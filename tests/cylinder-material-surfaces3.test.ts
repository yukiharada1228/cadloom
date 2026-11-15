import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,classifyCylinderMaterialWall3,boundaryCylinderMaterialWall3,boundaryCylinderMaterialSurfaces3,boundaryPlanarMaterialSurfaces3,sewMixedBRepFaces3} from '../dist/index.js';
import type {CylinderMaterialBoundary3,CylinderMaterialSurfaces3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),unit=cylinder3(line3(O,Z),1n);
function close(material:CylinderMaterialBoundary3,walls:CylinderMaterialSurfaces3){
 const planar=boundaryPlanarMaterialSurfaces3(material),sewn=sewMixedBRepFaces3([...planar.faces,...walls.faces],{requireClosed:true});
 assert.ok(sewn.topology.closedOrientedIncidence);assert.deepEqual(sewn.topology.issues,[]);return {planar,sewn};
}
test('owned wall cells select outward material and close against the shared planar pipeline',()=>{
 const raw=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0}),classification=classifyCylinderMaterialWall3(m,0),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(classification.cells.every(c=>c.minus&&!c.plus&&c.orientation===1&&c.owner===0));
 assert.ok(walls.faces.length>0);assert.equal(walls.faces.length,walls.faceOrigins.length);assert.ok(Object.isFrozen(walls)&&Object.isFrozen(walls.walls)&&Object.isFrozen(walls.faceOrigins));
 assert.equal(close(m,walls).sewn.topology.shells.length,1);
 for(const bad of [-1,1,NaN,0.5])assert.throws(()=>classifyCylinderMaterialWall3(m,bad),RangeError);
 assert.throws(()=>classifyCylinderMaterialWall3({...m},0),RangeError);assert.throws(()=>boundaryCylinderMaterialWall3({...classification,cells:[]}),RangeError);
});
test('an inner cylindrical void reverses the curved material orientation',()=>{
 const outer=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-1n,1n),inner=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([outer,inner],[],{kind:'difference',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(walls.walls[0]!.source.cells.every(c=>c.minus&&!c.plus&&c.orientation===1));assert.ok(walls.walls[1]!.source.cells.every(c=>!c.minus&&c.plus&&c.orientation===-1));
 assert.ok(walls.walls[1]!.faces.every(f=>f.sense===-1));assert.equal(close(m,walls).sewn.topology.shells.length,1);
});
test('equivalent reversed non-unit axes do not duplicate coincident wall cells',()=>{
 const first=prepareFiniteCylinder3(unit,-1n,1n),second=prepareFiniteCylinder3(cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),1n),2n,'8/3'),m=boundaryCylinderMaterialExpression3([first,second],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(walls.walls[0]!.faces.length>0);assert.equal(walls.walls[1]!.faces.length,0);assert.ok(walls.walls[1]!.source.cells.every(c=>c.owner===0));
 assert.equal(close(m,walls).sewn.topology.shells.length,1);
});
test('coincident walls with different finite heights retain nonoverlapping height bands',()=>{
 const first=prepareFiniteCylinder3(unit,-2n,0n),second=prepareFiniteCylinder3(unit,-1n,2n),m=boundaryCylinderMaterialExpression3([first,second],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(walls.walls.every(w=>w.faces.length>0));
 const secondWall=walls.walls[1]!;
 secondWall.sourceCells.forEach(i=>assert.ok(secondWall.source.source.partition.cells[i]!.sample.z.sign()>0));
 assert.ok(secondWall.source.cells.some(c=>c.owner===0));assert.ok(secondWall.source.cells.some(c=>c.owner===1));
 assert.equal(close(m,walls).sewn.topology.shells.length,1);
});
test('nonparallel cylinder intersection selects SSI-bounded curved cells with no planar remnants',()=>{
 const first=prepareFiniteCylinder3(unit,-2n,2n),second=prepareFiniteCylinder3(cylinder3(line3(O,X),4n),-2n,2n),m=boundaryCylinderMaterialExpression3([first,second],[],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m),result=close(m,walls);
 assert.ok(walls.walls.every(w=>w.faces.length>0));assert.ok(walls.faces.some(f=>f.loops.flat().some(c=>c.kind==='cylinder-ssi')));assert.equal(result.planar.faces.length,0);assert.equal(result.sewn.topology.shells.length,1);
});
test('an empty expression invents no curved boundary',()=>{
 const raw=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([raw],[],{kind:'xor',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:0}}),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(walls.walls[0]!.source.cells.every(c=>!c.minus&&!c.plus&&c.orientation===null));assert.deepEqual(walls.faces,[]);assert.deepEqual(walls.faceOrigins,[]);assert.equal(close(m,walls).sewn.topology.faces.length,0);
});
test('disjoint curved components remain separate closed shells on shared cap planes',()=>{
 const first=prepareFiniteCylinder3(unit,-1n,1n),second=prepareFiniteCylinder3(cylinder3(line3(point3(4n,0n,0n),Z),1n),-1n,1n),m=boundaryCylinderMaterialExpression3([first,second],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m);
 assert.ok(walls.walls.every(w=>w.faces.length>0));assert.equal(close(m,walls).sewn.topology.shells.length,2);
});
test('a tangent union retains nonmanifold contact diagnostics instead of claiming a solid',()=>{
 const first=prepareFiniteCylinder3(unit,-1n,1n),second=prepareFiniteCylinder3(cylinder3(line3(point3(2n,0n,0n),Z),1n),-1n,1n),m=boundaryCylinderMaterialExpression3([first,second],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),walls=boundaryCylinderMaterialSurfaces3(m),planar=boundaryPlanarMaterialSurfaces3(m),sewn=sewMixedBRepFaces3([...planar.faces,...walls.faces]);
 assert.equal(m.manifold,false);assert.equal(sewn.topology.closedOrientedIncidence,false);assert.ok(sewn.topology.issues.some(i=>i.kind==='nonmanifold-edge'||i.kind==='nonmanifold-vertex'));
 assert.throws(()=>sewMixedBRepFaces3([...planar.faces,...walls.faces],{requireClosed:true}),RangeError);
});
