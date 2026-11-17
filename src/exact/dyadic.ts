/**
 * Exact dyadic rationals `num * 2^exp` (`num: bigint`, `exp: integer`).
 *
 * Every finite IEEE double is a dyadic rational, so sums, differences and products of doubles are
 * held here without rounding (docs/POLICY.md §4). This replaces upstream's error-free double
 * expansions with plain bigint arithmetic; it is slower but simpler and has no range limits
 * (no underflow, no overflow).
 *
 * Upstream consulted (attribution, Apache-2.0 / MIT): solidcore `geom/expansion.rs` (exact sums
 * and products of doubles, Shewchuk's expansions), `geom/certified.rs` (proved verdicts),
 * `math.rs`, `limits.rs` (coordinate range policy). Not a translation: upstream keeps expansions
 * of doubles; this module decodes the IEEE bits into a bigint numerator and a binary exponent.
 *
 * Formal model: `formal/CadloomFormal/Exact.lean` (`Dy`, `Dy.add_correct`, `Dy.mul_correct`,
 * `Dy.val_shift`, `decode`, ...).
 */
import { invalidInput, ok, type Result } from '../core/error.ts';

/**
 * The exact value `num * 2^exp`. Always normalised: `num` is odd, or `num = 0n` and `exp = 0`.
 * Two dyadics are therefore equal exactly when their fields are equal.
 */
export interface Dyadic {
  readonly num: bigint;
  readonly exp: number;
}

export type Sign = -1 | 0 | 1;

export const DYADIC_ZERO: Dyadic = Object.freeze({ num: 0n, exp: 0 });

/** Number of trailing zero bits of a non-zero bigint. */
function trailingZeros(n: bigint): number {
  const lowest = n & -n; // the lowest set bit, as a positive power of two
  return lowest.toString(2).length - 1;
}

/**
 * The normalised dyadic of `num * 2^exp`: trailing zero bits move into the exponent
 * (`val_shift`: `(q * 2^k) * 2^e = q * 2^(e + k)`), and zero becomes `(0, 0)` (`val_zero`).
 * `exp` must be a safe integer.
 */
export function dyadic(num: bigint, exp: number): Dyadic {
  if (!Number.isSafeInteger(exp)) throw new RangeError('dyadic: exponent must be a safe integer');
  if (num === 0n) return DYADIC_ZERO;
  const tz = trailingZeros(num);
  return Object.freeze({ num: tz === 0 ? num : num >> BigInt(tz), exp: exp + tz });
}

/** The raw IEEE 754 binary64 fields of a double. */
export interface DoubleFields {
  readonly negative: boolean;
  /** Biased exponent field, 0..2047. */
  readonly exponent: number;
  /** Fraction field, 0..2^52-1. */
  readonly fraction: bigint;
}

/** Reads the sign, exponent and fraction fields of `x` from its bits. */
export function doubleFields(x: number): DoubleFields {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  return Object.freeze({
    negative: (bits >> 63n) === 1n,
    exponent: Number((bits >> 52n) & 0x7ffn),
    fraction: bits & 0xfffffffffffffn,
  });
}

const HIDDEN_BIT = 1n << 52n;

/**
 * The exact dyadic value of a finite double (Lean `decode`): a subnormal (`exponent = 0`) is
 * `fraction * 2^-1074`, a normal one `(2^52 + fraction) * 2^(exponent - 1075)`; the sign bit
 * negates the numerator. `+0` and `-0` both give zero. Infinities and NaN are rejected.
 */
export function dyadicFromNumber(x: number): Result<Dyadic> {
  if (!Number.isFinite(x)) return invalidInput('exact.dyadicFromNumber', `non-finite value ${x}`);
  const { negative, exponent, fraction } = doubleFields(x);
  const mag = exponent === 0 ? fraction : HIDDEN_BIT + fraction;
  const exp = exponent === 0 ? -1074 : exponent - 1075;
  return ok(dyadic(negative ? -mag : mag, exp));
}

/** `-a`. */
export function negDyadic(a: Dyadic): Dyadic {
  return a.num === 0n ? DYADIC_ZERO : Object.freeze({ num: -a.num, exp: a.exp });
}

/** `a + b`, exact: both numerators are shifted onto the smaller exponent (`Dy.add_correct`). */
export function addDyadic(a: Dyadic, b: Dyadic): Dyadic {
  if (a.num === 0n) return b;
  if (b.num === 0n) return a;
  const m = Math.min(a.exp, b.exp);
  return dyadic((a.num << BigInt(a.exp - m)) + (b.num << BigInt(b.exp - m)), m);
}

/** `a - b`, exact (`Dy.sub_correct`). */
export function subDyadic(a: Dyadic, b: Dyadic): Dyadic {
  return addDyadic(a, negDyadic(b));
}

/** `a * b`, exact: numerators multiply, exponents add (`Dy.mul_correct`). */
export function mulDyadic(a: Dyadic, b: Dyadic): Dyadic {
  return dyadic(a.num * b.num, a.exp + b.exp);
}

/** Sign of the value: the sign of the numerator, since `2^exp > 0` (`Dy.val_pos_iff`). */
export function signDyadic(a: Dyadic): Sign {
  return a.num > 0n ? 1 : a.num < 0n ? -1 : 0;
}

/** `-1`, `0`, `1` as `a <, =, > b`: the sign of `a - b` (`Dy.compare_lt_iff`). */
export function compareDyadic(a: Dyadic, b: Dyadic): Sign {
  return signDyadic(subDyadic(a, b));
}

/** Whether two dyadics have the same value (normalised, so field equality). */
export function dyadicEquals(a: Dyadic, b: Dyadic): boolean {
  return a.num === b.num && a.exp === b.exp;
}

/** The value as a fraction `num / den` with `den` a positive power of two (`den = 1n` if `exp >= 0`). */
export function dyadicToFraction(a: Dyadic): { readonly num: bigint; readonly den: bigint } {
  return a.exp >= 0
    ? Object.freeze({ num: a.num << BigInt(a.exp), den: 1n })
    : Object.freeze({ num: a.num, den: 1n << BigInt(-a.exp) });
}
