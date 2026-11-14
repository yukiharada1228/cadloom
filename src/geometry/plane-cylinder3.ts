import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,dot3,cross3} from './point3.js';
import type {Vector3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {cylinder3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import {algebraicLine3} from './algebraic-line3.js';
import type {AlgebraicLine3} from './algebraic-line3.js';
import {planeFrame3} from './plane-frame3.js';
import {ellipse3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';

export type PlaneCylinderIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'ellipse';readonly ellipse:Ellipse3}
 | {readonly kind:'lines';readonly lines:readonly {readonly line:AlgebraicLine3;readonly multiplicity:1|2}[]};
/** Complete supporting-surface intersection: an ellipse, one double tangent
 * generator, two simple generators, or empty. No unit-normal approximation.
 */
export function intersectPlaneCylinder3(inputPlane:Plane3,inputCylinder:Cylinder3):PlaneCylinderIntersection3 {
  const plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),cylinder=cylinder3(inputCylinder.axis,inputCylinder.radiusSquared),n=plane.normal,o=cylinder.axis.origin,d=cylinder.axis.direction,N=dot3(n,n),D=dot3(d,d),slope=dot3(n,d),offset=dot3(n,o).add(plane.offset);
  if(slope.sign()!==0){
    const t=offset.neg().div(slope),center=point3(o.x.add(d.x.mul(t)),o.y.add(d.y.mul(t)),o.z.add(d.z.mul(t))),u=d.y.sign()!==0||d.z.sign()!==0?cross3(d,vector3(1n,0n,0n)):cross3(d,vector3(0n,1n,0n)),v=cross3(d,u);
    const project=(a:Vector3)=>{const rate=dot3(n,a).div(slope);return vector3(a.x.sub(d.x.mul(rate)),a.y.sub(d.y.mul(rate)),a.z.sub(d.z.mul(rate)));};
    const U=project(u);let V=project(v);if(dot3(cross3(U,V),n).sign()<0)V=vector3(V.x.neg(),V.y.neg(),V.z.neg());
    const ellipse=ellipse3(planeFrame3(center,U,V),cylinder.radiusSquared.div(dot3(u,u)),cylinder.radiusSquared.div(dot3(v,v)));return Object.freeze({kind:'ellipse',ellipse});
  }
  const discriminant=cylinder.radiusSquared.mul(N).sub(offset.mul(offset));if(discriminant.sign()<0)return Object.freeze({kind:'none'});
  const rate=offset.div(N),closest=point3(o.x.sub(n.x.mul(rate)),o.y.sub(n.y.mul(rate)),o.z.sub(n.z.mul(rate)));
  if(discriminant.sign()===0)return Object.freeze({kind:'lines',lines:Object.freeze([Object.freeze({line:algebraicLine3(closest,d),multiplicity:2 as const})])});
  const w=cross3(n,d),parameter=AlgebraicReal.fromRational(discriminant.div(N.mul(N).mul(D))).sqrt();
  const lines=[parameter.neg(),parameter].map(t=>Object.freeze({line:algebraicLine3(algebraicPoint3(closest,w,t),d),multiplicity:1 as const})).sort((a,b)=>compareAlgebraicPoints3(a.line.origin,b.line.origin));
  return Object.freeze({kind:'lines',lines:Object.freeze(lines)});
}
