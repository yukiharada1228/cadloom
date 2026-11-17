/**
 * Knot insertion (Boehm's algorithm, The NURBS Book A5.1 CurveKnotIns) and knot refinement by
 * repeated insertion. The curve's shape and parametrization are unchanged; rational curves are
 * processed in homogeneous coordinates.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/crv_nurb.rs, solidcore/crates/solidcore/src/nurbs/knots.rs
 *   (find_span_and_mult), solidcore/crates/solidcore/src/nurbs/b_spline_curve.rs. Rewritten for cadloom.
 *
 * Formal model: for one insertion (`times = 1`) the new points are the Lean
 * `CadloomFormal.Nurbs.insertedPts`: `Q[i] = a_i P[i] + (1 - a_i) P[i-1]` with
 * `a_i = (u - U[i]) / (U[i+p] - U[i])` for `i = k-p+1 .. k-s`, copies elsewhere.
 */
import { invalidInput, type Result } from '../core/error.ts';
import { createNurbsCurve, curveDomain, homogeneousPoints, type NurbsCurve } from './curve.ts';
import { findSpan, knotMultiplicity } from './knots.ts';

/**
 * Inserts the knot `u` `times` times (A5.1). Requires `U[p] <= u < U[n+1]` (inserting at the
 * domain end is not supported) and `multiplicity(u) + times <= p`, so the result is again a valid
 * curve. Returns a new curve; the input is not modified.
 */
export function insertKnot(curve: NurbsCurve, u: number, times = 1): Result<NurbsCurve> {
  const op = 'nurbs.insertKnot';
  const p = curve.degree;
  const U = curve.knots;
  const [lo, hi] = curveDomain(curve);
  if (!Number.isFinite(u) || u < lo || u >= hi) return invalidInput(op, `parameter ${u} outside [${lo}, ${hi})`);
  if (!Number.isInteger(times) || times < 1) return invalidInput(op, 'times must be a positive integer');
  const s = knotMultiplicity(U, u);
  if (s + times > p) return invalidInput(op, 'resulting knot multiplicity would exceed the degree');
  const k = findSpan(U, p, u);
  const r = times;
  const Pw = homogeneousPoints(curve);
  const np = Pw.length - 1;
  const mp = np + p + 1;

  // New knots.
  const UQ: number[] = [];
  for (let i = 0; i <= k; i++) UQ.push(U[i]!);
  for (let i = 1; i <= r; i++) UQ.push(u);
  for (let i = k + 1; i <= mp; i++) UQ.push(U[i]!);

  // Unaltered control points.
  const Qw: number[][] = new Array<number[]>(np + r + 1);
  for (let i = 0; i <= k - p; i++) Qw[i] = Pw[i]!.slice();
  for (let i = k - s; i <= np; i++) Qw[i + r] = Pw[i]!.slice();
  const Rw: number[][] = [];
  for (let i = 0; i <= p - s; i++) Rw.push(Pw[k - p + i]!.slice());

  // Insert the knot r times.
  let L = k - p + 1;
  for (let j = 1; j <= r; j++) {
    L = k - p + j;
    for (let i = 0; i <= p - j - s; i++) {
      const den = U[i + k + 1]! - U[L + i]!;
      const alpha = den === 0 ? 0 : (u - U[L + i]!) / den;
      const a = Rw[i]!;
      const b = Rw[i + 1]!;
      for (let c = 0; c < a.length; c++) a[c] = alpha * b[c]! + (1 - alpha) * a[c]!;
    }
    Qw[L] = Rw[0]!.slice();
    Qw[k + r - j - s] = Rw[p - j - s]!.slice();
  }
  for (let i = L + 1; i < k - s; i++) Qw[i] = Rw[i - L]!.slice();

  if (curve.weights === undefined) return createNurbsCurve(p, UQ, Qw);
  const dim = curve.dimension;
  const weights = Qw.map((h) => h[dim]!);
  const points = Qw.map((h) => h.slice(0, dim).map((c) => c / h[dim]!));
  return createNurbsCurve(p, UQ, points, weights);
}

/**
 * Inserts every value of `values` once, in the given order (knot refinement by repeated A5.1).
 * Fails on the first value that {@link insertKnot} rejects.
 */
export function refineKnots(curve: NurbsCurve, values: readonly number[]): Result<NurbsCurve> {
  let current: Result<NurbsCurve> = { ok: true, value: curve };
  for (const v of values) {
    if (!current.ok) return current;
    current = insertKnot(current.value, v, 1);
  }
  return current;
}
