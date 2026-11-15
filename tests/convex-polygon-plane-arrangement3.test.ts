import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionConvexPolygonByPlanes3 as partition,point3,plane3,Rational,cross3,dot3,subtract3,evaluatePlane3} from '../dist/index.js';
import type {Point3} from '../dist/index.js';
const Q=(n:bigint)=>new Rational(n);
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
function areaVector(p:readonly Point3[]){return p.reduce((s,a,i)=>{const c=cross3(a,p[(i+1)%p.length]!);return point3(s.x.add(c.x),s.y.add(c.y),s.z.add(c.z));},point3(0n,0n));}
const square=[point3(0n,0n),point3(4n,0n),point3(4n,4n),point3(0n,4n)];
test('convex polygon cells match independent intersections of all signed halfplanes',()=>{
 const cuts=[[1n,0n,-1n],[0n,1n,-2n],[1n,1n,-4n],[1n,-1n,0n]];
 const planes=cuts.map(([a,b,c])=>plane3(a!,b!,0n,c!));
 const cells=partition(square,planes),actual=new Map(cells.map(c=>[c.signs.join(','),c]));let count=0;
 for(let mask=0;mask<16;mask++){
  const signs=cuts.map((_,i)=>(mask>>i)&1?1n:-1n);
  const constraints=[[1n,0n,0n],[-1n,0n,4n],[0n,1n,0n],[0n,-1n,4n],...cuts.map((c,i)=>c.map(v=>v*signs[i]!))];
  const vertices=new Map<string,Point3>();
  for(let i=0;i<constraints.length;i++)for(let j=i+1;j<constraints.length;j++){
   const [a,b,c]=constraints[i]!,[d,e,f]=constraints[j]!,det=a!*e!-b!*d!;if(!det)continue;
   const x=new Rational(b!*f!-c!*e!,det),y=new Rational(c!*d!-a!*f!,det);
   if(constraints.every(([u,v,w])=>x.mul(Q(u!)).add(y.mul(Q(v!))).add(Q(w!)).sign()>=0)){const p=point3(x,y);vertices.set(key(p),p);}
  }
  const points=[...vertices.values()],hasArea=points.some(a=>points.some(b=>points.some(c=>cross3(subtract3(b,a),subtract3(c,a)).z.sign()!==0)));
  const cell=actual.get(signs.join(','));
  if(!hasArea){assert.equal(cell,undefined);continue;}
  count++;assert.ok(cell);assert.deepEqual(new Set(cell.polygon.map(key)),new Set(vertices.keys()));
  planes.forEach((p,i)=>assert.equal(evaluatePlane3(p,cell.witness).sign(),Number(signs[i])));
 }
 assert.equal(count,cells.length);
 const total=cells.reduce((s,c)=>{const a=areaVector(c.polygon);return point3(s.x.add(a.x),s.y.add(a.y),s.z.add(a.z));},point3(0n,0n));
 assert.deepEqual(total,areaVector(square));
});
test('oblique polygons retain collinear ports, winding, exact tiny cuts and area',()=>{
 const map=(x:bigint|string,y:bigint|string)=>{const a=Rational.parse(String(x)),b=Rational.parse(String(y));return point3(a.add(Q(10n)),b.sub(Q(7n)),a.add(b));};
 const input=[map(0n,0n),map(2n,0n),map(4n,0n),map(4n,4n),map(0n,4n)];
 const tiny=Rational.parse('1/1'+'0'.repeat(100)),cuts=[plane3(1n,0n,0n,Q(10n).add(tiny).neg()),plane3(0n,1n,0n,5n),plane3(1n,1n,-1n,-3n)];
 for(const polygon of [input,[...input].reverse()]){
  const cells=partition(polygon,cuts);assert.equal(cells.length,4);
  const normal=areaVector(polygon),total=cells.reduce((s,c)=>{
   const v=areaVector(c.polygon);assert.ok(dot3(v,normal).sign()>0);
   cuts.forEach((p,i)=>{assert.equal(evaluatePlane3(p,c.witness).sign(),c.signs[i]);c.polygon.forEach(q=>assert.ok(evaluatePlane3(p,q).sign()===0||evaluatePlane3(p,q).sign()===c.signs[i]));});
   assert.equal(c.signs[2],0);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.polygon)&&Object.isFrozen(c.signs));
   return point3(s.x.add(v.x),s.y.add(v.y),s.z.add(v.z));
  },point3(0n,0n));assert.deepEqual(total,normal);
 }
 assert.deepEqual(partition(input,[])[0]!.polygon,input);
});
test('tangent, coplanar, duplicate and reversed cuts do not duplicate cells',()=>{
 const cells=partition(square,[plane3(1n,0n,0n),plane3(1n,1n,0n,-8n),plane3(0n,0n,1n),plane3(1n,0n,0n,-2n),plane3(-2n,0n,0n,4n)]);
 assert.equal(cells.length,2);assert.ok(cells.every(c=>c.signs[0]===1&&c.signs[1]===-1&&c.signs[2]===0&&c.signs[3]===-c.signs[4]!));
 assert.ok(cells.every(c=>c.polygon.length===4));
});
test('invalid planar boundary walks are rejected before subdivision',()=>{
 const p=(x:bigint,y:bigint,z=0n)=>point3(x,y,z);
 const invalid=[[],square.slice(0,2),[p(0n,0n),p(1n,0n),p(2n,0n)],[...square,square[0]!],[square[0]!,square[2]!,square[1]!,square[3]!],[p(0n,0n),p(4n,0n),p(1n,1n),p(4n,4n),p(0n,4n)],[p(0n,0n),p(3n,0n),p(2n,0n),p(4n,4n),p(0n,4n)],[...square.slice(0,3),p(0n,4n,1n)]];
 for(const polygon of invalid)assert.throws(()=>partition(polygon,[]),RangeError);
 assert.throws(()=>partition(square,[{normal:p(0n,0n),offset:Q(0n)}]),RangeError);
});
