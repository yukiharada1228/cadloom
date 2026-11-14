import test from 'node:test';
import assert from 'node:assert/strict';
import {circle2,circleThroughPoints2,line2,point2,segment2,intersectLineCircle2,intersectSegmentCircle2,intersectCircles2,classifyPointToCircle2,classifyAlgebraicPointToCircle2,compareAlgebraicPoints2,orientAlgebraicPoint2,algebraicPoint2,AlgebraicReal,Polynomial,isolateRealRoots,Rational} from '../dist/index.js';
import type {Point2} from '../dist/index.js';
const grid:readonly [bigint,bigint][]=[-1n,0n,1n].flatMap(x=>[-1n,0n,1n].map(y=>[x,y] as const));
function countSegment(a:readonly bigint[],b:readonly bigint[],c:readonly bigint[],r:bigint){
 const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,x=a[0]!-c[0]!,y=a[1]!-c[1]!;
 const A=dx*dx+dy*dy,B=2n*(x*dx+y*dy),C=x*x+y*y-r,D=B*B-4n*A*C;
 if(A===0n)return C===0n?1:0;
 if(D<0n)return 0;
 if(D===0n)return -B>=0n&&-B<=2n*A?1:0;
 const end=A+B+C;
 if(C===0n)return 1+(-B>0n&&-B<=A?1:0);
 if(end===0n)return 1+(C>0n&&C<A?1:0);
 if(C*end<0n)return 1;
 return C>0n&&end>0n&&-B>0n&&-B<2n*A?2:0;
}
test('3,645 closed segment/circle cases and 3,240 infinite lines match an independent integer quadratic oracle',()=>{
 let segments=0,lines=0;
 for(const a of grid)for(const b of grid)for(const c of grid)for(const r of [0n,1n,2n,4n,5n]){
  const start=point2(...a),end=point2(...b),circle=circle2(point2(...c),r);
  const hits=intersectSegmentCircle2(segment2(start,end),circle);
  assert.equal(hits.length,countSegment(a,b,c,r));segments++;
  hits.forEach((hit,i)=>{
   assert.equal(classifyAlgebraicPointToCircle2(hit.point,circle),0);
   assert.ok(hit.parameter.compare(AlgebraicReal.fromRational(0n))>=0&&hit.parameter.compare(AlgebraicReal.fromRational(1n))<=0);
   assert.equal(orientAlgebraicPoint2(start,end,hit.point),0);
   if(i)assert.equal(hits[i-1]!.parameter.compare(hit.parameter),-1);
   assert.ok(Object.isFrozen(hit)&&Object.isFrozen(hit.point));
  });
  assert.ok(Object.isFrozen(hits));
  const dx=b[0]-a[0],dy=b[1]-a[1];
  if(dx===0n&&dy===0n)continue;
  const x=a[0]-c[0],y=a[1]-c[1],A=dx*dx+dy*dy,B=2n*(x*dx+y*dy),C=x*x+y*y-r,D=B*B-4n*A*C;
  const all=intersectLineCircle2(line2(start,point2(dx,dy)),circle);
  assert.equal(all.length,D<0n?0:D===0n?1:2);all.forEach(h=>assert.equal(h.multiplicity,D===0n?2:1));lines++;
 }
 assert.equal(segments,3645);assert.equal(lines,3240);
});
test('1,296 circle pairs match raw integer radical discriminants, including concentric and point circles',()=>{
 let cases=0;
 for(const a of grid)for(const b of grid)for(const ra of [0n,1n,2n,4n])for(const rb of [0n,1n,2n,4n]){
  const first=circle2(point2(...a),ra),second=circle2(point2(...b),rb),hit=intersectCircles2(first,second);
  const dx=b[0]-a[0],dy=b[1]-a[1],D=dx*dx+dy*dy,H=4n*D*ra-(D+ra-rb)**2n;
  if(D===0n&&ra===rb&&ra>0n)assert.equal(hit.kind,'coincident');
  else {
   const expected=D===0n?(ra===rb?1:0):H<0n?0:H===0n?1:2;
   assert.equal(hit.kind,expected?'points':'none');
   if(hit.kind==='points'){
    assert.equal(hit.points.length,expected);
    hit.points.forEach((p,i)=>{
     assert.equal(classifyAlgebraicPointToCircle2(p,first),0);assert.equal(classifyAlgebraicPointToCircle2(p,second),0);
     if(i)assert.equal(compareAlgebraicPoints2(hit.points[i-1]!,p),-1);
    });
    if(cases%23===0){const reverse=intersectCircles2(second,first);assert.equal(reverse.kind,'points');if(reverse.kind==='points')hit.points.forEach((p,i)=>assert.equal(compareAlgebraicPoints2(p,reverse.points[i]!),0));}
   }
  }
  assert.ok(Object.isFrozen(hit));cases++;
 }
 assert.equal(cases,1296);
});
test('irrational coordinates, tangent/endpoint multiplicities, collapsed segments and input errors',()=>{
 const c=circle2(point2(0n,0n),2n),line=line2(point2(0n,0n),point2(1n,0n)),hits=intersectLineCircle2(line,c);
 assert.equal(hits.length,2);assert.equal(hits[1]!.point.x.compare(isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!),0);
 assert.equal(hits[1]!.point.y.compare(AlgebraicReal.fromRational(0n)),0);
 assert.equal(orientAlgebraicPoint2(point2(0n,0n),point2(1n,1n),hits[1]!.point),-1);
 assert.equal(classifyAlgebraicPointToCircle2(hits[1]!.point,circle2(point2(0n,0n),3n)),-1);
 assert.equal(classifyAlgebraicPointToCircle2(hits[1]!.point,circle2(point2(0n,0n),1n)),1);
 const unit=circle2(point2(0n,0n),1n);
 const tangent=intersectSegmentCircle2(segment2(point2(-1n,1n),point2(1n,1n)),unit);assert.equal(tangent.length,1);assert.equal(tangent[0]!.multiplicity,2);
 const endpoints=intersectSegmentCircle2(segment2(point2(-1n,0n),point2(1n,0n)),unit);assert.equal(endpoints.length,2);assert.equal(endpoints[0]!.parameter.rational?.toString(),'0');assert.equal(endpoints[1]!.parameter.compare(AlgebraicReal.fromRational(1n)),0);
 const collapsed=intersectSegmentCircle2(segment2(point2(1n,0n),point2(1n,0n)),unit);assert.equal(collapsed.length,1);assert.equal(collapsed[0]!.multiplicity,null);
 assert.equal(intersectSegmentCircle2(segment2(point2(0n,0n),point2(0n,0n)),unit).length,0);
 assert.throws(()=>circle2(point2(0n,0n),-1n),RangeError);assert.throws(()=>line2(point2(0n,0n),point2(0n,0n)),RangeError);
 assert.throws(()=>circleThroughPoints2(point2(0n,0n),point2(1n,1n),point2(2n,2n)),RangeError);
});
test('circles through rational points snapshot input and preserve tiny squared radii under huge translations',()=>{
 const c=circleThroughPoints2(point2(0n,0n),point2(2n,0n),point2(0n,2n));
 assert.equal(c.center.x.toString(),'1');assert.equal(c.center.y.toString(),'1');assert.equal(c.radiusSquared.toString(),'2');
 const huge=Rational.parse('1'+'0'.repeat(60)),tiny=Rational.parse('1/1'+'0'.repeat(80));
 const a=point2(huge,huge),b=point2(huge.add(tiny),huge),d=point2(huge,huge.add(tiny));
 const small=circleThroughPoints2(a,b,d);[a,b,d].forEach(p=>assert.equal(classifyPointToCircle2(p,small),0));
 assert.equal(small.radiusSquared.toString(),tiny.mul(tiny).div(new Rational(2n)).toString());
 const mutable={x:new Rational(2n),y:new Rational(3n)},snapshot=circle2(mutable,4n);mutable.x=new Rational(9n);
 assert.equal(snapshot.center.x.toString(),'2');assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.center));
});
test('rational similarities preserve correlated algebraic points and canonical circle intersections',()=>{
 const a=circle2(point2(0n,0n),2n),b=circle2(point2(1n,0n),2n),original=intersectCircles2(a,b);assert.equal(original.kind,'points');
 const scale=Rational.parse('-7/3'),offset=Rational.parse('1'+'0'.repeat(30));
 const linear=(p:Point2)=>point2(p.x.mul(Rational.parse('3/5')).sub(p.y.mul(Rational.parse('4/5'))).mul(scale),p.x.mul(Rational.parse('4/5')).add(p.y.mul(Rational.parse('3/5'))).mul(scale));
 const map=(p:Point2)=>{const v=linear(p);return point2(v.x.add(offset),v.y.sub(offset));};
 const mapped=intersectCircles2(circle2(map(a.center),a.radiusSquared.mul(scale).mul(scale)),circle2(map(b.center),b.radiusSquared.mul(scale).mul(scale)));assert.equal(mapped.kind,'points');
 if(original.kind==='points'&&mapped.kind==='points'){
  const expected=original.points.map(p=>algebraicPoint2(map(p.origin),linear(p.direction),p.parameter)).sort(compareAlgebraicPoints2);
  expected.forEach((p,i)=>assert.equal(compareAlgebraicPoints2(p,mapped.points[i]!),0));
 }
 const line=line2(point2(-2n,0n),point2(1n,0n));
 const forward=intersectLineCircle2(line,a),reverse=intersectLineCircle2(line2(line.origin,point2(line.direction.x.neg(),line.direction.y.neg())),a);
 forward.forEach((p,i)=>assert.equal(compareAlgebraicPoints2(p.point,reverse[reverse.length-1-i]!.point),0));
});

test('all 456 noncollinear lattice triples determine their unique rational circumcircles',()=>{
 let count=0;
 for(const a of grid)for(const b of grid)for(const c of grid){
  const determinant=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(determinant===0n)continue;
  const circle=circleThroughPoints2(point2(...a),point2(...b),point2(...c));
  const {numerator:nx,denominator:dx}=circle.center.x,{numerator:ny,denominator:dy}=circle.center.y,{numerator:nr,denominator:dr}=circle.radiusSquared;
  for(const p of [a,b,c]){
   const x=p[0]*dx-nx,y=p[1]*dy-ny;
   assert.equal((x*x*dy*dy+y*y*dx*dx)*dr,nr*dx*dx*dy*dy);
  }
  const reverse=circleThroughPoints2(point2(...c),point2(...b),point2(...a));
  assert.deepEqual(circle,reverse);count++;
 }
 assert.equal(count,456);
});
test('near tangencies retain or exclude distinct algebraic roots at exact rational offsets',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(80)),one=new Rational(1n),two=new Rational(2n),unit=circle2(point2(0n,0n),1n);
 assert.equal(intersectLineCircle2(line2(point2(0n,one.add(epsilon)),point2(1n,0n)),unit).length,0);
 const inside=intersectLineCircle2(line2(point2(0n,one.sub(epsilon)),point2(1n,0n)),unit);
 assert.equal(inside.length,2);assert.equal(inside[0]!.point.x.compare(inside[1]!.point.x),-1);
 assert.equal(intersectCircles2(unit,circle2(point2(two.add(epsilon),0n),1n)).kind,'none');
 const near=intersectCircles2(unit,circle2(point2(two.sub(epsilon),0n),1n));
 assert.equal(near.kind,'points');if(near.kind==='points'){
  assert.equal(near.points.length,2);assert.equal(compareAlgebraicPoints2(near.points[0]!,near.points[1]!),-1);
  near.points.forEach(p=>assert.equal(classifyAlgebraicPointToCircle2(p,unit),0));
 }
});
test('nonzero origins and unequal circle radii return independently known exact coordinates',()=>{
 const circle=circle2(point2(2n,3n),25n),hits=intersectLineCircle2(line2(point2(-1n,-1n),point2(3n,4n)),circle);
 assert.equal(hits.length,2);
 for(const [i,x,y,t] of [[0,-1n,-1n,0n],[1,5n,7n,2n]] as const){
  assert.equal(hits[i]!.point.x.compare(AlgebraicReal.fromRational(x)),0);
  assert.equal(hits[i]!.point.y.compare(AlgebraicReal.fromRational(y)),0);
  assert.equal(hits[i]!.parameter.compare(AlgebraicReal.fromRational(t)),0);
 }
 const common=intersectCircles2(circle2(point2(0n,0n),25n),circle2(point2(4n,0n),9n));assert.equal(common.kind,'points');
 if(common.kind==='points')for(const [i,y] of [[0,-3n],[1,3n]] as const){
  assert.equal(common.points[i]!.x.compare(AlgebraicReal.fromRational(4n)),0);
  assert.equal(common.points[i]!.y.compare(AlgebraicReal.fromRational(y)),0);
 }
});
