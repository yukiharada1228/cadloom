import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function coverage(c:ReturnType<typeof buildNurbsSourceBoundaryComplex3>){
 for(const [id,uses] of c.intersectionEdges.entries()){const old=c.source.edges[id]!;assert.ok(uses.length>0);assert.equal(uses[0]!.lower.compare(old.lower),0);assert.equal(uses.at(-1)!.upper.compare(old.upper),0);for(let i=0;i<uses.length;i++){const u=uses[i]!,e=c.edges[u.edge]!;assert.ok(e.intersectionUses.some(q=>q.edge===id));if(i){const p=uses[i-1]!,a=c.edges[p.edge]!;assert.equal(p.upper.compare(u.lower),0);assert.equal(p.direction===1?a.to:a.from,u.direction===1?e.from:e.to);}}}
 for(const ring of c.rings)for(let i=0;i<ring.length;i++){const a=ring[i]!,b=ring[(i+1)%ring.length]!,A=c.edges[a.edge]!,B=c.edges[b.edge]!;assert.equal(a.direction===1?A.to:A.from,b.direction===1?B.from:B.to);}
}
test('coincident source boundary and intersection become common atoms with oriented provenance',()=>{
 for(const top of [false,true]){const target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,top?1n-v:v))),K,K),r=refined(plane(),target),c=buildNurbsSourceBoundaryComplex3(r);coverage(c);assert.ok(c.edges.some(e=>e.boundaryUses.length&&e.intersectionUses.length));assert.ok(c.intersectionEdges.flat().every(u=>u.direction===(top?-1:1)));assert.equal(c.edges.length,c.boundaryEdges.flat().length);assert.ok(Object.isFrozen(c.edges[0]!.intersectionUses));}
});
test('proper finite overlap splits both representations without duplicate coincident atoms',()=>{
 const target=nurbsSurface3(1,1,['1/4','3/4'].map(u=>[0n,1n].map(v=>point3(u,v,v))),K,K),c=buildNurbsSourceBoundaryComplex3(refined(plane(),target));coverage(c);assert.equal(c.edges.length,6);assert.ok(c.edges.filter(e=>e.boundaryUses.length&&e.intersectionUses.length).length>0);assert.ok(c.edges.some(e=>e.boundaryUses.length&&!e.intersectionUses.length));
});
test('an interior transverse cut connects to boundary nodes without sharing boundary edges',()=>{
 const target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),c=buildNurbsSourceBoundaryComplex3(refined(plane(),target));coverage(c);assert.ok(c.edges.some(e=>e.intersectionUses.length&&!e.boundaryUses.length));assert.ok(c.edges.every(e=>!(e.intersectionUses.length&&e.boundaryUses.length)));const degree=c.vertices.map((_,v)=>c.edges.filter(e=>e.from===v||e.to===v).length);assert.equal(degree.filter(d=>d===3).length,2);assert.throws(()=>buildNurbsSourceBoundaryComplex3({...c.source}),/factory/);
});
test('boundary knot and projection extrema node a curved shared intersection consistently',()=>{
 const bottom=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n)],K),top=insertNurbsKnot3(nurbsCurve3(2,[point3(1n,0n,0n),point3('1/2',1n,0n),point3(0n,0n,0n)],K2),'1/3'),d=prepareNurbsParameterDomain2([bottom,top]),target=nurbsSurface3(2,1,[0n,'1/2',1n].map((u,i)=>[0n,1n].map(v=>point3(u,v,new Rational(v).sub(new Rational(i===1?1n:0n))))),K2,K),c=buildNurbsSourceBoundaryComplex3(refined(plane(),target,d));coverage(c);assert.ok(c.edges.filter(e=>e.intersectionUses.length).every(e=>e.boundaryUses.length>0));assert.ok(c.intersectionEdges.flat().every(u=>u.direction===-1));
});
