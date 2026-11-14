import { Rational } from "../numeric/rational.js";
import { point2 } from "./point2.js";
import type { ExactInput } from "./point2.js";

export interface Point3 { readonly x: Rational; readonly y: Rational; readonly z: Rational }
export type TriangleIndices = readonly [number, number, number];
export interface TriangleMesh3 {
  readonly vertices: readonly Point3[];
  readonly triangles: readonly TriangleIndices[];
}
export function point3(x: ExactInput, y: ExactInput, z: ExactInput = 0n): Point3 {
  const xy = point2(x,y);
  return Object.freeze({x:xy.x,y:xy.y,z:point2(z,0n).x});
}

function triple(a: Point3, b: Point3, c: Point3): Rational {
  return a.x.mul(b.y.mul(c.z).sub(b.z.mul(c.y)))
    .add(a.y.mul(b.z.mul(c.x).sub(b.x.mul(c.z))))
    .add(a.z.mul(b.x.mul(c.y).sub(b.y.mul(c.x))));
}

export interface MeshInspection {
  readonly closed: boolean;
  readonly consistentlyOriented: boolean;
  readonly nondegenerate: boolean;
  readonly manifoldVertices: boolean;
  readonly signedVolume: Rational;
}

/** Exact incidence/link and oriented-volume checks; does not test spatial self-intersections. */
export function inspectMesh(mesh: TriangleMesh3): MeshInspection {
  const edges = new Map<string,{count:number;balance:number}>();
  const links = mesh.vertices.map(() => new Map<number,number[]>());
  let sixVolume = new Rational(0n), nondegenerate = true;
  for (const ids of mesh.triangles) {
    if(ids.length!==3 || ids.some(i=>!Number.isInteger(i)||i<0||i>=mesh.vertices.length)) {
      throw new RangeError("Triangle indices must reference three existing vertices");
    }
    const [a,b,c] = ids.map(i=>mesh.vertices[i]!) as [Point3,Point3,Point3];
    const u=point3(b.x.sub(a.x),b.y.sub(a.y),b.z.sub(a.z));
    const v=point3(c.x.sub(a.x),c.y.sub(a.y),c.z.sub(a.z));
    if(u.y.mul(v.z).sub(u.z.mul(v.y)).sign()===0 &&
       u.z.mul(v.x).sub(u.x.mul(v.z)).sign()===0 &&
       u.x.mul(v.y).sub(u.y.mul(v.x)).sign()===0) nondegenerate=false;
    sixVolume=sixVolume.add(triple(a,b,c));
    for(let i=0;i<3;i++) {
      const origin=ids[i]!,target=ids[(i+1)%3]!,other=ids[(i+2)%3]!;
      const key=origin<target?`${origin}:${target}`:`${target}:${origin}`;
      const edge=edges.get(key)??{count:0,balance:0};
      edge.count++; edge.balance+=origin<target?1:-1; edges.set(key,edge);
      const link=links[origin]!;
      link.set(target,[...(link.get(target)??[]),other]);
      link.set(other,[...(link.get(other)??[]),target]);
    }
  }
  const manifoldVertices=links.every(link=>{
    if(link.size===0) return false; // Unused vertices are not part of a closed surface.
    if([...link.values()].some(neighbors=>neighbors.length!==2)) return false;
    const seen=new Set<number>(),queue=[link.keys().next().value!];
    for(let i=0;i<queue.length;i++) {
      const vertex=queue[i]!;
      if(seen.has(vertex))continue;
      seen.add(vertex);queue.push(...link.get(vertex)!);
    }
    return seen.size===link.size;
  });
  return Object.freeze({
    closed:[...edges.values()].every(e=>e.count===2),
    consistentlyOriented:[...edges.values()].every(e=>e.count===2&&e.balance===0),
    nondegenerate,manifoldVertices,signedVolume:sixVolume.div(new Rational(6n)),
  });
}
