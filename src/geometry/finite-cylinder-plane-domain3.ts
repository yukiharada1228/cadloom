import {Rational} from '../numeric/rational.js';
import {point3,dot3,cross3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {planeFrame3} from './plane-frame3.js';
import {prepareRectangleFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {assertOwnedFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
const axes=['x','y','z'] as const,one=new Rational(1n),zero=new Rational(0n);
/** Internal rational chart rectangle strictly enclosing every possible section. */
export function finiteCylinderPlaneDomain3(inputCylinders:readonly FiniteCylinder3[],input:Plane3):PreparedPlanarFace3 {
 if(!inputCylinders.length)throw new RangeError('At least one finite cylinder is required');inputCylinders.forEach(assertOwnedFiniteCylinder3);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),n=plane.normal,pivot=axes.find(k=>n[k].sign()!==0)!,other=axes.filter(k=>k!==pivot),origin=point3(...axes.map(k=>k===pivot?plane.offset.neg().div(n[pivot]):zero) as [Rational,Rational,Rational]),direction=(axis:typeof axes[number])=>point3(...axes.map(k=>k===axis?one:k===pivot?n[axis].neg().div(n[pivot]):zero) as [Rational,Rational,Rational]),u=direction(other[0]!),v=direction(other[1]!),frame=planeFrame3(origin,u,v),sense=dot3(cross3(u,v),n).sign() as 1|-1;
 // Every cylinder lies strictly inside this rational world-coordinate box:
 // each coordinate's radial displacement is <= radius < radiusSquared + 1.
 let bound=one;for(const p of inputCylinders){const c=p.cylinder,r=c.radiusSquared.add(one);for(const t of [p.lower,p.upper])for(const k of axes){const x=c.axis.origin[k].add(c.axis.direction[k].mul(t)),a=x.sign()<0?x.neg():x,b=a.add(r).add(one);if(b.compare(bound)>0)bound=b;}}
 // In this chart the two free coordinates are actual world coordinates.
 return prepareRectangleFace3(frame,bound.neg(),bound,bound.neg(),bound,sense);
}
