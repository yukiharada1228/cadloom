import {assertOwnedCappedNurbsRecutHalf3,locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3,NurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import {partitionNurbsRecutCurveByAlgebraicPlane3} from './nurbs-recut-curve-plane3.js';
import type {NurbsRecutCurvePlane3} from './nurbs-recut-curve-plane3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {point3,dot3} from './point3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';

type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;
export interface NurbsRecutCapSectionBoundary3 {
 readonly loop:number;readonly coedge:number;readonly edge:number;readonly direction:1|-1;
 /** Native parameters and signs for the entire final shared edge. */
 readonly partition:NurbsRecutCurvePlane3;
}
export interface NurbsRecutCapSectionEvent3 {
 readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 readonly boundary:readonly Readonly<{loop:number;coedge:number;edge:number;parameter:AlgebraicReal}>[];
}
export interface NurbsRecutCapSectionSpan3 {
 readonly start:NurbsRecutCapSectionEvent3;readonly end:NurbsRecutCapSectionEvent3;
 readonly sampleParameter:Rational;readonly location:'inside'|'boundary';
}
interface Context {readonly source:Closed;readonly face:number;readonly surface:NurbsRecutClosedSurface3;readonly plane:Plane3;}
export type NurbsRecutCapSection3=
 | Readonly<Context&{kind:'parallel'|'coplanar'}>
 | Readonly<Context&{kind:'unresolved';line:Line3;query:ReturnType<typeof locateNurbsRecutClosedSurface3>}>
 | Readonly<Context&{kind:'section';line:Line3;boundaryPartitions:readonly NurbsRecutCapSectionBoundary3[];events:readonly NurbsRecutCapSectionEvent3[];intervals:readonly Readonly<{start:NurbsRecutCapSectionEvent3;end:NurbsRecutCapSectionEvent3;spans:readonly NurbsRecutCapSectionSpan3[]}>[];isolated:readonly NurbsRecutCapSectionEvent3[]}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Section either generation of finite planar cap in the actual closed recut
 * topology. This is a face section, not another closed-body cut. Whole native
 * edge partitions and coedge provenance are retained for subsequent splitting. */
export function intersectNurbsRecutCapFacePlane3(source:CappedNurbsRecutHalf3,face:number,input:Plane3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutCapSection3 {
 assertOwnedCappedNurbsRecutHalf3(source);if(source.kind!=='closed')throw new RangeError('Expected a closed recut boundary');
 if(!Number.isSafeInteger(face)||face<0||face>=source.topology.faces.length)throw new RangeError('Invalid recut cap face index');
 const surface=source.topology.faces[face]!.surface;
 if(surface.kind==='retained'&&surface.source.kind!=='cap')throw new RangeError('Expected a finite planar recut cap face');
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),budget=options.maxDirections??16;
 if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const F=surface.kind==='cap'?surface.source.boundary.frame:surface.source.kind==='cap'?surface.source.source.source.source.surface.source.boundary.frame:null;
 if(F===null)throw new Error('Planar recut cap lost its frame');
 const context={source,face,surface,plane},n=plane.normal,A=dot3(n,F.u),D=dot3(n,F.v),C=dot3(n,F.origin).add(plane.offset);
 if(A.sign()===0&&D.sign()===0)return Object.freeze({...context,kind:C.sign()===0?'coplanar':'parallel'});
 const x=A.sign()!==0?C.neg().div(A):new Rational(0n),y=A.sign()!==0?new Rational(0n):C.neg().div(D),origin=point3(...(['x','y','z'] as const).map(k=>F.origin[k].add(F.u[k].mul(x)).add(F.v[k].mul(y))) as Parameters<typeof point3>),direction=point3(...(['x','y','z'] as const).map(k=>F.v[k].mul(A).sub(F.u[k].mul(D))) as Parameters<typeof point3>),line=line3(origin,direction),dd=dot3(direction,direction);
 const events:{parameter:AlgebraicReal;point:AlgebraicCoordinates3;boundary:{loop:number;coedge:number;edge:number;parameter:AlgebraicReal}[]}[]=[],boundaryPartitions:NurbsRecutCapSectionBoundary3[]=[],T=source.topology;
 for(const loop of T.faces[face]!.loops)for(const coedge of T.loops[loop]!.coedges){const h=T.coedges[coedge]!,partition=partitionNurbsRecutCurveByAlgebraicPlane3(T.edges[h.edge]!.curve,plane);boundaryPartitions.push(Object.freeze({loop,coedge,edge:h.edge,direction:h.direction,partition}));
  for(const vertex of partition.vertices)if(vertex.sign===0){const parameter=AlgebraicReal.linearCombination((['x','y','z'] as const).map(k=>({value:vertex.point[k],coefficient:direction[k].div(dd)})),dot3(origin,direction).neg().div(dd)),provenance={loop,coedge,edge:h.edge,parameter:vertex.parameter},old=events.find(e=>e.parameter.compare(parameter)===0);
   if(old){if(compareAlgebraicPoints3(old.point,vertex.point)!==0)throw new Error('Equal section parameters lost XYZ equality');old.boundary.push(provenance);}else events.push({parameter,point:vertex.point,boundary:[provenance]});
  }
 }
 events.sort((a,b)=>a.parameter.compare(b.parameter));const vertices=Object.freeze(events.map(e=>Object.freeze({...e,boundary:Object.freeze(e.boundary.map(p=>Object.freeze(p)))}))),pieces:{first:number;last:number;spans:NurbsRecutCapSectionSpan3[]}[]=[],covered=new Set<number>();
 for(let i=0;i+1<vertices.length;i++){const start=vertices[i]!,end=vertices[i+1]!,sampleParameter=between(start.parameter,end.parameter),p=point3(origin.x.add(direction.x.mul(sampleParameter)),origin.y.add(direction.y.mul(sampleParameter)),origin.z.add(direction.z.mul(sampleParameter))),query=locateNurbsRecutClosedSurface3(surface,p,options);
  if(query.kind==='unresolved')return Object.freeze({...context,kind:'unresolved',line,query});if(query.location==='outside')continue;
  const span=Object.freeze({start,end,sampleParameter,location:query.location});covered.add(i);covered.add(i+1);const previous=pieces.at(-1);if(previous&&previous.last===i){previous.last=i+1;previous.spans.push(span);}else pieces.push({first:i,last:i+1,spans:[span]});
 }
 return Object.freeze({...context,kind:'section',line,boundaryPartitions:Object.freeze(boundaryPartitions),events:vertices,intervals:Object.freeze(pieces.map(p=>Object.freeze({start:vertices[p.first]!,end:vertices[p.last]!,spans:Object.freeze(p.spans)}))),isolated:Object.freeze(vertices.filter((_,i)=>!covered.has(i)))});
}
