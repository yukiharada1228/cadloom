import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,point3,circle2,circularArc2,fullCircleArc2,extrudeBody3,booleanCurveRegions2,prepareExtrudeMaterialProgram3,strictCylinderMaterialProgramLocation3,boundaryMaterialSurfaces3,bodyFromMaterialSurfaceBoundary3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
const circle=(x=0n)=>circle2(point2(x,0n),1n),disk=(x=0n)=>[[{kind:'arc' as const,arc:fullCircleArc2(circle(x))}]];
test('a diameter and semicircle are certified exactly and replay as a common curved Body',()=>{
 const source=extrudeBody3([[{kind:'arc',arc:circularArc2(circle(),point2(1n,0n),point2(-1n,0n))},{kind:'segment',segment:{start:point2(-1n,0n),end:point2(1n,0n)}}]],2n),program=prepareExtrudeMaterialProgram3(source);
 const result=restoreBody3(serializeBody3(bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(program,{requireClosed:true}))));
 for(const [p,expected] of [[point3(0n,'1/2',1n),'inside'],[point3(0n,'-1/2',1n),'outside'],[point3(0n,0n,1n),'boundary'],[point3(1n,0n,1n),'boundary'],[point3(0n,'1/2',0n),'boundary']] as const)assert.equal(locateBody3(result,p),expected);
 assert.ok(result.topology.faces.some(f=>f.surface.kind==='cylinder'));assert.equal(result.construction.kind,'surface-material-expression');
});
test('a two-circle lens with irrational endpoints matches independent disk inequalities',()=>{
 const profile=booleanCurveRegions2(disk(),disk(1n),'intersection'),source=extrudeBody3(profile.rings,2n),program=prepareExtrudeMaterialProgram3(source);let count=0;
 for(let x=-4;x<=12;x++)for(let y=-8;y<=8;y++){
  const a=2*x+1,b=2*y+1,p=point3(`${a}/16`,`${b}/16`,1n),actual=strictCylinderMaterialProgramLocation3(program,p);if(actual===null)continue;
  assert.equal(actual,a*a+b*b<256&&(a-16)**2+b*b<256?'inside':'outside');assert.equal(locateBody3(source,p),actual);count++;
 }assert.ok(count>250);
});
test('a stadium is rejected when intersection of its supports is not its filled region',()=>{
 const source=extrudeBody3([[{kind:'segment',segment:{start:point2(0n,-1n),end:point2(2n,-1n)}},{kind:'arc',arc:circularArc2(circle(2n),point2(2n,-1n),point2(2n,1n))},{kind:'segment',segment:{start:point2(2n,1n),end:point2(0n,1n)}},{kind:'arc',arc:circularArc2(circle(),point2(0n,1n),point2(0n,-1n))}]],2n);
 assert.equal(locateBody3(source,point3(1n,0n,1n)),'inside');assert.throws(()=>prepareExtrudeMaterialProgram3(source),/not certified/);
});
test('clockwise circular notch lowers as a bounded difference rather than a filled disk',()=>{
 const p=[point2(1n,0n),point2(2n,0n),point2(2n,2n),point2(-2n,2n),point2(-2n,0n),point2(-1n,0n)],lines=p.slice(0,-1).map((start,i)=>({kind:'segment' as const,segment:{start,end:p[i+1]!}}));
 const source=extrudeBody3([[...lines,{kind:'arc',arc:circularArc2(circle(),point2(-1n,0n),point2(1n,0n),{direction:'cw'})}]],2n),program=prepareExtrudeMaterialProgram3(source);
 for(const [p,expected] of [[point3(0n,'1/2',1n),'outside'],[point3(0n,'3/2',1n),'inside'],[point3('3/2','1/2',1n),'inside']] as const){assert.equal(strictCylinderMaterialProgramLocation3(program,p),expected);assert.equal(locateBody3(source,p),expected);}
});
