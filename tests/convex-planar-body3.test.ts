import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,point2,line3,cylinder3,createPlanarBody3,createCylinderBody3,booleanMixedBodies3,booleanCylinderBodies3,serializeBody3,restoreBody3,locateBody3,consolidatePlanarBody3,extrudePolygon,triangle3} from '../dist/index.js';
const O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n),Z=point3(0n,0n,1n),tetra=[[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]],inside=point3('1/4','1/4','1/4');
function replay(body:ReturnType<typeof createPlanarBody3>){assert.equal(body.construction.kind,'cylinder-material-expression');assert.ok(body.topology.closedOrientedIncidence);const r=restoreBody3(serializeBody3(body));assert.deepEqual(r.record,body.record);for(const p of r.interiorSamples)assert.equal(locateBody3(r,p),'inside');return r;}
const cylinder=(x:bigint,r:any=1n)=>createCylinderBody3(cylinder3(line3(point3(x,0n),Z),r),-1n,1n);
test('restored convex planar Body participates in four mixed operations with replay and retained inputs',()=>{
 const a=restoreBody3(serializeBody3(createPlanarBody3(tetra))),b=cylinder(4n),before=serializeBody3(a);
 for(const kind of ['union','intersection','difference','xor'] as const){const r=replay(booleanMixedBodies3(a,b,kind));assert.equal(locateBody3(r,inside),kind==='intersection'?'outside':'inside');assert.equal(locateBody3(r,point3(4n,0n)),kind==='union'||kind==='xor'?'inside':'outside');assert.equal(locateBody3(r,point3(2n,0n)),'outside');}
 assert.equal(serializeBody3(a),before);assert.throws(()=>booleanCylinderBodies3(a,b,'union'),/cylinder\/halfspace/);
});
test('overlapping restored tetrahedron and cylinder Bodies preserve plane/curved intersection on replay',()=>{
 const a=restoreBody3(serializeBody3(createPlanarBody3(tetra))),b=cylinder(0n,'1/4'),r=replay(booleanMixedBodies3(a,b,'intersection'));
 for(const [p,l] of [[inside,'inside'],[point3('-1/10','1/10','1/10'),'outside'],[point3('2/5','2/5','1/10'),'outside'],[point3('1/4','1/4','3/4'),'outside'],[point3(0n,'1/4','1/4'),'boundary']] as const)assert.equal(locateBody3(r,p),l);
});
test('consolidated convex ownership survives restoration while concave, disconnected and copied Bodies reject',()=>{
 const a=restoreBody3(serializeBody3(consolidatePlanarBody3(createPlanarBody3(tetra)).body)),b=cylinder(4n),r=replay(booleanMixedBodies3(a,b,'intersection'));assert.equal(r.faces.length,0);
 const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],1n),concave=createPlanarBody3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)));assert.throws(()=>booleanMixedBodies3(concave,b,'union'),/convex/);
 const displaced=tetra.map(f=>f.map(p=>point3(p.x.add(point3(3n,0n).x),p.y,p.z))),two=createPlanarBody3([...tetra,...displaced]);assert.throws(()=>booleanMixedBodies3(two,b,'union'),/shell/);assert.throws(()=>booleanMixedBodies3({...a},b,'union'),/factory/);assert.throws(()=>booleanMixedBodies3(a,b,'bad' as any),/operation/);
});
