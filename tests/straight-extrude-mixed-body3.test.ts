import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,line3,cylinder3,circle2,fullCircleArc2,extrudeBody3,createCylinderBody3,booleanMixedBodies3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,planarBodyVolumeMoments3} from '../dist/index.js';
import type {Body3} from '../dist/index.js';
const ring=(xy:readonly (readonly [bigint,bigint])[])=>{const p=xy.map(([x,y])=>point2(x,y));return p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));};
function replay(body:Body3){const r=restoreBody3(serializeBody3(body));assert.deepEqual(r.record,body.record);assert.ok(r.topology.closedOrientedIncidence);assert.equal(r.topology.issues.length,0);r.faces.forEach((f,i)=>assert.equal(locateBodyFace3(r,i,f.sample),'inside'));for(const p of r.interiorSamples)assert.equal(locateBody3(r,p),'inside');return r;}
function l(dx:bigint){return replay(extrudeBody3([ring([[dx,0n],[dx+2n,0n],[dx+2n,1n],[dx+1n,1n],[dx+1n,2n],[dx,2n]])],2n));}
test('restored concave product Extrude pairs use native planar regularized Booleans and preserve inputs',()=>{
 const a=l(0n),b=l(1n),before=[serializeBody3(a),serializeBody3(b)];assert.equal(a.construction.kind,'extrude');
 for(const operation of ['union','intersection','difference'] as const){const r=replay(booleanMixedBodies3(a,b,operation));assert.equal(r.construction.kind,'planar');assert.equal(locateBody3(r,point3(1n,'3/2',1n)),operation==='union'?'inside':operation==='intersection'?'outside':'boundary');assert.equal(locateBody3(r,point3('3/2','1/2',1n)),operation==='difference'?'outside':'inside');if(operation==='union')assert.equal(planarBodyVolumeMoments3(r).volume.toString(),'10');}
 assert.equal(serializeBody3(a),before[0]);assert.equal(serializeBody3(b),before[1]);assert.throws(()=>booleanMixedBodies3({...a},b,'union'),/factory/);assert.throws(()=>booleanMixedBodies3(a,b,'bad' as any),/operation/);
});
test('restored straight-profile Extrude with a through-hole intersects a real cylinder without filling the hole',()=>{
 const a=replay(extrudeBody3([ring([[0n,0n],[4n,0n],[4n,4n],[0n,4n]]),ring([[1n,1n],[1n,3n],[3n,3n],[3n,1n]])],2n,{fillRule:'nonzero'})),before=serializeBody3(a),b=createCylinderBody3(cylinder3(line3(point3(2n,2n),point3(0n,0n,1n)),new Rational(9n,4n)),0n,2n),r=replay(booleanMixedBodies3(a,b,'intersection'));
 assert.equal(r.construction.kind,'cylinder-material-expression');assert.equal(r.topology.shells.length,1);assert.equal(r.interiorSamples.length,1);
 for(const [p,l] of [[point3(2n,2n,1n),'outside'],[point3('3/4',2n,1n),'inside'],[point3('1/2',2n,1n),'boundary'],[point3(1n,2n,1n),'boundary'],[point3('3/4','3/4',1n),'outside'],[point3('3/4',2n,0n),'boundary']] as const)assert.equal(locateBody3(r,p),l);assert.equal(serializeBody3(a),before);
});
test('curved-profile product Extrude remains explicitly unsupported by mixed Body lowering',()=>{
 const a=extrudeBody3([[{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n))}]],2n),b=createCylinderBody3(cylinder3(line3(point3(4n,0n),point3(0n,0n,1n)),1n),0n,2n),before=serializeBody3(a);assert.throws(()=>booleanMixedBodies3(a,b,'union'),/curved-profile Extrude/);assert.equal(serializeBody3(a),before);
});
test('reverse cylinder minus straight-profile Extrude recovers the planar tunnel with exact volume moments',()=>{
 const a=replay(extrudeBody3([ring([[0n,0n],[4n,0n],[4n,4n],[0n,4n]]),ring([[1n,1n],[1n,3n],[3n,3n],[3n,1n]])],2n,{fillRule:'nonzero'})),b=createCylinderBody3(cylinder3(line3(point3(2n,2n),point3(0n,0n,1n)),new Rational(9n,4n)),0n,2n),r=replay(booleanMixedBodies3(b,a,'difference'));
 for(const [p,l] of [[point3(2n,2n,1n),'inside'],[point3('3/4',2n,1n),'outside'],[point3('1/2',2n,1n),'outside'],[point3(1n,2n,1n),'boundary']] as const)assert.equal(locateBody3(r,p),l);
 const m=planarBodyVolumeMoments3(r);assert.equal(m.volume.toString(),'8');assert.deepEqual(m.centroid,point3(2n,2n,1n));assert.deepEqual(m.inertiaAtCentroid.map(row=>row.map(v=>v.toString())),[['16/3','0','0'],['0','16/3','0'],['0','0','16/3']]);
});
