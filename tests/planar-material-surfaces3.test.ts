import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,boundaryPlanarMaterialSurfaces3,boundaryCylinderMaterialSurfaces3,nativeBRepCurve3,sewMixedBRepFaces3,createPlanarBody3,serializeBody3,restoreBody3,locateBody3,planarBodyVolumeMoments3} from '../dist/index.js';
import {planarSolidFromBoundary3} from '../dist/convert/planar-body3.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),c=cylinder3(line3(O,Z),1n),raw=prepareFiniteCylinder3(c,-1n,1n);
function closeWithWall(result:ReturnType<typeof boundaryPlanarMaterialSurfaces3>){
 const sewn=sewMixedBRepFaces3([...result.faces,{surface:{kind:'cylinder',cylinder:c},sense:1,loops:raw.wall.boundary.map(loop=>loop.map(nativeBRepCurve3))}],{requireClosed:true});
 assert.ok(sewn.topology.closedOrientedIncidence);assert.deepEqual(sewn.topology.issues,[]);assert.equal(sewn.topology.shells.length,1);
}
test('all cylinder cap supports run through partition, refinement, selection and shared sewing',()=>{
 const material=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0}),result=boundaryPlanarMaterialSurfaces3(material);
 assert.equal(result.supports.length,2);assert.ok(result.faces.length>0);assert.equal(result.faceOrigins.length,result.faces.length);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.supports)&&Object.isFrozen(result.faces)&&Object.isFrozen(result.faceOrigins));
 result.faceOrigins.forEach((origin,i)=>{
  const support=result.supports[origin.support]!,cell=support.refinement.classification.source.cells[origin.cell]!;
  assert.equal(material.locate(cell.sample),'boundary');assert.equal(result.faces[i]!.surface.kind,'plane');assert.ok(Object.isFrozen(origin)&&Object.isFrozen(support.origins));
 });
 closeWithWall(result);assert.throws(()=>boundaryPlanarMaterialSurfaces3({...material}),RangeError);
});
test('a halfspace coinciding with a cap retains both origins and generates that support once',()=>{
 const material=boundaryCylinderMaterialExpression3([raw],[plane3(0n,0n,2n,-2n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}}),result=boundaryPlanarMaterialSurfaces3(material);
 assert.equal(result.supports.length,2);
 const cap=result.supports.find(s=>s.origins.some(o=>o.kind==='halfspace'))!;assert.equal(cap.origins.length,2);assert.ok(cap.origins.some(o=>o.kind==='cylinder-cap'&&o.cylinder===0&&o.cap===1));
 closeWithWall(result);
});
test('an empty owned expression produces no planar boundary faces',()=>{
 const material=boundaryCylinderMaterialExpression3([raw],[],{kind:'xor',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:0}}),result=boundaryPlanarMaterialSurfaces3(material);
 assert.ok(material.empty);assert.deepEqual(result.faces,[]);assert.deepEqual(result.faceOrigins,[]);assert.equal(result.sewn.topology.faces.length,0);
});
test('a guarded six-plane box yields a checked planar solid and replayable common Body',()=>{
 const guard=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n),planes=[plane3(1n,0n,0n,'-1/2'),plane3(-1n,0n,0n,'-1/2'),plane3(0n,1n,0n,'-1/2'),plane3(0n,-1n,0n,'-1/2'),plane3(0n,0n,1n,'-1/2'),plane3(0n,0n,-1n,'-1/2')];
 let expression:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};planes.forEach((_,halfspace)=>{expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};});
 const material=boundaryCylinderMaterialExpression3([guard],planes,expression),result=boundaryPlanarMaterialSurfaces3(material);
 assert.deepEqual(boundaryCylinderMaterialSurfaces3(material).faces,[]);
 assert.equal(result.supports.length,8);assert.ok(result.sewn.topology.closedOrientedIncidence);assert.deepEqual(result.sewn.topology.issues,[]);
 const checked=planarSolidFromBoundary3(result.sewn.topology);assert.equal(checked.volume.toString(),'1');
 const body=createPlanarBody3(checked.polygons),restored=restoreBody3(JSON.parse(serializeBody3(body)));assert.equal(planarBodyVolumeMoments3(restored).volume.toString(),'1');
 for(const [p,expected] of [[O,'inside'],[point3(1n,0n,0n),'outside'],[point3('1/2',0n,0n),'boundary']] as const)assert.equal(locateBody3(restored,p),expected);
});
test('nonorthogonal planar charts sew with the curved side of an oblique clipped cylinder',()=>{
 const d=point3(1n,2n,2n),cylinder=cylinder3(line3(O,d),1n),operand=prepareFiniteCylinder3(cylinder,-1n,1n),material=boundaryCylinderMaterialExpression3([operand],[plane3(1n,0n,0n,-1n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}});
 assert.ok(material.manifold);const result=boundaryPlanarMaterialSurfaces3(material);assert.equal(result.supports.length,3);
 const walls=material.faces.filter(f=>f.surface.kind==='cylinder').map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]}));assert.ok(walls.length>0);
 const sewn=sewMixedBRepFaces3([...result.faces,...walls],{requireClosed:true});assert.ok(sewn.topology.closedOrientedIncidence);assert.deepEqual(sewn.topology.issues,[]);assert.equal(sewn.topology.shells.length,1);
 for(const origin of result.faceOrigins){const sample=result.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!.sample;assert.equal(material.locate(sample),'boundary');}
});
test('shared cap supports select the union of overlapping cylinders and sew to both curved sides',()=>{
 const other=prepareFiniteCylinder3(cylinder3(line3(point3(1n,0n,0n),Z),1n),-1n,1n),material=boundaryCylinderMaterialExpression3([raw,other],[],{kind:'union',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}}),result=boundaryPlanarMaterialSurfaces3(material);
 assert.equal(result.supports.length,2);assert.ok(result.supports.every(s=>s.origins.length===2));
 const walls=material.faces.filter(f=>f.surface.kind==='cylinder').map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})),sewn=sewMixedBRepFaces3([...result.faces,...walls],{requireClosed:true});
 assert.ok(sewn.topology.closedOrientedIncidence);assert.deepEqual(sewn.topology.issues,[]);assert.equal(sewn.topology.shells.length,1);
 for(const origin of result.faceOrigins){const p=result.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!.sample;assert.equal(material.locate(p),'boundary');}
});
