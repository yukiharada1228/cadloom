import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point3,vector3,dot3,cross3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {snapshotExactPoint3,algebraicCoordinates3,algebraicPoint3,translateAlgebraicPoint3,subtractAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {line3,cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {plane3} from './plane3.js';

/** Infinite line with an algebraic origin and a nonzero rational direction. */
export interface AlgebraicLine3 {readonly origin:AlgebraicCoordinates3;readonly direction:Vector3;}
export function algebraicLine3(origin:Point3|AlgebraicCoordinates3,direction:Vector3):AlgebraicLine3 {
  const d=line3(point3(0n,0n,0n),direction).direction;return Object.freeze({origin:snapshotExactPoint3(origin),direction:d});
}
export function algebraicLinePoint3(input:AlgebraicLine3,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
  const l=algebraicLine3(input.origin,input.direction),t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter),d=l.direction,o=l.origin;
  if(t.rational!==null)return translateAlgebraicPoint3(o,vector3(d.x.mul(t.rational),d.y.mul(t.rational),d.z.mul(t.rational)));
  if(o.x.rational!==null&&o.y.rational!==null&&o.z.rational!==null)return algebraicPoint3(point3(o.x.rational,o.y.rational,o.z.rational),d,t);
  return algebraicCoordinates3(o.x.add(t.affine(d.x)),o.y.add(t.affine(d.y)),o.z.add(t.affine(d.z)));
}
export function pointOnAlgebraicLine3(inputPoint:Point3|AlgebraicCoordinates3,input:AlgebraicLine3):boolean {
  const l=algebraicLine3(input.origin,input.direction),q=subtractAlgebraicPoints3(inputPoint,l.origin),axes=['x','y','z'] as const,k=axes.find(k=>l.direction[k].sign()!==0)!;
  return axes.every(j=>j===k||q[j].affine(l.direction[k]).compare(q[k].affine(l.direction[j]))===0);
}
/** Whole-line support check, not a finite set of samples. */
export function algebraicLineOnSurface3(input:AlgebraicLine3,inputSurface:Surface3):boolean {
  const l=algebraicLine3(input.origin,input.direction);let surface:Surface3;
  switch(inputSurface.kind){
    case 'plane':{const p=inputSurface.plane;surface={kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)};break;}
    case 'cylinder':surface={kind:'cylinder',cylinder:cylinder3(inputSurface.cylinder.axis,inputSurface.cylinder.radiusSquared)};break;
    default:throw new RangeError('Unknown analytic surface kind');
  }
  if(classifyPointToSurface3(l.origin,surface)!==0)return false;
  if(surface.kind==='plane')return dot3(surface.plane.normal,l.direction).sign()===0;
  const cross=cross3(surface.cylinder.axis.direction,l.direction);return dot3(cross,cross).compare(new Rational(0n))===0;
}
