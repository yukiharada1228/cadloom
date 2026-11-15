import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,point3,algebraicPoint3,algebraicCoordinates3,algebraicSegment3,planeFrame3,ellipse3,intersectAlgebraicSegmentEllipse3,pointOnEllipse3,pointOnAlgebraicSegment3,compareAlgebraicPoints3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),e=ellipse3(planeFrame3(O,X,Y),1n,1n),sqrt=(n:bigint)=>AlgebraicReal.fromRational(n).sqrt();
function check(s:ReturnType<typeof algebraicSegment3>,count:number){
 const points=intersectAlgebraicSegmentEllipse3(s,e);assert.equal(points.length,count);
 for(const p of points){assert.ok(pointOnEllipse3(p,e));assert.ok(pointOnAlgebraicSegment3(p,s));}
 const reversed=intersectAlgebraicSegmentEllipse3(algebraicSegment3(s.end,s.start),e);assert.equal(reversed.length,count);
 points.forEach((p,i)=>assert.equal(compareAlgebraicPoints3(p,reversed[count-1-i]!),0));return points;
}
test('independent algebraic endpoint fields on a validated oblique rational line retain ordered intersections',()=>{
 const s=algebraicSegment3(algebraicPoint3(O,point3(1n,1n,0n),sqrt(2n).neg()),algebraicPoint3(point3(1n,1n,0n),point3(3n,3n,0n),sqrt(3n)));
 const points=check(s,2);assert.equal(points[0]!.x.sign(),-1);assert.equal(points[1]!.x.sign(),1);
 for(const p of points){assert.equal(p.x.compare(p.y),0);assert.equal(p.x.mul(p.x).compare(AlgebraicReal.fromRational('1/2')),0);}
});
test('rational fixed coordinates avoid combining independent vertical endpoint fields',()=>{
 const s=algebraicSegment3(algebraicCoordinates3('1/2',sqrt(2n).neg(),0n),algebraicCoordinates3('1/2',sqrt(3n),0n));
 const points=check(s,2);for(const p of points)assert.equal(p.y.mul(p.y).compare(AlgebraicReal.fromRational('3/4')),0);
 const short=algebraicSegment3(algebraicCoordinates3('1/2',sqrt(2n),0n),algebraicCoordinates3('1/2',sqrt(3n),0n));check(short,0);
});
test('a point construction ray is not accepted as the segment support without checking both endpoints',()=>{
 const s=algebraicSegment3(algebraicPoint3(O,X,sqrt(2n).neg()),algebraicPoint3(O,Y,sqrt(2n)));
 // This diagonal is tangent at (-1/sqrt(2),1/sqrt(2)); the two construction rays are different.
 const points=check(s,1);assert.equal(points[0]!.x.sign(),-1);assert.equal(points[0]!.y.sign(),1);
});
