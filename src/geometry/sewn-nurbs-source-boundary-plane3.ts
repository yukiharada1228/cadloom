import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from './sewn-nurbs-source-material3.js';
import {intersectNurbsSourceFacePlane3,nurbsSourceFacePlaneEdgePoint3} from './nurbs-source-face-plane3.js';
import type {NurbsSourceFacePlane3,NurbsSourcePlaneVertex3} from './nurbs-source-face-plane3.js';
import type {ExactInput} from './point2.js';
type Section=Extract<NurbsSourceFacePlane3,{kind:'resolved'}>;
export interface NurbsBoundaryPlaneVertex3 {
 readonly point:AlgebraicCoordinates3;
 readonly uses:readonly Readonly<{face:number;section:Section;vertex:number}>[];
}
export interface NurbsBoundaryPlaneEdge3 {
 readonly face:number;readonly section:Section;readonly edge:number;readonly from:number;readonly to:number;
 readonly sample:NurbsSourcePlaneVertex3;
}
export interface NurbsBoundaryPlaneComponent3 {
 /** Connected component of the endpoint incidence multigraph; area domains
  * and unnoded coincident spans are not a planar material arrangement. */
 readonly vertices:readonly number[];readonly edges:readonly number[];
 /** Combinatorial cycle only. Not an oriented/material cap certificate. */
 readonly cycle:readonly Readonly<{edge:number;direction:1|-1}>[]|null;
}
export interface NurbsBoundaryPlaneDiagnostic3 {
 /** Recorded witnesses only; absence is not a complete transversality proof. */
 readonly kind:'coplanar-area'|'boundary-span'|'patch-seam'|'nontransverse-witness'|'vertex-contact'|'noncycle-component';
 readonly face?:number;readonly edge?:number;readonly vertex?:number;readonly component?:number;
}
export type SewnNurbsBoundaryPlane3=
 | Readonly<{kind:'unresolved';face:number;section:Extract<NurbsSourceFacePlane3,{kind:'unresolved'}>}>
 | Readonly<{kind:'assembled';material:SewnNurbsSourceMaterialCertificate3;plane:Plane3;
   sections:readonly Readonly<{face:number;section:Section}>[];vertices:readonly NurbsBoundaryPlaneVertex3[];
   edges:readonly NurbsBoundaryPlaneEdge3[];areas:readonly Readonly<{face:number;section:Section;area:number}>[];
   components:readonly NurbsBoundaryPlaneComponent3[];diagnostics:readonly NurbsBoundaryPlaneDiagnostic3[]}>;
const owned=new WeakSet<SewnNurbsBoundaryPlane3>();
/** Internal provenance guard for derived section certificates. */
export function assertOwnedSewnNurbsBoundaryPlane3(input:SewnNurbsBoundaryPlane3):void {if(!owned.has(input))throw new RangeError('Expected factory-created boundary plane section');}
/** Exact boundary-section assembly for a certified globally embedded material.
 * Face intervals are retained, not chordalized or guessed to be cap boundaries. */
export function intersectSewnNurbsSourceBoundaryPlane3(material:SewnNurbsSourceMaterialCertificate3,input:Plane3):SewnNurbsBoundaryPlane3 {
 assertOwnedSewnNurbsSourceMaterial3(material);
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),T=material.containment.embedding.source.topology;
 const sections:{face:number;section:Section}[]=[],vertices:{point:AlgebraicCoordinates3;uses:{face:number;section:Section;vertex:number}[]}[]=[],edges:NurbsBoundaryPlaneEdge3[]=[],areas:{face:number;section:Section;area:number}[]=[],diagnostics:NurbsBoundaryPlaneDiagnostic3[]=[];
 const critical=(section:Section,patch:number,q:NurbsSourcePlaneVertex3)=>{
  const p=section.complex.source.source.patches[patch]!,F=p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
  return F.derivativeU().evaluateAlgebraic(q.u,q.v).sign()===0&&F.derivativeV().evaluateAlgebraic(q.u,q.v).sign()===0;
 };
 for(let face=0;face<T.faces.length;face++){
  const f=T.faces[face]!.surface,section=intersectNurbsSourceFacePlane3(f.source.complex,f.face,plane);
  if(section.kind==='unresolved'){const r=Object.freeze({kind:'unresolved' as const,face,section});owned.add(r);return r;}
  sections.push(Object.freeze({face,section}));
  const ids=section.vertices.map((q,vertex)=>{
   let id=vertices.findIndex(v=>compareAlgebraicPoints3(v.point,q.point)===0);if(id<0){id=vertices.length;vertices.push({point:q.point,uses:[]});}
   vertices[id]!.uses.push(Object.freeze({face,section,vertex}));
   if(q.stratum==='vertex')diagnostics.push(Object.freeze({kind:'vertex-contact',face,vertex:id}));
   if(q.patches.some(patch=>critical(section,patch,q)))diagnostics.push(Object.freeze({kind:'nontransverse-witness',face,vertex:id}));return id;
  });
  section.edges.forEach((e,edge)=>{
   let a=e.lower,b=e.upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
   const sample=nurbsSourceFacePlaneEdgePoint3(section,edge,a.upper.add(b.lower).div(new Rational(2n))),id=edges.length;
   edges.push(Object.freeze({face,section,edge,from:ids[e.from]!,to:ids[e.to]!,sample}));
   if(sample.stratum!=='face')diagnostics.push(Object.freeze({kind:'boundary-span',face,edge:id}));
   if(sample.patches.length!==1)diagnostics.push(Object.freeze({kind:'patch-seam',face,edge:id}));
   if(critical(section,e.patch,sample))diagnostics.push(Object.freeze({kind:'nontransverse-witness',face,edge:id}));
  });
  section.areas.forEach((_,area)=>{areas.push(Object.freeze({face,section,area}));diagnostics.push(Object.freeze({kind:'coplanar-area',face}));});
 }
 const adjacency=vertices.map(()=>[] as number[]);edges.forEach((e,id)=>{adjacency[e.from]!.push(id);adjacency[e.to]!.push(id);});const seen=new Set<number>(),components:NurbsBoundaryPlaneComponent3[]=[];
 for(let start=0;start<vertices.length;start++)if(!seen.has(start)){
  const ids:number[]=[],members=new Set<number>(),queue=[start];seen.add(start);
  for(let i=0;i<queue.length;i++){const v=queue[i]!;ids.push(v);for(const edge of adjacency[v]!){members.add(edge);const e=edges[edge]!,other=e.from===v?e.to:e.from;if(!seen.has(other)){seen.add(other);queue.push(other);}}}
  let cycle:{edge:number;direction:1|-1}[]|null=null;
  if(members.size&&ids.every(v=>adjacency[v]!.length===2)){
   cycle=[];const used=new Set<number>();let v=start;
   do{const edge=adjacency[v]!.find(e=>!used.has(e));if(edge===undefined)throw new Error('Degree-two component lost cycle continuation');const e=edges[edge]!,direction=e.from===v?1:-1;cycle.push(Object.freeze({edge,direction}));used.add(edge);v=direction===1?e.to:e.from;}while(v!==start);
   if(used.size!==members.size)throw new Error('Cycle failed to cover its connected component');
  }else diagnostics.push(Object.freeze({kind:'noncycle-component',component:components.length}));
  components.push(Object.freeze({vertices:Object.freeze(ids),edges:Object.freeze([...members]),cycle:cycle===null?null:Object.freeze(cycle)}));
 }
 const result=Object.freeze({kind:'assembled' as const,material,plane,sections:Object.freeze(sections),vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,uses:Object.freeze(v.uses)}))),edges:Object.freeze(edges),areas:Object.freeze(areas),components:Object.freeze(components),diagnostics:Object.freeze(diagnostics)});owned.add(result);return result;
}
export function nurbsBoundaryPlaneEdgePoint3(input:SewnNurbsBoundaryPlane3,edge:number,t:AlgebraicReal|ExactInput):NurbsSourcePlaneVertex3 {
 if(!owned.has(input))throw new RangeError('Expected factory-created boundary plane section');if(input.kind!=='assembled')throw new RangeError('Material plane section is unresolved');
 if(!Number.isSafeInteger(edge)||edge<0||edge>=input.edges.length)throw new RangeError('Invalid boundary plane section edge');const e=input.edges[edge]!;return nurbsSourceFacePlaneEdgePoint3(e.section,e.edge,t);
}
