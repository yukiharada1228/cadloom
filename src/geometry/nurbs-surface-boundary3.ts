import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsCurve3,nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsCurve3,NurbsSpan3} from './nurbs-curve3.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurface3,NurbsSurfacePatch3,NurbsSurfaceSides3} from './nurbs-surface3.js';

/** A closed one-sided rational image over an exact parameter interval.
 * Algebraic cut parameters are retained; these are not rational NURBS knots.
 */
export interface NurbsSurfaceBoundaryPiece3 {
  readonly curveSpan:number;readonly patch:NurbsSurfacePatch3;
  readonly startParameter:AlgebraicReal;readonly endParameter:AlgebraicReal;
  readonly x:Polynomial;readonly y:Polynomial;readonly z:Polynomial;readonly weight:Polynomial;
}
export interface NurbsSurfaceBoundary3 {
  readonly surface:NurbsSurface3;
  /** x=u, y=v, z=0. Parameter and spatial coordinates are intentionally distinct. */
  readonly parameterCurve:NurbsCurve3;
  readonly pieces:readonly NurbsSurfaceBoundaryPiece3[];
}
const one=new Polynomial([1n]),real=(x:Rational)=>AlgebraicReal.fromRational(x),keys=['x','y','z'] as const;
const owned=new WeakSet<NurbsSurfaceBoundary3>();
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
function powers(p:Polynomial,n:number):Polynomial[]{const a=[one];for(let i=1;i<=n;i++)a.push(a[i-1]!.mul(p));return a;}
/** W^(du+dv) F(U/W,V/W), with a common exponent for all four coordinates. */
function substitute(f:BivariatePolynomial,U:readonly Polynomial[],V:readonly Polynomial[],W:readonly Polynomial[],degree:number):Polynomial {
  let result=new Polynomial();f.rows.forEach((row,i)=>row.coefficients.forEach((c,j)=>{if(c.sign()!==0)result=result.add(U[i]!.mul(V[j]!).mul(W[degree-i-j]!).scale(c));}));return result;
}
/** Internal exact numerator of F(u(t),v(t)); denominator is a positive
 * power of the parameter span weight. Zero means whole-span coincidence.
 */
export function nurbsParameterPolynomial3(f:BivariatePolynomial,s:NurbsSpan3):Polynomial {
  const du=Math.max(0,f.degreeU),dv=Math.max(0,f.degreeV),degree=du+dv;
  return substitute(f,powers(s.x,du),powers(s.y,dv),powers(s.weight,degree),degree);
}
function compose(p:NurbsSurfacePatch3,s:NurbsSpan3,startParameter:AlgebraicReal,endParameter:AlgebraicReal):NurbsSurfaceBoundaryPiece3 {
  const coordinates=[p.x,p.y,p.z,p.weight],du=Math.max(...coordinates.map(f=>f.degreeU)),dv=Math.max(...coordinates.map(f=>f.degreeV)),degree=du+dv,U=powers(s.x,du),V=powers(s.y,dv),W=powers(s.weight,degree),[x,y,z,weight]=coordinates.map(f=>substitute(f,U,V,W,degree));
  return Object.freeze({curveSpan:s.index,patch:p,startParameter,endParameter,x:x!,y:y!,z:z!,weight:weight!});
}
function select(patches:readonly NurbsSurfacePatch3[],u:AlgebraicReal,v:AlgebraicReal,sides:NurbsSurfaceSides3):NurbsSurfacePatch3 {
  let candidates=patches.filter(p=>u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0);
  for(const axis of ['u','v'] as const){
    const low=axis==='u'?'startU':'startV',high=axis==='u'?'endU':'endV',side=axis==='u'?sides.uSide:sides.vSide;
    if(side==='left')candidates=candidates.filter(p=>!candidates.some(q=>q[high].compare(p[high])<0));
    else candidates=candidates.filter(p=>!candidates.some(q=>q[low].compare(p[low])>0));
  }
  if(candidates.length!==1)throw new RangeError('Parameter curve leaves the NURBS surface domain');return candidates[0]!;
}
/** Lift an arbitrary positive-weight rational parameter curve, splitting at ALL
 * surface knot preimages. Does not certify a simple boundary or embedded face.
 */
export function liftNurbsSurfaceBoundary3(inputSurface:NurbsSurface3,inputCurve:NurbsCurve3,sides:NurbsSurfaceSides3={}):NurbsSurfaceBoundary3 {
  if(sides.uSide!==undefined&&sides.uSide!=='left'&&sides.uSide!=='right'||sides.vSide!==undefined&&sides.vSide!=='left'&&sides.vSide!=='right')throw new RangeError('NURBS knot side must be left or right');
  const surface=nurbsSurface3(inputSurface.degreeU,inputSurface.degreeV,inputSurface.controlPoints,inputSurface.knotsU,inputSurface.knotsV,inputSurface.weights),parameterCurve=nurbsCurve3(inputCurve.degree,inputCurve.controlPoints,inputCurve.knots,inputCurve.weights),patches=nurbsSurfacePatches3(surface),pieces:NurbsSurfaceBoundaryPiece3[]=[];
  if(parameterCurve.controlPoints.some(p=>p.z.sign()!==0))throw new RangeError('Parameter curve must have z=0');
  for(const s of nurbsCurveSpans3(parameterCurve)){
    const cuts=[real(s.startParameter),real(s.endParameter)];
    for(const [N,knots] of [[s.x,surface.knotsU],[s.y,surface.knotsV]] as const)for(const k of knots){
      const f=N.sub(s.weight.scale(k));if(f.degree<0)continue;
      for(const t of isolateRealRoots(f))if(t.compare(real(s.startParameter))>0&&t.compare(real(s.endParameter))<0&&!cuts.some(c=>c.compare(t)===0))cuts.push(t);
    }
    cuts.sort((a,b)=>a.compare(b));
    for(let i=0;i+1<cuts.length;i++){
      const a=cuts[i]!,b=cuts[i+1]!,sample=between(a,b),uv=evaluateNurbsSpanPoint3(s,real(sample)),patch=select(patches,uv.x,uv.y,sides);
      pieces.push(compose(patch,s,a,b));
    }
  }
  const result=Object.freeze({surface,parameterCurve,pieces:Object.freeze(pieces)});owned.add(result);return result;
}
function assertOwned(b:NurbsSurfaceBoundary3):void {if(!owned.has(b))throw new RangeError('Operation requires a factory-created NURBS surface boundary');}
export function evaluateNurbsSurfaceBoundaryPiece3(boundary:NurbsSurfaceBoundary3,index:number,t:AlgebraicReal|Rational|string|bigint):AlgebraicCoordinates3 {
  assertOwned(boundary);if(!Number.isSafeInteger(index)||index<0||index>=boundary.pieces.length)throw new RangeError('Invalid boundary piece index');
  const p=boundary.pieces[index]!,a=t instanceof AlgebraicReal?t:AlgebraicReal.fromRational(t);
  if(a.compare(p.startParameter)<0||a.compare(p.endParameter)>0)throw new RangeError('Boundary parameter is outside this piece');
  return algebraicCoordinates3(a.rationalFunction(p.x,p.weight),a.rationalFunction(p.y,p.weight),a.rationalFunction(p.z,p.weight));
}
/** Whole-interval equality at the SAME parameter, not mere image-set equality.
 * Each nonempty overlap must satisfy homogeneous polynomial identities.
 */
export function nurbsSurfaceBoundaryMatchesCurve3(boundary:NurbsSurfaceBoundary3,input:NurbsCurve3):boolean {
  assertOwned(boundary);const curve=nurbsCurve3(input.degree,input.controlPoints,input.knots,input.weights);
  if(!curve.startParameter.equals(boundary.parameterCurve.startParameter)||!curve.endParameter.equals(boundary.parameterCurve.endParameter))return false;
  const spans=nurbsCurveSpans3(curve);
  for(const p of boundary.pieces)for(const s of spans){
    const lo=p.startParameter.compare(real(s.startParameter))>0?p.startParameter:real(s.startParameter),hi=p.endParameter.compare(real(s.endParameter))<0?p.endParameter:real(s.endParameter);
    if(lo.compare(hi)>=0)continue;
    if(keys.some(k=>!p[k].mul(s.weight).equals(s[k].mul(p.weight))))return false;
  }
  return true;
}
