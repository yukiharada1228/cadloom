import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsAffineProjection3,nurbsAffineProjectionParameters3,locateAffineProjectedNurbsSurface3} from './nurbs-affine-projection3.js';
import type {NurbsAffineProjectionCertificate3} from './nurbs-affine-projection3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {liftNurbsSurfaceBoundary3} from './nurbs-surface-boundary3.js';
import type {NurbsSurfaceBoundary3} from './nurbs-surface-boundary3.js';
import {evaluateNurbsSurface3} from './nurbs-surface3.js';
import {intersectTrimmedNurbsSurfacePlane3} from './nurbs-trimmed-plane-section3.js';
import type {TrimmedNurbsPlaneSection3} from './nurbs-trimmed-plane-section3.js';
import type {Plane3} from './plane3.js';

/** Embedded oriented face with one outer Jordan ring and disjoint holes.
 * C0 creases are permitted; no smooth-face, sewn BRep or material certificate. */
export interface AffineNurbsFace3 {
 readonly projection:NurbsAffineProjectionCertificate3;
 readonly domain:PreparedNurbsParameterDomain2;
 /** Ring/curve order and parameter direction match the validated domain. */
 readonly boundaries:readonly (readonly NurbsSurfaceBoundary3[])[];
 readonly sample:AlgebraicCoordinates3;
}
const owned=new WeakSet<AffineNurbsFace3>();
function guard(face:AffineNurbsFace3):void {if(!owned.has(face))throw new RangeError('Operation requires a factory-created affine NURBS face');}
/** The closed boundary is required to lie wholly in the support rectangle.
 * Since the rectangle is convex, its containment of a Jordan outer boundary
 * also contains the bounded interior. No silent clipping is performed. */
export function createAffineNurbsFace3(projection:NurbsAffineProjectionCertificate3,input:PreparedNurbsParameterDomain2):AffineNurbsFace3 {
 assertOwnedNurbsAffineProjection3(projection);
 const domain=prepareNurbsParameterDomain2(input.outer,input.holes,input.sense),boundaries=Object.freeze([domain.outer,...domain.holes].map(ring=>Object.freeze(ring.map(curve=>liftNurbsSurfaceBoundary3(projection.surface,curve)))));
 const sample=evaluateNurbsSurface3(projection.surface,domain.sample.u,domain.sample.v),face=Object.freeze({projection,domain,boundaries,sample});owned.add(face);return face;
}
/** Spatial membership uses both exact support equality and trim membership. */
export function locateAffineNurbsFace3(face:AffineNurbsFace3,point:Point3|AlgebraicCoordinates3):NurbsDomainLocation2 {
 guard(face);const p=snapshotExactPoint3(point);if(locateAffineProjectedNurbsSurface3(face.projection,p)==='outside')return 'outside';const uv=nurbsAffineProjectionParameters3(face.projection,p);return face.domain.locate(uv.u,uv.v);
}
export function affineNurbsFacePoint3(face:AffineNurbsFace3,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 guard(face);if(face.domain.locate(u,v)==='outside')throw new RangeError('Parameter lies outside the trimmed face');return evaluateNurbsSurface3(face.projection.surface,u,v);
}
/** Reuses complete trimmed section construction; does not sew a solid. */
export function intersectAffineNurbsFacePlane3(face:AffineNurbsFace3,plane:Plane3):TrimmedNurbsPlaneSection3 {
 guard(face);return intersectTrimmedNurbsSurfacePlane3(face.projection.surface,face.domain,plane);
}
