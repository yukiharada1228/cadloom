import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreBody3,locateBody3,point3} from '../dist/index.js';

test('archived 83d6bb1 cylinder island document retains shells, regions and independent material truth',()=>{
 const text=readFileSync(new URL('./fixtures/body-83d6bb1-cylinder-island.json',import.meta.url),'utf8'),record=JSON.parse(text),body=restoreBody3(text);
 assert.equal(body.faces.length,74);assert.equal(body.topology.shells.length,3);assert.ok(body.topology.closedOrientedIncidence);assert.deepEqual(body.record.regions,record.body.regions);
 // At z=0 the three concentric cylinders have radii 3, 2 and 1.
 // The expression outer \ (cavity \ island) has two radial material bands.
 for(let i=-8;i<=8;i++){
  const x=BigInt(i),a=x<0n?-x:x,expected=a===2n||a===4n||a===6n?'boundary':a<2n||a>4n&&a<6n?'inside':'outside';
  assert.equal(locateBody3(body,point3(`${i}/2`,0n)),expected,`x=${i}/2`);
 }
 assert.equal(locateBody3(body,point3(0n,0n,4n)),'outside');
});
