import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,lineInterval3,cylinder3,circle3,prepareCircularFace3,prepareRectangleFace3,planeFrame3,prepareFiniteCylinder3,boundaryCylinderMaterialExpression3,partitionPlanarFaceByCurves3,classifyPlanarPartitionMaterial3,boundaryPlanarMaterialCells3,nativeBRepCurve3,sewMixedBRepFaces3,compareAlgebraicPoints3,algebraicCoordinates3} from '../dist/index.js';
import type {Curve3,MixedBRepFace3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n),c=cylinder3(line3(O,Z),1n);
const raw=prepareFiniteCylinder3(c,-1n,1n),material=boundaryCylinderMaterialExpression3([raw],[],{kind:'cylinder',cylinder:0});
function cap(z:bigint,sense:1|-1=1,cuts:readonly Curve3[]=[]){
 const face=prepareCircularFace3(circle3(point3(0n,0n,z),Z,1n),[],sense),partition=partitionPlanarFaceByCurves3(face,cuts),classified=classifyPlanarPartitionMaterial3(partition,material);
 return boundaryPlanarMaterialCells3(classified);
}
test('classified cap cells sew with the actual cylinder wall into closed oriented incidence',()=>{
 for(const sense of [1,-1] as const){
  const top=cap(1n,sense),bottom=cap(-1n,sense);
  for(const [result,z] of [[top,1],[bottom,-1]] as const){
   assert.ok(result.faces.length>0);assert.equal(result.sourceCells.length,result.faces.length);
   result.faces.forEach((f,i)=>{assert.equal(f.surface.kind,'plane');if(f.surface.kind==='plane')assert.equal(f.surface.plane.normal.z.sign()*f.sense,z);assert.equal(result.source.cells[result.sourceCells[i]!]!.kind,'classified');});
   assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.faces)&&Object.isFrozen(result.sourceCells));
  }
  const wall:MixedBRepFace3={surface:{kind:'cylinder',cylinder:c},sense:1,loops:raw.wall.boundary.map(loop=>loop.map(nativeBRepCurve3))};
  const sewn=sewMixedBRepFaces3([...top.faces,...bottom.faces,wall],{requireClosed:true});
  assert.ok(sewn.topology.closedOrientedIncidence);assert.deepEqual(sewn.topology.issues,[]);assert.equal(sewn.topology.shells.length,1);
  assert.ok(sewn.topology.edges.every(e=>e.coedges.length===2));
 }
});
test('unresolved classifications and copied claims cannot be selected as boundaries',()=>{
 const face=prepareRectangleFace3(planeFrame3(point3(0n,0n,1n),X,Y),-2n,2n,-2n,2n),partition=partitionPlanarFaceByCurves3(face,[]),classified=classifyPlanarPartitionMaterial3(partition,material);
 assert.ok(classified.cells.some(c=>c.kind==='unresolved'));
 assert.throws(()=>boundaryPlanarMaterialCells3(classified),/resolved/);
 assert.throws(()=>boundaryPlanarMaterialCells3({...classified,cells:[]}),RangeError);
});
test('interior cross sections do not become material boundary faces',()=>{
 const result=cap(0n);assert.deepEqual(result.faces,[]);assert.deepEqual(result.sourceCells,[]);assert.equal(result.sewn.topology.faces.length,0);
});
test('selected cells retain dangling cut vertices through the shared sewing stage',()=>{
 const a=point3(0n,'-1/2',1n),b=point3(0n,'1/2',1n),cut:Curve3={kind:'line',interval:lineInterval3(line3(a,Y),0n,1n)},result=cap(1n,1,[cut]);
 for(const p of [a,b])assert.ok(result.sewn.topology.vertices.some(v=>compareAlgebraicPoints3(v,algebraicCoordinates3(p.x,p.y,p.z))===0));
 for(const [faceIndex,cell] of result.sourceCells.entries()){
  assert.ok(result.source.cells[cell]!.kind==='classified');assert.equal(result.sewn.sourceUses[faceIndex]!.length,1);
 }
});
