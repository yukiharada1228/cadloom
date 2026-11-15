import {plane3} from './plane3.js';
import {dot3} from './point3.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Surface3} from './surface3.js';
import type {CylinderHalfSpace3} from './trimmed-cylinder3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {refineCylinderFaceCells3} from './cylinder-cell-refinement3.js';
import type {CylinderFaceRefinement3} from './cylinder-cell-refinement3.js';
import {partitionPlanarFaceByFiniteCylinders3} from './planar-face-finite-cylinder3.js';
import type {PlanarFaceFiniteCylindersPartition3} from './planar-face-finite-cylinder3.js';
import type {CylinderFaceCell3} from './cylinder-face-cylinder-partition3.js';
import type {PlanarCylinderFaceCell3} from './planar-face-cylinder-partition3.js';
import {sectionFiniteCylinderExpression3} from './cylinder-expression-plane-section3.js';
import type {CylinderExpressionPlaneSection3} from './cylinder-expression-plane-section3.js';
import {assertOwnedFiniteCylinderExpressionBoundary3,locateFiniteCylinderExpression3} from './finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3} from './finite-cylinder-expression3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {SewnMixedBRep3} from './sew-mixed-brep3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
export type ClippedCylinderExpressionFaceOrigin3=
 | {readonly kind:'wall';readonly parentFace:number;readonly operand:number;readonly cell:number}
 | {readonly kind:'cap';readonly parentFace:number;readonly operand:number;readonly cap:0|1;readonly cell:number}
 | {readonly kind:'cut';readonly cut:number;readonly patch:number};
export interface ClippedCylinderExpressionFace3 {
 readonly surface:Surface3;readonly sense:1|-1;readonly boundary:readonly BRepCurve3[];
 readonly domain:CylinderFaceCell3|PlanarCylinderFaceCell3;readonly origin:ClippedCylinderExpressionFaceOrigin3;
}
export interface ClippedCylinderExpression3 {
 readonly source:FiniteCylinderExpressionBoundary3;
 /** Every original constraint is retained in order, oriented to keep side -1. */
 readonly halfspaces:readonly CylinderHalfSpace3[];
 readonly walls:readonly CylinderFaceRefinement3[];readonly caps:readonly (readonly PlanarFaceFiniteCylindersPartition3[])[];
 readonly sections:readonly CylinderExpressionPlaneSection3[];readonly faces:readonly ClippedCylinderExpressionFace3[];
 readonly sewn:SewnMixedBRep3;readonly empty:boolean;readonly manifold:boolean;
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const owned=new WeakSet<ClippedCylinderExpression3>();
export function assertOwnedClippedCylinderExpression3(input:ClippedCylinderExpression3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created clipped cylinder expression');}
/** Intersection of owned finite-cylinder expression material with any finite
 * list of rational halfspaces. Full cap/cap noding and prior cuts are retained.
 * Closed incidence alone is not a generic imported solid certificate. */
export function clipFiniteCylinderExpression3(source:FiniteCylinderExpressionBoundary3,input:readonly CylinderHalfSpace3[]):ClippedCylinderExpression3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);
 const halfspaces=Object.freeze(input.map(h=>{if(h.side!==-1&&h.side!==1)throw new RangeError('Halfspace side must be -1 or 1');const p=plane3(h.plane.normal.x,h.plane.normal.y,h.plane.normal.z,h.plane.offset),n=p.normal;return Object.freeze({side:-1 as const,plane:h.side===-1?p:plane3(n.x.neg(),n.y.neg(),n.z.neg(),p.offset.neg())});})),planes=halfspaces.map(h=>h.plane),surfaces=planes.map(plane=>Object.freeze({kind:'plane' as const,plane})),definitions=source.operands.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),faces:ClippedCylinderExpressionFace3[]=[],walls:CylinderFaceRefinement3[]=[],caps:(readonly PlanarFaceFiniteCylindersPartition3[])[]=[];
 const add=(domain:CylinderFaceCell3|PlanarCylinderFaceCell3,surface:Surface3,sense:1|-1,curves:readonly BRepCurve3[],orientation:1|-1,origin:ClippedCylinderExpressionFaceOrigin3)=>faces.push(Object.freeze({domain,surface,sense,boundary:Object.freeze(orientation===1?[...curves]:[...curves].reverse().map(reverseBRepCurve3)),origin:Object.freeze(origin)}));
 source.operands.forEach((primitive,operand)=>{
  const original=source.partitions[operand]!,selected=source.faces.flatMap((f,parentFace)=>f.source.operand===operand?[{f,parentFace}]:[]);let wall=original.wall.partition,parents=wall.cells.map((_,i)=>i);
  for(const surface of surfaces){const prior=parents;wall=refineCylinderFaceCells3(wall,surface);parents=wall.sourceCells.map(id=>prior[id]!);}walls.push(wall);
  wall.cells.forEach((cell,i)=>{const parent=selected.find(p=>p.f.source.face===0&&p.f.source.cell===parents[i]);if(!parent)return;const signs=wall.planeSides[i]!.slice(original.wall.partition.planes.length);if(signs.some(s=>s>0))return;if(signs.some(s=>s===0))throw new Error('Open cylinder wall has a zero plane side');add(cell,parent.f.surface,parent.f.sense,cell.boundary,parent.f.source.orientation,{kind:'wall',parentFace:parent.parentFace,operand,cell:i});});
  caps.push(Object.freeze(primitive.caps.map((cap,k)=>{const part=planes.length?partitionPlanarFaceByFiniteCylinders3(cap,definitions,planes):original.caps[k]!;part.partition.cells.forEach((cell,i)=>{
   const parents=selected.filter(p=>p.f.source.face===k+1&&p.f.domain.locate(cell.sample)==='inside');if(parents.length>1)throw new Error('Clipped cap has ambiguous source face');if(!parents.length)return;const parent=parents[0]!,offset=2*source.operands.length;
   for(let j=0;j<planes.length;j++){const sign=cell.planeSides[offset+j]!;if(sign>0)return;if(sign===0){if(parent.f.surface.kind!=='plane'||!surfacesCoincide3(parent.f.surface,surfaces[j]!))throw new Error('Zero-side cap lacks a coincident support');if(dot3(parent.f.surface.plane.normal,planes[j]!.normal).sign()*parent.f.sense<0)return;}}
   add(cell,parent.f.surface,parent.f.sense,cell.boundary.map(nativeBRepCurve3),parent.f.source.orientation,{kind:'cap',parentFace:parent.parentFace,operand,cap:k as 0|1,cell:i});
  });return part;})));
 });
 const sections=Object.freeze(planes.map((plane,cut)=>{const section=sectionFiniteCylinderExpression3(source,plane,planes);section.patches.forEach((patch,id)=>{
  if(patch.kind!=='interior')return;const offset=2*source.operands.length;
  for(let j=0;j<planes.length;j++){const side=patch.domain.planeSides[offset+j]!;if(side>0)return;if(side===0){if(!surfacesCoincide3(surfaces[cut]!,surfaces[j]!))throw new Error('Zero-side cut patch lacks a coincident support');if(dot3(plane.normal,planes[j]!.normal).sign()<0||j<cut)return;}}
  add(patch.domain,Object.freeze({kind:'plane',plane:section.base.surface}),section.base.sense,patch.domain.boundary.map(nativeBRepCurve3),1,{kind:'cut',cut,patch:id});
 });return section;}));
 const frozenFaces=Object.freeze(faces),sewn=sewMixedBRepFaces3(faces.map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})));for(const e of sewn.topology.edges)if(e.coedges.length<2||e.coedges.reduce((s,id)=>s+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Clipped cylinder expression has an unbalanced boundary edge');
 const empty=faces.length===0,manifold=empty||sewn.topology.closedOrientedIncidence,locate=(inputPoint:Point3|AlgebraicCoordinates3):CurveRegionLocation2=>{if(empty)return 'outside';const p=snapshotExactPoint3(inputPoint);if(frozenFaces.some(f=>f.domain.locate(p)!=='outside'))return 'boundary';if(surfaces.some(s=>classifyPointToSurface3(p,s)!==-1))return 'outside';return locateFiniteCylinderExpression3(source,p)==='inside'?'inside':'outside';},result=Object.freeze({source,halfspaces,walls:Object.freeze(walls),caps:Object.freeze(caps),sections,faces:frozenFaces,sewn,empty,manifold,locate});owned.add(result);return result;
}
/** Append constraints while retaining the original expression and every prior cut. */
export function refineClippedCylinderExpression3(input:ClippedCylinderExpression3,additional:readonly CylinderHalfSpace3[]):ClippedCylinderExpression3 {assertOwnedClippedCylinderExpression3(input);return clipFiniteCylinderExpression3(input.source,[...input.halfspaces,...additional]);}
