/**
 * Exact orientation predicates on double-precision points.
 *
 * `orient2d(a, b, c)` is the sign of
 *   (ax - cx)(by - cy) - (ay - cy)(bx - cx)   (= (b - a) × (c - a)),
 * positive when `a, b, c` turn counterclockwise, zero when collinear.
 *
 * `orient3d(a, b, c, d)` is the sign of minus Shewchuk's determinant
 *   det[a - d; b - d; c - d] = adz (bdx cdy - cdx bdy) + bdz (cdx ady - adx cdy) + cdz (adx bdy - bdx ady),
 * which equals `((b - a) × (c - a)) · (d - a)`: positive when `d` is on the side of the plane
 * `abc` that `(b - a) × (c - a)` points to (`abc` counterclockwise seen from `d`), zero when
 * coplanar. (This is the CGAL `orientation` convention; Shewchuk's `orient3d` has the opposite
 * sign.)
 *
 * The answer is always the sign of the exact determinant of the inputs' exact values. A
 * floating-point filter answers first when it can prove the sign; otherwise the determinant is
 * evaluated exactly in dyadic bigint arithmetic (`src/exact/dyadic.ts`), which is authoritative.
 *
 * ## Filter bound (Shewchuk 1997, "Adaptive Precision Floating-Point Arithmetic and Fast Robust
 * Geometric Predicates", §4.3, bounds `ccwerrboundA` and `o3derrboundA`)
 *
 * With round-to-nearest and unit roundoff `u = 2^-53`, every floating operation obeys
 * `fl(x op y) = (x op y)(1 + δ)`, `|δ| <= u`, as long as no result underflows (overflow yields a
 * non-finite value, which the filter rejects). Then:
 * - orient2d: the computed `det = fl(fl(L) - fl(R))` with `L, R` the two products of rounded
 *   differences satisfies `|det - exact| <= (3u + 16u²)(|L| + |R|)`, where the bound itself is
 *   evaluated in floating point (Shewchuk proves the rounding of `|L| + |R|` and of the final
 *   multiplication is absorbed by the `16u²` term). Three roundings lie on each path to the
 *   result (difference, product, final difference), hence the leading `3u`.
 * - orient3d: with `permanent` the floating sum of the absolute values of the six triple
 *   products (grouped as the determinant is), `|det - exact| <= (7u + 56u²) permanent`.
 * When `|det| > errbound` the computed sign is the exact sign; otherwise we fall back.
 *
 * The `(1 + δ)` model fails only for an underflowing product (sums and differences that are
 * subnormal are exact). The filter is therefore used only when every non-zero coordinate
 * difference has magnitude at least `2^-300`. Then a product of two differences is 0 or at least
 * `2^-600`; a 2x2 minor, the difference of two such doubles, is 0 or at least their ulp
 * (`>= 2^-652`); its product with a third difference is 0 or at least `2^-952`; the permanent's
 * products are at least `2^-900`; and `errbound >= 2^-950` when non-zero. None of these
 * underflow (least normal `2^-1022`). Inputs with tinier non-zero differences always take the
 * exact path.
 *
 * Upstream consulted (attribution, Apache-2.0 / MIT): solidcore `geom/expansion.rs` (Shewchuk's
 * exact expansions, used upstream for exact plane / axis tests), `geom/certified.rs` (the
 * `Verdict` yes / no / undecided discipline of proved floating bounds), `math.rs` (`det3`).
 * Upstream has no general `orient2d` / `orient3d`; these follow Shewchuk's published predicates.
 *
 * Formal model: `formal/CadloomFormal/Exact.lean` (`orient2d`, `orient3d`, `orient2dDy`,
 * `orient3dDy` and their theorems). The filter bound is not formalised.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Point2, Point3 } from '../math/vec.ts';
import {
  addDyadic,
  dyadicFromNumber,
  mulDyadic,
  signDyadic,
  subDyadic,
  type Dyadic,
  type Sign,
} from './dyadic.ts';

export type { Sign } from './dyadic.ts';

const U = 2 ** -53;
/** Shewchuk's `ccwerrboundA`. */
export const ORIENT2D_ERRBOUND = (3 + 16 * U) * U;
/** Shewchuk's `o3derrboundA`. */
export const ORIENT3D_ERRBOUND = (7 + 56 * U) * U;
/** Least magnitude of a non-zero coordinate difference for which the filter is used. */
const FILTER_MIN_DIFF = 2 ** -300;

/** Whether `d` cannot make a product of up to three factors underflow. */
const filterSafe = (d: number): boolean => d === 0 || Math.abs(d) >= FILTER_MIN_DIFF;

const signOf = (x: number): Sign => (x > 0 ? 1 : x < 0 ? -1 : 0);
/** `-s` without producing `-0`. */
const negSign = (s: Sign): Sign => (s === 0 ? 0 : s === 1 ? -1 : 1);

function finite2(p: Point2): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function finite3(p: Point3): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

/** Decodes every coordinate (all finite: checked by the caller). */
function dy(x: number): Dyadic {
  const r = dyadicFromNumber(x);
  if (!r.ok) throw new Error('exact: coordinate not finite after check'); // invariant
  return r.value;
}

/** Exact orient2d determinant of finite points (Lean `orient2dDy`, same expression tree). */
function orient2dDeterminant(a: Point2, b: Point2, c: Point2): Dyadic {
  const ax = dy(a.x), ay = dy(a.y), bx = dy(b.x), by = dy(b.y), cx = dy(c.x), cy = dy(c.y);
  return subDyadic(
    mulDyadic(subDyadic(ax, cx), subDyadic(by, cy)),
    mulDyadic(subDyadic(ay, cy), subDyadic(bx, cx)),
  );
}

/**
 * Exact orient3d determinant of finite points, before the final negation (Lean `orient3dDy`
 * is the negation of this tree).
 */
function shewchukOrient3dDeterminant(a: Point3, b: Point3, c: Point3, d: Point3): Dyadic {
  const dx = dy(d.x), dyy = dy(d.y), dz = dy(d.z);
  const adx = subDyadic(dy(a.x), dx), ady = subDyadic(dy(a.y), dyy), adz = subDyadic(dy(a.z), dz);
  const bdx = subDyadic(dy(b.x), dx), bdy = subDyadic(dy(b.y), dyy), bdz = subDyadic(dy(b.z), dz);
  const cdx = subDyadic(dy(c.x), dx), cdy = subDyadic(dy(c.y), dyy), cdz = subDyadic(dy(c.z), dz);
  return addDyadic(
    addDyadic(
      mulDyadic(adz, subDyadic(mulDyadic(bdx, cdy), mulDyadic(cdx, bdy))),
      mulDyadic(bdz, subDyadic(mulDyadic(cdx, ady), mulDyadic(adx, cdy))),
    ),
    mulDyadic(cdz, subDyadic(mulDyadic(adx, bdy), mulDyadic(bdx, ady))),
  );
}

/** orient2d by exact arithmetic only (no filter). */
export function orient2dExact(a: Point2, b: Point2, c: Point2): Result<Sign> {
  if (!(finite2(a) && finite2(b) && finite2(c))) return invalidInput('exact.orient2d', 'non-finite coordinate');
  return ok(signDyadic(orient2dDeterminant(a, b, c)));
}

/** orient3d by exact arithmetic only (no filter). */
export function orient3dExact(a: Point3, b: Point3, c: Point3, d: Point3): Result<Sign> {
  if (!(finite3(a) && finite3(b) && finite3(c) && finite3(d))) {
    return invalidInput('exact.orient3d', 'non-finite coordinate');
  }
  return ok(negSign(signDyadic(shewchukOrient3dDeterminant(a, b, c, d))));
}

/**
 * The filter alone: the proved sign of the orient2d determinant, or `undefined` when the
 * floating evaluation cannot decide it. Inputs must be finite.
 */
export function orient2dFilter(a: Point2, b: Point2, c: Point2): Sign | undefined {
  const acx = a.x - c.x, bcx = b.x - c.x, acy = a.y - c.y, bcy = b.y - c.y;
  if (!(filterSafe(acx) && filterSafe(bcx) && filterSafe(acy) && filterSafe(bcy))) return undefined;
  const left = acx * bcy;
  const right = acy * bcx;
  const det = left - right;
  const errbound = ORIENT2D_ERRBOUND * (Math.abs(left) + Math.abs(right));
  // NaN / infinite intermediates make both comparisons false.
  if (det > errbound || -det > errbound) return signOf(det);
  return undefined;
}

/**
 * The filter alone for orient3d (in this module's sign convention), or `undefined`.
 * Inputs must be finite.
 */
export function orient3dFilter(a: Point3, b: Point3, c: Point3, d: Point3): Sign | undefined {
  const adx = a.x - d.x, bdx = b.x - d.x, cdx = c.x - d.x;
  const ady = a.y - d.y, bdy = b.y - d.y, cdy = c.y - d.y;
  const adz = a.z - d.z, bdz = b.z - d.z, cdz = c.z - d.z;
  if (
    !(filterSafe(adx) && filterSafe(bdx) && filterSafe(cdx) &&
      filterSafe(ady) && filterSafe(bdy) && filterSafe(cdy) &&
      filterSafe(adz) && filterSafe(bdz) && filterSafe(cdz))
  ) return undefined;
  const bdxcdy = bdx * cdy, cdxbdy = cdx * bdy;
  const cdxady = cdx * ady, adxcdy = adx * cdy;
  const adxbdy = adx * bdy, bdxady = bdx * ady;
  const det = adz * (bdxcdy - cdxbdy) + bdz * (cdxady - adxcdy) + cdz * (adxbdy - bdxady);
  const permanent =
    (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz) +
    (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz) +
    (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz);
  const errbound = ORIENT3D_ERRBOUND * permanent;
  if (det > errbound || -det > errbound) return signOf(-det);
  return undefined;
}

/**
 * Exact orientation of three 2D points: `1` counterclockwise, `-1` clockwise, `0` collinear.
 * Non-finite coordinates are an `invalid-input` error.
 */
export function orient2d(a: Point2, b: Point2, c: Point2): Result<Sign> {
  if (!(finite2(a) && finite2(b) && finite2(c))) return invalidInput('exact.orient2d', 'non-finite coordinate');
  const fast = orient2dFilter(a, b, c);
  if (fast !== undefined) return ok(fast);
  return ok(signDyadic(orient2dDeterminant(a, b, c)));
}

/**
 * Exact orientation of `d` against the plane through `a, b, c`: `1` when `d` is on the side
 * `(b - a) × (c - a)` points to, `-1` on the other side, `0` coplanar.
 * Non-finite coordinates are an `invalid-input` error.
 */
export function orient3d(a: Point3, b: Point3, c: Point3, d: Point3): Result<Sign> {
  if (!(finite3(a) && finite3(b) && finite3(c) && finite3(d))) {
    return invalidInput('exact.orient3d', 'non-finite coordinate');
  }
  const fast = orient3dFilter(a, b, c, d);
  if (fast !== undefined) return ok(fast);
  return ok(negSign(signDyadic(shewchukOrient3dDeterminant(a, b, c, d))));
}
