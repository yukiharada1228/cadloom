import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {nodeNurbsIntersectionBoundary3,nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import type {NurbsIntersectionBoundaryNodes3} from './nurbs-intersection-boundary-nodes3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
import {refinedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-refine3.js';
import type {RefinedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-refine3.js';
export interface NurbsSourceBoundarySharedInterval3 {
 readonly boundaryEdge:number;readonly intersectionEdge:number;
 /** Increasing native boundary-curve parameters, with traversal unchanged. */
 readonly boundaryLower:AlgebraicReal;readonly boundaryUpper:AlgebraicReal;
 readonly intersectionLower:AlgebraicReal;readonly intersectionUpper:AlgebraicReal;
 readonly direction:1|-1;
}
export interface NurbsSourceBoundarySharing3 {readonly boundary:NurbsIntersectionBoundaryNodes3;readonly intervals:readonly NurbsSourceBoundarySharedInterval3[];}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Exact source-UV finite interval sharing. A whole-span polynomial identity,
 * monotone coordinate ranges and selected-branch membership are all required.
 * Endpoint or midpoint agreement alone never establishes coincidence. */
export function matchNurbsIntersectionSourceBoundary3(source:RefinedNurbsAffineIntersectionComplex3):NurbsSourceBoundarySharing3 {
 const boundary=nodeNurbsIntersectionBoundary3(source,'source'),intervals:NurbsSourceBoundarySharedInterval3[]=[],trim=source.source.source,raw=trim.source;
 for(const [boundaryEdge,b] of boundary.edges.entries()){
  const c=[boundary.domain.outer,...boundary.domain.holes][b.ring]![b.curve]!,span=nurbsCurveSpans3(c).find(s=>s.index===b.span)!,start=boundary.vertices[b.from]!,end=boundary.vertices[b.to]!;
  for(const [intersectionEdge,e] of source.edges.entries()){
   const use=e.uses[0]!,patch=trim.patches[use.patch]!,old=patch.edges[use.edge]!,original=raw.patches[patch.sourceIntersectionPatch]!.edges[old.sourceEdge]!,graph=original.graph,vertical=graph.edges[original.sourceEdge]!.kind==='vertical',key=vertical?'y':'x',axis=vertical?'v':'u';
   if(vertical){const u=graph.vertices[graph.edges[original.sourceEdge]!.from]!.u;if(nurbsBoundaryCoordinateRoots3(span,'x',u)!==null)continue;}
   else if(nurbsParameterPolynomial3(graph.nonvertical,span).degree>=0)continue;
   const a=start[axis],z=end[axis],direction=a.compare(z)<0?1:-1;if(a.compare(z)===0)continue;
   const lo=direction===1?a:z,hi=direction===1?z:a,lower=lo.compare(e.lower)>0?lo:e.lower,upper=hi.compare(e.upper)<0?hi:e.upper;if(lower.compare(upper)>=0)continue;
   const preimage=(value:AlgebraicReal)=>{const ts=nurbsBoundaryCoordinateRoots3(span,key,value);if(ts===null)throw new Error('Nonconstant boundary atom has a whole coordinate fiber');const candidates=ts.filter(t=>t.compare(b.lower)>=0&&t.compare(b.upper)<=0);if(candidates.length!==1)throw new Error('Boundary atom lost monotone coordinate uniqueness');return candidates[0]!;};
   const first=preimage(lower),last=preimage(upper),boundaryLower=first.compare(last)<0?first:last,boundaryUpper=first.compare(last)<0?last:first,sample=evaluateNurbsSpanPoint3(span,AlgebraicReal.fromRational(between(boundaryLower,boundaryUpper))),t=axis==='u'?sample.x:sample.y,selected=refinedNurbsAffineIntersectionEdgePoint3(source,intersectionEdge,t);
   if(sample.x.compare(selected.u)!==0||sample.y.compare(selected.v)!==0)continue;
   // The graph has no branch crossings inside an edge. The identity and
   // monotone coordinate bounds therefore select this same entire interval.
   for(const parameter of [boundaryLower,boundaryUpper]){const q=evaluateNurbsSpanPoint3(span,parameter),p=refinedNurbsAffineIntersectionEdgePoint3(source,intersectionEdge,axis==='u'?q.x:q.y);if(q.x.compare(p.u)!==0||q.y.compare(p.v)!==0)throw new Error('Shared boundary interval lost a closed endpoint');}
   intervals.push(Object.freeze({boundaryEdge,intersectionEdge,boundaryLower,boundaryUpper,intersectionLower:lower,intersectionUpper:upper,direction}));
  }
 }
 return Object.freeze({boundary,intervals:Object.freeze(intervals)});
}
