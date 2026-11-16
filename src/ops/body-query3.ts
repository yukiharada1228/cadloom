import {isOwnedCellularBody3,locateCellularBody3} from './cellular-body3.js';
import type {CellularBody3} from './cellular-body3.js';
import {cellularBoundaryAsBodyRecord3} from '../record/cellular-body3.js';
import {assertOwnedBody3,locateBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {restoreMixedBRepFaces3} from '../convert/mixed-faces3.js';
import type {MixedBRepFaces3} from '../convert/mixed-faces3.js';
import {intersectMixedBoundaryLine3,intersectMixedBoundaryRay3} from '../geometry/mixed-shell-ray3.js';
import {line3} from '../geometry/surface3.js';
import {point3} from '../geometry/point3.js';
import {Rational} from '../numeric/rational.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {MixedBoundaryRayHit3,MixedBoundaryRay3} from '../geometry/mixed-shell-ray3.js';
import type {Point3,Vector3} from '../geometry/point3.js';
export type BodyBoundaryIntersection3=MixedBoundaryRay3;
export type BodyQuerySource3=Body3|CellularBody3;
function assertSource(body:BodyQuerySource3):void {if(!isOwnedCellularBody3(body))assertOwnedBody3(body as Body3);}
function locateSource(body:BodyQuerySource3,point:Point3){return isOwnedCellularBody3(body)?locateCellularBody3(body,point):locateBody3(body,point);}
const decodedFaces=new WeakMap<BodyQuerySource3,MixedBRepFaces3>();
function faces(body:BodyQuerySource3):MixedBRepFaces3 {
 assertSource(body);let result=decodedFaces.get(body);
 if(!result){result=restoreMixedBRepFaces3(isOwnedCellularBody3(body)?cellularBoundaryAsBodyRecord3(body.record.boundary):body.record);decodedFaces.set(body,result);}return result;
}
/** Exact boundary events for p(t)=origin+t*direction, including negative t.
 * Shared-edge/vertex hits and contained supports retain explicit degeneracy.
 * Shell selection uses the owned Body's shell table, not caller geometry. */
export function intersectBodyLine3(body:BodyQuerySource3,origin:Point3,direction:Vector3,shell?:number):BodyBoundaryIntersection3 {
 return intersectMixedBoundaryLine3(faces(body),origin,direction,shell);
}
/** Forward events t>=0. Parameters are not distances for a nonunit direction. */
export function intersectBodyRay3(body:BodyQuerySource3,origin:Point3,direction:Vector3,shell?:number):BodyBoundaryIntersection3 {
 return intersectMixedBoundaryRay3(faces(body),origin,direction,shell);
}

export interface BodyLineMaterialInterval3 {
 readonly start:MixedBoundaryRayHit3;readonly end:MixedBoundaryRayHit3;
 /** A rational point strictly inside the material within this interval. */
 readonly sample:Point3;
}
export type BodyLineMaterialIntersection3=
 | {readonly kind:'degenerate';readonly boundary:BodyBoundaryIntersection3}
 | {readonly kind:'regular';readonly boundary:BodyBoundaryIntersection3;readonly intervals:readonly BodyLineMaterialInterval3[];readonly isolated:readonly MixedBoundaryRayHit3[]};
function strictlyBetween(a:AlgebraicReal,b:AlgebraicReal):Rational {
 let lo=a,hi=b;while(lo.upper.compare(hi.lower)>=0){lo=lo.refine();hi=hi.refine();}
 return lo.upper.add(hi.lower).div(new Rational(2n));
}
/** Closed material/line intersection for bounded owned Bodies. All boundary
 * events are required; selecting one shell would lose cavity boundaries.
 * Degenerate surface/edge events never become guessed material intervals. */
export function intersectBodyLineMaterial3(body:BodyQuerySource3,origin:Point3,direction:Vector3):BodyLineMaterialIntersection3 {
 assertSource(body);const line=line3(origin,direction),boundary=intersectBodyLine3(body,line.origin,line.direction);
 if(boundary.kind==='degenerate')return Object.freeze({kind:'degenerate',boundary});
 const pieces:{first:number;last:number;sample:Point3}[]=[],covered=new Set<number>(),hits=boundary.hits;
 for(let i=0;i+1<hits.length;i++){
  const t=strictlyBetween(hits[i]!.parameter,hits[i+1]!.parameter),sample=point3(line.origin.x.add(line.direction.x.mul(t)),line.origin.y.add(line.direction.y.mul(t)),line.origin.z.add(line.direction.z.mul(t))),location=locateSource(body,sample);
  if(location==='boundary')throw new Error('Material interval scan found an unreported interior boundary');
  if(location!=='inside')continue;
  covered.add(i);covered.add(i+1);const previous=pieces[pieces.length-1];
  if(previous&&previous.last===i)previous.last=i+1;else pieces.push({first:i,last:i+1,sample});
 }
 const intervals=Object.freeze(pieces.map(p=>Object.freeze({start:hits[p.first]!,end:hits[p.last]!,sample:p.sample}))),isolated=Object.freeze(hits.filter((_,i)=>!covered.has(i)));
 return Object.freeze({kind:'regular',boundary,intervals,isolated});
}
