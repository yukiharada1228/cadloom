import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTriangleTopology,triangle3,point3,point2,extrudePolygon,splitTriangleByPlane,plane3,evaluatePlane3,pointsEqual3} from '../dist/index.js';
import type {Triangle3,TriangleMesh3} from '../dist/index.js';
const p=(x:bigint,y:bigint,z=0n)=>point3(x,y,z);
const facesOf=(mesh:TriangleMesh3)=>mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!));
const square=[point2(0n,0n),point2(1n,0n),point2(1n,1n),point2(0n,1n)];
function verify(input:readonly Triangle3[]){
 const t=buildTriangleTopology(input);
 assert.equal(t.faces.length,input.length);assert.equal(t.halfEdges.length,input.length*3);
 t.halfEdges.forEach((h,i)=>{
  assert.equal(t.halfEdges[h.next]!.previous,i);assert.equal(t.halfEdges[h.previous]!.next,i);
  assert.equal(t.halfEdges[h.next]!.origin,h.target);assert.equal(t.halfEdges[h.next]!.face,h.face);
  assert.equal(t.halfEdges[t.halfEdges[h.next]!.next]!.next,i);
  assert.ok(t.edges[h.edge]!.halfEdges.includes(i));assert.ok(t.outgoing[h.origin]!.includes(i));
  if(h.twin!==null){
   const twin=t.halfEdges[h.twin]!;
   assert.equal(twin.twin,i);assert.equal(twin.origin,h.target);assert.equal(twin.target,h.origin);
   assert.equal(twin.edge,h.edge);
  }
  assert.ok(Object.isFrozen(h));
 });
 t.faces.forEach((f,i)=>{
  assert.ok(t.shells[f.shell]!.faces.includes(i));
  f.vertices.forEach((id,j)=>assert.ok(pointsEqual3(t.vertices[id]!,input[i]![j]!)));
 });
 if(t.boundaryLoops!==null){
  const boundary=new Set(t.edges.filter(e=>e.halfEdges.length===1).flatMap(e=>e.halfEdges));
  const visited=new Set<number>();
  for(const loop of t.boundaryLoops)loop.forEach((id,i)=>{
   assert.ok(boundary.has(id)&&!visited.has(id));visited.add(id);
   assert.equal(t.halfEdges[id]!.target,t.halfEdges[loop[(i+1)%loop.length]!]!.origin);
  });
  assert.equal(visited.size,boundary.size);
 }
 assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.faces)&&Object.isFrozen(t.vertices)&&Object.isFrozen(t.outgoing));
 return t;
}
test('welds equal rationals, shares reverse half-edges, and retains an oriented boundary loop',()=>{
 const a=p(0n,0n),b=p(1n,0n),c=p(1n,1n),d=p(0n,1n);
 const patch=verify([triangle3(a,b,c),triangle3(point3('0.0',0n),point3('2/2','1.0'),d)]);
 assert.equal(patch.vertices.length,4);assert.equal(patch.edges.length,5);
 assert.equal(patch.halfEdges.filter(h=>h.twin!==null).length,2);
 assert.equal(patch.boundaryLoops!.length,1);assert.equal(patch.boundaryLoops![0]!.length,4);
 assert.ok(patch.issues.every(i=>i.kind==='boundary-edge'));
 assert.equal(patch.shells.length,1);assert.equal(patch.shells[0]!.consistentlyOriented,true);
 assert.equal(patch.shells[0]!.closed,false);assert.equal(patch.shells[0]!.signedVolume,null);
 assert.equal(patch.closedManifold,false);
 assert.equal(verify([]).closedManifold,true);
 assert.throws(()=>buildTriangleTopology([[a,a,b]]),RangeError);
});
test('closed extrusions and reversed shells retain exact incidence and signed volume',()=>{
 const mesh=extrudePolygon([square],'3/2');
 const input=facesOf(mesh),t=verify(input);
 assert.ok(t.closedManifold);assert.equal(t.issues.length,0);assert.equal(t.boundaryLoops!.length,0);
 assert.equal(t.shells.length,1);assert.equal(t.shells[0]!.signedVolume!.toString(),'3/2');
 const reverse=verify(input.map(t=>triangle3(t[0],t[2],t[1])));
 assert.ok(reverse.closedManifold);assert.equal(reverse.shells[0]!.signedVolume!.toString(),'-3/2');
 const permuted=verify(input.slice().reverse());assert.deepEqual(permuted.vertices,t.vertices);
 assert.deepEqual(permuted.edges.map(e=>[e.start,e.end]),t.edges.map(e=>[e.start,e.end]));
 const malformed=verify(input.map((t,i)=>i===0?triangle3(t[0],t[2],t[1]):t));
 assert.equal(malformed.closedManifold,false);
 assert.ok(malformed.issues.some(i=>i.kind==='inconsistent-edge-orientation'));
 assert.equal(malformed.shells[0]!.closed,true);assert.equal(malformed.shells[0]!.consistentlyOriented,false);
 assert.equal(malformed.shells[0]!.signedVolume,null);
});
function tetra(a:ReturnType<typeof point3>,b:ReturnType<typeof point3>,c:ReturnType<typeof point3>,d:ReturnType<typeof point3>){
 return [triangle3(a,c,b),triangle3(a,b,d),triangle3(a,d,c),triangle3(b,c,d)];
}
test('edge-connected shells and global vertex pinches are distinguished',()=>{
 const first=tetra(p(0n,0n),p(1n,0n),p(0n,1n),p(0n,0n,1n));
 const second=tetra(p(3n,0n),p(4n,0n),p(3n,1n),p(3n,0n,1n));
 const disjoint=verify([...first,...second]);assert.equal(disjoint.shells.length,2);assert.ok(disjoint.closedManifold);
 const touching=tetra(p(0n,0n),p(-1n,0n),p(0n,-1n),p(0n,0n,-1n));
 const pinched=verify([...first,...touching]);
 assert.equal(pinched.shells.length,2);assert.ok(pinched.shells.every(s=>s.closedManifold));
 assert.equal(pinched.closedManifold,false);assert.equal(pinched.issues.filter(i=>i.kind==='nonmanifold-vertex').length,1);
});
test('edge fans, branched boundaries and unmatched T-junctions produce diagnostics',()=>{
 const a=p(0n,0n),b=p(2n,0n),m=p(1n,0n),c=p(0n,2n),d=p(1n,-1n);
 const fan=verify([triangle3(a,b,c),triangle3(b,a,d),triangle3(a,b,p(0n,0n,1n))]);
 assert.ok(fan.issues.some(i=>i.kind==='nonmanifold-edge'));assert.ok(fan.issues.some(i=>i.kind==='nonmanifold-vertex'));
 assert.equal(fan.boundaryLoops,null);
 const unmatched=verify([triangle3(a,b,c),triangle3(a,d,m),triangle3(m,d,b)]);
 assert.ok(unmatched.issues.some(i=>i.kind==='boundary-edge'));assert.equal(unmatched.shells.length,2);
 const near=point3(0n,0n,'1/1000000000000000000000000000000000000000');
 const separated=verify([triangle3(a,b,c),triangle3(near,point3(2n,0n,near.z),point3(0n,2n,near.z))]);
 assert.equal(separated.vertices.length,6);assert.equal(separated.shells.length,2);
});
test('plane-split extrusion pieces sew exactly and expose the new cut boundary',()=>{
 const input=facesOf(extrudePolygon([square],1n)),plane=plane3(1n,0n,0n,'-1/2');
 const splits=input.map(t=>splitTriangleByPlane(t,plane));
 for(const side of ['positive','negative'] as const){
  const t=verify(splits.flatMap(s=>s[side]));
  assert.equal(t.shells.length,1);assert.equal(t.shells[0]!.closed,false);
  assert.equal(t.shells[0]!.consistentlyOriented,true);assert.equal(t.boundaryLoops!.length,1);
  assert.ok(t.issues.every(i=>i.kind==='boundary-edge'));
  for(const id of t.boundaryLoops![0]!){
   const h=t.halfEdges[id]!;assert.equal(evaluatePlane3(plane,t.vertices[h.origin]!).sign(),0);
  }
 }
});

test('all 256 tetrahedron face subsets/windings match an independent adjacency oracle',()=>{
 const original=tetra(p(0n,0n),p(1n,0n),p(0n,1n),p(0n,0n,1n));
 for(let subset=0;subset<16;subset++)for(let flips=0;flips<16;flips++){
  const chosen:number[]=[],input:Triangle3[]=[];
  for(let i=0;i<4;i++)if(subset&(1<<i)){
   chosen.push(i);const f=original[i]!;input.push(flips&(1<<i)?triangle3(f[0],f[2],f[1]):f);
  }
  const t=verify(input);
  // In a tetrahedron every pair of faces shares exactly one edge. They have
  // compatible edge directions exactly when their winding flip bits agree.
  let conflicts=0;
  for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++){
   if(Boolean(flips&(1<<chosen[i]!))!==Boolean(flips&(1<<chosen[j]!)))conflicts++;
  }
  const oriented=conflicts===0,closed=chosen.length===4;
  assert.equal(t.issues.filter(i=>i.kind==='inconsistent-edge-orientation').length,conflicts);
  assert.equal(t.issues.filter(i=>i.kind==='boundary-edge').length,3*chosen.length-2*(chosen.length*(chosen.length-1)/2));
  assert.equal(t.issues.filter(i=>i.kind==='nonmanifold-vertex').length,0);
  assert.equal(t.closedManifold,chosen.length===0||closed&&oriented);
  assert.equal(t.shells.length,chosen.length===0?0:1);
  if(chosen.length){
   assert.equal(t.shells[0]!.closed,closed);assert.equal(t.shells[0]!.consistentlyOriented,oriented);
   assert.equal(t.shells[0]!.signedVolume===null,!(closed&&oriented));
  }
 }
});
test('duplicate faces are diagnosed even with opposite winding; input is snapshotted',()=>{
 const a={...p(0n,0n)},b=p(1n,0n),c=p(0n,1n);
 const t=verify([[a,b,c],[a,c,b]]);
 assert.ok(t.issues.some(i=>i.kind==='duplicate-face'));
 assert.equal(t.closedManifold,false);assert.equal(t.shells[0]!.closedManifold,false);
 assert.equal(t.shells[0]!.signedVolume,null);
 a.x=point3(10n,0n).x;
 assert.ok(t.vertices.some(v=>pointsEqual3(v,p(0n,0n))));
 assert.ok(!t.vertices.some(v=>pointsEqual3(v,p(10n,0n))));
 assert.ok(t.edges.every(e=>Object.isFrozen(e)&&Object.isFrozen(e.halfEdges)));
 assert.ok(t.outgoing.every(Object.isFrozen));
});
