import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';
import {assertOwnedNurbsAffineProjection3} from './nurbs-affine-projection3.js';
import type {NurbsAffineProjectionCertificate3,NurbsAffineParameterRow3} from './nurbs-affine-projection3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
export interface NurbsAffineIntersectionEquationPatch3 {
 readonly sourcePatch:NurbsSurfacePatch3;readonly targetPatch:NurbsSurfacePatch3;
 /** Target chart coordinates are uNumerator/sourcePatch.weight and likewise v. */
 readonly uNumerator:BivariatePolynomial;readonly vNumerator:BivariatePolynomial;
 /** Exact three homogeneous spatial equality residuals in source (u,v).
  * Their zeros alone do not enforce either closed parameter rectangle. */
 readonly equations:readonly [BivariatePolynomial,BivariatePolynomial,BivariatePolynomial];
}
export interface NurbsAffineIntersectionEquations3 {
 readonly source:NurbsSurface3;readonly target:NurbsAffineProjectionCertificate3;
 readonly pairs:readonly NurbsAffineIntersectionEquationPatch3[];
}
export interface NurbsAffineIntersectionPoint3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;
 readonly targetU:AlgebraicReal;readonly targetV:AlgebraicReal;readonly point:AlgebraicCoordinates3;
}
const owned=new WeakSet<NurbsAffineIntersectionEquations3>(),one=new BivariatePolynomial([[1n]]);
function powers(p:BivariatePolynomial,n:number){const result=[one];for(let i=1;i<=n;i++)result.push(result[i-1]!.mul(p));return result;}
function pullback(f:BivariatePolynomial,A:readonly BivariatePolynomial[],B:readonly BivariatePolynomial[],W:readonly BivariatePolynomial[],degree:number):BivariatePolynomial {
 let result=new BivariatePolynomial();f.rows.forEach((row,i)=>row.coefficients.forEach((c,j)=>{if(c.sign()!==0)result=result.add(A[i]!.mul(B[j]!).mul(W[degree-i-j]!).scale(c));}));return result;
}
/** Eliminate the target parameters using its checked affine left inverse.
 * Source may be folded, singular or have discontinuous one-sided patches.
 * This constructs exact closed-set constraints, not an enumerated SSI graph. */
export function nurbsAffineIntersectionEquations3(input:NurbsSurface3,target:NurbsAffineProjectionCertificate3):NurbsAffineIntersectionEquations3 {
 assertOwnedNurbsAffineProjection3(target);const source=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),pairs:NurbsAffineIntersectionEquationPatch3[]=[];
 for(const p of nurbsSurfacePatches3(source)){
  const coordinate=(r:NurbsAffineParameterRow3)=>p.x.scale(r.normal.x).add(p.y.scale(r.normal.y)).add(p.z.scale(r.normal.z)).add(p.weight.scale(r.offset)),uNumerator=coordinate(target.u),vNumerator=coordinate(target.v);
  for(const q of nurbsSurfacePatches3(target.surface)){
   const coordinates=[q.x,q.y,q.z,q.weight],du=Math.max(...coordinates.map(f=>f.degreeU)),dv=Math.max(...coordinates.map(f=>f.degreeV)),degree=du+dv,A=powers(uNumerator,du),B=powers(vNumerator,dv),W=powers(p.weight,degree),[X,Y,Z,D]=coordinates.map(f=>pullback(f,A,B,W,degree));
   const equations=Object.freeze([p.x.mul(D!).sub(p.weight.mul(X!)),p.y.mul(D!).sub(p.weight.mul(Y!)),p.z.mul(D!).sub(p.weight.mul(Z!))] as const);pairs.push(Object.freeze({sourcePatch:p,targetPatch:q,uNumerator,vNumerator,equations}));
  }
 }
 const report=Object.freeze({source,target,pairs:Object.freeze(pairs)});owned.add(report);return report;
}
export function assertOwnedNurbsAffineIntersectionEquations3(report:NurbsAffineIntersectionEquations3):void {if(!owned.has(report))throw new RangeError('Operation requires factory-created NURBS intersection equations');}
function pairAt(report:NurbsAffineIntersectionEquations3,pair:number):NurbsAffineIntersectionEquationPatch3 {
 assertOwnedNurbsAffineIntersectionEquations3(report);if(!Number.isSafeInteger(pair)||pair<0||pair>=report.pairs.length)throw new RangeError('Invalid intersection patch pair');return report.pairs[pair]!;
}
const real=(t:AlgebraicReal|ExactInput)=>t instanceof AlgebraicReal?t:AlgebraicReal.fromRational(t);
function inside(p:NurbsSurfacePatch3,u:AlgebraicReal,v:AlgebraicReal):boolean {return u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0;}
function candidate(p:NurbsAffineIntersectionEquationPatch3,u:AlgebraicReal,v:AlgebraicReal):NurbsAffineIntersectionPoint3|null {
 if(!inside(p.sourcePatch,u,v))return null;const targetU=p.uNumerator.rationalImage(u,v,p.sourcePatch.weight),targetV=p.vNumerator.rationalImage(u,v,p.sourcePatch.weight);if(!inside(p.targetPatch,targetU,targetV)||p.equations.some(f=>f.evaluateAlgebraic(u,v).sign()!==0))return null;
 const point=liftNurbsSectionPatch3(p.sourcePatch,u,v),other=liftNurbsSectionPatch3(p.targetPatch,targetU,targetV);if(compareAlgebraicPoints3(point,other)!==0)throw new Error('Eliminated intersection equations failed exact spatial equality');return Object.freeze({u,v,targetU,targetV,point});
}
/** Internal single-evaluation path for owned downstream trim classification. */
export function nurbsAffineIntersectionCandidate3(report:NurbsAffineIntersectionEquations3,pair:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsAffineIntersectionPoint3|null {return candidate(pairAt(report,pair),real(u),real(v));}
export function nurbsAffineIntersectionContains3(report:NurbsAffineIntersectionEquations3,pair:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):boolean {return candidate(pairAt(report,pair),real(u),real(v))!==null;}
export function nurbsAffineIntersectionPoint3(report:NurbsAffineIntersectionEquations3,pair:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsAffineIntersectionPoint3 {
 const result=candidate(pairAt(report,pair),real(u),real(v));if(!result)throw new RangeError('Parameters do not represent a closed patch intersection');return result;
}
