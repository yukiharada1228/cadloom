import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeNurbsSourceFaceBoundaryRegularity3,analyzeNurbsSourceFaceInteriorRegularity3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
function selected(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const result=selectNurbsSourceFacePatches3(lifted(s,t,d));assert.equal(result.kind,'selected');if(result.kind!=='selected')throw Error('Expected patch selection');return result;}
function analyzed(s:NurbsSurface3,t=plane('1'),d=unit()){const r=analyzeNurbsSourceFaceInteriorRegularity3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected regularity analysis');return r;}
const fold=()=>nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(y=>point3(u,y,0n))),K,K2);
function boundary(s:NurbsSurface3,t=plane('1'),d=unit()){const r=analyzeNurbsSourceFaceBoundaryRegularity3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected boundary analysis');return r;}
test('regular selected boundary uses do not claim all vertex sectors are covered',()=>{
 const r=boundary(plane());assert.ok(r.faces.every(f=>f.selectedBoundaryRegular));assert.equal(r.vertexSectorCoverage,'not-certified');assert.throws(()=>analyzeNurbsSourceFaceBoundaryRegularity3({...r.source}),/factory/);
});
test('a boundary-coincident rank-loss interval is distinct from regular open face interior',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1/2')),s=fold(),r=boundary(s,plane('1'),d);assert.equal(analyzed(s,plane('1'),d).faces[0]!.status,'regular');assert.equal(r.faces[0]!.selectedBoundaryRegular,false);assert.ok(r.faces[0]!.uses.some(u=>u.intervals.some(i=>!i.regular)&&u.events.every(e=>e.v.compare(AlgebraicReal.fromRational('1/2'))===0)));
});
test('selected implicit intersection branches retain whole singular boundary intervals on both faces',()=>{
 const t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,v))),K,K),r=boundary(fold(),t),c=r.source.source.source.source.source;assert.equal(r.faces.length,2);for(const f of r.faces){assert.equal(f.selectedBoundaryRegular,false);assert.ok(f.uses.some(u=>c.edges[u.edge]!.boundaryUses.length===0&&u.intervals.some(i=>!i.regular)));}
});
test('isolated rank loss at a corner or inside an unsplit boundary is retained with regular neighboring intervals',()=>{
 const B=['0','0','1'].map(Rational.parse),V=['0','1/2','1'].map(Rational.parse);
 for(const midpoint of [false,true]){const A=(midpoint?['1/4','-1/4','1/4']:['0','0','1']).map(Rational.parse),U=(midpoint?['-1/2','0','1/2']:['0','1/2','1']).map(Rational.parse),s=nurbsSurface3(2,2,A.map((a,i)=>B.map((b,j)=>point3(a,b,U[i]!.mul(V[j]!)))),K2,K2),r=boundary(s),events=r.faces[0]!.uses.flatMap(u=>u.events).filter(e=>!e.regular);assert.equal(r.faces[0]!.selectedBoundaryRegular,false);assert.ok(events.length>0);assert.ok(r.faces[0]!.uses.every(u=>u.intervals.every(i=>i.regular)));for(const e of events){assert.equal(e.u.compare(AlgebraicReal.fromRational(midpoint?'1/2':'0')),0);assert.equal(e.v.sign(),0);assert.equal(e.point.x.sign(),0);assert.equal(e.point.y.sign(),0);assert.equal(e.point.z.sign(),0);}if(midpoint)assert.ok(r.faces[0]!.uses.some(u=>u.events.length>=3));}
});
test('irrational boundary rank events are found exactly on both vertical domain edges',()=>{
 const s=nurbsSurface3(1,3,[0n,1n].map(u=>['0','-1/6','-1/3','-1/6'].map(y=>point3(u,y,0n))),K,[0n,0n,0n,0n,1n,1n,1n,1n]),r=boundary(s),events=r.faces[0]!.uses.flatMap(u=>u.events).filter(e=>!e.regular);assert.equal(events.length,2);for(const e of events)assert.equal(e.v.mul(e.v).compare(AlgebraicReal.fromRational('1/2')),0);
});
test('an unused collapsed seam side does not fail the selected regular face boundary',()=>{
 const xs=['0','1/2','1/2','1'],s=nurbsSurface3(1,1,xs.map((x,i)=>[point3(x,0n,0n),point3(x,i<2?0n:1n,0n)]),[0n,0n,'1/2','1/2',1n,1n],K),d=prepareNurbsParameterDomain2(ring('1/2','0','1','1')),r=boundary(s,plane('1'),d);assert.equal(r.support.everyPatchRegular,false);assert.equal(r.faces[0]!.selectedBoundaryRegular,true);assert.ok(r.faces[0]!.uses.every(u=>r.support.patches[u.patch]!.regular));
});
test('wholly rank-one source boundary intervals remain singular without dimension claims',()=>{
 const s=nurbsSurface3(1,1,[0n,1n].map(u=>[point3(u,0n,0n),point3(u,0n,0n)]),K,K),r=boundary(s);assert.equal(r.faces[0]!.selectedBoundaryRegular,false);assert.ok(r.faces[0]!.uses.every(u=>u.events.every(e=>!e.regular)&&u.intervals.every(i=>!i.regular)));
});
test('unresolved patch selection propagates instead of claiming boundary rank',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),p=selectNurbsSourceFacePatches3(liftNurbsSourceFaceBoundaries3(prepared(s,plane()))),r=analyzeNurbsSourceFaceBoundaryRegularity3(p);assert.equal(r.kind,'unresolved');assert.ok(!('faces' in r));
});
