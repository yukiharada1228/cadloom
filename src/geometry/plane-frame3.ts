import {algebraicPlanePoint3} from './algebraic-axial-point3.js';
import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point2} from './point2.js';
import type {Point2} from './point2.js';
import {algebraicCoordinates2,algebraicPoint2,snapshotExactPoint2,getPointParameterization2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {point3,vector3,dot3,cross3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {algebraicCoordinates3,algebraicPoint3,snapshotExactPoint3,getPointParameterization3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3} from './surface3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';

/** Injective affine chart p = origin + x*u + y*v; not required to be orthonormal.
 * A local circle can therefore map to an ellipse in 3D.
 */
export interface PlaneFrame3 {readonly origin:Point3;readonly u:Vector3;readonly v:Vector3;}
const axes=['x','y','z'] as const,zero=new Rational(0n);
const frameNormals=new WeakMap<PlaneFrame3,Vector3>(),inverseData=new WeakMap<PlaneFrame3,{readonly plane:Plane3;readonly U:Vector3;readonly V:Vector3;readonly uOffset:Rational;readonly vOffset:Rational}>(),inverses=new WeakMap<PlaneFrame3,WeakMap<AlgebraicCoordinates3,AlgebraicCoordinates2|null>>();
export function planeFrame3(origin:Point3,u:Vector3,v:Vector3):PlaneFrame3 {
  const o=point3(origin.x,origin.y,origin.z),a=vector3(u.x,u.y,u.z),b=vector3(v.x,v.y,v.z),normal=cross3(a,b);
  if(dot3(normal,normal).sign()===0)throw new RangeError('Plane frame directions must be independent');
  const frame=Object.freeze({origin:o,u:a,v:b});frameNormals.set(frame,normal);return frame;
}
function snapshotFrame(frame:PlaneFrame3):PlaneFrame3{return frameNormals.has(frame)?frame:planeFrame3(frame.origin,frame.u,frame.v);}
function mapRational(frame:PlaneFrame3,p:Point2,direction=false):Point3 {
  const component=(k:typeof axes[number])=>frame.u[k].mul(p.x).add(frame.v[k].mul(p.y)).add(direction?zero:frame.origin[k]);
  return point3(component('x'),component('y'),component('z'));
}
export function mapPlanePoint3(input:PlaneFrame3,inputPoint:Point2|AlgebraicCoordinates2):AlgebraicCoordinates3 {return algebraicPlanePoint3(snapshotFrame(input),inputPoint);}

function linear(point:AlgebraicCoordinates3,v:Vector3,offset=zero):AlgebraicReal {
  return evaluate({normal:v,offset},point);
}
/** Returns chart coordinates only if the point lies in the supporting plane.
 * This is a partial inverse, not a projection of off-plane points.
 */
export function pointInPlaneFrame3(input:PlaneFrame3,inputPoint:Point3|AlgebraicCoordinates3):AlgebraicCoordinates2|null {
  const frame=snapshotFrame(input),p=snapshotExactPoint3(inputPoint);let cache=inverses.get(frame);if(!cache){cache=new WeakMap();inverses.set(frame,cache);}const known=cache.get(p);if(known!==undefined)return known;
  let info=inverseData.get(frame);
  if(!info){
    const n=frameNormals.get(frame)!,uu=dot3(frame.u,frame.u),uv=dot3(frame.u,frame.v),vv=dot3(frame.v,frame.v),det=uu.mul(vv).sub(uv.mul(uv));
    const dual=(a:Vector3,b:Vector3,A:Rational,B:Rational)=>vector3(...axes.map(k=>a[k].mul(A).sub(b[k].mul(B)).div(det)) as [Rational,Rational,Rational]),U=dual(frame.u,frame.v,vv,uv),V=dual(frame.v,frame.u,uu,uv);
    info=Object.freeze({plane:plane3(n.x,n.y,n.z,dot3(n,frame.origin).neg()),U,V,uOffset:dot3(U,frame.origin).neg(),vOffset:dot3(V,frame.origin).neg()});inverseData.set(frame,info);
  }
  if(classifyPointToSurface3(p,{kind:'plane',plane:info.plane})!==0){cache.set(p,null);return null;}
  const {U,V}=info,data=getPointParameterization3(p);let result:AlgebraicCoordinates2;
  if(data){
    const project=(value:Vector3,direction=false)=>point2(dot3(U,direction?value:subtract3(value,frame.origin)),dot3(V,direction?value:subtract3(value,frame.origin)));
    result=algebraicPoint2(project(data.origin),project(data.direction,true),data.parameter);
  }else result=algebraicCoordinates2(linear(p,U,info.uOffset),linear(p,V,info.vOffset));
  cache.set(p,result);return result;
}
