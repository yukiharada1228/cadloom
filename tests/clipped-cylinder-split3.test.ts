import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,vector3,line3,cylinder3,plane3,clipCylinderBRep3,splitClippedCylinderByPlane3,rejoinClippedCylinderSplit3,curveEndpoints3,compareAlgebraicPoints3,curveOnSurface3,surfacesCoincide3,dot3} from '../dist/index.js';
import type {ClippedCylinderBRep3,ClippedCylinderPlaneSplit3,CylinderSplitEdgeMap3,CylinderSplitInterface3,CylinderHalfSpace3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),C=cylinder3(line3(O,Z),1n),h=(x:bigint,y:bigint,z:bigint,k:bigint|string=0n):CylinderHalfSpace3=>({plane:plane3(x,y,z,k),side:-1});
function closed(body:ClippedCylinderBRep3){assert.equal(body.empty,false);assert.equal(body.topology.closedOrientedIncidence,true);assert.equal(body.topology.issues.length,0);assert.equal(body.topology.shells.length,1);assert.equal(body.topology.vertices.length-body.topology.edges.length+body.topology.faces.length,2);assert.ok(body.interiorSample);assert.equal(body.locate(body.interiorSample),'inside');}
function maps(body:ClippedCylinderBRep3,shared:CylinderSplitInterface3,records:readonly CylinderSplitEdgeMap3[]){
 for(const record of records){const coedge=body.topology.coedges[record.coedge]!;assert.equal(coedge.edge,record.edge);assert.equal(coedge.direction,record.direction);let point=body.topology.vertices[coedge.origin]!;assert.ok(record.uses.length);
  for(const use of record.uses){const ends=curveEndpoints3(shared.edges[use.edge]!);assert.equal(compareAlgebraicPoints3(point,ends[use.direction===1?0:1]),0);point=ends[use.direction===1?1:0];}
  assert.equal(compareAlgebraicPoints3(point,body.topology.vertices[coedge.target]!),0);
 }
}
function genuine(result:ClippedCylinderPlaneSplit3){
 assert.equal(result.kind,'split');if(result.kind!=='split')throw new Error('Expected a true split');closed(result.negative);closed(result.positive);const shared=result.shared;
 assert.equal(shared.negativeLoops.length,1);assert.equal(shared.positiveLoops.length,1);assert.equal(shared.locate(shared.sample),'inside');assert.equal(result.parent.locate(shared.sample),'inside');assert.equal(result.negative.locate(shared.sample),'boundary');assert.equal(result.positive.locate(shared.sample),'boundary');
 for(let edge=0;edge<shared.edges.length;edge++){const negative=shared.negativeLoops.flat().filter(u=>u.edge===edge),positive=shared.positiveLoops.flat().filter(u=>u.edge===edge);assert.equal(negative.length,1);assert.equal(positive.length,1);assert.equal(negative[0]!.direction,-positive[0]!.direction);assert.ok(curveOnSurface3(shared.edges[edge]!,{kind:'plane',plane:result.plane}));}
 maps(result.negative,shared,shared.negativeBoundary);maps(result.positive,shared,shared.positiveBoundary);
 for(const [body,origins,face] of [[result.negative,result.negativeFaceOrigins,shared.negativeFace],[result.positive,result.positiveFaceOrigins,shared.positiveFace]] as const){assert.equal(origins.length,body.faces.length);for(let i=0;i<origins.length;i++){if(i===face){assert.equal(origins[i],null);continue;}const origin=origins[i]!;assert.notEqual(origin,null);const prior=result.parent.faces[origin]!,current=body.faces[i]!;assert.equal(prior.kind,current.kind);assert.equal(prior.domain.components[prior.component]!.locate(current.domain.components[current.component]!.sample),'inside');}}
 const rejoined=rejoinClippedCylinderSplit3(result),t=rejoined.sewing.topology;assert.equal(rejoined.parent,result.parent);assert.equal(t.closedOrientedIncidence,true);assert.equal(t.issues.length,0);assert.equal(t.shells.length,1);assert.equal(t.vertices.length-t.edges.length+t.faces.length,2);assert.equal(t.faces.length,result.negative.faces.length+result.positive.faces.length-2);assert.equal(rejoined.faces.length,t.faces.length);
 for(const f of t.faces)if(f.surface.kind==='plane')assert.equal(surfacesCoincide3(f.surface,{kind:'plane',plane:result.plane}),false);return shared;
}
function grid(result:ClippedCylinderPlaneSplit3){for(let x=-3n;x<=3n;x++)for(let y=-3n;y<=3n;y++)for(let z=-5n;z<=5n;z++){const p=point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n)),parent=result.parent.locate(p),negative=result.negative.locate(p),positive=result.positive.locate(p),side=dot3(result.plane.normal,p).add(result.plane.offset).sign();assert.equal(negative!=='outside'||positive!=='outside',parent!=='outside');assert.equal(negative==='inside'&&positive==='inside',false);if(side<0)assert.equal(positive,'outside');if(side>0)assert.equal(negative,'outside');}}
test('horizontal and oblique plane splits pair shared caps and rejoin closed external boundaries',()=>{
 const parent=clipCylinderBRep3(C,-2n,2n);
 for(const p of [plane3(0n,0n,1n),plane3(1n,0n,1n),plane3(1n,0n,0n)]){const result=splitClippedCylinderByPlane3(parent,p);genuine(result);grid(result);}
 const result=splitClippedCylinderByPlane3(parent,plane3(0n,0n,1n));if(result.kind==='split'){assert.equal(result.shared.edges.length,4);assert.equal(result.shared.locate(O),'inside');assert.equal(result.shared.locate(point3(1n,0n,0n)),'boundary');assert.equal(result.shared.locate(point3(2n,0n,0n)),'outside');assert.equal(result.shared.locate(point3(0n,0n,1n)),'outside');assert.equal(rejoinClippedCylinderSplit3(result).sewing.topology.faces.length,10);}
});
test('nonseparating facet, edge and nonvertex elliptic contacts retain the original solid',()=>{
 const parent=clipCylinderBRep3(C,-1n,1n),planes=[plane3(0n,0n,1n,-1n),plane3(3n,4n,0n,-5n),plane3(3n,4n,5n,-10n)];
 assert.ok(parent.topology.vertices.every(p=>dot3(planes[2]!.normal,{x:p.x.rational!,y:p.y.rational!,z:p.z.rational!}).add(planes[2]!.offset).sign()!==0));
 for(const p of planes){const r=splitClippedCylinderByPlane3(parent,p);assert.equal(r.kind,'touching');if(r.kind==='touching'){assert.equal(r.materialSide,-1);assert.equal(r.negative,parent);assert.equal(r.positive.empty,true);assert.equal(r.shared,null);assert.equal(rejoinClippedCylinderSplit3(r).sewing,parent.sewing);}grid(r);}
 const reversed=splitClippedCylinderByPlane3(parent,plane3(0n,0n,-1n,1n));assert.equal(reversed.kind,'touching');if(reversed.kind==='touching'){assert.equal(reversed.materialSide,1);assert.equal(reversed.positive,parent);}
});
test('strictly disjoint planes do not create interfaces or change retained topology',()=>{
 const parent=clipCylinderBRep3(C,-1n,1n);
 for(const p of [plane3(3n,4n,0n,-6n),plane3(-3n,-4n,0n,6n),plane3(0n,0n,1n,-3n)]){const r=splitClippedCylinderByPlane3(parent,p);assert.equal(r.kind,'disjoint');if(r.kind==='disjoint'){assert.equal(r.shared,null);assert.equal(r.materialSide===-1?r.negative:r.positive,parent);assert.equal(r.materialSide===-1?r.positive.empty:r.negative.empty,true);}grid(r);}
});
test('children remain owned inputs for further cuts with original-face provenance',()=>{
 const parent=clipCylinderBRep3(C,-2n,2n),first=splitClippedCylinderByPlane3(parent,plane3(1n,0n,1n));genuine(first);const second=splitClippedCylinderByPlane3(first.negative,plane3(0n,1n,0n));genuine(second);grid(second);assert.equal(second.parent,first.negative);
});
test('a pure polyhedral parent produces a hexagonal common face and no cylinder surrogate',()=>{
 const constraints=[h(1n,0n,0n,'-1/4'),h(-1n,0n,0n,'-1/4'),h(0n,1n,0n,'-1/4'),h(0n,-1n,0n,'-1/4'),h(0n,0n,1n,'-1/4'),h(0n,0n,-1n,'-1/4')],parent=clipCylinderBRep3(C,-1n,1n,constraints),r=splitClippedCylinderByPlane3(parent,plane3(1n,1n,1n)),shared=genuine(r);assert.equal(shared.edges.length,6);assert.ok(shared.edges.every(e=>e.kind==='algebraic-segment'));assert.equal(shared.locate(O),'inside');grid(r);
 const corner=splitClippedCylinderByPlane3(parent,plane3(1n,1n,1n,'-3/4'));assert.equal(corner.kind,'touching');
});
test('thin nonzero children and their algebraic shared rectangle survive exact splitting',()=>{
 const epsilon=new Rational(1n,10n**30n),parent=clipCylinderBRep3(C,-1n,1n),r=splitClippedCylinderByPlane3(parent,plane3(1n,0n,0n,new Rational(1n).sub(epsilon).neg())),shared=genuine(r);assert.equal(shared.edges.length,4);assert.equal(shared.locate(point3(new Rational(1n).sub(epsilon),0n,0n)),'inside');assert.equal(r.positive.locate(point3(new Rational(1n).sub(epsilon.div(new Rational(2n))),0n,0n)),'inside');
});
test('arbitrary rational axes pair circular interfaces with opposite normal orientation',()=>{
 const o=point3(3n,-2n,7n),d=vector3(1n,2n,2n),parent=clipCylinderBRep3(cylinder3(line3(o,d),5n),'-1/2','1/2'),p=plane3(d.x,d.y,d.z,dot3(d,o).neg()),r=splitClippedCylinderByPlane3(parent,p),shared=genuine(r);assert.equal(shared.locate(o),'inside');assert.equal(shared.locate(point3(5n,-3n,7n)),'boundary');assert.equal(shared.locate(point3(4n,0n,9n)),'outside');
});
test('elliptic-edge support extrema detect contacts on an already obliquely clipped solid',()=>{
 const parent=clipCylinderBRep3(C,-2n,2n,[h(-1n,0n,1n)]),p=plane3(2n,4n,1n,-5n);assert.ok(parent.topology.vertices.every(q=>q.x.affine(p.normal.x,p.offset).add(q.y.affine(p.normal.y)).add(q.z.affine(p.normal.z)).sign()!==0));const r=splitClippedCylinderByPlane3(parent,p);assert.equal(r.kind,'touching');assert.equal(r.negative,parent);assert.equal(r.positive.empty,true);assert.equal(parent.locate(point3('3/5','4/5','3/5')),'boundary');
});
test('general tilted interfaces and negative normal rescaling exchange material sides exactly',()=>{
 const parent=clipCylinderBRep3(C,-2n,2n),a=splitClippedCylinderByPlane3(parent,plane3(1n,2n,3n,'1/4')),b=splitClippedCylinderByPlane3(parent,plane3(-7n,-14n,-21n,'-7/4')),A=genuine(a),B=genuine(b);
 for(let x=-2n;x<=2n;x++)for(let y=-2n;y<=2n;y++){const X=new Rational(x,2n),Y=new Rational(y,2n),z=X.add(Y.mul(new Rational(2n))).add(new Rational(1n,4n)).neg().div(new Rational(3n)),p=point3(X,Y,z);assert.equal(A.locate(p),B.locate(p));assert.equal(a.negative.locate(p),b.positive.locate(p));assert.equal(a.positive.locate(p),b.negative.locate(p));}
});
test('empty inputs, immutable maps and factory ownership are explicit',()=>{
 const empty=clipCylinderBRep3(C,-1n,1n,[h(-1n,0n,0n,2n)]),r=splitClippedCylinderByPlane3(empty,plane3(1n,0n,0n));assert.equal(r.kind,'empty');assert.equal(r.negative,empty);assert.equal(r.positive,empty);assert.equal(r.shared,null);assert.equal(rejoinClippedCylinderSplit3(r).sewing.topology.faces.length,0);
 const parent=clipCylinderBRep3(C,-1n,1n),s=splitClippedCylinderByPlane3(parent,plane3(0n,0n,1n));assert.throws(()=>splitClippedCylinderByPlane3({...parent},plane3(1n,0n,0n)),RangeError);assert.throws(()=>rejoinClippedCylinderSplit3({...s}),RangeError);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.negativeFaceOrigins));if(s.kind==='split')assert.ok(Object.isFrozen(s.shared)&&Object.isFrozen(s.shared.edges)&&Object.isFrozen(s.shared.negativeBoundary)&&Object.isFrozen(s.shared.negativeBoundary[0]!.uses));
});
