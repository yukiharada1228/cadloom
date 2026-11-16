import {assertOwnedCappedNurbsRecutHalf3,locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {analyzeNurbsSourcePlaneZeroSet3} from './nurbs-source-plane-zero-set3.js';
import type {NurbsSourcePlaneZeroSetCertificate3} from './nurbs-source-plane-zero-set3.js';
import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface NurbsRecutCapContactWitness3 {readonly input:number;readonly sourceFace:number;readonly capFace:number;readonly point:AlgebraicCoordinates3;readonly kind:'cap-interior'|'undeclared-boundary';readonly origin:Readonly<{kind:'isolated';vertex:number}|{kind:'arc-probe';edge:number}>;}
export type NurbsRecutSourceCapContacts3=
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;reason:'capping'|'zero-set'|'source-query'|'cap-query'|'coplanar-source'}>
 | Readonly<{kind:'inspected';source:Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;scope:'isolated-source-zeros-and-arc-probes';certifiesAbsence:false;audits:readonly Readonly<{input:number;zeroSet:NurbsSourcePlaneZeroSetCertificate3}>[];contacts:readonly NurbsRecutCapContactWitness3[];pendingArcs:readonly Readonly<{input:number;edge:number;sourceFaces:readonly number[]}>[]}>;
/** Exact isolated-point checks and explicit probes of non-crossing zero arcs.
 * A probe inside a cap is a real contact witness. An outside probe does not
 * certify an entire arc is disjoint; those intervals remain pending. Retained
 * old planar caps are outside this diagnostic's source-face scope. */
export function inspectNurbsRecutSourceCapContacts3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutSourceCapContacts3 {
 assertOwnedCappedNurbsRecutHalf3(source);const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const fail=(reason:Extract<NurbsRecutSourceCapContacts3,{kind:'unresolved'}>['reason']):NurbsRecutSourceCapContacts3=>Object.freeze({kind:'unresolved',source,reason});if(source.kind!=='closed')return fail('capping');
 const T=source.topology,inputs=source.source.embedding.source.source.inputs,audits:{input:number;zeroSet:NurbsSourcePlaneZeroSetCertificate3}[]=[],contacts:NurbsRecutCapContactWitness3[]=[],pendingArcs:{input:number;edge:number;sourceFaces:readonly number[]}[]=[];
 const atVertex=(face:number,vertex:number)=>T.faces[face]!.loops.some(l=>T.loops[l]!.coedges.some(h=>T.coedges[h]!.origin===vertex));
 for(const [input,built] of inputs.entries()){
  const C=built.source.source.vertices.cells,scan=analyzeNurbsSourcePlaneZeroSet3(C);if(scan.kind!=='analyzed')return fail('zero-set');const zeroSet=scan.certificate;audits.push(Object.freeze({input,zeroSet}));if(zeroSet.coplanarCells.length)return fail('coplanar-source');
  const candidates:{face:number;surface:NurbsPlaneSplitFaceSurface3}[]=T.faces.flatMap((f,face)=>f.surface.kind==='retained'&&f.surface.source.kind==='source'&&f.surface.source.source.source.source.vertices.cells===C?[{face,surface:f.surface.source.source}]:[]);
  type P=NurbsSourcePlaneZeroSetCertificate3['vertices'][number]['point'];
  type ProbeResult={kind:'located';faces:number[]}|{kind:'source-query'|'cap-query'};
  const probe=(p:P,origin:NurbsRecutCapContactWitness3['origin']):ProbeResult=>{
   const retained:{face:number;location:'inside'|'boundary'}[]=[];
   for(const c of candidates){const q=locateNurbsPlaneSplitFaceParameters3(c.surface,p.u,p.v);if(q.kind==='unresolved')return {kind:'source-query'};if(q.location==='outside')continue;if(compareAlgebraicPoints3(q.point,p.point)!==0)throw new Error('Source contact UV provenance lost spatial equality');retained.push({face:c.face,location:q.location});}
   if(!retained.length)return {kind:'located',faces:[]};
   for(const capFace of source.capFaces){const cap=T.faces[capFace]!.surface;if(cap.kind!=='cap')throw new Error('New cap face map changed family');const q=locateNurbsRecutClosedSurface3(cap,p.point,options);if(q.kind==='unresolved')return {kind:'cap-query'};if(q.location==='outside')continue;
    for(const c of retained){let kind:NurbsRecutCapContactWitness3['kind']|null=q.location==='inside'?'cap-interior':null;
     if(q.location==='boundary'&&origin.kind==='isolated'){const vertex=T.vertices.findIndex(v=>compareAlgebraicPoints3(v,p.point)===0);if(c.location==='inside'||vertex<0||!atVertex(c.face,vertex)||!atVertex(capFace,vertex))kind='undeclared-boundary';}
     if(q.location==='boundary'&&origin.kind==='arc-probe'&&c.location==='inside')kind='undeclared-boundary';
     if(kind!==null)contacts.push(Object.freeze({input,sourceFace:c.face,capFace,point:p.point,kind,origin}));
    }
   }return {kind:'located',faces:retained.map(c=>c.face)};
  };
   for(const vertex of zeroSet.isolated){const result=probe(zeroSet.vertices[vertex]!.point,Object.freeze({kind:'isolated',vertex}));if(result.kind!=='located')return fail(result.kind);}
   for(const e of zeroSet.edges)if(e.kind!=='opposite-signs'){const result=probe(e.sample,Object.freeze({kind:'arc-probe',edge:e.edge}));if(result.kind!=='located')return fail(result.kind);if(result.faces.length)pendingArcs.push(Object.freeze({input,edge:e.edge,sourceFaces:Object.freeze(result.faces)}));}
 }
 return Object.freeze({kind:'inspected',source,scope:'isolated-source-zeros-and-arc-probes',certifiesAbsence:false,audits:Object.freeze(audits),contacts:Object.freeze(contacts),pendingArcs:Object.freeze(pendingArcs)});
}
