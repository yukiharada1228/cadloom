import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {bivariateFiberRoots} from '../numeric/bivariate-system.js';
import type {BivariateRoot} from '../numeric/bivariate-system.js';
import {assertOwnedAlgebraicCurveTopology2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';
export interface AlgebraicCurveRectangle2 {readonly uMin:AlgebraicReal;readonly uMax:AlgebraicReal;readonly vMin:AlgebraicReal;readonly vMax:AlgebraicReal;}
export interface RestrictedAlgebraicCurve2 {
 readonly graph:AlgebraicCurveTopology2;readonly bounds:AlgebraicCurveRectangle2;
 readonly vertices:readonly BivariateRoot[];
 readonly edges:readonly Readonly<{sourceEdge:number;lower:AlgebraicReal;upper:AlgebraicReal;from:number;to:number}>[];
}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Internal closed restriction, retaining isolated contacts and boundary overlap.
 * Every open graph edge is partitioned at all four rectangle-side events. */
export function restrictAlgebraicCurveRectangle2(graph:AlgebraicCurveTopology2,bounds:AlgebraicCurveRectangle2):RestrictedAlgebraicCurve2 {
 assertOwnedAlgebraicCurveTopology2(graph);if(bounds.uMin.compare(bounds.uMax)>0||bounds.vMin.compare(bounds.vMax)>0)throw new RangeError('Invalid closed restriction rectangle');if(graph.kind==='area')throw new RangeError('Curve restriction requires a one-dimensional graph');
 const inside=(q:BivariateRoot)=>q.u.compare(bounds.uMin)>=0&&q.u.compare(bounds.uMax)<=0&&q.v.compare(bounds.vMin)>=0&&q.v.compare(bounds.vMax)<=0;
 const vertices:BivariateRoot[]=[],edges:RestrictedAlgebraicCurve2['edges'][number][]=[];
 const add=(q:BivariateRoot)=>{let id=vertices.findIndex(p=>p.u.compare(q.u)===0&&p.v.compare(q.v)===0);if(id<0){id=vertices.length;vertices.push(Object.freeze({u:q.u,v:q.v}));}return id;};
 graph.vertices.filter(inside).forEach(add);
 const horizontal=[bounds.vMin,bounds.vMax].map(v=>({v,roots:bivariateFiberRoots(graph.polynomial.transpose(),v)}));
 graph.edges.forEach((e,sourceEdge)=>{
  const axis=e.kind==='branch'?'u':'v',a=graph.vertices[e.from]![axis],b=graph.vertices[e.to]![axis],cuts=[a,b];
  const addCut=(t:AlgebraicReal)=>{if(t.compare(a)>0&&t.compare(b)<0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);};
  (axis==='u'?[bounds.uMin,bounds.uMax]:[bounds.vMin,bounds.vMax]).forEach(addCut);
  if(axis==='u')for(const h of horizontal)if(h.roots.kind==='finite')for(const u of h.roots.roots)if(u.compare(a)>0&&u.compare(b)<0&&evaluateAlgebraicCurveEdge2(graph,sourceEdge,u).v.compare(h.v)===0)addCut(u);
  // A whole horizontal fiber is a component. Other branches can only meet it
  // at the projection events already used as source graph endpoints.
  cuts.sort((a,b)=>a.compare(b));
  for(const t of cuts){const q=evaluateAlgebraicCurveEdge2(graph,sourceEdge,t);if(inside(q))add(q);}
  for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!;if(!inside(evaluateAlgebraicCurveEdge2(graph,sourceEdge,between(lower,upper))))continue;
   const start=evaluateAlgebraicCurveEdge2(graph,sourceEdge,lower),end=evaluateAlgebraicCurveEdge2(graph,sourceEdge,upper);if(!inside(start)||!inside(end))throw new Error('Closed rectangle restriction lost an endpoint');edges.push(Object.freeze({sourceEdge,lower,upper,from:add(start),to:add(end)}));
  }
 });
 return Object.freeze({graph,bounds:Object.freeze({...bounds}),vertices:Object.freeze(vertices),edges:Object.freeze(edges)});
}
