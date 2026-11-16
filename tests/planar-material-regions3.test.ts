import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,cross3,dot3,subtract3,createBoxBody3,createPlanarMaterial3,planarMaterialFromBody3,booleanPlanarMaterials3 as boolean,planarMaterialRegions3 as regions,locatePlanarMaterial3 as locate,serializePlanarMaterial3,restorePlanarMaterial3} from '../dist/index.js';
import type {PlanarMaterial3,Point3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
const reload=(m:PlanarMaterial3)=>restorePlanarMaterial3(serializePlanarMaterial3(m));
function check(m:PlanarMaterial3){
 const r=regions(m);assert.equal(regions(m),r);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.regions)&&Object.isFrozen(r.chambers));
 assert.equal(r.regions[0]!.bounded,false);assert.equal(r.regions[0]!.material,false);assert.equal(r.regions[0]!.volume,null);
 for(const [id,region] of r.regions.entries()){
  assert.equal(locate(m,region.sample),region.material?'inside':'outside');assert.ok(region.chambers.length>0);
  if(id)assert.ok(region.volume!.sign()>0);
  for(const c of region.chambers){assert.equal(r.chambers[c]!.region,id);assert.equal(locate(m,r.chambers[c]!.sample),region.material?'inside':'outside');}
 }
 for(const u of r.boundaryUses){assert.equal(r.regions[u.materialRegion]!.material,true);assert.equal(r.regions[u.voidRegion]!.material,false);}
 const area=(p:readonly Point3[])=>p.reduce((s,a,i)=>{const c=cross3(a,p[(i+1)%p.length]!);return point3(s.x.add(c.x),s.y.add(c.y),s.z.add(c.z));},point3(0n,0n,0n));
 m.polygons.forEach((p,face)=>{const expected=area(p),actual=r.boundaryUses.filter(u=>u.face===face).reduce((s,u)=>{const a=area(u.polygon);return point3(s.x.add(a.x),s.y.add(a.y),s.z.add(a.z));},point3(0n,0n,0n));assert.equal(dot3(subtract3(actual,expected),subtract3(actual,expected)).sign(),0);});
 assert.throws(()=>regions({...m}),/factory-created/);return r;
}
test('face connectivity merges open material; edge and vertex contacts preserve separate regions',()=>{
 for(const [shift,components] of [[[1n,0n,0n],1],[[1n,1n,0n],2],[[1n,1n,1n],2],[[3n,0n,0n],2]] as const){
  const m=reload(boolean(box(),box(shift[0],shift[1],shift[2]),'union')),r=check(m),material=r.regions.filter(v=>v.material);
  assert.equal(material.length,components);assert.equal(r.regions.filter(v=>!v.material).length,1);
  assert.deepEqual(material.map(v=>v.volume!.toString()).sort(),components===1?['2']:['1','1']);
  const faceToRegions=new Map<number,Set<number>>();for(const u of r.boundaryUses){let ids=faceToRegions.get(u.face);if(!ids)faceToRegions.set(u.face,ids=new Set());ids.add(u.materialRegion);}
  assert.ok([...faceToRegions.values()].every(ids=>ids.size===1));
 }
});
test('nested cavity and material island retain all bounded material and void components with exact volumes',()=>{
 const cavity=boolean(box(0n,0n,0n,6n),box(1n,1n,1n,4n),'difference'),m=reload(boolean(cavity,box(2n,2n,2n,2n),'union')),r=check(m);
 assert.equal(r.regions.length,4);assert.deepEqual(r.regions.filter(v=>v.material).map(v=>v.volume!.toString()).sort(),['152','8']);
 assert.deepEqual(r.regions.filter(v=>!v.material&&v.bounded).map(v=>v.volume!.toString()),['56']);
 assert.ok(r.boundaryUses.some(u=>u.voidRegion!==0));
});
test('through tunnels remain connected to exterior while XOR contact keeps separate open materials',()=>{
 const outer=box(0n,0n,0n,3n),tunnel=createBoxBody3(point3(1n,1n,-1n),1n,1n,5n),plate=reload(boolean(outer,tunnel,'difference')),r=check(plate);
 assert.equal(r.regions.length,2);assert.equal(r.regions.find(v=>v.material)!.volume!.toString(),'24');
 const xor=reload(boolean(box(0n,0n,0n,2n),box(1n,1n,0n,2n),'xor')),x=check(xor);
 assert.equal(x.regions.filter(v=>v.material).length,2);assert.equal(x.regions.filter(v=>!v.material).length,1);assert.deepEqual(x.regions.filter(v=>v.material).map(v=>v.volume!.toString()),['6','6']);
});
test('empty material, oblique affine geometry and microscopic gaps use exact chamber adjacency',()=>{
 const empty=reload(boolean(box(),box(),'difference')),e=check(empty);assert.equal(e.regions.length,1);assert.equal(e.boundaryUses.length,0);
 const original=planarMaterialFromBody3(box()),move=(p:Point3)=>point3(p.x.add(p.y),p.y.add(p.z),p.z),oblique=createPlanarMaterial3(original.polygons.map(p=>p.map(move))),r=check(oblique);
 assert.equal(r.regions.length,2);assert.equal(r.regions[1]!.volume!.toString(),'1');
 const tiny=Rational.parse('1/1'+'0'.repeat(35)),offset=Rational.parse('1000000000000000000000000000000');
 const a=createBoxBody3(point3(offset,0n,0n),1n,1n,1n),b=createBoxBody3(point3(offset.add(Rational.parse('1')).add(tiny),0n,0n),1n,1n,1n),gap=check(boolean(a,b,'union'));
 assert.equal(gap.regions.filter(v=>v.material).length,2);assert.equal(gap.regions.length,3);
});
test('touching bounded voids stay distinct; an external material bridge reconnects contact components',()=>{
 for(const shift of [[2n,2n,1n],[2n,2n,2n]] as const){
  const holes=boolean(box(1n,1n,1n),box(shift[0],shift[1],shift[2]),'union'),m=reload(boolean(box(0n,0n,0n,4n),holes,'difference')),r=check(m);
  assert.equal(r.regions.filter(v=>v.material).length,1);assert.equal(r.regions.find(v=>v.material)!.volume!.toString(),'62');
  assert.deepEqual(r.regions.filter(v=>!v.material&&v.bounded).map(v=>v.volume!.toString()),['1','1']);
 }
 const touch=boolean(box(),box(1n,1n,0n),'union'),bridge=createBoxBody3(point3(0n,0n,-1n),2n,2n,1n),m=reload(boolean(touch,bridge,'union')),r=check(m);
 assert.equal(m.boundaryKind,'contact');assert.equal(r.regions.filter(v=>v.material).length,1);assert.equal(r.regions.find(v=>v.material)!.volume!.toString(),'6');
});
