import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {point3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {classifyPointToSurface3} from './surface3.js';
import {surfaceGermSides3} from './surface-germ3.js';
import {plane3} from './plane3.js';
import {evaluateCylinderMaterialExpression3 as truth} from './material-expression-eval3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import {resolveCylinderMaterialProgram3} from './cylinder-material-expression3.js';
import type {CylinderMaterialDefinition3} from './cylinder-material-expression3.js';
import {boundaryPlanarMaterialSurfaces3} from './planar-material-surfaces3.js';
import type {PlanarMaterialSurfaces3} from './planar-material-surfaces3.js';
import {boundaryCylinderMaterialSurfaces3} from './cylinder-material-surfaces3.js';
import type {CylinderMaterialSurfaces3} from './cylinder-material-surfaces3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {MixedBRepFace3,SewnMixedBRep3} from './sew-mixed-brep3.js';

export type MaterialSurfaceFaceOrigin3=
 | {readonly kind:'plane';readonly support:number;readonly cell:number}
 | {readonly kind:'cylinder';readonly cylinder:number;readonly cell:number};
export interface MaterialSurfaceBoundaryOptions3 {
 /** Require closed oriented manifold incidence, not a global embedding proof. */
 readonly requireClosed?:boolean;
}
export interface MaterialSurfaceBoundary3 {
 readonly material:CylinderMaterialDefinition3;
 readonly planar:PlanarMaterialSurfaces3;readonly cylindrical:CylinderMaterialSurfaces3;
 readonly faces:readonly MixedBRepFace3[];readonly faceOrigins:readonly MaterialSurfaceFaceOrigin3[];
 readonly sewn:SewnMixedBRep3;readonly empty:boolean;
 /** Incidence only; no implicit Body adoption or embedding certificate. */
 readonly closedOrientedIncidence:boolean;
}
const owned=new WeakSet<MaterialSurfaceBoundary3>();
export function assertOwnedMaterialSurfaceBoundary3(input:MaterialSurfaceBoundary3):void {
 if(!owned.has(input))throw new RangeError('Expected a factory-created material surface boundary');
}
/** Assemble planar and cylindrical selections into one oriented boundary.
 * Balanced nonmanifold contacts retain diagnostics unless requireClosed is set.
 * Supports only the owned finite-cylinder/halfspace material program family.
 */
export function boundaryMaterialSurfaces3(material:CylinderMaterialDefinition3,options:MaterialSurfaceBoundaryOptions3={}):MaterialSurfaceBoundary3 {
 resolveCylinderMaterialProgram3(material);
 if(options.requireClosed!==undefined&&typeof options.requireClosed!=='boolean')throw new TypeError('requireClosed must be boolean');
 const planar=boundaryPlanarMaterialSurfaces3(material),cylindrical=boundaryCylinderMaterialSurfaces3(material);
 const faces=Object.freeze([...planar.faces,...cylindrical.faces]);
 const faceOrigins:readonly MaterialSurfaceFaceOrigin3[]=Object.freeze([
  ...planar.faceOrigins.map(origin=>Object.freeze({kind:'plane' as const,...origin})),
  ...cylindrical.faceOrigins.map(origin=>Object.freeze({kind:'cylinder' as const,...origin})),
 ]);
 const splitPoints=[...planar.supports.flatMap(s=>s.refinement.classification.source.events),...cylindrical.walls.flatMap(w=>w.source.source.partition.contacts)];
 const sewn=sewMixedBRepFaces3(faces,{splitPoints,requireClosed:options.requireClosed??false});
 for(const edge of sewn.topology.edges)if(edge.coedges.length<2||edge.coedges.reduce((sum,id)=>sum+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Assembled material surface boundary has an unbalanced edge');
 const empty=faces.length===0;if('empty' in material&&empty!==material.empty)throw new Error('Assembled and source material disagree on emptiness');
 const result=Object.freeze({material,planar,cylindrical,faces,faceOrigins,sewn,empty,closedOrientedIncidence:sewn.topology.closedOrientedIncidence&&sewn.topology.issues.length===0});
 owned.add(result);return result;
}

/** Regularized membership uses selected bounded faces for the boundary, then
 * an exact eventual straight-line germ for cancelled primitive seams. */
export function locateMaterialSurfaceBoundary3(source:MaterialSurfaceBoundary3,input:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
 assertOwnedMaterialSurfaceBoundary3(source);
 if(source.empty)return 'outside';
 const program=resolveCylinderMaterialProgram3(source.material),p=snapshotExactPoint3(input);
 const cs=program.cylinders.map(c=>c.locate(p)),ps=program.planes.map(plane=>classifyPointToSurface3(p,{kind:'plane',plane}));
 if(cs.every(c=>c!=='boundary')&&ps.every(s=>s!==0))return truth(program.expression,cs.map(c=>c==='inside'),ps.map(s=>s<0))?'inside':'outside';
 const onBoundary=source.faceOrigins.some(origin=>{
  const domain=origin.kind==='plane'?source.planar.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!:source.cylindrical.walls[origin.cylinder]!.source.source.partition.cells[origin.cell]!;
  return domain.locate(p)!=='outside';
 });
 if(onBoundary)return 'boundary';
 for(let k=0n;;k++){
  const direction=point3(1n,k,k*k),cylinders:boolean[]=[],planes:boolean[]=[];let retry=false;
  for(const c of program.cylinders){
   const radial=surfaceGermSides3(p,direction,{kind:'cylinder',cylinder:c.cylinder}).plus;
   const d=c.cylinder.axis.direction,o=c.cylinder.axis.origin,D=dot3(d,d);
   const cap=(t:typeof c.lower)=>surfaceGermSides3(p,direction,{kind:'plane',plane:plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg())}).plus;
   const lo=cap(c.lower),hi=cap(c.upper);
   if(radial===0||lo===0||hi===0){retry=true;break;}
   cylinders.push(radial<0&&lo>0&&hi<0);
  }
  if(retry)continue;
  for(let i=0;i<program.planes.length;i++){
   const sign=ps[i]===0?dot3(program.planes[i]!.normal,direction).sign():ps[i]!;
   if(sign===0){retry=true;break;}planes.push(sign<0);
  }
  if(!retry)return truth(program.expression,cylinders,planes)?'inside':'outside';
 }
}
