import test from 'node:test';
import assert from 'node:assert/strict';
import {BivariatePolynomial} from '../dist/numeric/bivariate-polynomial.js';
import {bivariateEquationBasis} from '../dist/numeric/bivariate-equation-basis.js';
import {solveBivariateEquations} from '../dist/numeric/bivariate-system.js';
const P=(c:readonly (readonly bigint[])[])=>new BivariatePolynomial(c);
test('equation basis exposes a univariate constraint hidden by coordinate mixing',()=>{
 const a=P([[1n,1n],[0n,1n],[1n,1n]]),b=P([[2n,3n],[0n,3n],[0n,3n]]),basis=bivariateEquationBasis([a,b]);assert.ok(basis.some(p=>p.degreeV===0));
 for(const u of [-1n,0n,1n])for(const v of [-1n,0n,1n])assert.equal(basis.every(p=>p.evaluate(u,v).sign()===0),[a,b].every(p=>p.evaluate(u,v).sign()===0));
});
test('canonical equation basis is invariant under invertible rational spatial mixing',()=>{
 const equations=[P([[0n],[1n]]),P([[0n,1n]]),P([[1n,0n,1n],[0n],[1n]])],matrix=[['1/9','8/9','4/9'],['8/9','1/9','-4/9'],['-4/9','4/9','-7/9']];
 const mixed=matrix.map(row=>equations.reduce((sum,p,i)=>sum.add(p.scale(row[i]!)),P([]))),a=bivariateEquationBasis(equations),b=bivariateEquationBasis(mixed);assert.equal(a.length,3);assert.equal(b.length,3);a.forEach((p,i)=>assert.ok(p.equals(b[i]!)));assert.ok(Object.isFrozen(a));
 for(const u of [-2n,-1n,0n,1n,2n])for(const v of [-2n,-1n,0n,1n,2n])assert.equal(a.every(p=>p.evaluate(u,v).sign()===0),equations.every(p=>p.evaluate(u,v).sign()===0));
});
test('zero and redundant equations preserve unconstrained systems and shared curves',()=>{
 const zero=P([]),p=P([[0n,1n],[1n]]),a=bivariateEquationBasis([zero,p,p.scale(3n),p.scale(-2n)]);assert.equal(a.length,1);assert.ok(a[0]!.equals(p));assert.equal(solveBivariateEquations(a).kind,'shared');assert.deepEqual(bivariateEquationBasis([]),[]);assert.deepEqual(bivariateEquationBasis([zero,zero]),[]);assert.equal(solveBivariateEquations(bivariateEquationBasis([zero])).kind,'all');
});
test('equation reduction preserves finite roots and exposes inconsistent constant constraints',()=>{
 const p=P([[-1n],[0n],[1n]]),q=P([[0n,1n]]),equations=[p.add(q),p.sub(q),q.scale(2n)],a=solveBivariateEquations(equations),b=solveBivariateEquations(bivariateEquationBasis(equations));assert.equal(a.kind,'finite');assert.equal(b.kind,'finite');assert.equal(a.points.length,2);assert.equal(b.points.length,2);a.points.forEach((p,i)=>{assert.equal(p.u.compare(b.points[i]!.u),0);assert.equal(p.v.compare(b.points[i]!.v),0);});
 const impossible=bivariateEquationBasis([p,p.add(P([[1n]]))]);assert.ok(impossible.some(p=>p.degreeU===0&&p.degreeV===0&&p.coefficient(0,0).sign()!==0));assert.equal(solveBivariateEquations(impossible).points.length,0);
});
