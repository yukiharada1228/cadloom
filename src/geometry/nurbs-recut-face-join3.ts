import {assertOwnedSewnNurbsPlaneSplitFaces3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitFaces3} from './sew-nurbs-plane-split-faces3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
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
 | Readonly<{kind:'cap';source:Cap;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'sewn-source';source:Extract<SewnNurbsPlaneSplitFaces3,{kind:'sewn'}>;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>;
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
export function nurbsRecutJoinedCurvePoint3(curve:NurbsRecutJoinedCurve3,input:AlgebraicReal|ExactInput){if(!ownedCurves.has(curve))throw new RangeError('Expected factory-created joined curve');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(curve.lower)<0||t.compare(curve.upper)>0)throw new RangeError('Parameter outside joined curve');return curve.kind==='shared'?sewnNurbsPlaneSplitEdgePoint3(curve.source.chains[curve.chain]!.curve,t):curve.kind==='sewn-source'?sewnNurbsPlaneSplitEdgePoint3(curve.source.topology.edges[curve.edge]!.curve,t):curve.kind==='source'?nurbsPlaneSplitFaceEdgePoint3(curve.source.topology.edges[curve.edge]!.curve,t):nurbsCapSplitBoundaryPoint3(curve.source.topology.edges[curve.edge]!.curve,t);}
export function locateNurbsRecutJoinedSurface3(surface:NurbsRecutJoinedSurface3,point:Point3|AlgebraicCoordinates3,options:Readonly<{maxDirections?:number}>={}){if(!ownedSurfaces.has(surface))throw new RangeError('Expected factory-created joined surface');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const query=surface.kind==='source'?locateNurbsPlaneSplitFace3(surface.source,point):locateNurbsCapSplitSurface3(surface.source,point,options);return Object.freeze({...query,surface});}


export type NurbsRecutAssemblyJoin3=
 | Readonly<{kind:'unresolved';source:SewnNurbsPlaneSplitFaces3;reason:'source-faces'|'cap-faces'|'interval-coverage'|'incidence'}>
 | Readonly<{kind:'joined';alignments:readonly NurbsRecutCapEdgeAlignmentCertificate3[];source:Extract<SewnNurbsPlaneSplitFaces3,{kind:'sewn'}>;caps:readonly Cap[];topology:BRepTopology3<NurbsRecutJoinedCurve3,NurbsRecutJoinedSurface3>;sharedEdges:readonly (readonly (readonly number[])[])[];sourceEdges:readonly (readonly BRepEdgeUse3[])[];capEdges:readonly (readonly (readonly BRepEdgeUse3[])[])[];sourceFaces:readonly number[];capFaces:readonly (readonly number[])[]}>;
const ownedAssemblies=new WeakSet<NurbsRecutAssemblyJoin3>();
export function assertOwnedNurbsRecutAssemblyJoin3(report:NurbsRecutAssemblyJoin3):void {if(!ownedAssemblies.has(report))throw new RangeError('Expected factory-created recut assembly join');}
/** Reconstruct the complete old capped boundary with new cuts embedded as
 * shared seams. Both sides are retained; this is incidence, not a child-solid
 * material certificate or a new plane cap. */
export function joinNurbsRecutAssembly3(input:SewnNurbsPlaneSplitFaces3,alignments:readonly NurbsRecutCapEdgeAlignmentCertificate3[],capInputs:readonly NurbsCapSplitFaces3[]):NurbsRecutAssemblyJoin3 {
 assertOwnedSewnNurbsPlaneSplitFaces3(input);for(const a of alignments)assertOwnedNurbsRecutCapEdgeAlignment3(a);for(const c of capInputs)assertOwnedNurbsCapSplitFaces3(c);
 const own=<T extends NurbsRecutAssemblyJoin3>(r:T):T=>{ownedAssemblies.add(r);return r;},fail=(reason:Extract<NurbsRecutAssemblyJoin3,{kind:'unresolved'}>['reason']):NurbsRecutAssemblyJoin3=>own(Object.freeze({kind:'unresolved',source:input,reason}));
 if(input.kind!=='sewn')return fail('source-faces');if(input.previous===null||input.previous.kind!=='sewn'||input.side!==null)throw new RangeError('Assembly joining requires both sides of a previous finite-source assembly');
 const previous=input.previous,previousFaces=new Set<number>(),oldEdges=new Set<number>();
 for(const a of alignments){if(a.coverage.source!==previous)throw new RangeError('Alignment belongs to a different previous assembly');if(previousFaces.has(a.coverage.face))throw new RangeError('Duplicate previous face alignment');previousFaces.add(a.coverage.face);if(!input.inputs.some(b=>b.source.source.vertices.cells===a.coverage.cells))throw new RangeError('Alignment belongs to different recut cells');for(const c of a.chains){if(oldEdges.has(c.edge))throw new RangeError('Old interface requires a single source-face owner');oldEdges.add(c.edge);}}
 if(previousFaces.size!==previous.topology.faces.length||alignments.length!==input.inputs.length)throw new RangeError('Missing previous face alignment');
 const expected=new Set(alignments.flatMap(a=>a.caps)),caps:Cap[]=[],seen=new Set();for(const c of capInputs){if(c.kind!=='built')return fail('cap-faces');if(c.side!==null)throw new RangeError('Assembly joining requires both cap sides');if(!expected.has(c.source)||seen.has(c.source))throw new RangeError('Unexpected or duplicate cap assembly');seen.add(c.source);caps.push(c);}if(caps.length!==expected.size)throw new RangeError('Missing aligned cap assembly');
 const curves:NurbsRecutJoinedCurve3[]=[],add=(curve:NurbsRecutJoinedCurve3)=>{ownedCurves.add(curve);curves.push(curve);return curves.length-1;},sharedEdges=alignments.map(alignment=>alignment.chains.map((c,chain)=>c.fragments.map((f,fragment)=>add(Object.freeze({kind:'shared',source:alignment,chain,fragment,lower:f.lower,upper:f.upper})))));
 type Piece={id:number;lower:AlgebraicReal;upper:AlgebraicReal};const sourcePieces=new Map<NurbsSourcePlaneCellComplex3,Map<number,Piece[]>>(),capPieces=new Map<Cap['source'],Map<number,Piece[]>>();
 for(const [assembly,alignment] of alignments.entries()){
  let map=sourcePieces.get(alignment.coverage.cells);if(!map){map=new Map();sourcePieces.set(alignment.coverage.cells,map);}
  for(const [chain,c] of alignment.chains.entries())for(const [fragment,f] of c.fragments.entries()){const p={id:sharedEdges[assembly]![chain]![fragment]!,lower:f.lower,upper:f.upper};map.set(f.sourceMatch.edge,[...(map.get(f.sourceMatch.edge)??[]),p]);let capsMap=capPieces.get(f.cap);if(!capsMap){capsMap=new Map();capPieces.set(f.cap,capsMap);}capsMap.set(f.capEdge,[...(capsMap.get(f.capEdge)??[]),p]);}
 }
 const expand=(lower:AlgebraicReal,upper:AlgebraicReal,pieces:Piece[]|undefined,fallback:()=>number):readonly BRepEdgeUse3[]|null=>{
  if(!pieces)return Object.freeze([Object.freeze({edge:fallback(),direction:1 as const})]);const selected=pieces.filter(p=>p.lower.compare(lower)>=0&&p.upper.compare(upper)<=0).sort((a,b)=>a.lower.compare(b.lower));let cursor=lower;const uses:BRepEdgeUse3[]=[];for(const p of selected){if(p.lower.compare(cursor)!==0)return null;uses.push(Object.freeze({edge:p.id,direction:1}));cursor=p.upper;}return cursor.compare(upper)===0?Object.freeze(uses):null;
 };
 const sourceEdges:(readonly BRepEdgeUse3[])[]=[],capEdges:(readonly (readonly BRepEdgeUse3[])[])[]=[];
 for(const [edge,e] of input.topology.edges.entries()){
  const curve=e.curve,local=curve.kind==='section'?curve.source.topology.edges[curve.edge]!.curve:null,pieces=local?sourcePieces.get(local.source.source.vertices.cells)?.get(local.source.edges[local.edge]!.parent):undefined;
  const uses=expand(curve.lower,curve.upper,pieces,()=>add(Object.freeze({kind:'sewn-source',source:input,edge,lower:curve.lower,upper:curve.upper})));if(uses===null)return fail('interval-coverage');sourceEdges.push(uses);
 }
 for(const cap of caps){const list:(readonly BRepEdgeUse3[])[]=[];for(const [edge,e] of cap.topology.edges.entries()){const original=cap.sourceEdges.findIndex(id=>id===edge),uses=expand(e.curve.lower,e.curve.upper,capPieces.get(cap.source)?.get(original),()=>add(Object.freeze({kind:'cap',source:cap,edge,lower:e.curve.lower,upper:e.curve.upper})));if(uses===null)return fail('interval-coverage');list.push(uses);}capEdges.push(Object.freeze(list));}
 const faces:BRepFaceInput3<NurbsRecutJoinedSurface3>[]=[],members=new Map<NurbsRecutJoinedSurface3,Set<number>>(),sourceFaces:number[]=[],capFaces:number[][]=[];
 function adopt<T>(topology:BRepTopology3<T,unknown>,map:readonly (readonly BRepEdgeUse3[])[],surface:NurbsRecutJoinedSurface3,face:number){const f=topology.faces[face]!,loops=f.loops.map(l=>topology.loops[l]!.coedges.flatMap(id=>{const h=topology.coedges[id]!,uses=map[h.edge]!;return h.direction===1?[...uses]:[...uses].reverse().map(u=>Object.freeze({edge:u.edge,direction:(-u.direction) as 1|-1}));}));ownedSurfaces.add(surface);members.set(surface,new Set(loops.flatMap(l=>l.map(u=>u.edge))));const id=faces.length;faces.push({surface,sense:f.sense,loops});return id;}
 input.topology.faces.forEach((f,i)=>sourceFaces.push(adopt(input.topology,sourceEdges,Object.freeze({kind:'source',source:f.surface}),i)));
 caps.forEach((cap,j)=>{const ids:number[]=[];cap.topology.faces.forEach((f,i)=>ids.push(adopt(cap.topology,capEdges[j]!,Object.freeze({kind:'cap',source:f.surface}),i)));capFaces.push(ids);});
 const indices=new Map(curves.map((c,i)=>[c,i])),topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{snapshot:c=>{if(!indices.has(c))throw new RangeError('Expected selected joined curve');return c;},endpoints:c=>[nurbsRecutJoinedCurvePoint3(c,c.lower),nurbsRecutJoinedCurvePoint3(c,c.upper)],closed:()=>false,snapshotSurface:s=>{if(!members.has(s))throw new RangeError('Expected selected joined surface');return s;},onSurface:(c,s)=>members.get(s)?.has(indices.get(c)!)??false});
 if(!topology.closedOrientedIncidence||sharedEdges.flat(2).some(id=>{const e=topology.edges[id]!;return e.coedges.length!==2||new Set(e.coedges.map(h=>topology.faces[topology.coedges[h]!.face]!.surface.kind)).size!==2;}))return fail('incidence');
 return own(Object.freeze({kind:'joined',alignments:Object.freeze([...alignments]),source:input,caps:Object.freeze(caps),topology,sharedEdges:Object.freeze(sharedEdges.map(a=>Object.freeze(a.map(x=>Object.freeze(x))))),sourceEdges:Object.freeze(sourceEdges),capEdges:Object.freeze(capEdges),sourceFaces:Object.freeze(sourceFaces),capFaces:Object.freeze(capFaces.map(x=>Object.freeze(x)))}));
}