import {Rational} from '../numeric/rational.js';
import {compareAlgebraicPoints3} from '../geometry/algebraic-point3.js';
import {decodeExactPoint3,decodeExactReal3} from './exact3.js';
import type {ExactPointRecord3,ExactRealRecord3} from '../record/exact3.js';
import type {BodyRecord3} from '../record/body3.js';
/** Compare already validated, ordered recipe-output records semantically at
 * exact scalar/point fields. Not arbitrary BRep isomorphism or set equivalence.
 */
export function constructionRecordsAgree3(a:BodyRecord3,b:BodyRecord3):boolean {
  const rational=/^-?(?:0|[1-9][0-9]*)(?:\/[1-9][0-9]*)?$/;
  const same=(x:unknown,y:unknown):boolean=>{
    if(x===y)return true;
    if(typeof x==='string'&&typeof y==='string')return rational.test(x)&&rational.test(y)?Rational.parse(x).equals(Rational.parse(y)):false;
    if(x===null||y===null||typeof x!=='object'||typeof y!=='object')return false;
    if(Array.isArray(x)||Array.isArray(y))return Array.isArray(x)&&Array.isArray(y)&&x.length===y.length&&x.every((v,i)=>same(v,y[i]));
    const X=x as Record<string,unknown>,Y=y as Record<string,unknown>,point=(k:unknown)=>k==='affine'||k==='coordinates'||k==='rational-map'||k==='biparametric'||k==='quadratic-map',real=(k:unknown)=>k==='root'||k==='rational';
    if(point(X.kind)&&point(Y.kind))return compareAlgebraicPoints3(decodeExactPoint3(x as ExactPointRecord3),decodeExactPoint3(y as ExactPointRecord3))===0;
    if(real(X.kind)&&real(Y.kind))return decodeExactReal3(x as ExactRealRecord3).compare(decodeExactReal3(y as ExactRealRecord3))===0;
    const keys=Object.keys(X);return keys.length===Object.keys(Y).length&&keys.every(k=>Object.hasOwn(Y,k)&&same(X[k],Y[k]));
  };
  // Version-1 construction documents predating explicit domains are still
  // checked against every field they stored. Missing domains are regenerated.
  const expected={...b,faces:b.faces.map((f,i)=>{if(a.faces[i]?.domain!==undefined)return f;const {domain,...legacy}=f;return legacy;})};
  return same(a,expected);
}
