import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,point3,vector3,line3,cylinder3,plane3,translateAlgebraicPoint3} from '../dist/index.js';
import {algebraicQuadraticPoint3} from '../dist/geometry/algebraic-point3.js';
import {faceSupportsAgree3} from '../dist/geometry/face-domain-binding3.js';
const P=(...xs:bigint[])=>new Polynomial(xs),T=P(0n,1n),r=AlgebraicReal.fromRational(2n).sqrt(),O=point3(0n,0n);
test('coincident nonunit cylinders keep outward coorientation under shifted and reversed axes',()=>{
 const a={kind:'cylinder' as const,cylinder:cylinder3(line3(O,vector3(1n,1n,1n)),2n)},b={kind:'cylinder' as const,cylinder:cylinder3(line3(point3(10n,10n,10n),vector3(-3n,-3n,-3n)),2n)},p=algebraicQuadraticPoint3(r,[P(1n,1n),P(-1n,1n),T],vector3(1n,1n,1n),P(3n));
 for(const A of [-1,1] as const)for(const B of [-1,1] as const)assert.equal(faceSupportsAgree3(a,A,b,B,p),A===B);
 assert.throws(()=>faceSupportsAgree3(a,1,b,1,translateAlgebraicPoint3(p,point3(1n,-1n))),/point on the surface/);assert.equal(faceSupportsAgree3(a,1,{kind:'cylinder',cylinder:cylinder3(a.cylinder.axis,3n)},1,p),false);
 assert.throws(()=>faceSupportsAgree3({...a,cylinder:{...a.cylinder,radiusSquared:new Rational(0n)}},1,b,1,p),RangeError);
});
test('plane coorientation respects rational normal sign and validates the actual sample',()=>{
 const p=algebraicQuadraticPoint3(r,[T,P(),T.scale(new Rational(-1n,3n))],vector3(0n,1n,'-2/3'),P(3n)),a={kind:'plane' as const,plane:plane3(1n,2n,3n)},tiny=new Rational(-1n,10n**100n),b={kind:'plane' as const,plane:plane3(tiny,tiny.mul(new Rational(2n)),tiny.mul(new Rational(3n)))};
 assert.equal(faceSupportsAgree3(a,1,b,-1,p),true);assert.equal(faceSupportsAgree3(a,1,b,1,p),false);assert.equal(faceSupportsAgree3(a,-1,a,-1,p),true);assert.throws(()=>faceSupportsAgree3(a,1,b,-1,translateAlgebraicPoint3(p,point3(1n,0n))),/point on the surface/);assert.equal(faceSupportsAgree3(a,1,{kind:'plane',plane:plane3(1n,2n,3n,1n)},1,p),false);
});
