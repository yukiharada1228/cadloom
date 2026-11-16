import {assertOwnedCappedNurbsPlaneMaterial3} from '../geometry/capped-nurbs-plane-material3.js';
import type {CappedNurbsPlaneMaterialCertificate3} from '../geometry/capped-nurbs-plane-material3.js';
import {locateCappedNurbsPlaneMaterial3,locateCappedNurbsPlaneFace3} from '../geometry/capped-nurbs-plane-query3.js';
import type {Point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';
import {encodeNurbsSourceBRep3} from '../convert/nurbs-source-brep3.js';
import {encodeRationalPoint3} from '../convert/exact3.js';
import {readCappedNurbsBodyDocument3} from '../record/capped-nurbs-body3.js';
import type {CappedNurbsBodyDocument3} from '../record/capped-nurbs-body3.js';
export interface CappedNurbsBody3 {
 readonly kind:'capped-nurbs-body';readonly record:CappedNurbsBodyDocument3;
 readonly topology:CappedNurbsPlaneMaterialCertificate3['containment']['embedding']['source']['topology'];
 readonly faces:readonly CappedNurbsBody3['topology']['faces'][number]['surface'][];
 readonly regions:readonly Readonly<{shell:number;cavities:readonly number[];sample:Point3}>[];
 readonly interiorSamples:readonly Point3[];
}
const materials=new WeakMap<CappedNurbsBody3,CappedNurbsPlaneMaterialCertificate3>();
export function isOwnedCappedNurbsBody3(value:unknown):value is CappedNurbsBody3 {return value!==null&&typeof value==='object'&&materials.has(value as CappedNurbsBody3);}
export function materialOfCappedNurbsBody3(body:CappedNurbsBody3):CappedNurbsPlaneMaterialCertificate3 {const material=materials.get(body);if(!material)throw new RangeError('Operation requires a factory-created capped NURBS Body');return material;}
/** Adopt certified regions and source-only replay data, never arbitrary BRep. */
export function adoptCappedNurbsBody3(material:CappedNurbsPlaneMaterialCertificate3):CappedNurbsBody3 {
 assertOwnedCappedNurbsPlaneMaterial3(material);const source=material.containment.embedding.source,K=source.source,old=K.material,raw=old.containment.embedding.source,P=K.boundary.source.source.plane,side=K.boundary.source.side;if(side!==1&&side!==-1)throw new Error('Capped material lost selected side');
 const record=readCappedNurbsBodyDocument3({version:1,kind:'capped-nurbs-body-document',parent:{version:1,kind:'nurbs-body-document',sources:raw.sources.map(encodeNurbsSourceBRep3),separators:old.containment.embedding.separations.map(p=>({first:p.first,second:p.second,normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()}))},plane:{normal:encodeRationalPoint3(P.normal),offset:P.offset.toString()},side}),regions=Object.freeze(material.regions.map(r=>Object.freeze({shell:r.shell,cavities:r.cavities,sample:r.sample}))),body=Object.freeze({kind:'capped-nurbs-body' as const,record,topology:source.topology,faces:Object.freeze(source.topology.faces.map(f=>f.surface)),regions,interiorSamples:Object.freeze(regions.map(r=>r.sample))});
 materials.set(body,material);return body;
}
export function locateOwnedCappedNurbsBody3(body:CappedNurbsBody3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {const source=materialOfCappedNurbsBody3(body).containment.embedding.source,q=locateCappedNurbsPlaneMaterial3(source,point);if(q.kind==='unresolved')throw new RangeError('Capped NURBS Body membership unresolved: '+q.reason);return q.kind;}
export function locateOwnedCappedNurbsBodyFace3(body:CappedNurbsBody3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {const q=locateCappedNurbsPlaneFace3(materialOfCappedNurbsBody3(body).containment.embedding.source,face,point);if(q.kind==='unresolved')throw new RangeError('Capped NURBS Body face membership unresolved: '+q.reason);return q.location;}
