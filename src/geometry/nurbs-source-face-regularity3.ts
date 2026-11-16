import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {BivariateRoot} from '../numeric/bivariate-system.js';
import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import {analyzeNurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import type {NurbsSurfaceRegularity3,NurbsSurfaceSingularPoint3} from './nurbs-surface-regularity3.js';
import {prepareNurbsDomainPolynomialPartition2} from './nurbs-domain-polynomial-partition2.js';
import {witnessBivariatePartition2} from './algebraic-curve-inequalities2.js';
import {locateNurbsSourceFace3} from './nurbs-source-face-location3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
export interface NurbsSourceFacePatchRegularity3 {
 readonly patch:number;readonly status:'regular'|'singular'|'unresolved';
 /** Exact witness in the OPEN UV face, not merely its closure. */
 readonly witness:NurbsSurfaceSingularPoint3|null;
}
export type NurbsSourceFaceRegularity3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFacePatches3;reason:'unresolved-patches'}>
 | Readonly<{kind:'analyzed';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;support:NurbsSurfaceRegularity3;faces:readonly Readonly<{face:number;status:'regular'|'singular'|'unresolved';patches:readonly NurbsSourceFacePatchRegularity3[]}>[]}>;
const one=new BivariatePolynomial([[1n]]);
/** Complete rank-two query on open inside UV faces, retaining each closed
 * one-sided patch. Boundary/vertex rank, injectivity and material are separate. */
export function analyzeNurbsSourceFaceInteriorRegularity3(source:NurbsSourceFacePatches3):NurbsSourceFaceRegularity3 {
 assertOwnedNurbsSourceFacePatches3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'unresolved-patches'});
 const L=source.source,F=L.source,c=F.source.source,R=c.source,support=analyzeNurbsSurfaceRegularity3(R.source.source.source.equations.source),domainPartition=prepareNurbsDomainPolynomialPartition2(c.sharing.boundary.domain),edgePolynomials:BivariatePolynomial[]=[];
 const add=(p:BivariatePolynomial)=>{if((p.degreeU>0||p.degreeV>0)&&!edgePolynomials.some(q=>q.equals(p)))edgePolynomials.push(p);};
 for(const v of c.vertices){add(new BivariatePolynomial(v.u.recognizeRational().polynomial.coefficients.map(q=>[q])));add(new BivariatePolynomial([v.v.recognizeRational().polynomial.coefficients]));}
 for(const e of R.edges){const old=R.source.edges[e.sourceEdge]!,use=old.uses[0]!,p=R.source.source.patches[use.patch]!,t=p.edges[use.edge]!,raw=R.source.source.source.patches[p.sourceIntersectionPatch]!.edges[t.sourceEdge]!;add(raw.graph.polynomial);}
 const partitions=new Map<number,readonly BivariatePolynomial[]>();
 const faces=source.faces.map(face=>{
  const patches=support.patches.map((p,patch):NurbsSourceFacePatchRegularity3=>{
   const original=L.patches[patch];if(!original||original.uSpan!==p.patch.uSpan||original.vSpan!==p.patch.vSpan)throw new Error('Source patch ordering changed during regularity snapshot');
   if(p.regular)return Object.freeze({patch,status:'regular',witness:null});let unresolved=false;
   const belongs=(q:BivariateRoot)=>{const where=locateNurbsSourceFace3(F,q.u,q.v);if(where.kind==='unresolved'){unresolved=true;return false;}return where.kind==='face'&&where.face===face.face;};
   let point:BivariateRoot|null=null;
   // A real zero set without curve edges or area is finite, even when it
   // comes from a shared polynomial rather than the finite-system branch.
   if(p.locus===null||p.locus.kind==='curve'&&p.locus.edges.length===0){point=[...p.points,...(p.locus?.vertices??[])].find(belongs)??null;}
   else{
    const q=p.patch,bounds={uMin:q.startU,uMax:q.endU,vMin:q.startV,vMax:q.endV};let polynomials=partitions.get(patch);
    if(!polynomials){polynomials=Object.freeze([...domainPartition(bounds),...edgePolynomials,p.normalX,p.normalY,p.normalZ]);partitions.set(patch,polynomials);}
    // Every normal zero, finite boundary branch endpoint, graph support and
    // coordinate event is an arrangement stratum. Membership is queried on
    // the actual finite UV graph, not inferred from implicit support alone.
    point=witnessBivariatePartition2(polynomials,bounds,q=>[p.normalX,p.normalY,p.normalZ].every(f=>f.rationalImage(q.u,q.v,one).sign()===0)&&belongs(q));
   }
   const witness=point?Object.freeze({u:point.u,v:point.v,point:liftNurbsSectionPatch3(p.patch,point.u,point.v)}):null;
   return Object.freeze({patch,status:witness?'singular':unresolved?'unresolved':'regular',witness});
  });
  const status=patches.some(p=>p.status==='singular')?'singular':patches.some(p=>p.status==='unresolved')?'unresolved':'regular';
  return Object.freeze({face:face.face,status,patches:Object.freeze(patches)});
 });
 return Object.freeze({kind:'analyzed',source,support,faces:Object.freeze(faces)});
}
