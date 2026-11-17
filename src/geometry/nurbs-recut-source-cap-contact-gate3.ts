import {assertOwnedCappedNurbsRecutHalf3,locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {analyzeNurbsRecutBoundaryZeroArcs3} from './nurbs-recut-boundary-zero-arcs3.js';
import type {NurbsRecutBoundaryZeroArcs3} from './nurbs-recut-boundary-zero-arcs3.js';
import {locateNurbsPlaneSplitFace3,locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutJoinedCurve3} from './nurbs-recut-face-join3.js';
import {partitionNurbsRecutCurveByAlgebraicPlane3} from './nurbs-recut-curve-plane3.js';
import {compareAlgebraicPoints3,snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {point3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';

type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;
type Boundary=Extract<NurbsRecutBoundaryZeroArcs3,{kind:'analyzed'}>;
type Origin=Readonly<{kind:'zero-set'|'noded';input:number;vertex:number}|{kind:'topology';vertex:number}>;
type Relation=Readonly<{sourceFace:number;sourceLocation:'inside'|'boundary';capFace:number;capLocation:'inside'|'outside'|'boundary';kind:'outside'|'declared-vertex'|'declared-edge'|'cap-interior'|'undeclared-boundary';vertex?:number;edge?:number}>;
export interface NurbsRecutSourceCapVertexRecord3 {
 readonly point:AlgebraicCoordinates3;
 readonly origins:readonly Origin[];
 readonly sourceFaces:readonly Readonly<{face:number;location:'inside'|'boundary'}>[];
 readonly relations:readonly Relation[];
}
export type NurbsRecutSourceCapVertices3=
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;reason:'boundary-analysis'|'source-query'|'cap-query'}>
 | Readonly<{kind:'checked';source:Closed;boundary:Boundary;points:readonly NurbsRecutSourceCapVertexRecord3[];
  contacts:readonly Readonly<{point:number;sourceFace:number;capFace:number;kind:'cap-interior'|'undeclared-boundary'}>[]}>;

/** Internal exact point-on-curve query. Intersect three complete coordinate
 * zero sets, retaining closed zero intervals as well as isolated roots.
 * Selected algebraic conjugates are filtered by the existing plane events. */
export function nurbsRecutJoinedCurveContainsPoint3(curve:NurbsRecutJoinedCurve3,input:Point3|AlgebraicCoordinates3):boolean {
 const point=snapshotExactPoint3(input);
 // Also validates ownership when an early empty coordinate intersection occurs.
 nurbsRecutJoinedCurvePoint3(curve,curve.lower);
 let intervals:{lower:AlgebraicReal;upper:AlgebraicReal}[]=[{lower:curve.lower,upper:curve.upper}],points:AlgebraicReal[]=[];
 const within=(t:AlgebraicReal,i:{lower:AlgebraicReal;upper:AlgebraicReal})=>t.compare(i.lower)>=0&&t.compare(i.upper)<=0;
 for(const axis of ['x','y','z'] as const){
  const normal=point3(axis==='x'?1n:0n,axis==='y'?1n:0n,axis==='z'?1n:0n),q=partitionNurbsRecutCurveByAlgebraicPlane3(curve,{normal,offset:point[axis].affine(-1n)});
  const next:{lower:AlgebraicReal;upper:AlgebraicReal}[]=[],roots=points.filter(t=>nurbsRecutJoinedCurvePoint3(curve,t)[axis].compare(point[axis])===0),add=(t:AlgebraicReal)=>{if(!roots.some(r=>r.compare(t)===0))roots.push(t);};
  for(const i of intervals){
   for(const v of q.vertices)if(v.sign===0&&within(v.parameter,i))add(v.parameter);
   for(const j of q.intervals)if(j.sign===0){const lower=i.lower.compare(j.lower)>=0?i.lower:j.lower,upper=i.upper.compare(j.upper)<=0?i.upper:j.upper,s=lower.compare(upper);if(s<0)next.push({lower,upper});else if(s===0)add(lower);}
  }
  intervals=next;points=roots;
  if(!intervals.length&&!points.length)return false;
 }
 return intervals.length>0||points.length>0;
}

/** Check all original zero vertices, source-noding vertices and final topology
 * vertices on the new plane, including endpoints of open-discarded arcs.
 * Known UV provenance avoids re-solving its source inverse; other finite
 * source faces are checked spatially rather than inferred from incidence. */
export function analyzeNurbsRecutSourceCapVertices3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutSourceCapVertices3 {
 assertOwnedCappedNurbsRecutHalf3(source);
 const fail=(reason:Extract<NurbsRecutSourceCapVertices3,{kind:'unresolved'}>['reason']):NurbsRecutSourceCapVertices3=>Object.freeze({kind:'unresolved',source,reason});
 const boundary=analyzeNurbsRecutBoundaryZeroArcs3(source,options);
 if(boundary.kind!=='analyzed')return fail('boundary-analysis');
 const closed=boundary.source,T=closed.topology,R=closed.source.embedding.source.source,P=closed.source.boundary.source.plane;
 type UV=Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;
 const points:{point:AlgebraicCoordinates3;origins:Origin[];known:Map<number,UV[]>}[]=[],onPlane=(p:AlgebraicCoordinates3)=>AlgebraicReal.linearCombination([{value:p.x,coefficient:P.normal.x},{value:p.y,coefficient:P.normal.y},{value:p.z,coefficient:P.normal.z}],P.offset).sign()===0;
 const add=(point:AlgebraicCoordinates3,origin:Origin,uv?:UV)=>{
  let entry=points.find(p=>compareAlgebraicPoints3(p.point,point)===0);
  if(!entry){entry={point,origins:[],known:new Map()};points.push(entry);}
  entry.origins.push(Object.freeze(origin));
  if(uv&&origin.kind!=='topology'){const values=entry.known.get(origin.input)??[];if(!values.some(p=>p.u.compare(uv.u)===0&&p.v.compare(uv.v)===0))values.push(uv);entry.known.set(origin.input,values);}
 };
 for(const {input,zeroSet} of boundary.interior.inspection.audits){
  zeroSet.vertices.forEach((v,vertex)=>add(v.point.point,{kind:'zero-set',input,vertex},v.point));
  R.inputs[input]!.source.vertices.forEach((v,vertex)=>{if(onPlane(v.point))add(v.point,{kind:'noded',input,vertex},v);});
 }
 T.vertices.forEach((p,vertex)=>{if(onPlane(p))add(p,{kind:'topology',vertex});});
 const faces=T.faces.flatMap((f,face)=>{const s=f.surface;if(s.kind!=='retained'||s.source.kind!=='source')return [];const surface=s.source.source,input=R.inputs.findIndex(b=>b.source===surface.source);if(input<0)throw new Error('Retained source face lost owned input');return [{face,surface,input}];});
 const atVertex=(face:number,vertex:number)=>T.faces[face]!.loops.some(l=>T.loops[l]!.coedges.some(h=>T.coedges[h]!.origin===vertex));
 const records:NurbsRecutSourceCapVertexRecord3[]=[],contacts:Extract<NurbsRecutSourceCapVertices3,{kind:'checked'}>['contacts'][number][]=[];
 for(const [index,p] of points.entries()){
  const retained:{face:number;location:'inside'|'boundary'}[]=[];
  for(const c of faces){
   const known=p.known.get(c.input),queries=known?known.map(uv=>locateNurbsPlaneSplitFaceParameters3(c.surface,uv.u,uv.v)):[locateNurbsPlaneSplitFace3(c.surface,p.point)];
   if(queries.some(q=>q.kind==='unresolved'))return fail('source-query');
   const members=queries.filter(q=>q.kind==='located'&&q.location!=='outside');
   if(!members.length)continue;
   if(members.some(q=>q.kind==='located'&&q.point&&compareAlgebraicPoints3(q.point,p.point)!==0))throw new Error('Zero vertex lost spatial source equality');
   retained.push({face:c.face,location:members.some(q=>q.kind==='located'&&q.location==='inside')?'inside':'boundary'});
  }
  const relations:Relation[]=[];
  if(retained.length)for(const capFace of closed.capFaces){
   const cap=T.faces[capFace]!.surface,q=locateNurbsRecutClosedSurface3(cap,p.point,options);
   if(q.kind==='unresolved')return fail('cap-query');
   for(const c of retained){
    let kind:Relation['kind']=q.location==='outside'?'outside':q.location==='inside'?'cap-interior':'undeclared-boundary',vertex:number|undefined,edge:number|undefined;
    if(q.location==='boundary'&&c.location==='boundary'){
     const origin=p.origins.find(o=>o.kind==='topology'&&atVertex(c.face,o.vertex)&&atVertex(capFace,o.vertex));
     if(origin){kind='declared-vertex';vertex=origin.vertex;}
     else {const common=T.edges.findIndex(e=>e.coedges.some(h=>T.coedges[h]!.face===c.face)&&e.coedges.some(h=>T.coedges[h]!.face===capFace)&&nurbsRecutJoinedCurveContainsPoint3(e.curve,p.point));if(common>=0){kind='declared-edge';edge=common;}}
    }
    relations.push(Object.freeze({sourceFace:c.face,sourceLocation:c.location,capFace,capLocation:q.location,kind,...(vertex===undefined?{}:{vertex}),...(edge===undefined?{}:{edge})}));
    if(kind==='cap-interior'||kind==='undeclared-boundary')contacts.push(Object.freeze({point:index,sourceFace:c.face,capFace,kind}));
   }
  }
  records.push(Object.freeze({point:p.point,origins:Object.freeze(p.origins),sourceFaces:Object.freeze(retained.map(c=>Object.freeze(c))),relations:Object.freeze(relations)}));
 }
 return Object.freeze({kind:'checked',source:closed,boundary,points:Object.freeze(records),contacts:Object.freeze(contacts)});
}

type Checked=Extract<NurbsRecutSourceCapVertices3,{kind:'checked'}>;
export interface NurbsRecutSourceCapContactCertificate3 {
 readonly source:Closed;
 readonly scope:'retained-nurbs-source-to-new-caps';
 readonly method:'complete-zero-strata-and-declared-incidence';
 readonly audit:Checked;
}
export type NurbsRecutSourceCapContactGate3=
 | Readonly<{kind:'certified';certificate:NurbsRecutSourceCapContactCertificate3}>
 | Readonly<{kind:'unresolved';audit:Extract<NurbsRecutSourceCapVertices3,{kind:'unresolved'}>}>
 | Readonly<{kind:'contact';audit:Checked;witness:Readonly<{kind:'vertex';point:number;sourceFace:number;capFace:number}|{kind:'interior-arc'|'boundary-arc';arc:number;sourceFace:number;capFace:number;point:AlgebraicCoordinates3}>}>;
const certificates=new WeakSet<NurbsRecutSourceCapContactCertificate3>();
export function assertOwnedNurbsRecutSourceCapContactCertificate3(c:NurbsRecutSourceCapContactCertificate3):void {if(!certificates.has(c))throw new RangeError('Expected factory-created source/new-cap contact certificate');}
/** Scoped absence of UNDECLARED contacts, not absence of shared boundaries.
 * All zero-dimensional events and all complete open zero arcs are covered;
 * coplanar source areas remain unresolved in the prerequisite analysis.
 * Retained old planar caps and whole-body embedding are NOT certified. */
export function certifyNurbsRecutSourceCapContacts3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutSourceCapContactGate3 {
 const audit=analyzeNurbsRecutSourceCapVertices3(source,options);
 if(audit.kind!=='checked')return Object.freeze({kind:'unresolved',audit});
 const first=audit.contacts[0];
 if(first)return Object.freeze({kind:'contact',audit,witness:Object.freeze({kind:'vertex',point:first.point,sourceFace:first.sourceFace,capFace:first.capFace})});
 const midpoint=(lower:AlgebraicReal,upper:AlgebraicReal)=>{let a=lower,b=upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));};
 for(const [arc,a] of audit.boundary.interior.arcs.entries())for(const c of a.caps)if(c.openLocation==='inside'){
  const z=a.zeroSet.edges.find(e=>e.edge===a.edge)!;
  return Object.freeze({kind:'contact',audit,witness:Object.freeze({kind:'interior-arc',arc,sourceFace:a.sourceFace,capFace:c.capFace,point:z.sample.point})});
 }
 for(const [arc,a] of audit.boundary.arcs.entries())for(const c of a.caps)if(c.openLocation==='inside')return Object.freeze({kind:'contact',audit,witness:Object.freeze({kind:'boundary-arc',arc,sourceFace:a.sourceFace,capFace:c.capFace,point:nurbsRecutJoinedCurvePoint3(audit.source.topology.edges[a.edge]!.curve,midpoint(a.lower,a.upper))})});
 const certificate:NurbsRecutSourceCapContactCertificate3=Object.freeze({source:audit.source,scope:'retained-nurbs-source-to-new-caps',method:'complete-zero-strata-and-declared-incidence',audit});
 certificates.add(certificate);return Object.freeze({kind:'certified',certificate});
}
