import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point2} from './point2.js';
import {algebraicCoordinates2,algebraicPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {point3,vector3,dot3,cross3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {algebraicCoordinates3,algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {planeFrame3,mapPlanePoint3,pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {ellipticArc3,splitEllipticArc3,pointOnEllipticArc3} from './ellipse3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {curveEndpoints3,snapshotCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {support} from './planar-cylinder-intersection3.js';
import {sectionPieces} from './cylinder-plane-split3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';

export const zero=new Rational(0n),one=new Rational(1n),two=new Rational(2n);
export const real=(q:Rational|bigint)=>AlgebraicReal.fromRational(q);
export const uniqueReals=(values:readonly AlgebraicReal[])=>values.filter((x,i,all)=>all.findIndex(y=>x.compare(y)===0)===i).sort((a,b)=>a.compare(b));
export const samePoint=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
export function canonical(c:Curve3):Curve3 {
  if(c.kind==='algebraic-segment'||c.kind==='elliptic-arc')return snapshotCurve3(c);
  if(c.kind==='line'){const [a,b]=curveEndpoints3(c);return snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(a,b)});}
  const e=support(c)!,arc=c.kind==='planar-arc'?c.arc.arc:c.arc;
  return snapshotCurve3({kind:'elliptic-arc',arc:ellipticArc3(e,c.arc.start,c.arc.end,{direction:arc.direction,fullEllipse:arc.fullCircle})});
}
export function frameFor(base:PreparedPlanarFace3):PlaneFrame3 {
  const d=base.domain;if(d.kind==='chart'||d.kind==='rectangle')return d.frame;if(d.kind==='elliptic')return d.ellipse.frame;
  const n=base.surface.normal,u=n.y.sign()!==0||n.z.sign()!==0?cross3(n,vector3(1n,0n,0n)):cross3(n,vector3(0n,1n,0n));return planeFrame3(d.outer.center,u,cross3(n,u));
}
export function duals(f:PlaneFrame3):readonly [Vector3,Vector3] {
  const A=dot3(f.u,f.u),B=dot3(f.v,f.v),C=dot3(f.u,f.v),det=A.mul(B).sub(C.mul(C)),row=(a:Vector3,b:Vector3,x:Rational,y:Rational)=>vector3(a.x.mul(x).sub(b.x.mul(y)).div(det),a.y.mul(x).sub(b.y.mul(y)).div(det),a.z.mul(x).sub(b.z.mul(y)).div(det));return [row(f.u,f.v,B,C),row(f.v,f.u,A,C)];
}
export function map(f:PlaneFrame3,x:AlgebraicReal,y:AlgebraicReal):AlgebraicCoordinates3 {
  return mapPlanePoint3(f,x.rational!==null?algebraicPoint2(point2(x.rational,0n),point2(0n,1n),y):y.rational!==null?algebraicPoint2(point2(0n,y.rational),point2(1n,0n),x):algebraicCoordinates2(x,y));
}
export function mapQ(f:PlaneFrame3,x:Rational,y:Rational):Point3{return point3(f.origin.x.add(f.u.x.mul(x)).add(f.v.x.mul(y)),f.origin.y.add(f.u.y.mul(x)).add(f.v.y.mul(y)),f.origin.z.add(f.u.z.mul(x)).add(f.v.z.mul(y)));}
interface EllipseSlice {K:Rational;L:Polynomial;C:Polynomial;local:(x:AlgebraicReal,y:AlgebraicReal)=>AlgebraicCoordinates2;start:AlgebraicCoordinates2;end:AlgebraicCoordinates2;}
export interface PlanarChartGeometry3 {
  frame:PlaneFrame3;curves:readonly Curve3[];
  xMin:Rational;xMax:Rational;yMin:Rational;yMax:Rational;
  critical:AlgebraicReal[];
  slice(curve:Curve3,x:AlgebraicReal,axis?:'x'|'y'):readonly AlgebraicReal[];
  extrema(curve:Curve3):readonly AlgebraicCoordinates3[];
  tangent(curve:Curve3,p:AlgebraicCoordinates3):AlgebraicCoordinates2;
}
export function chartGeometry(base:PreparedPlanarFace3):PlanarChartGeometry3 {
  const frame=frameFor(base),[DU,DV]=duals(frame),curves=base.boundary.flat().map(canonical),cache=new Map<Curve3,EllipseSlice>(),extremaCache=new Map<Curve3,AlgebraicCoordinates3[]>();
  let xMin=zero,xMax=zero,yMin=zero,yMax=zero;const critical:AlgebraicReal[]=[];
  const include=(p:AlgebraicCoordinates2)=>{if(p.x.lower.compare(xMin)<0)xMin=p.x.lower;if(p.x.upper.compare(xMax)>0)xMax=p.x.upper;if(p.y.lower.compare(yMin)<0)yMin=p.y.lower;if(p.y.upper.compare(yMax)>0)yMax=p.y.upper;};
  for(const c of curves){
    for(const p of curveEndpoints3(c)){const q=pointInPlaneFrame3(frame,p)!;critical.push(q.x);include(q);}
    if(c.kind!=='elliptic-arc')continue;
    const e=c.arc.ellipse,[EU,EV]=duals(e.frame),delta=subtract3(frame.origin,e.frame.origin),a=dot3(EU,frame.u),b=dot3(EU,frame.v),h=dot3(EU,delta),d=dot3(EV,frame.u),v=dot3(EV,frame.v),k=dot3(EV,delta),A=e.radiusVSquared,B=e.radiusUSquared,K=A.mul(b.mul(b)).add(B.mul(v.mul(v))),L=new Polynomial([A.mul(b).mul(h).add(B.mul(v).mul(k)).mul(two),A.mul(a).mul(b).add(B.mul(d).mul(v)).mul(two)]),C=new Polynomial([A.mul(h.mul(h)).add(B.mul(k.mul(k))).sub(A.mul(B)),A.mul(a).mul(h).add(B.mul(d).mul(k)).mul(two),A.mul(a.mul(a)).add(B.mul(d.mul(d)))]);
    cache.set(c,{K,L,C,local:(x,y)=>algebraicCoordinates2(x.affine(a,h).add(y.affine(b)),x.affine(d,k).add(y.affine(v))),start:pointInPlaneFrame3(e.frame,c.arc.start)!,end:pointInPlaneFrame3(e.frame,c.arc.end)!});
    const points:AlgebraicCoordinates3[]=[];
    for(const row of [DU,DV]){
      const p=dot3(row,e.frame.u),q=dot3(row,e.frame.v),squared=e.radiusUSquared.mul(p.mul(p)).add(e.radiusVSquared.mul(q.mul(q))),radius=real(squared).sqrt(),direction=vector3(e.frame.u.x.mul(e.radiusUSquared).mul(p).add(e.frame.v.x.mul(e.radiusVSquared).mul(q)).div(squared),e.frame.u.y.mul(e.radiusUSquared).mul(p).add(e.frame.v.y.mul(e.radiusVSquared).mul(q)).div(squared),e.frame.u.z.mul(e.radiusUSquared).mul(p).add(e.frame.v.z.mul(e.radiusVSquared).mul(q)).div(squared));
      for(const r of [radius.neg(),radius]){const point=algebraicPoint3(e.frame.origin,direction,r);include(pointInPlaneFrame3(frame,point)!);if(row===DU){critical.push(pointInPlaneFrame3(frame,point)!.x);if(pointOnEllipticArc3(point,c.arc))points.push(point);}}
    }
    extremaCache.set(c,points);
  }
  const angle=(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2)=>{const half=(p:AlgebraicCoordinates2)=>p.y.sign()>0||p.y.sign()===0&&p.x.sign()>=0?0:1,A=half(a),B=half(b);return A!==B?A<B?-1:1:A===0?-a.x.compare(b.x):a.x.compare(b.x);};
  const slice=(c:Curve3,x:AlgebraicReal,axis:'x'|'y'='x'):readonly AlgebraicReal[]=>{
    if(c.kind==='algebraic-segment'){
      const a=pointInPlaneFrame3(frame,c.segment.start)!,b=pointInPlaneFrame3(frame,c.segment.end)!,other=axis==='x'?'y':'x',dx=b[axis].sub(a[axis]);
      if(dx.sign()===0)return x.compare(a[axis])===0?[a[other],b[other]]:[];
      const forward=dx.sign()>0,lo=forward?a[axis]:b[axis],hi=forward?b[axis]:a[axis];if(x.compare(lo)<0||x.compare(hi)>0)return [];
      if(a[other].compare(b[other])===0)return [a[other]];
      const t=x.sub(a[axis]).div(dx);return [a[other].add(b[other].sub(a[other]).mul(t))];
    }
    if(c.kind!=='elliptic-arc')throw new Error('Unexpected planar boundary representation');const E=cache.get(c)!;
    const K=axis==='x'?E.K:E.C.coefficient(2),L=axis==='x'?E.L:new Polynomial([E.C.coefficient(1),E.L.coefficient(1)]),C=axis==='x'?E.C:new Polynomial([E.C.coefficient(0),E.L.coefficient(0),E.K]);
    const D=L.mul(L).sub(C.scale(K.mul(new Rational(4n)))),sign=x.signOf(D);if(sign<0)return [];
    const root=x.rationalFunction(D).sqrt(),linear=x.rationalFunction(L),values=sign===0?[linear.neg().affine(one.div(K.mul(two)))]:[linear.neg().sub(root).affine(one.div(K.mul(two))),linear.neg().add(root).affine(one.div(K.mul(two)))];
    if(c.arc.fullEllipse)return values;
    const s=c.arc.direction==='ccw'?E.start:E.end,e=c.arc.direction==='ccw'?E.end:E.start,order=angle(s,e);
    return values.filter(y=>{const p=axis==='x'?E.local(x,y):E.local(y,x),from=angle(s,p),to=angle(p,e);return order<0?from<=0&&to<=0:from<=0||to<=0;});
  };
  const tangent=(c:Curve3,p:AlgebraicCoordinates3):AlgebraicCoordinates2=>{
    if(c.kind==='algebraic-segment'){const a=pointInPlaneFrame3(frame,c.segment.start)!,b=pointInPlaneFrame3(frame,c.segment.end)!;return algebraicCoordinates2(b.x.sub(a.x),b.y.sub(a.y));}
    if(c.kind!=='elliptic-arc')throw new Error('Unexpected planar tangent');const e=c.arc.ellipse,q=pointInPlaneFrame3(e.frame,p)!,sign=c.arc.direction==='ccw'?one:one.neg(),a=q.y.affine(e.radiusUSquared.neg().mul(sign)),b=q.x.affine(e.radiusVSquared.mul(sign));return algebraicCoordinates2(a.affine(dot3(DU,e.frame.u)).add(b.affine(dot3(DU,e.frame.v))),a.affine(dot3(DV,e.frame.u)).add(b.affine(dot3(DV,e.frame.v))));
  };
  return {frame,curves,xMin:xMin.sub(one),xMax:xMax.add(one),yMin:yMin.sub(one),yMax:yMax.add(one),critical,slice,extrema:c=>extremaCache.get(c)??[],tangent};
}
/** Node a canonical original boundary at its vertical extrema before other cuts. */
export function verticalPieces(c:Curve3,g:PlanarChartGeometry3):readonly Curve3[] {
  if(c.kind!=='elliptic-arc')return [c];return sectionPieces(c).flatMap(piece=>{if(piece.kind!=='elliptic-arc')throw new Error('Expected ellipse');return splitEllipticArc3(piece.arc,g.extrema(c).filter(p=>pointOnEllipticArc3(p,piece.arc))).map(arc=>snapshotCurve3({kind:'elliptic-arc',arc}));});
}
