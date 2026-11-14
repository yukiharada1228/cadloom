import { AlgebraicReal } from '../numeric/real-roots.js';
import { Polynomial } from '../numeric/polynomial.js';
import type { Sign } from '../numeric/rational.js';
import { point2 } from './point2.js';
import type { ExactInput,Point2 } from './point2.js';

/** Coordinates may come from different algebraic extensions. */
export interface AlgebraicCoordinates2 {readonly x:AlgebraicReal;readonly y:AlgebraicReal;}
/** A point with correlated coordinates origin + parameter*direction over Q.
 * Origin/direction retain the shared parameter for exact geometric predicates.
 */
export interface AlgebraicPoint2 extends AlgebraicCoordinates2 {
  readonly origin:Point2;
  readonly direction:Point2;
  readonly parameter:AlgebraicReal;
}
type Parameterization2=Readonly<Pick<AlgebraicPoint2,'origin'|'direction'|'parameter'>>;
const parameters=new WeakMap<AlgebraicCoordinates2,Parameterization2>();
/** Internal verified-by-construction correlation, never inferred from extra object fields. */
export function getPointParameterization2(point:AlgebraicCoordinates2):Parameterization2|undefined{return parameters.get(point);}
export function snapshotAlgebraicCoordinates2(point:AlgebraicCoordinates2):AlgebraicCoordinates2 {
  const data=parameters.get(point);
  return data?algebraicPoint2(data.origin,data.direction,data.parameter):algebraicCoordinates2(point.x,point.y);
}
/** Internal snapshot accepting rational or algebraic coordinates. */
export function snapshotExactPoint2(point:Point2|AlgebraicCoordinates2):AlgebraicCoordinates2 {
  if(point.x instanceof AlgebraicReal&&point.y instanceof AlgebraicReal)return snapshotAlgebraicCoordinates2(point as AlgebraicCoordinates2);
  return algebraicCoordinates2(point.x,point.y);
}
export function algebraicPoint2(origin:Point2,direction:Point2,parameter:AlgebraicReal):AlgebraicPoint2 {
  const o=point2(origin.x,origin.y),d=point2(direction.x,direction.y);
  const result=Object.freeze({origin:o,direction:d,parameter,x:parameter.affine(d.x,o.x),y:parameter.affine(d.y,o.y)});
  parameters.set(result,Object.freeze({origin:o,direction:d,parameter}));
  return result;
}
export function compareAlgebraicPoints2(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2):Sign {
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

/** General algebraic coordinates, without requiring a shared affine parameter. */
export function algebraicCoordinates2(x:AlgebraicReal|ExactInput,y:AlgebraicReal|ExactInput):AlgebraicCoordinates2 {
  return Object.freeze({x:x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x),y:y instanceof AlgebraicReal?y:AlgebraicReal.fromRational(y)});
}
/** Exact orientation of three independently represented algebraic points. */
export function orientAlgebraicPoints2(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2,c:AlgebraicCoordinates2):Sign {
  return b.x.sub(a.x).mul(c.y.sub(a.y)).sub(b.y.sub(a.y).mul(c.x.sub(a.x))).sign();
}
