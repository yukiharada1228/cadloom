import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,AlgebraicReal,createBoxBody3,createCylinderBody3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,bodyFromMaterialSurfaceBoundary3,intersectBodyLineMaterial3,locateBody3,restoreBody3,serializeBody3} from '../dist/index.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Z=point3(0n,0n,1n),C:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
const cylinder=(x=0n,r=1n,lo=-1n,hi=1n)=>prepareFiniteCylinder3(cylinder3(line3(point3(x,0n,0n),Z),r),lo,hi);
const body=(cylinders:ReturnType<typeof cylinder>[],expression:CylinderMaterialExpression3)=>bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3(cylinders,[],expression)));
test('box material interval keeps signed exact parameters and a strict rational interior sample',()=>{
 const box=createBoxBody3(O,1n,1n,1n),result=intersectBodyLineMaterial3(box,point3('1/2','1/3','2/5'),point3(2n,0n,0n));assert.ok(result.kind==='regular');
 assert.equal(result.intervals.length,1);assert.equal(result.isolated.length,0);const interval=result.intervals[0]!;
 assert.equal(interval.start.parameter.compare(AlgebraicReal.fromRational('-1/4')),0);assert.equal(interval.end.parameter.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(locateBody3(box,interval.sample),'inside');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.intervals)&&Object.isFrozen(interval));assert.throws(()=>intersectBodyLineMaterial3({...box},O,X),RangeError);assert.throws(()=>intersectBodyLineMaterial3(box,O,O),RangeError);
});
test('cavity and disconnected intersections return separate maximal material intervals after replay',()=>{
 const cavity=restoreBody3(serializeBody3(body([cylinder(0n,4n,-2n,2n),cylinder()],{kind:'difference',first:C,second:{kind:'cylinder',cylinder:1}}))),result=intersectBodyLineMaterial3(cavity,point3(-3n,'1/3','1/4'),X);assert.ok(result.kind==='regular');
 assert.equal(result.intervals.length,2);assert.equal(result.isolated.length,0);assert.equal(result.intervals[0]!.start,result.boundary.hits[0]);assert.equal(result.intervals[0]!.end,result.boundary.hits[1]);assert.equal(result.intervals[1]!.start,result.boundary.hits[2]);assert.equal(result.intervals[1]!.end,result.boundary.hits[3]);
 for(const interval of result.intervals){const p=interval.sample,squared=p.x.mul(p.x).add(p.y.mul(p.y));assert.ok(squared.compare(new Rational(1n))>0&&squared.compare(new Rational(4n))<0);assert.equal(locateBody3(cavity,p),'inside');}
 const disconnected=body([cylinder(),cylinder(4n)],{kind:'union',first:C,second:{kind:'cylinder',cylinder:1}}),separate=intersectBodyLineMaterial3(disconnected,point3(-2n,'1/3','1/4'),X);assert.ok(separate.kind==='regular');assert.equal(separate.intervals.length,2);
});
test('an isolated tangent remains a point and an internal cavity tangency does not split a closed interval',()=>{
 const unit=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),tangent=intersectBodyLineMaterial3(unit,point3('43/5','-26/5',0n),point3(-4n,3n,0n));assert.ok(tangent.kind==='regular');assert.equal(tangent.intervals.length,0);assert.equal(tangent.isolated.length,1);assert.equal(tangent.isolated[0]!.parameter.compare(AlgebraicReal.fromRational(2n)),0);
 const cavity=body([cylinder(0n,4n,-2n,2n),cylinder()],{kind:'difference',first:C,second:{kind:'cylinder',cylinder:1}}),contact=intersectBodyLineMaterial3(cavity,point3('11/5','-2/5','1/4'),point3(-4n,3n,0n));assert.ok(contact.kind==='regular');assert.equal(contact.boundary.hits.length,3);assert.equal(contact.intervals.length,1);assert.equal(contact.isolated.length,0);
});
test('empty material has no intervals and surface-contained queries preserve degeneracy',()=>{
 const empty=body([cylinder()],{kind:'difference',first:C,second:C}),result=intersectBodyLineMaterial3(empty,O,X);assert.ok(result.kind==='regular');assert.deepEqual(result.intervals,[]);assert.deepEqual(result.isolated,[]);
 const box=createBoxBody3(O,1n,1n,1n),surface=intersectBodyLineMaterial3(box,point3('1/2','1/2',0n),X);assert.equal(surface.kind,'degenerate');assert.ok(surface.boundary.containedSupports.length>0);assert.ok(!('intervals' in surface));
});
