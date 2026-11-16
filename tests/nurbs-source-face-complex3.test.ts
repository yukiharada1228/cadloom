import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNurbsSourceFaceComplex3,evaluateNurbsSourceComplexEdge3,certifyNurbsSurfaceTriangularProjection3,evaluateNurbsTriangularSurface3,certifyNurbsSourceFaceEmbedding3,evaluateNurbsSurface3,analyzeNurbsSourceFaceClosedRank3,analyzeNurbsSourceFaceVertexRegularity3,analyzeNurbsSourceFaceBoundaryRegularity3,analyzeNurbsSourceFaceInteriorRegularity3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
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
function embedding(s:NurbsSurface3,t=plane('2'),d=unit()){const r=certifyNurbsSourceFaceEmbedding3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected embedding analysis');return r;}
function complex(s:NurbsSurface3,t=plane('2'),d=unit()){const r=prepareNurbsSourceFaceComplex3(selected(s,t,d));assert.equal(r.kind,'prepared');if(r.kind!=='prepared')throw Error('Expected prepared complex');return r;}
test('a certified plane yields a closed face cycle with four open boundary edges',()=>{
 const r=complex(plane());assert.equal(r.faces.length,1);assert.equal(r.vertices.length,4);assert.equal(r.edges.length,4);assert.equal(r.boundaryEdges.length,4);assert.equal(r.pairedEdges.length,0);assert.equal(r.nonmanifoldEdges.length,0);assert.equal(r.faces[0]!.cycles[0]!.role,'outer');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.edges)&&r.edges.every(e=>Object.isFrozen(e.uses)));
 for(const e of r.edges){assert.equal(e.uses.length,1);assert.ok(e.lower.compare(e.upper)<0);}
});
test('a finite SSI cut shares one whole edge with opposite face traversals',()=>{
 const s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),r=complex(s,plane());assert.equal(r.faces.length,2);assert.equal(r.pairedEdges.length,1);assert.equal(r.boundaryEdges.length,6);const id=r.pairedEdges[0]!,e=r.edges[id]!;assert.notEqual(e.uses[0]!.face,e.uses[1]!.face);assert.equal(e.uses[0]!.direction,-e.uses[1]!.direction);const t=e.lower.add(e.upper).div(AlgebraicReal.fromRational(2n));assert.equal(compareAlgebraicPoints3(evaluateNurbsSourceComplexEdge3(r,id,0,t).point,evaluateNurbsSourceComplexEdge3(r,id,1,t).point),0);
});
test('a nonlinear trimmed chart retains its positive embedding certificate',()=>{
 const s=nurbsSurface3(2,1,[0n,0n,1n].map(x=>[0n,1n].map(v=>point3(x,v,0n))),K2,K),r=complex(s,plane('2'),prepareNurbsParameterDomain2(ring('1/4','0','1','1')));assert.ok(r.embedding.faces.every(f=>f.kind==='certified'&&f.method==='triangular'));assert.equal(r.boundaryEdges.length,4);
});
test('hole boundary roles and all closed cycle incidences survive preparation',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),r=complex(plane(),plane('2'),d);assert.equal(r.faces.length,1);assert.deepEqual(r.faces[0]!.cycles.map(c=>c.role).sort(),['hole','outer']);assert.equal(r.boundaryEdges.length,8);
 for(const c of r.faces[0]!.cycles)for(let i=0;i<c.uses.length;i++){const a=c.uses[i]!,b=c.uses[(i+1)%c.uses.length]!,A=r.edges[a.edge]!,B=r.edges[b.edge]!;assert.equal(a.direction===1?A.to:A.from,b.direction===1?B.from:B.to);}
});
test('discontinuous knot sides on distinct certified faces remain separate spatial edges',()=>{
 const xs=['0','1/4','3/4','1'],s=nurbsSurface3(1,1,xs.map(x=>[0n,1n].map(v=>point3(x,v,0n))),[0n,0n,'1/2','1/2',1n,1n],K),target=nurbsSurface3(1,1,[0n,1n].map(v=>[0n,1n].map(z=>point3('1/4',v,z))),K,K),r=complex(s,target);assert.equal(r.faces.length,2);assert.equal(r.pairedEdges.length,0);const groups=new Map<string,number[]>();r.edges.forEach((e,i)=>{const key=e.sourceEdge+':'+e.sourcePiece;groups.set(key,[...(groups.get(key)??[]),i]);});const pair=[...groups.values()].find(ids=>ids.length===2);assert.ok(pair);if(pair){const a=r.edges[pair[0]!]!,b=r.edges[pair[1]!]!;assert.notEqual(a.from,b.from);assert.notEqual(compareAlgebraicPoints3(r.vertices[a.from]!.point,r.vertices[b.from]!.point),0);}
});
test('uncertified faces and copied complexes cannot be used as prepared geometry',()=>{
 const r=prepareNurbsSourceFaceComplex3(selected(fold(),plane('2')));assert.equal(r.kind,'not-prepared');assert.throws(()=>evaluateNurbsSourceComplexEdge3(r,0,0,0n),/not prepared/);const p=complex(plane());assert.throws(()=>evaluateNurbsSourceComplexEdge3({...p},0,0,0n),/factory/);assert.throws(()=>evaluateNurbsSourceComplexEdge3(p,-1,0,0n),/edge/);assert.throws(()=>evaluateNurbsSourceComplexEdge3(p,0,99,0n),/use/);assert.throws(()=>evaluateNurbsSourceComplexEdge3(p,0,0,-1n),/outside/);
});
test('coincident UV branches with different spatial images propagate the upstream unresolved result',()=>{
 const xs=['0','1/4','3/4','1'],zs=['-1/2','0','0','1/2'],s=nurbsSurface3(1,1,xs.map((x,i)=>[0n,1n].map(v=>point3(x,v,zs[i]!))),[0n,0n,'1/2','1/2',1n,1n],K),F=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,plane())))),P=selectNurbsSourceFacePatches3(liftNurbsSourceFaceBoundaries3(F)),r=prepareNurbsSourceFaceComplex3(P);assert.equal(r.kind,'not-prepared');if(r.kind==='not-prepared')assert.equal(r.reason,'unresolved-patches');
});
