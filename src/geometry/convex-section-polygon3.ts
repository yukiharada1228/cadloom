import {Rational} from '../numeric/rational.js';
import {point2,segment2} from './point2.js';
import type {Point2} from './point2.js';
import {dot3} from './point3.js';
import type {Plane3} from './plane3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {preparePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';

export type ConvexSectionPolygon3={readonly kind:'empty'}|{readonly kind:'curved'}|{readonly kind:'polygon';readonly face:PreparedPlanarFace3};
/** Exact sufficient certificate that a bounded rational halfplane polygon is
 * inside its convex analytic section. The loose initial box contains that
 * section. No polygonal approximation is accepted: all vertices must satisfy
 * the exact convex-section predicate, otherwise the curved path is retained.
 */
export function convexSectionPolygon3(frame:PlaneFrame3,sense:1|-1,xMin:Rational,xMax:Rational,yMin:Rational,yMax:Rational,planes:readonly Plane3[],inside:(point:Point2)=>boolean):ConvexSectionPolygon3 {
  let polygon=[point2(xMin,yMin),point2(xMax,yMin),point2(xMax,yMax),point2(xMin,yMax)];
  const same=(a:Point2,b:Point2)=>a.x.equals(b.x)&&a.y.equals(b.y);
  for(const plane of planes){
    if(!polygon.length)break;const a=dot3(plane.normal,frame.u),b=dot3(plane.normal,frame.v),c=dot3(plane.normal,frame.origin).add(plane.offset),value=(p:Point2)=>a.mul(p.x).add(b.mul(p.y)).add(c),next:Point2[]=[];
    for(let i=0;i<polygon.length;i++){
      const A=polygon[i]!,B=polygon[(i+1)%polygon.length]!,ha=value(A),hb=value(B),inA=ha.sign()<=0,inB=hb.sign()<=0;
      if(inA!==inB){const t=ha.div(ha.sub(hb));next.push(point2(A.x.add(B.x.sub(A.x).mul(t)),A.y.add(B.y.sub(A.y).mul(t))));}
      if(inB)next.push(B);
    }
    polygon=next.filter((p,i)=>i===0||!same(p,next[i-1]!));if(polygon.length>1&&same(polygon[0]!,polygon[polygon.length-1]!))polygon.pop();
  }
  const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length]!;return sum.add(p.x.mul(q.y).sub(p.y.mul(q.x)));},new Rational(0n));
  if(polygon.length<3||area.sign()===0)return Object.freeze({kind:'empty'});
  if(!polygon.every(inside))return Object.freeze({kind:'curved'});
  if(sense===-1)polygon.reverse();
  const ring=polygon.map((p,i)=>Object.freeze({kind:'segment' as const,segment:segment2(p,polygon[(i+1)%polygon.length]!)}));
  return Object.freeze({kind:'polygon',face:preparePlanarFace3(frame,[ring],sense)});
}
