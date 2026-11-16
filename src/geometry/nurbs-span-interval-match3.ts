import {AlgebraicReal} from '../numeric/real-roots.js';
import {Polynomial,exactRational} from '../numeric/polynomial.js';
import {solveBivariateEquations,bivariateFiberRoots} from '../numeric/bivariate-system.js';
import {bivariateEquationBasis} from '../numeric/bivariate-equation-basis.js';
import {nurbsSpanPairEquations3} from './nurbs-curve-intersection3.js';
import {evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsSpan3} from './nurbs-curve3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {ExactInput} from './point2.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {restrictAlgebraicCurveRectangle2} from './algebraic-curve-rectangle2.js';
import type {RestrictedAlgebraicCurve2} from './algebraic-curve-rectangle2.js';
export interface NurbsSpanInterval3 {readonly span:NurbsSpan3;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;}
export interface NurbsSpanIntervalMatchCertificate3 {
 readonly first:NurbsSpanInterval3;readonly second:NurbsSpanInterval3;readonly direction:1|-1;
 readonly relation:RestrictedAlgebraicCurve2;
}
export type NurbsSpanIntervalMatch3=
 | Readonly<{kind:'matched';certificate:NurbsSpanIntervalMatchCertificate3}>
 | Readonly<{kind:'not-certified';reason:'finite-intersection'|'coverage-gap'|'orientation-conflict'}>;
const real=(q:AlgebraicReal|ExactInput)=>q instanceof AlgebraicReal?q:AlgebraicReal.fromRational(q),owned=new WeakSet<NurbsSpanIntervalMatchCertificate3>();
function snapshot(input:Readonly<{span:NurbsSpan3;lower:AlgebraicReal|ExactInput;upper:AlgebraicReal|ExactInput}>):NurbsSpanInterval3 {
 const p=input.span,span=Object.freeze({index:p.index,startParameter:exactRational(p.startParameter),endParameter:exactRational(p.endParameter),x:new Polynomial(p.x.coefficients),y:new Polynomial(p.y.coefficients),z:new Polynomial(p.z.coefficients),weight:new Polynomial(p.weight.coefficients)}),lower=real(input.lower),upper=real(input.upper);
 if(span.startParameter.compare(span.endParameter)>=0||lower.compare(upper)>=0||lower.compare(real(span.startParameter))<0||upper.compare(real(span.endParameter))>0)throw new RangeError('Invalid finite rational curve interval');
 if(span.weight.degree<0||(span.weight.degree>0&&AlgebraicReal.isolate(span.weight).some(t=>t.compare(lower)>=0&&t.compare(upper)<=0)))throw new RangeError('Curve weight vanishes in the finite interval');
 if(['x','y','z'].every(k=>{const N=span[k as 'x'|'y'|'z'],W=span.weight;return N.derivative().mul(W).sub(N.mul(W.derivative())).degree<0;}))throw new RangeError('Interval matching requires nonconstant curves');
 return Object.freeze({span,lower,upper});
}
function covers(input:readonly (readonly [AlgebraicReal,AlgebraicReal])[],lower:AlgebraicReal,upper:AlgebraicReal):boolean {
 let cursor=lower;for(const [a,b] of [...input].sort((a,b)=>a[0].compare(b[0]))){if(a.compare(cursor)>0)return false;if(b.compare(cursor)>0)cursor=b;if(cursor.compare(upper)>=0)return true;}return false;
}
/** Sufficient exact whole-interval correspondence with consistent parameter
 * orientation. Failure is not a proof that the spatial images differ. */
export function matchNurbsSpanIntervals3(a:Readonly<{span:NurbsSpan3;lower:AlgebraicReal|ExactInput;upper:AlgebraicReal|ExactInput}>,b:Readonly<{span:NurbsSpan3;lower:AlgebraicReal|ExactInput;upper:AlgebraicReal|ExactInput}>):NurbsSpanIntervalMatch3 {
 const first=snapshot(a),second=snapshot(b),solution=solveBivariateEquations(bivariateEquationBasis(nurbsSpanPairEquations3(first.span,second.span)));
 if(solution.kind==='finite')return Object.freeze({kind:'not-certified',reason:'finite-intersection'});
 if(solution.kind==='all')throw new Error('Nonconstant curves produced a whole parameter area');
 const graph=traceAlgebraicCurve2(solution.commonFactor,{uMin:first.span.startParameter,uMax:first.span.endParameter,vMin:second.span.startParameter,vMax:second.span.endParameter}),relation=restrictAlgebraicCurveRectangle2(graph,{uMin:first.lower,uMax:first.upper,vMin:second.lower,vMax:second.upper}),xs:[AlgebraicReal,AlgebraicReal][]=[],ys:[AlgebraicReal,AlgebraicReal][]=[];let direction:1|-1|null=null;
 for(const e of relation.edges){
  const p=relation.vertices[e.from]!,q=relation.vertices[e.to]!,du=p.u.compare(q.u),dv=p.v.compare(q.v);
  if(!du||!dv)throw new Error('Nonconstant finite curves produced a constant-parameter relation arc');
  const sign=(du*dv) as 1|-1;if(direction!==null&&direction!==sign)return Object.freeze({kind:'not-certified',reason:'orientation-conflict'});direction=sign;
  xs.push(du<0?[p.u,q.u]:[q.u,p.u]);ys.push(dv<0?[p.v,q.v]:[q.v,p.v]);
  for(const v of [p,q])if(compareAlgebraicPoints3(evaluateNurbsSpanPoint3(first.span,v.u),evaluateNurbsSpanPoint3(second.span,v.v))!==0)throw new Error('Parameter relation lost full XYZ equality');
 }
 if(direction===null||!covers(xs,first.lower,first.upper)||!covers(ys,second.lower,second.upper))return Object.freeze({kind:'not-certified',reason:'coverage-gap'});
 const certificate=Object.freeze({first,second,direction,relation});owned.add(certificate);return Object.freeze({kind:'matched',certificate});
}
export function nurbsSpanIntervalMatchPoint3(certificate:NurbsSpanIntervalMatchCertificate3,edge:number,input:AlgebraicReal|ExactInput) {
 if(!owned.has(certificate))throw new RangeError('Expected factory-created curve interval match');
 const r=certificate.relation;if(!Number.isSafeInteger(edge)||edge<0||edge>=r.edges.length)throw new RangeError('Invalid interval relation edge');
 const e=r.edges[edge]!,t=real(input);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the interval relation edge');
 const q=evaluateAlgebraicCurveEdge2(r.graph,e.sourceEdge,t),point=evaluateNurbsSpanPoint3(certificate.first.span,q.u);
 if(compareAlgebraicPoints3(point,evaluateNurbsSpanPoint3(certificate.second.span,q.v))!==0)throw new Error('Interval relation evaluation lost XYZ equality');
 return Object.freeze({firstParameter:q.u,secondParameter:q.v,point});
}
/** All opposite-side parameter preimages on the certified finite relation. */
export function nurbsSpanIntervalMatchParameters3(certificate:NurbsSpanIntervalMatchCertificate3,side:'first'|'second',input:AlgebraicReal|ExactInput):readonly AlgebraicReal[] {
 if(!owned.has(certificate))throw new RangeError('Expected factory-created curve interval match');
 if(side!=='first'&&side!=='second')throw new RangeError('Invalid interval relation side');
 const first=side==='first',from=first?certificate.first:certificate.second,to=first?certificate.second:certificate.first,t=real(input);
 if(t.compare(from.lower)<0||t.compare(from.upper)>0)throw new RangeError('Parameter is outside the certified interval');
 const f=certificate.relation.graph.polynomial,result=bivariateFiberRoots(first?f:f.transpose(),t);
 if(result.kind==='whole')throw new Error('Nonconstant interval relation has a whole finite fiber');
 const point=evaluateNurbsSpanPoint3(from.span,t);
 return Object.freeze(result.roots.map(q=>q.recognizeRational()).filter(q=>q.compare(to.lower)>=0&&q.compare(to.upper)<=0&&compareAlgebraicPoints3(point,evaluateNurbsSpanPoint3(to.span,q))===0));
}
