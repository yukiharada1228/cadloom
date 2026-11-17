/**
 * Evaluation and differential geometry of `Surface3`: the point and the partial derivatives up to
 * second order, the unit normal, the first and second fundamental forms, the Gaussian, mean and
 * principal curvatures and the normal curvature in a tangent direction.
 *
 * Analytic surfaces are differentiated in closed form (formulas below, in the frame's local
 * coordinates with `e = cos u X + sin u Y`, `f = -sin u X + cos u Y`); NURBS surfaces use the M1
 * `surfaceDerivatives` (A3.6 / A4.4) of `src/nurbs/surface.ts`, never a second evaluator.
 *
 * | kind     | S_u            | S_v                    | S_uu        | S_uv          | S_vv                  |
 * |----------|----------------|------------------------|-------------|---------------|-----------------------|
 * | plane    | X              | Y                      | 0           | 0             | 0                     |
 * | cylinder | r f            | Z                      | -r e        | 0             | 0                     |
 * | cone     | R(v) f         | t e + Z (`t = tan α`)  | -R(v) e     | t f           | 0                     |
 * | sphere   | r cos v f      | r(-sin v e + cos v Z)  | -r cos v e  | -r sin v f    | -r(cos v e + sin v Z) |
 * | torus    | (R + r cos v) f| r(-sin v e + cos v Z)  | -(R+r cos v) e | -r sin v f | -r(cos v e + sin v Z) |
 *
 * Sign convention (fixed here, as upstream `eval/normal_section.rs`): the unit normal is
 * `n = (S_u × S_v) / |S_u × S_v|` — outward for the cylinder, cone, sphere and torus (Lean
 * `sphere_cross_eq`, `cylinder_cross_eq`, `torus_cross_eq`) and `xAxis × yAxis = normal` for the plane
 * (Lean `plane_normal_eq_cross`). Second fundamental form `L = S_uu·n`, `M = S_uv·n`, `N = S_vv·n`;
 * a normal curvature is **negative where the surface bends away from `n`**. Hence a sphere of
 * radius `r` has `K = 1/r²`, `H = -1/r`, principal curvatures `-1/r, -1/r` (Lean
 * `sphere_gauss`, `sphere_mean`); a cylinder `K = 0`, `H = -1/(2r)`, principal `0, -1/r`
 * (`cylinder_gauss`, `cylinder_mean`); a torus `K = cos v / (r (R + r cos v))`, positive on the
 * outer equator and negative on the inner one (`torus_gauss`). With `D = EG - F²`:
 * `K = (LN - M²)/D`, `H = (EN - 2FM + GL)/(2D)`, `κ1,2 = H ± sqrt(max(0, H² - K))`, `κ1 >= κ2`.
 *
 * Degeneracy (`unitNormalFromPartials` of src/nurbs/surface.ts, shared with NURBS `surfaceNormal`): the normal is
 * `degenerate` when `|S_u|` or `|S_v|` is at most `1e-3 * zoneTol3d` (poles of the sphere, the cone
 * apex) or the unit tangents are within `angTolDeg` of parallel. Curvatures need the normal.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/eval/surface.rs (closed-form evaluation in angle and height),
 *   eval/sphere.rs, eval/normal_section.rs (normal curvature `n · r''`, its sign),
 *   surface/face_evaluation.rs (point and unit normal of a face surface), surface/sphere.rs,
 *   surface/torus.rs, surface/cone/p1.rs (Evaluate). Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { cross3, dot3, isFinite3, length3, scale3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { ROUNDING_SLACK } from '../curve/types.ts';
import { surfaceDerivatives, unitNormalFromPartials } from '../nurbs/surface.ts';
import { fromLocal, surfaceOrigin, vecFromLocal, type AnalyticSurface3, type Surface3 } from './types.ts';

/** The point and the partial derivatives up to order two at `(u, v)`. */
export interface SurfaceDerivs3 {
  readonly point: Point3;
  readonly su: Vec3;
  readonly sv: Vec3;
  readonly suu: Vec3;
  readonly suv: Vec3;
  readonly svv: Vec3;
}

/** First fundamental form `I = E du² + 2F du dv + G dv²`. */
export interface FirstFundamentalForm {
  readonly E: number;
  readonly F: number;
  readonly G: number;
}

/** Second fundamental form `II = L du² + 2M du dv + N dv²` with respect to the unit normal. */
export interface SecondFundamentalForm {
  readonly L: number;
  readonly M: number;
  readonly N: number;
}

export interface SurfaceCurvature {
  readonly normal: Vec3;
  readonly first: FirstFundamentalForm;
  readonly second: SecondFundamentalForm;
  /** Gaussian curvature `K = κ1 κ2`. */
  readonly gaussian: number;
  /** Mean curvature `H = (κ1 + κ2) / 2` (negative for a sphere with its outward normal). */
  readonly mean: number;
  /** Principal curvatures `[κ1, κ2]`, `κ1 >= κ2`. */
  readonly principal: readonly [number, number];
}

const OP = 'surface.evaluateSurface3';
const HALF_PI = Math.PI / 2;

/** Cone radius `R(v)`; `undefined` past the apex (beyond rounding). */
export function coneRadiusAt(baseRadius: number, tanAngle: number, v: number): number | undefined {
  const tv = tanAngle * v;
  const R = baseRadius + tv;
  if (R >= 0) return R;
  // At the apex `b + t v` is 0 in exact arithmetic; tolerate its rounding.
  if (R >= -ROUNDING_SLACK * (baseRadius + Math.abs(tv))) return 0;
  return undefined;
}

function checkParams(s: AnalyticSurface3, u: number, v: number): Result<void> {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return invalidInput(OP, 'non-finite parameter');
  if (s.kind === 'sphere' && !(Math.abs(v) <= HALF_PI * (1 + ROUNDING_SLACK))) {
    return invalidInput(OP, 'sphere latitude v must lie in [-π/2, π/2]');
  }
  if (s.kind === 'cone' && coneRadiusAt(s.baseRadius, Math.tan(s.semiAngle), v) === undefined) {
    return invalidInput(OP, 'cone parameter v lies past the apex (R(v) < 0)');
  }
  return ok(undefined);
}

/**
 * Local-frame coefficients of `S - origin` and its derivatives: each entry is
 * `[a, b, c]` meaning `a X + b Y + c Z`.
 */
type Local = readonly [number, number, number];

function analyticLocal(s: AnalyticSurface3, u: number, v: number): readonly [Local, Local, Local, Local, Local, Local] {
  const cu = Math.cos(u), su = Math.sin(u);
  // e = (cu, su, 0), f = (-su, cu, 0)
  switch (s.kind) {
    case 'plane':
      return [[u, v, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    case 'cylinder': {
      const r = s.radius;
      return [[r * cu, r * su, v], [-r * su, r * cu, 0], [0, 0, 1], [-r * cu, -r * su, 0], [0, 0, 0], [0, 0, 0]];
    }
    case 'cone': {
      const t = Math.tan(s.semiAngle);
      const R = coneRadiusAt(s.baseRadius, t, v) ?? 0;
      return [[R * cu, R * su, v], [-R * su, R * cu, 0], [t * cu, t * su, 1], [-R * cu, -R * su, 0], [-t * su, t * cu, 0], [0, 0, 0]];
    }
    case 'sphere':
    case 'torus': {
      const [R, r] = s.kind === 'sphere' ? [0, s.radius] : [s.majorRadius, s.minorRadius];
      // Clamp the latitude of a sphere to [-π/2, π/2] (accepted with rounding slack).
      const vv = s.kind === 'sphere' ? Math.min(HALF_PI, Math.max(-HALF_PI, v)) : v;
      const cv = Math.cos(vv), sv = Math.sin(vv);
      const rho = R + r * cv;
      return [
        [rho * cu, rho * su, r * sv],
        [-rho * su, rho * cu, 0],
        [-r * sv * cu, -r * sv * su, r * cv],
        [-rho * cu, -rho * su, 0],
        [r * sv * su, -r * sv * cu, 0],
        [-r * cv * cu, -r * cv * su, -r * sv],
      ];
    }
  }
}

/**
 * Point and partial derivatives `S, S_u, S_v, S_uu, S_uv, S_vv` at `(u, v)`.
 * Errors: non-finite parameters, a sphere latitude outside `[-π/2, π/2]`, a cone parameter past
 * the apex, NURBS parameters outside the knot domain (M1 `surfaceDerivatives`), overflow.
 */
export function evaluateSurface3(s: Surface3, u: number, v: number): Result<SurfaceDerivs3> {
  if (s.kind === 'nurbs') {
    const d = surfaceDerivatives(s.surface, u, v, 2);
    if (!d.ok) return d;
    const at = (k: number, l: number): Vec3 => {
      const p = d.value[k]![l]!;
      return Object.freeze(vec3(p[0]!, p[1]!, p[2]!));
    };
    return ok(Object.freeze({ point: at(0, 0), su: at(1, 0), sv: at(0, 1), suu: at(2, 0), suv: at(1, 1), svv: at(0, 2) }));
  }
  const chk = checkParams(s, u, v);
  if (!chk.ok) return chk;
  const frame = s.frame;
  const origin = surfaceOrigin(s);
  const [p, a, b, aa, ab, bb] = analyticLocal(s, u, v);
  const out: SurfaceDerivs3 = Object.freeze({
    point: fromLocal(frame, origin, p[0], p[1], p[2]),
    su: vecFromLocal(frame, a[0], a[1], a[2]),
    sv: vecFromLocal(frame, b[0], b[1], b[2]),
    suu: vecFromLocal(frame, aa[0], aa[1], aa[2]),
    suv: vecFromLocal(frame, ab[0], ab[1], ab[2]),
    svv: vecFromLocal(frame, bb[0], bb[1], bb[2]),
  });
  for (const w of [out.point, out.su, out.sv, out.suu, out.suv, out.svv]) {
    if (!isFinite3(w)) return invalidInput(OP, 'result is not finite (floating-point overflow)');
  }
  return ok(out);
}

/** The surface point `S(u, v)`. */
export function surfacePoint3(s: Surface3, u: number, v: number): Result<Point3> {
  const d = evaluateSurface3(s, u, v);
  return d.ok ? ok(d.value.point) : d;
}

/** The unit normal at `(u, v)`; `degenerate` at poles, the cone apex and creases. */
export function surfaceNormal3(kernel: Kernel, s: Surface3, u: number, v: number): Result<Vec3> {
  const d = evaluateSurface3(s, u, v);
  if (!d.ok) return d;
  return unitNormalFromPartials(kernel, d.value.su, d.value.sv, 'surface.surfaceNormal3');
}

/** Fundamental forms and curvatures from the derivatives (see the module comment for signs). */
export function curvatureFromDerivatives(kernel: Kernel, d: SurfaceDerivs3): Result<SurfaceCurvature> {
  const op = 'surface.surfaceCurvature';
  const n = unitNormalFromPartials(kernel, d.su, d.sv, op);
  if (!n.ok) return n;
  const E = dot3(d.su, d.su), F = dot3(d.su, d.sv), G = dot3(d.sv, d.sv);
  const L = dot3(d.suu, n.value), M = dot3(d.suv, n.value), N = dot3(d.svv, n.value);
  const det = E * G - F * F;
  if (!(det > 0) || !Number.isFinite(det)) return err({ kind: 'degenerate', operation: op });
  const K = (L * N - M * M) / det;
  const H = (E * N - 2 * F * M + G * L) / (2 * det);
  const disc = Math.sqrt(Math.max(0, H * H - K));
  const result: SurfaceCurvature = Object.freeze({
    normal: n.value,
    first: Object.freeze({ E, F, G }),
    second: Object.freeze({ L, M, N }),
    gaussian: K,
    mean: H,
    principal: Object.freeze([H + disc, H - disc] as const),
  });
  if (![K, H, disc, L, M, N].every(Number.isFinite)) return invalidInput(op, 'curvature is not finite (floating-point overflow)');
  return ok(result);
}

/** Fundamental forms, Gaussian, mean and principal curvatures at `(u, v)`. */
export function surfaceCurvature(kernel: Kernel, s: Surface3, u: number, v: number): Result<SurfaceCurvature> {
  const d = evaluateSurface3(s, u, v);
  if (!d.ok) return d;
  return curvatureFromDerivatives(kernel, d.value);
}

/**
 * Normal curvature `II(du, dv) / I(du, dv)` in the tangent direction `du S_u + dv S_v`
 * (upstream `normal_section`: `κ = n · r''` for the arc-length section). Error: a zero direction.
 */
export function normalCurvature(kernel: Kernel, s: Surface3, u: number, v: number, du: number, dv: number): Result<number> {
  const op = 'surface.normalCurvature';
  if (!Number.isFinite(du) || !Number.isFinite(dv)) return invalidInput(op, 'non-finite direction');
  const c = surfaceCurvature(kernel, s, u, v);
  if (!c.ok) return c;
  const { E, F, G } = c.value.first;
  const { L, M, N } = c.value.second;
  const I = E * du * du + 2 * F * du * dv + G * dv * dv;
  if (!(I > 0) || !Number.isFinite(I)) return invalidInput(op, 'zero or overflowing tangent direction');
  return ok((L * du * du + 2 * M * du * dv + N * dv * dv) / I);
}
