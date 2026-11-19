/**
 * The small dense linear solves of the M4 intersection code — the one place for them (POLICY §3.5):
 *
 * - `invertMatrix`: the inverse of an `n <= 3` matrix by Gauss–Jordan with partial pivoting (the
 *   Gauss–Newton steps of curve/curve and curve/surface refinement, and the preconditioner
 *   `Y = mid(J)⁻¹` of the Krawczyk tests in `curve-curve.ts` / `curve-surface.ts`);
 *
 * and, by Cramer's rule, the surface/surface solves (Lean model:
 * formal/CadloomFormal/IntersectSurface.lean):
 *
 * - `solveSym2`: the 2×2 normal equations `[[E, F], [F, G]] (x, y) = (f, g)` of a least-squares
 *   pull-back of a 3D vector onto a surface's tangent plane (`x S_u + y S_v ≈ w`, with
 *   `f = w·S_u`, `g = w·S_v`): `x = (G f - F g) / D`, `y = (E g - F f) / D`, `D = EG - F²`
 *   (Lean `solveSym2_spec`);
 * - `solve3`: a general 3×3 system `M y = r` by cofactors (Lean `solve3_spec`);
 * - `minNormStep`: the minimum-norm Gauss–Newton step of the 3 equations / 4 unknowns system
 *   `J Δ = b` with `J = [c0 c1 c2 c3]` (columns in R³): `y = (J Jᵀ)⁻¹ b`, `Δ_k = c_k · y`, so
 *   `J Δ = (J Jᵀ) y = b` (Lean `minNormStep_spec`).
 * A solve returns `undefined` when its determinant is not a positive-magnitude finite double
 * relative to the scale of its entries (the caller treats that as a singular point).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/surface_intersector/p1.rs (`refine_point`: Newton
 *   onto both surfaces), solidcore/crates/ssi/src/march.rs (corrector), solidcore/crates/solidcore/
 *   src/math.rs (small determinants). Rewritten for cadloom; not a translation.
 */
import type { Vec3 } from '../math/vec.ts';

/** Relative size below which a determinant counts as singular. */
export const SINGULAR_REL = 1e-14;

/** Solves `[[a, b], [b, c]] (x, y) = (f, g)`; `undefined` when `|ac - b²|` is negligible. */
export function solveSym2(a: number, b: number, c: number, f: number, g: number): readonly [number, number] | undefined {
  const det = a * c - b * b;
  const scale = Math.abs(a * c) + b * b;
  if (!Number.isFinite(det) || !(Math.abs(det) > SINGULAR_REL * scale)) return undefined;
  const x = (c * f - b * g) / det;
  const y = (a * g - b * f) / det;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

/** A 3×3 matrix by rows. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/** The determinant of a row-major 3×3 matrix (cofactor expansion along the first row). */
export function det3(m: Mat3): number {
  const [a, b, c, d, e, f, g, h, i] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** Solves `M y = r` by Cramer's rule; `undefined` when `det M` is negligible against the entries. */
export function solve3(m: Mat3, r: readonly [number, number, number]): readonly [number, number, number] | undefined {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = det3(m);
  const rowScale = (x: number, y: number, z: number): number => Math.abs(x) + Math.abs(y) + Math.abs(z);
  const scale = rowScale(a, b, c) * rowScale(d, e, f) * rowScale(g, h, i);
  if (!Number.isFinite(det) || !(Math.abs(det) > SINGULAR_REL * scale)) return undefined;
  const [p, q, s] = r;
  const y0 = (p * (e * i - f * h) - b * (q * i - f * s) + c * (q * h - e * s)) / det;
  const y1 = (a * (q * i - f * s) - p * (d * i - f * g) + c * (d * s - q * g)) / det;
  const y2 = (a * (e * s - q * h) - b * (d * s - q * g) + p * (d * h - e * g)) / det;
  return Number.isFinite(y0) && Number.isFinite(y1) && Number.isFinite(y2) ? [y0, y1, y2] : undefined;
}

/** `M = Σ_k c_k c_kᵀ` for column vectors `c_k`. */
function gram(cols: readonly Vec3[]): Mat3 {
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const c of cols) {
    xx += c.x * c.x; xy += c.x * c.y; xz += c.x * c.z;
    yy += c.y * c.y; yz += c.y * c.z; zz += c.z * c.z;
  }
  return [xx, xy, xz, xy, yy, yz, xz, yz, zz];
}

/**
 * The minimum-norm solution `Δ` of `Σ_k Δ_k c_k = b` (three equations, `cols.length` unknowns):
 * `Δ_k = c_k · (J Jᵀ)⁻¹ b`. `undefined` when the columns do not span R³ (to rounding).
 */
export function minNormStep(cols: readonly Vec3[], b: Vec3): number[] | undefined {
  const y = solve3(gram(cols), [b.x, b.y, b.z]);
  if (y === undefined) return undefined;
  return cols.map((c) => c.x * y[0] + c.y * y[1] + c.z * y[2]);
}

/** Solves `Σ_k Δ_k c_k = b` for exactly three columns (a square system). */
export function solveColumns3(c0: Vec3, c1: Vec3, c2: Vec3, b: Vec3): readonly [number, number, number] | undefined {
  return solve3([c0.x, c1.x, c2.x, c0.y, c1.y, c2.y, c0.z, c1.z, c2.z], [b.x, b.y, b.z]);
}

/** Inverse of a small (n <= 3) double matrix by Gauss–Jordan with partial pivoting, or `undefined`. */
export function invertMatrix(m: readonly (readonly number[])[]): number[][] | undefined {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    const piv = a[p]![c]!;
    if (!(Math.abs(piv) > 0) || !Number.isFinite(piv)) return undefined;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const row = a[c]!;
    for (let k = 0; k < 2 * n; k++) row[k] = row[k]! / piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r]![c]!;
      if (f === 0) continue;
      for (let k = 0; k < 2 * n; k++) a[r]![k] = a[r]![k]! - f * row[k]!;
    }
  }
  const inv = a.map((row) => row.slice(n));
  return inv.every((row) => row.every(Number.isFinite)) ? inv : undefined;
}
