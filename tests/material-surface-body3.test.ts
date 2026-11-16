import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,bodyFromMaterialSurfaceBoundary3,locateBody3,locateBodyFace3,serializeBody3,restoreBody3,bodyDocument3} from '../dist/index.js';
import {materialSurfaceSourceOfBody3} from '../dist/model/body3.js';
import type {CylinderMaterialExpression3,FiniteCylinder3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
const c=(x=0n,r=1n,lo=-1n,hi=1n)=>prepareFiniteCylinder3(cylinder3(line3(point3(x,0n,0n),Z),r),lo,hi);
function make(cylinders:FiniteCylinder3[],expression:CylinderMaterialExpression3){return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3(cylinders,[],expression)));}
function replay(body:ReturnType<typeof make>){
 assert.equal(body.construction.kind,'surface-material-expression');const restored=restoreBody3(serializeBody3(body));
 assert.deepEqual(restored.record.regions,body.record.regions);assert.equal(restored.faces.length,body.faces.length);
 for(const p of restored.interiorSamples)assert.equal(locateBody3(restored,p),'inside');
 restored.faces.forEach((f,i)=>{assert.equal(locateBodyFace3(restored,i,f.sample),'inside');assert.equal(locateBody3(restored,f.sample),'boundary');});
 assert.ok(materialSurfaceSourceOfBody3(restored));return restored;
}
test('direct material adoption preserves cavities, disconnected roots and empty bodies through replay',()=>{
 const cavity=replay(make([c(0n,4n,-2n,2n),c()],{kind:'difference',first:leaf,second:{kind:'cylinder',cylinder:1}}));
 assert.equal(cavity.topology.shells.length,2);assert.equal(locateBody3(cavity,O),'outside');assert.equal(locateBody3(cavity,point3('3/2',0n,0n)),'inside');assert.equal(cavity.interiorSamples.length,1);
 const disjoint=replay(make([c(),c(4n)],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}}));assert.equal(disjoint.interiorSamples.length,2);
 const empty=replay(make([c()],{kind:'xor',first:leaf,second:leaf}));assert.equal(empty.faces.length,0);assert.equal(locateBody3(empty,O),'outside');
});
test('SSI faces and cancelled internal caps remain exact after common Body restoration',()=>{
 const other=prepareFiniteCylinder3(cylinder3(line3(O,point3(1n,0n,0n)),4n),-2n,2n),ssi=replay(make([c(0n,1n,-2n,2n),other],{kind:'intersection',first:leaf,second:{kind:'cylinder',cylinder:1}}));
 assert.ok(ssi.record.curves.some(c=>c.kind==='cylinder-ssi'));assert.equal(locateBody3(ssi,O),'inside');
 const joined=replay(make([c(0n,1n,-2n,0n),c(0n,1n,0n,2n)],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}}));assert.equal(locateBody3(joined,O),'inside');
});
test('tampered recipes and records, copied ownership and nonmanifold sources cannot acquire Body ownership',()=>{
 const body=make([c()],leaf),document=bodyDocument3(body),copy=()=>JSON.parse(JSON.stringify(document));
 const changed=copy();changed.construction.cylinders[0].radiusSquared='4';assert.throws(()=>restoreBody3(changed),/match/);
 const wrongRegion=copy();wrongRegion.body.regions[1].void=true;assert.throws(()=>restoreBody3(wrongRegion),/match/);
 const index=copy();index.construction.expression.cylinder=9;assert.throws(()=>restoreBody3(index),/index/);
 assert.throws(()=>locateBody3({...body},O),RangeError);
 const source=materialSurfaceSourceOfBody3(body)!;assert.throws(()=>bodyFromMaterialSurfaceBoundary3({...source}),RangeError);
 const tangent=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([c(),c(2n)],[],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}}));assert.throws(()=>bodyFromMaterialSurfaceBoundary3(tangent),/manifold/);
});
