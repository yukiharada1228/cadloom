import assert from 'node:assert/strict';
import {memoryUsage} from 'node:process';
import {point2,point3,triangle3,extrudePolygon,preparePlanarSolid3,compilePlanarMaterial3,boundaryCylinderMaterialExpression3,bodyFromCylinderMaterial3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,surfacesCoincide3,Rational} from '../dist/index.js';

// Resource/integration reproduction: run after building, at the default heap.
// Keep the original material and Body observable after restoring a second Body.
// Pin the original 21-plane cone program even as the public boundary API evolves.
const started=performance.now();
const checkpoint=(phase:string)=>console.log(JSON.stringify({phase,elapsedMs:Math.round(performance.now()-started),memory:memoryUsage()}));
checkpoint('start');
const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],2n);
const source=preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)));
checkpoint('source');
const program=compilePlanarMaterial3(source);
assert.equal(program.planes.length,21);
const raw=boundaryCylinderMaterialExpression3(program.cylinders,program.planes,program.expression);
assert.ok(raw.manifold);
assert.equal(raw.faces.length,275);
for(const face of raw.faces){
 assert.equal(face.origin.kind,'halfspace');
 assert.ok(source.topology.faces.some(f=>surfacesCoincide3(f.surface,face.surface)));
 const p=face.domain.sample;
 assert.ok(p.x.rational!==null&&p.y.rational!==null&&p.z.rational!==null);
 assert.equal(source.locate(point3(p.x.rational,p.y.rational,p.z.rational)),'boundary');
}
checkpoint('boundary-checked');
const original=bodyFromCylinderMaterial3(raw);
checkpoint('body-adopted');
const record=serializeBody3(original);
checkpoint('serialized');
const restored=restoreBody3(record);
checkpoint('restored');
assert.equal(restored.faces.length,275);
assert.ok(restored.topology.closedOrientedIncidence);
assert.equal(restored.topology.issues.length,0);
assert.equal(restored.topology.shells.length,1);
assert.equal(restored.interiorSamples.length,1);
for(const p of restored.interiorSamples)assert.equal(locateBody3(restored,p),'inside');
restored.faces.forEach((f,i)=>assert.equal(locateBodyFace3(restored,i,f.sample),'inside'));
const zero=new Rational(0n),one=new Rational(1n),two=new Rational(2n);
for(const x of ['-1/2','1/2','3/2','5/2'])for(const y of ['-1/2','1/2','3/2','5/2'])for(const z of ['-1/2','1/2','3/2','5/2']){
 const p=point3(x,y,z),inside=[p.x,p.y,p.z].every(v=>v.compare(zero)>0&&v.compare(two)<0)&&(p.x.compare(one)<0||p.y.compare(one)<0);
 assert.equal(locateBody3(restored,p),inside?'inside':'outside');
}
for(const [p,expected] of [[point3(1n,'1/2',1n),'inside'],[point3('1/2',1n,1n),'inside'],[point3(1n,1n,1n),'boundary'],[point3(1n,'3/2',1n),'boundary'],[point3(2n,'1/2',1n),'boundary'],[point3('1/2','1/2',0n),'boundary'],[point3('1/2','3/2',2n),'boundary'],[point3('3/2','3/2',0n),'outside'],[point3(2n,2n,1n),'outside']] as const)assert.equal(locateBody3(restored,p),expected);
// These accesses keep the original complete source, raw material, Body and
// serialized document live throughout reconstruction and membership checks.
assert.equal(locateBody3(original,point3('1/2','1/2',1n)),'inside');
assert.equal(source.locate(point3('1/2','1/2',1n)),'inside');
assert.equal(raw.faces.length,original.faces.length);
assert.equal(record,serializeBody3(original));
checkpoint('all-checks-passed');
