import {assertOwnedClippedCylinderExpression3} from '../geometry/clipped-cylinder-expression3.js';
import type {ClippedCylinderExpression3} from '../geometry/clipped-cylinder-expression3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {encodeRefinedCylinderCellDomain3,encodePlanarMultiCellDomain3} from './mixed-face-domain3.js';
/** Full bounded-face persistence; supplied regions remain declarations only. */
export function bodyRecordFromClippedCylinderExpression3(input:ClippedCylinderExpression3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedClippedCylinderExpression3(input);const raw=bodyRecordFromMixedTopology3(input.sewn.topology,regions);return readBodyRecord3({...raw,faces:raw.faces.map((face,i)=>{const o=input.faces[i]!.origin;if(o.kind==='cut'){const section=input.sections[o.cut]!,patch=section.patches[o.patch]!;return {...face,domain:encodePlanarMultiCellDomain3(section.partition.partition,patch.cell)};}const direction=input.source.faces[o.parentFace]!.source.orientation;return {...face,domain:o.kind==='wall'?encodeRefinedCylinderCellDomain3(input.walls[o.operand]!,o.cell,direction):encodePlanarMultiCellDomain3(input.caps[o.operand]![o.cap]!.partition,o.cell,direction)};})});
}
