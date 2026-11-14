import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,vector3,line3,cylinder3,plane3,circle3,circularArc3,prepareCylinderFace3,intersectPlaneCylinderFace3,pointOnCurve3,compareAlgebraicPoints3,curveOnSurface3,curveEndpoints3,ellipse3,planeFrame3,ellipticArc3,fullEllipseArc3,interiorPointOnEllipticArc3,locatePointOnEllipticArc3,algebraicCoordinates3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),circle=circle3(O,Z,1n);
const covered=(result:ReturnType<typeof intersectPlaneCylinderFace3>,p:Parameters<typeof pointOnCurve3>[0])=>result.curves.some(c=>pointOnCurve3(p,c.curve))||result.points.some(q=>compareAlgebraicPoints3(algebraicCoordinates3(p.x,p.y,p.z),q)===0);
test('finite cylinder band clips an oblique ellipse into closed arcs and preserves surface support',()=>{
 const face=prepareCylinderFace3(cylinder,'-1/2','1/2'),plane=plane3(1n,0n,-1n),result=intersectPlaneCylinderFace3(plane,face);
 assert.equal(result.points.length,0);assert.ok(result.curves.length>=2);
 for(const {curve,multiplicity} of result.curves){assert.equal(multiplicity,1);assert.ok(curveOnSurface3(curve,{kind:'plane',plane}));assert.ok(curveOnSurface3(curve,{kind:'cylinder',cylinder}));for(const p of curveEndpoints3(curve))assert.notEqual(face.locate(p),'outside');}
 // Independent rational parameterization of the unit circle and z=x section.
 for(let i=-20n;i<=20n;i++){
  const den=1n+i*i,x=new Rational(1n-i*i,den),y=new Rational(2n*i,den),p=point3(x,y,x);
  assert.equal(covered(result,p),x.compare(new Rational(-1n,2n))>=0&&x.compare(new Rational(1n,2n))<=0);
 }
});
test('tangent cap contact is retained as a point, while opposite and separated bands are empty',()=>{
 const plane=plane3(1n,0n,-1n),result=intersectPlaneCylinderFace3(plane,prepareCylinderFace3(cylinder,1n,2n));
 assert.equal(result.curves.length,0);assert.equal(result.points.length,1);assert.equal(compareAlgebraicPoints3(result.points[0]!,algebraicCoordinates3(1n,0n,1n)),0);
 const empty=intersectPlaneCylinderFace3(plane,prepareCylinderFace3(cylinder,2n,3n));assert.equal(empty.curves.length+empty.points.length,0);
 const bottom=intersectPlaneCylinderFace3(plane,prepareCylinderFace3(cylinder,-2n,-1n));assert.equal(bottom.points.length,1);assert.ok(covered(bottom,point3(-1n,0n,-1n)));
});
test('parallel secant and tangent generators clip exactly and preserve multiplicity',()=>{
 const face=prepareCylinderFace3(cylinder,'-2/3','7/5');
 for(const [offset,count,multiplicity] of [[0n,2,1],[-1n,1,2],[-2n,0,1]] as const){
  const plane=plane3(1n,0n,0n,offset),r=intersectPlaneCylinderFace3(plane,face);assert.equal(r.curves.length,count);assert.equal(r.points.length,0);
  for(const c of r.curves){assert.equal(c.multiplicity,multiplicity);assert.equal(c.curve.kind,'algebraic-segment');assert.ok(curveOnSurface3(c.curve,{kind:'plane',plane}));for(const p of curveEndpoints3(c.curve))assert.equal(face.locate(p),'boundary');}
 }
});
test('angular patches clip cap-coincident circles and retain coincident generator boundaries',()=>{
 const angular=circularArc3(circle,point3(1n,0n,0n),point3(0n,1n,0n)),face=prepareCylinderFace3(cylinder,0n,2n,{angular});
 for(const z of [0n,1n,2n]){
  const r=intersectPlaneCylinderFace3(plane3(0n,0n,1n,-z),face);assert.ok(covered(r,point3(1n,0n,z)));assert.ok(covered(r,point3(0n,1n,z)));assert.equal(covered(r,point3(-1n,0n,z)),false);assert.equal(r.points.length,0);
 }
 const boundary=intersectPlaneCylinderFace3(plane3(1n,0n,0n),face);assert.equal(boundary.curves.length,1);assert.ok(covered(boundary,point3(0n,1n,1n)));
 const outside=intersectPlaneCylinderFace3(plane3(0n,0n,1n,-3n),face);assert.equal(outside.curves.length+outside.points.length,0);
});
test('angular and height clipping agree with independent rational product-domain oracle',()=>{
 for(const clockwise of [false,true]){
  const angular=circularArc3(circle,point3(1n,0n,0n),point3(0n,1n,0n),{direction:clockwise?'cw':'ccw'}),face=prepareCylinderFace3(cylinder,'-1/3','2/3',{angular,sense:-1}),r=intersectPlaneCylinderFace3(plane3(1n,1n,-1n),face);
  for(let i=-12n;i<=12n;i++){
   const den=1n+i*i,x=new Rational(1n-i*i,den),y=new Rational(2n*i,den),z=x.add(y),inQuarter=x.sign()>=0&&y.sign()>=0,endpoint=x.sign()===0&&y.equals(new Rational(1n))||x.equals(new Rational(1n))&&y.sign()===0;
   const inside=z.compare(new Rational(-1n,3n))>=0&&z.compare(new Rational(2n,3n))<=0&&(clockwise?!inQuarter||endpoint:inQuarter);
   assert.equal(covered(r,point3(x,y,z)),inside);
  }
 }
});
test('ellipse arc interior witnesses handle antipodal, major, narrow and irrational endpoints',()=>{
 const e=ellipse3(planeFrame3(O,vector3(1n,0n,0n),vector3(0n,1n,0n)),2n,3n),a=AlgebraicReal.fromRational(2n).sqrt(),b=AlgebraicReal.fromRational(3n).sqrt(),P=algebraicCoordinates3(a,0n,0n),Q=algebraicCoordinates3(a.neg(),0n,0n),T=algebraicCoordinates3(0n,b,0n);
 for(const direction of ['ccw','cw'] as const)for(const end of [Q,T]){const arc=ellipticArc3(e,P,end,{direction});assert.equal(locatePointOnEllipticArc3(interiorPointOnEllipticArc3(arc),arc),'interior');}
 assert.equal(locatePointOnEllipticArc3(interiorPointOnEllipticArc3(fullEllipseArc3(e)),fullEllipseArc3(e)),'interior');assert.throws(()=>interiorPointOnEllipticArc3(ellipticArc3(e,P,P)),RangeError);
 const eps=new Rational(1n,10n**30n),unitEllipse=ellipse3(e.frame,1n,1n),den=new Rational(1n).add(eps.mul(eps)),x=new Rational(1n).sub(eps.mul(eps)).div(den),y=eps.mul(new Rational(2n)).div(den),arc=ellipticArc3(unitEllipse,point3(1n,0n,0n),point3(x,y,0n));assert.equal(locatePointOnEllipticArc3(interiorPointOnEllipticArc3(arc),arc),'interior');
});
test('oblique-axis angular patches match an independent rational chart and ignore supplied locate callbacks',()=>{
 const o=point3(3n,-2n,7n),d=vector3(1n,2n,2n),u=vector3(2n,-1n,0n),v=vector3('2/3','4/3','-5/3'),c=cylinder3(line3(o,d),5n),n=vector3(new Rational(2n,5n).sub(new Rational(1n,9n)),new Rational(-1n,5n).sub(new Rational(2n,9n)),new Rational(-2n,9n));
 const map=(x:Rational,y:Rational,t:Rational)=>point3(o.x.add(u.x.mul(x)).add(v.x.mul(y)).add(d.x.mul(t)),o.y.add(u.y.mul(x)).add(v.y.mul(y)).add(d.y.mul(t)),o.z.add(u.z.mul(x)).add(v.z.mul(y)).add(d.z.mul(t)));
 const one=new Rational(1n),zero=new Rational(0n),angular=circularArc3(circle3(o,d,5n),map(one,zero,zero),map(zero,one,zero)),face=prepareCylinderFace3(c,'-1/2','3/4',{angular}),plane=plane3(n.x,n.y,n.z,n.x.mul(o.x).add(n.y.mul(o.y)).add(n.z.mul(o.z)).neg());
 const result=intersectPlaneCylinderFace3(plane,{...face,locate:()=>{throw new Error('Untrusted callback');}});
 for(let i=-15n;i<=15n;i++){const den=1n+i*i,x=new Rational(1n-i*i,den),y=new Rational(2n*i,den);assert.equal(covered(result,map(x,y,x)),x.sign()>=0&&y.sign()>=0&&x.compare(new Rational(3n,4n))<=0);}
 for(const {curve} of result.curves){assert.ok(curveOnSurface3(curve,{kind:'plane',plane}));assert.ok(curveOnSurface3(curve,{kind:'cylinder',cylinder:c}));}
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.curves)&&Object.isFrozen(result.points));
});
test('a sole tangency at the full-ellipse seam is an isolated point, not a retained ellipse',()=>{
 const face=prepareCylinderFace3(cylinder,1n,2n);for(const plane of [plane3(0n,-1n,1n),plane3(0n,1n,-1n)]){const r=intersectPlaneCylinderFace3(plane,face);assert.equal(r.curves.length,0);assert.equal(r.points.length,1);assert.equal(compareAlgebraicPoints3(r.points[0]!,algebraicCoordinates3(0n,1n,1n)),0);}
});
