import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,BivariatePolynomial,traceAlgebraicCurve2} from '../dist/index.js';
import {restrictAlgebraicCurveRectangle2} from '../dist/geometry/algebraic-curve-rectangle2.js';
const r=(q:string)=>AlgebraicReal.fromRational(q);
test('closed algebraic rectangle restriction finds both parabola branches at irrational side cuts',()=>{
 const graph=traceAlgebraicCurve2(new BivariatePolynomial([[0n,-1n],[0n],[1n]]),{uMin:-1n,uMax:1n,vMin:0n,vMax:2n}),bounds={uMin:r('-1'),uMax:r('1'),vMin:r('1/2'),vMax:r('1')},restricted=restrictAlgebraicCurveRectangle2(graph,bounds),root=r('1/2').sqrt();assert.equal(restricted.edges.length,2);assert.equal(restricted.vertices.length,4);assert.ok(restricted.vertices.some(p=>p.u.compare(root)===0));assert.ok(restricted.vertices.some(p=>p.u.compare(root.neg())===0));assert.ok(Object.isFrozen(restricted)&&Object.isFrozen(restricted.bounds));assert.throws(()=>restrictAlgebraicCurveRectangle2(graph,{...bounds,uMin:r('2')}),/Invalid/);
});
test('whole horizontal fibers, vertical edges and isolated corner contacts survive closed clipping',()=>{
 const graph=traceAlgebraicCurve2(new BivariatePolynomial([[0n],[0n,1n]]),{uMin:-2n,uMax:2n,vMin:-2n,vMax:2n}),bounds={uMin:r('-1/2'),uMax:r('1/2'),vMin:r('0'),vMax:r('1')},restricted=restrictAlgebraicCurveRectangle2(graph,bounds);assert.equal(restricted.edges.length,3);assert.equal(restricted.vertices.length,4);assert.ok(restricted.edges.some(e=>graph.edges[e.sourceEdge]!.kind==='vertical'));
 const point=traceAlgebraicCurve2(new BivariatePolynomial([[0n,0n,1n],[0n],[1n]]),{uMin:-1n,uMax:1n,vMin:-1n,vMax:1n}),touch=restrictAlgebraicCurveRectangle2(point,{uMin:r('0'),uMax:r('1'),vMin:r('0'),vMax:r('1')});assert.equal(touch.edges.length,0);assert.equal(touch.vertices.length,1);assert.equal(touch.vertices[0]!.u.sign(),0);assert.equal(touch.vertices[0]!.v.sign(),0);
});
