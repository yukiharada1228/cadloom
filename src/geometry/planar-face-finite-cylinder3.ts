import type {ExactInput} from './point2.js';
import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Cylinder3} from './surface3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {partitionPlanarFaceByCylinders3,partitionPlanarFaceByCylinder3} from './planar-face-cylinder-partition3.js';
import type {PlanarFaceCylinderPartition3} from './planar-face-cylinder-partition3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
export interface PlanarFaceFiniteCylinderPartition3 {
 readonly cutter:PreparedCylinderFace3;readonly partition:PlanarFaceCylinderPartition3;
 /** Locations of open planar cells in the filled finite cylinder; coplanar
  * cap patches remain boundary, not silently selected as material. */
 readonly materialLocations:readonly CurveRegionLocation2[];
}
const owned=new WeakSet<PlanarFaceFiniteCylinderPartition3>();
export function assertOwnedPlanarFaceFiniteCylinderPartition3(input:PlanarFaceFiniteCylinderPartition3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created finite-cylinder planar partition');}
/** Partition an owned native planar domain by the wall and both caps of a
 * filled finite cylinder. Includes cap-coincident boundary patches. Surface
 * domains only: does not assemble or certify a complete Boolean solid shell.
 */
export function partitionPlanarFaceByFiniteCylinder3(input:PreparedPlanarFace3,inputCutter:Cylinder3,lower:ExactInput,upper:ExactInput):PlanarFaceFiniteCylinderPartition3 {
 const cutter=prepareCylinderFace3(inputCutter,lower,upper),d=cutter.surface.axis.direction,o=cutter.surface.axis.origin,D=dot3(d,d),at=(t:typeof cutter.lower)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg()),partition=partitionPlanarFaceByCylinder3(input,cutter.surface,[at(cutter.lower),at(cutter.upper)]),materialLocations=Object.freeze(partition.cells.map((cell):CurveRegionLocation2=>{const signs=cell.planeSides;return signs[0]===-1||signs[1]===1||cell.side===1?'outside':signs[0]===0||signs[1]===0||cell.side===0?'boundary':'inside';})),result=Object.freeze({cutter,partition,materialLocations});owned.add(result);return result;
}

export interface PlanarFiniteCylinderCut3 {readonly cylinder:Cylinder3;readonly lower:ExactInput;readonly upper:ExactInput;}
export interface PlanarFaceFiniteCylindersPartition3 {
 readonly cutters:readonly PreparedCylinderFace3[];readonly partition:PlanarFaceCylinderPartition3;
 /** Row per open cell, column per finite cylinder in input order. */
 readonly materialLocations:readonly (readonly CurveRegionLocation2[])[];
}
const multiOwned=new WeakSet<PlanarFaceFiniteCylindersPartition3>();
export function assertOwnedPlanarFaceFiniteCylindersPartition3(input:PlanarFaceFiniteCylindersPartition3):void {if(!multiOwned.has(input))throw new RangeError('Expected a factory-created finite-cylinder arrangement');}
/** Simultaneously nodes every radial section and both cap planes of every
 * cutter. Labels open face cells only; no Boolean material is selected here. */
export function partitionPlanarFaceByFiniteCylinders3(input:PreparedPlanarFace3,definitions:readonly PlanarFiniteCylinderCut3[]):PlanarFaceFiniteCylindersPartition3 {
 const cutters=Object.freeze(definitions.map(c=>prepareCylinderFace3(c.cylinder,c.lower,c.upper))),planes=cutters.flatMap(c=>{const d=c.surface.axis.direction,o=c.surface.axis.origin,D=dot3(d,d),at=(t:typeof c.lower)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg());return [at(c.lower),at(c.upper)];}),partition=partitionPlanarFaceByCylinders3(input,cutters.map(c=>c.surface),planes),materialLocations=Object.freeze(partition.cells.map(cell=>Object.freeze(cutters.map((_,j):CurveRegionLocation2=>{const lo=cell.planeSides[2*j]!,hi=cell.planeSides[2*j+1]!,radial=cell.cylinderSides[j]!;return lo<0||hi>0||radial>0?'outside':lo===0||hi===0||radial===0?'boundary':'inside';})))),result=Object.freeze({cutters,partition,materialLocations});multiOwned.add(result);return result;
}
