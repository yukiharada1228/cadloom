import {cylinderIntersectionPointCoordinates3} from './cylinder-cylinder3.js';
import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {point3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import type {Cylinder3} from './surface3.js';
import {snapshotExactPoint3,getPointParameterization3,getBiparameterization3,getRationalParameterization3,algebraicPoint3,algebraicCoordinates3,algebraicBiparametricPoint3,algebraicRationalPoint3,rationalPointLinearNumerator3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
const axes=['x','y','z'] as const;
/** Axial height alone; unlike full coordinates this does not construct the
 * radial projection, which can require unrelated high-degree root images. */
export function cylinderHeight3(cylinder:Cylinder3,input:Point3|AlgebraicCoordinates3){
 const p=snapshotExactPoint3(input),known=cylinderIntersectionPointCoordinates3(p,cylinder);if(known)return known.height;
 const d=cylinder.axis.direction;return evaluate({normal:d,offset:dot3(d,cylinder.axis.origin).neg()},p).affine(new Rational(1n).div(dot3(d,d)));
}
/** Internal exact axial projection, retaining registered coordinate correlations.
 * Defined off the surface too; callers separately check cylinder membership.
 */
export function cylinderCoordinates3(cylinder:Cylinder3,input:Point3|AlgebraicCoordinates3){
 const p=snapshotExactPoint3(input),known=cylinderIntersectionPointCoordinates3(p,cylinder);if(known)return known;
 const d=cylinder.axis.direction,o=cylinder.axis.origin,D=dot3(d,d),inv=new Rational(1n).div(D),offset=dot3(d,o).neg(),height=evaluate({normal:d,offset},p).affine(inv),project=(v:Point3,vector=false)=>{const t=dot3(d,vector?v:subtract3(v,o)).div(D);return point3(v.x.sub(d.x.mul(t)),v.y.sub(d.y.mul(t)),v.z.sub(d.z.mul(t)));};
 const affine=getPointParameterization3(p),pair=getBiparameterization3(p),rational=getRationalParameterization3(p);let base:AlgebraicCoordinates3;
 if(rational){const T=rationalPointLinearNumerator3(rational,d,offset).scale(inv);base=algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(d[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
 else if(affine)base=algebraicPoint3(project(affine.origin),project(affine.direction,true),affine.parameter);
 else if(pair)base=algebraicBiparametricPoint3(project(pair.origin),project(pair.u,true),pair.s,project(pair.v,true),pair.t);
 else base=algebraicCoordinates3(...axes.map(k=>p[k].sub(height.affine(d[k]))) as Parameters<typeof algebraicCoordinates3>);
 return {base,height};
}
