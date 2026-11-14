import {Rational} from '../numeric/rational.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {BivariateRoot} from '../numeric/bivariate-system.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import {analyzeNurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import type {NurbsSurfaceRegularity3,NurbsPatchRegularity3,NurbsSurfaceSingularPoint3} from './nurbs-surface-regularity3.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';
import {liftNurbsSurfaceBoundary3,nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';

export interface NurbsTrimSingularEdge3 {
  readonly sourceEdge:number;
  /** u for ordinary graph branches, v for vertical edges. */
  readonly startParameter:AlgebraicReal;readonly endParameter:AlgebraicReal;
  readonly start:BivariateRoot;readonly end:BivariateRoot;readonly sample:BivariateRoot;
  /** Classification of the whole OPEN interval; endpoints are retained too. */
  readonly location:'inside'|'boundary';
}
export interface NurbsTrimPatchRegularity3 {
  readonly source:NurbsPatchRegularity3;
  /** Retained finite solutions, graph vertices, boundary events and region witnesses;
   * not only isolated points. */
  readonly points:readonly BivariateRoot[];
  readonly edges:readonly NurbsTrimSingularEdge3[];
  /** Exact nonempty intersection of a wholly singular patch with the domain.
   * The intersection can have lower dimension at boundary-only contacts.
   */
  readonly region:Readonly<{domain:PreparedNurbsParameterDomain2;patch:NurbsSurfacePatch3}>|null;
  readonly regular:boolean;
}
export interface NurbsTrimRegularity3 {
  readonly domain:PreparedNurbsParameterDomain2;readonly support:NurbsSurfaceRegularity3;
  readonly patches:readonly NurbsTrimPatchRegularity3[];
  /** Rank two for each incident one-sided patch at every retained parameter.
   * Not a positional seam, G1, injectivity, face or solid certificate.
   */
  readonly regular:boolean;
}
const owned=new WeakSet<NurbsTrimRegularity3>();
const real=(x:Rational)=>AlgebraicReal.fromRational(x);
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
function same(a:BivariateRoot,b:BivariateRoot):boolean{return a.u.compare(b.u)===0&&a.v.compare(b.v)===0;}
function inPatch(q:BivariateRoot,p:NurbsSurfacePatch3):boolean{return q.u.compare(real(p.startU))>=0&&q.u.compare(real(p.endU))<=0&&q.v.compare(real(p.startV))>=0&&q.v.compare(real(p.endV))<=0;}
/** Clip complete one-sided singular loci to a validated closed trim domain.
 * Singular area pieces remain implicit domain/rectangle intersections.
 */
export function analyzeNurbsTrimRegularity3(input:NurbsSurface3,inputDomain:PreparedNurbsParameterDomain2):NurbsTrimRegularity3 {
  // Revalidate geometry instead of trusting caller-provided methods/metadata.
  const domain=prepareNurbsParameterDomain2(inputDomain.outer,inputDomain.holes,inputDomain.sense),support=analyzeNurbsSurfaceRegularity3(input),curves=[domain.outer,...domain.holes].flat(),boundarySamples:BivariateRoot[]=[];
  for(const c of curves){
    const lifted=liftNurbsSurfaceBoundary3(support.surface,c),spans=nurbsCurveSpans3(c);
    for(const p of lifted.pieces){const s=spans.find(s=>s.index===p.curveSpan)!;for(const t of [p.startParameter,p.endParameter,real(between(p.startParameter,p.endParameter))]){const q=evaluateNurbsSpanPoint3(s,t);boundarySamples.push(Object.freeze({u:q.x,v:q.y}));}}
  }
  const patches=Object.freeze(support.patches.map(source=>{
    const points:BivariateRoot[]=[],edges:NurbsTrimSingularEdge3[]=[],graph=source.locus,p=source.patch,retained=(q:BivariateRoot)=>domain.locate(q.u,q.v)!=='outside';
    const add=(q:BivariateRoot)=>{if(inPatch(q,p)&&retained(q)&&!points.some(a=>same(a,q)))points.push(Object.freeze({u:q.u,v:q.v}));};
    source.points.forEach(add);
    let region:NurbsTrimPatchRegularity3['region']=null;
    if(graph?.kind==='area'){
      const candidates=[...boundarySamples,{u:real(domain.sample.u),v:real(domain.sample.v)},...([p.startU,p.endU].flatMap(u=>[p.startV,p.endV].map(v=>({u:real(u),v:real(v)}))))];
      const witness=candidates.find(q=>inPatch(q,p)&&retained(q));if(witness){region=Object.freeze({domain,patch:p});add(witness);}
    }else if(graph){
      const events:BivariateRoot[]=[];graph.vertices.forEach(add);
      for(const c of curves)for(const s of nurbsCurveSpans3(c)){
        const f=nurbsParameterPolynomial3(graph.polynomial,s),ts=f.degree<0?[real(s.startParameter),real(s.endParameter)]:isolateRealRoots(f).filter(t=>t.compare(real(s.startParameter))>=0&&t.compare(real(s.endParameter))<=0);
        for(const t of ts){const q=evaluateNurbsSpanPoint3(s,t),uv=Object.freeze({u:q.x,v:q.y});if(inPatch(uv,p)&&!events.some(a=>same(a,uv))){events.push(uv);add(uv);}}
      }
      graph.edges.forEach((e,sourceEdge)=>{
        const axis=e.kind==='branch'?'u':'v',a=graph.vertices[e.from]!,b=graph.vertices[e.to]!,cuts=[a[axis],b[axis]];
        for(const q of events){const t=q[axis];if(t.compare(a[axis])>0&&t.compare(b[axis])<0&&same(evaluateAlgebraicCurveEdge2(graph,sourceEdge,t),q)&&!cuts.some(c=>c.compare(t)===0))cuts.push(t);}
        cuts.sort((a,b)=>a.compare(b));
        for(let i=0;i+1<cuts.length;i++){
          const startParameter=cuts[i]!,endParameter=cuts[i+1]!,sample=evaluateAlgebraicCurveEdge2(graph,sourceEdge,between(startParameter,endParameter)),location=domain.locate(sample.u,sample.v);
          if(location==='outside')continue;
          const start=evaluateAlgebraicCurveEdge2(graph,sourceEdge,startParameter),end=evaluateAlgebraicCurveEdge2(graph,sourceEdge,endParameter);add(start);add(end);
          edges.push(Object.freeze({sourceEdge,startParameter,endParameter,start,end,sample,location}));
        }
      });
    }
    points.sort((a,b)=>a.u.compare(b.u)||a.v.compare(b.v));
    return Object.freeze({source,points:Object.freeze(points),edges:Object.freeze(edges),region,regular:region===null&&points.length===0&&edges.length===0});
  }));
  const result=Object.freeze({domain,support,patches,regular:patches.every(p=>p.regular)});owned.add(result);return result;
}

/** Evaluate only the retained closed subinterval, preserving one-sided patch geometry. */
export function evaluateNurbsTrimSingularEdge3(report:NurbsTrimRegularity3,patchIndex:number,edgeIndex:number,parameter:AlgebraicReal|ExactInput):NurbsSurfaceSingularPoint3 {
  if(!owned.has(report))throw new RangeError('Evaluation requires a factory-created trim regularity report');
  if(!Number.isSafeInteger(patchIndex)||patchIndex<0||patchIndex>=report.patches.length)throw new RangeError('Invalid trim patch index');
  const p=report.patches[patchIndex]!;
  if(!Number.isSafeInteger(edgeIndex)||edgeIndex<0||edgeIndex>=p.edges.length)throw new RangeError('Invalid trimmed singular edge index');
  const e=p.edges[edgeIndex]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);
  if(t.compare(e.startParameter)<0||t.compare(e.endParameter)>0)throw new RangeError('Parameter is outside the retained singular edge');
  const q=evaluateAlgebraicCurveEdge2(p.source.locus!,e.sourceEdge,t),patch=p.source.patch,W=patch.weight;
  return Object.freeze({...q,point:algebraicCoordinates3(patch.x.rationalImage(q.u,q.v,W),patch.y.rationalImage(q.u,q.v,W),patch.z.rationalImage(q.u,q.v,W))});
}
