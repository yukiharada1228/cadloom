/**
 * B-spline basis functions: the non-vanishing functions (The NURBS Book A2.2 BasisFuns) and their
 * derivatives (A2.3 DersBasisFuns).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/knots.rs (KnotVector::basis_eval_into),
 *   solidcore/crates/solidcore/src/nurbs/basis_basic.rs (basis_derivs). Rewritten for cadloom.
 *
 * Both functions take a span from {@link findSpan} (so `U[span] < U[span+1]`, and no
 * denominator below can be zero) and return values for `N[span-p+j, p](u)`, `j = 0..p`.
 */
import type { Knots } from './knots.ts';

/**
 * A2.2 BasisFuns: `N[span-p+j, p](u)` for `j = 0..p`. They are non-negative and sum to 1
 * for `u` in `[U[span], U[span+1]]` (partition of unity).
 */
export function basisFuns(knots: Knots, degree: number, span: number, u: number): readonly number[] {
  const p = degree;
  const N = new Array<number>(p + 1).fill(0);
  const left = new Array<number>(p + 1).fill(0);
  const right = new Array<number>(p + 1).fill(0);
  N[0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - knots[span + 1 - j]!;
    right[j] = knots[span + j]! - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = N[r]! / (right[r + 1]! + left[j - r]!);
      N[r] = saved + right[r + 1]! * temp;
      saved = left[j - r]! * temp;
    }
    N[j] = saved;
  }
  return Object.freeze(N);
}

/**
 * A2.3 DersBasisFuns: `ders[k][j] = d^k/du^k N[span-p+j, p](u)` for `k = 0..order`, `j = 0..p`.
 * Rows with `k > p` are zero. `order` should be a non-negative integer; other values are treated
 * as `max(0, floor(order))` (0 when not finite) so this low-level routine never throws.
 */
export function dersBasisFuns(
  knots: Knots,
  degree: number,
  span: number,
  u: number,
  order: number,
): readonly (readonly number[])[] {
  order = Number.isFinite(order) ? Math.max(0, Math.floor(order)) : 0;
  const p = degree;
  const ndu: number[][] = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0));
  const left = new Array<number>(p + 1).fill(0);
  const right = new Array<number>(p + 1).fill(0);
  ndu[0]![0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - knots[span + 1 - j]!;
    right[j] = knots[span + j]! - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      // Lower triangle: knot differences; upper triangle: basis functions.
      ndu[j]![r] = right[r + 1]! + left[j - r]!;
      const temp = ndu[r]![j - 1]! / ndu[j]![r]!;
      ndu[r]![j] = saved + right[r + 1]! * temp;
      saved = left[j - r]! * temp;
    }
    ndu[j]![j] = saved;
  }
  const ders: number[][] = Array.from({ length: order + 1 }, () => new Array<number>(p + 1).fill(0));
  for (let j = 0; j <= p; j++) ders[0]![j] = ndu[j]![p]!;
  const a: number[][] = [new Array<number>(p + 1).fill(0), new Array<number>(p + 1).fill(0)];
  const topOrder = Math.min(order, p);
  for (let r = 0; r <= p; r++) {
    let s1 = 0;
    let s2 = 1;
    a[0]![0] = 1;
    for (let k = 1; k <= topOrder; k++) {
      let d = 0;
      const rk = r - k;
      const pk = p - k;
      if (r >= k) {
        a[s2]![0] = a[s1]![0]! / ndu[pk + 1]![rk]!;
        d = a[s2]![0]! * ndu[rk]![pk]!;
      }
      const j1 = rk >= -1 ? 1 : -rk;
      const j2 = r - 1 <= pk ? k - 1 : p - r;
      for (let j = j1; j <= j2; j++) {
        a[s2]![j] = (a[s1]![j]! - a[s1]![j - 1]!) / ndu[pk + 1]![rk + j]!;
        d += a[s2]![j]! * ndu[rk + j]![pk]!;
      }
      if (r <= pk) {
        a[s2]![k] = -a[s1]![k - 1]! / ndu[pk + 1]![r]!;
        d += a[s2]![k]! * ndu[r]![pk]!;
      }
      ders[k]![r] = d;
      const t = s1;
      s1 = s2;
      s2 = t;
    }
  }
  let factor = p;
  for (let k = 1; k <= topOrder; k++) {
    for (let j = 0; j <= p; j++) ders[k]![j] = ders[k]![j]! * factor;
    factor *= p - k;
  }
  return Object.freeze(ders.map((row) => Object.freeze(row)));
}
