import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {surfacesCoincide3} from './surface3.js';
import {assertOwnedCylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import {finiteCylinderPlaneDomain3} from './finite-cylinder-plane-domain3.js';
import {partitionPlanarFaceByCurves3} from './planar-face-cylinder-partition3.js';
import {classifyPlanarPartitionMaterial3} from './planar-cell-material3.js';
import {refinePlanarMaterial3} from './refine-planar-material3.js';
import type {RefinedPlanarMaterial3} from './refine-planar-material3.js';
import {boundaryPlanarMaterialCells3} from './planar-material-cell-boundary3.js';
import type {PlanarMaterialCellBoundary3} from './planar-material-cell-boundary3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {MixedBRepFace3,SewnMixedBRep3} from './sew-mixed-brep3.js';

export type PlanarMaterialSupportOrigin3=
 | {readonly kind:'cylinder-cap';readonly cylinder:number;readonly cap:0|1}
 | {readonly kind:'halfspace';readonly halfspace:number};
export interface PlanarMaterialSurface3 {
 readonly plane:Plane3;readonly origins:readonly PlanarMaterialSupportOrigin3[];
 readonly refinement:RefinedPlanarMaterial3;readonly boundary:PlanarMaterialCellBoundary3;
}
export interface PlanarMaterialSurfaces3 {
 readonly material:CylinderMaterialBoundary3;
 readonly supports:readonly PlanarMaterialSurface3[];
 readonly faces:readonly MixedBRepFace3[];
 /** Output face index -> support group and refined cell index. */
 readonly faceOrigins:readonly Readonly<{support:number;cell:number}>[];
 readonly sewn:SewnMixedBRep3;
}
/** Build all planar boundary parts of an owned finite-cylinder/halfspace
 * material. Coincident cap and halfspace supports are processed only once.
 * Curved walls, global embedding and solid adoption are separate obligations.
 */
export function boundaryPlanarMaterialSurfaces3(material:CylinderMaterialBoundary3):PlanarMaterialSurfaces3 {
 assertOwnedCylinderMaterialBoundary3(material);
 const groups:{plane:Plane3;origins:PlanarMaterialSupportOrigin3[]}[]=[];
 function add(input:Plane3,origin:PlanarMaterialSupportOrigin3):void {
  let group=groups.find(g=>surfacesCoincide3({kind:'plane',plane:g.plane},{kind:'plane',plane:input}));
  if(!group){group={plane:plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),origins:[]};groups.push(group);}
  group.origins.push(Object.freeze(origin));
 }
 material.cylinders.forEach((c,cylinder)=>c.caps.forEach((cap,i)=>add(cap.surface,{kind:'cylinder-cap',cylinder,cap:i as 0|1})));
 material.planes.forEach((plane,halfspace)=>add(plane,{kind:'halfspace',halfspace}));
 const supports=Object.freeze(groups.map(group=>{
  const domain=finiteCylinderPlaneDomain3(material.cylinders,group.plane),partition=partitionPlanarFaceByCurves3(domain,[]);
  const refinement=refinePlanarMaterial3(classifyPlanarPartitionMaterial3(partition,material)),boundary=boundaryPlanarMaterialCells3(refinement.classification);
  return Object.freeze({plane:group.plane,origins:Object.freeze(group.origins),refinement,boundary});
 }));
 const faces=Object.freeze(supports.flatMap(s=>s.boundary.faces)),faceOrigins=Object.freeze(supports.flatMap((s,support)=>s.boundary.sourceCells.map(cell=>Object.freeze({support,cell}))));
 const sewn=sewMixedBRepFaces3(faces,{splitPoints:supports.flatMap(s=>s.refinement.classification.source.events)});
 return Object.freeze({material,supports,faces,faceOrigins,sewn});
}
