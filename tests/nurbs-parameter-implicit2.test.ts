import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,implicitizeNurbsParameterCurve2,implicitNurbsParameterSpanPoint2,AlgebraicReal} from '../dist/index.js';
import type {NurbsCurve3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],K3=[0n,0n,0n,0n,1n,1n,1n,1n];
function polynomial(c:NurbsCurve3){const r=implicitizeNurbsParameterCurve2(c),s=r.spans[0]!;assert.equal(s.kind,'curve');if(s.kind!=='curve')throw Error('Expected implicit curve');return {report:r,polynomial:s.polynomial};}
test('a rational line has its exact implicit equation over all closed span parameters',()=>{
 const {report,polynomial:f}=polynomial(nurbsCurve3(1,[point3(0n,3n,0n),point3(1n,5n,0n)],K));assert.equal(f.coefficient(1,0).toString(),'1');assert.equal(f.coefficient(0,1).toString(),'-1/2');assert.equal(f.coefficient(0,0).toString(),'3/2');for(const t of [0n,'1/3',1n]){const p=implicitNurbsParameterSpanPoint2(report,0,t);assert.equal(f.evaluateAlgebraic(p.x,p.y).sign(),0);}assert.notEqual(f.evaluate(0n,0n).sign(),0);const vertical=polynomial(nurbsCurve3(1,[point3(2n,0n,0n),point3(2n,'1/2',0n)],K,[1n,2n])).polynomial;assert.equal(vertical.coefficient(1,0).toString(),'1');assert.equal(vertical.coefficient(0,0).toString(),'-2');assert.equal(vertical.degreeV,0);
});
test('parabola implicitization remains exact at an algebraic parameter',()=>{
 const {report,polynomial:f}=polynomial(nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],K2));assert.equal(f.coefficient(1,0).toString(),'1');assert.equal(f.coefficient(0,2).toString(),'-1');const t=AlgebraicReal.fromRational('1/2').sqrt(),p=implicitNurbsParameterSpanPoint2(report,0,t);assert.equal(p.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.y.compare(t),0);assert.equal(f.evaluateAlgebraic(p.x,p.y).sign(),0);
});
test('a weighted quarter circle produces the exact circle but does not bless its other branches as span members',()=>{
 const {report,polynomial:f}=polynomial(nurbsCurve3(2,[point3(1n,0n,0n),point3(1n,1n,0n),point3(0n,1n,0n)],K2,[1n,1n,2n]));assert.equal(f.coefficient(2,0).toString(),'1');assert.equal(f.coefficient(0,2).toString(),'1');assert.equal(f.coefficient(0,0).toString(),'-1');const p=implicitNurbsParameterSpanPoint2(report,0,'1/2');assert.equal(p.x.compare(AlgebraicReal.fromRational('3/5')),0);assert.equal(p.y.compare(AlgebraicReal.fromRational('4/5')),0);assert.equal(f.evaluate('-3/5','-4/5').sign(),0);assert.throws(()=>implicitNurbsParameterSpanPoint2(report,0,-1n),/outside/);
});
test('common homogeneous base factors are removed before the resultant',()=>{
 // X=t²(1+t), Y=t(1+t), W=1+t in degree-three Bernstein form.
 const {polynomial:f}=polynomial(nurbsCurve3(3,[point3(0n,0n,0n),point3(0n,'1/4',0n),point3('1/5','3/5',0n),point3(1n,1n,0n)],K3,[1n,'4/3','5/3',2n]));assert.equal(f.coefficient(1,0).toString(),'1');assert.equal(f.coefficient(0,2).toString(),'-1');assert.equal(f.degreeU,1);assert.equal(f.degreeV,2);
});
test('nonproper parameterizations produce square-free support equations',()=>{
 const {polynomial:f}=polynomial(nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,0n,0n),point3(1n,1n,0n)],K2));assert.equal(f.degreeU,1);assert.equal(f.degreeV,1);assert.equal(f.coefficient(1,0).toString(),'1');assert.equal(f.coefficient(0,1).toString(),'-1');
});
test('discontinuous one-sided spans retain distinct support equations and global parameter ranges',()=>{
 const r=implicitizeNurbsParameterCurve2(nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n),point3(2n,1n,0n),point3(2n,2n,0n)],[0n,0n,1n,1n,2n,2n]));assert.equal(r.spans.length,2);assert.deepEqual(r.spans.map(s=>s.span.index),[1,3]);assert.equal(implicitNurbsParameterSpanPoint2(r,0,1n).x.compare(AlgebraicReal.fromRational(1n)),0);assert.equal(implicitNurbsParameterSpanPoint2(r,1,1n).x.compare(AlgebraicReal.fromRational(2n)),0);for(const s of r.spans)assert.equal(s.kind,'curve');assert.throws(()=>implicitNurbsParameterSpanPoint2(r,0,'3/2'),/outside/);
});
test('constant spans are points and factories snapshot data and enforce plane, ownership and ranges',()=>{
 const c=nurbsCurve3(1,[point3('1/3','2/5',0n),point3('1/3','2/5',0n)],K,[1n,2n]),r=implicitizeNurbsParameterCurve2({...c,startParameter:AlgebraicReal.fromRational(-99n).lower}),s=r.spans[0]!;assert.equal(s.kind,'point');if(s.kind==='point'){assert.equal(s.u.toString(),'1/3');assert.equal(s.v.toString(),'2/5');}assert.equal(r.curve.startParameter.toString(),'0');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.spans));assert.throws(()=>implicitNurbsParameterSpanPoint2({...r},0,0n),/factory/);assert.throws(()=>implicitNurbsParameterSpanPoint2(r,99,0n),/Invalid/);assert.throws(()=>implicitizeNurbsParameterCurve2(nurbsCurve3(1,[point3(0n,0n,1n),point3(1n,1n,1n)],K)),/z=0/);
});
