import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,analyzeNurbsCurve3,prepareNurbsEdge3,AlgebraicReal,reverseNurbsCurve3} from '../dist/index.js';
test('a monotone fifth-degree curve certifies an irrational third-order stationary point without bivariate elimination',()=>{
  // f(t)=t^5/5-t^3/3+t/4, so f'(t)=(t²-1/2)²≥0.
  const c=nurbsCurve3(5,['0','1/20','1/10','7/60','1/15','7/60'].map(x=>point3(x,0n,0n)),[...Array(6).fill(0n),...Array(6).fill(1n)]),a=analyzeNurbsCurve3(c),root=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(a.parameterRegular,false);assert.equal(a.interiorG1,true);assert.equal(a.simple,true);assert.equal(a.injective,true);assert.equal(a.monotoneCoordinate,'x');assert.equal(a.monotoneDirection,1);assert.equal(a.repetitions.length,0);assert.equal(a.stationary.length,1);
  const s=a.stationary[0]!;assert.equal(s.kind,'points');if(s.kind==='points'){assert.equal(s.points.length,1);assert.equal(s.points[0]!.parameter.compare(root),0);assert.equal(s.points[0]!.jetOrder,3);assert.equal(s.points[0]!.interior,true);}assert.ok(prepareNurbsEdge3(c));const reverse=analyzeNurbsCurve3(reverseNurbsCurve3(c));assert.equal(reverse.monotoneDirection,-1);assert.equal(reverse.simple,true);
});

test('coordinate certificates reject sign reversals and select another strictly monotone coordinate',()=>{
  // x=(t-1/2)^2 reverses direction, y=t is strictly increasing.
  const c=nurbsCurve3(2,[point3('1/4',0n,0n),point3('-1/4','1/2',0n),point3('1/4',1n,0n)],[0n,0n,0n,1n,1n,1n]);
  const a=analyzeNurbsCurve3(c);assert.equal(a.monotoneCoordinate,'y');assert.equal(a.monotoneDirection,1);assert.equal(a.simple,true);
});
test('constant coordinate spans do not establish strict monotonicity across a knot',()=>{
  const c=nurbsCurve3(1,[point3(0n,0n,0n),point3(0n,1n,0n),point3(1n,1n,0n)],[0n,0n,1n,2n,2n]);
  const a=analyzeNurbsCurve3(c);assert.equal(a.monotoneCoordinate,null);assert.equal(a.simple,true);assert.equal(a.interiorG1,false);
});
