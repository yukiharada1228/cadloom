import {assertOwnedCylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from './cylinder-material-expression3.js';
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
 readonly material:CylinderMaterialBoundary3;
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
export function boundaryMaterialSurfaces3(material:CylinderMaterialBoundary3,options:MaterialSurfaceBoundaryOptions3={}):MaterialSurfaceBoundary3 {
 assertOwnedCylinderMaterialBoundary3(material);
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
 const empty=faces.length===0;if(empty!==material.empty)throw new Error('Assembled and source material disagree on emptiness');
 const result=Object.freeze({material,planar,cylindrical,faces,faceOrigins,sewn,empty,closedOrientedIncidence:sewn.topology.closedOrientedIncidence&&sewn.topology.issues.length===0});
 owned.add(result);return result;
}
