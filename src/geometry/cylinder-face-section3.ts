import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {dot3} from './point3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {intersectAlgebraicSegmentPlane3} from './algebraic-segment-plane3.js';
import {algebraicLinePoint3} from './algebraic-line3.js';
import {intersectPlaneCylinder3} from './plane-cylinder3.js';
import {intersectCirclePlane3,pointOnArc3} from './circle3.js';
import {fullEllipseArc3,splitEllipticArc3,interiorPointOnEllipticArc3} from './ellipse3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {pointOnCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';

export interface CylinderFaceSection3 {
  /** Closed, positive-length pieces; tangent generators have multiplicity two.
   * Elliptic pieces can meet at the representation seam or boundary cuts.
   */
  readonly curves:readonly {readonly curve:Curve3;readonly multiplicity:1|2}[];
  /** Isolated contacts only; endpoints of returned curves are omitted. */
  readonly points:readonly AlgebraicCoordinates3[];
}
/** Exact intersection of an infinite rational plane with a finite cylinder
 * band/angular patch. Reconstructs the domain rather than trusting callbacks.
 */
export function intersectPlaneCylinderFace3(inputPlane:Plane3,inputFace:PreparedCylinderFace3):CylinderFaceSection3 {
  const p=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),face=prepareCylinderFace3(inputFace.surface,inputFace.lower,inputFace.upper,{angular:inputFace.angular,sense:inputFace.sense});
  const hit=intersectPlaneCylinder3(p,face.surface),curves:{curve:Curve3;multiplicity:1|2}[]=[],contacts:AlgebraicCoordinates3[]=[];
  if(hit.kind==='lines'){
    const d=face.surface.axis.direction,o=face.surface.axis.origin,D=dot3(d,d);
    for(const item of hit.lines){
      const q=item.line.origin,height=q.x.affine(d.x,dot3(o,d).neg()).add(q.y.affine(d.y)).add(q.z.affine(d.z)).affine(new Rational(1n).div(D));
      const at=(bound:Rational)=>algebraicLinePoint3(item.line,AlgebraicReal.fromRational(bound).sub(height));
      const start=at(face.lower),end=at(face.upper),middle=at(face.lower.add(face.upper).div(new Rational(2n)));
      if(face.locate(middle)!=='outside')curves.push({curve:{kind:'algebraic-segment',segment:algebraicSegment3(start,end)},multiplicity:item.multiplicity});
    }
  }else if(hit.kind==='ellipse'){
    // All boundary intersections partition the ellipse into cells on which
    // membership in the closed product domain is constant.
    for(const loop of face.boundary)for(const boundary of loop){
      if(boundary.kind==='circular-arc'){
        const cross=intersectCirclePlane3(boundary.arc.circle,p);
        if(cross.kind==='points')for(const q of cross.points)if(pointOnArc3(q,boundary.arc))contacts.push(q);
      }else if(boundary.kind==='algebraic-segment'){
        const cross=intersectAlgebraicSegmentPlane3(boundary.segment,p);
        if(cross.kind==='point')contacts.push(cross.point);
        else if(cross.kind==='coplanar')contacts.push(cross.segment.start,cross.segment.end);
      }else throw new Error('Unexpected cylinder domain boundary representation');
    }
    const cuts=contacts.filter((q,i,all)=>all.findIndex(r=>compareAlgebraicPoints3(q,r)===0)===i);
    for(const arc of splitEllipticArc3(fullEllipseArc3(hit.ellipse),cuts)){
      if(face.locate(interiorPointOnEllipticArc3(arc))!=='outside')curves.push({curve:{kind:'elliptic-arc',arc},multiplicity:1});
    }
  }
  const points=contacts.filter((q,i,all)=>all.findIndex(r=>compareAlgebraicPoints3(q,r)===0)===i&&face.locate(q)!=='outside'&&!curves.some(c=>pointOnCurve3(q,c.curve))).sort(compareAlgebraicPoints3).map(snapshotExactPoint3);
  return Object.freeze({curves:Object.freeze(curves.map(c=>Object.freeze({curve:Object.freeze(c.curve),multiplicity:c.multiplicity}))),points:Object.freeze(points)});
}
