import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePlanarSolid3,point3,point2,extrudePolygon,triangle3,bodyFromCylinderMaterial3,restoreBody3,serializeBody3,locateBody3,Rational} from '../dist/index.js';
import {boundaryConvexPlanarMaterial3} from '../dist/geometry/convex-planar-material3.js';
const O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n),Z=point3(0n,0n,1n),tetra=[[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]];
test('convex tetrahedron retains four plane supports and independent exact simplex membership after replay',()=>{
 const source=preparePlanarSolid3(tetra),raw=boundaryConvexPlanarMaterial3(source);assert.ok(raw.faces.length>=4);assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'));assert.deepEqual([...new Set(raw.faces.map(f=>f.origin.kind==='halfspace'?f.origin.halfspace:-1))].sort(),[0,1,2,3]);assert.ok(raw.manifold);
 const body=restoreBody3(serializeBody3(bodyFromCylinderMaterial3(raw)));
 for(let x=-1n;x<=5n;x++)for(let y=-1n;y<=5n;y++)for(let z=-1n;z<=5n;z++){const outside=x<0n||y<0n||z<0n||x+y+z>4n,boundary=x===0n||y===0n||z===0n||x+y+z===4n,p=point3(new Rational(x,4n),new Rational(y,4n),new Rational(z,4n));assert.equal(locateBody3(body,p),outside?'outside':boundary?'boundary':'inside');}
 assert.throws(()=>boundaryConvexPlanarMaterial3({...source}),/factory/);
});
test('convex lowering rejects a genuine concave single shell and disconnected shells',()=>{
 const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],1n),concave=preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)));assert.equal(concave.shells.length,1);assert.throws(()=>boundaryConvexPlanarMaterial3(concave),/convex/);
 const displaced=tetra.map(face=>face.map(p=>point3(p.x.add(new Rational(3n)),p.y,p.z))),two=preparePlanarSolid3([...tetra,...displaced]);assert.throws(()=>boundaryConvexPlanarMaterial3(two),/shell/);
});
test('tetrahedron/cylinder intersection retains curved and original planar domains through Body replay',async()=>{
 const {prepareFiniteCylinder3,cylinder3,line3,boundaryCylinderMaterialExpression3,booleanCylinderMaterials3}=await import('../dist/index.js'),poly=boundaryConvexPlanarMaterial3(preparePlanarSolid3(tetra)),cyl=prepareFiniteCylinder3(cylinder3(line3(O,Z),'1/4'),-1n,1n),raw=booleanCylinderMaterials3(poly,boundaryCylinderMaterialExpression3([cyl],[],{kind:'cylinder',cylinder:0}),'intersection');
 assert.ok(raw.faces.some(f=>f.surface.kind==='cylinder'));assert.ok(raw.faces.some(f=>f.origin.kind==='halfspace'));const body=restoreBody3(serializeBody3(bodyFromCylinderMaterial3(raw)));
 for(const [p,expected] of [[point3('1/10','1/10','1/10'),'inside'],[point3('-1/10','1/10','1/10'),'outside'],[point3('2/5','2/5','1/10'),'outside'],[point3('1/4','1/4','3/4'),'outside'],[point3(0n,'1/4','1/4'),'boundary']] as const)assert.equal(locateBody3(body,p),expected);
});
test('reflected sheared translated convex supports preserve material orientation and rational bounds',()=>{
 const map=(p:ReturnType<typeof point3>)=>point3(p.y.sub(p.x).add(new Rational(2n)),p.y.sub(new Rational(3n)),p.z.add(new Rational(1n))),source=preparePlanarSolid3(tetra.map(face=>face.map(map).reverse())),raw=boundaryConvexPlanarMaterial3(source),body=restoreBody3(serializeBody3(bodyFromCylinderMaterial3(raw)));
 assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'));assert.equal(source.volume.toString(),'1/6');
 for(const [p,l] of [[point3('1/4','1/4','1/4'),'inside'],[point3(0n,'1/4','1/4'),'boundary'],[point3('-1/10','1/4','1/4'),'outside'],[point3('1/2','1/2','1/2'),'outside']] as const)assert.equal(locateBody3(body,map(p)),l);
});
