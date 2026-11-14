import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFaces,point2,segment2,Rational} from '../dist/index.js';
const p=(x:number,y:number)=>point2(BigInt(x),BigInt(y));
const line=(x:number,y:number,u:number,v:number)=>segment2(p(x,y),p(u,v));
const box=(x:number,y:number,w:number)=>[line(x,y,x+w,y),line(x+w,y,x+w,y+w),line(x+w,y+w,x,y+w),line(x,y+w,x,y)];
function check(input:ReturnType<typeof segment2>[]) {
 const a=buildFaces(input);
 const parent=a.vertices.map((_,i)=>i);
 function root(i:number):number {while(parent[i]!==i)i=parent[i]!;return i;}
 for(const e of a.edges)parent[root(e.start)]=root(e.end);
 const components=new Set(parent.map((_,i)=>root(i))).size;
 assert.equal(a.vertices.length-a.edges.length+a.faces.length,1+components);
 a.boundaryFaces.forEach((face,b)=>assert.ok(a.faces[face]!.boundaries.includes(b)));
 a.halfEdges.forEach((h,i)=>assert.equal(a.halfEdgeFaces[i],a.halfEdgeFaces[h.next]));
 assert.ok(a.faces.slice(1).every(f=>f.twiceArea!.sign()>0));
 assert.ok(Object.isFrozen(a.faces));
 return a;
}
test('intersecting squares create three bounded regions with exact areas',()=>{
 const a=check([...box(0,0,2),...box(1,1,2)]);
 assert.equal(a.faces.length,4);
 assert.deepEqual(a.faces.slice(1).map(f=>f.twiceArea!.toString()).sort(),['2','6','6']);
});
test('nested loops, trees and isolated points are assigned to their containing faces',()=>{
 const a=check([...box(0,0,8),...box(2,2,4),...box(3,3,1),line(1,1,1,2),line(7,7,7,7),line(20,20,21,20)]);
 assert.equal(a.faces.length,4);
 assert.deepEqual(a.faces.slice(1).map(f=>f.twiceArea!.toString()).sort(),['2','30','96']);
 assert.equal(a.faces[0]!.boundaries.length,2);
 const outer=a.faces.find(f=>f.twiceArea?.equals(new Rational(96n)))!;
 assert.equal(outer.boundaries.length,3);
 assert.equal(outer.isolatedVertices.length,1);
 assert.equal(check([]).faces.length,1);
 assert.equal(check([line(0,0,1,0)]).faces.length,1);
});
test('touching loops, bridges and high-degree vertices respect planar Euler identity',()=>{
 check([...box(0,0,2),...box(2,2,2)]);
 check([...box(0,0,4),...box(1,1,1),line(0,0,1,1)]);
 const pts=Array.from({length:9},(_,i)=>p(i%3,Math.floor(i/3)));
 let seed=71;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<120;i++)check(Array.from({length:8},()=>segment2(pts[rand()%9]!,pts[rand()%9]!)));
});
test('face areas and ownership survive reflection, permutation and tiny rational scaling',()=>{
 const input=[...box(0,0,8),...box(2,2,4),line(1,1,1,2),line(7,7,7,7)];
 const original=check(input);
 const scale=Rational.parse('1/1000000000000000000000000000000000000000000');
 const offset=Rational.parse('9007199254740993123456789');
 const moved=input.slice().reverse().map(s=>segment2(
   point2(s.end.x.mul(scale).neg().add(offset),s.end.y.mul(scale)),
   point2(s.start.x.mul(scale).neg().add(offset),s.start.y.mul(scale))));
 const transformed=check(moved);
 assert.deepEqual(transformed.faces.slice(1).map(f=>f.twiceArea!.div(scale.mul(scale)).toString()).sort(),original.faces.slice(1).map(f=>f.twiceArea!.toString()).sort());
 assert.deepEqual(transformed.faces.map(f=>[f.boundaries.length,f.isolatedVertices.length]).sort(),original.faces.map(f=>[f.boundaries.length,f.isolatedVertices.length]).sort());
});
