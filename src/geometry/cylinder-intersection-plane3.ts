import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {isolateRealRoots} from '../numeric/real-roots.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {intersectCirclePlane3,pointOnArc3} from './circle3.js';
import {algebraicPoint3,algebraicBiparametricPoint3,algebraicRationalPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {assertOwnedCylinderIntersectionArc3,assertOwnedCylinderIntersectionGraph3,evaluateCylinderIntersectionArc3,pointOnCylinderIntersectionArc3,splitCylinderIntersectionArc3,rebuildCylinderIntersectionGraph3} from './cylinder-cylinder3.js';
import type {CylinderIntersectionArc3,BoundedCylinderIntersection3} from './cylinder-cylinder3.js';
import type {CylinderHalfSpace3} from './trimmed-cylinder3.js';

export type CylinderIntersectionArcPlane3=
 | {readonly kind:'none'}
 | {readonly kind:'points';readonly points:readonly AlgebraicCoordinates3[]}
 | {readonly kind:'overlap';readonly arc:CylinderIntersectionArc3};
export interface CylinderIntersectionArcPlaneSplit3 {
  readonly original:CylinderIntersectionArc3;readonly plane:Plane3;
  readonly intersection:CylinderIntersectionArcPlane3;
  /** Open-piece plane sign; closed endpoints are retained on adjacent pieces. */
  readonly pieces:readonly {readonly arc:CylinderIntersectionArc3;readonly side:Sign}[];
}
type Candidates={readonly kind:'fibers';readonly base:readonly AlgebraicCoordinates3[]}|
 {readonly kind:'finite';readonly points:readonly AlgebraicCoordinates3[]}|
 {readonly kind:'ellipse'};
const axes=['x','y','z'] as const,two=new Rational(2n);
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
function unique(points:readonly AlgebraicCoordinates3[]){return points.filter((p,i)=>points.findIndex(q=>same(p,q))===i).sort(compareAlgebraicPoints3);}
function finite(points:readonly AlgebraicCoordinates3[]):CylinderIntersectionArcPlane3 {const p=unique(points);return p.length?Object.freeze({kind:'points',points:Object.freeze(p)}):Object.freeze({kind:'none'});}
/** Complete supporting-pair/plane candidates, shared across one clipping pass. */
function candidates(arc:CylinderIntersectionArc3,plane:Plane3):Candidates {
  const first=arc.first,second=arc.second,d=first.axis.direction,e=second.axis.direction,slope=dot3(plane.normal,d),o=first.axis.origin;
  if(slope.sign()===0){const hit=intersectCirclePlane3(arc.base.circle,plane);if(hit.kind==='coincident')throw new Error('An axis-parallel plane cannot contain its normal cross-section circle');return {kind:'fibers',base:hit.kind==='points'?hit.points:[]};}
  const U=d.y.sign()!==0||d.z.sign()!==0?cross3(d,point3(1n,0n)):cross3(d,point3(0n,1n)),V=cross3(d,U),project=(p:Point3,vector=false)=>{const t=(vector?dot3(plane.normal,p):dot3(plane.normal,p).add(plane.offset)).div(slope);return point3(p.x.sub(d.x.mul(t)),p.y.sub(d.y.mul(t)),p.z.sub(d.z.mul(t)));},O=project(o),u=project(U,true),v=project(V,true),q=cross3(e,subtract3(O,second.axis.origin)),a=cross3(e,u),b=cross3(e,v);
  const xx=dot3(a,a),xy=dot3(a,b).mul(two),yy=dot3(b,b),lx=dot3(q,a).mul(two),ly=dot3(q,b).mul(two),c=dot3(q,q).sub(second.radiusSquared.mul(dot3(e,e)));
  // The base circle gives y²=R(x); the second cylinder becomes L(x)y+M(x)=0.
  const R=new Polynomial([first.radiusSquared.div(dot3(V,V)),0n,dot3(U,U).div(dot3(V,V)).neg()]),L=new Polynomial([ly,xy]),M=new Polynomial([c,lx,xx]).add(R.scale(yy));
  if(L.degree<0&&M.degree<0)return {kind:'ellipse'};
  const quartic=M.mul(M).sub(L.mul(L).mul(R));if(quartic.degree<0)throw new Error('Noncoincident circle/conic elimination is identically zero');
  const X=new Polynomial([0n,1n]),points:AlgebraicCoordinates3[]=[];
  for(const x of isolateRealRoots(quartic)){
    const radial=x.signOf(R);if(radial<0)continue;
    if(x.signOf(L)!==0){
      const N=axes.map(k=>L.scale(O[k]).add(X.mul(L).scale(u[k])).sub(M.scale(v[k]))) as [Polynomial,Polynomial,Polynomial];
      points.push(algebraicRationalPoint3(x,N,L));
    }else if(x.signOf(M)===0){
      const root=x.rationalFunction(R).sqrt();
      for(const sign of radial===0?[1n]:[-1n,1n]){const y=root.affine(sign);
        points.push(x.rational!==null?algebraicPoint3(point3(O.x.add(u.x.mul(x.rational)),O.y.add(u.y.mul(x.rational)),O.z.add(u.z.mul(x.rational))),v,y):y.rational!==null?algebraicPoint3(point3(O.x.add(v.x.mul(y.rational)),O.y.add(v.y.mul(y.rational)),O.z.add(v.z.mul(y.rational))),u,x):algebraicBiparametricPoint3(O,u,x,v,y));
      }
    }
  }
  return {kind:'finite',points:unique(points)};
}
function intersection(arc:CylinderIntersectionArc3,plane:Plane3,all:Candidates):CylinderIntersectionArcPlane3 {
  if(all.kind==='ellipse'){
    if(evaluate(plane,arc.sample).sign()===0)return Object.freeze({kind:'overlap',arc});
    return finite([arc.start,arc.end].filter(p=>evaluate(plane,p).sign()===0));
  }
  if(all.kind==='finite')return finite(all.points.filter(p=>pointOnCylinderIntersectionArc3(p,arc)));
  return finite(all.base.filter(q=>pointOnArc3(q,arc.base)).map(q=>evaluateCylinderIntersectionArc3(arc,q)));
}
/** All distinct plane intersections of an owned quartic SSI arc. A whole shared
 * elliptic section is overlap; the opposite height branch may meet it only at
 * critical endpoints. No multiplicity is inferred from elimination root counts.
 */
export function intersectCylinderIntersectionArcPlane3(arc:CylinderIntersectionArc3,input:Plane3):CylinderIntersectionArcPlane3 {
  assertOwnedCylinderIntersectionArc3(arc);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset);return intersection(arc,plane,candidates(arc,plane));
}
function split(arc:CylinderIntersectionArc3,plane:Plane3,all:Candidates):CylinderIntersectionArcPlaneSplit3 {
  const hit=intersection(arc,plane,all);
  const arcs=hit.kind==='points'?splitCylinderIntersectionArc3(arc,hit.points):[arc];
  const pieces=Object.freeze(arcs.map(arc=>{
    const side=evaluate(plane,arc.sample).sign();if(side===0&&hit.kind!=='overlap')throw new Error('Open SSI piece contains an unpartitioned plane root');
    return Object.freeze({arc,side});
  }));
  return Object.freeze({original:arc,plane,intersection:hit,pieces});
}
export function splitCylinderIntersectionArcByPlane3(arc:CylinderIntersectionArc3,input:Plane3):CylinderIntersectionArcPlaneSplit3 {
  assertOwnedCylinderIntersectionArc3(arc);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset);return split(arc,plane,candidates(arc,plane));
}
/** Closed-set clipping of an owned bounded SSI graph by rational halfspaces.
 * Retain isolated tangent contacts, coplanar arcs and singular incidence. This
 * clips curves, not regularized 3D material. Supporting plane candidates are
 * solved once per halfspace and shared across all branch arcs.
 */
export function clipCylinderIntersectionByHalfspaces3(input:BoundedCylinderIntersection3,halfspaces:readonly CylinderHalfSpace3[]):BoundedCylinderIntersection3 {
  assertOwnedCylinderIntersectionGraph3(input);
  const checked=halfspaces.map(h=>{if(h.side!==-1&&h.side!==1)throw new RangeError('SSI halfspace side must be -1 or +1');return {plane:plane3(h.plane.normal.x,h.plane.normal.y,h.plane.normal.z,h.plane.offset),side:h.side};});
  let current=input;
  for(const h of checked){
    const all=current.arcs.length?candidates(current.arcs[0]!,h.plane):null,arcs:CylinderIntersectionArc3[]=[],points:AlgebraicCoordinates3[]=[...current.isolatedPoints];
    for(const arc of current.arcs){const result=split(arc,h.plane,all!);if(result.intersection.kind==='points')points.push(...result.intersection.points);
      for(const piece of result.pieces)if(piece.side===0||piece.side===h.side){if([piece.arc.start,piece.arc.end].some(p=>{const s=evaluate(h.plane,p).sign();return s!==0&&s!==h.side;}))throw new Error('Clipped SSI piece has an excluded endpoint');arcs.push(piece.arc);}
    }
    const isolated=unique(points).filter(p=>{const sign=evaluate(h.plane,p).sign();return (sign===0||sign===h.side)&&!arcs.some(a=>same(p,a.start)||same(p,a.end));});
    current=rebuildCylinderIntersectionGraph3(current,arcs,isolated);
  }
  return current;
}
