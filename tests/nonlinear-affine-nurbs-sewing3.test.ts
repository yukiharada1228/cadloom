import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,sewAffineNurbsFaces3,serializeAffineNurbsFaces3,restoreAffineNurbsFaces3,reverseNurbsCurve3,affineNurbsBoundaryEdgePoint3,AlgebraicReal} from '../dist/index.js';
import type {NurbsCurve3,NurbsSurface3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],K3=[0n,0n,0n,0n,1n,1n,1n,1n];
const line=(a:string,b:string,c:string,d:string)=>nurbsCurve3(1,[point3(a,b,0n),point3(c,d,0n)],K);
const square=(a='0',b='0',c='1',d='1')=>[line(a,b,c,b),line(c,b,c,d),line(c,d,a,d),line(a,d,a,b)];
const flat=()=>nurbsSurface3(1,1,[-4n,4n].map(u=>[-4n,4n].map(v=>point3(u,v,0n))),[-4n,-4n,4n,4n],[-4n,-4n,4n,4n]);
function face(ring:readonly NurbsCurve3[],s:NurbsSurface3=flat()){const c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected certificate');return createAffineNurbsFace3(c.certificate,prepareNurbsParameterDomain2(ring));}
function adjacent(cubic=false){const ring=square('1','0','2','1');ring[3]=cubic?nurbsCurve3(3,[point3(1n,1n,0n),point3(1n,0n,0n),point3(1n,1n,0n),point3(1n,0n,0n)],K3):nurbsCurve3(2,[point3(1n,1n,0n),point3(1n,0n,0n),point3(1n,0n,0n)],K2);return [face(square()),face(ring)] as const;}
test('nonlinear endpoint-stationary parameterizations share one oriented edge in either face order',()=>{
 const [a,b]=adjacent();for(const faces of [[a,b],[b,a]]){const s=sewAffineNurbsFaces3(faces),t=s.topology,shared=t.edges.filter(e=>e.coedges.length===2);assert.equal(t.edges.length,7);assert.equal(t.vertices.length,6);assert.equal(shared.length,1);assert.equal(t.manifoldVertices,true);assert.equal(t.consistentlyOriented,true);assert.equal(t.boundaryLoops!.length,1);assert.equal(t.coedges[shared[0]!.coedges[0]!]!.direction,-t.coedges[shared[0]!.coedges[1]!]!.direction);}
});
test('an interior stationary cubic map shares both exact atoms across its parameter event',()=>{
 const [a,b]=adjacent(true),s=sewAffineNurbsFaces3([a,b]),t=s.topology;assert.equal(t.edges.filter(e=>e.coedges.length===2).length,2);assert.equal(t.edges.length,8);assert.equal(t.vertices.length,7);assert.equal(s.sourceUses[0]![0]![1]!.length,2);assert.equal(t.manifoldVertices,true);assert.equal(t.consistentlyOriented,true);
});
test('partial nonlinear overlap shares only the completely covered atom',()=>{
 const a=face(square()),ring=square('1','1/4','2','3/4');ring[3]=nurbsCurve3(2,[point3(1n,'3/4',0n),point3(1n,'3/4',0n),point3(1n,'1/4',0n)],K2);const s=sewAffineNurbsFaces3([a,face(ring)]),t=s.topology,shared=t.edges.filter(e=>e.coedges.length===2);assert.equal(shared.length,1);assert.equal(t.edges.length,9);assert.equal(t.vertices.length,8);assert.equal(s.sourceUses[0]![0]![1]!.length,3);const edge=shared[0]!.curve;assert.equal(affineNurbsBoundaryEdgePoint3(edge,edge.lower).y.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(affineNurbsBoundaryEdgePoint3(edge,edge.upper).y.compare(AlgebraicReal.fromRational('3/4')),0);
});
test('a curved spatial boundary with a degree-four reparameterization is shared and restored',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K),c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],K2),d=nurbsCurve3(4,[point3(0n,0n,0n),point3(0n,0n,0n),point3(0n,'1/6',0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],[0n,0n,0n,0n,0n,1n,1n,1n,1n,1n]),a=face([c,line('1','1','0','1'),line('0','1','0','0')],s),b=face([line('0','0','1','0'),line('1','0','1','1'),reverseNurbsCurve3(d)],s);
 for(const result of [sewAffineNurbsFaces3([a,b]),restoreAffineNurbsFaces3(serializeAffineNurbsFaces3([a,b]))]){const shared=result.topology.edges.filter(e=>e.coedges.length===2);assert.equal(shared.length,1);assert.equal(result.topology.edges.length,5);assert.equal(result.topology.boundaryLoops!.length,1);const e=shared[0]!.curve,p=affineNurbsBoundaryEdgePoint3(e,e.lower.add(e.upper).affine('1/2'));assert.equal(p.x.compare(p.y.mul(p.y)),0);assert.equal(p.z.compare(p.x.mul(p.y)),0);}
});
test('nonlinear cube edge parameterization closes through common incidence and reconstructive persistence',()=>{
 const ring=square();ring[0]=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,0n,0n),point3(1n,0n,0n)],K2);const maps=[(u:bigint,v:bigint)=>point3(v,u,0n),(u:bigint,v:bigint)=>point3(u,v,1n),(u:bigint,v:bigint)=>point3(u,0n,v),(u:bigint,v:bigint)=>point3(v,1n,u),(u:bigint,v:bigint)=>point3(0n,v,u),(u:bigint,v:bigint)=>point3(1n,u,v)],faces=maps.map((f,i)=>face(i===0?ring:square(),nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>f(u,v))),K,K)));
 for(const s of [sewAffineNurbsFaces3(faces),restoreAffineNurbsFaces3(serializeAffineNurbsFaces3(faces))]){assert.equal(s.topology.edges.length,12);assert.equal(s.topology.vertices.length,8);assert.equal(s.topology.coedges.length,24);assert.equal(s.topology.closedOrientedIncidence,true);assert.equal(s.topology.issues.length,0);}
});
test('complementary circle arcs with the same endpoints and algebraic support are never merged',()=>{
 const upper=nurbsCurve3(3,[point3(-1n,0n,0n),point3(-1n,2n,0n),point3(1n,2n,0n),point3(1n,0n,0n)],K3,[3n,1n,1n,3n]),lower=nurbsCurve3(3,[point3(-1n,0n,0n),point3(-1n,-2n,0n),point3(1n,-2n,0n),point3(1n,0n,0n)],K3,[3n,1n,1n,3n]),a=face([line('-1','0','1','0'),reverseNurbsCurve3(upper)]),b=face([lower,line('1','0','-1','0')]),s=sewAffineNurbsFaces3([a,b]),t=s.topology;assert.equal(t.edges.length,3);assert.equal(t.vertices.length,2);assert.equal(t.edges.filter(e=>e.coedges.length===2).length,1);assert.equal(t.edges.filter(e=>e.coedges.length===1).length,2);assert.equal(t.closed,false);assert.equal(t.manifoldVertices,true);assert.equal(t.boundaryLoops!.length,1);
});
