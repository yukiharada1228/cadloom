import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,createCylinderBody3,createBoxBody3,splitBodyByPlane3,locateBody3,serializeBody3,restoreBody3,booleanMaterialBodies3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n);
test('common split preserves exact cylinder surfaces, replay and subsequent operations',()=>{
 const body=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),s=splitBodyByPlane3(body,plane3(0n,0n,1n));
 assert.equal(s.representation,'surface-material');assert.ok(Object.isFrozen(s));
 for(const [child,z] of [[s.negative,'-1/2'],[s.positive,'1/2']] as const){assert.ok(child.topology.faces.some(f=>f.surface.kind==='cylinder'));assert.equal(locateBody3(child,point3(0n,0n,z)),'inside');assert.equal(locateBody3(child,O),'boundary');assert.equal(locateBody3(restoreBody3(serializeBody3(child)),point3(0n,0n,z)),'inside');}
 const again=splitBodyByPlane3(restoreBody3(serializeBody3(s.positive)),plane3(0n,0n,1n,'-1/2'));
 assert.equal(locateBody3(again.negative,point3(0n,0n,'1/4')),'inside');assert.equal(locateBody3(again.negative,point3(0n,0n,'3/4')),'outside');
 const joined=booleanMaterialBodies3(s.negative,s.positive,'union');assert.equal(locateBody3(joined,O),'inside');assert.equal(locateBody3(joined,point3(0n,0n,'3/4')),'inside');
 assert.throws(()=>splitBodyByPlane3({...body},plane3(1n,0n,0n)),/factory/);
});
test('common planar split retains contact-aware children and detailed planar metadata',()=>{
 const s=splitBodyByPlane3(createBoxBody3(O,1n,1n,1n),plane3(1n,0n,0n,'-1/2'));
 assert.equal(s.representation,'planar');if(s.representation!=='planar')throw new Error('dispatch');assert.equal(s.planar.shared.length,1);
 const again=splitBodyByPlane3(s.negative,plane3(0n,1n,0n,'-1/2'));assert.equal(locateBody3(again.positive,point3('1/4','3/4','1/2')),'inside');
});
test('oblique cylinder cuts retain elliptic trims and remain cuttable across another plane',()=>{
 const body=createCylinderBody3(cylinder3(line3(O,Z),1n),-2n,2n),s=splitBodyByPlane3(body,plane3(1n,0n,1n));
 assert.equal(s.representation,'surface-material');
 assert.equal(locateBody3(s.negative,point3('1/2',0n,-1n)),'inside');assert.equal(locateBody3(s.positive,point3('1/2',0n,-1n)),'outside');
 assert.equal(locateBody3(s.negative,point3('1/2',0n,'-1/2')),'boundary');
 assert.ok(s.negative.topology.edges.some(e=>{const c=e.curve.kind==='native'?e.curve.curve:e.curve;return c.kind==='elliptic-arc';}));
 const r=restoreBody3(serializeBody3(s.negative)),t=splitBodyByPlane3(r,plane3(0n,1n,0n));
 assert.equal(locateBody3(t.negative,point3(0n,'-1/2',-1n)),'inside');assert.equal(locateBody3(t.positive,point3(0n,'1/2',-1n)),'inside');
 assert.equal(locateBody3(t.negative,point3(0n,'1/2',-1n)),'outside');
});
test('mixed planar/cylinder Boolean results use the same split entry and retain bounded trims',()=>{
 const cylinder=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),box=createBoxBody3(point3('-1/2',-2n,-2n),1n,4n,4n),mixed=booleanMaterialBodies3(cylinder,box,'intersection'),s=splitBodyByPlane3(mixed,plane3(0n,0n,-2n));
 assert.equal(s.representation,'surface-material');
 assert.equal(locateBody3(s.negative,point3(0n,0n,'1/2')),'inside');assert.equal(locateBody3(s.positive,point3(0n,0n,'-1/2')),'inside');
 assert.equal(locateBody3(s.negative,point3('3/4',0n,'1/2')),'outside');
 assert.ok(s.negative.topology.faces.some(f=>f.surface.kind==='plane'));assert.ok(s.negative.topology.faces.some(f=>f.surface.kind==='cylinder'));
 const outside=splitBodyByPlane3(s.positive,plane3(0n,0n,1n,-2n));assert.equal(outside.positive.faces.length,0);assert.equal(locateBody3(outside.negative,point3(0n,0n,'-1/2')),'inside');
});
