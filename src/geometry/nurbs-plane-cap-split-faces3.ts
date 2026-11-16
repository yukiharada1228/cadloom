import {assertOwnedNurbsCapSplitBoundaries3,nurbsCapSplitBoundaryPoint3} from './nurbs-plane-cap-split-boundaries3.js';
import type {NurbsCapSplitBoundaries3,NurbsCapSplitBoundaryCurve3} from './nurbs-plane-cap-split-boundaries3.js';
import {analyzeNurbsCapSplitDomains3,assertOwnedNurbsCapSplitDomains3,locateNurbsCapSplitFace3} from './nurbs-plane-cap-split-domains3.js';
import type {NurbsCapSplitDomains3,NurbsCapSplitDomainsCertificate3} from './nurbs-plane-cap-split-domains3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from './brep-topology3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {pointInPlaneFrame3,mapPlanePoint3} from './plane-frame3.js';
import type {Point3} from './point3.js';
import type {Point2} from './point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
export interface NurbsCapSplitSurface3 {readonly source:NurbsCapSplitDomainsCertificate3;readonly face:number;readonly side:1|-1;}
export type NurbsCapSplitFaces3=
 | Readonly<{kind:'unresolved';source:NurbsCapSplitBoundaries3;side:1|-1|null;reason:'boundary-split'|'domains';query?:NurbsCapSplitDomains3}>
 | Readonly<{kind:'built';source:Extract<NurbsCapSplitBoundaries3,{kind:'split'}>;side:1|-1|null;domains:readonly NurbsCapSplitDomainsCertificate3[];topology:BRepTopology3<NurbsCapSplitBoundaryCurve3,NurbsCapSplitSurface3>;sourceEdges:readonly (number|null)[];sourceVertices:readonly (number|null)[]}>;
const ownedSurfaces=new WeakSet<NurbsCapSplitSurface3>(),ownedReports=new WeakSet<NurbsCapSplitFaces3>();
export function assertOwnedNurbsCapSplitSurface3(surface:NurbsCapSplitSurface3):void {if(!ownedSurfaces.has(surface))throw new RangeError('Expected factory-created child cap surface');}
export function assertOwnedNurbsCapSplitFaces3(report:NurbsCapSplitFaces3):void {if(!ownedReports.has(report))throw new RangeError('Expected factory-created child cap faces');}
/** Adopt finite child domains using their original curve objects and oriented
 * uses. Both sides share cut curves; a selected side remains an open face set.
 * This builds incidence and finite domains, not a closed child solid. */
export function buildNurbsCapSplitFaces3(source:NurbsCapSplitBoundaries3,side:1|-1|null=null,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitFaces3 {
 assertOwnedNurbsCapSplitBoundaries3(source);if(side!==null&&side!==1&&side!==-1)throw new RangeError('Expected cap side +1, -1 or null');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const own=<T extends NurbsCapSplitFaces3>(report:T):T=>{ownedReports.add(report);return report;};if(source.kind!=='split')return own(Object.freeze({kind:'unresolved',source,side,reason:'boundary-split'}));
 const domains:NurbsCapSplitDomainsCertificate3[]=[];
 for(const selected of side===null?[-1,1] as const:[side]){const q=analyzeNurbsCapSplitDomains3(source,selected,options);if(q.kind!=='analyzed')return own(Object.freeze({kind:'unresolved',source,side,reason:'domains',query:q}));domains.push(q.certificate);}
 const selected=new Set<number>();for(const c of domains){const cycles=c.side===1?source.positive:source.negative;for(const f of c.faces)for(const loop of [f.outer,...f.holes])for(const u of cycles[loop]!)selected.add(u.edge);}
 const ids=[...selected].sort((a,b)=>a-b),curves=ids.map(id=>source.edges[id]!.curve),curveIds=new Map(curves.map((c,i)=>[c,i])),sourceEdges:(number|null)[]=source.edges.map(()=>null);ids.forEach((id,i)=>{sourceEdges[id]=i;});
 const membership=new Map<NurbsCapSplitSurface3,Set<number>>(),faces:BRepFaceInput3<NurbsCapSplitSurface3>[]=[];
 for(const c of domains){assertOwnedNurbsCapSplitDomains3(c);const cycles=c.side===1?source.positive:source.negative;for(const [face,f] of c.faces.entries()){
  const surface=Object.freeze({source:c,face,side:c.side}),loops=[f.outer,...f.holes].map(id=>cycles[id]!.map(u=>Object.freeze({edge:sourceEdges[u.edge]!,direction:u.direction})));ownedSurfaces.add(surface);membership.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));faces.push({surface,sense:source.surface.source.boundary.sense,loops});
 }}
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{
  snapshot:curve=>{if(!curveIds.has(curve))throw new RangeError('Expected selected child cap curve');return curve;},
  endpoints:curve=>[nurbsCapSplitBoundaryPoint3(curve,curve.lower),nurbsCapSplitBoundaryPoint3(curve,curve.upper)],closed:()=>false,
  snapshotSurface:surface=>{if(!membership.has(surface))throw new RangeError('Expected selected child cap surface');return surface;},
  // Whole-edge membership follows from owned finite-domain boundary uses.
  onSurface:(curve,surface)=>membership.get(surface)?.has(curveIds.get(curve)!)??false,
 });
 if(!topology.consistentlyOriented||!topology.manifoldVertices||topology.boundaryLoops===null)throw new Error('Child cap face adoption lost oriented manifold boundary');
 const sourceVertices=source.vertices.map(p=>{const i=topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);return i<0?null:i;});
 return own(Object.freeze({kind:'built',source,side,domains:Object.freeze(domains),topology,sourceEdges:Object.freeze(sourceEdges),sourceVertices:Object.freeze(sourceVertices)}));
}
/** Spatial membership in a finite child face; off-support points are outside. */
export function locateNurbsCapSplitSurface3(surface:NurbsCapSplitSurface3,point:Point3|AlgebraicCoordinates3,options:Readonly<{maxDirections?:number}>={}) {
 assertOwnedNurbsCapSplitSurface3(surface);const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const uv=pointInPlaneFrame3(surface.source.source.surface.source.boundary.frame,point);
 if(uv===null)return Object.freeze({kind:'located' as const,surface,location:'outside' as const});return Object.freeze({...locateNurbsCapSplitFace3(surface.source,surface.face,uv,options),surface});
}
/** Map only accepted finite-domain chart points to exact spatial coordinates. */
export function nurbsCapSplitSurfacePoint3(surface:NurbsCapSplitSurface3,point:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}) {
 assertOwnedNurbsCapSplitSurface3(surface);const query=locateNurbsCapSplitFace3(surface.source,surface.face,point,options);if(query.kind==='unresolved'||query.location==='outside')return Object.freeze({...query,surface});return Object.freeze({kind:'point' as const,surface,parameter:query.point,point:mapPlanePoint3(surface.source.source.surface.source.boundary.frame,query.point),location:query.location});
}
