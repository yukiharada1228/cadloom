import {adoptCappedNurbsBody3,materialOfCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {CappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import {materialOfNurbsBody3} from '../model/nurbs-body3.js';
import type {NurbsBody3} from '../model/nurbs-body3.js';
import type {CappedNurbsPlaneMaterialCertificate3} from '../geometry/capped-nurbs-plane-material3.js';
import {refineSewnNurbsSourceEdgesByPlane3} from '../geometry/sewn-nurbs-source-edge-plane3.js';
import {partitionNurbsSourceFaceByPlane3} from '../geometry/nurbs-source-plane-cells3.js';
import {buildNurbsSourcePlaneCellComplex3} from '../geometry/nurbs-source-plane-cell-complex3.js';
import {matchNurbsPlaneCellSourceEdges3} from '../geometry/nurbs-plane-cell-source-edges3.js';
import {nodeNurbsPlaneCellSourceEdges3} from '../geometry/nurbs-plane-cell-source-nodes3.js';
import {buildNurbsPlaneSplitFaces3} from '../geometry/nurbs-plane-split-faces3.js';
import {sewNurbsPlaneSplitFaces3} from '../geometry/sew-nurbs-plane-split-faces3.js';
import {nurbsPlaneCapBoundary3} from '../geometry/nurbs-plane-cap-boundary3.js';
import {analyzeNurbsPlaneCapContainment3} from '../geometry/nurbs-plane-cap-containment3.js';
import {capNurbsPlaneSplitFaces3} from '../geometry/cap-nurbs-plane-split-faces3.js';
import {certifyCappedNurbsPlaneEmbedding3} from '../geometry/capped-nurbs-plane-embedding3.js';
import {analyzeCappedNurbsPlaneContainment3} from '../geometry/capped-nurbs-plane-containment3.js';
import {certifyCappedNurbsPlaneMaterial3} from '../geometry/capped-nurbs-plane-material3.js';
import {plane3} from '../geometry/plane3.js';
import type {Plane3} from '../geometry/plane3.js';
import type {SewnNurbsParitySearchOptions3} from '../geometry/sewn-nurbs-source-parity-search3.js';
import {readCappedNurbsBodyDocument3} from '../record/capped-nurbs-body3.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {restoreNurbsBody3,transformNurbsBody3} from './nurbs-body3.js';
import {decodeRationalPoint3} from '../convert/exact3.js';
import {Rational} from '../numeric/rational.js';
import {assertOwnedSimilarityTransform3,transformVectorBySimilarity3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {dot3,point3} from '../geometry/point3.js';
export function bodyFromCappedNurbsMaterial3(material:CappedNurbsPlaneMaterialCertificate3):CappedNurbsBody3 {return adoptCappedNurbsBody3(material);}
/** Rebuild every geometric/material gate before publishing a cut Body. */
export function splitNurbsBodyByPlane3(body:NurbsBody3,input:Plane3,options:SewnNurbsParitySearchOptions3={}):Readonly<{plane:Plane3;negative:CappedNurbsBody3;positive:CappedNurbsBody3}> {
 const material=materialOfNurbsBody3(body),plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset);const {R,inputs}=prepareCut(material,plane);
 const child=(side:1|-1):CappedNurbsBody3=>finishCut(material,R,inputs,side,options);
 return Object.freeze({plane,negative:child(-1),positive:child(1)});
}
function prepareCut(material:ReturnType<typeof materialOfNurbsBody3>,plane:Plane3){
 const R=refineSewnNurbsSourceEdgesByPlane3(material.containment.embedding.source,plane),inputs=R.topology.faces.map((f,face)=>{
  const cells=buildNurbsSourcePlaneCellComplex3(partitionNurbsSourceFaceByPlane3(f.surface.source.complex,f.surface.face,plane));
  return buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(R,face,cells)));
 });return {R,inputs};
}
function finishCut(material:ReturnType<typeof materialOfNurbsBody3>,R:ReturnType<typeof refineSewnNurbsSourceEdgesByPlane3>,inputs:readonly ReturnType<typeof buildNurbsPlaneSplitFaces3>[],side:1|-1,options:SewnNurbsParitySearchOptions3):CappedNurbsBody3 {
 const faces=sewNurbsPlaneSplitFaces3(R,inputs,side),B=nurbsPlaneCapBoundary3(faces);if(B.kind!=='certified')throw new RangeError('NURBS plane cut boundary unresolved: '+B.reason);
 const C=analyzeNurbsPlaneCapContainment3(B.certificate,material,options);if(C.kind!=='analyzed')throw new RangeError('NURBS plane cut domains unresolved: '+C.reason);
 const capped=capNurbsPlaneSplitFaces3(C.certificate),E=certifyCappedNurbsPlaneEmbedding3(capped);if(E.kind!=='certified')throw new RangeError('NURBS plane cut embedding not certified: '+E.reason);
 const K=analyzeCappedNurbsPlaneContainment3(E.certificate,options);if(K.kind!=='analyzed')throw new RangeError('NURBS plane cut shell containment unresolved: '+K.reason);
 const M=certifyCappedNurbsPlaneMaterial3(K.certificate,options);if(M.kind!=='certified')throw new RangeError('NURBS plane cut material not certified: '+M.kind);
 return adoptCappedNurbsBody3(M.certificate);
}
/** Single-side reconstruction does not require the other side to certify. */
export function createCappedNurbsBody3(body:NurbsBody3,input:Plane3,side:1|-1,options:SewnNurbsParitySearchOptions3={}):CappedNurbsBody3 {
 if(side!==1&&side!==-1)throw new RangeError('Cut side must be +1 or -1');const material=materialOfNurbsBody3(body),plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset);const {R,inputs}=prepareCut(material,plane);
 return finishCut(material,R,inputs,side,options);
}
export function restoreCappedNurbsBody3(input:unknown,limits:RecordReadLimits3={}):CappedNurbsBody3 {const record=readCappedNurbsBodyDocument3(input,limits),normal=decodeRationalPoint3(record.plane.normal),plane=plane3(normal.x,normal.y,normal.z,record.plane.offset),parent=restoreNurbsBody3(record.parent,limits);return createCappedNurbsBody3(parent,plane,record.side);}
export function transformCappedNurbsBody3(body:CappedNurbsBody3,transform:SimilarityTransform3):CappedNurbsBody3 {
 materialOfCappedNurbsBody3(body);assertOwnedSimilarityTransform3(transform);const parent=transformNurbsBody3(restoreNurbsBody3(body.record.parent),transform),n=transformVectorBySimilarity3(transform,decodeRationalPoint3(body.record.plane.normal)),s=transform.scaleSquared,normal=point3(n.x.div(s),n.y.div(s),n.z.div(s)),offset=Rational.parse(body.record.plane.offset).sub(dot3(normal,transform.translation));return createCappedNurbsBody3(parent,plane3(normal.x,normal.y,normal.z,offset),body.record.side);
}
