import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,bodyFromMaterialSurfaceBoundary3,createCylinderBody3,booleanCylinderBodies3,booleanMixedBodies3,clipCylinderExpressionBody3,locateBody3,restoreBody3,serializeBody3,booleanCylinderMaterialPrograms3,clipCylinderMaterialProgram3,strictCylinderMaterialProgramLocation3,createBoxBody3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),cyl=(x=0n,r=1n)=>cylinder3(line3(point3(x,0n,0n),Z),r);
const program=(x=0n,r=1n)=>prepareCylinderMaterialProgram3([prepareFiniteCylinder3(cyl(x,r),-1n,1n)],[],{kind:'cylinder',cylinder:0});
const body=(x=0n,r=1n)=>bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(program(x,r)));
const replay=(b:ReturnType<typeof body>)=>restoreBody3(serializeBody3(b));
test('new and primitive Bodies support all four Boolean operations and replayed results stay operands',()=>{
 const a=body(),b=createCylinderBody3(cyl(4n),-1n,1n);
 for(const operation of ['union','intersection','difference','xor'] as const){
  const r=replay(booleanCylinderBodies3(a,b,operation));assert.equal(r.construction.kind,'surface-material-expression');
  assert.equal(locateBody3(r,O),operation==='intersection'?'outside':'inside');assert.equal(locateBody3(r,point3(4n,0n,0n)),operation==='union'||operation==='xor'?'inside':'outside');
 }
 const joined=replay(booleanMixedBodies3(a,b,'union')),removed=replay(booleanMixedBodies3(joined,a,'difference'));
 assert.equal(locateBody3(removed,O),'outside');assert.equal(locateBody3(removed,point3(4n,0n,0n)),'inside');
 const cut=replay(clipCylinderExpressionBody3(removed,[{plane:plane3(0n,1n,0n,0n),side:-1}]));
 assert.equal(locateBody3(cut,point3(4n,'-1/2',0n)),'inside');assert.equal(locateBody3(cut,point3(4n,'1/2',0n)),'outside');
});
test('program composition keeps operand-local cuts, remaps plane indices and checks ownership',()=>{
 const a=clipCylinderMaterialProgram3(program(),[{plane:plane3(1n,0n,0n,0n),side:-1}]),b=clipCylinderMaterialProgram3(program(4n),[{plane:plane3(0n,1n,0n,0n),side:1}]),joined=booleanCylinderMaterialPrograms3(a,b,'union');
 for(const [p,expected] of [[point3('-1/2',0n,0n),'inside'],[point3('1/2',0n,0n),'outside'],[point3(4n,'1/2',0n),'inside'],[point3(4n,'-1/2',0n),'outside']] as const)assert.equal(strictCylinderMaterialProgramLocation3(joined,p),expected);
 assert.throws(()=>booleanCylinderMaterialPrograms3({...a},b,'union'),RangeError);assert.throws(()=>booleanCylinderMaterialPrograms3(a,b,'wat' as 'union'),RangeError);
 assert.throws(()=>clipCylinderMaterialProgram3(a,[{plane:plane3(1n,0n,0n,0n),side:0 as 1}]),RangeError);
});
test('mixed box and direct material results compose through the common Body entry',()=>{
 const cylinder=body(0n,4n),box=createBoxBody3(point3('-1/2','-1/2','-1/2'),1n,1n,1n),r=replay(booleanMixedBodies3(cylinder,box,'difference'));
 assert.equal(locateBody3(r,O),'outside');assert.equal(locateBody3(r,point3(1n,0n,0n)),'inside');
 assert.throws(()=>booleanMixedBodies3({...r},box,'union'),RangeError);
});
