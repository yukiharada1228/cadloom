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

test('finite plane cells retain both halfspaces and exclude a finite hole',()=>{
 const domain=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),c=complex(plane(),plane('100'),domain),r=partitionNurbsSourceFaceByPlane3(c,0,plane3(1n,0n,0n,'-1/2'));assert.equal(r.kind,'partitioned');if(r.kind!=='partitioned')return;
 assert.deepEqual([...new Set(r.cells.map(c=>c.sign))].sort(),[-1,1]);assert.ok(r.cells.length>=6);
 for(const [i,cell] of r.cells.entries()){const q=nurbsSourcePlaneCellPoint3(r,i,cell.sample.u,'1/2');assert.equal(q.stratum,'face');assert.equal(q.point.x.compare(AlgebraicReal.fromRational('1/2')),cell.sign);assert.ok(!(q.u.compare(AlgebraicReal.fromRational('1/4'))>0&&q.u.compare(AlgebraicReal.fromRational('3/4'))<0&&q.v.compare(AlgebraicReal.fromRational('1/4'))>0&&q.v.compare(AlgebraicReal.fromRational('3/4'))<0));}
 assert.throws(()=>nurbsSourcePlaneCellPoint3({...r},0,0n,'1/2'),/factory/);assert.throws(()=>nurbsSourcePlaneCellPoint3(r,0,r.cells[0]!.sample.u,0n),/fraction/);const cell=r.cells[0]!;assert.throws(()=>nurbsSourcePlaneCellPoint3(r,0,cell.graph.events[cell.graph.slabs[cell.slab]!.leftEvent]!.u,'1/2'),/slab/);
});
test('coplanar cells retain zero sign and nonlinear sections bound curved open strips',()=>{
 const c=complex(plane(),plane('100')),flat=partitionNurbsSourceFaceByPlane3(c,0,plane3(0n,0n,1n));assert.equal(flat.kind,'partitioned');if(flat.kind==='partitioned')assert.ok(flat.cells.length>0&&flat.cells.every(c=>c.sign===0));
 const U=['0','1/2','1'],B=['1/4','-1/4','1/4'],surface=nurbsSurface3(2,2,U.map((u,i)=>U.map((v,j)=>point3(u,v,Rational.parse(B[i]!).add(Rational.parse(B[j]!))))),K2,K2),r=partitionNurbsSourceFaceByPlane3(complex(surface,plane('100')),0,plane3(0n,0n,1n,'-1/10'));assert.equal(r.kind,'partitioned');if(r.kind!=='partitioned')return;assert.deepEqual([...new Set(r.cells.map(c=>c.sign))].sort(),[-1,1]);for(const [i,c] of r.cells.entries())for(const f of ['1/4','3/4'])assert.equal(nurbsSourcePlaneCellPoint3(r,i,c.sample.u,f).stratum,'face');
});
