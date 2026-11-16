import {assertOwnedCappedNurbsPlaneSplitFaces3} from './cap-nurbs-plane-split-faces3.js';
import type {CappedNurbsPlaneSplitFaces3} from './cap-nurbs-plane-split-faces3.js';
import {locateNurbsPlaneSplitFace3} from './nurbs-plane-split-face-query3.js';
import {locateNurbsPlaneCapFace3} from './nurbs-plane-cap-face-query3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {locateSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsMaterialLocation3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
type Closed=Extract<CappedNurbsPlaneSplitFaces3,{kind:'closed'}>;
export type CappedNurbsPlaneFaceLocation3=
 | Readonly<{kind:'located';source:Closed;face:number;point:AlgebraicCoordinates3;location:'inside'|'outside'|'boundary'}>
 | Readonly<{kind:'unresolved';source:Closed;face:number;point:AlgebraicCoordinates3;reason:'source-face'|'cap-face'}>;
function requireClosed(source:CappedNurbsPlaneSplitFaces3):asserts source is Closed {assertOwnedCappedNurbsPlaneSplitFaces3(source);if(source.kind!=='closed')throw new RangeError('Expected closed capped incidence');}
export function locateCappedNurbsPlaneFace3(source:CappedNurbsPlaneSplitFaces3,face:number,input:Point3|AlgebraicCoordinates3,options:Readonly<{maxDirections?:number}>={}):CappedNurbsPlaneFaceLocation3 {
 requireClosed(source);if(!Number.isSafeInteger(face)||face<0||face>=source.topology.faces.length)throw new RangeError('Invalid capped face');
 const point=snapshotExactPoint3(input),s=source.topology.faces[face]!.surface,located=(location:'inside'|'outside'|'boundary'):CappedNurbsPlaneFaceLocation3=>Object.freeze({kind:'located',source,face,point,location});
 if(s.kind==='source'){const q=locateNurbsPlaneSplitFace3(s.source,point);return q.kind==='located'?located(q.location):Object.freeze({kind:'unresolved',source,face,point,reason:'source-face'});}
 const uv=pointInPlaneFrame3(s.source.boundary.frame,point);if(uv===null)return located('outside');
 const q=locateNurbsPlaneCapFace3(s,uv,options);return q.kind==='located'?located(q.location):Object.freeze({kind:'unresolved',source,face,point,reason:'cap-face'});
}
export type CappedNurbsPlaneMaterialLocation3=
 | Readonly<{kind:'boundary';source:Closed;point:AlgebraicCoordinates3;faces:readonly number[];shells:readonly number[]}>
 | Readonly<{kind:'inside'|'outside';source:Closed;point:AlgebraicCoordinates3;planeSide:-1|0|1;original?:SewnNurbsMaterialLocation3}>
 | Readonly<{kind:'unresolved';source:Closed;point:AlgebraicCoordinates3;reason:'boundary-face'|'source-material'|'missing-retained-boundary'|'missing-cap-domain';face?:number;original?:SewnNurbsMaterialLocation3}>;
/** Membership of the regularized source-material halfspace selection. Boundary
 * faces are queried first: opposite-side tangential contacts are not blindly
 * inherited from the original boundary. No new Body certificate is issued. */
export function locateCappedNurbsPlaneMaterial3(source:CappedNurbsPlaneSplitFaces3,input:Point3|AlgebraicCoordinates3,options:SewnNurbsParitySearchOptions3={}):CappedNurbsPlaneMaterialLocation3 {
 requireClosed(source);const point=snapshotExactPoint3(input),B=source.source.boundary,P=B.source.source.plane,n=P.normal,planeSide=AlgebraicReal.linearCombination([{value:point.x,coefficient:n.x},{value:point.y,coefficient:n.y},{value:point.z,coefficient:n.z}],P.offset).sign();
 const located=(kind:'inside'|'outside',original?:SewnNurbsMaterialLocation3):CappedNurbsPlaneMaterialLocation3=>Object.freeze({kind,source,point,planeSide,...(original===undefined?{}:{original})});
 if(planeSide!==0&&planeSide!==B.source.side)return located('outside');
 const faces:number[]=[],shells=new Set<number>();
 for(let face=0;face<source.topology.faces.length;face++){const q=locateCappedNurbsPlaneFace3(source,face,point,options);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',source,point,reason:'boundary-face',face});if(q.location!=='outside'){faces.push(face);shells.add(source.topology.faces[face]!.shell);}}
 if(faces.length)return Object.freeze({kind:'boundary',source,point,faces:Object.freeze(faces),shells:Object.freeze([...shells])});
 const original=locateSewnNurbsSourceMaterial3(source.source.material,point,options);
 if(original.kind==='unresolved')return Object.freeze({kind:'unresolved',source,point,reason:'source-material',original});
 if(planeSide===0){if(original.kind==='inside')return Object.freeze({kind:'unresolved',source,point,reason:'missing-cap-domain',original});return located('outside',original);}
 if(original.kind==='boundary')return Object.freeze({kind:'unresolved',source,point,reason:'missing-retained-boundary',original});
 return located(original.kind,original);
}
