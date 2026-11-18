/**
 * Exact 2D polygon predicates on double coordinates, decided by the M0 exact `orient2d`: whether two closed
 * segments meet, and the orientation of a simple ring. Shared by the display mesher (`src/tess/triangulate.ts`)
 * and planar profiles (`src/profile`), which is why they live here, below both (one job, one place; a kernel
 * module never imports the display layer).
 *
 * - `segmentsMeet` / `closedSegmentsMeet` — the closed segments `[p1, p2]`, `[q1, q2]` meet: a proper crossing
 *   (the four orientations strictly alternate) or an end point lying on the other segment (orientation 0 and
 *   inside the bounding box, exact comparisons).
 * - `loopOrientation` — `orient2d` at the ring's lowest (then leftmost) vertex, which is convex, so it is the
 *   ring's orientation when the ring is simple.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore-tess/src/mesher/cdt.rs`
 * (exact orientation tests on the work-plane loops), `solidcore/crates/solidcore/src/profile.rs` (loop sense) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Point2 } from '../math/vec.ts';
import type { Sign } from './dyadic.ts';
import { orient2d } from './predicates.ts';

const OP = 'exact.polygon';

/** M0 exact `orient2d` on points known to be finite (callers check their coordinates once). */
export function orientFinite(a: Point2, b: Point2, c: Point2): Sign {
  const r = orient2d(a, b, c);
  if (!r.ok) throw new Error('exact.orientFinite: coordinate not finite'); // invariant: callers pass finite points
  return r.value;
}

export const isFinitePoint2 = (p: Point2): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

/** `q` on the closed segment `[p, r]`, given `orient(p, r, q) = 0` (exact coordinate comparisons). */
export function onCollinearSegment(p: Point2, q: Point2, r: Point2): boolean {
  return Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
}

/** Why the rings cannot be read: a missing point or a non-finite coordinate (`undefined` when they can). */
export function ringProblem(points: readonly Point2[], rings: readonly (readonly number[])[]): string | undefined {
  for (const [li, r] of rings.entries()) {
    for (const i of r) {
      const p = Number.isInteger(i) ? points[i] : undefined;
      if (p === undefined) return `ring ${li} names a missing point ${i}`;
      if (!isFinitePoint2(p)) return `ring ${li} has a non-finite point`;
    }
  }
  return undefined;
}

/** Whether the closed segments `[p1, p2]` and `[q1, q2]` meet (finite points). */
export function closedSegmentsMeet(p1: Point2, p2: Point2, q1: Point2, q2: Point2): boolean {
  const o1 = orientFinite(p1, p2, q1), o2 = orientFinite(p1, p2, q2), o3 = orientFinite(q1, q2, p1), o4 = orientFinite(q1, q2, p2);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return (o1 === 0 && onCollinearSegment(p1, q1, p2)) || (o2 === 0 && onCollinearSegment(p1, q2, p2)) ||
    (o3 === 0 && onCollinearSegment(q1, p1, q2)) || (o4 === 0 && onCollinearSegment(q1, p2, q2));
}

/**
 * Whether the closed segments `[p1, p2]` and `[q1, q2]` meet, decided by the exact `orient2d`. Fails with
 * `invalid-input` for a non-finite coordinate.
 */
export function segmentsMeet(p1: Point2, p2: Point2, q1: Point2, q2: Point2): Result<boolean> {
  if (![p1, p2, q1, q2].every(isFinitePoint2)) return invalidInput(OP, 'non-finite point');
  return ok(closedSegmentsMeet(p1, p2, q1, q2));
}

/** The orientation of a ring of finite points: `orient2d` at its lowest (then leftmost) vertex; 0 below 3. */
export function ringOrientation(points: readonly Point2[], ring: readonly number[]): Sign {
  const n = ring.length;
  if (n < 3) return 0;
  let best = 0;
  for (let i = 1; i < n; i++) {
    const p = points[ring[i]!]!, q = points[ring[best]!]!;
    if (p.y < q.y || (p.y === q.y && p.x < q.x)) best = i;
  }
  return orientFinite(points[ring[(best + n - 1) % n]!]!, points[ring[best]!]!, points[ring[(best + 1) % n]!]!);
}

/**
 * The exact orientation of a simple ring: `orient2d` at its lowest (then leftmost) vertex; 0 for fewer than
 * three vertices. Fails with `invalid-input` for a missing or non-finite point.
 */
export function loopOrientation(points: readonly Point2[], ring: readonly number[]): Result<Sign> {
  const bad = ringProblem(points, [ring]);
  if (bad !== undefined) return invalidInput(OP, bad);
  return ok(ringOrientation(points, ring));
}
