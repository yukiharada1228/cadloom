import {assertOwnedCappedNurbsPlaneEmbedding3} from './capped-nurbs-plane-embedding3.js';
import type {CappedNurbsPlaneEmbeddingCertificate3} from './capped-nurbs-plane-embedding3.js';
import {locateCappedNurbsPlaneFace3} from './capped-nurbs-plane-query3.js';
import {intersectSewnNurbsSourceRay3,intersectSewnNurbsSourceLine3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsSourceRay3} from './sewn-nurbs-source-ray3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {point3,dot3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {algebraicCoordinates3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {sewnNurbsRayDirections3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
export interface CappedNurbsPlaneRayHit3 {readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly face:number;readonly shell:number;readonly dotSign:1|-1;}
export type CappedNurbsPlaneRayReason3='parent-ray'|'boundary-event'|'origin-hit'|'cap-parallel'|'multiple-face-hit';
export type CappedNurbsPlaneRay3=
 | Readonly<{kind:'unresolved';certificate:CappedNurbsPlaneEmbeddingCertificate3;reason:'parent-ray'|'face-query';face?:number;parent?:SewnNurbsSourceRay3}>
 | Readonly<{kind:'regular'|'degenerate';certificate:CappedNurbsPlaneEmbeddingCertificate3;line:Line3;forward:boolean;shell:number|null;faces:readonly number[];hits:readonly CappedNurbsPlaneRayHit3[];reasons:readonly CappedNurbsPlaneRayReason3[];parent?:SewnNurbsSourceRay3}>;
function faceIDs(c:CappedNurbsPlaneEmbeddingCertificate3,shell:number|undefined):readonly number[] {
 assertOwnedCappedNurbsPlaneEmbedding3(c);const T=c.source.topology;
 if(shell===undefined)return T.faces.map((_,i)=>i);
 if(!Number.isSafeInteger(shell)||shell<0||shell>=T.shells.length)throw new RangeError('Invalid capped NURBS shell');return T.shells[shell]!.faces;
}
export function intersectCappedNurbsPlaneRay3(c:CappedNurbsPlaneEmbeddingCertificate3,input:Line3,shell?:number):CappedNurbsPlaneRay3 {return section(c,input,shell,true);}
export function intersectCappedNurbsPlaneLine3(c:CappedNurbsPlaneEmbeddingCertificate3,input:Line3,shell?:number):CappedNurbsPlaneRay3 {return section(c,input,shell,false);}
function section(certificate:CappedNurbsPlaneEmbeddingCertificate3,input:Line3,shell:number|undefined,forward:boolean):CappedNurbsPlaneRay3 {
 const ids=faceIDs(certificate,shell),source=certificate.source,T=source.topology,line=line3(input.origin,input.direction),hits:CappedNurbsPlaneRayHit3[]=[],reasons=new Set<CappedNurbsPlaneRayReason3>();
 const result=(parent?:SewnNurbsSourceRay3):CappedNurbsPlaneRay3=>Object.freeze({kind:reasons.size?'degenerate':'regular',certificate,line,forward,shell:shell??null,faces:Object.freeze([...ids]),hits:Object.freeze(hits),reasons:Object.freeze([...reasons]),...(parent===undefined?{}:{parent})});
 if(!ids.length)return result();
 const raw=source.source.material.containment.embedding.source,parent=forward?intersectSewnNurbsSourceRay3(raw,line):intersectSewnNurbsSourceLine3(raw,line);
 if(parent.kind==='unresolved')return Object.freeze({kind:'unresolved',certificate,reason:'parent-ray',parent});
 const retainedOriginal=new Set(ids.flatMap(face=>{const s=T.faces[face]!.surface;return s.kind==='source'?[s.source.sourceFace]:[];}));
 if(parent.overlaps.some(o=>retainedOriginal.has(o.face)))reasons.add('parent-ray');
 const append=(h:CappedNurbsPlaneRayHit3)=>{if(h.parameter.sign()===0)reasons.add('origin-hit');hits.push(Object.freeze(h));};
 for(const h of parent.hits)for(const use of h.uses)for(const face of ids){const f=T.faces[face]!;if(f.surface.kind!=='source'||f.surface.source.sourceFace!==use.face)continue;
  const q=locateCappedNurbsPlaneFace3(source,face,h.point);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',certificate,reason:'face-query',face,parent});
  if(q.location==='outside')continue;if(q.location==='boundary')reasons.add('boundary-event');
  if(use.stratum!=='face')reasons.add('parent-ray');if(use.normals.length!==1||use.normals[0]!.dotSign===0){reasons.add('parent-ray');continue;}
  append({parameter:h.parameter,point:h.point,face,shell:f.shell,dotSign:use.normals[0]!.dotSign as 1|-1});
 }
 const B=source.source.boundary,P=B.source.source.plane,n=P.normal,denominator=dot3(n,line.direction),value=dot3(n,line.origin).add(P.offset),caps=ids.filter(face=>T.faces[face]!.surface.kind==='cap');
 if(denominator.sign()===0){if(value.sign()===0&&caps.length)reasons.add('cap-parallel');}
 else {const t=value.neg().div(denominator);if(!forward||t.sign()>=0){const parameter=AlgebraicReal.fromRational(t),p=point3(line.origin.x.add(line.direction.x.mul(t)),line.origin.y.add(line.direction.y.mul(t)),line.origin.z.add(line.direction.z.mul(t))),point=algebraicCoordinates3(p.x,p.y,p.z);
  for(const face of caps){const f=T.faces[face]!,q=locateCappedNurbsPlaneFace3(source,face,p);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',certificate,reason:'face-query',face,parent});if(q.location==='outside')continue;if(q.location==='boundary')reasons.add('boundary-event');append({parameter,point,face,shell:f.shell,dotSign:(f.sense*denominator.sign()) as 1|-1});}
 }}
 hits.sort((a,b)=>a.parameter.compare(b.parameter));for(let i=1;i<hits.length;i++)if(hits[i]!.parameter.compare(hits[i-1]!.parameter)===0){if(compareAlgebraicPoints3(hits[i]!.point,hits[i-1]!.point)!==0)throw new Error('Equal capped ray parameters lost XYZ equality');reasons.add('multiple-face-hit');}
 return result(parent);
}
export type CappedNurbsPlaneShellParity3=
 | Readonly<{kind:'unresolved';reason:'point-membership'|'face-section'}>
 | Readonly<{kind:'on-face';faces:readonly number[]}>
 | Readonly<{kind:'retry';ray:Extract<CappedNurbsPlaneRay3,{kind:'regular'|'degenerate'}>}>
 | Readonly<{kind:'parity';parity:'odd'|'even';crossings:number;orientedSum:number;ray:Extract<CappedNurbsPlaneRay3,{kind:'regular'|'degenerate'}>}>;
export function queryCappedNurbsPlaneShellParity3(certificate:CappedNurbsPlaneEmbeddingCertificate3,shell:number,origin:Point3,direction:Vector3=point3(1n,0n,0n)):CappedNurbsPlaneShellParity3 {
 const ids=faceIDs(certificate,shell),line=line3(origin,direction),faces:number[]=[];
 for(const face of ids){const q=locateCappedNurbsPlaneFace3(certificate.source,face,line.origin);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'point-membership'});if(q.location!=='outside')faces.push(face);}
 if(faces.length)return Object.freeze({kind:'on-face',faces:Object.freeze(faces)});
 const ray=intersectCappedNurbsPlaneRay3(certificate,line,shell);if(ray.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-section'});if(ray.kind==='degenerate')return Object.freeze({kind:'retry',ray});
 const crossings=ray.hits.length,orientedSum=ray.hits.reduce((sum,h)=>sum+h.dotSign,0);return Object.freeze({kind:'parity',parity:crossings%2?'odd':'even',crossings,orientedSum,ray});
}
export type CappedNurbsPlaneShellParitySearch3=
 | (Exclude<CappedNurbsPlaneShellParity3,{kind:'retry'}>&Readonly<{attempts:number}>)
 | Readonly<{kind:'unresolved';reason:'direction-budget';attempts:number;last:Extract<CappedNurbsPlaneShellParity3,{kind:'retry'}>|null}>;
export function queryCappedNurbsPlaneShellParityAuto3(certificate:CappedNurbsPlaneEmbeddingCertificate3,shell:number,origin:Point3,options:SewnNurbsParitySearchOptions3={}):CappedNurbsPlaneShellParitySearch3 {
 faceIDs(certificate,shell);const budget=options.maxDirections??128;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');let attempts=0,last:Extract<CappedNurbsPlaneShellParity3,{kind:'retry'}>|null=null;
 for(const direction of sewnNurbsRayDirections3(options.directions??[])){attempts++;const q=queryCappedNurbsPlaneShellParity3(certificate,shell,origin,direction);if(q.kind!=='retry')return Object.freeze({...q,attempts});last=q;if(attempts===budget)break;}
 return Object.freeze({kind:'unresolved',reason:'direction-budget',attempts,last});
}
