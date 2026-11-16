import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsSurface3,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,nurbsAffineIntersectionEdgePoint3,nurbsAffineIntersectionRegionPoint3,solveNurbsAffineIntersectionEquations3,nurbsAffineIntersectionEquations3,AlgebraicReal,compareAlgebraicPoints3,insertNurbsSurfaceKnot3,Rational} from '../dist/index.js';
import type {NurbsSurface3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],r=(q:string)=>AlgebraicReal.fromRational(q);
const plane=(z='0',a='0',b='0',c='1',d='1')=>nurbsSurface3(1,1,[a,c].map(u=>[b,d].map(v=>point3(u,v,z))),K,K);
const saddle=(end='1')=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(end,0n,0n),point3(end,1n,end)]],[0n,0n,end,end],K);
function certificate(s:NurbsSurface3){const c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected certificate');return c.certificate;}
test('complete hyperbola intersection is clipped to both closed patch rectangles',()=>{
 const s=intersectNurbsSurfaceAffineTarget3(plane('1/4'),certificate(saddle('3/4')));assert.equal(s.empty,false);assert.equal(s.patches.length,1);const p=s.patches[0]!;assert.equal(p.vertices.length,2);assert.equal(p.edges.length,1);assert.equal(p.region,null);assert.equal(p.edges[0]!.lower.compare(r('1/4')),0);assert.equal(p.edges[0]!.upper.compare(r('3/4')),0);const q=nurbsAffineIntersectionEdgePoint3(s,0,0,'1/2');assert.equal(q.v.compare(r('1/2')),0);assert.equal(q.point.z.compare(r('1/4')),0);assert.equal(q.targetU.compare(q.u),0);assert.throws(()=>nurbsAffineIntersectionEdgePoint3(s,0,0,'4/5'),/outside/);
});
test('isolated real contact is retained from a positive-definite shared polynomial',()=>{
 const values=['1/4','-1/4','1/4'],uv=['0','1/2','1'],source=nurbsSurface3(2,2,uv.map((u,i)=>uv.map((v,j)=>point3(u,v,Rational.parse(values[i]!).add(Rational.parse(values[j]!))))),K2,K2),s=intersectNurbsSurfaceAffineTarget3(source,certificate(plane()));assert.equal(s.empty,false);assert.equal(s.patches.length,1);assert.equal(s.patches[0]!.vertices.length,1);assert.equal(s.patches[0]!.edges.length,0);assert.equal(s.patches[0]!.vertices[0]!.u.compare(r('1/2')),0);assert.equal(s.patches[0]!.vertices[0]!.v.compare(r('1/2')),0);
});
test('folded sources retain two vertical parameter branches at the same spatial intersection',()=>{
 const source=nurbsSurface3(2,1,[0n,2n,0n].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),K2,K),target=nurbsSurface3(1,1,[0n,1n].map(u=>[-1n,1n].map(v=>point3('1/2',u,v))),K,[-1n,-1n,1n,1n]),s=intersectNurbsSurfaceAffineTarget3(source,certificate(target));assert.equal(s.patches[0]!.edges.length,2);const points=s.patches[0]!.edges.map((_,i)=>nurbsAffineIntersectionEdgePoint3(s,0,i,'1/3'));assert.notEqual(points[0]!.u.compare(points[1]!.u),0);assert.equal(compareAlgebraicPoints3(points[0]!.point,points[1]!.point),0);
});
test('coincident supports distinguish interior overlap, line/corner-only contact and empty domains',()=>{
 const source=plane(),inside=intersectNurbsSurfaceAffineTarget3(source,certificate(plane('0','1/4','1/4','3/4','3/4')));assert.equal(inside.empty,false);assert.ok(inside.patches[0]!.region);assert.equal(inside.patches[0]!.region!.contains('1/2','1/2'),true);assert.equal(inside.patches[0]!.region!.contains(0n,0n),false);assert.equal(nurbsAffineIntersectionRegionPoint3(inside,0,'1/2','1/2').point.z.sign(),0);assert.throws(()=>nurbsAffineIntersectionRegionPoint3(inside,0,0n,0n),/do not represent/);
 const line=intersectNurbsSurfaceAffineTarget3(source,certificate(plane('0','1','0','2','1')));assert.ok(line.patches[0]!.region);assert.equal(line.patches[0]!.region!.witness.u.compare(r('1')),0);assert.equal(line.patches[0]!.region!.contains(1n,'1/2'),true);
 const corner=intersectNurbsSurfaceAffineTarget3(source,certificate(plane('0','1','1','2','2')));assert.ok(corner.patches[0]!.region);assert.equal(corner.patches[0]!.region!.witness.u.compare(r('1')),0);assert.equal(corner.patches[0]!.region!.witness.v.compare(r('1')),0);
 const empty=intersectNurbsSurfaceAffineTarget3(source,certificate(plane('0','2','2','3','3')));assert.equal(empty.empty,true);assert.equal(empty.patches.length,0);
});
test('rational weights preserve the curved intersection and target chart bounds',()=>{
 const target=nurbsSurface3(2,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/3',0n,0n),point3('1/3',1n,'1/3')],[point3(1n,0n,0n),point3(1n,1n,'1/2')]],K2,K,[[1n,1n],['3/2','3/2'],[2n,2n]]),s=intersectNurbsSurfaceAffineTarget3(plane('1/6'),certificate(target));assert.equal(s.empty,false);assert.equal(s.patches[0]!.edges.length,1);const p=nurbsAffineIntersectionEdgePoint3(s,0,0,'1/2');assert.equal(p.v.compare(r('1/2')),0);assert.equal(p.point.z.compare(r('1/6')),0);assert.equal(s.patches[0]!.edges[0]!.lower.compare(r('1/5')),0);
});
test('one-sided patch provenance remains separate and owned evaluators reject copied results',()=>{
 const source=insertNurbsSurfaceKnot3(plane(),'u','1/2'),target=certificate(plane()),equations=nurbsAffineIntersectionEquations3(source,target),s=solveNurbsAffineIntersectionEquations3(equations);assert.equal(s.patches.length,2);assert.equal(s.patches[0]!.pair,0);assert.equal(s.patches[1]!.pair,1);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.patches));assert.throws(()=>solveNurbsAffineIntersectionEquations3({...equations}),/factory/);assert.throws(()=>nurbsAffineIntersectionRegionPoint3({...s},0,'1/4','1/4'),/factory/);assert.throws(()=>nurbsAffineIntersectionEdgePoint3(s,0,0,'1/4'),/Invalid/);assert.throws(()=>nurbsAffineIntersectionRegionPoint3(s,99,'1/4','1/4'),/Invalid/);
});
test('a collapsed source point has a parameter region without a claim of spatial area',()=>{
 const source=nurbsSurface3(1,1,[[point3('1/2','1/2',0n),point3('1/2','1/2',0n)],[point3('1/2','1/2',0n),point3('1/2','1/2',0n)]],K,K),s=intersectNurbsSurfaceAffineTarget3(source,certificate(plane()));assert.equal(s.empty,false);assert.ok(s.patches[0]!.region);const a=nurbsAffineIntersectionRegionPoint3(s,0,'1/5','1/7'),b=nurbsAffineIntersectionRegionPoint3(s,0,'4/5','6/7');assert.equal(compareAlgebraicPoints3(a.point,b.point),0);assert.equal(intersectNurbsSurfaceAffineTarget3(source,certificate(plane('1'))).empty,true);
});
