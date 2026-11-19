/**
 * Directed rounding on IEEE-754 binary64 without access to the FPU rounding mode: neighbours of a
 * double (`nextUp` / `nextDown`, by bit manipulation through a `DataView`), the error-free
 * transformations TwoSum (Knuth) and TwoProduct (Dekker / Veltkamp split), and the rounded-down /
 * rounded-up `+ - × ÷ √` built from them.
 *
 * Contract of every `xDown(a, b)` / `xUp(a, b)` (round-to-nearest-even is the only assumption on the
 * host arithmetic, which ECMAScript mandates):
 *   `xDown(a, b) <= a ∘ b <= xUp(a, b)` for the exact real `a ∘ b`, and when the exact result is a
 *   double both return it unchanged (exactness is detected with the error-free transformations
 *   whenever they are valid; otherwise the result is moved one ulp outward, which is always sound
 *   because a correctly rounded result is within half an ulp of the exact value).
 * Overflow is sound in the extended sense: `xUp` may return `+Infinity`, `xDown` may return
 * `-Infinity`; `xDown` never returns `+Infinity` (an exact result above `MAX_VALUE` is bounded below
 * by `MAX_VALUE`) and `xUp` never returns `-Infinity`. A zero operand of a product gives an exact 0,
 * also against an infinite endpoint (the interval convention `0 · ∞ = 0`: an infinite endpoint is
 * an unattained bound, never a value). No result is ever `NaN` for non-`NaN` inputs that respect
 * those conventions.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/geom/expansion.rs (two_sum / two_product, the error-free
 *   transformations), solidcore/crates/solidcore/src/nurbs/math.rs (`gamma`, `UNIT`),
 *   solidcore/crates/solidcore/src/geom/certified.rs (outward steps of an ulp). Rewritten for
 *   cadloom; not a translation (upstream carries `gamma_n` budgets, it has no interval type).
 */

const VIEW = new DataView(new ArrayBuffer(8));

/** Unit roundoff `u = 2^-53`. */
export const UNIT_ROUNDOFF = 2 ** -53;

/** Higham's `γ_n = n u / (1 - n u)`, rounded up: the relative error bound of `n` roundings. */
export function gamma(n: number): number {
  const nu = n * UNIT_ROUNDOFF;
  return nextUp(nu / (1 - nu));
}

/** The least double strictly greater than `x` (`+Infinity` stays; `-Infinity` gives `-MAX_VALUE`; `±0` gives the least subnormal). */
export function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  if (x === -Infinity) return -Number.MAX_VALUE;
  VIEW.setFloat64(0, x);
  const bits = VIEW.getBigUint64(0);
  // Positive: one more in the bit pattern; negative: one less in magnitude (sign bit set).
  VIEW.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
  const y = VIEW.getFloat64(0);
  return y === 0 ? -0 : y; // -MIN_VALUE steps to -0, which is still > -MIN_VALUE
}

/** The greatest double strictly less than `x` (mirror of {@link nextUp}). */
export function nextDown(x: number): number {
  return -nextUp(-x);
}

/** TwoSum: `s = fl(a + b)` and the exact error `e` with `a + b = s + e` (valid when `s` is finite). */
export function twoSum(a: number, b: number): readonly [number, number] {
  const s = a + b;
  const bb = s - a;
  const e = a - (s - bb) + (b - bb);
  return [s, e];
}

const SPLITTER = 134217729; // 2^27 + 1
const SAFE_HI = 2 ** 450;
const SAFE_LO = 2 ** -450;

/** Whether TwoProduct is exact for `a`, `b`: no overflow in the split and no underflow in the error term. */
function productSafe(a: number, b: number): boolean {
  const aa = Math.abs(a), ab = Math.abs(b);
  return aa < SAFE_HI && ab < SAFE_HI && aa > SAFE_LO && ab > SAFE_LO;
}

function split(a: number): readonly [number, number] {
  const c = SPLITTER * a;
  const hi = c - (c - a);
  return [hi, a - hi];
}

/**
 * TwoProduct (Dekker): `p = fl(a b)` and `e` with `a b = p + e` exactly, or `undefined` when the
 * operands lie outside `[2^-450, 2^450]` in magnitude (then the split could overflow or the error
 * term underflow, and the caller falls back to an ulp step).
 */
export function twoProduct(a: number, b: number): readonly [number, number] | undefined {
  if (!productSafe(a, b)) return undefined;
  const p = a * b;
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  const e = al * bl - (p - ah * bh - al * bh - ah * bl);
  return [p, e];
}

/** `r` rounded toward `-∞` given the sign of `exact - r` (`undefined`: unknown). */
function down(r: number, sign: number | undefined): number {
  if (r === Infinity) return Number.MAX_VALUE;
  if (r === -Infinity) return r;
  return sign === 0 || (sign !== undefined && sign > 0) ? r : nextDown(r);
}

function up(r: number, sign: number | undefined): number {
  if (r === -Infinity) return -Number.MAX_VALUE;
  if (r === Infinity) return r;
  return sign === 0 || (sign !== undefined && sign < 0) ? r : nextUp(r);
}

function sumErrorSign(a: number, b: number): number | undefined {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0; // an infinite endpoint: exact (extended)
  const [s, e] = twoSum(a, b);
  return Number.isFinite(s) ? Math.sign(e) : undefined;
}

export function addDown(a: number, b: number): number {
  return down(a + b, sumErrorSign(a, b));
}
export function addUp(a: number, b: number): number {
  return up(a + b, sumErrorSign(a, b));
}
export function subDown(a: number, b: number): number {
  return addDown(a, -b);
}
export function subUp(a: number, b: number): number {
  return addUp(a, -b);
}

function productErrorSign(a: number, b: number): number | undefined {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const tp = twoProduct(a, b);
  return tp === undefined ? undefined : Math.sign(tp[1]);
}

export function mulDown(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return down(a * b, productErrorSign(a, b));
}
export function mulUp(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return up(a * b, productErrorSign(a, b));
}

/** Sign of `a / b - q` for `q = fl(a / b)`, or `undefined` when it cannot be decided exactly. */
function quotientErrorSign(a: number, b: number, q: number): number | undefined {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(q) ? undefined : 0;
  if (!Number.isFinite(q) || q === 0) return a === 0 ? 0 : undefined;
  const tp = twoProduct(q, b);
  if (tp === undefined) return undefined;
  // q b = p + e exactly; a - p is exact (Sterbenz: p is within a factor 2 of a), so the residual
  // a - q b = (a - p) - e has the sign of the exact comparison of the two doubles.
  const r = a - tp[0];
  const s = r > tp[1] ? 1 : r < tp[1] ? -1 : 0;
  return b > 0 ? s : -s;
}

/**
 * `a / b` rounded down; `b` must be non-zero (callers check). Two infinite operands (unattained
 * bounds of unbounded intervals) give `-Infinity` (`divUp`: `+Infinity`), never `NaN`.
 */
export function divDown(a: number, b: number): number {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return -Infinity;
  const q = a / b;
  if (q === 0 && a === 0) return 0;
  return down(q, quotientErrorSign(a, b, q));
}
export function divUp(a: number, b: number): number {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return Infinity;
  const q = a / b;
  if (q === 0 && a === 0) return 0;
  return up(q, quotientErrorSign(a, b, q));
}

/** Sign of `x - r²` for `r = fl(√x)` (exact when TwoProduct is valid). */
function sqrtErrorSign(x: number, r: number): number | undefined {
  if (x === 0 || x === Infinity) return 0;
  const tp = twoProduct(r, r);
  if (tp === undefined) return undefined;
  const d = x - tp[0];
  return d > tp[1] ? 1 : d < tp[1] ? -1 : 0;
}

/** `√x` rounded down, for `x >= 0`. */
export function sqrtDown(x: number): number {
  const r = Math.sqrt(x);
  return Math.max(0, down(r, sqrtErrorSign(x, r)));
}
/** `√x` rounded up, for `x >= 0`. */
export function sqrtUp(x: number): number {
  const r = Math.sqrt(x);
  return up(r, sqrtErrorSign(x, r));
}
