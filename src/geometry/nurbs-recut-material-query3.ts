import {assertOwnedNurbsRecutEmbedding3} from './nurbs-recut-embedding3.js';
import type {NurbsRecutEmbeddingCertificate3} from './nurbs-recut-embedding3.js';
import {locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import {locateSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsMaterialLocation3} from './sewn-nurbs-source-material-query3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import type {Plane3} from './plane3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {NurbsRecutParitySearchOptions3} from './nurbs-recut-ray3.js';
export type NurbsRecutMaterialLocation3=
 | Readonly<{kind:'boundary';embedding:NurbsRecutEmbeddingCertificate3;point:AlgebraicCoordinates3;faces:readonly number[];shells:readonly number[]}>
 | Readonly<{kind:'inside'|'outside';embedding:NurbsRecutEmbeddingCertificate3;point:AlgebraicCoordinates3;planeSides:readonly [-1|0|1,-1|0|1];original?:SewnNurbsMaterialLocation3}>
 | Readonly<{kind:'unresolved';embedding:NurbsRecutEmbeddingCertificate3;point:AlgebraicCoordinates3;reason:'boundary-face'|'source-material'|'missing-retained-boundary'|'missing-cap-domain';face?:number;original?:SewnNurbsMaterialLocation3}>;
/** Exact membership of the regularized intersection of source material and
 * both owned selected halfspaces. Actual finite boundary faces are queried
 * before source-boundary inheritance; discarded tangent remnants stay outside.
 * The original material's rational witness concerns the original material only,
 * while clipping signs always use the requested exact point. */
export function locateNurbsRecutMaterial3(embedding:NurbsRecutEmbeddingCertificate3,input:Point3|AlgebraicCoordinates3,options:NurbsRecutParitySearchOptions3={}):NurbsRecutMaterialLocation3 {
 assertOwnedNurbsRecutEmbedding3(embedding);
 const faceBudget=options.maxFaceDirections??16,rayBudget=options.maxDirections??128;
 if(!Number.isSafeInteger(faceBudget)||faceBudget<1)throw new RangeError('maxFaceDirections must be a positive safe integer');
 if(!Number.isSafeInteger(rayBudget)||rayBudget<1)throw new RangeError('maxDirections must be a positive safe integer');
 const point=snapshotExactPoint3(input),source=embedding.source,K=embedding.inherited.previous.source.source,previous=K.boundary.source,next=source.source.boundary.source;
 if(previous.side!==1&&previous.side!==-1)throw new Error('Recut material lost the previous selected side');
 const sign=(P:Plane3)=>AlgebraicReal.linearCombination([{value:point.x,coefficient:P.normal.x},{value:point.y,coefficient:P.normal.y},{value:point.z,coefficient:P.normal.z}],P.offset).sign(),planeSides=Object.freeze([sign(previous.source.plane),sign(next.plane)] as const);
 const located=(kind:'inside'|'outside',original?:SewnNurbsMaterialLocation3):NurbsRecutMaterialLocation3=>Object.freeze({kind,embedding,point,planeSides,...(original===undefined?{}:{original})});
 if((planeSides[0]!==0&&planeSides[0]!==previous.side)||(planeSides[1]!==0&&planeSides[1]!==next.side))return located('outside');
 const faces:number[]=[],shells=new Set<number>();
 for(let face=0;face<source.topology.faces.length;face++){const q=locateNurbsRecutClosedSurface3(source.topology.faces[face]!.surface,point,{maxDirections:faceBudget});if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',embedding,point,reason:'boundary-face',face});if(q.location!=='outside'){faces.push(face);shells.add(source.topology.faces[face]!.shell);}}
 if(faces.length)return Object.freeze({kind:'boundary',embedding,point,faces:Object.freeze(faces),shells:Object.freeze([...shells])});
 const original=locateSewnNurbsSourceMaterial3(K.material,point,options);
 if(original.kind==='unresolved')return Object.freeze({kind:'unresolved',embedding,point,reason:'source-material',original});
 if(planeSides.includes(0)){if(original.kind==='inside')return Object.freeze({kind:'unresolved',embedding,point,reason:'missing-cap-domain',original});return located('outside',original);}
 if(original.kind==='boundary')return Object.freeze({kind:'unresolved',embedding,point,reason:'missing-retained-boundary',original});
 return located(original.kind,original);
}
