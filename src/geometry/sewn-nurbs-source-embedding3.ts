import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import type {BivariateRoot} from '../numeric/bivariate-system.js';
import type {CurveRectangle2} from './algebraic-curve-topology2.js';
import {assertOwnedSewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import type {SewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {nurbsSourceComplexFacePointPreimage3} from './nurbs-source-complex-face-preimage3.js';
import {locateNurbsSourceFace3} from './nurbs-source-face-location3.js';
import {prepareNurbsSourceFacePolynomialPartition3} from './nurbs-source-face-partition3.js';
import {witnessBivariatePartition2} from './algebraic-curve-inequalities2.js';
export interface NurbsSourceFaceSeparation3 {
 readonly first:number;readonly second:number;readonly normal:Point3;readonly offset:Rational;readonly firstSign:1|-1;
 /** The zero section on this face lies only on declared shared incidence. */
 readonly coveredBy:'first'|'second';
}
/** Search inputs only: every proposed plane is checked over whole faces. */
export interface NurbsSourceFaceSeparationHint3 {readonly first:number;readonly second:number;readonly normal:Point3;readonly offset:Rational;}
export interface SewnNurbsSourceEmbeddingCertificate3 {readonly source:Extract<SewnNurbsSourceBReps3,{kind:'sewn'}>;readonly separations:readonly NurbsSourceFaceSeparation3[];}
export type SewnNurbsSourceEmbedding3=
 | Readonly<{kind:'certified';certificate:SewnNurbsSourceEmbeddingCertificate3}>
 | Readonly<{kind:'not-certified';source:SewnNurbsSourceBReps3;reason:'unresolved-sewing'|'open-or-nonmanifold-incidence'|'no-supported-separation'|'face-query-unresolved';pair?:readonly [number,number]}>;
const owned=new WeakSet<SewnNurbsSourceEmbeddingCertificate3>(),one=new BivariatePolynomial([[1n]]),keys=['x','y','z'] as const;
export function assertOwnedSewnNurbsSourceEmbedding3(c:SewnNurbsSourceEmbeddingCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created sewn NURBS embedding certificate');}
/** Sufficient pairwise geometric embedding certificate. Failure of the finite
 * plane search is not a claim that the input actually self-intersects. */
export function certifySewnNurbsSourceEmbedding3(input:SewnNurbsSourceBReps3,hints:readonly NurbsSourceFaceSeparationHint3[]=[]):SewnNurbsSourceEmbedding3 {
 assertOwnedSewnNurbsSourceBReps3(input);if(input.kind!=='sewn')return Object.freeze({kind:'not-certified',source:input,reason:'unresolved-sewing'});
 const T=input.topology;if(!T.closedOrientedIncidence)return Object.freeze({kind:'not-certified',source:input,reason:'open-or-nonmanifold-incidence'});
 const planes=new Map<string,Readonly<{normal:Point3;offset:Rational}>[]>();
 for(const h of hints){
  if(!Number.isSafeInteger(h.first)||!Number.isSafeInteger(h.second)||h.first<0||h.first>=h.second||h.second>=T.faces.length)throw new RangeError('Invalid NURBS separation hint face pair');
  const normal=point3(h.normal.x,h.normal.y,h.normal.z),offset=point3(h.offset,0n,0n).x;
  if([normal.x,normal.y,normal.z].every(q=>q.sign()===0))throw new RangeError('NURBS separation hint normal must be nonzero');
  const key=h.first+'|'+h.second,list=planes.get(key)??[];list.push(Object.freeze({normal,offset}));planes.set(key,list);
 }
 const real=(q:Rational)=>AlgebraicReal.fromRational(q),min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;
 const owners=input.sources.flatMap((source,index)=>source.topology.faces.map(()=>({source,index}))),contexts=T.faces.map((face,id)=>{
  const owner=owners[id]!;if(owner.source!==face.surface.source)throw new Error('Sewn face input order changed');const source=owner.source,complex=source.complex,L=complex.source.source,F=L.source,sourceFace=face.surface.face,proof=complex.embedding.faces.find(f=>f.face===sourceFace),rank=complex.embedding.rank;
  if(!proof||proof.kind!=='certified'||rank.kind!=='analyzed'||rank.interior.kind!=='analyzed')throw new Error('Sewn face lost local embedding proof');
  const bounds:CurveRectangle2=proof.method==='triangular'?proof.certificate.bounds:{uMin:proof.certificate.surface.startU,uMax:proof.certificate.surface.endU,vMin:proof.certificate.surface.startV,vMax:proof.certificate.surface.endV},sample=F.faces[sourceFace]!.sample,q=evaluateNurbsSourceComplexFace3(complex,sourceFace,sample.u,sample.v);if(q.kind!=='point')throw new Error('Sewn face lost rational interior sample');
  const rational=(a:AlgebraicReal)=>{const q=a.recognizeRational().rational;if(q===null)throw new Error('Rational parameter sample has a nonrational NURBS value');return q;},point=point3(rational(q.point.x),rational(q.point.y),rational(q.point.z)),normal=rank.interior.support.patches[q.images[0]!.patch]!,n=point3(normal.normalX.evaluate(sample.u,sample.v),normal.normalY.evaluate(sample.u,sample.v),normal.normalZ.evaluate(sample.u,sample.v));
  const patches=L.patches.flatMap((p,patch)=>{const b={uMin:max(p.startU,bounds.uMin),uMax:min(p.endU,bounds.uMax),vMin:max(p.startV,bounds.vMin),vMax:min(p.endV,bounds.vMax)};return b.uMin.compare(b.uMax)<0&&b.vMin.compare(b.vMax)<0?[{p,patch,bounds:b}]:[];}),vertices=new Set(T.coedges.filter(c=>c.face===id).flatMap(c=>[c.origin,c.target]));
  return {id,index:owner.index,source,sourceFace,complex,L,F,point,normal:n,patches,vertices,partition:prepareNurbsSourceFacePolynomialPartition3(complex.source)};
 });
 type Context=typeof contexts[number];
 const normalise=(p:Point3)=>{const first=keys.map(k=>p[k]).find(q=>q.sign()!==0);return first?point3(p.x.div(first),p.y.div(first),p.z.div(first)):null;},dot=(n:Point3,p:Point3)=>n.x.mul(p.x).add(n.y.mul(p.y)).add(n.z.mul(p.z));
 const base:Point3[]=[];for(const x of [0n,1n])for(const y of [-1n,0n,1n])for(const z of [-1n,0n,1n]){const n=normalise(point3(x,y,z));if(n&&!base.some(q=>keys.every(k=>q[k].compare(n[k])===0)))base.push(n);}
 let unresolved=false;
 const halfCache=new Map<string,boolean>(),coverCache=new Map<string,boolean>(),vertexCache=new Map<string,Readonly<{u:AlgebraicReal;v:AlgebraicReal}>|null>();
 const key=(n:Point3,c:Rational)=>[n.x,n.y,n.z,c].map(q=>q.toString()).join('|'),polynomial=(p:Context['patches'][number]['p'],n:Point3,c:Rational)=>p.x.scale(n.x).add(p.y.scale(n.y)).add(p.z.scale(n.z)).sub(p.weight.scale(c));
 const belongs=(f:Context,patch:number,q:BivariateRoot)=>{const a=evaluateNurbsSourceComplexFace3(f.complex,f.sourceFace,q.u,q.v);if(a.kind==='unresolved'){unresolved=true;return false;}return a.kind==='point'&&a.images.some(image=>image.patch===patch);};
 const half=(f:Context,n:Point3,c:Rational,sign:1|-1)=>{
  const k=f.id+'|'+sign+'|'+key(n,c),prior=halfCache.get(k);if(prior!==undefined)return prior;if(dot(n,f.point).sub(c).sign()*sign<0){halfCache.set(k,false);return false;}
  for(const p of f.patches){const G=polynomial(p.p,n,c).scale(BigInt(sign)),negative=(q:BivariateRoot)=>G.rationalImage(q.u,q.v,one).sign()<0,coarse=witnessBivariatePartition2([G],p.bounds,negative);if(!coarse)continue;
   if(belongs(f,p.patch,coarse)||witnessBivariatePartition2([...f.partition(p.bounds),G],p.bounds,q=>negative(q)&&belongs(f,p.patch,q))){halfCache.set(k,false);return false;}
  }if(unresolved){halfCache.set(k,false);return false;}halfCache.set(k,true);return true;
 };
 const covered=(f:Context,other:Context,n:Point3,c:Rational)=>{
  const k=f.id+'|'+other.id+'|'+key(n,c),prior=coverCache.get(k);if(prior!==undefined)return prior;
  const vertexUV:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>[]=[],grids:BivariatePolynomial[]=[];
  for(const vertex of f.vertices)if(other.vertices.has(vertex)){const vk=f.id+'|'+vertex;let uv=vertexCache.get(vk);if(uv===undefined){const q=nurbsSourceComplexFacePointPreimage3(f.complex,f.sourceFace,T.vertices[vertex]!);if(q.kind!=='point')unresolved=true;uv=q.kind==='point'?{u:q.u,v:q.v}:null;vertexCache.set(vk,uv);}if(uv===null){coverCache.set(k,false);return false;}vertexUV.push(uv);grids.push(new BivariatePolynomial(uv.u.recognizeRational().polynomial.coefficients.map(q=>[q])),new BivariatePolynomial([uv.v.recognizeRational().polynomial.coefficients]));}
  const sharedEdges=f.complex.edges.flatMap((e,edge)=>{if(!e.uses.some(u=>u.face===f.sourceFace))return [];const children=input.sourceUses[f.index]![edge]!;return children.length&&children.every(child=>T.edges[child.edge]!.coedges.some(h=>T.coedges[h]!.face===other.id))?[edge]:[];});
  const allowed=(q:BivariateRoot)=>{
   if(vertexUV.some(v=>v.u.compare(q.u)===0&&v.v.compare(q.v)===0))return true;
   const where=locateNurbsSourceFace3(f.F,q.u,q.v);if(where.kind==='unresolved'){unresolved=true;return false;}if(where.kind==='face')return false;
   return sharedEdges.some(id=>{const e=f.complex.edges[id]!,axis=f.L.edges[e.sourceEdge]!.axis,t=axis==='u'?q.u:q.v;return where.edges.includes(e.sourceEdge)&&t.compare(e.lower)>=0&&t.compare(e.upper)<=0;});
  };
  for(const p of f.patches){const G=polynomial(p.p,n,c),zero=(q:BivariateRoot)=>G.rationalImage(q.u,q.v,one).sign()===0;
   if(witnessBivariatePartition2([...f.partition(p.bounds),...grids,G],p.bounds,q=>zero(q)&&belongs(f,p.patch,q)&&!allowed(q))){coverCache.set(k,false);return false;}
  }if(unresolved){coverCache.set(k,false);return false;}coverCache.set(k,true);return true;
 };
 const separations:NurbsSourceFaceSeparation3[]=[];
 for(let a=0;a<contexts.length;a++)for(let b=a+1;b<contexts.length;b++){
  const A=contexts[a]!,B=contexts[b]!,normals:Point3[]=[];for(const q of [A.normal,B.normal,...base]){const n=normalise(q);if(n&&!normals.some(p=>keys.every(k=>p[k].compare(n[k])===0)))normals.push(n);}
  let found:NurbsSourceFaceSeparation3|undefined;
  hinted:for(const {normal,offset} of planes.get(a+'|'+b)??[])for(const firstSign of [1,-1] as const){
   if(!half(A,normal,offset,firstSign)||!half(B,normal,offset,(-firstSign) as 1|-1))continue;
   if(covered(A,B,normal,offset)){found=Object.freeze({first:a,second:b,normal,offset,firstSign,coveredBy:'first'});break hinted;}
   if(covered(B,A,normal,offset)){found=Object.freeze({first:a,second:b,normal,offset,firstSign,coveredBy:'second'});break hinted;}
  }
  if(!found)outer:for(const normal of normals){const x=dot(normal,A.point),y=dot(normal,B.point),offsets=[x,y,x.add(y).div(new Rational(2n)),new Rational(0n)].filter((c,i,all)=>all.findIndex(q=>q.compare(c)===0)===i);
   for(const offset of offsets)for(const firstSign of [1,-1] as const){if(!half(A,normal,offset,firstSign)||!half(B,normal,offset,(-firstSign) as 1|-1))continue;
    if(covered(A,B,normal,offset)){found=Object.freeze({first:a,second:b,normal,offset,firstSign,coveredBy:'first'});break outer;}if(covered(B,A,normal,offset)){found=Object.freeze({first:a,second:b,normal,offset,firstSign,coveredBy:'second'});break outer;}
   }
  }
  if(unresolved)return Object.freeze({kind:'not-certified',source:input,reason:'face-query-unresolved',pair:Object.freeze([a,b] as const)});
  if(!found)return Object.freeze({kind:'not-certified',source:input,reason:'no-supported-separation',pair:Object.freeze([a,b] as const)});separations.push(found);
 }
 const certificate=Object.freeze({source:input,separations:Object.freeze(separations)});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
