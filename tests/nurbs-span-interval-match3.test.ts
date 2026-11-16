import test from 'node:test';
import assert from 'node:assert/strict';
import {Polynomial,Rational,AlgebraicReal,matchNurbsSpanIntervals3,nurbsSpanIntervalMatchPoint3} from '../dist/index.js';
import type {NurbsSpan3} from '../dist/index.js';
const span=(x:readonly bigint[],y:readonly bigint[]=[],z:readonly bigint[]=[],w:readonly bigint[]=[1n]):NurbsSpan3=>({index:0,startParameter:new Rational(0n),endParameter:new Rational(1n),x:new Polynomial(x),y:new Polynomial(y),z:new Polynomial(z),weight:new Polynomial(w)});
function matched(r:ReturnType<typeof matchNurbsSpanIntervals3>){assert.equal(r.kind,'matched');if(r.kind!=='matched')throw Error('Expected whole interval match');return r.certificate;}
test('nonlinear parameter correspondence covers both intervals including algebraic endpoints',()=>{
 const a=span([0n,1n],[0n,0n,1n]),b=span([0n,0n,1n],[0n,0n,0n,0n,1n]),alpha=AlgebraicReal.isolate(new Polynomial([-1n,0n,2n]))[1]!,c=matched(matchNurbsSpanIntervals3({span:a,lower:'1/2',upper:1n},{span:b,lower:alpha,upper:1n}));assert.equal(c.direction,1);assert.ok(c.relation.edges.length);
 for(const [i,e] of c.relation.edges.entries())for(const t of [e.lower,e.upper]){const q=nurbsSpanIntervalMatchPoint3(c,i,t);assert.equal(q.firstParameter.compare(q.secondParameter.mul(q.secondParameter)),0);assert.equal(q.point.x.compare(q.firstParameter),0);}
 assert.throws(()=>nurbsSpanIntervalMatchPoint3({...c},0,c.relation.edges[0]!.lower),/factory/);assert.throws(()=>nurbsSpanIntervalMatchPoint3(c,0,-1n),/outside/);
});
test('reversed traversal and homogeneous common factors preserve exact whole interval matches',()=>{
 const a=span([0n,1n],[0n,0n,1n]),reverse=span([1n,-1n],[1n,-2n,1n]),c=matched(matchNurbsSpanIntervals3({span:a,lower:0n,upper:1n},{span:reverse,lower:0n,upper:1n}));assert.equal(c.direction,-1);
 const scaled=span([0n,0n,1n],[0n,0n,0n,1n],[],[0n,1n]),d=matched(matchNurbsSpanIntervals3({span:a,lower:'1/2',upper:1n},{span:scaled,lower:'1/2',upper:1n}));assert.equal(d.direction,1);assert.ok(Object.isFrozen(d.first.span));
});
test('same endpoints, partial coverage and retraced images cannot masquerade as an oriented match',()=>{
 const line=span([0n,1n]),bow=span([0n,1n],[],[0n,1n,-1n]);assert.equal(matchNurbsSpanIntervals3({span:line,lower:0n,upper:1n},{span:bow,lower:0n,upper:1n}).kind,'not-certified');assert.deepEqual(matchNurbsSpanIntervals3({span:line,lower:0n,upper:1n},{span:line,lower:'1/2',upper:1n}),{kind:'not-certified',reason:'coverage-gap'});
 assert.deepEqual(matchNurbsSpanIntervals3({span:line,lower:0n,upper:1n},{span:span([1n,-4n,4n]),lower:0n,upper:1n}),{kind:'not-certified',reason:'orientation-conflict'});
 assert.throws(()=>matchNurbsSpanIntervals3({span:line,lower:0n,upper:0n},{span:line,lower:0n,upper:1n}),/interval/);assert.throws(()=>matchNurbsSpanIntervals3({span:span([1n],[],[],[-1n,2n]),lower:0n,upper:1n},{span:line,lower:0n,upper:1n}),/weight/);assert.throws(()=>matchNurbsSpanIntervals3({span:span([1n]),lower:0n,upper:1n},{span:line,lower:0n,upper:1n}),/nonconstant/);
});
