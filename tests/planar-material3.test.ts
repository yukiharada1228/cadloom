import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,createBoxBody3,createCylinderBody3,cylinder3,line3,booleanPlanarMaterials3 as boolean,planarMaterialFromBody3,locatePlanarMaterial3 as locate,planarBodyFromMaterial3,planarMaterialDocument3,serializePlanarMaterial3,restorePlanarMaterial3,locateBody3,Rational,AlgebraicReal,algebraicCoordinates3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n)=>createBoxBody3(point3(x,y,z),1n,1n,1n);
const reload=(m:ReturnType<typeof boolean>)=>restorePlanarMaterial3(serializePlanarMaterial3(m));
test('edge and vertex contacts persist and feed subsequent material operations without weakening Body adoption',()=>{
 const a=box();
 for(const shift of [[1n,1n,0n],[1n,1n,1n]] as const){
  const b=box(shift[0],shift[1],shift[2]),joined=reload(boolean(a,b,'union'));
  assert.equal(joined.boundaryKind,'contact');assert.equal(joined.volume.toString(),'2');
  assert.equal(locate(joined,point3(shift[0],shift[1],shift[2])),'boundary');
  assert.throws(()=>planarBodyFromMaterial3(joined),/Contact material/);
  for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++)for(let z=-1;z<=5;z++){
   const v=[x,y,z],offset=shift.map(t=>Number(t)*2),inside=(o:readonly number[])=>v.every((t,i)=>t>o[i]!&&t<o[i]!+2),closed=(o:readonly number[])=>v.every((t,i)=>t>=o[i]!&&t<=o[i]!+2),zero=[0,0,0];
   const expected=inside(zero)||inside(offset)?'inside':closed(zero)||closed(offset)?'boundary':'outside';
   assert.equal(locate(joined,point3(`${x}/2`,`${y}/2`,`${z}/2`)),expected);
  }
  const remaining=reload(boolean(joined,b,'difference'));
  assert.equal(remaining.volume.toString(),'1');assert.equal(remaining.boundaryKind,'manifold');
  const adopted=planarBodyFromMaterial3(remaining);
  for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++)for(let z=-1;z<=5;z++){
   const p=point3(`${x}/4`,`${y}/4`,`${z}/4`),v=[x,y,z];
   const expected=v.every(t=>t>=0&&t<=4)?v.every(t=>t>0&&t<4)?'inside':'boundary':'outside';
   assert.equal(locate(remaining,p),expected);assert.equal(locateBody3(adopted,p),expected);
  }
  assert.equal(reload(boolean(joined,joined,'difference')).polygons.length,0);
 }
});
test('empty, cavity and algebraic locations survive material persistence',()=>{
 const outer=createBoxBody3(point3(0n,0n,0n),4n,4n,4n),inner=box(1n,1n,1n),cavity=reload(boolean(outer,inner,'difference'));
 assert.equal(cavity.volume.toString(),'63');
 const p=algebraicCoordinates3(AlgebraicReal.fromRational(Rational.parse('2')).sqrt(),AlgebraicReal.fromRational(Rational.parse('2')).sqrt(),AlgebraicReal.fromRational(Rational.parse('2')).sqrt());
 assert.equal(locate(cavity,p),'outside');assert.equal(locateBody3(planarBodyFromMaterial3(cavity),p),'outside');
 const empty=reload(boolean(outer,outer,'xor'));assert.equal(empty.volume.toString(),'0');assert.equal(locate(empty,point3(0n,0n,0n)),'outside');
 assert.equal(planarBodyFromMaterial3(empty).topology.faces.length,0);
});
test('shared construction DAGs stay shared and input documents are detached',()=>{
 let m=planarMaterialFromBody3(box());for(let i=0;i<4;i++)m=boolean(m,m,'union');
 const d=planarMaterialDocument3(m);assert.equal(d.nodes.length,5);
 for(const n of d.nodes)if(n.kind==='boolean')assert.equal(n.left,n.right);
 assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.nodes));assert.equal(reload(m).volume.toString(),'1');
 const raw=JSON.parse(serializePlanarMaterial3(m)),restored=restorePlanarMaterial3(raw);raw.nodes[0].polygons[0][0][0]='999';
 assert.equal(serializePlanarMaterial3(restored),serializePlanarMaterial3(m));
});
test('invalid graph, geometry, limits, ownership and unsupported curved inputs are rejected',()=>{
 const m=planarMaterialFromBody3(box()),base=JSON.parse(serializePlanarMaterial3(m));
 const bad=(change:(d:any)=>void)=>{const d=structuredClone(base);change(d);assert.throws(()=>restorePlanarMaterial3(d));};
 bad(d=>d.version=2);bad(d=>d.nodes[0]={kind:'boolean',operation:'union',left:0,right:0});
 bad(d=>d.nodes.push({kind:'boolean',operation:'union',left:-1,right:0}));
 bad(d=>d.nodes.push({kind:'boolean',operation:'bad',left:0,right:0}));
 bad(d=>d.nodes.push(structuredClone(d.nodes[0])));
 bad(d=>d.nodes[0].polygons.pop());bad(d=>d.nodes[0].polygons[0][0][0]='1/0');
 bad(d=>d.nodes[0].polygons[0][0][0]=0);bad(d=>d.nodes[0].polygons[0][0].pop());
 assert.throws(()=>restorePlanarMaterial3(base,{maxVertices:3}));assert.throws(()=>restorePlanarMaterial3(base,{maxCoordinateChars:0}));
 assert.throws(()=>restorePlanarMaterial3(serializePlanarMaterial3(m),{maxChars:3}));
 assert.throws(()=>restorePlanarMaterial3(serializePlanarMaterial3(boolean(m,m,'union')),{maxNodes:1}));
 assert.throws(()=>locate({...m},point3(0n,0n,0n)),/factory-created/);
 assert.throws(()=>boolean({...m},m,'union'));assert.throws(()=>planarBodyFromMaterial3({...m}));
 assert.throws(()=>planarMaterialFromBody3(createCylinderBody3(cylinder3(line3(point3(0n,0n,0n),point3(0n,0n,1n)),1n),0n,1n)),/curved/);
});
