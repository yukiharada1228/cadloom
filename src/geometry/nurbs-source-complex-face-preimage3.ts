import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import type {NurbsSourceComplexFacePoint3} from './nurbs-source-complex-face-query3.js';
import {nurbsAffineProjectionParameters3} from './nurbs-affine-projection3.js';
import {nurbsSurfaceRectanglePointPreimages3} from './nurbs-surface-preimage3.js';
export type NurbsSourceComplexFacePreimage3=
 | Extract<NurbsSourceComplexFacePoint3,{kind:'point'|'unresolved'}>
 | Readonly<{kind:'outside';face:number;point:AlgebraicCoordinates3}>;
/** Exact inverse membership of one certified finite face. Every algebraic
 * candidate is checked against the requested face side and full XYZ value. */
export function nurbsSourceComplexFacePointPreimage3(complex:NurbsSourceFaceComplex3,face:number,input:Point3|AlgebraicCoordinates3):NurbsSourceComplexFacePreimage3 {
 assertOwnedNurbsSourceFaceComplex3(complex);if(complex.kind!=='prepared')return Object.freeze({kind:'unresolved',reason:'unprepared-complex'});
 if(!Number.isSafeInteger(face)||!complex.faces.some(f=>f.face===face))throw new RangeError('Invalid prepared source face');
 const point=snapshotExactPoint3(input),proof=complex.embedding.faces.find(f=>f.face===face);if(!proof||proof.kind!=='certified')throw new Error('Prepared face lost embedding certificate');
 const matches:Extract<NurbsSourceComplexFacePoint3,{kind:'point'}>[]=[],accept=(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput)=>{
  const q=evaluateNurbsSourceComplexFace3(complex,face,u,v);if(q.kind==='unresolved')return q;
  if(q.kind==='point'&&compareAlgebraicPoints3(q.point,point)===0&&!matches.some(a=>a.u.compare(q.u)===0&&a.v.compare(q.v)===0))matches.push(q);return null;
 };
 if(proof.method==='affine'){const q=nurbsAffineProjectionParameters3(proof.certificate,point),unknown=accept(q.u,q.v);if(unknown)return unknown;}
 else {
  const report=nurbsSurfaceRectanglePointPreimages3(proof.certificate.surface,proof.certificate.bounds,point);
  for(const p of report.patches){if(p.wholePatch||p.locusEdges.length)throw new Error('Certified embedding has a nonfinite point fiber');
   for(const q of [...p.points,...p.locusVertices.map(id=>p.locus!.vertices[id]!)]){const unknown=accept(q.u,q.v);if(unknown)return unknown;}
  }
 }
 if(matches.length>1)throw new Error('Certified face has multiple distinct parameter preimages');return matches[0]??Object.freeze({kind:'outside',face,point});
}
