import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,dot3,pointsEqual3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {algebraicPoint3,algebraicCoordinates3,compareAlgebraicPoints3,getPointParameterization3,subtractAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import type {AlgebraicSegment3} from './algebraic-segment3.js';

export type AlgebraicSegmentPlaneIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'point';readonly point:AlgebraicCoordinates3;readonly parameter:AlgebraicReal}
 | {readonly kind:'coplanar';readonly segment:AlgebraicSegment3};
/** Internal linear evaluation preserving the factory-owned affine parameter. */
export function evaluatePlaneAtAlgebraicPoint3(plane:Plane3,p:AlgebraicCoordinates3):AlgebraicReal {
  const data=getPointParameterization3(p),n=plane.normal;
  if(data)return data.parameter.affine(dot3(n,data.direction),dot3(n,data.origin).add(plane.offset));
  return p.x.affine(n.x,plane.offset).add(p.y.affine(n.y)).add(p.z.affine(n.z));
}
/** Closed algebraic-endpoint segment/plane intersection. A rational displacement
 * from a correlated origin retains the same source parameter at the intersection.
 */
export function intersectAlgebraicSegmentPlane3(input:AlgebraicSegment3,inputPlane:Plane3):AlgebraicSegmentPlaneIntersection3 {
  const s=algebraicSegment3(input.start,input.end),plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),a=evaluatePlaneAtAlgebraicPoint3(plane,s.start),b=evaluatePlaneAtAlgebraicPoint3(plane,s.end),A=a.sign(),B=b.sign();
  if(A===0&&B===0&&compareAlgebraicPoints3(s.start,s.end)!==0)return Object.freeze({kind:'coplanar',segment:s});
  if(A===0)return Object.freeze({kind:'point',point:s.start,parameter:AlgebraicReal.fromRational(0n)});
  if(B===0)return Object.freeze({kind:'point',point:s.end,parameter:AlgebraicReal.fromRational(1n)});
  if(A===B)return Object.freeze({kind:'none'});
  const left=getPointParameterization3(s.start),right=getPointParameterization3(s.end);
  if(left&&right&&pointsEqual3(left.origin,right.origin)&&pointsEqual3(left.direction,right.direction)&&dot3(left.direction,left.direction).sign()!==0){
    const slope=dot3(plane.normal,left.direction),parameterOnSupport=dot3(plane.normal,left.origin).add(plane.offset).neg().div(slope),source=AlgebraicReal.fromRational(parameterOnSupport),common=left.parameter.polynomial;
    const conjugates=common.degree===2&&common.equals(right.parameter.polynomial)&&left.parameter.compare(right.parameter)!==0,sum=conjugates?common.coefficient(1).neg().div(common.coefficient(2)):null,parameter=sum!==null?left.parameter.rationalFunction(new Polynomial([parameterOnSupport,-1n]),new Polynomial([sum,-2n])):source.sub(left.parameter).div(right.parameter.sub(left.parameter));
    return Object.freeze({kind:'point',parameter,point:algebraicPoint3(left.origin,left.direction,source)});
  }
  const axes=['x','y','z'] as const,difference=subtractAlgebraicPoints3(s.end,s.start),data=getPointParameterization3(s.start);
  if(axes.every(k=>difference[k].rational!==null)){
    const d=vector3(difference.x.rational!,difference.y.rational!,difference.z.rational!),slope=dot3(plane.normal,d);
    if(!data){
      const parameter=a.affine(new Rational(-1n).div(slope)),point=algebraicCoordinates3(...axes.map(k=>s.start[k].add(parameter.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
      return Object.freeze({kind:'point',parameter,point});
    }
    const rate=dot3(plane.normal,data.direction).neg().div(slope),offset=dot3(plane.normal,data.origin).add(plane.offset).neg().div(slope),parameter=data.parameter.affine(rate,offset);
    const origin=point3(data.origin.x.add(d.x.mul(offset)),data.origin.y.add(d.y.mul(offset)),data.origin.z.add(d.z.mul(offset))),direction=vector3(data.direction.x.add(d.x.mul(rate)),data.direction.y.add(d.y.mul(rate)),data.direction.z.add(d.z.mul(rate)));
    return Object.freeze({kind:'point',parameter,point:algebraicPoint3(origin,direction,data.parameter)});
  }
  const parameter=a.div(a.sub(b)),point=algebraicCoordinates3(...axes.map(k=>s.start[k].add(difference[k].mul(parameter))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
  return Object.freeze({kind:'point',parameter,point});
}
