import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,plane3,createCylinderBody3,booleanMaterialBodies3,splitBodyByPlane3,rejoinBodyPlaneSplit3,locateBody3,serializeBody3,restoreBody3} from '../dist/index.js';
test('rejoining intersecting unequal perpendicular cylinders retains algebraic SSI outer edges',()=>{
 const O=point3(0n,0n,0n),a=createCylinderBody3(cylinder3(line3(O,point3(0n,0n,1n)),1n),-2n,2n),b=createCylinderBody3(cylinder3(line3(O,point3(1n,0n,0n)),2n),-2n,2n),parent=booleanMaterialBodies3(a,b,'intersection'),joined=rejoinBodyPlaneSplit3(splitBodyByPlane3(parent,plane3(0n,1n,0n,'-1/3')));
 assert.ok(joined.sewing.topology.closedOrientedIncidence);assert.deepEqual(joined.sewing.topology.issues,[]);assert.ok(joined.sewing.topology.edges.some(e=>e.curve.kind==='cylinder-ssi'));assert.ok('curves' in joined.body.record&&joined.body.record.curves.some(c=>c.kind==='cylinder-ssi'));
 const restored=restoreBody3(serializeBody3(joined.body));
 // All probes are within both finite axial intervals; radial inequalities suffice.
 for(const [x,y,z] of [['0','0','0'],['0','1/2','1'],['1/2','0','1'],['0','0','3/2'],['0','3/2','0'],['1','0','0']] as const){const p=point3(x,y,z),r1=p.x.mul(p.x).add(p.y.mul(p.y)),r2=p.y.mul(p.y).add(p.z.mul(p.z)),s1=r1.compare(new Rational(1n)),s2=r2.compare(new Rational(2n)),expected=s1>0||s2>0?'outside':s1===0||s2===0?'boundary':'inside';assert.equal(locateBody3(joined.body,p),expected);assert.equal(locateBody3(restored,p),expected);}
});
