import {Rational} from '../numeric/rational.js';
import {point3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {line3} from './surface3.js';
import {assertOwnedSewnNurbsSourceContainment3} from './sewn-nurbs-source-containment3.js';
import type {SewnNurbsSourceContainmentCertificate3} from './sewn-nurbs-source-containment3.js';
import {sewnNurbsRayDirections3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
import {intersectSewnNurbsSourceRay3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsSourceRay3} from './sewn-nurbs-source-ray3.js';

export interface SewnNurbsShellOrientation3 {
 readonly shell:number;
 readonly orientation:1|-1;
 readonly expectedOrientation:1|-1;
 readonly attempts:number;
 readonly exteriorWitness:Point3;
 /** Strictly inside this shell, not necessarily outside its children. */
 readonly interiorWitness:Point3;
 readonly ray:Extract<SewnNurbsSourceRay3,{kind:'regular'|'degenerate'}>;
}
export interface SewnNurbsSourceMaterialCertificate3 {
 readonly containment:SewnNurbsSourceContainmentCertificate3;
 readonly orientations:readonly SewnNurbsShellOrientation3[];
}
export type SewnNurbsSourceMaterial3=
 | Readonly<{kind:'certified';certificate:SewnNurbsSourceMaterialCertificate3}>
 | Readonly<{kind:'orientation-mismatch';containment:SewnNurbsSourceContainmentCertificate3;orientations:readonly SewnNurbsShellOrientation3[];shells:readonly number[]}>
 | Readonly<{kind:'unresolved';reason:'ray-budget'|'face-section'|'inconsistent-crossings';shell:number;attempts:number}>;
const owned=new WeakSet<SewnNurbsSourceMaterialCertificate3>();
export function assertOwnedSewnNurbsSourceMaterial3(c:SewnNurbsSourceMaterialCertificate3):void {
 if(!owned.has(c))throw new RangeError('Expected factory-created sewn NURBS material certificate');
}
/** Certifies alternating oriented boundaries of a bounded regular material.
 * This is a mathematical boundary model, not yet a common Body adapter. */
export function certifySewnNurbsSourceMaterial3(containment:SewnNurbsSourceContainmentCertificate3,options:SewnNurbsParitySearchOptions3={}):SewnNurbsSourceMaterial3 {
 assertOwnedSewnNurbsSourceContainment3(containment);
 const budget=options.maxDirections??128;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const source=containment.embedding.source,orientations:SewnNurbsShellOrientation3[]=[];
 // Positive-weight NURBS lie in the convex hull of their control points.
 // Thus x < every control-point x is outside every finite source face.
 let minX:Rational|undefined;
 for(const root of source.sources)for(const face of root.complex.embedding.faces){
  if(face.kind!=='certified')throw new Error('Material lost local embedding certificate');
  for(const row of face.certificate.surface.controlPoints)for(const p of row)if(minX===undefined||p.x.compare(minX)<0)minX=p.x;
 }
 for(const node of containment.shells){
  const origin=point3(minX!.sub(new Rational(1n)),node.sample.y,node.sample.z),aim=subtract3(node.sample,origin);
  // Aim near the known face as well as at it: its UV sample may lie on a
  // knot or on a support plane parallel to the first ray. These are exact
  // search candidates, never a geometric tolerance or a perturbed model.
  const preferred=[...(options.directions??[]),aim];let delta=new Rational(1n);
  for(let k=0;k<16;k++){
   delta=delta.div(new Rational(2n));
   for(const sign of [1n,-1n]){
    preferred.push(point3(aim.x,aim.y.add(delta.mul(new Rational(sign))),aim.z));
    preferred.push(point3(aim.x,aim.y,aim.z.add(delta.mul(new Rational(sign)))));
   }
  }
  let attempts=0,orientation:SewnNurbsShellOrientation3|undefined;
  for(const direction of sewnNurbsRayDirections3(preferred)){
   attempts++;const ray=intersectSewnNurbsSourceRay3(source,line3(origin,direction),node.shell);
   if(ray.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-section',shell:node.shell,attempts});
   if(ray.kind==='regular'&&ray.hits.length){
    const sign=ray.hits[0]!.uses[0]!.normals[0]!.dotSign;
    if(sign===0||ray.hits.length%2!==0||ray.hits.some((h,i)=>h.uses[0]!.normals[0]!.dotSign!==(i%2?-sign:sign)))return Object.freeze({kind:'unresolved',reason:'inconsistent-crossings',shell:node.shell,attempts});
    // An exact rational parameter strictly between the first enter/exit.
    // Refine isolating intervals until they leave a certified rational gap.
    let a=ray.hits[0]!.parameter,b=ray.hits[1]!.parameter;
    while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
    const t=a.upper.add(b.lower).div(new Rational(2n)),interiorWitness=point3(origin.x.add(direction.x.mul(t)),origin.y.add(direction.y.mul(t)),origin.z.add(direction.z.mul(t)));
    orientation=Object.freeze({shell:node.shell,orientation:(-sign) as 1|-1,expectedOrientation:node.expectedOrientation,attempts,exteriorWitness:origin,interiorWitness,ray});break;
   }
   if(attempts===budget)break;
  }
  if(!orientation)return Object.freeze({kind:'unresolved',reason:'ray-budget',shell:node.shell,attempts});
  orientations.push(orientation);
 }
 const frozen=Object.freeze(orientations),shells=Object.freeze(orientations.filter(o=>o.orientation!==o.expectedOrientation).map(o=>o.shell));
 if(shells.length)return Object.freeze({kind:'orientation-mismatch',containment,orientations:frozen,shells});
 const certificate=Object.freeze({containment,orientations:frozen});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
