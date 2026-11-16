import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,intersectAffineNurbsFaceBoundaries3,affineNurbsBoundaryRelationPoint3,sewAffineNurbsFaces3,AlgebraicReal,insertNurbsSurfaceKnot3,reverseNurbsCurve3,compareAlgebraicPoints3} from '../dist/index.js';
import type {NurbsCurve3,NurbsSurface3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n];
const line=(a:string,b:string,c:string,d:string)=>nurbsCurve3(1,[point3(a,b,0n),point3(c,d,0n)],K);
function polygon(ps:readonly (readonly [string,string])[]){return ps.map((p,i)=>line(p[0],p[1],ps[(i+1)%ps.length]![0],ps[(i+1)%ps.length]![1]));}
const square=(a:string,b:string,c:string,d:string)=>polygon([[a,b],[c,b],[c,d],[a,d]]);
const support=(z=0n)=>nurbsSurface3(1,1,[-4n,4n].map(u=>[-4n,4n].map(v=>point3(u,v,z))),[-4n,-4n,4n,4n],[-4n,-4n,4n,4n]);
function face(ring:readonly NurbsCurve3[],s:NurbsSurface3=support()){const c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected certificate');return createAffineNurbsFace3(c.certificate,prepareNurbsParameterDomain2(ring));}
test('all interior boundary crossings are discovered and noded without supplied endpoints',()=>{
 const a=face(square('-1','-1','1','1')),b=face(polygon([['0','-3/2'],['3/2','0'],['0','3/2'],['-3/2','0']])),r=intersectAffineNurbsFaceBoundaries3(a,b);assert.equal(r.points.length,8);assert.equal(r.relations.length,0);const keys=r.points.map(p=>`${p.point.x.recognizeRational().rational},${p.point.y.recognizeRational().rational}`).sort();assert.deepEqual(keys,['-1,-1/2','-1,1/2','-1/2,-1','-1/2,1','1,-1/2','1,1/2','1/2,-1','1/2,1'].sort());
 const s=sewAffineNurbsFaces3([a,b]);assert.equal(s.topology.edges.length,24);assert.equal(s.topology.vertices.length,16);assert.equal(s.boundaryIntersections.length,1);assert.equal(s.boundaryIntersections[0]!.points.length,8);assert.equal(s.topology.closedOrientedIncidence,false);assert.ok(s.topology.issues.some(i=>i.kind==='nonmanifold-vertex'));
});
test('3D equality excludes projected crossings on parallel separated supports',()=>{
 const a=face(square('-1','-1','1','1')),b=face(polygon([['0','-3/2'],['3/2','0'],['0','3/2'],['-3/2','0']]),support(1n)),r=intersectAffineNurbsFaceBoundaries3(a,b);assert.equal(r.points.length,0);assert.equal(r.relations.length,0);assert.equal(sewAffineNurbsFaces3([a,b]).topology.vertices.length,8);
});
test('tangent interior contact is retained without inventing an overlap interval',()=>{
 const c=nurbsCurve3(2,[point3(0n,2n,0n),point3('1/2',0n,0n),point3(1n,2n,0n)],K2),a=face(square('0','0','1','1')),b=face([c,line('1','2','1','3'),line('1','3','0','3'),line('0','3','0','2')]),r=intersectAffineNurbsFaceBoundaries3(a,b);assert.equal(r.points.length,1);assert.equal(r.relations.length,0);assert.equal(r.points[0]!.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(r.points[0]!.point.y.compare(AlgebraicReal.fromRational(1n)),0);
});
test('nonlinear coincidence is retained as an owned exact parameter relation',()=>{
 const a=face(square('0','0','1','1')),ring=square('1','0','2','1');ring[3]=nurbsCurve3(2,[point3(1n,1n,0n),point3(1n,0n,0n),point3(1n,0n,0n)],K2);const b=face(ring),r=intersectAffineNurbsFaceBoundaries3(a,b),index=r.relations.findIndex(p=>p.first.curve===1&&p.second.curve===3&&p.locus.edges.length>0);assert.ok(index>=0);const q=affineNurbsBoundaryRelationPoint3(r,index,0,'1/4');assert.equal(q.firstParameter.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(q.secondParameter.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(q.point.y.compare(AlgebraicReal.fromRational('1/4')),0);assert.throws(()=>affineNurbsBoundaryRelationPoint3({...r},index,0,'1/4'),/factory/);assert.throws(()=>affineNurbsBoundaryRelationPoint3(r,index,0,2n),/outside/);assert.throws(()=>affineNurbsBoundaryRelationPoint3(r,-1,0,0n),/Invalid/);assert.throws(()=>intersectAffineNurbsFaceBoundaries3({...a},b),/factory/);
});
test('relations are clipped to algebraic patch bounds and retain exact evaluations on both faces',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K),c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],K2),a=face([c,line('1','1','0','1'),line('0','1','0','0')],s),b=face([line('0','0','1','0'),line('1','0','1','1'),reverseNurbsCurve3(c)],insertNurbsSurfaceKnot3(s,'u','1/2')),r=intersectAffineNurbsFaceBoundaries3(a,b),root=AlgebraicReal.fromRational('1/2').sqrt();assert.ok(r.points.some(p=>p.firstParameter.compare(root)===0&&p.first.curve===0));
 for(let i=0;i<r.relations.length;i++){const rel=r.relations[i]!;for(const p of rel.locus.vertices){assert.ok(p.u.compare(rel.locus.bounds.uMin)>=0&&p.u.compare(rel.locus.bounds.uMax)<=0&&p.v.compare(rel.locus.bounds.vMin)>=0&&p.v.compare(rel.locus.bounds.vMax)<=0);}for(let j=0;j<rel.locus.edges.length;j++){const e=rel.locus.edges[j]!,q=affineNurbsBoundaryRelationPoint3(r,i,j,e.lower.add(e.upper).affine('1/2'));assert.equal(q.point.z.compare(q.point.x.mul(q.point.y)),0);}}
 const swapped=intersectAffineNurbsFaceBoundaries3(b,a);for(const p of r.points)assert.ok(swapped.points.some(q=>compareAlgebraicPoints3(p.point,q.point)===0));
});
