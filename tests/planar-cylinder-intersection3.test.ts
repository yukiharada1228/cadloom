import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point2,point3,vector3,line3,cylinder3,circle2,circle3,fullCircleArc2,planeFrame3,prepareCylinderFace3,prepareRectangleFace3,prepareCircularFace3,preparePlanarFace3,intersectPlanarCylinderFaces3,pointOnCurve3,compareAlgebraicPoints3,algebraicCoordinates3,curveEndpoints3,intersectAlgebraicSegmentEllipse3,algebraicSegment3,ellipse3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),wall=prepareCylinderFace3(cylinder,-2n,2n),f=planeFrame3(O,vector3(1n,0n,1n),vector3(0n,1n,0n));
const covered=(r:ReturnType<typeof intersectPlanarCylinderFaces3>,p:ReturnType<typeof point3>)=>r.curves.some(c=>pointOnCurve3(p,c.curve))||r.points.some(q=>compareAlgebraicPoints3(algebraicCoordinates3(p.x,p.y,p.z),q)===0);
function samples(r:ReturnType<typeof intersectPlanarCylinderFaces3>,oracle:(x:Rational,y:Rational)=>boolean){for(let k=-15n;k<=15n;k++){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den);assert.equal(covered(r,point3(x,y,x)),oracle(x,y));}}
test('bounded rectangle clips a cylinder section on both faces against an independent rational oracle',()=>{
 const face=prepareRectangleFace3(f,'-1/2','1/2',-2n,2n),r=intersectPlanarCylinderFaces3(face,wall);assert.ok(r.curves.length>=2);assert.equal(r.points.length,0);samples(r,x=>x.compare(new Rational(-1n,2n))>=0&&x.compare(new Rational(1n,2n))<=0);
 for(const c of r.curves)for(const p of curveEndpoints3(c.curve)){assert.notEqual(face.locate(p),'outside');assert.notEqual(wall.locate(p),'outside');}
});
test('circular planar annulus cuts ellipse at outer and hole boundaries',()=>{
 const n=vector3(1n,0n,-1n),face=prepareCircularFace3(circle3(O,n,'3/2'),[circle3(O,n,'5/4')]),r=intersectPlanarCylinderFaces3(face,wall);assert.ok(r.curves.length>=4);assert.equal(r.points.length,0);samples(r,x=>{const square=x.mul(x);return square.compare(new Rational(1n,4n))>=0&&square.compare(new Rational(1n,2n))<=0;});
});
test('circular disk tangency keeps two isolated contacts instead of dropping them',()=>{
 const face=prepareCircularFace3(circle3(O,vector3(1n,0n,-1n),1n)),r=intersectPlanarCylinderFaces3(face,wall);assert.equal(r.curves.length,0);assert.equal(r.points.length,2);assert.ok(covered(r,point3(0n,1n,0n)));assert.ok(covered(r,point3(0n,-1n,0n)));
});
test('affine circular chart boundaries participate in conic intersection clipping',()=>{
 const frame=planeFrame3(O,vector3(1n,0n,1n),vector3(0n,2n,0n)),face=preparePlanarFace3(frame,[[{kind:'arc',arc:fullCircleArc2(circle2(point2('1/2',0n),'1/4'))}]]),r=intersectPlanarCylinderFaces3(face,wall);assert.ok(r.curves.length>0);samples(r,x=>x.compare(new Rational(1n,3n))>=0);
});
test('parallel generator segments are clipped to bounded planar rectangles with tangent multiplicity',()=>{
 const frame=planeFrame3(O,vector3(0n,1n,0n),Z),face=prepareRectangleFace3(frame,-2n,2n,'-1/2','1/2'),r=intersectPlanarCylinderFaces3(face,wall);assert.equal(r.curves.length,2);assert.equal(r.points.length,0);
 for(const y of [-1n,1n])for(const z of ['-1','-1/2','0','1/2','1'])assert.equal(covered(r,point3(0n,y,z)),new Rational(-1n,2n).compare(Rational.parse(z))<=0&&new Rational(1n,2n).compare(Rational.parse(z))>=0);
 const tangentFrame=planeFrame3(point3(1n,0n,0n),vector3(0n,1n,0n),Z),t=intersectPlanarCylinderFaces3(prepareRectangleFace3(tangentFrame,-1n,1n,-1n,1n),wall);assert.equal(t.curves.length,1);assert.equal(t.curves[0]!.multiplicity,2);
});
test('algebraic rectangle limits and segment endpoints remain exact',()=>{
 const h=AlgebraicReal.fromRational('1/2').sqrt(),face=prepareRectangleFace3(f,h.neg(),h,-2n,2n),r=intersectPlanarCylinderFaces3(face,wall);samples(r,x=>x.mul(x).compare(new Rational(1n,2n))<=0);
 const e=ellipse3(planeFrame3(O,vector3(1n,0n,0n),vector3(0n,1n,0n)),1n,1n),segment=algebraicSegment3(algebraicCoordinates3(h,-2n,0n),algebraicCoordinates3(h,2n,0n)),hits=intersectAlgebraicSegmentEllipse3(segment,e);assert.equal(hits.length,2);for(const y of [h,h.neg()])assert.ok(hits.some(p=>compareAlgebraicPoints3(p,algebraicCoordinates3(h,y,0n))===0));
});
test('coplanar boundary coincidence retains arcs and factory ownership is enforced',()=>{
 const frame=planeFrame3(O,vector3(1n,0n,0n),vector3(0n,1n,0n)),face=prepareCircularFace3(circle3(O,Z,1n)),r=intersectPlanarCylinderFaces3(face,wall);assert.ok(r.curves.length>0);assert.equal(r.points.length,0);assert.ok(covered(r,point3(1n,0n,0n)));assert.throws(()=>intersectPlanarCylinderFaces3({...face,locate:()=> 'outside'},wall),RangeError);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.curves)&&Object.isFrozen(r.points));
});
test('generator touching a polygon corner is an isolated point and both face bounds apply',()=>{
 const diamondFrame=planeFrame3(O,vector3(0n,1n,1n),vector3(0n,1n,-1n)),diamond=prepareRectangleFace3(diamondFrame,0n,'1/2',0n,'1/2'),contact=intersectPlanarCylinderFaces3(diamond,wall);assert.equal(contact.curves.length,0);assert.equal(contact.points.length,1);assert.ok(covered(contact,point3(0n,1n,0n)));
 const rectangle=prepareRectangleFace3(f,'-1/2','1/2',-2n,2n),shortWall=prepareCylinderFace3(cylinder,0n,'1/4'),section=intersectPlanarCylinderFaces3(rectangle,shortWall);samples(section,x=>x.sign()>=0&&x.compare(new Rational(1n,4n))<=0);
});
