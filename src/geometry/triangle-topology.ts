import { inspectMesh } from "./mesh3.js";
import type { TriangleIndices, TriangleMesh3 } from "./mesh3.js";
import type { Point3 } from "./point3.js";
import type { Rational } from "../numeric/rational.js";
import { triangle3 } from "./triangle3.js";
import type { Triangle3 } from "./triangle3.js";

export interface TopologyHalfEdge3 {
  readonly origin: number;
  readonly target: number;
  readonly face: number;
  readonly edge: number;
  readonly next: number;
  readonly previous: number;
  /** Present only for exactly two oppositely directed uses of an edge. */
  readonly twin: number | null;
}
export interface TopologyEdge3 {
  readonly start: number;
  readonly end: number;
  readonly halfEdges: readonly number[];
}
export interface TopologyFace3 {
  /** Face index is the original input triangle index. */
  readonly vertices: TriangleIndices;
  readonly halfEdge: number;
  readonly shell: number;
}
export interface TriangleShell3 {
  readonly faces: readonly number[];
  readonly closed: boolean;
  /** Boundary edges are allowed; shared edges must be oppositely oriented. */
  readonly consistentlyOriented: boolean;
  readonly closedManifold: boolean;
  /** Null unless this component is a consistently oriented closed manifold. */
  readonly signedVolume: Rational | null;
}
export type TopologyIssue3 =
  | { readonly kind: "boundary-edge" | "nonmanifold-edge" | "inconsistent-edge-orientation"; readonly edge: number }
  | { readonly kind: "nonmanifold-vertex"; readonly vertex: number }
  | { readonly kind: "duplicate-face"; readonly face: number; readonly duplicateOf: number };
export interface TriangleTopology extends TriangleMesh3 {
  readonly outgoing: readonly (readonly number[])[];
  readonly edges: readonly TopologyEdge3[];
  readonly halfEdges: readonly TopologyHalfEdge3[];
  readonly faces: readonly TopologyFace3[];
  readonly shells: readonly TriangleShell3[];
  readonly issues: readonly TopologyIssue3[];
  /** Directed boundary half-edge cycles; null when the boundary branches or is inconsistent. */
  readonly boundaryLoops: readonly (readonly number[])[] | null;
  /** Closed, oriented manifold incidence without duplicate faces; does not certify embedding or outward orientation. */
  readonly closedManifold: boolean;
}
const key = (p:Point3) => `${p.x},${p.y},${p.z}`;
function append(map:Map<number,number[]>,key:number,value:number){
  const values=map.get(key);
  if(values)values.push(value);else map.set(key,[value]);
}

/** Welds exactly equal coordinates and builds immutable triangular surface topology. No snapping/healing. */
export function buildTriangleTopology(input: readonly Triangle3[]): TriangleTopology {
  const snapshots=input.map(t=>triangle3(...t));
  const points=new Map<string,Point3>();
  snapshots.forEach(t=>t.forEach(p=>points.set(key(p),p)));
  const vertices=[...points.values()].sort((a,b)=>a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z));
  const indices=new Map(vertices.map((p,i)=>[key(p),i]));
  const triangles=snapshots.map(t=>Object.freeze([indices.get(key(t[0]))!,indices.get(key(t[1]))!,indices.get(key(t[2]))!] as const));
  const outgoing:number[][]=vertices.map(()=>[]);
  const halfEdges:{origin:number;target:number;face:number;edge:number;next:number;previous:number;twin:number|null}[]=[];
  const edgeMap=new Map<string,{start:number;end:number;halfEdges:number[]}>();
  const links=vertices.map(()=>new Map<number,number[]>());
  triangles.forEach((t,face)=>{
    t.forEach((origin,i)=>{
      const target=t[(i+1)%3]!,other=t[(i+2)%3]!,id=halfEdges.length;
      outgoing[origin]!.push(id);
      halfEdges.push({origin,target,face,edge:-1,next:face*3+(i+1)%3,previous:face*3+(i+2)%3,twin:null});
      const start=Math.min(origin,target),end=Math.max(origin,target),edgeKey=`${start}:${end}`;
      let edge=edgeMap.get(edgeKey);
      if(!edge){edge={start,end,halfEdges:[]};edgeMap.set(edgeKey,edge);}
      edge.halfEdges.push(id);
      const link=links[origin]!;
      append(link,target,other);append(link,other,target);
    });
  });
  const edges=[...edgeMap.values()].sort((a,b)=>a.start-b.start||a.end-b.end);
  const issues:TopologyIssue3[]=[],adjacency:number[][]=triangles.map(()=>[]);
  const seenFaces=new Map<string,number>(),duplicates=new Set<number>();
  triangles.forEach((t,face)=>{
    const faceKey=[...t].sort((a,b)=>a-b).join(":");
    const prior=seenFaces.get(faceKey);
    if(prior===undefined)seenFaces.set(faceKey,face);
    else {issues.push({kind:"duplicate-face",face,duplicateOf:prior});duplicates.add(face);}
  });
  edges.forEach((edge,index)=>{
    const uses=edge.halfEdges;
    uses.forEach(id=>{halfEdges[id]!.edge=index;});
    if(uses.length===1)issues.push({kind:"boundary-edge",edge:index});
    if(uses.length>2)issues.push({kind:"nonmanifold-edge",edge:index});
    if(uses.length===2){
      const a=halfEdges[uses[0]!]!,b=halfEdges[uses[1]!]!;
      if(a.origin===b.target&&a.target===b.origin){a.twin=uses[1]!;b.twin=uses[0]!;}
      else issues.push({kind:"inconsistent-edge-orientation",edge:index});
    }
    // A star connects all incident faces without quadratically expanding edge fans.
    for(let i=1;i<uses.length;i++){
      const a=halfEdges[uses[0]!]!.face,b=halfEdges[uses[i]!]!.face;
      adjacency[a]!.push(b);adjacency[b]!.push(a);
    }
  });
  links.forEach((link,vertex)=>{
    const seen=new Set<number>(),queue=[link.keys().next().value!];
    for(let i=0;i<queue.length;i++){
      const current=queue[i]!;if(seen.has(current))continue;
      seen.add(current);for(const neighbor of link.get(current)!)queue.push(neighbor);
    }
    const degrees=[...link.values()].map(neighbors=>neighbors.length);
    const endpoints=degrees.filter(n=>n===1).length;
    const valid=seen.size===link.size&&degrees.every(n=>n===1||n===2)&&(endpoints===0||endpoints===2);
    if(!valid)issues.push({kind:"nonmanifold-vertex",vertex});
  });
  const faceShells:number[]=[],shells:TriangleShell3[]=[];
  triangles.forEach((_,first)=>{
    if(faceShells[first]!==undefined)return;
    const faces=[first],shell=shells.length;faceShells[first]=shell;
    for(let i=0;i<faces.length;i++)for(const neighbor of adjacency[faces[i]!]!){
      if(faceShells[neighbor]===undefined){faceShells[neighbor]=shell;faces.push(neighbor);}
    }
    faces.sort((a,b)=>a-b);
    const used=[...new Set(faces.flatMap(face=>[...triangles[face]!]))];
    const local=new Map(used.map((id,i)=>[id,i]));
    const report=inspectMesh({vertices:used.map(id=>vertices[id]!),
      triangles:faces.map(face=>{
        const t=triangles[face]!;return [local.get(t[0])!,local.get(t[1])!,local.get(t[2])!] as const;
      })});
    const consistentlyOriented=faces.every(face=>[0,1,2].every(i=>{
      const h=halfEdges[face*3+i]!;
      return edges[h.edge]!.halfEdges.length===1||h.twin!==null;
    }));
    const closedManifold=report.closed&&report.consistentlyOriented&&report.manifoldVertices&&!faces.some(face=>duplicates.has(face));
    shells.push(Object.freeze({faces:Object.freeze(faces),closed:report.closed,consistentlyOriented,
      closedManifold,signedVolume:closedManifold?report.signedVolume:null}));
  });
  const boundary=edges.filter(e=>e.halfEdges.length===1).map(e=>e.halfEdges[0]!);
  const starts=new Map<number,number[]>(),ends=new Map<number,number[]>();
  for(const id of boundary){
    const h=halfEdges[id]!;
    append(starts,h.origin,id);append(ends,h.target,id);
  }
  const boundaryVertices=new Set([...starts.keys(),...ends.keys()]);
  let boundaryLoops:readonly (readonly number[])[]|null=null;
  if([...boundaryVertices].every(v=>starts.get(v)?.length===1&&ends.get(v)?.length===1)){
    const loops:(readonly number[])[]=[],seen=new Set<number>();
    for(const first of boundary){
      if(seen.has(first))continue;
      const loop:number[]=[];let current=first;
      do{
        seen.add(current);loop.push(current);
        current=starts.get(halfEdges[current]!.target)![0]!;
      }while(current!==first);
      loops.push(Object.freeze(loop));
    }
    boundaryLoops=Object.freeze(loops);
  }
  return Object.freeze({vertices:Object.freeze(vertices),triangles:Object.freeze(triangles),
    outgoing:Object.freeze(outgoing.map(ids=>Object.freeze(ids))),
    edges:Object.freeze(edges.map(e=>Object.freeze({...e,halfEdges:Object.freeze(e.halfEdges)}))),
    halfEdges:Object.freeze(halfEdges.map(h=>Object.freeze(h))),
    faces:Object.freeze(triangles.map((t,i)=>Object.freeze({vertices:t,halfEdge:i*3,shell:faceShells[i]!}))),
    shells:Object.freeze(shells),issues:Object.freeze(issues.map(issue=>Object.freeze(issue))),boundaryLoops,
    closedManifold:issues.length===0});
}
