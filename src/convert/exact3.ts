import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,countRealRoots,isolateRealRoots} from '../numeric/real-roots.js';
import {algebraicCoordinates3,algebraicPoint3,getPointParameterization3,algebraicRationalPoint3,algebraicBiparametricPoint3,getRationalParameterization3,getBiparameterization3} from '../geometry/algebraic-point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import {point3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import {RecordReader3} from '../record/schema.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {realSchema3,pointSchema3} from '../record/exact3.js';
import type {ExactRealRecord3,ExactPointRecord3,RationalPointRecord3} from '../record/exact3.js';

export function encodeExactReal3(value:AlgebraicReal|Rational):ExactRealRecord3 {
  if(value instanceof Rational)return Object.freeze({kind:'rational',value:value.toString()});const rational=value.rational;
  return rational?Object.freeze({kind:'rational',value:rational.toString()}):Object.freeze({kind:'root',polynomial:Object.freeze(value.polynomial.coefficients.map(c=>c.toString())),lower:value.lower.toString(),upper:value.upper.toString()});
}
/** Restores a real value only after checking a unique root in the OPEN interval. */
export function decodeExactReal3(input:ExactRealRecord3,limits:RecordReadLimits3={}):AlgebraicReal {
  const r=realSchema3(input,'real',new RecordReader3(limits)) as ExactRealRecord3;
  if(r.kind==='rational')return AlgebraicReal.fromRational(r.value);
  const p=new Polynomial(r.polynomial),lo=Rational.parse(r.lower),hi=Rational.parse(r.upper);
  if(p.degree<1||lo.compare(hi)>=0||p.evaluate(lo).sign()===0||p.evaluate(hi).sign()===0||countRealRoots(p,lo,hi)!==1)throw new RangeError('Invalid unique-root certificate');
  const root=isolateRealRoots(p).find(t=>t.compare(AlgebraicReal.fromRational(lo))>0&&t.compare(AlgebraicReal.fromRational(hi))<0);if(!root)throw new Error('Root certificate could not be restored');return root;
}
export function encodeRationalPoint3(p:Point3):RationalPointRecord3{return Object.freeze([p.x.toString(),p.y.toString(),p.z.toString()]);}
export function decodeRationalPoint3(p:RationalPointRecord3):Point3{return point3(p[0],p[1],p[2]);}
export function encodeExactPoint3(p:AlgebraicCoordinates3):ExactPointRecord3 {
  const r=getRationalParameterization3(p);if(r)return Object.freeze({kind:'rational-map',parameter:encodeExactReal3(r.parameter),numerators:Object.freeze(r.numerators.map(n=>Object.freeze(n.coefficients.map(c=>c.toString())))),denominator:Object.freeze(r.denominator.coefficients.map(c=>c.toString()))});
  const b=getBiparameterization3(p);if(b)return Object.freeze({kind:'biparametric',origin:encodeRationalPoint3(b.origin),u:encodeRationalPoint3(b.u),s:encodeExactReal3(b.s),v:encodeRationalPoint3(b.v),t:encodeExactReal3(b.t)});
  const a=getPointParameterization3(p);return a?Object.freeze({kind:'affine',origin:encodeRationalPoint3(a.origin),direction:encodeRationalPoint3(a.direction),parameter:encodeExactReal3(a.parameter)}):Object.freeze({kind:'coordinates',x:encodeExactReal3(p.x),y:encodeExactReal3(p.y),z:encodeExactReal3(p.z)});
}
export function decodeExactPoint3(input:ExactPointRecord3):AlgebraicCoordinates3 {
  const p=pointSchema3(input,'point',new RecordReader3()) as ExactPointRecord3;
  if(p.kind==='rational-map')return algebraicRationalPoint3(decodeExactReal3(p.parameter),p.numerators.map(n=>new Polynomial(n)) as [Polynomial,Polynomial,Polynomial],new Polynomial(p.denominator));
  if(p.kind==='biparametric')return algebraicBiparametricPoint3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.u),decodeExactReal3(p.s),decodeRationalPoint3(p.v),decodeExactReal3(p.t));
  return p.kind==='affine'?algebraicPoint3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction),decodeExactReal3(p.parameter)):algebraicCoordinates3(decodeExactReal3(p.x),decodeExactReal3(p.y),decodeExactReal3(p.z));
}
