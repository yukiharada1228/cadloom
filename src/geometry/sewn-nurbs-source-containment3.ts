import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {assertOwnedSewnNurbsSourceEmbedding3} from './sewn-nurbs-source-embedding3.js';
import type {SewnNurbsSourceEmbeddingCertificate3} from './sewn-nurbs-source-embedding3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {querySewnNurbsSourceShellParityAuto3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3,SewnNurbsShellParitySearch3} from './sewn-nurbs-source-parity-search3.js';

export interface SewnNurbsShellContainmentNode3 {
 readonly shell:number;
 readonly sample:Point3;
 readonly sampleFace:number;
 readonly containers:readonly number[];
 readonly parent:number|null;
 readonly depth:number;
 /** Required orientation for an alternating material boundary; not an
  * assertion about the actual orientation of this shell. */
 readonly expectedOrientation:1|-1;
}
export interface SewnNurbsSourceContainmentCertificate3 {
 readonly embedding:SewnNurbsSourceEmbeddingCertificate3;
 readonly shells:readonly SewnNurbsShellContainmentNode3[];
}
export type SewnNurbsSourceContainment3=
 | Readonly<{kind:'analyzed';certificate:SewnNurbsSourceContainmentCertificate3}>
 | Readonly<{kind:'unresolved';reason:'face-sample'|'parity'|'unexpected-contact'|'inconsistent-containment';shell?:number;other?:number;query?:SewnNurbsShellParitySearch3}>;
const owned=new WeakSet<SewnNurbsSourceContainmentCertificate3>();
export function assertOwnedSewnNurbsSourceContainment3(c:SewnNurbsSourceContainmentCertificate3):void {
 if(!owned.has(c))throw new RangeError('Expected factory-created sewn NURBS containment certificate');
}
/** One boundary sample suffices only because the owned embedding certificate
 * proves disjoint connected embedded closed shells. This does not determine
 * actual normal orientation or certify a material Body. */
export function analyzeSewnNurbsSourceContainment3(embedding:SewnNurbsSourceEmbeddingCertificate3,options:SewnNurbsParitySearchOptions3={}):SewnNurbsSourceContainment3 {
 assertOwnedSewnNurbsSourceEmbedding3(embedding);
 const source=embedding.source,T=source.topology,samples:{sample:Point3;sampleFace:number}[]=[];
 for(let shell=0;shell<T.shells.length;shell++){
  const sampleFace=T.shells[shell]!.faces[0];if(sampleFace===undefined)return Object.freeze({kind:'unresolved',reason:'face-sample',shell});
  const f=T.faces[sampleFace]!.surface,c=f.source.complex,uv=c.source.source.source.faces[f.face]!.sample,q=evaluateNurbsSourceComplexFace3(c,f.face,uv.u,uv.v);
  if(q.kind!=='point')return Object.freeze({kind:'unresolved',reason:'face-sample',shell});
  const x=q.point.x.recognizeRational().rational,y=q.point.y.recognizeRational().rational,z=q.point.z.recognizeRational().rational;
  if(x===null||y===null||z===null)return Object.freeze({kind:'unresolved',reason:'face-sample',shell});
  samples.push({sample:point3(x,y,z),sampleFace});
 }
 const inside=samples.map(()=>samples.map(()=>false));
 for(let shell=0;shell<samples.length;shell++)for(let other=0;other<samples.length;other++)if(shell!==other){
  const query=querySewnNurbsSourceShellParityAuto3(source,other,samples[shell]!.sample,options);
  if(query.kind==='on-face')return Object.freeze({kind:'unresolved',reason:'unexpected-contact',shell,other,query});
  if(query.kind!=='parity')return Object.freeze({kind:'unresolved',reason:'parity',shell,other,query});
  inside[shell]![other]=query.parity==='odd';
 }
 // Check the strict partial order and that each ancestor set is a chain.
 // Never fabricate a forest from contradictory classifications.
 for(let a=0;a<samples.length;a++)for(let b=0;b<samples.length;b++)if(inside[a]![b]){
  if(inside[b]![a])return Object.freeze({kind:'unresolved',reason:'inconsistent-containment',shell:a,other:b});
  for(let c=0;c<samples.length;c++){
   if(inside[b]![c]&&!inside[a]![c]||c!==b&&inside[a]![c]&&!inside[b]![c]&&!inside[c]![b])return Object.freeze({kind:'unresolved',reason:'inconsistent-containment',shell:a,other:b});
  }
 }
 const shells=Object.freeze(samples.map((sample,shell)=>{
  const containers=inside[shell]!.flatMap((yes,id)=>yes?[id]:[]),nearest=containers.filter(b=>!containers.some(c=>c!==b&&inside[c]![b]));
  if(nearest.length>1)throw new Error('Containment ancestor chain lost uniqueness');
  return Object.freeze({...sample,shell,containers:Object.freeze(containers),parent:nearest[0]??null,depth:containers.length,expectedOrientation:(containers.length%2?-1:1) as 1|-1});
 }));
 const certificate=Object.freeze({embedding,shells});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
