import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareBoxMaterialProgram3,strictCylinderMaterialProgramLocation3,createBoxBody3,createCylinderBody3,createClippedCylinderBody3,booleanMaterialBodies3,locateBody3,restoreBody3,serializeBody3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n);
test('box definitions are owned bounded programs with exact independent strict membership',()=>{
 const p=prepareBoxMaterialProgram3(point3('-1/2','-1/2','-1/2'),1n,1n,1n);assert.equal(p.planes.length,6);
 for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++)for(let z=-4;z<=4;z++){
  const q=point3(`${2*x+1}/8`,`${2*y+1}/8`,`${2*z+1}/8`),value=strictCylinderMaterialProgramLocation3(p,q);
  assert.notEqual(value,null);assert.equal(value,Math.abs(2*x+1)<4&&Math.abs(2*y+1)<4&&Math.abs(2*z+1)<4?'inside':'outside');
 }
 assert.throws(()=>prepareBoxMaterialProgram3(O,0n,1n,1n),RangeError);
});
test('two legacy clipped Bodies enter the new kernel directly and retain local cuts through replay',()=>{
 const first=createClippedCylinderBody3(cylinder,-1n,1n,[{plane:plane3(1n,0n,0n,0n),side:-1}]),second=createClippedCylinderBody3(cylinder,-1n,1n,[{plane:plane3(0n,1n,0n,0n),side:1}]);
 const result=restoreBody3(serializeBody3(booleanMaterialBodies3(first,second,'difference')));assert.equal(result.construction.kind,'surface-material-expression');
 assert.equal(locateBody3(result,point3('-1/4','-1/4',0n)),'inside');assert.equal(locateBody3(result,point3('-1/4','1/4',0n)),'outside');
 const reunited=restoreBody3(serializeBody3(booleanMaterialBodies3(result,first,'union')));assert.equal(locateBody3(reunited,point3('-1/4','1/4',0n)),'inside');
 assert.throws(()=>booleanMaterialBodies3({...first},second,'union'),RangeError);assert.throws(()=>booleanMaterialBodies3(first,second,'wat' as 'union'),RangeError);
});
test('a box and legacy primitive enter the new kernel without an old box boundary prerequisite',()=>{
 const box=createBoxBody3(point3('-1/2','-1/2','-1/2'),1n,1n,1n),guard=createCylinderBody3(cylinder3(line3(point3('-1/2','-1/2',0n),Z),3n),-2n,2n),result=restoreBody3(serializeBody3(booleanMaterialBodies3(box,guard,'intersection')));
 assert.equal(result.construction.kind,'surface-material-expression');assert.equal(locateBody3(result,O),'inside');assert.equal(locateBody3(result,point3(1n,0n,0n)),'outside');
 assert.ok(result.topology.faces.every(f=>f.surface.kind==='plane'));
});
