import {materialOfNurbsBody3} from '../model/nurbs-body3.js';
import type {NurbsBody3} from '../model/nurbs-body3.js';
import type {Plane3} from '../geometry/plane3.js';
import {intersectSewnNurbsSourceBoundaryPlane3} from '../geometry/sewn-nurbs-source-boundary-plane3.js';
import type {SewnNurbsBoundaryPlane3} from '../geometry/sewn-nurbs-source-boundary-plane3.js';
/** Complete per-face boundary locus; cap material and child Bodies are not inferred. */
export function intersectNurbsBodyBoundaryPlane3(body:NurbsBody3,plane:Plane3):SewnNurbsBoundaryPlane3 {
 return intersectSewnNurbsSourceBoundaryPlane3(materialOfNurbsBody3(body),plane);
}
