import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {isolateRealRoots} from '../numeric/real-roots.js';
import {point3,cross3,dot3} from './point3.js';
import {plane3} from './plane3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {pointOnArc3,intersectCirclePlane3} from './circle3.js';
import {algebraicRationalPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedCylinderIntersectionArc3,evaluateCylinderIntersectionArc3,pointOnCylinderIntersectionArc3,splitCylinderIntersectionArc3} from './cylinder-cylinder3.js';
import type {CylinderIntersectionArc3} from './cylinder-cylinder3.js';
import {cylinderIntersectionArcOnSurface3,cylinderHeightCoefficients3,reduceCirclePolynomial3} from './cylinder-intersection-support3.js';
export type CylinderIntersectionArcCylinder3={readonly kind:'none'}|{readonly kind:'points';readonly points:readonly AlgebraicCoordinates3[]}|{readonly kind:'overlap';readonly arc:CylinderIntersectionArc3};
export interface CylinderIntersectionArcCylinderSplit3 {readonly original:CylinderIntersectionArc3;readonly cylinder:Cylinder3;readonly intersection:CylinderIntersectionArcCylinder3;readonly pieces:readonly {readonly arc:CylinderIntersectionArc3;readonly side:Sign}[];}
const axes=['x','y','z'] as const,X=new Polynomial([0n,1n]);
function unique(points:readonly AlgebraicCoordinates3[]):CylinderIntersectionArcCylinder3 {const result=points.filter((p,i)=>points.findIndex(q=>compareAlgebraicPoints3(p,q)===0)===i).sort(compareAlgebraicPoints3);return result.length?Object.freeze({kind:'points',points:Object.freeze(result)}):Object.freeze({kind:'none'});}
/** Complete distinct intersections of an owned SSI arc and a third circular
 * cylinder. Height elimination followed by a generic separating circle chart
 * recovers exact rational-univariate coordinates, including whole height fibers.
 */
export function intersectCylinderIntersectionArcCylinder3(arc:CylinderIntersectionArc3,input:Cylinder3):CylinderIntersectionArcCylinder3 {
 assertOwnedCylinderIntersectionArc3(arc);const target=cylinder3(input.axis,input.radiusSquared),surface={kind:'cylinder' as const,cylinder:target};if(cylinderIntersectionArcOnSurface3(arc,surface))return Object.freeze({kind:'overlap',arc});
 const origin=arc.first.axis.origin,d=arc.first.axis.direction,U0=d.y.sign()!==0||d.z.sign()!==0?cross3(d,point3(1n,0n)):cross3(d,point3(0n,1n)),V0=cross3(d,U0);
 for(let k=0n;;k++){
  const K=new Rational(k),U=point3(...axes.map(a=>U0[a].add(V0[a].mul(K))) as Parameters<typeof point3>),V=cross3(d,U),R=new Polynomial([arc.first.radiusSquared.div(dot3(V,V)),0n,dot3(U,U).div(dot3(V,V)).neg()]),source=cylinderHeightCoefficients3(arc.second,origin,U,V,d),other=cylinderHeightCoefficients3(target,origin,U,V,d),L=other.b.scale(source.a).sub(source.b.scale(other.a)).scale(2n),M=other.c.scale(source.a).sub(source.c.scale(other.a)),H=M.mul(M).scale(source.a).sub(source.b.mul(M).mul(L).scale(2n)).add(source.c.mul(L).mul(L)),h=reduceCirclePolynomial3(H,R);
  if(h.zero){
   // Only exceptional L=M=0 fibers and shared critical endpoints can meet
   // the opposite branch after the whole-arc identity test has failed.
   const points=[arc.start,arc.end].filter(p=>classifyPointToSurface3(p,surface)===0),normal=point3(...axes.map(a=>U[a].mul(L.coefficient(1,0)).div(dot3(U,U)).add(V[a].mul(L.coefficient(0,1)).div(dot3(V,V)))) as Parameters<typeof point3>),offset=L.coefficient(0,0).sub(dot3(normal,origin));
   if(dot3(normal,normal).sign()===0){if(offset.sign()===0)throw new Error('Identically coincident height equations failed whole-arc containment');return unique(points);}
   const roots=intersectCirclePlane3(arc.base.circle,plane3(normal.x,normal.y,normal.z,offset));if(roots.kind==='points')for(const q of roots.points)if(pointOnArc3(q,arc.base))points.push(evaluateCylinderIntersectionArc3(arc,q));return unique(points);
  }
  // A common zero of the two remainder coefficients gives an ambiguous
  // projection fiber. Rotate the rational orthogonal chart, rather than lose
  // that fiber or independently combine its conjugate coordinates.
  if(h.even.gcd(h.odd).degree>0)continue;
  const P=h.even.mul(h.even).sub(h.odd.mul(h.odd).mul(R));if(P.degree<0)throw new Error('Nonzero circle remainder has zero elimination polynomial');const points:AlgebraicCoordinates3[]=[],l=reduceCirclePolynomial3(L,R),m=reduceCirclePolynomial3(M,R),D=h.odd,Y=h.even.neg();
  for(const root of isolateRealRoots(P)){
   const x=root.recognizeRational();if(x.signOf(R)<0)continue;if(x.signOf(D)===0)throw new Error('Separating circle chart has an unresolved projection fiber');
   const LN=l.even.mul(D).add(l.odd.mul(Y)),MN=m.even.mul(D).add(m.odd.mul(Y)),baseN=axes.map(a=>D.scale(origin[a]).add(X.mul(D).scale(U[a])).add(Y.scale(V[a]))) as [Polynomial,Polynomial,Polynomial];
   if(x.signOf(LN)===0){if(x.signOf(MN)!==0)continue;const q=algebraicRationalPoint3(x,baseN,D);if(pointOnArc3(q,arc.base))points.push(evaluateCylinderIntersectionArc3(arc,q));continue;}
   const W=D.mul(LN),N=baseN.map((n,i)=>n.mul(LN).sub(MN.mul(D).scale(d[axes[i]!]))) as [Polynomial,Polynomial,Polynomial],p=algebraicRationalPoint3(x,N,W);
   if(pointOnCylinderIntersectionArc3(p,arc)&&classifyPointToSurface3(p,surface)===0)points.push(p);
  }
  return unique(points);
 }
}
export function splitCylinderIntersectionArcByCylinder3(arc:CylinderIntersectionArc3,input:Cylinder3):CylinderIntersectionArcCylinderSplit3 {
 const cylinder=cylinder3(input.axis,input.radiusSquared),intersection=intersectCylinderIntersectionArcCylinder3(arc,cylinder),arcs=intersection.kind==='points'?splitCylinderIntersectionArc3(arc,intersection.points):[arc],pieces=Object.freeze(arcs.map(arc=>{const side=intersection.kind==='overlap'?0:classifyPointToSurface3(arc.sample,{kind:'cylinder',cylinder});if(side===0&&intersection.kind!=='overlap')throw new Error('Open SSI piece contains an unpartitioned cylinder root');return Object.freeze({arc,side});}));return Object.freeze({original:arc,cylinder,intersection,pieces});
}
