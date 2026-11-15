import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {point3,line3,cylinder3,prepareFiniteCylinder3,booleanFiniteCylinders3,boundaryFiniteCylinderExpression3,finiteCylinderBooleanRegions3,finiteCylinderExpressionRegions3,restoreMixedBRepFaces3,locateBody3} from '../dist/index.js';
import {replaceMixedBRepRegions3,assertOwnedMixedBRepFaces3} from '../dist/convert/mixed-faces3.js';
import {finiteCylinderRegionFaces3} from '../dist/geometry/finite-cylinder-regions3.js';
import {adoptFiniteCylinderBooleanBody3,adoptFiniteCylinderExpressionBody3} from '../dist/model/body3.js';

test('region replacement retains fully bound geometry and checks schema without accepting copied ownership',()=>{
 const document=JSON.parse(readFileSync(new URL('./fixtures/body-83d6bb1-cylinder-island.json',import.meta.url),'utf8')),original=restoreMixedBRepFaces3(document.body),regions=JSON.parse(JSON.stringify(document.body.regions)),next=replaceMixedBRepRegions3(original,regions);
 assertOwnedMixedBRepFaces3(next);assert.equal(next.faces,original.faces);assert.equal(next.boundary.topology,original.boundary.topology);assert.equal(next.boundary.vertexMap,original.boundary.vertexMap);
 for(const key of ['vertices','curves','surfaces'] as const)assert.equal(next.boundary.geometry[key],original.boundary.geometry[key]);
 assert.deepEqual(next.boundary.geometry.record,original.boundary.geometry.record);assert.notEqual(next.boundary.geometry.record,original.boundary.geometry.record);
 regions[0].shells.push(999);assert.deepEqual(next.boundary.geometry.record.regions,document.body.regions);assert.ok(Object.isFrozen(next.boundary.geometry.record.regions[0].shells));
 assert.throws(()=>replaceMixedBRepRegions3({...original},document.body.regions),/factory/);
 assert.throws(()=>replaceMixedBRepRegions3(original,[{shells:[999],void:false}]),RangeError);
 assert.throws(()=>replaceMixedBRepRegions3(original,[{shells:[0],void:true}]),RangeError);
});

test('binary and expression Body adoption reuse actual constructive region certificates and reject copied claims',()=>{
 const O=point3(0n,0n),Z=point3(0n,0n,1n),a=prepareFiniteCylinder3(cylinder3(line3(O,Z),4n),-2n,2n),b=prepareFiniteCylinder3(cylinder3(line3(O,Z),1n),-1n,1n),binary=booleanFiniteCylinders3(a,b,'difference'),expression=boundaryFiniteCylinderExpression3([a,b],{kind:'difference',first:{kind:'operand',operand:0},second:{kind:'operand',operand:1}});
 const cases=[{material:finiteCylinderBooleanRegions3(binary),adopt:()=>adoptFiniteCylinderBooleanBody3(binary)},{material:finiteCylinderExpressionRegions3(expression),adopt:()=>adoptFiniteCylinderExpressionBody3(expression)}];
 for(const {material,adopt} of cases){const bound=finiteCylinderRegionFaces3(material),body=adopt();assert.equal(body.geometry,bound.boundary.geometry);assert.equal(body.faces,bound.faces);assert.equal(body.topology,bound.boundary.topology);assert.deepEqual(body.record,material.record);assert.equal(locateBody3(body,O),'outside');assert.equal(locateBody3(body,point3('3/2',0n)),'inside');assert.equal(body.interiorSamples.length,1);assert.throws(()=>finiteCylinderRegionFaces3({...material}),/factory/);}
});
