import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,analyzeNurbsTrimSeams3,insertNurbsSurfaceKnot3,AlgebraicReal,reverseNurbsCurve3} from '../dist/index.js';
const K=[0n,0n,1n,1n],U=[0n,0n,'1/2','1/2',1n,1n],V=[0n,0n,0n,1n,1n,1n];
const line=(a:readonly [string,string],b:readonly [string,string])=>nurbsCurve3(1,[point3(a[0],a[1],0n),point3(b[0],b[1],0n)],K),polygon=(p:readonly (readonly [string,string])[])=>p.map((a,i)=>line(a,p[(i+1)%p.length]!)),rect=(a:string,b:string,c:string,d:string)=>polygon([[a,b],[c,b],[c,d],[a,d]]),domain=()=>prepareNurbsParameterDomain2(rect('1/10','1/10','9/10','9/10'));
function patch(zRight:readonly string[]=['0','0','0']){return nurbsSurface3(1,2,['0','1/2','1/2','1'].map((x,i)=>['0','1/2','1'].map((v,j)=>point3(x,v,i<2?'0':zRight[j]!))),U,V);}
test('matching patches are position-, C1- and G1-continuous over the retained interval',()=>{
  const r=analyzeNurbsTrimSeams3(patch(),domain());assert.equal(r.continuous,true);assert.equal(r.c1,true);assert.equal(r.g1,true);assert.equal(r.seams.length,1);assert.equal(r.seams[0]!.intervals.length,1);assert.equal(r.seams[0]!.intervals[0]!.startParameter.compare(AlgebraicReal.fromRational('1/10')),0);
});
test('a supporting gap outside the trim does not invalidate retained seam continuity',()=>{
  const r=analyzeNurbsTrimSeams3(patch(['1','1','1']),prepareNurbsParameterDomain2(rect('3/5','1/10','9/10','9/10')));assert.equal(r.seams[0]!.source.continuous,false);assert.equal(r.seams[0]!.points.length,0);assert.equal(r.seams[0]!.intervals.length,0);assert.equal(r.continuous,true);
});
test('a gap with one isolated agreement point is partitioned at the double root',()=>{
  const r=analyzeNurbsTrimSeams3(patch(['1/4','-1/4','1/4']),domain()),s=r.seams[0]!;assert.equal(r.continuous,false);assert.equal(s.intervals.length,2);assert.ok(s.intervals.every(i=>!i.continuous));const p=s.points.find(p=>p.parameter.compare(AlgebraicReal.fromRational('1/2'))===0)!;assert.ok(p);assert.equal(p.continuous,true);assert.equal(p.c1,true);assert.equal(p.g1,true);
});
test('a trim touching only the isolated agreement point retains no false gap interval',()=>{
  const d=prepareNurbsParameterDomain2(polygon([['1/10','1/10'],['1/2','1/2'],['1/10','9/10']])),r=analyzeNurbsTrimSeams3(patch(['1/4','-1/4','1/4']),d),s=r.seams[0]!;assert.equal(s.intervals.length,0);assert.equal(s.points.length,1);assert.equal(s.points[0]!.location,'boundary');assert.equal(r.continuous,true);assert.equal(r.c1,true);assert.equal(r.g1,true);
});
test('hole interiors are removed but hole boundaries remain endpoints',()=>{
  const hole=rect('1/4','1/4','3/4','3/4').reverse().map(reverseNurbsCurve3),r=analyzeNurbsTrimSeams3(patch(),prepareNurbsParameterDomain2(rect('1/10','1/10','9/10','9/10'),[hole])),s=r.seams[0]!;assert.equal(s.intervals.length,2);assert.equal(s.points.length,4);assert.equal(s.intervals[0]!.endParameter.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(s.intervals[1]!.startParameter.compare(AlgebraicReal.fromRational('3/4')),0);
});
test('a boundary-coincident seam interval is classified as boundary',()=>{
  const r=analyzeNurbsTrimSeams3(patch(),prepareNurbsParameterDomain2(rect('1/2','1/4','3/4','3/4')));assert.equal(r.seams[0]!.intervals.length,1);assert.equal(r.seams[0]!.intervals[0]!.location,'boundary');
});
test('irrational trim intersections are exact seam interval endpoints',()=>{
  const c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],V),d=prepareNurbsParameterDomain2([c,line(['1','1'],['0','1']),line(['0','1'],['0','0'])]),r=analyzeNurbsTrimSeams3(patch(),d);assert.equal(r.seams[0]!.intervals[0]!.startParameter.compare(AlgebraicReal.fromRational('1/2').sqrt()),0);
});
test('speed changes preserve G1 but fail C1 in the original coordinates',()=>{
  const s=nurbsSurface3(1,1,['0','1','1','3'].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),U,K),r=analyzeNurbsTrimSeams3(s,domain());assert.equal(r.continuous,true);assert.equal(r.c1,false);assert.equal(r.g1,true);
});
test('folded and orientation-reversing seams fail cooriented G1',()=>{
  const fold=nurbsSurface3(1,1,['0','1/2','1/2','1'].map((x,i)=>[point3(x,0n,i===3?1n:0n),point3(x,1n,i===3?1n:0n)]),U,K),reverse=nurbsSurface3(1,1,['0','1','1','0'].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),U,K);for(const s of [fold,reverse]){const r=analyzeNurbsTrimSeams3(s,domain());assert.equal(r.continuous,true);assert.equal(r.g1,false);}
});
test('zero normals cannot be certified G1 even when first derivatives match',()=>{
  const s=nurbsSurface3(1,1,['0','1/2','1/2','1'].map(x=>[point3(x,0n,0n),point3(x,0n,0n)]),U,K),r=analyzeNurbsTrimSeams3(s,domain());assert.equal(r.continuous,true);assert.equal(r.c1,true);assert.equal(r.g1,false);
});
test('refinement exposes both seam directions without changing smoothness',()=>{
  const s=insertNurbsSurfaceKnot3(patch(),'v','1/3',3),r=analyzeNurbsTrimSeams3(s,domain());assert.equal(r.seams.length,4);assert.equal(r.c1,true);assert.equal(r.g1,true);assert.equal(r.seams.filter(s=>s.source.direction==='v').length,2);
});
test('cached domain methods are ignored and out-of-range domains are rejected',()=>{
  const d=domain(),r=analyzeNurbsTrimSeams3(patch(['1','1','1']),{...d,locate:()=> 'outside' as const});assert.equal(r.continuous,false);assert.throws(()=>analyzeNurbsTrimSeams3(patch(),prepareNurbsParameterDomain2(rect('-1','0','2','1'))),/domain/);
});
test('nonconstant rational weights and different homogeneous scales preserve all seam identities',()=>{
  const s=nurbsSurface3(1,2,['0','1/2','1/2','1'].map(x=>['0','1/2','1'].map(y=>point3(x,y,0n))),U,V,[[1n,2n,3n],[1n,2n,3n],[7n,14n,21n],[7n,14n,21n]]),r=analyzeNurbsTrimSeams3(s,domain());assert.equal(r.continuous,true);assert.equal(r.c1,true);assert.equal(r.g1,true);
});
test('G1 sign changes are split at zero normal roots and coorientation is checked on each cell',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3('1/4',0n,0n),point3('3/4',1n,0n)]],U,K),r=analyzeNurbsTrimSeams3(s,domain()),seam=r.seams[0]!;assert.equal(r.continuous,true);assert.equal(r.g1,false);assert.equal(seam.intervals.length,2);assert.equal(seam.intervals[0]!.g1,false);assert.equal(seam.intervals[1]!.g1,true);const p=seam.points.find(p=>p.parameter.compare(AlgebraicReal.fromRational('1/2'))===0)!;assert.ok(p);assert.equal(p.g1,false);
});
