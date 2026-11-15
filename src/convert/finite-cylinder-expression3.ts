import {assertOwnedFiniteCylinderExpressionBoundary3} from '../geometry/finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3} from '../geometry/finite-cylinder-expression3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {encodeRefinedCylinderCellDomain3,encodePlanarMultiCellDomain3} from './mixed-face-domain3.js';
/** Export exact selected face domains. Region declarations are supplied by the
 * caller; this does not infer shell nesting or certify an owned material Body. */
export function bodyRecordFromFiniteCylinderExpression3(input:FiniteCylinderExpressionBoundary3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedFiniteCylinderExpressionBoundary3(input);const raw=bodyRecordFromMixedTopology3(input.sewn.topology,regions);
 return readBodyRecord3({...raw,faces:raw.faces.map((face,i)=>{const s=input.faces[i]!.source,part=input.partitions[s.operand]!,domain=s.face===0?encodeRefinedCylinderCellDomain3(part.wall.partition,s.cell,s.orientation):encodePlanarMultiCellDomain3(part.caps[s.face-1]!.partition,s.cell,s.orientation);return {...face,domain};})});
}
