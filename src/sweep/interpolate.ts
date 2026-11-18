/**
 * Global B-spline interpolation of many point sequences at shared parameters (The NURBS Book §9.2.1, A9.1), used to
 * skin the sections of a sweep: every control point of the profile traces a sequence of positions at the stations,
 * and each sequence is interpolated by a B-spline curve with the **same** degree, knots and parameters, so the
 * curves are the columns of one tensor-product surface.
 *
 * - parameters: given (the sweep passes the stations' normalised path parameters `v_i = (t_i - t_0) / (t_m - t_0)`);
 * - knots: clamped, interior knots by averaging (eq. 9.8), `u_{j+p} = (1/p) Σ_{i=j}^{j+p-1} v_i`, `j = 1 .. m - p`;
 * - the collocation matrix `N_{j}(v_i)` is banded and totally positive (Schoenberg–Whitney holds for averaged
 *   knots), so it is factored once, by Gaussian elimination without pivoting restricted to its band (de Boor), and
 *   every column of data is solved against the same factors.
 * The curves pass through the data at the parameters exactly (up to rounding of the solve, tested).
 *
 * Not in `src/nurbs` because M1 deferred NURBS fitting; it is the only interpolation in the kernel so far and moves
 * there when fitting lands (one job, one place).
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/nurbs/srf_adv/p4.rs`
 * (skinning the sections of a sweep), `sweep/loft_sections.rs` (sections interpolated across with shared
 * parameters) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { basisFuns } from '../nurbs/basis.ts';
import { findSpan, type Knots } from '../nurbs/knots.ts';

/** A factored collocation system for interpolation at fixed parameters. */
export interface Interpolation {
  readonly degree: number;
  readonly knots: Knots;
  readonly params: readonly number[];
  /** Solves for the control points of one coordinate column (length = `params.length`). */
  readonly solve: (data: readonly number[]) => number[];
}

const OP = 'sweep.interpolation';

/**
 * The interpolation system at strictly increasing `params` from 0 to 1 with degree `min(degree, n - 1)`.
 * Fails with `invalid-input` for fewer than two parameters, unordered parameters or a singular pivot.
 */
export function interpolation(params: readonly number[], degree: number): Result<Interpolation> {
  const n = params.length;
  if (n < 2) return invalidInput(OP, 'need at least two parameters');
  for (let i = 1; i < n; i++) if (!(params[i]! > params[i - 1]!)) return invalidInput(OP, 'parameters must increase strictly');
  if (params[0] !== 0 || params[n - 1] !== 1) return invalidInput(OP, 'parameters must run from 0 to 1');
  const p = Math.min(degree, n - 1);
  const knots: number[] = [];
  for (let i = 0; i <= p; i++) knots.push(0);
  for (let j = 1; j <= n - 1 - p; j++) {
    let s = 0;
    for (let i = j; i < j + p; i++) s += params[i]!;
    knots.push(s / p);
  }
  for (let i = 0; i <= p; i++) knots.push(1);

  // Dense storage, banded elimination: row i has its non-zeros in columns span - p .. span.
  const A: Float64Array[] = Array.from({ length: n }, () => new Float64Array(n));
  let band = 0;
  for (let i = 0; i < n; i++) {
    const span = findSpan(knots, p, params[i]!);
    const N = basisFuns(knots, p, span, params[i]!);
    for (let j = 0; j <= p; j++) {
      const col = span - p + j;
      A[i]![col] = N[j]!;
      if (N[j]! !== 0) band = Math.max(band, Math.abs(col - i));
    }
  }
  for (let k = 0; k < n; k++) {
    const pivot = A[k]![k]!;
    if (!(Math.abs(pivot) > 1e-300)) return invalidInput(OP, 'singular interpolation matrix');
    for (let i = k + 1; i <= Math.min(n - 1, k + band); i++) {
      const f = A[i]![k]! / pivot;
      if (f === 0) continue;
      A[i]![k] = f;
      for (let j = k + 1; j <= Math.min(n - 1, k + band); j++) A[i]![j]! -= f * A[k]![j]!;
    }
  }
  const solve = (data: readonly number[]): number[] => {
    const x = data.slice();
    for (let i = 1; i < n; i++) for (let k = Math.max(0, i - band); k < i; k++) x[i]! -= A[i]![k]! * x[k]!;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j <= Math.min(n - 1, i + band); j++) x[i]! -= A[i]![j]! * x[j]!;
      x[i] = x[i]! / A[i]![i]!;
    }
    return x;
  };
  return ok(Object.freeze({ degree: p, knots: Object.freeze(knots), params: Object.freeze(params.slice()), solve }));
}

/** The B-spline value `Σ N_j(v) c_j` of one control column `c` of an interpolation at `v in [0, 1]`. */
export function interpolationValue(ip: Interpolation, column: readonly number[], v: number): number {
  const span = findSpan(ip.knots, ip.degree, v);
  const N = basisFuns(ip.knots, ip.degree, span, v);
  let s = 0;
  for (let j = 0; j <= ip.degree; j++) s += N[j]! * column[span - ip.degree + j]!;
  return s;
}
