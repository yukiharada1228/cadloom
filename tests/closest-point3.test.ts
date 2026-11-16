import test from 'node:test';
import assert from 'node:assert/strict';
import {similarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3,Rational,AlgebraicReal,point3,line3,segment3,cylinder3,plane3,closestPointOnLine3,closestPointOnSegment3,closestPointOnSurface3,classifyPointToSurface3,compareAlgebraicPoints3,algebraicCoordinates3,intersectCirclePlane3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n);
test('line and closed-segment projections keep exact parameters, bounds and collapsed-point semantics',()=>{
 const line=line3(point3(1n,2n,3n),point3(2n,-1n,2n)),p=point3(3n,0n,8n),result=closestPointOnLine3(p,line);
 assert.equal(result.parameter.toString(),'16/9');assert.equal(result.squaredDistance.compare(AlgebraicReal.fromRational('41/9')),0);assert.equal(compareAlgebraicPoints3(result.point,algebraicCoordinates3('41/9','2/9','59/9')),0);
 const reversed=closestPointOnLine3(p,line3(line.origin,point3(-4n,2n,-4n)));assert.equal(reversed.parameter.toString(),'-8/9');assert.equal(compareAlgebraicPoints3(reversed.point,result.point),0);
 const s=segment3(O,point3(2n,0n,0n));
 for(const [p,t,d] of [[point3(-1n,1n,0n),'0','2'],[point3(3n,1n,0n),'1','2'],[point3(1n,3n,0n),'1/2','9']] as const){const q=closestPointOnSegment3(p,s);assert.equal(q.parameter.toString(),t);assert.equal(q.squaredDistance.compare(AlgebraicReal.fromRational(d)),0);}
 const collapsed=closestPointOnSegment3(point3(1n,2n,2n),segment3(O,O));assert.equal(collapsed.parameter.sign(),0);assert.equal(collapsed.squaredDistance.compare(AlgebraicReal.fromRational(9n)),0);assert.ok(Object.isFrozen(result));
});
test('plane projection uses the true Euclidean metric with an unnormalized rational normal',()=>{
 const plane=plane3(2n,-3n,6n,-7n),result=closestPointOnSurface3(point3(2n,1n,0n),{kind:'plane',plane});assert.ok(result.kind==='point');
 assert.equal(result.squaredDistance.compare(AlgebraicReal.fromRational('36/49')),0);assert.equal(classifyPointToSurface3(result.point,{kind:'plane',plane}),0);
 assert.equal(compareAlgebraicPoints3(result.point,algebraicCoordinates3('110/49','31/49','36/49')),0);
});
test('off-axis cylinder projection retains exact quadratic dependence and axis points return a full nearest circle',()=>{
 const cylinder=cylinder3(line3(point3(1n,-2n,0n),point3(0n,0n,3n)),2n),surface={kind:'cylinder' as const,cylinder},result=closestPointOnSurface3(point3(4n,2n,5n),surface),root=AlgebraicReal.fromRational(2n).sqrt();assert.ok(result.kind==='point');
 assert.equal(result.squaredDistance.compare(root.affine(-10n,27n)),0);assert.equal(classifyPointToSurface3(result.point,surface),0);
 assert.equal(compareAlgebraicPoints3(result.point,algebraicCoordinates3(root.affine('3/5',1n),root.affine('4/5',-2n),5n)),0);
 const family=closestPointOnSurface3(point3(1n,-2n,5n),surface);assert.ok(family.kind==='circle');assert.deepEqual(family.circle.center,point3(1n,-2n,5n));assert.equal(family.squaredDistance.compare(AlgebraicReal.fromRational(2n)),0);
 const members=intersectCirclePlane3(family.circle,plane3(0n,1n,0n,2n));assert.equal(members.kind,'points');if(members.kind==='points'){assert.equal(members.points.length,2);for(const p of members.points)assert.equal(classifyPointToSurface3(p,surface),0);}
});
test('cylinder minimum bounds independent rational surface candidates and behaves inside and on the support',()=>{
 const cylinder=cylinder3(line3(O,Z),1n),surface={kind:'cylinder' as const,cylinder},p=point3(2n,1n,3n),result=closestPointOnSurface3(p,surface);assert.ok(result.kind==='point');
 assert.equal(result.squaredDistance.compare(AlgebraicReal.fromRational(5n).sqrt().affine(-2n,6n)),0);
 for(let i=-8;i<=8;i++)for(let z=-2;z<=2;z++){
  const t=new Rational(BigInt(i),7n),one=new Rational(1n),T=t.mul(t),D=one.add(T),q=point3(one.sub(T).div(D),t.mul(new Rational(2n)).div(D),new Rational(BigInt(3+z))),dx=p.x.sub(q.x),dy=p.y.sub(q.y),dz=p.z.sub(q.z),squared=dx.mul(dx).add(dy.mul(dy)).add(dz.mul(dz));
  assert.ok(result.squaredDistance.compare(AlgebraicReal.fromRational(squared))<=0);assert.equal(classifyPointToSurface3(q,surface),0);
 }
 const inside=closestPointOnSurface3(point3('1/2',0n,0n),surface);assert.ok(inside.kind==='point');assert.equal(inside.squaredDistance.compare(AlgebraicReal.fromRational('1/4')),0);
 const on=closestPointOnSurface3(point3(1n,0n,3n),surface);assert.equal(on.squaredDistance.sign(),0);
});

test('nearest cylinder geometry transforms covariantly and invalid supports are rejected',()=>{
 const c=cylinder3(line3(O,Z),2n),p=point3(2n,1n,3n),t=similarityTransform3([point3(0n,0n,2n),point3(0n,2n,0n),point3(2n,0n,0n)],point3(3n,-2n,5n)),a=closestPointOnSurface3(p,{kind:'cylinder',cylinder:c}),b=closestPointOnSurface3(transformPointBySimilarity3(t,p),{kind:'cylinder',cylinder:cylinder3(line3(transformPointBySimilarity3(t,O),transformVectorBySimilarity3(t,Z)),8n)});
 assert.ok(a.kind==='point'&&b.kind==='point');assert.equal(b.squaredDistance.compare(a.squaredDistance.affine(4n)),0);
 assert.equal(compareAlgebraicPoints3(b.point,algebraicCoordinates3(a.point.z.affine(2n,3n),a.point.y.affine(2n,-2n),a.point.x.affine(2n,5n))),0);
 assert.throws(()=>closestPointOnLine3(O,{origin:O,direction:O}),RangeError);
 assert.throws(()=>closestPointOnSurface3(O,{kind:'plane',plane:{normal:O,offset:new Rational(0n)}}),RangeError);
 assert.throws(()=>closestPointOnSurface3(O,{kind:'cylinder',cylinder:{axis:line3(O,Z),radiusSquared:new Rational(-1n)}}),RangeError);
});
