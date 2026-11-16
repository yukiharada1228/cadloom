import {traceAlgebraicCurveProduct2} from '../dist/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,Polynomial,AlgebraicReal,isolateRealRoots,BivariatePolynomial,traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2,bivariateFiberRoots} from '../dist/index.js';
import type {AlgebraicCurveTopology2} from '../dist/index.js';
const q=(n:bigint,d=1n)=>new Rational(n,d),real=(n:bigint|string|Rational)=>AlgebraicReal.fromRational(n),U=new BivariatePolynomial([[],[1n]]),V=new BivariatePolynomial([[0n,1n]]),one=new BivariatePolynomial([[1n]]),box={uMin:-2n,uMax:2n,vMin:-2n,vMax:2n};
function degree(t:AlgebraicCurveTopology2,id:number){return t.edges.filter(e=>e.from===id||e.to===id).length;}
function audit(t:AlgebraicCurveTopology2){
  assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.vertices)&&Object.isFrozen(t.edges));
  for(const p of t.vertices){assert.equal(t.polynomial.evaluateAlgebraic(p.u,p.v).sign(),0);assert.ok(p.u.compare(real(t.bounds.uMin))>=0&&p.u.compare(real(t.bounds.uMax))<=0&&p.v.compare(real(t.bounds.vMin))>=0&&p.v.compare(real(t.bounds.vMax))<=0);}
  t.edges.forEach((e,i)=>{const a=t.vertices[e.from]!,b=t.vertices[e.to]!;assert.equal(t.polynomial.evaluateAlgebraic(e.sample.u,e.sample.v).sign(),0);for(const p of [a,b]){const r=evaluateAlgebraicCurveEdge2(t,i,e.kind==='branch'?p.u:p.v);assert.equal(r.u.compare(p.u),0);assert.equal(r.v.compare(p.v),0);}const p=evaluateAlgebraicCurveEdge2(t,i,e.kind==='branch'?e.sample.u:e.sample.v);assert.equal(p.u.compare(e.sample.u),0);assert.equal(p.v.compare(e.sample.v),0);});
  assert.equal(t.components.reduce((n,c)=>n+c.vertices.length,0),t.vertices.length);assert.equal(t.components.reduce((n,c)=>n+c.edges.length,0),t.edges.length);
}
function contains(t:AlgebraicCurveTopology2,u:Rational,v:Rational):boolean {
  const x=real(u),y=real(v);if(t.kind==='area')return true;if(t.vertices.some(p=>p.u.compare(x)===0&&p.v.compare(y)===0))return true;
  return t.edges.some((e,i)=>{const a=t.vertices[e.from]!,b=t.vertices[e.to]!;if(e.kind==='vertical')return a.u.compare(x)===0&&y.compare(a.v)>=0&&y.compare(b.v)<=0;if(x.compare(a.u)<=0||x.compare(b.u)>=0)return false;return evaluateAlgebraicCurveEdge2(t,i,x).v.compare(y)===0;});
}

test('factored projection and fibers preserve expanded-product topology across crossings and algebraic events',()=>{
 const circle=U.mul(U).add(V.mul(V)).sub(one),line=U.sub(V),cases=[[U,V,line],[V.mul(V).sub(U),V.sub(one.scale('1/2'))],[circle,line],[circle,U.sub(one)],[line.mul(line),line.mul(V.add(one.scale('1/4')))],[U.mul(U).add(V.mul(V)),V]];
 for(const factors of cases){const expanded=factors.reduce((a,b)=>a.mul(b),one),a=traceAlgebraicCurve2(expanded,box),b=traceAlgebraicCurveProduct2(factors,box);audit(a);audit(b);assert.equal(a.vertices.length,b.vertices.length);assert.equal(a.edges.length,b.edges.length);assert.equal(a.components.length,b.components.length);
 const same=(x:typeof a.vertices[number],y:typeof a.vertices[number])=>x.u.compare(y.u)===0&&x.v.compare(y.v)===0;for(const e of a.edges){const t=e.kind==='branch'?e.sample.u:e.sample.v,j=b.edges.findIndex((f,i)=>{if(f.kind!==e.kind||!same(a.vertices[e.from]!,b.vertices[f.from]!)||!same(a.vertices[e.to]!,b.vertices[f.to]!))return false;const q=evaluateAlgebraicCurveEdge2(b,i,t);return q.u.compare(e.sample.u)===0&&q.v.compare(e.sample.v)===0;});assert.ok(j>=0);const p=evaluateAlgebraicCurveEdge2(b,j,t);assert.equal(p.u.compare(e.sample.u),0);assert.equal(p.v.compare(e.sample.v),0);}
 }
});
test('factored graphs retain zero loci for duplicates, vertical factors, empty products and zero factors',()=>{
 const a=traceAlgebraicCurveProduct2([U,U.scale(-2n),one.scale(3n)],box);audit(a);assert.equal(a.edges.length,1);assert.equal(a.edges[0]!.kind,'vertical');assert.equal(traceAlgebraicCurveProduct2([],box).edges.length,0);assert.equal(traceAlgebraicCurveProduct2([U,new BivariatePolynomial()],box).kind,'area');assert.throws(()=>traceAlgebraicCurveProduct2([U],{...box,uMax:-2n}),/rectangle/);
});
test('equal event fibers retain the lower-degree certificate from a crossing factor',()=>{
 const circle=U.mul(U).add(V.mul(V)).sub(one),line=U.add(V).sub(one.scale('1/2')),g=traceAlgebraicCurveProduct2([circle,line],{uMin:-1n,uMax:1n,vMin:-1n,vMax:1n}),crossings=g.vertices.filter(p=>circle.evaluateAlgebraic(p.u,p.v).sign()===0&&line.evaluateAlgebraic(p.u,p.v).sign()===0);
 assert.equal(crossings.length,2);for(const p of crossings){assert.equal(p.u.polynomial.degree,2);assert.equal(p.v.polynomial.degree,2);assert.equal(AlgebraicReal.linearCombination([{value:p.u,coefficient:1n},{value:p.v,coefficient:1n}]).rational?.toString(),'1/2');}
});
