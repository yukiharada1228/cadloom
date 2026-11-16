import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,cross3,dot3,plane3,evaluatePlane3,createBoxBody3,createPlanarBody3,createCylinderBody3,cylinder3,line3,booleanMaterialBodies3,planarMaterialFromBody3,splitPlanarBodyByPlane3,rejoinPlanarBodySplit3,planarBodyVolumeMoments3,locateBody3,locateBodyFace3,serializeBody3,restoreBody3} from '../dist/index.js';
import type {Point3,PlanarBodyPlaneSplit3} from '../dist/index.js';
const q=(n:bigint,d=1n)=>new Rational(n,d),O=point3(0n,0n,0n),Z=point3(0n,0n,1n),box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
function volumes(s:PlanarBodyPlaneSplit3){return [planarBodyVolumeMoments3(s.negative).volume.toString(),planarBodyVolumeMoments3(s.positive).volume.toString()];}
function doubleArea(s:PlanarBodyPlaneSplit3){return s.shared.flatMap(p=>p.polygon.map((a,i)=>cross3(a,p.polygon[(i+1)%p.polygon.length]!))).reduce((a,b)=>point3(a.x.add(b.x),a.y.add(b.y),a.z.add(b.z)),O);}
function check(s:PlanarBodyPlaneSplit3){
 for(const [child,ids,side] of [[s.negative,s.negativeCutFaces,1],[s.positive,s.positiveCutFaces,-1]] as const){
  const restored=restoreBody3(serializeBody3(child));assert.deepEqual(restored.record,child.record);
  for(const id of ids){const f=child.topology.faces[id]!;assert.equal(f.surface.kind,'plane');if(f.surface.kind==='plane')assert.equal(dot3(f.surface.plane.normal,s.plane.normal).sign()*f.sense,side);}
 }
 s.shared.forEach(p=>{p.polygon.forEach(v=>assert.equal(evaluatePlane3(s.plane,v).sign(),0));assert.ok(s.negativeCutFaces.includes(p.negativeFace));assert.ok(s.positiveCutFaces.includes(p.positiveFace));});
 const m=planarBodyVolumeMoments3(s.parent),a=planarBodyVolumeMoments3(s.negative),b=planarBodyVolumeMoments3(s.positive);assert.equal(a.volume.add(b.volume).toString(),m.volume.toString());
 const joined=rejoinPlanarBodySplit3(s);assert.equal(planarBodyVolumeMoments3(joined).volume.toString(),m.volume.toString());assert.throws(()=>rejoinPlanarBodySplit3({...s}),/factory-created/);return joined;
}
test('oblique central cube cut has the independent hexagonal interface and equal half volumes',()=>{
 const parent=box(),s=splitPlanarBodyByPlane3(parent,plane3(1n,1n,1n,'-3/2'));assert.equal(s.kind,'split');assert.deepEqual(volumes(s),['1/2','1/2']);assert.equal(s.shared.length,1);assert.equal(s.shared[0]!.polygon.length,6);assert.deepEqual(doubleArea(s),point3('3/2','3/2','3/2'));
 const expected=['0,1,1/2','0,1/2,1','1,0,1/2','1,1/2,0','1/2,0,1','1/2,1,0'];assert.deepEqual(s.shared[0]!.polygon.map(p=>`${p.x},${p.y},${p.z}`).sort(),expected.sort());
 const joined=check(s);for(const x of ['-1/4','1/4','3/4','5/4'])for(const y of ['-1/4','1/4','3/4','5/4'])for(const z of ['-1/4','1/4','3/4','5/4']){
  const p=point3(x,y,z),inside=[p.x,p.y,p.z].every(v=>v.sign()>0&&v.compare(q(1n))<0),sign=evaluatePlane3(s.plane,p).sign();assert.equal(locateBody3(s.negative,p),inside&&sign<0?'inside':'outside');assert.equal(locateBody3(s.positive,p),inside&&sign>0?'inside':'outside');assert.equal(locateBody3(joined,p),inside?'inside':'outside');
 }
 assert.equal(locateBody3(s.negative,point3('1/2','1/2','1/2')),'boundary');assert.equal(locateBody3(s.positive,point3('1/2','1/2','1/2')),'boundary');
 const triangles=planarMaterialFromBody3(parent).polygons.flatMap(p=>Array.from({length:p.length-2},(_,i)=>[p[0]!,p[i+1]!,p[i+2]!])),subdivided=splitPlanarBodyByPlane3(createPlanarBody3(triangles),s.plane);
 assert.deepEqual(volumes(subdivided),['1/2','1/2']);assert.deepEqual(doubleArea(subdivided),point3('3/2','3/2','3/2'));check(subdivided);

});
test('through-hole caps retain their exact missing area and both children remain replayable',()=>{
 const outer=createBoxBody3(O,4n,4n,2n),drill=createBoxBody3(point3(1n,1n,-1n),2n,2n,4n),parent=booleanMaterialBodies3(outer,drill,'difference',{contacts:'preserve'}),s=splitPlanarBodyByPlane3(parent,plane3(0n,0n,1n,-1n));
 assert.equal(s.kind,'split');assert.deepEqual(volumes(s),['12','12']);assert.equal(doubleArea(s).z.toString(),'24');
 for(const child of [s.negative,s.positive])for(const id of child===s.negative?s.negativeCutFaces:s.positiveCutFaces)assert.equal(locateBodyFace3(child,id,point3(2n,2n,1n)),'outside');
 assert.equal(locateBody3(s.negative,point3(2n,2n,'1/2')),'outside');assert.equal(locateBody3(s.positive,point3(2n,2n,'3/2')),'outside');check(s);
});
test('a closed cavity opens into the cut without being filled or retained as a false bounded void',()=>{
 const parent=booleanMaterialBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference',{contacts:'preserve'}),s=splitPlanarBodyByPlane3(parent,plane3(0n,0n,1n,'-3/2'));
 assert.deepEqual(volumes(s),['13','13']);assert.equal(doubleArea(s).z.toString(),'16');for(const child of [s.negative,s.positive])assert.equal(child.record.regions.filter(r=>!r.material&&r.bounded).length,0);
 assert.equal(locateBody3(s.negative,point3('3/2','3/2','5/4')),'outside');assert.equal(locateBody3(s.positive,point3('3/2','3/2','7/4')),'outside');check(s);
});
test('edge contacts survive splitting and rejoining; a separating plane creates no false area interface',()=>{
 const parent=booleanMaterialBodies3(box(),box(1n,1n,0n),'union',{contacts:'preserve'}),separated=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,-1n));assert.equal(separated.kind,'separated');assert.equal(separated.shared.length,0);assert.deepEqual(volumes(separated),['1','1']);
 const s=splitPlanarBodyByPlane3(parent,plane3(1n,1n,0n,-1n));assert.equal(s.kind,'split');assert.deepEqual(volumes(s),['1/2','3/2']);const joined=check(s);assert.equal(joined.topology.closedOrientedIncidence,false);assert.equal(locateBody3(joined,point3(1n,1n,'1/2')),'boundary');assert.equal(locateBody3(joined,point3('1/2','1/2','1/2')),'inside');
 const disjoint=booleanMaterialBodies3(box(),box(3n,0n,0n),'union',{contacts:'preserve'}),gap=splitPlanarBodyByPlane3(disjoint,plane3(1n,0n,0n,-2n));assert.equal(gap.kind,'separated');assert.equal(gap.shared.length,0);assert.equal(gap.negativeCutFaces.length+gap.positiveCutFaces.length,0);check(gap);
});
test('coincident boundary, outside plane, empty and signed scaling retain closed regularized semantics',()=>{
 const parent=box();for(const offset of [-1n,-2n]){const s=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,offset));assert.equal(s.kind,'one-sided');assert.deepEqual(volumes(s),['1','0']);assert.equal(s.shared.length,0);if(offset===-1n)assert.ok(s.negativeCutFaces.length>0);check(s);}
 const empty=splitPlanarBodyByPlane3(createPlanarBody3([]),plane3(1n,0n,0n));assert.equal(empty.kind,'empty');assert.deepEqual(volumes(empty),['0','0']);assert.equal(empty.shared.length,0);check(empty);
 const raw={normal:point3(2n,0n,0n),offset:q(-1n,2n)},snapshot=splitPlanarBodyByPlane3(parent,raw);raw.normal=O;raw.offset=q(99n);assert.deepEqual(volumes(snapshot),['1/4','3/4']);assert.equal(snapshot.plane.normal.x.toString(),'2');assert.equal(snapshot.plane.offset.toString(),'-1/2');
 const a=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,'-1/4')),b=splitPlanarBodyByPlane3(parent,plane3(-7n,0n,0n,'7/4'));assert.deepEqual(volumes(a),['1/4','3/4']);assert.deepEqual(volumes(b),['3/4','1/4']);
 const n=splitPlanarBodyByPlane3(restoreBody3(serializeBody3(a.positive)),plane3(0n,1n,0n,'-1/2'));assert.deepEqual(volumes(n),['3/8','3/8']);check(n);
});
test('microscopic halfspace cuts at huge coordinates stay nonempty and invalid inputs fail explicitly',()=>{
 const B=q(10n**30n),tiny=q(1n,10n**40n),parent=createBoxBody3(point3(B,0n,0n),1n,1n,1n),s=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,B.add(tiny).neg()));assert.equal(s.kind,'split');assert.deepEqual(volumes(s),[tiny.toString(),q(1n).sub(tiny).toString()]);assert.equal(s.shared.length,1);
 assert.throws(()=>splitPlanarBodyByPlane3({...parent},plane3(1n,0n,0n)),/factory/);assert.throws(()=>splitPlanarBodyByPlane3(parent,{normal:O,offset:q(0n)}),/nonzero/);
 const curved=createCylinderBody3(cylinder3(line3(O,Z),1n),0n,1n);assert.throws(()=>splitPlanarBodyByPlane3(curved,plane3(1n,0n,0n)),/curved/);
});
test('a coincident cavity wall is retained on only one child and excluded from the new shared interface',()=>{
 const parent=booleanMaterialBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference',{contacts:'preserve'}),s=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,-1n));
 assert.equal(s.kind,'split');assert.deepEqual(volumes(s),['9','17']);assert.equal(doubleArea(s).x.toString(),'16');
 const p=point3(1n,'3/2','3/2');assert.equal(locateBody3(parent,p),'boundary');assert.equal(locateBody3(s.negative,p),'boundary');assert.equal(locateBody3(s.positive,p),'outside');
 s.shared.forEach(piece=>assert.equal(locateBodyFace3(s.negative,piece.negativeFace,p),'outside'));
 const joined=check(s);assert.equal(joined.record.regions.filter(r=>!r.material&&r.bounded).length,1);
});
test('weighted rational cube cuts match an independent inclusion-exclusion volume formula',()=>{
 const parent=box(),cases=[['1','2','3','-1'],['1','2','3','0'],['1','2','3','1'],['1','2','3','3'],['1','2','3','6'],['1','2','3','7'],['1/3','2/5','3/7','1/5'],['1/3','2/5','3/7','1/2'],['1/3','2/5','3/7','9/10'],['1','-2','3','1'],['-1/3','2/5','-3/7','-1/7'],['-1','-2','-3','-3']] as const;
 for(const values of cases){
  const [a,b,c,t]=values.map(Rational.parse) as [Rational,Rational,Rational,Rational],weights=[a,b,c].map(v=>v.sign()<0?v.neg():v),threshold=[a,b,c].reduce((s,v)=>v.sign()<0?s.sub(v):s,t);let sum=q(0n);
  // Integral over the positive octant, subtracting translates beyond x/y/z=1.
  for(let mask=0;mask<8;mask++){
   let r=threshold,bits=0;weights.forEach((v,i)=>{if(mask&(1<<i)){r=r.sub(v);bits++;}});
   if(r.sign()>0){const term=r.mul(r).mul(r);sum=bits%2?sum.sub(term):sum.add(term);}
  }
  const expected=sum.div(weights.reduce((p,v)=>p.mul(v),q(6n))),s=splitPlanarBodyByPlane3(parent,plane3(a,b,c,t.neg()));assert.deepEqual(volumes(s),[expected.toString(),q(1n).sub(expected).toString()]);
  assert.equal(s.kind,expected.sign()===0||expected.equals(q(1n))?'one-sided':'split');
  for(const x of ['1/7','3/7','6/7'])for(const y of ['1/7','3/7','6/7'])for(const z of ['1/7','3/7','6/7']){
   const p=point3(x,y,z),sign=a.mul(p.x).add(b.mul(p.y)).add(c.mul(p.z)).sub(t).sign();assert.equal(locateBody3(s.negative,p),sign<0?'inside':sign===0?'boundary':'outside');assert.equal(locateBody3(s.positive,p),sign>0?'inside':sign===0?'boundary':'outside');
  }
 }
});
