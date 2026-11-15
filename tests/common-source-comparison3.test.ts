import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,point3,vector3,translateAlgebraicPoint3} from '../dist/index.js';
import {algebraicPoint3,algebraicRationalPoint3,algebraicQuadraticPoint3,compareAlgebraicPoints3,algebraicPointsEqual3,compareLinearPoints3} from '../dist/geometry/algebraic-point3.js';
const P=(...xs:bigint[])=>new Polynomial(xs),T=P(0n,1n),O=point3(0n,0n),r=AlgebraicReal.fromRational(2n).sqrt(),N:[Polynomial,Polynomial,Polynomial]=[T,P(),P()],a=algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(3n));
test('shared quadratic source comparisons agree with independent translation differences and signed denominators',()=>{
 const v=point3(1n,2n,3n),b=translateAlgebraicPoint3(a,v);for(const n of [vector3(1n,0n),vector3(0n,-1n),vector3(1n,2n,-3n),vector3(-2n,3n,1n),O]){const expected=n.x.mul(v.x).add(n.y.mul(v.y)).add(n.z.mul(v.z)).neg().sign();assert.equal(compareLinearPoints3(a,b,n),expected);assert.equal(compareLinearPoints3(b,a,n),expected===0?0:-expected);}
 const opposite=algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(3n),P(-1n));assert.equal(compareLinearPoints3(a,opposite,vector3(1n,1n)),1);assert.equal(compareLinearPoints3(opposite,a,vector3(1n,1n)),-1);
 const same=algebraicQuadraticPoint3(r,[T.neg(),P(),P()],vector3(0n,-1n),P(3n),P(-1n));for(const n of [vector3(1n,1n),vector3(-1n,-2n,3n),vector3(0n,1n)]){assert.equal(compareLinearPoints3(a,same,n),0);assert.equal(Object.is(compareLinearPoints3(a,same,n),-0),false);}
});
test('affine, rational and quadratic charts can compare in one source with exact cancellation',()=>{
 const affine=algebraicPoint3(O,vector3(1n,2n,3n),r),rational=algebraicRationalPoint3(r,[T,T.scale(2n),T.scale(3n)]);assert.equal(compareLinearPoints3(affine,rational,vector3(-2n,3n,1n)),0);
 const x=algebraicRationalPoint3(r,N);assert.equal(compareLinearPoints3(a,x,vector3(1n,-1n)),-1);assert.equal(compareLinearPoints3(a,x,vector3(1n,0n)),0);
 const radical=algebraicQuadraticPoint3(r,[P(),P(),P()],vector3(0n,1n),P(2n)),source=algebraicRationalPoint3(r,[P(),T,P()]);assert.equal(compareLinearPoints3(radical,source,vector3(1n,1n)),0);
 const poleSide=algebraicRationalPoint3(r,[P(1n),P(),P()],P(-2n,1n)),unit=algebraicRationalPoint3(r,[P(1n),P(),P()]);assert.equal(compareLinearPoints3(poleSide,unit,vector3(1n,0n)),-1);
 const d=P(1n,1n),A=algebraicRationalPoint3(r,[d,T,P()],d),B=algebraicRationalPoint3(r,[d.scale(2n),T.scale(2n),P()],d.scale(2n));assert.equal(compareLinearPoints3(A,B,vector3(1n,2n)),0);
});
test('different radicals, conjugates and mutable unregistered points retain complete comparisons',()=>{
 const b=algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(5n));assert.equal(compareLinearPoints3(a,b,vector3(1n,1n)),-1);
 const negative=algebraicRationalPoint3(r.neg(),N),positive=algebraicRationalPoint3(r,N);assert.equal(compareLinearPoints3(negative,positive,vector3(1n,1n)),-1);
 const copy={...a};assert.equal(compareLinearPoints3(copy,a,vector3(1n,0n)),0);copy.x=AlgebraicReal.fromRational(0n);assert.equal(compareLinearPoints3(copy,a,vector3(1n,0n)),-1);assert.equal(compareLinearPoints3(copy,a,vector3(-1n,0n)),1);
});

test('shared-source lexicographic order and equality retain x/y/z priority and exact welding',()=>{
 for(const v of [point3(1n,-100n,-100n),point3(0n,1n,-100n),point3(0n,0n,1n),point3(-1n,100n,100n),O]){const b=translateAlgebraicPoint3(a,v),first=[v.x,v.y,v.z].find(c=>c.sign()!==0),expected=first?-first.sign():0;assert.equal(compareAlgebraicPoints3(a,b),expected);assert.equal(algebraicPointsEqual3(a,b),expected===0);assert.equal(compareAlgebraicPoints3(b,a),expected===0?0:-expected);}
 const same=algebraicQuadraticPoint3(r,[T.neg(),P(),P()],vector3(0n,-1n),P(3n),P(-1n));assert.equal(compareAlgebraicPoints3(a,same),0);assert.equal(algebraicPointsEqual3(a,same),true);
});
test('equivalent independently restored source roots compare through the same real field',()=>{
 const same=r.refine(),other=algebraicQuadraticPoint3(same,N,vector3(0n,1n),P(3n));assert.notEqual(same,r);assert.equal(compareAlgebraicPoints3(a,other),0);assert.equal(compareLinearPoints3(a,other,vector3(1n,1n)),0);const nonminimal=AlgebraicReal.fromIsolatingInterval(P(6n,0n,-5n,0n,1n),'7/5','3/2'),again=algebraicQuadraticPoint3(nonminimal,N,vector3(0n,1n),P(3n));assert.equal(compareAlgebraicPoints3(a,again),0);
});
