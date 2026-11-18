/**
 * Analytic 3D curves (line, circle, ellipse) and NURBS curves of dimension 3 as one
 * discriminated union `Curve3`, with validated constructors and an orthonormal frame builder.
 *
 * Parametrisations (all values frozen):
 * - line:    `C(t) = origin + t * direction`, `t ∈ range` (the direction is kept as given, not
 *            normalised, so the parameter is `|direction|` times arc length);
 * - circle:  `C(t) = center + r cos t · xAxis + r sin t · yAxis`, `t` in radians;
 * - ellipse: `C(t) = center + a cos t · xAxis + b sin t · yAxis`, `a` = major, `b` = minor radius;
 * - nurbs:   the M0 `NurbsCurve` (dimension 3) over its own knot domain.
 * `yAxis = normal × xAxis`, so the parameter runs counter-clockwise about `normal`.
 *
 * Decisions (documented deviations from the upstream classes):
 * - ranges are finite with `t0 < t1`; circle/ellipse ranges span at most `2π`;
 * - an ellipse with `minor > major` is rejected (`invalid-input`) rather than silently swapped,
 *   because swapping would shift the parametrisation by `π/2`; `minor = major` is allowed;
 * - the reference `xAxis` need not be exactly orthogonal to `normal`: its component orthogonal to
 *   the normal is used (Gram-Schmidt). It is rejected when it is within the kernel's angular
 *   tolerance of being parallel to the normal.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/curve/line.rs (SmLine: point + s·V over a domain),
 *   solidcore/crates/solidcore/src/curve/arc.rs (ArcDefinition, placement: unit axis, reference
 *   made square to the axis), solidcore/crates/solidcore/src/curve/ellipse.rs and ellipse/p1.rs
 *   (SmEllipse: `O + rx cos(s) X + ry sin(s) Y`), solidcore/crates/solidcore/src/curve/curve.rs
 *   (the curve kinds). Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, isFinite3, normalize3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { curveDomain } from '../nurbs/curve.ts';

export const TWO_PI = 2 * Math.PI;

/** Slack for comparisons that should be exact but went through a few roundings. */
export const ROUNDING_SLACK = 1e-12;

/** A right-handed orthonormal frame: `yAxis = normal × xAxis`. */
export interface CurveFrame {
  readonly normal: Vec3;
  readonly xAxis: Vec3;
  readonly yAxis: Vec3;
}

export interface LineCurve {
  readonly kind: 'line';
  readonly origin: Point3;
  /** Non-zero, not normalised: `C(t) = origin + t * direction`. */
  readonly direction: Vec3;
  readonly range: readonly [number, number];
}

export interface CircleCurve {
  readonly kind: 'circle';
  readonly center: Point3;
  readonly frame: CurveFrame;
  readonly radius: number;
  /** Angles in radians, `t0 < t1 <= t0 + 2π`. */
  readonly range: readonly [number, number];
}

export interface EllipseCurve {
  readonly kind: 'ellipse';
  readonly center: Point3;
  /** `xAxis` is the major-axis direction. */
  readonly frame: CurveFrame;
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly range: readonly [number, number];
}

export interface NurbsCurve3 {
  readonly kind: 'nurbs';
  /** A validated M0 NURBS curve with `dimension === 3`. */
  readonly curve: NurbsCurve;
}

export type Curve3 = LineCurve | CircleCurve | EllipseCurve | NurbsCurve3;

/** Frozen copy of `v` with `-0` normalised to `0` (shared with `src/surface/types.ts`; not re-exported publicly). */
export const freezeVec = (v: Vec3): Vec3 => Object.freeze({ x: v.x === 0 ? 0 : v.x, y: v.y === 0 ? 0 : v.y, z: v.z === 0 ? 0 : v.z });

/**
 * An orthonormal frame from a normal (any non-zero length) and a reference x direction (any
 * length, projected orthogonally to the normal). Errors: non-finite input, a zero normal or
 * reference, or a reference within `kernel.tolerances.angTolDeg` of the normal's direction.
 */
export function createCurveFrame(kernel: Kernel, normal: Vec3, xReference: Vec3): Result<CurveFrame> {
  const op = 'curve.createCurveFrame';
  if (!isFinite3(normal) || !isFinite3(xReference)) return invalidInput(op, 'non-finite frame vector');
  const n = normalize3(normal);
  if (n === undefined) return invalidInput(op, 'normal of zero length');
  const r = normalize3(xReference);
  if (r === undefined) return invalidInput(op, 'reference direction of zero length');
  const along = dot3(r, n);
  const perp = sub3(r, scale3(n, along));
  // |perp| = sin(angle between reference and normal).
  const sinAngle = Math.hypot(perp.x, perp.y, perp.z);
  if (!(sinAngle > Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180))) {
    return invalidInput(op, 'reference direction is parallel to the normal');
  }
  const x = normalize3(perp)!;
  const y = normalize3(cross3(n, x))!;
  return ok(Object.freeze({ normal: freezeVec(n), xAxis: freezeVec(x), yAxis: freezeVec(y) }));
}

function checkRange(op: string, range: readonly [number, number], angular: boolean): Result<readonly [number, number]> {
  const [t0, t1] = range;
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return invalidInput(op, 'non-finite parameter range');
  if (!(t0 < t1)) return invalidInput(op, 'parameter range must satisfy t0 < t1');
  if (!Number.isFinite(t1 - t0)) return invalidInput(op, 'parameter range overflows');
  if (angular && t1 - t0 > TWO_PI * (1 + ROUNDING_SLACK)) return invalidInput(op, 'angular range exceeds 2π');
  return ok(Object.freeze([t0, t1] as const));
}

function checkRadius(op: string, what: string, r: number): Result<number> {
  if (!Number.isFinite(r) || !(r > 0)) return invalidInput(op, `${what} must be finite and positive`);
  return ok(r);
}

/** A line `origin + t * direction` over `range`. */
export function createLineCurve(origin: Point3, direction: Vec3, range: readonly [number, number]): Result<LineCurve> {
  const op = 'curve.createLineCurve';
  if (!isFinite3(origin) || !isFinite3(direction)) return invalidInput(op, 'non-finite origin or direction');
  if (direction.x === 0 && direction.y === 0 && direction.z === 0) return invalidInput(op, 'direction of zero length');
  const rg = checkRange(op, range, false);
  if (!rg.ok) return rg;
  for (const t of rg.value) {
    if (!isFinite3(add3(origin, scale3(direction, t)))) return invalidInput(op, 'end point overflows');
  }
  // `d·d` must be a positive finite double: the projection parameter divides by it (a direction
  // like (1e-200, 0, 0) is non-zero but its `d·d` underflows to 0).
  const dd = dot3(direction, direction);
  if (!Number.isFinite(dd)) return invalidInput(op, 'direction too long');
  if (!(dd > 0)) return invalidInput(op, 'direction too short (|d|² underflows)');
  if (!Number.isFinite(Math.sqrt(dd) * (rg.value[1] - rg.value[0]))) return invalidInput(op, 'line length overflows');
  return ok(Object.freeze({ kind: 'line', origin: freezeVec(origin), direction: freezeVec(direction), range: rg.value }));
}

/** The segment from `a` (t = 0) to `b` (t = 1). */
export function createSegmentCurve(a: Point3, b: Point3): Result<LineCurve> {
  return createLineCurve(a, sub3(b, a), [0, 1]);
}

/** A circle (arc) about `center` in the plane orthogonal to `normal`, angle 0 along `xReference`. */
export function createCircleCurve(
  kernel: Kernel,
  center: Point3,
  normal: Vec3,
  xReference: Vec3,
  radius: number,
  range: readonly [number, number] = [0, TWO_PI],
): Result<CircleCurve> {
  const op = 'curve.createCircleCurve';
  if (!isFinite3(center)) return invalidInput(op, 'non-finite center');
  const r = checkRadius(op, 'radius', radius);
  if (!r.ok) return r;
  const frame = createCurveFrame(kernel, normal, xReference);
  if (!frame.ok) return frame;
  const rg = checkRange(op, range, true);
  if (!rg.ok) return rg;
  if (!isFinite3(add3(center, scale3(frame.value.xAxis, radius)))) return invalidInput(op, 'circle overflows');
  // Curvature `1/r` and length `r (t1 - t0)` must be finite doubles.
  if (!Number.isFinite(1 / radius) || !Number.isFinite(radius * (rg.value[1] - rg.value[0]))) {
    return invalidInput(op, 'radius out of the representable range');
  }
  return ok(Object.freeze({ kind: 'circle', center: freezeVec(center), frame: frame.value, radius, range: rg.value }));
}

/**
 * An ellipse (arc) about `center` in the plane orthogonal to `normal`, major axis along
 * `majorReference`. Requires `0 < minorRadius <= majorRadius` (no silent swap).
 */
export function createEllipseCurve(
  kernel: Kernel,
  center: Point3,
  normal: Vec3,
  majorReference: Vec3,
  majorRadius: number,
  minorRadius: number,
  range: readonly [number, number] = [0, TWO_PI],
): Result<EllipseCurve> {
  const op = 'curve.createEllipseCurve';
  if (!isFinite3(center)) return invalidInput(op, 'non-finite center');
  const a = checkRadius(op, 'major radius', majorRadius);
  if (!a.ok) return a;
  const b = checkRadius(op, 'minor radius', minorRadius);
  if (!b.ok) return b;
  if (minorRadius > majorRadius) return invalidInput(op, 'minor radius exceeds major radius');
  const frame = createCurveFrame(kernel, normal, majorReference);
  if (!frame.ok) return frame;
  const rg = checkRange(op, range, true);
  if (!rg.ok) return rg;
  if (!isFinite3(add3(center, scale3(frame.value.xAxis, majorRadius)))) return invalidInput(op, 'ellipse overflows');
  // The perimeter (≤ 2π a) must be a finite double and the axis ratio b/a must not underflow.
  if (!Number.isFinite(TWO_PI * majorRadius) || !(minorRadius / majorRadius > 0)) {
    return invalidInput(op, 'radii out of the representable range');
  }
  return ok(
    Object.freeze({ kind: 'ellipse', center: freezeVec(center), frame: frame.value, majorRadius, minorRadius, range: rg.value }),
  );
}

/** Wraps a validated M0 NURBS curve; it must have dimension 3. */
export function createNurbsCurve3(curve: NurbsCurve): Result<NurbsCurve3> {
  if (curve.dimension !== 3) return invalidInput('curve.createNurbsCurve3', 'NURBS curve must have dimension 3');
  return ok(Object.freeze({ kind: 'nurbs', curve }));
}

/** The parameter range of any curve (the knot domain for NURBS). */
export function curveRange(curve: Curve3): readonly [number, number] {
  return curve.kind === 'nurbs' ? curveDomain(curve.curve) : curve.range;
}

/** Internal: the in-plane semi-axes `(a, b)` of a circle or ellipse. */
export function conicRadii(curve: CircleCurve | EllipseCurve): readonly [number, number] {
  return curve.kind === 'circle' ? [curve.radius, curve.radius] : [curve.majorRadius, curve.minorRadius];
}
