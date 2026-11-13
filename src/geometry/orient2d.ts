import type { Point2 } from "./point2.js";
import type { Sign } from "../numeric/rational.js";

/** +1 counterclockwise, -1 clockwise, 0 collinear (exactly). */
export function orient2d(a: Point2, b: Point2, c: Point2): Sign {
  return b.x.sub(a.x).mul(c.y.sub(a.y))
    .sub(b.y.sub(a.y).mul(c.x.sub(a.x))).sign();
}
