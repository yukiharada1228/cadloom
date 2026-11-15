import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,circle3,circularArc3,curveEndpoints3,pointOnCurve3} from '../dist/index.js';
import {snapshotCurve3} from '../dist/geometry/curve3.js';
import type {Curve3} from '../dist/index.js';
test('only privately validated curve snapshots are reused; mutable and forged inputs remain checked',()=>{
 const circle=circle3(point3(0n,0n),point3(0n,0n,1n),1n),arc=circularArc3(circle,point3(1n,0n),point3(0n,1n));
 const input={kind:'circular-arc' as const,arc:{...arc}},first=snapshotCurve3(input);assert.notEqual(first,input);assert.equal(snapshotCurve3(first),first);
 input.arc={...arc,start:arc.end,end:arc.start};const second=snapshotCurve3(input);assert.notEqual(first,second);assert.equal(curveEndpoints3(first)[0].x.rational!.toString(),'1');assert.equal(curveEndpoints3(second)[0].x.rational!.toString(),'0');
 input.arc={...arc,start:{...arc.start,x:arc.start.x.affine(2n)}};assert.throws(()=>snapshotCurve3(input),RangeError);
 const forged=Object.freeze({kind:'circular-arc',arc:Object.freeze({...input.arc})}) as Curve3;assert.throws(()=>snapshotCurve3(forged),RangeError);assert.equal(pointOnCurve3(point3(1n,0n),first),true);
});
