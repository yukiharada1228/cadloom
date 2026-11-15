import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3} from '../dist/index.js';
import {signBiparametricQuadratic3} from '../dist/geometry/algebraic-point3.js';
const q=(x:bigint)=>new Rational(x),zero=q(0n),one=q(1n),O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n);
test('biparametric quadratic signs agree with independent integer evaluation',()=>{
 for(let s=-3n;s<=3n;s++)for(let t=-3n;t<=3n;t++)for(let k=-2n;k<=2n;k++){
  const value=k+(k-1n)*s+(k+1n)*t+(2n-k)*s*s+(k+2n)*s*t-(k+3n)*t*t;
  const p={origin:O,u:X,s:AlgebraicReal.fromRational(s),v:Y,t:AlgebraicReal.fromRational(t)};
  assert.equal(signBiparametricQuadratic3(p,q(k),q(k-1n),q(k+1n),q(2n-k),q(k+2n),q(-k-3n)),value<0n?-1:value>0n?1:0);
 }
});
test('quadratic filtering retains correlated zeros and microscopic strict signs',()=>{
 const s=AlgebraicReal.fromRational(2n).sqrt(),t=AlgebraicReal.fromRational(3n).sqrt(),p={origin:O,u:X,s,v:Y,t},tiny=new Rational(1n,10n**40n);
 // s²+t²=5, with both positive and negative cross terms tested separately.
 for(const c of [q(-5n),q(-5n).add(tiny),q(-5n).sub(tiny)])assert.equal(signBiparametricQuadratic3(p,c,zero,zero,one,zero,one),c.add(q(5n)).sign());
 for(const sign of [-1n,1n])assert.equal(signBiparametricQuadratic3(p,zero,zero,zero,zero,q(sign),zero),Number(sign));
 const same={...p,t:s};assert.equal(signBiparametricQuadratic3(same,zero,one,one.neg(),one,q(-2n),one),0);
});
