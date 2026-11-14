import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHalfEdges, compareDirections, point2, segment2} from '../dist/index.js';
const p = (x: number, y: number) => point2(BigInt(x), BigInt(y));
const line = (x: number, y: number, u: number, v: number) => segment2(p(x,y),p(u,v));
function check(input: ReturnType<typeof segment2>[]) {
  const a = buildHalfEdges(input);
  assert.equal(a.halfEdges.length, a.edges.length * 2);
  const seen = new Set<number>();
  a.boundaries.forEach((walk, boundary) => {
    walk.halfEdges.forEach((id, i) => {
      assert.ok(!seen.has(id)); seen.add(id);
      const h = a.halfEdges[id]!;
      assert.equal(h.boundary, boundary);
      assert.equal(a.halfEdges[h.twin]!.twin, id);
      assert.equal(a.halfEdges[h.next]!.previous, id);
      assert.equal(a.halfEdges[h.next]!.origin, h.target);
      assert.equal(h.next, walk.halfEdges[(i+1)%walk.halfEdges.length]);
      assert.ok(Object.isFrozen(h));
    });
  });
  assert.equal(seen.size, a.halfEdges.length);
  assert.equal(a.boundaries.reduce((n,w)=>n.add(w.twiceSignedArea),point2(0n,0n).x).sign(),0);
  return a;
}
test('exact direction order across axes, equal rays and large rational coordinates',()=>{
  const rays = [p(1,0),p(1,1),p(0,1),p(-1,1),p(-1,0),p(-1,-1),p(0,-1),p(1,-1)];
  rays.forEach((a,i)=>rays.forEach((b,j)=>assert.equal(Math.sign(compareDirections(a,b)),Math.sign(i-j))));
  assert.equal(compareDirections(p(1,1),p(2,2)),0);
  assert.ok(compareDirections(point2('9007199254740993','1/3'),point2('9007199254740992','1/3'))<0);
  assert.throws(()=>compareDirections(p(0,0),p(1,0)),RangeError);
});
test('square, bridges, isolated vertices and nested components preserve boundary components',()=>{
  const square=[line(0,0,2,0),line(2,0,2,2),line(2,2,0,2),line(0,2,0,0)];
  assert.deepEqual(check(square).boundaries.map(w=>w.twiceSignedArea.toString()).sort(),['-8','8']);
  assert.equal(check([line(0,0,1,0),line(1,0,2,0)]).boundaries[0]!.twiceSignedArea.sign(),0);
  assert.equal(check([line(0,0,0,0)]).boundaries.length,0);
  assert.equal(check([...square,line(0,0,-1,0)]).boundaries.length,2);
  assert.equal(check([...square,line(3,0,4,0),line(4,0,4,1),line(4,1,3,1),line(3,1,3,0)]).boundaries.length,4);
  assert.equal(check([line(0,0,4,0),line(4,0,4,4),line(4,4,0,4),line(0,4,0,0),line(1,1,2,1),line(2,1,2,2),line(2,2,1,2),line(1,2,1,1)]).boundaries.length,4);
  assert.equal(check([]).boundaries.length,0);
});
test('exhaustive 3x3 segment pairs retain twin/next permutations and closed walks',()=>{
  const pts=Array.from({length:9},(_,i)=>p(i%3,Math.floor(i/3)));
  const segments=pts.flatMap(a=>pts.map(b=>segment2(a,b)));
  for(const a of segments) for(const b of segments) check([a,b]);
});
