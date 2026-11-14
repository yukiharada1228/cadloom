import {Rational} from '../numeric/rational.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations,divideBivariateExact} from '../numeric/bivariate-system.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';
import {traceAlgebraicCurve2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';

export interface NurbsSurfaceSingularPoint3 {
  readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;
}
export interface NurbsPatchRegularity3 {
  readonly patch:NurbsSurfacePatch3;
  /** du × dv = (normalX,normalY,normalZ)/weight³ on this closed patch. */
  readonly normalX:BivariatePolynomial;readonly normalY:BivariatePolynomial;readonly normalZ:BivariatePolynomial;
  /** Isolated solutions outside the shared polynomial zero locus. */
  readonly points:readonly NurbsSurfaceSingularPoint3[];
  /** May include isolated real vertices, curves, an area, or no real points. */
  readonly locus:AlgebraicCurveTopology2|null;
  readonly regular:boolean;
}
export interface NurbsSurfaceSeam3 {
  readonly firstPatch:number;readonly secondPatch:number;readonly direction:'u'|'v';readonly parameter:Rational;
  /** Pointwise equality over the entire common parameter boundary. */
  readonly continuous:boolean;
}
export interface NurbsSurfaceRegularity3 {
  readonly surface:NurbsSurface3;readonly patches:readonly NurbsPatchRegularity3[];readonly seams:readonly NurbsSurfaceSeam3[];
  readonly continuous:boolean;
  /** Nonzero one-sided differential on each closed patch; not a C1 seam claim. */
  readonly everyPatchRegular:boolean;
}
const real=(x:Rational)=>AlgebraicReal.fromRational(x),keys=['x','y','z'] as const;
function patchReport(p:NurbsSurfacePatch3):NurbsPatchRegularity3 {
  const W=p.weight,du=keys.map(k=>p[k].derivativeU().mul(W).sub(p[k].mul(W.derivativeU()))),dv=keys.map(k=>p[k].derivativeV().mul(W).sub(p[k].mul(W.derivativeV())));
  // Every cross product has a W factor; remove it exactly. W>0 on the patch.
  const normal=[0,1,2].map(i=>{const j=(i+1)%3,k=(i+2)%3;return divideBivariateExact(du[j]!.mul(dv[k]!).sub(du[k]!.mul(dv[j]!)),W);}),result=solveBivariateEquations(normal);
  const points=Object.freeze(result.points.filter(q=>q.u.compare(real(p.startU))>=0&&q.u.compare(real(p.endU))<=0&&q.v.compare(real(p.startV))>=0&&q.v.compare(real(p.endV))<=0).map(q=>Object.freeze({...q,point:algebraicCoordinates3(p.x.rationalImage(q.u,q.v,W),p.y.rationalImage(q.u,q.v,W),p.z.rationalImage(q.u,q.v,W))})));
  const locus=result.kind==='finite'?null:traceAlgebraicCurve2(result.commonFactor,{uMin:p.startU,uMax:p.endU,vMin:p.startV,vMax:p.endV}),regular=points.length===0&&(locus===null||locus.kind==='curve'&&locus.vertices.length===0);
  return Object.freeze({patch:p,normalX:normal[0]!,normalY:normal[1]!,normalZ:normal[2]!,points,locus,regular});
}
/** Complete one-sided singular parameter loci on every closed knot rectangle,
 * plus exact whole-boundary positional continuity. Does not prove injectivity.
 */
export function analyzeNurbsSurfaceRegularity3(input:NurbsSurface3):NurbsSurfaceRegularity3 {
  const surface=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),raw=nurbsSurfacePatches3(surface),patches=Object.freeze(raw.map(patchReport)),seams:NurbsSurfaceSeam3[]=[];
  for(let i=0;i<raw.length;i++)for(let j=i+1;j<raw.length;j++){
    const a=raw[i]!,b=raw[j]!;let direction:'u'|'v'|null=null,parameter:Rational|null=null;
    if(a.endU.equals(b.startU)&&a.startV.equals(b.startV)&&a.endV.equals(b.endV)){direction='u';parameter=a.endU;}
    else if(a.endV.equals(b.startV)&&a.startU.equals(b.startU)&&a.endU.equals(b.endU)){direction='v';parameter=a.endV;}
    if(direction===null||parameter===null)continue;
    const restrict=(f:BivariatePolynomial)=>direction==='u'?f.specializeU(parameter!):f.specializeV(parameter!),A=restrict(a.weight),B=restrict(b.weight),continuous=keys.every(k=>restrict(a[k]).mul(B).equals(restrict(b[k]).mul(A)));
    seams.push(Object.freeze({firstPatch:i,secondPatch:j,direction,parameter,continuous}));
  }
  return Object.freeze({surface,patches,seams:Object.freeze(seams),continuous:seams.every(s=>s.continuous),everyPatchRegular:patches.every(p=>p.regular)});
}
