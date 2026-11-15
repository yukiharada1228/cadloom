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
const coordinateForms3=[['x',point3(1n,0n)],['y',point3(0n,1n)],['z',point3(0n,0n,1n)]] as const;
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
  return data?point as AlgebraicCoordinates3:algebraicCoordinates3(point.x,point.y,point.z);
}
/** Exact equality with a necessary box-separation filter. Unlike lexicographic
 * ordering, equality may reject on any disjoint coordinate before refining x. */
export function algebraicPointsEqual3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):boolean {
 if(a===b)return true;for(const k of ['x','y','z'] as const)if(a[k].upper.compare(b[k].lower)<0||b[k].upper.compare(a[k].lower)<0)return false;return compareAlgebraicPoints3(a,b)===0;
}
export function compareAlgebraicPoints3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):Sign {
  if(a===b)return 0;
  for(const [k,n] of coordinateForms3){const common=compareCommonLinearSource3(a,b,n),sign=common??a[k].compare(b[k]);if(sign!==0)return sign;}return 0;
}
/** Rational translation preserving only factory-recorded affine correlation. */
export function translateAlgebraicPoint3(input:Point3|AlgebraicCoordinates3,translation:Vector3):AlgebraicCoordinates3 {
  const p=snapshotExactPoint3(input),v=vector3(translation.x,translation.y,translation.z),data=parameters.get(p),rational=rationalParameters.get(p),pair=biparameters.get(p);
  if(data)return algebraicPoint3(point3(data.origin.x.add(v.x),data.origin.y.add(v.y),data.origin.z.add(v.z)),data.direction,data.parameter);
  if(rational){
    // Each coordinate image is already certified. Rational translation shifts
    // its polynomial directly; do not eliminate the source parameter again.
    const point=algebraicCoordinates3(p.x.affine(1n,v.x),p.y.affine(1n,v.y),p.z.affine(1n,v.z)),numerators=rational.numerators.map((N,i)=>N.add(rational.denominator.scale(v[(['x','y','z'] as const)[i]!]))) as [Polynomial,Polynomial,Polynomial];
    rationalParameters.set(point,Object.freeze({parameter:rational.parameter,numerators:Object.freeze(numerators),denominator:rational.denominator}));return point;
  }
  const quadratic=quadraticParameters.get(p);if(quadratic){const point=algebraicCoordinates3(p.x.affine(1n,v.x),p.y.affine(1n,v.y),p.z.affine(1n,v.z)),numerators=quadratic.numerators.map((N,i)=>N.add(quadratic.denominator.scale(v[(['x','y','z'] as const)[i]!]))) as [Polynomial,Polynomial,Polynomial];quadraticParameters.set(point,Object.freeze({...quadratic,numerators:Object.freeze(numerators)}));return point;}
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
  // Enclose the polynomial before constructing a field containing both roots.
  // Dependency only widens these intervals; unresolved signs use the complete
  // calculation below, including all cancellations and exact zeros.
  type Bounds=readonly [Rational,Rational];
  const mul=(x:Bounds,y:Bounds):Bounds=>{const v=[x[0].mul(y[0]),x[0].mul(y[1]),x[1].mul(y[0]),x[1].mul(y[1])].sort((a,b)=>a.compare(b));return [v[0]!,v[3]!];};
  let s=p.s,t=p.t;for(let i=0;i<8;i++){
    const S:Bounds=[s.lower,s.upper],T:Bounds=[t.lower,t.upper],terms:readonly [Rational,Bounds][]=[[a,S],[b,T],[A,mul(S,S)],[B,mul(S,T)],[C,mul(T,T)]];let lo=c,hi=c;
    for(const [coefficient,v] of terms){if(coefficient.sign()>=0){lo=lo.add(coefficient.mul(v[0]));hi=hi.add(coefficient.mul(v[1]));}else{lo=lo.add(coefficient.mul(v[1]));hi=hi.add(coefficient.mul(v[0]));}}
    if(lo.sign()>0)return 1;if(hi.sign()<0)return -1;if(lo.sign()===0&&hi.sign()===0)return 0;s=s.refine();t=t.refine();
  }
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
export interface QuadraticParameterization3 extends RationalParameterization3 {readonly coefficients:Vector3;readonly radicand:Polynomial;}
const quadraticParameters=new WeakMap<AlgebraicCoordinates3,QuadraticParameterization3>();
/** Construct each coordinate in one shared quadratic extension. Public fields
 * cannot register a point; only these actual coordinate constructions do. */
export function algebraicQuadraticPoint3(parameter:AlgebraicReal,numerators:readonly [Polynomial,Polynomial,Polynomial],coefficients:Vector3,radicand:Polynomial,denominator=new Polynomial([1n])):AlgebraicCoordinates3 {
 const c=vector3(coefficients.x,coefficients.y,coefficients.z),N=Object.freeze([...numerators]) as readonly [Polynomial,Polynomial,Polynomial],axes=['x','y','z'] as const,p=algebraicCoordinates3(...axes.map((k,i)=>parameter.quadraticImage(N[i]!,radicand,c[k],denominator)) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);quadraticParameters.set(p,Object.freeze({parameter,numerators:N,coefficients:c,radicand,denominator}));return p;
}
export function getQuadraticParameterization3(point:AlgebraicCoordinates3):QuadraticParameterization3|undefined{return quadraticParameters.get(point);}
/** Construct o + U*x + V*y + W*z in the same source field. A map that
 * annihilates the radical returns a genuine rational-univariate chart. */
export function affineQuadraticPoint3(p:QuadraticParameterization3,origin:Point3,columns:readonly [Vector3,Vector3,Vector3]):AlgebraicCoordinates3 {
 const o=point3(origin.x,origin.y,origin.z),[U,V,W]=columns.map(c=>vector3(c.x,c.y,c.z)),axes=['x','y','z'] as const,rows=axes.map(k=>vector3(U![k],V![k],W![k])),N=rows.map((row,i)=>rationalPointLinearNumerator3(p,row,o[axes[i]!])) as [Polynomial,Polynomial,Polynomial],c=vector3(...rows.map(row=>dot3(row,p.coefficients)) as [Rational,Rational,Rational]);
 return c.x.sign()===0&&c.y.sign()===0&&c.z.sign()===0?algebraicRationalPoint3(p.parameter,N,p.denominator):algebraicQuadraticPoint3(p.parameter,N,c,p.radicand,p.denominator);
}
export function quadraticPointLinearParts3(p:QuadraticParameterization3,n:Vector3,offset=new Rational(0n)):{numerator:Polynomial;coefficient:Rational} {
 return {numerator:rationalPointLinearNumerator3(p,n,offset),coefficient:dot3(p.coefficients,n)};
}
export function quadraticPointLinearValue3(p:QuadraticParameterization3,n:Vector3,offset=new Rational(0n)):AlgebraicReal {const v=quadraticPointLinearParts3(p,n,offset);return p.parameter.quadraticImage(v.numerator,p.radicand,v.coefficient,p.denominator);}
/** Sign of constant + sum(weight * (normal·point+offset)^2). D² is positive. */
export function signQuadraticPointSquaredForms3(p:QuadraticParameterization3,forms:readonly {readonly normal:Vector3;readonly offset:Rational;readonly weight:Rational}[],constant:Rational):Sign {
 let A=p.denominator.mul(p.denominator).scale(constant),B=new Polynomial();for(const f of forms){const v=quadraticPointLinearParts3(p,f.normal,f.offset);A=A.add(v.numerator.mul(v.numerator).add(p.radicand.scale(v.coefficient.mul(v.coefficient))).scale(f.weight));B=B.add(v.numerator.scale(v.coefficient.mul(f.weight).mul(new Rational(2n))));}return p.parameter.signQuadratic(A,B,p.radicand);
}
export function rationalPointLinearNumerator3(p:RationalParameterization3,n:Vector3,offset:Rational):Polynomial {
  return p.numerators[0].scale(n.x).add(p.numerators[1].scale(n.y)).add(p.numerators[2].scale(n.z)).add(p.denominator.scale(offset));
}
export function rationalPointSphereNumerator3(p:RationalParameterization3,center:Point3,radiusSquared:Rational):Polynomial {
  return p.numerators.reduce((sum,N,i)=>{const q=N.sub(p.denominator.scale(center[(['x','y','z'] as const)[i]!]));return sum.add(q.mul(q));},new Polynomial()).sub(p.denominator.mul(p.denominator).scale(radiusSquared));
}

/** Internal exact linear sign without constructing an unnecessary compositum. */
export function signLinearAlgebraicPoint3(point:AlgebraicCoordinates3,normal:Vector3,offset:Rational):Sign {
 const quadratic=quadraticParameters.get(point);if(quadratic){const v=quadraticPointLinearParts3(quadratic,normal,offset),sign=quadratic.parameter.signQuadratic(v.numerator,new Polynomial([v.coefficient]),quadratic.radicand);return sign===0?0:sign*quadratic.parameter.signOf(quadratic.denominator) as Sign;}
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
 const quadratic=quadraticParameters.get(point);if(quadratic)return quadraticPointLinearValue3(quadratic,normal).compare(constant);
 const data=parameters.get(point),rational=rationalParameters.get(point),pair=biparameters.get(point);
 if(data)return data.parameter.affine(dot3(normal,data.direction),dot3(normal,data.origin)).compare(constant);
 if(rational)return rational.parameter.rationalFunction(rationalPointLinearNumerator3(rational,normal,new Rational(0n)),rational.denominator).compare(constant);
 const raw=pair?[pair.s.affine(dot3(normal,pair.u),dot3(normal,pair.origin)),pair.t.affine(dot3(normal,pair.v)),constant.neg()]:[...(['x','y','z'] as const).filter(k=>normal[k].sign()!==0).map(k=>point[k].affine(normal[k])),constant.neg()];let offset=new Rational(0n);const terms:AlgebraicReal[]=[];
 for(const t of raw){if(t.rational!==null)offset=offset.add(t.rational);else terms.push(t);}
 if(!terms.length)return offset.sign();if(terms.length===1)return terms[0]!.affine(1n,offset).sign();if(terms.length===2)return terms[0]!.affine(1n,offset).compare(terms[1]!.neg());
 let refined=terms;for(let i=0;i<16;i++){const lo=refined.reduce((sum,p)=>sum.add(p.lower),offset),hi=refined.reduce((sum,p)=>sum.add(p.upper),offset);if(lo.sign()>0)return 1;if(hi.sign()<0)return -1;if(lo.sign()===0&&hi.sign()===0)return 0;refined=refined.map(p=>p.refine());}
 return terms.slice(0,-1).reduce((sum,t)=>sum.add(t),AlgebraicReal.fromRational(offset)).compare(terms[terms.length-1]!.neg());
}

/** Exact comparison of two rational linear projections, without constructing
 * independent algebraic images when rational intervals already separate them. */
interface LinearSource3 {readonly parameter:AlgebraicReal;readonly numerator:Polynomial;readonly denominator:Polynomial;readonly coefficient:Rational;readonly radicand:Polynomial|null;}
function linearSource3(p:AlgebraicCoordinates3,n:Vector3):LinearSource3|undefined {
 const zero=new Rational(0n),quadratic=quadraticParameters.get(p);if(quadratic){const v=quadraticPointLinearParts3(quadratic,n);return {...quadratic,numerator:v.numerator,coefficient:v.coefficient};}
 const rational=rationalParameters.get(p);if(rational)return {...rational,numerator:rationalPointLinearNumerator3(rational,n,zero),coefficient:zero,radicand:null};
 const affine=parameters.get(p);if(affine)return {parameter:affine.parameter,numerator:new Polynomial([dot3(n,affine.origin),dot3(n,affine.direction)]),denominator:new Polynomial([1n]),coefficient:zero,radicand:null};return undefined;
}
/** Compare inside one actual shared source field before making image values.
 * Different parameters/radicands leave the complete general path unchanged. */
function compareCommonLinearSource3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3,n:Vector3):Sign|undefined {
 const A=linearSource3(a,n),B=linearSource3(b,n);if(!A||!B||A.radicand&&B.radicand&&!A.radicand.equals(B.radicand)||A.parameter!==B.parameter&&A.parameter.compare(B.parameter)!==0)return undefined;
 const numerator=A.numerator.mul(B.denominator).sub(B.numerator.mul(A.denominator)),radicand=A.radicand??B.radicand,coefficient=B.denominator.scale(A.coefficient).sub(A.denominator.scale(B.coefficient)),sign=radicand?A.parameter.signQuadratic(numerator,coefficient,radicand):A.parameter.signOf(numerator);
 return sign===0?0:sign*A.parameter.signOf(A.denominator)*A.parameter.signOf(B.denominator) as Sign;
}
export function compareLinearPoints3(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3,n:Vector3):Sign {
 if(a===b)return 0;const axes=['x','y','z'] as const,active=axes.filter(k=>n[k].sign()!==0);if(!active.length)return 0;const common=compareCommonLinearSource3(a,b,n);if(common!==undefined)return common;if(active.length===1){const k=active[0]!;const sign=a[k].compare(b[k]);return sign===0?0:sign*n[k].sign() as Sign;}let A=axes.map(k=>a[k]),B=axes.map(k=>b[k]);const interval=(p:readonly AlgebraicReal[])=>{let lo=new Rational(0n),hi=new Rational(0n);axes.forEach((k,i)=>{const value=p[i]!,positive=n[k].sign()>=0;lo=lo.add((positive?value.lower:value.upper).mul(n[k]));hi=hi.add((positive?value.upper:value.lower).mul(n[k]));});return {lo,hi};};
 for(let i=0;i<16;i++){const x=interval(A),y=interval(B);if(x.hi.compare(y.lo)<0)return -1;if(x.lo.compare(y.hi)>0)return 1;if(x.lo.compare(x.hi)===0&&y.lo.compare(y.hi)===0)return x.lo.compare(y.lo);A=A.map(p=>p.refine());B=B.map(p=>p.refine());}
 const affine=getPointParameterization3(b),rational=getRationalParameterization3(b),pair=getBiparameterization3(b),quadratic=getQuadraticParameterization3(b),zero=new Rational(0n),constant=quadratic?quadraticPointLinearValue3(quadratic,n):affine?affine.parameter.affine(dot3(n,affine.direction),dot3(n,affine.origin)):rational?rational.parameter.rationalFunction(rationalPointLinearNumerator3(rational,n,zero),rational.denominator):pair?pair.s.affine(dot3(n,pair.u),dot3(n,pair.origin)).add(pair.t.affine(dot3(n,pair.v))):b.x.affine(n.x).add(b.y.affine(n.y)).add(b.z.affine(n.z));return compareLinearAlgebraicPoint3(a,n,constant);
}
