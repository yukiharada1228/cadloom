import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {locateNurbsSourceFace3} from './nurbs-source-face-location3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
export type NurbsSourceComplexFacePoint3=
 | Readonly<{kind:'outside';face:number;u:AlgebraicReal;v:AlgebraicReal}>
 | Readonly<{kind:'unresolved';reason:'unprepared-complex'|'face-location'}>
 | Readonly<{kind:'point';face:number;u:AlgebraicReal;v:AlgebraicReal;stratum:'face'|'edge'|'vertex';point:AlgebraicCoordinates3;images:readonly Readonly<{patch:number;point:AlgebraicCoordinates3}>[]}>;
/** Evaluate one certified face closure with its approached patch sides.
 * A UV arrangement stratum is retained; it is not a spatial material label. */
export function evaluateNurbsSourceComplexFace3(complex:NurbsSourceFaceComplex3,face:number,uInput:AlgebraicReal|ExactInput,vInput:AlgebraicReal|ExactInput):NurbsSourceComplexFacePoint3 {
 assertOwnedNurbsSourceFaceComplex3(complex);if(complex.kind!=='prepared')return Object.freeze({kind:'unresolved',reason:'unprepared-complex'});
 if(!Number.isSafeInteger(face)||!complex.faces.some(f=>f.face===face))throw new RangeError('Invalid prepared source face');
 const u=uInput instanceof AlgebraicReal?uInput:AlgebraicReal.fromRational(uInput),v=vInput instanceof AlgebraicReal?vInput:AlgebraicReal.fromRational(vInput),P=complex.source,L=P.source,F=L.source,where=locateNurbsSourceFace3(F,u,v);
 if(where.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'face-location'});
 if(where.kind==='face'?where.face!==face:!where.faces.includes(face))return Object.freeze({kind:'outside',face,u,v});
 const rank=complex.embedding.rank;if(rank.kind!=='analyzed'||rank.vertices.kind!=='analyzed')throw new Error('Prepared face lost vertex coverage');
 const event=rank.vertices.events.find(e=>e.u.compare(u)===0&&e.v.compare(v)===0),ids=new Set<number>();
 if(event)event.uses.filter(q=>q.faces.includes(face)).forEach(q=>ids.add(q.patch));
 else if(where.kind==='face')L.patches.forEach((p,id)=>{if(u.compare(AlgebraicReal.fromRational(p.startU))>=0&&u.compare(AlgebraicReal.fromRational(p.endU))<=0&&v.compare(AlgebraicReal.fromRational(p.startV))>=0&&v.compare(AlgebraicReal.fromRational(p.endV))<=0)ids.add(id);});
 else {
  const selected=P.faces.find(f=>f.face===face)!;
  for(const cycle of selected.cycles)for(const use of cycle.uses){if(!where.edges.includes(use.edge))continue;const e=L.edges[use.edge]!,piece=e.pieces[use.piece]!,t=e.axis==='u'?u:v;if(t.compare(piece.lower)>=0&&t.compare(piece.upper)<=0)ids.add(use.patch);}
 }
 if(!ids.size)throw new Error('Prepared face lost approached patch coverage');
 const images=Object.freeze([...ids].sort((a,b)=>a-b).map(patch=>Object.freeze({patch,point:liftNurbsSectionPatch3(L.patches[patch]!,u,v)}))),point=images[0]!.point;
 if(images.some(q=>compareAlgebraicPoints3(q.point,point)!==0))throw new Error('Certified face patch limits disagree at query');
 return Object.freeze({kind:'point',face,u,v,stratum:where.kind,point,images});
}
