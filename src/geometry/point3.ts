import { point2 } from "./point2.js";
import type { ExactInput } from "./point2.js";
import type { Rational } from "../numeric/rational.js";

export interface Vector3 { readonly x: Rational; readonly y: Rational; readonly z: Rational }
export interface Point3 extends Vector3 {}
export interface Segment3 { readonly start: Point3; readonly end: Point3 }

export function point3(x: ExactInput, y: ExactInput, z: ExactInput = 0n): Point3 {
  const xy = point2(x,y);
  return Object.freeze({x:xy.x,y:xy.y,z:point2(z,0n).x});
}
export function vector3(x: ExactInput, y: ExactInput, z: ExactInput = 0n): Vector3 {
  return point3(x,y,z);
}
export function segment3(start: Point3, end: Point3): Segment3 {
  return Object.freeze({start:point3(start.x,start.y,start.z),end:point3(end.x,end.y,end.z)});
}
export function pointsEqual3(a: Point3, b: Point3): boolean {
  return a.x.equals(b.x) && a.y.equals(b.y) && a.z.equals(b.z);
}
/** Componentwise a - b; also used to form displacement vectors from points. */
export function subtract3(a: Vector3, b: Vector3): Vector3 {
  return vector3(a.x.sub(b.x),a.y.sub(b.y),a.z.sub(b.z));
}
export function dot3(a: Vector3, b: Vector3): Rational {
  return a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z));
}
export function cross3(a: Vector3, b: Vector3): Vector3 {
  return vector3(a.y.mul(b.z).sub(a.z.mul(b.y)),
    a.z.mul(b.x).sub(a.x.mul(b.z)),a.x.mul(b.y).sub(a.y.mul(b.x)));
}
