import {snapshotExactPoint2,getPointParameterization2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,dot3,cross3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import type {Plane3} from './plane3.js';
import {snapshotExactPoint3,getQuadraticParameterization3,affineQuadraticPoint3,getPointParameterization3,getRationalParameterization3,getBiparameterization3,rationalPointLinearNumerator3,algebraicPoint3,algebraicCoordinates3,algebraicRationalPoint3,algebraicBiparametricPoint3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface AlgebraicAxialCoordinates3 {readonly base:AlgebraicCoordinates3;readonly direction:Vector3;}
const axial=new WeakMap<AlgebraicCoordinates3,AlgebraicAxialCoordinates3>(),axes=['x','y','z'] as const,zero=new Rational(0n),one=new Rational(1n);
const parallel=(a:Vector3,b:Vector3)=>{const c=cross3(a,b);return c.x.sign()===0&&c.y.sign()===0&&c.z.sign()===0;};
function direction(input:Vector3):Vector3 {const d=vector3(input.x,input.y,input.z);if(dot3(d,d).sign()===0)throw new RangeError('Axial construction requires a nonzero direction');return d;}
/** Read-only provenance from actual coordinate construction, never public flags. */
const derived=new WeakMap<AlgebraicCoordinates3,readonly AlgebraicAxialCoordinates3[]>();
function decompositions(point:AlgebraicCoordinates3):readonly AlgebraicAxialCoordinates3[] {
 const known=derived.get(point);if(known)return known;const result:AlgebraicAxialCoordinates3[]=[],a=getPointParameterization3(point),b=getBiparameterization3(point),q=getQuadraticParameterization3(point);
 if(a&&dot3(a.direction,a.direction).sign()!==0)result.push(Object.freeze({base:algebraicCoordinates3(a.origin.x,a.origin.y,a.origin.z),direction:a.direction}));
 if(q&&dot3(q.coefficients,q.coefficients).sign()!==0)result.push(Object.freeze({base:algebraicRationalPoint3(q.parameter,q.numerators,q.denominator),direction:q.coefficients}));
 if(b){if(dot3(b.v,b.v).sign()!==0)result.push(Object.freeze({base:algebraicPoint3(b.origin,b.u,b.s),direction:b.v}));if(dot3(b.u,b.u).sign()!==0)result.push(Object.freeze({base:algebraicPoint3(b.origin,b.v,b.t),direction:b.u}));}const frozen=Object.freeze(result);derived.set(point,frozen);return frozen;
}
export function getAlgebraicAxialCoordinates3(point:AlgebraicCoordinates3,wanted?:Vector3):AlgebraicAxialCoordinates3|undefined {const own=axial.get(point);return own&&(!wanted||parallel(own.direction,wanted))?own:decompositions(point).find(a=>!wanted||parallel(a.direction,wanted));}
export function getAlgebraicAxialDirections3(point:AlgebraicCoordinates3):readonly Vector3[] {const own=axial.get(point);return Object.freeze([...(own?[own]:[]),...decompositions(point)].map(a=>a.direction).filter((d,i,all)=>all.findIndex(e=>parallel(d,e))===i));}
/** Construct q+t*d, retaining the exact line decomposition even when q and t
 * require several different algebraic source fields. */
export function algebraicAxialPoint3(input:Point3|AlgebraicCoordinates3,inputDirection:Vector3,t:AlgebraicReal):AlgebraicCoordinates3 {
 const inherited=axial.get(input as AlgebraicCoordinates3),q=snapshotExactPoint3(input),d=direction(inputDirection),data=getPointParameterization3(q),p=t.rational!==null?translateAlgebraicPoint3(q,point3(d.x.mul(t.rational),d.y.mul(t.rational),d.z.mul(t.rational))):data?algebraicBiparametricPoint3(data.origin,data.direction,data.parameter,d,t):algebraicCoordinates3(...axes.map(k=>q[k].add(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
 axial.set(p,Object.freeze({base:inherited&&parallel(inherited.direction,d)?inherited.base:q,direction:d}));return p;
}
/** Construct the intersection with a rational plane along d. Each branch
 * computes the affine projection; no caller-provided point is certified. */
export function projectAlgebraicPointAlongDirection3(input:Point3|AlgebraicCoordinates3,inputDirection:Vector3,inputPlane:Plane3):AlgebraicCoordinates3 {
 const inherited=axial.get(input as AlgebraicCoordinates3),q=snapshotExactPoint3(input),d=direction(inputDirection),normal=vector3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z),offset=inputPlane.offset,a=dot3(normal,d);if(a.sign()===0)throw new RangeError('Projection direction is parallel to the target plane');
 const map=(v:Point3,vector=false)=>{const t=dot3(normal,v).add(vector?zero:offset).div(a);return point3(...axes.map(k=>v[k].sub(d[k].mul(t))) as [Rational,Rational,Rational]);},rational=getRationalParameterization3(q),affine=getPointParameterization3(q),pair=getBiparameterization3(q),quadratic=getQuadraticParameterization3(q);let p:AlgebraicCoordinates3;
 if(rational){const T=rationalPointLinearNumerator3(rational,normal,offset).scale(one.div(a));p=algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(d[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
 else if(affine)p=algebraicPoint3(map(affine.origin),map(affine.direction,true),affine.parameter);
 else if(pair)p=algebraicBiparametricPoint3(map(pair.origin),map(pair.u,true),pair.s,map(pair.v,true),pair.t);
 else if(quadratic)p=affineQuadraticPoint3(quadratic,map(point3(0n,0n)),[map(point3(1n,0n),true),map(point3(0n,1n),true),map(point3(0n,0n,1n),true)]);
 else p=algebraicCoordinates3(...axes.map(k=>{const terms=axes.map(j=>({value:q[j],coefficient:(j===k?one:zero).sub(d[k].mul(normal[j]).div(a))})).filter(t=>t.coefficient.sign()!==0);return terms.reduce((sum,t)=>sum.add(t.value.affine(t.coefficient)),q[k].affine(0n,d[k].mul(offset).div(a).neg()));}) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
 axial.set(p,Object.freeze({base:inherited&&parallel(inherited.direction,d)?inherited.base:q,direction:d}));return p;
}

/** Construct a planar map with its true fixed-x line decomposition. The
 * original common-parameter affine chart is retained when it exists. */
export function algebraicPlanePoint3(input:PlaneFrame3,inputPoint:Point2|AlgebraicCoordinates2):AlgebraicCoordinates3 {
 const o=point3(input.origin.x,input.origin.y,input.origin.z),u=vector3(input.u.x,input.u.y,input.u.z),v=vector3(input.v.x,input.v.y,input.v.z),n=cross3(u,v);if(dot3(n,n).sign()===0)throw new RangeError('Plane frame directions must be independent');const q=snapshotExactPoint2(inputPoint),data=getPointParameterization2(q),map=(a:Point2,vector=false)=>point3(...axes.map(k=>u[k].mul(a.x).add(v[k].mul(a.y)).add(vector?zero:o[k])) as [Rational,Rational,Rational]),p=data?algebraicPoint3(map(data.origin),map(data.direction,true),data.parameter):algebraicBiparametricPoint3(o,u,q.x,v,q.y),base=algebraicPoint3(o,u,q.x);axial.set(p,Object.freeze({base,direction:v}));return p;
}
