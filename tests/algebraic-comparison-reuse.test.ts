import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,isolateRealRoots} from '../dist/index.js';
test('repeated exact comparison preserves conjugate order, equivalent certificates and canonical zero',()=>{
 const roots=isolateRealRoots(new Polynomial([-2n,0n,1n])),a=roots[1]!,b=isolateRealRoots(new Polynomial([-6n,0n,1n]))[1]!,same=isolateRealRoots(new Polynomial([6n,0n,-5n,0n,1n])).find(r=>r.lower.sign()>=0&&r.compare(a)===0)!;assert.ok(same);
 for(let i=0;i<5;i++){
  assert.equal(a.compare(a),0);assert.equal(a.compare(same),0);assert.equal(same.compare(a),0);assert.equal(Object.is(same.compare(a),-0),false);
  assert.equal(a.compare(b),-1);assert.equal(b.compare(a),1);assert.equal(roots[0]!.compare(a),-1);assert.equal(a.compare(roots[0]!),1);
  assert.equal(a.refine().compare(a),0);assert.equal(a.compare(AlgebraicReal.fromRational('7/5')),1);assert.equal(a.compare(AlgebraicReal.fromRational('3/2')),-1);
 }
});
test('mutable structural receivers cannot reuse a previously cached comparison',()=>{
 const source=AlgebraicReal.fromRational(1n),other=AlgebraicReal.fromRational(2n),fake=Object.assign(Object.create(AlgebraicReal.prototype),source) as AlgebraicReal;
 assert.equal(fake.compare(other),-1);assert.equal(other.compare(fake),1);
 Object.assign(fake,AlgebraicReal.fromRational(3n));assert.equal(fake.compare(other),1);assert.equal(other.compare(fake),-1);
});
