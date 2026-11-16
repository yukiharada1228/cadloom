/** Run after npm run build. Fixed synthetic geometry; times are observations, not a test gate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {point3,createBoxBody3,createCylinderBody3,cylinder3,line3,booleanMaterialBodies3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
const timings:Record<string,number>={};
function timed<T>(name:string,run:()=>T):T {const start=performance.now(),value=run();timings[name]=performance.now()-start;return value;}
const box=(x=0n,y=0n)=>createBoxBody3(point3(x,y,0n),1n,1n,1n);
const contact=timed('contactMs',()=>booleanMaterialBodies3(box(),box(1n,1n),'union',{contacts:'preserve'}));
const cylinder=createCylinderBody3(cylinder3(line3(point3('1/2','1/2',0n),point3(0n,0n,1n)),'1/16'),'1/4','3/4');
const result=timed('intersectionMs',()=>booleanMaterialBodies3(contact,cylinder,'intersection'));
const json=timed('serializeMs',()=>serializeBody3(result)),restored=timed('replayMs',()=>restoreBody3(json));
for(const [p,expected] of [[point3('1/2','1/2','1/2'),'inside'],[point3('3/4','1/2','1/2'),'boundary'],[point3(1n,1n,'1/2'),'outside']] as const)assert.equal(locateBody3(restored,p),expected);
console.log(JSON.stringify({node:process.version,platform:process.platform,architecture:process.arch,timings,faces:restored.faces.length,edges:restored.topology.edges.length,characters:json.length,sha256:createHash('sha256').update(json).digest('hex'),memory:process.memoryUsage()},null,2));
