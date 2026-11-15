import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point2,point3,vector3,plane3,line3,cylinder3,circle3,circularArc3,ellipse3,planeFrame3,preparePlanarFace3,prepareRectangleFace3,prepareCircularFace3,prepareEllipseFace3,prepareCylinderFace3,prepareTrimmedPlanar3,prepareTrimmedCylinder3,translatePlanarFace3,encodePlanarDomain3,encodeCylinderDomain3,encodeTrimmedPlanarDomain3,encodeTrimmedCylinderDomain3,decodeFaceDomain3,readFaceDomainRecord3,bodyRecordFromTopology3,readBodyRecord3,buildBRepTopology3,restoreNativeBRepBoundary3,restoreNativeBRepFaces3,createBoxBody3,extrudeBody3,bodyDocument3,restoreBody3,locateBody3,encodeExactPoint3,decodeExactPoint3,algebraicCoordinates3,fullCircleArc2,circle2} from '../dist/index.js';
import type {FaceDomainRecord3,BodyRecord3,CurveRegion2,Body3} from '../dist/index.js';
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n));
const polygon=(xy:readonly (readonly [bigint,bigint])[]):CurveRegion2=>{const p=xy.map(([x,y])=>point2(x,y));return [p.map((start,i)=>({kind:'segment',segment:{start,end:p[(i+1)%p.length]!}}))];};
const box=()=>createBoxBody3(point3(0n,0n,0n),2n,3n,4n);
function faceRecord(domain:FaceDomainRecord3):BodyRecord3 {
  const f=decodeFaceDomain3(domain),edges=f.boundary.flat(),loops:number[][]=[];let next=0;for(const ring of f.boundary)loops.push(ring.map(()=>next++));
  const topology=buildBRepTopology3(edges,[{surface:f.surface,sense:f.sense,loops:loops.map(r=>r.map(edge=>({edge,direction:1})))}]),r=bodyRecordFromTopology3(topology,[{shells:[0],void:false}]);return readBodyRecord3({...r,faces:r.faces.map(f=>({...f,domain}))});
}
test('common Bodies carry complete bounded analytic domain records and reconstructed face queries',()=>{
  const b=box(),r=restoreNativeBRepFaces3(clone(b.record));assert.equal(r.faces.length,6);assert.ok(b.record.faces.every(f=>f.domain));assert.equal(b.faces.length,6);for(let i=0;i<r.faces.length;i++){const f=r.faces[i]!;assert.equal(f.locate(f.sample),'inside');assert.equal(b.faces[i]!.locate(f.sample),'inside');}assert.throws(()=>locateBody3(r as unknown as Body3,point3(1n,1n,1n)),/factory/);
});
test('chart domains with holes and reversed sense survive affine chart serialization',()=>{
  const frame=planeFrame3(point3(3n,-2n,7n),vector3(2n,0n,0n),vector3(1n,3n,0n)),outer=polygon([[0n,0n],[4n,0n],[4n,4n],[0n,4n]]),hole=polygon([[1n,1n],[1n,2n],[2n,2n],[2n,1n]]),base=preparePlanarFace3(frame,[...outer,...hole]);
  for(const sense of [1,-1] as const){const f=translatePlanarFace3(base,vector3(0n,0n,0n),sense),record=encodePlanarDomain3(f),d=decodeFaceDomain3(clone(record));restoreNativeBRepFaces3(faceRecord(record));for(let i=-1n;i<=5n;i++)for(let j=-1n;j<=5n;j++){const p=point3(3n+2n*i+j,-2n+3n*j,7n);assert.equal(d.locate(p),f.locate(p));}assert.equal(d.sense,sense);}
});
test('algebraic rectangle bounds and nonprincipal ellipse axes remain exact',()=>{
  const a=AlgebraicReal.fromRational('1/2').sqrt(),b=AlgebraicReal.fromRational(2n).sqrt(),rectangle=prepareRectangleFace3(xy,a,2n,-1n,b,-1),rr=encodePlanarDomain3(rectangle),d=decodeFaceDomain3(clone(rr));assert.equal(d.locate(algebraicCoordinates3(a,0n,0n)),'boundary');assert.equal(d.locate(point3(1n,0n,0n)),'inside');restoreNativeBRepFaces3(faceRecord(rr));
  const e=prepareEllipseFace3(ellipse3(planeFrame3(point3(1n,2n,3n),vector3(2n,0n,0n),vector3(1n,1n,0n)),2n,3n),-1),er=encodePlanarDomain3(e),copy=decodeFaceDomain3(clone(er));restoreNativeBRepFaces3(faceRecord(er));for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){const p=point3(BigInt(1+2*i+j),BigInt(2+j),3n),v=i*i/2+j*j/3;assert.equal(copy.locate(p),v>1?'outside':v===1?'boundary':'inside');}
});
test('arbitrary-normal annular disks retain circular holes and physical sense',()=>{
  const outer=circle3(point3(0n,0n,0n),vector3(1n,2n,2n),4n),hole=circle3(point3(0n,0n,0n),vector3(-1n,-2n,-2n),1n),f=prepareCircularFace3(outer,[hole],-1),r=encodePlanarDomain3(f),d=decodeFaceDomain3(clone(r));assert.equal(d.locate(point3(0n,0n,0n)),'outside');assert.equal(d.locate(point3(1n,0n,'-1/2')),'inside');assert.equal(d.locate(f.boundary[0]![0]!.kind==='circular-arc'?f.boundary[0]![0]!.arc.start:f.sample),'boundary');restoreNativeBRepFaces3(faceRecord(r));
});
test('full and angular cylinder product domains restore true bounded surfaces',()=>{
  const c=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,2n)),2n),angular=circularArc3(circle3(point3(0n,0n,0n),vector3(0n,0n,1n),2n),point3(1n,1n,0n),point3(-1n,1n,0n)),a=AlgebraicReal.fromRational(2n).sqrt();
  for(const f of [prepareCylinderFace3(c,'-1/2',1n,{sense:-1}),prepareCylinderFace3(c,'-1/2',1n,{angular,sense:-1})]){const r=encodeCylinderDomain3(f),d=decodeFaceDomain3(clone(r));assert.equal(d.locate(algebraicCoordinates3(0n,a,0n)),'inside');assert.equal(d.locate(algebraicCoordinates3(0n,a,3n)),'outside');restoreNativeBRepFaces3(faceRecord(r));}
});
test('trimmed plane domains recompute components from a strict interior witness',()=>{
  const f=prepareTrimmedPlanar3(prepareRectangleFace3(xy,0n,3n,0n,2n),[{plane:plane3(1n,1n,0n,-2n),side:-1}]),r=encodeTrimmedPlanarDomain3(f,0),d=decodeFaceDomain3(clone(r));assert.equal(d.locate(point3('1/2','1/2',0n)),'inside');assert.equal(d.locate(point3(2n,1n,0n)),'outside');assert.equal(d.locate(point3(1n,1n,0n)),'boundary');restoreNativeBRepFaces3(faceRecord(r));const bad=clone(r) as any;bad.sample=encodeExactPoint3(algebraicCoordinates3(1n,1n,0n));assert.throws(()=>decodeFaceDomain3(bad),/strict interior/);
});
test('disconnected trimmed cylinder components are selected by membership rather than cached component IDs',()=>{
  const base=prepareCylinderFace3(cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),-1n,1n),f=prepareTrimmedCylinder3(base,[{plane:plane3(1n,0n,0n,'-1/2'),side:-1},{plane:plane3(-1n,0n,0n,'-1/2'),side:-1}]);assert.equal(f.components.length,2);
  for(let i=0;i<2;i++){const r=encodeTrimmedCylinderDomain3(f,i),raw=clone(r) as any;raw.halfspaces.reverse();const d=decodeFaceDomain3(raw);assert.equal(d.locate(f.components[i]!.sample),'inside');assert.equal(d.locate(f.components[1-i]!.sample),'outside');restoreNativeBRepFaces3(faceRecord(r));}
});
test('missing domains, shifted bounds, missing holes and wrong normal senses are rejected',()=>{
  const b=box(),missing=clone(b.record) as any;delete missing.faces[0].domain;assert.ok(restoreNativeBRepBoundary3(missing));assert.throws(()=>restoreNativeBRepFaces3(missing),/no bounded domain/);const index=b.record.faces.findIndex(f=>f.domain?.kind==='rectangle');
  for(const mutate of [(r:any)=>r.faces[index].domain.uMax={kind:'rational',value:'100'},(r:any)=>r.faces[index].domain.sense*=-1]){const r=clone(b.record);mutate(r);assert.ok(readBodyRecord3(r));assert.throws(()=>restoreNativeBRepFaces3(r),/domain|orientation/);}
  const plate=extrudeBody3([...polygon([[-3n,-3n],[3n,-3n],[3n,3n],[-3n,3n]]),[{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n),'cw')}]],2n,{fillRule:'nonzero'}),raw=clone(plate.record) as any,cap=raw.faces.find((f:any)=>f.domain?.kind==='chart'&&f.domain.rings.length===2);cap.domain.rings.pop();assert.throws(()=>restoreNativeBRepFaces3(raw),/boundary/);
});
test('complementary cylinder arcs with identical endpoints do not pass full boundary matching',()=>{
  const c=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),arc=circularArc3(circle3(point3(0n,0n,0n),vector3(0n,0n,1n),1n),point3(1n,0n,0n),point3(0n,1n,0n)),r=clone(faceRecord(encodeCylinderDomain3(prepareCylinderFace3(c,0n,1n,{angular:arc})))) as any;r.faces[0].domain.angular.direction='cw';assert.ok(decodeFaceDomain3(r.faces[0].domain));assert.throws(()=>restoreNativeBRepFaces3(r),/boundary/);
});
test('extra backtracking loops cannot self-pair and masquerade as a matching face boundary',()=>{
  const r=clone(box().record) as any,n=r.vertices.length,e=r.edges.length,l=r.loops.length,c=r.curves.length,A=encodeExactPoint3(algebraicCoordinates3('1/2','1/2',0n)),B=encodeExactPoint3(algebraicCoordinates3('3/4','1/2',0n));r.vertices.push(A,B);r.curves.push({kind:'segment',start:A,end:B});r.edges.push({curve:c,start:n,end:n+1});r.loops.push({uses:[{edge:e,direction:1},{edge:e,direction:-1}]});r.faces[0].loops.push(l);assert.ok(readBodyRecord3(r));assert.equal(restoreNativeBRepBoundary3(r).topology.closedOrientedIncidence,true);assert.throws(()=>restoreNativeBRepFaces3(r),/pair one domain use/);
});
test('equivalent scaled support normals preserve physical orientation while unvalidated pcurves are refused',()=>{
  const r=clone(box().record) as any,f=r.faces[0],s=r.surfaces[f.surface];s.normal=s.normal.map((x:string)=>Rational.parse(x).mul(new Rational(-2n)).toString());s.offset=Rational.parse(s.offset).mul(new Rational(-2n)).toString();f.sense*=-1;assert.equal(restoreNativeBRepFaces3(r).faces.length,6);
  const metadata=clone(box().record) as any;metadata.faces[0].parameterBounds=Array.from({length:4},()=>({kind:'rational',value:'0'}));assert.ok(readBodyRecord3(metadata));assert.throws(()=>restoreNativeBRepFaces3(metadata),/correspondence/);
});
test('legacy construction documents regenerate absent domains and supplied invalid domains are not ignored',()=>{
  const b=box(),old=clone(bodyDocument3(b)) as any;old.body.faces.forEach((f:any)=>delete f.domain);const restored=restoreBody3(old);assert.ok(restored.record.faces.every(f=>f.domain));assert.equal(locateBody3(restored,point3(1n,1n,1n)),'inside');const bad=clone(bodyDocument3(b)) as any;bad.body.faces[0].domain.sense*=-1;assert.throws(()=>restoreBody3(bad),/does not match/);
});
test('domain readers remain structural and invalid geometric definitions fail during reconstruction',()=>{
  const r=clone(encodePlanarDomain3(prepareCircularFace3(circle3(point3(0n,0n,0n),vector3(0n,0n,1n),1n)))) as any;r.outer.radiusSquared='0';assert.ok(readFaceDomainRecord3(r));assert.throws(()=>decodeFaceDomain3(r),/positive area/);r.extra=true;assert.throws(()=>readFaceDomainRecord3(r),/unknown/);
});
test('different valid edge subdivisions bind to the same complete oriented face boundaries',()=>{
  const r=clone(box().record) as any,first=r.edges[0],oldEnd=first.end,vertex=r.vertices.length,edge=r.edges.length,curve=r.curves.length,A=decodeExactPoint3(r.vertices[first.start]),B=decodeExactPoint3(r.vertices[first.end]),mid=encodeExactPoint3(algebraicCoordinates3(A.x.add(B.x).affine('1/2'),A.y.add(B.y).affine('1/2'),A.z.add(B.z).affine('1/2')));
  // Split one actual geometric edge and both of its incident uses consistently.
  r.vertices.push(mid);r.curves[first.curve]={kind:'segment',start:r.vertices[first.start],end:mid};first.end=vertex;r.curves.push({kind:'segment',start:mid,end:r.vertices[oldEnd]});r.edges.push({curve,start:vertex,end:oldEnd});
  for(const l of r.loops)l.uses=l.uses.flatMap((u:any)=>u.edge!==0?[u]:u.direction===1?[{edge:0,direction:1},{edge,direction:1}]:[{edge,direction:-1},{edge:0,direction:-1}]);
  const bound=restoreNativeBRepFaces3(r);assert.equal(bound.faces.length,6);assert.equal(bound.boundary.topology.edges.length,13);assert.ok(bound.faces.every(f=>f.locate(f.sample)==='inside'));
});
