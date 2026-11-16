import {encodeCurveRecord3,decodeCurveRecord3,encodeSurfaceRecord3,decodeSurfaceRecord3} from './geometry3.js';
import {readNurbsSourceBRepRecord3,parseNurbsSourceBRepRecord3} from '../record/nurbs-source-brep3.js';
import type {NurbsSourceBRepRecord3,NurbsSourceDomainRecord3} from '../record/nurbs-source-brep3.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {assertOwnedNurbsSourceBRep3,buildNurbsSourceBRep3} from '../geometry/nurbs-source-brep3.js';
import type {NurbsSourceBRep3} from '../geometry/nurbs-source-brep3.js';
import {prepareNurbsParameterDomain2} from '../geometry/nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2} from '../geometry/nurbs-parameter-domain2.js';
import {certifyNurbsSurfaceAffineProjection3} from '../geometry/nurbs-affine-projection3.js';
import {intersectNurbsSurfaceAffineTarget3} from '../geometry/nurbs-affine-intersection3.js';
import {trimNurbsAffineIntersection3} from '../geometry/nurbs-affine-intersection-trim3.js';
import {sewNurbsAffineIntersection3} from '../geometry/nurbs-affine-intersection-seams3.js';
import {refineNurbsAffineIntersectionComplex3} from '../geometry/nurbs-affine-intersection-refine3.js';
import {buildNurbsSourceBoundaryComplex3} from '../geometry/nurbs-source-boundary-complex3.js';
import {buildNurbsSourceHalfedges3} from '../geometry/nurbs-source-halfedges3.js';
import {classifyNurbsSourceFaces3} from '../geometry/nurbs-source-faces3.js';
import {liftNurbsSourceFaceBoundaries3} from '../geometry/nurbs-source-face-lift3.js';
import {selectNurbsSourceFacePatches3} from '../geometry/nurbs-source-face-patches3.js';
import {prepareNurbsSourceFaceComplex3} from '../geometry/nurbs-source-face-complex3.js';
export function encodeNurbsSourceBRep3(input:NurbsSourceBRep3):NurbsSourceBRepRecord3 {
 assertOwnedNurbsSourceBRep3(input);const F=input.complex.source.source.source,c=F.source.source,trim=c.source.source.source;
 const surface=(s:typeof trim.source.equations.source)=>{const r=encodeSurfaceRecord3({kind:'nurbs',surface:s});if(r.kind!=='nurbs')throw new Error('NURBS support encoding invariant');return r;};
 const domain=(d:PreparedNurbsParameterDomain2):NurbsSourceDomainRecord3=>{const ring=(cs:typeof d.outer)=>Object.freeze(cs.map(curve=>{const r=encodeCurveRecord3({kind:'nurbs',curve});if(r.kind!=='nurbs')throw new Error('NURBS trim encoding invariant');return r;}));return Object.freeze({outer:ring(d.outer),holes:Object.freeze(d.holes.map(ring)),sense:d.sense});};
 return readNurbsSourceBRepRecord3({version:1,kind:'nurbs-source-brep',source:surface(trim.source.equations.source),target:surface(trim.source.equations.target.surface),sourceDomain:domain(trim.sourceDomain),targetDomain:domain(trim.targetDomain),sense:input.sense});
}
/** Replays the exact complete construction. Serialized flags never restore a
 * certificate, ownership, shared edges or a shell/material assertion. */
export function decodeNurbsSourceBRep3(input:unknown,limits:RecordReadLimits3={}):NurbsSourceBRep3 {
 const r=readNurbsSourceBRepRecord3(input,limits),source=decodeSurfaceRecord3(r.source),target=decodeSurfaceRecord3(r.target);if(source.kind!=='nurbs'||target.kind!=='nurbs')throw new Error('NURBS support decoding invariant');
 const domain=(d:NurbsSourceDomainRecord3)=>{const ring=(cs:typeof d.outer)=>cs.map(c=>{const q=decodeCurveRecord3(c);if(q.kind!=='nurbs')throw new Error('NURBS trim decoding invariant');return q.curve;});return prepareNurbsParameterDomain2(ring(d.outer),d.holes.map(ring),d.sense);};
 const projection=certifyNurbsSurfaceAffineProjection3(target.surface);if(projection.kind!=='certified')throw new RangeError('Source BRep target needs a certified affine inverse');
 const trim=trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(source.surface,projection.certificate),domain(r.sourceDomain),domain(r.targetDomain)),refined=refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trim)),faces=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined))),selection=selectNurbsSourceFacePatches3(liftNurbsSourceFaceBoundaries3(faces)),complex=prepareNurbsSourceFaceComplex3(selection);
 if(complex.kind!=='prepared')throw new RangeError('Source BRep replay did not certify every finite face');return buildNurbsSourceBRep3(complex,r.sense);
}
export function stringifyNurbsSourceBRep3(input:NurbsSourceBRep3):string {return JSON.stringify(encodeNurbsSourceBRep3(input));}
export function restoreNurbsSourceBRep3(json:string,limits:RecordReadLimits3={}):NurbsSourceBRep3 {return decodeNurbsSourceBRep3(parseNurbsSourceBRepRecord3(json,limits),limits);}
