import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {dot3} from './point3.js';
import type {Point3} from './point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Surface3} from './surface3.js';
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

export type CylinderExpressionSplitFaceOrigin3=
 | {readonly kind:'wall';readonly parentFace:number;readonly operand:number;readonly cell:number}
 | {readonly kind:'cap';readonly parentFace:number;readonly operand:number;readonly cap:0|1;readonly cell:number}
 | {readonly kind:'section';readonly patch:number};
export interface CylinderExpressionSplitFace3 {
 readonly surface:Surface3;readonly sense:1|-1;readonly boundary:readonly BRepCurve3[];
 readonly domain:CylinderFaceCell3|PlanarCylinderFaceCell3;readonly origin:CylinderExpressionSplitFaceOrigin3;
}
export interface CylinderExpressionSplitChild3 {
 readonly side:-1|1;readonly faces:readonly CylinderExpressionSplitFace3[];readonly sewn:SewnMixedBRep3;
 readonly empty:boolean;readonly manifold:boolean;
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
/** Face pairs only; child coedge subdivision tables remain separate. */
export interface CylinderExpressionSplitInterface3 {readonly patch:number;readonly negativeFace:number;readonly positiveFace:number;}
export interface CylinderExpressionPlaneSplit3 {
 readonly source:FiniteCylinderExpressionBoundary3;readonly plane:Plane3;readonly section:CylinderExpressionPlaneSection3;
 readonly walls:readonly CylinderFaceRefinement3[];readonly caps:readonly (readonly PlanarFaceFiniteCylindersPartition3[])[];
 readonly negative:CylinderExpressionSplitChild3;readonly positive:CylinderExpressionSplitChild3;
 readonly interfaces:readonly CylinderExpressionSplitInterface3[];
 /** One-sided includes touching and disjoint cuts; contacts are not classified here. */
 readonly kind:'split'|'one-sided'|'empty';
}
const owned=new WeakSet<CylinderExpressionPlaneSplit3>();
export function assertOwnedCylinderExpressionPlaneSplit3(input:CylinderExpressionPlaneSplit3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder expression plane split');}
/** Complete closed mixed-boundary children of one plane cut. Retains immediate
 * parent-cell provenance and balanced nonmanifold results. Not yet Body region
 * adoption, persistent clipped recipes or a point/line contact classifier. */
export function splitFiniteCylinderExpressionByPlane3(source:FiniteCylinderExpressionBoundary3,input:Plane3):CylinderExpressionPlaneSplit3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),surface:Surface3=Object.freeze({kind:'plane',plane}),section=sectionFiniteCylinderExpression3(source,plane),definitions=source.operands.map(p=>({cylinder:p.cylinder,lower:p.lower,upper:p.upper})),negative:CylinderExpressionSplitFace3[]=[],positive:CylinderExpressionSplitFace3[]=[],interfaces:CylinderExpressionSplitInterface3[]=[],walls:CylinderFaceRefinement3[]=[],caps:(readonly PlanarFaceFiniteCylindersPartition3[])[]=[];
 const add=(side:-1|1,domain:CylinderFaceCell3|PlanarCylinderFaceCell3,support:Surface3,sense:1|-1,curves:readonly BRepCurve3[],orientation:1|-1,origin:CylinderExpressionSplitFaceOrigin3)=>{const boundary=Object.freeze(orientation===1?[...curves]:[...curves].reverse().map(reverseBRepCurve3)),face=Object.freeze({surface:support,sense,boundary,domain,origin:Object.freeze(origin)});(side===-1?negative:positive).push(face);};
 source.operands.forEach((primitive,operand)=>{
  const old=source.partitions[operand]!,selected=source.faces.flatMap((f,parentFace)=>f.source.operand===operand?[{f,parentFace}]:[]),wall=refineCylinderFaceCells3(old.wall.partition,surface);walls.push(wall);
  wall.cells.forEach((cell,i)=>{const prior=selected.find(p=>p.f.source.face===0&&p.f.source.cell===wall.sourceCells[i]);if(!prior)return;const side=wall.planeSides[i]!.at(-1)!;if(side===0)throw new Error('An open cylinder wall cannot coincide with a cut plane');add(side,cell,prior.f.surface,prior.f.sense,cell.boundary,prior.f.source.orientation,{kind:'wall',parentFace:prior.parentFace,operand,cell:i});});
  caps.push(Object.freeze(primitive.caps.map((cap,k)=>{
   const partition=partitionPlanarFaceByFiniteCylinders3(cap,definitions,[plane]);partition.partition.cells.forEach((cell,i)=>{
    const prior=selected.filter(p=>p.f.source.face===k+1&&p.f.domain.locate(cell.sample)==='inside');if(prior.length>1)throw new Error('Refined planar cell has ambiguous parent face');if(!prior.length)return;const p=prior[0]!,sign=cell.planeSides.at(-1)!;let side:-1|1;
    if(sign!==0)side=sign;else {if(p.f.surface.kind!=='plane'||!surfacesCoincide3(p.f.surface,surface))throw new Error('Zero-side planar cell lacks a coincident cut support');const outward=dot3(p.f.surface.plane.normal,plane.normal).sign()*p.f.sense;if(outward===0)throw new Error('Coincident planar boundary has no physical normal');side=outward>0?-1:1;}
    add(side,cell,p.f.surface,p.f.sense,cell.boundary.map(nativeBRepCurve3),p.f.source.orientation,{kind:'cap',parentFace:p.parentFace,operand,cap:k as 0|1,cell:i});
   });return partition;
  })));
 });
 section.patches.forEach((patch,i)=>{if(patch.kind!=='interior')return;interfaces.push(Object.freeze({patch:i,negativeFace:negative.length,positiveFace:positive.length}));const support:Surface3=Object.freeze({kind:'plane',plane:section.base.surface}),curves=patch.domain.boundary.map(nativeBRepCurve3);add(-1,patch.domain,support,section.base.sense,curves,1,{kind:'section',patch:i});add(1,patch.domain,support,-section.base.sense as 1|-1,curves,-1,{kind:'section',patch:i});});
 const child=(side:-1|1,inputFaces:readonly CylinderExpressionSplitFace3[]):CylinderExpressionSplitChild3=>{
  const faces=Object.freeze([...inputFaces]),sewn=sewMixedBRepFaces3(faces.map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})));for(const e of sewn.topology.edges)if(e.coedges.length<2||e.coedges.reduce((s,id)=>s+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Plane-cut cylinder expression has an unbalanced boundary edge');
  const empty=faces.length===0,manifold=empty||sewn.topology.closedOrientedIncidence,locate=(p:Point3|AlgebraicCoordinates3):CurveRegionLocation2=>{if(empty)return 'outside';if(faces.some(f=>f.domain.locate(p)!=='outside'))return 'boundary';if(classifyPointToSurface3(p,surface)!==side)return 'outside';return locateFiniteCylinderExpression3(source,p)==='inside'?'inside':'outside';};return Object.freeze({side,faces,sewn,empty,manifold,locate});
 };
 const a=child(-1,negative),b=child(1,positive),result=Object.freeze({source,plane,section,walls:Object.freeze(walls),caps:Object.freeze(caps),negative:a,positive:b,interfaces:Object.freeze(interfaces),kind:a.empty&&b.empty?'empty':a.empty||b.empty?'one-sided':'split'} as const);owned.add(result);return result;
}
