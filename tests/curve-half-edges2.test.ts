import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,segment2,circle2,circularArc2,fullCircleArc2,buildCurveHalfEdges2,buildHalfEdges,AlgebraicReal,Rational,compareAlgebraicPoints2} from '../dist/index.js';
import type {PlanarCurve2,CurveHalfEdgeArrangement2,Point2} from '../dist/index.js';
const unit=circle2(point2(0n,0n),1n),q=(n:bigint|string)=>AlgebraicReal.fromRational(n);
function verify(input:readonly PlanarCurve2[],checkTangents=false):CurveHalfEdgeArrangement2 {
 const a=buildCurveHalfEdges2(input),seen=new Set<number>();assert.equal(a.halfEdges.length,2*a.edges.length);
 a.outgoing.forEach((ids,vertex)=>{
  ids.forEach(id=>{assert.equal(a.halfEdges[id]!.origin,vertex);assert.ok(!seen.has(id));seen.add(id);});
  assert.ok(Object.isFrozen(ids));
  for(let i=1;i<ids.length;i++){
   const u=a.halfEdges[ids[i-1]!]!.germ,v=a.halfEdges[ids[i]!]!.germ;
   const half=(t:typeof u.tangent)=>t.y.sign()<0||t.y.sign()===0&&t.x.sign()<0?1:0;
   const hu=half(u.tangent),hv=half(v.tangent);assert.ok(hu<=hv);
   if(checkTangents&&hu===hv){
    const cross=u.tangent.x.mul(v.tangent.y).sub(u.tangent.y.mul(v.tangent.x)).sign();assert.ok(cross>=0);
    if(cross===0){
     if(u.curvatureSign!==v.curvatureSign)assert.ok(u.curvatureSign<v.curvatureSign);
     else {assert.notEqual(u.curvatureSign,0);const order=u.radiusSquared!.compare(v.radiusSquared!);assert.ok(-u.curvatureSign*order<0);}
    }
   }
  }
 });
 assert.equal(seen.size,a.halfEdges.length);
 a.halfEdges.forEach((h,id)=>{
  const twin=a.halfEdges[h.twin]!,next=a.halfEdges[h.next]!,previous=a.halfEdges[h.previous]!;
  assert.equal(twin.twin,id);assert.equal(twin.origin,h.target);assert.equal(twin.target,h.origin);assert.equal(twin.edge,h.edge);
  assert.equal(next.previous,id);assert.equal(previous.next,id);assert.equal(next.origin,h.target);
  assert.equal(h.germ.curvatureSign,-twin.germ.curvatureSign||0);assert.equal(h.germ.radiusSquared?.toString(),twin.germ.radiusSquared?.toString());
  const around=a.outgoing[h.target]!,position=around.indexOf(h.twin);assert.equal(h.next,around[(position+around.length-1)%around.length]);
  if(checkTangents){
   const p=a.vertices[h.origin]!.point,e=a.edges[h.edge]!;
   if(e.kind==='line'){
    const d=e.interval.line.direction,side=h.origin===e.start?1n:-1n;
    assert.equal(h.germ.tangent.x.compare(AlgebraicReal.fromRational(d.x.mul(new Rational(side)))),0);
    assert.equal(h.germ.tangent.y.compare(AlgebraicReal.fromRational(d.y.mul(new Rational(side)))),0);
   }else {
    const rx=p.x.affine(1n,e.arc.circle.center.x.neg()),ry=p.y.affine(1n,e.arc.circle.center.y.neg()),t=h.germ.tangent;
    assert.equal(t.x.mul(rx).add(t.y.mul(ry)).sign(),0);
    assert.equal(t.x.mul(t.x).add(t.y.mul(t.y)).compare(AlgebraicReal.fromRational(e.arc.circle.radiusSquared)),0);
   }
  }
  assert.ok(Object.isFrozen(h)&&Object.isFrozen(h.germ)&&Object.isFrozen(h.germ.tangent));
 });
 const visited=new Set<number>();
 a.boundaries.forEach((walk,boundary)=>{
  assert.ok(walk.halfEdges.length>0&&Object.isFrozen(walk)&&Object.isFrozen(walk.halfEdges));
  walk.halfEdges.forEach((id,i)=>{assert.ok(!visited.has(id));visited.add(id);assert.equal(a.halfEdges[id]!.boundary,boundary);assert.equal(a.halfEdges[id]!.next,walk.halfEdges[(i+1)%walk.halfEdges.length]);});
 });
 assert.equal(visited.size,a.halfEdges.length);
 // Independent planar Euler count for active graph components. Isolated points
 // have no boundary orbit and must not be counted as edge-bearing components.
 const reached=new Set<number>();let C=0;
 a.outgoing.forEach((ids,v)=>{
  if(!ids.length||reached.has(v))return;C++;
  const pending=[v];reached.add(v);
  while(pending.length){const u=pending.pop()!;for(const id of a.outgoing[u]!){const w=a.halfEdges[id]!.target;if(!reached.has(w)){reached.add(w);pending.push(w);}}}
 });
 assert.equal(a.boundaries.length,a.edges.length-reached.size+2*C);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.halfEdges)&&Object.isFrozen(a.outgoing)&&Object.isFrozen(a.boundaries));return a;
}
test('circles, chords and algebraic crossings produce exact twins and planar boundary walks',()=>{
 const circle=verify([{kind:'arc',arc:fullCircleArc2(unit)}],true);assert.equal(circle.boundaries.length,2);assert.deepEqual(circle.boundaries.map(b=>b.halfEdges.length),[2,2]);
 circle.boundaries.forEach(b=>assert.equal(new Set(b.halfEdges.map(id=>circle.halfEdges[id]!.germ.curvatureSign)).size,1));
 const chord=verify([{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),2n))},{kind:'segment',segment:segment2(point2(0n,-3n),point2(0n,3n))}],true);assert.equal(chord.boundaries.length,3);
 const crossing=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(1n,0n),1n))}],true);assert.equal(crossing.boundaries.length,4);
});
function fan(rotated:boolean,reflected=false):PlanarCurve2[]{
 const map=(p:Point2)=>{const v=rotated?point2(p.x.mul(Rational.parse('3/5')).sub(p.y.mul(Rational.parse('4/5'))),p.x.mul(Rational.parse('4/5')).add(p.y.mul(Rational.parse('3/5')))):p;return reflected?point2(v.x,v.y.neg()):v;};
 const arc=(r:bigint,sign:1|-1)=>circularArc2(circle2(map(point2(0n,r*BigInt(sign))),r*r),map(point2(0n,0n)),map(point2(r,r*BigInt(sign))),{direction:sign*(reflected?-1:1)===1?'ccw':'cw'});
 return [{kind:'arc',arc:arc(1n,1)},{kind:'segment',segment:segment2(map(point2(0n,0n)),map(point2(1n,0n)))},{kind:'arc',arc:arc(2n,-1)},{kind:'arc',arc:arc(2n,1)},{kind:'arc',arc:arc(1n,-1)}];
}
test('coincident outgoing tangent rays are ordered by negative/zero/positive exact curvature',()=>{
 for(const rotated of [false,true])for(const reflected of [false,true]){
  const a=verify(fan(rotated,reflected),true),origin=a.vertices.findIndex(v=>v.point.x.compare(q(0n))===0&&v.point.y.compare(q(0n))===0);
  assert.deepEqual(a.outgoing[origin]!.map(id=>a.edges[a.halfEdges[id]!.edge]!.sources[0]),reflected?[0,3,1,2,4]:[4,2,1,3,0]);
  assert.equal(a.boundaries.length,1);assert.equal(a.boundaries[0]!.halfEdges.length,2*a.edges.length);
 }
});
test('external/internal circle contacts and line tangencies preserve distinct planar sectors',()=>{
 for(const [center,radius,order] of [[point2(2n,0n),1n,[1,0,0,1]],[point2('1/2',0n),'1/4',[0,1,1,0]]] as const){
  const a=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(center,radius))}],true);
  assert.equal(a.boundaries.length,3);assert.deepEqual(a.boundaries.map(b=>b.halfEdges.length).sort((x,y)=>x-y),[2,2,4]);
  const contact=a.vertices.findIndex(v=>v.point.x.equals(q(1n))&&v.point.y.equals(q(0n)));assert.deepEqual(a.outgoing[contact]!.map(id=>a.edges[a.halfEdges[id]!.edge]!.sources[0]),order);
  a.boundaries.forEach(w=>{
   const labels=w.halfEdges.map(id=>({source:a.edges[a.halfEdges[id]!.edge]!.sources[0]!,sign:a.halfEdges[id]!.germ.curvatureSign})),sources=new Set(labels.map(x=>x.source));
   if(center.x.equals(new Rational(2n)))labels.forEach(x=>assert.equal(x.sign,sources.size===1?1:-1));
   else labels.forEach(x=>assert.equal(x.sign,sources.size===1?(x.source===0?-1:1):(x.source===0?1:-1)));
  });
 }
 const line=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'segment',segment:segment2(point2(-2n,1n),point2(2n,1n))}],true);assert.equal(line.boundaries.length,2);
 const diagonal=verify([{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),2n))},{kind:'segment',segment:segment2(point2(-3n,5n),point2(5n,-3n))}],true);assert.equal(diagonal.boundaries.length,2);
 const endpoint=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'segment',segment:segment2(point2(-2n,1n),point2(0n,1n))}],true);
 for(const a of [line,diagonal,endpoint])a.boundaries.forEach(w=>{
  const hasLine=w.halfEdges.some(id=>a.edges[a.halfEdges[id]!.edge]!.kind==='line');
  w.halfEdges.filter(id=>a.edges[a.halfEdges[id]!.edge]!.kind==='arc').forEach(id=>assert.equal(a.halfEdges[id]!.germ.curvatureSign,hasLine?-1:1));
 });
 const bouquet=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2('1/2',0n),'1/4'))},{kind:'arc',arc:fullCircleArc2(circle2(point2(2n,0n),1n))}],true);assert.equal(bouquet.boundaries.length,4);
});
test('disconnected components, isolated points and true near-contact geometry remain distinct',()=>{
 const nested=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),4n))},{kind:'point',point:point2(0n,0n)}]);assert.equal(nested.boundaries.length,4);assert.equal(nested.outgoing.find(ids=>!ids.length)?.length,0);
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),two=new Rational(2n);
 const near=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(two.sub(epsilon),0n),1n))}]);assert.equal(near.boundaries.length,4);assert.equal(near.vertices.filter(v=>v.sources.length===2).length,2);
 const gap=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(two.add(epsilon),0n),1n))}]);assert.equal(gap.boundaries.length,4);assert.equal(gap.vertices.filter(v=>v.sources.length===2).length,0);
 assert.deepEqual(verify([{kind:'point',point:point2(0n,0n)}]).boundaries,[]);assert.equal(verify([]).halfEdges.length,0);
});
test('seeded mixed circle/line graphs satisfy independent planar Euler and complete orbit invariants',()=>{
 let seed=87329;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<50;trial++){
  const input:PlanarCurve2[]=[];
  for(let i=0;i<3;i++)input.push({kind:'arc',arc:fullCircleArc2(circle2(point2(BigInt(next()%5)-2n,BigInt(next()%5)-2n),[0n,1n,2n,4n][next()%4]!))});
  for(let i=0;i<2;i++)input.push({kind:'segment',segment:segment2(point2(BigInt(next()%7)-3n,BigInt(next()%7)-3n),point2(BigInt(next()%7)-3n,BigInt(next()%7)-3n))});
  const a=verify(input),b=verify(input.slice().reverse());
  assert.equal(a.vertices.length,b.vertices.length);assert.equal(a.edges.length,b.edges.length);assert.deepEqual(a.outgoing,b.outgoing);
  assert.deepEqual(a.halfEdges.map(h=>[h.origin,h.target,h.edge,h.twin,h.next,h.previous,h.boundary]),b.halfEdges.map(h=>[h.origin,h.target,h.edge,h.twin,h.next,h.previous,h.boundary]));
  a.vertices.forEach((v,i)=>assert.equal(compareAlgebraicPoints2(v.point,b.vertices[i]!.point),0));
 }
});
test('all 6,561 rational segment pairs reproduce the existing straight-edge rotation and boundary permutations',()=>{
 const points=[-1n,0n,1n].flatMap(x=>[-1n,0n,1n].map(y=>point2(x,y))),segments=points.flatMap(a=>points.map(b=>segment2(a,b)));let count=0;
 for(const a of segments)for(const b of segments){
  const expected=buildHalfEdges([a,b]),actual=buildCurveHalfEdges2([{kind:'segment',segment:a},{kind:'segment',segment:b}]);
  assert.deepEqual(actual.outgoing,expected.outgoing);
  assert.deepEqual(actual.halfEdges.map(({germ,...h})=>h),expected.halfEdges);
  assert.deepEqual(actual.boundaries.map(w=>w.halfEdges),expected.boundaries.map(w=>w.halfEdges));count++;
 }
 assert.equal(count,6561);
});

test('internally tangent circles with almost equal radii keep their exact signed-curvature order',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),r=new Rational(1n).sub(epsilon);
 const a=verify([{kind:'arc',arc:fullCircleArc2(unit)},{kind:'arc',arc:fullCircleArc2(circle2(point2(epsilon,0n),r.mul(r)))}],true);
 assert.equal(a.vertices.length,3);assert.equal(a.boundaries.length,3);
 const contact=a.vertices.findIndex(v=>v.point.x.equals(q(1n))&&v.point.y.equals(q(0n)));
 assert.deepEqual(a.outgoing[contact]!.map(id=>a.edges[a.halfEdges[id]!.edge]!.sources[0]),[0,1,1,0]);
});
