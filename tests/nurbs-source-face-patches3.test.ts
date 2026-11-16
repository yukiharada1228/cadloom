import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
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
test('the trim-interior side can be continuous while an unused incident seam image differs',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/4',0n,0n),point3('1/4',1n,0n)],[point3('3/4',0n,0n),point3('3/4',1n,0n)],[point3(1n,0n,0n),point3(1n,1n,0n)]],[0n,0n,'1/2','1/2',1n,1n],K),d=prepareNurbsParameterDomain2(ring('1/2','0','1','1')),r=selected(s,plane(),d);assert.equal(r.source.continuous,false);assert.equal(r.faces.length,1);assert.equal(r.faces[0]!.positionContinuous,true);assert.ok(r.faces[0]!.cycles.flatMap(c=>c.uses).every(u=>r.source.patches[u.patch]!.startU.compare(new Rational(1n,2n))>=0));assert.ok(r.seams.every(s=>s.interiorFaces.length===0));assert.throws(()=>selectNurbsSourceFacePatches3({...r.source}),/factory/);
});
test('closed outer boundary does not hide a discontinuous interior source seam',()=>{
 const xs=['0','1/2','1/2','1'],ys=['0','1/2','1'],s=nurbsSurface3(1,2,xs.map((x,i)=>ys.map((y,j)=>point3(x,y,i<2||j!==1?0n:1n))),[0n,0n,'1/2','1/2',1n,1n],K2),r=selected(s,plane());assert.equal(r.source.continuous,true);assert.equal(r.faces.length,1);const f=r.faces[0]!;assert.equal(f.boundaryClosed,true);assert.equal(f.interiorContinuous,false);assert.equal(f.positionContinuous,false);assert.ok(r.seams.some(s=>!s.continuous&&s.interiorFaces.includes(f.face)));
});
test('two faces on a continuous crease select their own local patch sides',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,'1/2'),point3(0n,1n,'1/2')],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'1/2'),point3(1n,1n,'1/2')]],[0n,0n,'1/2',1n,1n],K),r=selected(s,plane());assert.equal(r.faces.length,2);assert.ok(r.faces.every(f=>f.positionContinuous));for(const f of r.faces){const side=r.source.source.faces[f.face]!.sample.u.compare(new Rational(1n,2n));for(const u of f.cycles.flatMap(c=>c.uses)){const p=r.source.patches[u.patch]!;assert.ok(side<0?p.endU.compare(new Rational(1n,2n))<=0:p.startU.compare(new Rational(1n,2n))>=0);}}
});
test('an algebraic constant-u cut does not require rational boundary coordinates',()=>{
 const s=nurbsSurface3(2,1,[0n,'1/2',1n].map((u,i)=>[0n,1n].map(v=>point3(u,v,i===2?'1/2':'-1/2'))),K2,K),r=selected(s,plane());assert.equal(r.faces.length,2);assert.ok(r.faces.every(f=>f.positionContinuous));assert.ok(r.source.edges.some(e=>e.events.some(q=>q.u.recognizeRational().rational===null)));
});
test('knot seams are restricted to the actual annular face and skip the hole interior',()=>{
 const knots=[0n,0n,'1/2',1n,1n],xy=[0n,'1/2',1n],s=nurbsSurface3(1,1,xy.map(u=>xy.map(v=>point3(u,v,0n))),knots,knots),d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/3','1/3','2/3','2/3',true)]),r=selected(s,plane(),d);assert.equal(r.faces.length,1);assert.equal(r.faces[0]!.positionContinuous,true);assert.equal(r.seams.length,4);for(const seam of r.seams){assert.equal(seam.continuous,true);assert.deepEqual(seam.interiorFaces,[r.faces[0]!.face]);assert.ok(seam.upper.compare(AlgebraicReal.fromRational('1/3'))<=0||seam.lower.compare(AlgebraicReal.fromRational('2/3'))>=0);}
});

test('horizontal knot boundaries select the UV-left side for both traversal directions',()=>{
 const s=nurbsSurface3(1,1,[0n,1n].map(u=>[point3(u,0n,'1/2'),point3(u,'1/2',0n),point3(u,1n,'1/2')]),K,[0n,0n,'1/2',1n,1n]),r=selected(s,plane());assert.equal(r.faces.length,2);for(const f of r.faces){assert.equal(f.positionContinuous,true);const side=r.source.source.faces[f.face]!.sample.v.compare(new Rational(1n,2n));for(const u of f.cycles.flatMap(c=>c.uses)){const p=r.source.patches[u.patch]!;assert.ok(side<0?p.endV.compare(new Rational(1n,2n))<=0:p.startV.compare(new Rational(1n,2n))>=0);}}
});
test('unresolved active bounds propagate without assigning face patches',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),lift=liftNurbsSourceFaceBoundaries3(prepared(s,plane())),r=selectNurbsSourceFacePatches3(lift);assert.equal(r.kind,'unresolved');if(r.kind==='unresolved'){assert.equal(r.reason,'unresolved-lift');assert.equal(r.source,lift);}assert.ok(!('faces' in r));
});
