import {assertOwnedNurbsRecutEmbedding3} from './nurbs-recut-embedding3.js';
import type {NurbsRecutEmbeddingCertificate3} from './nurbs-recut-embedding3.js';
import {locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import {locateNurbsPlaneSplitFace3,locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {intersectNurbsSourceFaceLine3,intersectNurbsSourceFaceRay3} from './nurbs-source-face-line3.js';
import type {NurbsSourceFaceLine3} from './nurbs-source-face-line3.js';
import {sewnNurbsRayDirections3} from './sewn-nurbs-source-parity-search3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import type {Plane3} from './plane3.js';
import {point3,dot3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';

export interface NurbsRecutRayOptions3 {readonly maxFaceDirections?:number;}
export interface NurbsRecutRayHit3 {
 readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 readonly face:number;readonly shell:number;readonly family:'source'|'old-cap'|'new-cap';
 /** Zero flags a tangent or nonunique source normal; never regular. */
 readonly dotSign:-1|0|1;
}
export type NurbsRecutRayReason3='source-overlap'|'source-event'|'nontransverse'|'patch-seam'|'boundary-event'|'origin-hit'|'cap-parallel'|'multiple-face-hit';
export type NurbsRecutRay3=
 | Readonly<{kind:'unresolved';certificate:NurbsRecutEmbeddingCertificate3;reason:'source-section'|'face-query';face:number}>
 | Readonly<{kind:'regular'|'degenerate';certificate:NurbsRecutEmbeddingCertificate3;line:Line3;forward:boolean;shell:number|null;faces:readonly number[];
  hits:readonly NurbsRecutRayHit3[];
  overlaps:readonly Readonly<{face:number;lower:AlgebraicReal;upper:AlgebraicReal}>[];
  sections:readonly Readonly<{originalFace:number;section:Exclude<NurbsSourceFaceLine3,{kind:'unresolved'}>}>[];
  reasons:readonly NurbsRecutRayReason3[]}>;
function faceIDs(c:NurbsRecutEmbeddingCertificate3,shell:number|undefined):readonly number[] {
 assertOwnedNurbsRecutEmbedding3(c);const T=c.source.topology;
 if(shell===undefined)return T.faces.map((_,i)=>i);
 if(!Number.isSafeInteger(shell)||shell<0||shell>=T.shells.length)throw new RangeError('Invalid recut shell');return T.shells[shell]!.faces;
}
function budget(options:NurbsRecutRayOptions3):number {const n=options.maxFaceDirections??16;if(!Number.isSafeInteger(n)||n<1)throw new RangeError('maxFaceDirections must be a positive safe integer');return n;}
function between(lower:AlgebraicReal,upper:AlgebraicReal):Rational {let a=lower,b=upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
export function intersectNurbsRecutLine3(c:NurbsRecutEmbeddingCertificate3,input:Line3,shell?:number,options:NurbsRecutRayOptions3={}):NurbsRecutRay3 {return section(c,input,shell,false,options);}
export function intersectNurbsRecutRay3(c:NurbsRecutEmbeddingCertificate3,input:Line3,shell?:number,options:NurbsRecutRayOptions3={}):NurbsRecutRay3 {return section(c,input,shell,true,options);}
function section(certificate:NurbsRecutEmbeddingCertificate3,input:Line3,shell:number|undefined,forward:boolean,options:NurbsRecutRayOptions3):NurbsRecutRay3 {
 const ids=faceIDs(certificate,shell),T=certificate.source.topology,line=line3(input.origin,input.direction),faceOptions={maxDirections:budget(options)},hits:NurbsRecutRayHit3[]=[],reasons=new Set<NurbsRecutRayReason3>(),overlaps:Extract<NurbsRecutRay3,{kind:'regular'|'degenerate'}>['overlaps'][number][]=[],sections:Extract<NurbsRecutRay3,{kind:'regular'|'degenerate'}>['sections'][number][]=[];
 const fail=(reason:'source-section'|'face-query',face:number):NurbsRecutRay3=>Object.freeze({kind:'unresolved',certificate,reason,face}),append=(hit:NurbsRecutRayHit3)=>{if(hit.parameter.sign()===0)reasons.add('origin-hit');hits.push(Object.freeze(hit));};
 const groups=new Map<number,{surface:NurbsPlaneSplitFaceSurface3;faces:number[]}>();
 for(const face of ids){const s=T.faces[face]!.surface;if(s.kind!=='retained'||s.source.kind!=='source')continue;const surface=s.source.source,known=groups.get(surface.sourceFace);
  if(known){const a=known.surface.source.source.vertices.cells.source,b=surface.source.source.vertices.cells.source;if(a.complex!==b.complex||a.face!==b.face)throw new Error('Recut source ID lost its original parameter frame');known.faces.push(face);}else groups.set(surface.sourceFace,{surface,faces:[face]});
 }
 for(const [originalFace,group] of groups){
  const context=group.surface.source.source.vertices.cells.source,parent=forward?intersectNurbsSourceFaceRay3(context.complex,context.face,line):intersectNurbsSourceFaceLine3(context.complex,context.face,line);
  if(parent.kind==='unresolved')return fail('source-section',group.faces[0]!);
  sections.push(Object.freeze({originalFace,section:parent}));
  for(const face of group.faces){
   const f=T.faces[face]!,s=f.surface;if(s.kind!=='retained'||s.source.kind!=='source')throw new Error('Source group changed family');const surface=s.source.source;
   for(const h of parent.vertices){const q=locateNurbsPlaneSplitFaceParameters3(surface,h.u,h.v);if(q.kind==='unresolved')return fail('face-query',face);if(q.location==='outside')continue;
    if(compareAlgebraicPoints3(q.point,h.point)!==0)throw new Error('Recut line UV provenance lost XYZ equality');
    if(q.location==='boundary')reasons.add('boundary-event');if(h.stratum!=='face')reasons.add('source-event');if(h.normals.length!==1)reasons.add('patch-seam');
    const sign=h.normals.length===1?(h.normals[0]!.dotSign*f.sense) as -1|0|1:0;if(sign===0)reasons.add('nontransverse');
    append({parameter:h.parameter,point:h.point,face,shell:f.shell,family:'source',dotSign:sign});
   }
   // A parent overlap is connected and injectively maps to a line interval.
   // Noncoincident plane roots split the overlap. When a cutting plane
   // contains the line, component membership can change at its arrangement
   // vertices, so all on-line source-noding vertices are also required.
   for(const o of parent.overlaps){
    const x=parent.vertices[o.from]!.parameter,y=parent.vertices[o.to]!.parameter,lower=x.compare(y)<=0?x:y,upper=x.compare(y)<=0?y:x,cuts=[lower,upper],C=surface.source.source.vertices.cells.source;
    for(const P of C.planes){const d=dot3(P.normal,line.direction);if(d.sign()===0)continue;const t=AlgebraicReal.fromRational(dot3(P.normal,line.origin).add(P.offset).neg().div(d));if(t.compare(lower)>0&&t.compare(upper)<0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);}
    const axis=(['x','y','z'] as const).find(k=>line.direction[k].sign()!==0)!,scale=new Rational(1n).div(line.direction[axis]);
    for(const vertex of surface.source.vertices){const t=vertex.point[axis].affine(scale,line.origin[axis].neg().mul(scale));if(t.compare(lower)<=0||t.compare(upper)>=0||cuts.some(q=>q.compare(t)===0))continue;if(compareAlgebraicPoints3(vertex.point,algebraicPoint3(line.origin,line.direction,t))===0)cuts.push(t);}
    cuts.sort((a,b)=>a.compare(b));const locations:('inside'|'outside'|'boundary')[]=[];
    for(const t of cuts){const q=locateNurbsPlaneSplitFace3(surface,algebraicPoint3(line.origin,line.direction,t));if(q.kind==='unresolved')return fail('face-query',face);locations.push(q.location);}
    const covered=new Set<number>();
    for(let i=0;i+1<cuts.length;i++){const a=cuts[i]!,b=cuts[i+1]!,q=locateNurbsPlaneSplitFace3(surface,algebraicPoint3(line.origin,line.direction,AlgebraicReal.fromRational(between(a,b))));if(q.kind==='unresolved')return fail('face-query',face);if(q.location==='outside')continue;if(locations[i]==='outside'||locations[i+1]==='outside')return fail('face-query',face);covered.add(i);covered.add(i+1);overlaps.push(Object.freeze({face,lower:a,upper:b}));}
    cuts.forEach((t,i)=>{if(!covered.has(i)&&locations[i]!=='outside')overlaps.push(Object.freeze({face,lower:t,upper:t}));});
   }
  }
 }
 if(overlaps.length)reasons.add('source-overlap');
 for(const face of ids){
  const f=T.faces[face]!,s=f.surface;
  if(s.kind==='retained'&&s.source.kind==='source')continue;
  let P:Plane3;
  if(s.kind==='cap')P=certificate.source.source.boundary.source.plane;
  else {if(s.source.kind!=='cap')throw new Error('Planar ray face changed family');P=s.source.source.source.source.surface.source.boundary.source.source.plane;}
  const d=dot3(P.normal,line.direction),v=dot3(P.normal,line.origin).add(P.offset);
  if(d.sign()===0){if(v.sign()===0)reasons.add('cap-parallel');continue;}
  const t=v.neg().div(d);if(forward&&t.sign()<0)continue;
  const parameter=AlgebraicReal.fromRational(t),point=algebraicPoint3(line.origin,line.direction,parameter),q=locateNurbsRecutClosedSurface3(s,point,faceOptions);
  if(q.kind==='unresolved')return fail('face-query',face);if(q.location==='outside')continue;if(q.location==='boundary')reasons.add('boundary-event');
  append({parameter,point,face,shell:f.shell,family:s.kind==='cap'?'new-cap':'old-cap',dotSign:(f.sense*d.sign()) as -1|1});
 }
 hits.sort((a,b)=>a.parameter.compare(b.parameter));for(let i=1;i<hits.length;i++)if(hits[i]!.parameter.compare(hits[i-1]!.parameter)===0){if(compareAlgebraicPoints3(hits[i]!.point,hits[i-1]!.point)!==0)throw new Error('Equal recut line parameters lost XYZ equality');reasons.add('multiple-face-hit');}
 return Object.freeze({kind:reasons.size?'degenerate':'regular',certificate,line,forward,shell:shell??null,faces:Object.freeze([...ids]),hits:Object.freeze(hits),overlaps:Object.freeze(overlaps),sections:Object.freeze(sections),reasons:Object.freeze([...reasons])});
}

export type NurbsRecutShellParity3=
 | Readonly<{kind:'unresolved';reason:'point-membership'|'face-section'}>
 | Readonly<{kind:'on-face';faces:readonly number[]}>
 | Readonly<{kind:'retry';ray:Extract<NurbsRecutRay3,{kind:'regular'|'degenerate'}>}>
 | Readonly<{kind:'parity';parity:'odd'|'even';crossings:number;orientedSum:number;ray:Extract<NurbsRecutRay3,{kind:'regular'|'degenerate'}>}>;
export function queryNurbsRecutShellParity3(c:NurbsRecutEmbeddingCertificate3,shell:number,origin:Point3,direction:Vector3=point3(1n,0n,0n),options:NurbsRecutRayOptions3={}):NurbsRecutShellParity3 {
 const ids=faceIDs(c,shell),line=line3(origin,direction),faceOptions={maxDirections:budget(options)},faces:number[]=[];
 for(const face of ids){const q=locateNurbsRecutClosedSurface3(c.source.topology.faces[face]!.surface,line.origin,faceOptions);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'point-membership'});if(q.location!=='outside')faces.push(face);}
 if(faces.length)return Object.freeze({kind:'on-face',faces:Object.freeze(faces)});
 const ray=intersectNurbsRecutRay3(c,line,shell,options);if(ray.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-section'});if(ray.kind==='degenerate')return Object.freeze({kind:'retry',ray});
 return Object.freeze({kind:'parity',parity:ray.hits.length%2?'odd':'even',crossings:ray.hits.length,orientedSum:ray.hits.reduce((s,h)=>s+h.dotSign,0),ray});
}
export interface NurbsRecutParitySearchOptions3 extends SewnNurbsParitySearchOptions3,NurbsRecutRayOptions3 {}
export type NurbsRecutShellParitySearch3=
 | (Exclude<NurbsRecutShellParity3,{kind:'retry'}>&Readonly<{attempts:number}>)
 | Readonly<{kind:'unresolved';reason:'direction-budget';attempts:number;last:Extract<NurbsRecutShellParity3,{kind:'retry'}>|null}>;
export function queryNurbsRecutShellParityAuto3(c:NurbsRecutEmbeddingCertificate3,shell:number,origin:Point3,options:NurbsRecutParitySearchOptions3={}):NurbsRecutShellParitySearch3 {
 faceIDs(c,shell);budget(options);const n=options.maxDirections??128;if(!Number.isSafeInteger(n)||n<1)throw new RangeError('maxDirections must be a positive safe integer');let attempts=0,last:Extract<NurbsRecutShellParity3,{kind:'retry'}>|null=null;
 for(const direction of sewnNurbsRayDirections3(options.directions??[])){attempts++;const q=queryNurbsRecutShellParity3(c,shell,origin,direction,options);if(q.kind!=='retry')return Object.freeze({...q,attempts});last=q;if(attempts===n)break;}
 return Object.freeze({kind:'unresolved',reason:'direction-budget',attempts,last});
}
