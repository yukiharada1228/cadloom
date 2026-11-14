import test from 'node:test';
import assert from 'node:assert/strict';
import {extrudePolygon,inspectMesh,point2,point3,affine2,transformPolygon} from '../dist/index.js';
import type {TriangleMesh3} from '../dist/index.js';
const p=(x:number,y:number)=>point2(BigInt(x),BigInt(y));
const box=(x:number,y:number,w:number)=>[p(x,y),p(x+w,y),p(x+w,y+w),p(x,y+w)];
function check(region:ReturnType<typeof box>[],height:string,expected:string,baseZ='0'){
 const mesh=extrudePolygon(region,height,{baseZ});
 const report=inspectMesh(mesh);
 assert.ok(report.closed&&report.consistentlyOriented&&report.nondegenerate&&report.manifoldVertices);
 assert.equal(mesh.volume.toString(),expected);
 assert.ok(report.signedVolume.equals(mesh.volume));
 assert.ok(Object.isFrozen(mesh)&&Object.isFrozen(mesh.triangles)&&mesh.triangles.every(Object.isFrozen));
 assert.ok(mesh.vertices.every(v=>Object.isFrozen(v)&&(v.z.equals(mesh.zMin)||v.z.equals(mesh.zMax))));
 return mesh;
}
test('extrudes square, hole, islands and disjoint components with exact volume',()=>{
 check([box(0,0,2)],'3','12');
 const holed=check([box(0,0,8),box(2,2,4),box(3,3,1)],'2/3','98/3');
 // Closed orientable surface Euler characteristic: holed component (0) + island (2).
 const edges=new Set<string>();
 for(const ids of holed.triangles)for(let i=0;i<3;i++){
  const a=ids[i]!,b=ids[(i+1)%3]!;edges.add(a<b?`${a}:${b}`:`${b}:${a}`);
 }
 assert.equal(holed.vertices.length-edges.size+holed.triangles.length,2);
 check([box(0,0,2),box(4,0,1)],'2','10');
 assert.equal(check([],'1','0').triangles.length,0);
});
test('signed heights, huge offsets, fractional dimensions and fill rules',()=>{
 const mesh=check([box(0,0,2)],'-3','12','10');
 assert.equal(mesh.zMin.toString(),'7');assert.equal(mesh.zMax.toString(),'10');
 check([box(0,0,2)],'1/1000000000000000000000000000000','1/250000000000000000000000000000','90071992547409931234567890123456789');
 const scaled=transformPolygon(affine2('1/3',0n,0n,'2/5','9007199254740993123456789'),[box(0,0,2)]);
 assert.equal(extrudePolygon(scaled,'3/7').volume.toString(),'8/35');
 assert.equal(extrudePolygon([box(0,0,4),box(1,1,2)],'2',{fillRule:'nonzero'}).volume.toString(),'32');
});
test('rejects zero heights and non-manifold point-touching boundaries',()=>{
 assert.throws(()=>extrudePolygon([box(0,0,1)],0n),RangeError);
 assert.throws(()=>extrudePolygon([box(0,0,1),box(1,1,1)],1n),/non-pinched/);
 assert.throws(()=>extrudePolygon([[p(0,0),p(4,4),p(0,4),p(4,0)]],1n),/non-pinched/);
});
test('mesh inspection detects openings, reversed faces, collapsed triangles and pinched vertex links',()=>{
 const solid=extrudePolygon([box(0,0,1)],1n);
 assert.equal(inspectMesh({...solid,triangles:solid.triangles.slice(1)}).closed,false);
 const changed=solid.triangles.map((t,i)=>i===0?[t[0],t[2],t[1]] as const:t);
 assert.equal(inspectMesh({...solid,triangles:changed}).consistentlyOriented,false);
 const reversed=solid.triangles.map(t=>[t[0],t[2],t[1]] as const);
 assert.equal(inspectMesh({...solid,triangles:reversed}).signedVolume.toString(),'-1');
 assert.equal(inspectMesh({vertices:[point3(0n,0n),point3(1n,0n),point3(2n,0n)],triangles:[[0,1,2]]}).nondegenerate,false);
 assert.throws(()=>inspectMesh({...solid,triangles:[[0,1,solid.vertices.length]]}),RangeError);
 // Two tetrahedra share only one vertex: edge incidence alone cannot detect this pinch.
 const vertices=[point3(0n,0n,0n),point3(1n,0n,0n),point3(0n,1n,0n),point3(0n,0n,1n),point3(-1n,0n,0n),point3(0n,-1n,0n),point3(0n,0n,-1n)];
 const triangles:TriangleMesh3['triangles']=[[0,2,1],[0,1,3],[0,3,2],[1,2,3],[0,4,5],[0,6,4],[0,5,6],[4,6,5]];
 const report=inspectMesh({vertices,triangles});
 assert.ok(report.closed&&report.consistentlyOriented);
 assert.equal(report.manifoldVertices,false);
});
