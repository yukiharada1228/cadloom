import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,point3,algebraicCoordinates3,algebraicSegment3,planeFrame3,ellipse3,intersectAlgebraicSegmentEllipse3,pointOnEllipse3,compareAlgebraicPoints3,curveNodingPoints3,line3,lineInterval3} from '../dist/index.js';
import {algebraicRationalPoint3} from '../dist/geometry/algebraic-point3.js';
import {algebraicAxialPoint3,certifyAlgebraicAxialPair3} from '../dist/geometry/algebraic-axial-point3.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),sqrt=(q:string)=>AlgebraicReal.fromRational(q).sqrt();
test('rational source denominators of either sign retain one common conic field',()=>{
 const parameter=sqrt('1/2'),e=ellipse3(planeFrame3(O,X,Y),1n,1n);
 for(const sign of [1n,-1n]){
  const base=algebraicRationalPoint3(parameter,[new Polynomial([0n,sign]),new Polynomial([]),new Polynomial([])],new Polynomial([sign,0n,sign])),a=algebraicAxialPoint3(base,Y,sqrt('2').neg()),b=algebraicAxialPoint3(base,Y,sqrt('3')),segment=algebraicSegment3(a,b),points=intersectAlgebraicSegmentEllipse3(segment,e);
  assert.equal(points.length,2);
  for(const p of points){assert.ok(pointOnEllipse3(p,e));assert.equal(p.x.mul(p.x).compare(AlgebraicReal.fromRational('2/9')),0);assert.equal(p.y.mul(p.y).compare(AlgebraicReal.fromRational('7/9')),0);assert.ok(p.y.polynomial.degree<=2*parameter.polynomial.degree);}
  const reverse=intersectAlgebraicSegmentEllipse3(algebraicSegment3(b,a),e);points.forEach((p,i)=>assert.equal(compareAlgebraicPoints3(p,reverse[1-i]!),0));
 }
});
test('coplanarity and finite bounds govern intersections of verified rational-direction lines',()=>{
 const h=sqrt('1/2'),a=algebraicCoordinates3(h,-2n,0n),b=algebraicCoordinates3(h,2n,0n),base=algebraicCoordinates3(h,0n,0n);certifyAlgebraicAxialPair3(a,b,base,Y);
 const segment={kind:'algebraic-segment' as const,segment:algebraicSegment3(a,b)},crossing={kind:'line' as const,interval:lineInterval3(line3(point3(-2n,0n,0n),X),0n,4n)},points=curveNodingPoints3(segment,crossing);
 assert.equal(points.length,1);assert.equal(points[0]!.x.compare(h),0);assert.equal(points[0]!.y.sign(),0);
 assert.equal(compareAlgebraicPoints3(points[0]!,curveNodingPoints3(crossing,segment)[0]!),0);
 const skew={kind:'line' as const,interval:lineInterval3(line3(point3(-1n,-1n,-1n),point3(1n,1n,1n)),0n,2n)};assert.deepEqual(curveNodingPoints3(segment,skew),[]);
 const short={kind:'line' as const,interval:lineInterval3(line3(O,X),0n,'1/4')};assert.deepEqual(curveNodingPoints3(segment,short),[]);
});
