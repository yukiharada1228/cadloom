/**
 * Exact rationals (bigint fractions `n / d`) and the correctly rounded conversion back to a double.
 *
 * The closed forms of the M4 intersectors (line/line by Cramer's rule, line/plane) are evaluated
 * here exactly from the dyadic values of their double inputs (`src/exact/dyadic.ts`) and rounded
 * once with `qToNumber`; the one place for rational arithmetic (POLICY §3.5). Formal model of the
 * formulas that use it: formal/CadloomFormal/IntersectCurve.lean (`cramer_on_both`,
 * `line_plane_on`). Not exported from the package root (the short names are internal).
 *
 * Upstream consulted: none (solidcore evaluates these closed forms in floating point; exact
 * rationals are a cadloom design choice, moved here from src/intersect/curve-curve.ts).
 */
import { dyadicFromNumber, dyadicToFraction, type Dyadic } from './dyadic.ts';

/** An exact rational `n / d` in lowest terms, `d > 0`. */
export interface Q {
  readonly n: bigint;
  readonly d: bigint;
}

const Q0: Q = { n: 0n, d: 1n };
const babs = (x: bigint): bigint => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
function qNorm(n: bigint, d: bigint): Q {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return Q0;
  const g = gcd(n, d);
  return g === 1n ? { n, d } : { n: n / g, d: d / g };
}
export const qOfDyadic = (x: Dyadic): Q => {
  const f = dyadicToFraction(x);
  return qNorm(f.num, f.den);
};
/** Exact dyadic of a finite double (inputs are validated finite; a non-finite value reads as 0). */
export const dy = (x: number): Dyadic => {
  const r = dyadicFromNumber(x);
  return r.ok ? r.value : { num: 0n, exp: 0 };
};
export const qOf = (x: number): Q => qOfDyadic(dy(x));
export const qAdd = (a: Q, b: Q): Q => qNorm(a.n * b.d + b.n * a.d, a.d * b.d);
export const qSub = (a: Q, b: Q): Q => qNorm(a.n * b.d - b.n * a.d, a.d * b.d);
export const qMul = (a: Q, b: Q): Q => qNorm(a.n * b.n, a.d * b.d);
/** `a / b`; `b` must be non-zero. */
export const qDiv = (a: Q, b: Q): Q => qNorm(a.n * b.d, a.d * b.n);
export const qSign = (a: Q): -1 | 0 | 1 => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);
export const qCmp = (a: Q, b: Q): -1 | 0 | 1 => qSign(qSub(a, b));

const bitLength = (x: bigint): number => (x === 0n ? 0 : x.toString(2).length);

/** `x · 2^e` without intermediate overflow / underflow of the power. */
function ldexp(x: number, e: number): number {
  while (e > 900) {
    x *= 2 ** 900;
    e -= 900;
  }
  while (e < -900) {
    x *= 2 ** -900;
    e += 900;
  }
  return x * 2 ** e;
}

/**
 * The double nearest to `q` (correctly rounded, ties to even, outside the subnormal range): the
 * quotient is formed with at least 55 bits plus a sticky bit, then converted (`Number(bigint)`
 * rounds to nearest).
 */
export function qToNumber(q: Q): number {
  if (q.n === 0n) return 0;
  const neg = q.n < 0n;
  const n = neg ? -q.n : q.n;
  let shift = 56 - (bitLength(n) - bitLength(q.d));
  const num = shift >= 0 ? n << BigInt(shift) : n;
  const den = shift >= 0 ? q.d : q.d << BigInt(-shift);
  let quo = num / den;
  const sticky = num % den !== 0n ? 1n : 0n;
  quo = (quo << 1n) | sticky;
  shift += 1;
  const v = ldexp(Number(quo), -shift);
  return neg ? -v : v;
}
