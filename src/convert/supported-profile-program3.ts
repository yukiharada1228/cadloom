import {Rational} from '../numeric/rational.js';
import {point2} from '../geometry/point2.js';
import type {Point2} from '../geometry/point2.js';
import {point3} from '../geometry/point3.js';
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
const unsupported=()=>new RangeError('Extrude loop is not certified by its line/circle support intersection');
const same=(a:Point2,b:Point2)=>a.x.equals(b.x)&&a.y.equals(b.y);
function clean(points:Point2[]):Point2[]{const p=points.filter((v,i)=>i===0||!same(v,points[i-1]!));if(p.length>1&&same(p[0]!,p[p.length-1]!))p.pop();return p;}
/** A sufficient analytic representation, accepted only after exact 2D set
 * equality. It is not a complete compiler for arbitrary line/arc profiles. */
export function prepareSupportedProfileProgram3(ring:CurveRegion2[number],lower:Rational,upper:Rational):CylinderMaterialProgram3 {
 const filled=booleanCurveRegions2([ring],[],'union','even-odd');if(filled.rings.length!==1)throw unsupported();
 const boundary=filled.rings[0]!,one=new Rational(1n),xs:Rational[]=[],ys:Rational[]=[];
 for(const c of boundary){
  if(c.kind==='arc'){const o=c.arc.circle.center,r=c.arc.circle.radiusSquared.add(one);xs.push(o.x.sub(r),o.x.add(r));ys.push(o.y.sub(r),o.y.add(r));}
  else if(c.kind==='segment'){xs.push(c.segment.start.x,c.segment.end.x);ys.push(c.segment.start.y,c.segment.end.y);}
  else {xs.push(c.interval.start.x.lower,c.interval.start.x.upper,c.interval.end.x.lower,c.interval.end.x.upper);ys.push(c.interval.start.y.lower,c.interval.start.y.upper,c.interval.end.y.lower,c.interval.end.y.upper);}
 }
 const min=(v:Rational[])=>v.reduce((a,b)=>a.compare(b)<0?a:b).sub(one),max=(v:Rational[])=>v.reduce((a,b)=>a.compare(b)>0?a:b).add(one),x0=min(xs),x1=max(xs),y0=min(ys),y1=max(ys);
 let polygon=[point2(x0,y0),point2(x1,y0),point2(x1,y1),point2(x0,y1)];
 for(const c of boundary){
  if(c.kind==='arc')continue;
  const o=c.kind==='segment'?c.segment.start:c.interval.line.origin,d=c.kind==='segment'?point2(c.segment.end.x.sub(o.x),c.segment.end.y.sub(o.y)):c.interval.line.direction;
  const direction=c.kind==='segment'?1:c.interval.endParameter.compare(c.interval.startParameter),normal=direction===1?point2(d.y,d.x.neg()):point2(d.y.neg(),d.x),offset=normal.x.mul(o.x).add(normal.y.mul(o.y)).neg();
  const value=(p:Point2)=>normal.x.mul(p.x).add(normal.y.mul(p.y)).add(offset),next:Point2[]=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,A=value(a),B=value(b),inside=A.sign()<=0,other=B.sign()<=0;
   if(inside)next.push(a);
   if(inside!==other){const t=A.div(A.sub(B));next.push(point2(a.x.add(b.x.sub(a.x).mul(t)),a.y.add(b.y.sub(a.y).mul(t))));}
  }
  polygon=clean(next);if(polygon.length<3)throw unsupported();
 }
 const loop=polygon.map((start,i)=>({kind:'segment' as const,segment:{start,end:polygon[(i+1)%polygon.length]!}}));
 let candidate:CurveRegion2=[loop];
 const circles=boundary.filter(c=>c.kind==='arc').map(c=>({circle:c.arc.circle,operation:c.arc.direction==='ccw'?'intersection' as const:'difference' as const}));
 for(const c of circles)candidate=booleanCurveRegions2(candidate,[[{kind:'arc',arc:fullCircleArc2(c.circle)}]],c.operation,'even-odd').rings;
 const difference=booleanCurveRegions2(candidate,filled.rings,'xor','even-odd');if(difference.rings.length||difference.selectedFaces.length)throw unsupported();
 const mesh=extrudePolygon([polygon],upper.sub(lower),{baseZ:lower});
 let program=preparePlanarMaterialProgram3(preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!))));
 for(const c of circles){const cylinder=prepareFiniteCylinder3(cylinder3(line3(point3(c.circle.center.x,c.circle.center.y,0n),point3(0n,0n,1n)),c.circle.radiusSquared),lower,upper);program=booleanCylinderMaterialPrograms3(program,prepareCylinderMaterialProgram3([cylinder],[],{kind:'cylinder',cylinder:0}),c.operation);}
 return program;
}
