import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,locateMaterialSurfaceBoundary3,boundaryCylinderMaterialExpression3} from '../dist/index.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
const raw=(lo=-1n,hi=1n)=>prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),lo,hi);
test('selected bounded domains determine primitive faces, edges, interior and exterior',()=>{
 const source=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([raw()],[],leaf));
 for(const [p,expected] of [[O,'inside'],[point3(1n,0n,0n),'boundary'],[point3(1n,0n,1n),'boundary'],[point3(0n,0n,1n),'boundary'],[point3(1n,0n,2n),'outside'],[point3(2n,0n,0n),'outside']] as const)assert.equal(locateMaterialSurfaceBoundary3(source,p),expected);
 assert.throws(()=>locateMaterialSurfaceBoundary3({...source},O),RangeError);
 for(const origin of source.faceOrigins){const p=origin.kind==='plane'?source.planar.supports[origin.support]!.refinement.classification.source.cells[origin.cell]!.sample:source.cylindrical.walls[origin.cylinder]!.source.source.partition.cells[origin.cell]!.sample;assert.equal(locateMaterialSurfaceBoundary3(source,p),'boundary');}
});
test('cancelled caps and inactive halfspace zeros are interior rather than boundary',()=>{
 const a=raw(-2n,0n),b=raw(0n,2n),tree:CylinderMaterialExpression3={kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}},source=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([a,b],[],tree));
 assert.equal(locateMaterialSurfaceBoundary3(source,O),'inside');assert.equal(locateMaterialSurfaceBoundary3(source,point3(1n,0n,0n)),'boundary');
 const redundant=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([raw()],[plane3(1n,0n,0n,0n)],{kind:'union',first:leaf,second:{kind:'intersection',first:leaf,second:{kind:'halfspace',halfspace:0}}}));
 assert.equal(locateMaterialSurfaceBoundary3(redundant,O),'inside');
 const empty=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([raw()],[],{kind:'difference',first:leaf,second:leaf}));
 assert.equal(locateMaterialSurfaceBoundary3(empty,O),'outside');assert.equal(locateMaterialSurfaceBoundary3(empty,point3(1n,0n,0n)),'outside');
});
test('oblique clipping matches legacy membership on a rational grid including primitive seams',()=>{
 const cylinders=[raw(-2n,2n)],planes=[plane3(2n,0n,1n,0n)],tree:CylinderMaterialExpression3={kind:'intersection',first:leaf,second:{kind:'halfspace',halfspace:0}};
 const source=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3(cylinders,planes,tree)),legacy=boundaryCylinderMaterialExpression3(cylinders,planes,tree);
 for(let x=-4;x<=4;x++)for(let y=-2;y<=2;y++)for(let z=-4;z<=4;z++){const p=point3(`${x}/2`,`${y}/2`,`${z}/2`);assert.equal(locateMaterialSurfaceBoundary3(source,p),legacy.locate(p),`${x},${y},${z}`);}
});
