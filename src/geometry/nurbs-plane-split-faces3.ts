import {assertOwnedNurbsPlaneCellSourceNoding3} from './nurbs-plane-cell-source-nodes3.js';
import type {NurbsPlaneCellSourceNoding3,NurbsPlaneCellSourceNodes3} from './nurbs-plane-cell-source-nodes3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3} from './brep-topology3.js';
import {nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {AlgebraicReal as Real} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
export interface NurbsPlaneSplitFaceEdge3 {readonly source:NurbsPlaneCellSourceNodes3;readonly edge:number;}
export interface NurbsPlaneSplitFaceSurface3 {
 readonly source:NurbsPlaneCellSourceNodes3;readonly region:number;
 readonly sourceFace:number;readonly sign:-1|0|1;
}
export type NurbsPlaneSplitFaces3=
 | Readonly<{kind:'unresolved';source:NurbsPlaneCellSourceNoding3;reason:'edge-noding'|'non-simple-region';region?:number}>
 | Readonly<{kind:'built';source:NurbsPlaneCellSourceNodes3;topology:BRepTopology3<NurbsPlaneSplitFaceEdge3,NurbsPlaneSplitFaceSurface3>;
   /** Noded edge -> adopted topology edge; internal same-region seams are null. */
   sourceEdges:readonly (number|null)[];sourceVertices:readonly (number|null)[]}>;
const ownedEdges=new WeakSet<NurbsPlaneSplitFaceEdge3>(),ownedSurfaces=new WeakSet<NurbsPlaneSplitFaceSurface3>();
/** Adopt oriented region loops into common BRep incidence. Original surface
 * restrictions/provenance remain owned; no cap or closed child Body is made. */
export function buildNurbsPlaneSplitFaces3(source:NurbsPlaneCellSourceNoding3):NurbsPlaneSplitFaces3 {
 assertOwnedNurbsPlaneCellSourceNoding3(source);
 if(source.kind!=='noded')return Object.freeze({kind:'unresolved',source,reason:'edge-noding'});
 for(const [region,r] of source.regions.entries())if(r.cycles===null)return Object.freeze({kind:'unresolved',source,reason:'non-simple-region',region});
 const selected=new Set(source.regions.flatMap(r=>r.cycles!.flatMap(c=>c.map(u=>u.edge)))),sourceEdges:(number|null)[]=source.edges.map(()=>null),curves:NurbsPlaneSplitFaceEdge3[]=[];
 for(const edge of [...selected].sort((a,b)=>a-b)){sourceEdges[edge]=curves.length;const curve=Object.freeze({source,edge});ownedEdges.add(curve);curves.push(curve);}
 const originalFace=source.source.vertices.face,sense=source.source.vertices.source.topology.faces[originalFace]!.sense;
 const faces=source.regions.map((r,region)=>{
  const surface=Object.freeze({source,region,sourceFace:originalFace,sign:r.sign});ownedSurfaces.add(surface);
  const loops=r.cycles!.map(c=>{const uses=c.map(u=>({edge:sourceEdges[u.edge]!,direction:u.direction}));return sense===1?uses:uses.reverse().map(u=>({edge:u.edge,direction:(-u.direction) as 1|-1}));});
  return {surface,sense,loops};
 });
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{
  snapshot:(e:NurbsPlaneSplitFaceEdge3)=>{if(!ownedEdges.has(e))throw new RangeError('Expected factory-created split-face edge');return e;},
  endpoints:e=>{const q=e.source.edges[e.edge]!;return [e.source.vertices[q.from]!.point,e.source.vertices[q.to]!.point] as const;},closed:()=>false,
  snapshotSurface:(s:NurbsPlaneSplitFaceSurface3)=>{if(!ownedSurfaces.has(s))throw new RangeError('Expected factory-created split-face surface');return s;},
  onSurface:(e,s)=>e.source===s.source&&s.source.regions[s.region]!.boundary.some(u=>u.edge===e.edge),
 });
 if(!topology.consistentlyOriented)throw new Error('Split-face region orientation is inconsistent');
 const sourceVertices=source.vertices.map(v=>{const id=topology.vertices.findIndex(p=>p.x.compare(v.point.x)===0&&p.y.compare(v.point.y)===0&&p.z.compare(v.point.z)===0);return id<0?null:id;});
 return Object.freeze({kind:'built',source,topology,sourceEdges:Object.freeze(sourceEdges),sourceVertices:Object.freeze(sourceVertices)});
}
export function nurbsPlaneSplitFaceEdgePoint3(edge:NurbsPlaneSplitFaceEdge3,input:AlgebraicReal|ExactInput) {
 if(!ownedEdges.has(edge))throw new RangeError('Expected factory-created split-face edge');
 const e=edge.source.edges[edge.edge]!,t=input instanceof Real?input:Real.fromRational(input);
 if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the split-face edge');
 return nurbsSourcePlaneCellComplexEdgePoint3(edge.source.source.vertices.cells,e.parent,t).point;
}
