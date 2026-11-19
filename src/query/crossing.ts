/**
 * The crossing-number (even–odd) test of a point against closed polygons in a face's `(u, v)` domain, decided
 * by the M0 exact `orient2d` on the given double coordinates.
 *
 * The ray from `q` runs in `+u` (`+x`). An edge `(a, b)` is counted by the **half-open rule**:
 * - it straddles the ray's line iff `(a.y > q.y) !== (b.y > q.y)` — an end point *on* the line counts as
 *   below it, so a vertex on the ray belongs to exactly one side;
 * - a straddling edge crosses the ray to the right of `q` iff `q` lies strictly left of the upward-directed edge:
 *   `orient2d(a, b, q) > 0` when `b.y > a.y`, `orient2d(a, b, q) < 0` otherwise.
 * With that rule a ray through a shared vertex `v` of consecutive edges `(a, v)`, `(v, b)` counts `1` when the
 * polygon passes through the line there (`a` and `b` strictly on opposite sides) and `0` or `2` when it only
 * touches it (both strictly on one side); edges lying on the line count `0`, so a pass-through along a
 * horizontal run counts once (Lean `Query.pass_through_count`, `Query.touch_count_even`,
 * `Query.horizontal_zero`, `Query.horizontal_run_pass`). The count is unchanged when a polygon is read backwards
 * (`Query.crossCount_reverse`), so the parity does not depend on loop orientation.
 *
 * Points on an edge (`orient2d = 0` within the edge's extent) are reported as `on` and not counted.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/query/face.rs` and
 * `query/loop.rs` (point-in-face by parity in the face's parameter space), `intersect/point_class.rs`
 * (classification classes) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import type { Point2 } from '../math/vec.ts';
import { onCollinearSegment, orientFinite } from '../exact/polygon.ts';

/** How one polygon edge meets the `+x` ray from `q`. */
export type EdgeCrossing = 'cross' | 'none' | 'on';

/** The half-open crossing rule for edge `(a, b)` against the `+x` ray from `q` (finite points; see the module comment). */
export function edgeCrossing(q: Point2, a: Point2, b: Point2): EdgeCrossing {
  const aAbove = a.y > q.y, bAbove = b.y > q.y;
  if (aAbove === bAbove) {
    // Not straddling: `q` can still lie on the edge (a horizontal edge at `q.y`, or an end point at `q.y`).
    if ((a.y === q.y || b.y === q.y) && orientFinite(a, b, q) === 0 && onCollinearSegment(a, q, b)) return 'on';
    return 'none';
  }
  const o = orientFinite(a, b, q);
  if (o === 0) return 'on';
  return (b.y > a.y ? o > 0 : o < 0) ? 'cross' : 'none';
}

/** The crossing count of `q` against closed rings (each ring's last point joins its first), or `on`. */
export interface CrossingCount {
  readonly count: number;
  readonly on: boolean;
}

/** Counts the crossings of the `+x` ray from `q` with the edges of `rings`; `on` when `q` lies on an edge. */
export function crossingCount(q: Point2, rings: readonly (readonly Point2[])[]): CrossingCount {
  let count = 0;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i]!, b = ring[(i + 1) % n]!;
      // Cheap rejection: the edge lies entirely left of q or entirely above / below its line.
      if ((a.y > q.y && b.y > q.y) || (a.y < q.y && b.y < q.y) || (a.x < q.x && b.x < q.x)) continue;
      const c = edgeCrossing(q, a, b);
      if (c === 'on') return { count, on: true };
      if (c === 'cross') count++;
    }
  }
  return { count, on: false };
}
