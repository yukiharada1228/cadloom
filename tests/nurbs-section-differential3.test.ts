import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,plane3,nurbsSurface3,intersectNurbsSurfacePlane3,nurbsPlaneSectionEdgeDifferential3} from '../dist/index.js';
import type {NurbsSectionEdgeDifferential3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],q=(a:bigint,b=1n)=>new Rational(a,b),r=(x:bigint|string|Rational)=>AlgebraicReal.fromRational(x);
function regular(d:NurbsSectionEdgeDifferential3){assert.equal(d.kind,'regular');if(d.kind!=='regular')throw new Error('regular');assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.parameterPoint));return d;}
function vector(p:{x:AlgebraicReal;y:AlgebraicReal;z:AlgebraicReal},x:bigint|string,y:bigint|string,z:bigint|string){assert.equal(p.x.compare(r(x)),0);assert.equal(p.y.compare(r(y)),0);assert.equal(p.z.compare(r(z)),0);}
const choose=(n:number,k:number)=>{let result=1n;for(let i=1;i<=k;i++)result=result*BigInt(n-i+1)/BigInt(i);return result;};
// Independent power-to-Bernstein conversion for the polynomial graph (u,v,F).
function graph(a:readonly (readonly bigint[])[],n:number,m:number){const poles=Array.from({length:n+1},(_,i)=>Array.from({length:m+1},(_,j)=>{let z=q(0n);for(let x=0;x<=i;x++)for(let y=0;y<=j;y++)z=z.add(q(a[x]?.[y]??0n).mul(q(choose(i,x),choose(n,x))).mul(q(choose(j,y),choose(m,y))));return point3(q(BigInt(i),BigInt(n)),q(BigInt(j),BigInt(m)),z);}));return nurbsSurface3(n,m,poles,[...Array(n+1).fill(0n),...Array(n+1).fill(1n)],[...Array(m+1).fill(0n),...Array(m+1).fill(1n)]);}
test('hyperbolic sections have exact implicit derivatives and spatial curvature',()=>{
 const s=graph([[0n],[0n,1n]],1,1),section=intersectNurbsSurfacePlane3(s,plane3(0n,0n,1n,'-1/4')),d=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,'1/2'));assert.equal(d.coordinate,'u');vector(d.point,'1/2','1/2','1/4');vector(d.derivative,1n,-1n,0n);vector(d.secondDerivative,0n,4n,0n);assert.equal(d.curvatureSquared.compare(r(2n)),0);const algebraic=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,r('1/2').sqrt()));vector(algebraic.derivative,1n,'-1/2',0n);assert.equal(algebraic.secondDerivative.y.compare(r(2n).sqrt()),0);assert.equal(algebraic.curvatureSquared.compare(r('128/125')),0);assert.throws(()=>nurbsPlaneSectionEdgeDifferential3({...section},0,0,'1/2'),/factory/);assert.throws(()=>nurbsPlaneSectionEdgeDifferential3(section,-1,0,'1/2'),RangeError);assert.throws(()=>nurbsPlaneSectionEdgeDifferential3(section,0,-1,'1/2'),RangeError);assert.throws(()=>nurbsPlaneSectionEdgeDifferential3(section,0,0,2n),RangeError);
});
test('projection-critical endpoints switch to a valid local coordinate rather than divide by zero',()=>{
 const section=intersectNurbsSurfacePlane3(graph([[0n,0n,1n],[-1n]],1,2),plane3(0n,0n,1n)),at=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,0n));assert.equal(at.coordinate,'v');vector(at.derivative,0n,1n,0n);vector(at.secondDerivative,2n,0n,0n);assert.equal(at.curvatureSquared.compare(r(4n)),0);
 const interior=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,'1/4'));assert.equal(interior.coordinate,'u');vector(interior.derivative,1n,1n,0n);vector(interior.secondDerivative,0n,-2n,0n);assert.equal(interior.curvatureSquared.compare(r('1/2')),0);
});
test('weighted cylinder sections retain circular curvature and tangent-plane vertical branches',()=>{
 const s=nurbsSurface3(2,1,[[point3(1n,0n,-2n),point3(1n,0n,3n)],[point3(1n,1n,-2n),point3(1n,1n,3n)],[point3(0n,1n,-2n),point3(0n,1n,3n)]],K2,K,[[1n,1n],[1n,1n],[2n,2n]]),horizontal=intersectNurbsSurfacePlane3(s,plane3(0n,0n,1n)),d=regular(nurbsPlaneSectionEdgeDifferential3(horizontal,0,0,'1/2'));vector(d.derivative,'-32/25','24/25',0n);vector(d.secondDerivative,'-64/125','-352/125',0n);assert.equal(d.curvatureSquared.compare(r(1n)),0);
 const tangent=intersectNurbsSurfacePlane3(s,plane3(3n,4n,0n,-5n)),vertical=regular(nurbsPlaneSectionEdgeDifferential3(tangent,0,0,'1/2'));assert.equal(vertical.coordinate,'v');vector(vertical.derivative,0n,0n,5n);vector(vertical.secondDerivative,0n,0n,0n);assert.equal(vertical.curvatureSquared.sign(),0);
});
test('repeated nonvertical contact factors preserve a regular geometric branch',()=>{
 const section=intersectNurbsSurfacePlane3(graph([[0n,0n,1n],[],[0n,-2n],[],[1n]],4,2),plane3(0n,0n,1n)),d=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,'1/2'));vector(d.point,'1/2','1/4',0n);vector(d.derivative,1n,1n,0n);vector(d.secondDerivative,0n,2n,0n);assert.equal(d.curvatureSquared.compare(r('1/2')),0);
});
test('singular implicit events and stationary spatial images are explicit nonregular results',()=>{
 const section=intersectNurbsSurfacePlane3(graph([[0n,0n,1n],[],[-1n]],2,2),plane3(0n,0n,1n)),d=nurbsPlaneSectionEdgeDifferential3(section,0,0,0n);assert.equal(d.kind,'singular-parameter');assert.equal('derivative' in d,false);assert.equal('curvatureSquared' in d,false);
 const s=nurbsSurface3(2,1,[0n,0n,1n].map(x=>[point3(x,0n,0n),point3(x,0n,1n)]),K2,K),collapsed=intersectNurbsSurfacePlane3(s,plane3(0n,0n,1n)),stationary=nurbsPlaneSectionEdgeDifferential3(collapsed,0,0,0n);assert.equal(stationary.kind,'stationary-image');assert.equal('curvatureSquared' in stationary,false);if(stationary.kind==='stationary-image'){vector(stationary.derivative,0n,0n,0n);vector(stationary.secondDerivative,2n,0n,0n);}
});
test('edge derivatives keep actual one-sided patch provenance across discontinuous knots',()=>{
 const s=nurbsSurface3(1,1,[0n,1n,10n,12n].map(x=>[point3(x,0n,-1n),point3(x,1n,1n)]),[0n,0n,1n,1n,2n,2n],K),section=intersectNurbsSurfacePlane3(s,plane3(0n,0n,1n)),left=regular(nurbsPlaneSectionEdgeDifferential3(section,0,0,1n)),right=regular(nurbsPlaneSectionEdgeDifferential3(section,1,0,1n));vector(left.point,1n,'1/2',0n);vector(right.point,10n,'1/2',0n);vector(left.derivative,1n,0n,0n);vector(right.derivative,2n,0n,0n);assert.equal(left.curvatureSquared.sign(),0);assert.equal(right.curvatureSquared.sign(),0);
});
