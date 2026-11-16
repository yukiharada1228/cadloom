import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,boundaryMaterialSurfaces3,materialSurfaceRegions3,strictCylinderMaterialProgramLocation3} from '../dist/index.js';
import {finiteCylinderRegionFaces3} from '../dist/geometry/finite-cylinder-regions3.js';
import type {CylinderMaterialExpression3,FiniteCylinder3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),leaf:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
const c=(x=0n,r=1n,lo=-1n,hi=1n)=>prepareFiniteCylinder3(cylinder3(line3(point3(x,0n,0n),Z),r),lo,hi);
function analyze(cylinders:FiniteCylinder3[],expression:CylinderMaterialExpression3){
 const program=prepareCylinderMaterialProgram3(cylinders,[],expression),boundary=boundaryMaterialSurfaces3(program),result=materialSurfaceRegions3(boundary);
 assert.equal(materialSurfaceRegions3(boundary),result);assert.equal(finiteCylinderRegionFaces3(result).faces.length,boundary.faces.length);
 for(const p of result.materialSamples)assert.equal(strictCylinderMaterialProgramLocation3(program,p),'inside');
 assert.throws(()=>materialSurfaceRegions3({...boundary}),RangeError);assert.throws(()=>finiteCylinderRegionFaces3({...result}),RangeError);
 return result;
}
test('direct material regions determine root and reversed cavity nesting with strict witnesses',()=>{
 const r=analyze([c(0n,4n,-2n,2n),c()],{kind:'difference',first:leaf,second:{kind:'cylinder',cylinder:1}});
 assert.deepEqual(r.shells.map(s=>s.depth).sort(),[0,1]);assert.equal(r.materialSamples.length,1);
 const inner=r.shells.find(s=>s.depth===1)!;assert.ok(!inner.outward);assert.notEqual(inner.parent,null);
 assert.equal(r.regions.filter(s=>s.void).length,1);
});
test('direct disjoint components and empty selection retain their actual region counts',()=>{
 const r=analyze([c(),c(4n)],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}});
 assert.equal(r.materialSamples.length,2);assert.ok(r.shells.every(s=>s.parent===null&&s.outward));
 const empty=analyze([c()],{kind:'xor',first:leaf,second:leaf});assert.equal(empty.shells.length,0);assert.equal(empty.materialSamples.length,0);
});
test('strict primitive-boundary witnesses stay unresolved and tangent nonmanifolds cannot be adopted',()=>{
 const program=prepareCylinderMaterialProgram3([c()],[],leaf);
 assert.equal(strictCylinderMaterialProgramLocation3(program,O),'inside');assert.equal(strictCylinderMaterialProgramLocation3(program,point3(1n,0n,0n)),null);
 assert.throws(()=>strictCylinderMaterialProgramLocation3({...program},O),RangeError);
 const tangent=boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3([c(),c(2n)],[],{kind:'union',first:leaf,second:{kind:'cylinder',cylinder:1}}));
 assert.throws(()=>materialSurfaceRegions3(tangent),RangeError);
});
test('direct nonparallel SSI boundary has an outward material root',()=>{
 const a=c(0n,1n,-2n,2n),b=prepareFiniteCylinder3(cylinder3(line3(O,point3(1n,0n,0n)),4n),-2n,2n);
 const r=analyze([a,b],{kind:'intersection',first:leaf,second:{kind:'cylinder',cylinder:1}});
 assert.ok(r.source.faces.some(f=>f.loops.some(l=>l.some(c=>c.kind==='cylinder-ssi'))));
 assert.equal(r.shells.length,1);assert.ok(r.shells[0]!.outward);assert.equal(r.materialSamples.length,1);
});
