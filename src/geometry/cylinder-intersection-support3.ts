import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {plane3} from './plane3.js';
import {cylinder3,surfacesCoincide3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3,Surface3} from './surface3.js';
import {circularArc3,interiorPointOnArc3} from './circle3.js';
import {assertOwnedCylinderIntersectionArc3,evaluateCylinderIntersectionArc3} from './cylinder-cylinder3.js';
import type {CylinderIntersectionArc3} from './cylinder-cylinder3.js';
import {intersectCylinderIntersectionArcPlane3} from './cylinder-intersection-plane3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';

/** Substitute p=origin+U*x+V*y+d*h into a cylinder equation. */
export function cylinderHeightCoefficients3(c:Cylinder3,origin:Point3,U:Vector3,V:Vector3,d:Vector3){
  const e=c.axis.direction,q=cross3(e,subtract3(origin,c.axis.origin)),u=cross3(e,U),v=cross3(e,V),w=cross3(e,d),two=new Rational(2n);
  return {a:dot3(w,w),b:new BivariatePolynomial([[dot3(q,w),dot3(v,w)],[dot3(u,w)]]),c:new BivariatePolynomial([[dot3(q,q).sub(c.radiusSquared.mul(dot3(e,e))),dot3(q,v).mul(two),dot3(v,v)],[dot3(q,u).mul(two),dot3(u,v).mul(two)],[dot3(u,u)]])};
}
/** Remainder modulo y²=R(x), over Q. */
export function reduceCirclePolynomial3(p:BivariatePolynomial,R:Polynomial){
  let even=new Polynomial(),odd=new Polynomial();const powers=[new Polynomial([1n])];
  for(let j=1;j<=Math.floor(p.degreeV/2);j++)powers.push(powers[j-1]!.mul(R));
  p.rows.forEach((row,i)=>row.coefficients.forEach((c,j)=>{if(c.sign()===0)return;const term=powers[Math.floor(j/2)]!.mul(new Polynomial([...Array.from({length:i},()=>0n),c]));if(j%2===0)even=even.add(term);else odd=odd.add(term);}));
  return {even,odd,zero:even.degree<0&&odd.degree<0};
}
/** Complete whole-arc membership in a native plane/circular-cylinder support.
 * A finite set of endpoint/sample checks is never used as its certificate.
 * The cylinder case eliminates height and reduces the residual modulo the base
 * circle; a branch witness is used only after the polynomial identity holds.
 */
export function cylinderIntersectionArcOnSurface3(arc:CylinderIntersectionArc3,input:Surface3):boolean {
  assertOwnedCylinderIntersectionArc3(arc);
  if(input.kind==='plane'){
    const p=plane3(input.plane.normal.x,input.plane.normal.y,input.plane.normal.z,input.plane.offset);
    if([arc.start,arc.end,arc.sample].some(q=>evaluate(p,q).sign()!==0))return false;
    return intersectCylinderIntersectionArcPlane3(arc,p).kind==='overlap';
  }
  if(input.kind!=='cylinder')throw new RangeError('Unknown supporting surface');
  const target=cylinder3(input.cylinder.axis,input.cylinder.radiusSquared),surface={kind:'cylinder' as const,cylinder:target};
  if([arc.first,arc.second].some(c=>surfacesCoincide3({kind:'cylinder',cylinder:c},surface)))return true;
  const origin=arc.first.axis.origin,d=arc.first.axis.direction,U=d.y.sign()!==0||d.z.sign()!==0?cross3(d,point3(1n,0n)):cross3(d,point3(0n,1n)),V=cross3(d,U),source=cylinderHeightCoefficients3(arc.second,origin,U,V,d),other=cylinderHeightCoefficients3(target,origin,U,V,d),R=new Polynomial([arc.first.radiusSquared.div(dot3(V,V)),0n,dot3(U,U).div(dot3(V,V)).neg()]);
  const L=other.b.scale(source.a).sub(source.b.scale(other.a)).scale(2n),M=other.c.scale(source.a).sub(source.c.scale(other.a));
  if(reduceCirclePolynomial3(L,R).zero)return reduceCirclePolynomial3(M,R).zero;
  const H=M.mul(M).scale(source.a).sub(source.b.mul(M).mul(L).scale(2n)).add(source.c.mul(L).mul(L));
  if(!reduceCirclePolynomial3(H,R).zero)return false;
  // Pick a true open-arc witness away from L=0. L is a nonzero affine
  // function on the circle, so repeated strict subdivision must leave its <=2 roots.
  const e=arc.second.axis.direction,k=target.axis.direction,E=dot3(e,e),K=dot3(k,k),ed=dot3(e,d),kd=dot3(k,d),m=point3(d.x.mul(E).sub(e.x.mul(ed)),d.y.mul(E).sub(e.y.mul(ed)),d.z.mul(E).sub(e.z.mul(ed))),n=point3(d.x.mul(K).sub(k.x.mul(kd)),d.y.mul(K).sub(k.y.mul(kd)),d.z.mul(K).sub(k.z.mul(kd))),normal=point3(n.x.mul(source.a).sub(m.x.mul(other.a)).mul(new Rational(2n)),n.y.mul(source.a).sub(m.y.mul(other.a)).mul(new Rational(2n)),n.z.mul(source.a).sub(m.z.mul(other.a)).mul(new Rational(2n))),offset=dot3(m,arc.second.axis.origin).mul(other.a).sub(dot3(n,target.axis.origin).mul(source.a)).mul(new Rational(2n));
  let base=arc.base,q=arc.baseSample;
  while(evaluate({normal,offset},q).sign()===0){base=circularArc3(base.circle,base.start,q,{direction:base.direction});q=interiorPointOnArc3(base);}
  return classifyPointToSurface3(evaluateCylinderIntersectionArc3(arc,q),surface)===0;
}
