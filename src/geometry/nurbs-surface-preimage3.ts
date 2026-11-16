import {Rational} from '../numeric/rational.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {CurveRectangle2} from './algebraic-curve-topology2.js';
import {exactRational} from '../numeric/polynomial.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';

export interface NurbsSurfacePreimagePatch3 {
 readonly patch:NurbsSurfacePatch3;
 /** Finite solutions outside the shared polynomial zero locus. */
 readonly points:readonly Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3}>[];
 /** May contain conjugate components which are NOT actual preimages. Only
  * selected locusVertices/locusEdges below belong to the requested point. */
 readonly locus:AlgebraicCurveTopology2|null;readonly locusVertices:readonly number[];readonly locusEdges:readonly number[];
 readonly wholePatch:boolean;
}
export interface NurbsSurfacePointPreimages3 {
 readonly surface:NurbsSurface3;readonly point:AlgebraicCoordinates3;
 /** Only nonempty one-sided patches. Same-parameter seam origins stay distinct. */
 readonly patches:readonly NurbsSurfacePreimagePatch3[];readonly empty:boolean;
}
const owned=new WeakSet<NurbsSurfacePointPreimages3>(),real=(v:AlgebraicReal|ExactInput)=>v instanceof AlgebraicReal?v:AlgebraicReal.fromRational(v);
function inside(p:NurbsSurfacePatch3,u:AlgebraicReal,v:AlgebraicReal):boolean {return u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0;}
/** Rational equation P(N/W)=0; exact value filtering is still required because
 * the root certificate can have other real conjugates or nonminimal factors. */
function equation(N:BivariatePolynomial,W:BivariatePolynomial,input:AlgebraicReal):BivariatePolynomial {
 const value=input.recognizeRational();if(value.rational!==null)return N.sub(W.scale(value.rational));
 const P=value.polynomial,n=P.degree,A=[new BivariatePolynomial([[1n]])],B=[new BivariatePolynomial([[1n]])];for(let i=1;i<=n;i++){A.push(A[i-1]!.mul(N));B.push(B[i-1]!.mul(W));}
 let result=new BivariatePolynomial();for(let i=0;i<=n;i++)result=result.add(A[i]!.mul(B[n-i]!).scale(P.coefficient(i)));return result;
}
/** Complete patchwise inverse image, including collapsed curves and patches.
 * Does not assume the map is injective or weld one-sided knot values. */
function pointPreimages(input:NurbsSurface3,target:Point3|AlgebraicCoordinates3,bounds?:CurveRectangle2):NurbsSurfacePointPreimages3 {
 const surface=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),point=snapshotExactPoint3(target),patches:NurbsSurfacePreimagePatch3[]=[];
 if(bounds&&(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0||bounds.uMin.compare(surface.startU)<0||bounds.uMax.compare(surface.endU)>0||bounds.vMin.compare(surface.startV)<0||bounds.vMax.compare(surface.endV)>0))throw new RangeError('Preimage rectangle must be positive and inside the active surface');
 for(const original of nurbsSurfacePatches3(surface)){
  const min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;
  const patch=bounds?Object.freeze({...original,startU:max(original.startU,bounds.uMin),endU:min(original.endU,bounds.uMax),startV:max(original.startV,bounds.vMin),endV:min(original.endV,bounds.vMax)}):original;
  if(patch.startU.compare(patch.endU)>=0||patch.startV.compare(patch.endV)>=0)continue;
  const solutions=solveBivariateEquations((['x','y','z'] as const).map(k=>equation(patch[k],patch.weight,point[k]))),matches=(u:AlgebraicReal,v:AlgebraicReal)=>compareAlgebraicPoints3(liftNurbsSectionPatch3(patch,u,v),point)===0;
  const points=Object.freeze(solutions.points.filter(q=>inside(patch,q.u,q.v)&&matches(q.u,q.v)).map(q=>Object.freeze({...q,point:liftNurbsSectionPatch3(patch,q.u,q.v)})));
  let wholePatch=false,locus:AlgebraicCurveTopology2|null=null;const locusVertices:number[]=[],locusEdges:number[]=[];
  if(solutions.kind==='all'){
   // Every coordinate takes values in a finite root set. A continuous patch
   // rectangle is connected, so its image in that finite set is constant.
   wholePatch=matches(real(patch.startU.add(patch.endU).div(new Rational(2n))),real(patch.startV.add(patch.endV).div(new Rational(2n))));
  }else if(solutions.kind==='shared'){
   locus=traceAlgebraicCurve2(solutions.commonFactor,{uMin:patch.startU,uMax:patch.endU,vMin:patch.startV,vMax:patch.endV});
   locus.vertices.forEach((q,id)=>{if(matches(q.u,q.v))locusVertices.push(id);});const selected=new Set(locusVertices);
   locus.edges.forEach((e,id)=>{
    // A connected open edge also maps into the finite candidate-value set.
    // Exact equality at its interior witness selects the entire branch.
    if(matches(e.sample.u,e.sample.v)){if(!selected.has(e.from)||!selected.has(e.to))throw new Error('Selected preimage branch has a nonmatching endpoint');locusEdges.push(id);}
   });
  }
  if(points.length||wholePatch||locusVertices.length||locusEdges.length)patches.push(Object.freeze({patch,points,locus,locusVertices:Object.freeze(locusVertices),locusEdges:Object.freeze(locusEdges),wholePatch}));
 }
 const result=Object.freeze({surface,point,patches:Object.freeze(patches),empty:patches.length===0});owned.add(result);return result;
}
/** Whole-active-rectangle patch limits, including degenerate fibers. */
export function nurbsSurfacePointPreimages3(input:NurbsSurface3,target:Point3|AlgebraicCoordinates3):NurbsSurfacePointPreimages3 {return pointPreimages(input,target);}
/** Closed inside limits of a positive active rectangle. Returned patch bounds
 * are clipped, while homogeneous polynomials and span identities are retained. */
export function nurbsSurfaceRectanglePointPreimages3(input:NurbsSurface3,bounds:Readonly<{uMin:ExactInput;uMax:ExactInput;vMin:ExactInput;vMax:ExactInput}>,target:Point3|AlgebraicCoordinates3):NurbsSurfacePointPreimages3 {
 return pointPreimages(input,target,Object.freeze({uMin:exactRational(bounds.uMin),uMax:exactRational(bounds.uMax),vMin:exactRational(bounds.vMin),vMax:exactRational(bounds.vMax)}));
}
/** Internal guard for consumers of an actual inverse-image computation. */
export function assertOwnedNurbsSurfacePointPreimages3(report:NurbsSurfacePointPreimages3):void {if(!owned.has(report))throw new RangeError('Operation requires a factory-created NURBS preimage report');}
function at(report:NurbsSurfacePointPreimages3,patch:number):NurbsSurfacePreimagePatch3 {
 assertOwnedNurbsSurfacePointPreimages3(report);if(!Number.isSafeInteger(patch)||patch<0||patch>=report.patches.length)throw new RangeError('Invalid preimage patch index');return report.patches[patch]!;
}
export function nurbsSurfacePreimageEdgePoint3(report:NurbsSurfacePointPreimages3,patch:number,edge:number,parameter:AlgebraicReal|ExactInput):Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3}> {
 const p=at(report,patch);if(!Number.isSafeInteger(edge)||edge<0||edge>=p.locusEdges.length||!p.locus)throw new RangeError('Invalid selected preimage edge');const q=evaluateAlgebraicCurveEdge2(p.locus,p.locusEdges[edge]!,parameter),point=liftNurbsSectionPatch3(p.patch,q.u,q.v);if(compareAlgebraicPoints3(point,report.point)!==0)throw new Error('Preimage edge evaluation changed target');return Object.freeze({...q,point});
}
export function nurbsSurfacePreimagePatchPoint3(report:NurbsSurfacePointPreimages3,patch:number,inputU:AlgebraicReal|ExactInput,inputV:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 const p=at(report,patch),u=real(inputU),v=real(inputV);if(!p.wholePatch||!inside(p.patch,u,v))throw new RangeError('Parameter is outside a wholly collapsed preimage patch');const point=liftNurbsSectionPatch3(p.patch,u,v);if(compareAlgebraicPoints3(point,report.point)!==0)throw new Error('Preimage patch evaluation changed target');return point;
}
