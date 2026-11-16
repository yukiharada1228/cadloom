import test from 'node:test';
import assert from 'node:assert/strict';
import {reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function faces(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const h=buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))),f=classifyNurbsSourceFaces3(h);assert.equal(f.kind,'classified');if(f.kind!=='classified')throw Error('Expected faces');assert.equal(f.halfedgeFaces.length,h.halfedges.length);assert.equal(f.faces.filter(p=>p.unbounded).length,1);return f;}
test('outer and hole walks belong to the same annular source domain face',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/3','1/3','2/3','2/3',true)]),f=faces(plane(),plane(),d),inside=f.faces.filter(q=>q.location==='inside');assert.equal(f.faces.length,3);assert.equal(inside.length,1);assert.equal(inside[0]!.outerCycles.length,1);assert.equal(inside[0]!.holeCycles.length,1);assert.equal(inside[0]!.cycles.length,2);assert.equal(f.faces.filter(q=>q.location==='outside').length,2);assert.throws(()=>classifyNurbsSourceFaces3({...f.source}),/factory/);
});
test('a transverse cut creates two source domain faces with distinct exact samples',()=>{
 const t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),f=faces(plane(),t),inside=f.faces.filter(q=>q.location==='inside');assert.equal(inside.length,2);assert.deepEqual(inside.map(q=>q.sample.u.compare(new Rational(1n,2n))).sort(),[-1,1]);assert.ok(inside.every(q=>q.outerCycles.length===1&&q.holeCycles.length===0));
});
test('a closed algebraic cut separates a disk and an annulus without polygonal approximation',()=>{
 const q=[new Rational(1n,4n),new Rational(-1n,4n),new Rational(1n,4n)],xy=[0n,'1/2',1n],s=nurbsSurface3(2,2,xy.map((u,i)=>xy.map((v,j)=>point3(u,v,q[i]!.add(q[j]!).sub(new Rational(1n,16n))))),K2,K2),f=faces(s,plane()),inside=f.faces.filter(q=>q.location==='inside');assert.equal(inside.length,2);assert.equal(inside.filter(q=>q.holeCycles.length===1).length,1);for(const face of inside){const x=face.sample.u.sub(new Rational(1n,2n)),y=face.sample.v.sub(new Rational(1n,2n)),sign=x.mul(x).add(y.mul(y)).compare(new Rational(1n,16n));assert.equal(sign,face.holeCycles.length?1:-1);}
});
test('two cuts across a hole retain two inside pieces and both outside regions',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('2/5','2/5','3/5','3/5',true)]),t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),f=faces(plane(),t,d);assert.equal(f.faces.filter(q=>q.location==='inside').length,2);assert.equal(f.faces.filter(q=>q.location==='outside').length,2);
});
test('an interior wire does not fabricate a hole or split the enclosing UV face',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),f=faces(s,plane()),inside=f.faces.filter(q=>q.location==='inside');assert.equal(inside.length,1);assert.equal(inside[0]!.holeCycles.length,0);assert.equal(inside[0]!.wireCycles.length,1);
});

test('reversed trim senses and discontinuous spatial seam images retain well-defined UV faces',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1').slice().reverse().map(reverseNurbsCurve3),[],-1),f=faces(plane(),plane(),d);assert.equal(f.faces.filter(q=>q.location==='inside').length,1);assert.equal(f.faces.find(q=>q.location==='inside')!.outerCycles.length,1);
 const s=nurbsSurface3(1,1,[[point3(0n,0n,-1n),point3(0n,1n,-1n)],[point3('1/4',0n,0n),point3('1/4',1n,0n)],[point3('3/4',0n,0n),point3('3/4',1n,0n)],[point3(1n,0n,1n),point3(1n,1n,1n)]],[0n,0n,'1/2','1/2',1n,1n],K),h=buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,plane()))),result=classifyNurbsSourceFaces3(h);assert.equal(result.kind,'classified');if(result.kind==='classified'){assert.equal(result.faces.filter(f=>f.location==='inside').length,2);assert.equal(result.faces.filter(f=>f.unbounded).length,1);}
});
