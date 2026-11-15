import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,triangle3,extrudePolygon,preparePlanarSolid3,createPlanarBody3,restoreBody3,serializeBody3,booleanMixedBodies3,locateBody3,locateBodyFace3,boundaryPlanarMaterial3,booleanCylinderMaterials3,bodyFromCylinderMaterial3} from '../dist/index.js';
import type {Point3,Body3} from '../dist/index.js';
const q=(n:bigint)=>new Rational(n),between=(v:Rational,a:bigint,b:bigint)=>v.compare(q(a))>0&&v.compare(q(b))<0;
function source(dx:bigint){const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],2n),vertices=mesh.vertices.map(p=>point3(p.x.add(q(dx)),p.y,p.z));return preparePlanarSolid3(mesh.triangles.map(t=>triangle3(vertices[t[0]]!,vertices[t[1]]!,vertices[t[2]]!)));}
function inside(p:Point3,dx:bigint){const x=p.x.sub(q(dx));return between(x,0n,2n)&&between(p.y,0n,2n)&&between(p.z,0n,2n)&&(x.compare(q(1n))<0||p.y.compare(q(1n))<0);}
function replay(body:Body3){const r=restoreBody3(serializeBody3(body));assert.deepEqual(r.record,body.record);assert.ok(r.topology.closedOrientedIncidence);assert.equal(r.topology.issues.length,0);r.faces.forEach((f,i)=>assert.equal(locateBodyFace3(r,i,f.sample),'inside'));for(const p of r.interiorSamples)assert.equal(locateBody3(r,p),'inside');return r;}
for(const operation of ['union','intersection','difference'] as const)test(`overlapping concave native Bodies retain regularized ${operation} across shared and opposed bounded planes`,()=>{
 const a=restoreBody3(serializeBody3(createPlanarBody3(source(0n).polygons))),b=restoreBody3(serializeBody3(createPlanarBody3(source(1n).polygons))),before=[serializeBody3(a),serializeBody3(b)],r=replay(booleanMixedBodies3(a,b,operation));assert.equal(r.construction.kind,'cylinder-material-expression');
 for(const x of ['-1/2','1/2','3/2','5/2','7/2'])for(const y of ['-1/2','1/2','3/2','5/2'])for(const z of ['-1/2','1/2','3/2','5/2']){
  const p=point3(x,y,z),A=inside(p,0n),B=inside(p,1n),expected=operation==='union'?A||B:operation==='intersection'?A&&B:A&&!B;assert.equal(locateBody3(r,p),expected?'inside':'outside');
 }
 // Above y=1 the sources meet only on x=1. Union cancels the internal face;
 // regularized intersection removes this zero-thickness strip entirely.
 assert.equal(locateBody3(r,point3(1n,'3/2',1n)),operation==='union'?'inside':operation==='intersection'?'outside':'boundary');
 assert.equal(locateBody3(r,point3(1n,1n,1n)),operation==='union'?'inside':'boundary');
 assert.equal(serializeBody3(a),before[0]);assert.equal(serializeBody3(b),before[1]);
});
test('concave XOR preserves a nonmanifold edge diagnosis and cannot acquire manifold Body ownership',()=>{
 const a=boundaryPlanarMaterial3(source(0n)),b=boundaryPlanarMaterial3(source(1n)),raw=booleanCylinderMaterials3(a,b,'xor');assert.equal(raw.manifold,false);assert.ok(raw.sewn.topology.issues.some(i=>i.kind==='nonmanifold-edge'));assert.throws(()=>bodyFromCylinderMaterial3(raw),/manifold/);
 for(const x of ['-1/2','1/2','3/2','5/2','7/2'])for(const y of ['-1/2','1/2','3/2','5/2'])for(const z of ['-1/2','1/2','3/2','5/2']){const p=point3(x,y,z);assert.equal(raw.locate(p),inside(p,0n)!==inside(p,1n)?'inside':'outside');}
 assert.equal(raw.locate(point3(2n,1n,1n)),'boundary');
});
