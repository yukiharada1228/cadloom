import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,plane3,intersectCylinders3,cylinderIntersectionArcOnSurface3,cylinderIntersectionBRepCurve3 as ssi,nativeBRepCurve3 as native,reverseBRepCurve3 as reverse,brepCurveEndpoints3 as ends,brepCurveOnSurface3,pointOnBRepCurve3,buildMixedBRepTopology3,sewMixedBRepFaces3,compareAlgebraicPoints3,classifyPointToSurface3,splitCylinderIntersectionArc3,clipCylinderBRep3,surfacesCoincide3,reverseCurve3,createBoxBody3,algebraicCoordinates3,fullCircleArc3,circle3,curveNodingPoints3,lineInterval3,planeFrame3,prepareRectangleFace3,prepareCylinderFace3,intersectPlanarCylinderFaces3,curveEndpoints3} from '../dist/index.js';
import type {Curve3,Cylinder3,CylinderIntersectionArc3,BRepCurve3,MixedBRepFace3,SewnMixedBRep3,BRepTopology3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),A=cylinder3(line3(O,Z),1n),B=cylinder3(line3(O,X),4n);
const rev=(loop:readonly BRepCurve3[])=>[...loop].reverse().map(reverse);
function graph(a=A,b=B){const g=intersectCylinders3(a,b);assert.equal(g.kind,'bounded');if(g.kind!=='bounded')throw new Error('Expected SSI');return g;}
function fixture(){const g=graph(),top=g.arcs.filter(a=>a.branch===1).map(a=>ssi(a)),bottom=g.arcs.filter(a=>a.branch===-1).map(a=>ssi(a));return {g,top,bottom,faces:[{surface:{kind:'cylinder' as const,cylinder:A},sense:1 as const,loops:[bottom,rev(top)]},{surface:{kind:'cylinder' as const,cylinder:B},sense:1 as const,loops:[top]},{surface:{kind:'cylinder' as const,cylinder:B},sense:1 as const,loops:[rev(bottom)]}]};}
function provenance(r:SewnMixedBRep3,input:readonly MixedBRepFace3[]){
 assert.equal(r.sourceUses.length,input.length);input.forEach((f,i)=>f.loops.forEach((loop,j)=>loop.forEach((curve,k)=>{
  const uses=r.sourceUses[i]![j]![k]!,e=ends(curve);let p=e[0];assert.ok(uses.length);
  for(const use of uses){const a=ends(r.topology.edges[use.edge]!.curve);assert.equal(compareAlgebraicPoints3(p,a[use.direction===1?0:1]),0);p=a[use.direction===1?1:0];}
  assert.equal(compareAlgebraicPoints3(p,e[1]),0);
 })));
 r.topology.edges.forEach(edge=>edge.coedges.forEach(id=>assert.equal(brepCurveOnSurface3(edge.curve,r.topology.faces[r.topology.coedges[id]!.face]!.surface),true)));
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.sourceUses)&&Object.isFrozen(r.faceLoops));
}
function patch(t:BRepTopology3<Curve3|BRepCurve3>,id:number):MixedBRepFace3 {const f=t.faces[id]!;return {surface:f.surface,sense:f.sense,loops:f.loops.map(l=>t.loops[l]!.coedges.map(id=>{const h=t.coedges[id]!,raw=t.edges[h.edge]!.curve,c=raw.kind==='native'||raw.kind==='cylinder-ssi'?raw:native(raw);return h.direction===1?c:reverse(c);}))};}
function ordered(arcs:readonly CylinderIntersectionArc3[],ccw:boolean):BRepCurve3[]{
 const remaining=arcs.map(a=>ssi(a)),loop=[remaining.shift()!];while(remaining.length){const target=ends(loop[loop.length-1]!)[1],i=remaining.findIndex(c=>ends(c).some(p=>compareAlgebraicPoints3(p,target)===0));assert.ok(i>=0);let c=remaining.splice(i,1)[0]!;if(compareAlgebraicPoints3(ends(c)[0],target)!==0)c=reverse(c);loop.push(c);}
 assert.equal(compareAlgebraicPoints3(ends(loop[loop.length-1]!)[1],ends(loop[0]!)[0]),0);
 const [p,q]=ends(loop[0]!),sign=p.x.mul(q.y).sub(p.y.mul(q.x)).sign();assert.notEqual(sign,0);return (sign>0)===ccw?loop:rev(loop);
}
test('irreducible quartic cylinder intersection edges form explicit shared three-face BRep incidence',()=>{
 const {g}=fixture(),edges=g.arcs.map(a=>ssi(a)),r=buildMixedBRepTopology3(edges,[{surface:{kind:'cylinder',cylinder:A},sense:1,loops:[[{edge:0,direction:1},{edge:2,direction:1}],[{edge:3,direction:-1},{edge:1,direction:-1}]]},{surface:{kind:'cylinder',cylinder:B},sense:1,loops:[[{edge:1,direction:1},{edge:3,direction:1}]]},{surface:{kind:'cylinder',cylinder:B},sense:1,loops:[[{edge:2,direction:-1},{edge:0,direction:-1}]]}]);
 assert.equal(r.closedOrientedIncidence,true);assert.equal(r.issues.length,0);assert.equal(r.edges.length,4);assert.equal(r.vertices.length,4);assert.equal(r.faces.length,3);assert.equal(r.shells.length,1);assert.equal(r.loops.length,4);assert.ok(r.edges.every(e=>e.curve.kind==='cylinder-ssi'&&e.coedges.length===2));
 // The cylinder face is an annulus: use face Euler contributions, not F alone.
 assert.equal(r.vertices.length-r.edges.length+r.faces.reduce((sum,f)=>sum+2-f.loops.length,0),2);
});
test('whole-curve support rejects a different cylinder through both endpoints and the representative sample',()=>{
 const unitX=cylinder3(line3(O,X),1n),g=graph(A,unitX),a=g.arcs[0]!,sx=BigInt(a.sample.x.sign()),sy=BigInt(a.sample.y.sign()),sz=BigInt(a.sample.z.sign()),target=cylinder3(line3(O,point3(2n*sx,sy,new Rational(-sz,3n))),'37/46'),surface={kind:'cylinder' as const,cylinder:target};
 for(const p of [a.start,a.end,a.sample])assert.equal(classifyPointToSurface3(p,surface),0);
 assert.equal(cylinderIntersectionArcOnSurface3(a,surface),false);const next=splitCylinderIntersectionArc3(a,[a.sample])[0]!;assert.notEqual(classifyPointToSurface3(next.sample,surface),0);
 assert.throws(()=>buildMixedBRepTopology3([ssi(a)],[{surface,sense:1,loops:[[{edge:0,direction:1},{edge:0,direction:-1}]]}]),RangeError);
 assert.equal(cylinderIntersectionArcOnSurface3(a,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),1n)}),true);
 for(const [i,arc] of g.arcs.entries())assert.equal(cylinderIntersectionArcOnSurface3(arc,{kind:'plane',plane:plane3(-1n,0n,1n)}),i===0||i===3);
 assert.equal(cylinderIntersectionArcOnSurface3(a,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),2n)}),false);
});
test('mixed sewing preserves curved source-use paths and closed cylinder/cylinder boundary incidence',()=>{
 const {faces}=fixture(),r=sewMixedBRepFaces3(faces,{requireClosed:true});provenance(r,faces);assert.equal(r.topology.edges.length,4);assert.equal(r.topology.faces.length,3);assert.equal(r.topology.closedOrientedIncidence,true);
 for(const c of r.topology.coedges)assert.notEqual(c.twin,null);
});
test('swapping SSI parameter axes nodes unmatched endpoints and merges the same quartic geometry',()=>{
 const base=fixture(),swapped=graph(B,A),top=ordered(swapped.arcs.filter(a=>a.sample.z.sign()>0),true),bottom=ordered(swapped.arcs.filter(a=>a.sample.z.sign()<0),false),faces:MixedBRepFace3[]=[base.faces[0]!,{surface:{kind:'cylinder',cylinder:B},sense:1,loops:[top]},{surface:{kind:'cylinder',cylinder:B},sense:1,loops:[bottom]}];
 const r=sewMixedBRepFaces3(faces,{requireClosed:true});provenance(r,faces);assert.equal(r.topology.vertices.length,8);assert.equal(r.topology.edges.length,8);assert.equal(r.topology.faces.length,3);assert.equal(r.topology.issues.length,0);assert.ok(r.sourceUses[0]!.some(l=>l.some(u=>u.length===2)));
});
test('native elliptic boundary uses sew against SSI representations and store shared SSI edges',()=>{
 const b=cylinder3(line3(O,X),1n),g=graph(A,b),plane=plane3(-1n,0n,1n),source=clipCylinderBRep3(A,-2n,2n,[{plane,side:-1}]),cap=source.faces.findIndex(f=>f.kind==='planar'&&surfacesCoincide3({kind:'plane',plane:f.plane},{kind:'plane',plane}));assert.ok(cap>=0);
 const top=g.arcs.filter(a=>cylinderIntersectionArcOnSurface3(a,{kind:'plane',plane})).map(a=>ssi(a)),original=patch(source.topology,cap),faces:MixedBRepFace3[]=[{...original,loops:[top]},...source.topology.faces.flatMap((_,i)=>i===cap?[]:[patch(source.topology,i)])],r=sewMixedBRepFaces3(faces,{requireClosed:true});provenance(r,faces);
 assert.equal(r.topology.faces.length,6);assert.equal(r.topology.vertices.length,8);assert.equal(r.topology.edges.length,12);assert.equal(r.topology.edges.filter(e=>e.curve.kind==='cylinder-ssi').length,4);assert.ok(r.sourceUses[0]![0]!.every(u=>u.length===2));
});
test('all four singular-locus branches remain distinct despite sharing identical endpoint pairs',()=>{
 const b=cylinder3(line3(O,X),1n),g=graph(A,b),curves=g.arcs.map(a=>ssi(a)),faces:MixedBRepFace3[]=[{surface:{kind:'cylinder',cylinder:A},sense:1,loops:curves.map(c=>[c,reverse(c)])}],r=sewMixedBRepFaces3(faces);provenance(r,faces);
 assert.equal(r.topology.edges.length,4);assert.equal(r.topology.vertices.length,2);assert.equal(r.topology.closedOrientedIncidence,false);assert.throws(()=>sewMixedBRepFaces3(faces,{requireClosed:true}),RangeError);
});
test('partial curved source subdivisions retain oriented provenance, without asserting face-domain validity',()=>{
 const g=graph(),top=g.arcs.filter(a=>a.branch===1),parts=splitCylinderIntersectionArc3(top[0]!,[top[0]!.sample]),whole=top.map(a=>ssi(a)),subdivided=[...parts.map(a=>ssi(a)),ssi(top[1]!)],faces:MixedBRepFace3[]=[{surface:{kind:'cylinder',cylinder:A},sense:1,loops:[whole]},{surface:{kind:'cylinder',cylinder:B},sense:1,loops:[rev(subdivided)]}],r=sewMixedBRepFaces3(faces,{requireClosed:true});provenance(r,faces);
 assert.equal(r.topology.edges.length,3);assert.equal(r.sourceUses[0]![0]![0]!.length,2);assert.equal(r.topology.closedOrientedIncidence,true);
});
test('native-only compatibility, orientation snapshots and forged algebraic edges remain explicit',()=>{
 const box=createBoxBody3(O,1n,1n,1n),faces=box.topology.faces.map((_,i)=>patch(box.topology,i)),r=sewMixedBRepFaces3(faces,{requireClosed:true});provenance(r,faces);assert.equal(r.topology.edges.length,12);assert.equal(r.topology.faces.length,6);
 const a=graph().arcs[0]!,c=ssi(a),back=reverse(c);assert.equal(compareAlgebraicPoints3(ends(c)[0],ends(back)[1]),0);assert.equal(compareAlgebraicPoints3(ends(c)[1],ends(back)[0]),0);assert.equal(pointOnBRepCurve3(a.sample,back),true);
 assert.throws(()=>ssi({...a}),RangeError);assert.throws(()=>ssi(a,0 as 1),RangeError);assert.throws(()=>sewMixedBRepFaces3([],{requireClosed:1 as unknown as boolean}),TypeError);
 const fake={...c,start:point3(999n,999n,999n),end:point3(999n,999n,999n)};assert.equal(compareAlgebraicPoints3(ends(fake)[0],a.start),0);
});

test('upstream cut points split a shared box edge and map back to exact topology vertices',()=>{
 const box=createBoxBody3(O,2n,2n,2n),faces=box.topology.faces.map((_,i)=>patch(box.topology,i));
 const baseline=sewMixedBRepFaces3(faces,{requireClosed:true}),edge=baseline.topology.edges[0]!,[a,b]=ends(edge.curve);
 const middle=algebraicCoordinates3(a.x.add(b.x).affine('1/2'),a.y.add(b.y).affine('1/2'),a.z.add(b.z).affine('1/2'));
 const cuts=[middle,middle,point3(9n,9n,9n),a],result=sewMixedBRepFaces3(faces,{requireClosed:true,splitPoints:cuts});
 provenance(result,faces);assert.equal(result.topology.edges.length,baseline.topology.edges.length+1);assert.equal(result.topology.vertices.length,baseline.topology.vertices.length+1);
 assert.ok(result.topology.closedOrientedIncidence);assert.equal(result.splitPointVertices[0],result.splitPointVertices[1]);assert.equal(result.splitPointVertices[2],null);
 cuts.forEach((p,i)=>{const vertex=result.splitPointVertices[i];if(vertex!==null)assert.equal(compareAlgebraicPoints3(algebraicCoordinates3(p.x,p.y,p.z),result.topology.vertices[vertex!]!),0);});
 assert.ok(Object.isFrozen(result.splitPointVertices));assert.equal(baseline.splitPointVertices.length,0);
 const reversed=sewMixedBRepFaces3(faces,{requireClosed:true,splitPoints:[...cuts].reverse()});assert.deepEqual([...reversed.splitPointVertices].reverse(),result.splitPointVertices);
});
test('upstream SSI interior cuts preserve shared edges, source paths and closure',()=>{
 const {faces,g}=fixture(),cut=g.arcs[0]!.sample,baseline=sewMixedBRepFaces3(faces,{requireClosed:true});
 const result=sewMixedBRepFaces3(faces,{requireClosed:true,splitPoints:[cut]});provenance(result,faces);
 assert.equal(result.topology.edges.length,baseline.topology.edges.length+1);assert.equal(result.topology.vertices.length,baseline.topology.vertices.length+1);
 const vertex=result.splitPointVertices[0]!;assert.notEqual(vertex,null);assert.equal(compareAlgebraicPoints3(result.topology.vertices[vertex!]!,cut),0);
 assert.ok(result.topology.edges.every(e=>e.coedges.length===2));assert.ok(result.sourceUses.flat(2).some(uses=>uses.length===2));
});
test('native conic intersection events feed sewing without changing the source loop',()=>{
 const circle={kind:'circular-arc' as const,arc:fullCircleArc3(circle3(O,Z,1n))};
 const cutting={kind:'line' as const,interval:lineInterval3(line3(point3('-2','4/5',0n),X),0n,4n)};
 const points=curveNodingPoints3(circle,cutting);assert.equal(points.length,2);
 const faces:MixedBRepFace3[]=[{surface:{kind:'plane',plane:plane3(0n,0n,1n)},sense:1,loops:[[native(circle)]]}];
 const baseline=sewMixedBRepFaces3(faces),result=sewMixedBRepFaces3(faces,{splitPoints:points});provenance(result,faces);
 assert.equal(result.topology.edges.length,baseline.topology.edges.length+2);assert.equal(result.topology.vertices.length,baseline.topology.vertices.length+2);
 result.splitPointVertices.forEach((vertex,i)=>{assert.notEqual(vertex,null);assert.equal(compareAlgebraicPoints3(result.topology.vertices[vertex!]!,points[i]!),0);});
 assert.equal(result.sourceUses[0]![0]![0]!.length,baseline.sourceUses[0]![0]![0]!.length+2);
});

test('finite face section endpoints become exact boundary vertices with source paths retained',()=>{
 const planar=prepareRectangleFace3(planeFrame3(O,X,point3(0n,1n,0n)),-2n,2n,'-1/2','1/2');
 const wall=prepareCylinderFace3(A,-1n,1n),section=intersectPlanarCylinderFaces3(planar,wall);
 const points=[...section.curves.flatMap(c=>curveEndpoints3(c.curve)),...section.points];
 const faces:MixedBRepFace3[]=[{surface:{kind:'plane',plane:planar.surface},sense:1,loops:planar.boundary.map(loop=>loop.map(native))}];
 const baseline=sewMixedBRepFaces3(faces),result=sewMixedBRepFaces3(faces,{splitPoints:points});provenance(result,faces);
 const unique=new Set(result.splitPointVertices);unique.delete(null);assert.equal(unique.size,4);
 assert.equal(result.topology.vertices.length,baseline.topology.vertices.length+4);assert.equal(result.topology.edges.length,baseline.topology.edges.length+4);
 for(const [i,vertex] of result.splitPointVertices.entries()){
  const onBoundary=faces[0]!.loops.flat().some(c=>pointOnBRepCurve3(points[i]!,c));
  assert.equal(vertex!==null,onBoundary);
  if(vertex!==null)assert.equal(compareAlgebraicPoints3(result.topology.vertices[vertex]!,points[i]!),0);
 }
 // These are cuts of the supplied boundary only: no interior circle arcs or new faces are inferred.
 assert.equal(result.topology.faces.length,1);assert.ok(result.topology.edges.every(e=>e.curve.kind==='native'&&e.curve.curve.kind==='algebraic-segment'));
});
