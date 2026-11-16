import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Plane3} from './plane3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {intersectNurbsSurfacePlane3,liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import {sewNurbsPlaneSection3} from './nurbs-section-seams3.js';
import type {NurbsSectionComplex3} from './nurbs-section-seams3.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {nurbsDomainPatchWitness3,locateNurbsDomainPatch3} from './nurbs-domain-patch3.js';
import {nurbsSectionArc3,nurbsSectionArcPoint3} from './nurbs-section-arc3.js';
import type {NurbsSectionArc3} from './nurbs-section-arc3.js';
import {partitionValidatedNurbsSectionArcByDomain3} from './nurbs-section-arc-domain3.js';
import type {NurbsSurface3,NurbsSurfacePatch3} from './nurbs-surface3.js';

export interface TrimmedNurbsSectionVertex3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 readonly location:'inside'|'boundary';readonly sourceVertices:readonly number[];readonly sourceEdges:readonly number[];
}
export interface TrimmedNurbsSectionEdge3 {readonly from:number;readonly to:number;readonly arc:NurbsSectionArc3;readonly sourceEdge:number;readonly location:'inside'|'boundary';}
export interface TrimmedNurbsSectionArea3 {
 readonly sourceArea:number;readonly patch:NurbsSurfacePatch3;
 /** Witness of the CLOSED domain/rectangle intersection. This does not imply
  * positive area or connectedness, nor a regular/embedded spatial image. */
 readonly witness:Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3}>;
 locate(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2;
}
export interface TrimmedNurbsPlaneSection3 {
 readonly source:NurbsSectionComplex3;readonly domain:PreparedNurbsParameterDomain2;
 readonly vertices:readonly TrimmedNurbsSectionVertex3[];readonly edges:readonly TrimmedNurbsSectionEdge3[];
 readonly areas:readonly TrimmedNurbsSectionArea3[];
 /** Components of vertices/edges only; contained area sets are NOT joined. */
 readonly curveComponents:readonly Readonly<{vertices:readonly number[];edges:readonly number[]}>[];
}
const owned=new WeakSet<TrimmedNurbsPlaneSection3>(),real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
/** Complete trimmed section as a union of a parameter-seam curve graph and
 * implicit closed domain/contained-patch intersections. No spatial welding of
 * distinct parameters or general NURBS Body certificate is inferred. */
export function intersectTrimmedNurbsSurfacePlane3(surface:NurbsSurface3,input:PreparedNurbsParameterDomain2,plane:Plane3):TrimmedNurbsPlaneSection3 {
 const domain=prepareNurbsParameterDomain2(input.outer,input.holes,input.sense),source=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(surface,plane));
 type V={u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;location:'inside'|'boundary';sourceVertices:number[];sourceEdges:number[]};
 const vertices:V[]=[],edges:TrimmedNurbsSectionEdge3[]=[];
 const add=(u:AlgebraicReal,v:AlgebraicReal,point:AlgebraicCoordinates3,sourceVertex:number|null,sourceEdge:number|null):number=>{
  const location=domain.locate(u,v);if(location==='outside')throw new Error('A retained section endpoint lies outside the trim');
  let id=vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0&&compareAlgebraicPoints3(q.point,point)===0);if(id<0){id=vertices.length;vertices.push({u,v,point,location,sourceVertices:[],sourceEdges:[]});}
  const q=vertices[id]!;if(sourceVertex!==null&&!q.sourceVertices.includes(sourceVertex))q.sourceVertices.push(sourceVertex);if(sourceEdge!==null&&!q.sourceEdges.includes(sourceEdge))q.sourceEdges.push(sourceEdge);return id;
 };
 source.vertices.forEach((q,id)=>{if(domain.locate(q.u,q.v)!=='outside')add(q.u,q.v,q.point,id,null);});
 source.edges.forEach((e,sourceEdge)=>{
  const use=e.uses[0]!,arc=nurbsSectionArc3(source.source,use.piece,use.edge,e.lower,e.upper),partition=partitionValidatedNurbsSectionArcByDomain3(arc,domain),ids=new Map<AlgebraicReal,number>();
  for(const v of partition.vertices)if(v.location!=='outside')ids.set(v.parameter,add(v.u,v.v,v.point,null,sourceEdge));
  const endpoint=(parameter:AlgebraicReal)=>{const row=partition.vertices.find(v=>v.parameter.compare(parameter)===0);if(!row)throw new Error('Missing trim event endpoint');const id=ids.get(row.parameter);if(id===undefined)throw new Error('Retained edge has an outside endpoint');return id;};
  for(const part of partition.pieces)if(part.location!=='outside')edges.push(Object.freeze({from:endpoint(part.arc.lower),to:endpoint(part.arc.upper),arc:part.arc,sourceEdge,location:part.location}));
 });
 const areas:TrimmedNurbsSectionArea3[]=[];source.source.containedPatches.forEach((patch,sourceArea)=>{
  const q=nurbsDomainPatchWitness3(patch,domain);if(!q)return;
  const locate=(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2=>locateNurbsDomainPatch3(patch,domain,u,v);
  areas.push(Object.freeze({sourceArea,patch,witness:Object.freeze({...q,point:liftNurbsSectionPatch3(patch,q.u,q.v)}),locate}));
 });
 const parents=vertices.map((_,i)=>i),root=(id:number):number=>{while(parents[id]!==id){parents[id]=parents[parents[id]!]!;id=parents[id]!;}return id;};
 edges.forEach(e=>{const a=root(e.from),b=root(e.to);parents[Math.max(a,b)]=Math.min(a,b);});const groups=new Map<number,{vertices:number[];edges:number[]}>(),group=(id:number)=>{const r=root(id);let value=groups.get(r);if(!value){value={vertices:[],edges:[]};groups.set(r,value);}return value;};
 vertices.forEach((_,i)=>group(i).vertices.push(i));edges.forEach((e,i)=>group(e.from).edges.push(i));
 const result:TrimmedNurbsPlaneSection3=Object.freeze({source,domain,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,sourceVertices:Object.freeze(v.sourceVertices.sort((a,b)=>a-b)),sourceEdges:Object.freeze(v.sourceEdges.sort((a,b)=>a-b))}))),edges:Object.freeze(edges),areas:Object.freeze(areas),curveComponents:Object.freeze([...groups.values()].map(g=>Object.freeze({vertices:Object.freeze(g.vertices),edges:Object.freeze(g.edges)})))});owned.add(result);return result;
}
export function trimmedNurbsSectionEdgePoint3(section:TrimmedNurbsPlaneSection3,edge:number,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!owned.has(section))throw new RangeError('Operation requires a factory-created trimmed section');if(!Number.isSafeInteger(edge)||edge<0||edge>=section.edges.length)throw new RangeError('Invalid trimmed section edge');return nurbsSectionArcPoint3(section.edges[edge]!.arc,parameter);
}
export function trimmedNurbsSectionAreaPoint3(section:TrimmedNurbsPlaneSection3,area:number,inputU:AlgebraicReal|ExactInput,inputV:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!owned.has(section))throw new RangeError('Operation requires a factory-created trimmed section');if(!Number.isSafeInteger(area)||area<0||area>=section.areas.length)throw new RangeError('Invalid trimmed section area');const a=section.areas[area]!,u=real(inputU),v=real(inputV);if(a.locate(u,v)==='outside')throw new RangeError('Parameter lies outside the contained trimmed patch');return liftNurbsSectionPatch3(a.patch,u,v);
}
