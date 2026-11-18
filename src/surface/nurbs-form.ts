/**
 * Exact NURBS forms of the analytic surfaces over a parameter box, and the general surface of
 * revolution (The NURBS Book A8.1 MakeRevolvedSurf).
 *
 * A8.1 (`revolveCurveToNurbs`): for every control point `P_j` (weight `w_j`) of the profile, its
 * foot `O_j` on the axis, radial vector `P_j - O_j = r_j X_j` (`X_j` unit; any unit vector
 * orthogonal to the axis when `r_j = 0`) and `Y_j = A × X_j` (`A` the unit axis) give the circle
 * of `P_j` about the axis. Row `j` of the net is the A7.1 arc of that circle built by
 * `rationalQuadraticArc` of src/curve/conic.ts (the arc construction is not repeated here):
 * `P_ij = O_j + r_j (x_i X_j + y_i Y_j)` with the unit-arc net `(x_i, y_i)`, weight `w_i`. The
 * surface weight is the product `w_i w_j`. Since a rotation is linear and the arc's rational
 * parametrisation does not depend on `j`, the surface is exactly
 * `S(a, b) = Rot_{θ(a)}(C(b))` where `θ(a)` is the arc's angle at its NURBS parameter `a`
 * (`unitArcAngleOfParam`; the knots are the segment angles so `θ = a` at every knot). Lean:
 * `rotate_axis_distance` (rotation keeps the distance to the axis), `revolve_tensor_x/_y/_z/_w`
 * (the tensor-product numerator and denominator factor into arc × profile), and the
 * consequences `revolve_sphere`, `revolve_torus`, `revolve_cone`, and for the concrete symbolic
 * patch of `sphereToNurbs` (one A7.1 segment per direction, middle points as `unitArcNet`
 * computes them) `sphere_segment_patch`.
 *
 * Direction convention: the NURBS `u` (first index of the net, degree 2) is the rotation, `v` is
 * the profile's own parameter (its degree and knots).
 *
 * Analytic patches over `[u0, u1] × [v0, v1]` (all built so that the NURBS domain is that box and
 * `S_nurbs(a, b) = S(θ(a), φ(b))` with the angle maps of the arcs, identity at the knots):
 * - plane: bilinear, degree 1×1, knots `[u0,u0,u1,u1] × [v0,v0,v1,v1]`, the same
 *   parametrisation exactly;
 * - cylinder / cone: the generator line `origin + R(v) X + v Z`, `v ∈ [v0, v1]` (`lineToNurbs`,
 *   degree 1, parameter = `v` exactly) revolved by `[u0, u1]`; a cone box must stay on the nappe
 *   (`R(v0), R(v1) >= 0`);
 * - sphere: the meridian arc `center + r cos v X + r sin v Z`, `v ∈ [v0, v1] ⊂ [-π/2, π/2]`
 *   (`rationalQuadraticArc`), revolved by `[u0, u1]`;
 * - torus: the tube arc `center + (R + r cos v) X + r sin v Z`, `v ∈ [v0, v1]`, revolved.
 * Angular sweeps satisfy `0 < u1 - u0 <= 2π` (and `v1 - v0 <= 2π` for the torus).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/surface/surf_of_revolution.rs (MakeNurb: the profile's
 *   control points swept by the rational arc, weights multiplied), surface/cone/p1.rs
 *   (make_nurb), surface/sphere.rs, surface/torus.rs, surface/plane/p1.rs (the bilinear NURB of a
 *   plane). Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { add3, cross3, dot3, isFinite3, length3, normalize3, scale3, sub3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { ROUNDING_SLACK, TWO_PI, createLineCurve } from '../curve/types.ts';
import { lineToNurbs, rationalQuadraticArc } from '../curve/conic.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { createNurbsSurface, type NurbsSurface } from '../nurbs/surface.ts';
import { coneRadiusAt } from './evaluate.ts';
import {
  fromLocal,
  type ConeSurface,
  type CylinderSurface,
  type PlaneSurface,
  type SphereSurface,
  type Surface3,
  type TorusSurface,
} from './types.ts';

/** A parameter box `[[u0, u1], [v0, v1]]`. */
export interface ParamBox {
  readonly u: readonly [number, number];
  readonly v: readonly [number, number];
}

function checkInterval(op: string, what: string, r: readonly [number, number], maxSweep?: number): Result<void> {
  const [a, b] = r;
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(a < b) || !Number.isFinite(b - a)) {
    return invalidInput(op, `${what} range must be finite with start < end`);
  }
  if (maxSweep !== undefined && b - a > maxSweep * (1 + ROUNDING_SLACK)) return invalidInput(op, `${what} sweep exceeds 2π`);
  return ok(undefined);
}

const toArr = (p: Point3): number[] => [p.x, p.y, p.z];

/**
 * `normalize3` that also rejects a non-finite quotient: for a subnormal length `1 / len`
 * overflows and M0 `normalize3` returns infinite components.
 */
function unitOrUndefined(v: Vec3): Vec3 | undefined {
  const u = normalize3(v);
  return u !== undefined && isFinite3(u) ? u : undefined;
}

/** Any unit vector orthogonal to the finite unit vector `a` (deterministic). */
function anyPerpendicular(a: Vec3): Vec3 {
  const ax = Math.abs(a.x), ay = Math.abs(a.y), az = Math.abs(a.z);
  const helper = ax <= ay && ax <= az ? vec3(1, 0, 0) : ay <= az ? vec3(0, 1, 0) : vec3(0, 0, 1);
  // `a` is a unit vector and `helper` its smallest component's axis, so `|a × helper|² >= 2/3`.
  return unitOrUndefined(cross3(a, helper)) ?? vec3(0, 0, 0);
}

/**
 * A8.1: the surface swept by rotating `profile` (a 3D NURBS curve) about the line through
 * `axisPoint` along `axisDirection` (right-handed) by the angles `[startAngle, endAngle]`
 * (radians, `0 < end - start <= 2π`). `u` = rotation, `v` = profile parameter.
 */
export function revolveCurveToNurbs(
  profile: NurbsCurve,
  axisPoint: Point3,
  axisDirection: Vec3,
  startAngle: number,
  endAngle: number,
): Result<NurbsSurface> {
  const op = 'surface.revolveCurveToNurbs';
  if (profile.dimension !== 3) return invalidInput(op, 'profile must be a 3D curve');
  if (!isFinite3(axisPoint) || !isFinite3(axisDirection)) return invalidInput(op, 'non-finite axis');
  const A = unitOrUndefined(axisDirection);
  if (A === undefined) return invalidInput(op, 'axis direction of zero or subnormal length');
  const net: number[][][] = [];
  const weights: number[][] = [];
  let knotsU: readonly number[] = [];
  const pw = profile.weights;
  for (let j = 0; j < profile.controlPoints.length; j++) {
    const c = profile.controlPoints[j]!;
    const P = vec3(c[0]!, c[1]!, c[2]!);
    const h = dot3(sub3(P, axisPoint), A);
    const Oj = add3(axisPoint, scale3(A, h));
    if (!isFinite3(Oj)) return invalidInput(op, 'axis foot overflows');
    const radial = sub3(P, Oj);
    // A subnormal radial vector counts as on the axis (its unit vector is not representable).
    const unit = unitOrUndefined(radial);
    const X = unit ?? anyPerpendicular(A);
    const r = unit === undefined ? 0 : length3(radial);
    const Y = cross3(A, X);
    const arc = rationalQuadraticArc(Oj, X, Y, r, r, startAngle, endAngle);
    if (!arc.ok) return arc;
    knotsU = arc.value.knots;
    const wj = pw === undefined ? 1 : pw[j]!;
    const aw = arc.value.weights!;
    arc.value.controlPoints.forEach((q, i) => {
      (net[i] ??= []).push(q.slice());
      (weights[i] ??= []).push(aw[i]! * wj);
    });
  }
  return createNurbsSurface(2, profile.degree, knotsU, profile.knots, net, weights);
}

/** The bilinear NURBS of a plane over `box`, with the plane's own parametrisation. */
export function planeToNurbs(plane: PlaneSurface, box: ParamBox): Result<NurbsSurface> {
  const op = 'surface.planeToNurbs';
  const cu = checkInterval(op, 'u', box.u);
  if (!cu.ok) return cu;
  const cv = checkInterval(op, 'v', box.v);
  if (!cv.ok) return cv;
  const [u0, u1] = box.u, [v0, v1] = box.v;
  const at = (u: number, v: number): number[] => toArr(fromLocal(plane.frame, plane.origin, u, v, 0));
  const net = [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]];
  for (const row of net) for (const p of row) if (!p.every(Number.isFinite)) return invalidInput(op, 'control point overflows');
  return createNurbsSurface(1, 1, [u0, u0, u1, u1], [v0, v0, v1, v1], net);
}

/** The generator line `origin + R(v) X + v Z` of a cylinder / cone as a degree-1 NURBS over `[v0, v1]`. */
function generator(s: CylinderSurface | ConeSurface, v: readonly [number, number]): Result<NurbsCurve> {
  const { xAxis: X, normal: Z } = s.frame;
  const [b, t] = s.kind === 'cylinder' ? [s.radius, 0] : [s.baseRadius, Math.tan(s.semiAngle)];
  const line = createLineCurve(add3(s.origin, scale3(X, b)), add3(scale3(X, t), Z), v);
  if (!line.ok) return line;
  return lineToNurbs(line.value);
}

/** The exact NURBS of a cylinder or cone patch (see the module comment). */
export function ruledRevolutionToNurbs(s: CylinderSurface | ConeSurface, box: ParamBox): Result<NurbsSurface> {
  const op = s.kind === 'cylinder' ? 'surface.cylinderToNurbs' : 'surface.coneToNurbs';
  const cu = checkInterval(op, 'u', box.u, TWO_PI);
  if (!cu.ok) return cu;
  const cv = checkInterval(op, 'v', box.v);
  if (!cv.ok) return cv;
  if (s.kind === 'cone') {
    const t = Math.tan(s.semiAngle);
    if (box.v.some((v) => coneRadiusAt(s.baseRadius, t, v) === undefined)) {
      return invalidInput(op, 'cone patch crosses the apex (R(v) < 0)');
    }
  }
  const g = generator(s, box.v);
  if (!g.ok) return g;
  return revolveCurveToNurbs(g.value, s.origin, s.frame.normal, box.u[0], box.u[1]);
}

/** The exact NURBS of a cylinder patch (generator line revolved). */
export function cylinderToNurbs(s: CylinderSurface, box: ParamBox): Result<NurbsSurface> {
  return ruledRevolutionToNurbs(s, box);
}

/** The exact NURBS of a cone patch on the nappe (generator line revolved). */
export function coneToNurbs(s: ConeSurface, box: ParamBox): Result<NurbsSurface> {
  return ruledRevolutionToNurbs(s, box);
}

/** The exact NURBS of a sphere patch: `v ⊂ [-π/2, π/2]`. */
export function sphereToNurbs(s: SphereSurface, box: ParamBox): Result<NurbsSurface> {
  const op = 'surface.sphereToNurbs';
  const cu = checkInterval(op, 'u', box.u, TWO_PI);
  if (!cu.ok) return cu;
  const cv = checkInterval(op, 'v', box.v);
  if (!cv.ok) return cv;
  const half = (Math.PI / 2) * (1 + ROUNDING_SLACK);
  if (box.v[0] < -half || box.v[1] > half) return invalidInput(op, 'latitude range must lie in [-π/2, π/2]');
  const { xAxis: X, normal: Z } = s.frame;
  const meridian = rationalQuadraticArc(s.center, X, Z, s.radius, s.radius, box.v[0], box.v[1]);
  if (!meridian.ok) return meridian;
  return revolveCurveToNurbs(meridian.value, s.center, Z, box.u[0], box.u[1]);
}

/** The exact NURBS of a torus patch. */
export function torusToNurbs(s: TorusSurface, box: ParamBox): Result<NurbsSurface> {
  const op = 'surface.torusToNurbs';
  const cu = checkInterval(op, 'u', box.u, TWO_PI);
  if (!cu.ok) return cu;
  const cv = checkInterval(op, 'v', box.v, TWO_PI);
  if (!cv.ok) return cv;
  const { xAxis: X, normal: Z } = s.frame;
  const tube = rationalQuadraticArc(add3(s.center, scale3(X, s.majorRadius)), X, Z, s.minorRadius, s.minorRadius, box.v[0], box.v[1]);
  if (!tube.ok) return tube;
  return revolveCurveToNurbs(tube.value, s.center, Z, box.u[0], box.u[1]);
}

/**
 * The exact NURBS form of any `Surface3` over `box` (the box is ignored for a NURBS surface,
 * which is returned as is).
 */
export function surfaceToNurbs(s: Surface3, box: ParamBox): Result<NurbsSurface> {
  switch (s.kind) {
    case 'plane':
      return planeToNurbs(s, box);
    case 'cylinder':
    case 'cone':
      return ruledRevolutionToNurbs(s, box);
    case 'sphere':
      return sphereToNurbs(s, box);
    case 'torus':
      return torusToNurbs(s, box);
    case 'nurbs':
      return ok(s.surface);
  }
}
