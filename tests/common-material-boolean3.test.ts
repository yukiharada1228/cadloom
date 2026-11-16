import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,createBoxBody3,createCylinderBody3,cylinder3,line3,booleanMaterialBodies3,locateBody3,bodyDocument3,serializeBody3,restoreBody3,planarBodyVolumeMoments3,planarMaterialOfCellularBody3,materialProgramOfPlanarMaterial3,strictCylinderMaterialProgramLocation3} from '../dist/index.js';
import type {Body3,KernelBody3,CellularBody3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
function cell(b:KernelBody3):CellularBody3 {assert.ok('kind' in b&&b.kind==='cellular-body');return b as CellularBody3;}
function typing(a:Body3,b:Body3,c:CellularBody3){
 const old:Body3=booleanMaterialBodies3(a,b,'union');
 const strict:Body3=booleanMaterialBodies3(a,b,'union',{contacts:'reject'});
 const preserved:KernelBody3=booleanMaterialBodies3(a,b,'union',{contacts:'preserve'});
 const chain:KernelBody3=booleanMaterialBodies3(c,b,'difference');return [old,strict,preserved,chain];
}
void typing;
test('common Boolean preserves edge and vertex contacts explicitly and chains restored cellular operands',()=>{
 for(const shift of [[1n,1n,0n],[1n,1n,1n]] as const){
  const a=box(),b=box(shift[0],shift[1],shift[2]),source=booleanMaterialBodies3(a,b,'union',{contacts:'preserve'}),r=restoreBody3(serializeBody3(source));
  assert.equal(cell(r).interiorSamples.length,2);assert.equal(planarBodyVolumeMoments3(r).volume.toString(),'2');assert.equal(locateBody3(r,point3(shift[0],shift[1],shift[2])),'boundary');
  const loaded:unknown=JSON.parse(serializeBody3(r)),result=restoreBody3(serializeBody3(booleanMaterialBodies3(restoreBody3(loaded),b,'difference')));
  assert.equal(cell(result).interiorSamples.length,1);assert.equal(planarBodyVolumeMoments3(result).volume.toString(),'1');assert.equal(locateBody3(result,point3('1/2','1/2','1/2')),'inside');
 }
});
test('coincidence, face union, XOR and finite cavity retain regularized meanings in preservation mode',()=>{
 const a=box(),b=box(1n,0n,0n),joined=restoreBody3(serializeBody3(booleanMaterialBodies3(a,b,'union',{contacts:'preserve'})));
 assert.equal(cell(joined).interiorSamples.length,1);assert.equal(locateBody3(joined,point3(1n,'1/2','1/2')),'inside');
 for(const op of ['difference','xor'] as const){const empty=restoreBody3(serializeBody3(booleanMaterialBodies3(a,a,op,{contacts:'preserve'})));assert.equal(empty.faces.length,0);assert.equal(locateBody3(empty,point3(0n,0n,0n)),'outside');}
 const xor=booleanMaterialBodies3(box(0n,0n,0n,2n),box(1n,1n,1n,2n),'xor',{contacts:'preserve'});assert.equal(planarBodyVolumeMoments3(xor).volume.toString(),'14');
 const cavity=restoreBody3(serializeBody3(booleanMaterialBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference',{contacts:'preserve'})));assert.equal(cell(cavity).record.regions.filter(r=>!r.material&&r.bounded).length,1);assert.equal(locateBody3(cavity,point3('3/2','3/2','3/2')),'outside');
});
test('compiled contact material definitions agree with independent primitive truth away from support zeros',()=>{
 const r=cell(booleanMaterialBodies3(box(),box(1n,1n,0n),'union',{contacts:'preserve'})),material=planarMaterialOfCellularBody3(r),p=materialProgramOfPlanarMaterial3(material);
 for(let x=-1;x<=4;x++)for(let y=-1;y<=4;y++){
  const a=2*x+1,b=2*y+1,q=point3(`${a}/4`,`${b}/4`,'1/2'),A=a>0&&a<4&&b>0&&b<4,B=a>4&&a<8&&b>4&&b<8;
  assert.equal(strictCylinderMaterialProgramLocation3(p,q),A||B?'inside':'outside');
 }
 assert.throws(()=>materialProgramOfPlanarMaterial3({...material}),/factory/);
});
test('curved intersection can resolve a planar contact through the common material program and replay',()=>{
 const contact=booleanMaterialBodies3(box(),box(1n,1n,0n),'union',{contacts:'preserve'}),c=createCylinderBody3(cylinder3(line3(point3('1/2','1/2',0n),point3(0n,0n,1n)),'1/16'),'1/4','3/4');
 const result=restoreBody3(serializeBody3(booleanMaterialBodies3(contact,c,'intersection'))),document=bodyDocument3(result);
 assert.ok(!('kind' in result));assert.ok('construction' in document);assert.equal(result.interiorSamples.length,1);assert.ok(result.topology.faces.some(f=>f.surface.kind==='cylinder'));
 for(const x of ['1/4','1/2','3/4'])for(const y of ['1/4','1/2','3/4'])for(const z of ['0','1/4','1/2','3/4','1']){
  // At these coordinates dx/dy are exactly 0 or ±1/4; use integer units of 1/4.
  const dx=x==='1/2'?0:1,dy=y==='1/2'?0:1,radial=dx+dy,insideZ=z==='1/2',closedZ=insideZ||z==='1/4'||z==='3/4';
  const expected=radial>1||!closedZ?'outside':radial===1||!insideZ?'boundary':'inside';assert.equal(locateBody3(result,point3(x,y,z)),expected);
 }
});
test('legacy manifold-only calls retain their contract and invalid ownership or policies fail',()=>{
 const a=box(),b=box(1n,1n,0n);assert.throws(()=>booleanMaterialBodies3(a,b,'union'),/manifold|closed/i);
 const preserved=booleanMaterialBodies3(a,b,'union',{contacts:'preserve'});
 assert.throws(()=>booleanMaterialBodies3({...a},b,'union',{contacts:'preserve'}),/factory/);assert.throws(()=>booleanMaterialBodies3({...cell(preserved)},b,'union'),/factory/);
 assert.throws(()=>booleanMaterialBodies3(a,b,'bad' as 'union',{contacts:'preserve'}),/operation/);assert.throws(()=>booleanMaterialBodies3(a,b,'union',{contacts:'bad' as 'preserve'}),/policy/);
});
