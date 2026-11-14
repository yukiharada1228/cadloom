import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,vector3,segment3,pointsEqual3,dot3,cross3,subtract3,orient3d,
 plane3,planeFromPoints,evaluatePlane3,classifyPointToPlane3,intersectSegmentPlane,Rational} from '../dist/index.js';
import type {Point3} from '../dist/index.js';
const p=(x:bigint,y:bigint,z:bigint)=>point3(x,y,z);
const sign=(n:bigint)=>n<0n?-1:n>0n?1:0;
const points=Array.from({length:8},(_,i)=>[BigInt(i&1),BigInt((i>>1)&1),BigInt((i>>2)&1)] as const);
// Independent 4x4 Leibniz determinant, without displacement/cross-product formulas.
const permutations=(items:number[]):number[][]=>items.length===0?[[]]:items.flatMap((v,i)=>permutations(items.filter((_,j)=>j!==i)).map(t=>[v,...t]));
const terms=permutations([0,1,2,3]).map(order=>{
 let inversions=0;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(order[i]!>order[j]!)inversions++;
 return {order,coefficient:inversions%2?-1n:1n};
});
function determinantOracle(rows:readonly (readonly bigint[])[]):bigint {
 return -terms.reduce((sum,{order,coefficient})=>sum+order.reduce((product,col,row)=>product*rows[row]![col]!,coefficient),0n);
}

test('3D vector operations and oriented-plane sign convention',()=>{
 const x=vector3(1n,0n,0n),y=vector3(0n,1n,0n),z=vector3(0n,0n,1n);
 assert.deepEqual(cross3(x,y),z);assert.equal(dot3(x,y).sign(),0);
 assert.equal(dot3(z,z).toString(),'1');assert.deepEqual(subtract3(z,x),vector3(-1n,0n,1n));
 assert.equal(orient3d(p(0n,0n,0n),x,y,z),1);
 assert.equal(orient3d(p(0n,0n,0n),y,x,z),-1);
 const plane=planeFromPoints(p(0n,0n,2n),p(1n,0n,2n),p(0n,1n,2n));
 for(const q of [p(0n,0n,2n),p(1n,0n,2n),p(0n,1n,2n)])assert.equal(evaluatePlane3(plane,q).sign(),0);
 assert.equal(classifyPointToPlane3(plane,p(0n,0n,3n)),1);
 assert.throws(()=>plane3(0n,0n,0n),RangeError);
 assert.throws(()=>planeFromPoints(x,x,y),RangeError);
 assert.throws(()=>planeFromPoints(p(0n,0n,0n),x,p(2n,0n,0n)),RangeError);
 assert.throws(()=>evaluatePlane3({normal:vector3(0n,0n,0n),offset:new Rational(1n)},x),RangeError);
});

test('exhaustive cube vertices: 4,096 orientations match independent 4x4 determinant',()=>{
 for(const a of points)for(const b of points)for(const c of points)for(const d of points){
  const oracle=determinantOracle([a,b,c,d].map(q=>[...q,1n]));
  assert.equal(orient3d(p(...a),p(...b),p(...c),p(...d)),sign(oracle));
 }
});

test('4,992 integer segment/plane pairs match independent linear membership oracle',()=>{
 for(const nx of [-1n,0n,1n])for(const ny of [-1n,0n,1n])for(const nz of [-1n,0n,1n]){
  if(nx===0n&&ny===0n&&nz===0n)continue;
  for(const offset of [-1n,0n,1n])for(const a of points)for(const b of points){
   const value=(v:readonly bigint[])=>nx*v[0]!+ny*v[1]!+nz*v[2]!+offset;
   const fa=value(a),fb=value(b),equal=a.every((v,i)=>v===b[i]);
   const result=intersectSegmentPlane(segment3(p(...a),p(...b)),plane3(nx,ny,nz,offset));
   const spansZero=(fa<=0n&&fb>=0n)||(fb<=0n&&fa>=0n);
   const expected=!spansZero?'none':fa===0n&&fb===0n&&!equal?'coplanar':'point';
   assert.equal(result.kind,expected);
   if(result.kind==='point'){
    const t=result.parameter;
    assert.ok(t.numerator>=0n&&t.numerator<=t.denominator);
    for(const [i,axis] of ['x','y','z'].entries()){
     const coordinate=result.point[axis as keyof Point3];
     assert.equal(coordinate.numerator*t.denominator,(a[i]!*t.denominator+(b[i]!-a[i]!)*t.numerator)*coordinate.denominator);
    }
    const {x,y,z}=result.point;
    assert.equal(nx*x.numerator*y.denominator*z.denominator+ny*y.numerator*x.denominator*z.denominator+nz*z.numerator*x.denominator*y.denominator+offset*x.denominator*y.denominator*z.denominator,0n);
    const reverse=intersectSegmentPlane(segment3(p(...b),p(...a)),plane3(nx,ny,nz,offset));
    assert.equal(reverse.kind,'point');
    if(reverse.kind==='point'){
     assert.ok(pointsEqual3(result.point,reverse.point));
     if(!equal)assert.equal(t.add(reverse.parameter).toString(),'1');
    }
   }
  }
 }
});

test('rational crossings, coplanarity, collapsed segments and immutable snapshots',()=>{
 const plane=plane3(1n,1n,1n,-1n);
 const hit=intersectSegmentPlane(segment3(p(0n,0n,0n),p(1n,1n,1n)),plane);
 assert.equal(hit.kind,'point');
 if(hit.kind==='point'){
  assert.equal(hit.parameter.toString(),'1/3');assert.deepEqual(hit.point,point3('1/3','1/3','1/3'));
  assert.ok(Object.isFrozen(hit)&&Object.isFrozen(hit.point));
 }
 const start={x:new Rational(1n),y:new Rational(0n),z:new Rational(0n)};
 const result=intersectSegmentPlane({start,end:p(0n,1n,0n)},plane);
 assert.equal(result.kind,'coplanar');start.x=new Rational(50n);
 if(result.kind==='coplanar'){
  assert.equal(result.segment.start.x.toString(),'1');assert.ok(Object.isFrozen(result.segment));
 }
 assert.equal(intersectSegmentPlane(segment3(p(1n,0n,0n),p(1n,0n,0n)),plane).kind,'point');
 assert.equal(intersectSegmentPlane(segment3(p(0n,0n,0n),p(0n,0n,0n)),plane).kind,'none');
 assert.equal(intersectSegmentPlane(segment3(p(0n,0n,2n),p(1n,0n,2n)),plane3(0n,0n,1n)).kind,'none');
});

test('orientation and plane crossing remain exact at huge translations and tiny separations',()=>{
 const huge=Rational.parse('90071992547409931234567890123456789'),tiny=Rational.parse('1/10000000000000000000000000000000000000000000000');
 const a=point3(huge,huge,huge),b=point3(huge.add(new Rational(1n)),huge,huge),c=point3(huge,huge.add(new Rational(1n)),huge);
 const above=point3(huge,huge,huge.add(tiny)),below=point3(huge,huge,huge.sub(tiny));
 assert.equal(orient3d(a,b,c,above),1);assert.equal(orient3d(a,b,c,below),-1);
 const plane=planeFromPoints(a,b,c),inverse=plane3(plane.normal.x.neg(),plane.normal.y.neg(),plane.normal.z.neg(),plane.offset.neg());
 for(const q of [plane,inverse]){
  const result=intersectSegmentPlane(segment3(above,below),q);
  assert.equal(result.kind,'point');
  if(result.kind==='point'){assert.ok(pointsEqual3(result.point,a));assert.equal(result.parameter.toString(),'1/2');}
 }
});

test('seeded rational points match denominator-cleared determinant and equivalent plane scalings',()=>{
 let seed=20261114;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const coordinate=()=>new Rational(BigInt(rand()%41)-20n,BigInt(1+rand()%13));
 for(let i=0;i<300;i++){
  const [a,b,c,d]=Array.from({length:4},()=>point3(coordinate(),coordinate(),coordinate())) as [Point3,Point3,Point3,Point3];
  const rows=[a,b,c,d].map(({x,y,z})=>[
   x.numerator*y.denominator*z.denominator,y.numerator*x.denominator*z.denominator,
   z.numerator*x.denominator*y.denominator,x.denominator*y.denominator*z.denominator,
  ]);
  const expected=sign(determinantOracle(rows));
  assert.equal(orient3d(a,b,c,d),expected);
  if(expected===0)continue;
  const plane=planeFromPoints(a,b,c);
  assert.equal(classifyPointToPlane3(plane,d),expected);
  const opposite=point3(a.x.add(a.x.sub(d.x)),a.y.add(a.y.sub(d.y)),a.z.add(a.z.sub(d.z)));
  const factor=new Rational(i%2?7n:-3n,11n);
  const equivalent=plane3(plane.normal.x.mul(factor),plane.normal.y.mul(factor),plane.normal.z.mul(factor),plane.offset.mul(factor));
  for(const candidate of [plane,equivalent]){
   const result=intersectSegmentPlane(segment3(d,opposite),candidate);
   assert.equal(result.kind,'point');
   if(result.kind==='point'){assert.ok(pointsEqual3(result.point,a));assert.equal(result.parameter.toString(),'1/2');}
  }
 }
});
