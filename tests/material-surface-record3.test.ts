import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,bodyRecordFromMaterialSurfaceBoundary3,restoreMixedBRepFaces3} from '../dist/index.js';
import type {CylinderMaterialExpression3,MaterialSurfaceBoundary3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n);
function replay(source:MaterialSurfaceBoundary3){
 const record=bodyRecordFromMaterialSurfaceBoundary3(source,[{shells:source.sewn.topology.shells.map((_,i)=>i),void:false}]);
 const decoded=restoreMixedBRepFaces3(JSON.parse(JSON.stringify(record)));
 assert.equal(decoded.faces.length,source.faces.length);assert.equal(decoded.boundary.topology.shells.length,source.sewn.topology.shells.length);
 source.faceOrigins.forEach((origin,i)=>{
  const sample=origin.kind==='plane'?source.planar.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!.sample:source.cylindrical.walls[origin.cylinder]!.source.source.partition.cells[origin.cell]!.sample;
  assert.equal(decoded.faces[i]!.locate(sample),'inside');assert.equal(decoded.faces[i]!.sense,source.faces[i]!.sense);
 });return record;
}
test('definition-driven cylinder boundary exports and rebinds both planar and curved cells',()=>{
 const c=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n),source=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([c],[],{kind:'cylinder',cylinder:0}),{requireClosed:true});
 const record=replay(source);assert.ok(record.faces.some(f=>f.domain?.kind==='planar-curve-partition-cell'));assert.ok(record.faces.some(f=>f.domain?.kind==='cylinder-refined-cell'));
 assert.throws(()=>bodyRecordFromMaterialSurfaceBoundary3({...source},record.regions),RangeError);
 const planar=record.faces.findIndex(f=>f.domain?.kind==='planar-curve-partition-cell'),wrong=JSON.parse(JSON.stringify(record));wrong.faces[planar].domain.orientation*=-1;
 assert.throws(()=>restoreMixedBRepFaces3(wrong),RangeError);
});
test('cavity shell orientations and SSI curve domains survive exact record restoration',()=>{
 const outer=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n),inner=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n);
 const difference:CylinderMaterialExpression3={kind:'difference',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:1}};
 const cavity=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([outer,inner],[],difference),{requireClosed:true});assert.equal(replay(cavity).shells.length,2);
 const other=prepareFiniteCylinder3(cylinder3(line3(O,X),4n),-2n,2n),intersection:CylinderMaterialExpression3={...difference,kind:'intersection'};
 const tall=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-2n,2n),ssi=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([tall,other],[],intersection),{requireClosed:true});
 assert.ok(ssi.faces.some(f=>f.loops.some(loop=>loop.some(c=>c.kind==='cylinder-ssi'))));
 const record=replay(ssi);assert.ok(record.faces.some(f=>f.domain?.kind==='cylinder-refined-cell'));
});
test('empty selection round-trips without inventing geometry or material certification',()=>{
 const c=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n),leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 const source=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([c],[],{kind:'xor',first:leaf,second:leaf})),record=replay(source);
 assert.equal(record.faces.length,0);assert.equal(record.shells.length,0);
});
