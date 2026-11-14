import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,cross3,dot3} from './point3.js';
import {algebraicCoordinates3,compareAlgebraicPoints3,subtractAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import type {AlgebraicSegment3} from './algebraic-segment3.js';
import {ellipse3,intersectEllipses3,intersectLineEllipse3,intersectAlgebraicSegmentEllipse3,pointOnEllipticArc3,splitEllipticArc3,interiorPointOnEllipticArc3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';
import {planeFrame3} from './plane-frame3.js';
import {curveEndpoints3,pointOnCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {translatePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {intersectPlaneCylinderFace3} from './cylinder-face-section3.js';
import type {CylinderFaceSection3} from './cylinder-face-section3.js';

const axes=['x','y','z'] as const;
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
function support(c:Curve3):Ellipse3|null {
  if(c.kind==='elliptic-arc')return c.arc.ellipse;
  if(c.kind==='planar-arc'){
    const f=c.arc.frame,C=c.arc.arc.circle.center,r=c.arc.arc.circle.radiusSquared;
    return ellipse3(planeFrame3(point3(f.origin.x.add(f.u.x.mul(C.x)).add(f.v.x.mul(C.y)),f.origin.y.add(f.u.y.mul(C.x)).add(f.v.y.mul(C.y)),f.origin.z.add(f.u.z.mul(C.x)).add(f.v.z.mul(C.y))),f.u,f.v),r,r);
  }
  if(c.kind==='circular-arc'){
    const circle=c.arc.circle,n=circle.normal,u=n.y.sign()!==0||n.z.sign()!==0?cross3(n,vector3(1n,0n,0n)):cross3(n,vector3(0n,1n,0n)),v=cross3(n,u);
    return ellipse3(planeFrame3(circle.center,u,v),circle.radiusSquared.div(dot3(u,u)),circle.radiusSquared.div(dot3(v,v)));
  }
  return null;
}
function ellipseBoundary(e:Ellipse3,b:Curve3):readonly AlgebraicCoordinates3[] {
  if(b.kind==='line')return intersectLineEllipse3(b.interval.line,e).filter(h=>pointOnCurve3(h.point,b)).map(h=>h.point);
  if(b.kind==='algebraic-segment')return intersectAlgebraicSegmentEllipse3(b.segment,e);
  const hit=intersectEllipses3(e,support(b)!);
  return hit.kind==='points'?hit.points.filter(p=>pointOnCurve3(p,b)):hit.kind==='coincident'?curveEndpoints3(b):[];
}
function segmentCross(a:AlgebraicSegment3,b:AlgebraicSegment3):readonly AlgebraicCoordinates3[] {
  const A=subtractAlgebraicPoints3(a.end,a.start),B=subtractAlgebraicPoints3(b.end,b.start),q=subtractAlgebraicPoints3(b.start,a.start),pairs=[['x','y'],['y','z'],['z','x']] as const;
  for(const [i,j] of pairs){
    const det=A[i].mul(B[j]).sub(A[j].mul(B[i]));if(det.sign()===0)continue;
    const t=q[i].mul(B[j]).sub(q[j].mul(B[i])).div(det),p=algebraicCoordinates3(...axes.map(k=>a.start[k].add(A[k].mul(t))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
    return pointOnAlgebraicSegment3(p,a)&&pointOnAlgebraicSegment3(p,b)?[p]:[];
  }
  return [a.start,a.end,b.start,b.end].filter(p=>pointOnAlgebraicSegment3(p,a)&&pointOnAlgebraicSegment3(p,b));
}
function segmentBoundary(s:AlgebraicSegment3,b:Curve3):readonly AlgebraicCoordinates3[] {
  const e=support(b);if(e)return intersectAlgebraicSegmentEllipse3(s,e).filter(p=>pointOnCurve3(p,b));
  const [start,end]=curveEndpoints3(b);return segmentCross(s,algebraicSegment3(start,end));
}
/** Closed-set intersection of a factory-owned planar face and a finite cylinder
 * product-domain face. Returns curves and isolated contacts, not sewn faces.
 */
export function intersectPlanarCylinderFaces3(inputPlanar:PreparedPlanarFace3,inputCylinder:PreparedCylinderFace3):CylinderFaceSection3 {
  const face=translatePlanarFace3(inputPlanar,vector3(0n,0n,0n)),section=intersectPlaneCylinderFace3(face.surface,inputCylinder),curves:{curve:Curve3;multiplicity:1|2}[]=[],contacts:AlgebraicCoordinates3[]=[...section.points],boundaries=face.boundary.flat();
  const unique=(points:readonly AlgebraicCoordinates3[])=>points.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i);
  for(const item of section.curves){
    const c=item.curve;contacts.push(...curveEndpoints3(c));
    if(c.kind==='elliptic-arc'){
      const cuts=unique(boundaries.flatMap(b=>ellipseBoundary(c.arc.ellipse,b))).filter(p=>pointOnEllipticArc3(p,c.arc));contacts.push(...cuts);
      for(const arc of splitEllipticArc3(c.arc,cuts))if(face.locate(interiorPointOnEllipticArc3(arc))!=='outside')curves.push({curve:Object.freeze({kind:'elliptic-arc',arc}),multiplicity:item.multiplicity});
    }else if(c.kind==='algebraic-segment'){
      const s=c.segment,cuts=unique([s.start,s.end,...boundaries.flatMap(b=>segmentBoundary(s,b))]),k=axes.find(k=>s.start[k].compare(s.end[k])!==0)!;
      cuts.sort((p,q)=>p[k].compare(q[k])*s.start[k].compare(s.end[k])*-1);contacts.push(...cuts);
      for(let i=0;i+1<cuts.length;i++){
        const start=cuts[i]!,end=cuts[i+1]!,middle=algebraicCoordinates3(start.x.add(end.x).affine('1/2'),start.y.add(end.y).affine('1/2'),start.z.add(end.z).affine('1/2'));
        if(face.locate(middle)!=='outside')curves.push({curve:Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(start,end)}),multiplicity:item.multiplicity});
      }
    }else throw new Error('Unexpected plane/cylinder section representation');
  }
  const points=unique(contacts).filter(p=>face.locate(p)!=='outside'&&!curves.some(c=>pointOnCurve3(p,c.curve))).sort(compareAlgebraicPoints3);
  return Object.freeze({curves:Object.freeze(curves.map(c=>Object.freeze(c))),points:Object.freeze(points)});
}
