import {finiteCylinderPlaneDomain3} from './finite-cylinder-plane-domain3.js';
import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
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
const owned=new WeakSet<CylinderExpressionPlaneSection3>();
export function assertOwnedCylinderExpressionPlaneSection3(input:CylinderExpressionPlaneSection3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder expression plane section');}
function truth(t:FiniteCylinderExpression3,v:readonly boolean[]):boolean {if(t.kind==='operand')return v[t.operand]!;const a=truth(t.first,v),b=truth(t.second,v);switch(t.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}}
/** Positive-area cut-cap candidates of an owned cylinder expression. Interior
 * patches have material on both sides; boundary patches coincide with an old
 * outer/cavity cap. This does not assemble closed child Bodies or contacts. */
export function sectionFiniteCylinderExpression3(source:FiniteCylinderExpressionBoundary3,input:Plane3,additionalPlanes:readonly Plane3[]=[]):CylinderExpressionPlaneSection3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),n=plane.normal,base=finiteCylinderPlaneDomain3(source.operands,plane),partition=partitionPlanarFaceByFiniteCylinders3(base,source.operands.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),additionalPlanes),patches:CylinderExpressionSectionPatch3[]=[];
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
