import {Rational} from '../numeric/rational.js';
import {point3,dot3,cross3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {planeFrame3} from './plane-frame3.js';
import {prepareRectangleFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {partitionPlanarFaceByFiniteCylinders3} from './planar-face-finite-cylinder3.js';
import type {PlanarFaceFiniteCylindersPartition3} from './planar-face-finite-cylinder3.js';
import type {PlanarCylinderFaceCell3} from './planar-face-cylinder-partition3.js';
import {surfacesCoincide3} from './surface3.js';
import {assertOwnedFiniteCylinderExpressionBoundary3} from './finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3,FiniteCylinderExpression3} from './finite-cylinder-expression3.js';

export interface CylinderExpressionSectionPatch3 {
 readonly cell:number;readonly domain:PlanarCylinderFaceCell3;
 /** Exact material in the two open normal directions; no numerical offset. */
 readonly negative:boolean;readonly positive:boolean;
 readonly kind:'interior'|'boundary';
}
export interface CylinderExpressionPlaneSection3 {
 readonly source:FiniteCylinderExpressionBoundary3;readonly plane:Plane3;
 readonly base:PreparedPlanarFace3;readonly partition:PlanarFaceFiniteCylindersPartition3;
 /** Only positive-area patches incident to material on at least one side. */
 readonly patches:readonly CylinderExpressionSectionPatch3[];
}
const owned=new WeakSet<CylinderExpressionPlaneSection3>(),axes=['x','y','z'] as const,one=new Rational(1n),zero=new Rational(0n);
export function assertOwnedCylinderExpressionPlaneSection3(input:CylinderExpressionPlaneSection3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder expression plane section');}
function truth(t:FiniteCylinderExpression3,v:readonly boolean[]):boolean {if(t.kind==='operand')return v[t.operand]!;const a=truth(t.first,v),b=truth(t.second,v);switch(t.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}}
/** Positive-area cut-cap candidates of an owned cylinder expression. Interior
 * patches have material on both sides; boundary patches coincide with an old
 * outer/cavity cap. This does not assemble closed child Bodies or contacts. */
export function sectionFiniteCylinderExpression3(source:FiniteCylinderExpressionBoundary3,input:Plane3,additionalPlanes:readonly Plane3[]=[]):CylinderExpressionPlaneSection3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),n=plane.normal,pivot=axes.find(k=>n[k].sign()!==0)!,other=axes.filter(k=>k!==pivot),origin=point3(...axes.map(k=>k===pivot?plane.offset.neg().div(n[pivot]):zero) as [Rational,Rational,Rational]),direction=(axis:typeof axes[number])=>point3(...axes.map(k=>k===axis?one:k===pivot?n[axis].neg().div(n[pivot]):zero) as [Rational,Rational,Rational]),u=direction(other[0]!),v=direction(other[1]!),frame=planeFrame3(origin,u,v),sense=dot3(cross3(u,v),n).sign() as 1|-1;
 // Every cylinder lies strictly inside this rational world-coordinate box:
 // each coordinate's radial displacement is <= radius < radiusSquared + 1.
 let bound=one;for(const p of source.operands){const c=p.cylinder,r=c.radiusSquared.add(one);for(const t of [p.lower,p.upper])for(const k of axes){const x=c.axis.origin[k].add(c.axis.direction[k].mul(t)),a=x.sign()<0?x.neg():x,b=a.add(r).add(one);if(b.compare(bound)>0)bound=b;}}
 // In this chart the two free coordinates are actual world coordinates.
 const base=prepareRectangleFace3(frame,bound.neg(),bound,bound.neg(),bound,sense),partition=partitionPlanarFaceByFiniteCylinders3(base,source.operands.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),additionalPlanes),patches:CylinderExpressionSectionPatch3[]=[];
 partition.partition.cells.forEach((domain,cell)=>{
  const negative:boolean[]=[],positive:boolean[]=[];
  source.operands.forEach((primitive,j)=>{
   const location=partition.materialLocations[cell]![j]!;
   if(location!=='boundary'){negative.push(location==='inside');positive.push(location==='inside');return;}
   // An open planar patch cannot lie on a regular cylinder wall. Boundary
   // membership therefore requires a coincident axial cap, with known outward normal.
   const cap=primitive.caps.find(c=>surfacesCoincide3({kind:'plane',plane:c.surface},{kind:'plane',plane}));if(!cap)throw new Error('Open planar material patch has no coincident cylinder cap');
   const side=dot3(cap.normal,n).sign();if(side===0)throw new Error('Coincident cap has zero normal derivative');negative.push(side>0);positive.push(side<0);
  });
  const a=truth(source.expression,negative),b=truth(source.expression,positive);if(a||b)patches.push(Object.freeze({cell,domain,negative:a,positive:b,kind:a&&b?'interior':'boundary'}));
 });
 const result=Object.freeze({source,plane,base,partition,patches:Object.freeze(patches)});owned.add(result);return result;
}
