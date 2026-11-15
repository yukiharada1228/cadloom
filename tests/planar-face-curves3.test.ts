import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,lineInterval3,circle3,fullCircleArc3,circularArc3,planeFrame3,prepareRectangleFace3,prepareCylinderFace3,cylinder3,intersectPlanarCylinderFaces3,partitionPlanarFaceByCurves3,curveEndpoints3,compareAlgebraicPoints3,algebraicCoordinates3,reverseCurve3,classifyPointToSurface3,interiorPointOnEllipticArc3,prepareCircularFace3} from '../dist/index.js';
import type {Curve3,PreparedPlanarFace3,PlanarFaceCurvePartition3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const base=()=>prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,-2n,2n);
const line=(a:ReturnType<typeof point3>,b:ReturnType<typeof point3>):Curve3=>({kind:'line',interval:lineInterval3(line3(a,point3(b.x.sub(a.x),b.y.sub(a.y),b.z.sub(a.z))),0n,1n)});
function coverage(face:PreparedPlanarFace3,result:PlanarFaceCurvePartition3){
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.cells)&&Object.isFrozen(result.cutCurves));
 for(let x=-9;x<=9;x++)for(let y=-9;y<=9;y++){
  const p=point3(`${x}/4`,`${y}/4`,0n),locations=result.cells.map(c=>c.locate(p));
  assert.equal(locations.some(l=>l!=='outside'),face.locate(p)!=='outside',`coverage ${x},${y}`);
  assert.ok(locations.filter(l=>l==='inside').length<=1,`overlap ${x},${y}`);
 }
 for(const cell of result.cells){assert.equal(cell.locate(cell.sample),'inside');assert.equal(face.locate(cell.sample),'inside');assert.ok(Object.isFrozen(cell)&&Object.isFrozen(cell.boundary));}
 assert.equal(result.sewn.topology.faces.length,result.cells.length);
}
test('finite crossing and dangling segments subdivide the actual planar domain',()=>{
 const face=base(),cuts=[line(point3(-1n,0n),point3(1n,0n)),line(point3(0n,-1n),point3(0n,1n))];
 const result=partitionPlanarFaceByCurves3(face,cuts);coverage(face,result);
 for(const p of [O,...cuts.flatMap(curveEndpoints3)]){
  const q=algebraicCoordinates3(p.x,p.y,p.z);assert.ok(result.sewn.topology.vertices.some(v=>compareAlgebraicPoints3(v,q)===0));
 }
 const reversed=partitionPlanarFaceByCurves3(face,[...cuts].reverse().map(reverseCurve3));coverage(face,reversed);assert.equal(reversed.cells.length,result.cells.length);
});
test('closed conics and line cuts produce cells with consistent exact cylinder sides',()=>{
 const face=base(),c=cylinder3(line3(O,Z),1n),circle:Curve3={kind:'circular-arc',arc:fullCircleArc3(circle3(O,Z,1n))};
 const result=partitionPlanarFaceByCurves3(face,[circle,line(point3(-2n,0n),point3(2n,0n))]);coverage(face,result);
 for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++){
  const p=point3(`${x}/4`,`${y}/4`,0n);
  for(const cell of result.cells)if(cell.locate(p)==='inside')assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:c}),classifyPointToSurface3(cell.sample,{kind:'cylinder',cylinder:c}));
 }
});
test('finite planar/cylinder intersection pieces are inserted as planar cell boundaries',()=>{
 const face=prepareRectangleFace3(planeFrame3(O,X,Y),-2n,2n,'-1/2','1/2'),wall=prepareCylinderFace3(cylinder3(line3(O,Z),1n),-1n,1n),section=intersectPlanarCylinderFaces3(face,wall);
 const result=partitionPlanarFaceByCurves3(face,section.curves.map(c=>c.curve));coverage(face,result);
 for(const p of section.curves.flatMap(c=>curveEndpoints3(c.curve)))assert.ok(result.sewn.topology.vertices.some(v=>compareAlgebraicPoints3(v,p)===0));
 assert.ok(result.cells.some(c=>c.boundary.some(b=>b.kind==='elliptic-arc')));
});
test('empty and outside cuts preserve coverage while noncoplanar whole arcs are rejected',()=>{
 const face=base();coverage(face,partitionPlanarFaceByCurves3(face,[]));
 coverage(face,partitionPlanarFaceByCurves3(face,[line(point3(3n,0n),point3(4n,0n))]));
 const arc:Curve3={kind:'circular-arc',arc:circularArc3(circle3(O,X,1n),point3(0n,1n),point3(0n,-1n))};
 assert.throws(()=>partitionPlanarFaceByCurves3(face,[arc]),/entirely/);
 assert.throws(()=>partitionPlanarFaceByCurves3({...face,locate:()=> 'inside'},[]),RangeError);
});

test('a finite semicircle is not extended to its missing lower half',()=>{
 const face=base(),arc:Curve3={kind:'circular-arc',arc:circularArc3(circle3(O,Z,1n),X,point3(-1n,0n))};
 const result=partitionPlanarFaceByCurves3(face,[arc]);coverage(face,result);
 const elliptic=result.cells.flatMap(c=>c.boundary).filter(c=>c.kind==='elliptic-arc');assert.ok(elliptic.length>0);
 for(const curve of elliptic)if(curve.kind==='elliptic-arc')assert.ok(interiorPointOnEllipticArc3(curve.arc).y.sign()>=0);
});
test('a face hole stays outside every cell when finite cuts pass through it',()=>{
 const face=prepareCircularFace3(circle3(O,Z,4n),[circle3(O,Z,1n)]);
 const result=partitionPlanarFaceByCurves3(face,[line(point3(-3n,0n),point3(3n,0n))]);coverage(face,result);
 assert.ok(result.cells.every(c=>c.locate(O)==='outside'));
});
