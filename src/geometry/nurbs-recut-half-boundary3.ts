import {assertOwnedNurbsRecutAssemblyJoin3,nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutAssemblyJoin3,NurbsRecutJoinedCurve3,NurbsRecutJoinedSurface3} from './nurbs-recut-face-join3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';
import {intersectPlanes3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {dot3,point3,cross3} from './point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {planeFrame3,pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Joined=Extract<NurbsRecutAssemblyJoin3,{kind:'joined'}>;
export type NurbsRecutHalfBoundary3=
 | Readonly<{kind:'unresolved';source:NurbsRecutAssemblyJoin3;side:1|-1;reason:'assembly'|'coplanar-face'|'incidence'|'non-section-boundary';face?:number}>
 | Readonly<{kind:'selected';source:Joined;side:1|-1;plane:Plane3;signs:readonly (1|-1)[];topology:BRepTopology3<NurbsRecutJoinedCurve3,NurbsRecutJoinedSurface3>;sourceEdges:readonly (number|null)[];sourceVertices:readonly (number|null)[];sourceFaces:readonly (number|null)[];
   /** One selected face and one opposite-signed parent face certify the entire
    * boundary edge lies in the cutting plane, not merely its endpoints. */
   boundary:readonly Readonly<{edge:number;sourceEdge:number;selectedFace:number;oppositeFace:number}>[]}>;
const owned=new WeakSet<NurbsRecutHalfBoundary3>();
export function assertOwnedNurbsRecutHalfBoundary3(report:NurbsRecutHalfBoundary3):void {if(!owned.has(report))throw new RangeError('Expected factory-created recut half boundary');}
/** Extract one signed closure with original finite surfaces and curve objects.
 * Zero-dimensional contacts are not promoted to faces; coplanar 2D faces
 * remain explicitly unresolved pending regularized orientation handling. */
export function selectNurbsRecutHalfBoundary3(source:NurbsRecutAssemblyJoin3,side:1|-1):NurbsRecutHalfBoundary3 {
 assertOwnedNurbsRecutAssemblyJoin3(source);if(side!==1&&side!==-1)throw new RangeError('Expected side +1 or -1');const own=<T extends NurbsRecutHalfBoundary3>(r:T):T=>{owned.add(r);return r;},fail=(reason:Extract<NurbsRecutHalfBoundary3,{kind:'unresolved'}>['reason'],face?:number):NurbsRecutHalfBoundary3=>own(Object.freeze({kind:'unresolved',source,side,reason,...(face===undefined?{}:{face})}));if(source.kind!=='joined')return fail('assembly');
 const T=source.topology,plane=source.source.source.plane,signs:(1|-1)[]=[];
 for(const [face,f] of T.faces.entries()){
  const surface=f.surface,p=surface.kind==='source'?surface.source.source.source.vertices.cells.source.plane:surface.source.source.source.section.plane,sign=surface.kind==='source'?surface.source.sign:surface.source.side;
  if(intersectPlanes3(p,plane).kind!=='coincident')throw new Error('Joined face lost its cutting plane');const orientation=dot3(p.normal,plane.normal).sign();if(orientation===0)throw new Error('Coincident cutting planes lost parallel normals');if(sign===0)return fail('coplanar-face',face);signs.push((sign*orientation) as 1|-1);
 }
 const selectedFaces=T.faces.flatMap((_,i)=>signs[i]===side?[i]:[]),selected=new Set(selectedFaces),edgeIds=T.edges.flatMap((e,i)=>e.coedges.some(h=>selected.has(T.coedges[h]!.face))?[i]:[]),curves=edgeIds.map(i=>T.edges[i]!.curve),indices=new Map(curves.map((c,i)=>[c,i])),sourceEdges:(number|null)[]=T.edges.map(()=>null),sourceFaces:(number|null)[]=T.faces.map(()=>null),members=new Map<NurbsRecutJoinedSurface3,Set<number>>();edgeIds.forEach((i,j)=>{sourceEdges[i]=j;});
 const faces=selectedFaces.map((id,i)=>{const f=T.faces[id]!,loops=f.loops.map(l=>T.loops[l]!.coedges.map(h=>{const use=T.coedges[h]!;return {edge:sourceEdges[use.edge]!,direction:use.direction};}));sourceFaces[id]=i;members.set(f.surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));return {surface:f.surface,sense:f.sense,loops};});
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{snapshot:c=>{if(!indices.has(c))throw new RangeError('Expected selected half curve');return c;},endpoints:c=>{const e=T.edges[edgeIds[indices.get(c)!]!]!;return [T.vertices[e.start]!,T.vertices[e.end]!] as const;},closed:()=>false,snapshotSurface:s=>{if(!members.has(s))throw new RangeError('Expected selected half surface');return s;},onSurface:(c,s)=>members.get(s)?.has(indices.get(c)!)??false});
 if(!topology.consistentlyOriented||!topology.manifoldVertices||topology.boundaryLoops===null)return fail('incidence');
 const boundary:Extract<NurbsRecutHalfBoundary3,{kind:'selected'}>['boundary'][number][]=[];
 for(const [edge,e] of topology.edges.entries())if(e.coedges.length===1){const sourceEdge=edgeIds[edge]!,old=T.edges[sourceEdge]!,selectedFace=T.coedges[old.coedges.find(h=>selected.has(T.coedges[h]!.face))!]!.face,other=old.coedges.find(h=>!selected.has(T.coedges[h]!.face));if(other===undefined||signs[selectedFace]!==side||signs[T.coedges[other]!.face]!==-side)return fail('non-section-boundary');boundary.push(Object.freeze({edge,sourceEdge,selectedFace,oppositeFace:T.coedges[other]!.face}));}
 const sourceVertices=T.vertices.map(p=>{const i=topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);return i<0?null:i;});
 return own(Object.freeze({kind:'selected',source,side,plane,signs:Object.freeze(signs),topology,sourceEdges:Object.freeze(sourceEdges),sourceFaces:Object.freeze(sourceFaces),sourceVertices:Object.freeze(sourceVertices),boundary:Object.freeze(boundary)}));
}
export interface NurbsRecutHalfCapBoundaryCertificate3 {readonly source:Extract<NurbsRecutHalfBoundary3,{kind:'selected'}>;readonly frame:PlaneFrame3;readonly sense:1|-1;readonly loops:readonly (readonly BRepEdgeUse3[])[];}
const ownedCaps=new WeakSet<NurbsRecutHalfCapBoundaryCertificate3>();
export function assertOwnedNurbsRecutHalfCapBoundary3(c:NurbsRecutHalfCapBoundaryCertificate3):void {if(!ownedCaps.has(c))throw new RangeError('Expected factory-created recut cap boundary');}
/** Opposite-signed parent closures certify whole-curve plane membership.
 * Reverse the selected open boundary to obtain cap-directed loops. */
export function nurbsRecutHalfCapBoundary3(source:Extract<NurbsRecutHalfBoundary3,{kind:'selected'}>):NurbsRecutHalfCapBoundaryCertificate3 {
 assertOwnedNurbsRecutHalfBoundary3(source);if(source.kind!=='selected')throw new RangeError('Expected selected recut half');const T=source.topology,{normal:n,offset}=source.plane,scale=offset.neg().div(dot3(n,n)),origin=point3(n.x.mul(scale),n.y.mul(scale),n.z.mul(scale)),axis=n.x.sign()!==0||n.y.sign()!==0?point3(0n,0n,1n):point3(1n,0n,0n),u=cross3(axis,n),v=cross3(n,u),loops=Object.freeze(T.boundaryLoops!.map(loop=>Object.freeze([...loop].reverse().map(id=>{const h=T.coedges[id]!;return Object.freeze({edge:h.edge,direction:(-h.direction) as 1|-1});}))));
 const c=Object.freeze({source,frame:planeFrame3(origin,u,v),sense:(-source.side) as 1|-1,loops});ownedCaps.add(c);return c;
}
export function nurbsRecutHalfCapBoundaryPoint3(c:NurbsRecutHalfCapBoundaryCertificate3,edge:number,t:AlgebraicReal|ExactInput){assertOwnedNurbsRecutHalfCapBoundary3(c);if(!Number.isSafeInteger(edge)||!c.loops.some(l=>l.some(u=>u.edge===edge)))throw new RangeError('Expected recut cap boundary edge');const p=nurbsRecutJoinedCurvePoint3(c.source.topology.edges[edge]!.curve,t),q=pointInPlaneFrame3(c.frame,p);if(q===null)throw new Error('Certified recut boundary left its plane');return q;}
