import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsCurve3,nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsCurve3,NurbsSpan3} from './nurbs-curve3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';

export interface NurbsCurvePairPoint3 {
  readonly firstParameter:AlgebraicReal;readonly secondParameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
}
export interface NurbsCurveIntersectionPoint3 extends NurbsCurvePairPoint3 {
  readonly branches:readonly {readonly firstSpan:number;readonly secondSpan:number}[];
}
export interface NurbsCurveParameterRelation3 {
  readonly firstSpan:number;readonly secondSpan:number;
  /** u is the first parameter, v the second. May contain isolated vertices or
   * be a whole area for equal constant curves; not every relation is a spatial arc.
   */
  readonly topology:AlgebraicCurveTopology2;
}
export interface NurbsCurveIntersection3 {
  readonly first:NurbsCurve3;readonly second:NurbsCurve3;
  /** Isolated within at least one closed span pair, including isolated relation
   * vertices. Other relations may continue through the event. Different
   * parameter pairs at one spatial point stay distinct.
   */
  readonly points:readonly NurbsCurveIntersectionPoint3[];
  readonly relations:readonly NurbsCurveParameterRelation3[];
}
const owned=new WeakSet<NurbsCurveIntersection3>();
const real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
const outer=(a:Polynomial,b:Polynomial)=>new BivariatePolynomial(a.coefficients.map(x=>b.coefficients.map(y=>x.mul(y))));
function inSpan(t:AlgebraicReal,s:NurbsSpan3):boolean {return t.compare(real(s.startParameter))>=0&&t.compare(real(s.endParameter))<=0;}
export function nurbsSpanPairEquations3(a:NurbsSpan3,b:NurbsSpan3):readonly BivariatePolynomial[]{return (['x','y','z'] as const).map(k=>outer(a[k],b.weight).sub(outer(a.weight,b[k])));}
/** Complete intersections of closed span images, retaining parameter relations
 * for coincident arcs, constant curves and nonlinear reparameterizations.
 */
export function intersectNurbsCurves3(inputFirst:NurbsCurve3,inputSecond:NurbsCurve3):NurbsCurveIntersection3 {
  const first=nurbsCurve3(inputFirst.degree,inputFirst.controlPoints,inputFirst.knots,inputFirst.weights),second=nurbsCurve3(inputSecond.degree,inputSecond.controlPoints,inputSecond.knots,inputSecond.weights),points:{firstParameter:AlgebraicReal;secondParameter:AlgebraicReal;point:AlgebraicCoordinates3;branches:{firstSpan:number;secondSpan:number}[]}[]=[],relations:NurbsCurveParameterRelation3[]=[];
  for(const a of nurbsCurveSpans3(first))for(const b of nurbsCurveSpans3(second)){
    const result=solveBivariateEquations(nurbsSpanPairEquations3(a,b));
    const record=(p:{readonly u:AlgebraicReal;readonly v:AlgebraicReal})=>{
      if(!inSpan(p.u,a)||!inSpan(p.v,b))return;
      const point=evaluateNurbsSpanPoint3(a,p.u);let prior=points.find(q=>q.firstParameter.compare(p.u)===0&&q.secondParameter.compare(p.v)===0&&compareAlgebraicPoints3(q.point,point)===0);
      if(!prior){prior={firstParameter:p.u,secondParameter:p.v,point,branches:[]};points.push(prior);}prior.branches.push(Object.freeze({firstSpan:a.index,secondSpan:b.index}));
    };
    for(const p of result.points)record(p);
    if(result.kind!=='finite'){
      const topology=traceAlgebraicCurve2(result.commonFactor,{uMin:a.startParameter,uMax:a.endParameter,vMin:b.startParameter,vMax:b.endParameter});
      if(topology.kind==='area'||topology.vertices.length){
        relations.push(Object.freeze({firstSpan:a.index,secondSpan:b.index,topology}));
        topology.vertices.forEach((p,i)=>{if(!topology.edges.some(e=>e.from===i||e.to===i))record(p);});
      }
    }
  }
  points.sort((a,b)=>a.firstParameter.compare(b.firstParameter)||a.secondParameter.compare(b.secondParameter)||compareAlgebraicPoints3(a.point,b.point));
  const result=Object.freeze({first,second,points:Object.freeze(points.map(p=>Object.freeze({...p,branches:Object.freeze(p.branches)}))),relations:Object.freeze(relations)});owned.add(result);return result;
}
function relationAt(input:NurbsCurveIntersection3,relation:number):NurbsCurveParameterRelation3 {
  if(!owned.has(input))throw new RangeError('Curve relation evaluation requires a factory-created intersection');
  if(!Number.isSafeInteger(relation)||relation<0||relation>=input.relations.length)throw new RangeError('Invalid curve parameter relation');return input.relations[relation]!;
}
export function evaluateNurbsCurveRelation3(input:NurbsCurveIntersection3,relation:number,inputU:AlgebraicReal|ExactInput,inputV:AlgebraicReal|ExactInput):NurbsCurvePairPoint3 {
  const r=relationAt(input,relation),u=real(inputU),v=real(inputV),a=nurbsCurveSpans3(input.first).find(s=>s.index===r.firstSpan)!,b=nurbsCurveSpans3(input.second).find(s=>s.index===r.secondSpan)!;
  if(!inSpan(u,a)||!inSpan(v,b))throw new RangeError('Parameters are outside the relation rectangle');
  if(r.topology.polynomial.evaluateAlgebraic(u,v).sign()!==0)throw new RangeError('Parameters are not on the curve relation');
  return Object.freeze({firstParameter:u,secondParameter:v,point:evaluateNurbsSpanPoint3(a,u)});
}
/** Graph coordinate is u on a branch and v on a vertical relation edge. */
export function nurbsCurveRelationEdgePoint3(input:NurbsCurveIntersection3,relation:number,edge:number,parameter:AlgebraicReal|ExactInput):NurbsCurvePairPoint3 {
  const r=relationAt(input,relation),p=evaluateAlgebraicCurveEdge2(r.topology,edge,parameter);return evaluateNurbsCurveRelation3(input,relation,p.u,p.v);
}
