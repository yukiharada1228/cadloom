import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point3,vector3,line3,plane3,cylinder3,circle3,fullCircleArc3,circularArc3,reverseCircularArc3,locatePointOnArc3,interiorPointOnArc3,algebraicCoordinates3,algebraicPoint3,translateAlgebraicPoint3,subtractAlgebraicPoints3,algebraicSegment3,pointOnAlgebraicSegment3,prepareCylinderFace3,curveOnSurface3,pointOnCurve3,curveEndpoints3,reverseCurve3,normalToSurface3,buildBRepTopology3} from '../dist/index.js';
import type {Curve3,PreparedCylinderFace3,Point3,AlgebraicCoordinates3} from '../dist/index.js';
const q=(v:bigint|string)=>AlgebraicReal.fromRational(v),sqrt=(v:bigint)=>isolateRealRoots(new Polynomial([-v,0n,1n]))[1]!;
const origin=point3(0n,0n,0n),Z=vector3(0n,0n,1n),unit=cylinder3(line3(origin,Z),1n);
function verify(face:PreparedCylinderFace3):PreparedCylinderFace3 {
 assert.equal(face.locate(face.sample),'inside');assert.equal(face.topology.manifoldVertices,true);assert.equal(face.topology.consistentlyOriented,true);assert.equal(face.topology.faces.length,1);assert.equal(face.topology.shells.length,1);assert.equal(face.topology.closed,false);assert.equal(face.topology.boundaryLoops!.length,face.boundary.length);
 for(const ring of face.boundary){assert.ok(Object.isFrozen(ring));for(const curve of ring){assert.equal(curveOnSurface3(curve,{kind:'cylinder',cylinder:face.surface}),true);assert.ok(Object.isFrozen(curve));}}
 for(const p of face.topology.vertices)assert.equal(face.locate(p),'boundary');
 const actual=face.normalAt(face.sample),normal=normalToSurface3(face.sample,{kind:'cylinder',cylinder:face.surface});
 for(const k of ['x','y','z'] as const)assert.equal(actual[k].compare(normal[k].affine(BigInt(face.sense))),0);
 assert.ok(Object.isFrozen(face)&&Object.isFrozen(face.surface)&&Object.isFrozen(face.boundary)&&Object.isFrozen(face.sample)&&Object.isFrozen(face.angular));return face;
}
test('algebraic endpoint segments preserve exact membership, reversal and whole-surface checks',()=>{
 const root=AlgebraicReal.fromRational('1/2').sqrt(),a=algebraicPoint3(origin,vector3(1n,1n,0n),root),b=translateAlgebraicPoint3(a,vector3(0n,0n,2n)),s=algebraicSegment3(a,b),curve:Curve3={kind:'algebraic-segment',segment:s};
 assert.equal(pointOnAlgebraicSegment3(translateAlgebraicPoint3(a,vector3(0n,0n,1n)),s),true);assert.equal(pointOnAlgebraicSegment3(translateAlgebraicPoint3(a,vector3(0n,0n,3n)),s),false);assert.equal(pointOnAlgebraicSegment3(translateAlgebraicPoint3(a,vector3('1/1000000000000000000000000000000',0n,1n)),s),false);
 assert.equal(curveOnSurface3(curve,{kind:'cylinder',cylinder:unit}),true);assert.equal(curveOnSurface3(curve,{kind:'plane',plane:plane3(1n,-1n,0n)}),true);assert.equal(pointOnCurve3(a,reverseCurve3(curve)),true);
 const delta=subtractAlgebraicPoints3(b,a);assert.equal(delta.x.sign(),0);assert.equal(delta.y.sign(),0);assert.equal(delta.z.compare(q(2n)),0);
 const opposite=translateAlgebraicPoint3(algebraicPoint3(origin,vector3(-1n,-1n,0n),root),vector3(0n,0n,0n));assert.equal(curveOnSurface3({kind:'algebraic-segment',segment:algebraicSegment3(a,opposite)},{kind:'cylinder',cylinder:unit}),false);
 assert.throws(()=>buildBRepTopology3([{kind:'algebraic-segment',segment:algebraicSegment3(a,a)}],[]),RangeError);
});
test('independent algebraic segment coordinates and untrusted affine fields remain exact',()=>{
 const a=sqrt(2n),b=sqrt(3n),start=algebraicCoordinates3(a,b,0n),end=algebraicCoordinates3(a.affine(1n,1n),b.affine(1n,2n),3n),segment=algebraicSegment3(start,end),mid=algebraicCoordinates3(a.affine(1n,'1/2'),b.affine(1n,1n),'3/2');
 assert.equal(pointOnAlgebraicSegment3(mid,segment),true);assert.equal(pointOnAlgebraicSegment3(algebraicCoordinates3(mid.x.affine(1n,'1/3'),mid.y,mid.z),segment),false);
 const forged={...algebraicCoordinates3(0n,0n,0n),origin:point3(8n,8n,8n),direction:Z,parameter:sqrt(2n)},translated=translateAlgebraicPoint3(forged,vector3(1n,2n,3n));assert.equal(translated.x.compare(q(1n)),0);assert.equal(translated.y.compare(q(2n)),0);assert.equal(translated.z.compare(q(3n)),0);
 const mutable={...start},snapshot=algebraicSegment3(mutable,end);mutable.x=q(99n);assert.equal(snapshot.start.x.compare(a),0);assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.start));
});
test('arbitrary-axis full cylinder bands have genuine annular domains without seam boundaries',()=>{
 const n=vector3(1n,1n,1n),o=point3(2n,3n,4n),surface=cylinder3(line3(o,n),1n),base=fullCircleArc3(circle3(o,n,1n)).start;
 for(const sense of [1,-1] as const){
  const face=verify(prepareCylinderFace3(surface,'-2/3','5/7',{sense}));assert.equal(face.boundary.length,2);assert.equal(face.topology.edges.length,2);assert.ok(face.topology.edges.every(e=>e.start===e.end));
  assert.equal(face.locate(base),'inside');assert.equal(face.locate(translateAlgebraicPoint3(base,vector3('-2/3','-2/3','-2/3'))),'boundary');assert.equal(face.locate(translateAlgebraicPoint3(base,vector3('5/7','5/7','5/7'))),'boundary');assert.equal(face.locate(translateAlgebraicPoint3(base,vector3(1n,1n,1n))),'outside');assert.equal(face.locate(o),'outside');
  assert.throws(()=>face.normalAt(o),RangeError);
 }
});
test('partial cylinder patches use algebraic straight generators and correct closed boundaries',()=>{
 const surface=cylinder3(line3(origin,Z),4n),circle=circle3(origin,Z,4n),h=sqrt(3n),angular=circularArc3(circle,algebraicCoordinates3(1n,h.neg(),0n),algebraicCoordinates3(1n,h,0n));
 for(const sense of [1,-1] as const){
  const face=verify(prepareCylinderFace3(surface,-1n,2n,{angular,sense}));assert.equal(face.boundary.length,1);assert.equal(face.boundary[0]!.length,4);assert.equal(face.topology.vertices.length,4);assert.equal(face.boundary.flat().filter(c=>c.kind==='algebraic-segment').length,2);
  assert.equal(face.locate(point3(2n,0n,0n)),'inside');assert.equal(face.locate(point3(-2n,0n,0n)),'outside');assert.equal(face.locate(point3(2n,0n,-1n)),'boundary');assert.equal(face.locate(algebraicCoordinates3(1n,h,0n)),'boundary');assert.equal(face.locate(point3(0n,2n,0n)),'outside');assert.equal(face.normalAt(point3(2n,0n,0n)).x.compare(q(BigInt(2*sense))),0);
  const bottom=face.boundary.flat().find(c=>c.kind==='circular-arc'&&c.arc.circle.center.z.compare(new Rational(-1n))===0)!;assert.equal(bottom.kind==='circular-arc'?bottom.arc.direction:'',sense===1?'ccw':'cw');
  for(const curve of face.boundary.flat()){const ends=curveEndpoints3(curve);assert.equal(face.locate(ends[0]),'boundary');assert.equal(face.locate(ends[1]),'boundary');}
 }
});
test('opposite angular normals and clockwise traversal define the same physical patch',()=>{
 const positive=circularArc3(circle3(origin,Z,1n),point3(1n,0n,0n),point3(-1n,0n,0n)),negative=circularArc3(circle3(origin,vector3(0n,0n,-3n),1n),point3(1n,0n,0n),point3(-1n,0n,0n),{direction:'cw'}),a=verify(prepareCylinderFace3(unit,0n,2n,{angular:positive})),b=verify(prepareCylinderFace3(unit,0n,2n,{angular:negative}));
 for(const p of [point3(0n,1n,1n),point3(0n,-1n,1n),point3(1n,0n,1n),point3(-1n,0n,2n)])assert.equal(a.locate(p),b.locate(p));assert.equal(b.angular.direction,'ccw');assert.equal(b.locate(point3(0n,1n,1n)),'inside');
});
const hex=[point3(0n,1n,-1n),point3(-1n,1n,0n),point3(-1n,0n,1n),point3(0n,-1n,1n),point3(1n,-1n,0n),point3(1n,0n,-1n)],mod=(x:number)=>(x%6+6)%6;
test('spatial cylinder patch location agrees with independent cyclic and height indices',()=>{
 const n=vector3(1n,1n,1n),surface=cylinder3(line3(origin,n),2n);
 for(const ns of [1,-1])for(const direction of ['ccw','cw'] as const)for(let s=0;s<6;s++)for(let e=0;e<6;e++){
  if(s===e)continue;const circle=circle3(origin,vector3(BigInt(ns),BigInt(ns),BigInt(ns)),2n),angular=circularArc3(circle,hex[s]!,hex[e]!,{direction}),face=prepareCylinderFace3(surface,-1n,1n,{angular}),sign=ns*(direction==='ccw'?1:-1);
  assert.equal(face.locate(face.sample),'inside');
  for(let i=0;i<6;i++)for(const t of [-2n,-1n,0n,1n,2n]){
   const p=point3(hex[i]!.x.add(new Rational(t)),hex[i]!.y.add(new Rational(t)),hex[i]!.z.add(new Rational(t))),insideAngle=mod(sign*(i-s))<=mod(sign*(e-s)),boundaryAngle=i===s||i===e,expected=t<-1n||t>1n||!insideAngle?'outside':t===-1n||t===1n||boundaryAngle?'boundary':'inside';assert.equal(face.locate(p),expected,`${ns} ${direction} ${s}->${e} @ ${i},${t}`);
  }
 }
});
test('open-arc witnesses cover major/minor arcs, irrational seams and extremely thin angles',()=>{
 const c=circle3(origin,Z,1n),epsilon=Rational.parse('1/1'+'0'.repeat(30)),den=new Rational(1n).add(epsilon.mul(epsilon)),end=point3(new Rational(1n).sub(epsilon.mul(epsilon)).div(den),epsilon.mul(new Rational(2n)).div(den),0n),arc=circularArc3(c,point3(1n,0n,0n),end),witness=interiorPointOnArc3(arc);assert.equal(locatePointOnArc3(witness,arc),'interior');
 const face=verify(prepareCylinderFace3(unit,0n,1n,{angular:arc}));assert.equal(face.locate(face.sample),'inside');
 const clockwise=reverseCircularArc3(arc),major=circularArc3(c,end,point3(1n,0n,0n));
 assert.equal(locatePointOnArc3(interiorPointOnArc3(clockwise),clockwise),'interior');assert.equal(locatePointOnArc3(interiorPointOnArc3(major),major),'interior');
 const full=fullCircleArc3(circle3(origin,vector3(1n,1n,1n),1n));assert.equal(locatePointOnArc3(interiorPointOnArc3(full),full),'interior');assert.throws(()=>interiorPointOnArc3(circularArc3(c,point3(1n,0n,0n),point3(1n,0n,0n))),RangeError);
});
test('algebraic query heights and independently represented radial coordinates need no rational approximation',()=>{
 const half=AlgebraicReal.fromRational('1/2').sqrt(),height=sqrt(3n),angular=circularArc3(circle3(origin,Z,1n),point3(1n,0n,0n),point3(-1n,0n,0n)),face=verify(prepareCylinderFace3(unit,0n,2n,{angular})),p=algebraicCoordinates3(half,half,height);
 assert.equal(face.locate(p),'inside');const n=face.normalAt(p);assert.equal(n.x.compare(half),0);assert.equal(n.y.compare(half),0);assert.equal(n.z.sign(),0);
 const along=algebraicPoint3(point3(0n,1n,0n),vector3(0n,0n,2n),half);assert.equal(face.locate(along),'inside');
});
test('axis scale and origin are respected as exact parameters rather than approximate physical heights',()=>{
 const surface=cylinder3(line3(point3(2n,3n,5n),vector3(0n,0n,2n)),1n),face=verify(prepareCylinderFace3(surface,'1/2','3/2'));
 assert.equal(face.locate(point3(3n,3n,6n)),'boundary');assert.equal(face.locate(point3(3n,3n,8n)),'boundary');assert.equal(face.locate(point3(3n,3n,7n)),'inside');assert.equal(face.locate(point3(3n,3n,5n)),'outside');assert.equal(face.normalAt(point3(3n,3n,7n)).x.compare(q(4n)),0);
});
test('zero extent, wrong angular circles, bounds and off-domain normals are rejected',()=>{
 for(const [a,b] of [[0n,0n],[2n,1n]])assert.throws(()=>prepareCylinderFace3(unit,a!,b!),RangeError);
 assert.throws(()=>prepareCylinderFace3(unit,0n,1n,{sense:0 as 1}),RangeError);
 for(const c of [circle3(origin,Z,2n),circle3(point3(0n,0n,1n),Z,1n),circle3(origin,vector3(1n,0n,0n),1n)])assert.throws(()=>prepareCylinderFace3(unit,0n,1n,{angular:fullCircleArc3(c)}),RangeError);
 const circle=circle3(origin,Z,1n);assert.throws(()=>prepareCylinderFace3(unit,0n,1n,{angular:circularArc3(circle,point3(1n,0n,0n),point3(1n,0n,0n))}),RangeError);
 const face=prepareCylinderFace3(unit,0n,1n);assert.throws(()=>face.normalAt(point3(1n,0n,2n)),RangeError);assert.throws(()=>face.normalAt(origin),RangeError);
});
test('cylinder face and algebraic generator snapshots survive caller mutations',()=>{
 const o={...origin},d={...Z},surface={axis:{origin:o,direction:d},radiusSquared:new Rational(1n)},face=verify(prepareCylinderFace3(surface,0n,1n));o.x=new Rational(99n);d.z=new Rational(9n);assert.equal(face.locate(point3(1n,0n,'1/2')),'inside');
 assert.ok(Object.isFrozen(face.topology)&&face.boundary.every(Object.isFrozen));
});
test('reversing and rescaling the cylinder axis preserves the physical face under exact bound remapping',()=>{
 const angular=circularArc3(circle3(origin,Z,1n),point3(1n,0n,0n),point3(-1n,0n,0n)),positive=verify(prepareCylinderFace3(unit,0n,2n,{angular})),negative=verify(prepareCylinderFace3(cylinder3(line3(origin,vector3(0n,0n,-2n)),1n),-1n,0n,{angular}));
 for(const p of [point3(0n,1n,1n),point3(0n,-1n,1n),point3(1n,0n,0n),point3(-1n,0n,2n),point3(0n,1n,3n)])assert.equal(negative.locate(p),positive.locate(p));
 const p=point3(0n,1n,1n),a=positive.normalAt(p),b=negative.normalAt(p);for(const k of ['x','y','z'] as const)assert.equal(b[k].affine('1/4').compare(a[k]),0);
});
