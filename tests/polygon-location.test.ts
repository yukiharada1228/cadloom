import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePolygon,locatePointInPolygon,point2,Rational} from '../dist/index.js';
const p=(x:number,y:number)=>point2(BigInt(x),BigInt(y));
const box=(x:number,y:number,w:number)=>[p(x,y),p(x+w,y),p(x+w,y+w),p(x,y+w)];

test('inside/outside and every edge/vertex of a square use exact closed boundaries',()=>{
 const region=[box(0,0,4)], polygon=preparePolygon(region);
 for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++){
  const expected=x<0||x>4||y<0||y>4?'outside':x===0||x===4||y===0||y===4?'boundary':'inside';
  assert.equal(polygon.locate(p(x,y)),expected);
 }
 assert.equal(locatePointInPolygon(p(1,1),region),'inside');
 assert.ok(Object.isFrozen(polygon));
});

test('holes, canceled rings, internal edges and degenerate curves have filled-region semantics',()=>{
 const outer=box(0,0,6), inner=box(2,2,2);
 const hole=preparePolygon([outer,inner]);
 assert.equal(hole.locate(p(3,3)),'outside');
 assert.equal(hole.locate(p(2,3)),'boundary');
 assert.equal(hole.locate(p(1,3)),'inside');
 const solid=preparePolygon([outer,inner],'nonzero');
 assert.equal(solid.locate(p(2,3)),'inside');
 assert.equal(solid.locate(p(3,3)),'inside');
 const canceled=preparePolygon([outer,outer]);
 assert.equal(canceled.locate(p(0,0)),'outside');
 assert.equal(canceled.locate(p(1,1)),'outside');
 const flat=preparePolygon([[p(0,0),p(1,0),p(2,0)]]);
 assert.equal(flat.locate(p(1,0)),'outside');
 const adjacent=preparePolygon([box(0,0,2),box(2,0,2)]);
 assert.equal(adjacent.locate(p(2,1)),'inside');
 assert.equal(preparePolygon([]).locate(p(0,0)),'outside');
});

test('self intersection and touching components retain true boundary vertices',()=>{
 const bow=preparePolygon([[p(0,0),p(4,4),p(0,4),p(4,0)]]);
 assert.equal(bow.locate(p(2,2)),'boundary');
 assert.equal(bow.locate(p(2,1)),'inside');
 assert.equal(bow.locate(p(0,2)),'outside');
 assert.equal(preparePolygon([box(0,0,2),box(2,2,2)]).locate(p(2,2)),'boundary');
});

test('prepared regions snapshot caller data and distinguish infinitesimal rational offsets',()=>{
 const ring=box(0,0,4), polygon=preparePolygon([ring]);
 ring.splice(0,ring.length,...box(20,20,1));
 assert.equal(polygon.locate(p(1,1)),'inside');
 const delta=Rational.parse('1/1000000000000000000000000000000000000000000');
 assert.equal(polygon.locate(point2(delta,1n)),'inside');
 assert.equal(polygon.locate(point2(delta.neg(),1n)),'outside');
 assert.equal(polygon.locate(p(0,1)),'boundary');
 const shift=Rational.parse('90071992547409931234567890123456789');
 const tiny=preparePolygon([box(0,0,4).map(q=>point2(shift.add(q.x.mul(delta)),q.y.mul(delta)))]);
 assert.equal(tiny.locate(point2(shift.add(delta),delta)),'inside');
 assert.equal(tiny.locate(point2(shift,delta)),'boundary');
 assert.equal(tiny.locate(point2(shift.sub(delta),delta)),'outside');
});
