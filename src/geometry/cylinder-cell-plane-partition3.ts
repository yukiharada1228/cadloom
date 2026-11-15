import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {Sign} from '../numeric/rational.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {cylinderCoordinates3} from './cylinder-coordinates3.js';
import {splitCircularArc3,pointOnArc3,interiorPointOnArc3} from './circle3.js';
import {splitBoundary} from './cylinder-plane-split3.js';
import {curveEndpoints3} from './curve3.js';
import {intersectCylinderIntersectionArcPlane3} from './cylinder-intersection-plane3.js';
import {height,restrictCylinderHeightBound3,createCylinderFaceCell3,assertOwnedCylinderFaceCylinderPartition3} from './cylinder-face-cylinder-partition3.js';
import type {CylinderFaceCylinderPartition3,CylinderFaceCell3,CylinderHeightBound3} from './cylinder-face-cylinder-partition3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';

export interface CylinderFacePlanePartition3 extends CylinderFaceCylinderPartition3 {
 readonly source:CylinderFaceCylinderPartition3|CylinderFacePlanePartition3;
 readonly planes:readonly Plane3[];
 /** Output cell -> immediate input cell; original cylinder side remains cells[].side. */
 readonly sourceCells:readonly number[];
 /** Open-cell signs for every ordered plane in planes; closed boundaries shared. */
 readonly planeSides:readonly (readonly Sign[])[];
}
const owned=new WeakSet<CylinderFacePlanePartition3>();
export function assertOwnedCylinderFacePlanePartition3(input:CylinderFacePlanePartition3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created plane-refined cylinder face partition');}
/** Refine every owned SSI/native strip domain by another rational plane. Both
 * strict sides remain as closed face cells; no material/solid selection is made.
 * Output is reusable by the same operation, retaining all prior plane signs.
 */
export function partitionCylinderFaceCellsByPlane3(input:CylinderFaceCylinderPartition3|CylinderFacePlanePartition3,inputPlane:Plane3):CylinderFacePlanePartition3 {
 const previous=owned.has(input as CylinderFacePlanePartition3)?input as CylinderFacePlanePartition3:null;if(!previous)assertOwnedCylinderFaceCylinderPartition3(input);
 const plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),base=input.base,a=dot3(plane.normal,base.surface.axis.direction),cells:CylinderFaceCell3[]=[],sourceCells:number[]=[],planeSides:(readonly Sign[])[]=[],planeBound:CylinderHeightBound3=Object.freeze({kind:'plane',plane});
 input.cells.forEach((source,id)=>{
  const points:AlgebraicCoordinates3[]=[];
  for(const c of source.boundary){
   if(c.kind==='native')for(const piece of splitBoundary(c.curve,plane))points.push(...curveEndpoints3(piece));
   else {const hit=intersectCylinderIntersectionArcPlane3(c.arc,plane);if(hit.kind==='points')points.push(...hit.points);}
  }
  const cuts=points.map(p=>cylinderCoordinates3(base.surface,p).base).filter((p,i,all)=>all.findIndex(q=>compareAlgebraicPoints3(p,q)===0)===i&&pointOnArc3(p,source.angular));
  for(const angular of splitCircularArc3(source.angular,cuts)){
   const lower=restrictCylinderHeightBound3(source.lower,angular),upper=restrictCylinderHeightBound3(source.upper,angular),bounds:CylinderHeightBound3[]=[lower];
   if(a.sign()!==0){const q=interiorPointOnArc3(angular),p=height(base,planeBound,q);if(p.compare(height(base,lower,q))>0&&p.compare(height(base,upper,q))<0)bounds.push(planeBound);}
   bounds.push(upper);
   for(let i=0;i+1<bounds.length;i++){
    const cell=createCylinderFaceCell3(base,angular,bounds[i]!,bounds[i+1]!,source.side,input.contacts),side=evaluate(plane,cell.sample).sign();if(side===0)throw new Error('Plane refinement lacks a strict open-cell sign');
    cells.push(cell);sourceCells.push(id);planeSides.push(Object.freeze([...(previous?.planeSides[id]??[]),side]));
   }
  }
 });
 const sewn=sewMixedBRepFaces3(cells.map(c=>({surface:{kind:'cylinder' as const,cylinder:base.surface},sense:base.sense,loops:[c.boundary]}))),result=Object.freeze({base,cutter:input.cutter,intersection:input.intersection,contacts:input.contacts,cells:Object.freeze(cells),sewn,source:input,planes:Object.freeze([...(previous?.planes??[]),plane]),sourceCells:Object.freeze(sourceCells),planeSides:Object.freeze(planeSides)});owned.add(result);return result;
}
