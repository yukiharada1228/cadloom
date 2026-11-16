import {Rational} from '../numeric/rational.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from './sewn-nurbs-source-material3.js';
import {nurbsSourceComplexFacePointPreimage3} from './nurbs-source-complex-face-preimage3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {prepareNurbsSourceFacePolynomialPartition3} from './nurbs-source-face-partition3.js';
import {witnessBivariatePartition2} from './algebraic-curve-inequalities2.js';
import {querySewnNurbsSourceShellParityAuto3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3,SewnNurbsShellParitySearch3} from './sewn-nurbs-source-parity-search3.js';

export type SewnNurbsMaterialLocation3=
 | Readonly<{kind:'boundary';faces:readonly number[];shells:readonly number[]}>
 | Readonly<{kind:'inside'|'outside';containingShells:readonly number[];deepestShell:number|null;rationalWitness:Point3;enclosure:Readonly<{lower:Point3;upper:Point3}>}>
 | Readonly<{kind:'unresolved';reason:'point-membership'|'box-membership'|'parity'|'inconsistent-containment';face?:number;shell?:number;query?:SewnNurbsShellParitySearch3}>;
const keys=['x','y','z'] as const,one=new BivariatePolynomial([[1n]]);
/** Exact material membership, including independent algebraic coordinates.
 * Algebraic off-boundary points are replaced only after proving their closed
 * rational enclosure contains no boundary face. No float conversion is used. */
export function locateSewnNurbsSourceMaterial3(material:SewnNurbsSourceMaterialCertificate3,input:Point3|AlgebraicCoordinates3,options:SewnNurbsParitySearchOptions3={}):SewnNurbsMaterialLocation3 {
 assertOwnedSewnNurbsSourceMaterial3(material);
 const point=snapshotExactPoint3(input),source=material.containment.embedding.source,T=source.topology,faces:number[]=[],shells=new Set<number>();
 for(let face=0;face<T.faces.length;face++){
  const f=T.faces[face]!,q=nurbsSourceComplexFacePointPreimage3(f.surface.source.complex,f.surface.face,point);
  if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'point-membership',face});
  if(q.kind==='point'){faces.push(face);shells.add(f.shell);}
 }
 if(faces.length)return Object.freeze({kind:'boundary',faces:Object.freeze(faces),shells:Object.freeze([...shells])});
 // Prepare finite-face partitions once; refinement changes only box bounds.
 const contexts=T.faces.map((face,id)=>{
  const c=face.surface.source.complex,proof=c.embedding.faces.find(f=>f.face===face.surface.face);
  if(!proof||proof.kind!=='certified')throw new Error('Material lost face embedding certificate');
  const bounds=proof.method==='triangular'?proof.certificate.bounds:{uMin:proof.certificate.surface.startU,uMax:proof.certificate.surface.endU,vMin:proof.certificate.surface.startV,vMax:proof.certificate.surface.endV};
  const max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b,min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b;
  return {id,face,c,partition:prepareNurbsSourceFacePolynomialPartition3(c.source),patches:c.source.source.patches.flatMap((p,patch)=>{
   const b={uMin:max(bounds.uMin,p.startU),uMax:min(bounds.uMax,p.endU),vMin:max(bounds.vMin,p.startV),vMax:min(bounds.vMax,p.endV)};
   return b.uMin.compare(b.uMax)<0&&b.vMin.compare(b.vMax)<0?[{p,patch,bounds:b}]:[];
  })};
 });
 let coordinates=keys.map(k=>point[k].recognizeRational()),lower:Point3,upper:Point3;
 for(;;){
  lower=point3(coordinates[0]!.lower,coordinates[1]!.lower,coordinates[2]!.lower);upper=point3(coordinates[0]!.upper,coordinates[1]!.upper,coordinates[2]!.upper);
  // A rational point was already proved off boundary by inverse membership.
  if(coordinates.every(q=>q.rational!==null))break;
  let intersects=false;
  outer:for(const f of contexts)for(const patch of f.patches){
   const constraints=keys.flatMap(k=>[patch.p[k].sub(patch.p.weight.scale(lower[k])),patch.p.weight.scale(upper[k]).sub(patch.p[k])]);
   let unresolved=false;
   const hit=witnessBivariatePartition2([...f.partition(patch.bounds),...constraints],patch.bounds,q=>{
    if(constraints.some(g=>g.rationalImage(q.u,q.v,one).sign()<0))return false;
    const member=evaluateNurbsSourceComplexFace3(f.c,f.face.surface.face,q.u,q.v);
    if(member.kind==='unresolved'){unresolved=true;return false;}
    return member.kind==='point'&&member.images.some(image=>image.patch===patch.patch);
   });
   if(unresolved)return Object.freeze({kind:'unresolved',reason:'box-membership',face:f.id});
   if(hit){intersects=true;break outer;}
  }
  if(!intersects)break;
  // The point is off a finite union of compact faces. Its distance to that
  // boundary is positive, so these shrinking exact boxes eventually separate.
  coordinates=coordinates.map(q=>q.refine());
 }
 const half=new Rational(2n),rationalWitness=point3(lower.x.add(upper.x).div(half),lower.y.add(upper.y).div(half),lower.z.add(upper.z).div(half)),containingShells:number[]=[];
 for(const node of material.containment.shells){
  const query=querySewnNurbsSourceShellParityAuto3(source,node.shell,rationalWitness,options);
  if(query.kind!=='parity')return Object.freeze({kind:'unresolved',reason:'parity',shell:node.shell,query});
  if(query.parity==='odd')containingShells.push(node.shell);
 }
 containingShells.sort((a,b)=>material.containment.shells[a]!.depth-material.containment.shells[b]!.depth);
 for(let i=0;i<containingShells.length;i++){
  const node=material.containment.shells[containingShells[i]!]!;
  if(node.depth!==i||node.parent!==(i?containingShells[i-1]!:null))return Object.freeze({kind:'unresolved',reason:'inconsistent-containment',shell:node.shell});
 }
 return Object.freeze({kind:containingShells.length%2?'inside':'outside',containingShells:Object.freeze(containingShells),deepestShell:containingShells.at(-1)??null,rationalWitness,enclosure:Object.freeze({lower,upper})});
}
