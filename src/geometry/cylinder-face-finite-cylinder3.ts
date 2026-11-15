import type {ExactInput} from './point2.js';
import {dot3} from './point3.js';
import {plane3} from './plane3.js';
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
