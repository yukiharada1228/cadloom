import {AlgebraicReal} from '../numeric/real-roots.js';
import type {Sign} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
import {point3,vector3} from './point3.js';
import type {Point3,Vector3} from './point3.js';

export interface AlgebraicCoordinates3 {readonly x:AlgebraicReal;readonly y:AlgebraicReal;readonly z:AlgebraicReal;}
/** Correlated coordinates origin + parameter * direction over rational 3-space. */
export interface AlgebraicPoint3 extends AlgebraicCoordinates3 {
  readonly origin:Point3;readonly direction:Vector3;readonly parameter:AlgebraicReal;
}
type Parameterization3=Readonly<Pick<AlgebraicPoint3,'origin'|'direction'|'parameter'>>;
const parameters=new WeakMap<AlgebraicCoordinates3,Parameterization3>();
/** Internal construction registry; extra public object properties are never trusted. */
export function getPointParameterization3(point:AlgebraicCoordinates3):Parameterization3|undefined{return parameters.get(point);}
export function algebraicCoordinates3(x:AlgebraicReal|ExactInput,y:AlgebraicReal|ExactInput,z:AlgebraicReal|ExactInput=0n):AlgebraicCoordinates3 {
  const real=(v:AlgebraicReal|ExactInput)=>v instanceof AlgebraicReal?v:AlgebraicReal.fromRational(v);
  return Object.freeze({x:real(x),y:real(y),z:real(z)});
}
export function algebraicPoint3(origin:Point3,direction:Vector3,parameter:AlgebraicReal):AlgebraicPoint3 {
  const o=point3(origin.x,origin.y,origin.z),d=vector3(direction.x,direction.y,direction.z);
  const result=Object.freeze({origin:o,direction:d,parameter,x:parameter.affine(d.x,o.x),y:parameter.affine(d.y,o.y),z:parameter.affine(d.z,o.z)});
  parameters.set(result,Object.freeze({origin:o,direction:d,parameter}));return result;
}
/** Internal immutable snapshot preserving only registered coordinate correlations. */
export function snapshotExactPoint3(point:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const data=parameters.get(point as AlgebraicCoordinates3);
  return data?algebraicPoint3(data.origin,data.direction,data.parameter):algebraicCoordinates3(point.x,point.y,point.z);
}
export function compareAlgebraicPoints3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  return a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z);
}
/** Rational translation preserving only factory-recorded affine correlation. */
export function translateAlgebraicPoint3(input:Point3|AlgebraicCoordinates3,translation:Vector3):AlgebraicCoordinates3 {
  const p=snapshotExactPoint3(input),v=vector3(translation.x,translation.y,translation.z),data=parameters.get(p);
  return data?algebraicPoint3(point3(data.origin.x.add(v.x),data.origin.y.add(v.y),data.origin.z.add(v.z)),data.direction,data.parameter):algebraicCoordinates3(p.x.affine(1n,v.x),p.y.affine(1n,v.y),p.z.affine(1n,v.z));
}
/** Componentwise a-b. Shared affine parameters avoid unnecessary field extensions. */
export function subtractAlgebraicPoints3(inputA:Point3|AlgebraicCoordinates3,inputB:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const a=snapshotExactPoint3(inputA),b=snapshotExactPoint3(inputB),A=parameters.get(a),B=parameters.get(b);
  if(A&&B&&A.parameter.compare(B.parameter)===0)return algebraicPoint3(point3(A.origin.x.sub(B.origin.x),A.origin.y.sub(B.origin.y),A.origin.z.sub(B.origin.z)),vector3(A.direction.x.sub(B.direction.x),A.direction.y.sub(B.direction.y),A.direction.z.sub(B.direction.z)),A.parameter);
  const sub=(k:'x'|'y'|'z')=>a[k].compare(b[k])===0?AlgebraicReal.fromRational(0n):a[k].sub(b[k]);
  return algebraicCoordinates3(sub('x'),sub('y'),sub('z'));
}
