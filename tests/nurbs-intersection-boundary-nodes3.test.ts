import test from 'node:test';
import assert from 'node:assert/strict';
import {insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
test('source and target boundary rings are split at finite hyperbola endpoints',()=>{
 const saddle=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K),r=refined(plane('1/4'),saddle);
 for(const side of ['source','target'] as const){const b=nodeNurbsIntersectionBoundary3(r,side);closed(b);assert.equal(b.edges.length,6);assert.equal(b.intersectionVertices.filter(v=>v!==null).length,2);assert.ok(Object.isFrozen(b.rings[0]));}
 assert.throws(()=>nodeNurbsIntersectionBoundary3({...r},'source'),/factory/);assert.throws(()=>nodeNurbsIntersectionBoundary3(r,'bad' as 'source'),/Invalid/);
});
test('algebraic boundary preimages are filtered by both coordinates',()=>{
 const q=[new Rational(0n),new Rational(0n),new Rational(1n)],uv=[0n,'1/2',1n],s=nurbsSurface3(2,2,uv.map((u,i)=>uv.map((v,j)=>point3(u,v,q[i]!.add(q[j]!).sub(new Rational(1n,2n))))),K2,K2),r=refined(s,plane()),b=nodeNurbsIntersectionBoundary3(r,'source');closed(b);assert.equal(b.edges.length,6);assert.equal(b.intersectionVertices.filter(v=>v!==null).length,2);assert.ok(b.vertices.some(v=>v.u.mul(v.u).compare(AlgebraicReal.fromRational(new Rational(1n,2n)))===0&&v.v.sign()===0));
});
test('hole rings retain orientation and gain exact intersection nodes',()=>{
 const saddle=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K),d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('2/5','2/5','3/5','3/5',true)]),r=refined(plane('1/4'),saddle,d),b=nodeNurbsIntersectionBoundary3(r,'source');closed(b);assert.equal(b.rings.length,2);assert.equal(b.rings[0]!.length,6);assert.equal(b.rings[1]!.length,6);assert.equal(b.intersectionVertices.filter(v=>v!==null).length,4);
});
test('target boundary nodes preserve multiple source preimages at the same target UV',()=>{
 const s=nurbsSurface3(1,2,[0n,1n].map(u=>[1n,-1n,1n].map(z=>point3(u,0n,z))),K,J),t=nurbsSurface3(1,1,[-1n,1n].map(y=>[0n,1n].map(z=>point3('1/2',y,z))),K,K),r=refined(s,t,prepareNurbsParameterDomain2(ring('0','-1','1','1'))),b=nodeNurbsIntersectionBoundary3(r,'target');closed(b);assert.ok(b.vertices.some(v=>v.intersectionVertices.length===2));
});

test('weighted curved boundary and an inserted knot retain exact span provenance',()=>{
 const bottom=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n)],K),top=insertNurbsKnot3(nurbsCurve3(2,[point3(1n,0n,0n),point3('1/2',1n,0n),point3(0n,0n,0n)],K2,[1n,2n,1n]),'1/3'),d=prepareNurbsParameterDomain2([bottom,top]),target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),r=refined(plane(),target,d),b=nodeNurbsIntersectionBoundary3(r,'source');closed(b);assert.equal(b.edges.length,5);assert.equal(b.intersectionVertices.filter(v=>v!==null).length,2);assert.ok(b.vertices.some(v=>v.u.compare(AlgebraicReal.fromRational('1/2'))===0&&v.v.compare(AlgebraicReal.fromRational('2/3'))===0));assert.equal(new Set(b.edges.filter(e=>e.curve===1).map(e=>e.span)).size,2);
});
