import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,line3,cylinder3,circle2,fullCircleArc2,extrudeBody3,createCylinderBody3,booleanMixedBodies3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3} from '../dist/index.js';
import type {Body3,CurveRegion2} from '../dist/index.js';
const circle=(x:bigint,y:bigint,r:bigint,d:'cw'|'ccw'='ccw')=>[{kind:'arc' as const,arc:fullCircleArc2(circle2(point2(x,y),r),d)}],q=(n:bigint)=>new Rational(n);
function replay(body:Body3){const r=restoreBody3(serializeBody3(body));assert.deepEqual(r.record,body.record);assert.ok(r.topology.closedOrientedIncidence);assert.equal(r.topology.issues.length,0);r.faces.forEach((f,i)=>assert.equal(locateBodyFace3(r,i,f.sample),'inside'));for(const p of r.interiorSamples)assert.equal(locateBody3(r,p),'inside');return r;}
const cylinder=(x:bigint,y:bigint,r:bigint,lo=0n,hi=2n)=>createCylinderBody3(cylinder3(line3(point3(x,y),point3(0n,0n,1n)),r),lo,hi);
test('restored circular Extrude with negative height and nonzero base composes with a real cylinder',()=>{
 const a=replay(extrudeBody3([circle(0n,0n,4n)],-2n,{baseZ:3n})),b=cylinder(1n,0n,4n,1n,3n),before=serializeBody3(a);assert.equal(a.construction.kind,'extrude');
 for(const operation of ['union','intersection','difference'] as const){const r=replay(booleanMixedBodies3(a,b,operation));assert.equal(r.construction.kind,'cylinder-material-expression');
  for(const x of ['-5/2','-3/2','-1/2','1/2','3/2','5/2','7/2'])for(const y of ['-3/2','-1/2','1/2','3/2'])for(const z of ['1/2','3/2','5/2','7/2']){const p=point3(x,y,z),height=p.z.compare(q(1n))>0&&p.z.compare(q(3n))<0,A=height&&p.x.mul(p.x).add(p.y.mul(p.y)).compare(q(4n))<0,dx=p.x.sub(q(1n)),B=height&&dx.mul(dx).add(p.y.mul(p.y)).compare(q(4n))<0,expected=operation==='union'?A||B:operation==='intersection'?A&&B:A&&!B;assert.equal(locateBody3(r,p),expected?'inside':'outside');}
 }
 assert.equal(serializeBody3(a),before);assert.throws(()=>booleanMixedBodies3({...a},b,'union'),/factory/);
});
test('circular annulus product Extrude preserves its through-hole in mixed intersection replay',()=>{
 const a=replay(extrudeBody3([circle(0n,0n,9n),circle(0n,0n,1n,'cw')],2n,{fillRule:'nonzero'})),before=serializeBody3(a),r=replay(booleanMixedBodies3(a,cylinder(0n,0n,4n),'intersection'));assert.equal(r.topology.shells.length,1);assert.equal(r.interiorSamples.length,1);
 for(const [p,l] of [[point3(0n,0n,1n),'outside'],[point3('3/2',0n,1n),'inside'],[point3(1n,0n,1n),'boundary'],[point3(2n,0n,1n),'boundary'],[point3('5/2',0n,1n),'outside'],[point3('3/2',0n,0n),'boundary']] as const)assert.equal(locateBody3(r,p),l);assert.equal(serializeBody3(a),before);
});
test('normalized circular islands and disconnected product components preserve three material regions',()=>{
 const profile:CurveRegion2=[circle(0n,0n,9n),circle(0n,0n,4n,'cw'),circle(0n,0n,1n),circle(8n,0n,1n)],a=replay(extrudeBody3(profile,2n,{fillRule:'nonzero'})),r=replay(booleanMixedBodies3(a,cylinder(12n,0n,1n),'difference'));assert.equal(r.topology.shells.length,3);assert.equal(r.interiorSamples.length,3);
 for(const x of ['-7/2','-5/2','-3/2','-1/2','1/2','3/2','5/2','7/2','15/2','17/2'])for(const y of ['-1/2','1/2']){const p=point3(x,y,1n),radial=p.x.mul(p.x).add(p.y.mul(p.y)),dx=p.x.sub(q(8n)),expected=radial.compare(q(9n))<0&&radial.compare(q(4n))>0||radial.compare(q(1n))<0||dx.mul(dx).add(p.y.mul(p.y)).compare(q(1n))<0;assert.equal(locateBody3(r,p),expected?'inside':'outside');}
});
test('nonzero fill normalization removes inactive inner circles before circular lowering',()=>{
 const a=replay(extrudeBody3([circle(0n,0n,9n),circle(0n,0n,1n)],2n,{fillRule:'nonzero'})),probe=createCylinderBody3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),new Rational(1n,4n)),0n,2n),r=replay(booleanMixedBodies3(a,probe,'intersection'));assert.equal(locateBody3(r,point3(0n,0n,1n)),'inside');assert.equal(locateBody3(r,point3('1/4',0n,1n)),'inside');assert.equal(locateBody3(r,point3('1/2',0n,1n)),'boundary');
});
test('arc-only product boundaries with multiple circle supports remain explicitly unsupported',()=>{
 const a=extrudeBody3([circle(0n,0n,4n),circle(1n,0n,4n)],2n,{fillRule:'nonzero'}),before=serializeBody3(a);assert.throws(()=>booleanMixedBodies3(a,cylinder(8n,0n,1n),'union'),/full circular boundary loops/);assert.equal(serializeBody3(a),before);
});
test('circular product Extrude intersects a perpendicular non-unit-axis cylinder with exact spatial SSI replay',()=>{
 const a=replay(extrudeBody3([circle(0n,0n,1n)],6n,{baseZ:-3n})),b=createCylinderBody3(cylinder3(line3(point3(0n,0n),point3(2n,0n,0n)),4n),'-3/2','3/2'),r=replay(booleanMixedBodies3(a,b,'intersection'));assert.equal(r.topology.shells.length,1);
 for(const x of ['-3/2','-1/2','1/2','3/2'])for(const y of ['-3/2','-1/2','1/2','3/2'])for(const z of ['-5/2','-3/2','-1/2','1/2','3/2','5/2']){const p=point3(x,y,z),expected=p.x.mul(p.x).add(p.y.mul(p.y)).compare(q(1n))<0&&p.y.mul(p.y).add(p.z.mul(p.z)).compare(q(4n))<0;assert.equal(locateBody3(r,p),expected?'inside':'outside');}
 for(const p of [point3(1n,0n,'3/2'),point3(0n,0n,2n),point3(1n,0n,2n)])assert.equal(locateBody3(r,p),'boundary');
});
test('irrational-radius circular Extrude retains exact translated circle support and fractional heights',()=>{
 const a=replay(extrudeBody3([circle(1n,-1n,2n)],'3/2',{baseZ:'-1/2'})),b=createCylinderBody3(cylinder3(line3(point3(1n,-1n),point3(0n,0n,1n)),3n),'-1/2',1n),r=replay(booleanMixedBodies3(a,b,'intersection'));
 for(const x of ['-1/2','1/2','3/2','5/2'])for(const y of ['-5/2','-3/2','-1/2','1/2']){const p=point3(x,y,0n),dx=p.x.sub(q(1n)),dy=p.y.add(q(1n)),expected=dx.mul(dx).add(dy.mul(dy)).compare(q(2n))<0;assert.equal(locateBody3(r,p),expected?'inside':'outside');}
 for(const [p,l] of [[point3(2n,0n,0n),'boundary'],[point3('5/2',-1n,0n),'outside'],[point3(2n,-1n,0n),'inside'],[point3(1n,-1n,1n),'boundary'],[point3(1n,-1n,'3/2'),'outside']] as const)assert.equal(locateBody3(r,p),l);
});
