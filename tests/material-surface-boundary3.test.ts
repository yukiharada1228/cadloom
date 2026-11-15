import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,boundaryMaterialSurfaces3,createPlanarBody3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
import {assertOwnedMaterialSurfaceBoundary3} from '../dist/geometry/material-surface-boundary3.js';
import {planarSolidFromBoundary3} from '../dist/convert/planar-body3.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),unit=cylinder3(line3(O,Z),1n);
test('one kernel entry assembles both boundary kinds and retains every face origin',()=>{
 const raw=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.ok(result.closedOrientedIncidence&&!result.empty);assert.equal(result.sewn.topology.shells.length,1);assert.equal(result.faces.length,result.faceOrigins.length);
 assert.ok(result.faceOrigins.some(o=>o.kind==='plane'));assert.ok(result.faceOrigins.some(o=>o.kind==='cylinder'));
 result.faceOrigins.forEach((origin,i)=>{
  assert.ok(Object.isFrozen(origin));
  if(origin.kind==='plane')assert.equal(result.faces[i]!.surface.kind,'plane');else assert.equal(result.faces[i]!.surface.kind,'cylinder');
 });
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.faces)&&Object.isFrozen(result.faceOrigins));assertOwnedMaterialSurfaceBoundary3(result);
 assert.throws(()=>assertOwnedMaterialSurfaceBoundary3({...result}),RangeError);assert.throws(()=>boundaryMaterialSurfaces3({...m}),RangeError);
 assert.throws(()=>boundaryMaterialSurfaces3(m,{requireClosed:1 as unknown as boolean}),TypeError);
});
test('a closed internal cavity keeps a separate inward boundary shell',()=>{
 const outer=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n),inner=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([outer,inner],[],{kind:'difference',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.equal(result.sewn.topology.shells.length,2);assert.ok(result.cylindrical.walls[1]!.faces.every(f=>f.sense===-1));
 let innerCaps=0;
 result.faceOrigins.forEach((origin,i)=>{
  if(origin.kind!=='plane')return;const support=result.planar.supports[origin.support]!,cap=support.origins.find(o=>o.kind==='cylinder-cap'&&o.cylinder===1);
  if(!cap||cap.kind!=='cylinder-cap')return;
  const face=result.faces[i]!;assert.equal(face.surface.kind,'plane');if(face.surface.kind==='plane')assert.equal(face.surface.plane.normal.z.sign()*face.sense,cap.cap===0?1:-1);innerCaps++;
 });assert.ok(innerCaps>0);
});
test('a nonparallel cylinder intersection closes using only curved SSI faces',()=>{
 const a=prepareFiniteCylinder3(unit,-2n,2n),b=prepareFiniteCylinder3(cylinder3(line3(O,X),4n),-2n,2n),m=boundaryCylinderMaterialExpression3([a,b],[],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.equal(result.planar.faces.length,0);assert.ok(result.faces.some(f=>f.loops.flat().some(c=>c.kind==='cylinder-ssi')));assert.equal(result.sewn.topology.shells.length,1);
});
test('disjoint regular material remains two separate closed shells',()=>{
 const a=prepareFiniteCylinder3(unit,-1n,1n),b=prepareFiniteCylinder3(cylinder3(line3(point3(4n,0n,0n),Z),1n),-1n,1n),m=boundaryCylinderMaterialExpression3([a,b],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.equal(result.sewn.topology.shells.length,2);assert.ok(result.closedOrientedIncidence);
});
test('balanced tangent contact retains diagnostics and strict incidence rejects it',()=>{
 const a=prepareFiniteCylinder3(unit,-1n,1n),b=prepareFiniteCylinder3(cylinder3(line3(point3(2n,0n,0n),Z),1n),-1n,1n),m=boundaryCylinderMaterialExpression3([a,b],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryMaterialSurfaces3(m);
 assert.ok(!result.empty&&!result.closedOrientedIncidence);assert.ok(result.sewn.topology.issues.length>0);assert.throws(()=>boundaryMaterialSurfaces3(m,{requireClosed:true}),RangeError);
 for(const edge of result.sewn.topology.edges)assert.equal(edge.coedges.reduce((sum,id)=>sum+result.sewn.topology.coedges[id]!.direction,0),0);
});
test('empty material has no invented faces, vertices or provenance',()=>{
 const raw=prepareFiniteCylinder3(unit,-1n,1n),m=boundaryCylinderMaterialExpression3([raw],[],{kind:'xor',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:0}}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.ok(result.empty);assert.deepEqual(result.faces,[]);assert.deepEqual(result.faceOrigins,[]);assert.equal(result.sewn.topology.vertices.length,0);
});
test('an all-planar assembled boundary passes geometric validation and common Body replay',()=>{
 const guard=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n),planes=[plane3(1n,0n,0n,'-1/2'),plane3(-1n,0n,0n,'-1/2'),plane3(0n,1n,0n,'-1/2'),plane3(0n,-1n,0n,'-1/2'),plane3(0n,0n,1n,'-1/2'),plane3(0n,0n,-1n,'-1/2')];
 let expression:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};planes.forEach((_,halfspace)=>{expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};});
 const m=boundaryCylinderMaterialExpression3([guard],planes,expression),result=boundaryMaterialSurfaces3(m,{requireClosed:true});assert.equal(result.cylindrical.faces.length,0);
 const checked=planarSolidFromBoundary3(result.sewn.topology);assert.equal(checked.volume.toString(),'1');const body=createPlanarBody3(checked.polygons),restored=restoreBody3(JSON.parse(serializeBody3(body)));assert.equal(locateBody3(restored,O),'inside');assert.equal(locateBody3(restored,point3(1n,0n,0n)),'outside');
});
test('overlapping finite height bands assemble without duplicate walls or internal caps',()=>{
 const a=prepareFiniteCylinder3(unit,-2n,0n),b=prepareFiniteCylinder3(unit,-1n,2n),m=boundaryCylinderMaterialExpression3([a,b],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryMaterialSurfaces3(m,{requireClosed:true});
 assert.equal(result.sewn.topology.shells.length,1);assert.ok(result.cylindrical.walls.every(w=>w.faces.length>0));
 for(const origin of result.planar.faceOrigins){const p=result.planar.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!.sample;assert.ok(p.z.rational?.toString()==='-2'||p.z.rational?.toString()==='2');}
 assert.ok(result.sewn.topology.vertices.some(p=>p.z.rational?.toString()==='-2'));assert.ok(result.sewn.topology.vertices.some(p=>p.z.rational?.toString()==='2'));
});
