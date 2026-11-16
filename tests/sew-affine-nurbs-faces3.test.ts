import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,sewAffineNurbsFaces3,Rational,evaluateNurbsCurve3,compareAlgebraicPoints3} from '../dist/index.js';
import type {Point3,AffineNurbsFace3} from '../dist/index.js';
const K=[0n,0n,1n,1n];
function rectangle(knots=K){const ps=[point3(0n,0n,0n),point3(1n,0n,0n),point3(1n,1n,0n),point3(0n,1n,0n)];return ps.map((p,i)=>nurbsCurve3(1,[p,ps[(i+1)%4]!],knots));}
function face(f:(u:bigint,v:bigint)=>Point3,ring=rectangle()):AffineNurbsFace3 {const s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>f(u,v))),K,K),c=certifyNurbsSurfaceAffineProjection3(s);if(c.kind!=='certified')throw Error('Expected projection');return createAffineNurbsFace3(c.certificate,prepareNurbsParameterDomain2(ring));}
test('neighboring curved NURBS faces share an oppositely used whole boundary despite different UV charts and curve parameters',()=>{
 const a=face((u,v)=>point3(u,v,u*v)),b=face((u,v)=>point3(1n+u,v,(1n+u)*v),rectangle([2n,2n,5n,5n])),s=sewAffineNurbsFaces3([a,b]),t=s.topology;
 assert.equal(t.edges.length,7);assert.equal(t.vertices.length,6);assert.equal(t.faces.length,2);assert.equal(t.shells.length,1);assert.equal(t.closed,false);assert.equal(t.consistentlyOriented,true);assert.equal(t.manifoldVertices,true);assert.equal(t.boundaryLoops!.length,1);const shared=t.edges.filter(e=>e.coedges.length===2);assert.equal(shared.length,1);const uses=shared[0]!.coedges.map(h=>t.coedges[h]!);assert.equal(uses[0]!.direction,-uses[1]!.direction);assert.equal(uses[0]!.twin,shared[0]!.coedges[1]);assert.equal(s.sourceUses[0]![0]![1]![0]!.edge,s.sourceUses[1]![0]![3]![0]!.edge);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.sourceUses));assert.equal(t.faces[0]!.surface,a);
});
test('six affine NURBS faces use common incidence for a closed oriented cube shell',()=>{
 const faces=[face((u,v)=>point3(v,u,0n)),face((u,v)=>point3(u,v,1n)),face((u,v)=>point3(u,0n,v)),face((u,v)=>point3(v,1n,u)),face((u,v)=>point3(0n,v,u)),face((u,v)=>point3(1n,u,v))],t=sewAffineNurbsFaces3(faces).topology;
 assert.equal(t.edges.length,12);assert.equal(t.vertices.length,8);assert.equal(t.coedges.length,24);assert.equal(t.faces.length,6);assert.equal(t.shells.length,1);assert.equal(t.issues.length,0);assert.equal(t.closedOrientedIncidence,true);assert.equal(t.boundaryLoops!.length,0);for(const h of t.coedges){assert.notEqual(h.twin,null);assert.equal(t.coedges[h.twin!]!.twin,t.edges[h.edge]!.coedges.find(id=>t.coedges[id]===h));}
});
test('equal endpoints never merge distinct whole curves',()=>{
 const flat=(u:bigint,v:bigint)=>point3(u,v,0n),straight=rectangle().map(c=>nurbsCurve3(c.degree,c.controlPoints.map(p=>point3(p.x,p.y.div(new Rational(2n)),0n)),c.knots,c.weights)),a=face(flat,straight),ring=[...straight];ring[2]=nurbsCurve3(3,[point3(1n,'1/2',0n),point3('2/3','1/3',0n),point3('1/3','2/3',0n),point3(0n,'1/2',0n)],[0n,0n,0n,0n,1n,1n,1n,1n]);for(const t of [0n,'1/2',1n])assert.equal(compareAlgebraicPoints3(evaluateNurbsCurve3(straight[2]!,t),evaluateNurbsCurve3(ring[2]!,t)),0);const b=face(flat,ring),t=sewAffineNurbsFaces3([a,b]).topology;
 assert.equal(t.edges.length,5);assert.equal(t.edges.filter(e=>e.coedges.length===2).length,3);assert.equal(t.edges.filter(e=>e.coedges.length===1).length,2);assert.equal(t.closed,false);assert.ok(t.issues.some(i=>i.kind==='inconsistent-edge-orientation'));
});
test('owned geometry is mandatory and boundary provenance remains frozen',()=>{
 const a=face((u,v)=>point3(u,v,u*v));assert.throws(()=>sewAffineNurbsFaces3([{...a}]),/factory/);const s=sewAffineNurbsFaces3([a]);assert.equal(s.topology.edges.length,4);assert.equal(s.topology.issues.filter(i=>i.kind==='boundary-edge').length,4);for(const r of s.sourceUses[0]!)for(const c of r){assert.ok(Object.isFrozen(c));for(const e of c)assert.ok(Object.isFrozen(e));}assert.equal(sewAffineNurbsFaces3([]).topology.faces.length,0);
});

test('unmatched subdivisions stay explicit instead of claiming complete automatic sewing',()=>{
 const a=face((u,v)=>point3(u,v,u*v)),ring=rectangle(),p=point3(0n,'1/2',0n);ring.splice(3,1,nurbsCurve3(1,[point3(0n,1n,0n),p],K),nurbsCurve3(1,[p,point3(0n,0n,0n)],K));const b=face((u,v)=>point3(1n+u,v,(1n+u)*v),ring),t=sewAffineNurbsFaces3([a,b]).topology;
 assert.equal(t.edges.length,9);assert.equal(t.vertices.length,7);assert.equal(t.closed,false);assert.equal(t.closedOrientedIncidence,false);assert.equal(t.edges.filter(e=>e.coedges.length===2).length,0);
});
