import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,createBoxBody3,booleanCellularBodies3,cellularBodyFromBody3,serializeCellularBody3,restoreCellularBody3,locateCellularBody3,intersectBodyLine3,intersectBodyRay3,intersectBodyLineMaterial3,similarityTransform3,transformBody3,transformPointBySimilarity3,transformVectorBySimilarity3,inverseSimilarityTransform3,planarMaterialFromBody3,booleanPlanarMaterials3,transformPlanarMaterial3,planarMaterialDocument3,locatePlanarMaterial3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
const X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const contact=()=>restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(),box(1n,1n,0n),'union')));
const parameters=(v:ReturnType<typeof intersectBodyLine3>)=>v.hits.map(h=>h.parameter.rational!.toString());
test('shared Body line, ray and material APIs query contact Bodies without guessing through singular events',()=>{
 const body=contact(),o=point3(-1n,'-5/4','1/4'),d=point3(1n,1n,0n),line=intersectBodyLine3(body,o,d);
 assert.equal(line.kind,'regular');assert.deepEqual(parameters(line),['5/4','2','9/4','3']);
 const scan=intersectBodyLineMaterial3(body,o,d);assert.equal(scan.kind,'regular');if(scan.kind!=='regular')return;
 assert.deepEqual(scan.intervals.map(i=>[i.start.parameter.rational!.toString(),i.end.parameter.rational!.toString()]),[['5/4','2'],['9/4','3']]);assert.equal(scan.isolated.length,0);
 scan.intervals.forEach(i=>assert.equal(locateCellularBody3(body,i.sample),'inside'));
 assert.deepEqual(parameters(intersectBodyRay3(body,point3('1/2','1/4','1/4'),d)),['1/2','3/4','3/2']);
 assert.deepEqual(parameters(intersectBodyLine3(body,o,point3(2n,2n,0n))),['5/8','1','9/8','3/2']);
 assert.deepEqual(parameters(intersectBodyLine3(body,point3(3n,'11/4','1/4'),d)),['-11/4','-2','-7/4','-1']);
 const singular=intersectBodyLineMaterial3(body,point3(-1n,-1n,'1/4'),d);assert.equal(singular.kind,'degenerate');assert.ok(singular.boundary.hits.some(h=>h.uses.length>1));
 const contained=intersectBodyLineMaterial3(body,point3(-1n,0n,'1/4'),X);assert.equal(contained.kind,'degenerate');assert.ok(contained.boundary.containedSupports.length>0);
});
test('cavity intervals, empty results and shell selection retain existing query contracts',()=>{
 const cavity=restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference'))),s=intersectBodyLineMaterial3(cavity,point3(-1n,'3/2','5/4'),X);
 assert.equal(s.kind,'regular');if(s.kind==='regular')assert.deepEqual(s.intervals.map(i=>[i.start.parameter.rational!.toString(),i.end.parameter.rational!.toString()]),[['1','2'],['3','4']]);
 const empty=booleanCellularBodies3(cavity,cavity,'xor'),e=intersectBodyLineMaterial3(empty,point3(-1n,'1/3','1/4'),X);assert.equal(e.kind,'regular');if(e.kind==='regular'){assert.equal(e.intervals.length,0);assert.equal(e.isolated.length,0);}
 const disjoint=booleanCellularBodies3(box(),box(3n,0n,0n),'union'),o=point3(-1n,'1/3','1/4');assert.equal(intersectBodyLine3(disjoint,o,X).hits.length,4);
 assert.equal(intersectBodyLine3(disjoint,o,X,0).hits.length,2);assert.equal(intersectBodyLine3(disjoint,o,X,1).hits.length,2);
 assert.throws(()=>intersectBodyLine3(disjoint,o,X,2),/shell/);assert.throws(()=>intersectBodyRay3({...disjoint},o,X),/factory/);assert.throws(()=>intersectBodyLineMaterial3({...disjoint},o,X),/factory/);assert.throws(()=>intersectBodyLine3(disjoint,o,point3(0n,0n,0n)));
});
test('shared transform API preserves contact regions, exact volumes, query parameters and replay under reflection',()=>{
 const source=contact(),before=serializeCellularBody3(source),t=similarityTransform3([point3(-2n,0n,0n),point3(0n,2n,0n),point3(0n,0n,2n)],point3(10n,-3n,5n)),target=restoreCellularBody3(serializeCellularBody3(transformBody3(source,t)));
 assert.equal(target.topology.closedOrientedIncidence,false);assert.equal(target.interiorSamples.length,2);assert.deepEqual(target.record.regions.filter(r=>r.material).map(r=>r.volume),['8','8']);
 for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++)for(let z=-1;z<=3;z++){
  const p=point3(`${x}/2`,`${y}/2`,`${z}/2`);assert.equal(locateCellularBody3(target,transformPointBySimilarity3(t,p)),locateCellularBody3(source,p));
 }
 const o=point3(-1n,'-5/4','1/4'),d=point3(1n,1n,0n),a=intersectBodyLine3(source,o,d),b=intersectBodyLine3(target,transformPointBySimilarity3(t,o),transformVectorBySimilarity3(t,d));assert.equal(a.kind,b.kind);assert.deepEqual(parameters(a),parameters(b));
 const back=restoreCellularBody3(serializeCellularBody3(transformBody3(target,inverseSimilarityTransform3(t))));assert.deepEqual(back.record.regions.filter(r=>r.material).map(r=>r.volume),['1','1']);assert.deepEqual(parameters(intersectBodyLine3(back,o,d)),parameters(a));
 assert.equal(serializeCellularBody3(source),before);assert.throws(()=>transformBody3({...source},t),/factory/);assert.throws(()=>transformBody3(source,{...t}),/factory/);
 const native=transformBody3(box(),t);assert.equal(native.record.version,1);assert.equal(native.record.regions.length,2);
});
test('material similarity preserves shared construction DAGs and exact rational rotations',()=>{
 let source=planarMaterialFromBody3(box());for(let i=0;i<3;i++)source=booleanPlanarMaterials3(source,source,'union');
 const t=similarityTransform3([point3('3/5','4/5',0n),point3('-4/5','3/5',0n),Z],point3('1/7','2/9','3/11')),target=transformPlanarMaterial3(source,t);
 assert.equal(planarMaterialDocument3(target).nodes.length,4);assert.equal(target.volume.toString(),'1');assert.equal(locatePlanarMaterial3(target,transformPointBySimilarity3(t,point3('1/2','1/2','1/2'))),'inside');
 assert.throws(()=>transformPlanarMaterial3({...source},t),/factory/);assert.throws(()=>transformPlanarMaterial3(source,{...t}),/factory/);
 const empty=booleanCellularBodies3(box(),box(),'difference'),moved=restoreCellularBody3(serializeCellularBody3(transformBody3(empty,t)));assert.equal(moved.faces.length,0);assert.equal(locateCellularBody3(moved,point3(0n,0n,0n)),'outside');
});
test('microscopic separated material intervals remain ordered beyond Number precision',()=>{
 const B=Rational.parse('1000000000000000000000000000000'),tiny=Rational.parse('1/1'+'0'.repeat(40)),one=Rational.parse('1');
 const a=createBoxBody3(point3(B,0n,0n),1n,1n,1n),b=createBoxBody3(point3(B.add(one).add(tiny),0n,0n),1n,1n,1n),body=booleanCellularBodies3(a,b,'union'),s=intersectBodyLineMaterial3(body,point3(B.sub(one),'1/3','1/4'),X);
 assert.equal(s.kind,'regular');if(s.kind!=='regular')return;assert.equal(s.intervals.length,2);assert.equal(s.intervals[1]!.start.parameter.sub(s.intervals[0]!.end.parameter).rational!.toString(),tiny.toString());
});
