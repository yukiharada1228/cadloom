import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,plane3,nurbsSurface3,insertNurbsSurfaceKnot3,intersectNurbsSurfacePlane3,sewNurbsPlaneSection3,nurbsSectionComplexEdgePoint3,nurbsPlaneSectionVertex3,nurbsPlaneSectionEdgePoint3,compareAlgebraicPoints3} from '../dist/index.js';
import type {NurbsSectionComplex3,ExactInput} from '../dist/index.js';
const q=(n:bigint,d=1n)=>new Rational(n,d),K=[0n,0n,1n,1n],jump=[0n,0n,'1/2','1/2',1n,1n],P=plane3(0n,0n,1n);
function between(inputA:AlgebraicReal,inputB:AlgebraicReal):Rational{let a=inputA,b=inputB;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(q(2n));}
function audit(c:NurbsSectionComplex3){
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.vertices)&&Object.isFrozen(c.edges));
  assert.equal(c.components.reduce((n,g)=>n+g.vertices.length,0),c.vertices.length);assert.equal(c.components.reduce((n,g)=>n+g.edges.length,0),c.edges.length);assert.equal(c.components.reduce((n,g)=>n+g.areas.length,0),c.source.containedPatches.length);
  c.source.pieces.forEach(({topology:t},piece)=>{
    t.vertices.forEach((v,id)=>assert.ok(c.vertices.some(p=>p.uses.some(use=>use.piece===piece&&use.vertex===id)&&p.u.compare(v.u)===0&&p.v.compare(v.v)===0&&compareAlgebraicPoints3(p.point,nurbsPlaneSectionVertex3(c.source,piece,id))===0)));
    t.edges.forEach((e,edge)=>{const pieces=c.edges.filter(p=>p.uses.some(use=>use.piece===piece&&use.edge===edge)).sort((a,b)=>a.lower.compare(b.lower)),a=t.vertices[e.from]!,b=t.vertices[e.to]!;assert.ok(pieces.length);assert.equal(pieces[0]!.lower.compare(e.kind==='branch'?a.u:a.v),0);assert.equal(pieces[pieces.length-1]!.upper.compare(e.kind==='branch'?b.u:b.v),0);for(let i=1;i<pieces.length;i++)assert.equal(pieces[i-1]!.upper.compare(pieces[i]!.lower),0);});
  });
  c.edges.forEach((e,id)=>{
    assert.equal(e.lower.compare(e.upper),-1);const samples=[e.lower,AlgebraicReal.fromRational(between(e.lower,e.upper)),e.upper];
    for(const t of samples){const p=nurbsSectionComplexEdgePoint3(c,id,t);for(const use of e.uses)assert.equal(compareAlgebraicPoints3(p,nurbsPlaneSectionEdgePoint3(c.source,use.piece,use.edge,t)),0);}
    assert.equal(compareAlgebraicPoints3(nurbsSectionComplexEdgePoint3(c,id,e.lower),c.vertices[e.from]!.point),0);assert.equal(compareAlgebraicPoints3(nurbsSectionComplexEdgePoint3(c,id,e.upper),c.vertices[e.to]!.point),0);for(const area of e.areas){assert.ok(c.vertices[e.from]!.areas.includes(area));assert.ok(c.vertices[e.to]!.areas.includes(area));}
  });
}
function boundarySurface(rightX:readonly ExactInput[]){
  const degree=rightX.length-1,ys=rightX.map((_,j)=>q(BigInt(j),BigInt(degree))),rows=[ys.map(y=>point3(-1n,y,-1n)),ys.map(y=>point3(0n,y,0n)),ys.map((y,j)=>point3(rightX[j]!,y,0n)),ys.map(y=>point3(1n,y,1n))];
  return nurbsSurface3(1,degree,rows,jump,[...Array(degree+1).fill(0n),...Array(degree+1).fill(1n)]);
}
test('continuous patch corners sew four source pieces into one saddle section without losing point-only uses',()=>{
  let s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);s=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(s,'u','1/2'),'v','1/2');const section=intersectNurbsSurfacePlane3(s,plane3(0n,0n,1n,'-1/4')),c=sewNurbsPlaneSection3(section);audit(c);assert.equal(section.pieces.length,4);assert.equal(c.components.length,1);assert.equal(c.vertices.length,3);assert.equal(c.edges.length,2);assert.ok(c.vertices.some(v=>v.uses.length===4));
});
test('both horizontal and vertical coincident seam curves merge exact edge intervals with provenance',()=>{
  const poles=[[1n,0n],[1n,1n],[0n,1n]];let s=nurbsSurface3(2,1,poles.map(([x,y])=>[point3(x!,y!,-2n),point3(x!,y!,3n)]),[0n,0n,0n,1n,1n,1n],K,[[1n,1n],[1n,1n],[2n,2n]]);s=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(s,'u','1/2'),'v','2/5');
  for(const plane of [P,plane3(3n,4n,0n,-5n)]){const c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(s,plane));audit(c);assert.equal(c.source.pieces.length,4);assert.equal(c.vertices.length,3);assert.equal(c.edges.length,2);assert.equal(c.components.length,1);assert.ok(c.edges.every(e=>e.uses.length===2));assert.ok(c.seams.some(s=>s.kind==='interval'));}
});
test('different incident roots node a shared seam at both sides before merging its boundary atoms',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,'-1/6'),point3(0n,1n,'1/3')],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'-1/3'),point3(1n,1n,'1/6')]],[0n,0n,'1/2',1n,1n],K),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(s,P));audit(c);assert.equal(c.vertices.length,6);assert.equal(c.edges.length,5);assert.equal(c.components.length,1);assert.equal(c.edges.filter(e=>e.uses.length===2).length,3);assert.ok(c.vertices.some(v=>v.uses.some(u=>u.vertex===null)));
  const id=c.edges.findIndex(e=>e.lower.compare(AlgebraicReal.fromRational('1/3'))===0&&e.upper.compare(AlgebraicReal.fromRational('2/3'))===0),use=c.edges[id]!.uses[0]!;assert.doesNotThrow(()=>nurbsPlaneSectionEdgePoint3(c.source,use.piece,use.edge,'3/4'));assert.throws(()=>nurbsSectionComplexEdgePoint3(c,id,'3/4'),RangeError);
});
test('matching endpoints do not merge seam maps that differ by a sub-floating interior bulge',()=>{
  const epsilon=q(1n,10n**40n),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(boundarySurface([0n,epsilon.div(q(2n)),0n]),P));audit(c);assert.equal(c.vertices.length,2);assert.equal(c.edges.length,2);assert.equal(c.components.length,1);assert.ok(c.edges.every(e=>e.uses.length===1));assert.equal(c.seams[0]!.kind,'points');assert.equal(c.seams[0]!.points.length,2);assert.notEqual(compareAlgebraicPoints3(nurbsSectionComplexEdgePoint3(c,0,'1/2'),nurbsSectionComplexEdgePoint3(c,1,'1/2')),0);
});
test('different homogeneous seam representations merge when their projected parameter functions agree',()=>{
  const ys=[[0n,'1/2',1n],[0n,'1/2',1n],[0n,'1/3',1n],[0n,'1/3',1n]],xs=[-1n,0n,0n,1n],zs=[-1n,0n,0n,1n],weights=[[1n,1n,1n],[1n,1n,1n],[1n,'3/2',2n],[1n,'3/2',2n]],s=nurbsSurface3(1,2,ys.map((row,i)=>row.map(y=>point3(xs[i]!,y,zs[i]!))),jump,[0n,0n,0n,1n,1n,1n],weights),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(s,P));audit(c);assert.equal(c.vertices.length,2);assert.equal(c.edges.length,1);assert.equal(c.edges[0]!.uses.length,2);assert.equal(c.seams[0]!.kind,'interval');
});
test('isolated matching parameters introduce genuine seam junctions while tiny constant gaps remain separate',()=>{
  const epsilon=q(1n,10n**40n),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(boundarySurface([epsilon.div(q(-2n)),epsilon.div(q(2n))]),P));audit(c);assert.equal(c.vertices.length,5);assert.equal(c.edges.length,4);assert.equal(c.components.length,1);const middle=c.vertices.find(v=>v.v.compare(AlgebraicReal.fromRational('1/2'))===0)!;assert.ok(middle);assert.equal(c.edges.filter(e=>c.vertices[e.from]===middle||c.vertices[e.to]===middle).length,4);assert.ok(middle.uses.every(u=>u.vertex===null));
  const gap=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(boundarySurface([epsilon,epsilon]),P));audit(gap);assert.equal(gap.components.length,2);assert.equal(gap.vertices.length,4);assert.equal(gap.edges.length,2);assert.equal(gap.seams[0]!.kind,'none');
  const algebraic=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(boundarySurface(['-1/2','-1/2','1/2']),P));audit(algebraic);assert.equal(algebraic.components.length,1);assert.equal(algebraic.vertices.length,5);assert.equal(algebraic.edges.length,4);assert.equal(algebraic.seams[0]!.points.length,1);assert.equal(algebraic.seams[0]!.points[0]!.mul(algebraic.seams[0]!.points[0]!).compare(AlgebraicReal.fromRational('1/2')),0);
});
test('boundary-map equality outside the section plane creates no false seam contact',()=>{
  const z=['-1/2','1/2'],ys=[0n,1n],xs=[[-1n,-1n],[0n,0n],['-1/4','3/4'],[1n,1n]],s=nurbsSurface3(1,1,xs.map(row=>ys.map((y,j)=>point3(row[j]!,y,z[j]!))),jump,K),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(s,P));audit(c);assert.equal(c.components.length,2);assert.equal(c.seams[0]!.kind,'none');
});
test('contained patches attach to curve pieces and to one another along intervals or isolated seam points',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,'-1/2'),point3(1n,1n,'1/2')]],[0n,0n,'1/2',1n,1n],K),c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(s,P));audit(c);assert.equal(c.source.containedPatches.length,1);assert.equal(c.components.length,1);assert.equal(c.edges.filter(e=>e.areas.length===1).length,2);assert.equal(c.vertices.filter(v=>v.areas.length===1).length,3);
  const points=[[point3(-1n,0n,0n),point3(-1n,1n,0n)],[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('-1/2',0n,0n),point3('1/2',1n,0n)],[point3(1n,0n,0n),point3(1n,1n,0n)]],area=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(nurbsSurface3(1,1,points,jump,K),P));audit(area);assert.equal(area.source.containedPatches.length,2);assert.equal(area.vertices.length,0);assert.equal(area.components.length,1);assert.equal(area.seams[0]!.kind,'points');assert.equal(area.seams[0]!.points.length,1);
});
test('area-only continuity and corner-only contacts are explicit without fabricating curve edges',()=>{
  let planar=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,0n)]],K,K);planar=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(planar,'u','1/2'),'v','1/2');const c=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(planar,P));audit(c);assert.equal(c.source.containedPatches.length,4);assert.equal(c.components.length,1);assert.equal(c.edges.length,0);
  const coords=[0n,'1/2','1/2',1n];for(const shifted of [false,true]){const points=coords.map((x,i)=>coords.map((y,j)=>{const same=(i<2)===(j<2),X=shifted&&i>=2&&j>=2?Rational.parse(String(x)).add(q(1n,10n**40n)):x;return point3(X,y,same?0n:1n);})),section=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(nurbsSurface3(1,1,points,jump,jump),P));audit(section);assert.equal(section.source.containedPatches.length,2);assert.equal(section.components.length,shifted?2:1);assert.equal(section.areaCornerLinks.length,shifted?0:1);}
});
test('distinct-parameter spatial overlap is retained as separate parameter components and ownership is enforced',()=>{
  const rows=[0n,1n,0n,1n].map(x=>[point3(x,0n,'-1/2'),point3(x,1n,'1/2')]),source=intersectNurbsSurfacePlane3(nurbsSurface3(1,1,rows,jump,K),P),c=sewNurbsPlaneSection3(source);audit(c);assert.equal(c.components.length,2);assert.equal(c.edges.length,2);assert.throws(()=>sewNurbsPlaneSection3({...source}),RangeError);assert.throws(()=>nurbsSectionComplexEdgePoint3({...c},0,'1/4'),RangeError);assert.throws(()=>nurbsSectionComplexEdgePoint3(c,-1,0n),RangeError);assert.throws(()=>nurbsSectionComplexEdgePoint3(c,0,2n),RangeError);
  const empty=sewNurbsPlaneSection3(intersectNurbsSurfacePlane3(nurbsSurface3(1,1,rows,jump,K),plane3(0n,0n,1n,-2n)));audit(empty);assert.equal(empty.components.length,0);
});
