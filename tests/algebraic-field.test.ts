import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,isolateRealRoots} from '../dist/index.js';
const q=(x:bigint|string)=>AlgebraicReal.fromRational(x);
const sqrt=(d:bigint)=>isolateRealRoots(new Polynomial([-d,0n,1n]))[1]!;
const zero=q(0n);
test('independent quadratic fields combine into the correct real branches',()=>{
 const a=sqrt(2n),b=sqrt(3n),sum=a.add(b),difference=a.sub(b),product=a.mul(b);
 assert.equal(sum.compare(isolateRealRoots(new Polynomial([1n,0n,-10n,0n,1n]))[3]!),0);
 assert.equal(sum.compare(q(3n)),1);assert.equal(sum.compare(q(4n)),-1);
 assert.equal(difference.compare(zero),-1);assert.equal(product.compare(sqrt(6n)),0);
 assert.equal(a.div(b).compare(isolateRealRoots(new Polynomial(['-2/3',0n,1n]))[1]!),0);
 assert.equal(a.neg().mul(b.neg()).compare(product),0);assert.equal(a.neg().add(b.neg()).compare(sum.neg()),0);
 assert.equal(a.div(b.neg()).compare(a.div(b).neg()),0);
 assert.equal(sum.mul(difference).compare(q(-1n)),0);
 assert.equal(a.sub(a).compare(zero),0);assert.equal(a.add(a.neg()).compare(zero),0);
 assert.equal(a.mul(a).compare(q(2n)),0);
});
test('quadratic-field arithmetic matches independent coefficient formulas for all four operations',()=>{
 let cases=0;
 for(const d of [2n,3n,5n])for(let i=1n;i<=4n;i++){
  const root=sqrt(d),A=i-2n,B=i+1n,C=3n-i,D=2n;
  const a=root.affine(B,A),b=root.affine(D,C);
  assert.equal(a.add(b).compare(root.affine(B+D,A+C)),0);cases++;
  assert.equal(a.sub(b).compare(root.affine(B-D,A-C)),0);cases++;
  assert.equal(a.mul(b).compare(root.affine(A*D+B*C,A*C+B*D*d)),0);cases++;
  const norm=C*C-D*D*d;
  const expected=root.affine(new Rational(B*C-A*D,norm),new Rational(A*C-B*D*d,norm));
  assert.equal(a.div(b).compare(expected),0);cases++;
 }
 assert.equal(cases,48);
});
test('zero, rational and nonminimal root certificates retain exact division guards and inverse branches',()=>{
 const hiddenZero=isolateRealRoots(new Polynomial([0n,1n,0n,1n]))[0]!;
 assert.equal(hiddenZero.rational,null);assert.throws(()=>hiddenZero.reciprocal(),RangeError);
 const a=sqrt(2n);assert.throws(()=>a.div(hiddenZero),RangeError);assert.throws(()=>q(0n).reciprocal(),RangeError);
 assert.equal(hiddenZero.mul(a).compare(zero),0);assert.equal(hiddenZero.add(a).compare(a),0);
 assert.equal(a.neg().reciprocal().compare(a.affine('-1/2')),0);
 const withZero=isolateRealRoots(new Polynomial([0n,-2n,1n]))[1]!;
 assert.equal(withZero.reciprocal().compare(q('1/2')),0);
 assert.equal(q('-2/3').reciprocal().compare(q('-3/2')),0);
 assert.equal(q('2/3').add(q('3/5')).compare(q('19/15')),0);
 const computedZero=a.mul(a).sub(q(2n));assert.equal(computedZero.sign(),0);assert.throws(()=>computedZero.reciprocal(),RangeError);
 assert.equal(a.mul(q(0n)).compare(zero),0);assert.ok(Object.isFrozen(a.add(a)));
});
test('near cancellation has exact positive sign, distinctness and a valid nonzero reciprocal',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(20));
 const a=sqrt(2n),b=isolateRealRoots(new Polynomial([new Rational(-2n).sub(epsilon),0n,1n]))[1]!;
 const delta=b.sub(a);
 assert.equal(delta.compare(zero),1);assert.equal(delta.compare(AlgebraicReal.fromRational(epsilon)), -1);
 assert.equal(delta.reciprocal().compare(q(0n)),1);
});
test('three independently represented algebraic points have exact orientation and collinearity',async()=>{
 const {algebraicCoordinates2,orientAlgebraicPoints2,compareAlgebraicPoints2}=await import('../dist/index.js');
 const a=sqrt(2n),b=sqrt(3n),origin=algebraicCoordinates2(0n,0n);
 const p=algebraicCoordinates2(a,b),r=algebraicCoordinates2(a.add(q(1n)),b.add(q(1n)));
 assert.equal(orientAlgebraicPoints2(origin,p,r),-1); // sqrt(2) - sqrt(3)
 assert.equal(orientAlgebraicPoints2(origin,r,p),1);
 const doubled=algebraicCoordinates2(a.affine(2n),b.affine(2n));
 assert.equal(orientAlgebraicPoints2(origin,p,doubled),0);
 assert.equal(compareAlgebraicPoints2(p,doubled),-1);assert.equal(a.sign(),1);assert.ok(a.equals(sqrt(2n)));
 assert.ok(Object.isFrozen(p));
});
test('cubic roots and mixed degrees obey independent annihilating polynomial identities',()=>{
 const a=isolateRealRoots(new Polynomial([-2n,0n,0n,1n]))[0]!,b=isolateRealRoots(new Polynomial([-3n,0n,0n,1n]))[0]!;
 assert.equal(a.mul(b).compare(isolateRealRoots(new Polynomial([-6n,0n,0n,1n]))[0]!),0);
 assert.equal(a.reciprocal().compare(isolateRealRoots(new Polynomial(['-1/2',0n,0n,1n]))[0]!),0);
 const sum=a.add(b),difference=a.sub(b);
 // (s^3 - 5)^3 = 162*s^3 for s = cbrt(2)+cbrt(3).
 assert.equal(sum.signOf(new Polynomial([-125n,0n,0n,-87n,0n,0n,-15n,0n,0n,1n])),0);
 assert.equal(sum.compare(q(2n)),1);assert.equal(sum.compare(q(3n)),-1);
 assert.equal(difference.signOf(new Polynomial([1n,0n,0n,165n,0n,0n,3n,0n,0n,1n])),0);assert.equal(difference.sign(),-1);
 const mixed=a.add(sqrt(2n));
 // (s^3 + 6*s - 2)^2 = 2*(3*s^2 + 2)^2 for s = cbrt(2)+sqrt(2).
 assert.equal(mixed.signOf(new Polynomial([-4n,-24n,12n,-4n,-6n,0n,1n])),0);
 assert.equal(mixed.compare(q(2n)),1);assert.equal(mixed.compare(q(3n)),-1);
});

test('fully irrational translated triangles preserve orientation without assuming shared coordinate objects',async()=>{
 const {algebraicCoordinates2,orientAlgebraicPoints2}=await import('../dist/index.js');
 const a=sqrt(2n),b=sqrt(3n),origin=algebraicCoordinates2(a,b);
 const first=algebraicCoordinates2(a.affine(1n,1n),b.refine()),second=algebraicCoordinates2(a.refine(),b.affine(1n,1n));
 assert.equal(orientAlgebraicPoints2(origin,first,second),1);
 assert.equal(orientAlgebraicPoints2(origin,second,first),-1);
});
test('principal square roots select exact nonnegative branches across conjugate fields',()=>{
 const a=sqrt(2n),b=sqrt(3n),fourth=a.sqrt();
 assert.equal(fourth.compare(isolateRealRoots(new Polynomial([-2n,0n,0n,0n,1n]))[1]!),0);
 assert.equal(a.affine(1n,2n).sqrt().compare(isolateRealRoots(new Polynomial([2n,0n,-4n,0n,1n]))[3]!),0);
 assert.equal(b.affine(1n,2n).sqrt().compare(sqrt(6n).add(a).affine('1/2')),0);
 assert.equal(b.affine(-1n,2n).sqrt().compare(sqrt(6n).sub(a).affine('1/2')),0);
 assert.equal(q('9/16').sqrt().compare(q('3/4')),0);assert.equal(q(0n).sqrt().sign(),0);
 assert.throws(()=>a.neg().sqrt(),RangeError);
 const hiddenZero=isolateRealRoots(new Polynomial([0n,1n,0n,1n]))[0]!;assert.equal(hiddenZero.sqrt().compare(q(0n)),0);
 const nonminimal=isolateRealRoots(new Polynomial([0n,-2n,1n]))[1]!;assert.equal(nonminimal.sqrt().compare(a),0);
});
