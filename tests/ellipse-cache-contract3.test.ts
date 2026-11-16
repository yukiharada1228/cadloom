import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,point3,planeFrame3,mapPlanePoint3,ellipse3,ellipsePlane3,evaluatePlane3,locatePointInEllipse3,pointOnEllipse3,algebraicCoordinates3,AlgebraicReal,ellipticArc3,fullEllipseArc3,locatePointOnEllipticArc3,comparePointsAroundEllipse3,comparePointsOnEllipticArc3,reverseEllipticArc3} from '../dist/index.js';
const X=point3(1n,0n,0n),Y=point3(0n,1n,0n),O=point3(0n,0n,0n);
test('repeated nonorthogonal ellipse queries match independent local quadratic inequalities',()=>{
 const frame=planeFrame3(O,point3(1n,1n,0n),point3(0n,1n,1n)),e=ellipse3(frame,4n,9n);
 for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){
  const p=mapPlanePoint3(frame,point2(`${i}/2`,`${j}/2`)),value=9*i*i+4*j*j,expected=value===144?'boundary':value<144?'inside':'outside';
  for(let n=0;n<3;n++){assert.equal(locatePointInEllipse3(p,e),expected);assert.equal(pointOnEllipse3(p,e),expected==='boundary');}
  if(expected==='boundary')assert.equal(evaluatePlane3(ellipsePlane3(e),point3(p.x.rational!,p.y.rational!,p.z.rational!)).sign(),0);
 }
 assert.equal(locatePointInEllipse3(algebraicCoordinates3(0n,0n,1n),e),'outside');
});
test('foreign frozen ellipse roots and mutable point records are snapshotted again after warm queries',()=>{
 const frame={origin:O,u:X,v:Y},foreign=Object.freeze({frame,radiusUSquared:point2(4n,1n).x,radiusVSquared:point2(1n,1n).x}),p=algebraicCoordinates3(2n,0n,0n),owned=ellipse3(frame,4n,1n);
 assert.equal(locatePointInEllipse3(p,foreign),'boundary');assert.equal(locatePointInEllipse3(p,foreign),'boundary');
 frame.origin=point3(1n,0n,0n);assert.equal(locatePointInEllipse3(p,foreign),'inside');frame.origin=point3(5n,0n,0n);assert.equal(locatePointInEllipse3(p,foreign),'outside');
 assert.equal(locatePointInEllipse3(p,owned),'boundary');frame.v=X;assert.throws(()=>locatePointInEllipse3(p,foreign),/independent/);assert.throws(()=>ellipsePlane3(foreign),/independent/);
 const e=ellipse3(planeFrame3(O,X,Y),1n,1n),arc=fullEllipseArc3(e),raw={x:AlgebraicReal.fromRational(1n),y:AlgebraicReal.fromRational(0n),z:AlgebraicReal.fromRational(0n)};
 assert.equal(locatePointOnEllipticArc3(raw,arc),'interior');raw.x=AlgebraicReal.fromRational(2n);assert.equal(locatePointOnEllipticArc3(raw,arc),'outside');raw.x=AlgebraicReal.fromRational(0n);raw.y=AlgebraicReal.fromRational(1n);assert.equal(locatePointOnEllipticArc3(raw,arc),'interior');
 const mutable={frame:planeFrame3(O,X,Y),radiusUSquared:point2(4n,0n).x,radiusVSquared:point2(1n,0n).x};assert.equal(locatePointInEllipse3(p,mutable),'boundary');mutable.radiusUSquared=point2(1n,0n).x;assert.equal(locatePointInEllipse3(p,mutable),'outside');mutable.radiusUSquared=point2(0n,0n).x;assert.throws(()=>locatePointInEllipse3(p,mutable),/positive/);
});
test('angular and finite-arc order remain exact across the seam and reversal after cache reuse',()=>{
 const frame=planeFrame3(point3(2n,-3n,5n),point3(1n,1n,0n),point3(0n,1n,1n)),e=ellipse3(frame,1n,1n),local=[['1','0'],['3/5','4/5'],['0','1'],['-3/5','4/5'],['-1','0'],['-3/5','-4/5'],['0','-1'],['3/5','-4/5']] as const,points=local.map(([x,y])=>mapPlanePoint3(frame,point2(x,y)));
 for(let repeat=0;repeat<3;repeat++)for(let i=0;i<points.length;i++)for(let j=0;j<points.length;j++)assert.equal(comparePointsAroundEllipse3(e,points[i]!,points[j]!),Math.sign(i-j));
 const arc=ellipticArc3(e,points[6]!,points[2]!),reverse=reverseEllipticArc3(arc),order=[6,7,0,1,2];
 for(let repeat=0;repeat<3;repeat++){
  points.forEach((p,i)=>{const expected=i===6||i===2?'endpoint':order.includes(i)?'interior':'outside';assert.equal(locatePointOnEllipticArc3(p,arc),expected);assert.equal(locatePointOnEllipticArc3(p,reverse),expected);});
  for(let i=0;i<order.length;i++)for(let j=0;j<order.length;j++){const a=points[order[i]!]!,b=points[order[j]!]!;assert.equal(comparePointsOnEllipticArc3(arc,a,b),Math.sign(i-j));assert.equal(comparePointsOnEllipticArc3(reverse,a,b),Math.sign(j-i));}
 }
 const foreign={...arc,end:points[5]!};assert.equal(locatePointOnEllipticArc3(points[3]!,foreign),'interior');assert.equal(locatePointOnEllipticArc3(points[3]!,arc),'outside');
 assert.throws(()=>locatePointOnEllipticArc3(points[0]!,{...arc,start:algebraicCoordinates3(0n,0n,0n)}),/endpoints/);
});
