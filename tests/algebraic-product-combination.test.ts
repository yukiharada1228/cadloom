import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial} from '../dist/index.js';
const real=(v:Parameters<typeof AlgebraicReal.fromRational>[0])=>AlgebraicReal.fromRational(v);
test('common-source products cancel dependent conjugates exactly',()=>{
 const t=real(2n).sqrt(),x=t.affine(3n,1n),y=t.affine(-2n,5n),sum=AlgebraicReal.productCombination([{factors:[x,y]},{factors:[t],coefficient:-13n}],7n);assert.equal(sum.sign(),0);assert.equal(sum.rational?.numerator,0n);assert.equal(AlgebraicReal.productCombination([{factors:[t,t,t,t]}]).compare(real(4n)),0);
});
test('represented roots exclude denominator poles at other conjugates',()=>{
 const p=new Polynomial([-2n,0n,1n]).mul(new Polynomial([-3n,1n])),t=AlgebraicReal.fromIsolatingInterval(p,1n,2n),inv=t.rationalFunction(new Polynomial([1n]),new Polynomial([-3n,1n])),result=AlgebraicReal.productCombination([{factors:[inv,t.affine(1n,-3n)]}],-1n);assert.equal(result.sign(),0);
});
test('unrelated algebraic sources retain the complete exact fallback',()=>{
 const a=real(2n).sqrt(),b=real(3n).sqrt(),value=AlgebraicReal.productCombination([{factors:[a,b]}]);assert.equal(value.compare(real(6n).sqrt()),0);assert.equal(AlgebraicReal.productCombination([{factors:[],coefficient:'2/3'},{factors:[real(3n)],coefficient:'1/3'}],'1/3').compare(real(2n)),0);
});
test('factory ownership is checked even in a zero-coefficient term',()=>{
 assert.throws(()=>AlgebraicReal.productCombination([{factors:[{} as AlgebraicReal],coefficient:0n}]),/factory/);assert.equal(AlgebraicReal.productCombination([],'5/7').compare(real('5/7')),0);
});
