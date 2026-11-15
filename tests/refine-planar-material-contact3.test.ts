import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,planeFrame3,prepareRectangleFace3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,refinePlanarMaterial3,boundaryPlanarMaterialCells3,evaluateCylinder3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
test('a double tangent line and finite height cuts refine without inventing a planar material face',()=>{
 const cylinder=cylinder3(line3(point3(0n,0n,1n),X),1n),raw=prepareFiniteCylinder3(cylinder,-1n,1n),material=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0});
 const face=prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,-2n,2n),source=partitionPlanarFaceByCurves3(face,[]),initial=classifyPlanarPartitionMaterial3(source,material);
 assert.ok(initial.cells.some(c=>c.kind==='unresolved'));
 const result=refinePlanarMaterial3(initial);assert.deepEqual(result.addedSupports,[0,1,2]);assert.ok(result.classification.cells.length>1);
 for(const entry of result.classification.cells)assert.deepEqual(entry,{kind:'classified',minus:false,plus:false,orientation:null});
 assert.deepEqual(boundaryPlanarMaterialCells3(result.classification).faces,[]);
 for(const cell of result.classification.source.cells){
  assert.equal(cell.sample.z.sign(),0);
  const p=point3(cell.sample.x.rational!,cell.sample.y.rational!,0n);assert.ok(evaluateCylinder3(cylinder,p).sign()>0);
 }
});
test('opposite non-unit axis parameterizations insert a coincident wall once and retain the same cap material',()=>{
 const a=cylinder3(line3(O,Z),1n),b=cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),1n),first=prepareFiniteCylinder3(a,-1n,1n),second=prepareFiniteCylinder3(b,2n,'8/3');
 const material=boundaryCylinderMaterialExpression3([first,second],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}});
 const face=prepareRectangleFace3(planeFrame3(point3(0n,0n,1n),X,Y),-2n,2n,-2n,2n),source=partitionPlanarFaceByCurves3(face,[]),initial=classifyPlanarPartitionMaterial3(source,material),result=refinePlanarMaterial3(initial);
 assert.deepEqual(result.addedSupports,[0]);assert.equal(result.classification.source.cutCurves.length,1);assert.ok(result.parentCells.every(i=>i===0));
 result.classification.cells.forEach((entry,i)=>{
  assert.equal(entry.kind,'classified');if(entry.kind!=='classified')return;
  const p=result.classification.source.cells[i]!.sample,q=point3(p.x.rational!,p.y.rational!,1n),inside=evaluateCylinder3(a,q).sign()<0;
  assert.deepEqual(entry,{kind:'classified',minus:inside,plus:false,orientation:inside?1:null});
 });
 assert.ok(boundaryPlanarMaterialCells3(result.classification).faces.length>0);
 const repeated=refinePlanarMaterial3(result.classification);assert.equal(repeated.classification,result.classification);assert.deepEqual(repeated.addedSupports,[]);
});
