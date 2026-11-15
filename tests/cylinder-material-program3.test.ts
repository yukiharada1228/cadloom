import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,assertOwnedCylinderMaterialProgram3,boundaryCylinderMaterialExpression3,materialProgramOfBoundary3} from '../dist/index.js';
import type {CylinderMaterialExpression3,FiniteCylinder3,Plane3} from '../dist/index.js';
const raw=prepareFiniteCylinder3(cylinder3(line3(point3(0n,0n,0n),point3(0n,0n,1n)),1n),-1n,1n);
test('material definitions snapshot inputs without constructing combined boundary data',()=>{
 const cylinders=[raw],planes=[plane3(1n,0n,0n,0n)],leaf={kind:'cylinder' as const,cylinder:0};
 const tree={kind:'intersection' as const,first:leaf,second:{kind:'halfspace' as const,halfspace:0}};
 const program=prepareCylinderMaterialProgram3(cylinders,planes,tree);
 cylinders.length=0;planes.length=0;leaf.cylinder=9;
 assert.equal(program.cylinders[0],raw);assert.equal(program.planes.length,1);
 assert.deepEqual(program.expression,{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}});
 assert.deepEqual(Object.keys(program),['cylinders','planes','expression']);
 assert.ok(Object.isFrozen(program)&&Object.isFrozen(program.cylinders)&&Object.isFrozen(program.planes));
 assert.ok(Object.isFrozen(program.expression));if(program.expression.kind==='intersection')assert.ok(Object.isFrozen(program.expression.first));
 assertOwnedCylinderMaterialProgram3(program);assert.throws(()=>assertOwnedCylinderMaterialProgram3({...program}),RangeError);
});
test('invalid, cyclic, unbounded and sparse definitions are rejected before ownership',()=>{
 const c:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 for(const tree of [{kind:'cylinder',cylinder:-1},{kind:'cylinder',cylinder:0.5},{kind:'halfspace',halfspace:1},{kind:'wat'},null])
  assert.throws(()=>prepareCylinderMaterialProgram3([raw],[],tree as CylinderMaterialExpression3),RangeError);
 const cycle:any={kind:'union',first:c};cycle.second=cycle;
 assert.throws(()=>prepareCylinderMaterialProgram3([raw],[],cycle),/cyclic/);
 assert.throws(()=>prepareCylinderMaterialProgram3([raw],[plane3(1n,0n,0n,0n)],{kind:'union',first:c,second:{kind:'halfspace',halfspace:0}}),/bounded/);
 assert.throws(()=>prepareCylinderMaterialProgram3([],[],c),RangeError);
 assert.throws(()=>prepareCylinderMaterialProgram3([{...raw}],[],c),RangeError);
 assert.throws(()=>prepareCylinderMaterialProgram3(new Array<FiniteCylinder3>(1),[],c),RangeError);
 assert.throws(()=>prepareCylinderMaterialProgram3([raw],new Array<Plane3>(1),c));
});
test('shared expression DAGs are valid and legacy boundaries retain their actual owned program',()=>{
 const leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 const tree:CylinderMaterialExpression3={kind:'xor',first:leaf,second:leaf};
 const program=prepareCylinderMaterialProgram3([raw],[],tree);assertOwnedCylinderMaterialProgram3(program);
 const boundary=boundaryCylinderMaterialExpression3([raw],[],tree),retained=materialProgramOfBoundary3(boundary);
 assertOwnedCylinderMaterialProgram3(retained);assert.equal(retained.expression,boundary.expression);
 assert.equal(retained.cylinders,boundary.cylinders);assert.equal(retained.planes,boundary.planes);
 assert.ok(boundary.empty);assert.equal(boundary.locate(point3(0n,0n,0n)),'outside');
 assert.throws(()=>materialProgramOfBoundary3({...boundary}),RangeError);
 assert.throws(()=>assertOwnedCylinderMaterialProgram3(boundary),RangeError);
});
