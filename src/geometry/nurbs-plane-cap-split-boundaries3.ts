import {assertOwnedNurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import type {NurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import {intersectNurbsPlaneCapFacePlane3} from './nurbs-plane-cap-section3.js';
import type {NurbsPlaneCapSection3} from './nurbs-plane-cap-section3.js';
import {partitionSewnNurbsSplitEdgeByPlane3} from './sewn-nurbs-split-edge-plane3.js';
import {sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import {algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Line3} from './surface3.js';
import type {Plane3} from './plane3.js';
import type {BRepEdgeUse3} from './brep-topology3.js';
export type NurbsCapSplitBoundaryCurve3=
 | Readonly<{kind:'boundary';source:SewnNurbsPlaneSplitEdge3;loop:number;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'cut';line:Line3;lower:AlgebraicReal;upper:AlgebraicReal}>;
export interface NurbsCapSplitBoundaryEdge3 {readonly curve:NurbsCapSplitBoundaryCurve3;readonly start:number;readonly end:number;}
export type NurbsCapSplitBoundaries3=
 | Readonly<{kind:'unresolved';surface:NurbsPlaneCapFaceSurface3;section:NurbsPlaneCapSection3;reason:'section-query'|'coplanar'|'boundary-overlap'|'nonmanifold-boundary'}>
 | Readonly<{kind:'split';surface:NurbsPlaneCapFaceSurface3;section:NurbsPlaneCapSection3;vertices:readonly AlgebraicCoordinates3[];edges:readonly NurbsCapSplitBoundaryEdge3[];negative:readonly (readonly BRepEdgeUse3[])[];positive:readonly (readonly BRepEdgeUse3[])[]}>;
const ownedCurves=new WeakSet<NurbsCapSplitBoundaryCurve3>(),ownedReports=new WeakSet<NurbsCapSplitBoundaries3>();
export function assertOwnedNurbsCapSplitBoundaries3(report:NurbsCapSplitBoundaries3):void {if(!ownedReports.has(report))throw new RangeError('Expected factory-created cap split boundaries');}
/** Split a finite cap's oriented boundary into closed half-plane cycles.
 * Cycles can be disconnected or holes; grouping into new faces is a later gate.
 * Cut curves are shared by both sides with opposite directions. */
export function splitNurbsPlaneCapBoundaries3(surface:NurbsPlaneCapFaceSurface3,plane:Plane3,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitBoundaries3 {
 assertOwnedNurbsPlaneCapFaceSurface3(surface);const section=intersectNurbsPlaneCapFacePlane3(surface,plane,options),own=<T extends NurbsCapSplitBoundaries3>(r:T):T=>{ownedReports.add(r);return r;},fail=(reason:Extract<NurbsCapSplitBoundaries3,{kind:'unresolved'}>['reason'])=>own(Object.freeze({kind:'unresolved' as const,surface,section,reason}));
 if(section.kind==='unresolved')return fail('section-query');if(section.kind==='coplanar')return fail('coplanar');
 const B=surface.source.boundary,G=surface.source.faces[surface.face]!,vertices:AlgebraicCoordinates3[]=[],edges:NurbsCapSplitBoundaryEdge3[]=[],negative:BRepEdgeUse3[]=[],positive:BRepEdgeUse3[]=[];
 const vertex=(p:AlgebraicCoordinates3)=>{const old=vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);if(old>=0)return old;vertices.push(p);return vertices.length-1;};
 const add=(curve:NurbsCapSplitBoundaryCurve3)=>{ownedCurves.add(curve);const start=vertex(nurbsCapSplitBoundaryPoint3(curve,curve.lower)),end=vertex(nurbsCapSplitBoundaryPoint3(curve,curve.upper));edges.push(Object.freeze({curve,start,end}));return edges.length-1;};
 for(const loop of [G.outer,...G.holes])for(const use of B.loops[loop]!){const source=B.source.topology.edges[use.edge]!.curve,partition=partitionSewnNurbsSplitEdgeByPlane3(source,section.plane);
  for(const interval of partition.intervals){if(interval.sign===0)return fail('boundary-overlap');const edge=add(Object.freeze({kind:'boundary',source,loop,edge:use.edge,lower:interval.lower,upper:interval.upper}));(interval.sign===-1?negative:positive).push(Object.freeze({edge,direction:use.direction}));}
 }
 if(section.kind==='section')for(const interval of section.intervals)for(const span of interval.spans){
  if(span.location==='boundary')return fail('boundary-overlap');
  const edge=add(Object.freeze({kind:'cut',line:section.line,lower:span.start.parameter,upper:span.end.parameter})),direction=B.sense;
  // Chart direction (-D,A) has the negative half-plane on its left. The
  // inherited cap orientation is B.sense times chart orientation.
  negative.push(Object.freeze({edge,direction}));positive.push(Object.freeze({edge,direction:(-direction) as 1|-1}));
 }
 const cycles=(uses:BRepEdgeUse3[]):readonly (readonly BRepEdgeUse3[])[]|null=>{
  const from=(u:BRepEdgeUse3)=>u.direction===1?edges[u.edge]!.start:edges[u.edge]!.end,to=(u:BRepEdgeUse3)=>u.direction===1?edges[u.edge]!.end:edges[u.edge]!.start,out=new Map<number,BRepEdgeUse3>(),incoming=new Set<number>();
  for(const u of uses){if(from(u)===to(u)||out.has(from(u))||incoming.has(to(u)))return null;out.set(from(u),u);incoming.add(to(u));}
  if(out.size!==incoming.size||[...out.keys()].some(v=>!incoming.has(v)))return null;
  const remaining=new Set(uses),result:(readonly BRepEdgeUse3[])[]=[];
  while(remaining.size){const first=remaining.values().next().value!,loop:BRepEdgeUse3[]=[];let u=first;
   do {if(!remaining.delete(u))return null;loop.push(u);u=out.get(to(u))!;}while(u!==first);
   result.push(Object.freeze(loop));
  }return Object.freeze(result);
 };
 const N=cycles(negative),P=cycles(positive);if(N===null||P===null)return fail('nonmanifold-boundary');
 return own(Object.freeze({kind:'split',surface,section,vertices:Object.freeze(vertices),edges:Object.freeze(edges),negative:N,positive:P}));
}
export function nurbsCapSplitBoundaryPoint3(curve:NurbsCapSplitBoundaryCurve3,input:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!ownedCurves.has(curve))throw new RangeError('Expected factory-created cap split curve');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(curve.lower)<0||t.compare(curve.upper)>0)throw new RangeError('Parameter outside cap split curve');
 return curve.kind==='boundary'?sewnNurbsPlaneSplitEdgePoint3(curve.source,t):algebraicPoint3(curve.line.origin,curve.line.direction,t);
}
