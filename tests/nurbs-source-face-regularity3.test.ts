import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeNurbsSourceFaceInteriorRegularity3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
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
test('a regular source patch stays regular on its open UV face',()=>{
 const r=analyzed(plane());assert.equal(r.support.everyPatchRegular,true);assert.ok(r.faces.every(f=>f.status==='regular'));assert.throws(()=>analyzeNurbsSourceFaceInteriorRegularity3({...r.source}),/factory/);
});
test('an interior rank-drop line yields an exact face and spatial witness',()=>{
 const r=analyzed(fold()),f=r.faces[0]!;assert.equal(f.status,'singular');const w=f.patches[0]!.witness!;assert.equal(w.v.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(w.point.y.sign(),0);assert.equal(w.point.z.sign(),0);
});
test('rank loss outside the trim or only on its boundary is excluded from open-face regularity',()=>{
 for(const end of ['2/5','1/2']){const d=prepareNurbsParameterDomain2(ring('0','0','1',end)),r=analyzed(fold(),plane('1'),d);assert.equal(r.support.everyPatchRegular,false);assert.ok(r.faces.every(f=>f.status==='regular'));}
});
test('a singular cut boundary is distinct from the two regular open faces',()=>{
 const t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,v))),K,K),r=analyzed(fold(),t);assert.equal(r.faces.length,2);assert.ok(r.faces.every(f=>f.status==='regular'));assert.equal(r.support.everyPatchRegular,false);
});
test('finite-system and shared-polynomial isolated rank loss are removed by a hole',()=>{
 const square=['1/4','-1/4','1/4'].map(Rational.parse),linear=['-1/2','0','1/2'].map(Rational.parse),d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]);
 for(const mode of ['finite','shared']){const s=nurbsSurface3(2,2,square.map((a,i)=>square.map((b,j)=>mode==='finite'?point3(a,b,linear[i]!.mul(linear[j]!)):point3(a.sub(b),linear[i]!.mul(linear[j]!).mul(new Rational(2n)),0n))),K2,K2),without=analyzed(s),withHole=analyzed(s,plane('1'),d);assert.equal(without.faces[0]!.status,'singular');assert.equal(without.faces[0]!.patches[0]!.witness!.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(withHole.faces[0]!.status,'regular');}
});
test('rank-one source regions retain an interior witness without dimension claims about their image',()=>{
 const s=nurbsSurface3(1,1,[0n,1n].map(u=>[point3(u,0n,0n),point3(u,0n,0n)]),K,K),r=analyzed(s);assert.equal(r.support.patches[0]!.locus!.kind,'area');assert.equal(r.faces[0]!.status,'singular');assert.ok(r.faces[0]!.patches[0]!.witness);
});
test('an irrational singular line is not missed by rational interior probes',()=>{
 const s=nurbsSurface3(1,3,[0n,1n].map(u=>['0','-1/6','-1/3','-1/6'].map(y=>point3(u,y,0n))),K,[0n,0n,0n,0n,1n,1n,1n,1n]),r=analyzed(s),w=r.faces[0]!.patches[0]!.witness!;assert.equal(r.faces[0]!.status,'singular');assert.equal(w.v.mul(w.v).compare(AlgebraicReal.fromRational('1/2')),0);
});
test('a whole closed singular component inside a hole is excluded without boundary crossings',()=>{
 const A=['0','-1/2','0'].map(Rational.parse),G=['0','49/300','4/25','97/300'].map(Rational.parse),s=nurbsSurface3(2,3,A.map((a,i)=>G.map((g,j)=>point3(new Rational(BigInt(i),2n),g.add(a.mul(new Rational(BigInt(j),3n))),0n))),K2,[0n,0n,0n,0n,1n,1n,1n,1n]),d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]);assert.equal(analyzed(s).faces[0]!.status,'singular');assert.equal(analyzed(s,plane('1'),d).faces[0]!.status,'regular');
});

test('unresolved source patch selections propagate without a regularity claim',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),p=selectNurbsSourceFacePatches3(liftNurbsSourceFaceBoundaries3(prepared(s,plane()))),r=analyzeNurbsSourceFaceInteriorRegularity3(p);assert.equal(r.kind,'unresolved');if(r.kind==='unresolved')assert.equal(r.reason,'unresolved-patches');assert.ok(!('faces' in r));
});
