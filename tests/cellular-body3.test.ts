import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,createBoxBody3,createCylinderBody3,cylinder3,line3,booleanPlanarMaterials3,booleanCellularBodies3,cellularBodyFromPlanarMaterial3,cellularBodyFromBody3,locateCellularBody3 as locate,cellularBodyDocument3,serializeCellularBody3,restoreCellularBody3,readCellularBodyRecord3,parseCellularBodyRecord3,planarMaterialOfCellularBody3,planarBodyFromMaterial3,locateBody3,readBodyRecord3,AlgebraicReal,algebraicCoordinates3} from '../dist/index.js';
import type {CellularBody3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
function replay(body:CellularBody3){const json=serializeCellularBody3(body),r=restoreCellularBody3(json);assert.deepEqual(r.record,body.record);assert.deepEqual(parseCellularBodyRecord3(JSON.stringify(r.record)),r.record);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.record)&&Object.isFrozen(r.record.faceRegions));for(const p of r.interiorSamples)assert.equal(locate(r,p),'inside');for(const f of r.faces){assert.equal(f.locate(f.sample),'inside');assert.equal(locate(r,f.sample),'boundary');}assert.equal(r.materialFaces.length,r.faces.length);assert.ok(r.materialFaces.every(i=>i>=0&&i<planarMaterialOfCellularBody3(r).polygons.length));return r;}
test('contact cellular Bodies retain explicit face-region pairs through exact replay and another Boolean',()=>{
 for(const shift of [[1n,1n,0n],[1n,1n,1n]] as const){
  const a=box(),b=box(shift[0],shift[1],shift[2]),r=replay(booleanCellularBodies3(a,b,'union'));
  assert.equal(r.topology.closedOrientedIncidence,false);assert.equal(r.interiorSamples.length,2);assert.equal(r.record.regions.length,3);
  assert.ok(r.topology.issues.some(v=>v.kind==='nonmanifold-edge'||v.kind==='nonmanifold-vertex'));
  assert.equal(r.record.boundary.faces.length,r.record.faceRegions.length);
  assert.equal(locate(r,point3(shift[0],shift[1],shift[2])),'boundary');
  for(const p of r.record.faceRegions){assert.equal(r.record.regions[p.negative]!.material,true);assert.equal(r.record.regions[p.positive]!.material,false);}
  const remaining=replay(booleanCellularBodies3(r,b,'difference')),body=planarBodyFromMaterial3(planarMaterialOfCellularBody3(remaining));
  assert.equal(remaining.interiorSamples.length,1);assert.equal(remaining.topology.closedOrientedIncidence,true);
  for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++)for(let z=-1;z<=5;z++){
   const p=point3(`${x}/4`,`${y}/4`,`${z}/4`),v=[x,y,z],expected=v.every(t=>t>=0&&t<=4)?v.every(t=>t>0&&t<4)?'inside':'boundary':'outside';
   assert.equal(locate(remaining,p),expected);assert.equal(locateBody3(body,p),expected);
  }
 }
});
test('empty, finite cavity, coincident cancellation and face-connected material preserve region meanings',()=>{
 const a=box(),empty=replay(booleanCellularBodies3(a,a,'xor'));assert.equal(empty.record.boundary.faces.length,0);assert.equal(empty.record.regions.length,1);assert.equal(locate(empty,point3(0n,0n,0n)),'outside');
 const joined=replay(booleanCellularBodies3(a,box(1n,0n,0n),'union'));assert.equal(joined.interiorSamples.length,1);assert.equal(joined.record.regions[1]!.volume,'2');assert.equal(locate(joined,point3(1n,'1/2','1/2')),'inside');
 const cavity=replay(booleanCellularBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference'));
 assert.equal(cavity.record.regions.length,3);assert.equal(cavity.record.regions.filter(r=>r.material).length,1);assert.equal(cavity.record.regions.find(r=>r.material)!.volume,'26');assert.equal(cavity.record.regions.find(r=>!r.material&&r.bounded)!.volume,'1');
 const p=algebraicCoordinates3(AlgebraicReal.fromRational('2').sqrt(),AlgebraicReal.fromRational('2').sqrt(),AlgebraicReal.fromRational('2').sqrt());assert.equal(locate(cavity,p),'outside');
});
test('structurally plausible geometry and region edits cannot acquire cellular Body ownership',()=>{
 const r=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),base=JSON.parse(serializeCellularBody3(r));
 const bad=(change:(d:any)=>void,structural=false)=>{const d=structuredClone(base);change(d);if(structural)readCellularBodyRecord3(d.body);assert.throws(()=>restoreCellularBody3(d));};
 bad(d=>d.body.regions[1].volume='999',true);bad(d=>d.body.regions[1].sample=['99','99','99'],true);
 bad(d=>{const p=d.body.faceRegions.find((p:any)=>p.negative===1);p.negative=2;},true);
 bad(d=>d.body.boundary.vertices[0].x.value='999',true);
 bad(d=>d.body.boundary.faces[0].sense=-1,true);
 bad(d=>d.body.regions[0].material=true);bad(d=>d.body.faceRegions.pop());bad(d=>d.body.faceRegions[0].positive=999);
 bad(d=>d.body.regions.push({material:true,bounded:true,sample:['0','0','0'],volume:'1'}));
 bad(d=>d.body.boundary.shells[0].faces.pop());bad(d=>d.body.boundary.faces[0].unknown=true);bad(d=>d.unknown=true);
 assert.throws(()=>locate({...r},point3(0n,0n,0n)),/factory-created/);assert.throws(()=>serializeCellularBody3({...r}));assert.throws(()=>booleanCellularBodies3({...r},r,'union'));
 assert.throws(()=>readBodyRecord3(r.record));
});
test('read limits, input detachment and unsupported curved Body conversion are explicit',()=>{
 const r=replay(cellularBodyFromBody3(box())),doc=JSON.parse(serializeCellularBody3(r)),restored=restoreCellularBody3(doc);doc.body.regions[1].volume='0';assert.equal(restored.record.regions[1]!.volume,'1');
 assert.throws(()=>restoreCellularBody3(serializeCellularBody3(r),{maxChars:10}));assert.throws(()=>restoreCellularBody3(cellularBodyDocument3(r),{record:{maxItems:10}}));
 assert.throws(()=>restoreCellularBody3(cellularBodyDocument3(r),{maxVertices:3}));assert.throws(()=>restoreCellularBody3(cellularBodyDocument3(r),{maxChars:0}));
 assert.throws(()=>cellularBodyFromBody3(createCylinderBody3(cylinder3(line3(point3(0n,0n,0n),point3(0n,0n,1n)),1n),0n,1n)),/curved/);
 const material=booleanPlanarMaterials3(box(),box(1n,1n,0n),'union');assert.deepEqual(cellularBodyFromPlanarMaterial3(material).record,booleanCellularBodies3(box(),box(1n,1n,0n),'union').record);
});
