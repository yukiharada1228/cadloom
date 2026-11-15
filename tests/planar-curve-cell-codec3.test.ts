import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,lineInterval3,planeFrame3,prepareRectangleFace3,partitionPlanarFaceByCurves3,encodePlanarCurveCellDomain3,decodeMixedFaceDomain3,encodeExactPoint3,bodyRecordFromMixedTopology3,restoreMixedBRepFaces3,circle3,fullCircleArc3,sewMixedBRepFaces3,nativeBRepCurve3,algebraicCoordinates3} from '../dist/index.js';
import type {Curve3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const base=prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,-2n,2n);
const cuts:Curve3[]=[{kind:'circular-arc',arc:fullCircleArc3(circle3(O,Z,1n))},{kind:'line',interval:lineInterval3(line3(point3(-1n,0n,0n),X),0n,2n)}];
test('finite native curve cell records reconstruct every cell and bind complete sewn boundaries',()=>{
 const partition=partitionPlanarFaceByCurves3(base,cuts),sewn=sewMixedBRepFaces3(partition.cells.map(cell=>({surface:{kind:'plane' as const,plane:base.surface},sense:base.sense,loops:[cell.boundary.map(nativeBRepCurve3)]})),{splitPoints:partition.events}),raw=bodyRecordFromMixedTopology3(sewn.topology,[{shells:sewn.topology.shells.map((_,i)=>i),void:false}]);
 const record={...raw,faces:raw.faces.map((f,i)=>({...f,domain:encodePlanarCurveCellDomain3(partition,i)}))};
 const restored=restoreMixedBRepFaces3(JSON.parse(JSON.stringify(record)));
 assert.equal(restored.faces.length,partition.cells.length);
 partition.cells.forEach((cell,i)=>{
  const decoded=restored.faces[i]!;assert.equal(decoded.locate(cell.sample),'inside');
  for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++){const p=point3(`${x}/4`,`${y}/4`,0n);assert.equal(decoded.locate(p),cell.locate(p));}
 });
});
test('reversed orientation is retained while witness, ownership, range and plane errors reject',()=>{
 const partition=partitionPlanarFaceByCurves3(base,cuts),record=encodePlanarCurveCellDomain3(partition,0,-1),decoded=decodeMixedFaceDomain3(JSON.parse(JSON.stringify(record)));
 assert.equal(decoded.sense,-base.sense);assert.equal(decoded.locate(partition.cells[0]!.sample),'inside');
 assert.throws(()=>encodePlanarCurveCellDomain3({...partition},0),RangeError);
 for(const index of [-1,0.5,partition.cells.length])assert.throws(()=>encodePlanarCurveCellDomain3(partition,index),RangeError);
 assert.throws(()=>encodePlanarCurveCellDomain3(partition,0,0 as 1),RangeError);
 for(const p of [point3(9n,0n,0n),point3(2n,2n,0n),point3(0n,0n,1n)])assert.throws(()=>decodeMixedFaceDomain3({...record,sample:encodeExactPoint3(algebraicCoordinates3(p.x,p.y,p.z))}),RangeError);
 const off=partitionPlanarFaceByCurves3(base,[]),valid=encodePlanarCurveCellDomain3(off,0);
 assert.equal(decodeMixedFaceDomain3(valid).locate(O),'inside');
 assert.throws(()=>decodeMixedFaceDomain3({...valid,curves:[{kind:'line',origin:['0','0','1'],direction:['1','0','0'],lower:'0',upper:'1'}]}));
});
