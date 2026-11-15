import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,circle3,fullCircleArc3,circularArc3,plane3,planeFrame3,prepareRectangleFace3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,refinePlanarMaterial3,boundaryPlanarMaterialCells3,evaluateCylinder3} from '../dist/index.js';
import type {Curve3,PlanarPartitionMaterialClassification3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n),center=point3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),raw=prepareFiniteCylinder3(cylinder,-1n,1n),material=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0});
const face=()=>prepareRectangleFace3(planeFrame3(center,X,Y),-2n,2n,-2n,2n);
function check(source:PlanarPartitionMaterialClassification3){
 const result=refinePlanarMaterial3(source);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.parentCells)&&Object.isFrozen(result.addedSupports));
 assert.ok(result.classification.cells.every(c=>c.kind==='classified'));assert.equal(result.parentCells.length,result.classification.cells.length);
 for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++){
  const p=point3(`${x}/4`,`${y}/4`,1n);
  result.classification.source.cells.forEach((cell,i)=>{if(cell.locate(p)==='inside')assert.equal(source.source.cells[result.parentCells[i]!]!.locate(p),'inside');});
 }
 return result;
}
test('an uncut cap automatically inserts its missing circle and selects a material boundary',()=>{
 const partition=partitionPlanarFaceByCurves3(face(),[]),initial=classifyPlanarPartitionMaterial3(partition,material);assert.ok(initial.cells.some(c=>c.kind==='unresolved'));
 const result=check(initial);assert.deepEqual(result.addedSupports,[0]);assert.ok(result.parentCells.every(p=>p===0));
 assert.ok(boundaryPlanarMaterialCells3(result.classification).faces.length>0);
 const again=refinePlanarMaterial3(result.classification);assert.equal(again.classification,result.classification);assert.deepEqual(again.addedSupports,[]);
});
test('a partial circle is completed while retaining the previous cell ancestry',()=>{
 const arc:Curve3={kind:'circular-arc',arc:circularArc3(circle3(center,Z,1n),point3(1n,0n,1n),point3(-1n,0n,1n))};
 const initial=classifyPlanarPartitionMaterial3(partitionPlanarFaceByCurves3(face(),[arc]),material);assert.ok(initial.cells.some(c=>c.kind==='unresolved'));
 const result=check(initial);assert.equal(result.classification.source.cutCurves.length,2);assert.deepEqual(result.addedSupports,[0]);
});
test('an operand-local oblique plane cut is inserted and both material sides match independent inequalities',()=>{
 const m=boundaryCylinderMaterialExpression3([raw],[plane3(1n,1n,0n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}});
 const circle:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(center,Z,1n))};
 const result=check(classifyPlanarPartitionMaterial3(partitionPlanarFaceByCurves3(face(),[circle]),m));assert.deepEqual(result.addedSupports,[3]);
 result.classification.cells.forEach((entry,i)=>{
  assert.equal(entry.kind,'classified');if(entry.kind!=='classified')return;
  const p=result.classification.source.cells[i]!.sample,q=point3(p.x.rational!,p.y.rational!,1n),inside=evaluateCylinder3(cylinder,q).sign()<0&&q.x.add(q.y).sign()<0;
  assert.deepEqual(entry,{kind:'classified',minus:inside,plus:false,orientation:inside?1:null});
 });
});
test('resolved partitions are unchanged and copied classification claims are rejected',()=>{
 const circle:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(center,Z,1n))};
 const initial=classifyPlanarPartitionMaterial3(partitionPlanarFaceByCurves3(face(),[circle]),material),result=check(initial);
 assert.equal(result.classification,initial);assert.deepEqual(result.parentCells,initial.cells.map((_,i)=>i));
 assert.throws(()=>refinePlanarMaterial3({...initial}),RangeError);
});
