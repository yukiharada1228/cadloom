import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {evaluateNurbsSourceComplexEdge3} from './nurbs-source-face-complex3.js';
import {assertOwnedNurbsSourceBRep3} from './nurbs-source-brep3.js';
import type {NurbsSourceBRep3} from './nurbs-source-brep3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsSpan3} from './nurbs-curve3.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import {composeNurbsSurfaceBoundarySpan3} from './nurbs-surface-boundary3.js';
export interface NurbsSourceBoundaryMap3 {readonly span:NurbsSpan3;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly direction:1|-1;}
/** Internal exact rational map extraction. SSI branches without a supported rational
 * map remain unresolved, never replaced by their endpoint chord. */
export function nurbsSourceBoundaryMap3(input:NurbsSourceBRep3,edge:number):NurbsSourceBoundaryMap3|null {
 assertOwnedNurbsSourceBRep3(input);if(!Number.isSafeInteger(edge)||edge<0||edge>=input.complex.edges.length)throw new RangeError('Invalid source boundary edge');
 const complex=input.complex,q=complex.edges[edge]!,L=complex.source.source,c=L.source.source.source,e=c.edges[q.sourceEdge]!,patch=L.patches[q.uses[0]!.patch]!,boundary=e.boundaryUses[0];let result:NurbsSourceBoundaryMap3;
 if(boundary){
  const B=c.sharing.boundary,b=B.edges[boundary.edge]!,curve=[B.domain.outer,...B.domain.holes][b.ring]![b.curve]!,span=nurbsCurveSpans3(curve).find(s=>s.index===b.span)!,axis=L.edges[q.sourceEdge]!.axis;
  const inverse=(value:AlgebraicReal)=>{const roots=nurbsBoundaryCoordinateRoots3(span,axis==='u'?'x':'y',value);if(roots===null)throw new Error('Boundary map lost its nonconstant coordinate');const hits=roots.filter(t=>t.compare(boundary.lower)>=0&&t.compare(boundary.upper)<=0);if(hits.length!==1)throw new Error('Boundary map lost unique native parameter');return hits[0]!;};
  const a=inverse(q.lower),z=inverse(q.upper),direction=a.compare(z)<0?1:-1,lower=direction===1?a:z,upper=direction===1?z:a,p=composeNurbsSurfaceBoundarySpan3(patch,span,lower,upper);
  result=Object.freeze({span:Object.freeze({index:0,startParameter:span.startParameter,endParameter:span.endParameter,x:p.x,y:p.y,z:p.z,weight:p.weight}),lower,upper,direction});
 }else{
  const edgeLift=L.edges[q.sourceEdge]!,a=edgeLift.events[q.sourcePiece]!,z=edgeLift.events[q.sourcePiece+1]!,constantU=a.u.compare(z.u)===0,constantV=a.v.compare(z.v)===0;if(!constantU&&!constantV)return null;
  const fixed=(constantU?a.u:a.v).recognizeRational().rational;if(fixed===null)return null;
  const R=c.source,use=e.intersectionUses[0]!,old=R.source.edges[R.edges[use.edge]!.sourceEdge]!,u=old.uses[0]!,p=R.source.source.patches[u.patch]!,t=p.edges[u.edge]!,raw=R.source.source.source.patches[p.sourceIntersectionPatch]!.edges[t.sourceEdge]!,f=raw.graph.polynomial;
  if((constantU?f.specializeU(fixed):f.specializeV(fixed)).degree>=0)return null;
  let lo=q.lower,hi=q.upper;while(lo.upper.compare(hi.lower)>=0){lo=lo.refine();hi=hi.refine();}const sample=evaluateNurbsSourceComplexEdge3(complex,edge,0,AlgebraicReal.fromRational(lo.upper.add(hi.lower).div(new Rational(2n))));if((constantU?sample.u:sample.v).compare(AlgebraicReal.fromRational(fixed))!==0)return null;
  // The whole line factor plus membership in this crossing-free selected
  // graph branch establishes the full UV interval, not merely its endpoints.
  const at=(key:'x'|'y'|'z'|'weight')=>constantU?patch[key].specializeU(fixed):patch[key].specializeV(fixed);
  result=Object.freeze({span:Object.freeze({index:0,startParameter:constantU?patch.startV:patch.startU,endParameter:constantU?patch.endV:patch.endU,x:at('x'),y:at('y'),z:at('z'),weight:at('weight')}),lower:q.lower,upper:q.upper,direction:1});
 }
 const a=evaluateNurbsSpanPoint3(result.span,result.direction===1?result.lower:result.upper),z=evaluateNurbsSpanPoint3(result.span,result.direction===1?result.upper:result.lower);if(compareAlgebraicPoints3(a,complex.vertices[q.from]!.point)!==0||compareAlgebraicPoints3(z,complex.vertices[q.to]!.point)!==0)throw new Error('Rational boundary extraction lost selected patch endpoints');return result;
}
