import {adoptNurbsBody3} from '../model/nurbs-body3.js';
import type {NurbsBody3} from '../model/nurbs-body3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from '../geometry/sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from '../geometry/sewn-nurbs-source-material3.js';
import {intersectSewnNurbsSourceMaterialLine3} from '../geometry/sewn-nurbs-source-material-line3.js';
import {locateSewnNurbsSourceMaterial3} from '../geometry/sewn-nurbs-source-material-query3.js';
import {readNurbsBodyDocument3} from '../record/nurbs-body3.js';
import {decodeNurbsSourceBRep3} from '../convert/nurbs-source-brep3.js';
import {sewNurbsSourceBReps3} from '../geometry/sew-nurbs-source-breps3.js';
import {certifySewnNurbsSourceEmbedding3} from '../geometry/sewn-nurbs-source-embedding3.js';
import {analyzeSewnNurbsSourceContainment3} from '../geometry/sewn-nurbs-source-containment3.js';
import {certifySewnNurbsSourceMaterial3} from '../geometry/sewn-nurbs-source-material3.js';
import type {RecordReadLimits3} from '../record/schema.js';
/** Adopt only a geometrically certified material, never arbitrary incidence. */
export function bodyFromNurbsMaterial3(material:SewnNurbsSourceMaterialCertificate3):NurbsBody3 {
 assertOwnedSewnNurbsSourceMaterial3(material);
 const samples=material.containment.shells.filter(n=>n.depth%2===0).map(node=>{
  const orientation=material.orientations.find(o=>o.shell===node.shell)!;
  const scan=intersectSewnNurbsSourceMaterialLine3(material,orientation.ray.line);
  if(scan.kind==='unresolved')throw new RangeError('NURBS Body region scan unresolved: '+scan.reason);
  for(const interval of scan.intervals)for(const span of interval.spans)if(span.location==='inside'){
   const q=locateSewnNurbsSourceMaterial3(material,span.sample);if(q.kind==='inside'&&q.deepestShell===node.shell)return span.sample;
  }
  throw new RangeError('NURBS Body could not certify a material-region sample');
 });
 return adoptNurbsBody3(material,samples);
}
/** Every geometric certificate, shared incidence and material role is replayed. */
export function restoreNurbsBody3(input:unknown,limits:RecordReadLimits3={}):NurbsBody3 {
 const document=readNurbsBodyDocument3(input,limits),source=sewNurbsSourceBReps3(document.sources.map(s=>decodeNurbsSourceBRep3(s,limits))),embedding=certifySewnNurbsSourceEmbedding3(source);
 if(embedding.kind!=='certified')throw new RangeError('NURBS Body embedding not certified: '+embedding.reason);
 const containment=analyzeSewnNurbsSourceContainment3(embedding.certificate);if(containment.kind!=='analyzed')throw new RangeError('NURBS Body containment unresolved: '+containment.reason);
 const material=certifySewnNurbsSourceMaterial3(containment.certificate);if(material.kind!=='certified')throw new RangeError('NURBS Body material not certified: '+material.kind);
 return bodyFromNurbsMaterial3(material.certificate);
}
