import {assertOwnedNurbsPlaneSplitFaces3,nurbsPlaneSplitFaceEdgePoint3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaces3,NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {assertOwnedSewnNurbsSourceEdgePlane3,nurbsSourcePlaneEdgeFragmentPoint3} from './sewn-nurbs-source-edge-plane3.js';
import type {SewnNurbsSourceEdgePlane3} from './sewn-nurbs-source-edge-plane3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Built=Extract<NurbsPlaneSplitFaces3,{kind:'built'}>;
export type SewnNurbsPlaneSplitEdge3=
 | Readonly<{kind:'source';source:SewnNurbsSourceEdgePlane3;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'section';source:Built;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>;
export type SewnNurbsPlaneSplitFaces3=
 | Readonly<{kind:'unresolved';source:SewnNurbsSourceEdgePlane3;inputs:readonly NurbsPlaneSplitFaces3[];reason:'face-assembly'|'missing-source-face'|'coplanar-side-selection';input?:number;face?:number}>
 | Readonly<{kind:'sewn';source:SewnNurbsSourceEdgePlane3;inputs:readonly Built[];side:1|-1|null;
   topology:BRepTopology3<SewnNurbsPlaneSplitEdge3,NurbsPlaneSplitFaceSurface3>;
   sourceEdges:readonly (readonly (readonly BRepEdgeUse3[]|null)[])[];
   sourceFaces:readonly (readonly (number|null)[])[];
   sharedFragments:readonly (readonly number[])[]}>;
const ownedReports=new WeakSet<SewnNurbsPlaneSplitFaces3>();
function own<T extends SewnNurbsPlaneSplitFaces3>(report:T):T {ownedReports.add(report);return report;}
export function assertOwnedSewnNurbsPlaneSplitFaces3(report:SewnNurbsPlaneSplitFaces3):void {if(!ownedReports.has(report))throw new RangeError('Expected factory-created sewn split faces');}
const ownedEdges=new WeakSet<SewnNurbsPlaneSplitEdge3>();
export function assertOwnedSewnNurbsPlaneSplitEdge3(edge:SewnNurbsPlaneSplitEdge3):void {if(!ownedEdges.has(edge))throw new RangeError('Expected factory-created sewn split edge');}
/** Sew all original finite-face subdivisions using canonical shared curve
 * intervals. Optional side selection leaves open section boundaries, not caps. */
export function sewNurbsPlaneSplitFaces3(source:SewnNurbsSourceEdgePlane3,input:readonly NurbsPlaneSplitFaces3[],side?:1|-1):SewnNurbsPlaneSplitFaces3 {
 assertOwnedSewnNurbsSourceEdgePlane3(source);if(side!==undefined&&side!==1&&side!==-1)throw new RangeError('Split-face side must be +1 or -1');
 const inputs=Object.freeze(Array.from(input,r=>{assertOwnedNurbsPlaneSplitFaces3(r);return r;})),seen=new Set<number>(),built:Built[]=[];
 for(const [i,r] of inputs.entries()){
  if(r.source.source.vertices.source!==source)throw new RangeError('Split faces belong to a different source refinement');
  const face=r.source.source.vertices.face;if(seen.has(face))throw new RangeError('Duplicate original source face');seen.add(face);
  if(r.kind!=='built')return own(Object.freeze({kind:'unresolved',source,inputs,reason:'face-assembly',input:i}));built.push(r);
 }
 for(let face=0;face<source.topology.faces.length;face++)if(!seen.has(face))return own(Object.freeze({kind:'unresolved',source,inputs,reason:'missing-source-face',face}));
 if(side!==undefined)for(const [i,r] of built.entries())if(r.topology.faces.some(f=>f.surface.sign===0))return own(Object.freeze({kind:'unresolved',source,inputs,reason:'coplanar-side-selection',input:i}));
 const cuts=source.topology.edges.map(e=>[e.curve.lower,e.curve.upper]);
 for(const r of built)for(const e of r.topology.edges){const q=e.curve.source.edges[e.curve.edge]!.source;if(!q)continue;const old=source.topology.edges[q.edge]!.curve;
  if(q.lower.compare(old.lower)<0||q.upper.compare(old.upper)>0||q.lower.compare(q.upper)>=0)throw new Error('Split face lost its finite shared-curve restriction');
  for(const t of [q.lower,q.upper])if(!cuts[q.edge]!.some(v=>v.compare(t)===0))cuts[q.edge]!.push(t);
  const a=nurbsSourcePlaneEdgeFragmentPoint3(old,q.direction===1?q.lower:q.upper),b=nurbsSourcePlaneEdgeFragmentPoint3(old,q.direction===1?q.upper:q.lower);
  if(compareAlgebraicPoints3(a,r.topology.vertices[e.start]!)!==0||compareAlgebraicPoints3(b,r.topology.vertices[e.end]!)!==0)throw new Error('Split-face shared interval lost endpoint orientation');
 }
 cuts.forEach(c=>c.sort((a,b)=>a.compare(b)));
 const curves:SewnNurbsPlaneSplitEdge3[]=[],pieces=cuts.map(()=>new Map<number,number>()),sourceEdges:(readonly BRepEdgeUse3[]|null)[][]=built.map(r=>r.topology.edges.map(()=>null)),sourceFaces:(number|null)[][]=built.map(r=>r.topology.faces.map(()=>null));
 const faces:{surface:NurbsPlaneSplitFaceSurface3;sense:1|-1;loops:BRepEdgeUse3[][]}[]=[],memberships=new Map<NurbsPlaneSplitFaceSurface3,Set<number>>();
 const create=(curve:SewnNurbsPlaneSplitEdge3)=>{const id=curves.length;ownedEdges.add(curve);curves.push(curve);return id;};
 const children=(i:number,edge:number):readonly BRepEdgeUse3[]=>{
  const known=sourceEdges[i]![edge];if(known!==null&&known!==undefined)return known;
  const r=built[i]!,e=r.topology.edges[edge]!,q=e.curve.source.edges[e.curve.edge]!.source;let uses:BRepEdgeUse3[]=[];
  if(q){const ts=cuts[q.edge]!,indices=ts.map((t,j)=>({t,j})).filter(({t})=>t.compare(q.lower)>=0&&t.compare(q.upper)<=0);let cursor=q.lower;
   for(let j=0;j+1<indices.length;j++){const a=indices[j]!,b=indices[j+1]!;if(a.t.compare(cursor)!==0)throw new Error('Shared interval sewing has a gap');let id=pieces[q.edge]!.get(a.j);if(id===undefined){id=create(Object.freeze({kind:'source',source,edge:q.edge,lower:a.t,upper:b.t}));pieces[q.edge]!.set(a.j,id);}uses.push(Object.freeze({edge:id,direction:1}));cursor=b.t;}
   if(cursor.compare(q.upper)!==0)throw new Error('Shared interval sewing lost its final endpoint');
   if(q.direction===-1)uses=uses.reverse().map(u=>Object.freeze({edge:u.edge,direction:-1}));
  }else {const n=e.curve.source.edges[e.curve.edge]!;uses=[Object.freeze({edge:create(Object.freeze({kind:'section',source:r,edge,lower:n.lower,upper:n.upper})),direction:1})];}
  const result=Object.freeze(uses);sourceEdges[i]![edge]=result;return result;
 };
 for(const [i,r] of built.entries())for(const [face,f] of r.topology.faces.entries()){
  if(side!==undefined&&f.surface.sign!==side)continue;
  const loops=f.loops.map(loop=>r.topology.loops[loop]!.coedges.flatMap(id=>{const c=r.topology.coedges[id]!,uses=children(i,c.edge);return c.direction===1?[...uses]:[...uses].reverse().map(u=>Object.freeze({edge:u.edge,direction:(-u.direction) as 1|-1}));}));
  sourceFaces[i]![face]=faces.length;faces.push({surface:f.surface,sense:f.sense,loops});memberships.set(f.surface,new Set(loops.flatMap(c=>c.map(u=>u.edge))));
 }
 const indices=new Map(curves.map((c,i)=>[c,i])),topology=buildBRepTopologyWithGeometryAdapters3(curves,faces,{
  snapshot:(e:SewnNurbsPlaneSplitEdge3)=>{if(!ownedEdges.has(e))throw new RangeError('Expected factory-created sewn split edge');return e;},
  endpoints:e=>e.kind==='source'?[nurbsSourcePlaneEdgeFragmentPoint3(e.source.topology.edges[e.edge]!.curve,e.lower),nurbsSourcePlaneEdgeFragmentPoint3(e.source.topology.edges[e.edge]!.curve,e.upper)] as const:[e.source.topology.vertices[e.source.topology.edges[e.edge]!.start]!,e.source.topology.vertices[e.source.topology.edges[e.edge]!.end]!] as const,closed:()=>false,
  snapshotSurface:(s:NurbsPlaneSplitFaceSurface3)=>{if(!memberships.has(s))throw new RangeError('Expected selected split-face surface');return s;},onSurface:(e,s)=>memberships.get(s)?.has(indices.get(e)!)??false,
 });
 if(side===undefined&&source.topology.closedOrientedIncidence&&!topology.closedOrientedIncidence)throw new Error('Full split-face sewing changed closed oriented incidence');
 return own(Object.freeze({kind:'sewn',source,inputs:Object.freeze(built),side:side??null,topology,sourceEdges:Object.freeze(sourceEdges.map(a=>Object.freeze(a))),sourceFaces:Object.freeze(sourceFaces.map(a=>Object.freeze(a))),sharedFragments:Object.freeze(pieces.map(p=>Object.freeze([...p.entries()].sort((a,b)=>a[0]-b[0]).map(([,edge])=>edge))))}));
}
export function sewnNurbsPlaneSplitEdgePoint3(edge:SewnNurbsPlaneSplitEdge3,input:AlgebraicReal|ExactInput) {
 if(!ownedEdges.has(edge))throw new RangeError('Expected factory-created sewn split edge');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);
 if(t.compare(edge.lower)<0||t.compare(edge.upper)>0)throw new RangeError('Parameter is outside the sewn split edge');
 return edge.kind==='source'?nurbsSourcePlaneEdgeFragmentPoint3(edge.source.topology.edges[edge.edge]!.curve,t):nurbsPlaneSplitFaceEdgePoint3(edge.source.topology.edges[edge.edge]!.curve,t);
}
