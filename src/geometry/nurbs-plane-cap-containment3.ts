import {assertOwnedNurbsPlaneCapBoundary3,nurbsPlaneCapBoundaryPoint3} from './nurbs-plane-cap-boundary3.js';
import type {NurbsPlaneCapBoundaryCertificate3} from './nurbs-plane-cap-boundary3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from './sewn-nurbs-source-material3.js';
import {queryNurbsPlaneCapLoopWinding3} from './nurbs-plane-cap-winding3.js';
import type {NurbsPlaneCapLoopWinding3} from './nurbs-plane-cap-winding3.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
export interface NurbsPlaneCapContainmentCertificate3 {
 readonly boundary:NurbsPlaneCapBoundaryCertificate3;readonly material:SewnNurbsSourceMaterialCertificate3;
 readonly loops:readonly Readonly<{loop:number;sample:AlgebraicCoordinates2;containers:readonly number[];parent:number|null;depth:number}>[];
 /** Bounded alternating domains. Curves/uses stay in boundary.loops; this is
  * not yet a BRep face or a certified child solid. */
 readonly faces:readonly Readonly<{outer:number;holes:readonly number[]}>[];
}
export type NurbsPlaneCapContainment3=
 | Readonly<{kind:'analyzed';certificate:NurbsPlaneCapContainmentCertificate3}>
 | Readonly<{kind:'unresolved';boundary:NurbsPlaneCapBoundaryCertificate3;material:SewnNurbsSourceMaterialCertificate3;reason:'winding'|'unexpected-contact'|'inconsistent-containment';loop?:number;other?:number;query?:NurbsPlaneCapLoopWinding3}>;
const owned=new WeakSet<NurbsPlaneCapContainmentCertificate3>();
export function assertOwnedNurbsPlaneCapContainment3(c:NurbsPlaneCapContainmentCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created plane cap containment');}
/** One boundary sample per loop is sufficient only with the same owned global
 * material embedding: local finite-face embedding, complete cell noding and
 * manifold welded boundary cycles give disjoint Jordan loops in the cap chart.
 * No sampling-only test is used to assert absence of loop intersections. */
export function analyzeNurbsPlaneCapContainment3(boundary:NurbsPlaneCapBoundaryCertificate3,material:SewnNurbsSourceMaterialCertificate3,options:Readonly<{maxDirections?:number}>={}):NurbsPlaneCapContainment3 {
 assertOwnedNurbsPlaneCapBoundary3(boundary);assertOwnedSewnNurbsSourceMaterial3(material);
 if(material.containment.embedding.source!==boundary.source.source.source)throw new RangeError('Cap boundary belongs to a different material source');
 const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const unresolved=(reason:Extract<NurbsPlaneCapContainment3,{kind:'unresolved'}>['reason'],loop?:number,other?:number,query?:NurbsPlaneCapLoopWinding3):NurbsPlaneCapContainment3=>Object.freeze({kind:'unresolved',boundary,material,reason,...(loop===undefined?{}:{loop}),...(other===undefined?{}:{other}),...(query===undefined?{}:{query})});
 const T=boundary.source.topology,samples=boundary.loops.map(loop=>{const use=loop[0]!;return nurbsPlaneCapBoundaryPoint3(boundary,use.edge,T.edges[use.edge]!.curve.lower);}),inside=samples.map(()=>samples.map(()=>false));
 for(let loop=0;loop<samples.length;loop++)for(let other=0;other<samples.length;other++)if(loop!==other){
  const q=queryNurbsPlaneCapLoopWinding3(boundary,other,samples[loop]!,options);
  if(q.kind==='boundary')return unresolved('unexpected-contact',loop,other,q);
  if(q.kind==='unresolved')return unresolved('winding',loop,other,q);
  if(Math.abs(q.winding)>1)return unresolved('inconsistent-containment',loop,other,q);
  inside[loop]![other]=q.winding!==0;
 }
 // Validate strict containment and that every container set is a chain.
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){
  if(inside[j]![i])return unresolved('inconsistent-containment',i,j);
  for(let k=0;k<samples.length;k++)if(inside[j]![k]&&!inside[i]![k]||inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j])return unresolved('inconsistent-containment',i,k);
 }
 const loops=samples.map((sample,loop)=>{
  const containers=inside[loop]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null;
  return Object.freeze({loop,sample,containers:Object.freeze(containers),parent,depth:containers.length});
 });
 if(loops.some(l=>l.depth!==0&&(l.parent===null||loops[l.parent]!.depth!==l.depth-1)))return unresolved('inconsistent-containment');
 const faces=loops.filter(l=>l.depth%2===0).map(l=>Object.freeze({outer:l.loop,holes:Object.freeze(loops.filter(h=>h.parent===l.loop).map(h=>h.loop))}));
 const certificate=Object.freeze({boundary,material,loops:Object.freeze(loops),faces:Object.freeze(faces)});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
