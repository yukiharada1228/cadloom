import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial,exactRational} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point3,vector3,subtract3,dot3,cross3,segment3,pointsEqual3} from './point3.js';
import type {Point3,Vector3,Segment3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {algebraicCoordinates3,algebraicPoint3,snapshotExactPoint3,getPointParameterization3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3,AlgebraicPoint3} from './algebraic-point3.js';

export interface Line3 {readonly origin:Point3;readonly direction:Vector3;}
/** Circular cylinder of positive squared Euclidean radius about a rational axis.
 * Axis direction is not normalized. Its scale/sign and choice of origin are immaterial.
 */
export interface Cylinder3 {readonly axis:Line3;readonly radiusSquared:Rational;}
export type Surface3={readonly kind:'plane';readonly plane:Plane3}|{readonly kind:'cylinder';readonly cylinder:Cylinder3};
export function line3(origin:Point3,direction:Vector3):Line3 {
  const o=point3(origin.x,origin.y,origin.z),d=vector3(direction.x,direction.y,direction.z);
  if(dot3(d,d).sign()===0)throw new RangeError('Line direction must be nonzero');
  return Object.freeze({origin:o,direction:d});
}
export function cylinder3(axis:Line3,radiusSquared:ExactInput):Cylinder3 {
  const line=line3(axis.origin,axis.direction),r=exactRational(radiusSquared);
  if(r.sign()<=0)throw new RangeError('A regular cylinder surface requires a positive squared radius');
  return Object.freeze({axis:line,radiusSquared:r});
}
function snapshotSurface(input:Surface3):Surface3 {
  switch(input.kind){
    case 'plane':return Object.freeze({kind:'plane',plane:plane3(input.plane.normal.x,input.plane.normal.y,input.plane.normal.z,input.plane.offset)});
    case 'cylinder':return Object.freeze({kind:'cylinder',cylinder:cylinder3(input.cylinder.axis,input.cylinder.radiusSquared)});
    default:throw new RangeError('Unknown analytic surface kind');
  }
}
const two=new Rational(2n),four=new Rational(4n);
function equation(origin:Point3,direction:Vector3,surface:Surface3):Polynomial {
  if(surface.kind==='plane')return new Polynomial([dot3(surface.plane.normal,origin).add(surface.plane.offset),dot3(surface.plane.normal,direction)]);
  const c=surface.cylinder,d=c.axis.direction,u=cross3(d,subtract3(origin,c.axis.origin)),v=cross3(d,direction);
  return new Polynomial([dot3(u,u).sub(c.radiusSquared.mul(dot3(d,d))),dot3(u,v).mul(two),dot3(v,v)]);
}
/** Implicit value |axisDirection × (point-axisOrigin)|² - radius² |axisDirection|².
 * Negative inside the infinite cylinder; no square root or unit-axis approximation.
 */
export function evaluateCylinder3(input:Cylinder3,point:Point3):Rational {
  return equation(point,vector3(0n,0n,0n),{kind:'cylinder',cylinder:cylinder3(input.axis,input.radiusSquared)}).coefficient(0);
}
function linear(point:AlgebraicCoordinates3,normal:Vector3,offset:Rational):AlgebraicReal {
  return point.x.affine(normal.x,offset).add(point.y.affine(normal.y)).add(point.z.affine(normal.z));
}
/** Plane's oriented side, or cylinder's inside/on/outside sign. */
export function classifyPointToSurface3(inputPoint:Point3|AlgebraicCoordinates3,inputSurface:Surface3):Sign {
  const point=snapshotExactPoint3(inputPoint),surface=snapshotSurface(inputSurface),data=getPointParameterization3(point);
  if(data)return data.parameter.signOf(equation(data.origin,data.direction,surface));
  if(surface.kind==='plane')return linear(point,surface.plane.normal,surface.plane.offset).sign();
  const c=surface.cylinder,d=c.axis.direction,o=c.axis.origin;
  const q=algebraicCoordinates3(point.x.affine(1n,o.x.neg()),point.y.affine(1n,o.y.neg()),point.z.affine(1n,o.z.neg()));
  const x=q.z.affine(d.y).sub(q.y.affine(d.z)),y=q.x.affine(d.z).sub(q.z.affine(d.x)),z=q.y.affine(d.x).sub(q.x.affine(d.y));
  return x.mul(x).add(y.mul(y)).add(z.mul(z)).affine(1n,c.radiusSquared.mul(dot3(d,d)).neg()).sign();
}
/** Exact non-unit normal at a surface point. Plane orientation is retained;
 * cylinder normals point outward. Off-surface points are rejected.
 */
export function normalToSurface3(inputPoint:Point3|AlgebraicCoordinates3,inputSurface:Surface3):AlgebraicCoordinates3 {
  const surface=snapshotSurface(inputSurface),point=snapshotExactPoint3(inputPoint);
  if(classifyPointToSurface3(point,surface)!==0)throw new RangeError('Surface normal requires a point on the surface');
  if(surface.kind==='plane')return algebraicCoordinates3(surface.plane.normal.x,surface.plane.normal.y,surface.plane.normal.z);
  const c=surface.cylinder,d=c.axis.direction,o=c.axis.origin,D=dot3(d,d);
  const q=algebraicCoordinates3(point.x.affine(1n,o.x.neg()),point.y.affine(1n,o.y.neg()),point.z.affine(1n,o.z.neg()));
  const along=linear(q,d,new Rational(0n));
  return algebraicCoordinates3(q.x.affine(D).sub(along.affine(d.x)),q.y.affine(D).sub(along.affine(d.y)),q.z.affine(D).sub(along.affine(d.z)));
}
export interface LineSurfaceHit3 {
  readonly parameter:AlgebraicReal;readonly point:AlgebraicPoint3;
  /** Multiplicity of the substituted polynomial; null for a collapsed segment. */
  readonly multiplicity:1|2|null;
}
export type LineSurfaceIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'contained';readonly line:Line3}
 | {readonly kind:'points';readonly hits:readonly LineSurfaceHit3[]};
function finiteHits(line:Line3,p:Polynomial):readonly LineSurfaceHit3[] {
  const tangent=p.degree===2&&p.coefficient(1).mul(p.coefficient(1)).sub(p.coefficient(0).mul(p.coefficient(2)).mul(four)).sign()===0;
  return Object.freeze(isolateRealRoots(p).map(parameter=>Object.freeze({parameter,point:algebraicPoint3(line.origin,line.direction,parameter),multiplicity:tangent?2 as const:1 as const})));
}
/** Complete line/surface intersection, sorted in increasing input line parameter.
 * A generator on a cylinder or a line in a plane is returned as contained.
 */
export function intersectLineSurface3(input:Line3,inputSurface:Surface3):LineSurfaceIntersection3 {
  const line=line3(input.origin,input.direction),surface=snapshotSurface(inputSurface),p=equation(line.origin,line.direction,surface);
  if(p.degree===-1)return Object.freeze({kind:'contained',line});
  const hits=finiteHits(line,p);return hits.length?Object.freeze({kind:'points',hits}):Object.freeze({kind:'none'});
}
export type SegmentSurfaceIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'contained';readonly segment:Segment3}
 | {readonly kind:'points';readonly hits:readonly LineSurfaceHit3[]};
/** Closed segment, including endpoint hits, contained trims and collapsed points. */
export function intersectSegmentSurface3(input:Segment3,surface:Surface3):SegmentSurfaceIntersection3 {
  const s=segment3(input.start,input.end);
  if(pointsEqual3(s.start,s.end)){
    if(classifyPointToSurface3(s.start,surface)!==0)return Object.freeze({kind:'none'});
    const parameter=AlgebraicReal.fromRational(0n),point=algebraicPoint3(s.start,vector3(0n,0n,0n),parameter);
    return Object.freeze({kind:'points',hits:Object.freeze([Object.freeze({parameter,point,multiplicity:null})])});
  }
  const result=intersectLineSurface3(line3(s.start,subtract3(s.end,s.start)),surface);
  if(result.kind==='contained')return Object.freeze({kind:'contained',segment:s});
  if(result.kind==='none')return result;
  const zero=AlgebraicReal.fromRational(0n),one=AlgebraicReal.fromRational(1n),hits=Object.freeze(result.hits.filter(h=>h.parameter.compare(zero)>=0&&h.parameter.compare(one)<=0));
  return hits.length?Object.freeze({kind:'points',hits}):Object.freeze({kind:'none'});
}
/** Equality of supporting point sets; plane orientation and axis parameterization
 * are ignored. This does not compare bounded faces or trims.
 */
export function surfacesCoincide3(inputA:Surface3,inputB:Surface3):boolean {
  const a=snapshotSurface(inputA),b=snapshotSurface(inputB);if(a.kind!==b.kind)return false;
  if(a.kind==='plane'&&b.kind==='plane'){
    const A=a.plane,B=b.plane,axis=(['x','y','z'] as const).find(k=>A.normal[k].sign()!==0)!,scale=B.normal[axis].div(A.normal[axis]);
    return scale.sign()!==0&&(['x','y','z'] as const).every(k=>A.normal[k].mul(scale).equals(B.normal[k]))&&A.offset.mul(scale).equals(B.offset);
  }
  if(a.kind!=='cylinder'||b.kind!=='cylinder')return false;
  const A=a.cylinder,B=b.cylinder,parallel=cross3(A.axis.direction,B.axis.direction),offset=cross3(A.axis.direction,subtract3(B.axis.origin,A.axis.origin));
  return A.radiusSquared.equals(B.radiusSquared)&&dot3(parallel,parallel).sign()===0&&dot3(offset,offset).sign()===0;
}
