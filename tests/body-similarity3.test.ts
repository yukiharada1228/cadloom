import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,similarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3,transformCylinderMaterialProgram3,transformBody3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,strictCylinderMaterialProgramLocation3,createCylinderBody3,booleanMaterialBodies3,createClippedCylinderBody3,createBoxBody3,locateBody3,serializeBody3,restoreBody3,planarBodyVolumeMoments3,intersectBodyLine3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const transform=()=>similarityTransform3([point3(0n,0n,2n),point3(0n,2n,0n),point3(2n,0n,0n)],point3(3n,-2n,5n));
test('exact similarity validation snapshots inputs and rejects shear, anisotropy, singularity and fake ownership',()=>{
 const columns:[ReturnType<typeof point3>,ReturnType<typeof point3>,ReturnType<typeof point3>]=[X,Y,Z],t=similarityTransform3(columns,point3(2n,3n,4n));columns[0]=O;
 assert.deepEqual(transformPointBySimilarity3(t,X),point3(3n,3n,4n));assert.deepEqual(transformVectorBySimilarity3(t,X),X);assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.columns));
 for(const c of [[O,Y,Z],[X,point3(1n,1n,0n),Z],[point3(2n,0n,0n),Y,Z]] as const)assert.throws(()=>similarityTransform3(c),RangeError);
 assert.throws(()=>transformPointBySimilarity3({...t},O),RangeError);
 const rotation=similarityTransform3([point3('3/5','4/5',0n),point3('-4/5','3/5',0n),Z]);assert.equal(rotation.scaleSquared.toString(),'1');
});
test('cylinder/halfspace definitions transform covariantly on an independent rational grid',()=>{
 const source=prepareCylinderMaterialProgram3([prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n)],[plane3(1n,0n,0n,0n)],{kind:'intersection',first:{kind:'cylinder',cylinder:0},second:{kind:'halfspace',halfspace:0}}),t=transform(),target=transformCylinderMaterialProgram3(source,t);
 assert.equal(target.cylinders[0]!.cylinder.radiusSquared.toString(),'4');assert.equal(target.cylinders[0]!.lower.toString(),'-1');
 for(let x=-5;x<5;x++)for(let y=-5;y<5;y++)for(let z=-5;z<5;z++){
  const a=2*x+1,b=2*y+1,c=2*z+1,p=point3(`${a}/8`,`${b}/8`,`${c}/8`),expected=a*a+b*b<64&&Math.abs(c)<8&&a<0?'inside':'outside';
  assert.equal(strictCylinderMaterialProgramLocation3(source,p),expected);assert.equal(strictCylinderMaterialProgramLocation3(target,transformPointBySimilarity3(t,p)),expected);
 }
 assert.throws(()=>transformCylinderMaterialProgram3({...source},t),RangeError);
});
test('transformed clipped Body replays, preserves its source and retains line parameters',()=>{
 const source=createClippedCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n,[{plane:plane3(1n,0n,0n,0n),side:-1}]),before=serializeBody3(source),t=transform(),target=restoreBody3(serializeBody3(transformBody3(source,t)));
 for(const [p,expected] of [[point3('-1/2','1/4','1/2'),'inside'],[point3('1/2','1/4','1/2'),'outside'],[point3(0n,'1/2',0n),'boundary']] as const)assert.equal(locateBody3(target,transformPointBySimilarity3(t,p)),expected);
 const origin=point3(-2n,'1/3','1/4'),a=intersectBodyLine3(source,origin,X),b=intersectBodyLine3(target,transformPointBySimilarity3(t,origin),transformVectorBySimilarity3(t,X));assert.equal(a.hits.length,b.hits.length);a.hits.forEach((h,i)=>assert.equal(h.parameter.compare(b.hits[i]!.parameter),0));assert.equal(serializeBody3(source),before);
 assert.throws(()=>transformBody3({...source},t),RangeError);assert.throws(()=>transformBody3(source,{...t}),RangeError);
});
test('reflected scaled planar Body retains outward material and exact volume/centroid',()=>{
 const source=createBoxBody3(O,2n,3n,4n),t=similarityTransform3([point3(-2n,0n,0n),point3(0n,2n,0n),point3(0n,0n,2n)],point3(10n,-3n,5n)),target=restoreBody3(serializeBody3(transformBody3(source,t))),moments=planarBodyVolumeMoments3(target);
 assert.equal(moments.volume.toString(),'192');assert.deepEqual(moments.centroid,point3(8n,0n,9n));assert.equal(locateBody3(target,point3(8n,0n,9n)),'inside');assert.ok(target.topology.closedOrientedIncidence);
});

test('transformed and restored Bodies remain Boolean operands and empty material stays empty',()=>{
 const source=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),moved=restoreBody3(serializeBody3(transformBody3(source,similarityTransform3([X,Y,Z],point3(4n,0n,0n))))),joined=booleanMaterialBodies3(source,moved,'union');
 const reflected=restoreBody3(serializeBody3(transformBody3(joined,similarityTransform3([point3(-1n,0n,0n),Y,Z]))));
 assert.equal(reflected.interiorSamples.length,2);assert.equal(locateBody3(reflected,point3(-4n,0n,0n)),'inside');assert.equal(locateBody3(reflected,point3(4n,0n,0n)),'outside');
 const empty=transformBody3(booleanMaterialBodies3(source,source,'difference'),transform());assert.equal(empty.faces.length,0);assert.equal(locateBody3(empty,O),'outside');
});
