import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {assertOwnedAlgebraicCurveTopology2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
/** Internal parameter-space batching primitive. The caller validates the trim
 * geometry. No spatial embedding or report ownership is conferred here. */
export function partitionValidatedNurbsDomainGraphEdge2(topology:AlgebraicCurveTopology2,edge:number,lower:AlgebraicReal,upper:AlgebraicReal,domain:PreparedNurbsParameterDomain2){
 assertOwnedAlgebraicCurveTopology2(topology);if(!Number.isSafeInteger(edge)||edge<0||edge>=topology.edges.length)throw new RangeError('Invalid graph edge');
 const e=topology.edges[edge]!,axis=e.kind==='branch'?'u':'v',a=topology.vertices[e.from]![axis],b=topology.vertices[e.to]![axis];if(lower.compare(upper)>=0||lower.compare(a)<0||upper.compare(b)>0)throw new RangeError('Invalid finite graph interval');const cuts=[lower,upper];
 for(const curve of [domain.outer,...domain.holes].flat())for(const span of nurbsCurveSpans3(curve)){
  const f=nurbsParameterPolynomial3(topology.polynomial,span),lo=AlgebraicReal.fromRational(span.startParameter),hi=AlgebraicReal.fromRational(span.endParameter),parameters=f.degree<0?[lo,hi]:isolateRealRoots(f).filter(t=>t.compare(lo)>=0&&t.compare(hi)<=0);
  for(const t of parameters){const q=evaluateNurbsSpanPoint3(span,t),parameter=axis==='u'?q.x:q.y;if(parameter.compare(lower)<0||parameter.compare(upper)>0||cuts.some(p=>p.compare(parameter)===0))continue;const on=evaluateAlgebraicCurveEdge2(topology,edge,parameter);if(on.u.compare(q.x)===0&&on.v.compare(q.y)===0)cuts.push(parameter);}
 }
 cuts.sort((a,b)=>a.compare(b));const vertices=cuts.map(parameter=>{const q=evaluateAlgebraicCurveEdge2(topology,edge,parameter);return Object.freeze({parameter,...q,location:domain.locate(q.u,q.v)});});
 const pieces=cuts.slice(0,-1).map((lower,i)=>{const upper=cuts[i+1]!,q=evaluateAlgebraicCurveEdge2(topology,edge,lower.add(upper).div(AlgebraicReal.fromRational(2n))),location:NurbsDomainLocation2=domain.locate(q.u,q.v);return Object.freeze({lower,upper,location});});
 return Object.freeze({vertices:Object.freeze(vertices),pieces:Object.freeze(pieces)});
}
