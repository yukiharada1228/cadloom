import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,encodeAffineNurbsFace3,decodeAffineNurbsFace3,serializeAffineNurbsFaces3,restoreAffineNurbsFaces3,affineNurbsFacesDocument3,readAffineNurbsFaceRecord3,readAffineNurbsFacesDocument3,parseAffineNurbsFacesDocument3,locateAffineNurbsFace3,sewAffineNurbsFaces3,insertNurbsSurfaceKnot3,reverseNurbsCurve3,affineNurbsBoundaryEdgePoint3,compareAlgebraicPoints3} from '../dist/index.js';
import type {NurbsCurve3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],line=(a:string,b:string,c:string,d:string)=>nurbsCurve3(1,[point3(a,b,0n),point3(c,d,0n)],K);
function rectangle(a='0',b='0',c='1',d='1',cw=false){const ring=[line(a,b,c,b),line(c,b,c,d),line(c,d,a,d),line(a,d,a,b)];return cw?ring.reverse().map(reverseNurbsCurve3):ring;}
const surface=()=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
function face(s=surface(),ring:readonly NurbsCurve3[]=rectangle(),holes:readonly (readonly NurbsCurve3[])[]=[]){const c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected certificate');return createAffineNurbsFace3(c.certificate,prepareNurbsParameterDomain2(ring,holes));}
const clone=(x:unknown)=>JSON.parse(JSON.stringify(x));
test('face defining geometry round trips with exact holes, orientation, samples and immutable snapshots',()=>{
 const f=face(surface(),rectangle(),[rectangle('2/5','2/5','3/5','3/5',true)]),record=encodeAffineNurbsFace3(f),g=decodeAffineNurbsFace3(record);assert.deepEqual(encodeAffineNurbsFace3(g),record);assert.ok(Object.isFrozen(record)&&Object.isFrozen(record.surface.points)&&Object.isFrozen(record.holes));assert.equal(locateAffineNurbsFace3(g,g.sample),'inside');for(const p of [point3('1/4','1/4','1/16'),point3('1/2','1/2','1/4'),point3('2/5','1/2','1/5'),point3('1/4','1/4',0n)])assert.equal(locateAffineNurbsFace3(g,p),locateAffineNurbsFace3(f,p));
 const raw=clone(record),snapshot=readAffineNurbsFaceRecord3(raw);raw.surface.points[0][0][0]='999';assert.equal(snapshot.surface.points[0]![0]![0],'0');assert.throws(()=>encodeAffineNurbsFace3({...f}),/factory/);
});
test('restoring a collection recomputes algebraic endpoint cuts and shared BRep incidence',()=>{
 const c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],K2),a=face(surface(),[c,line('1','1','0','1'),line('0','1','0','0')]),b=face(insertNurbsSurfaceKnot3(surface(),'u','1/2'),[line('0','0','1','0'),line('1','0','1','1'),reverseNurbsCurve3(c)]),expected=sewAffineNurbsFaces3([a,b]),json=serializeAffineNurbsFaces3([a,b]),restored=restoreAffineNurbsFaces3(json);
 assert.equal(json.includes('certified'),false);assert.equal(json.includes('topology'),false);assert.equal(json.includes('polynomial'),false);assert.deepEqual(restored.sourceUses,expected.sourceUses);assert.equal(restored.topology.edges.filter(e=>e.coedges.length===2).length,2);assert.equal(restored.topology.vertices.length,expected.topology.vertices.length);for(let i=0;i<expected.topology.vertices.length;i++)assert.equal(compareAlgebraicPoints3(restored.topology.vertices[i]!,expected.topology.vertices[i]!),0);for(const e of restored.topology.edges)assert.equal(compareAlgebraicPoints3(affineNurbsBoundaryEdgePoint3(e.curve,e.curve.lower),restored.topology.vertices[e.start]!),0);
 assert.deepEqual(affineNurbsFacesDocument3(restored.topology.faces.map(f=>f.surface)),parseAffineNurbsFacesDocument3(json));
});
test('a closed cube collection restores closed common incidence without storing a material claim',()=>{
 const maps=[(u:bigint,v:bigint)=>point3(v,u,0n),(u:bigint,v:bigint)=>point3(u,v,1n),(u:bigint,v:bigint)=>point3(u,0n,v),(u:bigint,v:bigint)=>point3(v,1n,u),(u:bigint,v:bigint)=>point3(0n,v,u),(u:bigint,v:bigint)=>point3(1n,u,v)],faces=maps.map(f=>face(nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>f(u,v))),K,K))),r=restoreAffineNurbsFaces3(serializeAffineNurbsFaces3(faces));assert.equal(r.topology.edges.length,12);assert.equal(r.topology.vertices.length,8);assert.equal(r.topology.faces.length,6);assert.equal(r.topology.closedOrientedIncidence,true);assert.equal(r.topology.issues.length,0);assert.equal(restoreAffineNurbsFaces3(serializeAffineNurbsFaces3([])).topology.faces.length,0);
});
test('structural records do not confer geometric ownership or bypass embedding and boundary checks',()=>{
 const base=encodeAffineNurbsFace3(face()),badWeight=clone(base);badWeight.surface.weights[0][0]='-1';assert.doesNotThrow(()=>readAffineNurbsFaceRecord3(badWeight));assert.throws(()=>decodeAffineNurbsFace3(badWeight),/positive/);
 const collapsed=clone(base);for(const row of collapsed.surface.points)for(const p of row){p[0]='0';p[2]='0';}assert.throws(()=>decodeAffineNurbsFace3(collapsed),/not certified/);
 const outside=clone(base);outside.outer[0].points[0][0]='-1';assert.throws(()=>decodeAffineNurbsFace3(outside),/closed chain|domain/);
 const nonplanar=clone(base);nonplanar.outer[0].points[0][2]='1';assert.throws(()=>decodeAffineNurbsFace3(nonplanar),/planar/);
 const reversed=clone(base);reversed.sense=-1;assert.throws(()=>decodeAffineNurbsFace3(reversed),/orientation/);
 const forged=clone(base);forged.certified=true;assert.throws(()=>decodeAffineNurbsFace3(forged),/unknown field/);
});
test('schema versions, own fields, geometry tags and collection budgets are checked cumulatively',()=>{
 const record=encodeAffineNurbsFace3(face()),doc=affineNurbsFacesDocument3([face(),face()]),bad=clone(record);bad.version=2;assert.throws(()=>readAffineNurbsFaceRecord3(bad),/expected/);assert.throws(()=>readAffineNurbsFaceRecord3(Object.create(record)),/missing field/);
 const analytic=clone(record);analytic.outer[0]={kind:'line',origin:['0','0','0'],direction:['1','0','0'],start:{kind:'rational',value:'0'},end:{kind:'rational',value:'1'}};assert.throws(()=>readAffineNurbsFaceRecord3(analytic),/NURBS parameter curve/);const plane=clone(record);plane.surface={kind:'plane',normal:['0','0','1'],offset:'0'};assert.throws(()=>readAffineNurbsFaceRecord3(plane),/NURBS surface/);
 assert.throws(()=>readAffineNurbsFacesDocument3(doc,{maxItems:10}),/budget/);assert.throws(()=>restoreAffineNurbsFaces3(doc,{maxNumericCharacters:1}),/budget/);assert.throws(()=>parseAffineNurbsFacesDocument3(' '.repeat(200),{maxItems:1,maxNumericCharacters:1}),/text budget/);assert.throws(()=>restoreAffineNurbsFaces3('{'),SyntaxError);assert.throws(()=>readAffineNurbsFacesDocument3(doc,{maxItems:0}),/positive/);
 const one=affineNurbsFacesDocument3([face()]);assert.doesNotThrow(()=>readAffineNurbsFacesDocument3(one,{maxItems:200}));assert.throws(()=>readAffineNurbsFacesDocument3(doc,{maxItems:200}),/budget/);
});

test('coherent defining-geometry edits are revalidated as new geometry rather than authenticated as the original face',()=>{
 const record=clone(encodeAffineNurbsFace3(face()));for(const row of record.surface.points)for(const p of row)p[2]=String(BigInt(p[2])+5n);const g=decodeAffineNurbsFace3(record);assert.equal(locateAffineNurbsFace3(g,point3('1/4','1/4','81/16')),'inside');assert.equal(locateAffineNurbsFace3(g,point3('1/4','1/4','1/16')),'outside');
});
