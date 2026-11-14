import test from 'node:test';
import assert from 'node:assert/strict';
import {triangle3,point3,vector3,pointOnTriangle3,plane3,planeFromPoints,evaluatePlane3,
 intersectTrianglePlane,splitTriangleByPlane,cross3,subtract3,dot3,pointsEqual3,Rational} from '../dist/index.js';
import type {Triangle3,Plane3,Point3} from '../dist/index.js';
const p=(x:bigint,y:bigint,z=0n)=>point3(x,y,z);
const normal=(t:Triangle3)=>cross3(subtract3(t[1],t[0]),subtract3(t[2],t[0]));
function verifySplit(t:Triangle3,plane:Plane3){
 const result=splitTriangleByPlane(t,plane),n=normal(t);
 let sum=vector3(0n,0n,0n);
 for(const [pieces,side] of [[result.positive,1],[result.negative,-1]] as const){
  for(const piece of pieces){
   const pn=normal(piece);
   assert.equal(dot3(pn,n).sign(),1);
   sum=vector3(sum.x.add(pn.x),sum.y.add(pn.y),sum.z.add(pn.z));
   assert.ok(Object.isFrozen(piece)&&piece.every(Object.isFrozen));
   for(const q of piece){assert.ok(evaluatePlane3(plane,q).sign()*side>=0);assert.ok(pointOnTriangle3(q,t));}
  }
 }
 if(result.coplanar){const cn=normal(result.coplanar);sum=vector3(sum.x.add(cn.x),sum.y.add(cn.y),sum.z.add(cn.z));}
 assert.deepEqual(sum,n);
 assert.deepEqual(result.intersection,intersectTrianglePlane(t,plane));
 return result;
}

test('triangle membership, exact cuts and dimensional contact cases',()=>{
 const t=triangle3(p(0n,0n),p(2n,0n),p(0n,2n));
 for(const q of [p(0n,0n),p(1n,0n),point3('1/3','1/3',0n)])assert.ok(pointOnTriangle3(q,t));
 assert.equal(pointOnTriangle3(p(2n,2n),t),false);assert.equal(pointOnTriangle3(p(0n,0n,1n),t),false);
 const split=verifySplit(t,plane3(1n,0n,0n,-1n));
 assert.equal(split.positive.length,1);assert.equal(split.negative.length,2);
 assert.equal(split.intersection.kind,'segment');
 if(split.intersection.kind==='segment'){
  assert.deepEqual(split.intersection.segment.start,p(1n,0n));assert.deepEqual(split.intersection.segment.end,p(1n,1n));
 }
 const edge=verifySplit(t,plane3(1n,0n,0n));assert.equal(edge.intersection.kind,'segment');assert.equal(edge.negative.length,0);
 const vertex=verifySplit(t,plane3(1n,1n,0n));assert.equal(vertex.intersection.kind,'point');assert.equal(vertex.negative.length,0);
 const all=verifySplit(t,plane3(0n,0n,1n));assert.equal(all.intersection.kind,'coplanar');assert.equal(all.positive.length+all.negative.length,0);assert.deepEqual(all.coplanar,t);
 assert.equal(verifySplit(t,plane3(0n,0n,1n,-1n)).intersection.kind,'none');
 assert.throws(()=>triangle3(p(0n,0n),p(1n,0n),p(2n,0n)),RangeError);
 assert.throws(()=>splitTriangleByPlane([p(0n,0n),p(0n,0n),p(0n,1n)],plane3(0n,0n,1n)),RangeError);
});

// Independent signed planar determinant with denominator clearing for integer edge endpoints.
function integerSide(a:readonly bigint[],b:readonly bigint[],q:Point3):bigint {
 return (b[0]!-a[0]!)*(q.y.numerator-a[1]!*q.y.denominator)*q.x.denominator-
  (b[1]!-a[1]!)*(q.x.numerator-a[0]!*q.x.denominator)*q.y.denominator;
}
function rationalSide(a:Point3,b:Point3,q:Point3){return b.x.sub(a.x).mul(q.y.sub(a.y)).sub(b.y.sub(a.y).mul(q.x.sub(a.x))).sign();}
test('6,460 grid triangle/plane cases: independent contact oracle, coverage and nonoverlap',()=>{
 const grid=Array.from({length:9},(_,i)=>[BigInt(i%3),BigInt(Math.floor(i/3))] as const);
 let cases=0;
 for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)for(let k=j+1;k<9;k++){
  const a=grid[i]!,b=grid[j]!,c=grid[k]!;
  const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(area===0n)continue;
  const winding=area>0n?1:-1;
  const triangle=triangle3(p(...a),p(...b),p(...c));
  for(const nz of [0n,1n])for(const nx of [-1n,0n,1n])for(const ny of [-1n,0n,1n]){
   if(nx===0n&&ny===0n&&nz===0n)continue;
   for(const offset of [-2n,-1n,0n,1n,2n]){
    cases++;
    const values=[a,b,c].map(q=>nx*q[0]+ny*q[1]+offset);
    const zero=values.filter(v=>v===0n).length,positive=values.filter(v=>v>0n).length,negative=values.filter(v=>v<0n).length;
    const expected=zero===3?'coplanar':positive===3||negative===3?'none':zero===1&&(positive===2||negative===2)?'point':'segment';
    const result=verifySplit(triangle,plane3(nx,ny,nz,offset));
    assert.equal(result.intersection.kind,expected);
    const pieces=[...result.positive,...result.negative];
    for(const piece of pieces)for(const q of piece){
     assert.equal(q.z.sign(),0);
     for(const [u,v] of [[a,b],[b,c],[c,a]])assert.ok(integerSide(u!,v!,q)*BigInt(winding)>=0n);
    }
    // Independent convex separation criterion verifies pairwise interior disjointness.
    for(let u=0;u<pieces.length;u++)for(let v=u+1;v<pieces.length;v++){
     const separates=(a:Triangle3,b:Triangle3)=>a.some((p,i)=>b.every(q=>rationalSide(p,a[(i+1)%3]!,q)*winding<=0));
     assert.ok(separates(pieces[u]!,pieces[v]!)||separates(pieces[v]!,pieces[u]!));
    }
   }
  }
 }
 assert.equal(cases,6460);
});

test('oblique rational triangles preserve area vectors under reversed normals and winding',()=>{
 const huge=Rational.parse('90071992547409931234567890123456789');
 const t=triangle3(point3(0n,0n,huge),point3(4n,0n,huge.add(new Rational(1n))),point3(0n,4n,huge.add(new Rational(2n))));
 const plane=plane3('1/3','2/7','1/11',huge.div(new Rational(11n)).neg().sub(new Rational(1n)));
 const inverse=plane3(plane.normal.x.neg(),plane.normal.y.neg(),plane.normal.z.neg(),plane.offset.neg());
 const a=verifySplit(t,plane),b=verifySplit(t,inverse);
 assert.deepEqual(a.positive,b.negative);assert.deepEqual(a.negative,b.positive);assert.deepEqual(a.intersection,b.intersection);
 const reversed=verifySplit(triangle3(t[0],t[2],t[1]),plane);
 assert.deepEqual(reversed.intersection,a.intersection);
 const source={x:new Rational(0n),y:new Rational(0n),z:new Rational(0n)};
 const coplanar=splitTriangleByPlane([source,p(1n,0n),p(0n,1n)],planeFromPoints(p(0n,0n),p(1n,0n),p(0n,1n)));
 source.x=new Rational(99n);assert.ok(pointsEqual3(coplanar.coplanar![0],p(0n,0n)));
 assert.ok(Object.isFrozen(coplanar)&&Object.isFrozen(coplanar.intersection));
});
