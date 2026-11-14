import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,circle2,circularArc2,fullCircleArc2,reverseCircularArc2,locatePointOnArc2,pointOnArc2,comparePointsAroundCircle2,comparePointsOnArc2,splitCircularArc2,intersectArcs2,intersectLineArc2,intersectSegmentArc2,line2,segment2,intersectCircles2,compareAlgebraicPoints2,algebraicCoordinates2,AlgebraicReal,Polynomial,Rational,isolateRealRoots,classifyAlgebraicPointToCircle2} from '../dist/index.js';
import type {CircularArc2,ArcIntersection2,Point2,AlgebraicCoordinates2} from '../dist/index.js';
const unit=circle2(point2(0n,0n),1n);
// Known CCW order, with an independent sample strictly between each adjacent mark.
const samples=[point2(1n,0n),point2('4/5','3/5'),point2('3/5','4/5'),point2('5/13','12/13'),point2(0n,1n),point2('-5/13','12/13'),point2('-3/5','4/5'),point2('-4/5','3/5'),point2(-1n,0n),point2('-4/5','-3/5'),point2('-3/5','-4/5'),point2('-5/13','-12/13'),point2(0n,-1n),point2('5/13','-12/13'),point2('3/5','-4/5'),point2('4/5','-3/5')];
const marks=samples.filter((_,i)=>i%2===0);
const asAlgebraic=(p:Point2)=>algebraicCoordinates2(p.x,p.y);
const same=(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2)=>compareAlgebraicPoints2(a,b)===0;
function oracle(start:number,end:number,direction:'ccw'|'cw',index:number,full=false){
 if(full)return true;
 const distance=direction==='ccw'?(index-start+16)%16:(start-index+16)%16;
 const length=direction==='ccw'?(end-start+16)%16:(start-end+16)%16;
 return distance<=length;
}
function resultContains(result:ArcIntersection2,p:Point2):boolean {
 if(result.kind==='none')return false;
 const q=asAlgebraic(p);
 return result.points.some(v=>same(v,q))||result.kind==='overlap'&&result.arcs.some(arc=>pointOnArc2(p,arc));
}
test('all 128 oriented rational endpoint arcs match independent cyclic-index membership and traversal order',()=>{
 let count=0;
 for(let start=0;start<8;start++)for(let end=0;end<8;end++)for(const direction of ['ccw','cw'] as const){
  const arc=circularArc2(unit,marks[start]!,marks[end]!,{direction});
  const selected:number[]=[];
  samples.forEach((p,index)=>{
   const inside=oracle(start*2,end*2,direction,index);
   assert.equal(pointOnArc2(p,arc),inside);
   assert.equal(locatePointOnArc2(p,arc),inside?(index===start*2||index===end*2?'endpoint':'interior'):'outside');
   if(inside)selected.push(index);
  });
  selected.sort((a,b)=>comparePointsOnArc2(arc,samples[a]!,samples[b]!));
  const distance=(i:number)=>direction==='ccw'?(i-start*2+16)%16:(start*2-i+16)%16;
  assert.deepEqual(selected,selected.slice().sort((a,b)=>distance(a)-distance(b)));
  const reversed=reverseCircularArc2(arc);samples.forEach(p=>assert.equal(pointOnArc2(p,reversed),pointOnArc2(p,arc)));
  assert.equal(pointOnArc2(point2(0n,0n),arc),false);assert.ok(Object.isFrozen(arc)&&Object.isFrozen(arc.start));count++;
 }
 assert.equal(count,128);
 for(let i=0;i<16;i++)for(let j=0;j<16;j++)assert.equal(comparePointsAroundCircle2(unit,samples[i]!,samples[j]!),i<j?-1:i>j?1:0);
});
test('20,736 coincident-support arc pairs match independent closed cyclic set intersections',()=>{
 const fixtures:{arc:CircularArc2;start:number;end:number;direction:'ccw'|'cw';full:boolean}[]=[];
 for(let start=0;start<8;start++)for(let end=0;end<8;end++)for(const direction of ['ccw','cw'] as const)fixtures.push({arc:circularArc2(unit,marks[start]!,marks[end]!,{direction}),start:start*2,end:end*2,direction,full:false});
 for(let start=0;start<8;start++)for(const direction of ['ccw','cw'] as const)fixtures.push({arc:circularArc2(unit,marks[start]!,marks[start]!,{direction,fullCircle:true}),start:start*2,end:start*2,direction,full:true});
 let count=0;
 for(const a of fixtures)for(const b of fixtures){
  const result=intersectArcs2(a.arc,b.arc);
  samples.forEach((p,index)=>assert.equal(resultContains(result,p),oracle(a.start,a.end,a.direction,index,a.full)&&oracle(b.start,b.end,b.direction,index,b.full)));
  if(result.kind==='overlap'){
   assert.ok(result.arcs.length<=2);
   result.arcs.forEach(arc=>{
    assert.equal(arc.direction,a.direction);assert.equal(pointOnArc2(arc.start,a.arc)&&pointOnArc2(arc.end,a.arc),true);
    assert.equal(pointOnArc2(arc.start,b.arc)&&pointOnArc2(arc.end,b.arc),true);
   });
   result.points.forEach(p=>assert.ok(result.arcs.every(arc=>!pointOnArc2(p,arc))));
  }
  assert.ok(Object.isFrozen(result));count++;
 }
 assert.equal(count,20736);
});
test('overlaps preserve two components, isolated endpoint contacts and whole circles',()=>{
 const east=point2(1n,0n),north=point2(0n,1n),west=point2(-1n,0n),south=point2(0n,-1n);
 const disconnected=intersectArcs2(circularArc2(unit,east,south),circularArc2(unit,west,north));
 assert.equal(disconnected.kind,'overlap');if(disconnected.kind==='overlap'){assert.equal(disconnected.arcs.length,2);assert.equal(disconnected.points.length,0);}
 const isolated=intersectArcs2(circularArc2(unit,east,south),circularArc2(unit,west,east));
 assert.equal(isolated.kind,'overlap');if(isolated.kind==='overlap'){assert.equal(isolated.arcs.length,1);assert.equal(isolated.points.length,1);assert.ok(same(isolated.points[0]!,asAlgebraic(east)));}
 const endpoints=intersectArcs2(circularArc2(unit,east,west),circularArc2(unit,west,east));assert.equal(endpoints.kind,'points');if(endpoints.kind==='points')assert.equal(endpoints.points.length,2);
 const full=fullCircleArc2(unit),reverse=fullCircleArc2(unit,'cw'),whole=intersectArcs2(full,reverse);assert.equal(whole.kind,'overlap');if(whole.kind==='overlap')assert.equal(whole.arcs[0]!.fullCircle,true);
 samples.forEach(p=>assert.equal(locatePointOnArc2(p,full),'interior'));
 const point=circularArc2(unit,east,east);assert.equal(point.fullCircle,false);assert.equal(pointOnArc2(north,point),false);
});
test('subdivision retains oriented chains, coverage and shared endpoints without duplicate point fragments',()=>{
 const inputs=[fullCircleArc2(unit),fullCircleArc2(unit,'cw'),circularArc2(unit,marks[6]!,marks[2]!),circularArc2(unit,marks[2]!,marks[6]!,{direction:'cw'})];
 for(const arc of inputs){
  const cuts=marks.filter(p=>pointOnArc2(p,arc)),pieces=splitCircularArc2(arc,[...cuts,...cuts,arc.start,arc.end]);
  assert.ok(pieces.length>1);assert.ok(same(pieces[0]!.start,arc.start)&&same(pieces[pieces.length-1]!.end,arc.end));
  pieces.forEach((p,i)=>{assert.equal(p.fullCircle,false);assert.ok(!same(p.start,p.end));assert.equal(p.direction,arc.direction);if(i)assert.ok(same(pieces[i-1]!.end,p.start));});
  samples.forEach(p=>{
   assert.equal(pieces.some(piece=>pointOnArc2(p,piece)),pointOnArc2(p,arc));
   assert.ok(pieces.filter(piece=>locatePointOnArc2(p,piece)==='interior').length<=1);
  });
  assert.ok(Object.isFrozen(pieces));
 }
 const point=circularArc2(unit,marks[0]!,marks[0]!);assert.equal(splitCircularArc2(point,[marks[0]!]).length,1);
 assert.equal(splitCircularArc2(fullCircleArc2(unit),[])[0]!.fullCircle,true);
});
test('algebraic endpoints and independent quadratic coordinates remain exact; distinct-circle hits filter by arc membership',()=>{
 const other=circle2(point2(1n,0n),1n),support=intersectCircles2(unit,other);assert.equal(support.kind,'points');if(support.kind!=='points')return;
 const lower=support.points[0]!.y.sign()<0?support.points[0]!:support.points[1]!,upper=support.points.find(p=>p.y.sign()>0)!;
 const minor=circularArc2(unit,lower,upper),major=circularArc2(unit,upper,lower);
 assert.equal(pointOnArc2(point2(1n,0n),minor),true);assert.equal(pointOnArc2(point2(-1n,0n),minor),false);assert.equal(pointOnArc2(point2(-1n,0n),major),true);
 const hits=intersectLineArc2(line2(point2(0n,0n),point2(1n,0n)),minor);assert.equal(hits.length,1);assert.equal(hits[0]!.point.x.compare(AlgebraicReal.fromRational(1n)),0);
 assert.equal(intersectSegmentArc2(segment2(point2(-2n,0n),point2(0n,0n)),minor).length,0);
 const firstQuarter=circularArc2(unit,point2(1n,0n),point2(0n,1n)),secondUpper=circularArc2(other,point2(2n,0n),point2(0n,0n));
 const result=intersectArcs2(firstQuarter,secondUpper);assert.equal(result.kind,'points');if(result.kind==='points'){assert.equal(result.points.length,1);assert.ok(same(result.points[0]!,upper));}
 const radiusTwo=circle2(point2(0n,0n),2n),sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!,sqrt6=isolateRealRoots(new Polynomial([-6n,0n,1n]))[1]!;
 const independent=algebraicCoordinates2(sqrt2.affine('1/2'),sqrt6.affine('1/2'));
 assert.equal(classifyAlgebraicPointToCircle2(independent,radiusTwo),0);
 assert.equal(classifyAlgebraicPointToCircle2(independent,unit),1);
 assert.equal(classifyAlgebraicPointToCircle2(independent,circle2(point2(0n,0n),3n)),-1);
 assert.equal(classifyAlgebraicPointToCircle2({...upper},unit),0);
 const quarter=circularArc2(radiusTwo,algebraicCoordinates2(sqrt2,0n),algebraicCoordinates2(0n,sqrt2));assert.equal(locatePointOnArc2(independent,quarter),'interior');
});
test('point circles, near-seam rational points, snapshots and invalid input retain precise set conventions',()=>{
 const origin=point2(2n,3n),pointCircle=circle2(origin,0n),point=fullCircleArc2(pointCircle);
 assert.equal(point.fullCircle,false);assert.equal(locatePointOnArc2(origin,point),'endpoint');assert.equal(intersectArcs2(point,point).kind,'points');
 const t=Rational.parse('1/1'+'0'.repeat(40)),one=new Rational(1n),two=new Rational(2n),denominator=one.add(t.mul(t));
 const near=point2(one.sub(t.mul(t)).div(denominator),two.mul(t).div(denominator));
 const east=point2(1n,0n),north=point2(0n,1n),quarter=circularArc2(unit,east,north),pointArc=circularArc2(unit,east,east);
 assert.equal(comparePointsAroundCircle2(unit,east,near),-1);assert.equal(locatePointOnArc2(near,quarter),'interior');assert.equal(pointOnArc2(near,pointArc),false);
 assert.throws(()=>circularArc2(unit,east,point2(0n,0n)),RangeError);assert.throws(()=>circularArc2(unit,east,north,{fullCircle:true}),RangeError);
 assert.throws(()=>circularArc2(unit,east,north,{direction:'bad' as 'ccw'}),RangeError);
 assert.throws(()=>comparePointsAroundCircle2(unit,east,point2(0n,0n)),RangeError);assert.throws(()=>comparePointsOnArc2(quarter,east,point2(-1n,0n)),RangeError);
 assert.throws(()=>splitCircularArc2(quarter,[point2(-1n,0n)]),RangeError);
 const mutable={x:AlgebraicReal.fromRational(1n),y:AlgebraicReal.fromRational(0n)},snapshot=circularArc2(unit,mutable,north);mutable.x=AlgebraicReal.fromRational(-1n);assert.ok(same(snapshot.start,asAlgebraic(east)));
 // Extra fields on a valid general coordinate object must not forge correlation.
 const unrelated={...algebraicCoordinates2(0n,0n),origin:east,direction:point2(0n,0n),parameter:AlgebraicReal.fromRational(0n)};
 assert.equal(classifyAlgebraicPointToCircle2(unrelated,unit),-1);
});
test('1,024 different-circle arc pairs select the independently known upper/lower intersection branches',()=>{
 const secondCircle=circle2(point2(1n,0n),1n),firstMarks=[point2(1n,0n),point2(0n,1n),point2(-1n,0n),point2(0n,-1n)],secondMarks=[point2(2n,0n),point2(1n,1n),point2(0n,0n),point2(1n,-1n)];
 const support=intersectCircles2(unit,secondCircle);assert.equal(support.kind,'points');if(support.kind!=='points')return;
 const upper=support.points.find(p=>p.y.sign()>0)!,lower=support.points.find(p=>p.y.sign()<0)!;
 const fixtures=(circle:typeof unit,points:Point2[])=>points.flatMap((a,s)=>points.flatMap((b,e)=>(['ccw','cw'] as const).map(d=>({arc:circularArc2(circle,a,b,{direction:d}),s:2*s,e:2*e,d}))));
 const contains=(a:{s:number;e:number;d:'ccw'|'cw'},index:number)=>a.d==='ccw'?(index-a.s+8)%8<=(a.e-a.s+8)%8:(a.s-index+8)%8<=(a.s-a.e+8)%8;
 let count=0;
 for(const a of fixtures(unit,firstMarks))for(const b of fixtures(secondCircle,secondMarks)){
  const result=intersectArcs2(a.arc,b.arc),expected=[...(contains(a,1)&&contains(b,3)?[upper]:[]),...(contains(a,7)&&contains(b,5)?[lower]:[])];
  assert.equal(result.kind,expected.length?'points':'none');
  if(result.kind==='points'){assert.equal(result.points.length,expected.length);expected.forEach(p=>assert.ok(result.points.some(q=>same(p,q))));}
  count++;
 }
 assert.equal(count,1024);
 const quarter=circularArc2(unit,firstMarks[0]!,firstMarks[1]!);
 const tangentCircle=circle2(point2(2n,0n),1n),touch=circularArc2(tangentCircle,point2(1n,0n),point2(2n,1n),{direction:'cw'});
 assert.equal(intersectArcs2(quarter,touch).kind,'points');
 assert.equal(intersectArcs2(quarter,fullCircleArc2(circle2(point2(1n,0n),0n))).kind,'points');
 assert.equal(intersectArcs2(quarter,fullCircleArc2(circle2(point2(0n,0n),0n))).kind,'none');
});
