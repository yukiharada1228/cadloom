import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,line3,cylinder3,circle2,circularArc2,fullCircleArc2,extrudeBody3,prepareExtrudeMaterialProgram3,strictCylinderMaterialProgramLocation3,createCylinderBody3,booleanMaterialBodies3,restoreBody3,serializeBody3,locateBody3} from '../dist/index.js';
const square=()=>{const p=[point2(-1n,-1n),point2(1n,-1n),point2(1n,1n),point2(-1n,1n)];return p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));};
const circle=(r:Rational|bigint)=>[{kind:'arc' as const,arc:fullCircleArc2(circle2(point2(0n,0n),r))}];
function plate(){return restoreBody3(serializeBody3(extrudeBody3([square(),circle(new Rational(1n,4n))],-2n,{baseZ:3n})));}
test('a polygon with a circular hole lowers from its actual normalized extrusion to strict exact predicates',()=>{
 const body=plate(),p=prepareExtrudeMaterialProgram3(body);assert.ok(p.cylinders.length>=2);let checked=0;
 for(let x=-5;x<=5;x++)for(let y=-5;y<=5;y++){
  const q=point3(`${2*x+1}/8`,`${2*y+1}/8`,2n),actual=strictCylinderMaterialProgramLocation3(p,q);if(actual===null)continue;
  const inside=Math.abs(2*x+1)<8&&Math.abs(2*y+1)<8&&(2*x+1)**2+(2*y+1)**2>16;
  assert.equal(actual,inside?'inside':'outside');assert.equal(locateBody3(body,q),actual);checked++;
 }assert.ok(checked>100);assert.throws(()=>prepareExtrudeMaterialProgram3({...body}),RangeError);
});
test('mixed polygon/circle product material enters the common kernel without filling its hole',()=>{
 const body=plate(),guard=createCylinderBody3(cylinder3(line3(point3(-1n,-1n,0n),point3(0n,0n,1n)),9n),0n,4n),result=restoreBody3(serializeBody3(booleanMaterialBodies3(body,guard,'intersection')));
 assert.equal(result.construction.kind,'surface-material-expression');assert.equal(result.topology.shells.length,1);
 assert.ok(result.topology.faces.some(f=>f.surface.kind==='cylinder'));
 for(const [p,expected] of [[point3(0n,0n,2n),'outside'],[point3('3/4',0n,2n),'inside'],[point3('1/2',0n,2n),'boundary'],[point3('3/4',0n,1n),'boundary'],[point3('3/4',0n,0n),'outside']] as const)assert.equal(locateBody3(result,p),expected);
});
test('circular annuli retain parity and a certified arc-line loop lowers exactly',()=>{
 const annulus=extrudeBody3([circle(4n),circle(1n)],2n),p=prepareExtrudeMaterialProgram3(annulus);
 assert.equal(strictCylinderMaterialProgramLocation3(p,point3(0n,0n,1n)),'outside');assert.equal(strictCylinderMaterialProgramLocation3(p,point3('3/2',0n,1n)),'inside');
 const half=extrudeBody3([[{kind:'arc',arc:circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(-1n,0n))},{kind:'segment',segment:{start:point2(-1n,0n),end:point2(1n,0n)}}]],2n);
 const halfProgram=prepareExtrudeMaterialProgram3(half);assert.equal(strictCylinderMaterialProgramLocation3(halfProgram,point3(0n,'1/2',1n)),'inside');assert.equal(strictCylinderMaterialProgramLocation3(halfProgram,point3(0n,'-1/2',1n)),'outside');
});
test('a polygon island inside a circular hole survives normalized loop parity',()=>{
 const p=[point2('-1/4','-1/4'),point2('1/4','-1/4'),point2('1/4','1/4'),point2('-1/4','1/4')],island=p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));
 const body=extrudeBody3([square(),circle(new Rational(1n,4n)),island],2n),program=prepareExtrudeMaterialProgram3(body);
 for(const [p,expected] of [[point3(0n,0n,1n),'inside'],[point3('2/5',0n,1n),'outside'],[point3('3/4',0n,1n),'inside']] as const){assert.equal(strictCylinderMaterialProgramLocation3(program,p),expected);assert.equal(locateBody3(body,p),expected);}
});
