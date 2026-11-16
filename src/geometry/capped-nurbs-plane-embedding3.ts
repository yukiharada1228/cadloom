import {assertOwnedCappedNurbsPlaneSplitFaces3} from './cap-nurbs-plane-split-faces3.js';
import type {CappedNurbsPlaneSplitFaces3} from './cap-nurbs-plane-split-faces3.js';
import {intersectSewnNurbsSourceBoundaryPlane3} from './sewn-nurbs-source-boundary-plane3.js';
import {certifyNurbsBoundaryPlaneWires3} from './nurbs-plane-wires3.js';
import type {NurbsPlaneWiresCertificate3,NurbsPlaneWires3} from './nurbs-plane-wires3.js';
export interface CappedNurbsPlaneEmbeddingCertificate3 {
 readonly source:Extract<CappedNurbsPlaneSplitFaces3,{kind:'closed'}>;
 readonly method:'empty'|'transverse-halfspace';
 readonly section:NurbsPlaneWiresCertificate3|null;
}
export type CappedNurbsPlaneEmbedding3=
 | Readonly<{kind:'certified';certificate:CappedNurbsPlaneEmbeddingCertificate3}>
 | Readonly<{kind:'not-certified';source:CappedNurbsPlaneSplitFaces3;reason:'unresolved-capping'|'section-transversality';section?:NurbsPlaneWires3}>;
const owned=new WeakSet<CappedNurbsPlaneEmbeddingCertificate3>();
export function assertOwnedCappedNurbsPlaneEmbedding3(c:CappedNurbsPlaneEmbeddingCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created capped NURBS embedding certificate');}
/** Sufficient inherited embedding certificate. Transverse finite sections
 * exclude hidden source/cap tangent contacts; unsupported degeneracies retain
 * their complete section report instead of being certified by incidence. */
export function certifyCappedNurbsPlaneEmbedding3(source:CappedNurbsPlaneSplitFaces3):CappedNurbsPlaneEmbedding3 {
 assertOwnedCappedNurbsPlaneSplitFaces3(source);
 if(source.kind!=='closed')return Object.freeze({kind:'not-certified',source,reason:'unresolved-capping'});
 if(source.topology.faces.length===0){const certificate=Object.freeze({source,method:'empty' as const,section:null});owned.add(certificate);return Object.freeze({kind:'certified',certificate});}
 const K=source.source,plane=K.boundary.source.source.plane,section=certifyNurbsBoundaryPlaneWires3(intersectSewnNurbsSourceBoundaryPlane3(K.material,plane));
 if(section.kind!=='certified')return Object.freeze({kind:'not-certified',source,reason:'section-transversality',section});
 // Source-source contacts inherit the same globally embedded material. Its
 // complete transverse zero loci are the noded split boundaries; finite cap
 // domains are the owned disjoint outer/hole groups. Thus cap/source meetings
 // lie on the declared shared boundary, and cap interiors do not intersect.
 const certificate=Object.freeze({source,method:'transverse-halfspace' as const,section:section.certificate});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
