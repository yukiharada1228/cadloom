import test from 'node:test';
import assert from 'node:assert/strict';
import {BivariatePolynomial,Polynomial,Rational,polynomialResultant} from '../dist/index.js';
import {resultantOverBivariatePolynomials} from '../dist/numeric/bivariate-resultant.js';
const zero=new BivariatePolynomial(),one=new BivariatePolynomial([[1n]]),u=new BivariatePolynomial([[0n],[1n]]),v=new BivariatePolynomial([[0n,1n]]);
test('bivariate coefficient resultants match independent linear and quadratic elimination formulas',()=>{
 assert.ok(resultantOverBivariatePolynomials([u.scale(-1n),one],[v.scale(-1n),one]).equals(u.sub(v)));assert.ok(resultantOverBivariatePolynomials([u.scale(-1n),zero,one],[v.scale(-1n),one]).equals(v.mul(v).sub(u)));assert.ok(resultantOverBivariatePolynomials([u.scale(-1n),zero,one],[u.scale(-1n),one,one]).equals(u.scale(-1n)));const A=u.add(v),B=u.mul(v).add(one),C=u.sub(v),D=u.scale(2n).add(v.scale(3n));assert.ok(resultantOverBivariatePolynomials([B,A],[D,C]).equals(A.mul(D).sub(B.mul(C))));
});
test('zero, constants and common parameter factors obey exact determinant conventions',()=>{
 assert.equal(resultantOverBivariatePolynomials([], [one]).degreeU,-1);assert.ok(resultantOverBivariatePolynomials([u],[v]).equals(one));assert.ok(resultantOverBivariatePolynomials([u],[one,zero,one]).equals(u.mul(u)));assert.equal(resultantOverBivariatePolynomials([u.mul(v),u.add(v).scale(-1n),one],[u.scale(-1n),one]).degreeU,-1);
});
test('specialization of a degree-three/degree-two resultant agrees with 25 rational Sylvester determinants',()=>{
 const p=[u,v,u.mul(v).add(one),one],q=[u.sub(v),u.add(one),one],f=resultantOverBivariatePolynomials(p,q);for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const a=new Rational(BigInt(i),2n),b=new Rational(BigInt(j),3n),P=new Polynomial(p.map(c=>c.evaluate(a,b))),Q=new Polynomial(q.map(c=>c.evaluate(a,b)));assert.equal(f.evaluate(a,b).compare(polynomialResultant(P,Q)),0);}
});
