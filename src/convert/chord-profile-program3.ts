import {Rational} from '../numeric/rational.js';
import {point2} from '../geometry/point2.js';
import type {Point2} from '../geometry/point2.js';
import {point3} from '../geometry/point3.js';
import {plane3} from '../geometry/plane3.js';
import {fullCircleArc2} from '../geometry/circular-arc2.js';
import {booleanCurveRegions2} from '../geometry/curve-boolean2.js';
import type {CurveRegion2} from '../geometry/curve-boolean2.js';
import {extrudePolygon} from '../geometry/extrude.js';
import {triangle3} from '../geometry/triangle3.js';
import {preparePlanarSolid3} from '../geometry/planar-solid3.js';
import {preparePlanarMaterialProgram3} from '../geometry/planar-material-boundary3.js';
import {line3,cylinder3} from '../geometry/surface3.js';
import {prepareFiniteCylinder3} from '../geometry/finite-cylinder-boolean3.js';
import {prepareCylinderMaterialProgram3,booleanCylinderMaterialPrograms3} from '../geometry/cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
const region=(polygon:Point2[]):CurveRegion2=>polygon.length<3?[]:[polygon.map((start,i)=>({kind:'segment' as const,segment:{start,end:polygon[(i+1)%polygon.length]!}}))];
function rational(p:{x:Rational|{rational:Rational|null};y:Rational|{rational:Rational|null}}):Point2 {
 const x=p.x instanceof Rational?p.x:p.x.rational,y=p.y instanceof Rational?p.y:p.y.rational;
 if(x===null||y===null)throw new RangeError('Extrude chord decomposition requires rational boundary endpoints');return point2(x,y);
}
function clip(polygon:Point2[],n:Point2,offset:Rational):Point2[]{
 const value=(p:Point2)=>n.x.mul(p.x).add(n.y.mul(p.y)).add(offset),result:Point2[]=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,A=value(a),B=value(b),inside=A.sign()<=0,other=B.sign()<=0;
  if(inside)result.push(a);if(inside!==other){const t=A.div(A.sub(B));result.push(point2(a.x.add(b.x.sub(a.x).mul(t)),a.y.add(b.y.sub(a.y).mul(t))));}
 }
 return result;
}
/** A parity decomposition accepted only after exact filled-region equality. */
export function prepareChordProfileProgram3(boundary:CurveRegion2[number],lower:Rational,upper:Rational):CylinderMaterialProgram3 {
 const points=boundary.map(c=>rational(c.kind==='arc'?c.arc.start:c.kind==='segment'?c.segment.start:c.interval.start));
 const seed=booleanCurveRegions2(region(points),[],'union','even-odd'),patches=[];let candidate=seed.rings;
 for(const c of boundary){
  if(c.kind!=='arc')continue;
  const a=rational(c.arc.start),b=rational(c.arc.end),dx=b.x.sub(a.x),dy=b.y.sub(a.y);
  if(dx.sign()===0&&dy.sign()===0)throw new RangeError('Chord decomposition needs nonpoint partial arcs');
  const n=c.arc.direction==='ccw'?point2(dy.neg(),dx):point2(dy,dx.neg()),offset=n.x.mul(a.x).add(n.y.mul(a.y)).neg(),circle=c.arc.circle,o=circle.center,r=circle.radiusSquared.add(new Rational(1n));
  const box=[point2(o.x.sub(r),o.y.sub(r)),point2(o.x.add(r),o.y.sub(r)),point2(o.x.add(r),o.y.add(r)),point2(o.x.sub(r),o.y.add(r))];
  const patch=booleanCurveRegions2([[{kind:'arc',arc:fullCircleArc2(circle)}]],region(clip(box,n,offset)),'intersection','even-odd');
  candidate=booleanCurveRegions2(candidate,patch.rings,'xor','even-odd').rings;patches.push({circle,n,offset});
 }
 const difference=booleanCurveRegions2(candidate,[boundary],'xor','even-odd');if(difference.rings.length||difference.selectedFaces.length)throw new RangeError('Extrude chord decomposition is not certified by exact region equality');
 let program:CylinderMaterialProgram3|undefined;
 const append=(p:CylinderMaterialProgram3)=>{program=program?booleanCylinderMaterialPrograms3(program,p,'xor'):p;};
 for(const ring of seed.rings){
  const polygon=ring.map(c=>{if(c.kind==='arc')throw new Error('Chord polygon produced an arc');return rational(c.kind==='segment'?c.segment.start:c.interval.start);}),mesh=extrudePolygon([polygon],upper.sub(lower),{baseZ:lower});
  append(preparePlanarMaterialProgram3(preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)))));
 }
 for(const {circle,n,offset} of patches){
  const cylinder=prepareFiniteCylinder3(cylinder3(line3(point3(circle.center.x,circle.center.y,0n),point3(0n,0n,1n)),circle.radiusSquared),lower,upper);
  append(prepareCylinderMaterialProgram3([cylinder],[plane3(n.x,n.y,0n,offset)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}}));
 }
 if(!program)throw new RangeError('Empty chord decomposition');return program;
}
