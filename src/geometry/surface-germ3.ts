import type {Sign} from '../numeric/rational.js';
import {vector3,dot3,cross3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {snapshotExactPoint3,signLinearAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3,cylinder3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {plane3} from './plane3.js';

export interface SurfaceGermSides3 {readonly minus:Sign;readonly plus:Sign;}
/** Exact eventual signs at p-t*v and p+t*v for sufficiently small t>0.
 * Zero means the entire straight germ lies on the support, not an unknown sign.
 * No finite epsilon is selected. Plane sign retains its supplied orientation;
 * cylinder sign is negative inside. This classifies germs, not a whole face cell.
 */
export function surfaceGermSides3(inputPoint:Point3|AlgebraicCoordinates3,inputDirection:Vector3,inputSurface:Surface3):SurfaceGermSides3 {
 const p=snapshotExactPoint3(inputPoint),v=vector3(inputDirection.x,inputDirection.y,inputDirection.z);
 let surface:Surface3;
 switch(inputSurface.kind){
  case 'plane':{const q=inputSurface.plane;surface={kind:'plane',plane:plane3(q.normal.x,q.normal.y,q.normal.z,q.offset)};break;}
  case 'cylinder':{const c=inputSurface.cylinder;surface={kind:'cylinder',cylinder:cylinder3(c.axis,c.radiusSquared)};break;}
  default:throw new RangeError('Unknown analytic surface kind');
 }
 const value=classifyPointToSurface3(p,surface);
 if(value!==0)return Object.freeze({minus:value,plus:value});
 let derivative:Sign,quadratic:Sign=0;
 if(surface.kind==='plane')derivative=dot3(surface.plane.normal,v).sign();
 else {
  const d=surface.cylinder.axis.direction,o=surface.cylinder.axis.origin,D=dot3(d,d),dv=dot3(d,v);
  const n=vector3(v.x.mul(D).sub(d.x.mul(dv)),v.y.mul(D).sub(d.y.mul(dv)),v.z.mul(D).sub(d.z.mul(dv)));
  derivative=signLinearAlgebraicPoint3(p,n,dot3(n,o).neg());
  const c=cross3(d,v);quadratic=dot3(c,c).sign();
 }
 return derivative===0?Object.freeze({minus:quadratic,plus:quadratic}):Object.freeze({minus:derivative===1?-1:1,plus:derivative});
}
