import {assertOwnedCappedNurbsPlaneContainment3} from './capped-nurbs-plane-containment3.js';
import type {CappedNurbsPlaneContainmentCertificate3} from './capped-nurbs-plane-containment3.js';
import {intersectCappedNurbsPlaneRay3,queryCappedNurbsPlaneShellParityAuto3} from './capped-nurbs-plane-ray3.js';
import type {CappedNurbsPlaneRay3,CappedNurbsPlaneShellParitySearch3} from './capped-nurbs-plane-ray3.js';
import {locateCappedNurbsPlaneMaterial3} from './capped-nurbs-plane-query3.js';
import type {CappedNurbsPlaneMaterialLocation3} from './capped-nurbs-plane-query3.js';
import {sewnNurbsRayDirections3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
import {point3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {line3} from './surface3.js';
import {Rational} from '../numeric/rational.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
type Ray=Extract<CappedNurbsPlaneRay3,{kind:'regular'|'degenerate'}>;
export interface CappedNurbsPlaneShellOrientation3 {
 readonly shell:number;readonly orientation:1|-1;readonly expectedOrientation:1|-1;readonly attempts:number;
 readonly exteriorWitness:Point3;
 /** Inside the geometric shell; it may lie inside a child cavity. */
 readonly interiorWitness:Point3;readonly ray:Ray;
}
export interface CappedNurbsPlaneMaterialRegion3 {
 readonly shell:number;readonly cavities:readonly number[];readonly sample:Point3;readonly containingShells:readonly number[];
 readonly ray:Ray;readonly entry:number;readonly sampleParameter:Rational;
}
export interface CappedNurbsPlaneMaterialCertificate3 {
 readonly containment:CappedNurbsPlaneContainmentCertificate3;
 readonly orientations:readonly CappedNurbsPlaneShellOrientation3[];
 readonly regions:readonly CappedNurbsPlaneMaterialRegion3[];
}
export type CappedNurbsPlaneMaterial3=
 | Readonly<{kind:'certified';certificate:CappedNurbsPlaneMaterialCertificate3}>
 | Readonly<{kind:'orientation-mismatch';containment:CappedNurbsPlaneContainmentCertificate3;orientations:readonly CappedNurbsPlaneShellOrientation3[];shells:readonly number[]}>
 | Readonly<{kind:'unresolved';containment:CappedNurbsPlaneContainmentCertificate3;reason:'ray-budget'|'face-section'|'inconsistent-crossings'|'region-query'|'region-sample';shell:number;attempts:number;query?:CappedNurbsPlaneMaterialLocation3|CappedNurbsPlaneShellParitySearch3}>;
const owned=new WeakSet<CappedNurbsPlaneMaterialCertificate3>();
export function assertOwnedCappedNurbsPlaneMaterial3(c:CappedNurbsPlaneMaterialCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created capped NURBS material certificate');}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Check actual new shell orientation and a strict material sample in each
 * even-depth region. Expected depths alone never issue this certificate. */
export function certifyCappedNurbsPlaneMaterial3(containment:CappedNurbsPlaneContainmentCertificate3,options:SewnNurbsParitySearchOptions3={}):CappedNurbsPlaneMaterial3 {
 assertOwnedCappedNurbsPlaneContainment3(containment);const budget=options.maxDirections??128;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const embedding=containment.embedding,source=embedding.source,raw=source.source.material.containment.embedding.source,orientations:CappedNurbsPlaneShellOrientation3[]=[],regions:CappedNurbsPlaneMaterialRegion3[]=[];
 const fail=(reason:Extract<CappedNurbsPlaneMaterial3,{kind:'unresolved'}>['reason'],shell:number,attempts:number,query?:CappedNurbsPlaneMaterialLocation3|CappedNurbsPlaneShellParitySearch3):CappedNurbsPlaneMaterial3=>Object.freeze({kind:'unresolved',containment,reason,shell,attempts,...(query===undefined?{}:{query})});
 // Original positive-weight control hulls bound all retained faces. A linear
 // coordinate has its extrema on each bounded planar cap's boundary, so the
 // same global bound also encloses every cap and every new bounded shell.
 let minX:Rational|undefined;
 for(const root of raw.sources)for(const face of root.complex.embedding.faces){if(face.kind!=='certified')throw new Error('Material lost source embedding');for(const row of face.certificate.surface.controlPoints)for(const p of row)if(minX===undefined||p.x.compare(minX)<0)minX=p.x;}
 for(const node of containment.shells){
  const origin=point3(minX!.sub(new Rational(1n)),node.sample.y,node.sample.z),aim=subtract3(node.sample,origin),preferred=[...(options.directions??[]),aim];let delta=new Rational(1n);
  for(let k=0;k<16;k++){delta=delta.div(new Rational(2n));for(const sign of [1n,-1n]){preferred.push(point3(aim.x,aim.y.add(delta.mul(new Rational(sign))),aim.z));preferred.push(point3(aim.x,aim.y,aim.z.add(delta.mul(new Rational(sign)))));}}
  let attempts=0,accepted=false;
  for(const direction of sewnNurbsRayDirections3(preferred)){
   attempts++;const line=line3(origin,direction),ray=intersectCappedNurbsPlaneRay3(embedding,line,node.shell);
   if(ray.kind==='unresolved')return fail('face-section',node.shell,attempts);
   if(ray.kind==='regular'&&ray.hits.length){
    const first=ray.hits[0]!,sign=first.dotSign;if(ray.hits.length%2!==0||ray.hits.some((h,i)=>h.dotSign!==(i%2?-sign:sign)))return fail('inconsistent-crossings',node.shell,attempts);
    const t=between(first.parameter,ray.hits[1]!.parameter),at=(parameter:Rational)=>point3(origin.x.add(direction.x.mul(parameter)),origin.y.add(direction.y.mul(parameter)),origin.z.add(direction.z.mul(parameter))),orientation=Object.freeze({shell:node.shell,orientation:(-sign) as 1|-1,expectedOrientation:node.expectedOrientation,attempts,exteriorWitness:origin,interiorWitness:at(t),ray});
    if(orientation.orientation!==node.expectedOrientation){orientations.push(orientation);accepted=true;break;}
    if(node.depth%2===0){
     const all=intersectCappedNurbsPlaneRay3(embedding,line);if(all.kind==='unresolved')return fail('face-section',node.shell,attempts);
     if(all.kind==='regular'){
      const entry=all.hits.findIndex(h=>h.shell===node.shell&&h.parameter.compare(first.parameter)===0);if(entry<0||entry+1>=all.hits.length)return fail('inconsistent-crossings',node.shell,attempts);
      // The next hit can be an inner cavity, earlier than this shell's exit.
      // Sampling the complete boundary gap avoids choosing a void witness.
      const sampleParameter=between(all.hits[entry]!.parameter,all.hits[entry+1]!.parameter),sample=at(sampleParameter),location=locateCappedNurbsPlaneMaterial3(source,sample,options);
      if(location.kind==='unresolved')return fail('region-query',node.shell,attempts,location);if(location.kind!=='inside')return fail('region-sample',node.shell,attempts,location);
      const containingShells:number[]=[];
      for(const other of containment.shells){const q=queryCappedNurbsPlaneShellParityAuto3(embedding,other.shell,sample,options);if(q.kind!=='parity')return fail('region-query',node.shell,attempts,q);if(q.parity==='odd')containingShells.push(other.shell);}
      const expected=[node.shell,...node.containers].sort((a,b)=>a-b);if(containingShells.length!==expected.length||containingShells.some((id,i)=>id!==expected[i]))return fail('region-sample',node.shell,attempts);
      regions.push(Object.freeze({shell:node.shell,cavities:Object.freeze(containment.shells.filter(s=>s.parent===node.shell).map(s=>s.shell)),sample,containingShells:Object.freeze(containingShells),ray:all,entry,sampleParameter}));orientations.push(orientation);accepted=true;break;
     }
    }else {orientations.push(orientation);accepted=true;break;}
   }
   if(attempts===budget)break;
  }
  if(!accepted)return fail('ray-budget',node.shell,attempts);
 }
 const frozen=Object.freeze(orientations),shells=Object.freeze(orientations.filter(o=>o.orientation!==o.expectedOrientation).map(o=>o.shell));
 if(shells.length)return Object.freeze({kind:'orientation-mismatch',containment,orientations:frozen,shells});
 const certificate=Object.freeze({containment,orientations:frozen,regions:Object.freeze(regions)});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
