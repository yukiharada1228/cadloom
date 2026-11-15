import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,point2,Rational,Polynomial,AlgebraicReal,algebraicCoordinates3,algebraicPoint3,createPlanarBody3,createBoxBody3,createCylinderBody3,booleanPlanarBodies3,extrudeBody3,locateBody3,locateBodyFace3,serializeBody3,restoreBody3,bodyDocument3,readBodyDocument3,cylinder3,line3} from '../dist/index.js';
import type {Point3,Body3} from '../dist/index.js';
function tetra(){const O=point3(0n,0n),X=point3(2n,0n),Y=point3(0n,2n),Z=point3(0n,0n,2n);return [[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]];}
const root=(n:bigint)=>AlgebraicReal.isolate(new Polynomial([-n,0n,1n])).find(r=>r.sign()>0)!;
function roundtrip(b:Body3){const r=restoreBody3(serializeBody3(b));assert.deepEqual(r.record,b.record);assert.equal(r.record,r.geometry.record);return r;}
test('planar construction roundtrips with validated bounded face definitions and owned queries',()=>{
 const input=tetra(),body=createPlanarBody3(input),copy=roundtrip(body);input.length=0;
 assert.equal(body.construction.kind,'planar');assert.equal(body.faces.length,4);assert.equal(body.topology.closedOrientedIncidence,true);assert.equal(body.interiorSamples.length,1);
 for(const b of [body,copy]){
  assert.equal(locateBody3(b,point3('1/4','1/4','1/4')),'inside');assert.equal(locateBody3(b,point3(1n,1n,1n)),'outside');assert.equal(locateBody3(b,point3(0n,'1/2','1/2')),'boundary');
  b.faces.forEach((f,i)=>assert.equal(locateBodyFace3(b,i,f.sample),'inside'));b.interiorSamples.forEach(p=>assert.equal(locateBody3(b,p),'inside'));
 }
 assert.throws(()=>locateBody3({...body},point3(0n,0n)),RangeError);
});
test('common Body differences persist real cavity region roles, then support another operation',()=>{
 const a=createBoxBody3(point3(0n,0n),4n,4n,4n),b=createBoxBody3(point3(1n,1n,1n),2n,2n,2n),cavity=roundtrip(booleanPlanarBodies3(a,b,'difference'));
 assert.deepEqual(cavity.record.regions,[{shells:[0],void:false},{shells:[0,1],void:false},{shells:[1],void:true}]);assert.equal(cavity.interiorSamples.length,1);
 assert.equal(locateBody3(cavity,point3(2n,2n,2n)),'outside');assert.equal(locateBody3(cavity,point3(1n,2n,2n)),'boundary');
 const filled=roundtrip(booleanPlanarBodies3(cavity,b,'union'));assert.equal(filled.record.shells.length,1);assert.equal(locateBody3(filled,point3(2n,2n,2n)),'inside');
 const island=createBoxBody3(point3('3/2','3/2','3/2'),1n,1n,1n),nested=roundtrip(booleanPlanarBodies3(cavity,island,'union'));
 assert.equal(nested.record.regions.filter(r=>r.void).length,1);assert.equal(nested.record.regions.length,4);assert.equal(nested.interiorSamples.length,2);
 assert.equal(locateBody3(nested,point3(2n,2n,2n)),'inside');assert.equal(locateBody3(nested,point3('5/4',2n,2n)),'outside');
});
test('algebraic queries preserve exact interior and boundary plane sign cells',()=>{
 const cube=booleanPlanarBodies3(createBoxBody3(point3(0n,0n),2n,2n,2n),createPlanarBody3([]),'union'),s2=root(2n),s3=root(3n);
 assert.equal(locateBody3(cube,algebraicCoordinates3(s2,s3,'1/2')),'inside');
 assert.equal(locateBody3(cube,algebraicCoordinates3(0n,s2,s3)),'boundary');assert.equal(locateBody3(cube,algebraicCoordinates3(0n,0n,s2)),'boundary');
 assert.equal(locateBody3(cube,algebraicCoordinates3(s2,s3,root(5n))),'outside');
 const t=roundtrip(createPlanarBody3(tetra())),half=s2.affine('1/2');
 const face=algebraicPoint3(point3(0n,1n,1n),point3(1n,-1n,0n),half),edge=algebraicPoint3(point3(0n,2n,0n),point3(1n,-1n,0n),s2);
 assert.equal(locateBody3(t,face),'boundary');assert.equal(locateBody3(t,edge),'boundary');
 assert.equal(locateBody3(t,{...algebraicCoordinates3(half,'1/4','1/4'),origin:point3(-100n,-100n,-100n)} as unknown as typeof face),'inside');
 // A microscopic positive plane sign must survive rational representative selection.
 const tiny=Rational.parse('1/1'+'0'.repeat(55)),above=AlgebraicReal.fromRational(new Rational(4n).add(tiny)).sqrt();
 assert.equal(locateBody3(cube,algebraicCoordinates3(above,1n,1n)),'outside');
 const below=AlgebraicReal.fromRational(new Rational(4n).sub(tiny)).sqrt();
 assert.equal(locateBody3(cube,algebraicCoordinates3(below,1n,1n)),'inside');
});
test('rational linear extrusion faces with holes convert into common planar Boolean operands',()=>{
 const ring=(lo:bigint,hi:bigint)=>{const p=[point2(lo,lo),point2(hi,lo),point2(hi,hi),point2(lo,hi)];return p.map((a,i)=>({kind:'segment' as const,segment:{start:a,end:p[(i+1)%p.length]!}}));};
 const plate=extrudeBody3([ring(0n,4n),ring(1n,3n)],2n),clip=createBoxBody3(point3(0n,0n),2n,4n,2n),cut=roundtrip(booleanPlanarBodies3(plate,clip,'intersection'));
 assert.equal(locateBody3(cut,point3('1/2',2n,1n)),'inside');assert.equal(locateBody3(cut,point3('3/2',2n,1n)),'outside');assert.equal(locateBody3(cut,point3('5/2','1/2',1n)),'outside');
 assert.equal(cut.record.shells.length,1);assert.equal(cut.record.regions.filter(r=>r.void).length,0);
});
test('tampered snapshots, region roles, face definitions and invalid geometry fail restoration',()=>{
 const b=createPlanarBody3(tetra());
 for(const mutate of [(d:any)=>{d.body.regions[1].void=true;},(d:any)=>{d.body.faces[0].domain.rings=[];},(d:any)=>{d.construction.polygons[0][0][0]='1';},(d:any)=>{d.body.surfaces[0].offset='1';}]){
  const d=JSON.parse(serializeBody3(b));mutate(d);assert.throws(()=>restoreBody3(d),RangeError);
 }
 const cavity=booleanPlanarBodies3(createBoxBody3(point3(0n,0n),4n,4n,4n),createBoxBody3(point3(1n,1n,1n),2n,2n,2n),'difference'),d=JSON.parse(serializeBody3(cavity));d.body.regions[2].void=false;
 readBodyDocument3(d);assert.throws(()=>restoreBody3(d),/does not match/);
 assert.throws(()=>restoreBody3(serializeBody3(b),{maxItems:20}),RangeError);
 assert.throws(()=>createPlanarBody3(tetra().slice(1)),RangeError);
});
test('empty and disconnected material roundtrip; unsupported Body contacts and curved operands fail explicitly',()=>{
 const empty=roundtrip(createPlanarBody3([]));assert.equal(empty.interiorSamples.length,0);assert.deepEqual(empty.record.regions,[{shells:[],void:false}]);
 const a=createBoxBody3(point3(0n,0n),1n,1n,1n),far=createBoxBody3(point3(3n,0n),1n,1n,1n),two=roundtrip(booleanPlanarBodies3(a,far,'union'));
 assert.equal(two.record.regions[0]!.shells.length,2);assert.equal(two.interiorSamples.length,2);
 assert.throws(()=>booleanPlanarBodies3(a,createBoxBody3(point3(1n,1n,0n),1n,1n,1n),'union'),/nonmanifold contact/);
 assert.throws(()=>booleanPlanarBodies3(a,createCylinderBody3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),0n,1n),'union'),/curved/);
 assert.throws(()=>bodyDocument3({...a}),RangeError);
});
