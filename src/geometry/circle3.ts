import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial,exactRational} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point3,vector3,dot3,cross3,subtract3,pointsEqual3,segment3} from './point3.js';
import type {Point3,Vector3,Segment3} from './point3.js';
import {algebraicPoint3,snapshotExactPoint3,getPointParameterization3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3,AlgebraicPoint3} from './algebraic-point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {line3,classifyPointToSurface3,intersectLineSurface3} from './surface3.js';
import type {Line3} from './surface3.js';

/** Circle in normal·(p-center)=0 with squared Euclidean radius.
 * The rational normal is nonzero and oriented, but need not be unit length.
 * Radius zero represents a point circle.
 */
export interface Circle3 {readonly center:Point3;readonly normal:Vector3;readonly radiusSquared:Rational;}
export type CirclePointInput3=Point3|AlgebraicCoordinates3;
export function circle3(center:Point3,normal:Vector3,radiusSquared:ExactInput):Circle3 {
  const c=point3(center.x,center.y,center.z),n=vector3(normal.x,normal.y,normal.z),r=exactRational(radiusSquared);
  if(dot3(n,n).sign()===0)throw new RangeError('Spatial circle requires a nonzero plane normal');
  if(r.sign()<0)throw new RangeError('Circle squared radius must be nonnegative');
  return Object.freeze({center:c,normal:n,radiusSquared:r});
}
/** Unique circle through three noncollinear rational points; input order orients its normal. */
export function circleThroughPoints3(inputA:Point3,inputB:Point3,inputC:Point3):Circle3 {
  const a=point3(inputA.x,inputA.y,inputA.z),b=point3(inputB.x,inputB.y,inputB.z),c=point3(inputC.x,inputC.y,inputC.z),u=subtract3(b,a),v=subtract3(c,a),n=cross3(u,v);
  const A=dot3(u,u),B=dot3(v,v),C=dot3(u,v),det=A.mul(B).sub(C.mul(C));
  if(det.sign()===0)throw new RangeError('Circle requires three noncollinear points');
  const denominator=det.mul(new Rational(2n)),alpha=B.mul(A.sub(C)).div(denominator),beta=A.mul(B.sub(C)).div(denominator);
  const h=vector3(u.x.mul(alpha).add(v.x.mul(beta)),u.y.mul(alpha).add(v.y.mul(beta)),u.z.mul(alpha).add(v.z.mul(beta)));
  return circle3(point3(a.x.add(h.x),a.y.add(h.y),a.z.add(h.z)),n,dot3(h,h));
}
function snapshot(circle:Circle3):Circle3{return circle3(circle.center,circle.normal,circle.radiusSquared);}
export function circlePlane3(input:Circle3):Plane3 {
  const c=snapshot(input);return plane3(c.normal.x,c.normal.y,c.normal.z,dot3(c.normal,c.center).neg());
}
function sphereEquation(origin:Point3,direction:Vector3,circle:Circle3):Polynomial {
  const q=subtract3(origin,circle.center);
  return new Polynomial([dot3(q,q).sub(circle.radiusSquared),dot3(q,direction).mul(new Rational(2n)),dot3(direction,direction)]);
}
/** Both the circle's plane equation and sphere equation must hold. */
export function pointOnCircle3(inputPoint:CirclePointInput3,input:Circle3):boolean {
  const c=snapshot(input),p=snapshotExactPoint3(inputPoint);
  if(classifyPointToSurface3(p,{kind:'plane',plane:circlePlane3(c)})!==0)return false;
  const data=getPointParameterization3(p);
  if(data)return data.parameter.signOf(sphereEquation(data.origin,data.direction,c))===0;
  const x=p.x.affine(1n,c.center.x.neg()),y=p.y.affine(1n,c.center.y.neg()),z=p.z.affine(1n,c.center.z.neg());
  return x.mul(x).add(y.mul(y)).add(z.mul(z)).affine(1n,c.radiusSquared.neg()).sign()===0;
}
/** Point-set equality ignores normal sign/scale; point-circle normals are immaterial. */
export function circlesCoincide3(inputA:Circle3,inputB:Circle3):boolean {
  const a=snapshot(inputA),b=snapshot(inputB),cross=cross3(a.normal,b.normal);
  return pointsEqual3(a.center,b.center)&&a.radiusSquared.equals(b.radiusSquared)&&(a.radiusSquared.sign()===0||dot3(cross,cross).sign()===0);
}
export interface LineCircleHit3 {
  readonly parameter:AlgebraicReal;readonly point:AlgebraicPoint3;
  /** Sphere-polynomial multiplicity for coplanar lines; null for a transverse
   * plane hit or a collapsed segment. Not a general space-curve multiplicity.
   */
  readonly multiplicity:1|2|null;
}
/** Finite hits ordered by the input line parameter. A line cannot be contained in a circle. */
export function intersectLineCircle3(input:Line3,inputCircle:Circle3):readonly LineCircleHit3[] {
  const line=line3(input.origin,input.direction),circle=snapshot(inputCircle),planeHit=intersectLineSurface3(line,{kind:'plane',plane:circlePlane3(circle)});
  if(planeHit.kind==='none')return Object.freeze([]);
  if(planeHit.kind==='points')return Object.freeze(planeHit.hits.filter(h=>pointOnCircle3(h.point,circle)).map(h=>Object.freeze({parameter:h.parameter,point:h.point,multiplicity:null})));
  const p=sphereEquation(line.origin,line.direction,circle),disc=p.coefficient(1).mul(p.coefficient(1)).sub(p.coefficient(0).mul(p.coefficient(2)).mul(new Rational(4n))),multiplicity=disc.sign()===0?2 as const:1 as const;
  return Object.freeze(isolateRealRoots(p).map(parameter=>Object.freeze({parameter,point:algebraicPoint3(line.origin,line.direction,parameter),multiplicity})));
}
export function intersectSegmentCircle3(input:Segment3,circle:Circle3):readonly LineCircleHit3[] {
  const s=segment3(input.start,input.end);
  if(pointsEqual3(s.start,s.end)){
    if(!pointOnCircle3(s.start,circle))return Object.freeze([]);
    const parameter=AlgebraicReal.fromRational(0n);return Object.freeze([Object.freeze({parameter,point:algebraicPoint3(s.start,vector3(0n,0n,0n),parameter),multiplicity:null})]);
  }
  const zero=AlgebraicReal.fromRational(0n),one=AlgebraicReal.fromRational(1n);
  return Object.freeze(intersectLineCircle3(line3(s.start,subtract3(s.end,s.start)),circle).filter(h=>h.parameter.compare(zero)>=0&&h.parameter.compare(one)<=0));
}
/** Internal rational intersection line of nonparallel plane equations. */
function planeIntersection(a:Plane3,b:Plane3):Line3 {
  const A=dot3(a.normal,a.normal),B=dot3(b.normal,b.normal),C=dot3(a.normal,b.normal),det=A.mul(B).sub(C.mul(C));
  const k=a.offset.neg(),l=b.offset.neg(),alpha=k.mul(B).sub(l.mul(C)).div(det),beta=l.mul(A).sub(k.mul(C)).div(det);
  const component=(key:'x'|'y'|'z')=>a.normal[key].mul(alpha).add(b.normal[key].mul(beta));
  return line3(point3(component('x'),component('y'),component('z')),cross3(a.normal,b.normal));
}
export type CirclePlaneIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly circle:Circle3}
 | {readonly kind:'points';readonly points:readonly AlgebraicPoint3[]};
export function intersectCirclePlane3(inputCircle:Circle3,inputPlane:Plane3):CirclePlaneIntersection3 {
  const c=snapshot(inputCircle),p=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),support=circlePlane3(c),normal=cross3(c.normal,p.normal);
  if(c.radiusSquared.sign()===0){
    return classifyPointToSurface3(c.center,{kind:'plane',plane:p})===0?Object.freeze({kind:'points',points:Object.freeze([algebraicPoint3(c.center,vector3(0n,0n,0n),AlgebraicReal.fromRational(0n))])}):Object.freeze({kind:'none'});
  }
  if(dot3(normal,normal).sign()===0)return classifyPointToSurface3(c.center,{kind:'plane',plane:p})===0?Object.freeze({kind:'coincident',circle:c}):Object.freeze({kind:'none'});
  const points=intersectLineCircle3(planeIntersection(support,p),c).map(h=>h.point).sort(compareAlgebraicPoints3);
  return points.length?Object.freeze({kind:'points',points:Object.freeze(points)}):Object.freeze({kind:'none'});
}
export type CircleCircleIntersection3=CirclePlaneIntersection3;
/** Complete circle/circle point set, including noncoplanar and point circles. */
export function intersectCircles3(inputA:Circle3,inputB:Circle3):CircleCircleIntersection3 {
  const a=snapshot(inputA),b=snapshot(inputB);
  const finite=(points:readonly AlgebraicPoint3[]):CircleCircleIntersection3=>points.length?Object.freeze({kind:'points',points:Object.freeze([...points].sort(compareAlgebraicPoints3))}):Object.freeze({kind:'none'});
  if(a.radiusSquared.sign()===0)return finite(pointOnCircle3(a.center,b)?[algebraicPoint3(a.center,vector3(0n,0n,0n),AlgebraicReal.fromRational(0n))]:[]);
  if(b.radiusSquared.sign()===0)return finite(pointOnCircle3(b.center,a)?[algebraicPoint3(b.center,vector3(0n,0n,0n),AlgebraicReal.fromRational(0n))]:[]);
  const normal=cross3(a.normal,b.normal);
  if(dot3(normal,normal).sign()!==0)return finite(intersectLineCircle3(planeIntersection(circlePlane3(a),circlePlane3(b)),a).filter(h=>pointOnCircle3(h.point,b)).map(h=>h.point));
  if(classifyPointToSurface3(b.center,{kind:'plane',plane:circlePlane3(a)})!==0)return finite([]);
  if(pointsEqual3(a.center,b.center))return a.radiusSquared.equals(b.radiusSquared)?Object.freeze({kind:'coincident',circle:a}):finite([]);
  const d=subtract3(b.center,a.center),offset=dot3(a.center,a.center).sub(dot3(b.center,b.center)).sub(a.radiusSquared).add(b.radiusSquared).div(new Rational(2n));
  const hit=intersectCirclePlane3(a,plane3(d.x,d.y,d.z,offset));return hit.kind==='points'?finite(hit.points):finite([]);
}
/** Internal deterministic positively oriented rational basis, without normalization. */
function basis(circle:Circle3):readonly [Vector3,Vector3] {
  const n=circle.normal,u=n.y.sign()!==0||n.z.sign()!==0?cross3(n,vector3(1n,0n,0n)):cross3(n,vector3(0n,1n,0n));
  return [u,cross3(n,u)];
}
function coordinate(circle:Circle3,p:AlgebraicCoordinates3,axis:Vector3):AlgebraicReal {
  const data=getPointParameterization3(p);
  if(data)return data.parameter.affine(dot3(data.direction,axis),dot3(subtract3(data.origin,circle.center),axis));
  return p.x.affine(axis.x,dot3(circle.center,axis).neg()).add(p.y.affine(axis.y)).add(p.z.affine(axis.z));
}
/** Internal angular order on certified points, from the positive first basis ray.
 * Upper-half x projection decreases monotonically even when basis lengths differ.
 */
function angleCompare(circle:Circle3,a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  if(circle.radiusSquared.sign()===0)return 0;
  const [u,v]=basis(circle),ax=coordinate(circle,a,u),bx=coordinate(circle,b,u);
  const half=(p:AlgebraicCoordinates3,x:AlgebraicReal)=>{const y=coordinate(circle,p,v).sign();return y>0||y===0&&x.sign()>=0?0:1;};
  const ha=half(a,ax),hb=half(b,bx);if(ha!==hb)return ha<hb?-1:1;
  const comparison=ax.compare(bx);return ha===0?comparison===0?0:comparison===1?-1:1:comparison;
}
export function comparePointsAroundCircle3(input:Circle3,inputA:CirclePointInput3,inputB:CirclePointInput3):Sign {
  const c=snapshot(input),a=snapshotExactPoint3(inputA),b=snapshotExactPoint3(inputB);
  if(!pointOnCircle3(a,c)||!pointOnCircle3(b,c))throw new RangeError('Angular ordering requires points on the circle');
  return angleCompare(c,a,b);
}
export type ArcDirection3='ccw'|'cw';
export interface CircularArcOptions3 {readonly direction?:ArcDirection3;readonly fullCircle?:boolean;}
export interface CircularArc3 {readonly circle:Circle3;readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;readonly direction:ArcDirection3;readonly fullCircle:boolean;}
export type ArcPointLocation3='outside'|'endpoint'|'interior';
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
const flip=(direction:ArcDirection3):ArcDirection3=>direction==='ccw'?'cw':'ccw';
function make(circle:Circle3,start:AlgebraicCoordinates3,end:AlgebraicCoordinates3,direction:ArcDirection3,fullCircle=false):CircularArc3{return Object.freeze({circle,start,end,direction,fullCircle});}
export function circularArc3(input:Circle3,inputStart:CirclePointInput3,inputEnd:CirclePointInput3,options:CircularArcOptions3={}):CircularArc3 {
  const c=snapshot(input),start=snapshotExactPoint3(inputStart),end=snapshotExactPoint3(inputEnd),direction=options.direction??'ccw',full=options.fullCircle??false;
  if(direction!=='ccw'&&direction!=='cw')throw new RangeError('Unknown arc direction');
  if(typeof full!=='boolean')throw new TypeError('fullCircle must be boolean');
  if(!pointOnCircle3(start,c)||!pointOnCircle3(end,c))throw new RangeError('Arc endpoints must lie on the circle');
  if(full&&!same(start,end))throw new RangeError('A full circle requires equal seam endpoints');
  return make(c,start,same(start,end)?start:end,direction,full&&c.radiusSquared.sign()>0);
}
function snapshotArc(arc:CircularArc3):CircularArc3{return circularArc3(arc.circle,arc.start,arc.end,{direction:arc.direction,fullCircle:arc.fullCircle});}
/** Full circle about any nonzero rational normal, including irrational axis lengths. */
export function fullCircleArc3(input:Circle3,direction:ArcDirection3='ccw'):CircularArc3 {
  const c=snapshot(input),[u]=basis(c),t=AlgebraicReal.fromRational(c.radiusSquared.div(dot3(u,u))).sqrt(),seam=algebraicPoint3(c.center,u,t);
  return circularArc3(c,seam,seam,{direction,fullCircle:true});
}
export function reverseCircularArc3(input:CircularArc3):CircularArc3 {const a=snapshotArc(input);return make(a.circle,a.end,a.start,flip(a.direction),a.fullCircle);}
function containsOnCircle(p:AlgebraicCoordinates3,arc:CircularArc3):boolean {
  if(arc.fullCircle)return true;if(same(arc.start,arc.end))return same(p,arc.start);
  const start=arc.direction==='ccw'?arc.start:arc.end,end=arc.direction==='ccw'?arc.end:arc.start;
  const order=angleCompare(arc.circle,start,end),from=angleCompare(arc.circle,start,p),to=angleCompare(arc.circle,p,end);
  return order<0?from<=0&&to<=0:from<=0||to<=0;
}
export function locatePointOnArc3(inputPoint:CirclePointInput3,input:CircularArc3):ArcPointLocation3 {
  const p=snapshotExactPoint3(inputPoint),a=snapshotArc(input);
  if(!pointOnCircle3(p,a.circle)||!containsOnCircle(p,a))return 'outside';
  return !a.fullCircle&&(same(p,a.start)||same(p,a.end))?'endpoint':'interior';
}
export function pointOnArc3(point:CirclePointInput3,arc:CircularArc3):boolean{return locatePointOnArc3(point,arc)!=='outside';}
function orderAlong(arc:CircularArc3,a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  const side=(p:AlgebraicCoordinates3)=>{const c=angleCompare(arc.circle,arc.start,p);return arc.direction==='ccw'?(c<=0?0:1):(c>=0?0:1);};
  const sa=side(a),sb=side(b);if(sa!==sb)return sa<sb?-1:1;
  const c=angleCompare(arc.circle,a,b);return arc.direction==='ccw'?c:c===0?0:c===1?-1:1;
}
export function comparePointsOnArc3(input:CircularArc3,inputA:CirclePointInput3,inputB:CirclePointInput3):Sign {
  const arc=snapshotArc(input),a=snapshotExactPoint3(inputA),b=snapshotExactPoint3(inputB);
  if(!pointOnArc3(a,arc)||!pointOnArc3(b,arc))throw new RangeError('Arc ordering requires points on the arc');return orderAlong(arc,a,b);
}
function unique(points:readonly AlgebraicCoordinates3[]):AlgebraicCoordinates3[]{return points.filter((p,i)=>points.findIndex(q=>same(p,q))===i);}
export function splitCircularArc3(input:CircularArc3,inputCuts:readonly CirclePointInput3[]):readonly CircularArc3[] {
  const arc=snapshotArc(input),cuts=inputCuts.map(snapshotExactPoint3);
  if(cuts.some(p=>!pointOnArc3(p,arc)))throw new RangeError('Arc cut must lie on the arc');
  if(!arc.fullCircle&&same(arc.start,arc.end))return Object.freeze([arc]);
  const ordered=unique([arc.start,...cuts,arc.end]).sort((a,b)=>orderAlong(arc,a,b));if(ordered.length===1)return Object.freeze([arc]);
  const count=arc.fullCircle?ordered.length:ordered.length-1;
  return Object.freeze(Array.from({length:count},(_,i)=>make(arc.circle,ordered[i]!,ordered[(i+1)%ordered.length]!,arc.direction)));
}
export function intersectLineArc3(line:Line3,input:CircularArc3):readonly LineCircleHit3[] {const arc=snapshotArc(input);return Object.freeze(intersectLineCircle3(line,arc.circle).filter(h=>containsOnCircle(h.point,arc)));}
export function intersectSegmentArc3(segment:Segment3,input:CircularArc3):readonly LineCircleHit3[] {const arc=snapshotArc(input);return Object.freeze(intersectSegmentCircle3(segment,arc.circle).filter(h=>containsOnCircle(h.point,arc)));}
export type ArcIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'points';readonly points:readonly AlgebraicCoordinates3[]}
 | {readonly kind:'overlap';readonly arcs:readonly CircularArc3[];readonly points:readonly AlgebraicCoordinates3[]};
/** Closed arc intersection, preserving isolated contacts separately from overlaps.
 * Overlap arcs follow the first input's normal and traversal direction.
 */
export function intersectArcs3(inputA:CircularArc3,inputB:CircularArc3):ArcIntersection3 {
  const first=snapshotArc(inputA),originalSecond=snapshotArc(inputB),support=intersectCircles3(first.circle,originalSecond.circle);
  const resultPoints=(points:AlgebraicCoordinates3[]):ArcIntersection3=>points.length?Object.freeze({kind:'points',points:Object.freeze(points.sort((a,b)=>orderAlong(first,a,b)))}):Object.freeze({kind:'none'});
  if(support.kind==='none')return Object.freeze({kind:'none'});
  if(support.kind==='points')return resultPoints(support.points.filter(p=>containsOnCircle(p,first)&&containsOnCircle(p,originalSecond)));
  const second=make(first.circle,originalSecond.start,originalSecond.end,dot3(first.circle.normal,originalSecond.circle.normal).sign()>0?originalSecond.direction:flip(originalSecond.direction),originalSecond.fullCircle);
  const marks=unique([first.start,first.end,second.start,second.end]).sort((a,b)=>angleCompare(first.circle,a,b)),N=marks.length;
  const inCell=(arc:CircularArc3,index:number)=>{if(arc.fullCircle)return true;const s=marks.findIndex(p=>same(p,arc.direction==='ccw'?arc.start:arc.end)),e=marks.findIndex(p=>same(p,arc.direction==='ccw'?arc.end:arc.start));return s<e?s<=index&&index<e:s>e&&(index>=s||index<e);};
  const selected=marks.map((_,i)=>inCell(first,i)&&inCell(second,i));
  if(selected.every(Boolean))return Object.freeze({kind:'overlap',arcs:Object.freeze([make(first.circle,first.start,first.start,first.direction,true)]),points:Object.freeze([])});
  const arcs:CircularArc3[]=[],points:AlgebraicCoordinates3[]=[];
  marks.forEach((p,i)=>{const previous=selected[(i+N-1)%N]!;
    if(selected[i]&&!previous){let end=(i+1)%N;while(selected[end])end=(end+1)%N;arcs.push(first.direction==='ccw'?make(first.circle,p,marks[end]!,first.direction):make(first.circle,marks[end]!,p,first.direction));}
    if(!selected[i]&&!previous&&containsOnCircle(p,first)&&containsOnCircle(p,second))points.push(p);
  });
  if(!arcs.length)return resultPoints(points);
  return Object.freeze({kind:'overlap',arcs:Object.freeze(arcs.sort((a,b)=>orderAlong(first,a.start,b.start))),points:Object.freeze(points.sort((a,b)=>orderAlong(first,a,b)))});
}
/** Exact open-arc witness. Dyadic slope bisection uses only rational linear
 * predicates at the endpoints; the returned point needs only a quadratic root.
 */
export function interiorPointOnArc3(input:CircularArc3):AlgebraicCoordinates3 {
  const arc=snapshotArc(input);
  if(arc.fullCircle)return arc.start;
  if(same(arc.start,arc.end))throw new RangeError('A point arc has no open-arc interior');
  const c=arc.circle,[u,v]=basis(c),neg=(a:Vector3)=>vector3(a.x.neg(),a.y.neg(),a.z.neg()),pairs:readonly (readonly [Vector3,Vector3])[]=[[u,v],[v,neg(u)],[neg(u),neg(v)],[neg(v),u]];
  const onRay=(d:Vector3)=>algebraicPoint3(c.center,d,AlgebraicReal.fromRational(c.radiusSquared.div(dot3(d,d))).sqrt());
  for(const [U,V] of pairs){
    const quadrant=make(c,onRay(U),onRay(V),'ccw'),hit=intersectArcs3(quadrant,arc);
    if(hit.kind!=='overlap')continue;
    const piece=hit.arcs[0]!;let lo=new Rational(0n),hi=new Rational(1n);
    while(true){
      const q=lo.add(hi).div(new Rational(2n)),a=new Rational(1n).sub(q),axis=vector3(V.x.mul(a).sub(U.x.mul(q)),V.y.mul(a).sub(U.y.mul(q)),V.z.mul(a).sub(U.z.mul(q)));
      // Y/(X+Y)-q has the sign of (1-q)Y-qX in a closed quadrant.
      if(coordinate(c,piece.start,axis).sign()>=0){lo=q;continue;}
      if(coordinate(c,piece.end,axis).sign()<=0){hi=q;continue;}
      const A=a.div(dot3(U,U)),B=q.div(dot3(V,V)),direction=vector3(U.x.mul(A).add(V.x.mul(B)),U.y.mul(A).add(V.y.mul(B)),U.z.mul(A).add(V.z.mul(B))),point=onRay(direction);
      if(locatePointOnArc3(point,arc)!=='interior')throw new Error('Angular witness did not lie in the open arc');
      return point;
    }
  }
  throw new Error('Nonpoint arc has no positive quadrant overlap');
}
