import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,isolateRealRoots,point3,vector3,line3,cylinder3,intersectCylinders3,pointOnArc3,evaluateCylinderIntersectionArc3,pointOnCylinderIntersectionArc3} from '../dist/index.js';
import {algebraicRationalPoint3,getQuadraticParameterization3,signQuadraticPointSquaredForms3,signLinearAlgebraicPoint3} from '../dist/geometry/algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3} from '../dist/geometry/algebraic-segment-plane3.js';
import {cylinderHeight3} from '../dist/geometry/cylinder-coordinates3.js';
import {projectCylinderIntersectionBase3} from '../dist/geometry/cylinder-cylinder3.js';
const P=(...xs:bigint[])=>new Polynomial(xs),O=point3(0n,0n),one=new Rational(1n),zero=new Rational(0n),source=isolateRealRoots(P(1n,0n,-10n,0n,1n))[3]!,U=P(-2n,0n,6n),V=P(0n,4n),W=P(2n,0n,6n),normals=[vector3(1n,-1n),vector3(0n,1n,-1n),vector3(-1n,0n,1n)];
test('oblique SSI lifts preserve quartic-source quadratic degree, both sheets and signed denominators/axes',()=>{
 for(const d of [vector3(1n,1n,1n),vector3(-2n,-2n,-2n)]){const a=cylinder3(line3(O,d),2n),b=cylinder3(line3(O,vector3(1n,0n)),4n),g=intersectCylinders3(a,b);assert.equal(g.kind,'bounded');if(g.kind!=='bounded')continue;
  for(const sign of [1n,-1n]){const q=algebraicRationalPoint3(source,[U.add(V).scale(sign),V.sub(U).scale(sign),V.scale(-2n*sign)],W.scale(sign));for(const branch of [-1,1]){const arc=g.arcs.find(a=>a.branch===branch&&pointOnArc3(q,a.base))!;assert.ok(arc);const p=evaluateCylinderIntersectionArc3(arc,q),chart=getQuadraticParameterization3(p)!;assert.ok(chart);assert.equal(chart.parameter,source);for(const k of ['x','y','z'] as const)assert.ok(p[k].polynomial.degree<=8);
   // Independent implicit equations: circle cylinder about (1,1,1) and X axis.
   assert.equal(signQuadraticPointSquaredForms3(chart,normals.map(normal=>({normal,offset:zero,weight:one})),new Rational(-6n)),0);assert.equal(signQuadraticPointSquaredForms3(chart,[vector3(0n,1n),vector3(0n,0n,1n)].map(normal=>({normal,offset:zero,weight:one})),new Rational(-4n)),0);
   assert.equal(signLinearAlgebraicPoint3(p,vector3(0n,d.y,d.z),zero),branch);assert.equal(pointOnCylinderIntersectionArc3(p,arc),true);assert.equal(projectCylinderIntersectionBase3(arc,p),q);
   const value=evaluatePlaneAtAlgebraicPoint3({normal:d,offset:zero},p),D=d.x.mul(d.x).add(d.y.mul(d.y)).add(d.z.mul(d.z));assert.ok(value.polynomial.degree<=8);assert.equal(value.affine(one.div(D)).compare(cylinderHeight3(a,p)),0);
  }}
 }
});
