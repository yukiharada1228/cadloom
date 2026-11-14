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

export type EllipseEllipseIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly ellipse:Ellipse3}
 | {readonly kind:'points';readonly points:readonly AlgebraicCoordinates3[]};
/** Complete spatial ellipse intersection. Coplanar quadratics reduce to a
 * quartic in one chart coordinate; zero linear recovery coefficients are
 * handled separately, including two points sharing that coordinate.
 */
export function intersectEllipses3(inputA:Ellipse3,inputB:Ellipse3):EllipseEllipseIntersection3 {
  const a=snapshot(inputA),b=snapshot(inputB),planes=intersectPlanes3(ellipsePlane3(a),ellipsePlane3(b));
  if(planes.kind==='none')return Object.freeze({kind:'none'});
  if(ellipsesCoincide3(a,b))return Object.freeze({kind:'coincident',ellipse:a});
  let points:AlgebraicCoordinates3[]=[];
  if(planes.kind==='line')points=intersectLineEllipse3(planes.line,a).filter(h=>pointOnEllipse3(h.point,b)).map(h=>h.point);
  else {
    const [u,v]=duals(b),offset=subtract3(a.frame.origin,b.frame.origin),U=a.frame.u,V=a.frame.v;
    const alpha=dot3(u,U),beta=dot3(u,V),gamma=dot3(u,offset),delta=dot3(v,U),epsilon=dot3(v,V),zeta=dot3(v,offset),A=b.radiusVSquared,B=b.radiusUSquared,two=new Rational(2n);
    // b in a's coordinates: xx*x²+xy*x*y+yy*y²+lx*x+ly*y+c.
    const xx=A.mul(alpha.mul(alpha)).add(B.mul(delta.mul(delta))),xy=A.mul(alpha.mul(beta)).add(B.mul(delta.mul(epsilon))).mul(two),yy=A.mul(beta.mul(beta)).add(B.mul(epsilon.mul(epsilon))),lx=A.mul(alpha.mul(gamma)).add(B.mul(delta.mul(zeta))).mul(two),ly=A.mul(beta.mul(gamma)).add(B.mul(epsilon.mul(zeta))).mul(two),c=A.mul(gamma.mul(gamma)).add(B.mul(zeta.mul(zeta))).sub(A.mul(B));
    const R=new Polynomial([a.radiusVSquared,0n,a.radiusVSquared.div(a.radiusUSquared).neg()]),L=new Polynomial([ly,xy]),M=new Polynomial([c,lx,xx]).add(R.scale(yy)),quartic=M.mul(M).sub(L.mul(L).mul(R));
    if(quartic.degree<0)throw new Error('Distinct positive ellipses cannot have an identically zero elimination polynomial');
    const X=new Polynomial([0n,1n]);
    for(const x of isolateRealRoots(quartic)){
      const radial=x.signOf(R);if(radial<0)continue;
      if(x.signOf(L)!==0){
        // Evaluate each world coordinate as one rational function of x;
        // no independent conjugate Cartesian product is introduced.
        const component=(k:'x'|'y'|'z')=>x.rationalFunction(L.scale(a.frame.origin[k]).add(X.mul(L).scale(a.frame.u[k])).sub(M.scale(a.frame.v[k])),L);
        points.push(snapshotExactPoint3({x:component('x'),y:component('y'),z:component('z')}));
      }else if(x.signOf(M)===0){
        if(radial===0)points.push(algebraicPoint3(a.frame.origin,a.frame.u,x));
        else {
          const y=x.rationalFunction(R).sqrt();
          for(const Y of [y.neg(),y]){
            const component=(k:'x'|'y'|'z')=>x.affine(a.frame.u[k],a.frame.origin[k]).add(Y.affine(a.frame.v[k]));
            points.push(snapshotExactPoint3({x:component('x'),y:component('y'),z:component('z')}));
          }
        }
      }
    }
  }
  points=points.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i).sort(compareAlgebraicPoints3);
  return points.length?Object.freeze({kind:'points',points:Object.freeze(points)}):Object.freeze({kind:'none'});
}

/** Finite intersection with a closed segment whose endpoints may be algebraic. */
export function intersectAlgebraicSegmentEllipse3(input:import('./algebraic-segment3.js').AlgebraicSegment3,inputEllipse:Ellipse3):readonly AlgebraicCoordinates3[] {
  const e=snapshot(inputEllipse),s=snapshotExactPoint3(input.start),t=snapshotExactPoint3(input.end),zero=AlgebraicReal.fromRational(0n),one=AlgebraicReal.fromRational(1n);
  if(same(s,t))return Object.freeze(pointOnEllipse3(s,e)?[s]:[]);
  const axes=['x','y','z'] as const;
  if(axes.every(k=>s[k].rational!==null&&t[k].rational!==null))return Object.freeze(intersectSegmentEllipse3(segment3(point3(s.x.rational!,s.y.rational!,s.z.rational!),point3(t.x.rational!,t.y.rational!,t.z.rational!)),e).map(h=>h.point));
  const plane=ellipsePlane3(e),value=(p:AlgebraicCoordinates3)=>p.x.affine(plane.normal.x,plane.offset).add(p.y.affine(plane.normal.y)).add(p.z.affine(plane.normal.z)),S=value(s),T=value(t);
  const at=(r:AlgebraicReal)=>snapshotExactPoint3({x:s.x.add(t.x.sub(s.x).mul(r)),y:s.y.add(t.y.sub(s.y).mul(r)),z:s.z.add(t.z.sub(s.z).mul(r))});
  if(S.sign()!==0||T.sign()!==0){
    if(S.sign()*T.sign()>0)return Object.freeze([]);
    const r=S.div(S.sub(T));if(r.compare(zero)<0||r.compare(one)>0)return Object.freeze([]);const p=at(r);return Object.freeze(pointOnEllipse3(p,e)?[p]:[]);
  }
  const a=pointInPlaneFrame3(e.frame,s)!,b=pointInPlaneFrame3(e.frame,t)!,dx=b.x.sub(a.x),dy=b.y.sub(a.y),A=dx.mul(dx).affine(e.radiusVSquared).add(dy.mul(dy).affine(e.radiusUSquared)),B=a.x.mul(dx).affine(e.radiusVSquared).add(a.y.mul(dy).affine(e.radiusUSquared)).affine(2n),C=a.x.mul(a.x).affine(e.radiusVSquared).add(a.y.mul(a.y).affine(e.radiusUSquared)).affine(1n,e.radiusUSquared.mul(e.radiusVSquared).neg()),disc=B.mul(B).sub(A.mul(C).affine(4n));
  if(disc.sign()<0)return Object.freeze([]);
  const root=disc.sqrt(),den=A.affine(2n),parameters=disc.sign()===0?[B.neg().div(den)]:[B.neg().sub(root).div(den),B.neg().add(root).div(den)];
  return Object.freeze(parameters.filter(r=>r.compare(zero)>=0&&r.compare(one)<=0).map(at));
}
