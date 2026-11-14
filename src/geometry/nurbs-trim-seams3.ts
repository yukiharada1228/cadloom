import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';
import {nurbsSurfaceSeams3} from './nurbs-surface-regularity3.js';
import type {NurbsSurfaceSeam3} from './nurbs-surface-regularity3.js';
import {liftNurbsSurfaceBoundary3} from './nurbs-surface-boundary3.js';

export interface NurbsTrimSeamState3 {
  readonly continuous:boolean;
  /** Equal partial derivatives in the original common (u,v) coordinates. */
  readonly c1:boolean;
  /** Equal cooriented tangent planes with nonzero one-sided normals. */
  readonly g1:boolean;
}
export interface NurbsTrimSeamPoint3 extends NurbsTrimSeamState3 {
  readonly parameter:AlgebraicReal;readonly location:'inside'|'boundary';
}
export interface NurbsTrimSeamInterval3 extends NurbsTrimSeamState3 {
  readonly startParameter:AlgebraicReal;readonly endParameter:AlgebraicReal;
  /** Location and states are constant on the OPEN interval. */
  readonly location:'inside'|'boundary';
}
export interface NurbsTrimSeam3 {
  readonly source:NurbsSurfaceSeam3;
  /** Transverse coordinate: v on u seams, u on v seams. */
  readonly points:readonly NurbsTrimSeamPoint3[];readonly intervals:readonly NurbsTrimSeamInterval3[];
  readonly continuous:boolean;readonly c1:boolean;readonly g1:boolean;
}
export interface NurbsTrimSeams3 extends NurbsTrimSeamState3 {
  readonly surface:NurbsSurface3;readonly domain:PreparedNurbsParameterDomain2;readonly seams:readonly NurbsTrimSeam3[];
}
const real=(x:Rational)=>AlgebraicReal.fromRational(x),keys=['x','y','z'] as const;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
function equations(a:NurbsSurfacePatch3,b:NurbsSurfacePatch3,s:NurbsSurfaceSeam3){
  const restrict=(f:NurbsSurfacePatch3['weight'])=>s.direction==='u'?f.specializeU(s.parameter):f.specializeV(s.parameter),A=restrict(a.weight),B=restrict(b.weight),A2=A.mul(A),B2=B.mul(B),position=keys.map(k=>restrict(a[k]).mul(B).sub(restrict(b[k]).mul(A)));
  const partial=(p:NurbsSurfacePatch3,axis:'u'|'v')=>{const d=(f:NurbsSurfacePatch3['weight'])=>axis==='u'?f.derivativeU():f.derivativeV();return keys.map(k=>restrict(d(p[k]).mul(p.weight).sub(p[k].mul(d(p.weight)))));};
  const au=partial(a,'u'),av=partial(a,'v'),bu=partial(b,'u'),bv=partial(b,'v'),derivatives=[...au.map((f,i)=>f.mul(B2).sub(bu[i]!.mul(A2))),...av.map((f,i)=>f.mul(B2).sub(bv[i]!.mul(A2)))];
  const cross=(u:readonly Polynomial[],v:readonly Polynomial[])=>[0,1,2].map(i=>{const j=(i+1)%3,k=(i+2)%3;return u[j]!.mul(v[k]!).sub(u[k]!.mul(v[j]!));}),na=cross(au,av),nb=cross(bu,bv),planes=cross(na,nb),dot=na.reduce((sum,f,i)=>sum.add(f.mul(nb[i]!)),new Polynomial());
  const at=(t:AlgebraicReal):NurbsTrimSeamState3=>{const zero=(p:Polynomial)=>t.signOf(p)===0,continuous=position.every(zero);return Object.freeze({continuous,c1:continuous&&derivatives.every(zero),g1:continuous&&planes.every(zero)&&t.signOf(dot)>0});};
  return {polynomials:[...position,...derivatives,...planes,dot],at};
}
/** Exact position, C1 and cooriented tangent-plane matching on retained seams.
 * All adjacent one-sided closed patches are compared, even at boundary contacts.
 * This does not establish global injectivity or a spatial face embedding.
 */
export function analyzeNurbsTrimSeams3(input:NurbsSurface3,inputDomain:PreparedNurbsParameterDomain2):NurbsTrimSeams3 {
  const surface=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),domain=prepareNurbsParameterDomain2(inputDomain.outer,inputDomain.holes,inputDomain.sense),raw=nurbsSurfacePatches3(surface),curves=[domain.outer,...domain.holes].flat();
  for(const c of curves)liftNurbsSurfaceBoundary3(surface,c); // Validate whole-boundary active-domain containment.
  const seams=Object.freeze(nurbsSurfaceSeams3(raw).map(source=>{
    const a=raw[source.firstPatch]!,b=raw[source.secondPatch]!,axis=source.direction==='u'?'y':'x',lo=source.direction==='u'?a.startV:a.startU,hi=source.direction==='u'?a.endV:a.endU,cuts=[real(lo),real(hi)],eq=equations(a,b,source);
    const add=(t:AlgebraicReal)=>{if(t.compare(real(lo))>=0&&t.compare(real(hi))<=0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);};
    for(const c of curves)for(const span of nurbsCurveSpans3(c)){
      const N=source.direction==='u'?span.x:span.y,f=N.sub(span.weight.scale(source.parameter)),roots=f.degree<0?[real(span.startParameter),real(span.endParameter)]:isolateRealRoots(f).filter(t=>t.compare(real(span.startParameter))>=0&&t.compare(real(span.endParameter))<=0);
      for(const t of roots)add(evaluateNurbsSpanPoint3(span,t)[axis]);
    }
    // Every predicate can change only at a root of one of these polynomials.
    for(const p of eq.polynomials)if(p.degree>0)for(const t of isolateRealRoots(p))add(t);
    cuts.sort((a,b)=>a.compare(b));
    const locate=(t:AlgebraicReal):NurbsDomainLocation2=>source.direction==='u'?domain.locate(source.parameter,t):domain.locate(t,source.parameter),points:NurbsTrimSeamPoint3[]=[],intervals:NurbsTrimSeamInterval3[]=[];
    for(const t of cuts){const location=locate(t);if(location!=='outside')points.push(Object.freeze({parameter:t,location,...eq.at(t)}));}
    for(let i=0;i+1<cuts.length;i++){const startParameter=cuts[i]!,endParameter=cuts[i+1]!,sample=real(between(startParameter,endParameter)),location=locate(sample);if(location!=='outside')intervals.push(Object.freeze({startParameter,endParameter,location,...eq.at(sample)}));}
    const states=[...points,...intervals];return Object.freeze({source,points:Object.freeze(points),intervals:Object.freeze(intervals),continuous:states.every(s=>s.continuous),c1:states.every(s=>s.c1),g1:states.every(s=>s.g1)});
  }));
  return Object.freeze({surface,domain,seams,continuous:seams.every(s=>s.continuous),c1:seams.every(s=>s.c1),g1:seams.every(s=>s.g1)});
}
