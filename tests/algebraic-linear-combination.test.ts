import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial} from '../dist/index.js';
const r=(s:bigint|string)=>AlgebraicReal.fromRational(s);
test('opt-in linear images retain a shared field through legacy arithmetic and huge offsets',()=>{
 const u=r('1/2').sqrt(),v=r('1/3'),T=r(10n**30n),h=u.mul(v).div(u.add(r(1n))),x=u.add(h).add(T),y=v.add(h.mul(r(2n))).sub(T),z=h.add(T.mul(r(2n))),U=AlgebraicReal.linearCombination([{value:x,coefficient:1n},{value:z,coefficient:-1n}],10n**30n),V=AlgebraicReal.linearCombination([{value:y,coefficient:1n},{value:z,coefficient:-2n}],5n*10n**30n);assert.equal(U.compare(u),0);assert.equal(V.compare(v),0);assert.ok(U.polynomial.degree<=u.polynomial.degree);assert.equal(V.rational!.toString(),'1/3');assert.ok(Object.isFrozen(U));
});
test('rational images, refinement and reciprocal preserve private source provenance',()=>{
 const u=r(2n).sqrt(),F=new Polynomial([3n,2n]),A=F.mul(F).add(new Polynomial([1n])),B=F.add(new Polynomial([2n])),f=u.affine(2n,3n),g=f.rationalFunction(new Polynomial([1n,0n,1n]),new Polynomial([2n,1n])).refine().refine(),h=g.reciprocal(),actual=AlgebraicReal.linearCombination([{value:g,coefficient:3n},{value:h,coefficient:2n},{value:u,coefficient:-1n}],5n),expected=u.rationalFunction(A.mul(A).scale(3n).add(B.mul(B).scale(2n)).add(new Polynomial([5n,-1n]).mul(A).mul(B)),A.mul(B));assert.equal(actual.compare(expected),0);assert.ok(actual.polynomial.degree<=u.polynomial.degree);assert.throws(()=>u.rationalFunction(new Polynomial([1n]),u.polynomial),/zero denominator/);
});
test('independent generators retain complete arithmetic fallback and equal values remain exact',()=>{
 const a=r(2n).sqrt(),b=r(3n).sqrt(),actual=AlgebraicReal.linearCombination([{value:a,coefficient:1n},{value:b,coefficient:2n}],'-1/2'),expected=a.add(b.affine(2n)).affine(1n,'-1/2');assert.equal(actual.compare(expected),0);const separatelyConstructed=r(2n).sqrt();assert.equal(AlgebraicReal.linearCombination([{value:a,coefficient:1n},{value:separatelyConstructed,coefficient:-1n}]).sign(),0);
});
test('rational, empty and zero terms are exact and copied source claims are rejected',()=>{
 assert.equal(AlgebraicReal.linearCombination([],'7/5').rational!.toString(),'7/5');assert.equal(AlgebraicReal.linearCombination([{value:r(2n).sqrt(),coefficient:0n},{value:r('1/3'),coefficient:2n}],'1/5').rational!.toString(),'13/15');const a=r(2n).sqrt();assert.throws(()=>AlgebraicReal.linearCombination([{value:{...a,source:a} as never,coefficient:1n}]),/factory/);assert.throws(()=>AlgebraicReal.linearCombination([{value:a,coefficient:0.5 as never}]),/exact|number|input/i);
});
