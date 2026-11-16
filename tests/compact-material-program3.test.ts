import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,prepareFiniteCylinder3,prepareCylinderMaterialProgram3,compactCylinderMaterialProgram3,clipCylinderMaterialProgram3} from '../dist/index.js';
import type {CylinderMaterialExpression3} from '../dist/index.js';
const axis=line3(point3(0n,0n,0n),point3(0n,0n,1n)),a=prepareFiniteCylinder3(cylinder3(axis,1n),-1n,1n),copy=prepareFiniteCylinder3(cylinder3(axis,1n),-1n,1n),b=prepareFiniteCylinder3(cylinder3(axis,4n),-1n,1n),planes=[plane3(1n,0n,0n),plane3(3n,0n,0n),plane3(-2n,0n,0n)];
const c=(cylinder:number):CylinderMaterialExpression3=>({kind:'cylinder',cylinder}),p=(halfspace:number):CylinderMaterialExpression3=>({kind:'halfspace',halfspace});
function evaluate(t:CylinderMaterialExpression3,cs:readonly boolean[],ps:readonly boolean[]):boolean {
 if(t.kind==='cylinder')return cs[t.cylinder]!;if(t.kind==='halfspace')return ps[t.halfspace]!;
 const x=evaluate(t.first,cs,ps),y=evaluate(t.second,cs,ps);switch(t.kind){case 'union':return x||y;case 'intersection':return x&&y;case 'difference':return x&&!y;case 'xor':return x!==y;}
}
test('compaction interns only identical finite specifications and positively proportional halfspaces',()=>{
 const source=prepareCylinderMaterialProgram3([a,copy,b],planes,{kind:'intersection',first:{kind:'union',first:c(0),second:c(1)},second:{kind:'union',first:p(0),second:{kind:'union',first:p(1),second:p(2)}}}),out=compactCylinderMaterialProgram3(source);
 assert.equal(out.cylinders.length,1);assert.equal(out.planes.length,2);assert.ok(out.planes.some(q=>q.normal.x.sign()===-1));
 assert.equal(compactCylinderMaterialProgram3(source),out);assert.equal(compactCylinderMaterialProgram3(out),out);assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.expression));assert.throws(()=>compactCylinderMaterialProgram3({...source}),/factory/);
 const longer=prepareFiniteCylinder3(cylinder3(axis,1n),-2n,1n);assert.equal(compactCylinderMaterialProgram3(prepareCylinderMaterialProgram3([a,longer],[],{kind:'union',first:c(0),second:c(1)})).cylinders.length,2);
 const again=compactCylinderMaterialProgram3(clipCylinderMaterialProgram3(out,[{plane:planes[1]!,side:-1}]));assert.equal(again.planes.length,2);
 const empty=compactCylinderMaterialProgram3(prepareCylinderMaterialProgram3([a,copy,b],planes,{kind:'xor',first:c(0),second:c(1)}));assert.equal(empty.cylinders.length,1);assert.equal(empty.planes.length,0);for(const bit of [false,true])assert.equal(evaluate(empty.expression,[bit],[]),false);
});
test('seeded Boolean trees preserve all truth assignments after primitive remapping and simplification',()=>{
 let seed=173;const random=(n:number)=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;},ops=['union','intersection','difference','xor'] as const;
 const tree=(depth:number):CylinderMaterialExpression3=>depth===0||random(4)===0?(random(2)?c(random(3)):p(random(3))):{kind:ops[random(4)]!,first:tree(depth-1),second:tree(depth-1)};
 for(let i=0;i<512;i++){
  // The outer cylinder makes every independently generated formula bounded.
  const expression:CylinderMaterialExpression3={kind:'intersection',first:{kind:'union',first:c(0),second:c(2)},second:tree(5)},source=prepareCylinderMaterialProgram3([a,copy,b],planes,expression),out=compactCylinderMaterialProgram3(source);
  for(let mask=0;mask<16;mask++){
   const values=[0,1,2,3].map(k=>Boolean(mask&(1<<k))),before=evaluate(expression,[values[0]!,values[0]!,values[1]!],[values[2]!,values[2]!,values[3]!]),after=evaluate(out.expression,out.cylinders.map(q=>q.cylinder.radiusSquared.toString()==='1'?values[0]!:values[1]!),out.planes.map(q=>q.normal.x.sign()>0?values[2]!:values[3]!));
   assert.equal(after,before,`case ${i}, assignment ${mask}`);
  }
 }
});
