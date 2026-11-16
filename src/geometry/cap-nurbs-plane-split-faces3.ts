import {assertOwnedNurbsPlaneCapContainment3} from './nurbs-plane-cap-containment3.js';
import type {NurbsPlaneCapContainmentCertificate3} from './nurbs-plane-cap-containment3.js';
import {assertOwnedSewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from './brep-topology3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
export interface NurbsPlaneCapFaceSurface3 {readonly kind:'cap';readonly source:NurbsPlaneCapContainmentCertificate3;readonly face:number;}
export type CappedNurbsPlaneFaceSurface3=NurbsPlaneCapFaceSurface3|Readonly<{kind:'source';source:NurbsPlaneSplitFaceSurface3}>;
export type CappedNurbsPlaneSplitFaces3=
 | Readonly<{kind:'unresolved';source:NurbsPlaneCapContainmentCertificate3;reason:'nonmanifold-incidence';topology:BRepTopology3<SewnNurbsPlaneSplitEdge3,CappedNurbsPlaneFaceSurface3>}>
 | Readonly<{kind:'closed';source:NurbsPlaneCapContainmentCertificate3;topology:BRepTopology3<SewnNurbsPlaneSplitEdge3,CappedNurbsPlaneFaceSurface3>;
   sourceEdges:readonly number[];sourceVertices:readonly number[];sourceFaces:readonly number[];capFaces:readonly number[]}>;
const ownedSurfaces=new WeakSet<CappedNurbsPlaneFaceSurface3>(),ownedReports=new WeakSet<CappedNurbsPlaneSplitFaces3>();
export function assertOwnedNurbsPlaneCapFaceSurface3(s:NurbsPlaneCapFaceSurface3):void {if(!ownedSurfaces.has(s)||s.kind!=='cap')throw new RangeError('Expected factory-created NURBS plane cap face');}
export function assertOwnedCappedNurbsPlaneSplitFaces3(r:CappedNurbsPlaneSplitFaces3):void {if(!ownedReports.has(r))throw new RangeError('Expected factory-created capped split faces');}
/** Adopt every owned outer/hole group as a planar face and sew it to the same
 * original boundary edges. Closed incidence is not child-Body certification. */
export function capNurbsPlaneSplitFaces3(source:NurbsPlaneCapContainmentCertificate3):CappedNurbsPlaneSplitFaces3 {
 assertOwnedNurbsPlaneCapContainment3(source);const B=source.boundary,T=B.source.topology,curves=T.edges.map(e=>e.curve),indices=new Map(curves.map((c,i)=>[c,i])),membership=new Map<CappedNurbsPlaneFaceSurface3,Set<number>>();
 const faces:BRepFaceInput3<CappedNurbsPlaneFaceSurface3>[]=T.faces.map(f=>{
  const surface=Object.freeze({kind:'source' as const,source:f.surface}),loops=f.loops.map(loop=>T.loops[loop]!.coedges.map(id=>{const c=T.coedges[id]!;return {edge:c.edge,direction:c.direction};}));ownedSurfaces.add(surface);membership.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));return {surface,sense:f.sense,loops};
 });
 const sourceFaces=faces.map((_,i)=>i),capFaces:number[]=[];
 for(const [face,group] of source.faces.entries()){
  const surface=Object.freeze({kind:'cap' as const,source,face}),loops=[group.outer,...group.holes].map(loop=>B.loops[loop]!);ownedSurfaces.add(surface);membership.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));capFaces.push(faces.length);faces.push({surface,sense:B.sense,loops});
 }
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{
  snapshot:e=>{assertOwnedSewnNurbsPlaneSplitEdge3(e);if(!indices.has(e))throw new RangeError('Curve is not in the capped source');return e;},
  endpoints:e=>{const q=T.edges[indices.get(e)!]!;return [T.vertices[q.start]!,T.vertices[q.end]!] as const;},closed:()=>false,
  snapshotSurface:(s:CappedNurbsPlaneFaceSurface3)=>{if(!membership.has(s))throw new RangeError('Expected selected capped surface');return s;},
  // Exact full-edge domain membership is inherited from the owned source face
  // or the certified cap boundary use, never from finite point samples.
  onSurface:(e,s)=>membership.get(s)?.has(indices.get(e)!)??false,
 });
 if(!topology.closedOrientedIncidence){const report=Object.freeze({kind:'unresolved' as const,source,reason:'nonmanifold-incidence' as const,topology});ownedReports.add(report);return report;}
 const sourceVertices=T.vertices.map(p=>{const id=topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);if(id<0)throw new Error('Capping lost a source vertex');return id;});
 const report=Object.freeze({kind:'closed' as const,source,topology,sourceEdges:Object.freeze(curves.map((_,i)=>i)),sourceVertices:Object.freeze(sourceVertices),sourceFaces:Object.freeze(sourceFaces),capFaces:Object.freeze(capFaces)});ownedReports.add(report);return report;
}
