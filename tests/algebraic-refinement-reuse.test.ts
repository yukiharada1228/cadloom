import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,countRealRoots,isolateRealRoots} from '../dist/index.js';
test('immutable refinement reuses exact certificates without changing the original root',()=>{
 const a=AlgebraicReal.fromRational(2n).sqrt(),lo=a.lower,hi=a.upper;let root=a;
 for(let i=0;i<20;i++){const next=root.refine();assert.equal(root.refine(),next);assert.equal(next.compare(a),0);assert.ok(next.lower.compare(root.lower)>=0&&next.upper.compare(root.upper)<=0);assert.equal(countRealRoots(next.polynomial,next.lower,next.upper),1);root=next;}
 assert.equal(a.lower,lo);assert.equal(a.upper,hi);assert.equal(AlgebraicReal.fromRational(0n).refine().rational!.sign(),0);
 const zero=isolateRealRoots(new Polynomial([0n,1n,0n,1n]))[0]!;assert.equal(zero.refine().rational!.sign(),0);assert.equal(zero.refine(),zero.refine());
 const fake=Object.assign(Object.create(AlgebraicReal.prototype),a) as AlgebraicReal,first=fake.refine();Object.assign(fake,{lower:new Rational(1n),upper:new Rational(3n,2n)});const second=fake.refine();assert.notEqual(second,first);assert.equal(second.lower.toString(),'5/4');assert.equal(second.upper.toString(),'3/2');
});
