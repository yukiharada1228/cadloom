import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {partitionConvexPolygonByPlanes3} from './convex-polygon-plane-arrangement3.js';
import type {ConvexPolygonPlaneCell3} from './convex-polygon-plane-arrangement3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {sewBRepFaces3} from './sew-brep3.js';
import type {SewnBRep3,SewBRepOptions3} from './sew-brep3.js';

export interface PlanarBRepCell3 extends ConvexPolygonPlaneCell3 {
  readonly sourceFace:number;
}
export interface PlanarBRepEdgeOrigin3 {
  readonly sourceFace:number;
  /** Output face index, also the index in cells. */
  readonly cell:number;
  readonly polygonEdge:number;
  /** Input polygon edge, or null for a newly introduced cut. */
  readonly sourceEdge:number|null;
  /** Input planes containing the entire edge, including coincident supports. */
  readonly planes:readonly number[];
  /** Traversal relative to the shared output edge. */
  readonly direction:1|-1;
}
export interface PartitionedPlanarBRep3 {
  readonly cells:readonly PlanarBRepCell3[];
  readonly sewn:SewnBRep3;
  /** Shared output edge → all source boundary/cut uses. */
  readonly edgeOrigins:readonly (readonly PlanarBRepEdgeOrigin3[])[];
}
function onSegment(p:Point3,a:Point3,b:Point3):boolean {
  const d=subtract3(b,a),q=subtract3(p,a),c=cross3(d,q);
  return dot3(c,c).sign()===0&&dot3(q,subtract3(p,b)).sign()<=0;
}
/** Subdivide rational convex planar faces, then node all resulting boundary
 * endpoints and sew shared edges. Input polygon winding defines physical normals.
 * Output face indices agree with cells; source face/edge IDs and cutting-plane
 * incidence survive edge subdivision. No tolerance or triangulation is used.
 *
 * The input is an oriented polygon soup, not an owned solid. requireClosed checks
 * manifold oriented incidence only. Arbitrary face intersections not supplied as
 * cutting planes, global embedding, shell nesting and material are not certified.
 */
export function partitionPlanarBRepFaces3(input:readonly (readonly Point3[])[],inputPlanes:readonly Plane3[],options:SewBRepOptions3={}):PartitionedPlanarBRep3 {
  const polygons=input.map(p=>p.map(v=>point3(v.x,v.y,v.z))),planes=inputPlanes.map(p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset));
  const cells=Object.freeze(polygons.flatMap((polygon,sourceFace)=>partitionConvexPolygonByPlanes3(polygon,planes).map(cell=>Object.freeze({...cell,sourceFace}))));
  const origins=cells.map(cell=>cell.polygon.map((a,i)=>{
    const b=cell.polygon[(i+1)%cell.polygon.length]!,polygon=polygons[cell.sourceFace]!;
    const sourceEdge=polygon.findIndex((p,j)=>onSegment(a,p,polygon[(j+1)%polygon.length]!)&&onSegment(b,p,polygon[(j+1)%polygon.length]!));
    const containing=Object.freeze(planes.flatMap((p,j)=>evaluatePlane3(p,a).sign()===0&&evaluatePlane3(p,b).sign()===0?[j]:[]));
    if(sourceEdge<0&&!containing.length)throw new Error('Partition edge has neither boundary nor cut provenance');
    return {sourceEdge:sourceEdge<0?null:sourceEdge,planes:containing};
  }));
  const sewn=sewBRepFaces3(cells.map(cell=>{
    const p=cell.polygon,normal=p.reduce((sum,a,i)=>{const c=cross3(subtract3(a,p[0]!),subtract3(p[(i+1)%p.length]!,p[0]!));return point3(sum.x.add(c.x),sum.y.add(c.y),sum.z.add(c.z));},point3(0n,0n));
    return {surface:{kind:'plane' as const,plane:plane3(normal.x,normal.y,normal.z,dot3(normal,p[0]!).neg())},sense:1 as const,loops:[p.map((a,i)=>({kind:'algebraic-segment' as const,segment:algebraicSegment3(a,p[(i+1)%p.length]!)}))]};
  }),options);
  const edgeOrigins:PlanarBRepEdgeOrigin3[][]=sewn.topology.edges.map(()=>[]);
  sewn.sourceUses.forEach((loops,cell)=>loops[0]!.forEach((uses,polygonEdge)=>uses.forEach(use=>edgeOrigins[use.edge]!.push(Object.freeze({sourceFace:cells[cell]!.sourceFace,cell,polygonEdge,...origins[cell]![polygonEdge]!,direction:use.direction})))));
  return Object.freeze({cells,sewn,edgeOrigins:Object.freeze(edgeOrigins.map(uses=>Object.freeze(uses)))});
}
