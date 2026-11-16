import test from 'node:test';
import assert from 'node:assert/strict';
import {liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
test('saddle boundaries and intersection atoms lift exactly with all walk directions retained',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K),r=lifted(s,plane('1/4'));assert.equal(r.continuous,true);assert.equal(r.cycles.length,r.source.source.cycles.length);
 for(let e=0;e<r.edges.length;e++)for(let p=0;p<r.edges[e]!.pieces.length;p++){const piece=r.edges[e]!.pieces[p]!,t=piece.lower.add(piece.upper).div(AlgebraicReal.fromRational(2n));for(let use=0;use<piece.patches.length;use++){const q=evaluateNurbsSourceLiftPiece3(r,e,p,use,t);assert.equal(q.point.x.compare(q.u),0);assert.equal(q.point.y.compare(q.v),0);assert.equal(q.point.z.compare(q.u.mul(q.v)),0);}}
 for(const cycle of r.cycles)assert.ok(cycle.every(q=>q.direction===1||q.direction===-1));assert.throws(()=>evaluateNurbsSourceLiftPiece3({...r},0,0,0,0n),/factory/);assert.throws(()=>evaluateNurbsSourceLiftPiece3(r,0,0,99,0n),/Invalid/);assert.throws(()=>evaluateNurbsSourceLiftPiece3(r,0,0,0,-1n),/outside/);
});
test('a continuous crease retains both closed one-sided patch uses',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,'1/2'),point3(0n,1n,'1/2')],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'1/2'),point3(1n,1n,'1/2')]],[0n,0n,'1/2',1n,1n],K),r=lifted(s,plane());assert.equal(r.continuous,true);let found=false;
 for(let e=0;e<r.edges.length;e++)for(let p=0;p<r.edges[e]!.pieces.length;p++){const piece=r.edges[e]!.pieces[p]!;if(piece.patches.length===2){found=true;const t=piece.lower.add(piece.upper).div(AlgebraicReal.fromRational(2n)),a=evaluateNurbsSourceLiftPiece3(r,e,p,0,t),b=evaluateNurbsSourceLiftPiece3(r,e,p,1,t);assert.notEqual(a.patch,b.patch);assert.equal(compareAlgebraicPoints3(a.point,b.point),0);assert.equal(piece.continuous,true);}}
 assert.equal(found,true);
});
test('discontinuous source knots retain both endpoint images and do not certify boundary continuity',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/4',0n,0n),point3('1/4',1n,0n)],[point3('3/4',0n,0n),point3('3/4',1n,0n)],[point3(1n,0n,0n),point3(1n,1n,0n)]],[0n,0n,'1/2','1/2',1n,1n],K),r=lifted(s,plane());assert.equal(r.continuous,false);const jumps=r.edges.flatMap(e=>e.events).filter(q=>!q.continuous);assert.ok(jumps.length>=2);for(const q of jumps){assert.equal(q.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.deepEqual(q.images.map(i=>i.point.x.compare(AlgebraicReal.fromRational('1/2'))).sort(),[-1,1]);}
});
test('weighted rational source images satisfy their independent quotient formula',()=>{
 const s=nurbsSurface3(2,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/3',0n,0n),point3('1/3',1n,'1/3')],[point3(1n,0n,0n),point3(1n,1n,'1/2')]],K2,K,[[1n,1n],['3/2','3/2'],[2n,2n]]),r=lifted(s,plane('1/6'));assert.equal(r.continuous,true);
 for(let e=0;e<r.edges.length;e++)for(let p=0;p<r.edges[e]!.pieces.length;p++){const piece=r.edges[e]!.pieces[p]!,t=piece.lower.add(piece.upper).div(AlgebraicReal.fromRational(2n)),q=evaluateNurbsSourceLiftPiece3(r,e,p,0,t);assert.equal(q.point.z.compare(q.u.mul(q.v).div(q.u.add(AlgebraicReal.fromRational(1n)))),0);}
});
test('UV boundaries outside active source bounds stay explicitly unresolved',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),f=prepared(s,plane()),r=liftNurbsSourceFaceBoundaries3(f);assert.equal(r.kind,'unresolved');if(r.kind==='unresolved')assert.equal(r.reason,'outside-active-domain');assert.throws(()=>evaluateNurbsSourceLiftPiece3(r,0,0,0,0n),/unresolved/);assert.throws(()=>liftNurbsSourceFaceBoundaries3({...f}),/factory/);
});

test('matching seam endpoints do not certify whole-interval equality of different patch images',()=>{
 const xs=['0','1/2','1/2','1'],ys=['0','1/3','2/3','1'],z=['0','-1/6','1/6','0'],s=nurbsSurface3(1,3,xs.map((x,i)=>ys.map((y,j)=>point3(x,y,i<2?'0':z[j]!))),[0n,0n,'1/2','1/2',1n,1n],[0n,0n,0n,0n,1n,1n,1n,1n]),d=prepareNurbsParameterDomain2(ring('1/2','0','1','1')),r=lifted(s,plane(),d);assert.equal(r.continuous,false);assert.ok(r.edges.some(e=>e.pieces.some(p=>p.patches.length===2&&!p.continuous)&&e.events.every(q=>q.continuous)));
});
