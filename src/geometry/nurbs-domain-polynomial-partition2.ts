import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {implicitizeNurbsParameterCurve2} from './nurbs-parameter-implicit2.js';
import {traceAlgebraicCurve2} from './algebraic-curve-topology2.js';
import type {CurveRectangle2} from './algebraic-curve-topology2.js';
import type {PreparedNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
/** Internal input is a freshly validated Jordan domain. Supports are only
 * partition boundaries; finite branch membership always uses domain.locate. */
export function prepareNurbsDomainPolynomialPartition2(domain:PreparedNurbsParameterDomain2) {
 const support:BivariatePolynomial[]=[],ends:BivariatePolynomial[]=[];
 const add=(list:BivariatePolynomial[],p:BivariatePolynomial)=>{if(!list.some(q=>q.equals(p)))list.push(p);};
 for(const curve of [domain.outer,...domain.holes].flat())for(const piece of implicitizeNurbsParameterCurve2(curve).spans){
  if(piece.kind==='curve')add(support,piece.polynomial);
  for(const t of [piece.span.startParameter,piece.span.endParameter]){const s=piece.span,W=s.weight.evaluate(t),u=s.x.evaluate(t).div(W),v=s.y.evaluate(t).div(W);add(ends,new BivariatePolynomial([[u.neg()],[1n]]));add(ends,new BivariatePolynomial([[v.neg(),1n]]));}
 }
 let product=new BivariatePolynomial([[1n]]);support.forEach(f=>{product=product.mul(f);});const cache=new Map<string,readonly BivariatePolynomial[]>();
 return (bounds:CurveRectangle2):readonly BivariatePolynomial[]=>{
  const key=[bounds.uMin,bounds.uMax,bounds.vMin,bounds.vMax].map(q=>q.toString()).join('|'),prior=cache.get(key);if(prior)return prior;const result=[...support,...ends],uGraph=traceAlgebraicCurve2(product,bounds),vGraph=traceAlgebraicCurve2(product.transpose(),{uMin:bounds.vMin,uMax:bounds.vMax,vMin:bounds.uMin,vMax:bounds.uMax});
  for(const e of uGraph.events)add(result,new BivariatePolynomial(e.u.polynomial.coefficients.map(c=>[c])));for(const e of vGraph.events)add(result,new BivariatePolynomial([e.u.polynomial.coefficients]));const frozen=Object.freeze(result);cache.set(key,frozen);return frozen;
 };
}
