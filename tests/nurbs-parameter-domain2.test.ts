import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,prepareNurbsParameterDomain2,reverseNurbsCurve3,AlgebraicReal,Rational,insertNurbsKnot3} from '../dist/index.js';
const line=(a:ReturnType<typeof point3>,b:ReturnType<typeof point3>)=>nurbsCurve3(1,[a,b],[0n,0n,1n,1n]);
const polygon=(xy:readonly (readonly [number,number])[])=>{const p=xy.map(([x,y])=>point3(BigInt(x),BigInt(y),0n));return p.map((a,i)=>line(a,p[(i+1)%p.length]!));};
const square=(a:number,b:number,c:number,d:number)=>polygon([[a,b],[c,b],[c,d],[a,d]]),reverse=(r:ReturnType<typeof polygon>)=>r.slice().reverse().map(reverseNurbsCurve3);
const circle=()=>[nurbsCurve3(2,[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]].map(([x,y])=>point3(BigInt(x!),BigInt(y!),0n)),[0n,0n,0n,1n,1n,2n,2n,3n,3n,4n,4n,4n],[1n,1n,2n,2n,4n,4n,8n,8n,16n])];
test('oriented outer and hole loops classify rational and algebraic queries and retain a strict material witness',()=>{
  const d=prepareNurbsParameterDomain2(square(0,0,10,10),[reverse(square(2,2,8,8))]);
  assert.equal(d.locate(1n,1n),'inside');assert.equal(d.locate(5n,5n),'outside');assert.equal(d.locate(2n,5n),'boundary');assert.equal(d.locate(0n,5n),'boundary');assert.equal(d.locate(11n,5n),'outside');assert.equal(d.locate(d.sample.u,d.sample.v),'inside');
  const a=AlgebraicReal.fromRational(2n).sqrt();assert.equal(d.locate(a,a),'inside');assert.equal(d.locate(a.affine(2n),a.affine(2n)),'outside');assert.ok(Object.isFrozen(d));
});
test('rational circle winding counts tangent roots and algebraic boundary points exactly',()=>{
  const d=prepareNurbsParameterDomain2(circle()),a=AlgebraicReal.fromRational('1/2').sqrt();
  for(const [x,y,where] of [[0n,0n,'inside'],[0n,1n,'boundary'],[-2n,1n,'outside'],[2n,0n,'outside'],[-2n,0n,'outside']] as const)assert.equal(d.locate(x,y),where);
  assert.equal(d.locate(a,a),'boundary');assert.equal(d.locate(a,a.affine('1/2')),'inside');assert.equal(d.locate(a,a.affine(2n)),'outside');
});
test('a single closed polygonal NURBS is accepted despite interior corners',()=>{
  const c=nurbsCurve3(1,[[0,0],[3,0],[3,3],[0,3],[0,0]].map(([x,y])=>point3(BigInt(x!),BigInt(y!),0n)),[0n,0n,1n,2n,3n,4n,4n]),d=prepareNurbsParameterDomain2([c]);assert.equal(d.locate(1n,1n),'inside');assert.equal(d.locate(-1n,0n),'outside');assert.equal(d.locate(2n,0n),'boundary');
});
test('self crossings, overlapping neighbors, open chains and nonplanar curves are rejected',()=>{
  assert.throws(()=>prepareNurbsParameterDomain2(polygon([[0,0],[3,3],[0,3],[3,0]])),/cross|touch/);
  assert.throws(()=>prepareNurbsParameterDomain2(polygon([[0,0],[3,0],[1,0],[1,2],[0,2]])),/overlap/);
  assert.throws(()=>prepareNurbsParameterDomain2(square(0,0,3,3).slice(1)),/closed chain/);
  assert.throws(()=>prepareNurbsParameterDomain2([line(point3(0n,0n,1n),point3(1n,1n,1n))]),/planar/);
});
test('wrong orientation, holes outside, nested holes and touching holes are rejected',()=>{
  const outer=square(0,0,10,10);assert.throws(()=>prepareNurbsParameterDomain2(reverse(outer)),/orientation/);assert.throws(()=>prepareNurbsParameterDomain2(outer,[square(2,2,3,3)]),/orientation/);
  assert.throws(()=>prepareNurbsParameterDomain2(outer,[reverse(square(12,12,13,13))]),/strictly inside/);
  assert.throws(()=>prepareNurbsParameterDomain2(outer,[reverse(square(2,2,8,8)),reverse(square(3,3,4,4))]),/nest/);
  assert.throws(()=>prepareNurbsParameterDomain2(outer,[reverse(square(2,2,5,5)),reverse(square(5,3,7,4))]),/cross|touch|overlap/);
  assert.throws(()=>prepareNurbsParameterDomain2(outer,[reverse(square(0,2,2,3))]),/cross|touch|overlap/);
});
test('concave horizontal chains and all vertex-level rays agree with an independent rectilinear oracle',()=>{
  const d=prepareNurbsParameterDomain2(polygon([[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]]));
  for(let i=-1;i<=13;i++)for(let j=-1;j<=13;j++){const x=i/2,y=j/2,inClosed=(x>=0&&x<=6&&y>=0&&y<=2)||(x>=0&&x<=2&&y>=0&&y<=6),inOpen=(x>0&&x<6&&y>0&&y<2)||(x>0&&x<2&&y>0&&y<6)||(x>0&&x<2&&y===2),expected=!inClosed?'outside':inOpen?'inside':'boundary';assert.equal(d.locate(`${i}/2`,`${j}/2`),expected,`${x},${y}`);}
});
test('reversing all loops and sense preserves the material domain',()=>{
  const a=prepareNurbsParameterDomain2(square(0,0,5,5),[reverse(square(1,1,2,2))]),b=prepareNurbsParameterDomain2(reverse(square(0,0,5,5)),[square(1,1,2,2)],-1);
  for(let x=0;x<=10;x++)for(let y=0;y<=10;y++)assert.equal(a.locate(`${x}/2`,`${y}/2`),b.locate(`${x}/2`,`${y}/2`));assert.throws(()=>prepareNurbsParameterDomain2([],[],1),/contain/);
});

test('curved lens agrees with an independent parabola inequality, including tangent and algebraic rays',()=>{
  const bottom=line(point3(0n,0n,0n),point3(2n,0n,0n)),top=nurbsCurve3(2,[point3(2n,0n,0n),point3(1n,2n,0n),point3(0n,0n,0n)],[0n,0n,0n,1n,1n,1n]),d=prepareNurbsParameterDomain2([bottom,top]);
  const refined=prepareNurbsParameterDomain2([insertNurbsKnot3(bottom,'1/3'),insertNurbsKnot3(top,'1/2',2)]);
  for(let i=-1;i<=9;i++)for(let j=-1;j<=5;j++){const x=i/4,y=j/4,h=2*x-x*x,closed=x>=0&&x<=2&&y>=0&&y<=h,inside=x>0&&x<2&&y>0&&y<h,expected=!closed?'outside':inside?'inside':'boundary';assert.equal(d.locate(`${i}/4`,`${j}/4`),expected);assert.equal(refined.locate(`${i}/4`,`${j}/4`),expected);}
  const a=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(d.locate(a,a),'inside');assert.equal(d.locate(1n,a),'inside');assert.equal(d.locate(-1n,1n),'outside');assert.equal(d.locate(1n,1n),'boundary');
});
test('tiny exact domains at huge offsets retain strict material witnesses',()=>{
  const base=new Rational(10n**30n),width=new Rational(1n,10n**30n),p=(x:Rational,y:Rational)=>point3(x,y,0n),points=[p(base,base),p(base.add(new Rational(1n)),base),p(base.add(new Rational(1n)),base.add(width)),p(base,base.add(width))],d=prepareNurbsParameterDomain2(points.map((a,i)=>line(a,points[(i+1)%4]!))),mid=base.add(width.div(new Rational(2n)));
  assert.equal(d.locate(mid,mid),'inside');assert.equal(d.locate(base,mid),'boundary');assert.equal(d.locate(base.sub(width),mid),'outside');assert.equal(d.locate(d.sample.u,d.sample.v),'inside');
});
test('zero-speed endpoint reparameterization preserves the region',()=>{
  const r=square(0,0,2,2);r[0]=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,0n,0n),point3(2n,0n,0n)],[0n,0n,0n,1n,1n,1n]);const d=prepareNurbsParameterDomain2(r);assert.equal(d.locate(1n,1n),'inside');assert.equal(d.locate(0n,0n),'boundary');
});
