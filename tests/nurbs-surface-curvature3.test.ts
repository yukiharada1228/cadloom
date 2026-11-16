import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,nurbsSurface3,secondDifferentialNurbsSurface3,curvatureNurbsSurface3,insertNurbsSurfaceKnot3,reverseNurbsSurface3} from '../dist/index.js';
import type {NurbsSurface3,NurbsSurfaceCurvature3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],q=(n:bigint,d=1n)=>new Rational(n,d),one=q(1n),two=q(2n),zero=q(0n),real=(x:bigint|string|Rational)=>AlgebraicReal.fromRational(x);
function regular(c:NurbsSurfaceCurvature3){assert.equal(c.regular,true);if(!c.regular)throw new Error('Expected regular surface');assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.principal));assert.equal(c.principal[0].mul(c.principal[1]).compare(c.gaussian),0);assert.equal(c.principal[0].add(c.principal[1]).compare(c.mean.mul(real(2n))),0);return c;}
const cylinder=()=>nurbsSurface3(2,1,[[point3(1n,0n,-2n),point3(1n,0n,3n)],[point3(1n,1n,-2n),point3(1n,1n,3n)],[point3(0n,1n,-2n),point3(0n,1n,3n)]],K2,K,[[1n,1n],[1n,1n],[2n,2n]]);
test('bilinear saddle second derivatives and curvature match independent graph formulas',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
 for(const u of [zero,q(1n,2n),one])for(const v of [zero,q(1n,3n),one]){const c=regular(curvatureNurbsSurface3(s,u,v)),d=c.differential,D=one.add(u.mul(u)).add(v.mul(v));for(const a of [d.duu,d.dvv])for(const key of ['x','y','z'] as const)assert.equal(a[key].sign(),0);assert.equal(d.duv.x.sign(),0);assert.equal(d.duv.y.sign(),0);assert.equal(d.duv.z.compare(real(1n)),0);assert.equal(c.gaussian.compare(real(one.neg().div(D.mul(D)))),0);assert.equal(c.mean.mul(c.mean).compare(real(u.mul(u).mul(v).mul(v).div(D.mul(D).mul(D)))),0);assert.equal(c.mean.sign(),u.sign()===0||v.sign()===0?0:-1);}
 const origin=regular(curvatureNurbsSurface3(s,0n,0n));assert.equal(origin.principal[0].compare(real(-1n)),0);assert.equal(origin.principal[1].compare(real(1n)),0);
});
test('paraboloid has exact positive umbilic curvatures and nonrational curvature away from its vertex',()=>{
 const xy=[zero,q(1n,2n),one],s=nurbsSurface3(2,2,xy.map((x,i)=>xy.map((y,j)=>point3(x,y,BigInt((i===2?1:0)+(j===2?1:0))))),K2,K2),origin=regular(curvatureNurbsSurface3(s,0n,0n));assert.equal(origin.gaussian.compare(real(4n)),0);assert.equal(origin.mean.compare(real(2n)),0);origin.principal.forEach(k=>assert.equal(k.compare(real(2n)),0));
 const c=regular(curvatureNurbsSurface3(s,'1/2','1/2'));assert.equal(c.gaussian.compare(real('4/9')),0);assert.equal(c.mean.mul(c.mean).compare(real('16/27')),0);assert.equal(c.mean.sign(),1);assert.equal(c.differential.duu.z.compare(real(2n)),0);assert.equal(c.differential.dvv.z.compare(real(2n)),0);
});
test('weighted rational cylinder has exact quotient second derivatives and constant principal curvatures',()=>{
 const s=cylinder();for(const u of [zero,q(1n,2n),one]){const d=secondDifferentialNurbsSurface3(s,u,'1/3'),D=one.add(u.mul(u)),D3=D.mul(D).mul(D),x=q(-4n).add(u.mul(u).mul(q(12n))).div(D3),y=u.mul(q(4n)).mul(u.mul(u).sub(q(3n))).div(D3);assert.equal(d.duu.x.compare(real(x)),0);assert.equal(d.duu.y.compare(real(y)),0);assert.equal(d.duu.z.sign(),0);for(const a of [d.duv,d.dvv])for(const key of ['x','y','z'] as const)assert.equal(a[key].sign(),0);const c=regular(curvatureNurbsSurface3(s,u,'1/3'));assert.equal(c.gaussian.sign(),0);assert.equal(c.mean.compare(real('-1/2')),0);assert.equal(c.principal[0].compare(real(-1n)),0);assert.equal(c.principal[1].sign(),0);}
 const algebraic=regular(curvatureNurbsSurface3(s,real('1/2').sqrt(),'1/3'));assert.equal(algebraic.mean.compare(real('-1/2')),0);assert.equal(algebraic.gaussian.sign(),0);
});
test('second derivatives use explicit knot sides and singular points have no invented curvature',()=>{
 const xs=[0n,1n,2n,3n,4n],s=nurbsSurface3(2,1,xs.map((x,i)=>[point3(q(x,4n),0n,i===4?1n:0n),point3(q(x,4n),1n,i===4?1n:0n)]),[0n,0n,0n,'1/2','1/2',1n,1n,1n],K),left=regular(curvatureNurbsSurface3(s,'1/2','1/2',{uSide:'left'})),right=regular(curvatureNurbsSurface3(s,'1/2','1/2',{uSide:'right'}));assert.equal(left.differential.duu.z.sign(),0);assert.equal(right.differential.duu.z.compare(real(8n)),0);assert.equal(left.mean.sign(),0);assert.equal(right.mean.compare(real(4n)),0);assert.equal(right.gaussian.sign(),0);
 const collapsed=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,0n,0n)],[point3(1n,0n,0n),point3(1n,0n,0n)]],K,K),singular=curvatureNurbsSurface3(collapsed,'1/2','1/2');assert.equal(singular.regular,false);assert.equal('gaussian' in singular,false);assert.equal('principal' in singular,false);assert.throws(()=>curvatureNurbsSurface3(s,2n,0n),/parameter|domain|outside/i);
});
test('refinement, orientation reversal and tiny parameter domains preserve the expected curvature laws',()=>{
 const s=cylinder(),c=regular(curvatureNurbsSurface3(s,'1/2','1/3')),refined=insertNurbsSurfaceKnot3(s,'u','1/2'),reversed=reverseNurbsSurface3(s,'u');for(const side of ['left','right'] as const){const r=regular(curvatureNurbsSurface3(refined,'1/2','1/3',{uSide:side}));assert.equal(r.mean.compare(c.mean),0);for(const key of ['x','y','z'] as const)assert.equal(r.differential.duu[key].compare(c.differential.duu[key]),0);}
 const r=regular(curvatureNurbsSurface3(reversed,'1/2','1/3'));assert.equal(r.mean.compare(c.mean.neg()),0);assert.equal(r.gaussian.compare(c.gaussian),0);assert.equal(r.principal[0].compare(c.principal[1].neg()),0);assert.equal(r.principal[1].compare(c.principal[0].neg()),0);
 const h=q(1n,10n**40n),tiny=nurbsSurface3(s.degreeU,s.degreeV,s.controlPoints,[0n,0n,0n,h,h,h],s.knotsV,s.weights),t=regular(curvatureNurbsSurface3(tiny,h.div(two),'1/3'));assert.equal(t.mean.compare(c.mean),0);assert.equal(t.gaussian.compare(c.gaussian),0);assert.ok(t.differential.du.x.mul(t.differential.du.x).add(t.differential.du.y.mul(t.differential.du.y)).compare(real(10n**70n))>0);
});
test('nonseparable weights satisfy independent quadratic Taylor coefficient equations',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K,[[1n,2n],[3n,5n]]);
 for(const u of [zero,q(1n,3n),one])for(const v of [q(1n,4n),one]){const d=secondDifferentialNurbsSurface3(s,u,v),W=one.add(u.mul(two)).add(v).add(u.mul(v)),Wu=two.add(v),Wv=one.add(u);
  // Solve W*S=N by increasing Taylor degree, independently of the explicit
  // quotient second-derivative formula used by the implementation.
  for(const [key,a,b,c] of [['x',3n,0n,2n],['y',0n,2n,3n],['z',0n,0n,5n]] as const){const A=q(a),B=q(b),C=q(c),s00=A.mul(u).add(B.mul(v)).add(C.mul(u).mul(v)).div(W),s10=A.add(C.mul(v)).sub(Wu.mul(s00)).div(W),s01=B.add(C.mul(u)).sub(Wv.mul(s00)).div(W),s20=Wu.mul(s10).neg().div(W),s02=Wv.mul(s01).neg().div(W),s11=C.sub(Wu.mul(s01)).sub(Wv.mul(s10)).sub(s00).div(W);assert.equal(d.du[key].compare(real(s10)),0);assert.equal(d.dv[key].compare(real(s01)),0);assert.equal(d.duu[key].compare(real(s20.mul(two))),0);assert.equal(d.duv[key].compare(real(s11)),0);assert.equal(d.dvv[key].compare(real(s02.mul(two))),0);}
 }
});
