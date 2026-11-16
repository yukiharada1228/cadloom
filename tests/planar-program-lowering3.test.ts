import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,point3,line3,cylinder3,triangle3,extrudePolygon,preparePlanarSolid3,preparePlanarMaterialProgram3,strictCylinderMaterialProgramLocation3,extrudeBody3,createCylinderBody3,booleanMaterialBodies3,restoreBody3,serializeBody3,locateBody3} from '../dist/index.js';
const xy=[[0n,0n],[2n,0n],[2n,1n],[1n,1n],[1n,2n],[0n,2n]] as const;
const ring=()=>{const p=xy.map(([x,y])=>point2(x,y));return p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));};
test('concave and empty planar solids become owned definitions without constructing material boundaries',()=>{
 const mesh=extrudePolygon([xy.map(([x,y])=>point2(x,y))],2n),source=preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!))),p=preparePlanarMaterialProgram3(source);let checked=0;
 for(let x=-1;x<=3;x++)for(let y=-1;y<=3;y++)for(let z=-1;z<=3;z++){
  const q=point3(`${17*x+1}/17`,`${19*y+2}/19`,`${23*z+3}/23`),actual=strictCylinderMaterialProgramLocation3(p,q);if(actual===null)continue;
  assert.equal(actual,x>=0&&x<2&&y>=0&&y<2&&z>=0&&z<2&&(x<1||y<1)?'inside':'outside');assert.equal(source.locate(q),actual);checked++;
 }
 assert.ok(checked>100);assert.deepEqual(Object.keys(p),['cylinders','planes','expression']);
 assert.throws(()=>preparePlanarMaterialProgram3({...source}),RangeError);
 const empty=preparePlanarMaterialProgram3(preparePlanarSolid3([]));assert.equal(strictCylinderMaterialProgramLocation3(empty,point3('1/3','1/5','1/7')),'outside');
});
test('restored straight concave extrusion enters the definition-driven kernel with its missing corner intact',()=>{
 const extrusion=restoreBody3(serializeBody3(extrudeBody3([ring()],2n))),guard=createCylinderBody3(cylinder3(line3(point3(0n,0n,0n),point3(0n,0n,1n)),9n),-1n,3n);
 const result=restoreBody3(serializeBody3(booleanMaterialBodies3(extrusion,guard,'intersection')));
 assert.equal(result.construction.kind,'surface-material-expression');assert.ok(result.topology.closedOrientedIncidence);
 for(const [p,expected] of [[point3('1/2','3/2',1n),'inside'],[point3('3/2','1/2',1n),'inside'],[point3('3/2','3/2',1n),'outside'],[point3(1n,'3/2',1n),'boundary']] as const)assert.equal(locateBody3(result,p),expected);
});
