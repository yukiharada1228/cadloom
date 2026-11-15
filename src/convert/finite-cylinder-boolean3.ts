import {assertOwnedFiniteCylinderBoolean3} from '../geometry/finite-cylinder-boolean3.js';
import type {FiniteCylinderBoolean3} from '../geometry/finite-cylinder-boolean3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {encodeCylinderCellDomain3,encodePlanarCellDomain3} from './mixed-face-domain3.js';
/** Preserve every selected constructive face domain; region roles remain
 * caller declarations, not inferred shell nesting or a material certificate. */
export function bodyRecordFromFiniteCylinderBoolean3(input:FiniteCylinderBoolean3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedFiniteCylinderBoolean3(input);const record=bodyRecordFromMixedTopology3(input.sewn.topology,regions);
 return readBodyRecord3({...record,faces:record.faces.map((f,i)=>{const s=input.faces[i]!.source,p=input.partitions[s.operand],domain=s.face===0?encodeCylinderCellDomain3(p.wall.partition,s.cell,s.orientation):encodePlanarCellDomain3(p.caps[s.face-1]!.partition,s.cell,s.orientation);return {...f,domain};})});
}
