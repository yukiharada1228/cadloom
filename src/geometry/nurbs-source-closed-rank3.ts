import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import {analyzeNurbsSourceFaceInteriorRegularity3} from './nurbs-source-face-regularity3.js';
import type {NurbsSourceFaceRegularity3} from './nurbs-source-face-regularity3.js';
import {analyzeNurbsSourceFaceBoundaryRegularity3} from './nurbs-source-boundary-regularity3.js';
import type {NurbsSourceBoundaryRegularity3} from './nurbs-source-boundary-regularity3.js';
import {analyzeNurbsSourceFaceVertexRegularity3} from './nurbs-source-vertex-regularity3.js';
import type {NurbsSourceVertexRegularity3} from './nurbs-source-vertex-regularity3.js';
export type NurbsSourceClosedRank3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFacePatches3;reason:'unresolved-patches'}>
 | Readonly<{kind:'analyzed';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;interior:NurbsSourceFaceRegularity3;boundary:NurbsSourceBoundaryRegularity3;vertices:NurbsSourceVertexRegularity3;faces:readonly Readonly<{face:number;status:'regular'|'singular'|'unresolved';positionContinuous:boolean}>[]}>;
/** Rank on the face closure in patches approached through that UV face.
 * Continuity remains separate; no C1/G1, injectivity or material certificate. */
export function analyzeNurbsSourceFaceClosedRank3(source:NurbsSourceFacePatches3):NurbsSourceClosedRank3 {
 assertOwnedNurbsSourceFacePatches3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'unresolved-patches'});
 const interior=analyzeNurbsSourceFaceInteriorRegularity3(source),boundary=analyzeNurbsSourceFaceBoundaryRegularity3(source),vertices=analyzeNurbsSourceFaceVertexRegularity3(source);
 const faces=source.faces.map(f=>{const i=interior.kind==='analyzed'?interior.faces.find(q=>q.face===f.face):undefined,b=boundary.kind==='analyzed'?boundary.faces.find(q=>q.face===f.face):undefined,v=vertices.kind==='analyzed'?vertices.faces.find(q=>q.face===f.face):undefined,singular=i?.status==='singular'||b?.selectedBoundaryRegular===false||v?.vertexRegular===false,regular=i?.status==='regular'&&b?.selectedBoundaryRegular===true&&v?.vertexRegular===true,status=singular?'singular':regular?'regular':'unresolved';return Object.freeze({face:f.face,status,positionContinuous:f.positionContinuous});});
 return Object.freeze({kind:'analyzed',source,interior,boundary,vertices,faces:Object.freeze(faces)});
}
