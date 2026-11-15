import {partitionConvexPolygonByPlanes3} from '../geometry/convex-polygon-plane-arrangement3.js';
import {point3,cross3,dot3,subtract3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import {point2,segment2} from '../geometry/point2.js';
import {planeFrame3} from '../geometry/curve3.js';
import {preparePlanarFace3} from '../geometry/planar-face3.js';
import {encodePlanarDomain3} from './face-domain3.js';
import {triangulatePolygon} from '../geometry/triangulate.js';
import {preparePlanarSolid3} from '../geometry/planar-solid3.js';
import type {BRepTopology3} from '../geometry/brep-topology3.js';
/** Internal exact polygon-to-existing-chart-domain bridge. */
export function encodePlanarPolygonDomain3(polygon:readonly Point3[],normal:Point3){
  const origin=polygon[0]!,u=subtract3(polygon[1]!,origin),v=cross3(normal,u),frame=planeFrame3(origin,u,v),U=dot3(u,u),V=dot3(v,v);
  const points=polygon.map(p=>{const q=subtract3(p,origin);return point2(dot3(q,u).div(U),dot3(q,v).div(V));});
  return encodePlanarDomain3(preparePlanarFace3(frame,[points.map((p,i)=>({kind:'segment' as const,segment:segment2(p,points[(i+1)%points.length]!)}))]));
}
/** Convert already owned/validated Body boundary data into rational planar
 * material geometry. Nonconvex faces and holes are decomposed exactly in charts;
 * curved edges/surfaces and nonrational vertices fail explicitly.
 */
export function planarSolidFromBoundary3(t:BRepTopology3){
  const polygons:Point3[][]=[];
  for(const face of t.faces){
    if(face.surface.kind!=='plane')throw new RangeError('Planar Body operations do not support curved surfaces');
    const plane=face.surface.plane,n=plane.normal,k=(['x','y','z'] as const).find(k=>n[k].sign()!==0)!,origin=point3(k==='x'?plane.offset.neg().div(n[k]):0n,k==='y'?plane.offset.neg().div(n[k]):0n,k==='z'?plane.offset.neg().div(n[k]):0n);
    const seed=n.x.sign()===0?point3(1n,0n):n.y.sign()===0?point3(0n,1n):point3(0n,0n,1n),v=cross3(n,seed),u=cross3(v,n),U=dot3(u,u),V=dot3(v,v);
    const rings=face.loops.map(id=>t.loops[id]!.coedges.map(id=>{
      const coedge=t.coedges[id]!,edge=t.edges[coedge.edge]!;
      if(edge.curve.kind!=='line'&&edge.curve.kind!=='algebraic-segment')throw new RangeError('Planar Body operations require straight boundary edges');
      const p=t.vertices[coedge.origin]!;if(p.x.rational===null||p.y.rational===null||p.z.rational===null)throw new RangeError('Planar Body operations require rational vertices');
      const q=subtract3(point3(p.x.rational,p.y.rational,p.z.rational),origin);return point2(dot3(q,u).div(U),dot3(q,v).div(V));
    }));
    const lift=(p:{x:Point3['x'];y:Point3['y']})=>point3(origin.x.add(u.x.mul(p.x)).add(v.x.mul(p.y)),origin.y.add(u.y.mul(p.x)).add(v.y.mul(p.y)),origin.z.add(u.z.mul(p.x)).add(v.z.mul(p.y)));
    if(rings.length===1){const polygon=rings[0]!.map(lift);try{partitionConvexPolygonByPlanes3(polygon,[]);polygons.push(polygon);continue;}catch(error){if(!(error instanceof RangeError))throw error;}}
    const mesh=triangulatePolygon(rings);
    for(const ids of mesh.triangles){const p=ids.map(id=>lift(mesh.vertices[id]!));polygons.push(face.sense===1?p:p.reverse());}
  }
  return preparePlanarSolid3(polygons);
}
