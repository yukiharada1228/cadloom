import {assertOwnedBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {restoreMixedBRepFaces3} from '../convert/mixed-faces3.js';
import type {MixedBRepFaces3} from '../convert/mixed-faces3.js';
import {intersectMixedBoundaryLine3,intersectMixedBoundaryRay3} from '../geometry/mixed-shell-ray3.js';
import type {MixedBoundaryRay3} from '../geometry/mixed-shell-ray3.js';
import type {Point3,Vector3} from '../geometry/point3.js';
export type BodyBoundaryIntersection3=MixedBoundaryRay3;
const decodedFaces=new WeakMap<Body3,MixedBRepFaces3>();
function faces(body:Body3):MixedBRepFaces3 {
 assertOwnedBody3(body);let result=decodedFaces.get(body);
 if(!result){result=restoreMixedBRepFaces3(body.record);decodedFaces.set(body,result);}return result;
}
/** Exact boundary events for p(t)=origin+t*direction, including negative t.
 * Shared-edge/vertex hits and contained supports retain explicit degeneracy.
 * Shell selection uses the owned Body's shell table, not caller geometry. */
export function intersectBodyLine3(body:Body3,origin:Point3,direction:Vector3,shell?:number):BodyBoundaryIntersection3 {
 return intersectMixedBoundaryLine3(faces(body),origin,direction,shell);
}
/** Forward events t>=0. Parameters are not distances for a nonunit direction. */
export function intersectBodyRay3(body:Body3,origin:Point3,direction:Vector3,shell?:number):BodyBoundaryIntersection3 {
 return intersectMixedBoundaryRay3(faces(body),origin,direction,shell);
}
