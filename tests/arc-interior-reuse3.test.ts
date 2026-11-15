import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,circle3,circularArc3,interiorPointOnArc3,locatePointOnArc3,reverseCircularArc3} from '../dist/index.js';
test('open-arc witnesses reuse only validated immutable arcs and respect changed caller arcs',()=>{
 const C=circle3(point3(0n,0n),point3(0n,0n,1n),1n),a=circularArc3(C,point3(1n,0n),point3(0n,1n)),p=interiorPointOnArc3(a);assert.equal(interiorPointOnArc3(a),p);assert.equal(locatePointOnArc3(p,a),'interior');assert.equal(locatePointOnArc3(interiorPointOnArc3(reverseCircularArc3(a)),a),'interior');
 const copy={...a};assert.equal(locatePointOnArc3(interiorPointOnArc3(copy),a),'interior');copy.start=a.end;copy.end=a.start;const other=interiorPointOnArc3(copy);assert.equal(locatePointOnArc3(other,a),'outside');assert.equal(locatePointOnArc3(p,a),'interior');copy.end=copy.start;assert.throws(()=>interiorPointOnArc3(copy),RangeError);
});
