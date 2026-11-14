import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point2,segment2,circle2,fullCircleArc2,reverseCircularArc2,lineInterval2,point3,vector3,circle3,preparePlanarFace3,prepareCircularFace3,planeFrame3,mapPlanePoint3,algebraicCoordinates3,curveOnSurface3,pointOnCurve3,curveEndpoints3,preparePolygon,booleanCurveRegions2} from '../dist/index.js';
import type {CurveBoundary2,CurveRegion2,PreparedPlanarFace3,Point2,PolygonRegion} from '../dist/index.js';
const xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n));
const polygon=(points:readonly Point2[]):CurveRegion2=>[points.map((p,i)=>({kind:'segment',segment:segment2(p,points[(i+1)%points.length]!)}))];
const box=(lo:bigint,hi:bigint)=>polygon([point2(lo,lo),point2(hi,lo),point2(hi,hi),point2(lo,hi)]);
const disk=(x:bigint|string,y:bigint|string,r:bigint|string,cw=false):CurveRegion2=>[[{kind:'arc',arc:fullCircleArc2(circle2(point2(x,y),r),cw?'cw':'ccw')}]];
function reversed(region:CurveRegion2):CurveRegion2{return region.map(r=>r.slice().reverse().map((c):CurveBoundary2=>c.kind==='arc'?{kind:'arc',arc:reverseCircularArc2(c.arc)}:c.kind==='line'?{kind:'line',interval:lineInterval2(c.interval.line,c.interval.endParameter,c.interval.startParameter)}:{kind:'segment',segment:segment2(c.segment.end,c.segment.start)}));}
function verify(face:PreparedPlanarFace3):PreparedPlanarFace3 {
 assert.equal(face.locate(face.sample),'inside');assert.equal(face.topology.faces.length,1);assert.equal(face.topology.shells.length,1);assert.equal(face.topology.manifoldVertices,true);assert.equal(face.topology.consistentlyOriented,true);assert.equal(face.topology.closed,false);
 assert.equal(face.topology.boundaryLoops!.length,face.boundary.length);assert.equal(face.topology.edges.length,face.boundary.flat().length);
 for(const ring of face.boundary){assert.ok(Object.isFrozen(ring));for(const c of ring){assert.ok(Object.isFrozen(c));assert.equal(curveOnSurface3(c,{kind:'plane',plane:face.surface}),true);}}
 for(const p of face.topology.vertices){assert.equal(face.locate(p),'boundary');assert.ok(face.boundary.some(r=>r.some(c=>pointOnCurve3(p,c))));}
 for(const k of ['x','y','z'] as const)assert.equal(face.normal[k].compare(face.surface.normal[k].mul(new Rational(BigInt(face.sense)))),0);
 assert.ok(Object.isFrozen(face)&&Object.isFrozen(face.domain)&&Object.isFrozen(face.boundary)&&Object.isFrozen(face.surface)&&Object.isFrozen(face.sample));return face;
}
test('skew chart planar faces preserve geometry, holes, oriented normals and off-plane exclusion',()=>{
 const frame=planeFrame3(point3(2n,-1n,4n),vector3(1n,-1n,0n),vector3(1n,1n,-2n)),region=[...disk(0n,0n,4n),...disk(0n,0n,1n,true)];
 for(const sense of [1,-1] as const){
  const face=verify(preparePlanarFace3(frame,sense===1?region:reversed(region),sense));assert.equal(face.boundary.length,2);assert.equal(face.domain.kind,'chart');
  assert.equal(face.locate(mapPlanePoint3(frame,point2('3/2',0n))),'inside');assert.equal(face.locate(mapPlanePoint3(frame,point2(0n,0n))),'outside');assert.equal(face.locate(mapPlanePoint3(frame,point2(2n,0n))),'boundary');
  const epsilon=Rational.parse('1/1'+'0'.repeat(30)),p=mapPlanePoint3(frame,point2('3/2',0n));assert.equal(face.locate(algebraicCoordinates3(p.x,p.y,p.z.affine(1n,epsilon))),'outside');
  const directions=face.boundary.flat().filter(c=>c.kind==='planar-arc').map(c=>c.kind==='planar-arc'?c.arc.arc.direction:'');assert.equal(directions.includes(sense===1?'ccw':'cw'),true);assert.equal(directions.includes(sense===1?'cw':'ccw'),true);
 }
});
test('nonconvex chart domains agree with independent polygon winding location after embedding',()=>{
 const points=[point2(0n,0n),point2(4n,0n),point2(4n,1n),point2(1n,1n),point2(1n,4n),point2(0n,4n)],region:PolygonRegion=[points],oracle=preparePolygon(region),frame=planeFrame3(point3(3n,2n,-1n),vector3(2n,1n,0n),vector3(1n,3n,2n)),face=verify(preparePlanarFace3(frame,polygon(points)));
 for(let x=-2n;x<=10n;x++)for(let y=-2n;y<=10n;y++){const p=point2(new Rational(x,2n),new Rational(y,2n));assert.equal(face.locate(mapPlanePoint3(frame,p)),oracle.locate(p));}
});
test('chart validation rejects wrong winding, overlapping/disconnected/touching or canceled boundaries',()=>{
 assert.throws(()=>preparePlanarFace3(xy,reversed(box(0n,2n))),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,box(0n,2n),-1),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[],1),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(-2n,0n,1n),...disk(2n,0n,1n)]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,1n),...disk(1n,0n,1n)]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,1n),...disk(2n,0n,1n)]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,4n),...disk(1n,0n,1n,true)]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,4n),...disk(0n,0n,1n)]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,4n),...disk(0n,0n,1n,true),...disk(0n,0n,'1/4')]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...disk(0n,0n,1n),...disk(0n,0n,1n,true)]),RangeError);
 const bow=polygon([point2(0n,0n),point2(2n,2n),point2(0n,2n),point2(2n,0n)]);assert.throws(()=>preparePlanarFace3(xy,bow),RangeError);
});
test('point primitives, retraced bridges and duplicated/internal source curves cannot hide in a valid region',()=>{
 const square=box(0n,2n),point:CurveBoundary2={kind:'segment',segment:segment2(point2(0n,0n),point2(0n,0n))};
 assert.throws(()=>preparePlanarFace3(xy,[...square,[point]]),RangeError);
 const bridge:CurveBoundary2[]=[{kind:'segment',segment:segment2(point2(0n,0n),point2(1n,1n))},{kind:'segment',segment:segment2(point2(1n,1n),point2(0n,0n))}];assert.throws(()=>preparePlanarFace3(xy,[...square,bridge]),RangeError);
 assert.throws(()=>preparePlanarFace3(xy,[...square,...square]),RangeError);
});
test('arbitrary-normal circular disk/annulus faces support irrational seams and exact algebraic queries',()=>{
 const n=vector3(1n,1n,1n),center=point3(2n,3n,4n),outer=circle3(center,n,4n),hole=circle3(center,vector3(-3n,-3n,-3n),1n),root=isolateRealRoots(new Polynomial(['-1/2',0n,1n]))[1]!;
 for(const sense of [1,-1] as const){
  const face=verify(prepareCircularFace3(outer,[hole],sense));assert.equal(face.domain.kind,'circular');assert.equal(face.boundary.length,2);
  assert.equal(face.locate(center),'outside');assert.equal(face.locate(point3(3n,2n,4n)),'inside');
  assert.equal(face.locate(algebraicCoordinates3(2n,root.affine(1n,3n),root.affine(-1n,4n))),'boundary');
  assert.equal(face.locate(point3(2n,3n,5n)),'outside');
  const directions=face.boundary.map(r=>r[0]!.kind==='circular-arc'?r[0]!.arc.direction:'');assert.deepEqual(directions,sense===1?['ccw','cw']:['cw','ccw']);
 }
});
test('multiple circular holes and chart domains agree with an independent raw integer distance oracle',()=>{
 const frame=planeFrame3(point3(3n,-2n,5n),vector3(1n,0n,0n),vector3(0n,1n,0n)),n=vector3(0n,0n,1n),outer=circle3(frame.origin,n,16n),holes=[circle3(point3(2n,-2n,5n),n,'1/4'),circle3(point3(4n,-2n,5n),vector3(0n,0n,-1n),'1/4')],region=[...disk(0n,0n,16n),...disk(-1n,0n,'1/4',true),...disk(1n,0n,'1/4',true)];
 for(const sense of [1,-1] as const){
  const face=verify(prepareCircularFace3(outer,holes,sense)),chart=verify(preparePlanarFace3(frame,sense===1?region:reversed(region),sense));
  for(let x=-10n;x<=10n;x++)for(let y=-10n;y<=10n;y++){
   const outerSign=x*x+y*y-64n,holeSigns=[(x-2n)**2n+y*y-1n,(x+2n)**2n+y*y-1n],expected=outerSign>0n||holeSigns.some(s=>s<0n)?'outside':outerSign===0n||holeSigns.some(s=>s===0n)?'boundary':'inside',p=point3(new Rational(x,2n).add(new Rational(3n)),new Rational(y,2n).sub(new Rational(2n)),5n);
   assert.equal(face.locate(p),expected);assert.equal(chart.locate(p),expected);
  }
 }
});
test('circular holes reject touching, nesting, overlap, degeneracy and off-plane geometry',()=>{
 const n=vector3(0n,0n,1n),outer=circle3(point3(0n,0n,0n),n,4n),h=(x:bigint|string,r:bigint|string=1n)=>circle3(point3(x,0n,0n),n,r);
 for(const holes of [[h(1n)],[h(3n)],[h(0n,9n)],[h(0n,0n)]])assert.throws(()=>prepareCircularFace3(outer,holes),RangeError);
 const big=circle3(point3(0n,0n,0n),n,16n);
 for(const holes of [[h(-1n),h(1n)],[h('-1/2'),h('1/2')],[h(0n),h(0n,'1/4')],[h(0n),h(0n)]])assert.throws(()=>prepareCircularFace3(big,holes),RangeError);
 assert.throws(()=>prepareCircularFace3(big,[circle3(point3(0n,0n,0n),vector3(1n,0n,0n),1n)]),RangeError);
 assert.throws(()=>prepareCircularFace3(big,[circle3(point3(0n,0n,'1/1000000000000000000000000000000'),n,1n)]),RangeError);
 assert.throws(()=>prepareCircularFace3(h(0n,0n)),RangeError);assert.throws(()=>prepareCircularFace3(big,[],0 as 1),RangeError);
});
test('dyadic witnesses resolve thin annuli without tolerances or a fixed iteration budget',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),one=new Rational(1n),inner=one.sub(epsilon),n=vector3(1n,1n,1n),center=point3(0n,0n,0n);
 const face=verify(prepareCircularFace3(circle3(center,n,1n),[circle3(center,n,inner.mul(inner))]));
 assert.equal(face.locate(face.sample),'inside');assert.equal(face.locate(center),'outside');
 const region=[...disk(0n,0n,1n),...disk(0n,0n,inner.mul(inner).toString(),true)],chart=verify(preparePlanarFace3(xy,region));assert.equal(chart.locate(point3(one.sub(epsilon.div(new Rational(2n))),0n,0n)),'inside');
});
test('input collections and structural frame/normal data are independently snapshotted',()=>{
 const origin={...point3(0n,0n,0n)},u={...vector3(1n,0n,0n)},v={...vector3(0n,1n,0n)},region=box(0n,2n).map(r=>[...r]),face=verify(preparePlanarFace3({origin,u,v},region));
 origin.z=new Rational(99n);u.x=new Rational(99n);region[0]!.length=0;assert.equal(face.locate(point3(1n,1n,0n)),'inside');
 const n={...vector3(1n,1n,1n)},c={...point3(0n,0n,0n)},holes=[circle3(point3(0n,0n,0n),n,1n)],circular=verify(prepareCircularFace3({center:c,normal:n,radiusSquared:new Rational(4n)},holes));holes.length=0;n.z=new Rational(99n);c.x=new Rational(99n);assert.equal(circular.locate(point3(0n,0n,0n)),'outside');
});

test('actual lifted boundary area vectors agree with declared normals for reflected charts',()=>{
 const frame=planeFrame3(point3(5n,7n,3n),vector3(2n,1n,0n),vector3(1n,-2n,0n));
 for(const sense of [1,-1] as const){
  const region=box(0n,2n),face=verify(preparePlanarFace3(frame,sense===1?region:reversed(region),sense));let z=AlgebraicReal.fromRational(0n);
  for(const c of face.boundary.flat()){const [a,b]=curveEndpoints3(c);z=z.add(a.x.mul(b.y).sub(a.y.mul(b.x)));}
  assert.equal(z.compare(AlgebraicReal.fromRational(BigInt(-40*sense))),0);assert.equal(z.affine(face.normal.z).sign(),1);
 }
});
test('strict circular inclusion/separation matches independent integer-radius triangle inequalities',()=>{
 const n=vector3(0n,0n,1n),outer=circle3(point3(0n,0n,0n),n,25n);
 for(let d=-6n;d<=6n;d++)for(let r=1n;r<=5n;r++){
  const hole=circle3(point3(d,0n,0n),n,r*r),inside=(d<0n?-d:d)+r<5n;
  if(inside)verify(prepareCircularFace3(outer,[hole]));else assert.throws(()=>prepareCircularFace3(outer,[hole]),RangeError);
 }
 const big=circle3(point3(0n,0n,0n),n,400n);
 for(let d=1n;d<=6n;d++)for(let a=1n;a<=3n;a++)for(let b=1n;b<=3n;b++){
  const holes=[circle3(point3(-d,0n,0n),n,a*a),circle3(point3(d,0n,0n),n,b*b)];
  if(2n*d>a+b)verify(prepareCircularFace3(big,holes));else assert.throws(()=>prepareCircularFace3(big,holes),RangeError);
 }
});

test('normalized curved Booleans become embedded faces with algebraic trim vertices',()=>{
 const a=disk(0n,0n,1n),b=disk(1n,0n,1n),h=isolateRealRoots(new Polynomial(['-3/4',0n,1n]))[1]!;
 for(const op of ['union','intersection','difference'] as const){
  const result=booleanCurveRegions2(a,b,op),face=verify(preparePlanarFace3(xy,result.rings));
  assert.ok(face.topology.vertices.some(p=>p.y.rational===null));
  assert.equal(face.locate(point3('-1/2',0n,0n)),op==='intersection'?'outside':'inside');
  assert.equal(face.locate(point3('1/2',0n,0n)),op==='difference'?'outside':'inside');
  assert.equal(face.locate(algebraicCoordinates3('1/2',h,0n)),'boundary');
 }
 const xor=booleanCurveRegions2(a,b,'xor');assert.throws(()=>preparePlanarFace3(xy,xor.rings),RangeError);
});
