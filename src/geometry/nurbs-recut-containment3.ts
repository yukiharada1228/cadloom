import {assertOwnedNurbsRecutEmbedding3} from './nurbs-recut-embedding3.js';
import type {NurbsRecutEmbeddingCertificate3} from './nurbs-recut-embedding3.js';
import {queryNurbsRecutShellParityAuto3} from './nurbs-recut-ray3.js';
import type {NurbsRecutShellParitySearch3} from './nurbs-recut-ray3.js';
import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import {point3} from './point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import type {NurbsRecutParitySearchOptions3} from './nurbs-recut-ray3.js';
export interface NurbsRecutShellContainmentNode3 {
 readonly shell:number;readonly sample:Point3;readonly sampleFace:number;
 readonly containers:readonly number[];readonly parent:number|null;readonly depth:number;
 /** Expected material orientation, not a check of actual shell orientation. */
 readonly expectedOrientation:1|-1;
}
export interface NurbsRecutContainmentCertificate3 {
 readonly embedding:NurbsRecutEmbeddingCertificate3;
 readonly shells:readonly NurbsRecutShellContainmentNode3[];
}
export type NurbsRecutContainment3=
 | Readonly<{kind:'analyzed';certificate:NurbsRecutContainmentCertificate3}>
 | Readonly<{kind:'unresolved';embedding:NurbsRecutEmbeddingCertificate3;reason:'face-sample'|'parity'|'unexpected-contact'|'inconsistent-containment';shell?:number;other?:number;query?:NurbsRecutShellParitySearch3}>;
const owned=new WeakSet<NurbsRecutContainmentCertificate3>();
export function assertOwnedNurbsRecutContainment3(c:NurbsRecutContainmentCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created recut shell containment');}
/** Recompute containment of the newly connected embedded shells. Cutting can
 * open an old cavity into the exterior, so old shell depths cannot be reused. */
export function analyzeNurbsRecutContainment3(embedding:NurbsRecutEmbeddingCertificate3,options:NurbsRecutParitySearchOptions3={}):NurbsRecutContainment3 {
 assertOwnedNurbsRecutEmbedding3(embedding);const budget=options.maxDirections??128;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const faceBudget=options.maxFaceDirections??16;if(!Number.isSafeInteger(faceBudget)||faceBudget<1)throw new RangeError('maxFaceDirections must be a positive safe integer');
 const source=embedding.source,T=source.topology,fail=(reason:Extract<NurbsRecutContainment3,{kind:'unresolved'}>['reason'],shell?:number,other?:number,query?:NurbsRecutShellParitySearch3):NurbsRecutContainment3=>Object.freeze({kind:'unresolved',embedding,reason,...(shell===undefined?{}:{shell}),...(other===undefined?{}:{other}),...(query===undefined?{}:{query})}),samples:{sample:Point3;sampleFace:number}[]=[];
 for(let shell=0;shell<T.shells.length;shell++){
  const sampleFace=T.shells[shell]!.faces.find(face=>{const s=T.faces[face]!.surface;return s.kind==='retained'&&s.source.kind==='source';});if(sampleFace===undefined)return fail('face-sample',shell);
  const s=T.faces[sampleFace]!.surface;if(s.kind!=='retained'||s.source.kind!=='source')throw Error('Shell sample lost source face');const surface=s.source.source,N=surface.source,region=N.regions[surface.region]!,cell=region.cells[0];if(cell===undefined)return fail('face-sample',shell);
  const cellSample=N.source.vertices.cells.source.cells[cell]!.sample,point=cellSample.point,x=point.x.recognizeRational().rational,y=point.y.recognizeRational().rational,z=point.z.recognizeRational().rational;if(x===null||y===null||z===null)return fail('face-sample',shell);
  const sample=point3(x,y,z),q=locateNurbsPlaneSplitFaceParameters3(surface,cellSample.u,cellSample.v);if(q.kind!=='located'||q.location!=='inside'||compareAlgebraicPoints3(q.point,point)!==0)return fail('face-sample',shell);samples.push({sample,sampleFace});
 }
 const inside=samples.map(()=>samples.map(()=>false));
 for(let shell=0;shell<samples.length;shell++)for(let other=0;other<samples.length;other++)if(shell!==other){
  const q=queryNurbsRecutShellParityAuto3(embedding,other,samples[shell]!.sample,options);if(q.kind==='on-face')return fail('unexpected-contact',shell,other,q);if(q.kind!=='parity')return fail('parity',shell,other,q);inside[shell]![other]=q.parity==='odd';
 }
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){
  if(inside[j]![i])return fail('inconsistent-containment',i,j);
  for(let k=0;k<samples.length;k++)if((inside[j]![k]&&!inside[i]![k])||(inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j]))return fail('inconsistent-containment',i,k);
 }
 const shells=samples.map(({sample,sampleFace},shell)=>{const containers=inside[shell]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null,depth=containers.length;return Object.freeze({shell,sample,sampleFace,containers:Object.freeze(containers),parent,depth,expectedOrientation:(depth%2?-1:1) as 1|-1});});
 if(shells.some(s=>s.depth!==0&&(s.parent===null||shells[s.parent]!.depth!==s.depth-1)))return fail('inconsistent-containment');
 const certificate=Object.freeze({embedding,shells:Object.freeze(shells)});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
