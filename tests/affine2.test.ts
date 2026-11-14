import test from 'node:test';
import assert from 'node:assert/strict';
import {affine2,affineDeterminant,transformPoint,transformSegment,transformPolygon,
 composeAffine2,invertAffine2,point2,segment2,pointsEqual,intersectSegments,
 booleanPolygons,preparePolygon,Rational} from '../dist/index.js';
import type {BooleanOperation} from '../dist/index.js';
const p=(x:bigint,y:bigint)=>point2(x,y);
const square=[p(0n,0n),p(2n,0n),p(2n,2n),p(0n,2n)];
test('identity, exact rotation, singular maps and composition order',()=>{
 const point=p(1n,2n);
 assert.ok(pointsEqual(transformPoint(affine2(),point),point));
 const rotate=affine2('3/5','-4/5','4/5','3/5');
 assert.ok(pointsEqual(transformPoint(rotate,point),point2('-1','2')));
 const move=affine2(1n,0n,0n,1n,10n,20n), scale=affine2(2n,0n,0n,3n);
 assert.ok(pointsEqual(transformPoint(composeAffine2(move,scale),point),p(12n,26n)));
 assert.ok(pointsEqual(transformPoint(composeAffine2(scale,move),point),p(22n,66n)));
 const singular=affine2(1n,2n,2n,4n);
 assert.throws(()=>invertAffine2(singular),RangeError);
 assert.equal(booleanPolygons(transformPolygon(singular,[square]),[],'union').twiceArea.sign(),0);
 assert.ok(Object.isFrozen(rotate));
});
test('seeded rational matrices invert and compose exactly on large rational points',()=>{
 let seed=931;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%21)-10n;};
 for(let i=0;i<200;i++){
  const t=affine2(...Array.from({length:6},()=>new Rational(rand(),7n)) as [Rational,Rational,Rational,Rational,Rational,Rational]);
  const point=point2('90071992547409931234567890123456789/13','-1/10000000000000000000000000000');
  if(affineDeterminant(t).sign()===0)continue;
  const inverse=invertAffine2(t);
  assert.ok(pointsEqual(transformPoint(inverse,transformPoint(t,point)),point));
  assert.ok(pointsEqual(transformPoint(t,transformPoint(inverse,point)),point));
  assert.ok(pointsEqual(transformPoint(composeAffine2(t,inverse),point),point));
 }
});
test('intersection, polygon area and point location commute with invertible affine maps',()=>{
 const a=segment2(p(0n,0n),p(2n,2n)),b=segment2(p(0n,2n),p(2n,0n));
 const other=square.map(q=>point2(q.x.add(new Rational(1n)),q.y.add(new Rational(1n))));
 const ops:BooleanOperation[]=['union','intersection','difference','xor'];
 for(const t of [affine2(2n,1n,1n,3n,5n,-7n),affine2(-1n,'1/3','2/7',2n),affine2('1/10000000000000000000',0n,0n,'1/3')]){
  const hit=intersectSegments(transformSegment(t,a),transformSegment(t,b));
  assert.equal(hit.kind,'point');
  if(hit.kind==='point')assert.ok(pointsEqual(hit.point,transformPoint(t,p(1n,1n))));
  for(const op of ops){
   const original=booleanPolygons([square],[other],op);
   const mapped=booleanPolygons(transformPolygon(t,[square]),transformPolygon(t,[other]),op);
   const det=affineDeterminant(t), magnitude=det.sign()<0?det.neg():det;
   assert.ok(mapped.twiceArea.equals(original.twiceArea.mul(magnitude)));
  }
  const polygon=preparePolygon(transformPolygon(t,[square]));
  for(const [q,location] of [[p(1n,1n),'inside'],[p(0n,1n),'boundary'],[p(3n,1n),'outside']] as const){
   assert.equal(polygon.locate(transformPoint(t,q)),location);
  }
 }
 const transformed=transformPolygon(affine2(),[square]);
 assert.ok(Object.isFrozen(transformed)&&Object.isFrozen(transformed[0])&&Object.isFrozen(transformed[0]![0]));
});
