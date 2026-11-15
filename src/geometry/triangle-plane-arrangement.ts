import {triangle3} from './triangle3.js';
import type {Triangle3} from './triangle3.js';
import type {Plane3} from './plane3.js';
import {partitionConvexPolygonByPlanes3} from './convex-polygon-plane-arrangement3.js';
import type {ConvexPolygonPlaneCell3} from './convex-polygon-plane-arrangement3.js';

export type TrianglePlaneCell3=ConvexPolygonPlaneCell3;
/** Triangle entry point for the shared exact convex planar subdivision engine. */
export function partitionTriangleByPlanes3(input:Triangle3,inputPlanes:readonly Plane3[]):readonly TrianglePlaneCell3[] {
  return partitionConvexPolygonByPlanes3(triangle3(...input),inputPlanes);
}
