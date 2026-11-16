import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,dot3,subtract3,segment3} from './point3.js';
import type {Point3,Segment3} from './point3.js';
import {line3,cylinder3} from './surface3.js';
import type {Line3,Surface3} from './surface3.js';
import {plane3} from './plane3.js';
import {circle3} from './circle3.js';
import type {Circle3} from './circle3.js';
import {algebraicPoint3,algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface UniqueClosestPoint3 {readonly kind:'point';readonly point:AlgebraicCoordinates3;readonly squaredDistance:AlgebraicReal;}
export interface LineClosestPoint3 extends UniqueClosestPoint3 {readonly parameter:Rational;}
export type SurfaceClosestPoint3=UniqueClosestPoint3|{readonly kind:'circle';readonly circle:Circle3;readonly squaredDistance:AlgebraicReal;};
const zero=new Rational(0n),one=new Rational(1n);
function linePoint(origin:Point3,direction:Point3,t:Rational):Point3{return point3(origin.x.add(direction.x.mul(t)),origin.y.add(direction.y.mul(t)),origin.z.add(direction.z.mul(t)));}
function unique(p:Point3,q:Point3,parameter:Rational):LineClosestPoint3 {
 const d=subtract3(p,q);return Object.freeze({kind:'point',point:algebraicCoordinates3(q.x,q.y,q.z),squaredDistance:AlgebraicReal.fromRational(dot3(d,d)),parameter});
}
/** Exact closest point on an infinite rational supporting line. */
export function closestPointOnLine3(input:Point3,inputLine:Line3):LineClosestPoint3 {
 const p=point3(input.x,input.y,input.z),line=line3(inputLine.origin,inputLine.direction),t=dot3(subtract3(p,line.origin),line.direction).div(dot3(line.direction,line.direction));
 return unique(p,linePoint(line.origin,line.direction,t),t);
}
/** Closed rational segment; a collapsed segment returns its point with t=0. */
export function closestPointOnSegment3(input:Point3,inputSegment:Segment3):LineClosestPoint3 {
 const p=point3(input.x,input.y,input.z),s=segment3(inputSegment.start,inputSegment.end),d=subtract3(s.end,s.start),D=dot3(d,d);
 let t=D.sign()===0?zero:dot3(subtract3(p,s.start),d).div(D);if(t.sign()<0)t=zero;else if(t.compare(one)>0)t=one;
 return unique(p,linePoint(s.start,d,t),t);
}
/** Plane or infinite circular-cylinder support, not a trimmed face or solid.
 * An axis point has an entire nearest circle; no arbitrary point is selected. */
export function closestPointOnSurface3(input:Point3,surface:Surface3):SurfaceClosestPoint3 {
 const p=point3(input.x,input.y,input.z);
 if(surface.kind==='plane'){
  const s=surface.plane,plane=plane3(s.normal.x,s.normal.y,s.normal.z,s.offset),N=dot3(plane.normal,plane.normal),value=dot3(plane.normal,p).add(plane.offset),q=linePoint(p,plane.normal,value.neg().div(N));
  return Object.freeze({kind:'point',point:algebraicCoordinates3(q.x,q.y,q.z),squaredDistance:AlgebraicReal.fromRational(value.mul(value).div(N))});
 }
 if(surface.kind!=='cylinder')throw new RangeError('Unknown analytic closest-point support');
 const c=cylinder3(surface.cylinder.axis,surface.cylinder.radiusSquared),d=c.axis.direction,D=dot3(d,d),q=linePoint(c.axis.origin,d,dot3(subtract3(p,c.axis.origin),d).div(D)),radial=subtract3(p,q),rhoSquared=dot3(radial,radial);
 if(rhoSquared.sign()===0)return Object.freeze({kind:'circle',circle:circle3(q,d,c.radiusSquared),squaredDistance:AlgebraicReal.fromRational(c.radiusSquared)});
 const scale=AlgebraicReal.fromRational(c.radiusSquared.div(rhoSquared)).sqrt();
 return Object.freeze({kind:'point',point:algebraicPoint3(q,radial,scale),squaredDistance:scale.affine(rhoSquared.mul(new Rational(-2n)),rhoSquared.add(c.radiusSquared))});
}
