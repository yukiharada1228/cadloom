import type {AlgebraicReal} from '../numeric/real-roots.js';
import {partitionValidatedNurbsDomainGraphEdge2} from './nurbs-domain-graph-edge2.js';
import {prepareNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {assertOwnedNurbsSectionArc3,restrictNurbsSectionArc3,nurbsSectionArcPoint3} from './nurbs-section-arc3.js';
import type {NurbsSectionArc3} from './nurbs-section-arc3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';

export interface NurbsSectionArcDomainPartition3 {
 readonly source:NurbsSectionArc3;readonly domain:PreparedNurbsParameterDomain2;
 /** Every closed endpoint/event, including isolated boundary-only contacts. */
 readonly vertices:readonly Readonly<{parameter:AlgebraicReal;u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;location:NurbsDomainLocation2}>[];
 /** Complete positive-width partition in traversal order. Location applies to
  * the OPEN interior; endpoints have their own classifications above. */
 readonly pieces:readonly Readonly<{arc:NurbsSectionArc3;location:NurbsDomainLocation2}>[];
}
/** Exact partition against validated rational NURBS parameter-space boundaries.
 * Ignores caller-provided locate/sample claims; this is not spatial embedding. */
export function partitionNurbsSectionArcByDomain3(arc:NurbsSectionArc3,input:PreparedNurbsParameterDomain2):NurbsSectionArcDomainPartition3 {
 assertOwnedNurbsSectionArc3(arc);return partitionValidatedNurbsSectionArcByDomain3(arc,prepareNurbsParameterDomain2(input.outer,input.holes,input.sense));
}
/** Internal batching path. Caller constructs the validated immutable domain;
 * this helper does not confer ownership or an embedding certificate. */
export function partitionValidatedNurbsSectionArcByDomain3(arc:NurbsSectionArc3,domain:PreparedNurbsParameterDomain2):NurbsSectionArcDomainPartition3 {
 assertOwnedNurbsSectionArc3(arc);const topology=arc.section.pieces[arc.piece]!.topology,partition=partitionValidatedNurbsDomainGraphEdge2(topology,arc.edge,arc.lower,arc.upper,domain);
 const vertices=partition.vertices.map(v=>Object.freeze({...v,point:nurbsSectionArcPoint3(arc,v.parameter)})),pieces=partition.pieces.map(p=>Object.freeze({arc:restrictNurbsSectionArc3(arc,p.lower,p.upper),location:p.location}));
 if(arc.direction===-1){vertices.reverse();pieces.reverse();}
 return Object.freeze({source:arc,domain,vertices:Object.freeze(vertices),pieces:Object.freeze(pieces)});
}
