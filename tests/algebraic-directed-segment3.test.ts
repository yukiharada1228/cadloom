import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,point3,algebraicCoordinates2,algebraicCoordinates3,mapPlanePoint3,planeFrame3,pointInPlaneFrame3,ellipse3,algebraicSegment3,intersectAlgebraicSegmentEllipse3,pointOnEllipse3,compareAlgebraicPoints3,curveNodingPoints3} from '../dist/index.js';
import {certifyAlgebraicAxialPair3,commonAlgebraicAxialLine3} from '../dist/geometry/algebraic-axial-point3.js';
const O=point3(0n,0n,0n),Y=point3(0n,1n,0n),sqrt=(q:string)=>AlgebraicReal.fromRational(q).sqrt();
test('line registration rejects a wrong direction and does not trust copied coordinate flags',()=>{
 const h=sqrt('1/2'),a=algebraicCoordinates3(h,0n,0n),b=algebraicCoordinates3(h,1n,0n);
 assert.equal(commonAlgebraicAxialLine3(a,b),null);
 assert.throws(()=>certifyAlgebraicAxialPair3(a,b,a,point3(1n,0n,0n)),RangeError);assert.equal(commonAlgebraicAxialLine3(a,b),null);
 certifyAlgebraicAxialPair3(a,b,a,Y);assert.ok(commonAlgebraicAxialLine3(a,b));
 const copiedA={...a,direction:Y,base:a},copiedB={...b,direction:Y,base:a};assert.equal(commonAlgebraicAxialLine3(copiedA,copiedB),null);
});
test('spatial rational directions intersect an ellipse without endpoint-field interpolation',()=>{
 const frame=planeFrame3(O,point3(2n,-1n,0n),point3(2n,4n,-5n)),e=ellipse3(frame,'1/5','1/45'),h=sqrt('1/10');
 const a=mapPlanePoint3(frame,algebraicCoordinates2(h,sqrt('2').neg())),b=mapPlanePoint3(frame,algebraicCoordinates2(h,sqrt('3'))),s=algebraicSegment3(a,b);
 const points=intersectAlgebraicSegmentEllipse3(s,e);assert.equal(points.length,2);
 for(const p of points){assert.ok(pointOnEllipse3(p,e));const q=pointInPlaneFrame3(frame,p)!;assert.equal(q.x.compare(h),0);assert.equal(q.y.mul(q.y).compare(AlgebraicReal.fromRational('1/90')),0);}
 const reversed=intersectAlgebraicSegmentEllipse3(algebraicSegment3(b,a),e);points.forEach((p,i)=>assert.equal(compareAlgebraicPoints3(p,reversed[1-i]!),0));
});
test('registered parallel segments retain exact overlap endpoints and finite extents',()=>{
 const h=sqrt('1/2'),a=algebraicCoordinates3(h,0n,0n),b=algebraicCoordinates3(h,2n,0n),c=algebraicCoordinates3(h,1n,0n),d=algebraicCoordinates3(h,3n,0n);
 certifyAlgebraicAxialPair3(a,b,a,Y);certifyAlgebraicAxialPair3(c,d,a,Y);
 const first={kind:'algebraic-segment' as const,segment:algebraicSegment3(a,b)},second={kind:'algebraic-segment' as const,segment:algebraicSegment3(c,d)},points=curveNodingPoints3(first,second);
 assert.equal(points.length,2);assert.equal(points[0]!.y.rational!.toString(),'1');assert.equal(points[1]!.y.rational!.toString(),'2');
 assert.deepEqual(curveNodingPoints3(first,{kind:'algebraic-segment',segment:algebraicSegment3(algebraicCoordinates3(h,4n,0n),algebraicCoordinates3(h,5n,0n))}),[]);
});
