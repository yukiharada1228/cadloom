import {assertOwnedMaterialSurfaceBoundary3} from '../geometry/material-surface-boundary3.js';
import type {MaterialSurfaceBoundary3} from '../geometry/material-surface-boundary3.js';
import {bodyRecordFromMixedTopology3} from './body3.js';
import {encodePlanarCurveCellDomain3,encodeRefinedCylinderCellDomain3} from './mixed-face-domain3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
/** Export exact reconstructible domains. Caller region labels are not a proof
 * of shell nesting or solid validity; restoration binds complete face edges. */
export function bodyRecordFromMaterialSurfaceBoundary3(input:MaterialSurfaceBoundary3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
 assertOwnedMaterialSurfaceBoundary3(input);
 const raw=bodyRecordFromMixedTopology3(input.sewn.topology,regions);
 return readBodyRecord3({...raw,faces:raw.faces.map((face,i)=>{
  const origin=input.faceOrigins[i]!;
  if(origin.kind==='plane'){
   const classification=input.planar.supports[origin.support]!.refinement.classification,entry=classification.cells[origin.cell]!;
   if(entry.kind!=='classified'||entry.orientation===null)throw new Error('Selected planar face has no material orientation');
   return {...face,domain:encodePlanarCurveCellDomain3(classification.source,origin.cell,entry.orientation)};
  }
  const classification=input.cylindrical.walls[origin.cylinder]!.source,entry=classification.cells[origin.cell]!;
  if(entry.orientation===null||entry.owner!==origin.cylinder)throw new Error('Selected cylinder face lacks material ownership');
  return {...face,domain:encodeRefinedCylinderCellDomain3(classification.source.partition,origin.cell,entry.orientation)};
 })});
}
