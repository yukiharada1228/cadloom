import { AlgebraicReal } from '../numeric/real-roots.js';
import { Polynomial } from '../numeric/polynomial.js';
import type { Sign } from '../numeric/rational.js';
import { point2 } from './point2.js';
import type { Point2 } from './point2.js';

/** A point with correlated coordinates origin + parameter*direction over Q.
 * Origin/direction retain the shared parameter for exact geometric predicates.
 */
export interface AlgebraicPoint2 {
  readonly origin:Point2;
  readonly direction:Point2;
  readonly parameter:AlgebraicReal;
  readonly x:AlgebraicReal;
  readonly y:AlgebraicReal;
}
export function algebraicPoint2(origin:Point2,direction:Point2,parameter:AlgebraicReal):AlgebraicPoint2 {
  const o=point2(origin.x,origin.y),d=point2(direction.x,direction.y);
  return Object.freeze({origin:o,direction:d,parameter,x:parameter.affine(d.x,o.x),y:parameter.affine(d.y,o.y)});
}
export function compareAlgebraicPoints2(a:AlgebraicPoint2,b:AlgebraicPoint2):Sign {
  return a.x.compare(b.x)||a.y.compare(b.y);
}
/** Orientation of two rational points and one correlated algebraic point. */
export function orientAlgebraicPoint2(a:Point2,b:Point2,p:AlgebraicPoint2):Sign {
  const dx=b.x.sub(a.x),dy=b.y.sub(a.y);
  return p.parameter.signOf(new Polynomial([
    dx.mul(p.origin.y.sub(a.y)).sub(dy.mul(p.origin.x.sub(a.x))),
    dx.mul(p.direction.y).sub(dy.mul(p.direction.x)),
  ]));
}
