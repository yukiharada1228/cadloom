/**
 * Planar profiles: a plane (an M1 `PlaneSurface`, whose `(u, v)` are the profile's 2D coordinates) and closed
 * wires of segments, validated and organised into regions (an outer wire less its holes) by `createProfile`.
 *
 * `createProfile(kernel, plane, wires)` checks, in order, failing with `invalid-input` naming the wire and
 * segment:
 * 1. every wire has at least one segment, at most `MAX_PROFILE_SEGMENTS` in all, and every segment is well
 *    formed (finite; an arc's radius positive with `0 < |sweep| <= 2π`; a NURBS curve of dimension 2);
 * 2. no segment is degenerate at the zone tolerance `zoneTol3d`: a line longer than it, an arc of radius and
 *    length above it, a NURBS segment with a sample farther than it from its start;
 * 3. each wire is closed: each segment ends within `zoneTol3d` of where the next one starts (the last closes on
 *    the first; a one-segment wire is a full circle or a closed NURBS curve);
 * 4. no wire folds back at a junction (opposite tangents within `angTolDeg`, `junctionCusp`);
 * 5. no two segments touch away from the junctions they share, and no NURBS segment touches itself
 *    (`segmentsContact`, `segmentSelfContact` in `intersect.ts`: exact `orient2d` for line pairs, analytic for
 *    arcs, recursive Bézier subdivision for NURBS);
 * 6. every wire encloses a positive area (more than `zoneTol3d²`).
 * Then each wire's nesting depth is the number of other wires containing its first vertex (`pointInWire`: exact
 * for line pieces); wires at even depth are outer boundaries of regions, at odd depth holes of the innermost
 * wire containing them. Orientation is normalised: outer wires counter-clockwise, holes clockwise (reversed
 * with `reverseWire` when needed). The sign is decided by the exact `loopOrientation` of `src/exact` for wires of
 * lines only, otherwise by the sign of the Green area.
 *
 * Upstream consulted (for the checks and regions, not translated): `solidcore/crates/solidcore/src/prism/profile.rs`
 * (`Region2`: an outer loop counter-clockwise less its holes clockwise; `check_regions`: loops closed, segments
 * finite and of some length, arcs built at the zone tolerance; `Loop2::holds`), `prism/measure.rs` —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { isFinite3, vec2, type Point2, type Point3 } from '../math/vec.ts';
import { fromLocal, type PlaneSurface } from '../surface/types.ts';
import { createNurbsCurve } from '../nurbs/curve.ts';
import { loopOrientation } from '../exact/polygon.ts';
import { wireGreen, wiresAreaProperties, type AreaProperties } from './area.ts';
import { junctionCusp, pointInWire, segmentsContact, segmentSelfContact } from './intersect.ts';
import {
  arcSegment2,
  lineSegment2,
  nurbsSegment2,
  reverseWire,
  segmentEnd,
  segmentPoint,
  segmentStart,
  type Segment2,
  type Wire2,
} from './segment.ts';

/** Most segments `createProfile` takes over all wires (the contact test is quadratic in this). */
export const MAX_PROFILE_SEGMENTS = 2000;

/** An outer wire (counter-clockwise) less its holes (clockwise). */
export interface ProfileRegion {
  readonly outer: Wire2;
  readonly holes: readonly Wire2[];
}

declare const profileBrand: unique symbol;

/**
 * A validated planar profile (made only by `createProfile`): its plane and its regions, in the plane's 2D
 * coordinates. Regions are listed in the order of their outer wires in the input, holes likewise.
 */
export interface Profile {
  readonly plane: PlaneSurface;
  readonly regions: readonly ProfileRegion[];
  readonly [profileBrand]: true;
}

const OP = 'profile.createProfile';
const where = (w: number, s: number): string => `wire ${w} segment ${s}`;

/** Re-checks a segment through its constructor (segments may be plain objects). */
function wellFormed(seg: Segment2): Result<Segment2> {
  switch (seg.kind) {
    case 'line':
      return lineSegment2(seg.start, seg.end);
    case 'arc':
      return arcSegment2(seg.center, seg.radius, seg.startAngle, seg.endAngle, seg.ccw);
    case 'nurbs': {
      const c = seg.curve;
      if (typeof c !== 'object' || c === null || !Array.isArray(c.knots) || !Array.isArray(c.controlPoints)) {
        return invalidInput(OP, 'malformed NURBS segment');
      }
      const v = createNurbsCurve(c.degree, c.knots, c.controlPoints, c.weights);
      return v.ok ? nurbsSegment2(v.value) : v;
    }
    default:
      return invalidInput(OP, 'unknown segment kind');
  }
}

/** Fractions at which a segment is sampled for its degeneracy check. */
const SAMPLES = 16;

function degenerate(seg: Segment2, tol: number): Result<boolean> {
  switch (seg.kind) {
    case 'line':
      return ok(!(Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y) > tol));
    case 'arc':
      return ok(!(seg.radius > tol) || !(seg.radius * Math.abs(seg.endAngle - seg.startAngle) > tol));
    case 'nurbs': {
      const s0 = segmentStart(seg);
      let far = 0;
      for (let k = 1; k <= SAMPLES; k++) {
        const p = segmentPoint(seg, k / SAMPLES);
        if (!p.ok) return p;
        if (!Number.isFinite(p.value.x) || !Number.isFinite(p.value.y)) return invalidInput(OP, 'NURBS segment does not evaluate to finite points');
        far = Math.max(far, Math.hypot(p.value.x - s0.x, p.value.y - s0.y));
      }
      return ok(!(far > tol));
    }
  }
}

/** Signed orientation of a wire: exact for wires of lines, else the sign of its Green area. */
function wireSign(wire: Wire2, area: number): Result<number> {
  if (wire.every((s) => s.kind === 'line')) {
    const pts = wire.map(segmentStart);
    const o = loopOrientation(pts, pts.map((_, i) => i));
    if (!o.ok) return o;
    if (o.value !== 0) return ok(o.value);
  }
  return ok(Math.sign(area));
}

/**
 * Validates `wires` on `plane` and organises them into regions (see the module comment).
 */
export function createProfile(kernel: Kernel, plane: PlaneSurface, wires: readonly Wire2[]): Result<Profile> {
  const tol = kernel.tolerances.zoneTol3d;
  if (plane.kind !== 'plane' || !isFinite3(plane.origin)) return invalidInput(OP, 'the profile needs a finite plane surface');
  if (wires.length === 0) return invalidInput(OP, 'a profile needs at least one wire');
  const total = wires.reduce((n, w) => n + w.length, 0);
  if (total > MAX_PROFILE_SEGMENTS) return invalidInput(OP, `more than ${MAX_PROFILE_SEGMENTS} segments`);

  // 1-2. Well-formed, non-degenerate segments.
  const ws: Segment2[][] = [];
  for (const [wi, w] of wires.entries()) {
    if (w.length === 0) return invalidInput(OP, `wire ${wi} has no segment`);
    const out: Segment2[] = [];
    for (const [si, s] of w.entries()) {
      const r = wellFormed(s);
      if (!r.ok) return invalidInput(OP, `${where(wi, si)}: ${r.error.kind === 'invalid-input' ? r.error.reason : r.error.kind}`);
      const d = degenerate(r.value, tol);
      if (!d.ok) return d;
      if (d.value) return invalidInput(OP, `${where(wi, si)} is degenerate (shorter than the zone tolerance)`);
      out.push(r.value);
    }
    ws.push(out);
  }

  // 3-4. Closed wires without cusps.
  for (const [wi, w] of ws.entries()) {
    for (let i = 0; i < w.length; i++) {
      const a = w[i]!, b = w[(i + 1) % w.length]!;
      const e = segmentEnd(a), s = segmentStart(b);
      const gap = Math.hypot(e.x - s.x, e.y - s.y);
      if (!(gap <= tol)) return invalidInput(OP, `wire ${wi} is open: segment ${i} ends ${gap} from where the next starts`);
      const c = junctionCusp(kernel, a, b);
      if (!c.ok) return c;
      if (c.value) return invalidInput(OP, `wire ${wi} folds back at the end of segment ${i}`);
    }
  }

  // 5. No contacts away from shared junctions.
  const flat: { readonly w: number; readonly i: number; readonly seg: Segment2 }[] = [];
  ws.forEach((w, wi) => w.forEach((seg, i) => flat.push({ w: wi, i, seg })));
  for (let x = 0; x < flat.length; x++) {
    const A = flat[x]!;
    const self = segmentSelfContact(kernel, A.seg, ws[A.w]!.length === 1);
    if (!self.ok) return self;
    if (self.value) return invalidInput(OP, `${where(A.w, A.i)} crosses itself`);
    for (let y = x + 1; y < flat.length; y++) {
      const B = flat[y]!;
      const js: Point2[] = [];
      if (A.w === B.w) {
        const n = ws[A.w]!.length;
        if (B.i === A.i + 1) js.push(segmentStart(B.seg));
        if (A.i === 0 && B.i === n - 1) js.push(segmentStart(A.seg));
      }
      const c = segmentsContact(kernel, A.seg, B.seg, js);
      if (!c.ok) return c;
      if (c.value) {
        return invalidInput(OP, A.w === B.w
          ? `wire ${A.w} crosses or touches itself (segments ${A.i} and ${B.i})`
          : `wires ${A.w} and ${B.w} cross or touch (segments ${A.i} and ${B.i})`);
      }
    }
  }

  // 6. Areas and orientation signs.
  const signs: number[] = [];
  for (const [wi, w] of ws.entries()) {
    const g = wireGreen(w);
    if (!g.ok) return g;
    if (!(Math.abs(g.value.area) > tol * tol)) return invalidInput(OP, `wire ${wi} encloses no area`);
    const s = wireSign(w, g.value.area);
    if (!s.ok) return s;
    signs.push(s.value);
  }

  // Nesting by containment of each wire's first vertex.
  const n = ws.length;
  const inside: boolean[][] = ws.map(() => new Array<boolean>(n).fill(false));
  for (let i = 0; i < n; i++) {
    const p = segmentStart(ws[i]![0]!);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const r = pointInWire(kernel, p, ws[j]!);
      if (!r.ok) return r;
      inside[i]![j] = r.value;
    }
  }
  const depth = inside.map((row) => row.filter(Boolean).length);
  const parent = inside.map((row, i) => {
    let best = -1;
    row.forEach((inJ, j) => {
      if (inJ && (best < 0 || depth[j]! > depth[best]!)) best = j;
    });
    return depth[i]! % 2 === 1 ? best : -1;
  });

  const oriented = (wi: number, ccw: boolean): Result<Wire2> => {
    const w = Object.freeze(ws[wi]!.slice());
    return (signs[wi]! > 0) === ccw ? ok(w) : reverseWire(w);
  };
  const regions: ProfileRegion[] = [];
  for (let i = 0; i < n; i++) {
    if (depth[i]! % 2 === 1) continue;
    const outer = oriented(i, true);
    if (!outer.ok) return outer;
    const holes: Wire2[] = [];
    for (let j = 0; j < n; j++) {
      if (parent[j] !== i) continue;
      const h = oriented(j, false);
      if (!h.ok) return h;
      holes.push(h.value);
    }
    regions.push(Object.freeze({ outer: outer.value, holes: Object.freeze(holes) }));
  }
  return ok(Object.freeze({ plane, regions: Object.freeze(regions) }) as Profile);
}

/** The wires of a region, outer first. */
export const regionWires = (r: ProfileRegion): readonly Wire2[] => [r.outer, ...r.holes];

/** Area and centroid (2D, in the plane's coordinates) of one region. */
export function regionAreaProperties(region: ProfileRegion): Result<AreaProperties> {
  return wiresAreaProperties(regionWires(region));
}

/** Area and centroid (2D) of a whole profile (all regions). */
export function profileAreaProperties(profile: Profile): Result<AreaProperties> {
  return wiresAreaProperties(profile.regions.flatMap(regionWires));
}

/** The area of a profile (positive). */
export function profileArea(profile: Profile): Result<number> {
  const a = profileAreaProperties(profile);
  return a.ok ? ok(a.value.area) : a;
}

/** The world point of profile coordinates `p`: `origin + p.x xAxis + p.y yAxis` of the plane. */
export function profilePoint(profile: Profile, p: Point2): Point3 {
  return fromLocal(profile.plane.frame, profile.plane.origin, p.x, p.y, 0);
}

/** The 2D point `(x, y)` (frozen). */
export const point2 = (x: number, y: number): Point2 => Object.freeze(vec2(x, y));
