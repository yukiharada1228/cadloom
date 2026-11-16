import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,createBoxBody3,createCylinderBody3,cylinder3,line3,booleanCellularBodies3,locateBody3,locateBodyFace3,bodyDocument3,serializeBody3,restoreBody3,cellularBodyDocument3,serializeCellularBody3,similarityTransform3,transformBody3,intersectBodyLineMaterial3,planarBodyVolumeMoments3,closestPointOnPlanarBodyBoundary3} from '../dist/index.js';
import type {Body3,CellularBody3,KernelBody3,BodyDocument3,CellularBodyDocument3} from '../dist/index.js';
const box=(x=0n,y=0n,z=0n)=>createBoxBody3(point3(x,y,z),1n,1n,1n);
function typing(native:Body3&{extra:string},cell:CellularBody3,unknown:unknown){
 const a:Body3=restoreBody3(serializeBody3(native)),b:CellularBody3=restoreBody3(serializeBody3(cell));
 const da:BodyDocument3=bodyDocument3(native),db:CellularBodyDocument3=bodyDocument3(cell);
 const c:CellularBody3=restoreBody3(db),d:Body3=restoreBody3(da),any:KernelBody3=restoreBody3(unknown);
 // @ts-expect-error Unknown input cannot promise a manifold Body.
 const wrong:Body3=restoreBody3(unknown);
 // @ts-expect-error Serialization preserves the source family, not caller-added fields.
 restoreBody3(serializeBody3(native)).extra;
 // @ts-expect-error Converting a branded serialization to an ordinary string loses its source family.
 const lost:Body3=restoreBody3(String(serializeBody3(native)));
 return [a,b,c,d,any,wrong,lost];
}
void typing;
test('common location, face location and persistence preserve owned contact Bodies and ordinary JSON',()=>{
 const source=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),before=serializeCellularBody3(source),document=bodyDocument3(source);
 assert.deepEqual(document,cellularBodyDocument3(source));assert.equal(serializeBody3(source),before);
 const restored:CellularBody3=restoreBody3(serializeBody3(source)),fromObject:CellularBody3=restoreBody3(document);
 assert.deepEqual(restored.record,source.record);assert.deepEqual(fromObject.record,source.record);assert.equal(restored.interiorSamples.length,2);
 for(const r of [source,restored,fromObject]){
  assert.equal(locateBody3(r,point3('1/2','1/2','1/2')),'inside');assert.equal(locateBody3(r,point3(1n,1n,'1/2')),'boundary');assert.equal(locateBody3(r,point3(3n,0n,0n)),'outside');
  r.faces.forEach((face,id)=>{assert.equal(locateBodyFace3(r,id,face.sample),'inside');assert.equal(locateBody3(r,face.sample),'boundary');});
  for(const id of [-1,NaN,0.5,r.faces.length])assert.throws(()=>locateBodyFace3(r,id,point3(0n,0n,0n)),/face index/);
 }
 assert.equal(serializeBody3(source),before);assert.throws(()=>locateBody3({...source},point3(0n,0n,0n)),/factory/);assert.throws(()=>locateBodyFace3({...source},0,point3(0n,0n,0n)),/factory/);assert.throws(()=>serializeBody3({...source}),/factory/);
});
test('untyped loaded documents use common transform, queries, moments and nearest boundary without family-specific replay',()=>{
 const source=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),raw:unknown=JSON.parse(serializeBody3(source)),loaded=restoreBody3(raw),fromString=restoreBody3(String(serializeBody3(source)));
 assert.deepEqual(bodyDocument3(loaded),bodyDocument3(fromString));
 const t=similarityTransform3([point3(-2n,0n,0n),point3(0n,2n,0n),point3(0n,0n,2n)],point3(10n,-3n,5n)),result=restoreBody3(serializeBody3(transformBody3(loaded,t)));
 assert.equal(locateBody3(result,point3(9n,-2n,6n)),'inside');assert.equal(planarBodyVolumeMoments3(result).volume.toString(),'16');
 const closest=closestPointOnPlanarBodyBoundary3(result,point3(8n,-1n,6n));assert.equal(closest.kind,'points');if(closest.kind==='points')assert.equal(closest.squaredDistance.toString(),'0');
 const scan=intersectBodyLineMaterial3(loaded,point3(-1n,'-5/4','1/4'),point3(1n,1n,0n));assert.equal(scan.kind,'regular');if(scan.kind==='regular')assert.equal(scan.intervals.length,2);
 const chained=restoreBody3(serializeBody3(booleanCellularBodies3(loaded,box(1n,1n,0n),'difference')));assert.equal(chained.interiorSamples.length,1);assert.equal(locateBody3(chained,point3('1/2','1/2','1/2')),'inside');
});
test('legacy native documents retain their serialized format, family and geometric reconstruction',()=>{
 const native=box(),text=serializeBody3(native),d:BodyDocument3=bodyDocument3(native),r:Body3=restoreBody3(text);
 assert.equal(Object.hasOwn(d,'kind'),false);assert.equal(text,JSON.stringify(d));assert.deepEqual(r.record,native.record);assert.equal(serializeBody3(restoreBody3(d)),text);
 const cylinder=createCylinderBody3(cylinder3(line3(point3(0n,0n,0n),point3(0n,0n,2n)),1n),-1n,1n),c:Body3=restoreBody3(serializeBody3(cylinder));assert.equal(c.construction.kind,'cylinder');assert.equal(locateBody3(c,point3(0n,0n,0n)),'inside');
});
test('common replay rejects altered region claims, invalid dispatch and construction or record budgets',()=>{
 const source=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),base=JSON.parse(serializeBody3(source)),bad=structuredClone(base);bad.body.regions[1].volume='999';assert.throws(()=>restoreBody3(bad),/does not match/);
 for(const limits of [{maxChars:5},{maxItems:5},{maxNumericCharacters:5},{material:{maxNodes:1}},{material:{maxVertices:3}},{maxChars:0}])assert.throws(()=>restoreBody3(serializeBody3(source),limits));
 assert.throws(()=>restoreBody3(serializeBody3(box()),{maxChars:5}));assert.throws(()=>restoreBody3(serializeBody3(box()),{maxItems:5}));
 const wrong=structuredClone(base);wrong.kind='unknown';assert.throws(()=>restoreBody3(wrong));
 const inherited=Object.assign(Object.create({kind:base.kind}),{version:1,material:base.material,body:base.body});assert.throws(()=>restoreBody3(inherited));
 const extra=structuredClone(base);extra.extra=true;assert.throws(()=>restoreBody3(extra));
});
