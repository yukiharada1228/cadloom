import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,countRealRoots,encodeExactReal3,decodeExactReal3} from '../dist/index.js';
const P=(...xs:bigint[])=>new Polynomial(xs);
test('checked interval restoration preserves the supplied certificate and selected branch',()=>{
 const p=P(1n,0n,-10n,0n,1n),r=AlgebraicReal.fromIsolatingInterval(p,'1573/500','3147/1000');assert.equal(r.lower.toString(),'1573/500');assert.equal(r.upper.toString(),'3147/1000');assert.equal(countRealRoots(r.polynomial,r.lower,r.upper),1);const record=encodeExactReal3(r);assert.deepEqual(encodeExactReal3(decodeExactReal3(JSON.parse(JSON.stringify(record)))),record);
 const q=P(-2n,0n,1n),repeated=q.mul(q),positive=AlgebraicReal.fromIsolatingInterval(repeated,'7/5','3/2'),negative=AlgebraicReal.fromIsolatingInterval(q,'-3/2','-7/5');assert.equal(positive.compare(AlgebraicReal.fromRational(2n).sqrt()),0);assert.equal(positive.polynomial.degree,2);assert.equal(negative.compare(positive.neg()),0);assert.equal(AlgebraicReal.fromIsolatingInterval(P(0n,1n,0n,1n),'-1/2','1/2').rational?.toString(),'0');
});
test('interval constructors reject absent/multiple/endpoint roots and invalid ranges',()=>{
 for(const [p,lo,hi] of [[P(1n),'0','1'],[P(),'0','1'],[P(-2n,0n,1n),'-2','2'],[P(-2n,0n,1n),'2','3'],[P(-1n,0n,1n),'1','2'],[P(-2n,0n,1n),'2','1'],[P(-2n,0n,1n),'1','1']] as const)assert.throws(()=>AlgebraicReal.fromIsolatingInterval(p,lo,hi),/certificate/);
});
