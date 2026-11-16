import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,planeFrame3,prepareRectangleFace3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,refinePlanarMaterial3,prepareCircularFace3,circle3,classifyPlanarPartitionSurfaces3,classifyPointToSurface3} from '../dist/index.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n),base=prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,-2n,2n),raw=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n),C:CylinderMaterialExpression3={kind:'cylinder',cylinder:0},H:CylinderMaterialExpression3={kind:'halfspace',halfspace:0};
test('whole-cell false halfspace proves irrelevant curved zeros need no refinement',()=>{
 const program=prepareCylinderMaterialProgram3([raw],[plane3(0n,0n,1n,1n)],{kind:'intersection',first:C,second:H});
 const result=classifyPlanarPartitionMaterial3(partitionPlanarFaceByCurves3(base,[]),program);
 assert.ok(result.supports.cells.some(row=>row.some(c=>c.kind==='cut')));
 assert.ok(result.cells.every(c=>c.kind==='classified'&&!c.minus&&!c.plus));
 const refined=refinePlanarMaterial3(result);assert.equal(refined.classification,result);assert.deepEqual(refined.addedSupports,[]);
});
test('unknown relevant zeros remain unresolved through Boolean range evaluation',()=>{
 const program=prepareCylinderMaterialProgram3([raw],[],C),source=classifyPlanarPartitionMaterial3(partitionPlanarFaceByCurves3(base,[]),program);
 assert.ok(source.cells.some(c=>c.kind==='unresolved'));
 const refined=refinePlanarMaterial3(source);assert.ok(refined.addedSupports.length>0);assert.ok(refined.classification.cells.every(c=>c.kind==='classified'));
});

test('rational zero carriers choose strict rational witnesses between irrational circle intersections',()=>{
 const source=partitionPlanarFaceByCurves3(prepareCircularFace3(circle3(O,Z,2n)),[]),plane=plane3(0n,1n,0n,'-1/3');
 const result=classifyPlanarPartitionSurfaces3(source,[{kind:'plane',plane}]);let count=0;
 result.cells.forEach((row,i)=>{for(const entry of row)if(entry.kind==='cut'){
  count++;assert.ok(['x','y','z'].every(k=>entry.point[k as 'x'|'y'|'z'].rational!==null));
  assert.equal(source.cells[i]!.locate(entry.point),'inside');assert.equal(classifyPointToSurface3(entry.point,{kind:'plane',plane}),0);
 }});assert.ok(count>0);
});
test('irrational cylinder generators retain a strict witness on their verified rational direction',()=>{
 const face=prepareRectangleFace3(planeFrame3(O,Y,Z),-2n,2n,-2n,2n),source=partitionPlanarFaceByCurves3(face,[]),surface={kind:'cylinder' as const,cylinder:cylinder3(line3(O,Z),2n)},result=classifyPlanarPartitionSurfaces3(source,[surface]);
 let count=0;result.cells.forEach((row,i)=>row.forEach(entry=>{if(entry.kind!=='cut')return;count++;
  assert.equal(source.cells[i]!.locate(entry.point),'inside');assert.equal(classifyPointToSurface3(entry.point,surface),0);assert.notEqual(entry.point.z.rational,null);
 }));assert.ok(count>0);
});
