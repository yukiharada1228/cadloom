import {assertOwnedPlanarPartitionMaterialClassification3,classifyPlanarPartitionMaterial3} from './planar-cell-material3.js';
import type {PlanarPartitionMaterialClassification3} from './planar-cell-material3.js';
import {partitionPlanarFaceByCurves3} from './planar-face-cylinder-partition3.js';
import {planarPartitionSupportCurves3} from './planar-cell-surface3.js';
import {surfacesCoincide3} from './surface3.js';

export interface RefinedPlanarMaterial3 {
 readonly source:PlanarPartitionMaterialClassification3;
 readonly classification:PlanarPartitionMaterialClassification3;
 /** New cell index -> original cell index. Identity when no refinement occurs. */
 readonly parentCells:readonly number[];
 /** Indexes in source.supports.surfaces; coincident supports are inserted once. */
 readonly addedSupports:readonly number[];
}
/** Insert complete missing support intersections, retaining all previous cut
 * curves, then reclassify. An unresolved result is an invariant error, never
 * silently accepted as a material boundary. Does not adopt a whole solid.
 */
export function refinePlanarMaterial3(source:PlanarPartitionMaterialClassification3):RefinedPlanarMaterial3 {
 assertOwnedPlanarPartitionMaterialClassification3(source);
 const surfaces=source.supports.surfaces,indices:number[]=[];
 source.supports.cells.forEach(row=>row.forEach((entry,i)=>{
  if(entry.kind==='cut'&&!indices.some(j=>surfacesCoincide3(surfaces[j]!,surfaces[i]!)))indices.push(i);
 }));
 indices.sort((a,b)=>a-b);
 if(!indices.length)return Object.freeze({source,classification:source,parentCells:Object.freeze(source.source.cells.map((_,i)=>i)),addedSupports:Object.freeze([])});
 const carriers=planarPartitionSupportCurves3(source.source,indices.map(i=>surfaces[i]!));
 const curves=carriers.flatMap(c=>c??[]);
 const partition=partitionPlanarFaceByCurves3(source.source.base,[...source.source.cutCurves,...curves]);
 const classification=classifyPlanarPartitionMaterial3(partition,source.material);
 if(classification.cells.some(c=>c.kind==='unresolved'))throw new Error('Complete planar support refinement left unresolved interior zeros');
 const parentCells=Object.freeze(partition.cells.map(cell=>{
  const parents=source.source.cells.flatMap((parent,i)=>parent.locate(cell.sample)==='inside'?[i]:[]);
  if(parents.length!==1)throw new Error('Refined planar cell lacks a unique original cell');
  return parents[0]!;
 }));
 return Object.freeze({source,classification,parentCells,addedSupports:Object.freeze(indices)});
}
