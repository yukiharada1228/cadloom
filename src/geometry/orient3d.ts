import { cross3, dot3, subtract3 } from "./point3.js";
import type { Point3 } from "./point3.js";
import type { Sign } from "../numeric/rational.js";

/** Sign of ((b-a) × (c-a)) · (d-a); positive along the oriented plane normal. */
export function orient3d(a: Point3, b: Point3, c: Point3, d: Point3): Sign {
  return dot3(cross3(subtract3(b,a),subtract3(c,a)),subtract3(d,a)).sign();
}
