import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,point3,Rational,preparePlanarSolid3,partitionPlanarBRepFaces3,plane3,consolidatePlanarSolid3,createBoxBody3,booleanPlanarBodies3,consolidatePlanarBody3,createPlanarBody3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,extrudeBody3,triangulatePolygon} from '../dist/index.js';
import {planarSolidFromBoundary3} from '../dist/convert/planar-body3.js';
import type {Point3,Body3} from '../dist/index.js';
const cube=[
 [point3(0n,0n),point3(0n,2n),point3(2n,2n),point3(2n,0n)],
 [point3(0n,0n,2n),point3(2n,0n,2n),point3(2n,2n,2n),point3(0n,2n,2n)],
 [point3(0n,0n),point3(2n,0n),point3(2n,0n,2n),point3(0n,0n,2n)],
 [point3(0n,2n),point3(0n,2n,2n),point3(2n,2n,2n),point3(2n,2n)],
 [point3(0n,0n),point3(0n,0n,2n),point3(0n,2n,2n),point3(0n,2n)],
 [point3(2n,0n),point3(2n,2n),point3(2n,2n,2n),point3(2n,0n,2n)],
];
function roundtrip(b:Body3){const r=restoreBody3(serializeBody3(b));assert.deepEqual(r.record,b.record);return r;}
function provenance(result:ReturnType<typeof consolidatePlanarSolid3>){
 const all=result.sourceFaces.flat();assert.equal(all.length,result.source.polygons.length);assert.equal(new Set(all).size,all.length);
 assert.equal(result.faces.length,result.sourceFaces.length);assert.equal(new Set(result.shellMap).size,result.source.topology.shells.length);
 assert.equal(result.sewn.topology.closedOrientedIncidence,true);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.faces)&&Object.isFrozen(result.sourceFaces));
 const rebuilt=planarSolidFromBoundary3(result.sewn.topology);assert.equal(rebuilt.volume.toString(),result.source.volume.toString());return rebuilt;
}
test('subdivided cube consolidates to six faces, twelve edges and eight vertices without changing material',()=>{
 const cells=partitionPlanarBRepFaces3(cube,[plane3(1n,0n,0n,-1n),plane3(0n,1n,0n,-1n),plane3(0n,0n,1n,-1n)],{requireClosed:true}),source=preparePlanarSolid3(cells.cells.map(c=>c.polygon)),r=consolidatePlanarSolid3(source),rebuilt=provenance(r);
 assert.equal(source.polygons.length,24);assert.equal(r.faces.length,6);assert.equal(r.sewn.topology.edges.length,12);assert.equal(r.sewn.topology.vertices.length,8);assert.ok(r.sourceFaces.every(ids=>ids.length===4));assert.equal(r.retainedFaces.length,0);
 for(let x=-1n;x<=3n;x++)for(let y=-1n;y<=3n;y++)for(let z=-1n;z<=3n;z++){
  const v=[x,y,z],expected=v.some(n=>n<0n||n>2n)?'outside':v.some(n=>n===0n||n===2n)?'boundary':'inside';assert.equal(rebuilt.locate(point3(x,y,z)),expected);
 }
 assert.throws(()=>consolidatePlanarSolid3({...source}),RangeError);
});
test('common Body consolidation preserves cavity roles, face provenance, replay and further Booleans',()=>{
 const outer=createBoxBody3(point3(0n,0n),4n,4n,4n),inner=createBoxBody3(point3(1n,1n,1n),2n,2n,2n),source=booleanPlanarBodies3(outer,inner,'difference'),r=consolidatePlanarBody3(source),b=roundtrip(r.body);
 assert.equal(source.faces.length,60);assert.equal(b.faces.length,12);assert.equal(b.topology.edges.length,24);assert.deepEqual(b.record.regions,source.record.regions);assert.equal(b.construction.kind,'planar-consolidated');
 const all=r.sourceFaces.flat();assert.equal(all.length,source.faces.length);assert.equal(new Set(all).size,source.faces.length);assert.equal(r.retainedFaces.length,0);
 assert.equal(locateBody3(b,point3(2n,2n,2n)),'outside');assert.equal(locateBody3(b,point3('1/2','1/2','1/2')),'inside');
 b.faces.forEach((f,i)=>assert.equal(locateBodyFace3(b,i,f.sample),'inside'));
 const filled=consolidatePlanarBody3(booleanPlanarBodies3(b,inner,'union')).body;assert.equal(filled.faces.length,6);assert.equal(locateBody3(filled,point3(2n,2n,2n)),'inside');
 assert.deepEqual(consolidatePlanarBody3(b).body.record,b.record);
 const tampered=JSON.parse(serializeBody3(b));tampered.body.faces[0].domain.rings=[];assert.throws(()=>restoreBody3(tampered),RangeError);
});
test('coplanar consolidation creates connected nonconvex faces with holes and keeps separate components apart',()=>{
 const ring=(lo:bigint,hi:bigint)=>{const p=[point2(lo,lo),point2(hi,lo),point2(hi,hi),point2(lo,hi)];return p.map((a,i)=>({kind:'segment' as const,segment:{start:a,end:p[(i+1)%p.length]!}}));};
 const tube=extrudeBody3([ring(0n,4n),ring(1n,3n)],2n),r=consolidatePlanarBody3(tube),b=roundtrip(r.body);
 assert.equal(b.faces.length,10);assert.equal(b.record.faces.filter(f=>f.loops.length===2).length,2);assert.equal(b.record.shells.length,1);assert.equal(locateBody3(b,point3(2n,2n,1n)),'outside');assert.equal(locateBody3(b,point3('1/2',2n,1n)),'inside');
 for(const [id,face] of b.record.faces.entries())if(face.loops.length===2)assert.equal(locateBodyFace3(b,id,point3(2n,2n,b.faces[id]!.sample.z.rational!)),'outside');
 const two=booleanPlanarBodies3(createBoxBody3(point3(0n,0n),1n,1n,1n),createBoxBody3(point3(3n,0n),1n,1n,1n),'union'),merged=consolidatePlanarBody3(two).body;
 assert.equal(merged.faces.length,12);assert.equal(merged.record.shells.length,2);assert.equal(merged.interiorSamples.length,2);assert.equal(locateBody3(merged,point3(2n,'1/2','1/2')),'outside');
});
test('a pinched flat roof patch stays as valid faces while its pyramidal bump remains a manifold solid',()=>{
 const square=[point2(0n,0n),point2(4n,0n),point2(4n,4n),point2(0n,4n)],footprint=[point2(0n,0n),point2(2n,1n),point2(1n,2n)],mesh=triangulatePolygon([square,footprint]),top=mesh.triangles.map(ids=>ids.map(i=>point3(mesh.vertices[i]!.x,mesh.vertices[i]!.y,1n))),A=point3(0n,0n,1n),B=point3(2n,1n,1n),C=point3(1n,2n,1n),P=point3(1n,1n,2n);
 const base=square.map(p=>point3(p.x,p.y)),walls=square.map((p,i)=>{const q=square[(i+1)%square.length]!;return [point3(p.x,p.y),point3(q.x,q.y),point3(q.x,q.y,1n),point3(p.x,p.y,1n)];});
 const s=preparePlanarSolid3([[...base].reverse(),...walls,...top,[A,B,P],[B,C,P],[C,A,P]]),r=consolidatePlanarSolid3(s),rebuilt=provenance(r);
 assert.ok(r.retainedFaces.length>0);assert.ok(r.retainedFaces.every(id=>r.sourceFaces.some(ids=>ids.length===1&&ids[0]===id)));assert.equal(rebuilt.volume.toString(),'33/2');assert.equal(rebuilt.locate(point3(1n,1n,'3/2')),'inside');
 const mirrored=preparePlanarSolid3(s.polygons.map(face=>face.map(p=>point3(p.x,p.y,p.z.neg())).reverse())),negative=consolidatePlanarSolid3(mirrored),negativeMaterial=provenance(negative);
 assert.ok(negative.retainedFaces.length>0);assert.equal(negativeMaterial.volume.toString(),'33/2');assert.equal(negativeMaterial.locate(point3(1n,1n,'-3/2')),'inside');
});
test('empty consolidation and unsupported Body inputs remain explicit',()=>{
 const r=consolidatePlanarSolid3(preparePlanarSolid3([]));provenance(r);assert.equal(r.faces.length,0);assert.deepEqual(r.shellMap,[]);
 const empty=roundtrip(consolidatePlanarBody3(createPlanarBody3([])).body);assert.equal(empty.faces.length,0);assert.deepEqual(empty.record.regions,[{shells:[],void:false}]);
 const body=roundtrip(consolidatePlanarBody3(createBoxBody3(point3(0n,0n),1n,1n,1n)).body);assert.equal(body.faces.length,6);assert.throws(()=>consolidatePlanarBody3({...body}),RangeError);
});

test('microscopic gaps and distinct parallel supports remain separate without tolerance-based merging',()=>{
 const tiny=Rational.parse('1/1'+'0'.repeat(65)),half=Rational.parse('1/2'),unit=cube.map(f=>f.map(p=>point3(p.x.mul(half),p.y.mul(half),p.z.mul(half)))),upper=unit.map(f=>f.map(p=>point3(p.x,p.y,p.z.add(new Rational(1n)).add(tiny))));
 const s=preparePlanarSolid3([...upper,...unit]),r=consolidatePlanarSolid3(s),rebuilt=provenance(r);assert.equal(r.faces.length,12);assert.equal(r.sewn.topology.shells.length,2);assert.equal(rebuilt.volume.toString(),'2');
 assert.equal(rebuilt.locate(point3(half,half,new Rational(1n).add(tiny.mul(half)))),'outside');
 const right=createBoxBody3(point3(3n,0n),1n,1n,1n),left=createBoxBody3(point3(0n,0n),1n,1n,1n),body=roundtrip(consolidatePlanarBody3(booleanPlanarBodies3(right,left,'union')).body);
 assert.equal(body.record.shells.length,2);body.interiorSamples.forEach(p=>assert.equal(locateBody3(body,p),'inside'));
 assert.equal(locateBody3(body,point3(2n,half,half)),'outside');
});
