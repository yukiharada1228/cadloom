import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,sewAffineNurbsFaces3,insertNurbsSurfaceKnot3,reverseNurbsCurve3,AlgebraicReal,affineNurbsBoundaryEdgePoint3,compareAlgebraicPoints3} from '../dist/index.js';
import type {NurbsSurface3,NurbsCurve3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],line=(a:string,b:string,c:string,d:string)=>nurbsCurve3(1,[point3(a,b,0n),point3(c,d,0n)],K);
const surface=()=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
function face(s:NurbsSurface3,ring:readonly NurbsCurve3[]){const c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected certificate');return createAffineNurbsFace3(c.certificate,prepareNurbsParameterDomain2(ring));}
function halves(){const c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],K2),a=face(surface(),[c,line('1','1','0','1'),line('0','1','0','0')]),b=face(insertNurbsSurfaceKnot3(surface(),'u','1/2'),[line('0','0','1','0'),line('1','0','1','1'),reverseNurbsCurve3(c)]);return {a,b};}
test('algebraic patch endpoints node the opposite curved boundary and retain exact restricted evaluations',()=>{
 const {a,b}=halves(),s=sewAffineNurbsFaces3([a,b]),t=s.topology,shared=t.edges.filter(e=>e.coedges.length===2),root=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(shared.length,2);assert.equal(t.shells.length,1);assert.equal(t.boundaryLoops!.length,1);assert.equal(t.manifoldVertices,true);assert.equal(s.sourceUses[0]![0]![0]!.length,2);
 const vertex=t.vertices.find(p=>p.x.compare(AlgebraicReal.fromRational('1/2'))===0&&p.y.compare(root)===0);assert.ok(vertex);assert.equal(vertex.z.compare(root.affine('1/2')),0);assert.ok(shared.some(e=>e.curve.lower.compare(root)===0||e.curve.upper.compare(root)===0));
 for(const e of shared){const c=e.curve,p=affineNurbsBoundaryEdgePoint3(c,c.lower);assert.equal(compareAlgebraicPoints3(p,t.vertices[e.start]!),0);assert.equal(compareAlgebraicPoints3(affineNurbsBoundaryEdgePoint3(c,c.upper),t.vertices[e.end]!),0);assert.throws(()=>affineNurbsBoundaryEdgePoint3({...c},c.lower),/factory/);assert.throws(()=>affineNurbsBoundaryEdgePoint3(c,c.lower.affine(1n,-1n)),/outside/);assert.throws(()=>affineNurbsBoundaryEdgePoint3(c,c.upper.affine(1n,1n)),/outside/);}
});
test('input order preserves the shared curved atoms and exact polynomial identities',()=>{
 const {a,b}=halves(),s=sewAffineNurbsFaces3([b,a]);assert.equal(s.sourceUses[1]![0]![0]!.length,2);const shared=s.topology.edges.filter(e=>e.coedges.length===2);assert.equal(shared.length,2);for(const e of shared){const p=affineNurbsBoundaryEdgePoint3(e.curve,e.curve.lower.add(e.curve.upper).affine('1/2'));assert.equal(p.x.compare(p.y.mul(p.y)),0);assert.equal(p.z.compare(p.x.mul(p.y)),0);}assert.equal(s.topology.consistentlyOriented,true);
});

test('a repeated spatial coordinate produces candidate roots but only the matching 3D point cuts the boundary',()=>{
 const c=nurbsCurve3(2,[point3('3/4',0n,0n),point3('-1/4','1/2',0n),point3('3/4',1n,0n)],K2),a=face(surface(),[c,line('3/4','1','0','1'),line('0','1','0','0'),line('0','0','3/4','0')]),b=face(insertNurbsSurfaceKnot3(surface(),'v','1/4'),[line('3/4','0','1','0'),line('1','0','1','1'),line('1','1','3/4','1'),reverseNurbsCurve3(c)]),s=sewAffineNurbsFaces3([a,b]);
 assert.equal(s.sourceUses[0]![0]![0]!.length,2);const edges=s.topology.edges.filter(e=>e.coedges.length===2);assert.equal(edges.length,2);const limits=edges.flatMap(e=>[e.curve.lower,e.curve.upper]);assert.ok(limits.some(t=>t.compare(AlgebraicReal.fromRational('1/4'))===0));assert.ok(!limits.some(t=>t.compare(AlgebraicReal.fromRational('3/4'))===0));
});

test('a mismatched cube edge subdivision is noded into a closed oriented common BRep shell',()=>{
 const ring=[line('0','0','1/3','0'),line('1/3','0','1','0'),line('1','0','1','1'),line('1','1','0','1'),line('0','1','0','0')],square=[line('0','0','1','0'),line('1','0','1','1'),line('1','1','0','1'),line('0','1','0','0')],maps=[(u:bigint,v:bigint)=>point3(v,u,0n),(u:bigint,v:bigint)=>point3(u,v,1n),(u:bigint,v:bigint)=>point3(u,0n,v),(u:bigint,v:bigint)=>point3(v,1n,u),(u:bigint,v:bigint)=>point3(0n,v,u),(u:bigint,v:bigint)=>point3(1n,u,v)],faces=maps.map((f,i)=>face(nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>f(u,v))),K,K),i===0?ring:square)),t=sewAffineNurbsFaces3(faces).topology;
 assert.equal(t.edges.length,13);assert.equal(t.vertices.length,9);assert.equal(t.coedges.length,26);assert.equal(t.faces.length,6);assert.equal(t.shells.length,1);assert.equal(t.closedOrientedIncidence,true);assert.equal(t.issues.length,0);assert.ok(t.vertexLinks.every(v=>v.closed));
});
