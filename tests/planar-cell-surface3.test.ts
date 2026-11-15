import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,circle3,fullCircleArc3,circularArc3,planeFrame3,prepareRectangleFace3,partitionPlanarFaceByCurves3,classifyPlanarPartitionSurfaces3,classifyPointToSurface3,prepareCircularFace3,lineInterval3} from '../dist/index.js';
import type {Surface3,Curve3,PlanarFaceCurvePartition3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const face=()=>prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,-2n,2n);
const cylinder=(x=0n,y=0n,r=1n):Surface3=>({kind:'cylinder',cylinder:cylinder3(line3(point3(x,y,0n),Z),r)});
function checked(source:PlanarFaceCurvePartition3,surfaces:readonly Surface3[]){
 const result=classifyPlanarPartitionSurfaces3(source,surfaces);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.cells)&&Object.isFrozen(result.surfaces));
 result.cells.forEach((row,i)=>row.forEach((entry,j)=>{
  assert.ok(Object.isFrozen(row)&&Object.isFrozen(entry));
  if(entry.kind==='cut'){assert.equal(source.cells[i]!.locate(entry.point),'inside');assert.equal(classifyPointToSurface3(entry.point,surfaces[j]!),0);}
 }));return result;
}
test('an uncut cell reports hidden closed zero curves and lines away from its sample',()=>{
 const source=partitionPlanarFaceByCurves3(face(),[]),small:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3('1/2','1/2'),Z),'1/16')};
 assert.notEqual(classifyPointToSurface3(source.cells[0]!.sample,small),0);
 const result=checked(source,[small,{kind:'plane',plane:plane3(2n,0n,0n,-1n)}]);
 assert.ok(result.cells.flat().every(e=>e.kind==='cut'));
});
test('a complete circle partition certifies every open cell and rejects a missing half',()=>{
 const f=face(),arc:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(O,Z,1n))},surface=cylinder();
 const source=partitionPlanarFaceByCurves3(f,[arc]),result=checked(source,[surface]);
 assert.ok(result.cells.flat().every(e=>e.kind==='constant'));assert.ok(result.cells.some(r=>r[0]!.kind==='constant'&&r[0]!.sign===-1));
 for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++){
  const p=point3(`${x}/4`,`${y}/4`,0n);
  source.cells.forEach((cell,i)=>{if(cell.locate(p)==='inside'){const e=result.cells[i]![0]!;assert.equal(e.kind,'constant');if(e.kind==='constant')assert.equal(e.sign,classifyPointToSurface3(p,surface));}});
 }
 const half:Curve3={kind:'circular-arc',arc:circularArc3(circle3(O,Z,1n),X,point3(-1n,0n))};
 assert.ok(checked(partitionPlanarFaceByCurves3(f,[half]),[surface]).cells.some(r=>r[0]!.kind==='cut'));
});
test('double tangent generators inside a cell are unresolved zeros, not constant signs',()=>{
 const tangent:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,1n),X),1n)};
 const result=checked(partitionPlanarFaceByCurves3(face(),[]),[tangent]);assert.ok(result.cells.every(r=>r[0]!.kind==='cut'));
});
test('boundary-only tangency and coincident plane supports are distinguished',()=>{
 const f=prepareRectangleFace3(planeFrame3(O,X,Y),0n,2n,-1n,1n),source=partitionPlanarFaceByCurves3(f,[]);
 const result=checked(source,[cylinder(-1n),{kind:'plane',plane:plane3(0n,0n,2n)},{kind:'plane',plane:plane3(0n,0n,-3n)}]);
 for(const row of result.cells){assert.deepEqual(row[0],{kind:'constant',sign:1,sides:{minus:1,plus:1}});assert.deepEqual(row[1],{kind:'contained',sides:{minus:-1,plus:1}});assert.deepEqual(row[2],{kind:'contained',sides:{minus:1,plus:-1}});}
 assert.throws(()=>classifyPlanarPartitionSurfaces3({...source,cells:[]},[]),RangeError);
});
test('tilted rational charts retain complete ellipse zero detection',()=>{
 const f=prepareRectangleFace3(planeFrame3(O,point3(1n,0n,1n),Y),-2n,2n,-2n,2n),source=partitionPlanarFaceByCurves3(f,[]);
 const result=checked(source,[cylinder(),{kind:'plane',plane:plane3(0n,1n,0n,-1n)}]);assert.ok(result.cells.flat().every(e=>e.kind==='cut'));
});

test('zeros confined to a hole or shared vertical boundary are not interior cuts',()=>{
 const annulus=prepareCircularFace3(circle3(O,Z,4n),[circle3(O,Z,1n)]),source=partitionPlanarFaceByCurves3(annulus,[]);
 const small:Surface3={kind:'cylinder',cylinder:cylinder3(line3(O,Z),'1/4')};
 const result=checked(source,[small,cylinder(),cylinder(0n,0n,4n)]);
 for(const row of result.cells){assert.equal(row[0]!.kind,'constant');assert.equal(row[1]!.kind,'constant');assert.equal(row[2]!.kind,'constant');if(row[0]!.kind==='constant')assert.equal(row[0]!.sign,1);if(row[1]!.kind==='constant')assert.equal(row[1]!.sign,1);if(row[2]!.kind==='constant')assert.equal(row[2]!.sign,-1);}
 const cut:Curve3={kind:'line',interval:lineInterval3(line3(point3(0n,-1n),Y),0n,2n)};
 const vertical=partitionPlanarFaceByCurves3(face(),[cut]);
 assert.ok(checked(vertical,[{kind:'plane',plane:plane3(1n,0n,0n)}]).cells.flat().every(e=>e.kind==='constant'));
});
