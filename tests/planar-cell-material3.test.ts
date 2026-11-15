import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,plane3,line3,cylinder3,circle3,fullCircleArc3,planeFrame3,prepareRectangleFace3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,evaluateCylinder3} from '../dist/index.js';
import type {Curve3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n);
const material=()=>boundaryCylinderMaterialExpression3([prepareFiniteCylinder3(cylinder,-1n,1n)],[],{kind:'cylinder',cylinder:0});
function partition(z:bigint,radii:readonly bigint[]=[1n]){
 const origin=point3(0n,0n,z),face=prepareRectangleFace3(planeFrame3(origin,X,Y),-3n,3n,-3n,3n);
 const curves:Curve3[]=radii.map(r=>({kind:'circular-arc',arc:fullCircleArc3(circle3(origin,Z,r))}));
 return partitionPlanarFaceByCurves3(face,curves);
}
test('whole-cell material sides select the upper and lower cap with opposite orientation',()=>{
 const m=material();
 for(const z of [-1n,0n,1n,3n]){
  const source=partition(z),result=classifyPlanarPartitionMaterial3(source,m);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.cells));
  result.cells.forEach((e,i)=>{
   assert.equal(e.kind,'classified');if(e.kind!=='classified')return;
   const p=source.cells[i]!.sample,q=point3(p.x.rational!,p.y.rational!,z),radial=evaluateCylinder3(cylinder,q).sign()<0;
   const minus=radial&&(z===0n||z===1n),plus=radial&&(z===0n||z===-1n);
   assert.deepEqual(e,{kind:'classified',minus,plus,orientation:minus===plus?null:minus?1:-1});
  });
 }
});
test('unpartitioned primitive zeros remain unresolved with an interior witness',()=>{
 const face=prepareRectangleFace3(planeFrame3(point3(0n,0n,1n),X,Y),-3n,3n,-3n,3n),source=partitionPlanarFaceByCurves3(face,[]),m=material();
 const result=classifyPlanarPartitionMaterial3(source,m);assert.ok(result.cells.every(e=>e.kind==='unresolved'));
 for(const e of result.cells)if(e.kind==='unresolved'){assert.ok(e.cuts.length>0);assert.ok(Object.isFrozen(e.cuts));}
 assert.throws(()=>classifyPlanarPartitionMaterial3(source,{...m}),RangeError);
});
test('difference predicates retain cap material only between the two cylinder walls',()=>{
 const outer=cylinder3(line3(O,Z),4n),m=boundaryCylinderMaterialExpression3([prepareFiniteCylinder3(outer,-1n,1n),prepareFiniteCylinder3(cylinder,-1n,1n)],[],{kind:'difference',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}});
 const source=partition(1n,[4n,1n]),result=classifyPlanarPartitionMaterial3(source,m);
 result.cells.forEach((e,i)=>{
  assert.equal(e.kind,'classified');if(e.kind!=='classified')return;
  const p=source.cells[i]!.sample,q=point3(p.x.rational!,p.y.rational!,1n),inside=evaluateCylinder3(outer,q).sign()<0&&evaluateCylinder3(cylinder,q).sign()>0;
  assert.deepEqual(e,{kind:'classified',minus:inside,plus:false,orientation:inside?1:null});
 });
 assert.ok(result.cells.some(e=>e.kind==='classified'&&e.orientation===1));
});

test('operand-local halfspace cuts classify their cap on both normal sides',()=>{
 const m=boundaryCylinderMaterialExpression3([prepareFiniteCylinder3(cylinder,-1n,1n)],[plane3(0n,0n,1n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}});
 const source=partition(0n),result=classifyPlanarPartitionMaterial3(source,m);
 result.cells.forEach((e,i)=>{
  assert.equal(e.kind,'classified');if(e.kind!=='classified')return;
  const p=source.cells[i]!.sample,inside=evaluateCylinder3(cylinder,point3(p.x.rational!,p.y.rational!,0n)).sign()<0;
  assert.deepEqual(e,{kind:'classified',minus:inside,plus:false,orientation:inside?1:null});
 });
});
