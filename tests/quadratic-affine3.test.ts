import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,point3,vector3,line3,cylinder3,plane3,classifyPointToSurface3} from '../dist/index.js';
import {algebraicQuadraticPoint3,getQuadraticParameterization3,getRationalParameterization3,affineQuadraticPoint3} from '../dist/geometry/algebraic-point3.js';
import {projectAlgebraicPointAlongDirection3} from '../dist/geometry/algebraic-axial-point3.js';
import {cylinderCoordinates3} from '../dist/geometry/cylinder-coordinates3.js';
const O=point3(0n,0n),X=vector3(1n,0n),Z=vector3(0n,0n,1n),r=AlgebraicReal.fromRational(2n).sqrt(),s=AlgebraicReal.fromRational(3n).sqrt(),p=algebraicQuadraticPoint3(r,[new Polynomial([0n,1n]),new Polynomial(),new Polynomial()],vector3(0n,1n),new Polynomial([3n]));
test('rational affine maps preserve the shared quadratic field and reduce radical-free maps to RUR',()=>{
 const data=getQuadraticParameterization3(p)!,mapped=affineQuadraticPoint3(data,point3(1n,2n,3n),[X,vector3(0n,2n),vector3(1n,1n,1n)]);assert.equal(getQuadraticParameterization3(mapped)!.parameter,r);assert.equal(mapped.x.compare(r.affine(1n,1n)),0);assert.equal(mapped.y.compare(s.affine(2n,2n)),0);assert.equal(mapped.z.rational!.toString(),'3');
 const projected=affineQuadraticPoint3(data,O,[X,O,O]);assert.equal(getQuadraticParameterization3(projected),undefined);assert.equal(getRationalParameterization3(projected)!.parameter,r);assert.equal(projected.x.compare(r),0);assert.equal(projected.y.rational!.sign(),0);assert.equal(projected.z.rational!.sign(),0);
});
test('plane and nonunit cylinder projections retain quadratic coordinate correlations',()=>{
 const onPlane=projectAlgebraicPointAlongDirection3(p,Z,plane3(-1n,-1n,1n));assert.ok(getQuadraticParameterization3(onPlane));assert.equal(classifyPointToSurface3(onPlane,{kind:'plane',plane:plane3(-1n,-1n,1n)}),0);assert.equal(onPlane.z.compare(r.add(s)),0);assert.ok(onPlane.z.polynomial.degree<=4);
 const c=cylinder3(line3(O,vector3(1n,1n,1n)),1n),coordinates=cylinderCoordinates3(c,p);assert.ok(getQuadraticParameterization3(coordinates.base));assert.equal(coordinates.height.compare(r.add(s).affine('1/3')),0);assert.equal(classifyPointToSurface3(coordinates.base,{kind:'plane',plane:plane3(1n,1n,1n)}),0);assert.equal(coordinates.base.x.compare(r.affine('2/3').add(s.affine('-1/3'))),0);assert.equal(coordinates.base.y.compare(r.affine('-1/3').add(s.affine('2/3'))),0);
});
