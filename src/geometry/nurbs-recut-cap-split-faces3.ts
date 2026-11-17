import {assertOwnedNurbsRecutCapSplitBoundaries3,nurbsRecutCapSplitBoundaryPoint3} from './nurbs-recut-cap-split-boundaries3.js';
import type {NurbsRecutCapSplitBoundaries3,NurbsRecutCapSplitCurve3} from './nurbs-recut-cap-split-boundaries3.js';
import {analyzeNurbsRecutCapSplitDomains3,locateNurbsRecutCapSplitFace3} from './nurbs-recut-cap-split-domains3.js';
import type {NurbsRecutCapSplitDomains3,NurbsRecutCapSplitDomainsCertificate3} from './nurbs-recut-cap-split-domains3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from './brep-topology3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {pointInPlaneFrame3,mapPlanePoint3} from './plane-frame3.js';
import type {Point3} from './point3.js';
import type {Point2} from './point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
export interface NurbsRecutCapSplitSurface3 {readonly source:NurbsRecutCapSplitDomainsCertificate3;readonly face:number;readonly side:1|-1;}
export type NurbsRecutCapSplitFaces3=
 | Readonly<{kind:'unresolved';source:NurbsRecutCapSplitBoundaries3;side:1|-1|null;reason:'boundary-split'|'domains';query?:NurbsRecutCapSplitDomains3}>
 | Readonly<{kind:'built';source:Extract<NurbsRecutCapSplitBoundaries3,{kind:'split'}>;side:1|-1|null;domains:readonly NurbsRecutCapSplitDomainsCertificate3[];topology:BRepTopology3<NurbsRecutCapSplitCurve3,NurbsRecutCapSplitSurface3>;sourceEdges:readonly (number|null)[];sourceVertices:readonly (number|null)[]}>;
const surfaces=new WeakSet<NurbsRecutCapSplitSurface3>(),reports=new WeakSet<NurbsRecutCapSplitFaces3>();
export function assertOwnedNurbsRecutCapSplitSurface3(surface:NurbsRecutCapSplitSurface3):void {if(!surfaces.has(surface))throw new RangeError('Expected factory-created recut child cap surface');}
export function assertOwnedNurbsRecutCapSplitFaces3(report:NurbsRecutCapSplitFaces3):void {if(!reports.has(report))throw new RangeError('Expected factory-created recut child cap faces');}
/** Finite face adoption reuses native parent/cut curve objects. Both sides
 * share exact cut edges; this is still an open face set, not a child solid. */
export function buildNurbsRecutCapSplitFaces3(source:NurbsRecutCapSplitBoundaries3,side:1|-1|null=null,options:Readonly<{maxDirections?:number}>={}):NurbsRecutCapSplitFaces3 {
 assertOwnedNurbsRecutCapSplitBoundaries3(source);if(side!==null&&side!==1&&side!==-1)throw new RangeError('Expected cap side +1, -1 or null');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const own=<T extends NurbsRecutCapSplitFaces3>(r:T):T=>{reports.add(r);return r;};
 if(source.kind!=='split')return own(Object.freeze({kind:'unresolved',source,side,reason:'boundary-split'}));
 const domains:NurbsRecutCapSplitDomainsCertificate3[]=[];for(const selected of side===null?[-1,1] as const:[side]){const q=analyzeNurbsRecutCapSplitDomains3(source,selected,options);if(q.kind!=='analyzed')return own(Object.freeze({kind:'unresolved',source,side,reason:'domains',query:q}));domains.push(q.certificate);}
 const selected=new Set<number>();for(const c of domains){const cycles=c.side===1?source.positive:source.negative;for(const f of c.faces)for(const loop of [f.outer,...f.holes])for(const use of cycles[loop]!)selected.add(use.edge);}
 const ids=[...selected].sort((a,b)=>a-b),curves=ids.map(i=>source.edges[i]!.curve),indices=new Map(curves.map((c,i)=>[c,i])),sourceEdges:(number|null)[]=source.edges.map(()=>null);ids.forEach((id,i)=>{sourceEdges[id]=i;});
 const membership=new Map<NurbsRecutCapSplitSurface3,Set<number>>(),faces:BRepFaceInput3<NurbsRecutCapSplitSurface3>[]=[];
 for(const c of domains){const cycles=c.side===1?source.positive:source.negative;for(const [face,f] of c.faces.entries()){const surface=Object.freeze({source:c,face,side:c.side}),loops=[f.outer,...f.holes].map(id=>cycles[id]!.map(u=>Object.freeze({edge:sourceEdges[u.edge]!,direction:u.direction})));surfaces.add(surface);membership.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));faces.push({surface,sense:source.section.source.topology.faces[source.section.face]!.sense,loops});}}
 const topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{snapshot:c=>{if(!indices.has(c))throw new RangeError('Expected selected recut child curve');return c;},endpoints:c=>[nurbsRecutCapSplitBoundaryPoint3(c,c.lower),nurbsRecutCapSplitBoundaryPoint3(c,c.upper)],closed:()=>false,snapshotSurface:s=>{if(!membership.has(s))throw new RangeError('Expected selected recut child surface');return s;},onSurface:(c,s)=>membership.get(s)?.has(indices.get(c)!)??false});
 if(!topology.consistentlyOriented||!topology.manifoldVertices||topology.boundaryLoops===null)throw new Error('Recut child cap adoption lost oriented manifold boundary');
 const sourceVertices=source.vertices.map(p=>{const i=topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);return i<0?null:i;});return own(Object.freeze({kind:'built',source,side,domains:Object.freeze(domains),topology,sourceEdges:Object.freeze(sourceEdges),sourceVertices:Object.freeze(sourceVertices)}));
}
export function locateNurbsRecutCapSplitSurface3(surface:NurbsRecutCapSplitSurface3,point:Point3|AlgebraicCoordinates3,options:Readonly<{maxDirections?:number}>={}) {
 assertOwnedNurbsRecutCapSplitSurface3(surface);const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const uv=pointInPlaneFrame3(surface.source.frame,point);if(uv===null)return Object.freeze({kind:'located' as const,surface,location:'outside' as const});return Object.freeze({...locateNurbsRecutCapSplitFace3(surface.source,surface.face,uv,options),surface});
}
export function nurbsRecutCapSplitSurfacePoint3(surface:NurbsRecutCapSplitSurface3,point:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}) {
 assertOwnedNurbsRecutCapSplitSurface3(surface);const query=locateNurbsRecutCapSplitFace3(surface.source,surface.face,point,options);if(query.kind==='unresolved'||query.location==='outside')return Object.freeze({...query,surface});return Object.freeze({kind:'point' as const,surface,parameter:query.point,point:mapPlanePoint3(surface.source.frame,query.point),location:query.location});
}
