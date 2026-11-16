import {Rational} from '../numeric/rational.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import {analyzeNurbsSourceFaceClosedRank3} from './nurbs-source-closed-rank3.js';
import type {NurbsSourceClosedRank3} from './nurbs-source-closed-rank3.js';
import {certifyNurbsSurfaceAffineProjection3} from './nurbs-affine-projection3.js';
import type {NurbsAffineProjectionCertificate3,NurbsAffineProjectionResult3} from './nurbs-affine-projection3.js';
import {certifyNurbsSurfaceTriangularProjection3} from './nurbs-triangular-projection3.js';
import type {NurbsTriangularProjectionCertificate3,NurbsTriangularProjectionResult3} from './nurbs-triangular-projection3.js';
export type NurbsSourceEmbeddedFace3=
 | Readonly<{face:number;kind:'certified';method:'affine';certificate:NurbsAffineProjectionCertificate3}>
 | Readonly<{face:number;kind:'certified';method:'triangular';certificate:NurbsTriangularProjectionCertificate3}>
 | Readonly<{face:number;kind:'not-certified';reason:'rank-loss'|'rank-unresolved'|'discontinuous-face'|'no-projection-certificate'}>;
export type NurbsSourceFaceEmbedding3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFacePatches3;reason:'unresolved-patches'}>
 | Readonly<{kind:'analyzed';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;rank:NurbsSourceClosedRank3;faces:readonly NurbsSourceEmbeddedFace3[]}>;
/** Positive embedding proofs only. Failed discovery is not a proof of an
 * intersection. Face closure bounds use every monotone boundary atom. */
export function certifyNurbsSourceFaceEmbedding3(source:NurbsSourceFacePatches3):NurbsSourceFaceEmbedding3 {
 assertOwnedNurbsSourceFacePatches3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'unresolved-patches'});
 const rank=analyzeNurbsSourceFaceClosedRank3(source),L=source.source,F=L.source,c=F.source.source,surface=c.source.source.source.source.equations.source,cache=new Map<string,NurbsTriangularProjectionResult3>();let affine:NurbsAffineProjectionResult3|undefined;
 const bound=(values:readonly AlgebraicReal[],lower:boolean,active:Rational)=>{const root=values.reduce((a,b)=>lower?a.compare(b)<0?a:b:a.compare(b)>0?a:b).recognizeRational(),q=root.rational??(lower?root.lower:root.upper);return lower?q.compare(active)>0?q:active:q.compare(active)<0?q:active;};
 const faces=source.faces.map((f):NurbsSourceEmbeddedFace3=>{
  const r=rank.kind==='analyzed'?rank.faces.find(q=>q.face===f.face):undefined;if(r?.status!=='regular')return Object.freeze({face:f.face,kind:'not-certified',reason:r?.status==='singular'?'rank-loss':'rank-unresolved'});
  if(!f.positionContinuous)return Object.freeze({face:f.face,kind:'not-certified',reason:'discontinuous-face'});
  affine??=certifyNurbsSurfaceAffineProjection3(surface);if(affine.kind==='certified')return Object.freeze({face:f.face,kind:'certified',method:'affine',certificate:affine.certificate});
  const vertices=F.faces[f.face]!.cycles.flatMap(cycle=>F.source.cycles[cycle]!.flatMap(id=>{const h=F.source.halfedges[id]!;return [c.vertices[h.from]!,c.vertices[h.to]!];}));if(!vertices.length)throw new Error('Bounded inside face lacks boundary atoms');
  // Both coordinates are monotone on every atom. Its endpoints therefore
  // bound the whole closed curve, including algebraic extrema and holes.
  const bounds={uMin:bound(vertices.map(v=>v.u),true,surface.startU),uMax:bound(vertices.map(v=>v.u),false,surface.endU),vMin:bound(vertices.map(v=>v.v),true,surface.startV),vMax:bound(vertices.map(v=>v.v),false,surface.endV)},key=[bounds.uMin,bounds.uMax,bounds.vMin,bounds.vMax].map(q=>q.toString()).join('|');let result=cache.get(key);
  if(!result){result=certifyNurbsSurfaceTriangularProjection3(surface,bounds);cache.set(key,result);}return result.kind==='certified'?Object.freeze({face:f.face,kind:'certified',method:'triangular',certificate:result.certificate}):Object.freeze({face:f.face,kind:'not-certified',reason:'no-projection-certificate'});
 });
 return Object.freeze({kind:'analyzed',source,rank,faces:Object.freeze(faces)});
}
