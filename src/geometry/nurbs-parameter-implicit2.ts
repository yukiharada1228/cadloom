import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {gcdBivariate,divideBivariateExact} from '../numeric/bivariate-system.js';
import {resultantOverBivariatePolynomials} from '../numeric/bivariate-resultant.js';
import type {ExactInput} from './point2.js';
import {nurbsCurve3,nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsCurve3,NurbsSpan3} from './nurbs-curve3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
export type ImplicitNurbsParameterSpan2=
 | Readonly<{kind:'curve';span:NurbsSpan3;polynomial:BivariatePolynomial}>
 | Readonly<{kind:'point';span:NurbsSpan3;u:Rational;v:Rational}>;
export interface ImplicitNurbsParameterCurve2 {readonly curve:NurbsCurve3;readonly spans:readonly ImplicitNurbsParameterSpan2[];}
const owned=new WeakSet<ImplicitNurbsParameterCurve2>();
function quotient(p:Polynomial,g:Polynomial):Polynomial {const d=p.divRem(g);if(d.remainder.degree>=0)throw new Error('Nonexact homogeneous primitive division');return d.quotient;}
/** Necessary implicit equations of every closed rational parameter span.
 * A zero of the polynomial is not, by itself, finite-span membership. */
export function implicitizeNurbsParameterCurve2(input:NurbsCurve3):ImplicitNurbsParameterCurve2 {
 const curve=nurbsCurve3(input.degree,input.controlPoints,input.knots,input.weights);if(curve.controlPoints.some(p=>p.z.sign()!==0))throw new RangeError('Parameter curves require z=0');
 return finish(curve);
}
function finish(curve:NurbsCurve3):ImplicitNurbsParameterCurve2 {
 const spans:ImplicitNurbsParameterSpan2[]=nurbsCurveSpans3(curve).map(span=>{
  const common=span.x.gcd(span.y).gcd(span.weight),X=quotient(span.x,common),Y=quotient(span.y,common),W=quotient(span.weight,common);
  if(Math.max(X.degree,Y.degree,W.degree)<=0){const u=X.coefficient(0).div(W.coefficient(0)),v=Y.coefficient(0).div(W.coefficient(0));if(span.x.sub(span.weight.scale(u)).degree>=0||span.y.sub(span.weight.scale(v)).degree>=0)throw new Error('Constant parameter span failed homogeneous identities');return Object.freeze({kind:'point' as const,span,u,v});}
  const m=Math.max(X.degree,W.degree),n=Math.max(Y.degree,W.degree),p=Array.from({length:m+1},(_,i)=>new BivariatePolynomial([[X.coefficient(i)],[W.coefficient(i).neg()]])),q=Array.from({length:n+1},(_,i)=>new BivariatePolynomial([[Y.coefficient(i),W.coefficient(i).neg()]])),result=resultantOverBivariatePolynomials(p,q);
  if(result.degreeU<0)throw new Error('Primitive nonconstant parameterization has a zero resultant');
  const repeated=gcdBivariate(gcdBivariate(result,result.derivativeU()),result.derivativeV()),squareFree=divideBivariateExact(result,repeated),row=squareFree.rows[squareFree.degreeU]!,leading=row.coefficients[row.degree]!,polynomial=squareFree.scale(new Rational(1n).div(leading));
  if(polynomial.degreeU===0&&polynomial.degreeV===0||nurbsParameterPolynomial3(polynomial,span).degree>=0)throw new Error('Implicit parameter equation failed exact homogeneous substitution');
  return Object.freeze({kind:'curve' as const,span,polynomial});
 });
 const report=Object.freeze({curve,spans:Object.freeze(spans)});owned.add(report);return report;
}
export function implicitNurbsParameterSpanPoint2(report:ImplicitNurbsParameterCurve2,index:number,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!owned.has(report))throw new RangeError('Operation requires a factory-created implicit NURBS parameter curve');if(!Number.isSafeInteger(index)||index<0||index>=report.spans.length)throw new RangeError('Invalid implicit span index');const s=report.spans[index]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(AlgebraicReal.fromRational(s.span.startParameter))<0||t.compare(AlgebraicReal.fromRational(s.span.endParameter))>0)throw new RangeError('Parameter is outside the closed span');return evaluateNurbsSpanPoint3(s.span,t);
}
