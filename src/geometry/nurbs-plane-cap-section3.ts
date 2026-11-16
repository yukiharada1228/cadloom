import {assertOwnedNurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import type {NurbsPlaneCapFaceSurface3} from './cap-nurbs-plane-split-faces3.js';
import {locateNurbsPlaneCapFace3} from './nurbs-plane-cap-face-query3.js';
import type {NurbsPlaneCapFaceLocation3} from './nurbs-plane-cap-face-query3.js';
import {partitionSewnNurbsSplitEdgeByPlane3} from './sewn-nurbs-split-edge-plane3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {point3,dot3} from './point3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {Rational} from '../numeric/rational.js';
export interface NurbsPlaneCapSectionEvent3 {
 readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 /** Original boundary-edge native parameters; shared vertices retain every use. */
 readonly boundary:readonly Readonly<{loop:number;edge:number;parameter:AlgebraicReal}>[];
}
export interface NurbsPlaneCapSectionSpan3 {readonly start:NurbsPlaneCapSectionEvent3;readonly end:NurbsPlaneCapSectionEvent3;readonly sampleParameter:Rational;readonly location:'inside'|'boundary';}
export type NurbsPlaneCapSection3=
 | Readonly<{kind:'parallel'|'coplanar';surface:NurbsPlaneCapFaceSurface3;plane:Plane3}>
 | Readonly<{kind:'unresolved';surface:NurbsPlaneCapFaceSurface3;plane:Plane3;line:Line3;query:NurbsPlaneCapFaceLocation3}>
 | Readonly<{kind:'section';surface:NurbsPlaneCapFaceSurface3;plane:Plane3;line:Line3;events:readonly NurbsPlaneCapSectionEvent3[];intervals:readonly Readonly<{start:NurbsPlaneCapSectionEvent3;end:NurbsPlaneCapSectionEvent3;spans:readonly NurbsPlaneCapSectionSpan3[]}>[];isolated:readonly NurbsPlaneCapSectionEvent3[]}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Complete intersection of an owned finite cap (outer minus holes) and a
 * rational plane. All roots and whole-edge overlaps supply the event partition;
 * point queries classify open cells only, never infer missing boundary roots. */
export function intersectNurbsPlaneCapFacePlane3(surface:NurbsPlaneCapFaceSurface3,input:Plane3,options:Readonly<{maxDirections?:number}>={}):NurbsPlaneCapSection3 {
 assertOwnedNurbsPlaneCapFaceSurface3(surface);
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),budget=options.maxDirections??16;
 if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const B=surface.source.boundary,F=B.frame,n=plane.normal,A=dot3(n,F.u),C=dot3(n,F.origin).add(plane.offset),D=dot3(n,F.v);
 if(A.sign()===0&&D.sign()===0)return Object.freeze({kind:C.sign()===0?'coplanar':'parallel',surface,plane});
 const x=A.sign()!==0?C.neg().div(A):new Rational(0n),y=A.sign()!==0?new Rational(0n):C.neg().div(D),origin=point3(...(['x','y','z'] as const).map(k=>F.origin[k].add(F.u[k].mul(x)).add(F.v[k].mul(y))) as Parameters<typeof point3>),direction=point3(...(['x','y','z'] as const).map(k=>F.v[k].mul(A).sub(F.u[k].mul(D))) as Parameters<typeof point3>),line=line3(origin,direction),dd=dot3(direction,direction);
 const events:{parameter:AlgebraicReal;point:AlgebraicCoordinates3;boundary:{loop:number;edge:number;parameter:AlgebraicReal}[]}[]=[],group=surface.source.faces[surface.face]!;
 for(const loop of [group.outer,...group.holes])for(const use of B.loops[loop]!){
  const report=partitionSewnNurbsSplitEdgeByPlane3(B.source.topology.edges[use.edge]!.curve,plane);
  for(const vertex of report.vertices)if(vertex.sign===0){
   const parameter=AlgebraicReal.linearCombination((['x','y','z'] as const).map(k=>({value:vertex.point[k],coefficient:direction[k].div(dd)})),dot3(origin,direction).neg().div(dd)),provenance={loop,edge:use.edge,parameter:vertex.parameter},old=events.find(e=>e.parameter.compare(parameter)===0);
   if(old)old.boundary.push(provenance);else events.push({parameter,point:vertex.point,boundary:[provenance]});
  }
 }
 events.sort((a,b)=>a.parameter.compare(b.parameter));
 const vertices=Object.freeze(events.map(e=>Object.freeze({...e,boundary:Object.freeze(e.boundary.map(p=>Object.freeze(p)))}))),pieces:{first:number;last:number;spans:NurbsPlaneCapSectionSpan3[]}[]=[],covered=new Set<number>();
 for(let i=0;i+1<vertices.length;i++){
  const start=vertices[i]!,end=vertices[i+1]!,sampleParameter=between(start.parameter,end.parameter),p=point3(origin.x.add(direction.x.mul(sampleParameter)),origin.y.add(direction.y.mul(sampleParameter)),origin.z.add(direction.z.mul(sampleParameter))),uv=pointInPlaneFrame3(F,p);
  if(uv===null)throw new Error('Cap section line left its supporting plane');
  const query=locateNurbsPlaneCapFace3(surface,uv,options);if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',surface,plane,line,query});if(query.location==='outside')continue;
  const span=Object.freeze({start,end,sampleParameter,location:query.location});covered.add(i);covered.add(i+1);const previous=pieces.at(-1);if(previous&&previous.last===i){previous.last=i+1;previous.spans.push(span);}else pieces.push({first:i,last:i+1,spans:[span]});
 }
 return Object.freeze({kind:'section',surface,plane,line,events:vertices,intervals:Object.freeze(pieces.map(p=>Object.freeze({start:vertices[p.first]!,end:vertices[p.last]!,spans:Object.freeze(p.spans)}))),isolated:Object.freeze(vertices.filter((_,i)=>!covered.has(i)))});
}
