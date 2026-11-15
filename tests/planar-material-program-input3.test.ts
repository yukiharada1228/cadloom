import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryPlanarMaterialSurfaces3,boundaryCylinderMaterialExpression3,nativeBRepCurve3,sewMixedBRepFaces3} from '../dist/index.js';
import {planarSolidFromBoundary3} from '../dist/convert/planar-body3.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n);
test('program-only cap construction closes with the primitive wall and rejects structural copies',()=>{
 const raw=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n),program=prepareCylinderMaterialProgram3([raw],[],{kind:'cylinder',cylinder:0});
 const result=boundaryPlanarMaterialSurfaces3(program);
 assert.equal(result.material,program);assert.equal(result.supports.length,2);
 const sewn=sewMixedBRepFaces3([...result.faces,{surface:{kind:'cylinder',cylinder:raw.cylinder},sense:1,loops:raw.wall.boundary.map(loop=>loop.map(nativeBRepCurve3))}],{requireClosed:true});
 assert.ok(sewn.topology.closedOrientedIncidence);assert.equal(sewn.topology.shells.length,1);
 assert.throws(()=>boundaryPlanarMaterialSurfaces3({...program}),RangeError);
 for(const s of result.supports)assert.equal(s.refinement.classification.material,program);
});
test('a program-only six-plane solid passes geometric validation without first building a material boundary',()=>{
 const guard=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n);
 const planes=[plane3(1n,0n,0n,'-1/2'),plane3(-1n,0n,0n,'-1/2'),plane3(0n,1n,0n,'-1/2'),plane3(0n,-1n,0n,'-1/2'),plane3(0n,0n,1n,'-1/2'),plane3(0n,0n,-1n,'-1/2')];
 let expression:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 planes.forEach((_,halfspace)=>{expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};});
 const result=boundaryPlanarMaterialSurfaces3(prepareCylinderMaterialProgram3([guard],planes,expression));
 assert.ok(result.sewn.topology.closedOrientedIncidence);assert.equal(planarSolidFromBoundary3(result.sewn.topology).volume.toString(),'1');
 assert.ok(result.supports.every(s=>s.refinement.classification.cells.every(c=>c.kind==='classified')));
});
test('oblique program refinement agrees with legacy-owned input and empty programs select no boundary',()=>{
 const raw=prepareFiniteCylinder3(cylinder3(line3(O,point3(1n,2n,2n)),1n),-1n,1n),planes=[plane3(1n,0n,0n,-1n)];
 const expression:CylinderMaterialExpression3={kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}};
 const direct=boundaryPlanarMaterialSurfaces3(prepareCylinderMaterialProgram3([raw],planes,expression));
 const legacy=boundaryPlanarMaterialSurfaces3(boundaryCylinderMaterialExpression3([raw],planes,expression));
 assert.deepEqual(direct.faceOrigins,legacy.faceOrigins);assert.deepEqual(direct.sewn.topology,legacy.sewn.topology);
 assert.ok(direct.supports.some(s=>s.refinement.addedSupports.length>0));
 const leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 const empty=boundaryPlanarMaterialSurfaces3(prepareCylinderMaterialProgram3([raw],[],{kind:'xor',first:leaf,second:leaf}));
 assert.deepEqual(empty.faces,[]);assert.deepEqual(empty.faceOrigins,[]);
});
