/**
 * Normal cones of surface patches: a direction `axis` and a half-angle `θ` such that the
 * parametric normal `S_u × S_v` at every regular point of the patch makes an angle of at most `θ`
 * with `axis`. Two patches whose cones admit no parallel or anti-parallel pair of directions
 * (`normalConesSeparated`) cannot have a closed intersection loop between them nor a tangency
 * (Sederberg–Meyers loop test), which the surface/surface intersector uses to stop subdividing.
 *
 * The normal direction is enclosed by an interval vector `N` and the cone is derived from it:
 * axis `a` = the normalised midpoint of `N`; for every `v ∈ N`, `tan θ = |a × v| / (a · v)
 * <= |a × N|_hi / (a · N)_lo` (interval cross and dot products, rounded against the claim), and
 * `θ <= atan` of that bound rounded up (`trig.ts` `atanUp`); the bound is linear in the box width.
 * When `N` may
 * contain the zero vector, or `(a · N)_lo <= 0`, the cone is the whole sphere (`θ = π`).
 * The direction enclosures, positive multiples of `S_u × S_v`:
 * - plane: `Z` exactly (`θ = 0`);
 * - cylinder: `cos u X + sin u Y` (`S_u × S_v = r e(u)`);
 * - cone: `e(u) - tan(α) Z` (`S_u × S_v = R(v) (e(u) - tan α Z)`, the apex `R = 0` excluded);
 * - sphere and torus: `cos v e(u) + sin v Z` (`S_u × S_v = ρ r (cos v e + sin v Z)`, `ρ > 0`
 *   off the sphere's poles; at a pole the limit normal is the same formula);
 * - NURBS: `(W X_u - W_u X) × (W X_v - W_v X)` (`= W^4 S_u × S_v`, `W > 0`) with the interval
 *   enclosures of the homogeneous surface and its partials from `homogeneousPartials`.
 * The orientation is that of the parametrisation (a reversed face flips it: negate the axis).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/ssi (loop detection by normal cones / Gauss maps), solidcore/docs/ssi.md
 *   (closed loops and tangencies must be flagged, not missed), solidcore/crates/solidcore/src/
 *   intersect/surface_intersector.rs. Rewritten for cadloom.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Vec3 } from '../math/vec.ts';
import type { NurbsSurface } from '../nurbs/surface.ts';
import type { Surface3 } from '../surface/types.ts';
import { ivAdd, ivContainsZero, ivCross, ivDot, ivec3, ivNormSq, ivScale, ivScaleVec, ivSub, type IVec3 } from './box.ts';
import { addUp, divDown, divUp, mulDown, mulUp, sqrtUp, subDown } from './float.ts';
import { isBounded, midpoint, neg, sqrt, unsafeInterval, type Interval } from './interval.ts';
import { homogeneousPartials } from './nurbs-hull.ts';
import { acosDown, acosUp, atanUp, cosInterval, sinInterval, tanInterval } from './trig.ts';

/** Every patch normal is within `halfAngle` (radians, an upper bound) of `axis` (a unit vector up to rounding). */
export interface NormalCone {
  readonly axis: Vec3;
  readonly halfAngle: number;
}

const FULL = (axis: Vec3): NormalCone => Object.freeze({ axis, halfAngle: Math.PI + 2 ** -49 });

const exactIVec = (v: Vec3): IVec3 => ivec3(unsafeInterval(v.x, v.x), unsafeInterval(v.y, v.y), unsafeInterval(v.z, v.z));

/** The cone of the directions of the vectors in `n` (see the module comment). */
export function coneOfDirections(n: IVec3): NormalCone {
  const m = { x: midpoint(n.x), y: midpoint(n.y), z: midpoint(n.z) };
  const len = Math.hypot(m.x, m.y, m.z);
  const axis = len > 0 && Number.isFinite(len) ? Object.freeze({ x: m.x / len, y: m.y / len, z: m.z / len }) : Object.freeze({ x: 0, y: 0, z: 1 });
  if (![n.x, n.y, n.z].every(isBounded) || ivContainsZero(n)) return FULL(axis);
  // tan θ = |a × v| / (a · v) for every v of the box (no unit-length assumption on a).
  const A = exactIVec(axis);
  const dotLo = ivDot(A, n).lo;
  if (!(dotLo > 0)) return FULL(axis);
  const crossHi = sqrtUp(ivNormSq(ivCross(A, n)).hi);
  const tanHi = divUp(crossHi, dotLo);
  if (!Number.isFinite(tanHi)) return FULL(axis);
  return Object.freeze({ axis, halfAngle: Math.min(Math.PI + 2 ** -49, atanUp(tanHi)) });
}

/**
 * The normal cone of `surface` over the parameter box `U × V` (same domain rules as
 * `boundSurface`). Errors: bad intervals, a cone whose `tan α` cannot be bounded, NURBS domain or
 * weight errors.
 */
export function boundNormalCone(surface: Surface3 | NurbsSurface, u: Interval, v: Interval): Result<NormalCone> {
  const op = 'interval.boundNormalCone';
  for (const t of [u, v]) {
    if (!Number.isFinite(t.lo) || !Number.isFinite(t.hi) || !(t.lo <= t.hi)) return invalidInput(op, 'bad parameter interval');
  }
  if (!('kind' in surface) || surface.kind === 'nurbs') {
    const s = 'kind' in surface ? surface.surface : surface;
    if (s.dimension !== 3) return invalidInput(op, 'NURBS surface must have dimension 3');
    const p = homogeneousPartials(s, u, v);
    if (!p.ok) return p;
    const { h, hu, hv } = p.value;
    const X = ivec3(h[0]!, h[1]!, h[2]!), Xu = ivec3(hu[0]!, hu[1]!, hu[2]!), Xv = ivec3(hv[0]!, hv[1]!, hv[2]!);
    const W = h[3]!, Wu = hu[3]!, Wv = hv[3]!;
    const a = ivSub(ivScale(Xu, W), ivScale(X, Wu));
    const b = ivSub(ivScale(Xv, W), ivScale(X, Wv));
    return ok(coneOfDirections(ivCross(a, b)));
  }
  const { xAxis: X, yAxis: Y, normal: Z } = surface.frame;
  if (surface.kind === 'plane') return ok(Object.freeze({ axis: Z, halfAngle: 0 }));
  const e = ivAdd(ivScaleVec(X, cosInterval(u)), ivScaleVec(Y, sinInterval(u)));
  switch (surface.kind) {
    case 'cylinder':
      return ok(coneOfDirections(e));
    case 'cone': {
      const t = tanInterval(unsafeInterval(surface.semiAngle, surface.semiAngle));
      if (!t.ok) return t;
      return ok(coneOfDirections(ivAdd(e, ivScaleVec(Z, neg(t.value)))));
    }
    case 'sphere':
    case 'torus': {
      const half = Math.PI / 2;
      const lat = surface.kind === 'sphere' ? unsafeInterval(Math.max(-half, Math.min(half, v.lo)), Math.max(-half, Math.min(half, v.hi))) : v;
      return ok(coneOfDirections(ivAdd(ivScale(e, cosInterval(lat)), ivScaleVec(Z, sinInterval(lat)))));
    }
  }
}

/**
 * `true` when no direction of cone `a` is parallel or anti-parallel to a direction of cone `b`:
 * the angle `φ` between the axes satisfies `φ > θa + θb` and `π - φ > θa + θb` (all bounds rounded
 * against the claim; `Math.PI` is below the real `π`). Sound: `true` is never returned wrongly.
 */
export function normalConesSeparated(a: NormalCone, b: NormalCone): boolean {
  const A = exactIVec(a.axis), B = exactIVec(b.axis);
  const nA = sqrt(ivNormSq(A)), nB = sqrt(ivNormSq(B));
  if (!nA.ok || !nB.ok || !(nA.value.lo > 0) || !(nB.value.lo > 0)) return false;
  const dot = ivDot(A, B);
  const denLo = mulDown(nA.value.lo, nB.value.lo);
  const denHi = mulUp(nA.value.hi, nB.value.hi);
  // cos φ ∈ [dot.lo / den, dot.hi / den] for den ∈ [denLo, denHi] > 0.
  const cosHi = dot.hi >= 0 ? divUp(dot.hi, denLo) : divUp(dot.hi, denHi);
  const cosLo = dot.lo >= 0 ? divDown(dot.lo, denHi) : divDown(dot.lo, denLo);
  const phiLo = acosDown(cosHi);
  const phiHi = acosUp(cosLo);
  const sum = addUp(a.halfAngle, b.halfAngle);
  return phiLo > sum && subDown(Math.PI, phiHi) > sum;
}

