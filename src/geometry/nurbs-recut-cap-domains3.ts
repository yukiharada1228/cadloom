import {assertOwnedCappedNurbsPlaneEmbedding3} from './capped-nurbs-plane-embedding3.js';
import type {CappedNurbsPlaneEmbeddingCertificate3} from './capped-nurbs-plane-embedding3.js';
import {assertOwnedNurbsRecutAssemblyJoin3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutAssemblyJoin3} from './nurbs-recut-face-join3.js';
import {assertOwnedNurbsRecutHalfCapBoundary3,nurbsRecutHalfCapBoundaryPoint3} from './nurbs-recut-half-boundary3.js';
import type {NurbsRecutHalfCapBoundaryCertificate3} from './nurbs-recut-half-boundary3.js';
import {queryNurbsRecutCapLoopWinding3} from './nurbs-recut-cap-winding3.js';
import type {NurbsRecutCapLoopWinding3} from './nurbs-recut-cap-winding3.js';
import {snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
export interface NurbsRecutAssemblyEmbeddingCertificate3 {readonly source:Extract<NurbsRecutAssemblyJoin3,{kind:'joined'}>;readonly previous:CappedNurbsPlaneEmbeddingCertificate3;readonly method:'inherited-finite-partitions';}
export type NurbsRecutAssemblyEmbedding3=
 | Readonly<{kind:'certified';certificate:NurbsRecutAssemblyEmbeddingCertificate3}>
 | Readonly<{kind:'not-certified';source:NurbsRecutAssemblyJoin3;reason:'assembly'|'cap-source'|'cap-coverage'}>;
const embedded=new WeakSet<NurbsRecutAssemblyEmbeddingCertificate3>();
export function assertOwnedNurbsRecutAssemblyEmbedding3(c:NurbsRecutAssemblyEmbeddingCertificate3):void {if(!embedded.has(c))throw new RangeError('Expected factory-created recut assembly embedding');}
/** The joined geometry is an exact finite partition of the same embedded old
 * boundary: complete old-face restrictions, both cap halves, certified whole
 * interface intervals and original shared-edge noding preserve its image.
 * This does not certify the new plane caps, which do not exist here yet. */
export function certifyNurbsRecutAssemblyEmbedding3(source:NurbsRecutAssemblyJoin3,previous:CappedNurbsPlaneEmbeddingCertificate3):NurbsRecutAssemblyEmbedding3 {
 assertOwnedNurbsRecutAssemblyJoin3(source);assertOwnedCappedNurbsPlaneEmbedding3(previous);if(source.kind!=='joined')return Object.freeze({kind:'not-certified',source,reason:'assembly'});
 const K=previous.source.source;if(source.source.previous!==K.boundary.source)throw new RangeError('Previous embedding belongs to a different old finite assembly');const faces=new Set<number>();
 for(const c of source.caps){const old=c.source.surface;if(old.source!==K)return Object.freeze({kind:'not-certified',source,reason:'cap-source'});if(faces.has(old.face))return Object.freeze({kind:'not-certified',source,reason:'cap-coverage'});faces.add(old.face);}
 if(faces.size!==K.faces.length||K.faces.some((_,i)=>!faces.has(i)))return Object.freeze({kind:'not-certified',source,reason:'cap-coverage'});
 const certificate=Object.freeze({source,previous,method:'inherited-finite-partitions' as const});embedded.add(certificate);return Object.freeze({kind:'certified',certificate});
}
export interface NurbsRecutCapDomainsCertificate3 {
 readonly boundary:NurbsRecutHalfCapBoundaryCertificate3;readonly embedding:NurbsRecutAssemblyEmbeddingCertificate3;
 readonly loops:readonly Readonly<{loop:number;sample:AlgebraicCoordinates2;containers:readonly number[];parent:number|null;depth:number}>[];
 readonly faces:readonly Readonly<{outer:number;holes:readonly number[]}>[];
}
export type NurbsRecutCapDomains3=
 | Readonly<{kind:'analyzed';certificate:NurbsRecutCapDomainsCertificate3}>
 | Readonly<{kind:'unresolved';boundary:NurbsRecutHalfCapBoundaryCertificate3;embedding:NurbsRecutAssemblyEmbeddingCertificate3;reason:'winding'|'unexpected-contact'|'inconsistent-containment';query?:NurbsRecutCapLoopWinding3}>;
const domains=new WeakSet<NurbsRecutCapDomainsCertificate3>();
export function assertOwnedNurbsRecutCapDomains3(c:NurbsRecutCapDomainsCertificate3):void {if(!domains.has(c))throw new RangeError('Expected factory-created recut cap domains');}
/** The same embedded old boundary plus complete plane partitions and welded
 * degree-one half-boundaries give disjoint Jordan loops. Under that inherited
 * geometry, one boundary point per loop determines pairwise containment. */
export function analyzeNurbsRecutCapDomains3(boundary:NurbsRecutHalfCapBoundaryCertificate3,embedding:NurbsRecutAssemblyEmbeddingCertificate3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutCapDomains3 {
 assertOwnedNurbsRecutHalfCapBoundary3(boundary);assertOwnedNurbsRecutAssemblyEmbedding3(embedding);if(boundary.source.source!==embedding.source)throw new RangeError('Cap boundary belongs to a different embedded assembly');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const fail=(reason:Extract<NurbsRecutCapDomains3,{kind:'unresolved'}>['reason'],query?:NurbsRecutCapLoopWinding3):NurbsRecutCapDomains3=>Object.freeze({kind:'unresolved',boundary,embedding,reason,...(query===undefined?{}:{query})}),T=boundary.source.topology,samples=boundary.loops.map(loop=>{const use=loop[0]!;return nurbsRecutHalfCapBoundaryPoint3(boundary,use.edge,T.edges[use.edge]!.curve.lower);}),inside=samples.map(()=>samples.map(()=>false));
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(i!==j){const q=queryNurbsRecutCapLoopWinding3(boundary,j,samples[i]!,options);if(q.kind==='boundary')return fail('unexpected-contact',q);if(q.kind==='unresolved')return fail('winding',q);if(Math.abs(q.winding)>1)return fail('inconsistent-containment',q);inside[i]![j]=q.winding!==0;}
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){if(inside[j]![i])return fail('inconsistent-containment');for(let k=0;k<samples.length;k++)if(inside[j]![k]&&!inside[i]![k]||inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j])return fail('inconsistent-containment');}
 const loops=samples.map((sample,loop)=>{const containers=inside[loop]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null;return Object.freeze({loop,sample,containers:Object.freeze(containers),parent,depth:containers.length});});if(loops.some(l=>l.depth!==0&&(l.parent===null||loops[l.parent]!.depth!==l.depth-1)))return fail('inconsistent-containment');
 const certificate=Object.freeze({boundary,embedding,loops:Object.freeze(loops),faces:Object.freeze(loops.filter(l=>l.depth%2===0).map(l=>Object.freeze({outer:l.loop,holes:Object.freeze(loops.filter(h=>h.parent===l.loop).map(h=>h.loop))})))});domains.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
export type NurbsRecutCapFaceLocation3=
 | Readonly<{kind:'located';source:NurbsRecutCapDomainsCertificate3;face:number;point:AlgebraicCoordinates2;location:'inside'|'outside'|'boundary';loop?:number}>
 | Readonly<{kind:'unresolved';source:NurbsRecutCapDomainsCertificate3;face:number;point:AlgebraicCoordinates2;query:NurbsRecutCapLoopWinding3}>;
export function locateNurbsRecutCapFace3(source:NurbsRecutCapDomainsCertificate3,face:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsRecutCapFaceLocation3 {
 assertOwnedNurbsRecutCapDomains3(source);if(!Number.isSafeInteger(face)||face<0||face>=source.faces.length)throw new RangeError('Invalid recut cap face');const point=snapshotExactPoint2(input),group=source.faces[face]!,located=(location:'inside'|'outside'|'boundary',loop?:number):NurbsRecutCapFaceLocation3=>Object.freeze({kind:'located',source,face,point,location,...(loop===undefined?{}:{loop})});
 for(const [i,loop] of [group.outer,...group.holes].entries()){const query=queryNurbsRecutCapLoopWinding3(source.boundary,loop,point,options);if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',source,face,point,query});if(query.kind==='boundary')return located('boundary',loop);if(i===0?query.winding===0:query.winding!==0)return located('outside');}return located('inside');
}
