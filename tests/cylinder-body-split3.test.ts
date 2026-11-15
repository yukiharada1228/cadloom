import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,line3,cylinder3,plane3,createCylinderBody3,createClippedCylinderBody3,splitCylinderBodyByPlane3,rejoinCylinderBodySplit3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,curveEndpoints3,compareAlgebraicPoints3,createBoxBody3,AlgebraicReal,algebraicCoordinates3} from '../dist/index.js';
import type {Body3,CylinderBodyPlaneSplit3,CylinderSplitInterface3,CylinderHalfSpace3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),C=cylinder3(line3(O,Z),1n),h=(x:bigint,y:bigint,z:bigint,k:bigint|string=0n):CylinderHalfSpace3=>({plane:plane3(x,y,z,k),side:-1});
function roundtrip(b:Body3){const r=restoreBody3(serializeBody3(b));assert.deepEqual(r.record,b.record);assert.equal(r.record,r.geometry.record);return r;}
function genuine(r:CylinderBodyPlaneSplit3):CylinderSplitInterface3 {
 assert.equal(r.kind,'split');if(r.kind!=='split')throw new Error('Expected genuine split');
 for(const [b,face,records,origins] of [[r.negative,r.shared.negativeFace,r.shared.negativeBoundary,r.negativeFaceOrigins],[r.positive,r.shared.positiveFace,r.shared.positiveBoundary,r.positiveFaceOrigins]] as const){
  assert.equal(b.topology.closedOrientedIncidence,true);assert.equal(b.topology.issues.length,0);assert.equal(origins.length,b.faces.length);assert.equal(origins[face],null);
  assert.equal(locateBody3(b,r.shared.sample),'boundary');assert.equal(locateBodyFace3(b,face,r.shared.sample),'inside');
  origins.forEach((parentFace,id)=>{if(parentFace!==null)assert.equal(locateBodyFace3(r.parent,parentFace,b.faces[id]!.sample),'inside');});
  // Check native interface coedge IDs against the actual reconstructed Body.
  for(const record of records){const c=b.topology.coedges[record.coedge]!;assert.equal(c.edge,record.edge);assert.equal(c.direction,record.direction);assert.equal(c.face,face);let p=b.topology.vertices[c.origin]!;
   for(const use of record.uses){const ends=curveEndpoints3(r.shared.edges[use.edge]!);assert.equal(compareAlgebraicPoints3(p,ends[use.direction===1?0:1]),0);p=ends[use.direction===1?1:0];}
   assert.equal(compareAlgebraicPoints3(p,b.topology.vertices[c.target]!),0);
  }
 }
 assert.equal(locateBody3(r.parent,r.shared.sample),'inside');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.shared));return r.shared;
}
test('cylinder Body cut has exact paired cap/edge IDs and matches independent half-cylinder inequalities',()=>{
 const parent=createCylinderBody3(C,-1n,1n),r=splitCylinderBodyByPlane3(parent,plane3(1n,0n,0n));genuine(r);
 for(let x=-3n;x<=3n;x++)for(let y=-3n;y<=3n;y++)for(let z=-3n;z<=3n;z++){
  const outside=x*x+y*y>4n||z < -2n||z>2n,boundary=x*x+y*y===4n||z===-2n||z===2n,p=point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n));
  for(const [body,side] of [[r.negative,-1n],[r.positive,1n]] as const){const expected=outside||side*x<0n?'outside':boundary||x===0n?'boundary':'inside';assert.equal(locateBody3(body,p),expected);}
 }
 const joined=rejoinCylinderBodySplit3(r);assert.equal(joined.body,parent);assert.equal(joined.sewing.topology.closedOrientedIncidence,true);assert.ok(joined.faces.length);
 assert.throws(()=>rejoinCylinderBodySplit3({...r}),RangeError);
});
test('both children roundtrip and a restored child can be cut and rejoined again',()=>{
 const first=splitCylinderBodyByPlane3(createCylinderBody3(C,-1n,1n),plane3(1n,0n,0n)),negative=roundtrip(first.negative),positive=roundtrip(first.positive);
 assert.equal(negative.construction.kind,'clipped-cylinder');assert.equal(locateBody3(positive,point3('1/2',0n,0n)),'inside');
 const second=splitCylinderBodyByPlane3(negative,plane3(0n,1n,0n));genuine(second);const quarter=roundtrip(second.negative);
 assert.equal(locateBody3(quarter,point3('-1/2','-1/2',0n)),'inside');assert.equal(locateBody3(quarter,point3('-1/2','1/2',0n)),'outside');assert.equal(rejoinCylinderBodySplit3(second).body,negative);
});
test('oblique elliptic interfaces persist as exact curves and bounded analytic faces',()=>{
 const parent=createCylinderBody3(C,-2n,2n),r=splitCylinderBodyByPlane3(parent,plane3(-1n,0n,1n)),shared=genuine(r);
 assert.ok(shared.edges.some(c=>c.kind==='elliptic-arc'));assert.equal(shared.locate(O),'inside');
 const a=roundtrip(r.negative),b=roundtrip(r.positive);assert.equal(locateBody3(a,point3('1/2',0n,0n)),'inside');assert.equal(locateBody3(b,point3('1/2',0n,1n)),'inside');
 assert.equal(locateBodyFace3(a,shared.negativeFace,point3('1/2',0n,'1/2')),'inside');
});
test('arbitrary rational nonunit axes and irrational radius preserve cut orientation under negative plane scaling',()=>{
 const o=point3(3n,-2n,7n),d=point3(1n,2n,2n),parent=createCylinderBody3(cylinder3(line3(o,d),5n),'-1/2','1/2'),p=plane3(1n,2n,2n,-13n),r=splitCylinderBodyByPlane3(parent,p),s=genuine(r);
 assert.equal(s.locate(o),'inside');assert.equal(s.locate(point3(5n,-3n,7n)),'boundary');
 const reverse=splitCylinderBodyByPlane3(parent,plane3(-7n,-14n,-14n,91n));genuine(reverse);
 assert.deepEqual(r.negative.record,reverse.positive.record);assert.deepEqual(r.positive.record,reverse.negative.record);
 const restored=roundtrip(r.positive);assert.equal(locateBody3(restored,point3('13/4','-3/2','15/2')),'inside');
});
test('touching, disjoint and infeasible recipes persist empty children without losing their constraints',()=>{
 const parent=createCylinderBody3(C,-1n,1n);
 for(const [offset,kind] of [[-1n,'touching'],[-2n,'disjoint']] as const){const r=splitCylinderBodyByPlane3(parent,plane3(1n,0n,0n,offset));assert.equal(r.kind,kind);assert.equal(r.negative,parent);assert.equal(r.shared,null);assert.equal(roundtrip(r.positive).faces.length,0);assert.equal(rejoinCylinderBodySplit3(r).body,parent);}
 const empty=roundtrip(createClippedCylinderBody3(C,-1n,1n,[{plane:plane3(1n,0n,0n,-2n),side:1}]));assert.equal(empty.faces.length,0);
 const split=splitCylinderBodyByPlane3(empty,plane3(1n,0n,0n));assert.equal(split.kind,'empty');assert.equal(split.negative,empty);assert.equal(split.positive,empty);assert.equal(rejoinCylinderBodySplit3(split).body,empty);
 const impossible=roundtrip(createClippedCylinderBody3(C,-1n,1n,[h(1n,0n,0n),h(-1n,0n,0n)]));assert.equal(impossible.faces.length,0);
 const redundant=roundtrip(createClippedCylinderBody3(C,-1n,1n,[h(1n,0n,0n,-2n)]));assert.equal(locateBody3(redundant,O),'inside');
});
test('pure planar cylinder/halfspace products preserve corner-contact emptiness on replay',()=>{
 const parent=createClippedCylinderBody3(C,-1n,1n,[h(1n,0n,0n,'-1/4'),h(-1n,0n,0n,'-1/4'),h(0n,1n,0n,'-1/4'),h(0n,-1n,0n,'-1/4'),h(0n,0n,1n,'-1/4'),h(0n,0n,-1n,'-1/4')]);
 assert.ok(parent.topology.faces.every(f=>f.surface.kind==='plane'));const r=splitCylinderBodyByPlane3(parent,plane3(1n,1n,1n,'-3/4'));assert.equal(r.kind,'touching');assert.equal(roundtrip(r.positive).faces.length,0);
 const split=splitCylinderBodyByPlane3(roundtrip(parent),plane3(1n,1n,1n));assert.equal(genuine(split).edges.length,6);
});
test('sub-floating-point curved children survive serialization and algebraic boundary queries',()=>{
 const tiny=new Rational(1n,10n**22n),cut=new Rational(1n).sub(tiny),r=splitCylinderBodyByPlane3(createCylinderBody3(C,-1n,1n),plane3(1n,0n,0n,cut.neg()));genuine(r);
 const small=roundtrip(r.positive);assert.equal(locateBody3(small,point3(new Rational(1n).sub(tiny.div(new Rational(2n))),0n,0n)),'inside');
 const radius=AlgebraicReal.fromRational(new Rational(1n).sub(cut.mul(cut))).sqrt();assert.equal(locateBody3(small,algebraicCoordinates3(cut,radius,0n)),'boundary');
});
test('unsupported/forged families and tampered clipping recipes fail explicitly',()=>{
 const parent=createCylinderBody3(C,-1n,1n);assert.throws(()=>splitCylinderBodyByPlane3({...parent},plane3(1n,0n,0n)),RangeError);
 assert.throws(()=>splitCylinderBodyByPlane3(createBoxBody3(O,1n,1n,1n),plane3(1n,0n,0n)),/cylinder\/halfspace/);
 assert.throws(()=>splitCylinderBodyByPlane3(parent,{normal:O,offset:new Rational(0n)}),RangeError);
 const cut=splitCylinderBodyByPlane3(parent,plane3(1n,0n,0n)).negative,doc=JSON.parse(serializeBody3(cut));doc.construction.halfspaces.push({normal:['1','0','0'],offset:'-1/2',side:1});assert.throws(()=>restoreBody3(doc),RangeError);
 const metadata=JSON.parse(serializeBody3(cut));metadata.body.faces[0].sense*=-1;assert.throws(()=>restoreBody3(metadata),RangeError);
});
