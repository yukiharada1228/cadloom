import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {point3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {assertOwnedSewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import type {SewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import {intersectNurbsSourceFaceLine3,intersectNurbsSourceFaceRay3} from './nurbs-source-face-line3.js';
import type {NurbsSourceFaceLine3,NurbsSourceLineVertex3} from './nurbs-source-face-line3.js';
import {nurbsSourceComplexFacePointPreimage3} from './nurbs-source-complex-face-preimage3.js';
export interface SewnNurbsSourceRayUse3 {
 readonly face:number;readonly sourceFace:number;readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly stratum:NurbsSourceLineVertex3['stratum'];
 /** Oriented by the sewn face sense, not just the source UV normal. */
 readonly normals:readonly Readonly<{patch:number;dotSign:1|0|-1}>[];
}
export type SewnNurbsSourceRayReason3='overlap'|'multiple-face-hit'|'boundary-event'|'nontransverse'|'patch-seam'|'origin-hit';
export type SewnNurbsSourceRay3=
 | Readonly<{kind:'unresolved';reason:'unresolved-sewing'|'face-section';face?:number}>
 | Readonly<{kind:'regular'|'degenerate';line:Line3;forward:boolean;faces:readonly number[];
   hits:readonly Readonly<{parameter:AlgebraicReal;point:AlgebraicCoordinates3;uses:readonly SewnNurbsSourceRayUse3[]}>[];
   overlaps:readonly Readonly<{face:number;section:Exclude<NurbsSourceFaceLine3,{kind:'unresolved'}>;overlap:number}>[];reasons:readonly SewnNurbsSourceRayReason3[]}>;
function faceIds(input:SewnNurbsSourceBReps3,shell:number|undefined):readonly number[]|null {
 assertOwnedSewnNurbsSourceBReps3(input);if(input.kind==='unresolved')return null;if(shell===undefined)return input.topology.faces.map((_,i)=>i);
 if(!Number.isSafeInteger(shell)||shell<0||shell>=input.topology.shells.length)throw new RangeError('Invalid sewn NURBS shell');return input.topology.shells[shell]!.faces;
}
export function intersectSewnNurbsSourceRay3(input:SewnNurbsSourceBReps3,ray:Line3,shell?:number):SewnNurbsSourceRay3 {return section(input,ray,shell,true);}
export function intersectSewnNurbsSourceLine3(input:SewnNurbsSourceBReps3,line:Line3,shell?:number):SewnNurbsSourceRay3 {return section(input,line,shell,false);}
function section(input:SewnNurbsSourceBReps3,original:Line3,shell:number|undefined,forward:boolean):SewnNurbsSourceRay3 {
 const ids=faceIds(input,shell);if(ids===null||input.kind!=='sewn')return Object.freeze({kind:'unresolved',reason:'unresolved-sewing'});const line=line3(original.origin,original.direction),groups:{parameter:AlgebraicReal;point:AlgebraicCoordinates3;uses:SewnNurbsSourceRayUse3[]}[]=[],overlaps:Extract<SewnNurbsSourceRay3,{kind:'regular'|'degenerate'}>['overlaps'][number][]=[],reasons=new Set<SewnNurbsSourceRayReason3>();
 for(const face of ids){const f=input.topology.faces[face]!,s=f.surface.source,c=s.complex,report=forward?intersectNurbsSourceFaceRay3(c,f.surface.face,line):intersectNurbsSourceFaceLine3(c,f.surface.face,line);if(report.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-section',face});
  report.overlaps.forEach((_,overlap)=>overlaps.push(Object.freeze({face,section:report,overlap})));if(report.overlaps.length)reasons.add('overlap');
  for(const h of report.vertices){const normals=Object.freeze(h.normals.map(n=>Object.freeze({patch:n.patch,dotSign:(n.dotSign*f.sense) as 1|0|-1}))),use=Object.freeze({face,sourceFace:f.surface.face,u:h.u,v:h.v,stratum:h.stratum,normals});let group=groups.find(g=>g.parameter.compare(h.parameter)===0);
   if(group){if(compareAlgebraicPoints3(group.point,h.point)!==0)throw new Error('Equal ray parameters lost XYZ equality');group.uses.push(use);}else groups.push({parameter:h.parameter,point:h.point,uses:[use]});
  }
 }
 groups.sort((a,b)=>a.parameter.compare(b.parameter));for(const h of groups){if(h.parameter.sign()===0)reasons.add('origin-hit');if(h.uses.length!==1)reasons.add('multiple-face-hit');for(const u of h.uses){if(u.stratum!=='face')reasons.add('boundary-event');if(u.normals.length!==1)reasons.add('patch-seam');if(u.normals.some(n=>n.dotSign===0))reasons.add('nontransverse');}}
 return Object.freeze({kind:reasons.size?'degenerate':'regular',line,forward,faces:Object.freeze([...ids]),hits:Object.freeze(groups.map(g=>Object.freeze({...g,uses:Object.freeze(g.uses)}))),overlaps:Object.freeze(overlaps),reasons:Object.freeze([...reasons])});
}
export type SewnNurbsShellParity3=
 | Readonly<{kind:'unresolved';reason:'unresolved-sewing'|'point-membership'|'face-section'}>
 | Readonly<{kind:'on-face';faces:readonly number[]}>
 | Readonly<{kind:'retry';ray:Extract<SewnNurbsSourceRay3,{kind:'degenerate'|'regular'}>}>
 | Readonly<{kind:'parity';parity:'odd'|'even';crossings:number;orientedSum:number;ray:Extract<SewnNurbsSourceRay3,{kind:'degenerate'|'regular'}>}>;
/** Intersection parity for a closed oriented locally manifold incidence shell.
 * This is not a certificate of global embedding, containment or material. */
export function querySewnNurbsSourceShellParity3(input:SewnNurbsSourceBReps3,shell:number,origin:Point3,direction:Vector3=point3(1n,0n,0n)):SewnNurbsShellParity3 {
 const ids=faceIds(input,shell);if(ids===null||input.kind!=='sewn')return Object.freeze({kind:'unresolved',reason:'unresolved-sewing'});const line=line3(origin,direction);
 if(!input.topology.shells[shell]!.closedOrientedIncidence)throw new RangeError('Shell parity requires closed oriented locally manifold incidence');
 const faces:number[]=[];for(const face of ids){const f=input.topology.faces[face]!.surface,q=nurbsSourceComplexFacePointPreimage3(f.source.complex,f.face,line.origin);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'point-membership'});if(q.kind==='point')faces.push(face);}
 if(faces.length)return Object.freeze({kind:'on-face',faces:Object.freeze(faces)});const ray=intersectSewnNurbsSourceRay3(input,line,shell);if(ray.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-section'});if(ray.kind==='degenerate')return Object.freeze({kind:'retry',ray});
 const crossings=ray.hits.length,orientedSum=ray.hits.reduce((sum,h)=>sum+h.uses[0]!.normals[0]!.dotSign,0);return Object.freeze({kind:'parity',parity:crossings%2?'odd':'even',crossings,orientedSum,ray});
}
