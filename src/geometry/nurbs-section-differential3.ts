import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {ExactInput} from './point2.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {assertOwnedNurbsPlaneSection3,liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {NurbsPlaneSection3} from './nurbs-plane-section3.js';
import type {NurbsSurfacePatch3} from './nurbs-surface3.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';

interface SectionPoint3 {
 readonly point:AlgebraicCoordinates3;
 readonly parameterPoint:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;
}
interface SectionJet3 extends SectionPoint3 {
 /** Local independent coordinate; may differ from the source edge coordinate
  * at a projection-critical endpoint. Increasing coordinate is not edge order. */
 readonly coordinate:'u'|'v';
 readonly derivative:AlgebraicCoordinates3;readonly secondDerivative:AlgebraicCoordinates3;
}
export type NurbsSectionEdgeDifferential3=
 | Readonly<SectionPoint3&{kind:'singular-parameter'}>
 | Readonly<SectionJet3&{kind:'stationary-image'}>
 | Readonly<SectionJet3&{kind:'regular';curvatureSquared:AlgebraicReal}>;
export type NurbsImplicitPatchEdgeDifferential3=
 | Extract<NurbsSectionEdgeDifferential3,{kind:'singular-parameter'}>
 | (Exclude<NurbsSectionEdgeDifferential3,{kind:'singular-parameter'}>&Readonly<{parameterDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;parameterSecondDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>}>);
const unit=AlgebraicReal.fromRational(1n);
const one=new BivariatePolynomial([[1n]]),zero=AlgebraicReal.fromRational(0n);
/** Differentiate a selected implicit branch on its actual one-sided patch.
 * Repeated plane-contact factors are removed by the owned topology. A zero
 * square-free gradient is unresolved, not a guessed tangent or an empty curve. */
export function nurbsPlaneSectionEdgeDifferential3(source:NurbsPlaneSection3,piece:number,edge:number,parameter:AlgebraicReal|ExactInput):NurbsSectionEdgeDifferential3 {
 assertOwnedNurbsPlaneSection3(source);if(!Number.isSafeInteger(piece)||piece<0||piece>=source.pieces.length)throw new RangeError('Invalid section piece index');
 const item=source.pieces[piece]!,result=implicitNurbsPatchEdgeDifferential3(item.patch,item.topology,edge,parameter);if(result.kind==='singular-parameter')return result;const {parameterDerivative:_,parameterSecondDerivative:__,...publicResult}=result;return Object.freeze(publicResult);
}
/** Internal shared jet on an owned selected graph and its actual one-sided patch. */
export function implicitNurbsPatchEdgeDifferential3(patch:NurbsSurfacePatch3,t:AlgebraicCurveTopology2,edge:number,parameter:AlgebraicReal|ExactInput):NurbsImplicitPatchEdgeDifferential3 {
 const parameterPoint=evaluateAlgebraicCurveEdge2(t,edge,parameter),{u,v}=parameterPoint,point=liftNurbsSectionPatch3(patch,u,v),base={point,parameterPoint};
 let coordinate:'u'|'v',slope:AlgebraicReal,second:AlgebraicReal;
 let directionNumerator=new BivariatePolynomial(),directionDenominator=one;
 if(t.edges[edge]!.kind==='vertical'){coordinate='v';slope=zero;second=zero;}
 else {
  const F=t.nonvertical,Fu=F.derivativeU(),Fv=F.derivativeV(),at=(p:BivariatePolynomial)=>p.rationalImage(u,v,one),a=at(Fu),b=at(Fv);
  // Keep dependent algebraic values in a single rational expression. Separate
  // resultant arithmetic can otherwise grow before exact cancellations occur.
  const implicitJet=(n:BivariatePolynomial,d:BivariatePolynomial,nn:BivariatePolynomial,nd:BivariatePolynomial,dd:BivariatePolynomial)=>{
   const numerator=nn.mul(d.mul(d)).sub(nd.mul(n).mul(d).scale(2n)).add(dd.mul(n.mul(n))).scale(-1n);
   return {slope:n.scale(-1n).rationalImage(u,v,d),second:numerator.rationalImage(u,v,d.mul(d).mul(d))};
  };
  if(b.sign()!==0){coordinate='u';directionNumerator=Fu;directionDenominator=Fv;({slope,second}=implicitJet(Fu,Fv,Fu.derivativeU(),Fu.derivativeV(),Fv.derivativeV()));}
  else if(a.sign()!==0){coordinate='v';directionNumerator=Fv;directionDenominator=Fu;({slope,second}=implicitJet(Fv,Fu,Fv.derivativeV(),Fu.derivativeV(),Fu.derivativeU()));}
  else return Object.freeze({...base,kind:'singular-parameter'});
 }
 // Differentiate P/W along the selected implicit chart as rational
 // polynomials before evaluating. This preserves cancellations such as the
 // identically constant spatial coordinate on a surface intersection.
 const D=(f:BivariatePolynomial)=>(coordinate==='u'?f.derivativeU():f.derivativeV()).mul(directionDenominator).sub((coordinate==='u'?f.derivativeV():f.derivativeU()).mul(directionNumerator)),W=patch.weight;
 const Q=W.mul(W).mul(directionDenominator),T=Q.mul(Q).mul(directionDenominator);
 const component=(k:'x'|'y'|'z')=>{const P=patch[k],R=D(P).mul(W).sub(P.mul(D(W))),S=D(R).mul(Q).sub(R.mul(D(Q)));return {R,S,first:R.rationalImage(u,v,Q),second:S.rationalImage(u,v,T)};};
 const x=component('x'),y=component('y'),z=component('z'),derivative=algebraicCoordinates3(x.first,y.first,z.first),secondDerivative=algebraicCoordinates3(x.second,y.second,z.second),parameterDerivative=Object.freeze(coordinate==='u'?{u:unit,v:slope}:{u:slope,v:unit}),parameterSecondDerivative=Object.freeze(coordinate==='u'?{u:zero,v:second}:{u:second,v:zero}),jet={...base,coordinate,derivative,secondDerivative,parameterDerivative,parameterSecondDerivative};
 const speed=x.R.mul(x.R).add(y.R.mul(y.R)).add(z.R.mul(z.R));
 if(speed.rationalImage(u,v,one).sign()===0)return Object.freeze({...jet,kind:'stationary-image'});
 const cross=[y.R.mul(z.S).sub(z.R.mul(y.S)),z.R.mul(x.S).sub(x.R.mul(z.S)),x.R.mul(y.S).sub(y.R.mul(x.S))],norm=cross.reduce((sum,f)=>sum.add(f.mul(f)),new BivariatePolynomial());
 // Q^4 cancels exactly between |first x second|^2 and |first|^6.
 const curvatureSquared=norm.rationalImage(u,v,directionDenominator.mul(directionDenominator).mul(speed).mul(speed).mul(speed));
 return Object.freeze({...jet,kind:'regular',curvatureSquared});
}
