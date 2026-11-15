import {support,segmentCross} from './curve-noding3.js';
export {support,segmentCross} from './curve-noding3.js';
import {vector3} from './point3.js';
import {algebraicCoordinates3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import type {AlgebraicSegment3} from './algebraic-segment3.js';
import {intersectEllipses3,intersectLineEllipse3,intersectAlgebraicSegmentEllipse3,pointOnEllipticArc3,splitEllipticArc3,interiorPointOnEllipticArc3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';
import {curveEndpoints3,pointOnCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {translatePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {intersectPlaneCylinderFace3} from './cylinder-face-section3.js';
import type {CylinderFaceSection3} from './cylinder-face-section3.js';

const axes=['x','y','z'] as const;
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
function ellipseBoundary(e:Ellipse3,b:Curve3):readonly AlgebraicCoordinates3[] {
  if(b.kind==='line')return intersectLineEllipse3(b.interval.line,e).filter(h=>pointOnCurve3(h.point,b)).map(h=>h.point);
  if(b.kind==='algebraic-segment')return intersectAlgebraicSegmentEllipse3(b.segment,e);
  const hit=intersectEllipses3(e,support(b)!);
  return hit.kind==='points'?hit.points.filter(p=>pointOnCurve3(p,b)):hit.kind==='coincident'?curveEndpoints3(b):[];
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
