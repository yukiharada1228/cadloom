import {AlgebraicReal} from '../numeric/real-roots.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {matchNurbsIntersectionSourceBoundary3} from './nurbs-intersection-boundary-sharing3.js';
import type {NurbsSourceBoundarySharing3} from './nurbs-intersection-boundary-sharing3.js';
import {refinedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-refine3.js';
import type {RefinedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-refine3.js';
export interface NurbsSourceBoundaryComplexUse3 {readonly edge:number;readonly direction:1|-1;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;}
export interface NurbsSourceBoundaryComplex3 {
 readonly source:RefinedNurbsAffineIntersectionComplex3;readonly sharing:NurbsSourceBoundarySharing3;
 /** UV incidence only; spatial preimages and their use data remain in source. */
 readonly vertices:readonly Readonly<{u:AlgebraicReal;v:AlgebraicReal;intersectionVertices:readonly number[]}>[];
 readonly edges:readonly Readonly<{from:number;to:number;boundaryUses:readonly NurbsSourceBoundaryComplexUse3[];intersectionUses:readonly NurbsSourceBoundaryComplexUse3[]}>[];
 readonly boundaryEdges:readonly (readonly NurbsSourceBoundaryComplexUse3[])[];
 readonly intersectionEdges:readonly (readonly NurbsSourceBoundaryComplexUse3[])[];
 readonly rings:readonly (readonly Readonly<{edge:number;direction:1|-1}>[])[];
 readonly intersectionVertices:readonly number[];
}
const owned=new WeakSet<NurbsSourceBoundaryComplex3>();
export function assertOwnedNurbsSourceBoundaryComplex3(source:NurbsSourceBoundaryComplex3):void {if(!owned.has(source))throw new RangeError('Expected a factory-created source boundary complex');}
const sorted=(values:readonly AlgebraicReal[])=>values.slice().sort((a,b)=>a.compare(b)).filter((v,i,a)=>i===0||v.compare(a[i-1]!)!==0);
/** Common source-UV atoms with certified boundary/intersection sharing.
 * This builds incidence, not cyclic branch order, face loops or a spatial BRep. */
export function buildNurbsSourceBoundaryComplex3(source:RefinedNurbsAffineIntersectionComplex3):NurbsSourceBoundaryComplex3 {
 const sharing=matchNurbsIntersectionSourceBoundary3(source),boundary=sharing.boundary,vertices:{u:AlgebraicReal;v:AlgebraicReal;intersectionVertices:number[]}[]=[],edges:{from:number;to:number;boundaryUses:NurbsSourceBoundaryComplexUse3[];intersectionUses:NurbsSourceBoundaryComplexUse3[]}[]=[],boundaryEdges:NurbsSourceBoundaryComplexUse3[][]=[],intersectionEdges:NurbsSourceBoundaryComplexUse3[][]=[];
 const vertex=(u:AlgebraicReal,v:AlgebraicReal)=>{let id=vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0);if(id<0){id=vertices.length;vertices.push({u,v,intersectionVertices:[]});}return id;};
 const intersectionVertices=source.vertices.map((v,id)=>{const n=vertex(v.point.u,v.point.v);vertices[n]!.intersectionVertices.push(id);return n;});boundary.vertices.forEach(v=>vertex(v.u,v.v));
 for(const [id,b] of boundary.edges.entries()){
  const c=[boundary.domain.outer,...boundary.domain.holes][b.ring]![b.curve]!,span=nurbsCurveSpans3(c).find(s=>s.index===b.span)!,relations=sharing.intervals.filter(q=>q.boundaryEdge===id),cuts=sorted([b.lower,b.upper,...relations.flatMap(q=>[q.boundaryLower,q.boundaryUpper])]),uses:NurbsSourceBoundaryComplexUse3[]=[];
  for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!,a=evaluateNurbsSpanPoint3(span,lower),z=evaluateNurbsSpanPoint3(span,upper),edge=edges.length,use=Object.freeze({edge,direction:1 as const,lower,upper});edges.push({from:vertex(a.x,a.y),to:vertex(z.x,z.y),boundaryUses:[Object.freeze({...use,edge:id})],intersectionUses:[]});uses.push(use);}
  boundaryEdges.push(uses);
 }
 for(const [id,e] of source.edges.entries()){
  const old=source.source.edges[e.sourceEdge]!,p=source.source.source.patches[old.uses[0]!.patch]!,t=p.edges[old.uses[0]!.edge]!,raw=source.source.source.source.patches[p.sourceIntersectionPatch]!.edges[t.sourceEdge]!,axis=raw.graph.edges[raw.sourceEdge]!.kind==='vertical'?'v':'u',relations=sharing.intervals.filter(q=>q.intersectionEdge===id),cuts=[e.lower,e.upper,...relations.flatMap(q=>[q.intersectionLower,q.intersectionUpper])];
  // UV nodes, including boundary knots/extrema, must also node every selected
  // incident graph branch. Spatial use identities are deliberately not erased.
  for(const v of vertices){const parameter=v[axis];if(parameter.compare(e.lower)<=0||parameter.compare(e.upper)>=0)continue;const q=refinedNurbsAffineIntersectionEdgePoint3(source,id,parameter);if(q.u.compare(v.u)===0&&q.v.compare(v.v)===0)cuts.push(parameter);}
  const points=sorted(cuts),uses:NurbsSourceBoundaryComplexUse3[]=[];
  for(let i=0;i+1<points.length;i++){
   const lower=points[i]!,upper=points[i+1]!,a=refinedNurbsAffineIntersectionEdgePoint3(source,id,lower),z=refinedNurbsAffineIntersectionEdgePoint3(source,id,upper),from=vertex(a.u,a.v),to=vertex(z.u,z.v);let edge=-1,direction:1|-1=1;
   for(const relation of relations){if(lower.compare(relation.intersectionLower)<0||upper.compare(relation.intersectionUpper)>0)continue;
    for(const b of boundaryEdges[relation.boundaryEdge]!){if(b.lower.compare(relation.boundaryLower)<0||b.upper.compare(relation.boundaryUpper)>0)continue;const candidate=edges[b.edge]!;if(candidate.from===from&&candidate.to===to){edge=b.edge;direction=1;break;}if(candidate.from===to&&candidate.to===from){edge=b.edge;direction=-1;break;}}
    if(edge>=0)break;
   }
   if(edge<0&&relations.some(r=>lower.compare(r.intersectionLower)>=0&&upper.compare(r.intersectionUpper)<=0))throw new Error('Certified sharing lost common atom boundaries');
   if(edge<0){edge=edges.length;edges.push({from,to,boundaryUses:[],intersectionUses:[]});}
   const use=Object.freeze({edge,direction,lower,upper});edges[edge]!.intersectionUses.push(Object.freeze({...use,edge:id}));uses.push(use);
  }
  intersectionEdges.push(uses);
 }
 const rings=Object.freeze(boundary.rings.map(r=>Object.freeze(r.flatMap(id=>boundaryEdges[id]!.map(u=>Object.freeze({edge:u.edge,direction:u.direction}))))));
 for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i]!,b=ring[(i+1)%ring.length]!,A=edges[a.edge]!,B=edges[b.edge]!;if((a.direction===1?A.to:A.from)!==(b.direction===1?B.from:B.to))throw new Error('Common boundary atoms lost closed ring incidence');}
 const result=Object.freeze({source,sharing,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,intersectionVertices:Object.freeze(v.intersectionVertices)}))),edges:Object.freeze(edges.map(e=>Object.freeze({...e,boundaryUses:Object.freeze(e.boundaryUses),intersectionUses:Object.freeze(e.intersectionUses)}))),boundaryEdges:Object.freeze(boundaryEdges.map(u=>Object.freeze(u))),intersectionEdges:Object.freeze(intersectionEdges.map(u=>Object.freeze(u))),rings,intersectionVertices:Object.freeze(intersectionVertices)});owned.add(result);return result;
}
