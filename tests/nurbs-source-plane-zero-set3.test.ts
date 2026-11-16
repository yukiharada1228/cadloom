import {analyzeNurbsSourcePlaneZeroSet3,buildNurbsSourcePlaneCellComplex3,buildNurbsSourceBRep3,sewNurbsSourceBReps3,refineSewnNurbsSourceEdgesByPlane3,matchNurbsPlaneCellSourceEdges3,nodeNurbsPlaneCellSourceEdges3,buildNurbsPlaneSplitFaces3,partitionNurbsSplitFaceByPlane3} from '../dist/index.js';
import {partitionNurbsSourceFaceByPlane3,nurbsSourcePlaneCellPoint3} from '../dist/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 intersectNurbsSourceFacePlane3,nurbsSourceFacePlaneEdgePoint3,nurbsSourceFacePlaneAreaPoint3,plane3,
 prepareNurbsSourceFaceComplex3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,classifyNurbsSourceFaces3,
 buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,refineNurbsAffineIntersectionComplex3,sewNurbsAffineIntersection3,
 trimNurbsAffineIntersection3,intersectNurbsSurfaceAffineTarget3,certifyNurbsSurfaceAffineProjection3,
 point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,AlgebraicReal,Rational
} from '../dist/index.js';
import type {NurbsSurface3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
function selected(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const result=selectNurbsSourceFacePatches3(lifted(s,t,d));assert.equal(result.kind,'selected');if(result.kind!=='selected')throw Error('Expected patch selection');return result;}
const fold=()=>nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(y=>point3(u,y,0n))),K,K2);
function complex(s:NurbsSurface3,t=plane('2'),d=unit()){const r=prepareNurbsSourceFaceComplex3(selected(s,t,d));assert.equal(r.kind,'prepared');if(r.kind!=='prepared')throw Error('Expected prepared complex');return r;}

function planeSection(c:ReturnType<typeof complex>,p:ReturnType<typeof plane3>){const r=intersectNurbsSourceFacePlane3(c,c.faces[0]!.face,p);assert.equal(r.kind,'resolved');if(r.kind!=='resolved')throw Error('Expected finite plane section');return r;}
function sampleEdges(r:ReturnType<typeof planeSection>){return r.edges.map((e,i)=>{let a=e.lower,b=e.upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return nurbsSourceFacePlaneEdgePoint3(r,i,a.upper.add(b.lower).div(new Rational(2n)));});}


function cellsOf(c:ReturnType<typeof complex>,p=plane3(0n,0n,1n,0n)){return buildNurbsSourcePlaneCellComplex3(partitionNurbsSourceFaceByPlane3(c,c.faces[0]!.face,p));}
function zeros(C:ReturnType<typeof cellsOf>){const r=analyzeNurbsSourcePlaneZeroSet3(C);assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected complete zero strata');return r.certificate;}
function bowl(){const V=['0','1/2','1'],H=['1/4','-1/4','1/4'];return nurbsSurface3(2,2,V.map((u,i)=>V.map((v,j)=>point3(u,v,Rational.parse(H[i]!).add(Rational.parse(H[j]!))))),K2,K2);}
test('an isolated tangent zero remains visible after equal-sign region boundary cancellation',()=>{
 const C=cellsOf(complex(bowl(),plane('100'))),r=zeros(C);assert.equal(C.regions.length,1);assert.ok(C.source.cells.every(c=>c.sign===1));assert.equal(r.edges.length,0);assert.equal(r.isolated.length,1);const v=r.vertices[r.isolated[0]!]!;assert.equal(v.point.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(v.point.v.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(v.point.point.z.sign(),0);assert.equal(v.point.stratum,'face');assert.ok(C.regions.every(c=>c.boundary.every(u=>{const e=C.edges[u.edge]!;return e.from!==v.sourceVertex&&e.to!==v.sourceVertex;})));
});
test('same-sign tangent arcs and opposite-sign section arcs have distinct exact incidence classes',()=>{
 const tangent=nurbsSurface3(1,2,[0n,1n].map(u=>['0','1/2','1'].map((v,j)=>point3(u,v,['1/4','-1/4','1/4'][j]!))),K,K2);
 for(const sign of [1n,-7n]){const C=cellsOf(complex(tangent,plane('100')),plane3(0n,0n,sign,0n)),r=zeros(C);assert.equal(C.regions.length,1);assert.equal(r.edges.length,1);assert.equal(r.edges[0]!.kind,'same-sign');assert.deepEqual(r.edges[0]!.signs,[sign===1n?1:-1]);assert.equal(r.edges[0]!.sample.point.z.sign(),0);assert.ok(C.regions[0]!.boundary.every(u=>u.edge!==r.edges[0]!.edge));assert.deepEqual(r.isolated,[]);}
 const crossing=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(v).sub(new Rational(1n,2n))))),K,K),r=zeros(cellsOf(complex(crossing,plane('100'))));assert.equal(r.edges.length,1);assert.equal(r.edges[0]!.kind,'opposite-signs');assert.deepEqual(r.edges[0]!.signs,[-1,1]);
});
test('quartic contact isolation keeps a real-algebraic critical coordinate exactly',()=>{
 const U=['0','1/4','1/2','3/4','1'],A=['1/4','1/4','1/12','-1/4','1/4'],V=['0','1/2','1'],H=['1/4','-1/4','1/4'],J4=[0n,0n,0n,0n,0n,1n,1n,1n,1n,1n],s=nurbsSurface3(4,2,U.map((u,i)=>V.map((v,j)=>point3(u,v,Rational.parse(A[i]!).add(Rational.parse(H[j]!))))),J4,K2),r=zeros(cellsOf(complex(s,plane('100'))));assert.equal(r.edges.length,0);assert.equal(r.isolated.length,1);const p=r.vertices[r.isolated[0]!]!.point.point;assert.equal(p.x.rational,null);assert.equal(p.x.mul(p.x).compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.y.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.z.sign(),0);
});
test('holes and previous finite-region restrictions exclude roots outside the retained closed domain',()=>{
 const domain=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),excluded=zeros(cellsOf(complex(bowl(),plane('100'),domain)));assert.deepEqual(excluded.isolated,[]);assert.deepEqual(excluded.edges,[]);assert.deepEqual(excluded.vertices,[]);
 const c=complex(bowl(),plane('100')),raw=sewNurbsSourceBReps3([buildNurbsSourceBRep3(c)]);assert.equal(raw.kind,'sewn');if(raw.kind!=='sewn')throw Error('Expected source');const P=plane3(1n,0n,0n,'-3/4'),R=refineSewnNurbsSourceEdgesByPlane3(raw,P),C=cellsOf(c,P),B=buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(R,0,C)));assert.equal(B.kind,'built');if(B.kind!=='built')throw Error('Expected finite split surface');const face=B.topology.faces.find(f=>f.surface.sign===1)!.surface,next=partitionNurbsSplitFaceByPlane3(face,plane3(0n,0n,1n,0n)),r=zeros(buildNurbsSourcePlaneCellComplex3(next));assert.deepEqual(r.edges,[]);assert.deepEqual(r.vertices,[]);assert.equal(r.source.source.restriction,face);
});
test('coplanar two-dimensional cells remain area evidence and only owned complexes can be analyzed',()=>{
 const C=cellsOf(complex(plane(),plane('100'))),r=zeros(C);assert.equal(r.coplanarCells.length,C.source.cells.length);assert.ok(r.coplanarCells.length>0);assert.ok(r.edges.every(e=>e.kind==='coplanar-incidence'));assert.deepEqual(r.isolated,[]);for(const e of r.edges){assert.equal(r.vertices[e.from]!.point.point.z.sign(),0);assert.equal(r.vertices[e.to]!.point.point.z.sign(),0);}assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.vertices)&&Object.isFrozen(r.edges)&&Object.isFrozen(r.coplanarCells));assert.throws(()=>analyzeNurbsSourcePlaneZeroSet3({...C}),/factory/);
});
