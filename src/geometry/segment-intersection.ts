import { comparePoints, point2, pointsEqual, segment2 } from "./point2.js";
import type { Point2, Segment2 } from "./point2.js";
import { orient2d } from "./orient2d.js";

export type SegmentIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly point: Point2 }
  | { readonly kind: "overlap"; readonly segment: Segment2 };

function ordered(s: Segment2): Segment2 {
  return comparePoints(s.start, s.end) <= 0 ? s : segment2(s.end, s.start);
}
export function pointOnSegment(p: Point2, s: Segment2): boolean {
  const bounds = ordered(s);
  return orient2d(s.start, s.end, p) === 0 &&
    comparePoints(bounds.start, p) <= 0 && comparePoints(p, bounds.end) <= 0;
}

/** Exact intersection of closed segments; zero-length segments are points. */
export function intersectSegments(a: Segment2, b: Segment2): SegmentIntersection {
  if (pointsEqual(a.start, a.end)) {
    return pointOnSegment(a.start, b) ? { kind: "point", point: a.start } : { kind: "none" };
  }
  if (pointsEqual(b.start, b.end)) {
    return pointOnSegment(b.start, a) ? { kind: "point", point: b.start } : { kind: "none" };
  }
  const rx = a.end.x.sub(a.start.x), ry = a.end.y.sub(a.start.y);
  const sx = b.end.x.sub(b.start.x), sy = b.end.y.sub(b.start.y);
  const qx = b.start.x.sub(a.start.x), qy = b.start.y.sub(a.start.y);
  const denominator = rx.mul(sy).sub(ry.mul(sx));
  if (denominator.sign() === 0) {
    if (orient2d(a.start, a.end, b.start) !== 0) return { kind: "none" };
    const aa = ordered(a), bb = ordered(b);
    const lo = comparePoints(aa.start, bb.start) >= 0 ? aa.start : bb.start;
    const hi = comparePoints(aa.end, bb.end) <= 0 ? aa.end : bb.end;
    const comparison = comparePoints(lo, hi);
    if (comparison > 0) return { kind: "none" };
    if (comparison === 0) return { kind: "point", point: lo };
    return { kind: "overlap", segment: segment2(lo, hi) };
  }
  const t = qx.mul(sy).sub(qy.mul(sx)).div(denominator);
  const u = qx.mul(ry).sub(qy.mul(rx)).div(denominator);
  if (t.sign() < 0 || t.numerator > t.denominator ||
      u.sign() < 0 || u.numerator > u.denominator) return { kind: "none" };
  return { kind: "point", point: point2(a.start.x.add(rx.mul(t)), a.start.y.add(ry.mul(t))) };
}
