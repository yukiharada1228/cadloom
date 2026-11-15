import {Polynomial} from '../numeric/polynomial.js';
import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {Sign} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
import {point3,vector3,dot3} from './point3.js';
import type {Point3,Vector3} from './point3.js';

export interface AlgebraicCoordinates3 {readonly x:AlgebraicReal;readonly y:AlgebraicReal;readonly z:AlgebraicReal;}
/** Correlated coordinates origin + parameter * direction over rational 3-space. */
export interface AlgebraicPoint3 extends AlgebraicCoordinates3 {
  readonly origin:Point3;readonly direction:Vector3;readonly parameter:AlgebraicReal;
}
type Parameterization3=Readonly<Pick<AlgebraicPoint3,'origin'|'direction'|'parameter'>>;
const parameters=new WeakMap<AlgebraicCoordinates3,Parameterization3>();
// Factory coordinate records are already deeply immutable. Preserve their identity
// so construction-specific weak registries survive internal snapshots.
const coordinatePoints=new WeakSet<AlgebraicCoordinates3>();
/** Internal construction registry; extra public object properties are never trusted. */
export function getPointParameterization3(point:AlgebraicCoordinates3):Parameterization3|undefined{return parameters.get(point);}
export function algebraicCoordinates3(x:AlgebraicReal|ExactInput,y:AlgebraicReal|ExactInput,z:AlgebraicReal|ExactInput=0n):AlgebraicCoordinates3 {
  const real=(v:AlgebraicReal|ExactInput)=>v instanceof AlgebraicReal?v:AlgebraicReal.fromRational(v);
  const point=Object.freeze({x:real(x),y:real(y),z:real(z)});coordinatePoints.add(point);return point;
}
export function algebraicPoint3(origin:Point3,direction:Vector3,parameter:AlgebraicReal):AlgebraicPoint3 {
  const o=point3(origin.x,origin.y,origin.z),d=vector3(direction.x,direction.y,direction.z);
  const result=Object.freeze({origin:o,direction:d,parameter,x:parameter.affine(d.x,o.x),y:parameter.affine(d.y,o.y),z:parameter.affine(d.z,o.z)});
  parameters.set(result,Object.freeze({origin:o,direction:d,parameter}));return result;
}
/** Internal immutable snapshot preserving only registered coordinate correlations. */
export function snapshotExactPoint3(point:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  if(coordinatePoints.has(point as AlgebraicCoordinates3))return point as AlgebraicCoordinates3;
  const data=parameters.get(point as AlgebraicCoordinates3);
  return data?algebraicPoint3(data.origin,data.direction,data.parameter):algebraicCoordinates3(point.x,point.y,point.z);
}
export function compareAlgebraicPoints3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  return a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z);
}
/** Rational translation preserving only factory-recorded affine correlation. */
export function translateAlgebraicPoint3(input:Point3|AlgebraicCoordinates3,translation:Vector3):AlgebraicCoordinates3 {
  const p=snapshotExactPoint3(input),v=vector3(translation.x,translation.y,translation.z),data=parameters.get(p),rational=rationalParameters.get(p),pair=biparameters.get(p);
  if(data)return algebraicPoint3(point3(data.origin.x.add(v.x),data.origin.y.add(v.y),data.origin.z.add(v.z)),data.direction,data.parameter);
  if(rational)return algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.add(rational.denominator.scale(v[(['x','y','z'] as const)[i]!]))) as [Polynomial,Polynomial,Polynomial],rational.denominator);
  if(pair)return algebraicBiparametricPoint3(point3(pair.origin.x.add(v.x),pair.origin.y.add(v.y),pair.origin.z.add(v.z)),pair.u,pair.s,pair.v,pair.t);
  return algebraicCoordinates3(p.x.affine(1n,v.x),p.y.affine(1n,v.y),p.z.affine(1n,v.z));
}
/** Componentwise a-b. Shared affine parameters avoid unnecessary field extensions. */
export function subtractAlgebraicPoints3(inputA:Point3|AlgebraicCoordinates3,inputB:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const a=snapshotExactPoint3(inputA),b=snapshotExactPoint3(inputB),A=parameters.get(a),B=parameters.get(b);
  if(A&&B&&A.parameter.compare(B.parameter)===0)return algebraicPoint3(point3(A.origin.x.sub(B.origin.x),A.origin.y.sub(B.origin.y),A.origin.z.sub(B.origin.z)),vector3(A.direction.x.sub(B.direction.x),A.direction.y.sub(B.direction.y),A.direction.z.sub(B.direction.z)),A.parameter);
  const sub=(k:'x'|'y'|'z')=>a[k].compare(b[k])===0?AlgebraicReal.fromRational(0n):a[k].sub(b[k]);
  return algebraicCoordinates3(sub('x'),sub('y'),sub('z'));
}

export interface Biparameterization3 {readonly origin:Point3;readonly u:Vector3;readonly s:AlgebraicReal;readonly v:Vector3;readonly t:AlgebraicReal;}
const biparameters=new WeakMap<AlgebraicCoordinates3,Biparameterization3>();
/** Internal rational affine chart with two exact algebraic parameters. No
 * relation between parameters is assumed; predicates expand the full polynomial.
 */
export function algebraicBiparametricPoint3(origin:Point3,u:Vector3,s:AlgebraicReal,v:Vector3,t:AlgebraicReal):AlgebraicCoordinates3 {
  const o=point3(origin.x,origin.y,origin.z),U=vector3(u.x,u.y,u.z),V=vector3(v.x,v.y,v.z),p=algebraicCoordinates3(s.affine(U.x,o.x).add(t.affine(V.x)),s.affine(U.y,o.y).add(t.affine(V.y)),s.affine(U.z,o.z).add(t.affine(V.z)));
  biparameters.set(p,Object.freeze({origin:o,u:U,s,v:V,t}));return p;
}
export function getBiparameterization3(p:AlgebraicCoordinates3):Biparameterization3|undefined{return biparameters.get(p);}
/** Exact sign of c + a*s + b*t + A*s² + B*s*t + C*t². */
export function signBiparametricQuadratic3(p:Biparameterization3,c:Rational,a:Rational,b:Rational,A:Rational,B:Rational,C:Rational):Sign {
  if(b.sign()===0&&B.sign()===0&&C.sign()===0)return p.s.signOf(new Polynomial([c,a,A]));
  if(a.sign()===0&&A.sign()===0&&B.sign()===0)return p.t.signOf(new Polynomial([c,b,C]));
  const base=p.s.rationalFunction(new Polynomial([c,a,A])),linear=b.sign()!==0||B.sign()!==0?p.s.affine(B,b).mul(p.t):null,quadratic=C.sign()!==0?p.t.rationalFunction(new Polynomial([0n,0n,C])):null;
  if(!linear)return quadratic?base.compare(quadratic.neg()):base.sign();
  if(!quadratic)return base.compare(linear.neg());
  return base.add(linear).compare(quadratic.neg());
}

export interface RationalParameterization3 {readonly parameter:AlgebraicReal;readonly numerators:readonly [Polynomial,Polynomial,Polynomial];readonly denominator:Polynomial;}
const rationalParameters=new WeakMap<AlgebraicCoordinates3,RationalParameterization3>();
/** Internal exact rational-function image of one algebraic source parameter. */
export function algebraicRationalPoint3(parameter:AlgebraicReal,numerators:readonly [Polynomial,Polynomial,Polynomial],denominator=new Polynomial([1n])):AlgebraicCoordinates3 {
  if(parameter.signOf(denominator)===0)throw new RangeError('Rational point denominator is zero');
  const values=numerators.map(n=>parameter.rationalFunction(n,denominator)),point=algebraicCoordinates3(values[0]!,values[1]!,values[2]!);
  rationalParameters.set(point,Object.freeze({parameter,numerators:Object.freeze([...numerators]) as readonly [Polynomial,Polynomial,Polynomial],denominator}));return point;
}
export function getRationalParameterization3(point:AlgebraicCoordinates3):RationalParameterization3|undefined{return rationalParameters.get(point);}
export function rationalPointLinearNumerator3(p:RationalParameterization3,n:Vector3,offset:Rational):Polynomial {
  return p.numerators[0].scale(n.x).add(p.numerators[1].scale(n.y)).add(p.numerators[2].scale(n.z)).add(p.denominator.scale(offset));
}
export function rationalPointSphereNumerator3(p:RationalParameterization3,center:Point3,radiusSquared:Rational):Polynomial {
  return p.numerators.reduce((sum,N,i)=>{const q=N.sub(p.denominator.scale(center[(['x','y','z'] as const)[i]!]));return sum.add(q.mul(q));},new Polynomial()).sub(p.denominator.mul(p.denominator).scale(radiusSquared));
}

/** Internal exact linear sign without constructing an unnecessary compositum. */
export function signLinearAlgebraicPoint3(point:AlgebraicCoordinates3,normal:Vector3,offset:Rational):Sign {
 const affine=parameters.get(point),rational=rationalParameters.get(point),pair=biparameters.get(point);
 if(affine)return affine.parameter.signOf(new Polynomial([dot3(normal,affine.origin).add(offset),dot3(normal,affine.direction)]));
 if(rational){const sign=rational.parameter.signOf(rationalPointLinearNumerator3(rational,normal,offset));return sign===0?0:sign*rational.parameter.signOf(rational.denominator) as Sign;}
 if(pair)return pair.s.affine(dot3(normal,pair.u),dot3(normal,pair.origin).add(offset)).compare(pair.t.affine(dot3(normal,pair.v)).neg());
 const axes=['x','y','z'] as const,terms=axes.filter(k=>normal[k].sign()!==0).map(k=>point[k].affine(normal[k]));
 if(!terms.length)return offset.sign();if(terms.length===1)return terms[0]!.affine(1n,offset).sign();if(terms.length===2)return terms[0]!.affine(1n,offset).compare(terms[1]!.neg());
 // Certified rational interval separation is only a fast filter. An unresolved
 // interval (including exact zero) falls back to complete algebraic comparison.
 let refined=terms;for(let i=0;i<16;i++){const lo=refined.reduce((sum,p)=>sum.add(p.lower),offset),hi=refined.reduce((sum,p)=>sum.add(p.upper),offset);if(lo.sign()>0)return 1;if(hi.sign()<0)return -1;if(lo.sign()===0&&hi.sign()===0)return 0;refined=refined.map(p=>p.refine());}
 return terms[0]!.add(terms[1]!).affine(1n,offset).compare(terms[2]!.neg());
}

/** Internal exact comparison of a rational linear form and an algebraic constant. */
export function compareLinearAlgebraicPoint3(point:AlgebraicCoordinates3,normal:Vector3,constant:AlgebraicReal):Sign {
 const data=parameters.get(point),rational=rationalParameters.get(point),pair=biparameters.get(point);
 if(data)return data.parameter.affine(dot3(normal,data.direction),dot3(normal,data.origin)).compare(constant);
 if(rational)return rational.parameter.rationalFunction(rationalPointLinearNumerator3(rational,normal,new Rational(0n)),rational.denominator).compare(constant);
 const raw=pair?[pair.s.affine(dot3(normal,pair.u),dot3(normal,pair.origin)),pair.t.affine(dot3(normal,pair.v)),constant.neg()]:[...(['x','y','z'] as const).filter(k=>normal[k].sign()!==0).map(k=>point[k].affine(normal[k])),constant.neg()];let offset=new Rational(0n);const terms:AlgebraicReal[]=[];
 for(const t of raw){if(t.rational!==null)offset=offset.add(t.rational);else terms.push(t);}
 if(!terms.length)return offset.sign();if(terms.length===1)return terms[0]!.affine(1n,offset).sign();if(terms.length===2)return terms[0]!.affine(1n,offset).compare(terms[1]!.neg());
 let refined=terms;for(let i=0;i<16;i++){const lo=refined.reduce((sum,p)=>sum.add(p.lower),offset),hi=refined.reduce((sum,p)=>sum.add(p.upper),offset);if(lo.sign()>0)return 1;if(hi.sign()<0)return -1;if(lo.sign()===0&&hi.sign()===0)return 0;refined=refined.map(p=>p.refine());}
 return terms.slice(0,-1).reduce((sum,t)=>sum.add(t),AlgebraicReal.fromRational(offset)).compare(terms[terms.length-1]!.neg());
}
