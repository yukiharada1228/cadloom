import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,Polynomial,isolateRealRoots,AlgebraicReal,point3,vector3,plane3,algebraicPoint3,algebraicSegment3,intersectAlgebraicSegmentPlane3} from '../dist/index.js';
test('distinct roots of one quadratic use independently known Vieta sums and products',()=>{
 for(let a=1n;a<=4n;a++)for(let b=-4n;b<=4n;b++)for(let c=-3n;c<=2n;c++){
  if(b*b-4n*a*c<=0n)continue;const roots=isolateRealRoots(new Polynomial([c,b,a]));assert.equal(roots.length,2);const x=roots[0]!,y=roots[1]!;
  assert.equal(x.add(y).compare(AlgebraicReal.fromRational(new Rational(-b,a))),0);assert.equal(x.mul(y).compare(AlgebraicReal.fromRational(new Rational(c,a))),0);
  const copy=x.affine(1n);assert.equal(x.sub(copy).sign(),0);assert.equal(x.add(copy).compare(x.affine(2n)),0);assert.ok(x.mul(copy).polynomial.degree<=2);
 }
});
test('a common rational line support avoids expanding conjugate endpoint interpolation',()=>{
 const roots=isolateRealRoots(new Polynomial([-2n,-1n,1n])),a=algebraicPoint3(point3(0n,0n,0n),vector3(1n,2n,3n),roots[0]!),b=algebraicPoint3(point3(0n,0n,0n),vector3(1n,2n,3n),roots[1]!),hit=intersectAlgebraicSegmentPlane3(algebraicSegment3(a,b),plane3(1n,0n,0n));assert.equal(hit.kind,'point');if(hit.kind==='point'){assert.equal(hit.point.x.sign(),0);assert.equal(hit.point.y.sign(),0);assert.equal(hit.point.z.sign(),0);assert.ok(hit.parameter.polynomial.degree<=2);}
});
test('perfect rational square roots stay rational for large non-dyadic numerators and denominators',()=>{
 for(const n of [1n,2n,3n,7n,12345n,10n**200n+12345n])for(const d of [1n,3n,17n,7n*10n**100n+3n]){
  const expected=new Rational(n,d),square=new Rational(n*n,d*d),root=AlgebraicReal.fromRational(square).sqrt();assert.ok(root.rational);assert.ok(root.rational.equals(expected));assert.equal(root.polynomial.degree,1);
 }
 for(let n=2n;n<=15n;n++){const q=AlgebraicReal.fromRational(n*n+1n),root=q.sqrt();assert.equal(root.mul(root).compare(q),0);assert.equal(root.sign(),1);}
});
