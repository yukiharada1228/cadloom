import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,circle3,circularArc3,fullCircleArc3,reverseCircularArc3,pointOnArc3,AlgebraicReal,algebraicPoint3,algebraicCoordinates3,compareAlgebraicPoints3,closestPointOnCircle3,closestPointOnCircularArc3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),N=point3(-1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n),circle=circle3(O,Z,1n);
test('spatial circle distance includes normal displacement and preserves an all-circle minimum',()=>{
 const unique=closestPointOnCircle3(point3(2n,0n,3n),circle);assert.ok(unique.kind==='point');assert.equal(compareAlgebraicPoints3(unique.point,algebraicCoordinates3(1n,0n,0n)),0);assert.equal(unique.squaredDistance.compare(AlgebraicReal.fromRational(10n)),0);
 const family=closestPointOnCircle3(point3(0n,0n,3n),circle);assert.ok(family.kind==='circle');assert.equal(family.squaredDistance.compare(AlgebraicReal.fromRational(10n)),0);
 const tilted=closestPointOnCircle3(point3(5n,5n,-1n),circle3(O,point3(1n,1n,1n),6n));assert.ok(tilted.kind==='point');assert.equal(compareAlgebraicPoints3(tilted.point,algebraicCoordinates3(1n,1n,-2n)),0);assert.equal(tilted.squaredDistance.compare(AlgebraicReal.fromRational(33n)),0);
 const oblique=circle3(point3(1n,-2n,3n),point3(1n,1n,1n),2n),all=closestPointOnCircle3(point3(3n,0n,5n),oblique);assert.ok(all.kind==='circle');assert.equal(all.squaredDistance.compare(AlgebraicReal.fromRational(14n)),0);
});
test('finite arcs choose interior or endpoint minima and preserve equal endpoint winners',()=>{
 const arc=circularArc3(circle,X,N),inside=closestPointOnCircularArc3(point3(0n,2n,3n),arc);assert.ok(inside.kind==='point');assert.equal(compareAlgebraicPoints3(inside.point,algebraicCoordinates3(0n,1n,0n)),0);assert.equal(inside.squaredDistance.compare(AlgebraicReal.fromRational(10n)),0);
 const endpoint=closestPointOnCircularArc3(point3(2n,-1n,0n),arc);assert.ok(endpoint.kind==='point');assert.equal(compareAlgebraicPoints3(endpoint.point,algebraicCoordinates3(1n,0n,0n)),0);assert.equal(endpoint.squaredDistance.compare(AlgebraicReal.fromRational(2n)),0);
 const tie=closestPointOnCircularArc3(point3(0n,-2n,0n),arc),reversed=closestPointOnCircularArc3(point3(0n,-2n,0n),reverseCircularArc3(arc));assert.ok(tie.kind==='points'&&reversed.kind==='points');assert.equal(tie.squaredDistance.compare(AlgebraicReal.fromRational(5n)),0);tie.points.forEach((p,i)=>{assert.ok(pointOnArc3(p,arc));assert.equal(compareAlgebraicPoints3(p,reversed.points[i]!),0);});assert.ok(Object.isFrozen(tie.points));
});
test('axis queries preserve all-arc sets while point arcs stay unique',()=>{
 const arc=circularArc3(circle,X,N),all=closestPointOnCircularArc3(point3(0n,0n,3n),arc);assert.ok(all.kind==='arc');assert.equal(all.arc,arc);assert.equal(all.squaredDistance.compare(AlgebraicReal.fromRational(10n)),0);
 const full=closestPointOnCircularArc3(O,fullCircleArc3(circle));assert.ok(full.kind==='arc'&&full.arc.fullCircle);
 const point=closestPointOnCircularArc3(O,circularArc3(circle,X,X));assert.ok(point.kind==='point');assert.equal(point.squaredDistance.compare(AlgebraicReal.fromRational(1n)),0);
 assert.throws(()=>closestPointOnCircularArc3(O,{...arc,end:algebraicCoordinates3(2n,0n,0n)}),RangeError);
});
test('irrational arc endpoints retain exact equal minima without independent squared-coordinate expansion',()=>{
 const root=AlgebraicReal.fromRational('1/2').sqrt(),a=algebraicPoint3(O,point3(1n,1n,0n),root),b=algebraicPoint3(O,point3(-1n,1n,0n),root),arc=circularArc3(circle,a,b),result=closestPointOnCircularArc3(point3(0n,-2n,0n),arc);assert.ok(result.kind==='points');assert.equal(result.squaredDistance.compare(root.affine(4n,5n)),0);assert.ok(result.points.every(p=>pointOnArc3(p,arc)));
 const lower=closestPointOnCircularArc3(point3(0n,-2n,0n),circularArc3(circle,X,N,{direction:'cw'}));assert.ok(lower.kind==='point');assert.equal(lower.squaredDistance.compare(AlgebraicReal.fromRational(1n)),0);
});
