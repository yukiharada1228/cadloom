import {assertOwnedNurbsRecutMaterial3} from '../geometry/nurbs-recut-material3.js';
import type {NurbsRecutMaterialCertificate3} from '../geometry/nurbs-recut-material3.js';
import {locateNurbsRecutMaterial3} from '../geometry/nurbs-recut-material-query3.js';
import {locateNurbsRecutClosedSurface3} from '../geometry/cap-nurbs-recut-half3.js';
import type {Point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';
import {encodeNurbsSourceBRep3} from '../convert/nurbs-source-brep3.js';
import {encodeRationalPoint3} from '../convert/exact3.js';
import {readRecutNurbsBodyDocument3} from '../record/recut-nurbs-body3.js';
import type {RecutNurbsBodyDocument3} from '../record/recut-nurbs-body3.js';
export interface RecutNurbsBody3 {
 readonly kind:'recut-nurbs-body';readonly record:RecutNurbsBodyDocument3;
 readonly topology:NurbsRecutMaterialCertificate3['containment']['embedding']['source']['topology'];
 readonly faces:readonly RecutNurbsBody3['topology']['faces'][number]['surface'][];
 readonly regions:readonly Readonly<{shell:number;cavities:readonly number[];sample:Point3}>[];
 readonly interiorSamples:readonly Point3[];
}
const materials=new WeakMap<RecutNurbsBody3,NurbsRecutMaterialCertificate3>();
export function isOwnedRecutNurbsBody3(value:unknown):value is RecutNurbsBody3 {return value!==null&&typeof value==='object'&&materials.has(value as RecutNurbsBody3);}
export function materialOfRecutNurbsBody3(body:RecutNurbsBody3):NurbsRecutMaterialCertificate3 {const material=materials.get(body);if(!material)throw new RangeError('Operation requires a factory-created recut NURBS Body');return material;}
export function adoptRecutNurbsBody3(material:NurbsRecutMaterialCertificate3):RecutNurbsBody3 {
 assertOwnedNurbsRecutMaterial3(material);const embedding=material.containment.embedding,source=embedding.source,K=embedding.inherited.previous.source.source,old=K.material,raw=old.containment.embedding.source,P=K.boundary.source.source.plane,side=K.boundary.source.side,N=source.source.boundary.source;
 if(side!==1&&side!==-1)throw new Error('Recut material lost previous selected side');
 const record=readRecutNurbsBodyDocument3({version:1,kind:'recut-nurbs-body-document',parent:{version:1,kind:'capped-nurbs-body-document',parent:{version:1,kind:'nurbs-body-document',sources:raw.sources.map(encodeNurbsSourceBRep3),separators:old.containment.embedding.separations.map(p=>({first:p.first,second:p.second,normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()}))},plane:{normal:encodeRationalPoint3(P.normal),offset:P.offset.toString()},side},plane:{normal:encodeRationalPoint3(N.plane.normal),offset:N.plane.offset.toString()},side:N.side});
 const regions=Object.freeze(material.regions.map(r=>Object.freeze({shell:r.shell,cavities:r.cavities,sample:r.sample}))),body=Object.freeze({kind:'recut-nurbs-body' as const,record,topology:source.topology,faces:Object.freeze(source.topology.faces.map(f=>f.surface)),regions,interiorSamples:Object.freeze(regions.map(r=>r.sample))});
 materials.set(body,material);return body;
}
export function locateOwnedRecutNurbsBody3(body:RecutNurbsBody3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {const q=locateNurbsRecutMaterial3(materialOfRecutNurbsBody3(body).containment.embedding,point);if(q.kind==='unresolved')throw new RangeError('Recut NURBS Body membership unresolved: '+q.reason);return q.kind;}
export function locateOwnedRecutNurbsBodyFace3(body:RecutNurbsBody3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {const source=materialOfRecutNurbsBody3(body).containment.embedding.source;if(!Number.isSafeInteger(face)||face<0||face>=source.topology.faces.length)throw new RangeError('Invalid recut Body face index');const q=locateNurbsRecutClosedSurface3(source.topology.faces[face]!.surface,point);if(q.kind==='unresolved')throw new RangeError('Recut NURBS Body face membership unresolved');return q.location;}
