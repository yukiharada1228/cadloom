import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point2,segment2,circle2,fullCircleArc2,booleanCurveRegions2,point3,vector3,planeFrame3,mapPlanePoint3,prepareRectangleFace3,preparePlanarFace3,prepareCircularFace3,translatePlanarFace3,translateCurve3,curveEndpoints3,pointOnCurve3,circle3,circularArc3,fullCircleArc3,interiorPointOnArc3,algebraicCoordinates2,algebraicCoordinates3,algebraicPoint3,algebraicSegment3,line3,lineInterval3,planarArc3,extrudeCurveRegionBRep3,extrudePolygon,prepareSolid3,normalToSurface3} from '../dist/index.js';
import type {Curve3,CurveRegion2,CurveBoundary2,PolygonRegion,Point2,AlgebraicCoordinates3,ExtrudedBRep3} from '../dist/index.js';
const xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n)),Z=vector3(0n,0n,1n),q=(v:bigint|string)=>AlgebraicReal.fromRational(v),sqrt=(n:bigint)=>isolateRealRoots(new Polynomial([-n,0n,1n]))[1]!;
const boxPoints=(x:bigint,y:bigint,w:bigint,h=w)=>[point2(x,y),point2(x+w,y),point2(x+w,y+h),point2(x,y+h)];
const polygon=(region:PolygonRegion):CurveRegion2=>region.map(r=>r.map((p,i)=>({kind:'segment',segment:segment2(p,r[(i+1)%r.length]!)})));
const disk=(x:bigint|string,y:bigint|string,r:bigint|string,cw=false):CurveRegion2=>[[{kind:'arc',arc:fullCircleArc2(circle2(point2(x,y),r),cw?'cw':'ccw')}]];
function midpoint(curve:Curve3):AlgebraicCoordinates3 {
 if(curve.kind==='line')return algebraicPoint3(curve.interval.line.origin,curve.interval.line.direction,curve.interval.startParameter.add(curve.interval.endParameter).affine('1/2'));
 if(curve.kind==='algebraic-segment'){const a=curve.segment.start,b=curve.segment.end;return algebraicCoordinates3(a.x.add(b.x).affine('1/2'),a.y.add(b.y).affine('1/2'),a.z.add(b.z).affine('1/2'));}
 if(curve.kind==='circular-arc')return interiorPointOnArc3(curve.arc);
 const a=curve.arc.arc,c=a.circle,local=circularArc3(circle3(point3(c.center.x,c.center.y,0n),Z,c.radiusSquared),algebraicCoordinates3(a.start.x,a.start.y,0n),algebraicCoordinates3(a.end.x,a.end.y,0n),{direction:a.direction,fullCircle:a.fullCircle}),p=interiorPointOnArc3(local);
 return mapPlanePoint3(curve.arc.frame,algebraicCoordinates2(p.x,p.y));
}
function verify(solid:ExtrudedBRep3,edges=true):ExtrudedBRep3 {
 const t=solid.topology;assert.equal(t.closedOrientedIncidence,true);assert.deepEqual(t.issues,[]);assert.equal(t.shells.length,solid.profiles.length);assert.equal(t.faces.length,solid.faces.length);assert.equal(solid.samples.length,solid.profiles.length);assert.ok(t.vertexLinks.every(l=>l.closed));
 solid.samples.forEach(p=>assert.equal(solid.locate(p),'inside'));solid.faces.forEach(({face},i)=>{assert.equal(solid.locate(face.sample),'boundary');assert.equal(t.faces[i]!.sense,face.sense);assert.equal(face.locate(face.sample),'inside');});
 if(edges)t.edges.forEach(e=>{
  assert.equal(e.coedges.length,2);const a=t.coedges[e.coedges[0]!]!,b=t.coedges[e.coedges[1]!]!;assert.equal(a.direction,-b.direction);assert.equal(a.twin,e.coedges[1]);
  for(const p of [...curveEndpoints3(e.curve),midpoint(e.curve)]){assert.equal(pointOnCurve3(p,e.curve),true);assert.equal(solid.locate(p),'boundary');assert.equal(solid.faces[a.face]!.face.locate(p),'boundary');assert.equal(solid.faces[b.face]!.face.locate(p),'boundary');}
 });
 assert.ok(Object.isFrozen(solid)&&Object.isFrozen(solid.profiles)&&Object.isFrozen(solid.faces)&&Object.isFrozen(solid.samples)&&solid.faces.every(Object.isFrozen));return solid;
}
test('algebraic rectangle face domains support exact bounds, orientation and partial inverse location',()=>{
 const frame=planeFrame3(point3(2n,3n,4n),vector3(1n,2n,0n),Z),a=sqrt(2n),b=sqrt(3n);
 for(const sense of [1,-1] as const){
  const face=prepareRectangleFace3(frame,a,b,-2n,1n,sense),p=mapPlanePoint3(frame,algebraicCoordinates2('3/2',0n));assert.equal(face.locate(p),'inside');assert.equal(face.locate(face.sample),'inside');assert.equal(face.boundary[0]!.length,4);assert.equal(face.domain.kind,'rectangle');assert.equal(face.topology.manifoldVertices,true);
  assert.equal(face.locate(mapPlanePoint3(frame,algebraicCoordinates2(a,0n))),'boundary');assert.equal(face.locate(mapPlanePoint3(frame,point2(1n,0n))),'outside');assert.equal(face.locate(algebraicCoordinates3(p.x,p.y.affine(1n,'1/1000000000000000000000000000000'),p.z)),'outside');
 }
 const independent=prepareRectangleFace3(xy,a,b,sqrt(5n),sqrt(7n));assert.equal(independent.locate(independent.sample),'inside');
 assert.throws(()=>prepareRectangleFace3(xy,a,a,0n,1n),RangeError);assert.throws(()=>prepareRectangleFace3(xy,0n,1n,1n,0n),RangeError);
});
test('curve translations preserve all edge representations and factory-owned planar face certification',()=>{
 const v=vector3(2n,-3n,5n),root=AlgebraicReal.fromRational('1/2').sqrt(),curves:Curve3[]=[
  {kind:'line',interval:lineInterval3(line3(point3(0n,0n,0n),vector3(1n,2n,0n)),sqrt(2n),sqrt(3n))},
  {kind:'algebraic-segment',segment:algebraicSegment3(algebraicCoordinates3(root,root,0n),algebraicCoordinates3(root,root,1n))},
  {kind:'planar-arc',arc:planarArc3(xy,fullCircleArc2(circle2(point2(0n,0n),1n)))},
  {kind:'circular-arc',arc:fullCircleArc3(circle3(point3(0n,0n,0n),vector3(1n,1n,1n),1n))},
 ];
 for(const c of curves){const moved=translateCurve3(c,v),before=curveEndpoints3(c),after=curveEndpoints3(moved);for(let i=0;i<2;i++)for(const k of ['x','y','z'] as const)assert.equal(after[i]![k].compare(before[i]![k].affine(1n,v[k])),0);assert.equal(pointOnCurve3(midpoint(moved),moved),true);}
 const faces=[preparePlanarFace3(xy,polygon([boxPoints(0n,0n,2n)])),prepareRectangleFace3(xy,sqrt(2n),sqrt(3n),0n,1n),prepareCircularFace3(circle3(point3(0n,0n,0n),vector3(1n,1n,1n),4n),[circle3(point3(0n,0n,0n),vector3(1n,1n,1n),1n)])];
 for(const face of faces){const moved=translatePlanarFace3(face,v,-1);assert.equal(moved.locate(moved.sample),'inside');for(const k of ['x','y','z'] as const)assert.equal(moved.normal[k].compare(face.normal[k].neg()),0);assert.equal(moved.topology.manifoldVertices,true);const back=translatePlanarFace3(moved,vector3(v.x.neg(),v.y.neg(),v.z.neg()),face.sense);assert.equal(back.locate(face.sample),'inside');assert.equal(back.boundary.flat().length,face.boundary.flat().length);assert.throws(()=>translatePlanarFace3({...face},v),RangeError);}
});
test('a rectangular profile produces a closed analytic box BRep',()=>{
 const solid=verify(extrudeCurveRegionBRep3(polygon([boxPoints(0n,0n,2n)]),3n));assert.equal(solid.topology.vertices.length,8);assert.equal(solid.topology.edges.length,12);assert.equal(solid.faces.length,6);assert.ok(solid.faces.every(f=>f.kind==='planar'));
 assert.equal(solid.locate(point3(1n,1n,1n)),'inside');assert.equal(solid.locate(point3(0n,1n,1n)),'boundary');assert.equal(solid.locate(point3(1n,1n,0n)),'boundary');assert.equal(solid.locate(point3(1n,1n,4n)),'outside');
});
test('circular annuli retain exact cylindrical walls and through-hole material semantics',()=>{
 const input=[...disk(0n,0n,4n),...disk(0n,0n,1n,true)],solid=verify(extrudeCurveRegionBRep3(input,2n,{fillRule:'nonzero'}));assert.equal(solid.profiles.length,1);assert.equal(solid.profiles[0]!.boundary.length,2);assert.equal(solid.faces.filter(f=>f.kind==='cylindrical').length,4);
 assert.equal(solid.locate(point3(0n,0n,1n)),'outside');assert.equal(solid.locate(point3('3/2',0n,1n)),'inside');assert.equal(solid.locate(point3(1n,0n,1n)),'boundary');assert.equal(solid.locate(point3(2n,0n,1n)),'boundary');assert.equal(solid.locate(point3('5/2',0n,1n)),'outside');
 const senses=new Set(solid.faces.filter(f=>f.kind==='cylindrical').map(f=>f.face.sense));assert.deepEqual([...senses].sort(),[-1,1]);
});
test('mixed clipped-circle profiles weld algebraic trims across caps, planar walls and cylinders',()=>{
 const clip=polygon([[point2('1/2',-2n),point2(2n,-2n),point2(2n,2n),point2('1/2',2n)]]),region=booleanCurveRegions2(disk(0n,0n,1n),clip,'intersection'),solid=verify(extrudeCurveRegionBRep3(region.rings,2n));
 assert.equal(solid.faces.length,5);assert.equal(solid.faces.filter(f=>f.kind==='cylindrical').length,2);assert.ok(solid.topology.vertices.some(p=>p.y.rational===null));assert.ok(solid.faces.some(f=>f.kind==='planar'&&f.face.domain.kind==='rectangle'&&f.face.domain.uMin.rational===null));
 for(let x=-2n;x<=6n;x++)for(let y=-5n;y<=5n;y++)for(const z of [-1n,0n,1n,2n,3n]){
  const norm=x*x+y*y,p=point3(new Rational(x,4n),new Rational(y,4n),z),expected=x<2n||norm>16n||z<0n||z>2n?'outside':x===2n||norm===16n||z===0n||z===2n?'boundary':'inside';assert.equal(solid.locate(p),expected);
 }
});
test('disconnected material, holes and nested islands become separate embedded shells',()=>{
 const input=[...disk(0n,0n,9n),...disk(0n,0n,4n,true),...disk(0n,0n,1n),...disk(6n,0n,1n)],solid=verify(extrudeCurveRegionBRep3(input,2n,{fillRule:'nonzero'}));assert.equal(solid.profiles.length,3);assert.equal(solid.topology.shells.length,3);assert.deepEqual(solid.profiles.map(p=>p.boundary.length).sort(),[1,1,2]);
 for(const [x,expected] of [[0n,'inside'],['3/2','outside'],['5/2','inside'],[4n,'outside'],[6n,'inside']] as const)assert.equal(solid.locate(point3(x,0n,1n)),expected);
});
test('straight BRep prisms agree with independently certified triangular solid location',()=>{
 const L=[point2(0n,0n),point2(3n,0n),point2(3n,1n),point2(1n,1n),point2(1n,3n),point2(0n,3n)],cases:PolygonRegion[]=[[L],[boxPoints(-3n,-3n,6n),boxPoints(-1n,-1n,2n)],[boxPoints(-4n,-1n,2n),boxPoints(2n,-1n,2n)]];
 for(const input of cases){
  const oldMesh=extrudePolygon(input,'-3/2',{baseZ:'2/3'}),triangles=oldMesh.triangles.map(t=>[oldMesh.vertices[t[0]]!,oldMesh.vertices[t[1]]!,oldMesh.vertices[t[2]]!] as const),old=prepareSolid3(triangles),solid=verify(extrudeCurveRegionBRep3(polygon(input),'-3/2',{baseZ:'2/3'}),false);
  assert.equal(solid.zMin.compare(Rational.parse('-5/6')),0);assert.equal(solid.zMax.compare(Rational.parse('2/3')),0);
  for(let x=-5n;x<=5n;x++)for(let y=-4n;y<=4n;y++)for(const z of ['-1','-5/6','0','2/3','1']){const p=point3(x,y,z);assert.equal(solid.locate(p),old.locate(p));}
 }
});
test('constructed face normals point outward from the product material, including cavity walls',()=>{
 for(const input of [polygon([boxPoints(0n,0n,2n)]),[...disk(0n,0n,4n),...disk(0n,0n,1n,true)]]){
  const solid=verify(extrudeCurveRegionBRep3(input,2n,{fillRule:'nonzero'}),false),epsilon=Rational.parse('1/100');
  for(const f of solid.faces){const p=f.face.sample,n=f.kind==='planar'?algebraicCoordinates3(f.face.normal.x,f.face.normal.y,f.face.normal.z):f.face.normalAt(p),perturb=(sign:bigint)=>algebraicCoordinates3(p.x.add(n.x.affine(epsilon.mul(new Rational(sign)))),p.y.add(n.y.affine(epsilon.mul(new Rational(sign)))),p.z.add(n.z.affine(epsilon.mul(new Rational(sign)))));assert.equal(solid.locate(perturb(1n)),'outside');assert.equal(solid.locate(perturb(-1n)),'inside');}
 }
});
test('fill normalization removes canceled geometry while pinched boundaries are rejected',()=>{
 const d=disk(0n,0n,1n);assert.equal(verify(extrudeCurveRegionBRep3([...d,...d],1n)).profiles.length,0);assert.equal(verify(extrudeCurveRegionBRep3([...d,...d],1n,{fillRule:'nonzero'})).profiles.length,1);assert.equal(verify(extrudeCurveRegionBRep3([...d,...disk(0n,0n,1n,true)],1n,{fillRule:'nonzero'})).profiles.length,0);
 assert.throws(()=>extrudeCurveRegionBRep3([...d,...disk(2n,0n,1n)],1n,{fillRule:'nonzero'}),RangeError);
 assert.throws(()=>extrudeCurveRegionBRep3([...disk(0n,0n,4n),...disk(1n,0n,1n,true)],1n,{fillRule:'nonzero'}),RangeError);
 const bow=polygon([[point2(0n,0n),point2(2n,2n),point2(0n,2n),point2(2n,0n)]]);assert.throws(()=>extrudeCurveRegionBRep3(bow,1n),RangeError);
});
test('empty products, exact algebraic queries, thin material and tiny heights have exact semantics',()=>{
 const empty=verify(extrudeCurveRegionBRep3([],1n));assert.equal(empty.faces.length,0);assert.equal(empty.samples.length,0);assert.equal(empty.locate(point3(0n,0n,0n)),'outside');assert.throws(()=>extrudeCurveRegionBRep3([],0n),RangeError);
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),r=new Rational(1n).sub(epsilon),thin=verify(extrudeCurveRegionBRep3([...disk(0n,0n,1n),...disk(0n,0n,r.mul(r).toString(),true)],epsilon,{fillRule:'nonzero'}),false);
 assert.equal(thin.locate(point3(new Rational(1n).sub(epsilon.div(new Rational(2n))),0n,epsilon.div(new Rational(2n)))),'inside');assert.equal(thin.locate(point3(0n,0n,epsilon.div(new Rational(2n)))),'outside');
 const solid=extrudeCurveRegionBRep3(disk(0n,0n,1n),2n),h=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(solid.locate(algebraicCoordinates3(h,h,sqrt(2n))),'boundary');assert.equal(solid.locate(algebraicCoordinates3(h,0n,sqrt(2n))),'inside');
});
test('input snapshots and all published face/edge collections remain immutable',()=>{
 const points=boxPoints(0n,0n,2n),input=polygon([points]).map(r=>[...r]),solid=verify(extrudeCurveRegionBRep3(input,1n));input[0]!.length=0;points.length=0;assert.equal(solid.locate(point3(1n,1n,'1/2')),'inside');assert.ok(Object.isFrozen(solid.topology)&&solid.topology.edges.every(Object.isFrozen));
});

test('overlapping fill components are regularized before material-face partitioning',()=>{
 const a=disk(0n,0n,1n),b=disk(1n,0n,1n),solid=verify(extrudeCurveRegionBRep3([...a,...b],1n,{fillRule:'nonzero'}));assert.equal(solid.profiles.length,1);
 // This point is on a discarded input circle but in the regularized union interior.
 assert.equal(solid.locate(point3(1n,0n,'1/2')),'inside');assert.equal(solid.locate(point3('-1/2',0n,'1/2')),'inside');assert.equal(solid.locate(point3('3/2',0n,'1/2')),'inside');
 const clockwise=verify(extrudeCurveRegionBRep3(disk(0n,0n,1n,true),1n,{fillRule:'nonzero'}));assert.ok(clockwise.faces.filter(f=>f.kind==='cylindrical').every(f=>f.face.sense===1));assert.equal(clockwise.locate(point3(0n,0n,'1/2')),'inside');
 assert.throws(()=>extrudeCurveRegionBRep3([...a,...b],1n),RangeError);
});
