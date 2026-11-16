import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {assertOwnedNurbsSourcePlaneCells3} from './nurbs-source-plane-cells3.js';
import type {NurbsSourcePlaneCells3} from './nurbs-source-plane-cells3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import type {NurbsSourceComplexFacePoint3} from './nurbs-source-complex-face-query3.js';
type Point=Extract<NurbsSourceComplexFacePoint3,{kind:'point'}>;
export interface NurbsSourcePlaneCellBoundaryEdge3 {
 readonly from:number;readonly to:number;readonly direction:1|-1;
 readonly side:'lower'|'right'|'upper'|'left';
 readonly path:Readonly<{kind:'curve';edge:number}|{kind:'u';u:AlgebraicReal}|{kind:'v';v:AlgebraicReal}>;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
}
export interface NurbsSourcePlaneCellBoundary3 {
 readonly source:Extract<NurbsSourcePlaneCells3,{kind:'partitioned'}>;readonly cell:number;
 readonly vertices:readonly Point[];
 /** Ordered boundary with positive UV orientation. Collapsed sides are omitted. */
 readonly edges:readonly NurbsSourcePlaneCellBoundaryEdge3[];
}
const owned=new WeakSet<NurbsSourcePlaneCellBoundary3>();
const real=(q:AlgebraicReal|ExactInput)=>q instanceof AlgebraicReal?q:AlgebraicReal.fromRational(q);
function point(source:Extract<NurbsSourcePlaneCells3,{kind:'partitioned'}>,cell:number,u:AlgebraicReal,v:AlgebraicReal):Point {
 const q=evaluateNurbsSourceComplexFace3(source.complex,source.face,u,v),patch=source.cells[cell]!.patch;
 if(q.kind!=='point'||!q.images.some(x=>x.patch===patch))throw new Error('Closed cell boundary lost finite-face membership');
 const sign=AlgebraicReal.linearCombination([{value:q.point.x,coefficient:source.plane.normal.x},{value:q.point.y,coefficient:source.plane.normal.y},{value:q.point.z,coefficient:source.plane.normal.z}],source.plane.offset).sign();
 if(sign!==0&&sign!==source.cells[cell]!.sign)throw new Error('Closed cell boundary changed plane side');
 if(source.restriction!==null){const old=locateNurbsPlaneSplitFaceParameters3(source.restriction,u,v);if(old.kind!=='located'||old.location==='outside')throw new Error('Closed refinement cell left its prior finite region');}
 return q;
}
/** Close one open strip, splitting its event sides at every arrangement vertex.
 * Artificial seams remain; this does not adopt or globally sew BRep faces. */
export function nurbsSourcePlaneCellBoundary3(source:NurbsSourcePlaneCells3,cell:number):NurbsSourcePlaneCellBoundary3 {
 assertOwnedNurbsSourcePlaneCells3(source);
 if(source.kind!=='partitioned')throw new RangeError('Plane cell partition is unresolved');
 if(!Number.isSafeInteger(cell)||cell<0||cell>=source.cells.length)throw new RangeError('Invalid plane cell');
 const c=source.cells[cell]!,g=c.graph,s=g.slabs[c.slab]!,left=g.events[s.leftEvent]!,right=g.events[s.rightEvent]!;
 const vertices:Point[]=[],edges:NurbsSourcePlaneCellBoundaryEdge3[]=[];
 const add=(u:AlgebraicReal,v:AlgebraicReal)=>{const old=vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0);if(old>=0)return old;vertices.push(point(source,cell,u,v));return vertices.length-1;};
 const at=(edge:number|null,u:AlgebraicReal,upper:boolean)=>edge===null?{u,v:real(upper?g.bounds.vMax:g.bounds.vMin)}:evaluateAlgebraicCurveEdge2(g,edge,u);
 const lowerLeft=at(c.lowerEdge,left.u,false),lowerRight=at(c.lowerEdge,right.u,false),upperLeft=at(c.upperEdge,left.u,true),upperRight=at(c.upperEdge,right.u,true);
 const append=(side:NurbsSourcePlaneCellBoundaryEdge3['side'],path:NurbsSourcePlaneCellBoundaryEdge3['path'],a:{u:AlgebraicReal;v:AlgebraicReal},b:{u:AlgebraicReal;v:AlgebraicReal},direction:1|-1)=>{
  const axis=path.kind==='u'?'v':'u',lo=a[axis],hi=b[axis];if(lo.compare(hi)===0)return;if(lo.compare(hi)>0)throw new Error('Cell boundary interval reversed');
  const from=add(direction===1?a.u:b.u,direction===1?a.v:b.v),to=add(direction===1?b.u:a.u,direction===1?b.v:a.v);
  edges.push(Object.freeze({side,path:Object.freeze(path),from,to,direction,lower:lo,upper:hi}));
 };
 const vertical=(side:'left'|'right',event:typeof left,a:typeof lowerLeft,b:typeof upperLeft,direction:1|-1)=>{
  const cuts=[a.v,b.v,...event.vertices.map(id=>g.vertices[id]!.v).filter(v=>v.compare(a.v)>0&&v.compare(b.v)<0)].sort((x,y)=>x.compare(y)).filter((v,i,all)=>i===0||v.compare(all[i-1]!)!==0);
  const intervals=cuts.slice(0,-1).map((v,i)=>[v,cuts[i+1]!] as const);if(direction===-1)intervals.reverse();
  for(const [lo,hi] of intervals)append(side,{kind:'u',u:event.u},{u:event.u,v:lo},{u:event.u,v:hi},direction);
 };
 append('lower',c.lowerEdge===null?{kind:'v',v:real(g.bounds.vMin)}:{kind:'curve',edge:c.lowerEdge},lowerLeft,lowerRight,1);
 vertical('right',right,lowerRight,upperRight,1);
 append('upper',c.upperEdge===null?{kind:'v',v:real(g.bounds.vMax)}:{kind:'curve',edge:c.upperEdge},upperLeft,upperRight,-1);
 vertical('left',left,lowerLeft,upperLeft,-1);
 if(!edges.length||edges.some((e,i)=>e.to!==edges[(i+1)%edges.length]!.from))throw new Error('Cell boundary failed to close');
 const result=Object.freeze({source,cell,vertices:Object.freeze(vertices),edges:Object.freeze(edges)});owned.add(result);return result;
}
export function nurbsSourcePlaneCellBoundaryPoint3(boundary:NurbsSourcePlaneCellBoundary3,edge:number,input:AlgebraicReal|ExactInput):Point {
 if(!owned.has(boundary))throw new RangeError('Expected factory-created cell boundary');
 if(!Number.isSafeInteger(edge)||edge<0||edge>=boundary.edges.length)throw new RangeError('Invalid cell boundary edge');
 const e=boundary.edges[edge]!,t=real(input);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the cell boundary edge');
 const path=e.path,g=boundary.source.cells[boundary.cell]!.graph,q=path.kind==='curve'?evaluateAlgebraicCurveEdge2(g,path.edge,t):path.kind==='u'?{u:path.u,v:t}:{u:t,v:path.v};
 return point(boundary.source,boundary.cell,q.u,q.v);
}
