import { Rational } from '../numeric/rational.js';
import type { Sign } from '../numeric/rational.js';
import { exactRational,Polynomial } from '../numeric/polynomial.js';
import { AlgebraicReal,isolateRealRoots } from '../numeric/real-roots.js';
import { point2,segment2,pointsEqual } from './point2.js';
import type { ExactInput,Point2,Segment2 } from './point2.js';
import { algebraicPoint2,compareAlgebraicPoints2 } from './algebraic-point2.js';
import type { AlgebraicPoint2 } from './algebraic-point2.js';

export interface Circle2 {readonly center:Point2;readonly radiusSquared:Rational;}
/** Squared radius is used so all circles through rational points remain expressible.
 * Negative squared radius is rejected; zero represents a point circle.
 */
export function circle2(center:Point2,radiusSquared:ExactInput):Circle2 {
  const r=exactRational(radiusSquared);
  if(r.sign()<0)throw new RangeError('Circle squared radius must be nonnegative');
  return Object.freeze({center:point2(center.x,center.y),radiusSquared:r});
}
export function circleThroughPoints2(a:Point2,b:Point2,c:Point2):Circle2 {
  const ux=b.x.sub(a.x),uy=b.y.sub(a.y),vx=c.x.sub(a.x),vy=c.y.sub(a.y);
  const determinant=ux.mul(vy).sub(uy.mul(vx));
  if(determinant.sign()===0)throw new RangeError('Circle requires three noncollinear points');
  const u2=ux.mul(ux).add(uy.mul(uy)),v2=vx.mul(vx).add(vy.mul(vy));
  const denominator=determinant.mul(new Rational(2n));
  const hx=u2.mul(vy).sub(uy.mul(v2)).div(denominator),hy=ux.mul(v2).sub(u2.mul(vx)).div(denominator);
  return circle2(point2(a.x.add(hx),a.y.add(hy)),hx.mul(hx).add(hy.mul(hy)));
}
export interface Line2 {readonly origin:Point2;readonly direction:Point2;}
/** Infinite parametric line origin + t*direction; direction must be nonzero. */
export function line2(origin:Point2,direction:Point2):Line2 {
  const o=point2(origin.x,origin.y),d=point2(direction.x,direction.y);
  if(d.x.sign()===0&&d.y.sign()===0)throw new RangeError('Line direction must be nonzero');
  return Object.freeze({origin:o,direction:d});
}
function equation(origin:Point2,direction:Point2,circle:Circle2):Polynomial {
  const x=origin.x.sub(circle.center.x),y=origin.y.sub(circle.center.y),dx=direction.x,dy=direction.y;
  return new Polynomial([
    x.mul(x).add(y.mul(y)).sub(circle.radiusSquared),
    x.mul(dx).add(y.mul(dy)).mul(new Rational(2n)),
    dx.mul(dx).add(dy.mul(dy)),
  ]);
}
/** Negative inside, zero on circle, positive outside (squared-distance predicate). */
export function classifyPointToCircle2(point:Point2,input:Circle2):Sign {
  const c=circle2(input.center,input.radiusSquared);
  return equation(point,point2(0n,0n),c).evaluate(0n).sign();
}
export function classifyAlgebraicPointToCircle2(point:AlgebraicPoint2,input:Circle2):Sign {
  const c=circle2(input.center,input.radiusSquared);
  return point.parameter.signOf(equation(point.origin,point.direction,c));
}
export interface LineCircleHit2 {
  readonly point:AlgebraicPoint2;
  readonly parameter:AlgebraicReal;
  /** Quadratic root multiplicity, not a general intersection multiplicity.
   * Null only for a collapsed segment on the circle (identically zero equation).
   */
  readonly multiplicity:1|2|null;
}
/** Finite hits sorted by increasing line parameter; tangent roots occur once. */
export function intersectLineCircle2(input:Line2,inputCircle:Circle2):readonly LineCircleHit2[] {
  const line=line2(input.origin,input.direction),circle=circle2(inputCircle.center,inputCircle.radiusSquared);
  const p=equation(line.origin,line.direction,circle);
  const discriminant=p.coefficient(1).mul(p.coefficient(1)).sub(p.coefficient(0).mul(p.coefficient(2)).mul(new Rational(4n)));
  const multiplicity:1|2=discriminant.sign()===0?2:1;
  return Object.freeze(isolateRealRoots(p).map(parameter=>Object.freeze({parameter,point:algebraicPoint2(line.origin,line.direction,parameter),multiplicity})));
}
/** Closed segment: both endpoint parameters 0 and 1 are included exactly. */
export function intersectSegmentCircle2(input:Segment2,circle:Circle2):readonly LineCircleHit2[] {
  const s=segment2(input.start,input.end),c=circle2(circle.center,circle.radiusSquared);
  if(pointsEqual(s.start,s.end)){
    if(classifyPointToCircle2(s.start,c)!==0)return Object.freeze([]);
    const parameter=AlgebraicReal.fromRational(0n);
    return Object.freeze([Object.freeze({parameter,point:algebraicPoint2(s.start,point2(0n,0n),parameter),multiplicity:null})]);
  }
  const line=line2(s.start,point2(s.end.x.sub(s.start.x),s.end.y.sub(s.start.y)));
  const zero=AlgebraicReal.fromRational(0n),one=AlgebraicReal.fromRational(1n);
  return Object.freeze(intersectLineCircle2(line,c).filter(hit=>hit.parameter.compare(zero)>=0&&hit.parameter.compare(one)<=0));
}
export type CircleCircleIntersection2 =
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly circle:Circle2}
 | {readonly kind:'points';readonly points:readonly AlgebraicPoint2[]};
/** Exact finite point set in lexicographic order, or an entire coincident circle. */
export function intersectCircles2(first:Circle2,second:Circle2):CircleCircleIntersection2 {
  const a=circle2(first.center,first.radiusSquared),b=circle2(second.center,second.radiusSquared);
  if(pointsEqual(a.center,b.center)){
    if(!a.radiusSquared.equals(b.radiusSquared))return Object.freeze({kind:'none'});
    if(a.radiusSquared.sign()===0)return Object.freeze({kind:'points',points:Object.freeze([algebraicPoint2(a.center,point2(0n,0n),AlgebraicReal.fromRational(0n))])});
    return Object.freeze({kind:'coincident',circle:a});
  }
  const dx=b.center.x.sub(a.center.x),dy=b.center.y.sub(a.center.y);
  const norm=(p:Point2)=>p.x.mul(p.x).add(p.y.mul(p.y));
  const rhs=norm(b.center).sub(norm(a.center)).add(a.radiusSquared).sub(b.radiusSquared).div(new Rational(2n));
  const origin=dx.sign()!==0?point2(rhs.div(dx),0n):point2(0n,rhs.div(dy));
  const line=line2(origin,point2(dy.neg(),dx));
  const points=intersectLineCircle2(line,a).map(hit=>hit.point).sort(compareAlgebraicPoints2);
  return points.length?Object.freeze({kind:'points',points:Object.freeze(points)}):Object.freeze({kind:'none'});
}
