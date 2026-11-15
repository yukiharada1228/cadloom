import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,countRealRoots} from '../dist/index.js';
const q=(v:bigint|Rational)=>AlgebraicReal.fromRational(v);
function certificate(v:AlgebraicReal){if(v.rational!==null){assert.equal(v.polynomial.evaluate(v.rational).sign(),0);return;}assert.equal(countRealRoots(v.polynomial,v.lower,v.upper),1);assert.notEqual(v.polynomial.evaluate(v.lower).sign(),0);assert.notEqual(v.polynomial.evaluate(v.upper).sign(),0);assert.equal(v.polynomial.evaluate(v.lower).sign()*v.polynomial.evaluate(v.upper).sign(),-1);assert.equal(v.refine().compare(v),0);}
test('local sum/product isolation preserves dependent cancellation, tiny conjugate gaps and all signed branches',()=>{
 const r=q(2n).sqrt(),e=new Rational(1n,10n**40n),a=r.affine(1n,e),b=r.affine(-1n,e.mul(new Rational(2n))),sum=a.add(b),product=a.mul(b);
 assert.equal(sum.compare(q(e.mul(new Rational(3n)))),0);certificate(sum);
 const expected=r.affine(e,new Rational(-2n).add(e.mul(e).mul(new Rational(2n))));assert.equal(product.compare(expected),0);certificate(product);
 const s=q(3n).sqrt();for(const A of [r,r.neg()])for(const B of [s,s.neg()]){const sum=A.add(B),product=A.mul(B);assert.equal(sum.sign(),B.sign());assert.equal(product.compare(q(6n).sqrt().affine(BigInt(A.sign()*B.sign()))),0);certificate(sum);certificate(product);}
});
test('dependent cancellation preserves canonical rational zero before further coordinate construction',()=>{
 const r=q(2n).sqrt(),zero=r.affine(1n,1n).add(r.affine(-1n,-1n));assert.equal(zero.rational?.toString(),'0');assert.equal(zero.affine(3n,-2n).rational?.toString(),'-2');assert.equal(zero.mul(r).rational?.toString(),'0');
});
