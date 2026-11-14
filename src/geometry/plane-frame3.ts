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

/** Injective affine chart p = origin + x*u + y*v; not required to be orthonormal.
 * A local circle can therefore map to an ellipse in 3D.
 */
export interface PlaneFrame3 {readonly origin:Point3;readonly u:Vector3;readonly v:Vector3;}
const axes=['x','y','z'] as const,zero=new Rational(0n);
export function planeFrame3(origin:Point3,u:Vector3,v:Vector3):PlaneFrame3 {
  const o=point3(origin.x,origin.y,origin.z),a=vector3(u.x,u.y,u.z),b=vector3(v.x,v.y,v.z),normal=cross3(a,b);
  if(dot3(normal,normal).sign()===0)throw new RangeError('Plane frame directions must be independent');
  return Object.freeze({origin:o,u:a,v:b});
}
function snapshotFrame(frame:PlaneFrame3):PlaneFrame3{return planeFrame3(frame.origin,frame.u,frame.v);}
function mapRational(frame:PlaneFrame3,p:Point2,direction=false):Point3 {
  const component=(k:typeof axes[number])=>frame.u[k].mul(p.x).add(frame.v[k].mul(p.y)).add(direction?zero:frame.origin[k]);
  return point3(component('x'),component('y'),component('z'));
}
export function mapPlanePoint3(input:PlaneFrame3,inputPoint:Point2|AlgebraicCoordinates2):AlgebraicCoordinates3 {
  const frame=snapshotFrame(input),p=snapshotExactPoint2(inputPoint),data=getPointParameterization2(p);
  if(data)return algebraicPoint3(mapRational(frame,data.origin),mapRational(frame,data.direction,true),data.parameter);
  const component=(k:typeof axes[number])=>p.x.affine(frame.u[k],frame.origin[k]).add(p.y.affine(frame.v[k]));
  return algebraicCoordinates3(component('x'),component('y'),component('z'));
}
function linear(point:AlgebraicCoordinates3,v:Vector3,offset=zero):AlgebraicReal {
  return point.x.affine(v.x,offset).add(point.y.affine(v.y)).add(point.z.affine(v.z));
}
/** Returns chart coordinates only if the point lies in the supporting plane.
 * This is a partial inverse, not a projection of off-plane points.
 */
export function pointInPlaneFrame3(input:PlaneFrame3,inputPoint:Point3|AlgebraicCoordinates3):AlgebraicCoordinates2|null {
  const frame=snapshotFrame(input),p=snapshotExactPoint3(inputPoint),n=cross3(frame.u,frame.v);
  if(classifyPointToSurface3(p,{kind:'plane',plane:plane3(n.x,n.y,n.z,dot3(n,frame.origin).neg())})!==0)return null;
  const uu=dot3(frame.u,frame.u),uv=dot3(frame.u,frame.v),vv=dot3(frame.v,frame.v),det=uu.mul(vv).sub(uv.mul(uv));
  const dual=(a:Vector3,b:Vector3,A:Rational,B:Rational)=>vector3(...axes.map(k=>a[k].mul(A).sub(b[k].mul(B)).div(det)) as [Rational,Rational,Rational]);
  const U=dual(frame.u,frame.v,vv,uv),V=dual(frame.v,frame.u,uu,uv),data=getPointParameterization3(p);
  if(data){
    const project=(value:Vector3,direction=false)=>point2(dot3(U,direction?value:subtract3(value,frame.origin)),dot3(V,direction?value:subtract3(value,frame.origin)));
    return algebraicPoint2(project(data.origin),project(data.direction,true),data.parameter);
  }
  return algebraicCoordinates2(linear(p,U,dot3(U,frame.origin).neg()),linear(p,V,dot3(V,frame.origin).neg()));
}
