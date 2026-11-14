import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Polynomial,Rational,AlgebraicReal,isolateRealRoots,countRealRoots,sturmSequence} from '../dist/index.js';
const p=(...xs:bigint[])=>new Polynomial(xs);
const rational=(x:string|bigint)=>isolateRealRoots(new Polynomial([typeof x==='bigint'?-x:Rational.parse(x).neg(),1n]))[0]!;
function certify(root:AlgebraicReal){
 assert.ok(Object.isFrozen(root));
 if(root.rational!==null){assert.equal(root.polynomial.evaluate(root.rational).sign(),0);return;}
 assert.equal(countRealRoots(root.polynomial,root.lower,root.upper),1);
 assert.equal(root.polynomial.evaluate(root.lower).sign()*root.polynomial.evaluate(root.upper).sign(),-1);
 const refined=root.refine();assert.ok(refined.lower.compare(root.lower)>=0&&refined.upper.compare(root.upper)<=0);
 assert.ok(refined.upper.sub(refined.lower).compare(root.upper.sub(root.lower))<0);
}
test('Sturm open endpoint conventions exclude each endpoint and count repeated roots once',()=>{
 const f=p(-1n,1n).mul(p(0n,1n)).mul(p(1n,1n)).mul(p(-1n,1n));
 for(let a=-4n;a<4n;a++)for(let b=a+1n;b<=4n;b++){
  const lo=new Rational(a,2n),hi=new Rational(b,2n);
  const expected=[-1n,0n,1n].filter(x=>lo.compare(new Rational(x))<0&&hi.compare(new Rational(x))>0).length;
  assert.equal(countRealRoots(f,lo,hi),expected);
 }
 assert.equal(countRealRoots(p(1n),-1n,1n),0);assert.equal(countRealRoots(p(1n,0n,1n),-10n,10n),0);
 assert.throws(()=>countRealRoots(p(),-1n,1n),RangeError);assert.throws(()=>countRealRoots(f,1n,1n),RangeError);
 assert.throws(()=>isolateRealRoots(p()),RangeError);assert.deepEqual(isolateRealRoots(p(4n)),[]);
 const sequence=sturmSequence(f);assert.ok(Object.isFrozen(sequence));
 for(let i=2;i<sequence.length;i++)assert.ok(sequence[i]!.equals(sequence[i-2]!.divRem(sequence[i-1]!).remainder.neg()));
});
test('isolates rational factors independently of multiplicity, order and irreducible positive factors',()=>{
 const roots=['-7/3','-1','0','1/5','2','13/4'];
 let polynomial=p(1n,0n,1n);
 roots.forEach((r,i)=>{const factor=new Polynomial([Rational.parse(r).neg(),1n]);for(let k=0;k<=i%3;k++)polynomial=polynomial.mul(factor);});
 const result=isolateRealRoots(polynomial.scale('-3/7'));assert.equal(result.length,roots.length);
 result.forEach((r,i)=>{certify(r);assert.equal(r.compare(rational(roots[i]!)),0);if(i)assert.equal(result[i-1]!.compare(r),-1);});
 assert.ok(Object.isFrozen(result));
});
test('irrational roots compare exactly across different defining polynomials and signs detect common factors',()=>{
 const f=p(-2n,0n,1n),roots=isolateRealRoots(f);assert.equal(roots.length,2);roots.forEach(certify);
 const sqrt2=roots[1]!,negative=roots[0]!;
 assert.equal(sqrt2.compare(rational('7/5')),1);assert.equal(sqrt2.compare(rational('3/2')),-1);
 assert.equal(sqrt2.compare(negative),1);assert.equal(sqrt2.compare(sqrt2.refine()),0);
 const extended=isolateRealRoots(f.mul(p(-3n,0n,1n)));assert.equal(extended.length,4);
 assert.equal(sqrt2.compare(extended[2]!),0);assert.equal(negative.compare(extended[1]!),0);
 assert.equal(sqrt2.signOf(f),0);assert.equal(sqrt2.signOf(f.mul(p(5n,1n))),0);
 assert.equal(sqrt2.signOf(p(-1n,1n)),1);assert.equal(sqrt2.signOf(p(-3n,0n,1n)),-1);
 assert.equal(negative.signOf(p(0n,1n)),-1);assert.equal(negative.signOf(p(1n)),1);assert.equal(sqrt2.signOf(p()),0);
});
test('isolates extremely close roots and compares adjacent irrational roots without floating point',()=>{
 const tiny=Rational.parse('1/1'+'0'.repeat(35));
 const first=p(-2n,0n,1n),second=new Polynomial([new Rational(-2n).sub(tiny),0n,1n]);
 const a=isolateRealRoots(first)[1]!,b=isolateRealRoots(second)[1]!;
 assert.equal(a.compare(b),-1);assert.equal(b.compare(a),1);assert.equal(a.signOf(second),-1);
 const close=new Polynomial([tiny.neg(),1n]).mul(p(0n,1n)).mul(new Polynomial([tiny,1n]));
 const roots=isolateRealRoots(close);assert.equal(roots.length,3);roots.forEach(certify);
 roots.forEach((r,i)=>assert.equal(r.compare(rational([tiny.neg().toString(),'0',tiny.toString()][i]!)),0));
});
test('odd-degree and even-degree roots have distinct real branches; every returned root satisfies polynomial sign exactly',()=>{
 for(const f of [p(-2n,0n,0n,1n),p(-2n,0n,0n,0n,1n),p(1n,-1n,0n,0n,0n,1n)]){
  const roots=isolateRealRoots(f);assert.ok(roots.length>0);
  roots.forEach(r=>{certify(r);assert.equal(r.signOf(f),0);});
 }
 assert.equal(isolateRealRoots(p(-2n,0n,0n,1n)).length,1);
 assert.equal(isolateRealRoots(p(-2n,0n,0n,0n,1n)).length,2);
});
test('polynomial signs at quadratic irrational roots match an independent raw BigInt quadratic-field oracle',()=>{
 const sign=(n:bigint)=>n<0n?-1:n>0n?1:0;
 let seed=82743;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 let cases=0;
 for(const d of [2n,3n,5n,6n,7n,10n]){
  const roots=isolateRealRoots(p(-d,0n,1n));
  for(let trial=0;trial<40;trial++){
   const cs=Array.from({length:7},()=>BigInt(next()%13)-6n),q=new Polynomial(cs);
   let A=0n,B=0n;
   cs.forEach((c,i)=>{if(i%2===0)A+=c*d**BigInt(i/2);else B+=c*d**BigInt((i-1)/2);});
   for(const [i,root] of roots.entries()){
    const b=i===0?-B:B;
    const expected=b===0n?sign(A):A===0n?sign(b):sign(A)===sign(b)?sign(A):A>0n?sign(A*A-b*b*d):-sign(A*A-b*b*d);
    assert.equal(root.signOf(q),expected,`d=${d}, branch=${i}, q=${cs}`);cases++;
   }
  }
 }
 assert.equal(cases,480);
});
test('seeded factored polynomials match known rational root sets and open-interval counts',()=>{
 let seed=9841;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<30;trial++){
  let f=p(BigInt(1+next()%7),0n,1n);
  const known=new Map<string,Rational>();
  for(let i=0;i<4;i++){
   const r=new Rational(BigInt(next()%17)-8n,BigInt(1+next()%5));known.set(r.toString(),r);
   const factor=new Polynomial([r.neg(),1n]);f=f.mul(factor);if(next()%2)f=f.mul(factor);
  }
  const expected=[...known.values()].sort((a,b)=>a.compare(b)),actual=isolateRealRoots(f);
  assert.equal(actual.length,expected.length);
  actual.forEach((r,i)=>{certify(r);assert.equal(r.compare(rational(expected[i]!.toString())),0);});
  for(let j=0;j<8;j++){
   const a=new Rational(BigInt(next()%17)-8n,2n),b=a.add(new Rational(BigInt(1+next()%15),3n));
   assert.equal(countRealRoots(f,a,b),expected.filter(r=>a.compare(r)<0&&b.compare(r)>0).length);
  }
 }
});

test('32 independent SymPy fixtures agree on total counts, 256 open intervals and isolated real branches',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/real-roots.json',import.meta.url),'utf8')) as {
  oracle:string;fixtures:{coefficients:string[];total:number;intervals:{lower:string;upper:string;count:number}[];isolators:{lower:string;upper:string}[]}[];
 };
 assert.equal(data.oracle,'SymPy 1.14.0');assert.equal(data.fixtures.length,32);
 for(const fixture of data.fixtures){
  const f=new Polynomial(fixture.coefficients),roots=isolateRealRoots(f);
  assert.equal(roots.length,fixture.total);assert.equal(roots.length,fixture.isolators.length);
  for(const interval of fixture.intervals)assert.equal(countRealRoots(f,interval.lower,interval.upper),interval.count);
  roots.forEach((root,i)=>{
   certify(root);const interval=fixture.isolators[i]!;
   if(interval.lower===interval.upper)assert.equal(root.compare(rational(interval.lower)),0);
   else {assert.equal(root.compare(rational(interval.lower)),1);assert.equal(root.compare(rational(interval.upper)),-1);}
  });
 }
});

test('rational algebraic points are exact, frozen and stable under refinement',()=>{
 const value=AlgebraicReal.fromRational('7/3');
 assert.equal(value.rational!.toString(),'7/3');assert.equal(value.refine(),value);assert.ok(Object.isFrozen(value));
 assert.equal(value.compare(rational('7/3')),0);assert.equal(value.signOf(new Polynomial([-7n,3n])),0);
 assert.equal(value.signOf(new Polynomial([2n,1n])),1);
});
test('exact rational affine images preserve root identity, order and inverse images',()=>{
 const sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!;
 const image=sqrt2.affine(-2n,3n),expected=isolateRealRoots(new Polynomial([1n,-6n,1n]))[0]!;
 assert.equal(image.compare(expected),0);certify(image);
 assert.equal(image.affine('-1/2','3/2').compare(sqrt2),0);
 assert.equal(sqrt2.affine(0n,'7/3').compare(AlgebraicReal.fromRational('7/3')),0);
 assert.equal(AlgebraicReal.fromRational('2/3').affine(3n,-1n).rational!.toString(),'1');
});
