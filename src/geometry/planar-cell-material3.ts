import type {CylinderMaterialExpression3} from './cylinder-material-program3.js';
import {evaluateCylinderMaterialExpression3 as truth} from './material-expression-eval3.js';
import {dot3} from './point3.js';
import {plane3} from './plane3.js';
import type {Surface3} from './surface3.js';
import {resolveCylinderMaterialProgram3} from './cylinder-material-expression3.js';
import type {CylinderMaterialDefinition3} from './cylinder-material-expression3.js';
import type {PlanarFaceCurvePartition3} from './planar-face-cylinder-partition3.js';
import {classifyPlanarPartitionSurfaces3} from './planar-cell-surface3.js';
import type {PlanarCellSurfaceClassification3,PlanarPartitionSurfaceClassification3} from './planar-cell-surface3.js';

export type PlanarCellMaterialClassification3=
 | {readonly kind:'unresolved';readonly cuts:readonly Extract<PlanarCellSurfaceClassification3,{kind:'cut'}>[]}
 | {readonly kind:'classified';readonly minus:boolean;readonly plus:boolean;readonly orientation:1|-1|null};
export interface PlanarPartitionMaterialClassification3 {
 readonly source:PlanarFaceCurvePartition3;readonly material:CylinderMaterialDefinition3;
 readonly supports:PlanarPartitionSurfaceClassification3;
 readonly cells:readonly PlanarCellMaterialClassification3[];
}
const owned=new WeakSet<PlanarPartitionMaterialClassification3>();
export function assertOwnedPlanarPartitionMaterialClassification3(input:PlanarPartitionMaterialClassification3):void {
 if(!owned.has(input))throw new RangeError('Expected a factory-created planar material classification');
}
/** Evaluate material on both normal sides only after every primitive support
 * has been certified on the whole open cell. Unsplit zeros remain unresolved.
 * Orientation is relative to the input face normal; null means no boundary.
 * This selects cells, not a sewn, embedded or adopted solid.
 */
export function classifyPlanarPartitionMaterial3(source:PlanarFaceCurvePartition3,material:CylinderMaterialDefinition3):PlanarPartitionMaterialClassification3 {
 const program=resolveCylinderMaterialProgram3(material);
 const surfaces:Surface3[]=[];
 for(const c of program.cylinders){
  const d=c.cylinder.axis.direction,o=c.cylinder.axis.origin,D=dot3(d,d);
  surfaces.push({kind:'cylinder',cylinder:c.cylinder});
  for(const t of [c.lower,c.upper])surfaces.push({kind:'plane',plane:plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg())});
 }
 surfaces.push(...program.planes.map(plane=>({kind:'plane' as const,plane})));
 const supports=classifyPlanarPartitionSurfaces3(source,surfaces);
 const cells=Object.freeze(supports.cells.map((row):PlanarCellMaterialClassification3=>{
  const cuts=row.filter((e):e is Extract<PlanarCellSurfaceClassification3,{kind:'cut'}>=>e.kind==='cut');
  if(cuts.length){
   type Range=readonly [boolean,boolean];
   const evaluate=(direction:'minus'|'plus'):Range=>{
    const predicate=(i:number,negative:boolean):Range=>{const e=row[i]!;if(e.kind==='cut')return [false,true];const value=negative?e.sides[direction]<0:e.sides[direction]>0;return [value,value];};
    const and=(a:Range,b:Range):Range=>[a[0]&&b[0],a[1]&&b[1]];
    const cylinders=program.cylinders.map((_,i)=>and(and(predicate(3*i,true),predicate(3*i+1,false)),predicate(3*i+2,true))),planes=program.planes.map((_,i)=>predicate(3*program.cylinders.length+i,true));
    const walk=(t:CylinderMaterialExpression3):Range=>{
     if(t.kind==='cylinder')return cylinders[t.cylinder]!;if(t.kind==='halfspace')return planes[t.halfspace]!;
     const a=walk(t.first),b=walk(t.second);
     switch(t.kind){case 'union':return [a[0]||b[0],a[1]||b[1]];case 'intersection':return and(a,b);case 'difference':return [a[0]&&!b[1],a[1]&&!b[0]];case 'xor':return [a[0]&&!b[1]||!a[1]&&b[0],a[1]&&!b[0]||!a[0]&&b[1]];}
    };return walk(program.expression);
   };
   const minus=evaluate('minus'),plus=evaluate('plus');
   if(minus[0]===minus[1]&&plus[0]===plus[1])return Object.freeze({kind:'classified',minus:minus[0],plus:plus[0],orientation:minus[0]===plus[0]?null:minus[0]?1:-1});
   return Object.freeze({kind:'unresolved',cuts:Object.freeze(cuts)});
  }
  const side=(i:number,direction:'minus'|'plus')=>{const e=row[i]!;if(e.kind==='cut')throw new Error('Unexpected unclassified support');return e.sides[direction];};
  const evaluate=(direction:'minus'|'plus')=>truth(program.expression,program.cylinders.map((_,i)=>side(3*i,direction)<0&&side(3*i+1,direction)>0&&side(3*i+2,direction)<0),program.planes.map((_,i)=>side(3*program.cylinders.length+i,direction)<0));
  const minus=evaluate('minus'),plus=evaluate('plus');
  return Object.freeze({kind:'classified',minus,plus,orientation:minus===plus?null:minus?1:-1});
 }));
 const result=Object.freeze({source,material,supports,cells});owned.add(result);return result;
}
