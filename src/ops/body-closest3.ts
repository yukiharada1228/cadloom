import {assertOwnedBody3,planarSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {planarSolidFromBoundary3} from '../convert/planar-body3.js';
import type {PreparedPlanarSolid3} from '../geometry/planar-solid3.js';
import {closestPointOnPlanarSolidBoundary3} from '../geometry/closest-planar-solid3.js';
import type {PlanarBoundaryClosest3} from '../geometry/closest-planar-solid3.js';
import type {Point3} from '../geometry/point3.js';
const sources=new WeakMap<Body3,PreparedPlanarSolid3>();
/** Boundary distance, not distance to closed material. Curved surfaces/edges
 * and nonrational vertices require a different backend and fail explicitly. */
export function closestPointOnPlanarBodyBoundary3(body:Body3,point:Point3):PlanarBoundaryClosest3 {
 assertOwnedBody3(body);let source=sources.get(body);
 if(!source){source=planarSourceOfBody3(body)??planarSolidFromBoundary3(body.topology);sources.set(body,source);}
 return closestPointOnPlanarSolidBoundary3(source,point);
}
