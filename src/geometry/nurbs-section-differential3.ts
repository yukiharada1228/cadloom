import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {ExactInput} from './point2.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {assertOwnedNurbsPlaneSection3,liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {NurbsPlaneSection3} from './nurbs-plane-section3.js';
import {secondDifferentialNurbsSurfacePatch3} from './nurbs-surface3.js';

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
const one=new BivariatePolynomial([[1n]]),zero=AlgebraicReal.fromRational(0n),two=AlgebraicReal.fromRational(2n);
const dot=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z));
/** Differentiate a selected implicit branch on its actual one-sided patch.
 * Repeated plane-contact factors are removed by the owned topology. A zero
 * square-free gradient is unresolved, not a guessed tangent or an empty curve. */
export function nurbsPlaneSectionEdgeDifferential3(source:NurbsPlaneSection3,piece:number,edge:number,parameter:AlgebraicReal|ExactInput):NurbsSectionEdgeDifferential3 {
 assertOwnedNurbsPlaneSection3(source);if(!Number.isSafeInteger(piece)||piece<0||piece>=source.pieces.length)throw new RangeError('Invalid section piece index');
 const item=source.pieces[piece]!,t=item.topology,parameterPoint=evaluateAlgebraicCurveEdge2(t,edge,parameter),{u,v}=parameterPoint,point=liftNurbsSectionPatch3(item.patch,u,v),base={point,parameterPoint};
 let coordinate:'u'|'v',slope:AlgebraicReal,second:AlgebraicReal;
 if(t.edges[edge]!.kind==='vertical'){coordinate='v';slope=zero;second=zero;}
 else {
  const F=t.nonvertical,Fu=F.derivativeU(),Fv=F.derivativeV(),at=(p:BivariatePolynomial)=>p.rationalImage(u,v,one),a=at(Fu),b=at(Fv);
  if(b.sign()!==0){coordinate='u';slope=a.neg().div(b);second=at(Fu.derivativeU()).add(two.mul(at(Fu.derivativeV())).mul(slope)).add(at(Fv.derivativeV()).mul(slope.mul(slope))).neg().div(b);}
  else if(a.sign()!==0){coordinate='v';slope=b.neg().div(a);second=at(Fv.derivativeV()).add(two.mul(at(Fu.derivativeV())).mul(slope)).add(at(Fu.derivativeU()).mul(slope.mul(slope))).neg().div(a);}
  else return Object.freeze({...base,kind:'singular-parameter'});
 }
 const d=secondDifferentialNurbsSurfacePatch3(item.patch,u,v),A=coordinate==='u'?d.du:d.dv,B=coordinate==='u'?d.dv:d.du,AA=coordinate==='u'?d.duu:d.dvv,BB=coordinate==='u'?d.dvv:d.duu;
 const derivative=algebraicCoordinates3(A.x.add(B.x.mul(slope)),A.y.add(B.y.mul(slope)),A.z.add(B.z.mul(slope))),component=(k:'x'|'y'|'z')=>AA[k].add(two.mul(d.duv[k]).mul(slope)).add(BB[k].mul(slope.mul(slope))).add(B[k].mul(second)),secondDerivative=algebraicCoordinates3(component('x'),component('y'),component('z')),jet={...base,coordinate,derivative,secondDerivative},speed=dot(derivative,derivative);
 if(speed.sign()===0)return Object.freeze({...jet,kind:'stationary-image'});
 const cross=algebraicCoordinates3(derivative.y.mul(secondDerivative.z).sub(derivative.z.mul(secondDerivative.y)),derivative.z.mul(secondDerivative.x).sub(derivative.x.mul(secondDerivative.z)),derivative.x.mul(secondDerivative.y).sub(derivative.y.mul(secondDerivative.x)));
 return Object.freeze({...jet,kind:'regular',curvatureSquared:dot(cross,cross).div(speed.mul(speed).mul(speed))});
}
