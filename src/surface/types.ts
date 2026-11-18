/**
 * Analytic surfaces (plane, cylinder, cone, sphere, torus) and 3D NURBS surfaces as one
 * discriminated union `Surface3`, with validated constructors.
 *
 * Every analytic surface is placed by a right-handed orthonormal frame `(xAxis, yAxis, normal)`
 * (the M0/M1 `CurveFrame` of `src/curve/types.ts`, `yAxis = normal × xAxis`, built by
 * `createCurveFrame`; for the surfaces of revolution `normal` is the axis `Z`). With
 * `e(u) = cos u · xAxis + sin u · yAxis` (angles in radians, not upstream's degrees):
 *
 * - plane:    `S(u, v) = origin + u · xAxis + v · yAxis` (unit normal `xAxis × yAxis = normal`);
 * - cylinder: `S(u, v) = origin + r · e(u) + v · Z`;
 * - cone:     `S(u, v) = origin + R(v) · e(u) + v · Z`, `R(v) = baseRadius + tan(semiAngle) · v`
 *             (upstream `SmCone`: radius `baseRadius` at the origin, signed semi-angle, `v` the
 *             height along the axis; a negative semi-angle narrows along `Z`). Decision: the
 *             cone is the **single nappe** `R(v) >= 0`; evaluating past the apex
 *             (`R(v) < 0`) is `invalid-input`. `baseRadius >= 0` (0: the apex is the origin),
 *             `0 < |semiAngle| < π/2` (a zero semi-angle is a cylinder: use that kind);
 * - sphere:   `S(u, v) = center + r (cos v · e(u) + sin v · Z)`, `u` longitude, `v` latitude in
 *             `[-π/2, π/2]` (upstream `SmSphere` STEP evaluation);
 * - torus:    `S(u, v) = center + (R + r cos v) · e(u) + r sin v · Z` (upstream `SmTorus`).
 *             Decision: only the ring torus `R > r > 0` is accepted; the horn (`R = r`) and
 *             spindle (`R < r`) tori self-intersect and are `invalid-input`.
 * - nurbs:    an M1 `NurbsSurface` (src/nurbs/surface.ts) of dimension 3 over its knot domain.
 *
 * With these parametrisations `S_u × S_v` points away from the axis / center (outward) for the
 * cylinder, cone, sphere (`cos v > 0`) and torus, and along `normal` for the plane.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/surface/plane.rs, surface/plane/p1.rs (SmPlane),
 *   surface/cone.rs, surface/cone/p1.rs (SmCone / SmCylinder: base radius, signed semi-angle,
 *   `S = O + R(v)(cos u X + sin u Y) + v Z`), surface/sphere.rs (`S = O + r (cos v (cos u X +
 *   sin u Y) + sin v Z)`), surface/torus.rs (`S = O + (R + r cos v)(cos u X + sin u Y) + r sin v Z`,
 *   the radius checks), surface/implicit.rs (the implicit forms), eval/surface.rs (Axes).
 *   Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, isFinite3, scale3, type Point3, type Vec3 } from '../math/vec.ts';
import { createCurveFrame, freezeVec, type CurveFrame } from '../curve/types.ts';
import type { NurbsSurface } from '../nurbs/surface.ts';

/** A right-handed orthonormal frame `(xAxis, yAxis, normal)`, `yAxis = normal × xAxis` (the curve frame). */
export type SurfaceFrame = CurveFrame;

export interface PlaneSurface {
  readonly kind: 'plane';
  readonly origin: Point3;
  /** `normal` is the unit plane normal, `xAxis`, `yAxis` the parameter directions. */
  readonly frame: SurfaceFrame;
}

export interface CylinderSurface {
  readonly kind: 'cylinder';
  /** A point of the axis (`v = 0`). */
  readonly origin: Point3;
  /** `normal` is the axis direction `Z`; `u = 0` along `xAxis`. */
  readonly frame: SurfaceFrame;
  readonly radius: number;
}

export interface ConeSurface {
  readonly kind: 'cone';
  /** The axis point where the radius is `baseRadius` (`v = 0`). */
  readonly origin: Point3;
  readonly frame: SurfaceFrame;
  /** Radius at `origin`, `>= 0`. */
  readonly baseRadius: number;
  /** Signed semi-angle in radians, `0 < |semiAngle| < π/2`: `R(v) = baseRadius + tan(semiAngle) v`. */
  readonly semiAngle: number;
}

export interface SphereSurface {
  readonly kind: 'sphere';
  readonly center: Point3;
  /** `normal` is the polar axis (`v = π/2`); `u = 0` along `xAxis`. */
  readonly frame: SurfaceFrame;
  readonly radius: number;
}

export interface TorusSurface {
  readonly kind: 'torus';
  readonly center: Point3;
  readonly frame: SurfaceFrame;
  /** Distance from the axis to the center of the tube, `R > r`. */
  readonly majorRadius: number;
  /** Tube radius `r > 0`. */
  readonly minorRadius: number;
}

export interface NurbsSurface3 {
  readonly kind: 'nurbs';
  /** A validated NURBS surface with `dimension === 3`. */
  readonly surface: NurbsSurface;
}

export type AnalyticSurface3 = PlaneSurface | CylinderSurface | ConeSurface | SphereSurface | TorusSurface;
export type Surface3 = AnalyticSurface3 | NurbsSurface3;

function checkLength(op: string, what: string, r: number): Result<number> {
  if (!Number.isFinite(r) || !(r > 0)) return invalidInput(op, `${what} must be finite and positive`);
  // Curvatures 1/r and areas ~ r² must stay finite doubles.
  if (!Number.isFinite(1 / r) || !Number.isFinite(r * r) || !(r * r > 0)) {
    return invalidInput(op, `${what} out of the representable range`);
  }
  return ok(r);
}

function checkPoint(op: string, p: Point3, frame: SurfaceFrame, reach: number): Result<Point3> {
  if (!isFinite3(p)) return invalidInput(op, 'non-finite origin');
  if (!isFinite3(add3(p, scale3(frame.xAxis, reach)))) return invalidInput(op, 'surface overflows');
  return ok(freezeVec(p));
}

/** The plane through `origin` with unit normal along `normal`, `u` along `xReference` (projected). */
export function createPlaneSurface(kernel: Kernel, origin: Point3, normal: Vec3, xReference: Vec3): Result<PlaneSurface> {
  const op = 'surface.createPlaneSurface';
  const frame = createCurveFrame(kernel, normal, xReference);
  if (!frame.ok) return frame;
  const o = checkPoint(op, origin, frame.value, 0);
  if (!o.ok) return o;
  return ok(Object.freeze({ kind: 'plane', origin: o.value, frame: frame.value }));
}

/** The infinite cylinder of `radius` about the line through `origin` along `axis`. */
export function createCylinderSurface(
  kernel: Kernel,
  origin: Point3,
  axis: Vec3,
  xReference: Vec3,
  radius: number,
): Result<CylinderSurface> {
  const op = 'surface.createCylinderSurface';
  const r = checkLength(op, 'radius', radius);
  if (!r.ok) return r;
  const frame = createCurveFrame(kernel, axis, xReference);
  if (!frame.ok) return frame;
  const o = checkPoint(op, origin, frame.value, radius);
  if (!o.ok) return o;
  return ok(Object.freeze({ kind: 'cylinder', origin: o.value, frame: frame.value, radius }));
}

/**
 * The cone nappe `R(v) = baseRadius + tan(semiAngle) v >= 0` about the line through `origin`
 * along `axis` (see the module comment). Errors: `baseRadius < 0`, `semiAngle` zero, not finite
 * or with `|semiAngle| >= π/2`, and the frame errors of `createCurveFrame`.
 */
export function createConeSurface(
  kernel: Kernel,
  origin: Point3,
  axis: Vec3,
  xReference: Vec3,
  baseRadius: number,
  semiAngle: number,
): Result<ConeSurface> {
  const op = 'surface.createConeSurface';
  if (!Number.isFinite(baseRadius) || baseRadius < 0) return invalidInput(op, 'base radius must be finite and >= 0');
  if (!Number.isFinite(semiAngle) || semiAngle === 0 || !(Math.abs(semiAngle) < Math.PI / 2)) {
    return invalidInput(op, 'semi-angle must satisfy 0 < |semiAngle| < π/2 (use a cylinder for 0)');
  }
  const t = Math.tan(semiAngle);
  if (!Number.isFinite(t) || !(Math.cos(semiAngle) > 0) || t === 0) return invalidInput(op, 'semi-angle out of range');
  if (baseRadius > 0 && !Number.isFinite(baseRadius / t)) return invalidInput(op, 'apex out of the representable range');
  const frame = createCurveFrame(kernel, axis, xReference);
  if (!frame.ok) return frame;
  const o = checkPoint(op, origin, frame.value, baseRadius);
  if (!o.ok) return o;
  return ok(Object.freeze({ kind: 'cone', origin: o.value, frame: frame.value, baseRadius: baseRadius === 0 ? 0 : baseRadius, semiAngle }));
}

/** The sphere of `radius` about `center`, polar axis `axis`, longitude 0 along `xReference`. */
export function createSphereSurface(
  kernel: Kernel,
  center: Point3,
  axis: Vec3,
  xReference: Vec3,
  radius: number,
): Result<SphereSurface> {
  const op = 'surface.createSphereSurface';
  const r = checkLength(op, 'radius', radius);
  if (!r.ok) return r;
  const frame = createCurveFrame(kernel, axis, xReference);
  if (!frame.ok) return frame;
  const c = checkPoint(op, center, frame.value, radius);
  if (!c.ok) return c;
  return ok(Object.freeze({ kind: 'sphere', center: c.value, frame: frame.value, radius }));
}

/** The ring torus about the line through `center` along `axis`; requires `majorRadius > minorRadius > 0`. */
export function createTorusSurface(
  kernel: Kernel,
  center: Point3,
  axis: Vec3,
  xReference: Vec3,
  majorRadius: number,
  minorRadius: number,
): Result<TorusSurface> {
  const op = 'surface.createTorusSurface';
  const R = checkLength(op, 'major radius', majorRadius);
  if (!R.ok) return R;
  const r = checkLength(op, 'minor radius', minorRadius);
  if (!r.ok) return r;
  if (!(majorRadius > minorRadius)) {
    return invalidInput(op, 'need majorRadius > minorRadius (horn and spindle tori are not supported)');
  }
  if (!Number.isFinite(majorRadius + minorRadius)) return invalidInput(op, 'torus overflows');
  const frame = createCurveFrame(kernel, axis, xReference);
  if (!frame.ok) return frame;
  const c = checkPoint(op, center, frame.value, majorRadius + minorRadius);
  if (!c.ok) return c;
  return ok(Object.freeze({ kind: 'torus', center: c.value, frame: frame.value, majorRadius, minorRadius }));
}

/** Wraps a validated NURBS surface; it must have dimension 3. */
export function createNurbsSurface3(surface: NurbsSurface): Result<NurbsSurface3> {
  if (surface.dimension !== 3) return invalidInput('surface.createNurbsSurface3', 'NURBS surface must have dimension 3');
  return ok(Object.freeze({ kind: 'nurbs', surface }));
}

/** Internal: the origin / center of an analytic surface. */
export function surfaceOrigin(s: AnalyticSurface3): Point3 {
  return s.kind === 'sphere' || s.kind === 'torus' ? s.center : s.origin;
}

/** Coordinates of `p - o` in `frame`: `(x, y, z)` along `(xAxis, yAxis, normal)`. */
export function localCoordinates(frame: SurfaceFrame, o: Point3, p: Point3): readonly [number, number, number] {
  const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
  const { xAxis: X, yAxis: Y, normal: Z } = frame;
  return [dx * X.x + dy * X.y + dz * X.z, dx * Y.x + dy * Y.y + dz * Y.z, dx * Z.x + dy * Z.y + dz * Z.z];
}

/** `o + a xAxis + b yAxis + c normal`. */
export function fromLocal(frame: SurfaceFrame, o: Point3, a: number, b: number, c: number): Point3 {
  const { xAxis: X, yAxis: Y, normal: Z } = frame;
  return Object.freeze({
    x: o.x + a * X.x + b * Y.x + c * Z.x,
    y: o.y + a * X.y + b * Y.y + c * Z.y,
    z: o.z + a * X.z + b * Y.z + c * Z.z,
  });
}

/** `a xAxis + b yAxis + c normal` (a vector). */
export function vecFromLocal(frame: SurfaceFrame, a: number, b: number, c: number): Vec3 {
  const { xAxis: X, yAxis: Y, normal: Z } = frame;
  return Object.freeze({
    x: a * X.x + b * Y.x + c * Z.x,
    y: a * X.y + b * Y.y + c * Z.y,
    z: a * X.z + b * Y.z + c * Z.z,
  });
}
