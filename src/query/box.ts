/**
 * Box helpers of the query code: the squared distance lower bound from a point to an axis-aligned box (the
 * pruning test of `closestPointOnBody`), and the parameter range in which a ray crosses a box (the pruning test
 * of `rayBody` / `classifyPoint`). Boxes are the certified `Box3` of `src/interval`.
 *
 * `boxDistanceSq(b, p) = Σ_i g_i²` with `g_i = max(lo_i - p_i, 0, p_i - hi_i)`: every point `x` of the box has
 * `|x - p|² >= boxDistanceSq(b, p)` (Lean `Query.boxDistSq_le`), so a box whose bound exceeds the best squared
 * distance found so far cannot hold a closer point (`Query.prune_sound`).
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/query/distance_bound.rs`
 * (box lower bounds pruning distance searches), `intersect/ray_tracer.rs` (box culling of rays) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import type { Point3, Vec3 } from '../math/vec.ts';
import { lineBoxRange, type Box3 } from '../interval/box.ts';

/** The gap of `x` to `[lo, hi]`: `max(lo - x, 0, x - hi)` (Lean `Query.gap`). */
export function axisGap(lo: number, hi: number, x: number): number {
  return Math.max(lo - x, 0, x - hi);
}

/** The squared distance lower bound from `p` to box `b` (Lean `Query.boxDistSq`). */
export function boxDistanceSq(b: Box3, p: Point3): number {
  const gx = axisGap(b.min.x, b.max.x, p.x), gy = axisGap(b.min.y, b.max.y, p.y), gz = axisGap(b.min.z, b.max.z, p.z);
  return gx * gx + gy * gy + gz * gz;
}

/**
 * Whether a box with squared lower bound `lowerSq` can be pruned against the best distance `best` found so far:
 * `lowerSq > best²` (with a relative allowance of `8 ε` for the rounding of both sides, so a tie is never pruned).
 */
export function canPrune(lowerSq: number, best: number): boolean {
  return lowerSq * (1 - 8 * Number.EPSILON) > best * best;
}

/**
 * The parameters `[t0, t1] ⊆ [0, maxT]` where the ray `o + t d` lies in box `b` grown by `pad`, or `undefined`
 * when it misses (slab test; a zero direction component keeps the ray inside that slab or outside it entirely).
 */
export function rayBoxRange(b: Box3, o: Point3, d: Vec3, maxT: number, pad: number): readonly [number, number] | undefined {
  const lo = { x: b.min.x - pad, y: b.min.y - pad, z: b.min.z - pad };
  const hi = { x: b.max.x + pad, y: b.max.y + pad, z: b.max.z + pad };
  // Widen each slab by a relative allowance so rounding never cuts a grazing hit.
  return lineBoxRange({ min: lo, max: hi }, o, d, 0, maxT, 1e-12);
}
