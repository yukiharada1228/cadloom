/**
 * Affine transforms of 3-space as 3x4 matrices `[L | t]`, row-major, acting on column vectors:
 * `applyPoint(f, p) = L p + t`, `applyVector(f, v) = L v`. Entry `(i, j)` is `m[4 * i + j]`.
 *
 * Convention note: upstream stores a row-vector 4x4 matrix (`p' = [p 1] M`, rows the images of
 * the axes, `concat(self, next)` applies `self` first). Here the matrix is the transpose's
 * upper 3x4 block, and `compose(f, g)` reads like function composition: first `g`, then `f`.
 *
 * Invariant: every `Transform` has finite entries. Each constructor and `compose` return an
 * `invalid-input` error instead of a transform whose entries overflowed, so `determinantSign` and
 * `inverse` never see a non-finite entry. (`applyPoint` / `applyVector` may still overflow to
 * infinite coordinates for huge inputs; they return plain doubles.)
 *
 * Floating-point: entries and results are doubles; the algebraic laws (associativity of
 * `compose`, `inverse` undoing the map, ...) hold exactly in the rational model
 * (`formal/CadloomFormal/Transform.lean`) and up to rounding here. Singularity of `inverse` is
 * decided exactly (the sign of the determinant of the stored doubles, in dyadic arithmetic).
 *
 * Upstream consulted (attribution, Apache-2.0 / MIT): solidcore `math.rs` (`Transform`,
 * `det3`, `concat`, `transform_point`, `transform_vector`, `rotation` (Rodrigues),
 * `uniform_scaling`, `inverse` via the adjugate, `is_regular`), `geom/transform.rs`.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { vec3, type Point3, type Vec3 } from './vec.ts';
import {
  addDyadic,
  dyadicFromNumber,
  mulDyadic,
  signDyadic,
  subDyadic,
  type Dyadic,
  type Sign,
} from '../exact/dyadic.ts';

/** Row-major 3x4 matrix entries `m00 m01 m02 m03 m10 ... m23`. */
export type Mat34 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export interface Transform {
  readonly m: Mat34;
}

const OP = 'math.transform';

/** Freezes a copy of the entries; `-0` is stored as `0` so equal maps compare equal. */
function make(m: Mat34): Transform {
  return Object.freeze({ m: Object.freeze(m.map((x) => (x === 0 ? 0 : x))) as unknown as Mat34 });
}

/** `make` after checking that every entry is finite (the module invariant). */
function checked(m: Mat34, what: string): Result<Transform> {
  if (!m.every((x) => Number.isFinite(x))) return invalidInput(OP, `${what} overflows the floating-point range`);
  return ok(make(m));
}

const finite3 = (v: Vec3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

export const IDENTITY_TRANSFORM: Transform = make([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);

/** A transform from 12 row-major entries; rejects a wrong length or a non-finite entry. */
export function transformFromMatrix(entries: readonly number[]): Result<Transform> {
  if (entries.length !== 12) return invalidInput(OP, `expected 12 entries, got ${entries.length}`);
  if (!entries.every((x) => Number.isFinite(x))) return invalidInput(OP, 'non-finite matrix entry');
  return ok(make(entries as unknown as Mat34));
}

/** `p ↦ p + v`. */
export function translation(v: Vec3): Result<Transform> {
  if (!finite3(v)) return invalidInput(OP, 'non-finite translation');
  return ok(make([1, 0, 0, v.x, 0, 1, 0, v.y, 0, 0, 1, v.z]));
}

/**
 * Scaling by `(sx, sy, sz)` about `center` (default the origin): `p ↦ c + S (p - c)`.
 * Zero factors are allowed (the result is singular and has no inverse).
 */
export function scaling(sx: number, sy: number, sz: number, center: Point3 = vec3(0, 0, 0)): Result<Transform> {
  if (!(Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz) && finite3(center))) {
    return invalidInput(OP, 'non-finite scaling');
  }
  const c = center;
  return checked([sx, 0, 0, c.x - sx * c.x, 0, sy, 0, c.y - sy * c.y, 0, 0, sz, c.z - sz * c.z], 'scaling');
}

/**
 * Right-handed rotation by `angle` radians about the line through `origin` (default the origin)
 * along `axis` (any length; normalised here). Rodrigues' formula
 * `R = c I + s [k]× + (1 - c) k kᵀ`, translation `o - R o`.
 * Errors: non-finite input, or an axis of zero length.
 */
export function rotation(axis: Vec3, angle: number, origin: Point3 = vec3(0, 0, 0)): Result<Transform> {
  if (!(finite3(axis) && Number.isFinite(angle) && finite3(origin))) {
    return invalidInput(OP, 'non-finite rotation');
  }
  // Scale by the largest component first so the length neither overflows nor underflows.
  const big = Math.max(Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z));
  if (big === 0) return invalidInput(OP, 'rotation axis of zero length');
  const ux = axis.x / big, uy = axis.y / big, uz = axis.z / big;
  const len = Math.hypot(ux, uy, uz);
  const x = ux / len, y = uy / len, z = uz / len;
  const c = Math.cos(angle), s = Math.sin(angle), v = 1 - c;
  const r00 = c + x * x * v, r01 = x * y * v - z * s, r02 = x * z * v + y * s;
  const r10 = y * x * v + z * s, r11 = c + y * y * v, r12 = y * z * v - x * s;
  const r20 = z * x * v - y * s, r21 = z * y * v + x * s, r22 = c + z * z * v;
  const o = origin;
  return checked([
    r00, r01, r02, o.x - (r00 * o.x + r01 * o.y + r02 * o.z),
    r10, r11, r12, o.y - (r10 * o.x + r11 * o.y + r12 * o.z),
    r20, r21, r22, o.z - (r20 * o.x + r21 * o.y + r22 * o.z),
  ], 'rotation');
}

/**
 * `f ∘ g`: apply `g` first, then `f` (Lean `compose`, same entry formulas).
 * Error: an entry of the product overflows.
 */
export function compose(f: Transform, g: Transform): Result<Transform> {
  const [f00, f01, f02, f03, f10, f11, f12, f13, f20, f21, f22, f23] = f.m;
  const [g00, g01, g02, g03, g10, g11, g12, g13, g20, g21, g22, g23] = g.m;
  return checked([
    f00 * g00 + f01 * g10 + f02 * g20,
    f00 * g01 + f01 * g11 + f02 * g21,
    f00 * g02 + f01 * g12 + f02 * g22,
    f00 * g03 + f01 * g13 + f02 * g23 + f03,
    f10 * g00 + f11 * g10 + f12 * g20,
    f10 * g01 + f11 * g11 + f12 * g21,
    f10 * g02 + f11 * g12 + f12 * g22,
    f10 * g03 + f11 * g13 + f12 * g23 + f13,
    f20 * g00 + f21 * g10 + f22 * g20,
    f20 * g01 + f21 * g11 + f22 * g21,
    f20 * g02 + f21 * g12 + f22 * g22,
    f20 * g03 + f21 * g13 + f22 * g23 + f23,
  ], 'composition');
}

/** `L p + t`. */
export function applyPoint(f: Transform, p: Point3): Point3 {
  const m = f.m;
  return vec3(
    m[0] * p.x + m[1] * p.y + m[2] * p.z + m[3],
    m[4] * p.x + m[5] * p.y + m[6] * p.z + m[7],
    m[8] * p.x + m[9] * p.y + m[10] * p.z + m[11],
  );
}

/** `L v` (translation ignored). */
export function applyVector(f: Transform, v: Vec3): Vec3 {
  const m = f.m;
  return vec3(
    m[0] * v.x + m[1] * v.y + m[2] * v.z,
    m[4] * v.x + m[5] * v.y + m[6] * v.z,
    m[8] * v.x + m[9] * v.y + m[10] * v.z,
  );
}

/** Determinant of the linear part, cofactor expansion along the first row (Lean `det`). */
export function determinant(f: Transform): number {
  const [m00, m01, m02, , m10, m11, m12, , m20, m21, m22] = f.m;
  return m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20);
}

/**
 * Exact sign of the determinant of the stored (double) linear part, by dyadic arithmetic.
 * Entries must be finite (guaranteed by the constructors).
 */
export function determinantSign(f: Transform): Sign {
  const d: Dyadic[] = [];
  for (const x of f.m) {
    const r = dyadicFromNumber(x);
    if (!r.ok) throw new Error('transform: non-finite entry'); // invariant of the constructors
    d.push(r.value);
  }
  const e = (i: number): Dyadic => d[i] as Dyadic;
  const minor = (a: number, b: number, c: number, dd: number): Dyadic => subDyadic(mulDyadic(e(a), e(b)), mulDyadic(e(c), e(dd)));
  const det = addDyadic(
    subDyadic(mulDyadic(e(0), minor(5, 10, 6, 9)), mulDyadic(e(1), minor(4, 10, 6, 8))),
    mulDyadic(e(2), minor(4, 9, 5, 8)),
  );
  return signDyadic(det);
}

/** `x * 2^k` for an integer `k` in `[-2100, 2100]`; exact unless the result under- or overflows. */
function timesPow2(x: number, k: number): number {
  const h = Math.trunc(k / 2);
  return x * 2 ** h * 2 ** (k - h);
}

/**
 * The inverse map: linear part `adj(L) / det`, translation `-(L⁻¹ t)` (Lean `inverse`).
 *
 * To keep the determinant out of the under/overflow range for badly scaled (e.g. diagonal
 * `1e-200`) maps, row `i` of `[L | t]` is first multiplied by `2^-k_i`, `2^k_i` about the largest
 * magnitude in row `i` of `L`: that is `S f` with `S = diag(2^-k_i)`, and `f⁻¹ = (S f)⁻¹ ∘ S`
 * (Lean `apply_inverse_scaled_left` / `_right`), so column `j` of the linear part of `(S f)⁻¹` is
 * multiplied by `2^-k_j` afterwards and the translation is kept. Powers of two are exact.
 *
 * Errors: an exactly singular linear part; a floating determinant that underflows, overflows or
 * has the wrong sign (too ill-conditioned to invert in doubles); an inverse entry that overflows.
 */
export function inverse(f: Transform): Result<Transform> {
  const sign = determinantSign(f);
  if (sign === 0) return invalidInput(OP, 'singular transform has no inverse');
  const k = [0, 1, 2].map((i) => {
    const big = Math.max(Math.abs(f.m[4 * i] ?? 0), Math.abs(f.m[4 * i + 1] ?? 0), Math.abs(f.m[4 * i + 2] ?? 0));
    return Math.floor(Math.log2(big)); // big > 0: a zero row would make the map singular
  }) as unknown as readonly [number, number, number];
  const row = (i: 0 | 1 | 2, j: number): number => timesPow2(f.m[4 * i + j] ?? 0, -k[i]);
  const m00 = row(0, 0), m01 = row(0, 1), m02 = row(0, 2), m03 = row(0, 3);
  const m10 = row(1, 0), m11 = row(1, 1), m12 = row(1, 2), m13 = row(1, 3);
  const m20 = row(2, 0), m21 = row(2, 1), m22 = row(2, 2), m23 = row(2, 3);
  const det = m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20);
  if (!Number.isFinite(det) || det === 0) return invalidInput(OP, 'determinant out of floating-point range');
  if ((det > 0 ? 1 : -1) !== sign) return invalidInput(OP, 'transform too ill-conditioned to invert');
  const s = 1 / det;
  // Linear part of (S f)⁻¹ ...
  const b00 = (m11 * m22 - m12 * m21) * s, b01 = (m02 * m21 - m01 * m22) * s, b02 = (m01 * m12 - m02 * m11) * s;
  const b10 = (m12 * m20 - m10 * m22) * s, b11 = (m00 * m22 - m02 * m20) * s, b12 = (m02 * m10 - m00 * m12) * s;
  const b20 = (m10 * m21 - m11 * m20) * s, b21 = (m01 * m20 - m00 * m21) * s, b22 = (m00 * m11 - m01 * m10) * s;
  // ... its translation, kept by `∘ S` ...
  const t0 = -(b00 * m03 + b01 * m13 + b02 * m23);
  const t1 = -(b10 * m03 + b11 * m13 + b12 * m23);
  const t2 = -(b20 * m03 + b21 * m13 + b22 * m23);
  // ... and column j of the linear part times 2^-k_j.
  const [k0, k1, k2] = k;
  return checked([
    timesPow2(b00, -k0), timesPow2(b01, -k1), timesPow2(b02, -k2), t0,
    timesPow2(b10, -k0), timesPow2(b11, -k1), timesPow2(b12, -k2), t1,
    timesPow2(b20, -k0), timesPow2(b21, -k1), timesPow2(b22, -k2), t2,
  ], 'inverse');
}
