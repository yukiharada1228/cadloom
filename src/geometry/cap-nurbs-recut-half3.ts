import {assertOwnedNurbsRecutCapDomains3,locateNurbsRecutCapFace3} from './nurbs-recut-cap-domains3.js';
import type {NurbsRecutCapDomainsCertificate3} from './nurbs-recut-cap-domains3.js';
import {locateNurbsRecutJoinedSurface3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutJoinedCurve3,NurbsRecutJoinedSurface3} from './nurbs-recut-face-join3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from './brep-topology3.js';
import {compareAlgebraicPoints3,snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {pointInPlaneFrame3,mapPlanePoint3} from './plane-frame3.js';
import type {Point2} from './point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
export interface NurbsRecutNewCapSurface3 {readonly kind:'cap';readonly source:NurbsRecutCapDomainsCertificate3;readonly face:number;}
export type NurbsRecutClosedSurface3=NurbsRecutNewCapSurface3|Readonly<{kind:'retained';source:NurbsRecutJoinedSurface3}>;
export type CappedNurbsRecutHalf3=
 | Readonly<{kind:'unresolved';source:NurbsRecutCapDomainsCertificate3;reason:'nonmanifold-incidence';topology:BRepTopology3<NurbsRecutJoinedCurve3,NurbsRecutClosedSurface3>}>
 | Readonly<{kind:'closed';source:NurbsRecutCapDomainsCertificate3;topology:BRepTopology3<NurbsRecutJoinedCurve3,NurbsRecutClosedSurface3>;sourceEdges:readonly number[];sourceVertices:readonly number[];sourceFaces:readonly number[];capFaces:readonly number[]}>;
const surfaces=new WeakSet<NurbsRecutClosedSurface3>(),reports=new WeakSet<CappedNurbsRecutHalf3>();
export function assertOwnedCappedNurbsRecutHalf3(r:CappedNurbsRecutHalf3):void {if(!reports.has(r))throw new RangeError('Expected factory-created capped recut half');}
export function assertOwnedNurbsRecutNewCapSurface3(s:NurbsRecutNewCapSurface3):void {if(!surfaces.has(s)||s.kind!=='cap')throw new RangeError('Expected factory-created new recut cap surface');}
/** Close the owned outer/hole groups using exactly the existing curve objects
 * and reverse coedges. Closed oriented incidence is not yet a certificate of
 * new cap/source embedding, shell nesting or actual material orientation. */
export function capNurbsRecutHalf3(source:NurbsRecutCapDomainsCertificate3):CappedNurbsRecutHalf3 {
 assertOwnedNurbsRecutCapDomains3(source);const B=source.boundary,T=B.source.topology,curves=T.edges.map(e=>e.curve),ids=new Map(curves.map((c,i)=>[c,i])),members=new Map<NurbsRecutClosedSurface3,Set<number>>(),faces:BRepFaceInput3<NurbsRecutClosedSurface3>[]=T.faces.map(f=>{
  const surface=Object.freeze({kind:'retained' as const,source:f.surface}),loops=f.loops.map(l=>T.loops[l]!.coedges.map(id=>{const h=T.coedges[id]!;return {edge:h.edge,direction:h.direction};}));surfaces.add(surface);members.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));return {surface,sense:f.sense,loops};
 });
 const sourceFaces=faces.map((_,i)=>i),capFaces:number[]=[];
 for(const [face,group] of source.faces.entries()){const surface=Object.freeze({kind:'cap' as const,source,face}),loops=[group.outer,...group.holes].map(l=>B.loops[l]!);surfaces.add(surface);members.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));capFaces.push(faces.length);faces.push({surface,sense:B.sense,loops});}
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{snapshot:c=>{if(!ids.has(c))throw new RangeError('Curve is not in the recut half');return c;},endpoints:c=>{const e=T.edges[ids.get(c)!]!;return [T.vertices[e.start]!,T.vertices[e.end]!] as const;},closed:()=>false,snapshotSurface:s=>{if(!members.has(s))throw new RangeError('Expected selected recut surface');return s;},onSurface:(c,s)=>members.get(s)?.has(ids.get(c)!)??false});
 if(!topology.closedOrientedIncidence){const r=Object.freeze({kind:'unresolved' as const,source,reason:'nonmanifold-incidence' as const,topology});reports.add(r);return r;}
 const sourceVertices=T.vertices.map(p=>{const i=topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);if(i<0)throw new Error('Recapping lost an existing vertex');return i;}),r=Object.freeze({kind:'closed' as const,source,topology,sourceEdges:Object.freeze(curves.map((_,i)=>i)),sourceVertices:Object.freeze(sourceVertices),sourceFaces:Object.freeze(sourceFaces),capFaces:Object.freeze(capFaces)});reports.add(r);return r;
}
/** Spatial closed finite-face membership, preserving a spatial result point. */
export function locateNurbsRecutClosedSurface3(surface:NurbsRecutClosedSurface3,input:Point3|AlgebraicCoordinates3,options:Readonly<{maxDirections?:number}>={}) {
 if(!surfaces.has(surface))throw new RangeError('Expected factory-created capped recut surface');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const point=snapshotExactPoint3(input);
 if(surface.kind==='retained'){const query=locateNurbsRecutJoinedSurface3(surface.source,point,options);return query.kind==='located'?Object.freeze({kind:'located' as const,surface,point,location:query.location}):Object.freeze({kind:'unresolved' as const,surface,point,query});}
 const parameter=pointInPlaneFrame3(surface.source.boundary.frame,point);if(parameter===null)return Object.freeze({kind:'located' as const,surface,point,location:'outside' as const});const query=locateNurbsRecutCapFace3(surface.source,surface.face,parameter,options);return query.kind==='located'?Object.freeze({kind:'located' as const,surface,point,location:query.location}):Object.freeze({kind:'unresolved' as const,surface,point,query});
}
export function nurbsRecutNewCapPoint3(surface:NurbsRecutNewCapSurface3,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}) {
 assertOwnedNurbsRecutNewCapSurface3(surface);const query=locateNurbsRecutCapFace3(surface.source,surface.face,input,options);if(query.kind==='unresolved'||query.location==='outside')return Object.freeze({...query,surface});return Object.freeze({kind:'point' as const,surface,parameter:query.point,point:mapPlanePoint3(surface.source.boundary.frame,query.point),location:query.location});
}
