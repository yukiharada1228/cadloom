import {assertOwnedClippedCylinderExpression3} from './clipped-cylinder-expression3.js';
import type {ClippedCylinderExpression3} from './clipped-cylinder-expression3.js';
import type {FiniteCylinderExpression3} from './finite-cylinder-expression3.js';
import type {CylinderHalfSpace3} from './trimmed-cylinder3.js';
import {assertOwnedFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {point3,dot3,cross3} from './point3.js';
import type {Vector3,Point3} from './point3.js';
import {snapshotExactPoint3,signLinearAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {finiteCylinderPlaneDomain3} from './finite-cylinder-plane-domain3.js';
import {partitionCylinderFaceByFiniteCylinders3} from './cylinder-face-finite-cylinder3.js';
import type {CylinderFaceFiniteCylindersPartition3} from './cylinder-face-finite-cylinder3.js';
import {partitionPlanarFaceByFiniteCylinders3} from './planar-face-finite-cylinder3.js';
import type {PlanarFaceFiniteCylindersPartition3} from './planar-face-finite-cylinder3.js';
import type {CylinderFaceCell3} from './cylinder-face-cylinder-partition3.js';
import type {PlanarCylinderFaceCell3} from './planar-face-cylinder-partition3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {SewnMixedBRep3} from './sew-mixed-brep3.js';
import type {BooleanOperation} from './polygon-boolean.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import type {Sign,Rational} from '../numeric/rational.js';
export type CylinderMaterialExpression3=
 | {readonly kind:'cylinder';readonly cylinder:number}
 | {readonly kind:'halfspace';readonly halfspace:number}
 | {readonly kind:BooleanOperation;readonly first:CylinderMaterialExpression3;readonly second:CylinderMaterialExpression3};
export type CylinderMaterialFaceOrigin3={readonly kind:'cylinder';readonly cylinder:number;readonly face:0|1|2;readonly cell:number}|{readonly kind:'halfspace';readonly halfspace:number;readonly cell:number};
export interface CylinderMaterialFace3 {readonly surface:Surface3;readonly sense:1|-1;readonly orientation:1|-1;readonly boundary:readonly BRepCurve3[];readonly domain:CylinderFaceCell3|PlanarCylinderFaceCell3;readonly origin:CylinderMaterialFaceOrigin3;}
export interface CylinderMaterialBoundary3 {
 readonly cylinders:readonly FiniteCylinder3[];readonly planes:readonly Plane3[];readonly expression:CylinderMaterialExpression3;
 readonly partitions:readonly {readonly wall:CylinderFaceFiniteCylindersPartition3;readonly caps:readonly PlanarFaceFiniteCylindersPartition3[]}[];
 readonly planePartitions:readonly PlanarFaceFiniteCylindersPartition3[];readonly faces:readonly CylinderMaterialFace3[];readonly sewn:SewnMixedBRep3;readonly empty:boolean;readonly manifold:boolean;
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const owned=new WeakSet<CylinderMaterialBoundary3>();
export function assertOwnedCylinderMaterialBoundary3(input:CylinderMaterialBoundary3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder material boundary');}
function snapshot(t:CylinderMaterialExpression3,n:number,m:number,active=new Set<object>()):CylinderMaterialExpression3 {
 if(t===null||typeof t!=='object'||active.has(t))throw new RangeError('Invalid or cyclic cylinder material expression');active.add(t);let result:CylinderMaterialExpression3;
 if(t.kind==='cylinder'){if(!Number.isSafeInteger(t.cylinder)||t.cylinder<0||t.cylinder>=n)throw new RangeError('Invalid material cylinder index');result=Object.freeze({kind:t.kind,cylinder:t.cylinder});}
 else if(t.kind==='halfspace'){if(!Number.isSafeInteger(t.halfspace)||t.halfspace<0||t.halfspace>=m)throw new RangeError('Invalid material halfspace index');result=Object.freeze({kind:t.kind,halfspace:t.halfspace});}
 else {if(!['union','intersection','difference','xor'].includes(t.kind))throw new RangeError('Unknown material expression operation');result=Object.freeze({kind:t.kind,first:snapshot(t.first,n,m,active),second:snapshot(t.second,n,m,active)});}active.delete(t);return result;
}
function truth(t:CylinderMaterialExpression3,c:readonly boolean[],p:readonly boolean[]):boolean {if(t.kind==='cylinder')return c[t.cylinder]!;if(t.kind==='halfspace')return p[t.halfspace]!;const a=truth(t.first,c,p),b=truth(t.second,c,p);switch(t.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}}
/** Conservative Boolean range with every cylinder false and all planes unknown.
 * False upper bound proves that the material is bounded by the cylinder union.
 * Compositions of bounded operands always retain that certificate. */
function exterior(t:CylinderMaterialExpression3):{lo:boolean;hi:boolean} {if(t.kind==='cylinder')return {lo:false,hi:false};if(t.kind==='halfspace')return {lo:false,hi:true};const a=exterior(t.first),b=exterior(t.second);switch(t.kind){case 'union':return {lo:a.lo||b.lo,hi:a.hi||b.hi};case 'intersection':return {lo:a.lo&&b.lo,hi:a.hi&&b.hi};case 'difference':return {lo:a.lo&&!b.hi,hi:a.hi&&!b.lo};case 'xor':return {lo:a.lo&&!b.hi||!a.hi&&b.lo,hi:a.hi&&!b.lo||!a.lo&&b.hi};}}
/** A bounded Boolean of finite cylinders and negative-side halfspace predicates.
 * Halfspaces belong inside the expression, so each operand keeps its own cuts. */
export function boundaryCylinderMaterialExpression3(input:readonly FiniteCylinder3[],inputPlanes:readonly Plane3[],tree:CylinderMaterialExpression3):CylinderMaterialBoundary3 {
 if(!input.length)throw new RangeError('At least one finite cylinder is required');input.forEach(assertOwnedFiniteCylinder3);const cylinders=Object.freeze([...input]),planes=Object.freeze(inputPlanes.map(p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset))),expression=snapshot(tree,cylinders.length,planes.length);if(exterior(expression).hi)throw new RangeError('Material expression is not certified bounded by its finite cylinders');
 const definitions=cylinders.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),partitions=Object.freeze(cylinders.map(c=>Object.freeze({wall:partitionCylinderFaceByFiniteCylinders3(c.wall,definitions,planes),caps:Object.freeze(c.caps.map(cap=>partitionPlanarFaceByFiniteCylinders3(cap,definitions,planes)))}))),planePartitions=Object.freeze(planes.map(p=>partitionPlanarFaceByFiniteCylinders3(finiteCylinderPlaneDomain3(cylinders,p),definitions,planes))),faces:CylinderMaterialFace3[]=[];
 function add(domain:CylinderFaceCell3|PlanarCylinderFaceCell3,locations:readonly CurveRegionLocation2[],sides:readonly Sign[],surface:Surface3,normal:Vector3|null,sense:1|-1,priority:number,origin:CylinderMaterialFaceOrigin3){
  const minusC:boolean[]=[],plusC:boolean[]=[],minusP:boolean[]=[],plusP:boolean[]=[];
  for(let j=0;j<cylinders.length;j++){
   const location=locations[j]!;if(location!=='boundary'){minusC.push(location==='inside');plusC.push(location==='inside');continue;}const c=cylinders[j]!;let same:boolean,other:number;
   if(origin.kind==='cylinder'&&origin.face===0){if(!surfacesCoincide3(surface,{kind:'cylinder',cylinder:c.cylinder}))throw new Error('Open wall material lacks coincident cylinder support');same=true;other=3*j;}
   else {const k=c.caps.findIndex(cap=>surfacesCoincide3(surface,{kind:'plane',plane:cap.surface}));if(k<0||normal===null)throw new Error('Open planar material lacks a coincident axial cap');same=dot3(c.caps[k]!.normal,normal).sign()>0;other=3*j+k+1;}
   if(other<priority)return;minusC.push(same);plusC.push(!same);
  }
  for(let j=0;j<planes.length;j++){
   const side=sides[j]!;if(side!==0){minusP.push(side<0);plusP.push(side<0);continue;}const p=planes[j]!;if(normal===null||!surfacesCoincide3(surface,{kind:'plane',plane:p}))throw new Error('Open zero-side material lacks coincident plane support');if(3*cylinders.length+j<priority)return;const d=dot3(p.normal,normal).sign();if(d===0)throw new Error('Coincident planes have zero normal derivative');minusP.push(d>0);plusP.push(d<0);
  }
  const a=truth(expression,minusC,minusP),b=truth(expression,plusC,plusP);if(a===b)return;const orientation=a?1:-1,curves=origin.kind==='cylinder'&&origin.face===0?(domain as CylinderFaceCell3).boundary:(domain as PlanarCylinderFaceCell3).boundary.map(nativeBRepCurve3),boundary=Object.freeze(orientation===1?[...curves]:[...curves].reverse().map(reverseBRepCurve3));faces.push(Object.freeze({surface,sense:sense*orientation as 1|-1,orientation,boundary,domain,origin:Object.freeze(origin)}));
 }
 const offset=2*cylinders.length;
 cylinders.forEach((c,i)=>{const part=partitions[i]!;part.wall.partition.cells.forEach((cell,k)=>add(cell,part.wall.materialLocations[k]!,part.wall.partition.planeSides[k]!.slice(offset),Object.freeze({kind:'cylinder',cylinder:c.cylinder}),null,1,3*i,{kind:'cylinder',cylinder:i,face:0,cell:k}));part.caps.forEach((p,j)=>p.partition.cells.forEach((cell,k)=>add(cell,p.materialLocations[k]!,cell.planeSides.slice(offset),Object.freeze({kind:'plane',plane:c.caps[j]!.surface}),c.caps[j]!.normal,c.caps[j]!.sense,3*i+j+1,{kind:'cylinder',cylinder:i,face:j+1 as 1|2,cell:k})));});
 planePartitions.forEach((p,i)=>p.partition.cells.forEach((cell,k)=>add(cell,p.materialLocations[k]!,cell.planeSides.slice(offset),Object.freeze({kind:'plane',plane:p.partition.base.surface}),planes[i]!.normal,p.partition.base.sense,3*cylinders.length+i,{kind:'halfspace',halfspace:i,cell:k})));
 const frozenFaces=Object.freeze(faces),sewn=sewMixedBRepFaces3(faces.map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})));for(const e of sewn.topology.edges)if(e.coedges.length<2||e.coedges.reduce((s,id)=>s+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Cylinder material expression has an unbalanced edge');
 const empty=faces.length===0,manifold=empty||sewn.topology.closedOrientedIncidence,locate=(inputPoint:Point3|AlgebraicCoordinates3):CurveRegionLocation2=>{
  if(empty)return 'outside';const p=snapshotExactPoint3(inputPoint),cs=cylinders.map(c=>c.locate(p)),ps=planes.map(plane=>classifyPointToSurface3(p,{kind:'plane',plane}));if(cs.every(c=>c!=='boundary')&&ps.every(s=>s!==0))return truth(expression,cs.map(c=>c==='inside'),ps.map(s=>s<0))?'inside':'outside';if(frozenFaces.some(f=>f.domain.locate(p)!=='outside'))return 'boundary';
  for(let k=0n;;k++){
   const v=point3(1n,k,k*k),cv:boolean[]=[],pv:boolean[]=[];let retry=false;
   for(const c of cylinders){const d=c.cylinder.axis.direction,o=c.cylinder.axis.origin,D=dot3(d,d),dv=dot3(d,v),n=point3(v.x.mul(D).sub(d.x.mul(dv)),v.y.mul(D).sub(d.y.mul(dv)),v.z.mul(D).sub(d.z.mul(dv)));let radial=classifyPointToSurface3(p,{kind:'cylinder',cylinder:c.cylinder});if(radial===0){radial=signLinearAlgebraicPoint3(p,n,dot3(n,o).neg());if(radial===0){const cross=cross3(d,v);if(dot3(cross,cross).sign()===0){retry=true;break;}radial=1;}}const cap=(t:Rational)=>{const sign=classifyPointToSurface3(p,{kind:'plane',plane:plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg())});return sign===0?dv.sign():sign;},lo=cap(c.lower),hi=cap(c.upper);if(lo===0||hi===0){retry=true;break;}cv.push(radial<0&&lo>0&&hi<0);}
   if(retry)continue;for(let i=0;i<planes.length;i++){const sign=ps[i]===0?dot3(planes[i]!.normal,v).sign():ps[i]!;if(sign===0){retry=true;break;}pv.push(sign<0);}if(!retry)return truth(expression,cv,pv)?'inside':'outside';
  }
 };
 const result=Object.freeze({cylinders,planes,expression,partitions,planePartitions,faces:frozenFaces,sewn,empty,manifold,locate});owned.add(result);return result;
}

export type CylinderMaterialOperand3=ClippedCylinderExpression3|CylinderMaterialBoundary3;
function parts(input:CylinderMaterialOperand3):Pick<CylinderMaterialBoundary3,'cylinders'|'planes'|'expression'> {
 if(owned.has(input as CylinderMaterialBoundary3))return input as CylinderMaterialBoundary3;const clipped=input as ClippedCylinderExpression3;assertOwnedClippedCylinderExpression3(clipped);
 const walk=(t:FiniteCylinderExpression3):CylinderMaterialExpression3=>t.kind==='operand'?{kind:'cylinder',cylinder:t.operand}:{kind:t.kind,first:walk(t.first),second:walk(t.second)};let expression=walk(clipped.source.expression);const planes=clipped.halfspaces.map(h=>h.plane);planes.forEach((_,halfspace)=>{expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};});return {cylinders:clipped.source.operands,planes,expression};
}
/** Boolean composition retains each operand's complete local material formula. */
export function booleanCylinderMaterials3(a:CylinderMaterialOperand3,b:CylinderMaterialOperand3,operation:BooleanOperation):CylinderMaterialBoundary3 {
 if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown cylinder material operation');const cylinders:FiniteCylinder3[]=[],planes:Plane3[]=[],ci=new Map<FiniteCylinder3,number>(),pi=new Map<Plane3,number>();
 const remap=(input:CylinderMaterialOperand3):CylinderMaterialExpression3=>{const p=parts(input),C=p.cylinders.map(c=>{let id=ci.get(c);if(id===undefined){id=cylinders.length;ci.set(c,id);cylinders.push(c);}return id;}),P=p.planes.map(plane=>{let id=pi.get(plane);if(id===undefined){id=planes.length;pi.set(plane,id);planes.push(plane);}return id;}),walk=(t:CylinderMaterialExpression3):CylinderMaterialExpression3=>t.kind==='cylinder'?{kind:t.kind,cylinder:C[t.cylinder]!}:t.kind==='halfspace'?{kind:t.kind,halfspace:P[t.halfspace]!}:{kind:t.kind,first:walk(t.first),second:walk(t.second)};return walk(p.expression);};const expression:CylinderMaterialExpression3={kind:operation,first:remap(a),second:remap(b)};return boundaryCylinderMaterialExpression3(cylinders,planes,expression);
}
/** Further cuts of prior Boolean results become predicates inside the same program. */
export function clipCylinderMaterial3(input:CylinderMaterialOperand3,halfspaces:readonly CylinderHalfSpace3[]):CylinderMaterialBoundary3 {
 const p=parts(input),planes=[...p.planes];let expression=p.expression;for(const h of halfspaces){if(h.side!==-1&&h.side!==1)throw new RangeError('Halfspace side must be -1 or 1');const v=plane3(h.plane.normal.x,h.plane.normal.y,h.plane.normal.z,h.plane.offset),n=v.normal,plane=h.side===-1?v:plane3(n.x.neg(),n.y.neg(),n.z.neg(),v.offset.neg()),halfspace=planes.length;planes.push(plane);expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};}return boundaryCylinderMaterialExpression3(p.cylinders,planes,expression);
}

/** Internal strict witness classifier; primitive-boundary cases must retry. */
export function strictCylinderMaterialLocation3(source:CylinderMaterialBoundary3,p:Point3):'inside'|'outside'|null {
 assertOwnedCylinderMaterialBoundary3(source);const c=source.cylinders.map(v=>v.locate(p)),planes=source.planes.map(plane=>classifyPointToSurface3(p,{kind:'plane',plane}));return c.includes('boundary')||planes.includes(0)?null:truth(source.expression,c.map(v=>v==='inside'),planes.map(v=>v<0))?'inside':'outside';
}
