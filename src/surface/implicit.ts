/**
 * Implicit side test and closest point (point inversion) of `Surface3`.
 *
 * `implicitValue(s, p)` is the **signed Euclidean distance** from `p` to the analytic surface,
 * positive on the side the unit normal of `evaluate.ts` points to (outside of the cylinder, cone,
 * sphere, torus; along `normal` for the plane). In the frame's local coordinates `(x, y, z)` of
 * `p - origin`, with `ρ = sqrt(x² + y²)`:
 *
 * - plane:    `z` (Lean `plane_signed_distance`);
 * - cylinder: `ρ - r` (zero set: Lean `cylinder_on_implicit`);
 * - sphere:   `|p - c| - r` (Lean `sphere_on_implicit`);
 * - cone:     in the meridian half-plane through `p` the nappe is the ray from the apex along
 *             `(sin α, cos α)` in `(ρ, z)`; `g = (ρ - b) cos α - z sin α` is the signed distance
 *             to its line, the foot has height `v_f = ((ρ - b) sin α + z cos α) cos α`. If
 *             `R(v_f) >= 0` the distance is `|g|`, otherwise the apex is the nearest point; the
 *             sign is the sign of `g` (zero set: Lean `cone_on_implicit`);
 * - torus:    `sqrt((ρ - R)² + z²) - r`, exact for the ring torus `R > r` (zero set: Lean
 *             `torus_local_implicit`);
 * - nurbs:    no implicit form: `invalid-input`.
 *
 * `projectPoint(kernel, s, p)` returns the nearest point, its parameters and the distance.
 * Analytic surfaces use the closed forms above. Angles are returned in `[0, 2π)` (`v` of a sphere
 * in `[-π/2, π/2]`). Ambiguities are `degenerate` (never NaN): a point within `1e-3 * zoneTol3d`
 * (the pole threshold of `evaluate.ts`) of the cylinder or torus axis, of the torus core circle,
 * of the sphere center, or of the cone axis on the inside of the nappe (where the nearest points
 * form a circle). A point on the sphere's polar axis (not the center) or on the cone's axis
 * beyond the apex has a unique nearest point (a pole / the apex) whose `u` is undefined: `u = 0`
 * is returned.
 *
 * NURBS surfaces: not certified. The domain is sampled (4 samples per knot span, fewer — at least
 * 1 — when a direction has more than 16 spans); from the 4 best samples, Newton's method on `f = (S - p)·S_u = 0`,
 * `g = (S - p)·S_v = 0` (The NURBS Book §6.1, eq. (6.6)) is run, with the full Hessian where it is
 * positive definite and the Gauss-Newton matrix `[[E, F], [F, G]]` otherwise, clamped to the
 * domain, at most 64 steps; it stops when `|S - p| <= zoneTol3d`, when both cosines
 * `|f| / (|S_u| |S - p|)` and `|g| / (|S_v| |S - p|)` are at most `1e-12`, or when a (clamped)
 * step moves the point by at most `1e-3 * zoneTol3d` (`refineProjection`, shared with the
 * surface/surface foot points). The nearest converged candidate is returned
 * (ties: the first seed); none converging is `not-converged`. A minimum narrower than the
 * sampling can be missed.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/surface/implicit.rs (the implicit equations of plane, cone,
 *   sphere, torus), surface/face_evaluation.rs (nearest point by Newton / Gauss-Newton from a
 *   guess, clamped to the box, capped steps), eval/surface.rs (closed-form inversion in angle and
 *   height), surface/cone/p1.rs (STEPInversion), surface/sphere.rs, surface/torus.rs.
 *   Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, dot3, isFinite3, length3, sub3, type Point3 } from '../math/vec.ts';
import { TWO_PI } from '../curve/types.ts';
import { knotDomain } from '../nurbs/knots.ts';
import { evaluateSurface, surfaceDomain } from '../nurbs/surface.ts';
import { evaluateSurface3, type SurfaceDerivs3 } from './evaluate.ts';
import { fromLocal, localCoordinates, surfaceOrigin, type ConeSurface, type NurbsSurface3, type Surface3 } from './types.ts';

/** The result of {@link projectPoint}. */
export interface SurfaceProjection {
  readonly u: number;
  readonly v: number;
  readonly point: Point3;
  readonly distance: number;
}

const OP_IMPLICIT = 'surface.implicitValue';
const OP_PROJECT = 'surface.projectPoint';

/** `atan2(y, x)` mapped to `[0, 2π)`. */
function angle(y: number, x: number): number {
  const a = Math.atan2(y, x);
  if (a >= 0) return a;
  const b = a + TWO_PI;
  return b < TWO_PI ? b : 0;
}

interface ConeFoot {
  /** Signed distance to the generator line in the meridian half-plane. */
  readonly g: number;
  /** Nearest point is the apex (the line foot is past it). */
  readonly apex: boolean;
  /** Height `v` and radius `R(v)` of the nearest point. */
  readonly v: number;
  readonly R: number;
  readonly distance: number;
}

function coneFoot(s: ConeSurface, rho: number, z: number): ConeFoot {
  const a = s.semiAngle;
  const ca = Math.cos(a), sa = Math.sin(a), t = Math.tan(a);
  const b = s.baseRadius;
  const g = (rho - b) * ca - z * sa;
  const vf = ((rho - b) * sa + z * ca) * ca;
  const Rf = b + t * vf;
  if (Rf >= 0) return { g, apex: false, v: vf, R: Rf, distance: Math.abs(g) };
  const va = -b / t;
  return { g, apex: true, v: va, R: 0, distance: Math.hypot(rho, z - va) };
}

function finiteOr(op: string, x: number): Result<number> {
  return Number.isFinite(x) ? ok(x) : invalidInput(op, 'result is not finite (floating-point overflow)');
}

/** Signed distance from `p` to an analytic surface (see the module comment); `invalid-input` for NURBS. */
export function implicitValue(s: Surface3, p: Point3): Result<number> {
  if (!isFinite3(p)) return invalidInput(OP_IMPLICIT, 'non-finite point');
  if (s.kind === 'nurbs') return invalidInput(OP_IMPLICIT, 'a NURBS surface has no implicit form');
  const [x, y, z] = localCoordinates(s.frame, surfaceOrigin(s), p);
  const rho = Math.hypot(x, y);
  switch (s.kind) {
    case 'plane':
      return finiteOr(OP_IMPLICIT, z);
    case 'cylinder':
      return finiteOr(OP_IMPLICIT, rho - s.radius);
    case 'sphere':
      return finiteOr(OP_IMPLICIT, Math.hypot(x, y, z) - s.radius);
    case 'cone': {
      const f = coneFoot(s, rho, z);
      return finiteOr(OP_IMPLICIT, f.g < 0 ? -f.distance : f.distance);
    }
    case 'torus':
      return finiteOr(OP_IMPLICIT, Math.hypot(rho - s.majorRadius, z) - s.minorRadius);
  }
}

function result(u: number, v: number, point: Point3, distance: number): Result<SurfaceProjection> {
  if (!isFinite3(point) || !Number.isFinite(distance) || !Number.isFinite(u) || !Number.isFinite(v)) {
    return invalidInput(OP_PROJECT, 'result is not finite (floating-point overflow)');
  }
  return ok(Object.freeze({ u: u === 0 ? 0 : u, v: v === 0 ? 0 : v, point, distance }));
}

const degenerate = (): Result<SurfaceProjection> => err({ kind: 'degenerate', operation: OP_PROJECT });

/** Nearest point of `s` to `p` with its parameters (see the module comment). */
export function projectPoint(kernel: Kernel, s: Surface3, p: Point3): Result<SurfaceProjection> {
  if (!isFinite3(p)) return invalidInput(OP_PROJECT, 'non-finite point');
  if (s.kind === 'nurbs') return projectNurbs(kernel, s, p);
  const minLen = 1e-3 * kernel.tolerances.zoneTol3d;
  const o = surfaceOrigin(s);
  const F = s.frame;
  const [x, y, z] = localCoordinates(F, o, p);
  const rho = Math.hypot(x, y);
  switch (s.kind) {
    case 'plane':
      return result(x, y, fromLocal(F, o, x, y, 0), Math.abs(z));
    case 'cylinder': {
      if (!(rho > minLen)) return degenerate();
      const k = s.radius / rho;
      return result(angle(y, x), z, fromLocal(F, o, k * x, k * y, z), Math.abs(rho - s.radius));
    }
    case 'sphere': {
      const d = Math.hypot(x, y, z);
      if (!(d > minLen)) return degenerate();
      const k = s.radius / d;
      const u = rho > minLen ? angle(y, x) : 0;
      return result(u, Math.atan2(z, rho), fromLocal(F, o, k * x, k * y, k * z), Math.abs(d - s.radius));
    }
    case 'cone': {
      const f = coneFoot(s, rho, z);
      if (!(rho > minLen)) {
        // On the axis: the apex is the unique nearest point when the foot is at or past it;
        // otherwise every point of a circle is nearest.
        if (!f.apex && f.R > minLen) return degenerate();
        return result(0, f.v, fromLocal(F, o, 0, 0, f.v), Math.hypot(rho, z - f.v));
      }
      const k = f.R / rho;
      return result(angle(y, x), f.v, fromLocal(F, o, k * x, k * y, f.v), f.distance);
    }
    case 'torus': {
      if (!(rho > minLen)) return degenerate();
      const R = s.majorRadius, r = s.minorRadius;
      const dr = rho - R;
      const m = Math.hypot(dr, z);
      if (!(m > minLen)) return degenerate();
      const radial = R + (r * dr) / m;
      const k = radial / rho;
      return result(angle(y, x), angle(z, dr), fromLocal(F, o, k * x, k * y, (r * z) / m), Math.abs(m - r));
    }
  }
}

/* ---------------------------------------------------------------- NURBS ---- */

const MAX_NEWTON_STEPS = 64;
const COSINE_TOL = 1e-12;

/** Distinct span boundaries of a knot vector inside its domain. */
function breakpoints(knots: readonly number[], degree: number): number[] {
  const [a, b] = knotDomain(knots, degree);
  const out: number[] = [a];
  for (const k of knots) if (k > out[out.length - 1]! && k <= b) out.push(k);
  return out;
}

function samples(knots: readonly number[], degree: number): number[] {
  const bp = breakpoints(knots, degree);
  const spans = bp.length - 1;
  const per = Math.max(1, Math.min(4, Math.floor(64 / spans)));
  const out: number[] = [];
  for (let i = 0; i < spans; i++) {
    const a = bp[i]!, b = bp[i + 1]!;
    for (let k = 0; k < per; k++) out.push(a + ((b - a) * k) / per);
  }
  out.push(bp[spans]!);
  return out;
}

function projectNurbs(kernel: Kernel, s: NurbsSurface3, p: Point3): Result<SurfaceProjection> {
  const srf = s.surface;
  const dom = surfaceDomain(srf);
  const us = samples(srf.knotsU, srf.degreeU);
  const vs = samples(srf.knotsV, srf.degreeV);
  const seeds: { u: number; v: number; d: number }[] = [];
  for (const u of us) {
    for (const v of vs) {
      const q = evaluateSurface(srf, u, v);
      if (!q.ok) return q;
      const c = q.value;
      seeds.push({ u, v, d: Math.hypot(c[0]! - p.x, c[1]! - p.y, c[2]! - p.z) });
    }
  }
  // Stable sort keeps the sampling order for ties (deterministic).
  seeds.sort((a, b) => a.d - b.d);
  let best: SurfaceProjection | undefined;
  for (const seed of seeds.slice(0, 4)) {
    const r = newton(kernel, s, p, seed.u, seed.v, dom.u, dom.v);
    if (!r.ok) continue;
    if (best === undefined || r.value.distance < best.distance) best = r.value;
  }
  if (best === undefined) return err({ kind: 'not-converged', operation: OP_PROJECT, iterations: MAX_NEWTON_STEPS });
  return ok(best);
}

const clamp = (x: number, r: readonly [number, number]): number => Math.min(r[1], Math.max(r[0], x));

/** Stopping rules and parameter domain of {@link refineProjection}. */
export interface RefineProjectionOptions {
  /** Maps a stepped `(u, v)` back into the allowed parameters (clamping; periodic angles may stay free). */
  readonly clamp: (u: number, v: number) => readonly [number, number];
  /** Converged once `|S - p| <= stopDistance` (`0`: only the cosine and step rules decide). */
  readonly stopDistance: number;
  /** Converged once a (mapped) step moves the surface point by at most `stepTol`. */
  readonly stepTol: number;
  /** At most this many Newton steps. */
  readonly maxSteps: number;
}

/** The result of {@link refineProjection}: the point, its derivatives, and whether a stopping rule was met. */
export interface RefinedProjection extends SurfaceProjection {
  readonly derivs: SurfaceDerivs3;
  /** `false`: the step budget ran out or the Newton matrix degenerated; the point is then the nearest one seen. */
  readonly converged: boolean;
}

/**
 * The local closest point of `p` on any `Surface3` from the start `(u0, v0)`: Newton's method on
 * `f = (S - p)·S_u = 0`, `g = (S - p)·S_v = 0` with the full Hessian where it is positive definite and
 * the Gauss-Newton matrix `[[E, F], [F, G]]` otherwise, each step mapped by `options.clamp`. It stops
 * (converged) when `|S - p| <= stopDistance`, when both cosines are at most `1e-12`, or when a step
 * moves the point by at most `stepTol`; the converged point is the current iterate. Otherwise
 * (budget, singular matrix) the nearest iterate is returned with `converged: false`. This is the one
 * local projection routine of the kernel: the NURBS branch of `projectPoint` and the surface/surface
 * foot points (`src/intersect/ssi-newton.ts`) both run it. Errors: an evaluation error at the start.
 */
export function refineProjection(s: Surface3, p: Point3, u0: number, v0: number, options: RefineProjectionOptions): Result<RefinedProjection> {
  let u = u0, v = v0;
  let best: RefinedProjection | undefined;
  const done = (d: SurfaceDerivs3, distance: number, converged: boolean): RefinedProjection =>
    Object.freeze({ u, v, point: d.point, distance, derivs: d, converged });
  for (let it = 0; it < options.maxSteps; it++) {
    const e = evaluateSurface3(s, u, v);
    if (!e.ok) return best === undefined ? e : ok(best);
    const d = e.value;
    const { point, su, sv, suu, suv, svv } = d;
    const r = sub3(point, p);
    const rl = length3(r);
    if (best === undefined || rl < best.distance) best = done(d, rl, false);
    if (rl <= options.stopDistance) return ok(done(d, rl, true));
    const f = dot3(r, su), g = dot3(r, sv);
    const lu = length3(su), lv = length3(sv);
    if (Math.abs(f) <= COSINE_TOL * lu * rl && Math.abs(g) <= COSINE_TOL * lv * rl) return ok(done(d, rl, true));
    const E = dot3(su, su), F = dot3(su, sv), G = dot3(sv, sv);
    let a = E + dot3(r, suu), b = F + dot3(r, suv), c = G + dot3(r, svv);
    if (!(a > 0 && a * c - b * b > 0)) {
      a = E; b = F; c = G; // Gauss-Newton
    }
    const det = a * c - b * b;
    if (!(det > 0) || !Number.isFinite(det)) return ok(best);
    const [nu, nv] = options.clamp(u - (c * f - b * g) / det, v - (a * g - b * f) / det);
    const move = length3({ x: (nu - u) * su.x + (nv - v) * sv.x, y: (nu - u) * su.y + (nv - v) * sv.y, z: (nu - u) * su.z + (nv - v) * sv.z });
    u = nu;
    v = nv;
    if (!(move > options.stepTol)) {
      const q = evaluateSurface3(s, u, v);
      if (!q.ok) return ok(best);
      return ok(done(q.value, distance3(q.value.point, p), true));
    }
  }
  return best === undefined ? invalidInput(OP_PROJECT, 'maxSteps must be positive') : ok(best);
}

function newton(
  kernel: Kernel,
  s: NurbsSurface3,
  p: Point3,
  u0: number,
  v0: number,
  du: readonly [number, number],
  dv: readonly [number, number],
): Result<SurfaceProjection> {
  const eps1 = kernel.tolerances.zoneTol3d;
  const r = refineProjection(s, p, u0, v0, {
    clamp: (u, v) => [clamp(u, du), clamp(v, dv)],
    stopDistance: eps1,
    stepTol: 1e-3 * eps1,
    maxSteps: MAX_NEWTON_STEPS,
  });
  if (!r.ok) return r;
  if (!r.value.converged) return err({ kind: 'not-converged', operation: OP_PROJECT, iterations: MAX_NEWTON_STEPS });
  return result(r.value.u, r.value.v, r.value.point, r.value.distance);
}
