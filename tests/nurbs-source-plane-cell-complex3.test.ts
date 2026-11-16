import {buildNurbsSourcePlaneCellComplex3} from '../dist/index.js';
import {nurbsSourcePlaneCellBoundary3,nurbsSourcePlaneCellBoundaryPoint3} from '../dist/index.js';
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


function check(r:ReturnType<typeof partitionNurbsSourceFaceByPlane3>){assert.equal(r.kind,'partitioned');if(r.kind!=='partitioned')throw Error('Expected partition');return r;}
function closedBoundary(b:ReturnType<typeof nurbsSourcePlaneCellBoundary3>){assert.ok(b.edges.length>=3);for(const [i,e] of b.edges.entries()){assert.equal(e.to,b.edges[(i+1)%b.edges.length]!.from);assert.ok(e.lower.compare(e.upper)<0);const a=nurbsSourcePlaneCellBoundaryPoint3(b,i,e.direction===1?e.lower:e.upper),z=b.vertices[e.from]!;assert.equal(a.u.compare(z.u),0);assert.equal(a.v.compare(z.v),0);const q=nurbsSourcePlaneCellBoundaryPoint3(b,i,AlgebraicReal.linearCombination([{value:e.lower,coefficient:Rational.parse('1/2')},{value:e.upper,coefficient:Rational.parse('1/2')}]));assert.equal(q.kind,'point');}}

test('equal-sign cell seams cancel to the outer and hole cycles with exact opposite edge uses',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),c=complex(plane(),plane('100'),d),r=check(partitionNurbsSourceFaceByPlane3(c,0,plane3(0n,0n,1n))),q=buildNurbsSourcePlaneCellComplex3(r);assert.equal(q.regions.length,1);const region=q.regions[0]!;assert.ok(region.cycles);assert.equal(region.cycles.length,2);assert.equal(q.vertices.length-q.edges.length+q.cells.length,0);assert.ok(q.edges.some(e=>e.uses.length===2));for(const e of q.edges)if(e.uses.length===2)assert.equal(e.uses[0]!.direction,-e.uses[1]!.direction);
 const areas=region.cycles.map(cycle=>AlgebraicReal.productCombination(cycle.flatMap(u=>{const e=q.edges[u.edge]!,a=q.vertices[u.direction===1?e.from:e.to]!.point,b=q.vertices[u.direction===1?e.to:e.from]!.point;return [{factors:[a.u,b.v],coefficient:1n},{factors:[a.v,b.u],coefficient:-1n}];})).recognizeRational().rational!.toString());assert.deepEqual(areas.sort(),['2','-1/2'].sort());assert.throws(()=>buildNurbsSourcePlaneCellComplex3({...r}),/factory/);assert.ok(Object.isFrozen(q.edges)&&Object.isFrozen(q.regions[0]!.boundary));
});
test('plane sign changes retain the cut while same-side event seams cancel at a turning point',()=>{
 const s=nurbsSurface3(1,2,[0n,1n].map(u=>['1/2','0','1/2'].map((z,i)=>point3(u,['0','1/2','1'][i]!,Rational.parse(z).sub(new Rational(u))))),K,K2),r=check(partitionNurbsSourceFaceByPlane3(complex(s,plane('100')),0,plane3(0n,0n,1n))),q=buildNurbsSourcePlaneCellComplex3(r);assert.equal(q.regions.length,2);assert.deepEqual(q.regions.map(r=>r.sign).sort(),[-1,1]);assert.ok(q.regions.every(r=>r.cycles?.length===1));assert.ok(q.edges.some(e=>e.uses.length===2&&r.cells[e.uses[0]!.cell]!.sign!==r.cells[e.uses[1]!.cell]!.sign));assert.ok(q.regions.some(r=>r.cells.length>1));for(const region of q.regions)for(const cycle of region.cycles!){for(let i=0;i<cycle.length;i++){const a=cycle[i]!,b=cycle[(i+1)%cycle.length]!,e=q.edges[a.edge]!,f=q.edges[b.edge]!;assert.equal(a.direction===1?e.to:e.from,b.direction===1?f.from:f.to);}}
});
