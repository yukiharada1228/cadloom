import {adoptRecutNurbsBody3,materialOfRecutNurbsBody3} from '../model/recut-nurbs-body3.js';
import type {RecutNurbsBody3} from '../model/recut-nurbs-body3.js';
import {materialOfCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {CappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {NurbsRecutMaterialCertificate3} from '../geometry/nurbs-recut-material3.js';
import {refineSewnNurbsSourceEdgesByPlane3} from '../geometry/sewn-nurbs-source-edge-plane3.js';
import {partitionNurbsSplitFaceByPlane3} from '../geometry/nurbs-source-plane-cells3.js';
import {buildNurbsSourcePlaneCellComplex3} from '../geometry/nurbs-source-plane-cell-complex3.js';
import {matchNurbsPlaneCellSourceEdges3} from '../geometry/nurbs-plane-cell-source-edges3.js';
import {nodeNurbsPlaneCellSourceEdges3} from '../geometry/nurbs-plane-cell-source-nodes3.js';
import {buildNurbsPlaneSplitFaces3} from '../geometry/nurbs-plane-split-faces3.js';
import {sewNurbsRecutSourceFaces3} from '../geometry/sew-nurbs-plane-split-faces3.js';
import {splitNurbsPlaneCapBoundaries3} from '../geometry/nurbs-plane-cap-split-boundaries3.js';
import {buildNurbsCapSplitFaces3} from '../geometry/nurbs-plane-cap-split-faces3.js';
import {coverNurbsRecutSectionEdges3,alignNurbsRecutCapEdges3} from '../geometry/nurbs-recut-edge-coverage3.js';
import {joinNurbsRecutAssembly3} from '../geometry/nurbs-recut-face-join3.js';
import {certifyNurbsRecutAssemblyEmbedding3,analyzeNurbsRecutCapDomains3} from '../geometry/nurbs-recut-cap-domains3.js';
import {selectNurbsRecutHalfBoundary3,nurbsRecutHalfCapBoundary3} from '../geometry/nurbs-recut-half-boundary3.js';
import {capNurbsRecutHalf3} from '../geometry/cap-nurbs-recut-half3.js';
import {certifyNurbsRecutEmbedding3} from '../geometry/nurbs-recut-embedding3.js';
import {analyzeNurbsRecutContainment3} from '../geometry/nurbs-recut-containment3.js';
import {certifyNurbsRecutMaterial3} from '../geometry/nurbs-recut-material3.js';
import type {NurbsRecutParitySearchOptions3} from '../geometry/nurbs-recut-ray3.js';
import {plane3} from '../geometry/plane3.js';
import type {Plane3} from '../geometry/plane3.js';
import {readRecutNurbsBodyDocument3} from '../record/recut-nurbs-body3.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {restoreCappedNurbsBody3,transformCappedNurbsBody3} from './capped-nurbs-body3.js';
import {decodeRationalPoint3} from '../convert/exact3.js';
import {Rational} from '../numeric/rational.js';
import {assertOwnedSimilarityTransform3,transformVectorBySimilarity3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {dot3,point3} from '../geometry/point3.js';
export function bodyFromRecutNurbsMaterial3(material:NurbsRecutMaterialCertificate3):RecutNurbsBody3 {return adoptRecutNurbsBody3(material);}
function prepare(body:CappedNurbsBody3,input:Plane3,options:NurbsRecutParitySearchOptions3){
 const material=materialOfCappedNurbsBody3(body),old=material.containment.embedding.source,previous=old.source.boundary.source,plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),faceOptions={maxDirections:options.maxFaceDirections??16};
 if(!Number.isSafeInteger(faceOptions.maxDirections)||faceOptions.maxDirections<1)throw new RangeError('maxFaceDirections must be a positive safe integer');
 const rayBudget=options.maxDirections??128;if(!Number.isSafeInteger(rayBudget)||rayBudget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const R=refineSewnNurbsSourceEdgesByPlane3(previous.source.source,plane),inputs=previous.topology.faces.map(f=>{
  const cells=buildNurbsSourcePlaneCellComplex3(partitionNurbsSplitFaceByPlane3(f.surface,plane));
  return buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(R,f.surface.sourceFace,cells)));
 });
 const source=sewNurbsRecutSourceFaces3(previous,R,inputs);
 const reports=old.capFaces.map(face=>{const s=old.topology.faces[face]!.surface;if(s.kind!=='cap')throw new Error('Previous cap map changed family');return splitNurbsPlaneCapBoundaries3(s,plane,faceOptions);}),caps=reports.map(r=>buildNurbsCapSplitFaces3(r,null,faceOptions));
 const alignments=inputs.map(b=>{if(b.kind!=='built')throw new RangeError('Recut source adoption unresolved: '+b.reason);const c=coverNurbsRecutSectionEdges3(previous,b.source.source.vertices.cells);if(c.kind!=='covered')throw new RangeError('Recut old-interface coverage unresolved: '+c.reason);const a=alignNurbsRecutCapEdges3(c.certificate,reports);if(a.kind!=='aligned')throw new RangeError('Recut cap alignment unresolved: '+a.reason);return a.certificate;});
 const joined=joinNurbsRecutAssembly3(source,alignments,caps),embedding=certifyNurbsRecutAssemblyEmbedding3(joined,material.containment.embedding);
 if(embedding.kind!=='certified')throw new RangeError('Recut old-boundary embedding unresolved: '+embedding.reason);
 return {joined,embedding:embedding.certificate,plane,faceOptions};
}
function finish(p:ReturnType<typeof prepare>,side:1|-1,options:NurbsRecutParitySearchOptions3):RecutNurbsBody3 {
 const half=selectNurbsRecutHalfBoundary3(p.joined,side);if(half.kind!=='selected')throw new RangeError('Recut half selection unresolved: '+half.reason);
 const domains=analyzeNurbsRecutCapDomains3(nurbsRecutHalfCapBoundary3(half),p.embedding,p.faceOptions);if(domains.kind!=='analyzed')throw new RangeError('Recut new-cap domains unresolved: '+domains.reason);
 const E=certifyNurbsRecutEmbedding3(capNurbsRecutHalf3(domains.certificate),p.faceOptions);if(E.kind!=='certified')throw new RangeError('Recut boundary embedding not certified: '+E.reason);
 const C=analyzeNurbsRecutContainment3(E.certificate,options);if(C.kind!=='analyzed')throw new RangeError('Recut shell containment unresolved: '+C.reason);
 const M=certifyNurbsRecutMaterial3(C.certificate,options);if(M.kind!=='certified')throw new RangeError('Recut material not certified: '+M.kind);
 return adoptRecutNurbsBody3(M.certificate);
}
export function createRecutNurbsBody3(body:CappedNurbsBody3,input:Plane3,side:1|-1,options:NurbsRecutParitySearchOptions3={}):RecutNurbsBody3 {if(side!==1&&side!==-1)throw new RangeError('Cut side must be +1 or -1');return finish(prepare(body,input,options),side,options);}
export function splitCappedNurbsBodyByPlane3(body:CappedNurbsBody3,input:Plane3,options:NurbsRecutParitySearchOptions3={}):Readonly<{plane:Plane3;negative:RecutNurbsBody3;positive:RecutNurbsBody3}> {const p=prepare(body,input,options);return Object.freeze({plane:p.plane,negative:finish(p,-1,options),positive:finish(p,1,options)});}
/** Nested source recipes are bounded by one reader, then every gate is replayed. */
export function restoreRecutNurbsBody3(input:unknown,limits:RecordReadLimits3={}):RecutNurbsBody3 {const record=readRecutNurbsBodyDocument3(input,limits),normal=decodeRationalPoint3(record.plane.normal),plane=plane3(normal.x,normal.y,normal.z,record.plane.offset),parent=restoreCappedNurbsBody3(record.parent,limits);return createRecutNurbsBody3(parent,plane,record.side);}
export function transformRecutNurbsBody3(body:RecutNurbsBody3,transform:SimilarityTransform3):RecutNurbsBody3 {
 materialOfRecutNurbsBody3(body);assertOwnedSimilarityTransform3(transform);const parent=transformCappedNurbsBody3(restoreCappedNurbsBody3(body.record.parent),transform),v=transformVectorBySimilarity3(transform,decodeRationalPoint3(body.record.plane.normal)),s=transform.scaleSquared,normal=point3(v.x.div(s),v.y.div(s),v.z.div(s)),offset=Rational.parse(body.record.plane.offset).sub(dot3(normal,transform.translation));return createRecutNurbsBody3(parent,plane3(normal.x,normal.y,normal.z,offset),body.record.side);
}
