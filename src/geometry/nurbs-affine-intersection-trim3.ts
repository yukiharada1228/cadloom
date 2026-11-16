import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {homogeneousBivariateSubstitution} from '../numeric/bivariate-substitution.js';
import type {ExactInput} from './point2.js';
import {assertOwnedAffineNurbsFace3} from './affine-nurbs-face3.js';
import type {AffineNurbsFace3} from './affine-nurbs-face3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import {prepareNurbsDomainPolynomialPartition2} from './nurbs-domain-polynomial-partition2.js';
import {prepareAlgebraicCurvePolynomialCuts2,witnessBivariatePartition2} from './algebraic-curve-inequalities2.js';
import {assertOwnedNurbsAffineIntersection3,intersectNurbsSurfaceAffineTarget3,nurbsAffineIntersectionEdgePoint3,nurbsAffineIntersectionRegionPoint3} from './nurbs-affine-intersection3.js';
import type {NurbsAffineIntersection3} from './nurbs-affine-intersection3.js';
import {nurbsAffineIntersectionCandidate3} from './nurbs-affine-intersection-equations3.js';
import type {NurbsAffineIntersectionPoint3} from './nurbs-affine-intersection-equations3.js';
export interface TrimmedNurbsAffineIntersectionPoint3 extends NurbsAffineIntersectionPoint3 {readonly sourceLocation:'inside'|'boundary';readonly targetLocation:'inside'|'boundary';}
export interface TrimmedNurbsAffineIntersectionEdge3 {readonly sourceEdge:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly from:number;readonly to:number;readonly sourceLocation:'inside'|'boundary';readonly targetLocation:'inside'|'boundary';}
export interface TrimmedNurbsAffineIntersectionPatch3 {
 readonly sourceIntersectionPatch:number;readonly vertices:readonly TrimmedNurbsAffineIntersectionPoint3[];readonly edges:readonly TrimmedNurbsAffineIntersectionEdge3[];
 /** Nonempty closed implicit set; no dimension/connectedness assertion. */
 readonly region:Readonly<{witness:TrimmedNurbsAffineIntersectionPoint3;contains(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):boolean}>|null;
}
export interface TrimmedNurbsAffineIntersection3 {readonly source:NurbsAffineIntersection3;readonly sourceDomain:PreparedNurbsParameterDomain2;readonly targetDomain:PreparedNurbsParameterDomain2;readonly patches:readonly TrimmedNurbsAffineIntersectionPatch3[];readonly empty:boolean;}
const owned=new WeakSet<TrimmedNurbsAffineIntersection3>();
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Restrict both parameter domains using support, finite endpoint and critical
 * projection strata. Implicit support equality never substitutes for locate. */
export function trimNurbsAffineIntersection3(source:NurbsAffineIntersection3,inputSource:PreparedNurbsParameterDomain2,inputTarget:PreparedNurbsParameterDomain2):TrimmedNurbsAffineIntersection3 {
 assertOwnedNurbsAffineIntersection3(source);const sourceDomain=prepareNurbsParameterDomain2(inputSource.outer,inputSource.holes,inputSource.sense),targetDomain=prepareNurbsParameterDomain2(inputTarget.outer,inputTarget.holes,inputTarget.sense),sourcePartition=prepareNurbsDomainPolynomialPartition2(sourceDomain),targetPartition=prepareNurbsDomainPolynomialPartition2(targetDomain),patches:TrimmedNurbsAffineIntersectionPatch3[]=[];
 const classify=(point:NurbsAffineIntersectionPoint3):TrimmedNurbsAffineIntersectionPoint3|null=>{const sourceLocation=sourceDomain.locate(point.u,point.v),targetLocation=targetDomain.locate(point.targetU,point.targetV);return sourceLocation==='outside'||targetLocation==='outside'?null:Object.freeze({...point,sourceLocation,targetLocation});};
 source.patches.forEach((p,sourceIntersectionPatch)=>{
  const pair=source.equations.pairs[p.pair]!,a=pair.sourcePatch,b=pair.targetPatch,bounds={uMin:a.startU,uMax:a.endU,vMin:a.startV,vMax:a.endV},A=pair.uNumerator,B=pair.vNumerator,W=a.weight,polynomials=[...sourcePartition(bounds),...targetPartition({uMin:b.startU,uMax:b.endU,vMin:b.startV,vMax:b.endV}).map(f=>homogeneousBivariateSubstitution(f,A,B,W))],vertices:TrimmedNurbsAffineIntersectionPoint3[]=[],edges:TrimmedNurbsAffineIntersectionEdge3[]=[];
  const add=(point:TrimmedNurbsAffineIntersectionPoint3)=>{let id=vertices.findIndex(q=>q.u.compare(point.u)===0&&q.v.compare(point.v)===0);if(id<0){id=vertices.length;vertices.push(point);}return id;};
  p.vertices.forEach(point=>{const q=classify(point);if(q)add(q);});
  const partitions=new Map<object,ReturnType<typeof prepareAlgebraicCurvePolynomialCuts2>>();
  p.edges.forEach((e,sourceEdge)=>{
   let partition=partitions.get(e.graph);if(!partition){partition=prepareAlgebraicCurvePolynomialCuts2(e.graph,polynomials);partitions.set(e.graph,partition);}const cuts=partition(e.sourceEdge,e.lower,e.upper),ids=new Map<AlgebraicReal,number>();
   for(const t of cuts){const q=classify(nurbsAffineIntersectionEdgePoint3(source,sourceIntersectionPatch,sourceEdge,t));if(q)ids.set(t,add(q));}
   for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!,sample=classify(nurbsAffineIntersectionEdgePoint3(source,sourceIntersectionPatch,sourceEdge,between(lower,upper)));if(!sample)continue;const from=ids.get(lower),to=ids.get(upper);if(from===undefined||to===undefined)throw new Error('Closed double trim lost an interval endpoint');edges.push(Object.freeze({sourceEdge,lower,upper,from,to,sourceLocation:sample.sourceLocation,targetLocation:sample.targetLocation}));}
  });
  let region:TrimmedNurbsAffineIntersectionPatch3['region']=null;
  if(p.region){
   const constraints=[A.sub(W.scale(b.startU)),W.scale(b.endU).sub(A),B.sub(W.scale(b.startV)),W.scale(b.endV).sub(B)],candidate=(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput)=>{const point=nurbsAffineIntersectionCandidate3(source.equations,p.pair,u,v);return point?classify(point):null;},witness=witnessBivariatePartition2([...polynomials,...constraints],bounds,q=>candidate(q.u,q.v)!==null);
   if(witness){const point=candidate(witness.u,witness.v);if(!point)throw new Error('Trim witness lost its membership');region=Object.freeze({witness:point,contains:(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput)=>candidate(u,v)!==null});}
  }
  if(vertices.length||edges.length||region)patches.push(Object.freeze({sourceIntersectionPatch,vertices:Object.freeze(vertices),edges:Object.freeze(edges),region}));
 });
 const report=Object.freeze({source,sourceDomain,targetDomain,patches:Object.freeze(patches),empty:patches.length===0});owned.add(report);return report;
}
function patchAt(report:TrimmedNurbsAffineIntersection3,patch:number):TrimmedNurbsAffineIntersectionPatch3 {if(!owned.has(report))throw new RangeError('Operation requires a factory-created trimmed NURBS intersection');if(!Number.isSafeInteger(patch)||patch<0||patch>=report.patches.length)throw new RangeError('Invalid trimmed intersection patch');return report.patches[patch]!;}
function located(report:TrimmedNurbsAffineIntersection3,point:NurbsAffineIntersectionPoint3):TrimmedNurbsAffineIntersectionPoint3 {const sourceLocation=report.sourceDomain.locate(point.u,point.v),targetLocation=report.targetDomain.locate(point.targetU,point.targetV);if(sourceLocation==='outside'||targetLocation==='outside')throw new RangeError('Point is outside a trim domain');return Object.freeze({...point,sourceLocation,targetLocation});}
export function trimmedNurbsAffineIntersectionEdgePoint3(report:TrimmedNurbsAffineIntersection3,patch:number,edge:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionPoint3 {
 const p=patchAt(report,patch);if(!Number.isSafeInteger(edge)||edge<0||edge>=p.edges.length)throw new RangeError('Invalid trimmed intersection edge');const e=p.edges[edge]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the trimmed intersection edge');return located(report,nurbsAffineIntersectionEdgePoint3(report.source,p.sourceIntersectionPatch,e.sourceEdge,t));
}
export function trimmedNurbsAffineIntersectionRegionPoint3(report:TrimmedNurbsAffineIntersection3,patch:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionPoint3 {const p=patchAt(report,patch);if(!p.region)throw new RangeError('Trimmed intersection patch has no region');return located(report,nurbsAffineIntersectionRegionPoint3(report.source,p.sourceIntersectionPatch,u,v));}

/** Direct finite-face intersection; both inputs retain their trim contracts. */
export function intersectAffineNurbsFaces3(first:AffineNurbsFace3,second:AffineNurbsFace3):TrimmedNurbsAffineIntersection3 {assertOwnedAffineNurbsFace3(first);assertOwnedAffineNurbsFace3(second);return trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(first.projection.surface,second.projection),first.domain,second.domain);}
