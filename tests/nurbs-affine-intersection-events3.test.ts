import test from 'node:test';
import assert from 'node:assert/strict';
import {nurbsCurve3,prepareNurbsParameterDomain2,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,analyzeTrimmedNurbsAffineIntersectionEdgeEvents3,analyzeNurbsAffineIntersectionComplexEdgeEvents3,point3,nurbsSurface3,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,analyzeNurbsAffineIntersectionEdgeEvents3,nurbsAffineIntersectionEdgeDifferential3,AlgebraicReal} from '../dist/index.js';
import type {NurbsSurface3} from '../dist/index.js';
const K=[0n,0n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
const flat=()=>nurbsSurface3(1,1,[-1n,1n].map(u=>[-1n,1n].map(v=>point3(u,v,0n))),K,K);
function report(s:NurbsSurface3,t:NurbsSurface3=flat()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certified target');return intersectNurbsSurfaceAffineTarget3(s,c.certificate);}
test('transverse branches have complete ordered coverage and agree with independent interior evaluations',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,'-1/4'),point3(0n,1n,'-1/4')],[point3(1n,0n,'-1/4'),point3(1n,1n,'3/4')]],K,K),r=report(s);
 for(let p=0;p<r.patches.length;p++)for(let e=0;e<r.patches[p]!.edges.length;e++){
  const a=analyzeNurbsAffineIntersectionEdgeEvents3(r,p,e);assert.equal(a.events[0]!.parameter.compare(r.patches[p]!.edges[e]!.lower),0);assert.equal(a.events.at(-1)!.parameter.compare(r.patches[p]!.edges[e]!.upper),0);assert.equal(a.intervals.length,a.events.length-1);
  for(const q of a.intervals){assert.equal(q.kind,'regular');assert.equal(q.transverse,true);assert.equal(q.sourceRegular,true);const t=q.lower.add(q.upper).div(AlgebraicReal.fromRational(2n));const d=nurbsAffineIntersectionEdgeDifferential3(r,p,e,t);assert.equal(d.kind,q.kind);assert.equal(d.transverse,q.transverse);}
 }
 assert.throws(()=>analyzeNurbsAffineIntersectionEdgeEvents3({...r},0,0),/factory/);assert.throws(()=>analyzeNurbsAffineIntersectionEdgeEvents3(r,-1,0),/Invalid/);
});
test('a repeated contact remains nontransverse on every open interval',()=>{
 const s=nurbsSurface3(2,1,[-1n,0n,1n].map((x,i)=>[point3(x,-1n,[1n,-1n,1n][i]!),point3(x,1n,[1n,-1n,1n][i]!)]),J,K),r=report(s);
 assert.ok(r.patches[0]!.edges.length>0);for(let e=0;e<r.patches[0]!.edges.length;e++){const a=analyzeNurbsAffineIntersectionEdgeEvents3(r,0,e);assert.ok(a.intervals.every(q=>q.kind==='regular'&&q.sourceRegular&&!q.transverse));}
});
test('a rank drop in the interior of a vertical parameter branch is retained as an event',()=>{
 const s=nurbsSurface3(1,2,[0n,1n].map(u=>[1n,-1n,1n].map(z=>point3(u,0n,z))),K,J),t=nurbsSurface3(1,1,[-1n,1n].map(y=>[0n,1n].map(z=>point3('1/2',y,z))),K,K),r=report(s,t),seen=[];
 for(let e=0;e<r.patches[0]!.edges.length;e++){const a=analyzeNurbsAffineIntersectionEdgeEvents3(r,0,e);seen.push(...a.events);assert.ok(a.intervals.every(q=>q.kind==='regular'&&q.transverse&&q.sourceRegular));}
 const at=seen.filter(q=>q.parameter.sign()===0);assert.ok(at.length>0);assert.ok(at.every(q=>q.differential.kind==='stationary-image'&&!q.differential.sourceRegular));
});
test('a node retains singular endpoint states without extending them to regular open branches',()=>{
 const values=[1n,-1n,1n],uv=[-1n,0n,1n],s=nurbsSurface3(2,2,uv.map((u,i)=>uv.map((v,j)=>point3(u,v,values[j]!-values[i]!))),J,J),r=report(s),events=[];
 for(let e=0;e<r.patches[0]!.edges.length;e++){const a=analyzeNurbsAffineIntersectionEdgeEvents3(r,0,e);events.push(...a.events);assert.ok(a.intervals.every(q=>q.kind==='regular'&&q.sourceRegular&&q.transverse));}
 assert.ok(events.some(e=>e.parameter.sign()===0&&e.differential.kind==='singular-parameter'));
});

function rectangle(a:string,b:string,c:string,d:string){const p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];return prepareNurbsParameterDomain2(p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K)));}
test('trim events obey finite retained bounds and reject forged ownership and indices',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,'-1/4'),point3(0n,1n,'-1/4')],[point3(1n,0n,'-1/4'),point3(1n,1n,'3/4')]],K,K),raw=report(s),trim=trimNurbsAffineIntersection3(raw,rectangle('1/3','0','3/4','1'),rectangle('0','0','1','1'));
 assert.ok(trim.patches.length>0);
 for(let p=0;p<trim.patches.length;p++)for(let e=0;e<trim.patches[p]!.edges.length;e++){const a=analyzeTrimmedNurbsAffineIntersectionEdgeEvents3(trim,p,e),edge=trim.patches[p]!.edges[e]!;assert.equal(a.events[0]!.parameter.compare(edge.lower),0);assert.equal(a.events.at(-1)!.parameter.compare(edge.upper),0);assert.ok(a.intervals.every(q=>q.sample.sourceLocation==='inside'&&q.sample.targetLocation==='inside'));}
 assert.throws(()=>analyzeTrimmedNurbsAffineIntersectionEdgeEvents3({...trim},0,0),/factory/);assert.throws(()=>analyzeTrimmedNurbsAffineIntersectionEdgeEvents3(trim,0,99),/Invalid/);
});
test('a seam shares event parameters while preserving opposite one-sided orientations',()=>{
 const crease=nurbsSurface3(1,1,[[point3(0n,0n,'1/2'),point3(0n,1n,'1/2')],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'1/2'),point3(1n,1n,'1/2')]],[0n,0n,'1/2',1n,1n],K),raw=report(crease),trim=trimNurbsAffineIntersection3(raw,rectangle('0','0','1','1'),rectangle('0','0','1','1')),complex=sewNurbsAffineIntersection3(trim),a=analyzeNurbsAffineIntersectionComplexEdgeEvents3(complex,0);
 assert.equal(a.uses.length,2);assert.ok(a.parameters.length>=2);
 for(const u of a.uses){assert.equal(u.events.length,a.parameters.length);assert.equal(u.intervals.length,a.parameters.length-1);assert.ok(u.intervals.every(q=>q.kind==='regular'&&q.transverse));}
 const orientations=a.uses.map(u=>{const d=u.intervals[0]!.sample;return d.kind==='regular'?d.orientation:0;}).sort();assert.deepEqual(orientations,[-1,1]);
 assert.throws(()=>analyzeNurbsAffineIntersectionComplexEdgeEvents3({...complex},0),/factory/);assert.throws(()=>analyzeNurbsAffineIntersectionComplexEdgeEvents3(complex,NaN),/Invalid/);
});
