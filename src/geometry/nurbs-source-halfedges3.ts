import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {assertOwnedNurbsSourceBoundaryComplex3} from './nurbs-source-boundary-complex3.js';
import type {NurbsSourceBoundaryComplex3} from './nurbs-source-boundary-complex3.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {refinedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-refine3.js';
export interface NurbsSourceHalfedge3 {readonly edge:number;readonly direction:1|-1;readonly from:number;readonly to:number;readonly twin:number;}
interface HalfedgeBase3 {readonly source:NurbsSourceBoundaryComplex3;readonly halfedges:readonly NurbsSourceHalfedge3[];}
export type NurbsSourceHalfedges3=
 | Readonly<HalfedgeBase3&{kind:'unresolved';vertices:readonly Readonly<{vertex:number;halfedges:readonly number[]}>[];}>
 | Readonly<HalfedgeBase3&{kind:'ordered';rotation:readonly (readonly number[])[];next:readonly number[];cycles:readonly (readonly number[])[];}>;
const owned=new WeakSet<NurbsSourceHalfedges3>();
export function assertOwnedNurbsSourceHalfedges3(source:NurbsSourceHalfedges3):void {if(!owned.has(source))throw new RangeError('Expected factory-created source halfedges');}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Counterclockwise germs in source UV, using common exact u-fibers rather
 * than floating angles or tangent-only sorting. Same-fiber ties stay unresolved.
 * Cycles are boundary walks, not classified faces or spatial BRep certificates. */
export function buildNurbsSourceHalfedges3(source:NurbsSourceBoundaryComplex3):NurbsSourceHalfedges3 {
 assertOwnedNurbsSourceBoundaryComplex3(source);
 const halfedges=Object.freeze(source.edges.flatMap((e,edge)=>[Object.freeze({edge,direction:1 as const,from:e.from,to:e.to,twin:2*edge+1}),Object.freeze({edge,direction:-1 as const,from:e.to,to:e.from,twin:2*edge})])),out=source.vertices.map(()=>[] as number[]);halfedges.forEach((h,id)=>out[h.from]!.push(id));
 const unresolved:{vertex:number;halfedges:readonly number[]}[]=[],rotation:(readonly number[])[]=[];
 for(const [vertex,ids] of out.entries()){
  const p=source.vertices[vertex]!,groups=new Map<number,number>(),xs=new Map<number,number>();
  for(const id of ids){const q=source.vertices[halfedges[id]!.to]!,x=q.u.compare(p.u),y=q.v.compare(p.v);if(x===0&&y===0)throw new Error('Positive monotone UV atom has coincident endpoints');xs.set(id,x);groups.set(id,x>0?y===0?0:y>0?1:7:x<0?y===0?4:y>0?3:5:y>0?2:6);}
  const heights=new Map<number,AlgebraicReal>();
  for(const sign of [1,-1]){
   const candidates=ids.filter(id=>xs.get(id)===sign);if(!candidates.length)continue;
   const bounds=source.vertices.map(q=>q.u).filter(u=>u.compare(p.u)===sign).sort((a,b)=>a.compare(b)*sign),bound=bounds[0]!;
   const u=AlgebraicReal.fromRational(sign===1?between(p.u,bound):between(bound,p.u));
   for(const id of candidates){const e=source.edges[halfedges[id]!.edge]!,b=e.boundaryUses[0];
    if(b){const old=source.sharing.boundary.edges[b.edge]!,domain=source.sharing.boundary.domain,c=[domain.outer,...domain.holes][old.ring]![old.curve]!,span=nurbsCurveSpans3(c).find(s=>s.index===old.span)!,ts=nurbsBoundaryCoordinateRoots3(span,'x',u)?.filter(t=>t.compare(b.lower)>=0&&t.compare(b.upper)<=0);if(!ts||ts.length!==1)throw new Error('Monotone boundary germ lost unique u preimage');heights.set(id,evaluateNurbsSpanPoint3(span,ts[0]!).y);}
    else{const use=e.intersectionUses[0];if(!use)throw new Error('UV edge has no geometry use');heights.set(id,refinedNurbsAffineIntersectionEdgePoint3(source.source,use.edge,u).v);}
   }
  }
  let tied=false;
  const compare=(a:number,b:number)=>{const g=groups.get(a)!-groups.get(b)!;if(g)return g;const sign=xs.get(a)!;if(sign===0||groups.get(a)===0||groups.get(a)===4)return 0;return heights.get(a)!.compare(heights.get(b)!)*sign;};
  const sorted=ids.slice().sort(compare);for(let i=1;i<sorted.length;i++)if(compare(sorted[i-1]!,sorted[i]!)===0)tied=true;
  if(tied)unresolved.push(Object.freeze({vertex,halfedges:Object.freeze(ids.slice())}));rotation.push(Object.freeze(sorted));
 }
 if(unresolved.length){const result=Object.freeze({source,halfedges,kind:'unresolved' as const,vertices:Object.freeze(unresolved)});owned.add(result);return result;}
 const next=halfedges.map(h=>{const r=rotation[h.to]!,i=r.indexOf(h.twin);if(i<0)throw new Error('Missing outgoing twin');return r[(i+r.length-1)%r.length]!;}),seen=new Set<number>(),cycles:number[][]=[];
 for(let id=0;id<halfedges.length;id++)if(!seen.has(id)){const cycle:number[]=[];let h=id;while(!seen.has(h)){seen.add(h);cycle.push(h);h=next[h]!;}if(h!==id)throw new Error('Halfedge successor is not a disjoint cycle permutation');cycles.push(cycle);}
 const result=Object.freeze({source,halfedges,kind:'ordered' as const,rotation:Object.freeze(rotation),next:Object.freeze(next),cycles:Object.freeze(cycles.map(c=>Object.freeze(c)))});owned.add(result);return result;
}
