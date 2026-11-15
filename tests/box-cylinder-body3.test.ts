import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,createBoxBody3,createCylinderBody3,booleanMixedBodies3,clipCylinderExpressionBody3,serializeBody3,restoreBody3,locateBody3,extrudeBody3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n);
function replay(body:ReturnType<typeof createBoxBody3>){assert.ok(body.topology.closedOrientedIncidence);const restored=restoreBody3(serializeBody3(body));assert.deepEqual(restored.record,body.record);for(const p of restored.interiorSamples)assert.equal(locateBody3(restored,p),'inside');return restored;}
test('native restored Box and cylinder Bodies compose through all four operations',()=>{
 const a=restoreBody3(serializeBody3(createBoxBody3(point3(-3n,-1n,-1n),1n,2n,2n))),b=createCylinderBody3(cylinder3(line3(point3(2n,0n),Z),1n),-1n,1n);
 for(const kind of ['union','intersection','difference','xor'] as const){const r=replay(booleanMixedBodies3(a,b,kind));assert.equal(r.construction.kind,'cylinder-material-expression');assert.equal(locateBody3(r,point3('-5/2',0n)),kind==='intersection'?'outside':'inside');assert.equal(locateBody3(r,point3(2n,0n)),kind==='union'||kind==='xor'?'inside':'outside');assert.equal(locateBody3(r,O),'outside');}
 assert.equal(a.construction.kind,'box');
});
test('overlapping box/cylinder Body difference preserves plane and curved boundaries after repeated operations',()=>{
 const box=createBoxBody3(point3(0n,-2n,-2n),2n,4n,4n),cyl=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),intersection=replay(booleanMixedBodies3(box,cyl,'intersection'));
 assert.equal(locateBody3(intersection,point3('1/2',0n)),'inside');assert.equal(locateBody3(intersection,point3('-1/2',0n)),'outside');assert.equal(locateBody3(intersection,O),'boundary');
 const diff=replay(booleanMixedBodies3(cyl,box,'difference'));assert.equal(locateBody3(diff,point3('-1/2',0n)),'inside');assert.equal(locateBody3(diff,point3('1/2',0n)),'outside');
 const union=replay(booleanMixedBodies3(box,cyl,'union'));assert.equal(locateBody3(union,point3('3/2',0n)),'inside');assert.equal(locateBody3(union,point3('-1/2',0n)),'inside');
 const cut=replay(clipCylinderExpressionBody3(diff,[{plane:plane3(0n,0n,1n),side:-1}]));assert.equal(locateBody3(cut,point3('-1/2',0n,'-1/2')),'inside');assert.equal(locateBody3(cut,point3('-1/2',0n,'1/2')),'outside');
 const reused=replay(booleanMixedBodies3(cut,createBoxBody3(point3(4n,0n),1n,1n,1n),'union'));assert.equal(locateBody3(reused,point3('9/2','1/2','1/2')),'inside');assert.equal(locateBody3(reused,point3('-1/2',0n,'1/2')),'outside');
 assert.throws(()=>booleanMixedBodies3(box,cyl,'xor'),/manifold/);
 assert.throws(()=>booleanMixedBodies3({...box},cyl,'union'),/factory/);assert.throws(()=>booleanMixedBodies3(box,cyl,'invalid' as any),/operation/);
});
