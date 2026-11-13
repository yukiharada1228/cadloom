import { Rational } from "../numeric/rational.js";

export type ExactInput = Rational | bigint | string;
export interface Point2 { readonly x: Rational; readonly y: Rational }
export interface Segment2 { readonly start: Point2; readonly end: Point2 }

function coordinate(value: ExactInput): Rational {
  if (value instanceof Rational) return value;
  if (typeof value === "bigint") return new Rational(value);
  if (typeof value === "string") return Rational.parse(value);
  throw new TypeError("Coordinates must be Rational, bigint or exact strings");
}
export function point2(x: ExactInput, y: ExactInput): Point2 {
  return Object.freeze({ x: coordinate(x), y: coordinate(y) });
}
export function segment2(start: Point2, end: Point2): Segment2 {
  return Object.freeze({ start: point2(start.x, start.y), end: point2(end.x, end.y) });
}
export function pointsEqual(a: Point2, b: Point2): boolean {
  return a.x.equals(b.x) && a.y.equals(b.y);
}
/** Lexicographic order, also used to canonicalize overlap endpoints. */
export function comparePoints(a: Point2, b: Point2): -1 | 0 | 1 {
  return a.x.compare(b.x) || a.y.compare(b.y);
}
