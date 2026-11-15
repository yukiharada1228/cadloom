import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Rational,point3,restoreBody3,locateBody3,locateBodyFace3} from '../dist/index.js';
test('archived af34fb3 concave material Body restores with exact bounded faces and independent L material membership',()=>{
 const data=readFileSync(new URL('./fixtures/body-af34fb3-planar-l.json',import.meta.url),'utf8');assert.equal(createHash('sha256').update(data).digest('hex'),'ee1a2ff6945a62190d9d8ea0d9db35a3527ef1acd9f9aa7c65aa686f020a6903');
 const body=restoreBody3(data);assert.equal(body.construction.kind,'cylinder-material-expression');assert.equal(body.faces.length,275);assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);assert.equal(body.topology.shells.length,1);assert.equal(body.interiorSamples.length,1);for(const p of body.interiorSamples)assert.equal(locateBody3(body,p),'inside');body.faces.forEach((face,i)=>assert.equal(locateBodyFace3(body,i,face.sample),'inside'));
 const zero=new Rational(0n),one=new Rational(1n),two=new Rational(2n),values=['-1/2','1/2','3/2','5/2'];
 for(const x of values)for(const y of values)for(const z of values){const p=point3(x,y,z),inside=[p.x,p.y,p.z].every(v=>v.compare(zero)>0&&v.compare(two)<0)&&(p.x.compare(one)<0||p.y.compare(one)<0);assert.equal(locateBody3(body,p),inside?'inside':'outside');}
 for(const [p,expected] of [[point3(1n,'1/2',1n),'inside'],[point3('1/2',1n,1n),'inside'],[point3(1n,1n,1n),'boundary'],[point3(1n,'3/2',1n),'boundary'],[point3(2n,'1/2',1n),'boundary'],[point3('1/2','1/2',0n),'boundary'],[point3('1/2','3/2',2n),'boundary'],[point3('3/2','3/2',0n),'outside'],[point3(2n,2n,1n),'outside']] as const)assert.equal(locateBody3(body,p),expected);
});
