import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionTriangleByPlanes3,triangle3,point3,plane3,evaluatePlane3,cross3,subtract3,dot3,Rational} from '../dist/index.js';
import type {Triangle3,Plane3,Point3} from '../dist/index.js';
const zero=new Rational(0n);
function area(p:readonly Point3[]){
 return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s.add(a.x.mul(b.y).sub(a.y.mul(b.x)));},zero);
}
function check(t:Triangle3,planes:readonly Plane3[]){
 const cells=partitionTriangleByPlanes3(t,planes),normal=cross3(subtract3(t[1],t[0]),subtract3(t[2],t[0]));
 let total=point3(0n,0n,0n);
 const signatures=new Set<string>();
 for(const c of cells){
  assert.ok(c.polygon.length>=3);assert.equal(c.signs.length,planes.length);
  assert.ok(!signatures.has(c.signs.join(',')));signatures.add(c.signs.join(','));
  assert.equal(new Set(c.polygon.map(p=>`${p.x},${p.y},${p.z}`)).size,c.polygon.length);
  planes.forEach((p,i)=>{
   assert.equal(evaluatePlane3(p,c.witness).sign(),c.signs[i]);
   c.polygon.forEach(v=>assert.ok(evaluatePlane3(p,v).sign()===0||evaluatePlane3(p,v).sign()===c.signs[i]));
  });
  let vector=point3(0n,0n,0n);
  c.polygon.forEach((p,i)=>{
   const q=c.polygon[(i+1)%c.polygon.length]!,v=cross3(p,q);
   vector=point3(vector.x.add(v.x),vector.y.add(v.y),vector.z.add(v.z));
   // Convexity and orientation of each edge, tested against every polygon vertex.
   c.polygon.forEach(r=>assert.ok(dot3(cross3(subtract3(q,p),subtract3(r,p)),normal).sign()>=0));
   assert.equal(dot3(normal,subtract3(p,t[0])).sign(),0);
   for(let j=0;j<3;j++)assert.ok(dot3(cross3(subtract3(t[(j+1)%3]!,t[j]!),subtract3(p,t[j]!)),normal).sign()>=0);
  });
  assert.ok(dot3(vector,normal).sign()>0);
  total=point3(total.x.add(vector.x),total.y.add(vector.y),total.z.add(vector.z));
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.polygon)&&Object.isFrozen(c.signs)&&Object.isFrozen(c.witness));
 }
 assert.deepEqual(total,normal);assert.ok(Object.isFrozen(cells));return cells;
}
test('partition preserves exact coverage, convexity, winding and interior signs across integer plane arrangements',()=>{
 const t=triangle3(point3(0n,0n),point3(4n,0n),point3(0n,4n));
 let cases=0;
 for(let a=-2n;a<=2n;a++)for(let b=-2n;b<=2n;b++)if(a||b)for(let k=-2n;k<=2n;k++){
  check(t,[plane3(a,b,0n,k),plane3(1n,-1n,0n),plane3(1n,1n,0n,-2n),plane3(0n,0n,1n)]);cases++;
 }
 assert.equal(cases,120);
});
test('independent halfplane intersection enumerates every cell vertex for all realizable sign combinations',()=>{
 const t=triangle3(point3(0n,0n),point3(4n,0n),point3(0n,4n));
 const cuts=[[1n,0n,-1n],[0n,1n,-1n],[1n,1n,-3n],[1n,-1n,0n]] as const;
 const planes=cuts.map(([a,b,c])=>plane3(a,b,0n,c));
 const cells=check(t,planes);
 const bySign=new Map(cells.map(c=>[c.signs.join(','),c]));let positiveCells=0;
 for(let mask=0;mask<16;mask++){
  const signs=cuts.map((_,i)=>(mask>>i)&1?1:-1);
  const constraints:bigint[][]=[[1n,0n,0n],[0n,1n,0n],[-1n,-1n,4n],...cuts.map((c,i)=>c.map(v=>v*BigInt(signs[i]!)))];
  const vertices=new Map<string,Point3>();
  for(let i=0;i<constraints.length;i++)for(let j=i+1;j<constraints.length;j++){
   const [a,b,c]=constraints[i]!,[d,e,f]=constraints[j]!;
   const det=a!*e!-b!*d!;if(det===0n)continue;
   const x=new Rational(b!*f!-c!*e!,det),y=new Rational(c!*d!-a!*f!,det);
   if(constraints.every(([u,v,w])=>x.mul(new Rational(u!)).add(y.mul(new Rational(v!))).add(new Rational(w!)).sign()>=0))vertices.set(`${x},${y}`,point3(x,y));
  }
  const points=[...vertices.values()];
  const dimension2=points.some(a=>points.some(b=>points.some(c=>b.x.sub(a.x).mul(c.y.sub(a.y)).sub(b.y.sub(a.y).mul(c.x.sub(a.x))).sign()!==0)));
  if(!dimension2){assert.ok(!bySign.has(signs.join(',')));continue;}
  positiveCells++;
  const actual=bySign.get(signs.join(','));assert.ok(actual);
  assert.deepEqual(new Set(actual.polygon.map(p=>`${p.x},${p.y}`)),new Set(vertices.keys()));
 }
 assert.equal(positiveCells,cells.length);
});
test('coplanar, duplicate, reversed and tangent planes do not duplicate area; oblique tiny rational cuts remain exact',()=>{
 const t=triangle3(point3(0n,0n),point3(4n,0n),point3(0n,4n));
 const planes=[plane3(1n,0n,0n,-1n),plane3(-2n,0n,0n,2n),plane3(0n,0n,1n),plane3(1n,1n,0n),plane3(1n,1n,0n,-4n)];
 const cells=check(t,planes);assert.equal(cells.length,2);
 assert.ok(cells.every(c=>c.signs[0]===-c.signs[1]!&&c.signs[2]===0&&c.signs[3]===1&&c.signs[4]===-1));
 const reverse=check(triangle3(t[0],t[2],t[1]),planes);assert.equal(reverse.length,2);
 assert.equal(cells.reduce((s,c)=>s.add(area(c.polygon)),zero).toString(),'16');
 const tiny=Rational.parse('1/1'+'0'.repeat(120));
 const oblique=triangle3(point3(0n,0n,0n),point3(1n,1n,0n),point3(0n,1n,1n));
 const r=check(oblique,[plane3(1n,0n,0n,tiny.neg()),plane3(0n,0n,1n,tiny.neg())]);assert.equal(r.length,4);
 assert.equal(check(t,[]).length,1);
 assert.throws(()=>partitionTriangleByPlanes3(t,[{normal:point3(0n,0n),offset:zero}]),RangeError);
});
