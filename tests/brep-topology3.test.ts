import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,vector3,line3,lineInterval3,plane3,planeFromPoints,circle3,circlePlane3,fullCircleArc3,circularArc3,cylinder3,buildBRepTopology3,buildTriangleTopology,triangle3,algebraicCoordinates3,Polynomial,isolateRealRoots,compareAlgebraicPoints3,pointOnCurve3,reverseCurve3,Rational} from '../dist/index.js';
import type {Curve3,BRepFaceInput3,BRepEdgeUse3,BRepTopology3,Triangle3,Point3,Surface3} from '../dist/index.js';
const use=(edge:number,direction:1|-1=1):BRepEdgeUse3=>({edge,direction});
const line=(a:Point3,b:Point3):Curve3=>({kind:'line',interval:lineInterval3(line3(a,vector3(b.x.sub(a.x),b.y.sub(a.y),b.z.sub(a.z))),0n,1n)});
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
function fromTriangles(triangles:readonly Triangle3[]){
 const ids=new Map<string,number>(),points:Point3[]=[],edges:Curve3[]=[],edgeIds=new Map<string,number>();
 const faces:BRepFaceInput3[]=triangles.map(t=>{
  const vertices=t.map(p=>{const k=key(p);if(!ids.has(k)){ids.set(k,points.length);points.push(p);}return ids.get(k)!;});
  const loop=vertices.map((a,i)=>{const b=vertices[(i+1)%3]!,lo=Math.min(a,b),hi=Math.max(a,b),k=`${lo}:${hi}`;
   if(!edgeIds.has(k)){edgeIds.set(k,edges.length);edges.push(line(points[lo]!,points[hi]!));}return use(edgeIds.get(k)!,a===lo?1:-1);
  });
  return {surface:{kind:'plane',plane:planeFromPoints(...t)},sense:1,loops:[loop]};
 });return {edges,faces};
}
const tetra=(a=point3(0n,0n,0n),b=point3(1n,0n,0n),c=point3(0n,1n,0n),d=point3(0n,0n,1n)):Triangle3[]=>[triangle3(a,c,b),triangle3(a,b,d),triangle3(b,c,d),triangle3(c,a,d)];
function verify(topology:BRepTopology3):BRepTopology3 {
 assert.ok(Object.isFrozen(topology)&&Object.isFrozen(topology.vertices)&&Object.isFrozen(topology.edges)&&Object.isFrozen(topology.faces));
 const seen=new Set<number>();
 topology.loops.forEach((loop,id)=>{
  assert.ok(Object.isFrozen(loop)&&Object.isFrozen(loop.coedges));assert.ok(loop.coedges.length>0);
  loop.coedges.forEach((h,i)=>{
   assert.ok(!seen.has(h));seen.add(h);const coedge=topology.coedges[h]!;assert.equal(coedge.loop,id);assert.equal(coedge.face,loop.face);assert.equal(coedge.next,loop.coedges[(i+1)%loop.coedges.length]);assert.equal(coedge.previous,loop.coedges[(i+loop.coedges.length-1)%loop.coedges.length]);
   assert.equal(coedge.target,topology.coedges[coedge.next]!.origin);assert.equal(topology.coedges[coedge.previous]!.next,h);
  });
 });assert.equal(seen.size,topology.coedges.length);
 topology.coedges.forEach((h,id)=>{
  const e=topology.edges[h.edge]!;assert.ok(e.coedges.includes(id));assert.ok(topology.outgoing[h.origin]!.includes(id));assert.equal(h.origin,h.direction===1?e.start:e.end);assert.equal(h.target,h.direction===1?e.end:e.start);
  if(h.twin!==null){const t=topology.coedges[h.twin]!;assert.equal(t.twin,id);assert.equal(t.edge,h.edge);assert.equal(t.direction,-h.direction);assert.equal(t.origin,h.target);assert.equal(t.target,h.origin);}
  assert.ok(Object.isFrozen(h));
 });
 topology.edges.forEach(e=>{assert.equal(pointOnCurve3(topology.vertices[e.start]!,e.curve),true);assert.equal(pointOnCurve3(topology.vertices[e.end]!,e.curve),true);assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.coedges));});
 topology.vertexLinks.forEach((link,v)=>{
  assert.deepEqual(link.corners,topology.outgoing[v]);assert.ok(Object.isFrozen(link)&&Object.isFrozen(link.ports)&&Object.isFrozen(link.degrees));
  // Independent corner incidence count: each edge end sees one corner per edge use,
  // including separate ports on a self-loop edge and repeated same-face uses.
  assert.deepEqual(link.degrees,link.ports.map(p=>topology.edges[Math.floor(p/2)]!.coedges.length));
  assert.equal(link.degrees.reduce((a,b)=>a+b,0),2*link.corners.length);
 });
 const shellFaces=new Set<number>();topology.shells.forEach((shell,id)=>shell.faces.forEach(f=>{assert.ok(!shellFaces.has(f));shellFaces.add(f);assert.equal(topology.faces[f]!.shell,id);}));assert.equal(shellFaces.size,topology.faces.length);
 if(topology.boundaryLoops!==null){const actual=topology.boundaryLoops.flat();assert.equal(new Set(actual).size,actual.length);assert.deepEqual(actual.slice().sort((a,b)=>a-b),topology.edges.filter(e=>e.coedges.length===1).flatMap(e=>e.coedges).sort((a,b)=>a-b));}
 return topology;
}
function cylinderInput(seam=false){
 const n=vector3(0n,0n,1n),bottom=circle3(point3(0n,0n,0n),n,1n),top=circle3(point3(0n,0n,2n),n,1n);
 const edges:Curve3[]=[{kind:'circular-arc',arc:fullCircleArc3(bottom)},{kind:'circular-arc',arc:fullCircleArc3(top)}];
 const side:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,0n),n),1n)};
 const faces:BRepFaceInput3[]=[{surface:{kind:'plane',plane:plane3(0n,0n,-1n)},sense:1,loops:[[use(0,-1)]]},{surface:{kind:'plane',plane:circlePlane3(top)},sense:1,loops:[[use(1)]]},{surface:side,sense:1,loops:[[use(0)],[use(1,-1)]]}];
 if(seam){edges.push(line(point3(0n,1n,0n),point3(0n,1n,2n)));faces[2]={surface:side,sense:1,loops:[[use(0),use(2),use(1,-1),use(2,-1)]]};}
 return {edges,faces};
}
test('explicit tetrahedral BRep incidence matches the independent triangular topology builder',()=>{
 const triangles=tetra(),input=fromTriangles(triangles),t=verify(buildBRepTopology3(input.edges,input.faces));
 assert.equal(t.vertices.length,4);assert.equal(t.edges.length,6);assert.equal(t.coedges.length,12);assert.equal(t.faces.length,4);assert.equal(t.shells.length,1);assert.equal(t.closedOrientedIncidence,true);assert.deepEqual(t.issues,[]);assert.deepEqual(t.boundaryLoops,[]);assert.ok(t.vertexLinks.every(v=>v.closed));
 const old=buildTriangleTopology(triangles);assert.equal(old.closedManifold,t.closedOrientedIncidence);assert.deepEqual(t.vertices.map(p=>[String(p.x.rational),String(p.y.rational),String(p.z.rational)]),old.vertices.map(p=>[String(p.x),String(p.y),String(p.z)]));
});
test('seeded triangle subsets, reversals and excess faces match independent simplicial links',()=>{
 let seed=6131;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<60;trial++){
  const x=BigInt(next()%11)-5n,y=BigInt(next()%11)-5n,z=BigInt(next()%11)-5n,triangles=tetra(point3(x,y,z),point3(x+2n,y,z),point3(x,y+3n,z),point3(x,y,z+4n));
  if(trial%4===0)triangles.pop();
  if(trial%4===1){const t=triangles[trial%4]!;triangles[trial%4]=triangle3(t[0],t[2],t[1]);}
  if(trial%4===2)triangles.push(triangles[0]!);
  const old=buildTriangleTopology(triangles),input=fromTriangles(triangles),t=verify(buildBRepTopology3(input.edges,input.faces));
  assert.equal(t.closed,old.edges.every(e=>e.halfEdges.length===2));assert.equal(t.consistentlyOriented,old.shells.every(s=>s.consistentlyOriented));assert.equal(t.manifoldVertices,!old.issues.some(i=>i.kind==='nonmanifold-vertex'));assert.equal(t.closedOrientedIncidence,old.closedManifold);
 }
});
test('periodic circular edges support capped cylinders and distinguish same-direction uses',()=>{
 const {edges,faces}=cylinderInput(),t=verify(buildBRepTopology3(edges,faces));assert.equal(t.vertices.length,2);assert.equal(t.edges.length,2);assert.equal(t.coedges.length,4);assert.equal(t.loops.length,4);assert.equal(t.faces.length,3);assert.equal(t.closedOrientedIncidence,true);assert.deepEqual(t.issues,[]);
 assert.ok(t.edges.every(e=>e.start===e.end));assert.ok(t.vertexLinks.every(v=>v.ports.length===2&&v.degrees.every(d=>d===2)&&v.closed));
 const wrong=[{...faces[0]!,loops:[[use(0)]]},...faces.slice(1)],bad=verify(buildBRepTopology3(edges,wrong));assert.equal(bad.closed,true);assert.equal(bad.manifoldVertices,true);assert.equal(bad.consistentlyOriented,false);assert.ok(bad.issues.some(i=>i.kind==='inconsistent-edge-orientation'&&i.edge===0));assert.equal(bad.edges[0]!.coedges.every(h=>bad.coedges[h]!.twin===null),true);
 const open=verify(buildBRepTopology3(edges,[faces[0]!,faces[2]!]));assert.equal(open.closed,false);assert.equal(open.consistentlyOriented,true);assert.equal(open.manifoldVertices,true);assert.equal(open.boundaryLoops!.length,1);assert.equal(open.boundaryLoops![0]!.length,1);
});
test('periodic seam edges may have two opposite coedges on one face',()=>{
 const {edges,faces}=cylinderInput(true),t=verify(buildBRepTopology3(edges,faces));assert.equal(t.edges.length,3);assert.equal(t.coedges.length,6);assert.equal(t.closedOrientedIncidence,true);assert.deepEqual(t.issues,[]);
 const seam=t.edges[2]!.coedges;assert.equal(seam.length,2);assert.equal(t.coedges[seam[0]!]!.face,t.coedges[seam[1]!]!.face);assert.equal(t.coedges[seam[0]!]!.twin,seam[1]);assert.ok(t.vertexLinks.every(v=>v.ports.length===3&&v.closed));
});
test('multiple distinct edges with the same endpoints retain distinct link ports',()=>{
 const c=circle3(point3(0n,0n,0n),vector3(0n,0n,1n),1n),east=point3(1n,0n,0n),west=point3(-1n,0n,0n),edges:Curve3[]=[{kind:'circular-arc',arc:circularArc3(c,east,west)},{kind:'circular-arc',arc:circularArc3(c,west,east)}];
 const face:BRepFaceInput3={surface:{kind:'plane',plane:circlePlane3(c)},sense:1,loops:[[use(0),use(1)]]},t=verify(buildBRepTopology3(edges,[face]));
 assert.equal(t.vertices.length,2);assert.equal(t.edges.length,2);assert.equal(t.manifoldVertices,true);assert.equal(t.boundaryLoops![0]!.length,2);assert.ok(t.vertexLinks.every(v=>v.ports.length===2&&!v.closed));
 // Two coincident disks can pass abstract incidence. This is deliberately not a solid certificate.
 const doubled=verify(buildBRepTopology3(edges,[face,{...face,sense:-1,loops:[[use(1,-1),use(0,-1)]]}]));assert.equal(doubled.closedOrientedIncidence,true);
});
test('touching shells have valid local links but a singular global vertex link',()=>{
 const triangles=[...tetra(),...tetra(point3(0n,0n,0n),point3(-1n,0n,0n),point3(0n,-1n,0n),point3(0n,0n,-1n))],input=fromTriangles(triangles),t=verify(buildBRepTopology3(input.edges,input.faces));
 assert.equal(t.closed,true);assert.equal(t.consistentlyOriented,true);assert.equal(t.manifoldVertices,false);assert.equal(t.closedOrientedIncidence,false);assert.equal(t.shells.length,2);assert.ok(t.shells.every(s=>s.closedOrientedIncidence));
 const issues=t.issues.filter(i=>i.kind==='nonmanifold-vertex');assert.equal(issues.length,1);if(issues[0]!.kind==='nonmanifold-vertex')assert.equal(t.vertexLinks[issues[0]!.vertex]!.connected,false);
});
test('algebraic endpoints weld semantically across circle and line representations',()=>{
 const h=isolateRealRoots(new Polynomial(['-3/4',0n,1n]))[1]!,circle=circle3(point3(0n,0n,0n),vector3(0n,0n,1n),1n);
 const edges:Curve3[]=[{kind:'circular-arc',arc:circularArc3(circle,algebraicCoordinates3('1/2',h,0n),algebraicCoordinates3('1/2',h.neg(),0n))},{kind:'line',interval:lineInterval3(line3(point3('1/2',0n,0n),vector3(0n,1n,0n)),h.neg().refine(),h.refine())}];
 const t=verify(buildBRepTopology3(edges,[{surface:{kind:'plane',plane:circlePlane3(circle)},sense:1,loops:[[use(0),use(1)]]}]));assert.equal(t.vertices.length,2);assert.equal(t.manifoldVertices,true);assert.equal(t.boundaryLoops![0]!.length,2);
 assert.equal(compareAlgebraicPoints3(t.vertices[0]!,algebraicCoordinates3('1/2',h.neg(),0n)),0);
});
test('edge IDs are explicit sharing contracts and unused edges are diagnosed',()=>{
 const {edges,faces}=cylinderInput(),duplicated=[edges[0]!,edges[0]!],surface=faces[0]!.surface;
 const t=verify(buildBRepTopology3(duplicated,[{surface,sense:1,loops:[[use(0)]]},{surface,sense:-1,loops:[[use(1,-1)]]}]));assert.equal(t.edges.length,2);assert.equal(t.closed,false);assert.equal(t.manifoldVertices,false);assert.equal(t.boundaryLoops,null);assert.ok(t.issues.filter(i=>i.kind==='boundary-edge').length===2);
 const unused=verify(buildBRepTopology3([edges[0]!],[]));assert.ok(unused.issues.some(i=>i.kind==='unused-edge'));assert.equal(unused.closedOrientedIncidence,false);
 const empty=verify(buildBRepTopology3([],[]));assert.equal(empty.closedOrientedIncidence,true);assert.equal(empty.shells.length,0);
});
test('indices, orientation tags, point edges, closure and whole-surface membership are validated',()=>{
 const {edges,faces}=cylinderInput(),face=faces[0]!;
 for(const id of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>buildBRepTopology3(edges,[{...face,loops:[[use(id)]]}]),RangeError);
 assert.throws(()=>buildBRepTopology3(edges,[{...face,sense:0 as 1}]),RangeError);assert.throws(()=>buildBRepTopology3(edges,[{...face,loops:[[use(0,0 as 1)]]}]),RangeError);
 assert.throws(()=>buildBRepTopology3(edges,[{...face,loops:[]}]),RangeError);assert.throws(()=>buildBRepTopology3(edges,[{...face,loops:[[]]}]),RangeError);
 const segment=line(point3(-1n,0n,0n),point3(1n,0n,0n));assert.throws(()=>buildBRepTopology3([segment],[{...face,loops:[[use(0)]]}]),RangeError);
 assert.throws(()=>buildBRepTopology3([segment],[{...faces[2]!,loops:[[use(0),use(0,-1)]]}]),RangeError);
 const point:Curve3={kind:'line',interval:lineInterval3(line3(point3(0n,0n,0n),vector3(1n,0n,0n)),0n,0n)};assert.throws(()=>buildBRepTopology3([point],[]),RangeError);
 const zero:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(point3(0n,0n,0n),vector3(0n,0n,1n),0n))};assert.throws(()=>buildBRepTopology3([zero],[]),RangeError);
});
test('input arrays and structural surface/curve fields are snapshotted',()=>{
 const input=cylinderInput(),edges=[...input.edges],faces=input.faces.map(f=>({...f,loops:f.loops.map(l=>l.map(u=>({...u})))})),t=verify(buildBRepTopology3(edges,faces));
 edges.length=0;faces[0]!.loops[0]![0]!.direction=1;faces.length=0;assert.equal(t.closedOrientedIncidence,true);assert.equal(t.faces.length,3);assert.equal(t.coedges[0]!.direction,-1);
 assert.ok(t.outgoing.every(Object.isFrozen)&&t.shells.every(Object.isFrozen)&&t.issues.every(Object.isFrozen));
});

test('vertex links retain self-loops at retraced edge tips without claiming a geometric face',()=>{
 const edge=line(point3(0n,0n,0n),point3(1n,0n,0n)),face:BRepFaceInput3={surface:{kind:'plane',plane:plane3(0n,0n,1n)},sense:1,loops:[[use(0),use(0,-1)]]};
 // This abstract incidence is closed. The zero-area geometric face is not certified.
 const t=verify(buildBRepTopology3([edge],[face]));assert.equal(t.closedOrientedIncidence,true);assert.ok(t.vertexLinks.every(v=>v.ports.length===1&&v.degrees[0]===2&&v.closed));
});
test('edge/face permutation and intrinsic edge reversal preserve incidence with remapped uses',()=>{
 const input=cylinderInput(true),base=verify(buildBRepTopology3(input.edges,input.faces)),order=[2,0,1],map=new Map(order.map((old,id)=>[old,id])),reversed=new Set([0,2]);
 const edges=order.map(i=>reversed.has(i)?reverseCurve3(input.edges[i]!):input.edges[i]!);
 const faces=[2,0,1].map(i=>({...input.faces[i]!,loops:input.faces[i]!.loops.map(l=>l.map(u=>use(map.get(u.edge)!,reversed.has(u.edge)?u.direction===1?-1:1:u.direction)))}));
 const actual=verify(buildBRepTopology3(edges,faces));assert.equal(actual.closedOrientedIncidence,true);assert.deepEqual(actual.issues,base.issues);assert.equal(actual.shells.length,base.shells.length);assert.equal(actual.vertices.length,base.vertices.length);
 actual.vertices.forEach((p,i)=>assert.equal(compareAlgebraicPoints3(p,base.vertices[i]!),0));
});
