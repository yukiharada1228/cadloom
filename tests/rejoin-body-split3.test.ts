import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,plane3,createCylinderBody3,createBoxBody3,splitBodyByPlane3,rejoinBodyPlaneSplit3,bodySplitInterface3,booleanMaterialBodies3,locateBody3,serializeBody3,restoreBody3,brepCurveEndpoints3,compareAlgebraicPoints3} from '../dist/index.js';
import type {BodyPlaneSplit3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=point3(0n,0n,1n),cylinder=(r:bigint,lo:bigint=-2n,hi:bigint=2n)=>createCylinderBody3(cylinder3(line3(O,Z),r),lo,hi);
function check(split:BodyPlaneSplit3){
 const joined=rejoinBodyPlaneSplit3(split),section=bodySplitInterface3(split);assert.equal(rejoinBodyPlaneSplit3(split),joined);assert.notEqual(joined.body,split.parent);assert.ok(Object.isFrozen(joined)&&Object.isFrozen(joined.faces));assert.throws(()=>rejoinBodyPlaneSplit3({...split}),/factory/);
 assert.equal(joined.faces.length,joined.sewing.topology.faces.length);assert.equal(joined.faces.length,split.negative.faces.length+split.positive.faces.length-section.negativeFaces.length-section.positiveFaces.length);
 joined.faces.forEach((row,id)=>{const body=row.side===-1?split.negative:split.positive,t=body.topology,f=t.faces[row.face]!,uses=joined.sewing.sourceUses[id]!;assert.ok(!(row.side===-1?section.negativeFaces:section.positiveFaces).includes(row.face));assert.equal(uses.length,f.loops.length);assert.equal(locateBody3(split.parent,body.faces[row.face]!.sample),'boundary');
  f.loops.forEach((loop,l)=>t.loops[loop]!.coedges.forEach((coedge,i)=>{const h=t.coedges[coedge]!,atoms=uses[l]![i]!;assert.ok(atoms.length>0);let at=t.vertices[h.origin]!;for(const atom of atoms){const ends=brepCurveEndpoints3(joined.sewing.topology.edges[atom.edge]!.curve),a=atom.direction===1?ends[0]:ends[1],b=atom.direction===1?ends[1]:ends[0];assert.equal(compareAlgebraicPoints3(at,a),0);at=b;}assert.equal(compareAlgebraicPoints3(at,t.vertices[h.target]!),0);}));
 });
 for(const edge of joined.sewing.topology.edges){assert.ok(edge.coedges.length>=2);assert.equal(edge.coedges.reduce((s,h)=>s+joined.sewing.topology.coedges[h]!.direction,0),0);}
 return joined;
}
test('oblique cylinder rejoin actually sews outer patches and constructs a replayable union Body',()=>{
 const split=splitBodyByPlane3(cylinder(1n),plane3(1n,0n,1n)),joined=check(split),restored=restoreBody3(serializeBody3(joined.body));assert.ok(joined.sewing.topology.closedOrientedIncidence);assert.deepEqual(joined.sewing.topology.issues,[]);
 for(const x of ['-1','0','1/2','2'])for(const y of ['-1/2','0','1/2'])for(const z of ['-2','0','1']){const p=point3(x,y,z),r=p.x.mul(p.x).add(p.y.mul(p.y)).compare(new Rational(1n)),expected=r>0?'outside':r===0||z==='-2'?'boundary':'inside';assert.equal(locateBody3(joined.body,p),expected);assert.equal(locateBody3(restored,p),expected);}
 const next=splitBodyByPlane3(restored,plane3(0n,1n,0n));assert.equal(locateBody3(next.positive,point3(0n,'1/2',0n)),'inside');
});
test('rejoin keeps an original cavity wall while cancelling only newly created annular caps',()=>{
 const parent=booleanMaterialBodies3(cylinder(4n),cylinder(1n,-1n,1n),'difference'),split=splitBodyByPlane3(parent,plane3(0n,0n,1n,-1n)),joined=check(split);assert.ok(joined.sewing.topology.closedOrientedIncidence);assert.equal(locateBody3(joined.body,O),'outside');assert.equal(locateBody3(joined.body,point3(0n,0n,1n)),'boundary');assert.equal(locateBody3(joined.body,point3(0n,0n,'3/2')),'inside');assert.equal(locateBody3(joined.body,point3('3/2',0n,0n)),'inside');
});
test('planar contact rejoin retains balanced multi-use edges without claiming manifold incidence',()=>{
 const a=createBoxBody3(O,1n,1n,1n),b=createBoxBody3(point3(1n,1n,0n),1n,1n,1n),parent=booleanMaterialBodies3(a,b,'union',{contacts:'preserve'}),joined=check(splitBodyByPlane3(parent,plane3(0n,0n,1n,'-1/2')));assert.ok('kind' in joined.body&&joined.body.kind==='cellular-body');assert.equal(joined.sewing.topology.closedOrientedIncidence,false);assert.ok(joined.sewing.topology.edges.some(e=>e.coedges.length===4));assert.equal(locateBody3(joined.body,point3('1/2','1/2','1/2')),'inside');assert.equal(locateBody3(joined.body,point3('3/2','3/2','1/2')),'inside');assert.equal(locateBody3(joined.body,point3(1n,1n,'1/2')),'boundary');
});
test('one-sided and empty splits rejoin without fabricating interface faces',()=>{
 const parent=createBoxBody3(O,1n,1n,1n),split=splitBodyByPlane3(parent,plane3(0n,0n,1n,-2n)),joined=check(split);assert.equal(locateBody3(joined.body,point3('1/2','1/2','1/2')),'inside');const empty=check(splitBodyByPlane3(split.positive,plane3(1n,0n,0n)));assert.equal(empty.faces.length,0);assert.equal(empty.body.faces.length,0);assert.equal(empty.sewing.topology.edges.length,0);
});
