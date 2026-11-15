import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,point3,vector3,line3,cylinder3,plane3,classifyPointToSurface3,translateAlgebraicPoint3,ellipse3,circle3,pointOnCircle3,planeFrame3,locatePointInEllipse3,isolateRealRoots} from '../dist/index.js';
import {algebraicQuadraticPoint3,getQuadraticParameterization3,snapshotExactPoint3,signLinearAlgebraicPoint3} from '../dist/geometry/algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3} from '../dist/geometry/algebraic-segment-plane3.js';
const P=(...xs:bigint[])=>new Polynomial(xs),T=P(0n,1n),O=point3(0n,0n),Z=vector3(0n,0n,1n),r=AlgebraicReal.fromRational(2n).sqrt();
test('quadratic point charts retain exact linear and cylindrical predicates under translation',()=>{
 const p=algebraicQuadraticPoint3(r,[T,P(),P()],vector3(0n,1n),P(3n));assert.equal(snapshotExactPoint3(p),p);assert.equal(pointOnCircle3(p,circle3(O,Z,5n)),true);assert.equal(pointOnCircle3(p,circle3(O,Z,4n)),false);assert.ok(getQuadraticParameterization3(p));assert.equal(signLinearAlgebraicPoint3(p,Z,new Rational(0n)),0);
 const sum=evaluatePlaneAtAlgebraicPoint3(plane3(1n,1n,0n),p),expected=isolateRealRoots(P(1n,0n,-10n,0n,1n))[3]!;assert.equal(sum.compare(expected),0);assert.ok(sum.polynomial.degree<=4);
 for(const radius of [4n,5n,6n])assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),radius)}),radius===5n?0:radius<5n?1:-1);
 const shift=point3(2n,-1n,3n),moved=translateAlgebraicPoint3(p,shift);assert.equal(getQuadraticParameterization3(moved)!.parameter,r);assert.equal(classifyPointToSurface3(moved,{kind:'cylinder',cylinder:cylinder3(line3(shift,Z),5n)}),0);assert.equal(classifyPointToSurface3(moved,{kind:'plane',plane:plane3(0n,0n,1n,-3n)}),0);
 const fake={...p,x:AlgebraicReal.fromRational(0n),parameter:r};assert.equal(getQuadraticParameterization3(fake),undefined);assert.equal(classifyPointToSurface3(fake,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),5n)}),-1);
});
test('quartic-source rational quadratic points stay on exact circle and ellipse supports',()=>{
 const source=isolateRealRoots(P(1n,0n,-10n,0n,1n))[3]!,D=P(1n,1n),K=D.mul(D).scale(12n).sub(T.mul(T)),p=algebraicQuadraticPoint3(source,[T,P(),P()],vector3(0n,1n),K,D);for(const k of ['x','y','z'] as const)assert.ok(p[k].polynomial.degree<=8);
 assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),12n)}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),11n)}),1);
 assert.equal(pointOnCircle3(p,circle3(O,Z,12n)),true);
 const e=ellipse3(planeFrame3(O,vector3(1n,0n),vector3(0n,2n)),12n,3n);assert.equal(locatePointInEllipse3(p,e),'boundary');assert.equal(locatePointInEllipse3(p,ellipse3(e.frame,13n,'13/4')),'inside');assert.equal(locatePointInEllipse3(p,ellipse3(e.frame,11n,'11/4')),'outside');
});
test('quadratic point factories snapshot coefficient/numerator inputs and reject invalid fields',()=>{
 const N:[Polynomial,Polynomial,Polynomial]=[T,P(),P()],c={...vector3(0n,1n)},p=algebraicQuadraticPoint3(r,N,c,P(3n));N[0]=P(99n);c.y=new Rational(0n);assert.equal(p.x.compare(r),0);assert.equal(getQuadraticParameterization3(p)!.numerators[0],T);assert.ok(Object.isFrozen(getQuadraticParameterization3(p)!.numerators));assert.throws(()=>algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(-1n)),RangeError);assert.throws(()=>algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(3n),P(-2n,0n,1n)),RangeError);
});
