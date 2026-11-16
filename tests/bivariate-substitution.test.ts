import test from 'node:test';
import assert from 'node:assert/strict';
import {BivariatePolynomial,Rational} from '../dist/index.js';
import {homogeneousBivariateSubstitution} from '../dist/numeric/bivariate-substitution.js';
const one=new BivariatePolynomial([[1n]]),u=new BivariatePolynomial([[0n],[1n]]),v=new BivariatePolynomial([[0n,1n]]);
test('homogeneous substitution uses total degree and preserves the exact circle identity',()=>{
 const F=u.mul(u).add(v.mul(v)).sub(one),A=u.mul(u),B=v,W=one.add(u),result=homogeneousBivariateSubstitution(F,A,B,W);assert.ok(result.equals(A.mul(A).add(B.mul(B)).sub(W.mul(W))));assert.equal(result.degreeU,4);assert.ok(homogeneousBivariateSubstitution(new BivariatePolynomial(),A,B,W).equals(new BivariatePolynomial()));assert.ok(homogeneousBivariateSubstitution(new BivariatePolynomial([[7n]]),A,B,W).equals(new BivariatePolynomial([[7n]])));
});
test('rational evaluations agree with direct denominator-cleared substitution',()=>{
 const F=u.mul(u).mul(v).add(u).sub(v).add(one.scale(3n)),A=u.add(v),B=u.sub(v),W=one.add(u.mul(u)),result=homogeneousBivariateSubstitution(F,A,B,W);for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const x=new Rational(BigInt(i),3n),y=new Rational(BigInt(j),5n),a=A.evaluate(x,y),b=B.evaluate(x,y),w=W.evaluate(x,y),expected=F.evaluate(a.div(w),b.div(w)).mul(w.mul(w).mul(w));assert.equal(result.evaluate(x,y).compare(expected),0);}
});
