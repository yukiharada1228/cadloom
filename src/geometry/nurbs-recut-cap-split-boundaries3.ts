import {intersectNurbsRecutCapFacePlane3} from './nurbs-recut-cap-section3.js';
import type {NurbsRecutCapSection3} from './nurbs-recut-cap-section3.js';
import {partitionNurbsRecutCurveByAlgebraicPlane3} from './nurbs-recut-curve-plane3.js';
import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutJoinedCurve3} from './nurbs-recut-face-join3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Line3} from './surface3.js';
import type {Plane3} from './plane3.js';
import type {BRepEdgeUse3} from './brep-topology3.js';

export type NurbsRecutCapSplitCurve3=
 | Readonly<{kind:'boundary';source:NurbsRecutJoinedCurve3;loop:number;coedge:number;edge:number;lower:AlgebraicReal;upper:AlgebraicReal}>
 | Readonly<{kind:'cut';line:Line3;lower:AlgebraicReal;upper:AlgebraicReal}>;
export interface NurbsRecutCapSplitEdge3 {readonly curve:NurbsRecutCapSplitCurve3;readonly start:number;readonly end:number;}
export type NurbsRecutCapSplitBoundaries3=
 | Readonly<{kind:'unresolved';section:NurbsRecutCapSection3;reason:'section-query'|'coplanar'|'overlap-direction'|'nonmanifold-boundary'}>
 | Readonly<{kind:'split';section:Exclude<NurbsRecutCapSection3,{kind:'unresolved'}>;vertices:readonly AlgebraicCoordinates3[];edges:readonly NurbsRecutCapSplitEdge3[];
   /** For every parent coedge, child edge uses in native increasing order.
    * Directions retain the parent loop traversal, so reversing traversal also
    * requires reversing the array. No native interval is omitted. */
   sourceEdges:readonly Readonly<{loop:number;coedge:number;edge:number;direction:1|-1;pieces:readonly BRepEdgeUse3[]}>[];
   negative:readonly (readonly BRepEdgeUse3[])[];positive:readonly (readonly BRepEdgeUse3[])[]}>;
const curves=new WeakSet<NurbsRecutCapSplitCurve3>(),reports=new WeakSet<NurbsRecutCapSplitBoundaries3>();
export function assertOwnedNurbsRecutCapSplitBoundaries3(report:NurbsRecutCapSplitBoundaries3):void {if(!reports.has(report))throw new RangeError('Expected factory-created recut cap split boundaries');}
export function nurbsRecutCapSplitBoundaryPoint3(curve:NurbsRecutCapSplitCurve3,input:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!curves.has(curve))throw new RangeError('Expected factory-created recut cap split curve');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);
 if(t.compare(curve.lower)<0||t.compare(curve.upper)>0)throw new RangeError('Parameter outside recut cap split curve');
 return curve.kind==='boundary'?nurbsRecutJoinedCurvePoint3(curve.source,t):algebraicPoint3(curve.line.origin,curve.line.direction,t);
}
/** Subdivide either cap generation on the actual final coedges. Sections on
 * existing boundary edges belong only to the adjacent two-dimensional side;
 * they do not create duplicate cut edges or a spurious opposite-side face. */
export function splitNurbsRecutCapBoundaries3(source:CappedNurbsRecutHalf3,face:number,plane:Plane3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutCapSplitBoundaries3 {
 const section=intersectNurbsRecutCapFacePlane3(source,face,plane,options),own=<T extends NurbsRecutCapSplitBoundaries3>(r:T):T=>{reports.add(r);return r;},fail=(reason:Extract<NurbsRecutCapSplitBoundaries3,{kind:'unresolved'}>['reason'])=>own(Object.freeze({kind:'unresolved' as const,section,reason}));
 if(section.kind==='unresolved')return fail('section-query');if(section.kind==='coplanar')return fail('coplanar');
 const T=section.source.topology,sense=T.faces[face]!.sense,vertices:AlgebraicCoordinates3[]=[],edges:NurbsRecutCapSplitEdge3[]=[],negative:BRepEdgeUse3[]=[],positive:BRepEdgeUse3[]=[],sourceEdges:Extract<NurbsRecutCapSplitBoundaries3,{kind:'split'}>['sourceEdges'][number][]=[];
 const vertex=(p:AlgebraicCoordinates3)=>{const old=vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0);if(old>=0)return old;vertices.push(p);return vertices.length-1;},add=(curve:NurbsRecutCapSplitCurve3)=>{curves.add(curve);const start=vertex(nurbsRecutCapSplitBoundaryPoint3(curve,curve.lower)),end=vertex(nurbsRecutCapSplitBoundaryPoint3(curve,curve.upper));edges.push(Object.freeze({curve,start,end}));return edges.length-1;};
 const partitions=section.kind==='section'?section.boundaryPartitions:T.faces[face]!.loops.flatMap(loop=>T.loops[loop]!.coedges.map(coedge=>{const h=T.coedges[coedge]!;return {loop,coedge,edge:h.edge,direction:h.direction,partition:partitionNurbsRecutCurveByAlgebraicPlane3(T.edges[h.edge]!.curve,section.plane)};}));
 for(const b of partitions){const pieces:BRepEdgeUse3[]=[];for(const interval of b.partition.intervals){const curve=Object.freeze({kind:'boundary' as const,source:b.partition.source,loop:b.loop,coedge:b.coedge,edge:b.edge,lower:interval.lower,upper:interval.upper}),edge=add(curve),use=Object.freeze({edge,direction:b.direction});pieces.push(use);let sign=interval.sign;
   if(sign===0){if(section.kind!=='section')return fail('overlap-direction');const a=vertices[edges[edge]!.start]!,z=vertices[edges[edge]!.end]!,along=AlgebraicReal.linearCombination((['x','y','z'] as const).flatMap(k=>[{value:z[k],coefficient:section.line.direction[k]},{value:a[k],coefficient:section.line.direction[k].neg()}])).sign();if(along===0)return fail('overlap-direction');sign=(-along*b.direction*sense) as 1|-1;}
   (sign===-1?negative:positive).push(use);
  }sourceEdges.push(Object.freeze({loop:b.loop,coedge:b.coedge,edge:b.edge,direction:b.direction,pieces:Object.freeze(pieces)}));
 }
 if(section.kind==='section')for(const interval of section.intervals)for(const span of interval.spans){if(span.location==='boundary')continue;const edge=add(Object.freeze({kind:'cut',line:section.line,lower:span.start.parameter,upper:span.end.parameter}));negative.push(Object.freeze({edge,direction:sense}));positive.push(Object.freeze({edge,direction:(-sense) as 1|-1}));}
 const cycles=(uses:BRepEdgeUse3[]):readonly (readonly BRepEdgeUse3[])[]|null=>{const from=(u:BRepEdgeUse3)=>u.direction===1?edges[u.edge]!.start:edges[u.edge]!.end,to=(u:BRepEdgeUse3)=>u.direction===1?edges[u.edge]!.end:edges[u.edge]!.start,out=new Map<number,BRepEdgeUse3>(),incoming=new Set<number>();
  for(const u of uses){if(from(u)===to(u)||out.has(from(u))||incoming.has(to(u)))return null;out.set(from(u),u);incoming.add(to(u));}if(out.size!==incoming.size||[...out.keys()].some(v=>!incoming.has(v)))return null;
  const remaining=new Set(uses),result:(readonly BRepEdgeUse3[])[]=[];while(remaining.size){const first=remaining.values().next().value!,loop:BRepEdgeUse3[]=[];let u=first;do{if(!remaining.delete(u))return null;loop.push(u);const next=out.get(to(u));if(!next)return null;u=next;}while(u!==first);result.push(Object.freeze(loop));}return Object.freeze(result);
 };
 const N=cycles(negative),P=cycles(positive);if(N===null||P===null)return fail('nonmanifold-boundary');
 return own(Object.freeze({kind:'split',section,vertices:Object.freeze(vertices),edges:Object.freeze(edges),sourceEdges:Object.freeze(sourceEdges),negative:N,positive:P}));
}
