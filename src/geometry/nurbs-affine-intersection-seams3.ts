import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {gcdBivariate,bivariateFiberRoots} from '../numeric/bivariate-system.js';
import type {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import {assertOwnedTrimmedNurbsAffineIntersection3,trimmedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-trim3.js';
import type {TrimmedNurbsAffineIntersection3,TrimmedNurbsAffineIntersectionPoint3,TrimmedNurbsAffineIntersectionPatch3} from './nurbs-affine-intersection-trim3.js';
export interface NurbsIntersectionVertexUse3 {readonly patch:number;readonly vertex:number|null;readonly edge:number|null;}
export interface NurbsIntersectionComplexVertex3 extends TrimmedNurbsAffineIntersectionPoint3 {readonly uses:readonly NurbsIntersectionVertexUse3[];}
export interface NurbsIntersectionComplexEdge3 {readonly from:number;readonly to:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly uses:readonly Readonly<{patch:number;edge:number}>[];}
export interface NurbsAffineIntersectionComplex3 {
 readonly source:TrimmedNurbsAffineIntersection3;readonly vertices:readonly NurbsIntersectionComplexVertex3[];readonly edges:readonly NurbsIntersectionComplexEdge3[];
 readonly seamContacts:readonly Readonly<{firstPatch:number;secondPatch:number;u:AlgebraicReal;v:AlgebraicReal;vertex:number}>[];
 /** Graph components only. Implicit regions are not joined or decomposed. */
 readonly curveComponents:readonly Readonly<{vertices:readonly number[];edges:readonly number[]}>[];
 readonly regions:readonly Readonly<{patch:number;region:NonNullable<TrimmedNurbsAffineIntersectionPatch3['region']>}>[];
}
const owned=new WeakSet<NurbsAffineIntersectionComplex3>(),real=(q:Rational)=>AlgebraicReal.fromRational(q),max=(a:Rational,b:Rational)=>a.compare(b)>=0?a:b,min=(a:Rational,b:Rational)=>a.compare(b)<=0?a:b;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Equal-source-parameter seam quotient. Whole intervals require polynomial
 * identities on the selected branch, never endpoint/midpoint agreement alone. */
export function sewNurbsAffineIntersection3(source:TrimmedNurbsAffineIntersection3):NurbsAffineIntersectionComplex3 {
 assertOwnedTrimmedNurbsAffineIntersection3(source);
 type V=TrimmedNurbsAffineIntersectionPoint3&{uses:NurbsIntersectionVertexUse3[]};type E={from:number;to:number;lower:AlgebraicReal;upper:AlgebraicReal;uses:{patch:number;edge:number}[]};const vertices:V[]=[],edges:E[]=[],seamContacts:NurbsAffineIntersectionComplex3['seamContacts'][number][]=[];
 const pair=(patch:number)=>source.source.equations.pairs[source.source.patches[source.patches[patch]!.sourceIntersectionPatch]!.pair]!;
 const geometry=(patch:number,edge:number)=>{const p=source.patches[patch]!,e=p.edges[edge]!,original=source.source.patches[p.sourceIntersectionPatch]!.edges[e.sourceEdge]!;return {trim:e,graph:original.graph,sourceEdge:original.sourceEdge,axis:original.graph.edges[original.sourceEdge]!.kind==='branch'?'u' as const:'v' as const};};
 const sameUV=(a:{u:AlgebraicReal;v:AlgebraicReal},b:{u:AlgebraicReal;v:AlgebraicReal})=>a.u.compare(b.u)===0&&a.v.compare(b.v)===0;
 const vertex=(point:TrimmedNurbsAffineIntersectionPoint3,use:NurbsIntersectionVertexUse3)=>{let id=vertices.findIndex(q=>sameUV(q,point)&&q.targetU.compare(point.targetU)===0&&q.targetV.compare(point.targetV)===0&&compareAlgebraicPoints3(q.point,point.point)===0);if(id<0){id=vertices.length;vertices.push({...point,uses:[]});}const uses=vertices[id]!.uses;if(!uses.some(u=>u.patch===use.patch&&u.vertex===use.vertex&&u.edge===use.edge))uses.push(Object.freeze(use));return id;};
 const originals=source.patches.map((p,patch)=>p.vertices.map((q,id)=>vertex(q,{patch,vertex:id,edge:null})));
 const onEdge=(patch:number,edge:number,u:AlgebraicReal,v:AlgebraicReal)=>{const g=geometry(patch,edge),t=g.axis==='u'?u:v;if(t.compare(g.trim.lower)<0||t.compare(g.trim.upper)>0)return false;return sameUV(evaluateAlgebraicCurveEdge2(g.graph,g.sourceEdge,t),{u,v});};
 // Discontinuous adjacent source patches can meet at isolated seam points.
 // Find every such contact before noding, including interior edge contacts.
 for(let i=0;i<source.patches.length;i++)for(let j=i+1;j<source.patches.length;j++){
  const a=pair(i).sourcePatch,b=pair(j).sourcePatch;if(a===b)continue;const u0=max(a.startU,b.startU),u1=min(a.endU,b.endU),v0=max(a.startV,b.startV),v1=min(a.endV,b.endV);if(u0.compare(u1)>0||v0.compare(v1)>0)continue;
  let axis:'u'|'v',fixed:Rational,lower:Rational,upper:Rational;if(u0.equals(u1)&&v0.compare(v1)<0){axis='u';fixed=u0;lower=v0;upper=v1;}else if(v0.equals(v1)&&u0.compare(u1)<0){axis='v';fixed=v0;lower=u0;upper=u1;}else continue;
  const A=[a.x,a.y,a.z,a.weight].map(f=>axis==='u'?f.specializeU(fixed):f.specializeV(fixed)),B=[b.x,b.y,b.z,b.weight].map(f=>axis==='u'?f.specializeU(fixed):f.specializeV(fixed)),gcd=[0,1,2].map(k=>A[k]!.mul(B[3]!).sub(B[k]!.mul(A[3]!))).reduce((g,f)=>g.gcd(f),new Polynomial());
  if(gcd.degree<=0)continue;
  for(const t of isolateRealRoots(gcd))if(t.compare(real(lower))>=0&&t.compare(real(upper))<=0){const u=axis==='u'?real(fixed):t,v=axis==='u'?t:real(fixed),left=source.patches[i]!.edges.findIndex((_,edge)=>onEdge(i,edge,u,v)),right=source.patches[j]!.edges.findIndex((_,edge)=>onEdge(j,edge,u,v));if(left<0||right<0)continue;const L=geometry(i,left),R=geometry(j,right),p=trimmedNurbsAffineIntersectionEdgePoint3(source,i,left,L.axis==='u'?u:v),q=trimmedNurbsAffineIntersectionEdgePoint3(source,j,right,R.axis==='u'?u:v);if(compareAlgebraicPoints3(p.point,q.point)!==0)throw new Error('Seam root lost exact spatial equality');const id=vertex(p,{patch:i,vertex:null,edge:left}),other=vertex(q,{patch:j,vertex:null,edge:right});if(id!==other)throw new Error('Equal seam points have inconsistent target charts');seamContacts.push(Object.freeze({firstPatch:i,secondPatch:j,u,v,vertex:id}));}
 }
 const whole=(g:ReturnType<typeof geometry>,f:BivariatePolynomial,sample:{u:AlgebraicReal;v:AlgebraicReal})=>f.degreeU<0||(g.axis==='v'?bivariateFiberRoots(f,sample.u).kind==='whole':gcdBivariate(g.graph.nonvertical,f).evaluateAlgebraic(sample.u,sample.v).sign()===0);
 const equal=(first:{patch:number;edge:number},second:{patch:number;edge:number},lower:AlgebraicReal,upper:AlgebraicReal)=>{
  const a=geometry(first.patch,first.edge),b=geometry(second.patch,second.edge);if(a.axis!==b.axis)return false;const t=between(lower,upper),sample=evaluateAlgebraicCurveEdge2(a.graph,a.sourceEdge,t),other=evaluateAlgebraicCurveEdge2(b.graph,b.sourceEdge,t);if(!sameUV(sample,other))return false;if(a.axis==='u'&&!whole(a,b.graph.nonvertical,sample))return false;
  const P=pair(first.patch).sourcePatch,Q=pair(second.patch).sourcePatch;return P===Q||(['x','y','z'] as const).every(k=>whole(a,P[k].mul(Q.weight).sub(Q[k].mul(P.weight)),sample));
 };
 source.patches.forEach((p,patch)=>p.edges.forEach((e,edge)=>{
  const g=geometry(patch,edge),cuts:{t:AlgebraicReal;vertex:number}[]=[{t:e.lower,vertex:originals[patch]![e.from]!},{t:e.upper,vertex:originals[patch]![e.to]!}];
  vertices.forEach((q,id)=>{const t=q[g.axis];if(t.compare(e.lower)<=0||t.compare(e.upper)>=0||cuts.some(c=>c.t.compare(t)===0)||!onEdge(patch,edge,q.u,q.v)||compareAlgebraicPoints3(liftNurbsSectionPatch3(pair(patch).sourcePatch,q.u,q.v),q.point)!==0)return;cuts.push({t,vertex:id});vertex(q,{patch,vertex:null,edge});});cuts.sort((a,b)=>a.t.compare(b.t));
  for(let i=0;i+1<cuts.length;i++){const a=cuts[i]!,b=cuts[i+1]!,use=Object.freeze({patch,edge}),prior=edges.find(e=>e.from===a.vertex&&e.to===b.vertex&&equal(use,e.uses[0]!,a.t,b.t));if(prior)prior.uses.push(use);else edges.push({from:a.vertex,to:b.vertex,lower:a.t,upper:b.t,uses:[use]});}
 }));
 const parents=vertices.map((_,i)=>i),root=(v:number):number=>{while(parents[v]!==v){parents[v]=parents[parents[v]!]!;v=parents[v]!;}return v;};edges.forEach(e=>{const a=root(e.from),b=root(e.to);parents[Math.max(a,b)]=Math.min(a,b);});const groups=new Map<number,{vertices:number[];edges:number[]}>(),group=(id:number)=>{const key=root(id);let g=groups.get(key);if(!g){g={vertices:[],edges:[]};groups.set(key,g);}return g;};vertices.forEach((_,i)=>group(i).vertices.push(i));edges.forEach((e,i)=>group(e.from).edges.push(i));
 const result=Object.freeze({source,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,uses:Object.freeze(v.uses)}))),edges:Object.freeze(edges.map(e=>Object.freeze({...e,uses:Object.freeze(e.uses)}))),seamContacts:Object.freeze(seamContacts),curveComponents:Object.freeze([...groups.values()].map(g=>Object.freeze({vertices:Object.freeze(g.vertices),edges:Object.freeze(g.edges)}))),regions:Object.freeze(source.patches.flatMap((p,patch)=>p.region?[Object.freeze({patch,region:p.region})]:[]))});owned.add(result);return result;
}
export function assertOwnedNurbsAffineIntersectionComplex3(report:NurbsAffineIntersectionComplex3):void {if(!owned.has(report))throw new RangeError('Operation requires a factory-created intersection seam complex');}
export function nurbsAffineIntersectionComplexEdgePoint3(report:NurbsAffineIntersectionComplex3,edge:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionPoint3 {
 assertOwnedNurbsAffineIntersectionComplex3(report);if(!Number.isSafeInteger(edge)||edge<0||edge>=report.edges.length)throw new RangeError('Invalid seam complex edge');const e=report.edges[edge]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the seam complex edge');const use=e.uses[0]!;return trimmedNurbsAffineIntersectionEdgePoint3(report.source,use.patch,use.edge,t);
}
