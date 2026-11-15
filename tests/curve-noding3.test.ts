import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCurveNodingEvents3,curveNodingPoints3,point3,vector3,line3,lineInterval3,circle3,fullCircleArc3,circularArc3,reverseCurve3,pointOnCurve3,compareAlgebraicPoints3} from '../dist/index.js';
import type {Curve3,Point3} from '../dist/index.js';
const line=(a:Point3,b:Point3):Curve3=>({kind:'line',interval:lineInterval3(line3(a,vector3(b.x.sub(a.x),b.y.sub(a.y),b.z.sub(a.z))),0n,1n)});
const p=(x:bigint,y:bigint,z=0n)=>point3(x,y,z);
function check(a:Curve3,b:Curve3,count:number){
 const events=curveNodingPoints3(a,b);assert.equal(events.length,count);assert.ok(Object.isFrozen(events));
 for(const q of events){assert.ok(pointOnCurve3(q,a));assert.ok(pointOnCurve3(q,b));}
 for(const [A,B] of [[b,a],[reverseCurve3(a),b],[a,reverseCurve3(b)]] as const){
  const other=curveNodingPoints3(A,B);assert.equal(other.length,events.length);
  events.forEach((q,i)=>assert.equal(compareAlgebraicPoints3(q,other[i]!),0));
 }
 return events;
}
test('crossing, skew, endpoint and coincident line events retain exact finite bounds',()=>{
 const a=line(p(0n,0n),p(4n,0n));
 check(a,line(p(2n,-1n),p(2n,1n)),1);
 check(a,line(p(2n,-1n,1n),p(2n,1n,1n)),0);
 check(a,line(p(4n,0n),p(5n,1n)),1);
 const overlap=check(a,line(p(1n,0n),p(3n,0n)),2);
 assert.equal(overlap[0]!.x.rational!.toString(),'1');assert.equal(overlap[1]!.x.rational!.toString(),'3');
 check(a,line(p(5n,0n),p(6n,0n)),0);
});
test('line/conic events distinguish tangent, irrational secant and finite misses',()=>{
 const circle:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(p(0n,0n),vector3(0n,0n,1n),2n))};
 const hits=check(circle,line(p(-2n,0n),p(2n,0n)),2);
 assert.equal(hits[0]!.x.mul(hits[0]!.x).rational!.toString(),'2');
 check(circle,line(p(0n,0n),p(1n,0n)),0);
 const unit:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(p(0n,0n),vector3(0n,0n,1n),1n))};
 check(unit,line(p(-2n,1n),p(2n,1n)),1);
 check(unit,line(p(-2n,2n),p(2n,2n)),0);
});
test('conic events include coincident overlap ends and trim supporting intersections',()=>{
 const c=circle3(p(0n,0n),vector3(0n,0n,1n),1n);
 const upper:Curve3={kind:'circular-arc',arc:circularArc3(c,p(1n,0n),p(-1n,0n))};
 const right:Curve3={kind:'circular-arc',arc:circularArc3(c,p(0n,-1n),p(0n,1n))};
 check(upper,right,2);
 check(upper,{kind:'circular-arc',arc:fullCircleArc3(circle3(p(0n,-2n),vector3(0n,0n,1n),1n))},0);
 const full:Curve3={kind:'circular-arc',arc:fullCircleArc3(c)};
 check(full,full,1);
 check(full,{kind:'circular-arc',arc:fullCircleArc3(circle3(p(1n,0n),vector3(0n,0n,1n),1n))},2);
});

test('multi-curve events merge equal algebraic points and retain every source index',()=>{
 const curves=[line(p(-2n,0n),p(2n,0n)),line(p(0n,-2n),p(0n,2n)),line(p(-1n,-1n),p(1n,1n))];
 const events=collectCurveNodingEvents3(curves);assert.ok(Object.isFrozen(events));assert.equal(events.length,7);
 const origin=events.find(e=>compareAlgebraicPoints3(e.point,{x:e.point.x.affine(0n),y:e.point.y.affine(0n),z:e.point.z.affine(0n)})===0)!;
 assert.deepEqual(origin.curves,[0,1,2]);
 for(const event of events){
  assert.ok(Object.isFrozen(event)&&Object.isFrozen(event.curves));
  assert.deepEqual(event.curves,curves.flatMap((c,i)=>pointOnCurve3(event.point,c)?[i]:[]));
 }
 assert.deepEqual(collectCurveNodingEvents3([]),[]);
 const repeated=collectCurveNodingEvents3([curves[0]!,curves[0]!]);assert.equal(repeated.length,2);
 assert.ok(repeated.every(e=>e.curves.join(',')==='0,1'));
});
