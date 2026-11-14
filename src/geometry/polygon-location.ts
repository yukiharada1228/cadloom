import { booleanPolygons } from "./polygon-boolean.js";
import type { FillRule, PolygonRegion } from "./polygon-boolean.js";
import type { Point2 } from "./point2.js";
import type { Rational } from "../numeric/rational.js";
import { pointOnSegment } from "./segment-intersection.js";
import { orient2d } from "./orient2d.js";

export type PointLocation = "inside" | "boundary" | "outside";
export interface PreparedPolygon {
  readonly rings: PolygonRegion;
  readonly twiceArea: Rational;
  /** Classification against the regularized filled region, including its boundary. */
  locate(point: Point2): PointLocation;
}

/**
 * Snapshots and normalizes a ring set once for repeated point queries.
 * Canceled, internal and zero-area input edges are not treated as boundaries.
 */
export function preparePolygon(region: PolygonRegion, fillRule: FillRule = "even-odd"): PreparedPolygon {
  const { rings, twiceArea } = booleanPolygons(region, [], "union", fillRule);
  function locate(point: Point2): PointLocation {
    let winding = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const start = ring[i]!, end = ring[(i + 1) % ring.length]!;
        if (pointOnSegment(point, { start, end })) return "boundary";
        const side = orient2d(start, end, point);
        if (start.y.compare(point.y) <= 0 && end.y.compare(point.y) > 0 && side > 0) winding++;
        if (end.y.compare(point.y) <= 0 && start.y.compare(point.y) > 0 && side < 0) winding--;
      }
    }
    return winding === 0 ? "outside" : "inside";
  }
  return Object.freeze({ rings, twiceArea, locate });
}

/** One-shot query. Use preparePolygon for repeated queries without rebuilding the arrangement. */
export function locatePointInPolygon(
  point: Point2, region: PolygonRegion, fillRule: FillRule = "even-odd",
): PointLocation {
  return preparePolygon(region, fillRule).locate(point);
}
