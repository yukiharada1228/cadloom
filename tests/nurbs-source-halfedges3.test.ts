import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function cycles(c:ReturnType<typeof buildNurbsSourceBoundaryComplex3>){const h=buildNurbsSourceHalfedges3(c);assert.equal(h.kind,'ordered');if(h.kind!=='ordered')throw Error('Expected order');const all=h.cycles.flat();assert.equal(all.length,2*c.edges.length);assert.equal(new Set(all).size,all.length);for(const ring of h.cycles)for(let i=0;i<ring.length;i++){const a=ring[i]!,b=ring[(i+1)%ring.length]!;assert.equal(h.next[a],b);assert.equal(h.halfedges[a]!.to,h.halfedges[b]!.from);}return h;}
test('a simple closed trim has two oriented boundary walks and stable twins',()=>{
 const c=buildNurbsSourceBoundaryComplex3(refined(plane(),plane())),h=cycles(c);assert.equal(h.cycles.length,2);for(let i=0;i<h.halfedges.length;i++)assert.equal(h.halfedges[h.halfedges[i]!.twin]!.twin,i);assert.throws(()=>buildNurbsSourceHalfedges3({...c}),/factory/);
});
test('an interior transverse cut yields three walks with exact vertex rotations',()=>{
 const target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),c=buildNurbsSourceBoundaryComplex3(refined(plane(),target)),h=cycles(c);assert.equal(h.cycles.length,3);assert.equal(h.rotation.filter(r=>r.length===3).length,2);assert.ok(Object.isFrozen(h.cycles[0]));
});
test('a shared reversed boundary edge does not introduce duplicate walks',()=>{
 const target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,1n-v))),K,K),c=buildNurbsSourceBoundaryComplex3(refined(plane(),target));assert.equal(cycles(c).cycles.length,2);
});
function choose(n:number,k:number):bigint{let r=1n;for(let i=1;i<=k;i++)r=r*BigInt(n-i+1)/BigInt(i);return r;}
test('tangent branches with equal first derivatives are ordered by exact common fibers',()=>{
 const n=4,m=2,terms=[[0,2,1n],[2,1,-3n],[4,0,2n]] as const,pts=Array.from({length:n+1},(_,i)=>Array.from({length:m+1},(_,j)=>{let z=new Rational(0n);for(const [k,l,a] of terms)if(i>=k&&j>=l)z=z.add(new Rational(a*choose(i,k)*choose(j,l),choose(n,k)*choose(m,l)));return point3(new Rational(BigInt(i),BigInt(n)),new Rational(BigInt(j),BigInt(m)),z);})),s=nurbsSurface3(n,m,pts,[0n,0n,0n,0n,0n,1n,1n,1n,1n,1n],K2),c=buildNurbsSourceBoundaryComplex3(refined(s,plane())),h=cycles(c),v=c.vertices.findIndex(q=>q.u.sign()===0&&q.v.sign()===0),ids=h.rotation[v]!.filter(id=>c.edges[h.halfedges[id]!.edge]!.intersectionUses.length>0);assert.equal(ids.length,2);const ends=ids.map(id=>c.vertices[h.halfedges[id]!.to]!);assert.equal(ends[0]!.v.div(ends[0]!.u.mul(ends[0]!.u)).compare(AlgebraicReal.fromRational(1n)),0);assert.equal(ends[1]!.v.div(ends[1]!.u.mul(ends[1]!.u)).compare(AlgebraicReal.fromRational(2n)),0);
});
test('coincident knot-line UV germs are ordered while distinct spatial images remain in provenance',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,-1n),point3(0n,1n,-1n)],[point3('1/4',0n,0n),point3('1/4',1n,0n)],[point3('3/4',0n,0n),point3('3/4',1n,0n)],[point3(1n,0n,1n),point3(1n,1n,1n)]],[0n,0n,'1/2','1/2',1n,1n],K),c=buildNurbsSourceBoundaryComplex3(refined(s,plane())),h=buildNurbsSourceHalfedges3(c);assert.equal(h.kind,'ordered');if(h.kind==='ordered'){assert.equal(h.cycles.length,3);assert.ok(c.edges.some(e=>e.intersectionUses.length===2));assert.ok(h.rotation.every(ids=>new Set(ids).size===ids.length));}
});
