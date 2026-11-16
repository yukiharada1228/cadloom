import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {assertOwnedNurbsSectionArc3,splitNurbsSectionArc3,nurbsSectionArcPoint3} from './nurbs-section-arc3.js';
import type {NurbsSectionArc3} from './nurbs-section-arc3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';

export interface NurbsSectionArcDomainPartition3 {
 readonly source:NurbsSectionArc3;readonly domain:PreparedNurbsParameterDomain2;
 /** Every closed endpoint/event, including isolated boundary-only contacts. */
 readonly vertices:readonly Readonly<{parameter:AlgebraicReal;u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;location:NurbsDomainLocation2}>[];
 /** Complete positive-width partition in traversal order. Location applies to
  * the OPEN interior; endpoints have their own classifications above. */
 readonly pieces:readonly Readonly<{arc:NurbsSectionArc3;location:NurbsDomainLocation2}>[];
}
const real=(x:Parameters<typeof AlgebraicReal.fromRational>[0])=>AlgebraicReal.fromRational(x);
/** Exact partition against validated rational NURBS parameter-space boundaries.
 * Ignores caller-provided locate/sample claims; this is not spatial embedding. */
export function partitionNurbsSectionArcByDomain3(arc:NurbsSectionArc3,input:PreparedNurbsParameterDomain2):NurbsSectionArcDomainPartition3 {
 assertOwnedNurbsSectionArc3(arc);const domain=prepareNurbsParameterDomain2(input.outer,input.holes,input.sense),topology=arc.section.pieces[arc.piece]!.topology,cuts:AlgebraicReal[]=[arc.lower,arc.upper];
 const add=(u:AlgebraicReal,v:AlgebraicReal)=>{
  const parameter=arc.coordinate==='u'?u:v;if(parameter.compare(arc.lower)<0||parameter.compare(arc.upper)>0||cuts.some(t=>t.compare(parameter)===0))return;
  const on=evaluateAlgebraicCurveEdge2(topology,arc.edge,parameter);if(on.u.compare(u)===0&&on.v.compare(v)===0)cuts.push(parameter);
 };
 for(const curve of [domain.outer,...domain.holes].flat())for(const span of nurbsCurveSpans3(curve)){
  const f=nurbsParameterPolynomial3(topology.polynomial,span),lo=real(span.startParameter),hi=real(span.endParameter),parameters=f.degree<0?[lo,hi]:isolateRealRoots(f).filter(t=>t.compare(lo)>=0&&t.compare(hi)<=0);
  for(const t of parameters){const point=evaluateNurbsSpanPoint3(span,t);add(point.x,point.y);}
 }
 cuts.sort((a,b)=>a.compare(b));const vertices=cuts.map(parameter=>{const q=evaluateAlgebraicCurveEdge2(topology,arc.edge,parameter);return Object.freeze({parameter,u:q.u,v:q.v,point:nurbsSectionArcPoint3(arc,parameter),location:domain.locate(q.u,q.v)});});
 if(arc.direction===-1)vertices.reverse();
 const pieces=splitNurbsSectionArc3(arc,cuts).map(piece=>{const mid=piece.lower.add(piece.upper).div(real(2n)),q=evaluateAlgebraicCurveEdge2(topology,arc.edge,mid);return Object.freeze({arc:piece,location:domain.locate(q.u,q.v)});});
 return Object.freeze({source:arc,domain,vertices:Object.freeze(vertices),pieces:Object.freeze(pieces)});
}
