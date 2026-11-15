import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,plane3,circle3,prepareCircularFace3,prepareCylinderFace3,partitionCylinderFaceByFiniteCylinders3,partitionPlanarFaceByFiniteCylinders3,encodeRefinedCylinderCellDomain3,createMixedFaceDomainDecoder3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),A=cylinder3(line3(O,Z),1n),B=cylinder3(line3(O,X),2n),cuts=[{cylinder:B,lower:'-1/2',upper:'1/2'}],half=new Rational(1n,2n),two=new Rational(2n);
const material=(x:Rational,y:Rational,z:Rational)=>{const r=y.mul(y).add(z.mul(z)).compare(two),lo=x.compare(half.neg()),hi=x.compare(half);return r>0||lo<0||hi>0?'outside':r===0||lo===0||hi===0?'boundary':'inside';};

test('additional oblique wall cuts preserve finite-cylinder truth and exact plane columns on a rational grid',()=>{
 const r=partitionCylinderFaceByFiniteCylinders3(prepareCylinderFace3(A,-2n,2n),cuts,[plane3(1n,1n,1n),plane3(-2n,-2n,-2n)]);let checked=0;
 assert.equal(r.partition.planes.length,4);
 for(let n=-4;n<=4;n++){const t=new Rational(BigInt(n),5n),den=new Rational(1n).add(t.mul(t)),x=new Rational(1n).sub(t.mul(t)).div(den),y=t.mul(two).div(den);for(let h=-3;h<=3;h++){
  const z=new Rational(BigInt(h),2n),p=point3(x,y,z),expected=material(x,y,z),side=x.add(y).add(z).sign();if(expected==='boundary'||side===0)continue;
  assert.ok(r.partition.cells.some(c=>c.locate(p)!=='outside'));const ids=r.partition.cells.flatMap((c,i)=>c.locate(p)==='inside'?[i]:[]);assert.ok(ids.length<=1);if(!ids.length)continue;const i=ids[0]!;assert.equal(r.materialLocations[i]![0],expected);assert.deepEqual(r.partition.planeSides[i]!.slice(2),[side,-side]);checked++;
 }}assert.ok(checked>40);
});

test('planar arrangements retain independent plane signs and finite cylinder labels after extra cuts',()=>{
 const r=partitionPlanarFaceByFiniteCylinders3(prepareCircularFace3(circle3(O,Z,4n)),cuts,[plane3(1n,1n,0n),plane3(1n,-1n,0n,'-1/7')]);let checked=0;assert.equal(r.partition.planes.length,4);
 for(let i=-5;i<=5;i++)for(let j=-5;j<=5;j++){const x=new Rational(BigInt(i),3n),y=new Rational(BigInt(j),3n),p=point3(x,y),expected=material(x,y,new Rational(0n)),s=x.add(y).sign(),t=x.sub(y).sub(new Rational(1n,7n)).sign();if(x.mul(x).add(y.mul(y)).compare(new Rational(4n))>=0||expected==='boundary'||s===0||t===0)continue;
  const ids=r.partition.cells.flatMap((c,k)=>c.locate(p)==='inside'?[k]:[]);assert.equal(ids.length,1);const k=ids[0]!;assert.equal(r.materialLocations[k]![0],expected);assert.deepEqual(r.partition.cells[k]!.planeSides.slice(2),[s,t]);checked++;
 }assert.ok(checked>70);
});

test('a sub-floating-precision plane strip keeps its domain through exact replay and rejects invalid planes',()=>{
 const tiny=new Rational(1n,10n**40n),base=prepareCylinderFace3(A,-1n,1n),definitions=[{cylinder:A,lower:-1n,upper:1n}],planes=[plane3(0n,0n,1n),plane3(0n,0n,1n,tiny.neg())],r=partitionCylinderFaceByFiniteCylinders3(base,definitions,planes),p=point3('3/5','4/5',tiny.div(two)),ids=r.partition.cells.flatMap((c,i)=>c.locate(p)==='inside'?[i]:[]);
 assert.equal(ids.length,1);const id=ids[0]!;assert.deepEqual(r.partition.planeSides[id]!.slice(2),[1,-1]);assert.equal(r.materialLocations[id]![0],'boundary');const record=encodeRefinedCylinderCellDomain3(r.partition,id),restored=createMixedFaceDomainDecoder3()(JSON.parse(JSON.stringify(record)));assert.equal(restored.locate(p),'inside');assert.equal(restored.locate(point3('3/5','4/5',tiny.mul(two))),'outside');
 const invalid={normal:point3(0n,0n),offset:new Rational(0n)};assert.throws(()=>partitionCylinderFaceByFiniteCylinders3(base,definitions,[invalid]),RangeError);assert.throws(()=>partitionPlanarFaceByFiniteCylinders3(prepareCircularFace3(circle3(O,Z,1n)),definitions,[invalid]),RangeError);
});
