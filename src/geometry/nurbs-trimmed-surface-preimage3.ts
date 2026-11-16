import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Point3} from './point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {partitionValidatedNurbsDomainGraphEdge2} from './nurbs-domain-graph-edge2.js';
import {nurbsDomainPatchWitness3,locateNurbsDomainPatch3} from './nurbs-domain-patch3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import {nurbsSurfacePointPreimages3,assertOwnedNurbsSurfacePointPreimages3,nurbsSurfacePreimageEdgePoint3,nurbsSurfacePreimagePatchPoint3} from './nurbs-surface-preimage3.js';
import type {NurbsSurfacePointPreimages3} from './nurbs-surface-preimage3.js';
import type {NurbsSurface3} from './nurbs-surface3.js';

export interface TrimmedNurbsPreimageVertex3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly location:'inside'|'boundary';
 readonly sourcePoints:readonly number[];readonly sourceVertices:readonly number[];readonly sourceEdges:readonly number[];
}
export interface TrimmedNurbsPreimagePatch3 {
 readonly sourcePatch:number;readonly vertices:readonly TrimmedNurbsPreimageVertex3[];
 /** sourceEdge is the ordinal in the source patch's selected locusEdges list. */
 readonly edges:readonly Readonly<{from:number;to:number;sourceEdge:number;lower:AlgebraicReal;upper:AlgebraicReal;location:'inside'|'boundary'}>[];
 /** Nonempty CLOSED trim/rectangle intersection; may be disconnected or have
  * only boundary contacts. It is not a positive spatial area certificate. */
 readonly region:Readonly<{witness:Readonly<{u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3}>;locate(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2}>|null;
}
export interface TrimmedNurbsSurfacePointPreimages3 {readonly source:NurbsSurfacePointPreimages3;readonly domain:PreparedNurbsParameterDomain2;readonly patches:readonly TrimmedNurbsPreimagePatch3[];readonly empty:boolean;}
const owned=new WeakSet<TrimmedNurbsSurfacePointPreimages3>(),real=(v:AlgebraicReal|ExactInput)=>v instanceof AlgebraicReal?v:AlgebraicReal.fromRational(v);
/** Restrict only certified target-matching point/curve/patch preimages. Raw
 * conjugate candidate graph components are never admitted by trim membership. */
export function trimNurbsSurfacePointPreimages3(source:NurbsSurfacePointPreimages3,input:PreparedNurbsParameterDomain2):TrimmedNurbsSurfacePointPreimages3 {
 assertOwnedNurbsSurfacePointPreimages3(source);const domain=prepareNurbsParameterDomain2(input.outer,input.holes,input.sense),patches:TrimmedNurbsPreimagePatch3[]=[];
 source.patches.forEach((p,sourcePatch)=>{
  type V={u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;location:'inside'|'boundary';sourcePoints:number[];sourceVertices:number[];sourceEdges:number[]};const vertices:V[]=[],edges:TrimmedNurbsPreimagePatch3['edges'][number][]=[];
  const add=(u:AlgebraicReal,v:AlgebraicReal,kind:'sourcePoints'|'sourceVertices'|'sourceEdges',origin:number):number|null=>{
   const location=domain.locate(u,v);if(location==='outside')return null;let id=vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0);
   if(id<0){const point=liftNurbsSectionPatch3(p.patch,u,v);if(compareAlgebraicPoints3(point,source.point)!==0)throw new Error('Trim admitted a nonmatching inverse image');id=vertices.length;vertices.push({u,v,point,location,sourcePoints:[],sourceVertices:[],sourceEdges:[]});}if(!vertices[id]![kind].includes(origin))vertices[id]![kind].push(origin);return id;
  };
  p.points.forEach((q,id)=>add(q.u,q.v,'sourcePoints',id));p.locusVertices.forEach(id=>{const q=p.locus!.vertices[id]!;add(q.u,q.v,'sourceVertices',id);});
  p.locusEdges.forEach((rawEdge,sourceEdge)=>{
   const graph=p.locus!,e=graph.edges[rawEdge]!,axis=e.kind==='branch'?'u':'v',partition=partitionValidatedNurbsDomainGraphEdge2(graph,rawEdge,graph.vertices[e.from]![axis],graph.vertices[e.to]![axis],domain);
   for(const v of partition.vertices)add(v.u,v.v,'sourceEdges',sourceEdge);
   for(const piece of partition.pieces)if(piece.location!=='outside'){const a=evaluateAlgebraicCurveEdge2(graph,rawEdge,piece.lower),b=evaluateAlgebraicCurveEdge2(graph,rawEdge,piece.upper),from=add(a.u,a.v,'sourceEdges',sourceEdge),to=add(b.u,b.v,'sourceEdges',sourceEdge);if(from===null||to===null)throw new Error('Retained inverse edge has an outside endpoint');edges.push(Object.freeze({from,to,sourceEdge,lower:piece.lower,upper:piece.upper,location:piece.location}));}
  });
  let region:TrimmedNurbsPreimagePatch3['region']=null;
  if(p.wholePatch){const q=nurbsDomainPatchWitness3(p.patch,domain);if(q){const locate=(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2=>locateNurbsDomainPatch3(p.patch,domain,u,v);region=Object.freeze({witness:Object.freeze({...q,point:nurbsSurfacePreimagePatchPoint3(source,sourcePatch,q.u,q.v)}),locate});}}
  if(vertices.length||edges.length||region)patches.push(Object.freeze({sourcePatch,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,sourcePoints:Object.freeze(v.sourcePoints),sourceVertices:Object.freeze(v.sourceVertices),sourceEdges:Object.freeze(v.sourceEdges)}))),edges:Object.freeze(edges),region}));
 });
 const result=Object.freeze({source,domain,patches:Object.freeze(patches),empty:patches.length===0});owned.add(result);return result;
}
export function nurbsTrimmedSurfacePointPreimages3(surface:NurbsSurface3,domain:PreparedNurbsParameterDomain2,point:Point3|AlgebraicCoordinates3):TrimmedNurbsSurfacePointPreimages3 {return trimNurbsSurfacePointPreimages3(nurbsSurfacePointPreimages3(surface,point),domain);}
function at(report:TrimmedNurbsSurfacePointPreimages3,patch:number):TrimmedNurbsPreimagePatch3 {if(!owned.has(report))throw new RangeError('Operation requires a factory-created trimmed preimage report');if(!Number.isSafeInteger(patch)||patch<0||patch>=report.patches.length)throw new RangeError('Invalid trimmed inverse patch');return report.patches[patch]!;}
export function trimmedNurbsSurfacePreimageEdgePoint3(report:TrimmedNurbsSurfacePointPreimages3,patch:number,edge:number,input:AlgebraicReal|ExactInput){const p=at(report,patch);if(!Number.isSafeInteger(edge)||edge<0||edge>=p.edges.length)throw new RangeError('Invalid trimmed inverse edge');const e=p.edges[edge]!,t=real(input);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter outside trimmed inverse edge');return nurbsSurfacePreimageEdgePoint3(report.source,p.sourcePatch,e.sourceEdge,t);}
export function trimmedNurbsSurfacePreimagePatchPoint3(report:TrimmedNurbsSurfacePointPreimages3,patch:number,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {const p=at(report,patch);if(!p.region||p.region.locate(u,v)==='outside')throw new RangeError('Parameter outside trimmed inverse region');return nurbsSurfacePreimagePatchPoint3(report.source,p.sourcePatch,u,v);}
