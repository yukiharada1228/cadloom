/**
 * Exact NURBS forms of analytic curves: circular and elliptical arcs as rational quadratic
 * B-splines (The NURBS Book A7.1 MakeNurbsCircle) and lines as degree-1 B-splines.
 *
 * A7.1: the sweep `θ = end - start` is split into `n` equal segments (`n = 1` for `θ <= 90°`,
 * 2 for `<= 180°`, 3 for `<= 270°`, else 4); segment `i` of angle `Δ = θ / n` has the end points
 * on the circle, the middle control point at the intersection of the end tangents,
 * `(cos m, sin m) / cos(Δ/2)` with `m` the mid angle (computed as `(P_i + P_{i+1}) / (2 cos²(Δ/2))`
 * from the segment's end points), and middle weight `cos(Δ/2)`. Interior
 * knots are double. Deviation from A7.1: the knot values are the segment boundary **angles**
 * (`start, start, start, a1, a1, ..., end, end, end`) instead of `[0, 1]`, so the NURBS
 * parameter equals the angle at every knot.
 *
 * Exactness (formal model `CadloomFormal.Curve`, formal/CadloomFormal/Curve.lean):
 * `arc_on_unit_circle` (every segment point is on the unit circle), `arc_denominator_pos`
 * (no pole), `arc_mid_from_ends` (the middle point computed from the end points), `arc_reparam_x` / `arc_reparam_y` (the NURBS point at local parameter `t` is the
 * circle point at angle `m + 2 atan((2t - 1) tan(Δ/4))`, implemented by
 * `unitArcAngleOfParam` / `unitArcParamOfAngle`), `ellipse_arc_on_ellipse` (the affine image).
 * The 3D arcs are affine images `center + rx x · xAxis + ry y · yAxis` of the unit net; a
 * rational B-spline is affine invariant, so the image of the unit circle arc is exactly the
 * ellipse/circle arc (up to the rounding of the control points).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/curve/ellipse/p1.rs (make_nurb: rational quadratic elliptic
 *   arc over the angular domain), solidcore/crates/solidcore/src/curve/conic.rs,
 *   solidcore/crates/solidcore/src/curve/line.rs (the degree-1 NURB of a line).
 *   Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { add3, isFinite3, scale3, type Point3, type Vec3 } from '../math/vec.ts';
import { createNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { ROUNDING_SLACK, TWO_PI, conicRadii, type CircleCurve, type Curve3, type EllipseCurve, type LineCurve } from './types.ts';

/** The control net of a unit-circle arc (A7.1), in the plane: `x = cos`, `y = sin` directions. */
export interface UnitArcNet {
  /** Number of rational quadratic segments `n` (1..4). */
  readonly segments: number;
  /** `start, start, start, a1, a1, ..., a(n-1), a(n-1), end, end, end` (`2n + 4` knots). */
  readonly knots: readonly number[];
  /** `2n + 1` Euclidean control points `[x, y]`. */
  readonly points: readonly (readonly [number, number])[];
  /** `1, w_0, 1, w_1, ..., 1` with `w_i = cos((a_{i+1} - a_i)/2)` (equal up to rounding). */
  readonly weights: readonly number[];
}

/** Number of A7.1 segments for a sweep (radians), with slack for rounded multiples of 90°. */
function segmentCount(sweep: number): number {
  const q = (Math.PI / 2) * (1 + ROUNDING_SLACK);
  if (sweep <= q) return 1;
  if (sweep <= 2 * q) return 2;
  if (sweep <= 3 * q) return 3;
  return 4;
}

/**
 * The A7.1 net of the unit-circle arc from angle `start` to `end` (radians,
 * `0 < end - start <= 2π`). Usable as the angular factor of a surface of revolution: the net of
 * the circle of radius `r` about an axis is `axisPoint + r (x u + y v)` with the same knots and
 * weights.
 */
export function unitArcNet(start: number, end: number): Result<UnitArcNet> {
  const op = 'curve.unitArcNet';
  if (!Number.isFinite(start) || !Number.isFinite(end)) return invalidInput(op, 'non-finite angle');
  const sweep = end - start;
  if (!(sweep > 0) || !Number.isFinite(sweep)) return invalidInput(op, 'need start < end');
  if (sweep > TWO_PI * (1 + ROUNDING_SLACK)) return invalidInput(op, 'sweep exceeds 2π');
  const n = segmentCount(sweep);
  const delta = sweep / n;
  const angle = (i: number): number => (i === n ? end : start + i * delta);
  const knots: number[] = [start, start, start];
  for (let i = 1; i < n; i++) knots.push(angle(i), angle(i));
  knots.push(end, end, end);
  // Each segment is built from its own (rounded) knot angles `a_i`, `a_{i+1}`: end points on the
  // circle at exactly those angles, half-angle `φ = (a_{i+1} - a_i) / 2` (exact subtraction of
  // nearby doubles), weight `w = cos φ`, and middle point `(P_i + P_{i+1}) / (2 w²)` (the
  // intersection of the end tangents). So rounding of `start + i Δ` (large angles) cannot make a
  // segment's middle point inconsistent with its end points.
  const ends: (readonly [number, number])[] = [];
  for (let i = 0; i <= n; i++) {
    const a = angle(i);
    ends.push(Object.freeze([Math.cos(a), Math.sin(a)] as const));
  }
  const points: (readonly [number, number])[] = [];
  const weights: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p0 = ends[i]!;
    points.push(p0);
    weights.push(1);
    if (i < n) {
      const p1 = ends[i + 1]!;
      const w = Math.cos((angle(i + 1) - angle(i)) / 2);
      const k = 1 / (2 * w * w);
      points.push(Object.freeze([(p0[0] + p1[0]) * k, (p0[1] + p1[1]) * k] as const));
      weights.push(w);
    }
  }
  return ok(Object.freeze({ segments: n, knots: Object.freeze(knots), points: Object.freeze(points), weights: Object.freeze(weights) }));
}

/** Locates the segment of `net` containing knot-parameter `u`: `[index, a_i, a_{i+1}]`. */
function segmentOf(net: UnitArcNet, u: number): readonly [number, number, number] {
  const n = net.segments;
  for (let i = 0; i < n; i++) {
    const lo = net.knots[2 + 2 * i]!;
    const hi = net.knots[3 + 2 * i]!;
    if (u <= hi || i === n - 1) return [i, lo, hi];
  }
  return [n - 1, net.knots[2 * n]!, net.knots[2 * n + 1]!]; // unreachable: n >= 1
}

/**
 * The angle on the circle of the NURBS parameter `u` of `net` (exact inverse of the rational
 * reparametrisation, Lean `arc_reparam_x/_y`): in the segment `[a_i, a_{i+1}]` with
 * `τ = 2 (u - a_i) / (a_{i+1} - a_i) - 1`, the angle is `m + 2 atan(τ tan(Δ/4))`.
 */
export function unitArcAngleOfParam(net: UnitArcNet, u: number): number {
  const [, lo, hi] = segmentOf(net, u);
  const delta = hi - lo;
  const tau = (2 * (u - lo)) / delta - 1;
  const theta = (lo + hi) / 2 + 2 * Math.atan(tau * Math.tan(delta / 4));
  return Math.min(hi, Math.max(lo, theta)); // exact in the model; clamp the rounding
}

/** The NURBS parameter of `net` at which the arc passes through angle `theta` (in `[start, end]`). */
export function unitArcParamOfAngle(net: UnitArcNet, theta: number): number {
  const [, lo, hi] = segmentOf(net, theta);
  const delta = hi - lo;
  const tau = Math.tan((theta - (lo + hi) / 2) / 2) / Math.tan(delta / 4);
  return Math.min(hi, Math.max(lo, lo + ((tau + 1) / 2) * delta));
}

/**
 * The rational quadratic NURBS of the arc `center + rx cos θ · xAxis + ry sin θ · yAxis`,
 * `θ ∈ [start, end]` (A7.1). `xAxis` and `yAxis` need not be orthonormal: any affine image of the
 * unit circle arc is represented exactly. Knots are the segment angles (see the module comment).
 * A zero radius or parallel axes are accepted and give a collapsed (degenerate but valid) arc, e.g.
 * the pole row of a surface of revolution; callers wanting a true conic must check this.
 */
export function rationalQuadraticArc(
  center: Point3,
  xAxis: Vec3,
  yAxis: Vec3,
  rx: number,
  ry: number,
  start: number,
  end: number,
): Result<NurbsCurve> {
  const op = 'curve.rationalQuadraticArc';
  if (!isFinite3(center) || !isFinite3(xAxis) || !isFinite3(yAxis) || !Number.isFinite(rx) || !Number.isFinite(ry)) {
    return invalidInput(op, 'non-finite input');
  }
  const net = unitArcNet(start, end);
  if (!net.ok) return net;
  const ex = scale3(xAxis, rx);
  const ey = scale3(yAxis, ry);
  const pts = net.value.points.map(([x, y]) => {
    const p = add3(center, add3(scale3(ex, x), scale3(ey, y)));
    return [p.x, p.y, p.z];
  });
  for (const p of pts) if (!p.every(Number.isFinite)) return invalidInput(op, 'control point overflows');
  return createNurbsCurve(2, net.value.knots, pts, net.value.weights);
}

/** The exact NURBS form of a circle (arc); the NURBS parameter equals the angle at the knots. */
export function circleArcToNurbs(circle: CircleCurve): Result<NurbsCurve> {
  const { xAxis, yAxis } = circle.frame;
  return rationalQuadraticArc(circle.center, xAxis, yAxis, circle.radius, circle.radius, circle.range[0], circle.range[1]);
}

/** The exact NURBS form of an ellipse (arc). */
export function ellipseArcToNurbs(ellipse: EllipseCurve): Result<NurbsCurve> {
  const { xAxis, yAxis } = ellipse.frame;
  const [a, b] = conicRadii(ellipse);
  return rationalQuadraticArc(ellipse.center, xAxis, yAxis, a, b, ellipse.range[0], ellipse.range[1]);
}

/** The exact NURBS form of a line: degree 1, knots `[t0, t0, t1, t1]`, same parametrisation. */
export function lineToNurbs(line: LineCurve): Result<NurbsCurve> {
  const [t0, t1] = line.range;
  const a = add3(line.origin, scale3(line.direction, t0));
  const b = add3(line.origin, scale3(line.direction, t1));
  return createNurbsCurve(1, [t0, t0, t1, t1], [[a.x, a.y, a.z], [b.x, b.y, b.z]]);
}

/** The exact NURBS form of any `Curve3` (a NURBS curve is returned as is). */
export function curveToNurbs(curve: Curve3): Result<NurbsCurve> {
  switch (curve.kind) {
    case 'line':
      return lineToNurbs(curve);
    case 'circle':
      return circleArcToNurbs(curve);
    case 'ellipse':
      return ellipseArcToNurbs(curve);
    case 'nurbs':
      return ok(curve.curve);
  }
}
