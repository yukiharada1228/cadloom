import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,BivariatePolynomial,traceAlgebraicCurve2,Rational} from '../dist/index.js';
import {restrictAlgebraicCurveInequalities2,witnessBivariateInequalities2} from '../dist/geometry/algebraic-curve-inequalities2.js';
const q=(n:bigint)=>new Rational(n),bounds={uMin:q(-1n),uMax:q(1n),vMin:q(-1n),vMax:q(2n)};
test('inequality restriction retains an isolated tangency and whole shared-factor branches',()=>{
 const f=new BivariatePolynomial([[0n,1n],[0n],[-1n]]),g=traceAlgebraicCurve2(f,bounds),touch=restrictAlgebraicCurveInequalities2(g,[new BivariatePolynomial([[0n,-1n]])]);assert.equal(touch.edges.length,0);assert.equal(touch.vertices.length,1);assert.equal(touch.vertices[0]!.u.sign(),0);assert.equal(touch.vertices[0]!.v.sign(),0);const whole=restrictAlgebraicCurveInequalities2(g,[f,f.scale(-1n)]);assert.equal(whole.edges.length,g.edges.length);assert.equal(whole.vertices.length,g.vertices.length);assert.throws(()=>restrictAlgebraicCurveInequalities2({...g},[f]),/factory/);
});
test('closed witness enumeration includes isolated points and vertical cells, and rejects empty real sets',()=>{
 const f=new BivariatePolynomial([[0n,0n,1n],[0n],[1n]]),box={uMin:q(-1n),uMax:q(1n),vMin:q(-1n),vMax:q(1n)},point=witnessBivariateInequalities2([f,f.scale(-1n)],box);assert.ok(point);assert.equal(point.u.sign(),0);assert.equal(point.v.sign(),0);const u=new BivariatePolynomial([[0n],[1n]]),line=witnessBivariateInequalities2([u,u.scale(-1n)],box);assert.ok(line);assert.equal(line.u.sign(),0);const positive=f.add(new BivariatePolynomial([[1n]]));assert.equal(witnessBivariateInequalities2([positive,positive.scale(-1n)],box),null);assert.throws(()=>witnessBivariateInequalities2([],{...box,uMin:q(1n)}),/positive/);
});
test('a rational strip of width 10^-40 has an exact interior witness without accepted box corners',()=>{
 const a=new Rational(1n,3n),b=a.add(new Rational(1n,10n**40n)),c=new Rational(2n,5n),d=c.add(new Rational(1n,10n**40n)),fs=[new BivariatePolynomial([[a.neg()],[1n]]),new BivariatePolynomial([[b],[-1n]]),new BivariatePolynomial([[c.neg(),1n]]),new BivariatePolynomial([[d,-1n]])],p=witnessBivariateInequalities2(fs,{uMin:q(0n),uMax:q(1n),vMin:q(0n),vMax:q(1n)});assert.ok(p);assert.ok(p.u.compare(AlgebraicReal.fromRational(a))>=0&&p.u.compare(AlgebraicReal.fromRational(b))<=0);assert.ok(p.v.compare(AlgebraicReal.fromRational(c))>=0&&p.v.compare(AlgebraicReal.fromRational(d))<=0);for(const f of fs)assert.ok(f.evaluateAlgebraic(p.u,p.v).sign()>=0);
});
