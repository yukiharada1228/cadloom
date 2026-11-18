/**
 * The exact incircle predicate on double-precision points (used by the Lawson flips of the display mesher,
 * `src/tess/triangulate.ts`; it lives here with the other exact predicates).
 *
 * `incircle(a, b, c, d)` is the sign of
 *   | adx  ady  adx² + ady² |
 *   | bdx  bdy  bdx² + bdy² |      (adx = ax - dx, …)
 *   | cdx  cdy  cdx² + cdy² |
 * = alift (bdx cdy - cdx bdy) + blift (cdx ady - adx cdy) + clift (adx bdy - bdx ady):
 * positive when `d` lies inside the circle through `a, b, c` and `a, b, c` turn counter-clockwise, zero when
 * the four points are cocircular (or `a, b, c` collinear and `d` on their line). Its sign is always the sign
 * of the exact determinant of the inputs: a floating-point filter answers when Shewchuk's bound proves the
 * sign (`iccerrboundA = (10 + 96u) u` times the permanent), otherwise the determinant is evaluated exactly in
 * the M0 dyadic arithmetic (`src/exact/dyadic.ts`). As for the M0 `orient2d`, the filter is used only when
 * every non-zero coordinate difference is at least `2^-200` in magnitude, so no product of four differences
 * underflows; smaller differences always take the exact path.
 *
 * Upstream consulted (attribution): `solidcore/crates/solidcore-tess/src/mesher/cdt.rs` (Delaunay flips of
 * the constrained triangulation), `solidcore/crates/solidcore/src/geom/expansion.rs` (exact expansions) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT; Shewchuk 1997 for the filter bound.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { addDyadic, dyadicFromNumber, mulDyadic, signDyadic, subDyadic, type Dyadic, type Sign } from './dyadic.ts';
import type { Point2 } from '../math/vec.ts';

const U = 2 ** -53;
/** Shewchuk's `iccerrboundA`. */
export const INCIRCLE_ERRBOUND = (10 + 96 * U) * U;
const FILTER_MIN_DIFF = 2 ** -200;

const safe = (d: number): boolean => d === 0 || Math.abs(d) >= FILTER_MIN_DIFF;
const signOf = (x: number): Sign => (x > 0 ? 1 : x < 0 ? -1 : 0);

function dy(x: number): Dyadic {
  const r = dyadicFromNumber(x);
  if (!r.ok) throw new Error('tess.incircle: coordinate not finite'); // invariant: callers pass finite points
  return r.value;
}

function incircleExact(a: Point2, b: Point2, c: Point2, d: Point2): Sign {
  const dx = dy(d.x), dyy = dy(d.y);
  const adx = subDyadic(dy(a.x), dx), ady = subDyadic(dy(a.y), dyy);
  const bdx = subDyadic(dy(b.x), dx), bdy = subDyadic(dy(b.y), dyy);
  const cdx = subDyadic(dy(c.x), dx), cdy = subDyadic(dy(c.y), dyy);
  const lift = (x: Dyadic, y: Dyadic): Dyadic => addDyadic(mulDyadic(x, x), mulDyadic(y, y));
  const det = addDyadic(
    addDyadic(
      mulDyadic(lift(adx, ady), subDyadic(mulDyadic(bdx, cdy), mulDyadic(cdx, bdy))),
      mulDyadic(lift(bdx, bdy), subDyadic(mulDyadic(cdx, ady), mulDyadic(adx, cdy))),
    ),
    mulDyadic(lift(cdx, cdy), subDyadic(mulDyadic(adx, bdy), mulDyadic(bdx, ady))),
  );
  return signDyadic(det);
}

/** The filter alone: the proved sign, or `undefined` when floating point cannot decide it (always for a non-finite input). */
export function incircleFilter(a: Point2, b: Point2, c: Point2, d: Point2): Sign | undefined {
  const adx = a.x - d.x, ady = a.y - d.y, bdx = b.x - d.x, bdy = b.y - d.y, cdx = c.x - d.x, cdy = c.y - d.y;
  if (!(safe(adx) && safe(ady) && safe(bdx) && safe(bdy) && safe(cdx) && safe(cdy))) return undefined;
  const bdxcdy = bdx * cdy, cdxbdy = cdx * bdy, cdxady = cdx * ady, adxcdy = adx * cdy, adxbdy = adx * bdy, bdxady = bdx * ady;
  const alift = adx * adx + ady * ady, blift = bdx * bdx + bdy * bdy, clift = cdx * cdx + cdy * cdy;
  const det = alift * (bdxcdy - cdxbdy) + blift * (cdxady - adxcdy) + clift * (adxbdy - bdxady);
  const permanent =
    (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * alift +
    (Math.abs(cdxady) + Math.abs(adxcdy)) * blift +
    (Math.abs(adxbdy) + Math.abs(bdxady)) * clift;
  const errbound = INCIRCLE_ERRBOUND * permanent;
  if (det > errbound || -det > errbound) return signOf(det);
  return undefined;
}

/** Exact incircle sign of points known to be finite (the mesher checks its work coordinates once). */
export function incircleSign(a: Point2, b: Point2, c: Point2, d: Point2): Sign {
  return incircleFilter(a, b, c, d) ?? incircleExact(a, b, c, d);
}

/**
 * Exact incircle sign (see the module comment). Fails with `invalid-input` when a coordinate is not finite,
 * as the M0 `orient2d` does.
 */
export function incircle(a: Point2, b: Point2, c: Point2, d: Point2): Result<Sign> {
  for (const p of [a, b, c, d]) {
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y))) return invalidInput('exact.incircle', 'non-finite point');
  }
  return ok(incircleSign(a, b, c, d));
}

/** Exact incircle by the dyadic path only (for tests against the filter). */
export function incircleExactOnly(a: Point2, b: Point2, c: Point2, d: Point2): Sign {
  return incircleExact(a, b, c, d);
}
