import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Polynomial} from '../numeric/polynomial.js';
import {point2} from './point2.js';
import type {ExactInput,Point2} from './point2.js';
import {algebraicPoint2,getPointParameterization2,snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicPoint2,AlgebraicCoordinates2} from './algebraic-point2.js';
import {line2} from './circle2.js';
import type {Line2,LineCircleHit2} from './circle2.js';
import {intersectLineArc2} from './circular-arc2.js';
import type {CircularArc2} from './circular-arc2.js';

/** Closed rational supporting line trimmed by real algebraic parameters.
 * Traversal runs from startParameter to endParameter, including reversed/point trims.
 */
export interface LineInterval2 {
  readonly line:Line2;
  readonly startParameter:AlgebraicReal;
  readonly endParameter:AlgebraicReal;
  readonly start:AlgebraicPoint2;
  readonly end:AlgebraicPoint2;
}
export function lineInterval2(input:Line2,start:AlgebraicReal|ExactInput,end:AlgebraicReal|ExactInput):LineInterval2 {
  const line=line2(input.origin,input.direction),a=start instanceof AlgebraicReal?start:AlgebraicReal.fromRational(start),b=end instanceof AlgebraicReal?end:AlgebraicReal.fromRational(end);
  return Object.freeze({line,startParameter:a,endParameter:b,start:algebraicPoint2(line.origin,line.direction,a),end:algebraicPoint2(line.origin,line.direction,b)});
}
/** Internal canonical positive-lexicographic line frame: parameter is x or vertical y. */
export function canonicalLine2(input:Line2):Line2 {
  const line=line2(input.origin,input.direction),{origin:o,direction:d}=line;
  return d.x.sign()!==0?line2(point2(0n,o.y.sub(d.y.mul(o.x).div(d.x))),point2(1n,d.y.div(d.x))):line2(point2(o.x,0n),point2(0n,1n));
}
function between(value:AlgebraicReal,interval:LineInterval2):boolean {
  const a=interval.startParameter,b=interval.endParameter;
  return a.compare(b)<=0?value.compare(a)>=0&&value.compare(b)<=0:value.compare(b)>=0&&value.compare(a)<=0;
}
function parameterAt(point:AlgebraicCoordinates2,line:Line2):AlgebraicReal {
  const d=line.direction,o=line.origin;
  return d.x.sign()!==0?point.x.affine(new Rational(1n).div(d.x),o.x.neg().div(d.x)):point.y.affine(new Rational(1n).div(d.y),o.y.neg().div(d.y));
}
export function pointOnLineInterval2(input:Point2|AlgebraicCoordinates2,interval:LineInterval2):boolean {
  const point=snapshotExactPoint2(input),{origin:o,direction:d}=interval.line,data=getPointParameterization2(point);
  let side;
  if(data){
    side=data.parameter.signOf(new Polynomial([
      d.x.mul(data.origin.y.sub(o.y)).sub(d.y.mul(data.origin.x.sub(o.x))),
      d.x.mul(data.direction.y).sub(d.y.mul(data.direction.x)),
    ]));
  } else side=point.y.affine(d.x,d.x.mul(o.y).neg()).add(point.x.affine(d.y.neg(),d.y.mul(o.x))).sign();
  return side===0&&between(parameterAt(point,interval.line),interval);
}
export type LineIntervalIntersection2=
 | {readonly kind:'none'}
 | {readonly kind:'point';readonly point:AlgebraicCoordinates2}
 | {readonly kind:'overlap';readonly interval:LineInterval2};
export function intersectLineIntervals2(first:LineInterval2,second:LineInterval2):LineIntervalIntersection2 {
  const a=first.line,b=second.line,r=a.direction,s=b.direction,q=point2(b.origin.x.sub(a.origin.x),b.origin.y.sub(a.origin.y));
  const determinant=r.x.mul(s.y).sub(r.y.mul(s.x));
  if(determinant.sign()!==0){
    const t=AlgebraicReal.fromRational(q.x.mul(s.y).sub(q.y.mul(s.x)).div(determinant));
    const u=AlgebraicReal.fromRational(q.x.mul(r.y).sub(q.y.mul(r.x)).div(determinant));
    return between(t,first)&&between(u,second)?Object.freeze({kind:'point',point:algebraicPoint2(a.origin,r,t)}):Object.freeze({kind:'none'});
  }
  if(q.x.mul(r.y).sub(q.y.mul(r.x)).sign()!==0)return Object.freeze({kind:'none'});
  const line=canonicalLine2(a),coordinate=(p:AlgebraicCoordinates2)=>line.direction.x.sign()===0?p.y:p.x;
  const bounds=(interval:LineInterval2)=>[coordinate(interval.start),coordinate(interval.end)].sort((x,y)=>x.compare(y));
  const [a0,a1]=bounds(first),[b0,b1]=bounds(second);
  const lo=a0!.compare(b0!)>=0?a0!:b0!,hi=a1!.compare(b1!)<=0?a1!:b1!,comparison=lo.compare(hi);
  return comparison>0?Object.freeze({kind:'none'}):comparison===0?Object.freeze({kind:'point',point:algebraicPoint2(line.origin,line.direction,lo)}):Object.freeze({kind:'overlap',interval:lineInterval2(line,lo,hi)});
}
/** Hits retain increasing parameter order in the interval's supporting line frame. */
export function intersectLineIntervalArc2(interval:LineInterval2,arc:CircularArc2):readonly LineCircleHit2[] {
  return Object.freeze(intersectLineArc2(interval.line,arc).filter(hit=>between(hit.parameter,interval)));
}
