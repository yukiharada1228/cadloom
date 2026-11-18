/**
 * The prism layout shared by every "profile moved from a start plane to an end plane" solid: `extrude` (this
 * directory) and the translational and skinned sweeps of `src/sweep/sweep.ts`. One job, one place: the vertex,
 * edge, face and loop ids, the cap loops and the side loops are assigned here only, in the order
 * `formal/CadloomFormal/Prism.lean` models (`prism_euler_poincare`); the callers supply only the rail edges and the
 * side surfaces.
 *
 * - `placeSegment(kernel, plane, seg, a, b)` is the 3D edge geometry of a 2D profile segment lying on `plane` (its
 *   `(u, v)` are the segment's 2D coordinates) from the vertex point `a` to `b`: a line is the segment `a → b`; an
 *   arc is its own circle (normal `±n`, angle 0 at the arc's start, range `[0, |sweep|]`); a NURBS segment is the
 *   curve with its control points placed on the plane (`segmentNurbs3`). Also used by `revolve`.
 * - `buildPrismRegion(kernel, b, base, far, wires, layout)` adds one region as a new body of `b`. With `N` segments
 *   (wire by wire, outer first), `next(g)` the following segment of the same wire (cyclically):
 *   vertices bottom `b_g = g` then top `t_g = N + g`; edges bottom `B_g` (`placeSegment` on `base`), top `T_g`
 *   (`placeSegment` on `far`), rail `S_g` (`b_g → t_g`, `layout.rail`); faces bottom (`base`, reversed: one loop
 *   per wire run backwards), top (`far`: one loop per wire forwards), then side `g` (`layout.side`) with the loop
 *   `[B_g fwd, S_next(g) fwd, T_g rev, S_g rev]`. So `V = 2N`, `E = 3N`, `F = N + 2`, `L = N + 2(1 + H)`.
 *
 * Upstream consulted (for the conventions, not translated): `solidcore/crates/solidcore/src/prism/extrude.rs`
 * (`extrude_region`), `solidcore/crates/solidcore/src/prism/profile.rs` (`curve_on_frame`: an arc as its own
 * circle with angle 0 at its start, a clockwise arc about the reversed normal), `sweep/api_brep.rs` (capped
 * sweeps) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { scale3, type Point3 } from '../math/vec.ts';
import { createCircleCurve, createNurbsCurve3, createSegmentCurve, TWO_PI, type Curve3 } from '../curve/types.ts';
import { createNurbsCurve, curveDomain, type NurbsCurve } from '../nurbs/curve.ts';
import { fromLocal, vecFromLocal, type PlaneSurface, type Surface3 } from '../surface/types.ts';
import type { BrepBuilder, CoedgeUse, EdgeId, VertexId } from '../topology/brep.ts';
import { planePcurve } from '../topology/geometry.ts';
import { isFullCircle, segmentStart, segmentToNurbs, type Segment2, type Wire2 } from '../profile/segment.ts';

/** An edge's curve and interval. */
export interface EdgeGeom {
  readonly curve: Curve3;
  readonly t0: number;
  readonly t1: number;
}

/** The point of plane coordinates `(x, y)`. */
export const onPlane = (p: PlaneSurface, x: number, y: number): Point3 => fromLocal(p.frame, p.origin, x, y, 0);

/** Absolute sweep of an arc, exactly `2π` for a full circle. */
export const arcSpan = (s: Segment2 & { kind: 'arc' }): number => (isFullCircle(s) ? TWO_PI : Math.abs(s.endAngle - s.startAngle));

/** The `[0, 1]` knots of `knots` over its domain `[a, b]` (end values exact, so iso-line pcurves stay in the domain). */
export function unitKnots(knots: readonly number[], a: number, b: number): readonly number[] {
  const w = b - a;
  return knots.map((k) => (k <= a ? 0 : k >= b ? 1 : (k - a) / w));
}

/** The exact NURBS form of `seg` (in its direction) with its control points placed on plane `p` (dimension 3). */
export function segmentNurbs3(p: PlaneSurface, seg: Segment2): Result<NurbsCurve> {
  const c = segmentToNurbs(seg);
  if (!c.ok) return c;
  const pts = c.value.controlPoints.map((q) => {
    const w = onPlane(p, q[0]!, q[1]!);
    return [w.x, w.y, w.z];
  });
  if (!pts.every((q) => q.every(Number.isFinite))) return invalidInput('prism.layout', 'placed control point overflows');
  return createNurbsCurve(c.value.degree, c.value.knots, pts, c.value.weights);
}

/** The curve of segment `seg` on plane `p`, from `a` (its start vertex) to `b` (its end vertex). */
export function placeSegment(kernel: Kernel, p: PlaneSurface, seg: Segment2, a: Point3, b: Point3): Result<EdgeGeom> {
  switch (seg.kind) {
    case 'line': {
      const c = createSegmentCurve(a, b);
      return c.ok ? ok({ curve: c.value, t0: 0, t1: 1 }) : c;
    }
    case 'arc': {
      const n = p.frame.normal;
      const span = arcSpan(seg);
      const dir = vecFromLocal(p.frame, Math.cos(seg.startAngle), Math.sin(seg.startAngle), 0);
      const c = createCircleCurve(kernel, onPlane(p, seg.center.x, seg.center.y), seg.ccw ? n : scale3(n, -1), dir, seg.radius, [0, span]);
      return c.ok ? ok({ curve: c.value, t0: 0, t1: span }) : c;
    }
    case 'nurbs': {
      const nc = segmentNurbs3(p, seg);
      if (!nc.ok) return nc;
      const c = createNurbsCurve3(nc.value);
      if (!c.ok) return c;
      const [t0, t1] = curveDomain(nc.value);
      return ok({ curve: c.value, t0, t1 });
    }
  }
}

/** A side face: its surface, sense, and the pcurves of its loop `[B fwd, S_next fwd, T rev, S rev]`. */
export interface PrismSide {
  readonly surface: Surface3;
  readonly reversed: boolean;
  readonly pcurves: readonly [NurbsCurve, NurbsCurve, NurbsCurve, NurbsCurve];
}

/** The edges bounding side `index` (global segment index), as `buildPrismRegion` placed them. */
export interface PrismSideEdges {
  readonly index: number;
  readonly segment: Segment2;
  readonly bottom: EdgeGeom;
  readonly top: EdgeGeom;
  readonly railNext: EdgeGeom;
  readonly rail: EdgeGeom;
}

/** What differs between the prism-shaped solids: the rails `b_g → t_g` and the side faces. */
export interface PrismLayout {
  readonly rail: (index: number, from: Point3, to: Point3) => Result<EdgeGeom>;
  readonly side: (edges: PrismSideEdges) => Result<PrismSide>;
}

/** Adds one region (`wires`, outer first) as a new body of `b` in the prism layout (see the module comment). */
export function buildPrismRegion(
  kernel: Kernel,
  b: BrepBuilder,
  base: PlaneSurface,
  far: PlaneSurface,
  wires: readonly Wire2[],
  layout: PrismLayout,
): Result<void> {
  const segs: Segment2[] = [];
  const nextOf: number[] = [];
  const wireStart: number[] = [];
  for (const w of wires) {
    const o = segs.length;
    wireStart.push(o);
    w.forEach((s, j) => {
      segs.push(s);
      nextOf.push(o + ((j + 1) % w.length));
    });
  }
  const N = segs.length;
  const shell = b.addShell(b.addBody());
  const q = segs.map(segmentStart);
  const bp = q.map((p) => onPlane(base, p.x, p.y));
  const tp = q.map((p) => onPlane(far, p.x, p.y));
  const bv: VertexId[] = bp.map((p) => b.addVertex(p));
  const tv: VertexId[] = tp.map((p) => b.addVertex(p));

  const bottom: EdgeGeom[] = [], top: EdgeGeom[] = [], rail: EdgeGeom[] = [];
  for (let g = 0; g < N; g++) {
    const r = placeSegment(kernel, base, segs[g]!, bp[g]!, bp[nextOf[g]!]!);
    if (!r.ok) return r;
    bottom.push(r.value);
  }
  for (let g = 0; g < N; g++) {
    const r = placeSegment(kernel, far, segs[g]!, tp[g]!, tp[nextOf[g]!]!);
    if (!r.ok) return r;
    top.push(r.value);
  }
  for (let g = 0; g < N; g++) {
    const r = layout.rail(g, bp[g]!, tp[g]!);
    if (!r.ok) return r;
    rail.push(r.value);
  }
  const addEdges = (geoms: readonly EdgeGeom[], from: readonly VertexId[], to: (g: number) => VertexId): EdgeId[] =>
    geoms.map((e, g) => b.addEdge(from[g]!, to(g), e.curve, e.t0, e.t1));
  const B = addEdges(bottom, bv, (g) => bv[nextOf[g]!]!);
  const T = addEdges(top, tv, (g) => tv[nextOf[g]!]!);
  const S = addEdges(rail, bv, (g) => tv[g]!);

  // Caps: the bottom runs every wire backwards (outward normal -n), the top forwards.
  const bottomFace = b.addFace(shell, base, true);
  for (const [k, w] of wires.entries()) {
    const uses: CoedgeUse[] = [];
    for (let j = w.length - 1; j >= 0; j--) {
      const g = wireStart[k]! + j;
      const pc = planePcurve(kernel, base, bottom[g]!, true);
      if (!pc.ok) return pc;
      uses.push({ edge: B[g]!, reversed: true, pcurve: pc.value });
    }
    b.addLoop(bottomFace, uses);
  }
  const topFace = b.addFace(shell, far, false);
  for (const [k, w] of wires.entries()) {
    const uses: CoedgeUse[] = [];
    for (let j = 0; j < w.length; j++) {
      const g = wireStart[k]! + j;
      const pc = planePcurve(kernel, far, top[g]!, false);
      if (!pc.ok) return pc;
      uses.push({ edge: T[g]!, reversed: false, pcurve: pc.value });
    }
    b.addLoop(topFace, uses);
  }

  // Sides.
  for (let g = 0; g < N; g++) {
    const nx = nextOf[g]!;
    const side = layout.side({ index: g, segment: segs[g]!, bottom: bottom[g]!, top: top[g]!, railNext: rail[nx]!, rail: rail[g]! });
    if (!side.ok) return side;
    const [p0, p1, p2, p3] = side.value.pcurves;
    const f = b.addFace(shell, side.value.surface, side.value.reversed);
    b.addLoop(f, [
      { edge: B[g]!, reversed: false, pcurve: p0 },
      { edge: S[nx]!, reversed: false, pcurve: p1 },
      { edge: T[g]!, reversed: true, pcurve: p2 },
      { edge: S[g]!, reversed: true, pcurve: p3 },
    ]);
  }
  return ok(undefined);
}
