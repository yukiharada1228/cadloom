import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,AlgebraicReal,createBoxBody3,createCylinderBody3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,bodyFromMaterialSurfaceBoundary3,intersectBodyLine3,intersectBodyRay3,restoreBody3,serializeBody3} from '../dist/index.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Z=point3(0n,0n,1n),leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
const c=(x=0n,r=1n,lo=-1n,hi=1n)=>prepareFiniteCylinder3(cylinder3(line3(point3(x,0n,0n),Z),r),lo,hi);
const body=(cylinders:ReturnType<typeof c>[],expression:CylinderMaterialExpression3)=>bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3(cylinders,[],expression)));
const parameters=(r:ReturnType<typeof intersectBodyLine3>)=>{assert.ok(r.kind!=='unresolved');return r.hits.map(h=>h.parameter.rational?.toString());};
test('native box line and forward ray queries preserve signed parameters and direction scaling',()=>{
 const box=restoreBody3(serializeBody3(createBoxBody3(O,1n,1n,1n))),origin=point3('-1/2','1/3','2/5');
 const result=intersectBodyLine3(box,origin,point3(2n,0n,0n));assert.equal(result.kind,'regular');assert.deepEqual(parameters(result),['1/4','3/4']);
 assert.deepEqual(parameters(intersectBodyRay3(box,point3('1/2','1/3','2/5'),point3(2n,0n,0n))),['1/4']);
 assert.deepEqual(parameters(intersectBodyLine3(box,point3('1/2','1/3','2/5'),point3(2n,0n,0n))),['-1/4','1/4']);
 assert.equal(intersectBodyRay3(box,origin,point3(-1n,0n,0n)).hits.length,0);assert.equal(intersectBodyRay3(box,point3(0n,'1/3','2/5'),X).hits[0]!.parameter.sign(),0);
 assert.deepEqual(parameters(intersectBodyLine3(box,origin,point3(2n,0n,0n),0)),parameters(result));
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.hits)&&result.hits.every(h=>Object.isFrozen(h)&&Object.isFrozen(h.uses)));
 assert.throws(()=>intersectBodyRay3({...box},origin,X),RangeError);assert.throws(()=>intersectBodyRay3(box,origin,O),RangeError);
 for(const shell of [-1,1,0.5])assert.throws(()=>intersectBodyLine3(box,origin,X,shell),RangeError);
});
test('irrational cylinder roots remain exact and tangent multiplicity is retained',()=>{
 const cylinder=createCylinderBody3(cylinder3(line3(O,Z),2n),-1n,1n),result=intersectBodyRay3(cylinder,point3(-2n,0n,0n),X),root=AlgebraicReal.fromRational(2n).sqrt();
 assert.equal(result.hits.length,2);assert.equal(result.hits[0]!.parameter.compare(root.neg().affine(1n,2n)),0);assert.equal(result.hits[1]!.parameter.compare(root.affine(1n,2n)),0);
 assert.equal(result.hits[0]!.point.x.compare(root.neg()),0);assert.equal(result.hits[1]!.point.x.compare(root),0);
 const unit=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),tangent=intersectBodyRay3(unit,point3('43/5','-26/5',0n),point3(-4n,3n,0n));
 assert.equal(tangent.hits.length,1);assert.equal(tangent.hits[0]!.parameter.rational?.toString(),'2');assert.ok(tangent.hits[0]!.uses.every(u=>u.multiplicity===2));
});
test('cavities, disconnected material and empty results expose actual boundary events after replay',()=>{
 const cavity=restoreBody3(serializeBody3(body([c(0n,4n,-2n,2n),c()],{kind:'difference',first:leaf,second:{kind:'cylinder',cylinder:1}}))),ray=intersectBodyRay3(cavity,point3(-3n,0n,0n),X);
 assert.equal(ray.hits.length,4);['1','2','4','5'].forEach((v,i)=>assert.equal(ray.hits[i]!.parameter.compare(AlgebraicReal.fromRational(v)),0));assert.equal(intersectBodyRay3(cavity,point3(-3n,0n,0n),X,0).hits.length,2);
 const disjoint=body([c(),c(4n)],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}});const events=intersectBodyRay3(disjoint,point3(-2n,0n,0n),X);assert.equal(events.hits.length,4);['1','3','5','7'].forEach((v,i)=>assert.equal(events.hits[i]!.parameter.compare(AlgebraicReal.fromRational(v)),0));
 const empty=body([c()],{kind:'xor',first:leaf,second:leaf}),none=intersectBodyLine3(empty,O,X);assert.equal(none.kind,'regular');assert.deepEqual(none.hits,[]);assert.deepEqual(none.containedSupports,[]);
});
test('surface containment and edge contacts remain explicit degeneracies',()=>{
 const box=createBoxBody3(O,1n,1n,1n),coplanar=intersectBodyRay3(box,point3('1/2','1/2',0n),X),edge=intersectBodyLine3(box,point3(-1n,0n,0n),X);
 assert.equal(coplanar.kind,'degenerate');assert.ok(coplanar.containedSupports.length>0);assert.equal(edge.kind,'degenerate');assert.ok(edge.hits.some(h=>h.uses.some(u=>u.location==='boundary')));
});
