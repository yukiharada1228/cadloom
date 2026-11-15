import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,plane3,prepareFiniteCylinder3,boundaryFiniteCylinderExpression3,sectionFiniteCylinderExpression3,assertOwnedCylinderExpressionPlaneSection3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),leaf=(operand:number)=>({kind:'operand' as const,operand}),make=(x:bigint,r:bigint,h:bigint)=>prepareFiniteCylinder3(cylinder3(line3(point3(x,0n),Z),r),-h,h),outer=make(0n,4n,2n),inner=make(0n,1n,1n),cavity=boundaryFiniteCylinderExpression3([outer,inner],{kind:'difference',first:leaf(0),second:leaf(1)});
const patches=(s:ReturnType<typeof sectionFiniteCylinderExpression3>,p:ReturnType<typeof point3>)=>s.patches.filter(c=>c.domain.locate(p)!=='outside');
test('a cavity section has exact annular cut patches and independent rational material coverage',()=>{
 const s=sectionFiniteCylinderExpression3(cavity,plane3(0n,0n,1n));assertOwnedCylinderExpressionPlaneSection3(s);assert.ok(s.patches.length);assert.ok(s.patches.every(p=>p.kind==='interior'&&p.negative&&p.positive));let checked=0;
 for(let i=-7;i<=7;i++)for(let j=-7;j<=7;j++){const x=new Rational(BigInt(i),3n),y=new Rational(BigInt(j),3n),r=x.mul(x).add(y.mul(y)),a=r.compare(new Rational(1n)),b=r.compare(new Rational(4n));if(a===0||b===0)continue;const hits=patches(s,point3(x,y));assert.equal(hits.length>0,a>0&&b<0);checked++;}assert.ok(checked>200);
 assert.throws(()=>assertOwnedCylinderExpressionPlaneSection3({...s}),/factory/);assert.throws(()=>sectionFiniteCylinderExpression3({...cavity},s.plane),/factory/);assert.throws(()=>sectionFiniteCylinderExpression3(cavity,{normal:O,offset:new Rational(0n)}),RangeError);
});
test('coincident outer and cavity caps keep one-sided material distinct from genuine cut interiors',()=>{
 const lower=sectionFiniteCylinderExpression3(cavity,plane3(0n,0n,1n,2n)),reverse=sectionFiniteCylinderExpression3(cavity,plane3(0n,0n,-3n,-6n));assert.ok(lower.patches.length);assert.ok(lower.patches.every(p=>!p.negative&&p.positive&&p.kind==='boundary'));assert.ok(reverse.patches.every(p=>p.negative&&!p.positive&&p.kind==='boundary'));
 const cap=sectionFiniteCylinderExpression3(cavity,plane3(0n,0n,1n,-1n),[plane3(0n,1n,0n)]),hole=patches(cap,point3('1/3','1/3',1n)),annulus=patches(cap,point3('3/2','1/3',1n));assert.ok(hole.length&&annulus.length);assert.ok(hole.every(p=>!p.negative&&p.positive&&p.kind==='boundary'));assert.ok(annulus.every(p=>p.negative&&p.positive&&p.kind==='interior'));
 assert.equal(sectionFiniteCylinderExpression3(cavity,plane3(1n,0n,0n,-2n)).patches.length,0);assert.equal(sectionFiniteCylinderExpression3(cavity,plane3(0n,0n,1n,-3n)).patches.length,0);
});
test('oblique disconnected sections retain both material components and reversed plane orientation',()=>{
 const source=boundaryFiniteCylinderExpression3([make(-2n,1n,3n),make(2n,1n,3n)],{kind:'union',first:leaf(0),second:leaf(1)}),s=sectionFiniteCylinderExpression3(source,plane3(1n,0n,1n)),r=sectionFiniteCylinderExpression3(source,plane3(-2n,0n,-2n));assert.ok(s.patches.every(p=>p.kind==='interior'));let checked=0;
 for(let i=-11;i<=11;i++)for(let j=-4;j<=4;j++){const x=new Rational(BigInt(i),4n),y=new Rational(BigInt(j),4n),a=x.add(new Rational(2n)),b=x.sub(new Rational(2n)),left=a.mul(a).add(y.mul(y)).compare(new Rational(1n)),right=b.mul(b).add(y.mul(y)).compare(new Rational(1n));if(left===0||right===0)continue;const expected=left<0||right<0,p=point3(x,y,x.neg());assert.equal(patches(s,p).length>0,expected);assert.equal(patches(r,p).length>0,expected);checked++;}assert.ok(checked>150);assert.ok(patches(s,point3(-2n,0n,2n)).length&&patches(s,point3(2n,0n,-2n)).length);
});
test('opposed coincident caps cancel in union and remain one-sided in difference without epsilon',()=>{
 const c=cylinder3(line3(O,Z),1n),a=prepareFiniteCylinder3(c,-1n,0n),b=prepareFiniteCylinder3(c,0n,1n),plane=plane3(0n,0n,1n);
 for(const kind of ['union','intersection','difference','xor'] as const){const source=boundaryFiniteCylinderExpression3([a,b],{kind,first:leaf(0),second:leaf(1)}),s=sectionFiniteCylinderExpression3(source,plane),hits=patches(s,point3('1/3','1/3'));if(kind==='intersection'){assert.equal(s.patches.length,0);continue;}assert.ok(hits.length);assert.ok(hits.every(p=>p.negative&&p.positive===(kind!=='difference')&&p.kind===(kind==='difference'?'boundary':'interior')));}
 const cancelled=boundaryFiniteCylinderExpression3([a,a],{kind:'difference',first:leaf(0),second:leaf(1)});assert.equal(sectionFiniteCylinderExpression3(cancelled,plane3(0n,0n,1n,'1/2')).patches.length,0);
});
