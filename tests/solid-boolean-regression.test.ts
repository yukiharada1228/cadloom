import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,point3,triangle3,extrudePolygon,booleanSolids3,Rational} from '../dist/index.js';
import type {TriangleMesh3,BooleanOperation,Point3,Triangle3} from '../dist/index.js';
const faces=(m:TriangleMesh3)=>m.triangles.map(t=>triangle3(m.vertices[t[0]]!,m.vertices[t[1]]!,m.vertices[t[2]]!));
const ops:readonly BooleanOperation[]=['union','intersection','difference','xor'];
const truth=(a:boolean,b:boolean,op:BooleanOperation)=>op==='union'?a||b:op==='intersection'?a&&b:op==='difference'?a&&!b:a!==b;
const rect=(x:Rational,X:Rational)=>faces(extrudePolygon([[point2(x,0n),point2(X,0n),point2(X,1n),point2(x,1n)]],1n));
test('nonconvex L-prism Booleans match independent union-of-boxes membership and overlap volumes',()=>{
 const a=faces(extrudePolygon([[point2(0n,0n),point2(4n,0n),point2(4n,1n),point2(1n,1n),point2(1n,4n),point2(0n,4n)]],3n));
 const b=faces(extrudePolygon([[point2('1/2','1/2'),point2('5/2','1/2'),point2('5/2','5/2'),point2('1/2','5/2')]],3n,{baseZ:1n}));
 const q=(n:bigint)=>new Rational(n,4n);
 const between=(v:Rational,lo:bigint,hi:bigint)=>v.compare(new Rational(lo,2n))>0&&v.compare(new Rational(hi,2n))<0;
 const expectedVolumes=['59/2','7/2','35/2','26'];
 for(const [i,op] of ops.entries()){
  const r=booleanSolids3(a,b,op);assert.equal(r.volume.toString(),expectedVolumes[i]);
  for(let x=-1n;x<=17n;x+=2n)for(let y=-1n;y<=17n;y+=2n)for(let z=-1n;z<=17n;z+=2n){
   const p=point3(q(x),q(y),q(z));
   const inA=between(p.x,0n,8n)&&between(p.y,0n,8n)&&between(p.z,0n,6n)&&(p.x.compare(new Rational(1n))<0||p.y.compare(new Rational(1n))<0);
   const inB=between(p.x,1n,5n)&&between(p.y,1n,5n)&&between(p.z,2n,8n);
   assert.equal(r.locate(p),truth(inA,inB,op)?'inside':'outside',`${op} ${x},${y},${z}`);
  }
 }
});
test('near-coincident rational faces preserve both a thin intersection and a thin gap',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(80)),one=new Rational(1n),two=new Rational(2n),zero=new Rational(0n);
 const a=rect(zero,one),overlap=rect(one.sub(epsilon),two);
 const expected=[two,epsilon,one.sub(epsilon),two.sub(epsilon)];
 for(const [i,op] of ops.entries()){
  const r=booleanSolids3(a,overlap,op);assert.equal(r.volume.toString(),expected[i]!.toString());
  const p=point3(one.sub(epsilon.div(two)),'1/2','1/2');
  assert.equal(r.locate(p),truth(true,true,op)?'inside':'outside');
 }
 const separate=booleanSolids3(a,rect(one.add(epsilon),two),'union');
 assert.equal(separate.volume.toString(),two.sub(epsilon).toString());
 assert.equal(separate.locate(point3(one.add(epsilon.div(two)),'1/2','1/2')),'outside');
 assert.equal(separate.locate(point3(one,'1/2','1/2')),'boundary');
});
test('orientation-reversing rational affine maps preserve material after reversing face winding',()=>{
 const a=rect(new Rational(0n),new Rational(2n)),b=rect(new Rational(1n),new Rational(3n));
 const map=(p:Point3)=>point3(p.x.neg(),p.y.add(p.x.div(new Rational(3n))),p.z);
 const transform=(ts:readonly Triangle3[])=>ts.map(t=>triangle3(map(t[0]),map(t[2]),map(t[1])));
 for(const op of ops){
  const r=booleanSolids3(transform(a),transform(b),op);
  assert.equal(r.volume.toString(),op==='union'?'3':op==='xor'?'2':'1');
  for(const [x,inA,inB] of [['1/2',true,false],['3/2',true,true],['5/2',false,true]] as const){
   assert.equal(r.locate(map(point3(x,'1/2','1/2'))),truth(inA,inB,op)?'inside':'outside');
  }
 }
});
