import {assertOwnedCappedNurbsRecutHalf3, locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {inspectNurbsRecutSourceCapContacts3} from './nurbs-recut-source-cap-contacts3.js';
import type {NurbsRecutSourceCapContacts3} from './nurbs-recut-source-cap-contacts3.js';
import {nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneZeroSetCertificate3} from './nurbs-source-plane-zero-set3.js';
import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';

type Closed = Extract<CappedNurbsRecutHalf3, {kind:'closed'}>;
type Inspected = Extract<NurbsRecutSourceCapContacts3, {kind:'inspected'}>;
type Location = 'inside'|'outside'|'boundary';
export interface NurbsRecutInteriorZeroArcCertificate3 {
 readonly source:Closed;
 readonly zeroSet:NurbsSourcePlaneZeroSetCertificate3;
 readonly input:number;
 readonly edge:number;
 readonly sourceFace:number;
 readonly lower:AlgebraicReal;
 readonly upper:AlgebraicReal;
 readonly method:'inherited-embedding-and-interior-cell-incidence';
 readonly caps:readonly Readonly<{
  capFace:number;
  openLocation:'inside'|'outside';
  lowerLocation:Location;
  upperLocation:Location;
 }>[];
}
export type NurbsRecutInteriorZeroArcs3 =
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;reason:'inspection'|'source-query'|'cap-query'|'unexpected-boundary'|'inconsistent-locations'}>
 | Readonly<{kind:'analyzed';source:Closed;inspection:Inspected;
  certifiesAbsence:false;
  arcs:readonly NurbsRecutInteriorZeroArcCertificate3[];
  pendingEdges:readonly Readonly<{input:number;edge:number;reason:'not-interior'|'not-retained'}>[]}>;
const owned = new WeakSet<NurbsRecutInteriorZeroArcCertificate3>();

/** Classify whole OPEN zero arcs only after proving they lie in the interior
 * of one retained finite face. Two incident cells and no surviving boundary
 * parent are required. The owned inherited embedding excludes all other old
 * boundary sheets there; the complete arrangement excludes boundaries of the
 * same source face. Since new-cap boundaries are subsets of that old boundary,
 * an open connected arc cannot change cap membership. Endpoints are separate.
 * Boundary zero arcs and discarded arcs remain explicit; this is not a full
 * source/cap embedding or contact-absence certificate. */
export function analyzeNurbsRecutInteriorZeroArcs3(
 source:CappedNurbsRecutHalf3, options:Readonly<{maxDirections?:number}>={},
):NurbsRecutInteriorZeroArcs3 {
 assertOwnedCappedNurbsRecutHalf3(source);
 const fail=(reason:Extract<NurbsRecutInteriorZeroArcs3,{kind:'unresolved'}>['reason']):NurbsRecutInteriorZeroArcs3=>Object.freeze({kind:'unresolved',source,reason});
 const inspection=inspectNurbsRecutSourceCapContacts3(source,options);
 if(inspection.kind!=='inspected')return fail('inspection');
 const closed=inspection.source,T=closed.topology;
 const arcs:NurbsRecutInteriorZeroArcCertificate3[]=[],pendingEdges:Extract<NurbsRecutInteriorZeroArcs3,{kind:'analyzed'}>['pendingEdges'][number][]=[];
 for(const {input,zeroSet} of inspection.audits){
  const C=zeroSet.source;
  for(const z of zeroSet.edges){
   const e=C.edges[z.edge]!;
   const retained=T.faces.flatMap((f,face)=>{
    const s=f.surface;
    if(s.kind!=='retained'||s.source.kind!=='source')return [];
    const surface=s.source.source,N=surface.source;
    if(N.source.vertices.cells!==C)return [];
    return [{face,surface,region:N.regions[surface.region]!}];
   });
   const candidates=retained.filter(({surface,region})=>{
    const N=surface.source;
    // Both sides must belong to this same retained region. Equal signs alone
    // are insufficient: disconnected siblings have distinct finite domains.
    if(z.kind!=='same-sign'||e.uses.length!==2||!e.uses.every(u=>region.cells.includes(u.cell)))return false;
    if(region.boundary.some(u=>N.edges[u.edge]!.parent===z.edge))return false;
    return true;
   });
   if(candidates.length===0){pendingEdges.push(Object.freeze({input,edge:z.edge,reason:retained.some(r=>e.uses.some(u=>r.region.cells.includes(u.cell)))?'not-interior':'not-retained'}));continue;}
   if(candidates.length!==1)throw new Error('An interior zero arc belongs to multiple retained finite faces');
   const candidate=candidates[0]!,q=locateNurbsPlaneSplitFaceParameters3(candidate.surface,z.sample.u,z.sample.v);
   if(q.kind==='unresolved')return fail('source-query');
   if(q.location!=='inside'||compareAlgebraicPoints3(q.point,z.sample.point)!==0)return fail('inconsistent-locations');
   const lower=C.vertices[e.from]!.point.point,upper=C.vertices[e.to]!.point.point,caps:NurbsRecutInteriorZeroArcCertificate3['caps'][number][]=[];
   for(const capFace of closed.capFaces){
    const cap=T.faces[capFace]!.surface;
    if(cap.kind!=='cap')throw new Error('New cap map lost its surface family');
    const queries=[z.sample.point,lower,upper].map(p=>locateNurbsRecutClosedSurface3(cap,p,options));
    const [middle,a,b]=queries;
    if(!middle||!a||!b)throw new Error('Missing closed arc query');
    if(middle.kind==='unresolved'||a.kind==='unresolved'||b.kind==='unresolved')return fail('cap-query');
    if(middle.location==='boundary')return fail('unexpected-boundary');
    // Continuity into the closed finite cap and its open complement forbids
    // endpoints on the opposite open side. Boundary endpoints are allowed.
    if([a.location,b.location].some(l=>l!=='boundary'&&l!==middle.location))return fail('inconsistent-locations');
    caps.push(Object.freeze({capFace,openLocation:middle.location,lowerLocation:a.location,upperLocation:b.location}));
   }
   const certificate:NurbsRecutInteriorZeroArcCertificate3=Object.freeze({source:closed,zeroSet,input,edge:z.edge,sourceFace:candidate.face,lower:e.lower,upper:e.upper,method:'inherited-embedding-and-interior-cell-incidence',caps:Object.freeze(caps)});
   owned.add(certificate);arcs.push(certificate);
  }
 }
 return Object.freeze({kind:'analyzed',source:closed,inspection,certifiesAbsence:false,arcs:Object.freeze(arcs),pendingEdges:Object.freeze(pendingEdges)});
}

/** Evaluate any exact parameter using the certified interval classification;
 * closed endpoints use their independently checked classifications. */
export function nurbsRecutInteriorZeroArcPoint3(source:NurbsRecutInteriorZeroArcCertificate3,input:AlgebraicReal|ExactInput):Readonly<{point:AlgebraicCoordinates3;caps:readonly Readonly<{capFace:number;location:Location}>[]}> {
 if(!owned.has(source))throw new RangeError('Expected factory-created interior zero arc certificate');
 const parameter=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);
 if(parameter.compare(source.lower)<0||parameter.compare(source.upper)>0)throw new RangeError('Parameter outside certified zero arc');
 const point=nurbsSourcePlaneCellComplexEdgePoint3(source.zeroSet.source,source.edge,parameter).point;
 const caps=source.caps.map(c=>Object.freeze({capFace:c.capFace,location:parameter.compare(source.lower)===0?c.lowerLocation:parameter.compare(source.upper)===0?c.upperLocation:c.openLocation}));
 return Object.freeze({point,caps:Object.freeze(caps)});
}
