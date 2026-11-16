import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,createCylinderBody3,createBoxBody3,splitBodyByPlane3,bodySplitInterface3,booleanMaterialBodies3,brepCurveEndpoints3,pointOnBRepCurve3,nativeBRepCurve3,compareAlgebraicPoints3,locateBodyFace3} from '../dist/index.js';
import type {BodyPlaneSplit3,KernelBody3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),cylinder=(r:bigint)=>createCylinderBody3(cylinder3(line3(O,Z),r),-2n,2n);
function check(split:BodyPlaneSplit3){
 const result=bodySplitInterface3(split);assert.equal(bodySplitInterface3(split),result);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.atoms));assert.throws(()=>bodySplitInterface3({...split}),/factory/);
 const equal=(a:Parameters<typeof compareAlgebraicPoints3>[0],b:Parameters<typeof compareAlgebraicPoints3>[0])=>assert.equal(compareAlgebraicPoints3(a,b),0);
 for(const [body,maps] of [[split.negative,result.negativeCoedges],[split.positive,result.positiveCoedges]] as const){
  const covered=new Set<number>();
  for(const row of maps){assert.ok(Object.isFrozen(row)&&Object.isFrozen(row.uses));assert.ok(row.uses.length>0);assert.ok(!covered.has(row.coedge));covered.add(row.coedge);const h=body.topology.coedges[row.coedge]!,original=body.topology.edges[h.edge]!.curve,curve=original.kind==='native'||original.kind==='cylinder-ssi'?original:nativeBRepCurve3(original);let at=body.topology.vertices[h.origin]!;
   for(const use of row.uses){const ends=brepCurveEndpoints3(result.atoms[use.edge]!.curve),start=use.direction===1?ends[0]:ends[1],end=use.direction===1?ends[1]:ends[0];equal(at,start);assert.ok(pointOnBRepCurve3(start,curve)&&pointOnBRepCurve3(end,curve));at=end;}equal(at,body.topology.vertices[h.target]!);
  }
 }
 for(const atom of result.atoms){const n=atom.negative.reduce((s,u)=>s+u.direction,0),p=atom.positive.reduce((s,u)=>s+u.direction,0);assert.equal(n+p,0);assert.equal(atom.boundary,n!==0);}
 return result;
}
test('oblique cylinder interface nodes complete elliptic coedge spans on a common table',()=>{
 const split=splitBodyByPlane3(cylinder(1n),plane3(1n,0n,1n)),r=check(split);assert.ok(r.negativeFaces.length&&r.positiveFaces.length);assert.ok(r.atoms.some(a=>a.curve.kind==='native'&&a.curve.curve.kind==='elliptic-arc'));assert.ok(r.atoms.every(a=>a.negative.length&&a.positive.length));assert.equal(r.locate(O),'inside');assert.equal(r.locate(point3(1n,0n,-1n)),'boundary');assert.equal(r.locate(point3(2n,0n,-2n)),'outside');assert.equal(r.locate(point3(0n,0n,1n)),'outside');
});
test('annular cut interface preserves its hole and distinguishes the inner and outer contours',()=>{
 const parent=booleanMaterialBodies3(cylinder(4n),cylinder(1n),'difference'),r=check(splitBodyByPlane3(parent,plane3(0n,0n,1n)));
 assert.ok(r.atoms.some(a=>!a.boundary));assert.equal(r.locate(point3(0n,'3/2',0n)),'inside');assert.equal(r.locate(O),'outside');assert.equal(r.locate(point3('3/2',0n,0n)),'inside');assert.equal(r.locate(point3(1n,0n,0n)),'boundary');assert.equal(r.locate(point3(2n,0n,0n)),'boundary');assert.equal(r.locate(point3(3n,0n,0n)),'outside');assert.ok(r.atoms.filter(a=>a.boundary).length>=4);
});
test('planar and repeated cuts expose live coedges while tangent cuts invent no interface',()=>{
 const box=createBoxBody3(O,1n,1n,1n),split=splitBodyByPlane3(box,plane3(1n,1n,0n,-1n)),r=check(split);assert.equal(r.locate(point3('1/2','1/2','1/2')),'inside');
 const again=splitBodyByPlane3(split.negative,plane3(0n,0n,1n,'-1/2'));assert.equal(check(again).locate(point3('1/4','1/4','1/2')),'inside');
 for(const parent of [box,cylinder(1n)] as readonly KernelBody3[]){const outside=check(splitBodyByPlane3(parent,plane3(0n,0n,1n,-2n)));assert.equal(outside.atoms.length,0);assert.equal(outside.negativeFaces.length,0);assert.equal(outside.positiveFaces.length,0);assert.equal(outside.locate(point3(0n,0n,2n)),'outside');}
});

test('a pre-existing cavity wall on the cut plane is excluded from the new common interface',()=>{
 const inner=createCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n),parent=booleanMaterialBodies3(cylinder(4n),inner,'difference'),split=splitBodyByPlane3(parent,plane3(0n,0n,1n,-1n)),r=check(split),center=point3(0n,0n,1n);
 assert.equal(r.locate(center),'outside');assert.equal(r.locate(point3('3/2',0n,1n)),'inside');
 const wall=split.positive.topology.faces.flatMap((_,id)=>locateBodyFace3(split.positive,id,point3('1/4','1/4',1n))==='inside'?[id]:[]);assert.ok(wall.length>0);assert.ok(wall.every(id=>!r.positiveFaces.includes(id)));
});
