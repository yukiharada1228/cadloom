import {adoptNurbsBody3,materialOfNurbsBody3} from '../model/nurbs-body3.js';
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
import {assertOwnedSimilarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {dot3,cross3,point3} from '../geometry/point3.js';
import {Rational} from '../numeric/rational.js';
import {decodeRationalPoint3,encodeRationalPoint3} from '../convert/exact3.js';
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
 const document=readNurbsBodyDocument3(input,limits),source=sewNurbsSourceBReps3(document.sources.map(s=>decodeNurbsSourceBRep3(s,limits))),embedding=certifySewnNurbsSourceEmbedding3(source,(document.separators??[]).map(p=>({first:p.first,second:p.second,normal:decodeRationalPoint3(p.normal),offset:Rational.parse(p.offset)})));
 if(embedding.kind!=='certified')throw new RangeError('NURBS Body embedding not certified: '+embedding.reason);
 const containment=analyzeSewnNurbsSourceContainment3(embedding.certificate);if(containment.kind!=='analyzed')throw new RangeError('NURBS Body containment unresolved: '+containment.reason);
 const material=certifySewnNurbsSourceMaterial3(containment.certificate);if(material.kind!=='certified')throw new RangeError('NURBS Body material not certified: '+material.kind);
 return bodyFromNurbsMaterial3(material.certificate);
}
/** Transform both SSI construction supports; UV trim data stays in parameter
 * space. Reflection reverses face sense to preserve the material orientation. */
export function transformNurbsBody3(body:NurbsBody3,transform:SimilarityTransform3):NurbsBody3 {
 const material=materialOfNurbsBody3(body);assertOwnedSimilarityTransform3(transform);
 const [a,b,c]=transform.columns,orientation=dot3(a,cross3(b,c)).sign();
 if(orientation===0)throw new Error('Owned similarity became singular');
 const surface=(s:NurbsBody3['record']['sources'][number]['source'])=>({...s,points:s.points.map(row=>row.map(p=>encodeRationalPoint3(transformPointBySimilarity3(transform,decodeRationalPoint3(p)))))});
 const separators=material.containment.embedding.separations.map(p=>{
  const v=transformVectorBySimilarity3(transform,p.normal),s=transform.scaleSquared,normal=point3(v.x.div(s),v.y.div(s),v.z.div(s));
  return {first:p.first,second:p.second,normal:encodeRationalPoint3(normal),offset:p.offset.add(dot3(normal,transform.translation)).toString()};
 });
 return restoreNurbsBody3({...body.record,separators,sources:body.record.sources.map(s=>({...s,source:surface(s.source),target:surface(s.target),sense:s.sense*orientation}))});
}
