import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,segment2,line2,lineInterval2,circle2,circularArc2,fullCircleArc2,reverseCircularArc2,splitCurves2,splitSegments,algebraicCoordinates2,compareAlgebraicPoints2,pointOnLineInterval2,pointOnArc2,locatePointOnArc2,intersectLineIntervals2,intersectLineIntervalArc2,intersectArcs2,Polynomial,isolateRealRoots,AlgebraicReal} from '../dist/index.js';
import type {PlanarCurve2,CurveArrangement2,CurveEdge2,AlgebraicCoordinates2} from '../dist/index.js';
const same=(a:AlgebraicCoordinates2,b:AlgebraicCoordinates2)=>compareAlgebraicPoints2(a,b)===0;
const unit=circle2(point2(0n,0n),1n);
function contains(point:AlgebraicCoordinates2,curve:PlanarCurve2):boolean {
 switch(curve.kind){
  case 'point':return same(point,algebraicCoordinates2(curve.point.x,curve.point.y));
  case 'arc':return pointOnArc2(point,curve.arc);
  case 'line':return pointOnLineInterval2(point,curve.interval);
  case 'segment':{
   const s=curve.segment;
   if(s.start.x.equals(s.end.x)&&s.start.y.equals(s.end.y))return same(point,algebraicCoordinates2(s.start.x,s.start.y));
   return pointOnLineInterval2(point,lineInterval2(line2(s.start,point2(s.end.x.sub(s.start.x),s.end.y.sub(s.start.y))),0n,1n));
  }
 }
}
function verify(input:readonly PlanarCurve2[]):CurveArrangement2 {
 const result=splitCurves2(input);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.vertices)&&Object.isFrozen(result.edges));
 result.vertices.forEach((v,i)=>{
  if(i)assert.equal(compareAlgebraicPoints2(result.vertices[i-1]!.point,v.point),-1);
  assert.deepEqual(v.sources,input.flatMap((c,source)=>contains(v.point,c)?[source]:[]));
  assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.point)&&Object.isFrozen(v.sources));
 });
 result.edges.forEach(e=>{
  assert.ok(e.start<e.end);assert.deepEqual(e.sources,e.uses.map(u=>u.source));assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.uses));
  const a=result.vertices[e.start]!.point,b=result.vertices[e.end]!.point,geometry=e.kind==='arc'?e.arc:e.interval;
  assert.ok(same(a,geometry.start)&&same(b,geometry.end));
  e.sources.forEach(source=>{
   const original=input[source]!;assert.ok(contains(a,original)&&contains(b,original));
   if(e.kind==='arc'&&original.kind==='arc'){
    const overlap=intersectArcs2(e.arc,original.arc);assert.equal(overlap.kind,'overlap');
    if(overlap.kind==='overlap'){assert.equal(overlap.arcs.length,1);assert.equal(overlap.points.length,0);assert.ok(same(overlap.arcs[0]!.start,e.arc.start)&&same(overlap.arcs[0]!.end,e.arc.end));}
   }
  });
  result.vertices.forEach((v,i)=>{
   if(i===e.start||i===e.end)return;
   assert.equal(e.kind==='arc'?locatePointOnArc2(v.point,e.arc)==='interior':pointOnLineInterval2(v.point,e.interval),false);
  });
 });
 input.forEach((curve,source)=>{
  const V=result.vertices.filter(v=>v.sources.includes(source)).length,E=result.edges.filter(e=>e.sources.includes(source)).length;
  const point=curve.kind==='point'||curve.kind==='segment'&&curve.segment.start.x.equals(curve.segment.end.x)&&curve.segment.start.y.equals(curve.segment.end.y)||curve.kind==='line'&&curve.interval.startParameter.equals(curve.interval.endParameter)||curve.kind==='arc'&&!curve.arc.fullCircle&&same(curve.arc.start,curve.arc.end);
  if(point){assert.equal(V,1);assert.equal(E,0);}else assert.equal(E,curve.kind==='arc'&&curve.arc.fullCircle?V:V-1);
 });
 for(let i=0;i<result.edges.length;i++)for(let j=i+1;j<result.edges.length;j++){
  const a=result.edges[i]!,b=result.edges[j]!,allowed=[a.start,a.end].filter(id=>id===b.start||id===b.end).map(id=>result.vertices[id]!.point);
  let points:readonly AlgebraicCoordinates2[]=[];
  if(a.kind==='line'&&b.kind==='line'){
   const hit=intersectLineIntervals2(a.interval,b.interval);assert.notEqual(hit.kind,'overlap');if(hit.kind==='point')points=[hit.point];
  }else if(a.kind==='arc'&&b.kind==='arc'){
   const hit=intersectArcs2(a.arc,b.arc);assert.notEqual(hit.kind,'overlap');if(hit.kind==='points')points=hit.points;
  }else {
   const line=a.kind==='line'?a:b as Extract<CurveEdge2,{kind:'line'}>,arc=a.kind==='arc'?a:b as Extract<CurveEdge2,{kind:'arc'}>;
   points=intersectLineIntervalArc2(line.interval,arc.arc).map(h=>h.point);
  }
  points.forEach(p=>assert.ok(allowed.some(q=>same(p,q))));
 }
 return result;
}
function sameGeometry(a:CurveArrangement2,b:CurveArrangement2){
 assert.equal(a.vertices.length,b.vertices.length);assert.equal(a.edges.length,b.edges.length);
 a.vertices.forEach((v,i)=>assert.ok(same(v.point,b.vertices[i]!.point)));
 a.edges.forEach((e,i)=>{
  const f=b.edges[i]!;assert.equal(e.start,f.start);assert.equal(e.end,f.end);assert.equal(e.kind,f.kind);
  if(e.kind==='arc'&&f.kind==='arc'){assert.deepEqual(e.arc.circle,f.arc.circle);assert.equal(e.arc.direction,f.arc.direction);}
 });
}
test('mixed circle/chord noding shares algebraic crossings and retains oriented overlapping sources',()=>{
 const circle=circle2(point2(0n,0n),2n),sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!;
 const upper=circularArc2(circle,algebraicCoordinates2(sqrt2.neg(),0n),algebraicCoordinates2(sqrt2,0n),{direction:'cw'});
 const input:PlanarCurve2[]=[{kind:'arc',arc:fullCircleArc2(circle)},{kind:'segment',segment:segment2(point2(0n,-3n),point2(0n,3n))},{kind:'arc',arc:upper}];
 const result=verify(input);assert.equal(result.vertices.length,6);assert.equal(result.edges.length,7);
 assert.equal(result.vertices.filter(v=>v.sources.includes(0)&&v.sources.includes(1)).length,2);
 const doubled=result.edges.filter(e=>e.sources.includes(2));assert.equal(doubled.length,2);
 doubled.forEach(e=>assert.deepEqual(e.sources,[0,2]));
 const isolated=result.vertices.filter((_,i)=>!result.edges.some(e=>e.start===i||e.end===i)).map(v=>({kind:'point' as const,point:v.point}));
 sameGeometry(result,verify([...result.edges,...isolated]));
});
test('coincident circles, different full seams and reversed traversals merge complementary semicircles correctly',()=>{
 const seam=circularArc2(unit,point2(0n,1n),point2(0n,1n),{fullCircle:true,direction:'cw'});
 const input:PlanarCurve2[]=[{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:seam}];
 const result=verify(input);assert.equal(result.vertices.length,2);assert.equal(result.edges.length,2);
 result.edges.forEach(e=>{assert.deepEqual(e.sources,[0,1]);assert.equal(e.uses[0]!.direction,-e.uses[1]!.direction);assert.equal(e.kind,'arc');});
 const single=splitCurves2([input[0]!]);sameGeometry(result,single);
});
test('crossing, tangent and nested circles have exact shared vertex/edge counts',()=>{
 const crossing=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(1n,0n),1n))}]);
 assert.equal(crossing.vertices.length,6);assert.equal(crossing.edges.length,8);assert.equal(crossing.vertices.filter(v=>v.sources.length===2).length,2);
 const tangent=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(2n,0n),1n))}]);
 assert.equal(tangent.vertices.length,3);assert.equal(tangent.edges.length,4);assert.equal(tangent.vertices.filter(v=>v.sources.length===2).length,1);
 const nested=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),4n))}]);assert.equal(nested.vertices.length,4);assert.equal(nested.edges.length,4);
});
test('isolated algebraic points, point arcs and zero-length segments split every containing curve',()=>{
 const sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!,north=algebraicCoordinates2(0n,sqrt2);
 const input:PlanarCurve2[]=[{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),2n))},{kind:'point',point:north},{kind:'line',interval:lineInterval2(line2(point2(0n,0n),point2(0n,1n)),sqrt2,3n)},{kind:'segment',segment:segment2(point2(7n,7n),point2(7n,7n))},{kind:'arc',arc:circularArc2(unit,point2(0n,-1n),point2(0n,-1n))}];
 const result=verify(input);assert.equal(result.vertices.find(v=>same(v.point,north))!.sources.join(','),'0,1,2');
 assert.equal(result.vertices.find(v=>same(v.point,algebraicCoordinates2(7n,7n)))!.sources.join(','),'3');
 const arcs=result.edges.filter(e=>e.kind==='arc');assert.equal(arcs.length,3);
 assert.equal(result.edges.filter(e=>e.kind==='line').length,1);assert.equal(result.edges.some(e=>e.sources.includes(1)||e.sources.includes(3)||e.sources.includes(4)),false);
 assert.deepEqual(splitCurves2([]),{vertices:[],edges:[]});
});
test('geometry is invariant under input permutation and reversal; source uses reverse sign',()=>{
 const input:PlanarCurve2[]=[{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:circularArc2(unit,point2(1n,0n),point2(0n,-1n))},{kind:'segment',segment:segment2(point2(-2n,0n),point2(2n,0n))},{kind:'line',interval:lineInterval2(line2(point2(0n,0n),point2(0n,-2n)),-1n,1n)}];
 const result=verify(input),permuted=verify(input.slice().reverse());sameGeometry(result,permuted);
 result.edges.forEach((e,i)=>assert.deepEqual(e.sources,permuted.edges[i]!.sources.map(s=>input.length-1-s).sort((a,b)=>a-b)));
 const reversed=input.map((c):PlanarCurve2=>c.kind==='arc'?{kind:'arc',arc:reverseCircularArc2(c.arc)}:c.kind==='line'?{kind:'line',interval:lineInterval2(c.interval.line,c.interval.endParameter,c.interval.startParameter)}:c.kind==='segment'?{kind:'segment',segment:segment2(c.segment.end,c.segment.start)}:c);
 const reverse=verify(reversed);sameGeometry(result,reverse);result.edges.forEach((e,i)=>assert.deepEqual(e.uses.map(u=>({source:u.source,direction:-u.direction})),reverse.edges[i]!.uses));
});
test('all 6,561 rational segment pairs preserve baseline arrangement geometry and provenance',()=>{
 const points=[-1n,0n,1n].flatMap(x=>[-1n,0n,1n].map(y=>point2(x,y))),segments=points.flatMap(a=>points.map(b=>segment2(a,b)));let count=0;
 for(const a of segments)for(const b of segments){
  const expected=splitSegments([a,b]),actual=splitCurves2([{kind:'segment',segment:a},{kind:'segment',segment:b}]);
  assert.equal(actual.vertices.length,expected.vertices.length);assert.equal(actual.edges.length,expected.edges.length);
  actual.vertices.forEach((v,i)=>{const e=expected.vertices[i]!;assert.equal(v.point.x.compare(AlgebraicReal.fromRational(e.point.x)),0);assert.equal(v.point.y.compare(AlgebraicReal.fromRational(e.point.y)),0);assert.deepEqual(v.sources,e.sources);});
  actual.edges.forEach((e,i)=>{const f=expected.edges[i]!;assert.equal(e.kind,'line');assert.equal(e.start,f.start);assert.equal(e.end,f.end);assert.deepEqual(e.sources,f.sources);e.uses.forEach(use=>{const s=[a,b][use.source]!,direction=s.start.x.compare(s.end.x)||s.start.y.compare(s.end.y);assert.equal(use.direction,direction<0?1:-1);});});count++;
 }
 assert.equal(count,6561);
});

test('circle/line ranks agree with independent secant/tangent counts and circle-extremum placement',()=>{
 for(const y of [-2n,-1n,0n,1n,2n]){
  const r=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'segment',segment:segment2(point2(-2n,y),point2(2n,y))}]);
  assert.equal(r.vertices.length,y===-1n||y===1n?5:4);assert.equal(r.edges.length,y===-2n||y===2n?3:5);
 }
 for(const x of [-2n,-1n,0n,1n,2n]){
  const r=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'segment',segment:segment2(point2(x,-2n),point2(x,2n))}]);
  assert.equal(r.vertices.length,x===0n?6:4);assert.equal(r.edges.length,x===0n?7:x===-1n||x===1n?4:3);
 }
 const tangent=verify([{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),2n))},{kind:'segment',segment:segment2(point2(-3n,5n),point2(5n,-3n))}]);
 assert.equal(tangent.vertices.length,5);assert.equal(tangent.edges.length,5);
});
test('near tangent circles retain distinct exact crossings or a genuine gap without tolerance welding',()=>{
 const epsilon=AlgebraicReal.fromRational('1/1'+'0'.repeat(30)).rational!,two=AlgebraicReal.fromRational(2n).rational!;
 const overlap=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(two.sub(epsilon),0n),1n))}]);
 assert.equal(overlap.vertices.length,6);assert.equal(overlap.edges.length,8);assert.equal(overlap.vertices.filter(v=>v.sources.length===2).length,2);
 const separate=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(two.add(epsilon),0n),1n))}]);
 assert.equal(separate.vertices.length,4);assert.equal(separate.edges.length,4);assert.equal(separate.vertices.filter(v=>v.sources.length===2).length,0);
});

test('equal coordinates with different defining polynomials weld by value, and input snapshots stay immutable',()=>{
 const first=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!,second=isolateRealRoots(new Polynomial([-2n,0n,1n]).mul(new Polynomial([-3n,0n,1n])))[2]!;
 const input:PlanarCurve2[]=[{kind:'point',point:algebraicCoordinates2(first,0n)},{kind:'point',point:algebraicCoordinates2(second,0n)},{kind:'segment',segment:segment2(point2(-3n,0n),point2(3n,0n))}];
 const result=verify(input);assert.equal(result.vertices.length,3);assert.equal(result.edges.length,2);assert.deepEqual(result.vertices[1]!.sources,[0,1,2]);
 sameGeometry(result,verify(input.slice().reverse()));
 input.length=0;assert.equal(result.vertices.length,3);assert.equal(result.edges.length,2);
 result.edges.forEach(e=>assert.ok(Object.isFrozen(e.sources)&&e.uses.every(Object.isFrozen)));
});
