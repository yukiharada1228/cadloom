import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsSourceFaceComplex3,evaluateNurbsSourceComplexEdge3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3} from './brep-topology3.js';
type Prepared=Extract<NurbsSourceFaceComplex3,{kind:'prepared'}>;
export interface NurbsSourceBRepEdge3 {readonly complex:Prepared;readonly edge:number;}
export interface NurbsSourceBRepFace3 {readonly complex:Prepared;readonly face:number;}
export interface NurbsSourceBRep3 {
 readonly sense:1|-1;readonly complex:Prepared;readonly topology:BRepTopology3<NurbsSourceBRepEdge3,NurbsSourceBRepFace3>;
 /** Complex vertex -> topology vertex; exact spatial coincidences may weld
  * distinct UV vertices. This mapping preserves that distinction in source. */
 readonly sourceVertices:readonly number[];
 /** Topology face -> original source UV face ID (not its array ordinal). */
 readonly sourceFaces:readonly number[];
}
const owned=new WeakSet<NurbsSourceBRep3>(),ownedEdges=new WeakSet<NurbsSourceBRepEdge3>(),ownedFaces=new WeakSet<NurbsSourceBRepFace3>();
export function assertOwnedNurbsSourceBRep3(input:NurbsSourceBRep3):void {if(!owned.has(input))throw new RangeError('Expected factory-created NURBS source BRep');}
/** Bridge certified finite source faces to the shared incidence engine.
 * Whole-edge membership comes from validated complex incidences, not samples.
 * No new spatial edge coincidence or global solid certificate is inferred. */
export function buildNurbsSourceBRep3(complex:NurbsSourceFaceComplex3,sense:1|-1=1):NurbsSourceBRep3 {
 assertOwnedNurbsSourceFaceComplex3(complex);if(complex.kind!=='prepared')throw new RangeError('Source face complex is not prepared');if(sense!==1&&sense!==-1)throw new RangeError('NURBS source BRep sense must be +1 or -1');
 const edges=complex.edges.map((_,edge)=>{const q=Object.freeze({complex,edge});ownedEdges.add(q);return q;}),faces=complex.faces.map(f=>{const q=Object.freeze({complex,face:f.face});ownedFaces.add(q);return q;});
 const ends=(e:NurbsSourceBRepEdge3)=>{const q=e.complex.edges[e.edge]!;return [e.complex.vertices[q.from]!.point,e.complex.vertices[q.to]!.point] as const;};
 const topology=buildBRepTopologyWithGeometryAdapters3(edges,faces.map((surface,i)=>({surface,sense,loops:complex.faces[i]!.cycles.map(c=>sense===1?c.uses:[...c.uses].reverse().map(u=>Object.freeze({edge:u.edge,direction:(-u.direction) as 1|-1})))})),{
  snapshot:(e:NurbsSourceBRepEdge3)=>{if(!ownedEdges.has(e))throw new RangeError('Expected factory-created source BRep edge');return e;},endpoints:ends,closed:()=>false,
  snapshotSurface:(f:NurbsSourceBRepFace3)=>{if(!ownedFaces.has(f))throw new RangeError('Expected factory-created source BRep face');return f;},
  onSurface:(e,f)=>e.complex===f.complex&&e.complex.edges[e.edge]!.uses.some(u=>u.face===f.face),
 });
 const sourceVertices=complex.vertices.map(v=>{const id=topology.vertices.findIndex(q=>compareAlgebraicPoints3(q,v.point)===0);if(id<0)throw new Error('Source BRep lost a boundary vertex');return id;});
 const result=Object.freeze({sense,complex,topology,sourceVertices:Object.freeze(sourceVertices),sourceFaces:Object.freeze(faces.map(f=>f.face))});owned.add(result);return result;
}
export function nurbsSourceBRepEdgePoint3(edge:NurbsSourceBRepEdge3,input:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!ownedEdges.has(edge))throw new RangeError('Expected factory-created source BRep edge');return evaluateNurbsSourceComplexEdge3(edge.complex,edge.edge,0,input).point;
}
