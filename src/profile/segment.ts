/**
 * Boundary segments of a planar profile, in the profile plane's own 2D coordinates `(x, y)` (the plane
 * surface's `(u, v)`): line segments, circular arcs and 2D NURBS curves, with validated constructors,
 * evaluation by a fraction `s in [0, 1]`, tangents, reversal and the exact NURBS form.
 *
 * Parametrisations (`s in [0, 1]`, `s = 0` the start):
 * - line: `start + s (end - start)`;
 * - arc:  `center + radius (cos θ, sin θ)`, `θ = startAngle + s (endAngle - startAngle)`; counter-clockwise
 *         (`ccw`) exactly when `endAngle > startAngle`, with `0 < |endAngle - startAngle| <= 2π` (a sweep of `2π`
 *         is a full circle);
 * - nurbs: the M0 `NurbsCurve` (dimension 2) at `a + s (b - a)` over its knot domain `[a, b]`.
 *
 * Upstream consulted (for the segment kinds and their invariants, not translated):
 * `solidcore/crates/solidcore/src/prism/profile.rs` (`Seg2`: lines, arcs about a center from a start angle
 * with a signed sweep, Béziers; `Seg2::reversed`, `Seg2::spans` — an arc as rational quadratic spans) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { vec2, type Point2, type Vec2 } from '../math/vec.ts';
import { ROUNDING_SLACK, TWO_PI } from '../curve/types.ts';
import { unitArcNet } from '../curve/conic.ts';
import {
  createNurbsCurve,
  curveDerivatives,
  curveDomain,
  evaluateCurve,
  reverseNurbsCurve,
  type NurbsCurve,
} from '../nurbs/curve.ts';

export interface LineSegment2 {
  readonly kind: 'line';
  readonly start: Point2;
  readonly end: Point2;
}

export interface ArcSegment2 {
  readonly kind: 'arc';
  readonly center: Point2;
  readonly radius: number;
  /** Radians. The arc runs from `startAngle` to `endAngle`. */
  readonly startAngle: number;
  readonly endAngle: number;
  /** `endAngle > startAngle` (counter-clockwise) or `endAngle < startAngle` (clockwise). */
  readonly ccw: boolean;
}

export interface NurbsSegment2 {
  readonly kind: 'nurbs';
  /** A validated NURBS curve of dimension 2. */
  readonly curve: NurbsCurve;
}

export type Segment2 = LineSegment2 | ArcSegment2 | NurbsSegment2;

/** A closed wire: segments in order, each starting where the previous one ends (the last closes on the first). */
export type Wire2 = readonly Segment2[];

const OP = 'profile.segment';
const finite2 = (p: Point2): boolean =>
  typeof p === 'object' && p !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
const frozen2 = (x: number, y: number): Point2 => Object.freeze(vec2(x === 0 ? 0 : x, y === 0 ? 0 : y));

/** The line segment from `start` to `end` (finite points; length is checked by `createProfile`). */
export function lineSegment2(start: Point2, end: Point2): Result<LineSegment2> {
  if (!finite2(start) || !finite2(end)) return invalidInput(OP, 'non-finite line end point');
  return ok(Object.freeze({ kind: 'line', start: frozen2(start.x, start.y), end: frozen2(end.x, end.y) }));
}

/**
 * The arc of `radius` about `center` from `startAngle` to `endAngle` (radians). `ccw` defaults to the sign of
 * `endAngle - startAngle` and must agree with it. Fails unless every value is finite, `radius > 0` and
 * `0 < |endAngle - startAngle| <= 2π` (up to rounding).
 */
export function arcSegment2(center: Point2, radius: number, startAngle: number, endAngle: number, ccw?: boolean): Result<ArcSegment2> {
  if (!finite2(center) || !Number.isFinite(radius) || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) {
    return invalidInput(OP, 'non-finite arc data');
  }
  if (!(radius > 0) || !Number.isFinite(radius * radius)) return invalidInput(OP, 'arc radius must be positive and representable');
  const sweep = endAngle - startAngle;
  if (sweep === 0 || !Number.isFinite(sweep)) return invalidInput(OP, 'arc sweep must be non-zero');
  if (Math.abs(sweep) > TWO_PI * (1 + ROUNDING_SLACK)) return invalidInput(OP, 'arc sweep exceeds 2π');
  const dir = sweep > 0;
  if (ccw !== undefined && ccw !== dir) return invalidInput(OP, 'ccw disagrees with the sign of endAngle - startAngle');
  return ok(Object.freeze({ kind: 'arc', center: frozen2(center.x, center.y), radius, startAngle, endAngle, ccw: dir }));
}

/** A 2D NURBS segment; the curve must have dimension 2. */
export function nurbsSegment2(curve: NurbsCurve): Result<NurbsSegment2> {
  if (curve.dimension !== 2) return invalidInput(OP, 'a profile NURBS segment must have dimension 2');
  return ok(Object.freeze({ kind: 'nurbs', curve }));
}

/** Signed sweep `endAngle - startAngle` of an arc. */
export const arcSweep = (a: ArcSegment2): number => a.endAngle - a.startAngle;

/** Whether an arc is a full circle (`|sweep| = 2π` up to rounding). */
export const isFullCircle = (a: ArcSegment2): boolean => Math.abs(Math.abs(arcSweep(a)) - TWO_PI) <= TWO_PI * ROUNDING_SLACK;

const arcPoint = (a: ArcSegment2, theta: number): Point2 =>
  frozen2(a.center.x + a.radius * Math.cos(theta), a.center.y + a.radius * Math.sin(theta));

/** `a + s (b - a)`, exactly `b` at `s = 1`. */
const lerp = (a: number, b: number, s: number): number => (s === 1 ? b : a + s * (b - a));

/** The arc angle at fraction `s`. */
export const arcAngleAt = (a: ArcSegment2, s: number): number => lerp(a.startAngle, a.endAngle, s);

function nurbsPoint(c: NurbsCurve, s: number): Result<Point2> {
  const [lo, hi] = curveDomain(c);
  const p = evaluateCurve(c, Math.min(hi, Math.max(lo, lerp(lo, hi, s))));
  if (!p.ok) return p;
  return ok(frozen2(p.value[0]!, p.value[1]!));
}

/** The point at fraction `s in [0, 1]` of a segment. */
export function segmentPoint(seg: Segment2, s: number): Result<Point2> {
  if (!(s >= 0 && s <= 1)) return invalidInput(OP, 'fraction must lie in [0, 1]');
  switch (seg.kind) {
    case 'line':
      return ok(s === 0 ? seg.start : s === 1 ? seg.end : frozen2(lerp(seg.start.x, seg.end.x, s), lerp(seg.start.y, seg.end.y, s)));
    case 'arc':
      return ok(arcPoint(seg, arcAngleAt(seg, s)));
    case 'nurbs':
      return nurbsPoint(seg.curve, s);
  }
}

/** The start point (total: a validated NURBS curve evaluates at its domain start). */
export function segmentStart(seg: Segment2): Point2 {
  const p = segmentPoint(seg, 0);
  return p.ok ? p.value : frozen2(NaN, NaN);
}

/** The end point. */
export function segmentEnd(seg: Segment2): Point2 {
  const p = segmentPoint(seg, 1);
  return p.ok ? p.value : frozen2(NaN, NaN);
}

/** The derivative with respect to the fraction `s` (not normalised). */
export function segmentTangent(seg: Segment2, s: number): Result<Vec2> {
  if (!(s >= 0 && s <= 1)) return invalidInput(OP, 'fraction must lie in [0, 1]');
  switch (seg.kind) {
    case 'line':
      return ok(vec2(seg.end.x - seg.start.x, seg.end.y - seg.start.y));
    case 'arc': {
      const t = arcAngleAt(seg, s), w = arcSweep(seg) * seg.radius;
      return ok(vec2(-Math.sin(t) * w, Math.cos(t) * w));
    }
    case 'nurbs': {
      const [lo, hi] = curveDomain(seg.curve);
      const d = curveDerivatives(seg.curve, Math.min(hi, Math.max(lo, lerp(lo, hi, s))), 1);
      if (!d.ok) return d;
      const v = d.value[1]!;
      return ok(vec2(v[0]! * (hi - lo), v[1]! * (hi - lo)));
    }
  }
}

/** The same segment run the other way (a NURBS curve by `reverseNurbsCurve`). */
export function reverseSegment(seg: Segment2): Result<Segment2> {
  switch (seg.kind) {
    case 'line':
      return ok(Object.freeze({ kind: 'line', start: seg.end, end: seg.start }));
    case 'arc':
      return ok(Object.freeze({ ...seg, startAngle: seg.endAngle, endAngle: seg.startAngle, ccw: !seg.ccw }));
    case 'nurbs': {
      const r = reverseNurbsCurve(seg.curve);
      if (!r.ok) return r;
      return ok(Object.freeze({ kind: 'nurbs', curve: r.value }));
    }
  }
}

/** A wire run the other way: segments in reverse order, each reversed. */
export function reverseWire(wire: Wire2): Result<Wire2> {
  const out: Segment2[] = [];
  for (let i = wire.length - 1; i >= 0; i--) {
    const r = reverseSegment(wire[i]!);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(Object.freeze(out));
}

/**
 * The exact NURBS form of a segment, in its own direction, as a 2D curve: a line as degree 1 on `[0, 1]`, an arc
 * as the A7.1 rational quadratic net of `curve/conic.ts` (`unitArcNet`, knots the angles; a clockwise arc is
 * the counter-clockwise net reversed), a NURBS segment as itself.
 */
export function segmentToNurbs(seg: Segment2): Result<NurbsCurve> {
  switch (seg.kind) {
    case 'line':
      return createNurbsCurve(1, [0, 0, 1, 1], [[seg.start.x, seg.start.y], [seg.end.x, seg.end.y]]);
    case 'arc': {
      const lo = Math.min(seg.startAngle, seg.endAngle), hi = Math.max(seg.startAngle, seg.endAngle);
      const net = unitArcNet(lo, hi);
      if (!net.ok) return net;
      const { center: c, radius: r } = seg;
      const pts = net.value.points.map(([x, y]) => [c.x + r * x, c.y + r * y]);
      const ccwCurve = createNurbsCurve(2, net.value.knots, pts, net.value.weights);
      if (!ccwCurve.ok || seg.ccw) return ccwCurve;
      return reverseNurbsCurve(ccwCurve.value);
    }
    case 'nurbs':
      return ok(seg.curve);
  }
}
