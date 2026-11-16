import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,line3,cylinder3,createBoxBody3,createCylinderBody3,createPlanarBody3,extrudeBody3,booleanPlanarBodies3,closestPointOnPlanarBodyBoundary3,locateBody3,serializeBody3,restoreBody3,similarityTransform3,transformBody3,transformPointBySimilarity3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const ring=(xy:readonly (readonly [bigint,bigint])[])=>{const p=xy.map(([x,y])=>point2(x,y));return p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));};
const keys=(p:readonly ReturnType<typeof point3>[])=>p.map(v=>[v.x,v.y,v.z].map(q=>q.toString()).join(',')).sort();
test('finite box boundary chooses face, edge and vertex minima and keeps all six interior ties',()=>{
 const box=createBoxBody3(O,1n,1n,1n);
 for(const [p,q,d] of [[point3(2n,'1/2','1/2'),point3(1n,'1/2','1/2'),'1'],[point3(2n,2n,'1/2'),point3(1n,1n,'1/2'),'2'],[point3(2n,2n,2n),point3(1n,1n,1n),'3'],[O,O,'0']] as const){const r=closestPointOnPlanarBodyBoundary3(box,p);assert.ok(r.kind==='points');assert.equal(r.squaredDistance.toString(),d);assert.deepEqual(r.points,[q]);}
 const center=closestPointOnPlanarBodyBoundary3(box,point3('1/2','1/2','1/2'));assert.ok(center.kind==='points');assert.equal(center.squaredDistance.toString(),'1/4');assert.equal(center.points.length,6);assert.ok(center.points.every(p=>locateBody3(box,p)==='boundary'));assert.ok(Object.isFrozen(center)&&Object.isFrozen(center.points));
 assert.throws(()=>closestPointOnPlanarBodyBoundary3({...box},O),RangeError);
});
test('through-hole and concave face projections cannot win outside their finite domains',()=>{
 const plate=restoreBody3(serializeBody3(extrudeBody3([ring([[-2n,-2n],[2n,-2n],[2n,2n],[-2n,2n]]),ring([[-1n,-1n],[-1n,1n],[1n,1n],[1n,-1n]])],2n,{fillRule:'nonzero'}))),hole=closestPointOnPlanarBodyBoundary3(plate,point3(0n,0n,1n));assert.ok(hole.kind==='points');assert.equal(hole.squaredDistance.toString(),'1');assert.deepEqual(keys(hole.points),keys([point3(-1n,0n,1n),point3(1n,0n,1n),point3(0n,-1n,1n),point3(0n,1n,1n)]));
 const l=extrudeBody3([ring([[0n,0n],[2n,0n],[2n,1n],[1n,1n],[1n,2n],[0n,2n]])],2n),notch=closestPointOnPlanarBodyBoundary3(l,point3('3/2','3/2',1n));assert.ok(notch.kind==='points');assert.equal(notch.squaredDistance.toString(),'1/4');assert.deepEqual(keys(notch.points),keys([point3(1n,'3/2',1n),point3('3/2',1n,1n)]));
});
test('cavity shells and disconnected components participate in the same global minimum',()=>{
 const cavity=booleanPlanarBodies3(createBoxBody3(O,4n,4n,4n),createBoxBody3(point3(1n,1n,1n),2n,2n,2n),'difference'),result=closestPointOnPlanarBodyBoundary3(cavity,point3(2n,2n,2n));assert.ok(result.kind==='points');assert.equal(result.squaredDistance.toString(),'1');assert.equal(result.points.length,6);assert.ok(result.points.every(p=>locateBody3(cavity,p)==='boundary'));
 const disjoint=booleanPlanarBodies3(createBoxBody3(O,1n,1n,1n),createBoxBody3(point3(3n,0n,0n),1n,1n,1n),'union'),both=closestPointOnPlanarBodyBoundary3(disjoint,point3(2n,'1/2','1/2'));assert.ok(both.kind==='points');assert.deepEqual(keys(both.points),keys([point3(1n,'1/2','1/2'),point3(3n,'1/2','1/2')]));
});
test('similarity covariance, empty material and explicit curved-backend rejection remain exact',()=>{
 const box=createBoxBody3(O,1n,1n,1n),p=point3('1/2','1/2','1/2'),t=similarityTransform3([point3(-2n,0n,0n),point3(0n,2n,0n),point3(0n,0n,2n)],point3(10n,-3n,5n)),target=restoreBody3(serializeBody3(transformBody3(box,t))),a=closestPointOnPlanarBodyBoundary3(box,p),b=closestPointOnPlanarBodyBoundary3(target,transformPointBySimilarity3(t,p));assert.ok(a.kind==='points'&&b.kind==='points');assert.equal(b.squaredDistance.toString(),'1');assert.deepEqual(keys(b.points),keys(a.points.map(p=>transformPointBySimilarity3(t,p))));
 assert.deepEqual(closestPointOnPlanarBodyBoundary3(createPlanarBody3([]),O),{kind:'empty'});
 assert.throws(()=>closestPointOnPlanarBodyBoundary3(createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),O),/curved/);
});

test('large translations and sub-floating precision separations retain a positive exact distance',()=>{
 const B=10n**30n,D=10n**40n,box=createBoxBody3(point3(B,B,B),1n,1n,1n),p=point3(new Rational(B+1n).add(new Rational(1n,D)),new Rational(B).add(new Rational(1n,3n)),new Rational(B).add(new Rational(2n,5n))),result=closestPointOnPlanarBodyBoundary3(box,p);
 assert.ok(result.kind==='points');assert.ok(result.squaredDistance.sign()>0);assert.equal(result.squaredDistance.compare(new Rational(1n,D*D)),0);assert.equal(result.points.length,1);assert.equal(result.points[0]!.x.compare(new Rational(B+1n)),0);assert.equal(result.points[0]!.y.compare(p.y),0);assert.equal(result.points[0]!.z.compare(p.z),0);
});
