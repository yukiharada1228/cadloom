import {resolveCylinderMaterialProgram3} from './cylinder-material-expression3.js';
import type {CylinderMaterialDefinition3} from './cylinder-material-expression3.js';
import {assertOwnedCylinderFaceFiniteCylindersPartition3,partitionCylinderFaceByFiniteCylinders3} from './cylinder-face-finite-cylinder3.js';
import type {CylinderFaceFiniteCylindersPartition3} from './cylinder-face-finite-cylinder3.js';
import {surfacesCoincide3} from './surface3.js';
import {evaluateCylinderMaterialExpression3 as truth} from './material-expression-eval3.js';
import {reverseBRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {MixedBRepFace3,SewnMixedBRep3} from './sew-mixed-brep3.js';

export interface CylinderWallMaterialCell3 {
 readonly minus:boolean;readonly plus:boolean;readonly orientation:1|-1|null;
 /** Earliest coincident wall whose finite band contains the open cell. */
 readonly owner:number;
}
export interface CylinderMaterialWallClassification3 {
 readonly material:CylinderMaterialDefinition3;readonly cylinder:number;
 readonly source:CylinderFaceFiniteCylindersPartition3;
 readonly cells:readonly CylinderWallMaterialCell3[];
}
const owned=new WeakSet<CylinderMaterialWallClassification3>();
/** Side predicates use the entire owned cylinder/plane arrangement, not merely
 * a point sample. Normal direction is relative to the source face sense. */
export function classifyCylinderMaterialWall3(material:CylinderMaterialDefinition3,cylinder:number):CylinderMaterialWallClassification3 {
 const program=resolveCylinderMaterialProgram3(material);
 if(!Number.isSafeInteger(cylinder)||cylinder<0||cylinder>=program.cylinders.length)throw new RangeError('Invalid material wall cylinder index');
 const source='partitions' in material?material.partitions[cylinder]!.wall:partitionCylinderFaceByFiniteCylinders3(program.cylinders[cylinder]!.wall,program.cylinders.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),program.planes);assertOwnedCylinderFaceFiniteCylindersPartition3(source);
 const partition=source.partition,n=program.cylinders.length,offset=2*n;
 if(source.cutters.length!==n||partition.planes.length!==offset+program.planes.length)throw new Error('Material wall predicate columns do not match the program');
 const cells=Object.freeze(partition.cells.map((_,i):CylinderWallMaterialCell3=>{
  const locations=source.materialLocations[i]!,sides=partition.planeSides[i]!,minusC:boolean[]=[],plusC:boolean[]=[];let owner=cylinder;
  if(locations.length!==n||sides.length!==offset+program.planes.length)throw new Error('Incomplete material wall predicate row');
  for(let j=0;j<n;j++){
   const location=locations[j]!;
   if(location!=='boundary'){minusC.push(location==='inside');plusC.push(location==='inside');continue;}
   if(partition.cylinderSides[i]![j]!==0||sides[2*j]!==1||sides[2*j+1]!==-1||!surfacesCoincide3({kind:'cylinder',cylinder:partition.base.surface},{kind:'cylinder',cylinder:program.cylinders[j]!.cylinder}))throw new Error('Open boundary wall cell lacks coincident support and strict axial containment');
   const inward=partition.base.sense===1;minusC.push(inward);plusC.push(!inward);owner=Math.min(owner,j);
  }
  if(locations[cylinder]!=='boundary')throw new Error('An owned wall cell is not on its source finite cylinder');
  const planePredicates=program.planes.map((_,j)=>{const sign=sides[offset+j]!;if(sign===0)throw new Error('An open wall cell has an unpartitioned plane zero');return sign<0;});
  const minus=truth(program.expression,minusC,planePredicates),plus=truth(program.expression,plusC,planePredicates);
  return Object.freeze({minus,plus,orientation:minus===plus?null:minus?1:-1,owner});
 }));
 const result=Object.freeze({material,cylinder,source,cells});owned.add(result);return result;
}
export interface CylinderMaterialWallBoundary3 {
 readonly source:CylinderMaterialWallClassification3;readonly faces:readonly MixedBRepFace3[];
 readonly sourceCells:readonly number[];readonly sewn:SewnMixedBRep3;
}
/** Select only the owning wall's material boundary cells; reverse cavity uses. */
export function boundaryCylinderMaterialWall3(source:CylinderMaterialWallClassification3):CylinderMaterialWallBoundary3 {
 if(!owned.has(source))throw new RangeError('Expected a factory-created cylinder wall classification');
 const faces:MixedBRepFace3[]=[],sourceCells:number[]=[],base=source.source.partition.base;
 source.cells.forEach((entry,i)=>{
  if(entry.orientation===null||entry.owner!==source.cylinder)return;
  const boundary=source.source.partition.cells[i]!.boundary,loop=entry.orientation===1?boundary:[...boundary].reverse().map(reverseBRepCurve3),sense=entry.orientation===1?base.sense:base.sense===1?-1:1;
  faces.push(Object.freeze({surface:Object.freeze({kind:'cylinder',cylinder:base.surface}),sense,loops:Object.freeze([Object.freeze([...loop])])}));sourceCells.push(i);
 });
 const sewn=sewMixedBRepFaces3(faces,{splitPoints:source.source.partition.contacts});
 return Object.freeze({source,faces:Object.freeze(faces),sourceCells:Object.freeze(sourceCells),sewn});
}
export interface CylinderMaterialSurfaces3 {
 readonly material:CylinderMaterialDefinition3;readonly walls:readonly CylinderMaterialWallBoundary3[];
 readonly faces:readonly MixedBRepFace3[];
 readonly faceOrigins:readonly Readonly<{cylinder:number;cell:number}>[];
 readonly sewn:SewnMixedBRep3;
}
/** Construct the curved part of the material boundary. Planar pieces and
 * embedded-solid adoption remain separate from shared-edge incidence. */
export function boundaryCylinderMaterialSurfaces3(material:CylinderMaterialDefinition3):CylinderMaterialSurfaces3 {
 const program=resolveCylinderMaterialProgram3(material);
 const walls=Object.freeze(program.cylinders.map((_,i)=>boundaryCylinderMaterialWall3(classifyCylinderMaterialWall3(material,i))));
 const faces=Object.freeze(walls.flatMap(w=>w.faces)),faceOrigins=Object.freeze(walls.flatMap((w,cylinder)=>w.sourceCells.map(cell=>Object.freeze({cylinder,cell}))));
 const sewn=sewMixedBRepFaces3(faces,{splitPoints:walls.flatMap(w=>w.source.source.partition.contacts)});
 return Object.freeze({material,walls,faces,faceOrigins,sewn});
}
