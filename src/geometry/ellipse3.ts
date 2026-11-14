import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {exactRational,Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point2} from './point2.js';
import type {Point2} from './point2.js';
import {getPointParameterization2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {point3,vector3,dot3,cross3,subtract3,pointsEqual3,segment3} from './point3.js';
import type {Point3,Vector3,Segment3} from './point3.js';
import {algebraicPoint3,snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3,AlgebraicPoint3} from './algebraic-point3.js';
import {plane3,intersectPlanes3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {planeFrame3,pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {line3,intersectLineSurface3} from './surface3.js';
import type {Line3} from './surface3.js';
import type {PointLocation} from './polygon-location.js';

/** p=frame.origin+x*frame.u+y*frame.v, x²/radiusUSquared+y²/radiusVSquared=1.
 * Axes are independent rational conjugate directions, not necessarily principal,
 * orthogonal or unit. This represents arbitrary positive rational ellipse forms.
 */
export interface Ellipse3 {readonly frame:PlaneFrame3;readonly radiusUSquared:Rational;readonly radiusVSquared:Rational;}
export function ellipse3(input:PlaneFrame3,inputU:ExactInput,inputV:ExactInput):Ellipse3 {
  const frame=planeFrame3(input.origin,input.u,input.v),radiusUSquared=exactRational(inputU),radiusVSquared=exactRational(inputV);
  if(radiusUSquared.sign()<=0||radiusVSquared.sign()<=0)throw new RangeError('Ellipse coordinate squared radii must be positive');
  return Object.freeze({frame,radiusUSquared,radiusVSquared});
}
function snapshot(e:Ellipse3):Ellipse3{return ellipse3(e.frame,e.radiusUSquared,e.radiusVSquared);}
export function ellipsePlane3(input:Ellipse3):Plane3 {
  const e=snapshot(input),n=cross3(e.frame.u,e.frame.v);return plane3(n.x,n.y,n.z,dot3(n,e.frame.origin).neg());
}
function equation(o:Point2,d:Point2,e:Ellipse3):Polynomial {
  const a=e.radiusVSquared,b=e.radiusUSquared,two=new Rational(2n);
  return new Polynomial([a.mul(o.x.mul(o.x)).add(b.mul(o.y.mul(o.y))).sub(a.mul(b)),a.mul(o.x).mul(d.x).add(b.mul(o.y).mul(d.y)).mul(two),a.mul(d.x.mul(d.x)).add(b.mul(d.y.mul(d.y)))]);
}
function localSign(p:AlgebraicCoordinates2,e:Ellipse3):Sign {
  const data=getPointParameterization2(p);if(data)return data.parameter.signOf(equation(data.origin,data.direction,e));
  return p.x.mul(p.x).affine(e.radiusVSquared).add(p.y.mul(p.y).affine(e.radiusUSquared)).affine(1n,e.radiusUSquared.mul(e.radiusVSquared).neg()).sign();
}
/** Location in the closed planar ellipse disk; off-plane points are outside. */
export function locatePointInEllipse3(inputPoint:Point3|AlgebraicCoordinates3,input:Ellipse3):PointLocation {
  const e=snapshot(input),p=pointInPlaneFrame3(e.frame,inputPoint);if(p===null)return 'outside';const sign=localSign(p,e);return sign===0?'boundary':sign<0?'inside':'outside';
}
export function pointOnEllipse3(p:Point3|AlgebraicCoordinates3,e:Ellipse3):boolean{return locatePointInEllipse3(p,e)==='boundary';}
function duals(e:Ellipse3):readonly [Vector3,Vector3] {
  const u=e.frame.u,v=e.frame.v,A=dot3(u,u),B=dot3(v,v),C=dot3(u,v),det=A.mul(B).sub(C.mul(C));
  const component=(a:Vector3,b:Vector3,x:Rational,y:Rational)=>vector3(a.x.mul(x).sub(b.x.mul(y)).div(det),a.y.mul(x).sub(b.y.mul(y)).div(det),a.z.mul(x).sub(b.z.mul(y)).div(det));
  return [component(u,v,B,C),component(v,u,A,C)];
}
/** Supporting point-set equality ignores chart reparameterization and orientation. */
export function ellipsesCoincide3(inputA:Ellipse3,inputB:Ellipse3):boolean {
  const a=snapshot(inputA),b=snapshot(inputB);if(!pointsEqual3(a.frame.origin,b.frame.origin))return false;
  const n=cross3(cross3(a.frame.u,a.frame.v),cross3(b.frame.u,b.frame.v));if(dot3(n,n).sign()!==0)return false;
  const [A,B]=duals(a),[C,D]=duals(b),axes=['x','y','z'] as const;
  for(let i=0;i<3;i++)for(let j=i;j<3;j++){
    const x=axes[i]!,y=axes[j]!,left=A[x].mul(A[y]).div(a.radiusUSquared).add(B[x].mul(B[y]).div(a.radiusVSquared)),right=C[x].mul(C[y]).div(b.radiusUSquared).add(D[x].mul(D[y]).div(b.radiusVSquared));if(!left.equals(right))return false;
  }return true;
}
export interface LineEllipseHit3 {readonly parameter:AlgebraicReal;readonly point:AlgebraicPoint3;readonly multiplicity:1|2|null;}
/** Finite hits in increasing input parameter; multiplicity is quadratic when
 * coplanar, null for transverse plane hits or collapsed segments.
 */
export function intersectLineEllipse3(input:Line3,inputEllipse:Ellipse3):readonly LineEllipseHit3[] {
  const line=line3(input.origin,input.direction),e=snapshot(inputEllipse),planeHit=intersectLineSurface3(line,{kind:'plane',plane:ellipsePlane3(e)});
  if(planeHit.kind==='none')return Object.freeze([]);
  if(planeHit.kind==='points')return Object.freeze(planeHit.hits.filter(h=>pointOnEllipse3(h.point,e)).map(h=>Object.freeze({parameter:h.parameter,point:h.point,multiplicity:null})));
  const [U,V]=duals(e),delta=subtract3(line.origin,e.frame.origin),o=point2(dot3(U,delta),dot3(V,delta)),d=point2(dot3(U,line.direction),dot3(V,line.direction)),p=equation(o,d,e);
  if(p.degree!==2)throw new Error('Nonzero coplanar ellipse line must give a positive quadratic');
  const disc=p.coefficient(1).mul(p.coefficient(1)).sub(p.coefficient(0).mul(p.coefficient(2)).mul(new Rational(4n))),multiplicity=disc.sign()===0?2 as const:1 as const;
  return Object.freeze(isolateRealRoots(p).map(parameter=>Object.freeze({parameter,point:algebraicPoint3(line.origin,line.direction,parameter),multiplicity})));
}
export function intersectSegmentEllipse3(input:Segment3,e:Ellipse3):readonly LineEllipseHit3[] {
  const s=segment3(input.start,input.end);
  if(pointsEqual3(s.start,s.end)){if(!pointOnEllipse3(s.start,e))return Object.freeze([]);const parameter=AlgebraicReal.fromRational(0n);return Object.freeze([Object.freeze({parameter,point:algebraicPoint3(s.start,vector3(0n,0n,0n),parameter),multiplicity:null})]);}
  const zero=AlgebraicReal.fromRational(0n),one=AlgebraicReal.fromRational(1n);return Object.freeze(intersectLineEllipse3(line3(s.start,subtract3(s.end,s.start)),e).filter(h=>h.parameter.compare(zero)>=0&&h.parameter.compare(one)<=0));
}
export interface EllipticArcOptions3 {readonly direction?:'ccw'|'cw';readonly fullEllipse?:boolean;}
export interface EllipticArc3 {readonly ellipse:Ellipse3;readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;readonly direction:'ccw'|'cw';readonly fullEllipse:boolean;}
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
function make(e:Ellipse3,start:AlgebraicCoordinates3,end:AlgebraicCoordinates3,direction:'ccw'|'cw',fullEllipse=false):EllipticArc3{return Object.freeze({ellipse:e,start,end,direction,fullEllipse});}
export function ellipticArc3(input:Ellipse3,inputStart:Point3|AlgebraicCoordinates3,inputEnd:Point3|AlgebraicCoordinates3,options:EllipticArcOptions3={}):EllipticArc3 {
  const e=snapshot(input),start=snapshotExactPoint3(inputStart),end=snapshotExactPoint3(inputEnd),direction=options.direction??'ccw',full=options.fullEllipse??false;
  if(direction!=='ccw'&&direction!=='cw')throw new RangeError('Unknown elliptic arc direction');if(typeof full!=='boolean')throw new TypeError('fullEllipse must be boolean');
  if(!pointOnEllipse3(start,e)||!pointOnEllipse3(end,e))throw new RangeError('Elliptic arc endpoints must lie on the ellipse');if(full&&!same(start,end))throw new RangeError('Full ellipse requires equal seam endpoints');return make(e,start,same(start,end)?start:end,direction,full);
}
function snapshotArc(a:EllipticArc3):EllipticArc3{return ellipticArc3(a.ellipse,a.start,a.end,{direction:a.direction,fullEllipse:a.fullEllipse});}
export function fullEllipseArc3(input:Ellipse3,direction:'ccw'|'cw'='ccw'):EllipticArc3 {
  const e=snapshot(input),seam=algebraicPoint3(e.frame.origin,e.frame.u,AlgebraicReal.fromRational(e.radiusUSquared).sqrt());return ellipticArc3(e,seam,seam,{direction,fullEllipse:true});
}
function angleCompare(e:Ellipse3,a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  const A=pointInPlaneFrame3(e.frame,a)!,B=pointInPlaneFrame3(e.frame,b)!;
  const half=(p:AlgebraicCoordinates2)=>{const y=p.y.sign();return y>0||y===0&&p.x.sign()>=0?0:1;},ha=half(A),hb=half(B);if(ha!==hb)return ha<hb?-1:1;
  const c=A.x.compare(B.x);return ha===0?c===0?0:c===1?-1:1:c;
}
export function comparePointsAroundEllipse3(input:Ellipse3,inputA:Point3|AlgebraicCoordinates3,inputB:Point3|AlgebraicCoordinates3):Sign {
  const e=snapshot(input),a=snapshotExactPoint3(inputA),b=snapshotExactPoint3(inputB);if(!pointOnEllipse3(a,e)||!pointOnEllipse3(b,e))throw new RangeError('Angular order requires points on the ellipse');return angleCompare(e,a,b);
}
function contains(p:AlgebraicCoordinates3,a:EllipticArc3):boolean {
  if(a.fullEllipse)return true;if(same(a.start,a.end))return same(p,a.start);
  const s=a.direction==='ccw'?a.start:a.end,e=a.direction==='ccw'?a.end:a.start,order=angleCompare(a.ellipse,s,e),from=angleCompare(a.ellipse,s,p),to=angleCompare(a.ellipse,p,e);return order<0?from<=0&&to<=0:from<=0||to<=0;
}
export function locatePointOnEllipticArc3(inputPoint:Point3|AlgebraicCoordinates3,input:EllipticArc3):'outside'|'endpoint'|'interior' {
  const p=snapshotExactPoint3(inputPoint),a=snapshotArc(input);if(!pointOnEllipse3(p,a.ellipse)||!contains(p,a))return 'outside';return !a.fullEllipse&&(same(p,a.start)||same(p,a.end))?'endpoint':'interior';
}
export function pointOnEllipticArc3(p:Point3|AlgebraicCoordinates3,a:EllipticArc3):boolean{return locatePointOnEllipticArc3(p,a)!=='outside';}
export function reverseEllipticArc3(input:EllipticArc3):EllipticArc3 {const a=snapshotArc(input);return make(a.ellipse,a.end,a.start,a.direction==='ccw'?'cw':'ccw',a.fullEllipse);}
function orderAlong(a:EllipticArc3,p:AlgebraicCoordinates3,q:AlgebraicCoordinates3):Sign {
  const side=(p:AlgebraicCoordinates3)=>{const c=angleCompare(a.ellipse,a.start,p);return a.direction==='ccw'?(c<=0?0:1):(c>=0?0:1);},s=side(p),t=side(q);if(s!==t)return s<t?-1:1;const c=angleCompare(a.ellipse,p,q);return a.direction==='ccw'?c:c===0?0:c===1?-1:1;
}
export function comparePointsOnEllipticArc3(input:EllipticArc3,inputA:Point3|AlgebraicCoordinates3,inputB:Point3|AlgebraicCoordinates3):Sign {
  const a=snapshotArc(input),p=snapshotExactPoint3(inputA),q=snapshotExactPoint3(inputB);if(!pointOnEllipticArc3(p,a)||!pointOnEllipticArc3(q,a))throw new RangeError('Arc order requires points on the elliptic arc');return orderAlong(a,p,q);
}
export function splitEllipticArc3(input:EllipticArc3,inputCuts:readonly (Point3|AlgebraicCoordinates3)[]):readonly EllipticArc3[] {
  const a=snapshotArc(input),cuts=inputCuts.map(snapshotExactPoint3);if(cuts.some(p=>!pointOnEllipticArc3(p,a)))throw new RangeError('Elliptic cut must lie on the arc');if(!a.fullEllipse&&same(a.start,a.end))return Object.freeze([a]);
  const points=[a.start,...cuts,a.end].filter((p,i,all)=>all.findIndex(q=>same(p,q))===i).sort((p,q)=>orderAlong(a,p,q));if(points.length===1)return Object.freeze([a]);
  return Object.freeze(Array.from({length:a.fullEllipse?points.length:points.length-1},(_,i)=>make(a.ellipse,points[i]!,points[(i+1)%points.length]!,a.direction)));
}
export function intersectLineEllipticArc3(line:Line3,input:EllipticArc3):readonly LineEllipseHit3[] {const a=snapshotArc(input);return Object.freeze(intersectLineEllipse3(line,a.ellipse).filter(h=>contains(h.point,a)));}
export function intersectSegmentEllipticArc3(segment:Segment3,input:EllipticArc3):readonly LineEllipseHit3[] {const a=snapshotArc(input);return Object.freeze(intersectSegmentEllipse3(segment,a.ellipse).filter(h=>contains(h.point,a)));}

export type EllipsePlaneIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly ellipse:Ellipse3}
 | {readonly kind:'points';readonly points:readonly AlgebraicPoint3[]};
/** Complete ellipse/plane intersection; finite points use lexicographic order. */
export function intersectEllipsePlane3(inputEllipse:Ellipse3,inputPlane:Plane3):EllipsePlaneIntersection3 {
  const e=snapshot(inputEllipse),hit=intersectPlanes3(ellipsePlane3(e),inputPlane);
  if(hit.kind==='none')return Object.freeze({kind:'none'});if(hit.kind==='coincident')return Object.freeze({kind:'coincident',ellipse:e});
  const points=intersectLineEllipse3(hit.line,e).map(h=>h.point).sort(compareAlgebraicPoints3);return points.length?Object.freeze({kind:'points',points:Object.freeze(points)}):Object.freeze({kind:'none'});
}

/** Exact open-arc witness from a rational ray in one chart quadrant. */
export function interiorPointOnEllipticArc3(input:EllipticArc3):AlgebraicCoordinates3 {
  const a=snapshotArc(input);if(a.fullEllipse)return a.start;
  if(same(a.start,a.end))throw new RangeError('A point arc has no open interior');
  const e=a.ellipse,f=e.frame,one=new Rational(1n),two=new Rational(2n);
  const onRay=(x:Rational,y:Rational)=>{
    const norm=e.radiusVSquared.mul(x.mul(x)).add(e.radiusUSquared.mul(y.mul(y)));
    const scale=AlgebraicReal.fromRational(e.radiusUSquared.mul(e.radiusVSquared).div(norm)).sqrt();
    const d=vector3(f.u.x.mul(x).add(f.v.x.mul(y)),f.u.y.mul(x).add(f.v.y.mul(y)),f.u.z.mul(x).add(f.v.z.mul(y)));
    return algebraicPoint3(f.origin,d,scale);
  };
  const zero=new Rational(0n),cardinals=[onRay(one,zero),onRay(zero,one),onRay(one.neg(),zero),onRay(zero,one.neg())];
  const piece=splitEllipticArc3(a,cardinals.filter(p=>pointOnEllipticArc3(p,a)))[0]!;
  const s=pointInPlaneFrame3(f,piece.start)!,t=pointInPlaneFrame3(f,piece.end)!;
  for(const [sx,sy] of [[1n,1n],[-1n,1n],[-1n,-1n],[1n,-1n]] as const){
    if([s,t].some(p=>p.x.sign()*Number(sx)<0||p.y.sign()*Number(sy)<0))continue;
    const phase=(p:AlgebraicCoordinates2,q:Rational)=>{
      const X=q.mul(new Rational(-sx)),Y=one.sub(q).mul(new Rational(sy)),data=getPointParameterization2(p);
      if(data)return data.parameter.signOf(new Polynomial([data.origin.x.mul(X).add(data.origin.y.mul(Y)),data.direction.x.mul(X).add(data.direction.y.mul(Y))]));
      return p.x.affine(X).add(p.y.affine(Y)).sign();
    };
    // Either endpoint may have the smaller phase, independently of traversal.
    let lo=zero,hi=one;
    while(true){
      const q=lo.add(hi).div(two),S=phase(s,q),T=phase(t,q);
      if(S>=0&&T>=0){lo=q;continue;}
      if(S<=0&&T<=0){hi=q;continue;}
      const result=onRay(one.sub(q).mul(new Rational(sx)),q.mul(new Rational(sy)));
      if(locatePointOnEllipticArc3(result,a)!=='interior')throw new Error('Ellipse interior witness failed');return result;
    }
  }
  throw new Error('Nonpoint elliptic arc has no quadrant cell');
}
