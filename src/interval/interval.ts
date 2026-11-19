/**
 * Closed intervals `[lo, hi]` of doubles with outward-rounded arithmetic.
 *
 * Inclusion property (the reason this module exists): for every operation `op` and all reals
 * `x ∈ X`, `y ∈ Y`, the exact real `x op y` lies in `op(X, Y)`. The endpoint formulas are those
 * of the exact model `CadloomFormal.Interval` (formal/CadloomFormal/Interval.lean: `add`, `sub`,
 * `neg`, `mul` with the min / max of the four corner products in the same order, `sqr` with its
 * three sign cases, `hull`, `inter`), and each endpoint is then rounded outward with the directed
 * operations of `float.ts`, which only widens the interval (`widen_mem` in the Lean model).
 *
 * Endpoints: an interval made by {@link interval} has finite endpoints. Operations may overflow
 * to an infinite endpoint, which stays sound (an unattained bound): `lo ∈ [-∞, MAX_VALUE]`,
 * `hi ∈ [-MAX_VALUE, +∞]`, never `NaN`. {@link isBounded} tells whether both are finite; the
 * certified bound functions of this area reject unbounded results with a `Result` error.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/definitions-and-certificates.md (certified = proved bound, rounding carried),
 *   solidcore/crates/solidcore/src/geom/extent2d.rs (closed extents, union / overlap),
 *   solidcore/crates/solidcore/src/query/distance_bound.rs (rounding carried as a bound).
 *   Rewritten for cadloom; upstream has no interval type.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { addDown, addUp, divDown, divUp, mulDown, mulUp, sqrtDown, sqrtUp, subDown, subUp } from './float.ts';

/** A closed interval `lo <= hi` (frozen). */
export interface Interval {
  readonly lo: number;
  readonly hi: number;
}

const make = (lo: number, hi: number): Interval => Object.freeze({ lo: lo === 0 ? 0 : lo, hi: hi === 0 ? 0 : hi });

/** The interval `[lo, hi]`; both finite and `lo <= hi`. */
export function interval(lo: number, hi: number): Result<Interval> {
  const op = 'interval.interval';
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return invalidInput(op, 'interval endpoints must be finite');
  if (!(lo <= hi)) return invalidInput(op, 'interval needs lo <= hi');
  return ok(make(lo, hi));
}

/** The degenerate interval `[x, x]` of a finite double (exact: a double is a real). */
export function point(x: number): Result<Interval> {
  return interval(x, x);
}

/** Internal constructor for already-checked endpoints (shared inside `src/interval`). */
export function unsafeInterval(lo: number, hi: number): Interval {
  return make(lo, hi);
}

export function isBounded(a: Interval): boolean {
  return Number.isFinite(a.lo) && Number.isFinite(a.hi);
}

/** Whether the real `x` (a double) lies in `a`. */
export function contains(a: Interval, x: number): boolean {
  return a.lo <= x && x <= a.hi;
}

/** Whether `b ⊆ a`. */
export function containsInterval(a: Interval, b: Interval): boolean {
  return a.lo <= b.lo && b.hi <= a.hi;
}

/** An upper bound of `hi - lo` (rounded up). */
export function width(a: Interval): number {
  return subUp(a.hi, a.lo);
}

/** The midpoint (a double inside `a`; not a bound). */
export function midpoint(a: Interval): number {
  if (!isBounded(a)) return a.lo === -Infinity ? (a.hi === Infinity ? 0 : a.hi) : a.lo;
  const m = a.lo / 2 + a.hi / 2;
  return Math.min(a.hi, Math.max(a.lo, m));
}

/** An upper bound of `max |x|` over `a`. */
export function magnitude(a: Interval): number {
  return Math.max(Math.abs(a.lo), Math.abs(a.hi));
}

export function neg(a: Interval): Interval {
  return make(-a.hi, -a.lo);
}

export function add(a: Interval, b: Interval): Interval {
  return make(addDown(a.lo, b.lo), addUp(a.hi, b.hi));
}

export function sub(a: Interval, b: Interval): Interval {
  return make(subDown(a.lo, b.hi), subUp(a.hi, b.lo));
}

/** Product: the min / max of the four corner products `lo·lo, lo·hi, hi·lo, hi·hi` (Lean `mul`). */
export function mul(a: Interval, b: Interval): Interval {
  const lo = Math.min(Math.min(mulDown(a.lo, b.lo), mulDown(a.lo, b.hi)), Math.min(mulDown(a.hi, b.lo), mulDown(a.hi, b.hi)));
  const hi = Math.max(Math.max(mulUp(a.lo, b.lo), mulUp(a.lo, b.hi)), Math.max(mulUp(a.hi, b.lo), mulUp(a.hi, b.hi)));
  return make(lo, hi);
}

/**
 * `a · s` for a scalar double `s` (the product with the exact point interval `[s, s]`). A
 * non-finite `s` is not a real: the result is the unbounded `[-∞, +∞]` (never `NaN`).
 */
export function scale(a: Interval, s: number): Interval {
  if (!Number.isFinite(s)) return make(-Infinity, Infinity);
  return s >= 0 ? make(mulDown(a.lo, s), mulUp(a.hi, s)) : make(mulDown(a.hi, s), mulUp(a.lo, s));
}

/** `{x² : x ∈ a}` (tighter than `mul(a, a)` when `a` straddles 0; Lean `sqr`). */
export function sqr(a: Interval): Interval {
  // x² >= 0 exactly: an underflowing product rounded down is clamped at 0.
  if (a.lo >= 0) return make(Math.max(0, mulDown(a.lo, a.lo)), mulUp(a.hi, a.hi));
  if (a.hi <= 0) return make(Math.max(0, mulDown(a.hi, a.hi)), mulUp(a.lo, a.lo));
  return make(0, Math.max(mulUp(a.lo, a.lo), mulUp(a.hi, a.hi)));
}

/** Quotient; `invalid-input` when the divisor contains 0. */
export function div(a: Interval, b: Interval): Result<Interval> {
  if (b.lo <= 0 && b.hi >= 0) return invalidInput('interval.div', 'divisor interval contains 0');
  const lo = Math.min(Math.min(divDown(a.lo, b.lo), divDown(a.lo, b.hi)), Math.min(divDown(a.hi, b.lo), divDown(a.hi, b.hi)));
  const hi = Math.max(Math.max(divUp(a.lo, b.lo), divUp(a.lo, b.hi)), Math.max(divUp(a.hi, b.lo), divUp(a.hi, b.hi)));
  return ok(make(lo, hi));
}

/**
 * `{√x : x ∈ a, x >= 0}`: the lower end is clamped at 0 (the real square root is only taken of the
 * non-negative part). `invalid-input` when `a` is entirely negative.
 */
export function sqrt(a: Interval): Result<Interval> {
  if (a.hi < 0) return invalidInput('interval.sqrt', 'square root of a negative interval');
  return ok(make(a.lo <= 0 ? 0 : sqrtDown(a.lo), sqrtUp(a.hi)));
}

/** The smallest interval containing both (Lean `hull`). */
export function hull(a: Interval, b: Interval): Interval {
  return make(Math.min(a.lo, b.lo), Math.max(a.hi, b.hi));
}

/** The common part, or `undefined` when the intervals are disjoint (Lean `inter`; exact). */
export function intersect(a: Interval, b: Interval): Interval | undefined {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return lo <= hi ? make(lo, hi) : undefined;
}

/**
 * `[lo - e, hi + e]` rounded outward, for `e >= 0` (Lean `widenBy`). A negative or `NaN` `e` is
 * not a widening: the result is then the unbounded `[-∞, +∞]` (sound, never `NaN` or inverted).
 */
export function expand(a: Interval, e: number): Interval {
  if (!(e >= 0)) return make(-Infinity, Infinity);
  return make(subDown(a.lo, e), addUp(a.hi, e));
}

/** The two halves `[lo, m]`, `[m, hi]` at the midpoint (a bisection; their hull is `a`). */
export function bisect(a: Interval): readonly [Interval, Interval] {
  const m = midpoint(a);
  return [make(a.lo, m), make(m, a.hi)];
}

/** The smallest interval containing every given double (exact: min / max of doubles); `undefined` when empty or a value is `NaN`. */
export function hullOf(values: readonly number[]): Interval | undefined {
  if (values.length === 0) return undefined;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) {
    if (Number.isNaN(v)) return undefined;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return make(lo, hi);
}
