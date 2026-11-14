import test from 'node:test';
import assert from 'node:assert/strict';
import {Polynomial,Rational} from '../dist/index.js';
const p=(...xs:bigint[])=>new Polynomial(xs);
const power=(x:Rational,n:number)=>{let v=new Rational(1n);for(let i=0;i<n;i++)v=v.mul(x);return v;};
const direct=(a:Polynomial,x:Rational)=>a.coefficients.reduce((s,c,i)=>s.add(c.mul(power(x,i))),new Rational(0n));
test('polynomial normalization, exact inputs, derivative and rejected divisions',()=>{
 const values=[Rational.parse('1/3'),new Rational(2n),new Rational(0n)];
 const a=new Polynomial(values);values[0]=new Rational(9n);
 assert.equal(a.degree,1);assert.equal(a.coefficients[0]!.toString(),'1/3');
 assert.deepEqual(new Polynomial([0n,0n]).coefficients,[]);assert.equal(p().degree,-1);
 assert.equal(a.derivative().evaluate(9n).toString(),'2');assert.equal(p(3n).derivative().degree,-1);
 assert.throws(()=>a.divRem(p()),RangeError);assert.throws(()=>a.coefficient(-1),RangeError);
 assert.throws(()=>a.coefficient(0.5),RangeError);assert.throws(()=>new Polynomial([0.5 as unknown as bigint]),TypeError);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.coefficients));
});
test('seeded rational polynomials: arithmetic and Euclidean division versus independent power-sum evaluation',()=>{
 let seed=3871;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const make=()=>new Polynomial(Array.from({length:1+next()%6},()=>new Rational(BigInt(next()%17)-8n,BigInt(1+next()%7))));
 for(let i=0;i<200;i++){
  const a=make(),b=make(),x=new Rational(BigInt(next()%11)-5n,BigInt(1+next()%5));
  assert.ok(a.evaluate(x).equals(direct(a,x)));
  assert.ok(a.add(b).evaluate(x).equals(direct(a,x).add(direct(b,x))));
  assert.ok(a.mul(b).evaluate(x).equals(direct(a,x).mul(direct(b,x))));
  assert.ok(a.sub(b).add(b).equals(a));
  if(b.degree<0)continue;
  const {quotient,remainder}=a.divRem(b);
  assert.ok(quotient.mul(b).add(remainder).equals(a));assert.ok(remainder.degree<b.degree);
  const g=a.gcd(b);
  assert.equal(a.divRem(g).remainder.degree,-1);assert.equal(b.divRem(g).remainder.degree,-1);
  assert.equal(g.coefficients[g.degree]!.toString(),'1');
 }
});
test('square-free parts preserve distinct roots, remove multiplicities and normalize signs',()=>{
 const a=p(-1n,1n),b=p(2n,1n),c=p(1n,0n,1n);
 const repeated=a.mul(a).mul(a).mul(b).mul(b).mul(c).scale('-7/3');
 assert.ok(repeated.squareFree().equals(a.mul(b).mul(c)));
 assert.ok(p().squareFree().equals(p()));assert.ok(p(-8n).squareFree().equals(p(1n)));
 assert.ok(p().gcd(p()).equals(p()));
});
