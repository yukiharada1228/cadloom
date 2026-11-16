import {assertOwnedNurbsSourcePlaneCells3} from './nurbs-source-plane-cells3.js';
import type {NurbsSourcePlaneCells3} from './nurbs-source-plane-cells3.js';
import {nurbsSourcePlaneCellBoundary3,nurbsSourcePlaneCellBoundaryPoint3} from './nurbs-source-plane-cell-boundary3.js';
import type {NurbsSourcePlaneCellBoundary3,NurbsSourcePlaneCellBoundaryEdge3} from './nurbs-source-plane-cell-boundary3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Use=Readonly<{cell:number;edge:number;direction:1|-1}>;
export interface NurbsSourcePlaneCellComplex3 {
 readonly source:Extract<NurbsSourcePlaneCells3,{kind:'partitioned'}>;
 readonly boundaries:readonly NurbsSourcePlaneCellBoundary3[];
 readonly vertices:readonly Readonly<{graph:NurbsSourcePlaneCellBoundary3['source']['graphs'][number];point:NurbsSourcePlaneCellBoundary3['vertices'][number]}>[];
 readonly edges:readonly Readonly<{from:number;to:number;boundary:number;edge:number;lower:AlgebraicReal;upper:AlgebraicReal;uses:readonly Use[]}>[];
 readonly cells:readonly (readonly Readonly<{edge:number;direction:1|-1}>[])[];
 /** Edge-connected equal-sign regions, including noded patch-grid seams.
  * cycles=null preserves a non-simple boundary incidence without guessing. */
 readonly regions:readonly Readonly<{sign:-1|0|1;cells:readonly number[];boundary:readonly Readonly<{edge:number;direction:1|-1}>[];cycles:readonly (readonly Readonly<{edge:number;direction:1|-1}>[])[]|null}>[];
}
const owned=new WeakSet<NurbsSourcePlaneCellComplex3>();
function samePath(a:NurbsSourcePlaneCellBoundaryEdge3,b:NurbsSourcePlaneCellBoundaryEdge3):boolean {
 const x=a.path,y=b.path;
 if(x.kind!==y.kind)return false;
 return x.kind==='curve'?y.kind==='curve'&&x.edge===y.edge:x.kind==='u'?y.kind==='u'&&x.u.compare(y.u)===0:y.kind==='v'&&x.v.compare(y.v)===0;
}
/** Exact incidence and same-sign seam cancellation. Constant-coordinate seams
 * are noded across patch graphs; other curves require original branch identity. */
export function buildNurbsSourcePlaneCellComplex3(source:NurbsSourcePlaneCells3):NurbsSourcePlaneCellComplex3 {
 assertOwnedNurbsSourcePlaneCells3(source);if(source.kind!=='partitioned')throw new RangeError('Plane cell partition is unresolved');
 const boundaries=source.cells.map((_,i)=>nurbsSourcePlaneCellBoundary3(source,i)),vertices:{graph:NurbsSourcePlaneCellComplex3['vertices'][number]['graph'];point:NurbsSourcePlaneCellBoundary3['vertices'][number]}[]=[],edges:{from:number;to:number;boundary:number;edge:number;lower:AlgebraicReal;upper:AlgebraicReal;uses:Use[]}[]=[],cells:{edge:number;direction:1|-1}[][]=[];
 const endpoints=boundaries.flatMap(b=>b.vertices);
 for(const [cell,b] of boundaries.entries()){
  const graph=source.cells[cell]!.graph,add=(point:NurbsSourcePlaneCellBoundary3['vertices'][number])=>{const old=vertices.findIndex(v=>v.point.u.compare(point.u)===0&&v.point.v.compare(point.v)===0);if(old>=0){if(compareAlgebraicPoints3(vertices[old]!.point.point,point.point)!==0)throw new Error('Patch seam lost spatial continuity');return old;}vertices.push({graph,point});return vertices.length-1;};
  const uses:{edge:number;direction:1|-1}[]=[];
  for(const [local,e] of b.edges.entries()){
   const path=e.path,cuts=[e.lower,e.upper];
   if(path.kind!=='curve')for(const q of endpoints){const on=path.kind==='u'?q.u.compare(path.u)===0:q.v.compare(path.v)===0,t=path.kind==='u'?q.v:q.u;if(on&&t.compare(e.lower)>0&&t.compare(e.upper)<0&&!cuts.some(x=>x.compare(t)===0))cuts.push(t);}
   cuts.sort((a,b)=>a.compare(b));const pieces=cuts.slice(0,-1).map((lower,i)=>({lower,upper:cuts[i+1]!}));if(e.direction===-1)pieces.reverse();
   for(const {lower,upper} of pieces){
    const from=add(nurbsSourcePlaneCellBoundaryPoint3(b,local,lower)),to=add(nurbsSourcePlaneCellBoundaryPoint3(b,local,upper));
    let edge=edges.findIndex(x=>x.from===from&&x.to===to&&x.lower.compare(lower)===0&&x.upper.compare(upper)===0&&(path.kind!=='curve'||source.cells[x.boundary]!.graph===graph)&&samePath(boundaries[x.boundary]!.edges[x.edge]!,e));
    if(edge<0){edge=edges.length;edges.push({from,to,boundary:cell,edge:local,lower,upper,uses:[]});}
    const entry=edges[edge]!;if(entry.uses.length>=2||entry.uses.some(u=>u.direction===e.direction||u.cell===cell))throw new Error('Plane cells have inconsistent shared-edge incidence');
    entry.uses.push(Object.freeze({cell,edge:local,direction:e.direction}));uses.push(Object.freeze({edge,direction:e.direction}));
   }
  }
  for(let i=0;i<uses.length;i++){const a=uses[i]!,b=uses[(i+1)%uses.length]!,x=edges[a.edge]!,y=edges[b.edge]!;if((a.direction===1?x.to:x.from)!==(b.direction===1?y.from:y.to))throw new Error('Noded patch cell boundary failed to close');}
  cells.push(uses);
 }
 const neighbors=source.cells.map(()=>[] as number[]);
 for(const e of edges)if(e.uses.length===2){const [a,b]=e.uses;if(source.cells[a!.cell]!.sign===source.cells[b!.cell]!.sign){neighbors[a!.cell]!.push(b!.cell);neighbors[b!.cell]!.push(a!.cell);}}
 const seen=new Set<number>(),regions:NurbsSourcePlaneCellComplex3['regions'][number][]=[];
 for(let root=0;root<cells.length;root++)if(!seen.has(root)){
  const todo=[root],members:number[]=[];seen.add(root);while(todo.length){const c=todo.pop()!;members.push(c);for(const n of neighbors[c]!)if(!seen.has(n)){seen.add(n);todo.push(n);}}
  members.sort((a,b)=>a-b);const inside=new Set(members),boundary=members.flatMap(c=>cells[c]!.filter(u=>edges[u.edge]!.uses.filter(v=>inside.has(v.cell)).length===1));
  const ends=(u:typeof boundary[number])=>{const e=edges[u.edge]!;return u.direction===1?[e.from,e.to] as const:[e.to,e.from] as const;};
  const outgoing=new Map<number,number[]>(),incoming=new Map<number,number[]>();boundary.forEach((u,i)=>{const [a,b]=ends(u);outgoing.set(a,[...(outgoing.get(a)??[]),i]);incoming.set(b,[...(incoming.get(b)??[]),i]);});
  let cycles:typeof boundary[]|null=[];
  if([...new Set([...outgoing.keys(),...incoming.keys()])].some(v=>outgoing.get(v)?.length!==1||incoming.get(v)?.length!==1))cycles=null;
  else {const used=new Set<number>();for(let start=0;start<boundary.length;start++)if(!used.has(start)){const cycle:typeof boundary=[];let i=start;do{if(used.has(i))throw new Error('Region boundary walk failed');used.add(i);const u=boundary[i]!;cycle.push(u);i=outgoing.get(ends(u)[1])![0]!;}while(i!==start);cycles.push(cycle);}}
  regions.push(Object.freeze({sign:source.cells[root]!.sign,cells:Object.freeze(members),boundary:Object.freeze(boundary),cycles:cycles===null?null:Object.freeze(cycles.map(c=>Object.freeze(c)))}));
 }
 const result=Object.freeze({source,boundaries:Object.freeze(boundaries),vertices:Object.freeze(vertices.map(v=>Object.freeze(v))),edges:Object.freeze(edges.map(e=>Object.freeze({...e,uses:Object.freeze(e.uses)}))),cells:Object.freeze(cells.map(c=>Object.freeze(c))),regions:Object.freeze(regions)});owned.add(result);return result;
}
export function nurbsSourcePlaneCellComplexEdgePoint3(complex:NurbsSourcePlaneCellComplex3,edge:number,input:AlgebraicReal|ExactInput):NurbsSourcePlaneCellBoundary3['vertices'][number] {
 if(!owned.has(complex))throw new RangeError('Expected factory-created plane cell complex');
 if(!Number.isSafeInteger(edge)||edge<0||edge>=complex.edges.length)throw new RangeError('Invalid cell complex edge');
 const e=complex.edges[edge]!,t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);
 if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the cell complex edge');
 return nurbsSourcePlaneCellBoundaryPoint3(complex.boundaries[e.boundary]!,e.edge,t);
}
