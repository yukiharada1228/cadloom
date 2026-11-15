import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,planeFrame3,prepareRectangleFace3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,refinePlanarMaterial3,boundaryPlanarMaterialCells3,evaluateCylinder3} from '../dist/index.js';
test('a non-unit oblique cylinder cap refines in a fully spatial rational plane chart',()=>{
 const O=point3(0n,0n,0n),d=point3(1n,2n,2n),u=point3(2n,-1n,0n),v=point3(2n,4n,-5n),cylinder=cylinder3(line3(O,d),1n),raw=prepareFiniteCylinder3(cylinder,-1n,1n);
 const material=boundaryCylinderMaterialExpression3([raw],[plane3(1n,0n,0n,-1n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}});
 const face=prepareRectangleFace3(planeFrame3(d,u,v),-1n,1n,-1n,1n),source=partitionPlanarFaceByCurves3(face,[]),initial=classifyPlanarPartitionMaterial3(source,material);
 assert.ok(initial.cells.some(c=>c.kind==='unresolved'));
 const result=refinePlanarMaterial3(initial);assert.ok(result.classification.cells.every(c=>c.kind==='classified'));
 result.classification.cells.forEach((entry,i)=>{
  if(entry.kind!=='classified')throw new Error('Unresolved oblique cap');
  const p=result.classification.source.cells[i]!.sample,q=point3(p.x.rational!,p.y.rational!,p.z.rational!),inside=evaluateCylinder3(cylinder,q).sign()<0&&q.x.compare(d.x)<0;
  assert.deepEqual(entry,{kind:'classified',minus:inside,plus:false,orientation:inside?1:null});
  assert.equal(source.cells[result.parentCells[i]!]!.locate(p),'inside');
 });
 assert.ok(boundaryPlanarMaterialCells3(result.classification).faces.length>0);
});
