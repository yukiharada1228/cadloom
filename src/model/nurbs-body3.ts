import type {Point3} from '../geometry/point3.js';
import {point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from '../geometry/sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from '../geometry/sewn-nurbs-source-material3.js';
import {locateSewnNurbsSourceMaterial3} from '../geometry/sewn-nurbs-source-material-query3.js';
import {nurbsSourceComplexFacePointPreimage3} from '../geometry/nurbs-source-complex-face-preimage3.js';
import {encodeNurbsSourceBRep3} from '../convert/nurbs-source-brep3.js';
import {readNurbsBodyDocument3} from '../record/nurbs-body3.js';
import type {NurbsBodyDocument3} from '../record/nurbs-body3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';
export interface NurbsBodyRegion3 {readonly shell:number;readonly cavities:readonly number[];readonly sample:Point3;}
export interface NurbsBody3 {
 readonly kind:'nurbs-body';readonly record:NurbsBodyDocument3;
 readonly topology:SewnNurbsSourceMaterialCertificate3['containment']['embedding']['source']['topology'];
 readonly faces:readonly SewnNurbsSourceMaterialCertificate3['containment']['embedding']['source']['topology']['faces'][number]['surface'][];
 readonly regions:readonly NurbsBodyRegion3[];readonly interiorSamples:readonly Point3[];
}
const sources=new WeakMap<NurbsBody3,SewnNurbsSourceMaterialCertificate3>();
export function isOwnedNurbsBody3(value:unknown):value is NurbsBody3 {return value!==null&&typeof value==='object'&&sources.has(value as NurbsBody3);}
export function materialOfNurbsBody3(body:NurbsBody3):SewnNurbsSourceMaterialCertificate3 {
 const source=sources.get(body);if(!source)throw new RangeError('Operation requires a factory-created NURBS Body');return source;
}
/** Internal publication: one checked material sample per even-depth region. */
export function adoptNurbsBody3(material:SewnNurbsSourceMaterialCertificate3,input:readonly Point3[]):NurbsBody3 {
 assertOwnedSewnNurbsSourceMaterial3(material);
 const source=material.containment.embedding.source,nodes=material.containment.shells.filter(s=>s.depth%2===0),samples=input.map(p=>point3(p.x,p.y,p.z));
 if(samples.length!==nodes.length)throw new RangeError('NURBS Body requires one sample per material region');
 const regions=Object.freeze(nodes.map((node,i)=>{
  const sample=samples[i]!,q=locateSewnNurbsSourceMaterial3(material,sample);
  if(q.kind!=='inside'||q.deepestShell!==node.shell)throw new RangeError('NURBS Body region sample is not in the claimed material region');
  return Object.freeze({shell:node.shell,cavities:Object.freeze(material.containment.shells.filter(s=>s.parent===node.shell).map(s=>s.shell)),sample});
 }));
 const record=readNurbsBodyDocument3({version:1,kind:'nurbs-body-document',sources:source.sources.map(encodeNurbsSourceBRep3)}),body=Object.freeze({kind:'nurbs-body' as const,record,topology:source.topology,faces:Object.freeze(source.topology.faces.map(f=>f.surface)),regions,interiorSamples:Object.freeze(samples)});
 sources.set(body,material);return body;
}
export function locateOwnedNurbsBody3(body:NurbsBody3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
 const q=locateSewnNurbsSourceMaterial3(materialOfNurbsBody3(body),point);
 if(q.kind==='unresolved')throw new RangeError('NURBS Body membership unresolved: '+q.reason);return q.kind;
}
export function locateOwnedNurbsBodyFace3(body:NurbsBody3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
 materialOfNurbsBody3(body);if(!Number.isSafeInteger(face)||face<0||face>=body.faces.length)throw new RangeError('Invalid Body face index');
 const f=body.faces[face]!,q=nurbsSourceComplexFacePointPreimage3(f.source.complex,f.face,point);
 if(q.kind==='unresolved')throw new RangeError('NURBS Body face membership unresolved');return q.kind==='point'?(q.stratum==='face'?'inside':'boundary'):'outside';
}
