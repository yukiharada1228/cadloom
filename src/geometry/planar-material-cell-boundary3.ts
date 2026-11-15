import {assertOwnedPlanarPartitionMaterialClassification3} from './planar-cell-material3.js';
import type {PlanarPartitionMaterialClassification3} from './planar-cell-material3.js';
import {reverseCurve3} from './curve3.js';
import {nativeBRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {MixedBRepFace3,SewnMixedBRep3} from './sew-mixed-brep3.js';

export interface PlanarMaterialCellBoundary3 {
 readonly source:PlanarPartitionMaterialClassification3;
 readonly faces:readonly MixedBRepFace3[];
 /** Output face index to the original planar partition cell index. */
 readonly sourceCells:readonly number[];
 readonly sewn:SewnMixedBRep3;
}
/** Keep and orient certified material boundary cells, then share their edges.
 * Any unresolved cell rejects the whole selection; no partial solid is adopted.
 * The selected planar faces may be an open part of a larger material boundary.
 */
export function boundaryPlanarMaterialCells3(source:PlanarPartitionMaterialClassification3):PlanarMaterialCellBoundary3 {
 assertOwnedPlanarPartitionMaterialClassification3(source);
 if(source.cells.some(c=>c.kind==='unresolved'))throw new RangeError('Planar material boundary requires all cells resolved');
 const {base,cells}=source.source,faces:MixedBRepFace3[]=[],sourceCells:number[]=[];
 source.cells.forEach((entry,i)=>{
  if(entry.kind!=='classified'||entry.orientation===null)return;
  const orientation=entry.orientation,cell=cells[i]!;
  const boundary=orientation===1?cell.boundary:[...cell.boundary].reverse().map(reverseCurve3);
  const sense=orientation===1?base.sense:base.sense===1?-1:1;
  faces.push(Object.freeze({surface:Object.freeze({kind:'plane',plane:base.surface}),sense,loops:Object.freeze([Object.freeze(boundary.map(nativeBRepCurve3))])}));
  sourceCells.push(i);
 });
 const sewn=sewMixedBRepFaces3(faces,{splitPoints:source.source.events});
 return Object.freeze({source,faces:Object.freeze(faces),sourceCells:Object.freeze(sourceCells),sewn});
}
