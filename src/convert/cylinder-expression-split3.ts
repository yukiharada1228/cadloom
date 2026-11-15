import {assertOwnedCylinderExpressionPlaneSplit3} from '../geometry/cylinder-expression-plane-split3.js';
import type {CylinderExpressionPlaneSplit3} from '../geometry/cylinder-expression-plane-split3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {encodeRefinedCylinderCellDomain3,encodePlanarMultiCellDomain3} from './mixed-face-domain3.js';
/** Export one owned split boundary with complete replayable bounded face domains.
 * Caller-supplied regions are declarations, not inferred solid/nesting proofs. */
export function bodyRecordFromCylinderExpressionSplit3(input:CylinderExpressionPlaneSplit3,side:-1|1,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedCylinderExpressionPlaneSplit3(input);if(side!==-1&&side!==1)throw new RangeError('Split child side must be -1 or 1');const child=side===-1?input.negative:input.positive,raw=bodyRecordFromMixedTopology3(child.sewn.topology,regions);
 return readBodyRecord3({...raw,faces:raw.faces.map((face,i)=>{
  const origin=child.faces[i]!.origin;
  if(origin.kind==='section'){const patch=input.section.patches[origin.patch]!,domain=encodePlanarMultiCellDomain3(input.section.partition.partition,patch.cell,side===-1?1:-1);return {...face,domain};}
  const parent=input.source.faces[origin.parentFace]!,orientation=parent.source.orientation,domain=origin.kind==='wall'?encodeRefinedCylinderCellDomain3(input.walls[origin.operand]!,origin.cell,orientation):encodePlanarMultiCellDomain3(input.caps[origin.operand]![origin.cap]!.partition,origin.cell,orientation);return {...face,domain};
 })});
}
