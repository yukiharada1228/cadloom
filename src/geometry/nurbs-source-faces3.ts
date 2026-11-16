import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {bivariateFiberRoots} from '../numeric/bivariate-system.js';
import {assertOwnedNurbsSourceHalfedges3} from './nurbs-source-halfedges3.js';
import type {NurbsSourceHalfedges3} from './nurbs-source-halfedges3.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {refinedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-refine3.js';
type Ordered=Extract<NurbsSourceHalfedges3,{kind:'ordered'}>;
export interface NurbsSourceFace3 {
 readonly cycles:readonly number[];readonly outerCycles:readonly number[];readonly holeCycles:readonly number[];readonly wireCycles:readonly number[];
 readonly sample:Readonly<{u:Rational;v:Rational}>;readonly location:'inside'|'outside';readonly unbounded:boolean;
}
export type NurbsSourceFaces3=
 | Readonly<{kind:'unresolved';source:NurbsSourceHalfedges3;reason:'branch-order'|'fiber-collision'}>
 | Readonly<{kind:'classified';source:Ordered;faces:readonly NurbsSourceFace3[];cycleFaces:readonly number[];halfedgeFaces:readonly number[];windings:readonly (readonly number[])[]}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
class FiberCollision extends Error {}
/** Group left-side boundary walks by exact winding signatures. Face samples
 * and trim membership are in source UV, not material or spatial certificates. */
export function classifyNurbsSourceFaces3(source:NurbsSourceHalfedges3):NurbsSourceFaces3 {
 assertOwnedNurbsSourceHalfedges3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'branch-order'});
 const c=source.source,R=c.source,boundary=c.sharing.boundary,cache=new Map<string,readonly Readonly<{edge:number;value:AlgebraicReal}>[]>();
 const fiber=(axis:'u'|'v',coordinate:Rational)=>{
  const key=axis+':'+coordinate.toString(),prior=cache.get(key);if(prior)return prior;const at=AlgebraicReal.fromRational(coordinate),hits:{edge:number;value:AlgebraicReal}[]=[];
  for(const [edge,e] of c.edges.entries()){
   const a=c.vertices[e.from]![axis],b=c.vertices[e.to]![axis];if(a.compare(b)===0||at.compare(a)*at.compare(b)>=0)continue;
   const use=e.boundaryUses[0];let values:AlgebraicReal[]=[];
   if(use){const old=boundary.edges[use.edge]!,curve=[boundary.domain.outer,...boundary.domain.holes][old.ring]![old.curve]!,span=nurbsCurveSpans3(curve).find(s=>s.index===old.span)!,ts=nurbsBoundaryCoordinateRoots3(span,axis==='u'?'x':'y',at);if(ts===null)throw new FiberCollision();values=ts.filter(t=>t.compare(use.lower)>0&&t.compare(use.upper)<0).map(t=>{const q=evaluateNurbsSpanPoint3(span,t);return axis==='u'?q.y:q.x;});}
   else{const u=e.intersectionUses[0]!;
    if(axis==='u')values=[refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,at).v];
    else{const re=R.edges[u.edge]!,old=R.source.edges[re.sourceEdge]!,tp=R.source.source.patches[old.uses[0]!.patch]!,te=tp.edges[old.uses[0]!.edge]!,raw=R.source.source.source.patches[tp.sourceIntersectionPatch]!.edges[te.sourceEdge]!;
     if(raw.graph.edges[raw.sourceEdge]!.kind==='vertical')values=[refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,at).u];
     else{const roots=bivariateFiberRoots(raw.graph.nonvertical.transpose(),at);if(roots.kind==='whole')throw new FiberCollision();for(const x of roots.roots)if(x.compare(u.lower)>0&&x.compare(u.upper)<0){const q=refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,x);if(q.v.compare(at)===0)values.push(q.u);}}
    }
   }
   if(values.length!==1)throw new FiberCollision();hits.push({edge,value:values[0]!});
  }
  hits.sort((a,b)=>a.value.compare(b.value));if(hits.some((v,i)=>i>0&&v.value.compare(hits[i-1]!.value)===0))throw new FiberCollision();const result=Object.freeze(hits.map(h=>Object.freeze(h)));cache.set(key,result);return result;
 };
 try{
  const cycleOf=source.halfedges.map(()=>-1);source.cycles.forEach((ids,i)=>ids.forEach(h=>cycleOf[h]=i));
  const samples=source.cycles.map(ids=>{
   const id=ids.find(h=>cycleOf[source.halfedges[h]!.twin]!==cycleOf[h])??ids[0]!,h=source.halfedges[id]!,a=c.vertices[h.from]!,b=c.vertices[h.to]!,axis=a.u.compare(b.u)!==0?'u' as const:'v' as const,lo=a[axis].compare(b[axis])<0?a[axis]:b[axis],hi=a[axis].compare(b[axis])<0?b[axis]:a[axis],cuts=[lo,hi,...c.vertices.map(v=>v[axis]).filter(x=>x.compare(lo)>0&&x.compare(hi)<0)].sort((x,y)=>x.compare(y)),coordinate=between(cuts[0]!,cuts.find(x=>x.compare(cuts[0]!)>0)!),hits=fiber(axis,coordinate),index=hits.findIndex(x=>x.edge===h.edge);if(index<0)throw new FiberCollision();
   const increasing=b[axis].compare(a[axis])>0,above=axis==='u'?increasing:!increasing,value=hits[index]!.value,neighbor=hits[index+(above?1:-1)]?.value,other=neighbor?above?between(value,neighbor):between(neighbor,value):above?value.upper.add(new Rational(1n)):value.lower.sub(new Rational(1n));
   return {axis,coordinate,other,point:Object.freeze(axis==='u'?{u:coordinate,v:other}:{u:other,v:coordinate})};
  });
  const windings=samples.map(sample=>{const hits=fiber(sample.axis,sample.coordinate),at=AlgebraicReal.fromRational(sample.other),right=new Set(hits.filter(h=>h.value.compare(at)>0).map(h=>h.edge));return source.cycles.map(ids=>ids.reduce((sum,id)=>{const h=source.halfedges[id]!;if(!right.has(h.edge))return sum;const e=c.edges[h.edge]!,sign=c.vertices[e.to]![sample.axis].compare(c.vertices[e.from]![sample.axis])*h.direction;return sum+(sample.axis==='v'?sign:-sign);},0));});
  const faces:{cycles:number[];outerCycles:number[];holeCycles:number[];wireCycles:number[];sample:Readonly<{u:Rational;v:Rational}>;location:'inside'|'outside';unbounded:boolean}[]=[],keys=new Map<string,number>(),cycleFaces:number[]=[];
  source.cycles.forEach((ids,i)=>{const w=windings[i]!,key=w.join(','),point=samples[i]!.point,location=boundary.domain.locate(point.u,point.v);if(location==='boundary')throw new FiberCollision();let face=keys.get(key);if(face===undefined){face=faces.length;keys.set(key,face);faces.push({cycles:[],outerCycles:[],holeCycles:[],wireCycles:[],sample:point,location,unbounded:w.every(v=>v===0)});}const f=faces[face]!;if(f.location!==location)throw new FiberCollision();f.cycles.push(i);cycleFaces.push(face);
   const h=ids.find(h=>cycleOf[source.halfedges[h]!.twin]!==i),left=w[i]!,right=h===undefined?left:windings[cycleOf[source.halfedges[h]!.twin]!]![i]!;
   (left>0?f.outerCycles:right<0?f.holeCycles:f.wireCycles).push(i);
  });
  return Object.freeze({kind:'classified',source,faces:Object.freeze(faces.map(f=>Object.freeze({...f,cycles:Object.freeze(f.cycles),outerCycles:Object.freeze(f.outerCycles),holeCycles:Object.freeze(f.holeCycles),wireCycles:Object.freeze(f.wireCycles)}))),cycleFaces:Object.freeze(cycleFaces),halfedgeFaces:Object.freeze(cycleOf.map(i=>cycleFaces[i]!)),windings:Object.freeze(windings.map(w=>Object.freeze(w)))});
 }catch(error){if(error instanceof FiberCollision)return Object.freeze({kind:'unresolved',source,reason:'fiber-collision'});throw error;}
}
