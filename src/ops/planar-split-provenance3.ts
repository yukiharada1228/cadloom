import {isOwnedRecutNurbsBody3} from '../model/recut-nurbs-body3.js';
import {isOwnedCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import {Rational} from '../numeric/rational.js';
import {point3,subtract3,dot3,cross3,pointsEqual3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import {plane3,evaluatePlane3} from '../geometry/plane3.js';
import type {Plane3} from '../geometry/plane3.js';
import {partitionConvexPolygonByPlanes3} from '../geometry/convex-polygon-plane-arrangement3.js';
import {planarBoundaryPolygonsWithFaceOrigins3} from '../convert/planar-body3.js';
import type {KernelBody3} from '../model/body3.js';
import {isOwnedNurbsBody3} from '../model/nurbs-body3.js';
import type {CellularBody3} from '../model/cellular-body3.js';
import {assertOwnedPlanarBodySplit3} from './planar-body-split3.js';
import type {PlanarBodyPlaneSplit3} from './planar-body-split3.js';

export interface SplitParameterInterval3 {readonly start:Rational;readonly end:Rational;}
export interface SplitParentEdgeInterval3 {
 readonly edge:number;readonly childStart:Rational;readonly childEnd:Rational;
 readonly parentStart:Rational;readonly parentEnd:Rational;
}
export interface SplitParentCoedgeInterval3 {
 readonly coedge:number;readonly childStart:Rational;readonly childEnd:Rational;
 readonly parentStart:Rational;readonly parentEnd:Rational;readonly direction:1|-1;
}
export interface SplitFaceOrigin3 {
 readonly kind:'parent'|'cut';readonly parentFaces:readonly number[];
 /** Positive-area exact intersections cover every retained child face. */
 readonly fragments:readonly Readonly<{parentFace:number;polygon:readonly Point3[]}>[];
}
export interface SplitEdgeOrigin3 {
 readonly parentEdges:readonly SplitParentEdgeInterval3[];
 readonly parentFaces:readonly Readonly<{face:number;start:Rational;end:Rational}>[];
 /** Portions that did not exist as parent edges; may be cut or subdivision edges. */
 readonly created:readonly SplitParameterInterval3[];readonly onCutPlane:boolean;
}
export interface SplitCoedgeOrigin3 {
 readonly parentCoedges:readonly SplitParentCoedgeInterval3[];
 /** New edge uses, even when their underlying geometric edge is inherited. */
 readonly created:readonly SplitParameterInterval3[];
}
export interface SplitVertexOrigin3 {
 readonly parentVertices:readonly number[];
 readonly parentEdges:readonly Readonly<{edge:number;parameter:Rational}>[];
 readonly parentFaces:readonly number[];readonly created:boolean;readonly onCutPlane:boolean;
}
export interface PlanarSplitChildProvenance3 {
 readonly body:CellularBody3;readonly faces:readonly SplitFaceOrigin3[];
 readonly edges:readonly SplitEdgeOrigin3[];readonly coedges:readonly SplitCoedgeOrigin3[];
 readonly vertices:readonly SplitVertexOrigin3[];
}
export interface PlanarBodySplitProvenance3 {readonly negative:PlanarSplitChildProvenance3;readonly positive:PlanarSplitChildProvenance3;}
const zero=new Rational(0n),one=new Rational(1n),cache=new WeakMap<PlanarBodyPlaneSplit3,PlanarBodySplitProvenance3>();
const max=(a:Rational,b:Rational)=>a.compare(b)>=0?a:b,min=(a:Rational,b:Rational)=>a.compare(b)<=0?a:b;
function interval(start:Rational,end:Rational):SplitParameterInterval3|null {return start.compare(end)<0?Object.freeze({start,end}):null;}
function intersect(a:SplitParameterInterval3,b:SplitParameterInterval3){return interval(max(a.start,b.start),min(a.end,b.end));}
function merged(input:readonly SplitParameterInterval3[]):readonly SplitParameterInterval3[] {
 const sorted=[...input].sort((a,b)=>a.start.compare(b.start)||a.end.compare(b.end)),out:SplitParameterInterval3[]=[];
 for(const part of sorted){const last=out[out.length-1];if(last&&part.start.compare(last.end)<=0)out[out.length-1]=Object.freeze({start:last.start,end:max(last.end,part.end)});else out.push(part);}
 return Object.freeze(out);
}
function gaps(input:readonly SplitParameterInterval3[]):readonly SplitParameterInterval3[] {
 const out:SplitParameterInterval3[]=[];let at=zero;for(const part of merged(input)){if(part.start.compare(at)>0)out.push(Object.freeze({start:at,end:part.start}));at=max(at,part.end);}if(at.compare(one)<0)out.push(Object.freeze({start:at,end:one}));return Object.freeze(out);
}
function vertices(body:KernelBody3):readonly Point3[] {return body.topology.vertices.map(p=>{if(p.x.rational===null||p.y.rational===null||p.z.rational===null)throw new Error('Planar provenance requires rational vertices');return point3(p.x.rational,p.y.rational,p.z.rational);});}
function area(p:readonly Point3[]):Point3 {return p.reduce((sum,a,i)=>{const c=cross3(a,p[(i+1)%p.length]!);return point3(sum.x.add(c.x),sum.y.add(c.y),sum.z.add(c.z));},point3(0n,0n,0n));}
function edgePlanes(p:readonly Point3[]):readonly Plane3[] {const n=area(p);return p.map((a,i)=>{const inward=cross3(n,subtract3(p[(i+1)%p.length]!,a));return plane3(inward.x,inward.y,inward.z,dot3(inward,a).neg());});}
function planeKey(p:Plane3){const n=p.normal,k=[n.x,n.y,n.z].find(v=>v.sign()!==0)!;return [n.x,n.y,n.z,p.offset].map(v=>v.div(k).toString()).join(',');}
function lineInterval(a:Point3,b:Point3,planes:readonly Plane3[]):SplitParameterInterval3|null {
 let lo=zero,hi=one;const d=subtract3(b,a);
 for(const plane of planes){const value=evaluatePlane3(plane,a),slope=dot3(plane.normal,d);if(slope.sign()===0){if(value.sign()<0)return null;continue;}const t=value.neg().div(slope);if(slope.sign()>0)lo=max(lo,t);else hi=min(hi,t);if(lo.compare(hi)>=0)return null;}
 return interval(lo,hi);
}
const at=(a:Point3,b:Point3,t:Rational)=>point3(a.x.add(b.x.sub(a.x).mul(t)),a.y.add(b.y.sub(a.y).mul(t)),a.z.add(b.z.sub(a.z).mul(t)));
function parameter(p:Point3,a:Point3,b:Point3):Rational {const d=subtract3(b,a),D=dot3(d,d);if(D.sign()===0)throw new Error('Planar provenance requires positive-length edges');return dot3(subtract3(p,a),d).div(D);}
function collinear(p:Point3,a:Point3,b:Point3):boolean {const c=cross3(subtract3(b,a),subtract3(p,a));return dot3(c,c).sign()===0;}
function overlap(a:Point3,b:Point3,p:Point3,q:Point3):SplitParameterInterval3|null {
 if(!collinear(p,a,b)||!collinear(q,a,b))return null;const x=parameter(p,a,b),y=parameter(q,a,b);return interval(max(zero,min(x,y)),min(one,max(x,y)));
}
const ids=(input:readonly number[])=>Object.freeze([...new Set(input)].sort((a,b)=>a-b));

/** Exact lineage on the actual parent/child boundaries. Face area
 * coverage and closed segment intervals are checked, not inferred from samples.
 * This optional analysis can be expensive and is cached only for an owned split. */
export function planarBodySplitProvenance3(split:PlanarBodyPlaneSplit3):PlanarBodySplitProvenance3 {
 assertOwnedPlanarBodySplit3(split);const known=cache.get(split);if(known)return known;
 const parent=split.parent;if(isOwnedRecutNurbsBody3(parent)||isOwnedNurbsBody3(parent)||isOwnedCappedNurbsBody3(parent))throw new RangeError('NURBS Body planar split provenance is not implemented');const pv=vertices(parent),raw=planarBoundaryPolygonsWithFaceOrigins3(parent.topology),pe=parent.topology.edges.map(e=>({a:pv[e.start]!,b:pv[e.end]!}));
 const groups=new Map<string,{plane:Plane3;pieces:{face:number;polygon:readonly Point3[];planes:readonly Plane3[]}[]}>();
 raw.polygons.forEach((p,i)=>{const face=raw.faceOrigins[i]!,support=parent.topology.faces[face]!.surface;if(support.kind!=='plane')throw new Error('Planar provenance has a curved parent');const key=planeKey(support.plane);let group=groups.get(key);if(!group){group={plane:support.plane,pieces:[]};groups.set(key,group);}group.pieces.push({face,polygon:p,planes:edgePlanes(p)});});
 const analyze=(body:CellularBody3,cutFaces:ReadonlySet<number>):PlanarSplitChildProvenance3=>{
  const cv=vertices(body),ce=body.topology.edges.map(e=>({a:cv[e.start]!,b:cv[e.end]!}));
  const faces=Object.freeze(body.topology.faces.map((face,faceId):SplitFaceOrigin3=>{
   if(face.surface.kind!=='plane'||face.loops.length!==1)throw new Error('Cellular split face is not a convex planar polygon');
   const polygon=body.topology.loops[face.loops[0]!]!.coedges.map(id=>cv[body.topology.coedges[id]!.origin]!),n=area(polygon),measure=dot3(n,n),fragments:{parentFace:number;polygon:readonly Point3[]}[]=[];let covered=zero;
   for(const piece of groups.get(planeKey(face.surface.plane))?.pieces??[]){
    const parts=partitionConvexPolygonByPlanes3(polygon,piece.planes).filter(c=>c.signs.every(s=>s>=0));
    for(const part of parts){const physical=parent.topology.faces[piece.face]!,surface=physical.surface;if(surface.kind!=='plane'||dot3(surface.plane.normal,face.surface.plane.normal).sign()*physical.sense*face.sense<=0)throw new Error('Inherited split face has reversed physical orientation');fragments.push(Object.freeze({parentFace:piece.face,polygon:part.polygon}));covered=covered.add(dot3(n,area(part.polygon)));}
   }
   const cut=cutFaces.has(faceId);if(cut?covered.sign()!==0:!covered.equals(measure))throw new Error('Split face provenance does not cover its exact bounded domain');
   return Object.freeze({kind:cut?'cut':'parent',parentFaces:ids(fragments.map(f=>f.parentFace)),fragments:Object.freeze(fragments)});
  }));
  const edgeOrigins=Object.freeze(ce.map((edge,edgeId):SplitEdgeOrigin3=>{
   const parentEdges:SplitParentEdgeInterval3[]=[],parentFaces:{face:number;start:Rational;end:Rational}[]=[];
   pe.forEach((p,id)=>{const part=overlap(edge.a,edge.b,p.a,p.b);if(part)parentEdges.push(Object.freeze({edge:id,childStart:part.start,childEnd:part.end,parentStart:parameter(at(edge.a,edge.b,part.start),p.a,p.b),parentEnd:parameter(at(edge.a,edge.b,part.end),p.a,p.b)}));});
   const perFace=new Map<number,SplitParameterInterval3[]>();
   for(const group of groups.values())if(evaluatePlane3(group.plane,edge.a).sign()===0&&evaluatePlane3(group.plane,edge.b).sign()===0)for(const piece of group.pieces){const part=lineInterval(edge.a,edge.b,piece.planes);if(part){let list=perFace.get(piece.face);if(!list){list=[];perFace.set(piece.face,list);}list.push(part);}}
   for(const [face,parts] of perFace)for(const part of merged(parts))parentFaces.push(Object.freeze({face,...part}));
   const onCutPlane=evaluatePlane3(split.plane,edge.a).sign()===0&&evaluatePlane3(split.plane,edge.b).sign()===0,cutUse=body.topology.edges[edgeId]!.coedges.some(id=>cutFaces.has(body.topology.coedges[id]!.face));
   if(gaps(parentFaces).length&&!(onCutPlane&&cutUse))throw new Error('Split edge has no complete parent boundary or cut-face origin');
   return Object.freeze({parentEdges:Object.freeze(parentEdges),parentFaces:Object.freeze(parentFaces.sort((a,b)=>a.face-b.face||a.start.compare(b.start))),created:gaps(parentEdges.map(p=>({start:p.childStart,end:p.childEnd}))),onCutPlane});
  }));
  const coedges=Object.freeze(body.topology.coedges.map((h):SplitCoedgeOrigin3=>{
   const edge=ce[h.edge]!,perUse=new Map<number,SplitParameterInterval3[]>();
   for(const origin of edgeOrigins[h.edge]!.parentEdges)for(const parentUse of parent.topology.edges[origin.edge]!.coedges){
    const ph=parent.topology.coedges[parentUse]!;
    for(const fragment of faces[h.face]!.fragments.filter(f=>f.parentFace===ph.face)){
     const onFace=lineInterval(edge.a,edge.b,edgePlanes(fragment.polygon)),part=onFace&&intersect(onFace,{start:origin.childStart,end:origin.childEnd});
     if(part){let list=perUse.get(parentUse);if(!list){list=[];perUse.set(parentUse,list);}list.push(part);}
    }
   }
   const parentCoedges:SplitParentCoedgeInterval3[]=[];
   for(const [coedge,parts] of perUse){const ph=parent.topology.coedges[coedge]!,p=pe[ph.edge]!;
    for(const part of merged(parts)){
     const childStart=h.direction===1?part.start:one.sub(part.end),childEnd=h.direction===1?part.end:one.sub(part.start),t0=h.direction===1?part.start:part.end,t1=h.direction===1?part.end:part.start;
     const convert=(t:Rational)=>{const q=parameter(at(edge.a,edge.b,t),p.a,p.b);return ph.direction===1?q:one.sub(q);},parentStart=convert(t0),parentEnd=convert(t1),direction=parentEnd.compare(parentStart)>0?1 as const:-1 as const;
     parentCoedges.push(Object.freeze({coedge,childStart,childEnd,parentStart,parentEnd,direction}));
    }
   }
   parentCoedges.sort((a,b)=>a.coedge-b.coedge||a.childStart.compare(b.childStart));
   return Object.freeze({parentCoedges:Object.freeze(parentCoedges),created:gaps(parentCoedges.map(p=>({start:p.childStart,end:p.childEnd})))});
  }));
  const vertexOrigins=Object.freeze(cv.map((p,vertex):SplitVertexOrigin3=>{
   const parentVertices=ids(pv.flatMap((q,id)=>pointsEqual3(p,q)?[id]:[])),parentEdges:{edge:number;parameter:Rational}[]=[],parentFaces:number[]=[];
   pe.forEach((edge,id)=>{if(!collinear(p,edge.a,edge.b))return;const t=parameter(p,edge.a,edge.b);if(t.compare(zero)>=0&&t.compare(one)<=0)parentEdges.push(Object.freeze({edge:id,parameter:t}));});
   for(const group of groups.values())if(evaluatePlane3(group.plane,p).sign()===0)for(const piece of group.pieces)if(piece.planes.every(plane=>evaluatePlane3(plane,p).sign()>=0))parentFaces.push(piece.face);
   const onCutPlane=evaluatePlane3(split.plane,p).sign()===0,cutUse=body.topology.outgoing[vertex]!.some(id=>cutFaces.has(body.topology.coedges[id]!.face));
   if(!parentFaces.length&&!(onCutPlane&&cutUse))throw new Error('Split vertex has no parent boundary or cut-face origin');
   return Object.freeze({parentVertices,parentEdges:Object.freeze(parentEdges),parentFaces:ids(parentFaces),created:parentVertices.length===0,onCutPlane});
  }));
  return Object.freeze({body,faces,edges:edgeOrigins,coedges,vertices:vertexOrigins});
 };
 const result=Object.freeze({negative:analyze(split.negative,new Set(split.shared.map(p=>p.negativeFace))),positive:analyze(split.positive,new Set(split.shared.map(p=>p.positiveFace)))});cache.set(split,result);return result;
}
