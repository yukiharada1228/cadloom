import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import {analyzeNurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import type {NurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import {locateNurbsSourceFace3} from './nurbs-source-face-location3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface NurbsSourceVertexSector3 {readonly uSign:1|-1;readonly vSign:1|-1;readonly faces:readonly number[];}
export interface NurbsSourceVertexRankEvent3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly vertex:number|null;
 readonly liftEvents:readonly Readonly<{edge:number;event:number}>[];
 readonly sectors:readonly NurbsSourceVertexSector3[];
 readonly uses:readonly Readonly<{patch:number;faces:readonly number[];regular:boolean;point:AlgebraicCoordinates3}>[];
}
export type NurbsSourceVertexRegularity3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFacePatches3;reason:'unresolved-patches'|'face-location'|'unnoded-event'|'patch-coverage'}>
 | Readonly<{kind:'analyzed';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;support:NurbsSurfaceRegularity3;events:readonly NurbsSourceVertexRankEvent3[];faces:readonly Readonly<{face:number;vertexRegular:boolean;events:readonly number[];singularUses:readonly Readonly<{event:number;patch:number}>[]}>[]}>;
const one=new BivariatePolynomial([[1n]]),quadrants=[{group:1,uSign:1,vSign:1},{group:3,uSign:-1,vSign:1},{group:5,uSign:-1,vSign:-1},{group:7,uSign:1,vSign:-1}] as const;
/** All local face/patch sectors at UV vertices and lifted boundary-knot events.
 * Germ rotation, including equal-tangent branches, determines sector incidence.
 * No straight-chord angle or spatial material inference is used. */
export function analyzeNurbsSourceFaceVertexRegularity3(source:NurbsSourceFacePatches3):NurbsSourceVertexRegularity3 {
 assertOwnedNurbsSourceFacePatches3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'unresolved-patches'});
 const L=source.source,F=L.source,H=F.source,c=H.source,R=c.source,support=analyzeNurbsSurfaceRegularity3(R.source.source.source.equations.source),inside=new Set(source.faces.map(f=>f.face));
 const nodes:{u:AlgebraicReal;v:AlgebraicReal;vertex:number|null;liftEvents:{edge:number;event:number}[]}[]=c.vertices.map((q,vertex)=>({u:q.u,v:q.v,vertex,liftEvents:[]}));
 for(const [edge,e] of L.edges.entries())for(const [event,q] of e.events.entries()){let id=nodes.findIndex(v=>v.u.compare(q.u)===0&&v.v.compare(q.v)===0);if(id<0){id=nodes.length;nodes.push({u:q.u,v:q.v,vertex:null,liftEvents:[]});}nodes[id]!.liftEvents.push({edge,event});}
 const events:NurbsSourceVertexRankEvent3[]=[];
 for(const q of nodes){
  let germs:{group:number;face:number}[]=[];
  const group=(to:number)=>{const p=c.vertices[to]!,x=p.u.compare(q.u),y=p.v.compare(q.v);return x>0?y===0?0:y>0?1:7:x<0?y===0?4:y>0?3:5:y>0?2:y<0?6:-1;};
  if(q.vertex!==null)germs=H.rotation[q.vertex]!.map(id=>({group:group(H.halfedges[id]!.to),face:F.halfedgeFaces[id]!}));
  else{const edges=[...new Set(q.liftEvents.map(e=>e.edge))];if(edges.length!==1)return Object.freeze({kind:'unresolved',source,reason:'unnoded-event'});const edge=edges[0]!,e=c.edges[edge]!;germs=[{group:group(e.to),face:F.halfedgeFaces[2*edge]!},{group:group(e.from),face:F.halfedgeFaces[2*edge+1]!}].sort((a,b)=>a.group-b.group);if(germs[0]!.group===germs[1]!.group)return Object.freeze({kind:'unresolved',source,reason:'unnoded-event'});}
  if(germs.some((g,i)=>g.group<0||i>0&&g.group<germs[i-1]!.group))return Object.freeze({kind:'unresolved',source,reason:'unnoded-event'});
  let isolatedFaces:readonly number[]=[];
  if(!germs.length){const where=locateNurbsSourceFace3(F,q.u,q.v);if(where.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'face-location'});isolatedFaces=where.kind==='face'?[where.face]:where.faces;if(isolatedFaces.length!==1)return Object.freeze({kind:'unresolved',source,reason:'unnoded-event'});}
  const sectors=Object.freeze(quadrants.map(g=>{const fs=new Set<number>();if(!germs.length)isolatedFaces.forEach(f=>fs.add(f));else{const first=germs.findIndex(h=>h.group>=g.group),previous=first<0?germs.length-1:(first+germs.length-1)%germs.length;fs.add(germs[previous]!.face);germs.filter(h=>h.group===g.group).forEach(h=>fs.add(h.face));}return Object.freeze({uSign:g.uSign,vSign:g.vSign,faces:Object.freeze([...fs].filter(f=>inside.has(f)).sort((a,b)=>a-b))});}));
  const uses:NurbsSourceVertexRankEvent3['uses'][number][]=[],covered=sectors.map(()=>new Set<number>());
  support.patches.forEach((p,patch)=>{const original=L.patches[patch]!;if(original.uSpan!==p.patch.uSpan||original.vSpan!==p.patch.vSpan)throw new Error('Source vertex patch ordering changed');const P=p.patch,loU=AlgebraicReal.fromRational(P.startU).compare(q.u),hiU=AlgebraicReal.fromRational(P.endU).compare(q.u),loV=AlgebraicReal.fromRational(P.startV).compare(q.v),hiV=AlgebraicReal.fromRational(P.endV).compare(q.v);if(loU>0||hiU<0||loV>0||hiV<0)return;
   const fs=new Set<number>();for(const [sector,s] of sectors.entries())if((s.uSign<0?loU<0:hiU>0)&&(s.vSign<0?loV<0:hiV>0))s.faces.forEach(f=>{fs.add(f);covered[sector]!.add(f);});if(!fs.size)return;const regular=p.regular||[p.normalX,p.normalY,p.normalZ].some(f=>f.rationalImage(q.u,q.v,one).sign()!==0);uses.push(Object.freeze({patch,faces:Object.freeze([...fs].sort((a,b)=>a-b)),regular,point:liftNurbsSectionPatch3(P,q.u,q.v)}));
  });
  if(sectors.some((s,i)=>s.faces.some(f=>!covered[i]!.has(f))))return Object.freeze({kind:'unresolved',source,reason:'patch-coverage'});
  events.push(Object.freeze({...q,liftEvents:Object.freeze(q.liftEvents.map(e=>Object.freeze(e))),sectors,uses:Object.freeze(uses)}));
 }
 const faces=source.faces.map(f=>{const ids:number[]=[],singularUses:{event:number;patch:number}[]=[];events.forEach((e,event)=>{if(e.uses.some(u=>u.faces.includes(f.face)))ids.push(event);for(const u of e.uses)if(u.faces.includes(f.face)&&!u.regular)singularUses.push(Object.freeze({event,patch:u.patch}));});return Object.freeze({face:f.face,vertexRegular:singularUses.length===0,events:Object.freeze(ids),singularUses:Object.freeze(singularUses)});});
 return Object.freeze({kind:'analyzed',source,support,events:Object.freeze(events),faces:Object.freeze(faces)});
}
