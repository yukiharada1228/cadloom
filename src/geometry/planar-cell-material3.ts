import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Surface3} from './surface3.js';
import {assertOwnedCylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3,CylinderMaterialExpression3} from './cylinder-material-expression3.js';
import type {PlanarFaceCurvePartition3} from './planar-face-cylinder-partition3.js';
import {classifyPlanarPartitionSurfaces3} from './planar-cell-surface3.js';
import type {PlanarCellSurfaceClassification3,PlanarPartitionSurfaceClassification3} from './planar-cell-surface3.js';

export type PlanarCellMaterialClassification3=
 | {readonly kind:'unresolved';readonly cuts:readonly Extract<PlanarCellSurfaceClassification3,{kind:'cut'}>[]}
 | {readonly kind:'classified';readonly minus:boolean;readonly plus:boolean;readonly orientation:1|-1|null};
export interface PlanarPartitionMaterialClassification3 {
 readonly source:PlanarFaceCurvePartition3;readonly material:CylinderMaterialBoundary3;
 readonly supports:PlanarPartitionSurfaceClassification3;
 readonly cells:readonly PlanarCellMaterialClassification3[];
}
function truth(t:CylinderMaterialExpression3,c:readonly boolean[],p:readonly boolean[]):boolean {
 if(t.kind==='cylinder')return c[t.cylinder]!;
 if(t.kind==='halfspace')return p[t.halfspace]!;
 const a=truth(t.first,c,p),b=truth(t.second,c,p);
 switch(t.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}
}
/** Evaluate material on both normal sides only after every primitive support
 * has been certified on the whole open cell. Unsplit zeros remain unresolved.
 * Orientation is relative to the input face normal; null means no boundary.
 * This selects cells, not a sewn, embedded or adopted solid.
 */
export function classifyPlanarPartitionMaterial3(source:PlanarFaceCurvePartition3,material:CylinderMaterialBoundary3):PlanarPartitionMaterialClassification3 {
 assertOwnedCylinderMaterialBoundary3(material);
 const surfaces:Surface3[]=[];
 for(const c of material.cylinders){
  const d=c.cylinder.axis.direction,o=c.cylinder.axis.origin,D=dot3(d,d);
  surfaces.push({kind:'cylinder',cylinder:c.cylinder});
  for(const t of [c.lower,c.upper])surfaces.push({kind:'plane',plane:plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg())});
 }
 surfaces.push(...material.planes.map(plane=>({kind:'plane' as const,plane})));
 const supports=classifyPlanarPartitionSurfaces3(source,surfaces);
 const cells=Object.freeze(supports.cells.map((row):PlanarCellMaterialClassification3=>{
  const cuts=row.filter((e):e is Extract<PlanarCellSurfaceClassification3,{kind:'cut'}>=>e.kind==='cut');
  if(cuts.length)return Object.freeze({kind:'unresolved',cuts:Object.freeze(cuts)});
  const side=(i:number,direction:'minus'|'plus')=>{const e=row[i]!;if(e.kind==='cut')throw new Error('Unexpected unclassified support');return e.sides[direction];};
  const evaluate=(direction:'minus'|'plus')=>truth(material.expression,material.cylinders.map((_,i)=>side(3*i,direction)<0&&side(3*i+1,direction)>0&&side(3*i+2,direction)<0),material.planes.map((_,i)=>side(3*material.cylinders.length+i,direction)<0));
  const minus=evaluate('minus'),plus=evaluate('plus');
  return Object.freeze({kind:'classified',minus,plus,orientation:minus===plus?null:minus?1:-1});
 }));
 return Object.freeze({source,material,supports,cells});
}
