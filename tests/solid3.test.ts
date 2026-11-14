import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSolid3,point3,point2,triangle3,extrudePolygon,Rational} from '../dist/index.js';
import type {Triangle3,TriangleMesh3} from '../dist/index.js';
const faces=(m:TriangleMesh3)=>m.triangles.map(t=>triangle3(m.vertices[t[0]]!,m.vertices[t[1]]!,m.vertices[t[2]]!));
const reverse=(ts:readonly Triangle3[])=>ts.map(t=>triangle3(t[0],t[2],t[1]));
function box(lo:bigint,hi:bigint){
 return faces(extrudePolygon([[point2(lo,lo),point2(hi,lo),point2(hi,hi),point2(lo,hi)]],hi-lo,{baseZ:lo}));
}
test('solid queries match independent box inequalities on a rational grid including faces, edges and vertices',()=>{
 const s=prepareSolid3(box(0n,2n));
 assert.equal(s.volume.toString(),'8');assert.equal(s.shells[0]!.depth,0);
 let count=0;
 for(let x=-1n;x<=5n;x++)for(let y=-1n;y<=5n;y++)for(let z=-1n;z<=5n;z++){
  const coords=[x,y,z];
  const expected=coords.some(v=>v<0n||v>4n)?'outside':coords.some(v=>v===0n||v===4n)?'boundary':'inside';
  assert.equal(s.locate(point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n))),expected);count++;
 }
 assert.equal(count,343);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.shells));
 // The first ray is parallel to cube faces; later ones can hit shared diagonals.
 assert.equal(s.locate(point3(1n,1n,1n)),'inside');
});
test('nested cavities, material islands and separate components have alternating orientation and exact volume',()=>{
 const ts=[...box(0n,6n),...reverse(box(1n,5n)),...box(2n,4n),...box(8n,9n)];
 const s=prepareSolid3(ts);
 assert.deepEqual(s.shells.map(x=>x.depth),[0,1,2,0]);
 assert.equal(s.volume.toString(),'161');
 for(const [p,expected] of [[point3('1/2','1/2','1/2'),'inside'],[point3('3/2','3/2','3/2'),'outside'],[point3(3n,3n,3n),'inside'],[point3('17/2','17/2','17/2'),'inside'],[point3(7n,7n,7n),'outside'],[point3(1n,3n,3n),'boundary']] as const)assert.equal(s.locate(p),expected);
 assert.throws(()=>prepareSolid3(reverse(box(0n,6n))),/orientation/);
 assert.throws(()=>prepareSolid3([...box(0n,6n),...box(1n,5n)]),/orientation/);
 assert.throws(()=>prepareSolid3([...box(0n,6n),...reverse(box(1n,5n)),...reverse(box(2n,4n))]),/orientation/);
});
test('tetrahedron location matches independent barycentric inequalities, invariant under oblique rational affine maps',()=>{
 const a=point3(0n,0n,0n),b=point3(1n,0n,0n),c=point3(0n,1n,0n),d=point3(0n,0n,1n);
 const ts=[triangle3(a,c,b),triangle3(a,b,d),triangle3(a,d,c),triangle3(b,c,d)];
 const huge=Rational.parse('1'+'0'.repeat(80)),tiny=Rational.parse('1/1'+'0'.repeat(90));
 const transform=(p:ReturnType<typeof point3>)=>point3(huge.add(p.x.add(p.y).mul(tiny)),p.y.add(p.z),p.z);
 const s=prepareSolid3(ts),oblique=prepareSolid3(ts.map(t=>triangle3(...t.map(transform) as [typeof a,typeof a,typeof a])));
 for(let x=-1n;x<=5n;x++)for(let y=-1n;y<=5n;y++)for(let z=-1n;z<=5n;z++){
  const p=point3(new Rational(x,4n),new Rational(y,4n),new Rational(z,4n));
  const expected=x<0n||y<0n||z<0n||x+y+z>4n?'outside':x===0n||y===0n||z===0n||x+y+z===4n?'boundary':'inside';
  assert.equal(s.locate(p),expected);assert.equal(oblique.locate(transform(p)),expected);
 }
 assert.equal(oblique.volume.toString(),tiny.div(new Rational(6n)).toString());
});
test('through-holes use a single genus-one shell and empty material has no boundary',()=>{
 const outer=[point2(0n,0n),point2(4n,0n),point2(4n,4n),point2(0n,4n)];
 const hole=[point2(1n,1n),point2(3n,1n),point2(3n,3n),point2(1n,3n)];
 const s=prepareSolid3(faces(extrudePolygon([outer,hole],2n)));
 assert.equal(s.shells.length,1);assert.equal(s.volume.toString(),'24');
 assert.equal(s.locate(point3(2n,2n,1n)),'outside');
 assert.equal(s.locate(point3('1/2',2n,1n)),'inside');
 assert.equal(s.locate(point3(1n,2n,1n)),'boundary');
 const empty=prepareSolid3([]);assert.equal(empty.volume.toString(),'0');assert.equal(empty.locate(point3(0n,0n)),'outside');
});
test('rejects open, inconsistent, crossing, duplicate and touching surfaces; snapshots caller arrays',()=>{
 const ts=box(0n,2n);
 assert.throws(()=>prepareSolid3(ts.slice(1)),RangeError);
 assert.throws(()=>prepareSolid3([...ts,ts[0]!]),RangeError);
 assert.throws(()=>prepareSolid3([reverse(ts)[0]!,...ts.slice(1)]),RangeError);
 assert.throws(()=>prepareSolid3([...ts,...box(1n,3n)]),RangeError);
 assert.throws(()=>prepareSolid3([...ts,...box(2n,4n)]),RangeError);
 const mutable=ts.slice(),s=prepareSolid3(mutable);mutable.length=0;
 assert.equal(s.locate(point3(1n,1n,1n)),'inside');
});
