import {refineCylinderFaceCells3,assertOwnedCylinderFaceRefinement3} from './cylinder-cell-refinement3.js';
import type {CylinderFaceRefinement3,CylinderFaceRefinementInput3} from './cylinder-cell-refinement3.js';
import type {PlanarFiniteCylinderCut3} from './planar-face-finite-cylinder3.js';
import type {ExactInput} from './point2.js';
import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {Cylinder3} from './surface3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {partitionCylinderFaceByCylinder3} from './cylinder-face-cylinder-partition3.js';
import {partitionCylinderFaceCellsByPlane3} from './cylinder-cell-plane-partition3.js';
import type {CylinderFacePlanePartition3} from './cylinder-cell-plane-partition3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
export interface CylinderFaceFiniteCylinderPartition3 {
 readonly cutter:PreparedCylinderFace3;
 readonly partition:CylinderFacePlanePartition3;
 /** Open face-cell location in the filled finite cylinder. Coincident wall
  * patches are boundary, not silently selected as inside/outside material.
  */
 readonly materialLocations:readonly CurveRegionLocation2[];
}
const owned=new WeakSet<CylinderFaceFiniteCylinderPartition3>();
export function assertOwnedCylinderFaceFiniteCylinderPartition3(input:CylinderFaceFiniteCylinderPartition3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created finite-cylinder face partition');}
/** Partition a source cylinder band/angular face by a filled finite cylinder:
 * wall SSI plus both axial cap planes. This labels source face cells, not caps
 * of the cutter or a complete Boolean shell. No tessellated approximation.
 */
export function partitionCylinderFaceByFiniteCylinder3(input:PreparedCylinderFace3,inputCutter:Cylinder3,lower:ExactInput,upper:ExactInput):CylinderFaceFiniteCylinderPartition3 {
 const cutter=prepareCylinderFace3(inputCutter,lower,upper),d=cutter.surface.axis.direction,o=cutter.surface.axis.origin,D=dot3(d,d),at=(t:typeof cutter.lower)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg()),wall=partitionCylinderFaceByCylinder3(input,cutter.surface),first=partitionCylinderFaceCellsByPlane3(wall,at(cutter.lower)),partition=partitionCylinderFaceCellsByPlane3(first,at(cutter.upper)),materialLocations=Object.freeze(partition.cells.map((cell,i):CurveRegionLocation2=>{const sides=partition.planeSides[i]!;return sides[0]!==1||sides[1]!==-1||cell.side===1?'outside':cell.side===0?'boundary':'inside';})),result=Object.freeze({cutter,partition,materialLocations});owned.add(result);return result;
}

export interface CylinderFaceFiniteCylindersPartition3 {
 readonly cutters:readonly PreparedCylinderFace3[];readonly partition:CylinderFaceRefinement3;
 /** Row per open wall cell, column per finite cylinder in input order. */
 readonly materialLocations:readonly (readonly CurveRegionLocation2[])[];
}
const multiOwned=new WeakSet<CylinderFaceFiniteCylindersPartition3>();
export function assertOwnedCylinderFaceFiniteCylindersPartition3(input:CylinderFaceFiniteCylindersPartition3):void {if(!multiOwned.has(input))throw new RangeError('Expected a factory-created finite-cylinder wall arrangement');}
/** Append arbitrary oriented plane cuts after all finite-cylinder cap columns.
 * The extra planes subdivide source faces; they do not clip or create a solid. */
export function partitionCylinderFaceByFiniteCylinders3(input:PreparedCylinderFace3,definitions:readonly PlanarFiniteCylinderCut3[],additionalPlanes:readonly Plane3[]=[]):CylinderFaceFiniteCylindersPartition3 {
 if(!definitions.length)throw new RangeError('At least one finite cylinder is required');
 const cutters=Object.freeze(definitions.map(c=>prepareCylinderFace3(c.cylinder,c.lower,c.upper)));let current:CylinderFaceRefinementInput3=partitionCylinderFaceByCylinder3(input,cutters[0]!.surface);
 for(const c of cutters.slice(1))current=refineCylinderFaceCells3(current,{kind:'cylinder',cylinder:c.surface});
 for(const c of cutters){const d=c.surface.axis.direction,o=c.surface.axis.origin,D=dot3(d,d);for(const t of [c.lower,c.upper])current=refineCylinderFaceCells3(current,{kind:'plane',plane:plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg())});}
 // Extra columns follow all finite-cylinder caps; do not relabel their material.
 for(const p of additionalPlanes)current=refineCylinderFaceCells3(current,{kind:'plane',plane:p});
 const partition=current as CylinderFaceRefinement3;assertOwnedCylinderFaceRefinement3(partition);
 const materialLocations=Object.freeze(partition.cells.map((_,i)=>Object.freeze(cutters.map((_,j):CurveRegionLocation2=>{const signs=partition.planeSides[i]!,radial=partition.cylinderSides[i]![j]!,lo=signs[2*j]!,hi=signs[2*j+1]!;return radial>0||lo<0||hi>0?'outside':radial===0||lo===0||hi===0?'boundary':'inside';})))),result=Object.freeze({cutters,partition,materialLocations});multiOwned.add(result);return result;
}
