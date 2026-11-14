import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point2} from './point2.js';
import type {Point2} from './point2.js';
import {algebraicCoordinates2,algebraicPoint2,snapshotExactPoint2,getPointParameterization2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {point3,vector3,dot3,cross3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {algebraicCoordinates3,algebraicPoint3,compareAlgebraicPoints3,snapshotExactPoint3,getPointParameterization3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3,AlgebraicPoint3} from './algebraic-point3.js';
import {circularArc2,reverseCircularArc2,pointOnArc2} from './circular-arc2.js';
import type {CircularArc2} from './circular-arc2.js';
import {circle3,circularArc3,reverseCircularArc3,pointOnArc3,circlePlane3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3,algebraicSegmentOnSurface3} from './algebraic-segment3.js';
import type {AlgebraicSegment3} from './algebraic-segment3.js';
import {line3,cylinder3,classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Line3,Surface3} from './surface3.js';
import {plane3} from './plane3.js';

/** Injective affine chart p = origin + x*u + y*v; not required to be orthonormal.
 * A local circle can therefore map to an ellipse in 3D.
 */
export interface PlaneFrame3 {readonly origin:Point3;readonly u:Vector3;readonly v:Vector3;}
export interface LineInterval3 {
  readonly line:Line3;readonly startParameter:AlgebraicReal;readonly endParameter:AlgebraicReal;
  readonly start:AlgebraicPoint3;readonly end:AlgebraicPoint3;
}
/** Exact affine image of a circular arc in an injective rational plane chart. */
export interface PlanarArc3 {
  readonly frame:PlaneFrame3;readonly arc:CircularArc2;
  readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;
}
export type Curve3={readonly kind:'line';readonly interval:LineInterval3}|{readonly kind:'planar-arc';readonly arc:PlanarArc3}|{readonly kind:'circular-arc';readonly arc:CircularArc3}|{readonly kind:'algebraic-segment';readonly segment:AlgebraicSegment3};
/** Connected closed walk on a supporting surface; not a certified simple face domain. */
export interface CurveLoop3 {readonly surface:Surface3;readonly curves:readonly Curve3[];}
const axes=['x','y','z'] as const,zero=new Rational(0n),two=new Rational(2n);
export function planeFrame3(origin:Point3,u:Vector3,v:Vector3):PlaneFrame3 {
  const o=point3(origin.x,origin.y,origin.z),a=vector3(u.x,u.y,u.z),b=vector3(v.x,v.y,v.z),normal=cross3(a,b);
  if(dot3(normal,normal).sign()===0)throw new RangeError('Plane frame directions must be independent');
  return Object.freeze({origin:o,u:a,v:b});
}
function snapshotFrame(frame:PlaneFrame3):PlaneFrame3{return planeFrame3(frame.origin,frame.u,frame.v);}
function mapRational(frame:PlaneFrame3,p:Point2,direction=false):Point3 {
  const component=(k:typeof axes[number])=>frame.u[k].mul(p.x).add(frame.v[k].mul(p.y)).add(direction?zero:frame.origin[k]);
  return point3(component('x'),component('y'),component('z'));
}
export function mapPlanePoint3(input:PlaneFrame3,inputPoint:Point2|AlgebraicCoordinates2):AlgebraicCoordinates3 {
  const frame=snapshotFrame(input),p=snapshotExactPoint2(inputPoint),data=getPointParameterization2(p);
  if(data)return algebraicPoint3(mapRational(frame,data.origin),mapRational(frame,data.direction,true),data.parameter);
  const component=(k:typeof axes[number])=>p.x.affine(frame.u[k],frame.origin[k]).add(p.y.affine(frame.v[k]));
  return algebraicCoordinates3(component('x'),component('y'),component('z'));
}
function linear(point:AlgebraicCoordinates3,v:Vector3,offset=zero):AlgebraicReal {
  return point.x.affine(v.x,offset).add(point.y.affine(v.y)).add(point.z.affine(v.z));
}
/** Returns chart coordinates only if the point lies in the supporting plane.
 * This is a partial inverse, not a projection of off-plane points.
 */
export function pointInPlaneFrame3(input:PlaneFrame3,inputPoint:Point3|AlgebraicCoordinates3):AlgebraicCoordinates2|null {
  const frame=snapshotFrame(input),p=snapshotExactPoint3(inputPoint),n=cross3(frame.u,frame.v);
  if(classifyPointToSurface3(p,{kind:'plane',plane:plane3(n.x,n.y,n.z,dot3(n,frame.origin).neg())})!==0)return null;
  const uu=dot3(frame.u,frame.u),uv=dot3(frame.u,frame.v),vv=dot3(frame.v,frame.v),det=uu.mul(vv).sub(uv.mul(uv));
  const dual=(a:Vector3,b:Vector3,A:Rational,B:Rational)=>vector3(...axes.map(k=>a[k].mul(A).sub(b[k].mul(B)).div(det)) as [Rational,Rational,Rational]);
  const U=dual(frame.u,frame.v,vv,uv),V=dual(frame.v,frame.u,uu,uv),data=getPointParameterization3(p);
  if(data){
    const project=(value:Vector3,direction=false)=>point2(dot3(U,direction?value:subtract3(value,frame.origin)),dot3(V,direction?value:subtract3(value,frame.origin)));
    return algebraicPoint2(project(data.origin),project(data.direction,true),data.parameter);
  }
  return algebraicCoordinates2(linear(p,U,dot3(U,frame.origin).neg()),linear(p,V,dot3(V,frame.origin).neg()));
}
export function lineInterval3(input:Line3,start:AlgebraicReal|ExactInput,end:AlgebraicReal|ExactInput):LineInterval3 {
  const line=line3(input.origin,input.direction),a=start instanceof AlgebraicReal?start:AlgebraicReal.fromRational(start),b=end instanceof AlgebraicReal?end:AlgebraicReal.fromRational(end);
  return Object.freeze({line,startParameter:a,endParameter:b,start:algebraicPoint3(line.origin,line.direction,a),end:algebraicPoint3(line.origin,line.direction,b)});
}
export function planarArc3(inputFrame:PlaneFrame3,inputArc:CircularArc2):PlanarArc3 {
  const frame=snapshotFrame(inputFrame),arc=circularArc2(inputArc.circle,inputArc.start,inputArc.end,{direction:inputArc.direction,fullCircle:inputArc.fullCircle});
  return Object.freeze({frame,arc,start:mapPlanePoint3(frame,arc.start),end:mapPlanePoint3(frame,arc.end)});
}
/** Internal snapshot never trusts cached start/end fields from structural objects. */
export function snapshotCurve3(curve:Curve3):Curve3 {
  switch(curve.kind){
    case 'algebraic-segment':return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(curve.segment.start,curve.segment.end)});
    case 'line':return Object.freeze({kind:'line',interval:lineInterval3(curve.interval.line,curve.interval.startParameter,curve.interval.endParameter)});
    case 'planar-arc':return Object.freeze({kind:'planar-arc',arc:planarArc3(curve.arc.frame,curve.arc.arc)});
    case 'circular-arc':return Object.freeze({kind:'circular-arc',arc:circularArc3(curve.arc.circle,curve.arc.start,curve.arc.end,{direction:curve.arc.direction,fullCircle:curve.arc.fullCircle})});
    default:throw new RangeError('Unknown 3D curve kind');
  }
}
export function curveEndpoints3(input:Curve3):readonly [AlgebraicCoordinates3,AlgebraicCoordinates3] {
  const c=snapshotCurve3(input),data=c.kind==='line'?c.interval:c.kind==='algebraic-segment'?c.segment:c.arc;return Object.freeze([data.start,data.end]);
}
export function reverseCurve3(input:Curve3):Curve3 {
  const c=snapshotCurve3(input);
  if(c.kind==='algebraic-segment')return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(c.segment.end,c.segment.start)});
  if(c.kind==='line')return Object.freeze({kind:'line',interval:lineInterval3(c.interval.line,c.interval.endParameter,c.interval.startParameter)});
  if(c.kind==='circular-arc')return Object.freeze({kind:'circular-arc',arc:reverseCircularArc3(c.arc)});
  return Object.freeze({kind:'planar-arc',arc:planarArc3(c.arc.frame,reverseCircularArc2(c.arc.arc))});
}
/** Exact rational translation of bounded geometry, retaining traversal and seams. */
export function translateCurve3(input:Curve3,translation:Vector3):Curve3 {
  const c=snapshotCurve3(input),v=vector3(translation.x,translation.y,translation.z),move=(p:Point3)=>point3(p.x.add(v.x),p.y.add(v.y),p.z.add(v.z));
  if(c.kind==='line')return Object.freeze({kind:'line',interval:lineInterval3(line3(move(c.interval.line.origin),c.interval.line.direction),c.interval.startParameter,c.interval.endParameter)});
  if(c.kind==='algebraic-segment')return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(translateAlgebraicPoint3(c.segment.start,v),translateAlgebraicPoint3(c.segment.end,v))});
  if(c.kind==='planar-arc')return Object.freeze({kind:'planar-arc',arc:planarArc3(planeFrame3(move(c.arc.frame.origin),c.arc.frame.u,c.arc.frame.v),c.arc.arc)});
  const a=c.arc;
  return Object.freeze({kind:'circular-arc',arc:circularArc3(circle3(move(a.circle.center),a.circle.normal,a.circle.radiusSquared),translateAlgebraicPoint3(a.start,v),translateAlgebraicPoint3(a.end,v),{direction:a.direction,fullCircle:a.fullCircle})});
}
export function pointOnCurve3(inputPoint:Point3|AlgebraicCoordinates3,input:Curve3):boolean {
  const curve=snapshotCurve3(input),p=snapshotExactPoint3(inputPoint);
  if(curve.kind==='algebraic-segment')return pointOnAlgebraicSegment3(p,curve.segment);
  if(curve.kind==='circular-arc')return pointOnArc3(p,curve.arc);
  if(curve.kind==='planar-arc'){const local=pointInPlaneFrame3(curve.arc.frame,p);return local!==null&&pointOnArc2(local,curve.arc.arc);}
  const {line,startParameter:a,endParameter:b}=curve.interval,k=axes.find(k=>line.direction[k].sign()!==0)!;
  const t=p[k].affine(new Rational(1n).div(line.direction[k]),line.origin[k].neg().div(line.direction[k]));
  const lo=a.compare(b)<0?a:b,hi=a.compare(b)<0?b:a;
  return t.compare(lo)>=0&&t.compare(hi)<=0&&compareAlgebraicPoints3(p,algebraicPoint3(line.origin,line.direction,t))===0;
}
/** True iff every point of the bounded curve lies on the supporting surface.
 * Nondegenerate supports are checked by polynomial identities, not endpoint tests.
 */
export function curveOnSurface3(input:Curve3,inputSurface:Surface3):boolean {
  const curve=snapshotCurve3(input),data=curve.kind==='line'?curve.interval:curve.kind==='algebraic-segment'?curve.segment:curve.arc,start=data.start,end=data.end;
  const periodic=curve.kind==='circular-arc'?curve.arc.fullCircle:curve.kind==='planar-arc'&&curve.arc.arc.fullCircle;
  const isPoint=compareAlgebraicPoints3(start,end)===0&&!periodic;
  if(isPoint)return classifyPointToSurface3(start,inputSurface)===0;
  if(curve.kind==='algebraic-segment')return algebraicSegmentOnSurface3(curve.segment,inputSurface);
  let surface:Surface3;
  switch(inputSurface.kind){
    case 'plane':{const p=inputSurface.plane;surface={kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)};break;}
    case 'cylinder':surface={kind:'cylinder',cylinder:cylinder3(inputSurface.cylinder.axis,inputSurface.cylinder.radiusSquared)};break;
    default:throw new RangeError('Unknown analytic surface kind');
  }
  if(curve.kind==='line'){
    const {origin:o,direction:v}=curve.interval.line;
    if(surface.kind==='plane')return dot3(surface.plane.normal,v).sign()===0&&dot3(surface.plane.normal,o).add(surface.plane.offset).sign()===0;
    const c=surface.cylinder,d=c.axis.direction,u=cross3(d,subtract3(o,c.axis.origin)),w=cross3(d,v);
    return dot3(w,w).sign()===0&&dot3(u,u).sub(c.radiusSquared.mul(dot3(d,d))).sign()===0;
  }
  if(curve.kind==='circular-arc'){
    const circle=curve.arc.circle;
    if(surface.kind==='plane')return surfacesCoincide3(surface,{kind:'plane',plane:circlePlane3(circle)});
    const c=surface.cylinder,parallel=cross3(c.axis.direction,circle.normal),onAxis=cross3(c.axis.direction,subtract3(circle.center,c.axis.origin));
    return dot3(parallel,parallel).sign()===0&&dot3(onAxis,onAxis).sign()===0&&c.radiusSquared.equals(circle.radiusSquared);
  }
  const {frame,arc}=curve.arc;
  if(surface.kind==='plane'){
    const p=surface.plane;return dot3(p.normal,frame.u).sign()===0&&dot3(p.normal,frame.v).sign()===0&&dot3(p.normal,frame.origin).add(p.offset).sign()===0;
  }
  const c=surface.cylinder,d=c.axis.direction,q=cross3(d,subtract3(frame.origin,c.axis.origin)),u=cross3(d,frame.u),v=cross3(d,frame.v);
  const xx=dot3(u,u),xy=dot3(u,v).mul(two),yy=dot3(v,v),x=dot3(q,u).mul(two),y=dot3(q,v).mul(two),constant=dot3(q,q).sub(c.radiusSquared.mul(dot3(d,d))),center=arc.circle.center;
  // The pullback quadratic must be a scalar multiple of the local circle equation.
  return xy.sign()===0&&xx.equals(yy)&&x.equals(xx.mul(center.x).mul(two).neg())&&y.equals(xx.mul(center.y).mul(two).neg())&&constant.equals(xx.mul(center.x.mul(center.x).add(center.y.mul(center.y)).sub(arc.circle.radiusSquared)));
}
/** Validates exact endpoint closure and whole-curve support membership.
 * Self-intersections, retracing and point degeneracies still require face-domain validation.
 */
export function curveLoop3(input:readonly Curve3[],inputSurface:Surface3):CurveLoop3 {
  if(!input.length)throw new RangeError('A surface curve loop must be nonempty');
  let surface:Surface3;
  switch(inputSurface.kind){
    case 'plane':{const p=inputSurface.plane;surface=Object.freeze({kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)});break;}
    case 'cylinder':surface=Object.freeze({kind:'cylinder',cylinder:cylinder3(inputSurface.cylinder.axis,inputSurface.cylinder.radiusSquared)});break;
    default:throw new RangeError('Unknown analytic surface kind');
  }
  const curves=Object.freeze(input.map(snapshotCurve3)),ends=curves.map(curveEndpoints3);
  curves.forEach((curve,i)=>{
    if(compareAlgebraicPoints3(ends[i]![1],ends[(i+1)%curves.length]![0])!==0)throw new RangeError('Surface curve loop must be connected and closed');
    if(!curveOnSurface3(curve,surface))throw new RangeError('Entire boundary curve must lie on its supporting surface');
  });
  return Object.freeze({surface,curves});
}
