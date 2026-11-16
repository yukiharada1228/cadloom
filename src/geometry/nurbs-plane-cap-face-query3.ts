import {assertOwnedNurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import type {NurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import {queryNurbsPlaneCapLoopWinding3} from './nurbs-plane-cap-winding3.js';
import type {NurbsPlaneCapLoopWinding3} from './nurbs-plane-cap-winding3.js';
import {snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
import {mapPlanePoint3} from './plane-frame3.js';
export type NurbsPlaneCapFaceLocation3=
 | Readonly<{kind:'located';surface:NurbsPlaneCapFaceSurface3;point:AlgebraicCoordinates2;location:'inside'|'outside'|'boundary';loop?:number}>
 | Readonly<{kind:'unresolved';surface:NurbsPlaneCapFaceSurface3;point:AlgebraicCoordinates2;reason:'direction-budget';query:NurbsPlaneCapLoopWinding3}>;
/** Closed cap domain: inside its outer loop and outside its immediate holes.
 * Descendant material islands belong to separate owned cap faces. */
export function locateNurbsPlaneCapFace3(surface:NurbsPlaneCapFaceSurface3,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsPlaneCapFaceLocation3 {
 assertOwnedNurbsPlaneCapFaceSurface3(surface);const point=snapshotExactPoint2(input),source=surface.source,B=source.boundary,group=source.faces[surface.face]!;
 const located=(location:'inside'|'outside'|'boundary',loop?:number):NurbsPlaneCapFaceLocation3=>Object.freeze({kind:'located',surface,point,location,...(loop===undefined?{}:{loop})});
 for(const [i,loop] of [group.outer,...group.holes].entries()){
  const query=queryNurbsPlaneCapLoopWinding3(B,loop,point,options);
  if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',surface,point,reason:'direction-budget',query});
  if(query.kind==='boundary')return located('boundary',loop);
  if(i===0?query.winding===0:query.winding!==0)return located('outside');
 }
 return located('inside');
}
/** Evaluate only points in the finite closed planar cap domain. */
export function nurbsPlaneCapFacePoint3(surface:NurbsPlaneCapFaceSurface3,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}) {
 const location=locateNurbsPlaneCapFace3(surface,input,options);
 if(location.kind==='unresolved'||location.location==='outside')return location;
 return Object.freeze({kind:'point' as const,surface,parameter:location.point,point:mapPlanePoint3(surface.source.boundary.frame,location.point),location:location.location});
}
