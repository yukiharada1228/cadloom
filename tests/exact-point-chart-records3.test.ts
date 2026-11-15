import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,point3,encodeExactPoint3,decodeExactPoint3,compareAlgebraicPoints3,classifyPointToSurface3,cylinder3,line3} from '../dist/index.js';
import {algebraicRationalPoint3,algebraicBiparametricPoint3,getRationalParameterization3,getBiparameterization3} from '../dist/geometry/algebraic-point3.js';
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
test('rational-function point charts retain a common algebraic parameter through JSON and repeated round trips',()=>{
 const t=AlgebraicReal.fromRational(2n).sqrt(),p=algebraicRationalPoint3(t,[new Polynomial([1n]),new Polynomial(),new Polynomial([0n,1n])],new Polynomial([0n,1n]));let q=p;
 for(let i=0;i<3;i++){const r=encodeExactPoint3(q);assert.equal(r.kind,'rational-map');q=decodeExactPoint3(clone(r));assert.ok(getRationalParameterization3(q));assert.equal(compareAlgebraicPoints3(p,q),0);assert.equal(classifyPointToSurface3(q,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),'1/2')}),0);}
 assert.equal(encodeExactPoint3({...p}).kind,'coordinates');
});
test('two-parameter charts restore both selected root branches and exact surface membership',()=>{
 const s=AlgebraicReal.fromRational(2n).sqrt(),t=AlgebraicReal.fromRational(3n).sqrt().neg(),p=algebraicBiparametricPoint3(point3(0n,0n,7n),point3(1n,0n),s,point3(0n,1n),t),r=encodeExactPoint3(p),q=decodeExactPoint3(clone(r));assert.equal(r.kind,'biparametric');assert.ok(getBiparameterization3(q));assert.equal(compareAlgebraicPoints3(p,q),0);assert.equal(q.y.sign(),-1);assert.equal(classifyPointToSurface3(q,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),5n)}),0);assert.ok(Object.isFrozen(r));assert.equal(encodeExactPoint3({...p}).kind,'coordinates');
});
test('chart decoding checks array dimensions, root certificates and nonzero denominators',()=>{
 const r:any={kind:'rational-map',parameter:{kind:'rational',value:'2'},numerators:[['1'],['0'],['0']],denominator:['-2','1']};assert.throws(()=>decodeExactPoint3(r),/denominator/);r.denominator=['1'];r.numerators.pop();assert.throws(()=>decodeExactPoint3(r));r.numerators.push([42]);assert.throws(()=>decodeExactPoint3(r));r.numerators[2]=['0'];r.parameter={kind:'root',polynomial:['-2','0','1'],lower:'-2',upper:'2'};assert.throws(()=>decodeExactPoint3(r),/certificate/);
});
