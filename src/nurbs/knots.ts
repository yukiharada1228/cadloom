/**
 * Knot vectors of B-spline / NURBS curves: validation, span search (The NURBS Book A2.1),
 * multiplicity, domain and the clamped-uniform constructor.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/knots.rs (KnotVector::validate, find_span,
 *   find_span_and_mult, clamped_uniform). Rewritten for cadloom; not a translation.
 *
 * Conventions (Piegl & Tiller): a curve of degree `p` with `n + 1` control points has
 * `m + 1 = n + p + 2` knots `U[0..m]`; its parameter domain is `[U[p], U[n+1]]`.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';

/** A knot vector. Values returned by this module are frozen. */
export type Knots = readonly number[];

const OP_VALIDATE = 'nurbs.validateKnots';

/**
 * Validates a knot vector for a curve of `degree` with `controlPointCount` control points and
 * returns a frozen copy. Requirements:
 * - `degree` is an integer `>= 1`, `controlPointCount` an integer `>= degree + 1`;
 * - `knots.length === controlPointCount + degree + 1`;
 * - every knot is finite and the sequence is non-decreasing;
 * - no knot value occurs more than `degree + 1` times, and a knot strictly inside the domain
 *   `(U[p], U[n+1])` occurs at most `degree` times (the curve stays continuous);
 * - the domain is non-empty: `U[p] < U[n+1]`;
 * - floating-point safety: the total extent `U[m] - U[0]` is finite (so every knot difference and
 *   every `u - U[i]` in the evaluation schemes is finite), and every positive gap `U[i+1] - U[i]`
 *   has a finite reciprocal (no subnormal-scale spans, whose basis functions would overflow).
 * Unclamped (e.g. periodic-style uniform) vectors are accepted; see {@link isClamped}.
 */
export function validateKnots(knots: readonly number[], degree: number, controlPointCount: number): Result<Knots> {
  if (!Number.isInteger(degree) || degree < 1) return invalidInput(OP_VALIDATE, 'degree must be an integer >= 1');
  if (!Number.isInteger(controlPointCount) || controlPointCount < degree + 1) {
    return invalidInput(OP_VALIDATE, 'need at least degree + 1 control points');
  }
  if (knots.length !== controlPointCount + degree + 1) {
    return invalidInput(OP_VALIDATE, 'knot count must equal control point count + degree + 1');
  }
  for (let i = 0; i < knots.length; i++) {
    const k = knots[i]!;
    if (!Number.isFinite(k)) return invalidInput(OP_VALIDATE, `knot ${i} is not finite`);
    if (i > 0 && k < knots[i - 1]!) return invalidInput(OP_VALIDATE, `knots decrease at index ${i}`);
  }
  if (!Number.isFinite(knots[knots.length - 1]! - knots[0]!)) {
    return invalidInput(OP_VALIDATE, 'knot range U[m] - U[0] overflows');
  }
  for (let i = 0; i + 1 < knots.length; i++) {
    const gap = knots[i + 1]! - knots[i]!;
    if (gap > 0 && !Number.isFinite(1 / gap)) return invalidInput(OP_VALIDATE, `knot gap at index ${i} is too small`);
  }
  const n = controlPointCount - 1;
  const lo = knots[degree]!;
  const hi = knots[n + 1]!;
  if (!(lo < hi)) return invalidInput(OP_VALIDATE, 'empty parameter domain (U[p] >= U[n+1])');
  let i = 0;
  while (i < knots.length) {
    let j = i;
    while (j + 1 < knots.length && knots[j + 1] === knots[i]) j++;
    const mult = j - i + 1;
    const value = knots[i]!;
    if (mult > degree + 1) return invalidInput(OP_VALIDATE, `knot ${value} has multiplicity above degree + 1`);
    if (value > lo && value < hi && mult > degree) {
      return invalidInput(OP_VALIDATE, `interior knot ${value} has multiplicity above degree`);
    }
    i = j + 1;
  }
  return ok(Object.freeze(knots.slice()));
}

/** The parameter domain `[U[p], U[n+1]]` of a validated knot vector. */
export function knotDomain(knots: Knots, degree: number): readonly [number, number] {
  const n = knots.length - degree - 2;
  return Object.freeze([knots[degree]!, knots[n + 1]!] as const);
}

/** True when the first `p + 1` and the last `p + 1` knots are equal (the curve interpolates its end points). */
export function isClamped(knots: Knots, degree: number): boolean {
  const m = knots.length - 1;
  if (m < 2 * degree + 1) return false;
  for (let i = 1; i <= degree; i++) {
    if (knots[i] !== knots[0] || knots[m - i] !== knots[m]) return false;
  }
  return true;
}

/** Number of knots exactly equal to `u` (0 when `u` is not a knot). */
export function knotMultiplicity(knots: Knots, u: number): number {
  let count = 0;
  for (const k of knots) if (k === u) count++;
  return count;
}

/**
 * The NURBS Book A2.1 FindSpan: the index `k` in `[p, n]` with `U[k] <= u < U[k+1]`, by binary
 * search. Precondition: `knots` was accepted by {@link validateKnots} for `degree`.
 *
 * At (or beyond) the domain end `U[n+1]` it returns the last span of non-zero length, so the curve
 * is evaluated there as the limit from the left; below the domain start it returns the first span
 * of non-zero length. The returned span always has `U[k] < U[k+1]`.
 */
export function findSpan(knots: Knots, degree: number, u: number): number {
  const n = knots.length - degree - 2;
  if (u >= knots[n + 1]!) {
    let k = n;
    while (k > degree && !(knots[k]! < knots[k + 1]!)) k--;
    return k;
  }
  if (u < knots[degree]!) {
    let k = degree;
    while (k < n && !(knots[k]! < knots[k + 1]!)) k++;
    return k;
  }
  // Invariant: U[low] <= u < U[high].
  let low = degree;
  let high = n + 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (u < knots[mid]!) high = mid;
    else low = mid;
  }
  return low;
}

/**
 * A clamped knot vector with uniformly spaced interior knots on `[0, 1]`
 * (`p + 1` zeros, `count - p - 1` interior knots `i / (count - p)`, `p + 1` ones).
 */
export function clampedUniformKnots(controlPointCount: number, degree: number): Result<Knots> {
  const op = 'nurbs.clampedUniformKnots';
  if (!Number.isInteger(degree) || degree < 1) return invalidInput(op, 'degree must be an integer >= 1');
  if (!Number.isInteger(controlPointCount) || controlPointCount < degree + 1) {
    return invalidInput(op, 'need at least degree + 1 control points');
  }
  const spans = controlPointCount - degree;
  const knots: number[] = [];
  for (let i = 0; i <= degree; i++) knots.push(0);
  for (let i = 1; i < spans; i++) knots.push(i / spans);
  for (let i = 0; i <= degree; i++) knots.push(1);
  return ok(Object.freeze(knots));
}
