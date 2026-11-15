import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,countRealRoots,isolateRealRoots} from '../dist/index.js';
const P=(...xs:bigint[])=>new Polynomial(xs),q=(n:bigint)=>AlgebraicReal.fromRational(n),one=P(1n),t=P(0n,1n),r=q(2n).sqrt(),K=P(3n,1n);
function certified(x:AlgebraicReal){if(x.rational!==null)return;assert.equal(countRealRoots(x.polynomial,x.lower,x.upper),1);assert.equal(x.polynomial.evaluate(x.lower).sign()*x.polynomial.evaluate(x.upper).sign(),-1);assert.equal(x.refine().compare(x),0);}
test('correlated quadratic images retain the quartic degree and select both radical sheets exactly',()=>{
 // Eliminate t from t²=2 and (x-t)²=3+t: x⁴-10x²-8x-1=0.
 const oracle=isolateRealRoots(P(-1n,-8n,-10n,0n,1n));assert.equal(oracle.length,4);
 for(const [c,index] of [[1n,3],[-1n,1]] as const){const v=r.quadraticImage(t,K,c);assert.ok(v.polynomial.degree<=4);assert.equal(v.compare(oracle[index]!),0);certified(v);for(const d of [-2n,2n]){const divided=r.quadraticImage(t,K,c,P(d));assert.equal(divided.compare(oracle[index]!.affine(d===2n?'1/2':'-1/2')),0);assert.ok(divided.polynomial.degree<=4);certified(divided);}}
});
test('quadratic images reject poles and negative radicands, retain zero and remove denominator-zero conjugates',()=>{
 assert.throws(()=>r.quadraticImage(t,K,1n,P(-2n,0n,1n)),RangeError);assert.throws(()=>r.quadraticImage(t,P(-3n)),RangeError);
 const zero=r.quadraticImage(t,P(2n),-1n);assert.equal(zero.rational?.toString(),'0');assert.equal(r.quadraticImage(t,K,0n).compare(r),0);assert.equal(r.quadraticImage(t,P(-2n,0n,1n)).compare(r),0);
 const source=isolateRealRoots(P(0n,-2n,0n,1n)).find(x=>x.compare(r)===0)!;assert.ok(source);const v=source.quadraticImage(t,K,1n,t),expected=r.add(r.affine(1n,3n).sqrt()).div(r);assert.equal(v.compare(expected),0);assert.ok(v.polynomial.degree<=4);certified(v);
 assert.equal(q(2n).quadraticImage(P(1n),P(3n),2n,P(-2n)).compare(q(3n).sqrt().affine(-1n,'-1/2')),0);
});
test('quadratic-extension signs match integer arithmetic and handle radical cancellation without an extension',()=>{
 for(let n=-3n;n<=3n;n++)for(let a=-3n;a<=3n;a++)for(let b=-2n;b<=2n;b++){const value=a+b*(n<0n?-n:n);assert.equal(q(n).signQuadratic(P(a),P(b),P(0n,0n,1n)),value<0n?-1:value>0n?1:0);}
 assert.equal(r.signQuadratic(t,P(-1n),P(2n)),0);assert.equal(r.signQuadratic(t,P(-2n),P(2n)),-1);assert.equal(r.signQuadratic(t,P(2n),P(2n)),1);assert.equal(r.signQuadratic(P(-1n),t,P(1n)),1);assert.equal(r.signQuadratic(P(-1n),t,P(0n)),-1);assert.throws(()=>r.signQuadratic(one,one,P(-1n)),RangeError);
});
test('quartic-source rational charts remain degree eight and agree with independent norm-sign comparisons',()=>{
 const source=isolateRealRoots(P(1n,0n,-10n,0n,1n))[3]!,N=P(2n,0n,1n),radicand=P(5n,1n);
 for(const c of [-2n,2n])for(const D of [P(-1n,1n),P(1n,-1n)]){const image=source.quadraticImage(N,radicand,c,D);assert.ok(image.polynomial.degree<=2*source.polynomial.degree);certified(image);
  for(let n=-4n;n<=4n;n++){const sign=source.signQuadratic(N.sub(D.scale(new Rational(n))),P(c),radicand),expected=sign===0?0:sign*source.signOf(D);assert.equal(image.compare(q(n)),expected);}
 }
});
