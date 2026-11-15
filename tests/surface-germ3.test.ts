import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,surfaceGermSides3,point3,vector3,line3,cylinder3,plane3,evaluateCylinder3,AlgebraicReal,algebraicCoordinates3} from '../dist/index.js';
import type {Surface3,Point3,Vector3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=vector3(1n,0n,0n),Y=vector3(0n,1n,0n),Z=vector3(0n,0n,1n),wall:Surface3={kind:'cylinder',cylinder:cylinder3(line3(O,Z),1n)};
const neg=(v:Vector3)=>vector3(v.x.neg(),v.y.neg(),v.z.neg());
test('surface germs distinguish crossing, tangent and contained directions exactly',()=>{
 const p=point3(1n,0n,0n);
 assert.deepEqual(surfaceGermSides3(p,X,wall),{minus:-1,plus:1});
 assert.deepEqual(surfaceGermSides3(p,Y,wall),{minus:1,plus:1});
 assert.deepEqual(surfaceGermSides3(p,Z,wall),{minus:0,plus:0});
 assert.deepEqual(surfaceGermSides3(p,vector3(0n,0n,0n),wall),{minus:0,plus:0});
 const plane:Surface3={kind:'plane',plane:plane3(2n,0n,0n,-2n)};
 assert.deepEqual(surfaceGermSides3(p,X,plane),{minus:-1,plus:1});
 assert.deepEqual(surfaceGermSides3(p,Y,plane),{minus:0,plus:0});
 assert.deepEqual(surfaceGermSides3(p,X,{kind:'plane',plane:plane3(-2n,0n,0n,2n)}),{minus:1,plus:-1});
 assert.ok(Object.isFrozen(surfaceGermSides3(p,X,wall)));
});
test('germs preserve algebraic contact and arbitrarily small nonzero offsets',()=>{
 const h=AlgebraicReal.fromRational('1/2').sqrt(),p=algebraicCoordinates3(h,h,0n);
 assert.deepEqual(surfaceGermSides3(p,X,wall),{minus:-1,plus:1});
 assert.deepEqual(surfaceGermSides3(p,vector3(1n,-1n,0n),wall),{minus:1,plus:1});
 const tiny='1'+'0'.repeat(100),q=point3(`1${'0'.repeat(99)}1/${tiny}`,0n,0n);
 assert.deepEqual(surfaceGermSides3(q,neg(X),wall),{minus:1,plus:1});
});
test('rational germs match an independent three-value polynomial coefficient oracle',()=>{
 const surfaces:Surface3[]=[wall,{kind:'cylinder',cylinder:cylinder3(line3(point3(2n,-1n,3n),vector3(2n,1n,-2n)),3n)},{kind:'plane',plane:plane3(1n,2n,-3n,1n)}];
 const at=(p:Point3,v:Vector3,s:bigint)=>point3(p.x.add(v.x.mul(new Rational(s))),p.y.add(v.y.mul(new Rational(s))),p.z.add(v.z.mul(new Rational(s))));
 for(const surface of surfaces)for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
  const p=point3(BigInt(i),BigInt(j),BigInt(i-j)),v=vector3(BigInt(j),BigInt(i+1),BigInt(i*j));
  const evaluate=(q:Point3)=>surface.kind==='cylinder'?evaluateCylinder3(surface.cylinder,q):surface.plane.normal.x.mul(q.x).add(surface.plane.normal.y.mul(q.y)).add(surface.plane.normal.z.mul(q.z)).add(surface.plane.offset);
  const a=evaluate(p),positive=evaluate(at(p,v,1n)),negative=evaluate(at(p,v,-1n)),b=positive.sub(negative).div(new Rational(2n)),c=positive.add(negative).sub(a.mul(new Rational(2n))).div(new Rational(2n));
  const plus=a.sign()||b.sign()||c.sign(),minus=a.sign()||b.neg().sign()||c.sign();
  const result=surfaceGermSides3(p,v,surface);assert.deepEqual(result,{minus,plus});
  assert.deepEqual(surfaceGermSides3(p,neg(v),surface),{minus:result.plus,plus:result.minus});
 }
});
test('axis rescaling and shifts preserve cylinder germ signs',()=>{
 const equivalent:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,7n),vector3(0n,0n,-3n)),1n)};
 for(const v of [X,Y,Z,vector3(2n,-3n,5n)])assert.deepEqual(surfaceGermSides3(point3(1n,0n),v,wall),surfaceGermSides3(point3(1n,0n),v,equivalent));
});
