import {point3,dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {cylinder3,classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Surface3,Cylinder3} from './surface3.js';
import type {Sign} from '../numeric/rational.js';
import {compareAlgebraicPoints3,getRationalParameterization3,getPointParameterization3,getBiparameterization3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {pointOnArc3,splitCircularArc3,interiorPointOnArc3,intersectCirclePlane3} from './circle3.js';
import {cylinderCoordinates3} from './cylinder-coordinates3.js';
import {brepCurveEndpoints3} from './brep-curve3.js';
import {intersectCylinderIntersectionArcCylinder3} from './cylinder-intersection-cylinder3.js';
import {intersectCylinderIntersectionArcPlane3} from './cylinder-intersection-plane3.js';
import {partitionCylinderFaceByCylinder3,assertOwnedCylinderFaceCylinderPartition3,restrictCylinderHeightBound3,height,createCylinderFaceCell3} from './cylinder-face-cylinder-partition3.js';
import type {CylinderFaceCylinderPartition3,CylinderFaceCell3,CylinderHeightBound3} from './cylinder-face-cylinder-partition3.js';
import {partitionCylinderFaceCellsByPlane3,assertOwnedCylinderFacePlanePartition3} from './cylinder-cell-plane-partition3.js';
import type {CylinderFacePlanePartition3} from './cylinder-cell-plane-partition3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
export type CylinderFaceRefinementInput3=CylinderFaceCylinderPartition3|CylinderFacePlanePartition3|CylinderFaceRefinement3;
export interface CylinderFaceRefinement3 extends CylinderFaceCylinderPartition3 {
 readonly cuts:readonly Surface3[];readonly source:CylinderFaceRefinementInput3;readonly sourceCells:readonly number[];
 readonly cutters:readonly Cylinder3[];readonly cylinderSides:readonly (readonly Sign[])[];
 readonly planes:readonly Plane3[];readonly planeSides:readonly (readonly Sign[])[];
}
const owned=new WeakSet<CylinderFaceRefinement3>();
export function assertOwnedCylinderFaceRefinement3(input:CylinderFaceRefinement3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created multi-cutter cylinder face refinement');}
function metadata(input:CylinderFaceRefinementInput3){
 if(owned.has(input as CylinderFaceRefinement3)){const p=input as CylinderFaceRefinement3;return {cuts:p.cuts,cutters:p.cutters,cylinderSides:p.cylinderSides,planes:p.planes,planeSides:p.planeSides};}
 if('planes' in input){assertOwnedCylinderFacePlanePartition3(input);return {cuts:input.planes.map(plane=>Object.freeze({kind:'plane' as const,plane})),cutters:[input.cutter],cylinderSides:input.cells.map(c=>[c.side]),planes:input.planes,planeSides:input.planeSides};}
 assertOwnedCylinderFaceCylinderPartition3(input);return {cuts:[],cutters:[input.cutter],cylinderSides:input.cells.map(c=>[c.side]),planes:[],planeSides:input.cells.map(()=>[] as Sign[])};
}
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
/** Overlay a new complete cylinder/plane height arrangement with owned existing
 * embedded strip cells, preserving prior signs and immediate source-cell IDs.
 * Both kinds of returned refinements may be used by this same API again. */
export function refineCylinderFaceCells3(input:CylinderFaceRefinementInput3,cut:Surface3):CylinderFaceRefinement3 {
 const old=metadata(input),base=input.base,surface:Surface3=cut.kind==='cylinder'?Object.freeze({kind:'cylinder',cylinder:cylinder3(cut.cylinder.axis,cut.cylinder.radiusSquared)}):cut.kind==='plane'?Object.freeze({kind:'plane',plane:plane3(cut.plane.normal.x,cut.plane.normal.y,cut.plane.normal.z,cut.plane.offset)}):(()=>{throw new RangeError('Unsupported face cutter');})(),incoming=surface.kind==='cylinder'?partitionCylinderFaceByCylinder3(base,surface.cylinder):partitionCylinderFaceCellsByPlane3(partitionCylinderFaceByCylinder3(base,base.surface),surface.plane),points:AlgebraicCoordinates3[]=[...input.cells.flatMap(c=>c.boundary.flatMap(brepCurveEndpoints3)),...incoming.cells.flatMap(c=>c.boundary.flatMap(brepCurveEndpoints3))],boundPlanes=new Map<string,Plane3>(),sourceArcs=new Set<Extract<CylinderHeightBound3,{kind:'ssi'}>['arc']>(),incomingArcs=new Set<Extract<CylinderHeightBound3,{kind:'ssi'}>['arc']>();
 const asPlane=(b:Exclude<CylinderHeightBound3,{kind:'ssi'}>)=>b.kind==='plane'?b.plane:plane3(base.surface.axis.direction.x,base.surface.axis.direction.y,base.surface.axis.direction.z,dot3(base.surface.axis.direction,base.surface.axis.origin).add(dot3(base.surface.axis.direction,base.surface.axis.direction).mul(b.value)).neg());
 for(const c of input.cells)for(const b of [c.lower,c.upper]){if(b.kind==='ssi')sourceArcs.add(b.arc);else{const p=asPlane(b);boundPlanes.set([p.normal.x,p.normal.y,p.normal.z,p.offset].map(x=>x.toString()).join(','),p);}}
 for(const c of incoming.cells)for(const b of [c.lower,c.upper])if(b.kind==='ssi')incomingArcs.add(b.arc);
 for(const arc of sourceArcs){const hit=surface.kind==='cylinder'?intersectCylinderIntersectionArcCylinder3(arc,surface.cylinder):intersectCylinderIntersectionArcPlane3(arc,surface.plane);if(hit.kind==='points')points.push(...hit.points);}
 for(const p of boundPlanes.values()){
  if(surface.kind==='cylinder'){for(const arc of incomingArcs){const hit=intersectCylinderIntersectionArcPlane3(arc,p);if(hit.kind==='points')points.push(...hit.points);}}
  else {const a=dot3(p.normal,base.surface.axis.direction),b=dot3(surface.plane.normal,base.surface.axis.direction),normal=point3(p.normal.x.mul(b).sub(surface.plane.normal.x.mul(a)),p.normal.y.mul(b).sub(surface.plane.normal.y.mul(a)),p.normal.z.mul(b).sub(surface.plane.normal.z.mul(a))),offset=p.offset.mul(b).sub(surface.plane.offset.mul(a));if(dot3(normal,normal).sign()!==0){const hit=intersectCirclePlane3(base.angular.circle,plane3(normal.x,normal.y,normal.z,offset));if(hit.kind==='points')points.push(...hit.points);}}
 }
 const rank=(p:AlgebraicCoordinates3)=>getRationalParameterization3(p)?3:getPointParameterization3(p)?2:getBiparameterization3(p)?1:0;points.sort((a,b)=>rank(b)-rank(a));
 const contacts=[...input.contacts,...incoming.contacts].filter((p,i,all)=>all.findIndex(q=>same(p,q))===i),cuts=[...input.cells.flatMap(c=>[c.angular.start,c.angular.end]),...incoming.cells.flatMap(c=>[c.angular.start,c.angular.end]),...[...points,...contacts].map(p=>cylinderCoordinates3(base.surface,p).base)].filter((p,i,all)=>all.findIndex(q=>same(p,q))===i),cells:CylinderFaceCell3[]=[],sourceCells:number[]=[],cylinderSides:(readonly Sign[])[]=[],planeSides:(readonly Sign[])[]=[],coincident=surface.kind==='cylinder'&&surfacesCoincide3({kind:'cylinder',cylinder:base.surface},surface);
 input.cells.forEach((source,id)=>{
  for(const angular of splitCircularArc3(source.angular,cuts.filter(p=>pointOnArc3(p,source.angular)))){
   const q=interiorPointOnArc3(angular),lower=restrictCylinderHeightBound3(source.lower,angular,points),upper=restrictCylinderHeightBound3(source.upper,angular,points),lo=height(base,lower,q),hi=height(base,upper,q),roots:CylinderHeightBound3[]=[];
   for(const c of incoming.cells)if(pointOnArc3(q,c.angular))for(const b of [c.lower,c.upper]){const h=height(base,b,q);if(h.compare(lo)>0&&h.compare(hi)<0&&!roots.some(r=>height(base,r,q).compare(h)===0))roots.push(b);}
   roots.sort((a,b)=>height(base,a,q).compare(height(base,b,q)));const bounds=[lower,...roots.map(b=>restrictCylinderHeightBound3(b,angular,points)),upper];
   for(let i=0;i+1<bounds.length;i++){const cell=createCylinderFaceCell3(base,angular,bounds[i]!,bounds[i+1]!,source.side,contacts),side=coincident?0:classifyPointToSurface3(cell.sample,surface);if(side===0&&!coincident)throw new Error('Refined open cylinder cell contains an unpartitioned cutter root');cells.push(cell);sourceCells.push(id);cylinderSides.push(Object.freeze([...old.cylinderSides[id]!,...(surface.kind==='cylinder'?[side]:[])]));planeSides.push(Object.freeze([...old.planeSides[id]!,...(surface.kind==='plane'?[side]:[])]));}
  }
 });
 const sewn=sewMixedBRepFaces3(cells.map(c=>({surface:{kind:'cylinder' as const,cylinder:base.surface},sense:base.sense,loops:[c.boundary]}))),result=Object.freeze({base,cutter:input.cutter,intersection:input.intersection,contacts:Object.freeze(contacts),cuts:Object.freeze([...old.cuts,surface]),source:input,sourceCells:Object.freeze(sourceCells),cutters:Object.freeze([...old.cutters,...(surface.kind==='cylinder'?[surface.cylinder]:[])]),planes:Object.freeze([...old.planes,...(surface.kind==='plane'?[surface.plane]:[])]),cylinderSides:Object.freeze(cylinderSides),planeSides:Object.freeze(planeSides),cells:Object.freeze(cells),sewn});owned.add(result);return result;
}
export function partitionCylinderFaceCellsByCylinder3(input:CylinderFaceRefinementInput3,cylinder:Cylinder3):CylinderFaceRefinement3 {return refineCylinderFaceCells3(input,{kind:'cylinder',cylinder});}
