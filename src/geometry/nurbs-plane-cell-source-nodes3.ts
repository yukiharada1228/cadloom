import {assertOwnedNurbsPlaneCellSourceEdges3} from './nurbs-plane-cell-source-edges3.js';
import type {NurbsPlaneCellSourceEdges3} from './nurbs-plane-cell-source-edges3.js';
import {nurbsSpanIntervalMatchParameters3} from './nurbs-span-interval-match3.js';
import {nurbsPlaneCellRationalMapPoint3} from './nurbs-plane-cell-rational-map3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
interface Use {readonly edge:number;readonly direction:1|-1;}
export interface NurbsPlaneCellSourceNodes3 {
 readonly kind:'noded';readonly source:NurbsPlaneCellSourceEdges3;
 readonly vertices:readonly Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;originalVertex:number|null;topologyVertex:number|null}>[];
 readonly edges:readonly Readonly<{parent:number;from:number;to:number;lower:AlgebraicReal;upper:AlgebraicReal;source:Readonly<{edge:number;lower:AlgebraicReal;upper:AlgebraicReal;direction:1|-1}>|null}>[];
 readonly sourceUses:readonly (readonly Use[])[];readonly cells:readonly (readonly Use[])[];
 readonly regions:readonly Readonly<{sign:-1|0|1;cells:readonly number[];boundary:readonly Use[];cycles:readonly (readonly Use[])[]|null}>[];
}
export type NurbsPlaneCellSourceNoding3=NurbsPlaneCellSourceNodes3|Readonly<{kind:'unresolved';source:NurbsPlaneCellSourceEdges3;reason:'unresolved-source-match'|'ambiguous-parameter';edge?:number}>;
const owned=new WeakSet<NurbsPlaneCellSourceNoding3>();
function own<T extends NurbsPlaneCellSourceNoding3>(report:T):T {owned.add(report);return report;}
export function assertOwnedNurbsPlaneCellSourceNoding3(report:NurbsPlaneCellSourceNoding3):void {if(!owned.has(report))throw new RangeError('Expected factory-created cell source noding');}
/** Insert every matched shared-edge fragment boundary into the cell loops.
 * Curves and native parameters are retained; this is not solid adoption. */
export function nodeNurbsPlaneCellSourceEdges3(source:NurbsPlaneCellSourceEdges3):NurbsPlaneCellSourceNoding3 {
 assertOwnedNurbsPlaneCellSourceEdges3(source);
 if(!source.allOriginalBoundariesMatched)return own(Object.freeze({kind:'unresolved',source,reason:'unresolved-source-match'}));
 const cells=source.vertices.cells,T=source.vertices.source.topology;
 const vertices:NurbsPlaneCellSourceNodes3['vertices'][number][]=cells.vertices.map((q,originalVertex)=>Object.freeze({u:q.point.u,v:q.point.v,point:q.point.point,originalVertex,topologyVertex:source.vertices.vertices[originalVertex]!.topologyVertex}));
 const add=(q:Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3}>)=>{
  const old=vertices.findIndex(v=>v.u.compare(q.u)===0&&v.v.compare(q.v)===0);
  if(old>=0){if(compareAlgebraicPoints3(vertices[old]!.point,q.point)!==0)throw new Error('Cell source noding lost spatial equality');return old;}
  const id=T.vertices.findIndex(p=>compareAlgebraicPoints3(p,q.point)===0);vertices.push(Object.freeze({u:q.u,v:q.v,point:q.point,originalVertex:null,topologyVertex:id<0?null:id}));return vertices.length-1;
 };
 const edges:NurbsPlaneCellSourceNodes3['edges'][number][]=[],sourceUses:Use[][]=[];
 for(const [parent,e] of cells.edges.entries()){
  const match=source.edges[parent]!,uses:Use[]=[];
  if(match.kind==='interior'){uses.push(Object.freeze({edge:edges.length,direction:1}));edges.push(Object.freeze({parent,from:e.from,to:e.to,lower:e.lower,upper:e.upper,source:null}));}
  else if(match.kind==='matched'){
   let cursor=e.lower,last=e.from;
   for(const fragment of match.fragments){
    const a=fragment.direction===1?fragment.lower:fragment.upper,b=fragment.direction===1?fragment.upper:fragment.lower;
    const first=nurbsSpanIntervalMatchParameters3(match.certificate,'second',a),second=nurbsSpanIntervalMatchParameters3(match.certificate,'second',b);
    if(first.length!==1||second.length!==1)return own(Object.freeze({kind:'unresolved',source,reason:'ambiguous-parameter',edge:parent}));
    const x=nurbsPlaneCellRationalMapPoint3(match.parameterization,first[0]!),y=nurbsPlaneCellRationalMapPoint3(match.parameterization,second[0]!);
    if(x.nativeParameter.compare(cursor)!==0||x.nativeParameter.compare(y.nativeParameter)>=0)throw new Error('Cell source noding lost ordered interval coverage');
    const from=add(x),to=add(y);if(from!==last)throw new Error('Cell source noding disconnected consecutive fragments');
    uses.push(Object.freeze({edge:edges.length,direction:1}));edges.push(Object.freeze({parent,from,to,lower:x.nativeParameter,upper:y.nativeParameter,source:fragment}));cursor=y.nativeParameter;last=to;
   }
   if(cursor.compare(e.upper)!==0||last!==e.to)throw new Error('Cell source noding lost its final endpoint');
  }else throw new Error('Unresolved source edge escaped the noding gate');
  sourceUses.push(uses);
 }
 const expand=(input:readonly Use[]):readonly Use[]=>Object.freeze(input.flatMap(u=>u.direction===1?sourceUses[u.edge]!:[...sourceUses[u.edge]!].reverse().map(c=>Object.freeze({edge:c.edge,direction:(-c.direction) as 1|-1}))));
 const audit=(loop:readonly Use[])=>{for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,x=edges[a.edge]!,y=edges[b.edge]!;if((a.direction===1?x.to:x.from)!==(b.direction===1?y.from:y.to))throw new Error('Noded cell loop is not closed');}};
 const loops=cells.cells.map(c=>{const q=expand(c);audit(q);return q;}),regions=cells.regions.map(r=>{const cycles=r.cycles?.map(c=>{const q=expand(c);audit(q);return q;})??null;return Object.freeze({...r,boundary:expand(r.boundary),cycles:cycles===null?null:Object.freeze(cycles)});});
 return own(Object.freeze({kind:'noded',source,vertices:Object.freeze(vertices),edges:Object.freeze(edges),sourceUses:Object.freeze(sourceUses.map(u=>Object.freeze(u))),cells:Object.freeze(loops),regions:Object.freeze(regions)}));
}
