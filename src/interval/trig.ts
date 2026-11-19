/**
 * Certified interval `sin` / `cos` / `tan` and an outward `acos`, for the interval evaluation of
 * the analytic curves and surfaces (circles, ellipses, cylinders, cones, spheres, tori).
 *
 * Method for `f = sin` or `cos` on `[a, b]`:
 * 1. Endpoint values: `Math.sin(x)` / `Math.cos(x)` widened by `TRIG_PAD = 2^-50` on each side.
 * 2. Extrema: `f` is monotone between consecutive critical points (`sin`: maxima at `π/2 + 2kπ`,
 *    minima at `-π/2 + 2kπ`; `cos`: maxima at `2kπ`, minima at `π + 2kπ`). If a maximum may lie in
 *    `[a, b]` the upper end is 1, if a minimum may, the lower end is -1. "May" is decided on the
 *    enlarged interval `[a - δ, b + δ]`, `δ = 2^-30 · max(1, |a|, |b|)`, so an extremum is never
 *    missed (including an extra one only widens the result).
 * 3. The result is clamped to `[-1, 1]`; `sin(0) = 0`, `cos(0) = 1` exactly.
 *
 * Error budget (documented assumptions, not proved in Lean):
 * - the host `Math.sin` / `Math.cos` / `Math.acos` / `Math.atan` are within 2 ulps of the exact value of their
 *   (double) argument — V8 and SpiderMonkey use fdlibm ports (< 1 ulp, with exact Payne–Hanek
 *   reduction for large arguments). For a result `|y| <= 1` an ulp is at most `2^-52`, so the pad
 *   `2^-50` covers 4 ulps; for `acos` (results in `[0, π]`, ulp at most `2^-51`) the pad is `2^-49`;
 * - locating the extrema: `Math.PI` differs from `π` by less than `1.3e-16`, the multiple
 *   `phase + k·2π` and the quotient used to find `k` carry a relative error below `1e-15` of
 *   `max(1, |a|, |b|)`, far below `δ` (relative `9.3e-10`). Arguments beyond `2^40` in magnitude
 *   give `[-1, 1]` outright.
 * The arguments are doubles and exact: the enclosure is of the exact `sin` of those doubles
 * (an angle such as `π/2` stored as `Math.PI / 2` is the double, not the real `π/2`).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/geom/certified.rs (the circle weights' `cos` / `sin` counted
 *   as an ulp each), solidcore/crates/solidcore/src/query/distance_bound.rs (gamma_32 budget of
 *   the analytic forms). Rewritten for cadloom; upstream has no interval trigonometry.
 */
import { invalidInput, type Result } from '../core/error.ts';
import { addUp, subDown } from './float.ts';
import { div, unsafeInterval, type Interval } from './interval.ts';

export const TRIG_PAD = 2 ** -50;
export const ACOS_PAD = 2 ** -49;
const TWO_PI = 2 * Math.PI;
const REDUCTION_LIMIT = 2 ** 40;

/** Whether some `phase + 2kπ` (k integer) may lie in `[lo, hi]` (never a false "no"). */
function mayContainCritical(lo: number, hi: number, phase: number): boolean {
  const m = Math.max(1, Math.abs(lo), Math.abs(hi));
  if (!(m <= REDUCTION_LIMIT)) return true;
  const delta = 2 ** -30 * m;
  const a = lo - delta;
  const b = hi + delta;
  const k = Math.ceil((a - phase) / TWO_PI);
  return phase + k * TWO_PI <= b;
}

function enclose(f: (x: number) => number, x: number): readonly [number, number] {
  const y = f(x);
  return [subDown(y, TRIG_PAD), addUp(y, TRIG_PAD)];
}

function periodic(a: Interval, f: (x: number) => number, maxPhase: number, minPhase: number): Interval {
  const [l0, h0] = enclose(f, a.lo);
  const [l1, h1] = enclose(f, a.hi);
  let lo = Math.min(l0, l1);
  let hi = Math.max(h0, h1);
  if (mayContainCritical(a.lo, a.hi, maxPhase)) hi = 1;
  if (mayContainCritical(a.lo, a.hi, minPhase)) lo = -1;
  return unsafeInterval(Math.max(-1, lo), Math.min(1, hi));
}

/** An interval containing `sin x` for every real `x ∈ a`. */
export function sinInterval(a: Interval): Interval {
  if (a.lo === 0 && a.hi === 0) return unsafeInterval(0, 0);
  return periodic(a, Math.sin, Math.PI / 2, -Math.PI / 2);
}

/** An interval containing `cos x` for every real `x ∈ a`. */
export function cosInterval(a: Interval): Interval {
  if (a.lo === 0 && a.hi === 0) return unsafeInterval(1, 1);
  return periodic(a, Math.cos, 0, Math.PI);
}

/** An interval containing `tan x` for every `x ∈ a`; `invalid-input` when `cos` may vanish on `a`. */
export function tanInterval(a: Interval): Result<Interval> {
  const t = div(sinInterval(a), cosInterval(a));
  return t.ok ? t : invalidInput('interval.tanInterval', 'cos may vanish on the interval');
}

/**
 * An upper bound of `acos(c)` for every real `c >= x` (`acos` decreases), `x` clamped to `[-1, 1]`;
 * at most `π + ACOS_PAD`.
 */
export function acosUp(x: number): number {
  if (Number.isNaN(x)) return addUp(Math.PI, ACOS_PAD);
  const c = Math.max(-1, Math.min(1, x));
  return addUp(Math.acos(c), ACOS_PAD);
}

/** A lower bound of `acos(c)` for every real `c <= x`, clamped at 0 (`NaN`: 0). */
export function acosDown(x: number): number {
  if (Number.isNaN(x)) return 0;
  const c = Math.max(-1, Math.min(1, x));
  return Math.max(0, subDown(Math.acos(c), ACOS_PAD));
}


/** An upper bound of `atan(c)` for every real `c <= t` (`atan` increases); results below `π/2`, pad `TRIG_PAD` (`NaN`: the bound `π/2`). */
export function atanUp(t: number): number {
  if (Number.isNaN(t)) return addUp(Math.PI / 2, TRIG_PAD);
  return addUp(Math.atan(t), TRIG_PAD);
}
