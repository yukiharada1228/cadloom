import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,refinedNurbsAffineIntersectionEdgePoint3,refinedNurbsAffineIntersectionEdgeDifferential3,compareAlgebraicPoints3,Rational,AlgebraicReal} from '../dist/index.js';
import type {NurbsSurface3,RefinedNurbsAffineIntersectionComplex3} from '../dist/index.js';
const K=[0n,0n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function rectangle(a:string,b:string,c:string,d:string){const p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];return prepareNurbsParameterDomain2(p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K)));}
const unit=()=>rectangle('0','0','1','1');
const plane=()=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,0n))),K,K);
function complex(s:NurbsSurface3,t:NurbsSurface3,domain=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected target certificate');return sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),domain,unit()));}
function coverage(r:RefinedNurbsAffineIntersectionComplex3){
 assert.equal(r.sourceEdges.length,r.source.edges.length);assert.equal(r.curveComponents.length,r.source.curveComponents.length);
 for(let id=0;id<r.sourceEdges.length;id++){const ids=r.sourceEdges[id]!,old=r.source.edges[id]!;assert.ok(ids.length>0);assert.equal(r.edges[ids[0]!]!.lower.compare(old.lower),0);assert.equal(r.edges[ids.at(-1)!]!.upper.compare(old.upper),0);assert.equal(r.edges[ids[0]!]!.from,old.from);assert.equal(r.edges[ids.at(-1)!]!.to,old.to);
  for(let i=0;i<ids.length;i++){const e=r.edges[ids[i]!]!;assert.equal(e.sourceEdge,id);if(i>0){const prev=r.edges[ids[i-1]!]!;assert.equal(prev.upper.compare(e.lower),0);assert.equal(prev.to,e.from);}for(const [v,t] of [[e.from,e.lower],[e.to,e.upper]] as const)assert.equal(compareAlgebraicPoints3(refinedNurbsAffineIntersectionEdgePoint3(r,ids[i]!,t).point,r.vertices[v]!.point.point),0);}
 }
 const all=r.curveComponents.flatMap(c=>c.vertices);assert.equal(new Set(all).size,all.length);assert.equal(all.length,r.vertices.length);
}
test('rank-drop event becomes a connected vertex while equal spatial images keep distinct parameters',()=>{
 const s=nurbsSurface3(1,2,[0n,1n].map(u=>[1n,-1n,1n].map(z=>point3(u,0n,z))),K,J),t=nurbsSurface3(1,1,[-1n,1n].map(y=>[-2n,2n].map(z=>point3('1/2',y,z))),K,K),c=complex(s,t,rectangle('0','-1','1','1')),before=c.edges.length,r=refineNurbsAffineIntersectionComplex3(c);coverage(r);assert.ok(r.edges.length>before);const split=r.sourceEdges.find(ids=>ids.length>1)!;const outside=r.edges[split.at(-1)!]!.upper;assert.throws(()=>refinedNurbsAffineIntersectionEdgePoint3(r,split[0]!,outside),/outside/);
 const stationary=r.vertices.find(v=>v.point.v.sign()===0)!;assert.ok(stationary);assert.ok(stationary.events.every(e=>e.differential.kind==='stationary-image'));assert.ok(r.edges.filter(e=>r.vertices[e.from]===stationary||r.vertices[e.to]===stationary).length>=2);
 const a=r.vertices.find(v=>v.point.v.compare(AlgebraicReal.fromRational(-1n))===0)!,b=r.vertices.find(v=>v.point.v.compare(AlgebraicReal.fromRational(1n))===0)!;assert.notEqual(a,b);assert.equal(compareAlgebraicPoints3(a.point.point,b.point.point),0);assert.equal(c.edges.length,before);
});
test('shared crease edges preserve both incident uses and reject escaped child ranges',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,'1/2'),point3(0n,1n,'1/2')],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'1/2'),point3(1n,1n,'1/2')]],[0n,0n,'1/2',1n,1n],K),r=refineNurbsAffineIntersectionComplex3(complex(s,plane()));coverage(r);assert.ok(r.edges.every(e=>e.uses.length===2));
 const e=r.edges[0]!,t=e.lower.add(e.upper).div(AlgebraicReal.fromRational(2n)),d=e.uses.map((_,i)=>refinedNurbsAffineIntersectionEdgeDifferential3(r,0,i,t));assert.deepEqual(d.map(q=>q.kind==='regular'?q.orientation:0).sort(),[-1,1]);assert.throws(()=>refinedNurbsAffineIntersectionEdgePoint3({...r},0,t),/factory/);assert.throws(()=>refinedNurbsAffineIntersectionEdgePoint3(r,0,-1n),/outside/);assert.throws(()=>refinedNurbsAffineIntersectionEdgeDifferential3(r,0,99,t),/Invalid/);assert.throws(()=>refineNurbsAffineIntersectionComplex3({...r.source}),/factory/);assert.ok(Object.isFrozen(r.edges));assert.ok(Object.isFrozen(r.vertices[0]!.events));
});
test('overlap regions are retained separately without inventing curve boundaries',()=>{
 const r=refineNurbsAffineIntersectionComplex3(complex(plane(),plane()));coverage(r);assert.equal(r.edges.length,0);assert.ok(r.regions.length>0);assert.equal(r.regions,r.source.regions);
});

test('isolated contact vertices survive subdivision without manufactured edges',()=>{
 const q=[1n,-1n,1n],v=['0','1/2','1'],s=nurbsSurface3(2,2,v.map((u,i)=>v.map((w,j)=>point3(u,w,new Rational(q[i]!+q[j]!,4n)))),[0n,0n,0n,1n,1n,1n],[0n,0n,0n,1n,1n,1n]),r=refineNurbsAffineIntersectionComplex3(complex(s,plane()));coverage(r);assert.equal(r.edges.length,0);assert.equal(r.vertices.length,1);assert.equal(r.vertices[0]!.sourceVertex,0);assert.equal(r.vertices[0]!.events.length,0);
});
