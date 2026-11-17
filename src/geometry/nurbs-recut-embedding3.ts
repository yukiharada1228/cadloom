import {assertOwnedCappedNurbsRecutHalf3,locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {certifyNurbsRecutSourceCapContacts3,nurbsRecutJoinedCurveContainsPoint3} from './nurbs-recut-source-cap-contact-gate3.js';
import type {NurbsRecutSourceCapContactCertificate3,NurbsRecutSourceCapContactGate3} from './nurbs-recut-source-cap-contact-gate3.js';
import type {NurbsRecutAssemblyEmbeddingCertificate3} from './nurbs-recut-cap-domains3.js';
import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';

type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;
type Location='inside'|'outside'|'boundary';
type Origin=Readonly<{kind:'section-event';input:number;event:number}|{kind:'cap-split';input:number;vertex:number}|{kind:'topology';vertex:number}>;
export interface NurbsRecutOldCapContactCertificate3 {
 readonly source:Closed;
 readonly scope:'retained-old-planar-caps-to-new-caps';
 readonly arcs:readonly Readonly<{input:number;splitEdge:number;localEdge:number;joinedEdge:number;edge:number;oldFace:number;lower:AlgebraicReal;upper:AlgebraicReal;caps:readonly Readonly<{capFace:number;declaredBoundary:boolean;openLocation:Location;lowerLocation:Location;upperLocation:Location}>[]}>[];
 readonly points:readonly Readonly<{point:AlgebraicCoordinates3;origins:readonly Origin[];relations:readonly Readonly<{oldFace:number;capFace:number;kind:'outside'|'declared-vertex'|'declared-edge';vertex?:number;edge?:number}>[]}>[];
}
export type NurbsRecutOldCapContacts3=
 | Readonly<{kind:'certified';certificate:NurbsRecutOldCapContactCertificate3}>
 | Readonly<{kind:'contact';source:Closed;oldFace:number;capFace:number;point:AlgebraicCoordinates3;reason:'cap-interior'|'undeclared-boundary'}>
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;reason:'capping'|'section'|'interval-coverage'|'face-incidence'|'face-query'|'inconsistent-locations'}>;
const oldOwned=new WeakSet<NurbsRecutOldCapContactCertificate3>();
export function assertOwnedNurbsRecutOldCapContactCertificate3(c:NurbsRecutOldCapContactCertificate3):void {if(!oldOwned.has(c))throw new RangeError('Expected factory-created old/new cap contact certificate');}
function between(lower:AlgebraicReal,upper:AlgebraicReal):Rational {let a=lower,b=upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}

/** Noncoplanar planar supports meet on one line. The owned complete old-cap
 * section lists every finite span and isolated event. Cut spans map through
 * actual full native intervals into final shared edges; zero points query
 * every retained child cap, including additional split/topology vertices.
 * Whole-edge overlaps and coplanar caps are unresolved in the split factory. */
export function certifyNurbsRecutOldCapContacts3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutOldCapContacts3 {
 assertOwnedCappedNurbsRecutHalf3(source);const budget=options.maxDirections??16;
 if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const fail=(reason:Extract<NurbsRecutOldCapContacts3,{kind:'unresolved'}>['reason']):NurbsRecutOldCapContacts3=>Object.freeze({kind:'unresolved',source,reason});
 if(source.kind!=='closed')return fail('capping');
 const T=source.topology,H=source.source.boundary.source,G=H.source,P=H.plane;
 const arcs:NurbsRecutOldCapContactCertificate3['arcs'][number][]=[],points:{point:AlgebraicCoordinates3;origins:Origin[]}[]=[];
 const onPlane=(p:AlgebraicCoordinates3)=>AlgebraicReal.linearCombination([{value:p.x,coefficient:P.normal.x},{value:p.y,coefficient:P.normal.y},{value:p.z,coefficient:P.normal.z}],P.offset).sign()===0;
 const add=(point:AlgebraicCoordinates3,origin:Origin)=>{let p=points.find(v=>compareAlgebraicPoints3(v.point,point)===0);if(!p){p={point,origins:[]};points.push(p);}p.origins.push(Object.freeze(origin));};
 const oldFaces=T.faces.flatMap((f,face)=>f.surface.kind==='retained'&&f.surface.source.kind==='cap'?[{face,surface:f.surface.source.source}]:[]);
 const contact=(oldFace:number,capFace:number,point:AlgebraicCoordinates3,reason:'cap-interior'|'undeclared-boundary'):NurbsRecutOldCapContacts3=>Object.freeze({kind:'contact',source,oldFace,capFace,point,reason});
 for(const [input,cap] of G.caps.entries()){
  const B=cap.source,S=B.section;
  if(S.kind!=='parallel'&&S.kind!=='section')return fail('section');
  if(S.kind==='section'){
   S.events.forEach((e,event)=>add(e.point,{kind:'section-event',input,event}));
   const cuts=B.edges.flatMap((e,splitEdge)=>e.curve.kind==='cut'?[{splitEdge,curve:e.curve}]:[]),spans=S.intervals.flatMap(i=>i.spans);
   if(cuts.length!==spans.length||spans.some(s=>s.location!=='inside'))return fail('interval-coverage');
   const seen=new Set<number>();
   for(const {splitEdge,curve:original} of cuts){
    const span=spans.findIndex(s=>original.line===S.line&&s.start.parameter.compare(original.lower)===0&&s.end.parameter.compare(original.upper)===0);
    if(span<0||seen.has(span))return fail('interval-coverage');seen.add(span);
    const localEdge=cap.sourceEdges[splitEdge];if(localEdge===null||localEdge===undefined)return fail('interval-coverage');
    const uses=G.capEdges[input]![localEdge];if(!uses?.length)return fail('interval-coverage');let cursor=original.lower;
    for(const use of uses){
     const curve=G.topology.edges[use.edge]!.curve;
     // New cut lines are interior to the OLD finite cap; old source/cap
     // interface alignment applies to its boundary curves, never these lines.
     if(use.direction!==1||curve.kind!=='cap'||curve.source!==cap||curve.edge!==localEdge||curve.lower.compare(cursor)!==0||curve.upper.compare(curve.lower)<=0)return fail('interval-coverage');
     const half=H.sourceEdges[use.edge];if(half===null||half===undefined)return fail('interval-coverage');const edge=source.sourceEdges[half];if(edge===undefined)return fail('interval-coverage');
     const final=T.edges[edge]!;
     if(final.curve!==curve)return fail('interval-coverage');
     const owners=oldFaces.filter(f=>f.surface.source.source===B&&final.coedges.some(h=>T.coedges[h]!.face===f.face));
     if(owners.length!==1)return fail('face-incidence');const oldFace=owners[0]!.face;
     const sample=nurbsRecutJoinedCurvePoint3(curve,between(curve.lower,curve.upper)),lower=T.vertices[final.start]!,upper=T.vertices[final.end]!,caps:NurbsRecutOldCapContactCertificate3['arcs'][number]['caps'][number][]=[];
     for(const p of [sample,lower,upper]){const q=locateNurbsRecutClosedSurface3(T.faces[oldFace]!.surface,p,options);if(q.kind==='unresolved')return fail('face-query');if(q.location!=='boundary')return fail('inconsistent-locations');}
     for(const capFace of source.capFaces){
      const queries=[sample,lower,upper].map(p=>locateNurbsRecutClosedSurface3(T.faces[capFace]!.surface,p,options)),[m,a,b]=queries;
      if(!m||!a||!b)throw new Error('Missing old-cap interval query');
      if(m.kind==='unresolved'||a.kind==='unresolved'||b.kind==='unresolved')return fail('face-query');
      const declaredBoundary=final.coedges.some(h=>T.coedges[h]!.face===capFace);
      if(declaredBoundary){if([m.location,a.location,b.location].some(l=>l!=='boundary'))return fail('inconsistent-locations');}
      else {if(m.location==='inside')return contact(oldFace,capFace,sample,'cap-interior');if(m.location==='boundary')return contact(oldFace,capFace,sample,'undeclared-boundary');if([a.location,b.location].some(l=>l==='inside'))return fail('inconsistent-locations');}
      caps.push(Object.freeze({capFace,declaredBoundary,openLocation:m.location,lowerLocation:a.location,upperLocation:b.location}));
     }
     if(!caps.some(c=>c.declaredBoundary))return fail('face-incidence');
     arcs.push(Object.freeze({input,splitEdge,localEdge,joinedEdge:use.edge,edge,oldFace,lower:curve.lower,upper:curve.upper,caps:Object.freeze(caps)}));cursor=curve.upper;
    }
    if(cursor.compare(original.upper)!==0)return fail('interval-coverage');
   }
  }
  B.vertices.forEach((p,vertex)=>{if(onPlane(p))add(p,{kind:'cap-split',input,vertex});});
 }
 T.vertices.forEach((p,vertex)=>{if(onPlane(p))add(p,{kind:'topology',vertex});});
 const records:NurbsRecutOldCapContactCertificate3['points'][number][]=[],atVertex=(face:number,vertex:number)=>T.faces[face]!.loops.some(l=>T.loops[l]!.coedges.some(h=>T.coedges[h]!.origin===vertex));
 for(const p of points){
  const retained:number[]=[];
  for(const f of oldFaces){const q=locateNurbsRecutClosedSurface3(T.faces[f.face]!.surface,p.point,options);if(q.kind==='unresolved')return fail('face-query');if(q.location==='inside')return fail('inconsistent-locations');if(q.location==='boundary')retained.push(f.face);}
  const relations:NurbsRecutOldCapContactCertificate3['points'][number]['relations'][number][]=[];
  if(retained.length)for(const capFace of source.capFaces){
   const q=locateNurbsRecutClosedSurface3(T.faces[capFace]!.surface,p.point,options);if(q.kind==='unresolved')return fail('face-query');
   for(const oldFace of retained){
    if(q.location==='inside')return contact(oldFace,capFace,p.point,'cap-interior');
    if(q.location==='outside'){relations.push(Object.freeze({oldFace,capFace,kind:'outside'}));continue;}
    const vertex=p.origins.find((o):o is Extract<Origin,{kind:'topology'}>=>o.kind==='topology'&&atVertex(oldFace,o.vertex)&&atVertex(capFace,o.vertex));
    if(vertex){relations.push(Object.freeze({oldFace,capFace,kind:'declared-vertex',vertex:vertex.vertex}));continue;}
    const edge=T.edges.findIndex(e=>e.coedges.some(h=>T.coedges[h]!.face===oldFace)&&e.coedges.some(h=>T.coedges[h]!.face===capFace)&&nurbsRecutJoinedCurveContainsPoint3(e.curve,p.point));
    if(edge<0)return contact(oldFace,capFace,p.point,'undeclared-boundary');
    relations.push(Object.freeze({oldFace,capFace,kind:'declared-edge',edge}));
   }
  }
  records.push(Object.freeze({point:p.point,origins:Object.freeze(p.origins),relations:Object.freeze(relations)}));
 }
 const certificate:NurbsRecutOldCapContactCertificate3=Object.freeze({source,scope:'retained-old-planar-caps-to-new-caps',arcs:Object.freeze(arcs),points:Object.freeze(records)});
 oldOwned.add(certificate);return Object.freeze({kind:'certified',certificate});
}

export interface NurbsRecutEmbeddingCertificate3 {
 readonly source:Closed;
 readonly method:'inherited-boundary-and-complete-cap-contacts';
 readonly inherited:NurbsRecutAssemblyEmbeddingCertificate3;
 readonly sourceCaps:NurbsRecutSourceCapContactCertificate3;
 readonly oldCaps:NurbsRecutOldCapContactCertificate3;
}
export type NurbsRecutEmbedding3=
 | Readonly<{kind:'certified';certificate:NurbsRecutEmbeddingCertificate3}>
 | Readonly<{kind:'not-certified';source:CappedNurbsRecutHalf3;reason:'source-cap-contact';sourceCaps:Exclude<NurbsRecutSourceCapContactGate3,{kind:'certified'}>}>
 | Readonly<{kind:'not-certified';source:CappedNurbsRecutHalf3;reason:'old-cap-contact';oldCaps:Exclude<NurbsRecutOldCapContacts3,{kind:'certified'}>}>;
const owned=new WeakSet<NurbsRecutEmbeddingCertificate3>();
export function assertOwnedNurbsRecutEmbedding3(c:NurbsRecutEmbeddingCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created recut boundary embedding certificate');}
/** Retained face pairs inherit the exact old embedded boundary. Source/new-cap
 * and old-cap/new-cap contacts are fully gated; new caps have owned disjoint
 * planar outer/hole/island domains. Closed manifold incidence then realizes
 * the same shared edges/vertices geometrically. Material roles, shell nesting
 * and outward orientation are separate and are not certified here. */
export function certifyNurbsRecutEmbedding3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutEmbedding3 {
 const sourceCaps=certifyNurbsRecutSourceCapContacts3(source,options);
 if(sourceCaps.kind!=='certified')return Object.freeze({kind:'not-certified',source,reason:'source-cap-contact',sourceCaps});
 const oldCaps=certifyNurbsRecutOldCapContacts3(source,options);
 if(oldCaps.kind!=='certified')return Object.freeze({kind:'not-certified',source,reason:'old-cap-contact',oldCaps});
 const closed=sourceCaps.certificate.source;
 const certificate:NurbsRecutEmbeddingCertificate3=Object.freeze({source:closed,method:'inherited-boundary-and-complete-cap-contacts',inherited:closed.source.embedding,sourceCaps:sourceCaps.certificate,oldCaps:oldCaps.certificate});
 owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
