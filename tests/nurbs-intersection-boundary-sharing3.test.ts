import test from 'node:test';
import assert from 'node:assert/strict';
import {matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
test('horizontal, reversed and vertical boundary intervals have exact traversal directions',()=>{
 for(const [kind,expected] of [['bottom',1],['top',-1],['left',-1]] as const){const t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,kind==='bottom'?v:kind==='top'?1n-v:u))),K,K),r=refined(plane(),t),m=matchNurbsIntersectionSourceBoundary3(r);assert.ok(m.intervals.length>0);assert.ok(m.intervals.every(q=>q.direction===expected));for(const q of m.intervals){assert.ok(q.intersectionLower.compare(q.intersectionUpper)<0);assert.ok(q.boundaryLower.compare(q.boundaryUpper)<0);}}
});
test('finite trimming retains only a proper part of a coincident source boundary',()=>{
 const t=nurbsSurface3(1,1,['1/4','3/4'].map(u=>[0n,1n].map(v=>point3(u,v,v))),K,K),r=refined(plane(),t),m=matchNurbsIntersectionSourceBoundary3(r);assert.ok(m.intervals.length>0);const first=m.intervals[0]!,last=m.intervals.at(-1)!;assert.equal(first.intersectionLower.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(last.intersectionUpper.compare(AlgebraicReal.fromRational('3/4')),0);
});
test('an exact curved boundary identity matches across projection and knot subdivisions',()=>{
 const bottom=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n)],K),top=insertNurbsKnot3(nurbsCurve3(2,[point3(1n,0n,0n),point3('1/2',1n,0n),point3(0n,0n,0n)],K2),'1/3'),d=prepareNurbsParameterDomain2([bottom,top]),target=nurbsSurface3(2,1,[0n,'1/2',1n].map((u,i)=>[0n,1n].map(v=>point3(u,v,new Rational(v).sub(new Rational(i===1?1n:0n))))),K2,K),r=refined(plane(),target,d),m=matchNurbsIntersectionSourceBoundary3(r);assert.ok(m.intervals.length>=2);assert.ok(m.intervals.every(q=>q.direction===-1&&m.boundary.edges[q.boundaryEdge]!.curve===1));
});
test('endpoints and midpoint on a line do not make a cubic boundary coincide with it',()=>{
 const bottom=nurbsCurve3(3,[point3(0n,0n,0n),point3('1/3','-1/6',0n),point3('2/3','1/6',0n),point3(1n,0n,0n)],[0n,0n,0n,0n,1n,1n,1n,1n]),square=ring('0','0','1','1'),d=prepareNurbsParameterDomain2([bottom,...square.slice(1)]),target=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,v))),K,K),r=refined(plane(),target,d),m=matchNurbsIntersectionSourceBoundary3(r);assert.ok(r.edges.length>0);assert.equal(m.intervals.length,0);assert.throws(()=>matchNurbsIntersectionSourceBoundary3({...r}),/factory/);
});
