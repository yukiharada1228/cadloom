import { Rational } from '../numeric/rational.js';
import { point2 } from './point2.js';
import type { Point2 } from './point2.js';
import { point3, dot3, cross3, subtract3, pointsEqual3 } from './point3.js';
import type { Point3 } from './point3.js';
import { plane3, planeFromPoints, evaluatePlane3 } from './plane3.js';
import type { Plane3 } from './plane3.js';
import { triangle3 } from './triangle3.js';
import type { Triangle3 } from './triangle3.js';
import { partitionTriangleByPlanes3 } from './triangle-plane-arrangement.js';
import { booleanPolygons } from './polygon-boolean.js';
import type { BooleanOperation, PolygonRegion } from './polygon-boolean.js';
import { triangulatePolygon } from './triangulate.js';
import { prepareSolid3 } from './solid3.js';
import { createSurfaceLocator3 } from './surface-location3.js';
import { buildTriangleTopology } from './triangle-topology.js';
import type { TriangleTopology } from './triangle-topology.js';
import { inspectTriangleEmbedding } from './triangle-intersection3.js';
import type { PointLocation } from './polygon-location.js';

export interface SolidBooleanResult3 {
  readonly boundary: readonly Triangle3[];
  readonly topology: TriangleTopology;
  readonly volume: Rational;
  /** Exact material membership. Contact points/edges remain boundary. */
  locate(point:Point3):PointLocation;
}
export type SolidBooleanOperand3 = readonly Triangle3[] | SolidBooleanResult3;
const certifiedResults=new WeakSet<SolidBooleanResult3>();
function operand(input:SolidBooleanOperand3){
  if(Array.isArray(input))return prepareSolid3(input);
  const result=input as SolidBooleanResult3;
  if(!certifiedResults.has(result))throw new RangeError('Expected triangles or a Boolean result from this kernel instance');
  return result;
}
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
function canonical(p:Plane3):Plane3 {
  const first=[p.normal.x,p.normal.y,p.normal.z].find(v=>v.sign()!==0)!;
  return plane3(p.normal.x.div(first),p.normal.y.div(first),p.normal.z.div(first),p.offset.div(first));
}
function projection(p:Plane3){
  const n=p.normal;
  const project=(v:Point3):Point2=>n.x.sign()!==0?point2(v.y,v.z):n.y.sign()!==0?point2(v.z,v.x):point2(v.x,v.y);
  const lift=(v:Point2):Point3=>{
    if(n.x.sign()!==0)return point3(n.y.mul(v.x).add(n.z.mul(v.y)).add(p.offset).neg().div(n.x),v.x,v.y);
    if(n.y.sign()!==0)return point3(v.y,n.z.mul(v.x).add(n.x.mul(v.y)).add(p.offset).neg().div(n.y),v.x);
    return point3(v.x,v.y,n.x.mul(v.x).add(n.y.mul(v.y)).add(p.offset).neg().div(n.z));
  };
  return {project,lift};
}
const abs=(r:Rational)=>r.sign()<0?r.neg():r;
function truth(a:boolean,b:boolean,op:BooleanOperation):boolean {
  switch(op){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}
}
function along(p:Point3,d:Point3,t:Rational):Point3 {
  return point3(p.x.add(d.x.mul(t)),p.y.add(d.y.mul(t)),p.z.add(d.z.mul(t)));
}
function onEdge(p:Point3,a:Point3,b:Point3):boolean {
  const c=cross3(subtract3(p,a),subtract3(b,a));
  return c.x.sign()===0&&c.y.sign()===0&&c.z.sign()===0&&dot3(subtract3(p,a),subtract3(p,b)).sign()<=0;
}
/** Regularized exact material Boolean of certified triangular solids.
 * Lower-dimensional intersections contain no material. Results may have nonmanifold
 * contact edges/vertices; these are retained and reported by topology.closedManifold.
 * No tolerance, snapping or floating-point coordinates are used.
 */
export function booleanSolids3(a:SolidBooleanOperand3,b:SolidBooleanOperand3,operation:BooleanOperation):SolidBooleanResult3 {
  if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown Boolean operation');
  const first=operand(a),second=operand(b);
  const groups=new Map<string,{plane:Plane3;regions:[Point2[][],Point2[][]]}>();
  [first,second].forEach((solid,owner)=>{
    const t=solid.topology;
    t.triangles.forEach(ids=>{
      const face=triangle3(t.vertices[ids[0]]!,t.vertices[ids[1]]!,t.vertices[ids[2]]!);
      const plane=canonical(planeFromPoints(...face)),id=`${key(plane.normal)},${plane.offset}`;
      let group=groups.get(id);
      if(!group){group={plane,regions:[[],[]]};groups.set(id,group);}
      group.regions[owner as 0|1].push(face.map(projection(plane).project));
    });
  });
  const patches:Point3[][]=[];
  const all=[...groups.values()];
  for(const group of all){
    const {plane,regions}=group,{project,lift}=projection(plane);
    const coverage=booleanPolygons(regions[0],regions[1],'union').rings;
    const mesh=triangulatePolygon(coverage);
    const others=all.filter(g=>g!==group).map(g=>g.plane);
    const retained:[Point2[][],Point2[][]]=[[],[]];
    for(const ids of mesh.triangles){
      const face=triangle3(lift(mesh.vertices[ids[0]]!),lift(mesh.vertices[ids[1]]!),lift(mesh.vertices[ids[2]]!));
      for(const cell of partitionTriangleByPlanes3(face,others)){
        // Stop before the first other supporting plane in either normal direction.
        let step=new Rational(1n);
        for(const other of others){
          const value=evaluatePlane3(other,cell.witness),slope=dot3(other.normal,plane.normal);
          if(value.sign()===0)throw new Error('Cell witness lies on a distinct cutting plane');
          if(slope.sign()===0)continue;
          const bound=abs(value.div(slope)).div(new Rational(2n));
          if(bound.compare(step)<0)step=bound;
        }
        const side=(s:1|-1)=>{
          const q=along(cell.witness,plane.normal,s===1?step:step.neg());
          const x=first.locate(q),y=second.locate(q);
          if(x==='boundary'||y==='boundary')throw new Error('Boolean side sample reached a surface');
          return truth(x==='inside',y==='inside',operation);
        };
        const positive=side(1),negative=side(-1);
        if(positive!==negative)retained[negative?0:1].push(cell.polygon.map(project));
      }
    }
    // Remove subdivision seams before the final conforming 3D sewing pass.
    retained.forEach((rings,orientation)=>{
      if(!rings.length)return;
      const merged:PolygonRegion=booleanPolygons(rings,[],'union','nonzero').rings;
      const m=triangulatePolygon(merged);
      for(const ids of m.triangles){
        const polygon=ids.map(i=>lift(m.vertices[i]!));
        // Preserve contact lines/points even where material orientation does not
        // change (e.g. a tetrahedron tip touching another face interior).
        for(const cell of partitionTriangleByPlanes3(triangle3(polygon[0]!,polygon[1]!,polygon[2]!),others)){
          const points=[...cell.polygon];
          patches.push(orientation===0?points:points.reverse());
        }
      }
    });
  }
  const vertices=[...new Map(patches.flat().map(p=>[key(p),p])).values()];
  const boundary:Triangle3[]=[];
  for(const polygon of patches){
    const loop:Point3[]=[];
    polygon.forEach((a,i)=>{
      const b=polygon[(i+1)%polygon.length]!,direction=subtract3(b,a);
      const points=vertices.filter(p=>!pointsEqual3(p,b)&&onEdge(p,a,b));
      points.sort((p,q)=>dot3(subtract3(p,a),direction).compare(dot3(subtract3(q,a),direction)));
      loop.push(...points);
    });
    if(loop.length===3){boundary.push(triangle3(loop[0]!,loop[1]!,loop[2]!));continue;}
    const sum=loop.reduce((s,p)=>point3(s.x.add(p.x),s.y.add(p.y),s.z.add(p.z)),point3(0n,0n,0n));
    const count=new Rational(BigInt(loop.length)),center=point3(sum.x.div(count),sum.y.div(count),sum.z.div(count));
    loop.forEach((p,i)=>boundary.push(triangle3(center,p,loop[(i+1)%loop.length]!)));
  }
  const topology=buildTriangleTopology(boundary);
  // Regular closed material may have balanced 4+-use contact edges, but never holes.
  if(topology.edges.some(e=>e.halfEdges.reduce((sum,id)=>sum+(topology.halfEdges[id]!.origin===e.start?1:-1),0)!==0))throw new Error('Boolean result has an unbalanced boundary edge');
  if(!inspectTriangleEmbedding(boundary).embedded)throw new Error('Boolean result has an improper face intersection');
  const six=boundary.reduce((sum,t)=>sum.add(dot3(t[0],cross3(t[1],t[2]))),new Rational(0n));
  const volume=six.div(new Rational(6n));
  if(volume.sign()<0)throw new Error('Boolean result has negative material volume');
  const result=Object.freeze({boundary:Object.freeze(boundary),topology,volume,locate:createSurfaceLocator3(boundary)});
  certifiedResults.add(result);
  return result;
}
