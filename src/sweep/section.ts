/**
 * Profile sections for revolve and sweep: rigid maps of 2D wires (a rotation or a reflection plus a translation of
 * the plane).
 *
 * - `mapWire(wire, iso, reverse)` applies the isometry `p ↦ M p + t` (`M` orthonormal, `det M = ±1`) to every
 *   segment exactly in form: a line's ends are mapped; an arc keeps its radius, its center is mapped and its angles
 *   become `θ + α` (rotation by `α`) or `α - θ` (reflection, which also flips its sense); a NURBS segment's control
 *   points are mapped (affine invariance), knots and weights kept. With `reverse` the wire is then run backwards
 *   (`reverseWire` of `src/profile`), which is how both callers restore "material on the left" after a reflection.
 * The placement of a segment on a plane (`placeSegment`, `segmentNurbs3`) lives in `src/prism/layout.ts`, shared
 * with `extrude` (one job, one place).
 *
 * Upstream consulted (for the conventions, not translated): `solidcore/crates/solidcore/src/prism/profile.rs`
 * (`curve_on_frame`: an arc as its own circle with angle 0 at its start, a clockwise arc about the reversed
 * normal), `solidcore/crates/solidcore/src/sweep/segments.rs` (a profile placed by a frame) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Point2 } from '../math/vec.ts';
import { createNurbsCurve } from '../nurbs/curve.ts';
import { arcSegment2, lineSegment2, nurbsSegment2, reverseWire, type Segment2, type Wire2 } from '../profile/segment.ts';

/** The plane isometry `p ↦ (m00 x + m01 y + tx, m10 x + m11 y + ty)`; `M` orthonormal. */
export interface Iso2 {
  readonly m00: number;
  readonly m01: number;
  readonly m10: number;
  readonly m11: number;
  readonly tx: number;
  readonly ty: number;
}

/** `det M`: `+1` for a rotation, `-1` for a reflection (sign only). */
export const isoDet = (iso: Iso2): number => Math.sign(iso.m00 * iso.m11 - iso.m01 * iso.m10);

export const isoPoint = (iso: Iso2, p: Point2): Point2 =>
  Object.freeze({ x: iso.m00 * p.x + iso.m01 * p.y + iso.tx, y: iso.m10 * p.x + iso.m11 * p.y + iso.ty });

/** The image of one segment under `iso` (see the module comment). */
export function mapSegment(seg: Segment2, iso: Iso2): Result<Segment2> {
  switch (seg.kind) {
    case 'line':
      return lineSegment2(isoPoint(iso, seg.start), isoPoint(iso, seg.end));
    case 'arc': {
      const alpha = Math.atan2(iso.m10, iso.m00);
      const c = isoPoint(iso, seg.center);
      return isoDet(iso) > 0
        ? arcSegment2(c, seg.radius, seg.startAngle + alpha, seg.endAngle + alpha)
        : arcSegment2(c, seg.radius, alpha - seg.startAngle, alpha - seg.endAngle);
    }
    case 'nurbs': {
      const c = seg.curve;
      const pts = c.controlPoints.map((q) => {
        const p = isoPoint(iso, { x: q[0]!, y: q[1]! });
        return [p.x, p.y];
      });
      const n = createNurbsCurve(c.degree, c.knots, pts, c.weights);
      return n.ok ? nurbsSegment2(n.value) : n;
    }
  }
}

/** The image of a wire under `iso`, then run backwards when `reverse`. */
export function mapWire(wire: Wire2, iso: Iso2, reverse: boolean): Result<Wire2> {
  const out: Segment2[] = [];
  for (const s of wire) {
    const m = mapSegment(s, iso);
    if (!m.ok) return m;
    out.push(m.value);
  }
  return reverse ? reverseWire(out) : ok(Object.freeze(out));
}
