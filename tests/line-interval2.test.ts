import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,line2,lineInterval2,pointOnLineInterval2,intersectLineIntervals2,intersectLineIntervalArc2,fullCircleArc2,circle2,Polynomial,isolateRealRoots,AlgebraicReal,algebraicCoordinates2,compareAlgebraicPoints2,segment2,intersectSegments} from '../dist/index.js';
const sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!;
test('closed algebraic line trims support reversed frames, degenerate points and circle hits',()=>{
 const horizontal=line2(point2(0n,0n),point2(1n,0n)),a=lineInterval2(horizontal,sqrt2.neg(),sqrt2),b=lineInterval2(line2(point2(3n,0n),point2(-2n,0n)),0n,2n);
 const overlap=intersectLineIntervals2(a,b);assert.equal(overlap.kind,'overlap');if(overlap.kind==='overlap'){
  assert.equal(overlap.interval.start.x.compare(AlgebraicReal.fromRational(-1n)),0);assert.equal(overlap.interval.end.x.compare(sqrt2),0);
 }
 assert.equal(pointOnLineInterval2(point2(0n,0n),a),true);assert.equal(pointOnLineInterval2(point2(2n,0n),a),false);assert.equal(pointOnLineInterval2(point2(0n,1n),a),false);
 const hits=intersectLineIntervalArc2(a,fullCircleArc2(circle2(point2(0n,0n),2n)));assert.equal(hits.length,2);assert.equal(hits[0]!.parameter.compare(sqrt2.neg()),0);assert.equal(hits[1]!.parameter.compare(sqrt2),0);
 const endpoint=lineInterval2(horizontal,sqrt2,sqrt2);assert.equal(intersectLineIntervals2(a,endpoint).kind,'point');assert.equal(intersectLineIntervalArc2(endpoint,fullCircleArc2(circle2(point2(0n,0n),2n))).length,1);
 const diagonal=lineInterval2(line2(point2(0n,0n),point2(1n,1n)),-2n,2n);const crossing=intersectLineIntervals2(a,diagonal);assert.equal(crossing.kind,'point');if(crossing.kind==='point')assert.equal(compareAlgebraicPoints2(crossing.point,algebraicCoordinates2(0n,0n)),0);
 const vertical=lineInterval2(line2(point2(0n,3n),point2(0n,-2n)),0n,3n);assert.equal(pointOnLineInterval2(point2(0n,-1n),vertical),true);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.start));
});
test('integer line-interval intersections match all 6,561 baseline segment cases',()=>{
 const points=[-1n,0n,1n].flatMap(x=>[-1n,0n,1n].map(y=>point2(x,y)));
 const intervals=points.flatMap(a=>points.map(b=>({a,b,segment:segment2(a,b),interval:a.x.equals(b.x)&&a.y.equals(b.y)?lineInterval2(line2(a,point2(1n,0n)),0n,0n):lineInterval2(line2(a,point2(b.x.sub(a.x),b.y.sub(a.y))),0n,1n)})));
 let count=0;
 for(const a of intervals)for(const b of intervals){
  const expected=intersectSegments(a.segment,b.segment),actual=intersectLineIntervals2(a.interval,b.interval);
  assert.equal(actual.kind,expected.kind);
  if(expected.kind==='point'&&actual.kind==='point')assert.equal(compareAlgebraicPoints2(actual.point,algebraicCoordinates2(expected.point.x,expected.point.y)),0);
  if(expected.kind==='overlap'&&actual.kind==='overlap'){
   assert.equal(compareAlgebraicPoints2(actual.interval.start,algebraicCoordinates2(expected.segment.start.x,expected.segment.start.y)),0);
   assert.equal(compareAlgebraicPoints2(actual.interval.end,algebraicCoordinates2(expected.segment.end.x,expected.segment.end.y)),0);
  }
  count++;
 }
 assert.equal(count,6561);
});
