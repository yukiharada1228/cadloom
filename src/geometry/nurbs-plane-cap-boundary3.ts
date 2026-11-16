import {assertOwnedSewnNurbsPlaneSplitFaces3,sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitFaces3} from './sew-nurbs-plane-split-faces3.js';
import type {BRepEdgeUse3} from './brep-topology3.js';
import {planeFrame3,pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {point3,dot3,cross3} from './point3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Sewn=Extract<SewnNurbsPlaneSplitFaces3,{kind:'sewn'}>;
export interface NurbsPlaneCapBoundaryCertificate3 {
 readonly source:Sewn;
 /** The chart normal agrees with the cutting plane normal. */
 readonly frame:PlaneFrame3;
 /** Desired material-side cap normal relative to the chart normal.
  * Incidence does not certify the source shell has outward material orientation. */
 readonly sense:1|-1;
 /** Each loop reverses the existing open surface boundary. These are not yet
  * grouped into connected material faces or classified as outer/hole loops. */
 readonly loops:readonly (readonly BRepEdgeUse3[])[];
}
export type NurbsPlaneCapBoundary3=
 | Readonly<{kind:'certified';certificate:NurbsPlaneCapBoundaryCertificate3}>
 | Readonly<{kind:'unresolved';source:SewnNurbsPlaneSplitFaces3;reason:'face-sewing'|'side-required'|'open-parent'|'nonmanifold-boundary'|'non-section-boundary';edge?:number}>;
const owned=new WeakSet<NurbsPlaneCapBoundaryCertificate3>();
/** Derive cap-directed exact boundary curves. Whole-edge plane membership
 * follows from opposite signed face closures, or a coplanar source fragment;
 * it is never inferred from endpoint/sample plane tests. */
export function nurbsPlaneCapBoundary3(source:SewnNurbsPlaneSplitFaces3):NurbsPlaneCapBoundary3 {
 assertOwnedSewnNurbsPlaneSplitFaces3(source);
 const unresolved=(reason:Extract<NurbsPlaneCapBoundary3,{kind:'unresolved'}>['reason'],edge?:number):NurbsPlaneCapBoundary3=>Object.freeze({kind:'unresolved',source,reason,...(edge===undefined?{}:{edge})});
 if(source.kind!=='sewn')return unresolved('face-sewing');
 if(source.side===null)return unresolved('side-required');
 if(!source.source.topology.closedOrientedIncidence)return unresolved('open-parent');
 const T=source.topology;
 if(!T.consistentlyOriented||!T.manifoldVertices||T.boundaryLoops===null)return unresolved('nonmanifold-boundary');
 for(const e of T.edges)if(e.coedges.length===1){
  const c=e.curve;
  if(c.kind==='source'){
   if(c.source.topology.edges[c.edge]!.curve.sign!==0)return unresolved('non-section-boundary',T.coedges[e.coedges[0]!]!.edge);
  }else {
   const E=c.source.topology.edges[c.edge]!,coedges=E.coedges.map(id=>c.source.topology.coedges[id]!);
   // Every point of a cell boundary is in its cell's signed closure. A common
   // edge of + and - closures therefore lies in F=0 over its whole interval.
   if(coedges.length!==2||!coedges.some(h=>c.source.topology.faces[h.face]!.surface.sign===1)||!coedges.some(h=>c.source.topology.faces[h.face]!.surface.sign===-1))return unresolved('non-section-boundary',T.coedges[e.coedges[0]!]!.edge);
  }
 }
 const loops=Object.freeze(T.boundaryLoops.map(loop=>Object.freeze([...loop].reverse().map(id=>{const h=T.coedges[id]!;return Object.freeze({edge:h.edge,direction:(-h.direction) as 1|-1});}))));
 const {normal:n,offset}=source.source.plane,scale=offset.neg().div(dot3(n,n)),origin=point3(n.x.mul(scale),n.y.mul(scale),n.z.mul(scale));
 const axis=n.x.sign()!==0||n.y.sign()!==0?point3(0n,0n,1n):point3(1n,0n,0n),u=cross3(axis,n),v=cross3(n,u);
 const certificate=Object.freeze({source,frame:planeFrame3(origin,u,v),sense:(-source.side) as 1|-1,loops});owned.add(certificate);
 return Object.freeze({kind:'certified',certificate});
}
/** Evaluate a retained curve in the cap chart, with its original native
 * parameter. Loop orientation is recorded independently in the edge use. */
export function nurbsPlaneCapBoundaryPoint3(certificate:NurbsPlaneCapBoundaryCertificate3,edge:number,parameter:AlgebraicReal|ExactInput) {
 if(!owned.has(certificate))throw new RangeError('Expected factory-created plane cap boundary');
 if(!Number.isSafeInteger(edge)||!certificate.loops.some(loop=>loop.some(u=>u.edge===edge)))throw new RangeError('Expected cap boundary edge');
 const p=sewnNurbsPlaneSplitEdgePoint3(certificate.source.topology.edges[edge]!.curve,parameter),q=pointInPlaneFrame3(certificate.frame,p);
 if(q===null)throw new Error('Certified cap boundary left its plane');
 return q;
}
