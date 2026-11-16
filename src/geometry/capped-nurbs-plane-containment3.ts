import {assertOwnedCappedNurbsPlaneEmbedding3} from './capped-nurbs-plane-embedding3.js';
import type {CappedNurbsPlaneEmbeddingCertificate3} from './capped-nurbs-plane-embedding3.js';
import {queryCappedNurbsPlaneShellParityAuto3} from './capped-nurbs-plane-ray3.js';
import type {CappedNurbsPlaneShellParitySearch3} from './capped-nurbs-plane-ray3.js';
import {locateCappedNurbsPlaneFace3} from './capped-nurbs-plane-query3.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
export interface CappedNurbsPlaneShellContainmentNode3 {
 readonly shell:number;readonly sample:Point3;readonly sampleFace:number;
 readonly containers:readonly number[];readonly parent:number|null;readonly depth:number;
 /** Expected material orientation, not a check of actual shell orientation. */
 readonly expectedOrientation:1|-1;
}
export interface CappedNurbsPlaneContainmentCertificate3 {
 readonly embedding:CappedNurbsPlaneEmbeddingCertificate3;
 readonly shells:readonly CappedNurbsPlaneShellContainmentNode3[];
}
export type CappedNurbsPlaneContainment3=
 | Readonly<{kind:'analyzed';certificate:CappedNurbsPlaneContainmentCertificate3}>
 | Readonly<{kind:'unresolved';embedding:CappedNurbsPlaneEmbeddingCertificate3;reason:'face-sample'|'parity'|'unexpected-contact'|'inconsistent-containment';shell?:number;other?:number;query?:CappedNurbsPlaneShellParitySearch3}>;
const owned=new WeakSet<CappedNurbsPlaneContainmentCertificate3>();
export function assertOwnedCappedNurbsPlaneContainment3(c:CappedNurbsPlaneContainmentCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created capped shell containment');}
/** Recompute containment of the newly connected embedded shells. Cutting can
 * open an old cavity into the exterior, so old shell depths cannot be reused. */
export function analyzeCappedNurbsPlaneContainment3(embedding:CappedNurbsPlaneEmbeddingCertificate3,options:SewnNurbsParitySearchOptions3={}):CappedNurbsPlaneContainment3 {
 assertOwnedCappedNurbsPlaneEmbedding3(embedding);const budget=options.maxDirections??128;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const source=embedding.source,T=source.topology,fail=(reason:Extract<CappedNurbsPlaneContainment3,{kind:'unresolved'}>['reason'],shell?:number,other?:number,query?:CappedNurbsPlaneShellParitySearch3):CappedNurbsPlaneContainment3=>Object.freeze({kind:'unresolved',embedding,reason,...(shell===undefined?{}:{shell}),...(other===undefined?{}:{other}),...(query===undefined?{}:{query})}),samples:{sample:Point3;sampleFace:number}[]=[];
 for(let shell=0;shell<T.shells.length;shell++){
  const sampleFace=T.shells[shell]!.faces.find(face=>T.faces[face]!.surface.kind==='source');if(sampleFace===undefined)return fail('face-sample',shell);
  const s=T.faces[sampleFace]!.surface;if(s.kind!=='source')throw new Error('Shell sample lost source face');const N=s.source.source,region=N.regions[s.source.region]!,cell=region.cells[0];if(cell===undefined)return fail('face-sample',shell);
  const point=N.source.vertices.cells.source.cells[cell]!.sample.point,x=point.x.recognizeRational().rational,y=point.y.recognizeRational().rational,z=point.z.recognizeRational().rational;if(x===null||y===null||z===null)return fail('face-sample',shell);
  const sample=point3(x,y,z),q=locateCappedNurbsPlaneFace3(source,sampleFace,sample);if(q.kind!=='located'||q.location!=='inside')return fail('face-sample',shell);samples.push({sample,sampleFace});
 }
 const inside=samples.map(()=>samples.map(()=>false));
 for(let shell=0;shell<samples.length;shell++)for(let other=0;other<samples.length;other++)if(shell!==other){
  const q=queryCappedNurbsPlaneShellParityAuto3(embedding,other,samples[shell]!.sample,options);if(q.kind==='on-face')return fail('unexpected-contact',shell,other,q);if(q.kind!=='parity')return fail('parity',shell,other,q);inside[shell]![other]=q.parity==='odd';
 }
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){
  if(inside[j]![i])return fail('inconsistent-containment',i,j);
  for(let k=0;k<samples.length;k++)if((inside[j]![k]&&!inside[i]![k])||(inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j]))return fail('inconsistent-containment',i,k);
 }
 const shells=samples.map(({sample,sampleFace},shell)=>{const containers=inside[shell]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null,depth=containers.length;return Object.freeze({shell,sample,sampleFace,containers:Object.freeze(containers),parent,depth,expectedOrientation:(depth%2?-1:1) as 1|-1});});
 if(shells.some(s=>s.depth!==0&&(s.parent===null||shells[s.parent]!.depth!==s.depth-1)))return fail('inconsistent-containment');
 const certificate=Object.freeze({embedding,shells:Object.freeze(shells)});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
