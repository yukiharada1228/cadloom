import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,triangle3,line3,cylinder3,extrudePolygon,createPlanarBody3,createCylinderBody3,booleanMixedBodies3,booleanCylinderBodies3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,consolidatePlanarBody3,clipCylinderExpressionBody3,plane3} from '../dist/index.js';
import type {Body3,Point3} from '../dist/index.js';
const q=(n:bigint)=>new Rational(n),between=(v:Rational,a:bigint,b:bigint)=>v.compare(q(a))>0&&v.compare(q(b))<0;
function lBody(){const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],2n);return createPlanarBody3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)));}
function replay(body:Body3){assert.equal(body.construction.kind,'cylinder-material-expression');assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);const restored=restoreBody3(serializeBody3(body));assert.deepEqual(restored.record,body.record);restored.faces.forEach((f,i)=>assert.equal(locateBodyFace3(restored,i,f.sample),'inside'));for(const p of restored.interiorSamples)assert.equal(locateBody3(restored,p),'inside');return restored;}
function box(a:bigint,b:bigint){const p=(x:bigint,y:bigint,z:bigint)=>point3(x?a:b,y?a:b,z?a:b);return [[p(1n,1n,1n),p(1n,0n,1n),p(0n,0n,1n),p(0n,1n,1n)],[p(1n,1n,0n),p(0n,1n,0n),p(0n,0n,0n),p(1n,0n,0n)],[p(1n,1n,1n),p(0n,1n,1n),p(0n,1n,0n),p(1n,1n,0n)],[p(1n,0n,1n),p(1n,0n,0n),p(0n,0n,0n),p(0n,0n,1n)],[p(1n,1n,1n),p(1n,1n,0n),p(1n,0n,0n),p(1n,0n,1n)],[p(0n,1n,1n),p(0n,0n,1n),p(0n,0n,0n),p(0n,1n,0n)]];}
const makeCylinder=(x:Rational|bigint,y:Rational|bigint,r:Rational|bigint,upper:bigint=2n)=>createCylinderBody3(cylinder3(line3(point3(x,y),point3(0n,0n,1n)),r),0n,upper);
function lInside(p:Point3){return [p.x,p.y,p.z].every(v=>between(v,0n,2n))&&(p.x.compare(q(1n))<0||p.y.compare(q(1n))<0);}
test('restored concave planar Body participates in all four mixed operations with exact independent truth',()=>{
 const a=restoreBody3(serializeBody3(lBody())),b=makeCylinder(4n,0n,1n),before=serializeBody3(a);
 for(const operation of ['union','intersection','difference','xor'] as const){
  const r=replay(booleanMixedBodies3(a,b,operation));
  for(const x of ['-1/2','1/2','3/2','5/2','7/2','9/2'])for(const y of ['-1/2','1/2','3/2','5/2'])for(const z of ['-1/2','1/2','3/2','5/2']){
   const p=point3(x,y,z),A=lInside(p),dx=p.x.sub(q(4n)),B=dx.mul(dx).add(p.y.mul(p.y)).compare(q(1n))<0&&between(p.z,0n,2n),expected=operation==='union'?A||B:operation==='intersection'?A&&B:operation==='difference'?A&&!B:A!==B;assert.equal(locateBody3(r,p),expected?'inside':'outside');
  }
 }
 assert.equal(serializeBody3(a),before);assert.throws(()=>booleanCylinderBodies3(a,b,'union'),/cylinder\/halfspace/);
});
test('consolidated concave Body intersects a real cylinder and the restored result remains cuttable',()=>{
 const a=restoreBody3(serializeBody3(consolidatePlanarBody3(lBody()).body)),b=makeCylinder(1n,1n,new Rational(1n,4n)),result=replay(booleanMixedBodies3(a,b,'intersection'));
 for(const [p,l] of [[point3('3/4','3/4',1n),'inside'],[point3('5/4','5/4',1n),'outside'],[point3('1/2','1/2',1n),'outside'],[point3(1n,1n,1n),'boundary'],[point3('3/4','3/4',0n),'boundary']] as const)assert.equal(locateBody3(result,p),l);
 const cut=replay(clipCylinderExpressionBody3(result,[{plane:plane3(0n,0n,1n,-1n),side:-1}]));assert.equal(locateBody3(cut,point3('3/4','3/4','1/2')),'inside');assert.equal(locateBody3(cut,point3('3/4','3/4','3/2')),'outside');assert.equal(locateBody3(cut,point3('3/4','3/4',1n)),'boundary');
});
test('disconnected native planar shells enter mixed Boolean composition without a convex-shell restriction',()=>{
 const O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n),Z=point3(0n,0n,1n),tetra=[[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]],other=tetra.map(f=>f.map(p=>point3(p.x.add(q(3n)),p.y,p.z))),a=restoreBody3(serializeBody3(createPlanarBody3([...tetra,...other]))),b=makeCylinder(6n,0n,1n),r=replay(booleanMixedBodies3(a,b,'union'));
 assert.equal(r.topology.shells.length,3);assert.equal(r.interiorSamples.length,3);for(const p of [point3('1/4','1/4','1/4'),point3('13/4','1/4','1/4'),point3(6n,0n,1n)])assert.equal(locateBody3(r,p),'inside');assert.equal(locateBody3(r,point3(2n,0n,1n)),'outside');
});
test('native planar cavity clips a cylinder into two disconnected material regions with void boundaries',()=>{
 const a=restoreBody3(serializeBody3(createPlanarBody3([...box(0n,3n),...box(1n,2n).map(f=>[...f].reverse())]))),b=makeCylinder(new Rational(3n,2n),new Rational(3n,2n),new Rational(1n,16n),3n),r=replay(booleanMixedBodies3(a,b,'intersection'));
 assert.equal(r.topology.shells.length,2);assert.equal(r.interiorSamples.length,2);for(const [z,l] of [['1/2','inside'],['3/2','outside'],['5/2','inside'],['1','boundary'],['2','boundary']] as const)assert.equal(locateBody3(r,point3('3/2','3/2',z)),l);
});
test('empty native planar material has correct mixed Boolean identity and annihilator behavior',()=>{
 const a=createPlanarBody3([]),b=makeCylinder(4n,0n,1n);
 for(const operation of ['union','intersection','difference','xor'] as const){const r=replay(booleanMixedBodies3(a,b,operation));assert.equal(locateBody3(r,point3(4n,0n,1n)),operation==='union'||operation==='xor'?'inside':'outside');assert.equal(locateBody3(r,point3(0n,0n,0n)),'outside');}
});
