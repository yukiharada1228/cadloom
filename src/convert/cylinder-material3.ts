import {assertOwnedCylinderMaterialBoundary3} from '../geometry/cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from '../geometry/cylinder-material-expression3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {encodeRefinedCylinderCellDomain3,encodePlanarMultiCellDomain3} from './mixed-face-domain3.js';
/** Exact boundary/domain export; caller region labels are not material proofs. */
export function bodyRecordFromCylinderMaterial3(input:CylinderMaterialBoundary3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedCylinderMaterialBoundary3(input);const raw=bodyRecordFromMixedTopology3(input.sewn.topology,regions);return readBodyRecord3({...raw,faces:raw.faces.map((face,i)=>{const f=input.faces[i]!,o=f.origin;if(o.kind==='halfspace')return {...face,domain:encodePlanarMultiCellDomain3(input.planePartitions[o.halfspace]!.partition,o.cell,f.orientation)};const p=input.partitions[o.cylinder]!;return {...face,domain:o.face===0?encodeRefinedCylinderCellDomain3(p.wall.partition,o.cell,f.orientation):encodePlanarMultiCellDomain3(p.caps[o.face-1]!.partition,o.cell,f.orientation)};})});
}
