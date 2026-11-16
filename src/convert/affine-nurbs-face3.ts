import {assertOwnedAffineNurbsFace3,createAffineNurbsFace3} from '../geometry/affine-nurbs-face3.js';
import type {AffineNurbsFace3} from '../geometry/affine-nurbs-face3.js';
import {certifyNurbsSurfaceAffineProjection3} from '../geometry/nurbs-affine-projection3.js';
import {prepareNurbsParameterDomain2} from '../geometry/nurbs-parameter-domain2.js';
import {sewAffineNurbsFaces3} from '../geometry/sew-affine-nurbs-faces3.js';
import type {SewnAffineNurbsFaces3} from '../geometry/sew-affine-nurbs-faces3.js';
import {encodeCurveRecord3,decodeCurveRecord3,encodeSurfaceRecord3,decodeSurfaceRecord3} from './geometry3.js';
import {readAffineNurbsFaceRecord3,readAffineNurbsFacesDocument3,parseAffineNurbsFacesDocument3} from '../record/affine-nurbs-face3.js';
import type {AffineNurbsFaceRecord3,AffineNurbsFacesDocument3} from '../record/affine-nurbs-face3.js';
import type {RecordReadLimits3} from '../record/schema.js';

/** Store defining geometry only; never serialize ownership or unchecked flags. */
export function encodeAffineNurbsFace3(face:AffineNurbsFace3):AffineNurbsFaceRecord3 {
 assertOwnedAffineNurbsFace3(face);
 const surface=encodeSurfaceRecord3({kind:'nurbs',surface:face.projection.surface});if(surface.kind!=='nurbs')throw new Error('NURBS support encoding invariant');
 const ring=(curves:typeof face.domain.outer)=>Object.freeze(curves.map(c=>{const record=encodeCurveRecord3({kind:'nurbs',curve:c});if(record.kind!=='nurbs')throw new Error('NURBS boundary encoding invariant');return record;}));
 return Object.freeze({version:1,kind:'affine-nurbs-face',surface,outer:ring(face.domain.outer),holes:Object.freeze(face.domain.holes.map(ring)),sense:face.domain.sense});
}
/** Recompute the affine left inverse, seams, Jordan loops, orientation,
 * rectangle containment and lifted boundaries before conferring ownership. */
export function decodeAffineNurbsFace3(input:unknown,limits:RecordReadLimits3={}):AffineNurbsFace3 {
 const record=readAffineNurbsFaceRecord3(input,limits),surface=decodeSurfaceRecord3(record.surface);if(surface.kind!=='nurbs')throw new Error('NURBS support decoding invariant');
 const projection=certifyNurbsSurfaceAffineProjection3(surface.surface);if(projection.kind!=='certified')throw new RangeError(`NURBS face affine embedding is not certified: ${projection.reason}`);
 const ring=(records:typeof record.outer)=>records.map(r=>{const c=decodeCurveRecord3(r);if(c.kind!=='nurbs')throw new Error('NURBS boundary decoding invariant');return c.curve;});
 return createAffineNurbsFace3(projection.certificate,prepareNurbsParameterDomain2(ring(record.outer),record.holes.map(ring),record.sense));
}
export function affineNurbsFacesDocument3(faces:readonly AffineNurbsFace3[]):AffineNurbsFacesDocument3 {return Object.freeze({version:1,kind:'affine-nurbs-faces',faces:Object.freeze(Array.from(faces,encodeAffineNurbsFace3))});}
export function serializeAffineNurbsFaces3(faces:readonly AffineNurbsFace3[]):string {return JSON.stringify(affineNurbsFacesDocument3(faces));}
/** Regenerates all endpoint cuts, interval identities and common incidence.
 * The document is a face collection, not an accepted material Body. */
export function restoreAffineNurbsFaces3(input:unknown,limits:RecordReadLimits3={}):SewnAffineNurbsFaces3 {
 const record=typeof input==='string'?parseAffineNurbsFacesDocument3(input,limits):readAffineNurbsFacesDocument3(input,limits);
 return sewAffineNurbsFaces3(record.faces.map(face=>decodeAffineNurbsFace3(face,limits)));
}
