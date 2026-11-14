import test from 'node:test';
import assert from 'node:assert/strict';
import {triangulatePolygon,preparePolygon,point2,Rational,orient2d,pointOnSegment,transformPolygon,affine2} from '../dist/index.js';
import type {PolygonRegion,FillRule} from '../dist/index.js';
const p=(x:number,y:number)=>point2(BigInt(x),BigInt(y));
const box=(x:number,y:number,w:number)=>[p(x,y),p(x+w,y),p(x+w,y+w),p(x,y+w)];
function check(region:PolygonRegion,rule:FillRule='even-odd') {
 const mesh=triangulatePolygon(region,rule),polygon=preparePolygon(region,rule);
 const counts=new Map<string,number>();
 let sum=new Rational(0n);
 for(const ids of mesh.triangles){
  const [a,b,c]=ids.map(i=>mesh.vertices[i]!) as [typeof mesh.vertices[number],typeof mesh.vertices[number],typeof mesh.vertices[number]];
  assert.equal(orient2d(a,b,c),1);
  sum=sum.add(b.x.sub(a.x).mul(c.y.sub(a.y)).sub(b.y.sub(a.y).mul(c.x.sub(a.x))));
  const center=point2(a.x.add(b.x).add(c.x).div(new Rational(3n)),a.y.add(b.y).add(c.y).div(new Rational(3n)));
  assert.equal(polygon.locate(center),'inside');
  for(let i=0;i<3;i++){
   const u=ids[i]!,v=ids[(i+1)%3]!,key=u<v?`${u}:${v}`:`${v}:${u}`;
   counts.set(key,(counts.get(key)??0)+1);
   // No mesh vertex lies strictly inside any triangle edge.
   mesh.vertices.forEach((q,id)=>{if(id!==u&&id!==v)assert.equal(pointOnSegment(q,{start:mesh.vertices[u]!,end:mesh.vertices[v]!}),false);});
  }
 }
 // Independent convex separating-axis criterion: interiors of distinct triangles do not overlap.
 for(let i=0;i<mesh.triangles.length;i++)for(let j=i+1;j<mesh.triangles.length;j++){
  const a=mesh.triangles[i]!.map(id=>mesh.vertices[id]!),b=mesh.triangles[j]!.map(id=>mesh.vertices[id]!);
  const separates=(u:typeof a,v:typeof a)=>u.some((p,k)=>v.every(q=>orient2d(p,u[(k+1)%3]!,q)<=0));
  assert.ok(separates(a,b)||separates(b,a),'triangle interiors overlap');
 }
 assert.ok(sum.equals(mesh.twiceArea)&&sum.equals(polygon.twiceArea));
 for(const [key,n] of counts){
  assert.ok(n===1||n===2);
  const [u,v]=key.split(':').map(Number),a=mesh.vertices[u!]!,b=mesh.vertices[v!]!;
  assert.equal(polygon.locate(point2(a.x.add(b.x).div(new Rational(2n)),a.y.add(b.y).div(new Rational(2n)))),n===1?'boundary':'inside');
 }
 assert.ok(Object.isFrozen(mesh)&&Object.isFrozen(mesh.vertices)&&Object.isFrozen(mesh.triangles));
 return mesh;
}
test('triangulates concavity, holes, nested islands, touching components and empty regions',()=>{
 check([box(0,0,4)]);
 check([[p(0,0),p(4,0),p(4,1),p(1,1),p(1,4),p(0,4)]]);
 check([box(0,0,8),box(2,2,4),box(3,3,1)]);
 check([box(0,0,2),box(2,2,2)]);
 check([[p(0,0),p(4,4),p(0,4),p(4,0)]]);
 assert.equal(check([]).triangles.length,0);
 assert.equal(check([[p(0,0),p(1,0),p(2,0)]]).triangles.length,0);
 check([box(0,0,4),box(1,1,2)],'nonzero');
});
test('slab wall subdivisions remain conforming under rational shear and extreme scales',()=>{
 const region=[box(0,0,8),box(2,1,3),box(3,5,2)];
 check(region);
 check(transformPolygon(affine2(1n,'2/3','1/7',2n),region));
 check(transformPolygon(affine2('1/100000000000000000000000000000000',0n,0n,'1/3','9007199254740993123456789'),region));
});

test('seeded crossing rings retain area, nonoverlap and conforming edges',()=>{
 let seed=444;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<12;i++)check([Array.from({length:6},()=>p(rand()%5,rand()%5))]);
});
