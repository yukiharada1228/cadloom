import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational} from '../dist/index.js';
import {nurbsBoundaryCoordinateRoots3} from '../dist/geometry/nurbs-intersection-boundary-nodes3.js';
test('affine rational images and single-term combinations satisfy an independent cubic and retain the real branch',()=>{
 const a=AlgebraicReal.isolate(new Polynomial([-2n,0n,0n,1n]))[0]!,scale=Rational.parse('3/2'),offset=Rational.parse('-7/3'),forms=[a.rationalFunction(new Polynomial([offset.mul(new Rational(2n)),3n]),new Polynomial([2n])),AlgebraicReal.linearCombination([{value:a,coefficient:scale}],offset),AlgebraicReal.productCombination([{factors:[a,AlgebraicReal.fromRational('1/2')],coefficient:3n}],offset)],variable=new Polynomial([offset.neg(),1n]),equation=variable.mul(variable).mul(variable).sub(new Polynomial([scale.mul(scale).mul(scale).mul(new Rational(2n))]));
 for(const value of forms){assert.equal(value.signOf(equation),0);assert.equal(value.sign(),-1);assert.equal(value.compare(forms[0]!),0);}
 assert.equal(a.rationalFunction(new Polynomial([7n]),new Polynomial([2n])).rational?.toString(),'7/2');assert.equal(a.rationalFunction(new Polynomial()).sign(),0);assert.throws(()=>a.rationalFunction(new Polynomial([1n]),a.polynomial),/zero denominator/);
});
test('coordinate inverse recognizes an exactly rational root hidden in a reducible high-degree certificate',()=>{
 const value=AlgebraicReal.fromIsolatingInterval(new Polynomial([0n,-1n,0n,0n,0n,0n,0n,1n]),'3/4','5/4');assert.equal(value.rational,null);const span={index:0,startParameter:new Rational(0n),endParameter:new Rational(1n),x:new Polynomial([0n,1n]),y:new Polynomial(),z:new Polynomial(),weight:new Polynomial([1n])},roots=nurbsBoundaryCoordinateRoots3(span,'x',value);assert.equal(roots?.length,1);assert.equal(roots![0]!.rational?.toString(),'1');assert.equal(roots![0]!.compare(value),0);
});
