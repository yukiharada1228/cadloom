import {assertOwnedNurbsRecutCapEdgeAlignment3} from './nurbs-recut-edge-coverage3.js';
import type {NurbsRecutCapEdgeAlignmentCertificate3} from './nurbs-recut-edge-coverage3.js';
import {assertOwnedNurbsPlaneSplitFaces3,nurbsPlaneSplitFaceEdgePoint3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaces3,NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {assertOwnedNurbsCapSplitFaces3,locateNurbsCapSplitSurface3} from './nurbs-plane-cap-split-faces3.js';
import type {NurbsCapSplitFaces3,NurbsCapSplitSurface3} from './nurbs-plane-cap-split-faces3.js';
import {nurbsCapSplitBoundaryPoint3} from './nurbs-plane-cap-split-boundaries3.js';
import {sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import {locateNurbsPlaneSplitFace3} from './nurbs-plane-split-face-query3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3,BRepEdgeUse3} from './brep-topology3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Point3} from './point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
type Built=Extract<NurbsPlaneSplitFaces3,{kind:'built'}>;type Cap=Extract<NurbsCapSplitFaces3,{kind:'built'}>;
export type NurbsRecutJoinedCurve3=
 | Readonly<{kind:'shared';source:NurbsRecutCapEdgeAlignmentCertificate3;chain:number;fragment:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'source';source:Built;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'cap';source:Cap;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>;
export type NurbsRecutJoinedSurface3=Readonly<{kind:'source';source:NurbsPlaneSplitFaceSurface3}>|Readonly<{kind:'cap';source:NurbsCapSplitSurface3}>;
export type NurbsRecutFaceJoin3=
 | Readonly<{kind:'unresolved';alignment:NurbsRecutCapEdgeAlignmentCertificate3;reason:'source-faces'|'cap-faces'|'interval-coverage'|'incidence'}>
 | Readonly<{kind:'joined';alignment:NurbsRecutCapEdgeAlignmentCertificate3;source:Built;caps:readonly Cap[];topology:BRepTopology3<NurbsRecutJoinedCurve3,NurbsRecutJoinedSurface3>;sharedEdges:readonly (readonly number[])[];sourceEdges:readonly (readonly BRepEdgeUse3[])[];capEdges:readonly (readonly (readonly BRepEdgeUse3[])[])[];sourceFaces:readonly number[];capFaces:readonly (readonly number[])[]}>;
const ownedCurves=new WeakSet<NurbsRecutJoinedCurve3>(),ownedSurfaces=new WeakSet<NurbsRecutJoinedSurface3>(),ownedReports=new WeakSet<NurbsRecutFaceJoin3>();
export function assertOwnedNurbsRecutFaceJoin3(report:NurbsRecutFaceJoin3):void {if(!ownedReports.has(report))throw new RangeError('Expected factory-created recut face join');}
/** Replace both parents' boundary uses by the same native subintervals, then
 * rebuild all incidence. This joins a finite source face and its old caps;
 * other original faces and the new cutting-plane caps are still absent. */
export function joinNurbsRecutSourceCaps3(alignment:NurbsRecutCapEdgeAlignmentCertificate3,input:NurbsPlaneSplitFaces3,capInputs:readonly NurbsCapSplitFaces3[]):NurbsRecutFaceJoin3 {
 assertOwnedNurbsRecutCapEdgeAlignment3(alignment);assertOwnedNurbsPlaneSplitFaces3(input);for(const c of capInputs)assertOwnedNurbsCapSplitFaces3(c);
 const own=<T extends NurbsRecutFaceJoin3>(r:T):T=>{ownedReports.add(r);return r;},fail=(reason:Extract<NurbsRecutFaceJoin3,{kind:'unresolved'}>['reason']):NurbsRecutFaceJoin3=>own(Object.freeze({kind:'unresolved',alignment,reason}));
 if(input.kind!=='built')return fail('source-faces');if(input.source.source.vertices.cells!==alignment.coverage.cells)throw new RangeError('Source faces belong to a different recut complex');
 const caps:Cap[]=[],seen=new Set();for(const c of capInputs){if(c.kind!=='built')return fail('cap-faces');if(c.side!==null)throw new RangeError('Recut joining requires both cap sides');if(!alignment.caps.includes(c.source)||seen.has(c.source))throw new RangeError('Unexpected or duplicate cap assembly');seen.add(c.source);caps.push(c);}if(caps.length!==alignment.caps.length)throw new RangeError('Missing aligned cap assembly');
 const curves:NurbsRecutJoinedCurve3[]=[],add=(curve:NurbsRecutJoinedCurve3)=>{ownedCurves.add(curve);curves.push(curve);return curves.length-1;},sharedEdges=alignment.chains.map((c,chain)=>c.fragments.map((f,fragment)=>add(Object.freeze({kind:'shared',source:alignment,chain,fragment,lower:f.lower,upper:f.upper}))));
 type Piece={id:number;lower:AlgebraicReal;upper:AlgebraicReal};const sourcePieces=new Map<number,Piece[]>(),capPieces=new Map<Cap['source'],Map<number,Piece[]>>();
 for(const [chain,c] of alignment.chains.entries())for(const [fragment,f] of c.fragments.entries()){const p={id:sharedEdges[chain]![fragment]!,lower:f.lower,upper:f.upper};sourcePieces.set(f.sourceMatch.edge,[...(sourcePieces.get(f.sourceMatch.edge)??[]),p]);let map=capPieces.get(f.cap);if(!map){map=new Map();capPieces.set(f.cap,map);}map.set(f.capEdge,[...(map.get(f.capEdge)??[]),p]);}
 const expand=(lower:AlgebraicReal,upper:AlgebraicReal,pieces:Piece[]|undefined,fallback:()=>number):readonly BRepEdgeUse3[]|null=>{
  if(!pieces)return Object.freeze([Object.freeze({edge:fallback(),direction:1 as const})]);const selected=pieces.filter(p=>p.lower.compare(lower)>=0&&p.upper.compare(upper)<=0).sort((a,b)=>a.lower.compare(b.lower));let cursor=lower;const uses:BRepEdgeUse3[]=[];for(const p of selected){if(p.lower.compare(cursor)!==0)return null;uses.push(Object.freeze({edge:p.id,direction:1}));cursor=p.upper;}return cursor.compare(upper)===0?Object.freeze(uses):null;
 };
 const sourceEdges:(readonly BRepEdgeUse3[])[]=[],capEdges:(readonly (readonly BRepEdgeUse3[])[])[]=[];
 for(const [edge,e] of input.topology.edges.entries()){const n=e.curve.source.edges[e.curve.edge]!,uses=expand(n.lower,n.upper,sourcePieces.get(n.parent),()=>add(Object.freeze({kind:'source',source:input,edge,lower:n.lower,upper:n.upper})));if(uses===null)return fail('interval-coverage');sourceEdges.push(uses);}
 for(const cap of caps){const list:(readonly BRepEdgeUse3[])[]=[];for(const [edge,e] of cap.topology.edges.entries()){const original=cap.sourceEdges.findIndex(id=>id===edge),uses=expand(e.curve.lower,e.curve.upper,capPieces.get(cap.source)?.get(original),()=>add(Object.freeze({kind:'cap',source:cap,edge,lower:e.curve.lower,upper:e.curve.upper})));if(uses===null)return fail('interval-coverage');list.push(uses);}capEdges.push(Object.freeze(list));}
 const faces:BRepFaceInput3<NurbsRecutJoinedSurface3>[]=[],members=new Map<NurbsRecutJoinedSurface3,Set<number>>(),sourceFaces:number[]=[],capFaces:number[][]=[];
 function adopt<T>(topology:BRepTopology3<T,unknown>,map:readonly (readonly BRepEdgeUse3[])[],surface:NurbsRecutJoinedSurface3,face:number){const f=topology.faces[face]!,loops=f.loops.map(l=>topology.loops[l]!.coedges.flatMap(id=>{const h=topology.coedges[id]!,uses=map[h.edge]!;return h.direction===1?[...uses]:[...uses].reverse().map(u=>Object.freeze({edge:u.edge,direction:(-u.direction) as 1|-1}));}));ownedSurfaces.add(surface);members.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));const id=faces.length;faces.push({surface,sense:f.sense,loops});return id;}
 input.topology.faces.forEach((f,i)=>sourceFaces.push(adopt(input.topology,sourceEdges,Object.freeze({kind:'source',source:f.surface}),i)));
 caps.forEach((cap,j)=>{const ids:number[]=[];cap.topology.faces.forEach((f,i)=>ids.push(adopt(cap.topology,capEdges[j]!,Object.freeze({kind:'cap',source:f.surface}),i)));capFaces.push(ids);});
 const indices=new Map(curves.map((c,i)=>[c,i])),topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{snapshot:c=>{if(!indices.has(c))throw new RangeError('Expected selected joined curve');return c;},endpoints:c=>[nurbsRecutJoinedCurvePoint3(c,c.lower),nurbsRecutJoinedCurvePoint3(c,c.upper)],closed:()=>false,snapshotSurface:s=>{if(!members.has(s))throw new RangeError('Expected selected joined surface');return s;},onSurface:(c,s)=>members.get(s)?.has(indices.get(c)!)??false});
 if(!topology.consistentlyOriented||!topology.manifoldVertices||topology.boundaryLoops===null||sharedEdges.flat().some(id=>{const e=topology.edges[id]!;return e.coedges.length!==2||new Set(e.coedges.map(h=>topology.faces[topology.coedges[h]!.face]!.surface.kind)).size!==2;}))return fail('incidence');
 return own(Object.freeze({kind:'joined',alignment,source:input,caps:Object.freeze(caps),topology,sharedEdges:Object.freeze(sharedEdges.map(x=>Object.freeze(x))),sourceEdges:Object.freeze(sourceEdges),capEdges:Object.freeze(capEdges),sourceFaces:Object.freeze(sourceFaces),capFaces:Object.freeze(capFaces.map(x=>Object.freeze(x)))}));
}
export function nurbsRecutJoinedCurvePoint3(curve:NurbsRecutJoinedCurve3,input:AlgebraicReal|ExactInput){if(!ownedCurves.has(curve))throw new RangeError('Expected factory-created joined curve');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(curve.lower)<0||t.compare(curve.upper)>0)throw new RangeError('Parameter outside joined curve');return curve.kind==='shared'?sewnNurbsPlaneSplitEdgePoint3(curve.source.chains[curve.chain]!.curve,t):curve.kind==='source'?nurbsPlaneSplitFaceEdgePoint3(curve.source.topology.edges[curve.edge]!.curve,t):nurbsCapSplitBoundaryPoint3(curve.source.topology.edges[curve.edge]!.curve,t);}
export function locateNurbsRecutJoinedSurface3(surface:NurbsRecutJoinedSurface3,point:Point3|AlgebraicCoordinates3){if(!ownedSurfaces.has(surface))throw new RangeError('Expected factory-created joined surface');const query=surface.kind==='source'?locateNurbsPlaneSplitFace3(surface.source,point):locateNurbsCapSplitSurface3(surface.source,point);return Object.freeze({...query,surface});}
