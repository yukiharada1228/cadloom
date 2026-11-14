import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {Curve3} from './curve3.js';
import {snapshotCurve3,curveEndpoints3,curveOnSurface3} from './curve3.js';
import {plane3} from './plane3.js';
import {cylinder3} from './surface3.js';
import type {Surface3} from './surface3.js';

export interface BRepEdgeUse3 {readonly edge:number;readonly direction:1|-1;}
export interface BRepFaceInput3 {
  readonly surface:Surface3;
  /** Desired normal relative to the supporting surface. Geometric boundary/normal
   * agreement is not certified by incidence checks; loops explicitly give traversal.
   */
  readonly sense:1|-1;
  readonly loops:readonly (readonly BRepEdgeUse3[])[];
}
export interface BRepEdge3 {readonly curve:Curve3;readonly start:number;readonly end:number;readonly coedges:readonly number[];}
export interface BRepCoedge3 extends BRepEdgeUse3 {
  readonly origin:number;readonly target:number;readonly face:number;readonly loop:number;
  readonly next:number;readonly previous:number;
  /** Only for an edge with exactly two oppositely directed uses; may be same-face. */
  readonly twin:number|null;
}
export interface BRepLoop3 {readonly face:number;readonly coedges:readonly number[];}
export interface BRepFace3 {readonly surface:Surface3;readonly sense:1|-1;readonly loops:readonly number[];readonly shell:number;}
export interface BRepVertexLink3 {
  /** Edge-end ports: 2e at the curve start, 2e+1 at its end. They remain distinct
   * for a periodic edge whose start and end are the same geometric vertex.
   */
  readonly ports:readonly number[];
  /** Each coedge denotes its origin corner, between previous incoming and this outgoing port. */
  readonly corners:readonly number[];
  readonly degrees:readonly number[];
  readonly connected:boolean;
  /** One cycle or one interval, retaining parallel arcs and self-loops. */
  readonly manifold:boolean;
  readonly closed:boolean;
}
export interface BRepShell3 {
  readonly faces:readonly number[];
  readonly closed:boolean;
  readonly consistentlyOriented:boolean;
  /** Local to this edge-connected shell; global vertex contacts may still be singular. */
  readonly manifoldVertices:boolean;
  readonly closedOrientedIncidence:boolean;
}
export type BRepIssue3=
 | {readonly kind:'unused-edge'|'boundary-edge'|'nonmanifold-edge'|'inconsistent-edge-orientation';readonly edge:number}
 | {readonly kind:'nonmanifold-vertex';readonly vertex:number};
export interface BRepTopology3 {
  readonly vertices:readonly AlgebraicCoordinates3[];
  readonly outgoing:readonly (readonly number[])[];
  readonly edges:readonly BRepEdge3[];
  readonly coedges:readonly BRepCoedge3[];
  readonly loops:readonly BRepLoop3[];
  readonly faces:readonly BRepFace3[];
  readonly shells:readonly BRepShell3[];
  readonly vertexLinks:readonly BRepVertexLink3[];
  readonly issues:readonly BRepIssue3[];
  /** Boundary coedge cycles if every boundary vertex has one incoming and one outgoing use. */
  readonly boundaryLoops:readonly (readonly number[])[]|null;
  readonly closed:boolean;
  readonly consistentlyOriented:boolean;
  readonly manifoldVertices:boolean;
  /** Incidence only: no face-domain, geometric normal, embedding or solid certification. */
  readonly closedOrientedIncidence:boolean;
}
function snapshotSurface(surface:Surface3):Surface3 {
  switch(surface.kind){
    case 'plane':{const p=surface.plane;return Object.freeze({kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)});}
    case 'cylinder':return Object.freeze({kind:'cylinder',cylinder:cylinder3(surface.cylinder.axis,surface.cylinder.radiusSquared)});
    default:throw new RangeError('Unknown analytic surface kind');
  }
}
/** Builds explicit shared-edge BRep incidence; does not automatically node or weld
 * coincident edge geometries. Endpoint vertices are welded by exact algebraic equality.
 * Faces must later be certified as connected surface domains with valid boundaries.
 */
export function buildBRepTopology3(inputEdges:readonly Curve3[],inputFaces:readonly BRepFaceInput3[]):BRepTopology3 {
  const curves=inputEdges.map(snapshotCurve3),ends=curves.map(curveEndpoints3);
  curves.forEach((curve,i)=>{
    const periodic=curve.kind==='circular-arc'?curve.arc.fullCircle:curve.kind==='elliptic-arc'?curve.arc.fullEllipse:curve.kind==='planar-arc'&&curve.arc.arc.fullCircle;
    if(!periodic&&compareAlgebraicPoints3(ends[i]![0],ends[i]![1])===0)throw new RangeError('BRep edge must have positive extent; periodic circles are allowed');
  });
  const records=ends.flatMap((points,e)=>points.map((point,end)=>({point,port:2*e+end}))).sort((a,b)=>compareAlgebraicPoints3(a.point,b.point)||a.port-b.port);
  const vertices:AlgebraicCoordinates3[]=[],portVertex:number[]=[];
  for(const record of records){
    if(!vertices.length||compareAlgebraicPoints3(vertices[vertices.length-1]!,record.point)!==0)vertices.push(record.point);
    portVertex[record.port]=vertices.length-1;
  }
  const edges=curves.map((curve,e)=>({curve,start:portVertex[2*e]!,end:portVertex[2*e+1]!,coedges:[] as number[]}));
  const outgoing:number[][]=vertices.map(()=>[]),ports:number[][]=vertices.map(()=>[]);
  edges.forEach((e,id)=>{ports[e.start]!.push(2*id);ports[e.end]!.push(2*id+1);});
  const coedges:{edge:number;direction:1|-1;origin:number;target:number;face:number;loop:number;next:number;previous:number;twin:number|null}[]=[],loops:BRepLoop3[]=[],faceLoops:number[][]=[];
  const faces=inputFaces.map((input,face)=>{
    const surface=snapshotSurface(input.surface);
    if(input.sense!==1&&input.sense!==-1)throw new RangeError('Face sense must be +1 or -1');
    if(!input.loops.length)throw new RangeError('A bounded BRep face requires boundary loops');
    const ids:number[]=[],checked=new Set<number>();faceLoops.push(ids);
    for(const inputLoop of input.loops){
      if(!inputLoop.length)throw new RangeError('BRep boundary loop must be nonempty');
      const loop=loops.length,start=coedges.length,uses:number[]=[];
      inputLoop.forEach((use,index)=>{
        if(!Number.isSafeInteger(use.edge)||use.edge<0||use.edge>=edges.length)throw new RangeError('Coedge must reference an existing edge');
        if(use.direction!==1&&use.direction!==-1)throw new RangeError('Coedge direction must be +1 or -1');
        const edge=edges[use.edge]!;
        if(!checked.has(use.edge)){if(!curveOnSurface3(edge.curve,surface))throw new RangeError('Entire face edge must lie on its supporting surface');checked.add(use.edge);}
        const origin=use.direction===1?edge.start:edge.end,target=use.direction===1?edge.end:edge.start,id=coedges.length;
        coedges.push({edge:use.edge,direction:use.direction,origin,target,face,loop,next:start+(index+1)%inputLoop.length,previous:start+(index+inputLoop.length-1)%inputLoop.length,twin:null});
        uses.push(id);edge.coedges.push(id);outgoing[origin]!.push(id);
      });
      for(const id of uses)if(coedges[id]!.target!==coedges[coedges[id]!.next]!.origin)throw new RangeError('BRep boundary loop must be connected and closed');
      loops.push(Object.freeze({face,coedges:Object.freeze(uses)}));ids.push(loop);
    }
    return {surface,sense:input.sense,loops:Object.freeze(ids),shell:-1};
  });
  const issues:BRepIssue3[]=[],adjacency:number[][]=faces.map(()=>[]);
  edges.forEach((edge,id)=>{
    const uses=edge.coedges;
    if(uses.length===0)issues.push({kind:'unused-edge',edge:id});
    if(uses.length===1)issues.push({kind:'boundary-edge',edge:id});
    if(uses.length>2)issues.push({kind:'nonmanifold-edge',edge:id});
    if(uses.length===2){const a=coedges[uses[0]!]!,b=coedges[uses[1]!]!;if(a.direction!==b.direction){a.twin=uses[1]!;b.twin=uses[0]!;}else issues.push({kind:'inconsistent-edge-orientation',edge:id});}
    for(let i=1;i<uses.length;i++){const a=coedges[uses[0]!]!.face,b=coedges[uses[i]!]!.face;adjacency[a]!.push(b);adjacency[b]!.push(a);}
  });
  const startPort=(h:BRepCoedge3)=>2*h.edge+(h.direction===1?0:1),endPort=(h:BRepCoedge3)=>2*h.edge+(h.direction===1?1:0);
  function link(vertexPorts:readonly number[],corners:readonly number[]):BRepVertexLink3 {
    const neighbors=new Map(vertexPorts.map(p=>[p,[] as number[]]));
    for(const id of corners){const h=coedges[id]!,a=endPort(coedges[h.previous]!),b=startPort(h);neighbors.get(a)!.push(b);neighbors.get(b)!.push(a);}
    const seen=new Set<number>(),pending=vertexPorts.length?[vertexPorts[0]!]:[];
    while(pending.length){const p=pending.pop()!;if(seen.has(p))continue;seen.add(p);for(const neighbor of neighbors.get(p)!)pending.push(neighbor);}
    const degrees=vertexPorts.map(p=>neighbors.get(p)!.length),connected=seen.size===vertexPorts.length,endpoints=degrees.filter(n=>n===1).length;
    const manifold=vertexPorts.length>0&&connected&&degrees.every(n=>n===1||n===2)&&(endpoints===0||endpoints===2);
    return Object.freeze({ports:Object.freeze([...vertexPorts]),corners:Object.freeze([...corners]),degrees:Object.freeze(degrees),connected,manifold,closed:manifold&&endpoints===0});
  }
  const vertexLinks=vertices.map((_,v)=>link(ports[v]!,outgoing[v]!));
  vertexLinks.forEach((report,vertex)=>{if(!report.manifold)issues.push({kind:'nonmanifold-vertex',vertex});});
  const oriented=(e:BRepEdge3)=>e.coedges.length===1||e.coedges.length===2&&coedges[e.coedges[0]!]!.twin!==null;
  const shells:BRepShell3[]=[];
  faces.forEach((first,start)=>{
    if(first.shell!==-1)return;
    const ids=[start],shell=shells.length;first.shell=shell;
    for(let i=0;i<ids.length;i++)for(const neighbor of adjacency[ids[i]!]!)if(faces[neighbor]!.shell===-1){faces[neighbor]!.shell=shell;ids.push(neighbor);}
    ids.sort((a,b)=>a-b);
    const shellCoedges=ids.flatMap(f=>faceLoops[f]!.flatMap(l=>loops[l]!.coedges)),edgeIds=[...new Set(shellCoedges.map(h=>coedges[h]!.edge))],vertexIds=[...new Set(shellCoedges.map(h=>coedges[h]!.origin))],edgeSet=new Set(edgeIds),faceSet=new Set(ids);
    const closed=edgeIds.every(e=>edges[e]!.coedges.length===2),consistentlyOriented=edgeIds.every(e=>oriented(edges[e]!));
    const manifoldVertices=vertexIds.every(v=>link(ports[v]!.filter(p=>edgeSet.has(Math.floor(p/2))),outgoing[v]!.filter(h=>faceSet.has(coedges[h]!.face))).manifold);
    shells.push(Object.freeze({faces:Object.freeze(ids),closed,consistentlyOriented,manifoldVertices,closedOrientedIncidence:closed&&consistentlyOriented&&manifoldVertices}));
  });
  const boundary=edges.filter(e=>e.coedges.length===1).map(e=>e.coedges[0]!),starts=new Map<number,number[]>(),targets=new Map<number,number[]>();
  const append=(map:Map<number,number[]>,v:number,id:number)=>{const values=map.get(v);if(values)values.push(id);else map.set(v,[id]);};
  for(const id of boundary){const h=coedges[id]!;append(starts,h.origin,id);append(targets,h.target,id);}
  const boundaryVertices=new Set([...starts.keys(),...targets.keys()]);let boundaryLoops:readonly (readonly number[])[]|null=null;
  if([...boundaryVertices].every(v=>starts.get(v)?.length===1&&targets.get(v)?.length===1)){
    const seen=new Set<number>(),cycles:(readonly number[])[]=[];
    for(const first of boundary){if(seen.has(first))continue;const cycle:number[]=[];let id=first;do{seen.add(id);cycle.push(id);id=starts.get(coedges[id]!.target)![0]!;}while(id!==first);cycles.push(Object.freeze(cycle));}
    boundaryLoops=Object.freeze(cycles);
  }
  const closed=edges.every(e=>e.coedges.length===2),consistentlyOriented=edges.every(oriented),manifoldVertices=vertexLinks.every(v=>v.manifold);
  return Object.freeze({vertices:Object.freeze(vertices),outgoing:Object.freeze(outgoing.map(ids=>Object.freeze(ids))),edges:Object.freeze(edges.map(e=>Object.freeze({...e,coedges:Object.freeze(e.coedges)}))),coedges:Object.freeze(coedges.map(h=>Object.freeze(h))),loops:Object.freeze(loops),faces:Object.freeze(faces.map(f=>Object.freeze(f))),shells:Object.freeze(shells),vertexLinks:Object.freeze(vertexLinks),issues:Object.freeze(issues.map(i=>Object.freeze(i))),boundaryLoops,closed,consistentlyOriented,manifoldVertices,closedOrientedIncidence:closed&&consistentlyOriented&&manifoldVertices});
}
