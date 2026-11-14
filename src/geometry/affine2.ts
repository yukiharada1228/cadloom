import { Rational } from "../numeric/rational.js";
import { point2, segment2 } from "./point2.js";
import type { ExactInput, Point2, Segment2 } from "./point2.js";
import type { PolygonRegion } from "./polygon-boolean.js";

/** x' = a*x + b*y + tx; y' = c*x + d*y + ty. */
export interface Affine2 {
  readonly a: Rational;
  readonly b: Rational;
  readonly c: Rational;
  readonly d: Rational;
  readonly tx: Rational;
  readonly ty: Rational;
}

/** Defaults to the identity. Inputs never pass through floating-point conversion. */
export function affine2(
  a: ExactInput = 1n, b: ExactInput = 0n, c: ExactInput = 0n,
  d: ExactInput = 1n, tx: ExactInput = 0n, ty: ExactInput = 0n,
): Affine2 {
  const row1 = point2(a,b), row2 = point2(c,d), offset = point2(tx,ty);
  return Object.freeze({ a: row1.x, b: row1.y, c: row2.x, d: row2.y, tx: offset.x, ty: offset.y });
}

export function affineDeterminant(t: Affine2): Rational {
  return t.a.mul(t.d).sub(t.b.mul(t.c));
}
export function transformPoint(t: Affine2, p: Point2): Point2 {
  return point2(t.a.mul(p.x).add(t.b.mul(p.y)).add(t.tx),
    t.c.mul(p.x).add(t.d.mul(p.y)).add(t.ty));
}
export function transformSegment(t: Affine2, s: Segment2): Segment2 {
  return segment2(transformPoint(t,s.start),transformPoint(t,s.end));
}
/** Preserves ring order/orientation algebraically; singular maps may collapse area. */
export function transformPolygon(t: Affine2, region: PolygonRegion): PolygonRegion {
  return Object.freeze(region.map(ring => Object.freeze(ring.map(p => transformPoint(t,p)))));
}

/** Returns outer(inner(p)); argument order is application order from right to left. */
export function composeAffine2(outer: Affine2, inner: Affine2): Affine2 {
  const offset = transformPoint(outer, point2(inner.tx,inner.ty));
  return affine2(
    outer.a.mul(inner.a).add(outer.b.mul(inner.c)),
    outer.a.mul(inner.b).add(outer.b.mul(inner.d)),
    outer.c.mul(inner.a).add(outer.d.mul(inner.c)),
    outer.c.mul(inner.b).add(outer.d.mul(inner.d)),offset.x,offset.y,
  );
}

export function invertAffine2(t: Affine2): Affine2 {
  const det = affineDeterminant(t);
  if (det.sign() === 0) throw new RangeError("A singular affine transform has no inverse");
  return affine2(t.d.div(det),t.b.neg().div(det),t.c.neg().div(det),t.a.div(det),
    t.b.mul(t.ty).sub(t.d.mul(t.tx)).div(det),
    t.c.mul(t.tx).sub(t.a.mul(t.ty)).div(det));
}
