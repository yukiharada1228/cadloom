import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {exactRational} from '../numeric/polynomial.js';
import {rationalNullspace} from '../numeric/rational-nullspace.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import type {ExactInput} from './point2.js';
import {nurbsSurface3,nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurface3} from './nurbs-surface3.js';
import {nurbsSurfaceSeams3} from './nurbs-surface-regularity3.js';
import {witnessBivariateInequalities2} from './algebraic-curve-inequalities2.js';
import type {CurveRectangle2} from './algebraic-curve-topology2.js';
export interface NurbsTriangularProjectionCertificate3 {
 readonly surface:NurbsSurface3;readonly bounds:CurveRectangle2;
 readonly firstParameter:'u'|'v';readonly firstNormal:Point3;readonly secondNormal:Point3;
 readonly firstSign:1|-1;readonly secondSign:1|-1;
 readonly patches:readonly Readonly<{patch:number;bounds:CurveRectangle2}>[];
}
export type NurbsTriangularProjectionResult3=
 | Readonly<{kind:'certified';certificate:NurbsTriangularProjectionCertificate3}>
 | Readonly<{kind:'not-certified';surface:NurbsSurface3;bounds:CurveRectangle2;reason:'discontinuous-seam'|'no-triangular-projection'}>;
const owned=new WeakSet<NurbsTriangularProjectionCertificate3>(),keys=['x','y','z'] as const,min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;
export function assertOwnedNurbsTriangularProjection3(c:NurbsTriangularProjectionCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created triangular NURBS projection');}
/** Continuous triangular coordinate order proves injectivity on the closed
 * rectangle. Strict derivative signs are checked everywhere, not sampled. */
export function certifyNurbsSurfaceTriangularProjection3(input:NurbsSurface3,inputBounds?:Readonly<{uMin:ExactInput;uMax:ExactInput;vMin:ExactInput;vMax:ExactInput}>):NurbsTriangularProjectionResult3 {
 const surface=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),bounds=Object.freeze({uMin:exactRational(inputBounds?.uMin??surface.startU),uMax:exactRational(inputBounds?.uMax??surface.endU),vMin:exactRational(inputBounds?.vMin??surface.startV),vMax:exactRational(inputBounds?.vMax??surface.endV)});
 if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0||bounds.uMin.compare(surface.startU)<0||bounds.uMax.compare(surface.endU)>0||bounds.vMin.compare(surface.startV)<0||bounds.vMax.compare(surface.endV)>0)throw new RangeError('Triangular projection bounds must be a positive active rectangle');
 const all=nurbsSurfacePatches3(surface),patches=all.flatMap((p,patch)=>{const b=Object.freeze({uMin:max(bounds.uMin,p.startU),uMax:min(bounds.uMax,p.endU),vMin:max(bounds.vMin,p.startV),vMax:min(bounds.vMax,p.endV)});return b.uMin.compare(b.uMax)<0&&b.vMin.compare(b.vMax)<0?[{p,patch,bounds:b}]:[];}),ids=new Set(patches.map(p=>p.patch));
 if(nurbsSurfaceSeams3(all).some(s=>ids.has(s.firstPatch)&&ids.has(s.secondPatch)&&!s.continuous))return Object.freeze({kind:'not-certified',surface,bounds,reason:'discontinuous-seam'});
 const jets=patches.map(({p})=>({u:keys.map(k=>p[k].derivativeU().mul(p.weight).sub(p[k].mul(p.weight.derivativeU()))),v:keys.map(k=>p[k].derivativeV().mul(p.weight).sub(p[k].mul(p.weight.derivativeV())))}));
 const dot=(n:readonly Rational[],fs:readonly BivariatePolynomial[])=>fs.reduce((sum,f,i)=>sum.add(f.scale(n[i]!)),new BivariatePolynomial());
 const strictSign=(fs:readonly BivariatePolynomial[]):1|-1|0=>{const b=patches[0]!.bounds,s=fs[0]!.evaluate(b.uMin.add(b.uMax).div(new Rational(2n)),b.vMin.add(b.vMax).div(new Rational(2n))).sign();if(s===0)return 0;return fs.some((f,i)=>witnessBivariateInequalities2([s===1?f.scale(-1n):f],patches[i]!.bounds)!==null)?0:s;};
 for(const firstParameter of ['u','v'] as const){const second=firstParameter==='u'?'v':'u',rows:Rational[][]=[];
  for(const j of jets){const fs=j[second],du=Math.max(...fs.map(f=>f.degreeU)),dv=Math.max(...fs.map(f=>f.degreeV));for(let u=0;u<=du;u++)for(let v=0;v<=dv;v++){const row=fs.map(f=>f.coefficient(u,v));if(row.some(q=>q.sign()!==0))rows.push(row);}}
  const basis=rationalNullspace(rows,3),candidates=basis.map(v=>v.slice());for(let i=0;i<basis.length;i++)for(let j=i+1;j<basis.length;j++){candidates.push(basis[i]!.map((q,k)=>q.add(basis[j]![k]!)));candidates.push(basis[i]!.map((q,k)=>q.sub(basis[j]![k]!)));}
  for(const n of candidates){if(jets.some(j=>dot(n,j[second]).degreeU>=0))throw new Error('Triangular independence discovery failed exact identity');const firstSign=strictSign(jets.map(j=>dot(n,j[firstParameter])));if(!firstSign)continue;
   const ms:Rational[][]=keys.map((_,i)=>keys.map((_,k)=>new Rational(i===k?1n:0n)));jets.forEach((j,i)=>{const b=patches[i]!.bounds,u=b.uMin.add(b.uMax).div(new Rational(2n)),v=b.vMin.add(b.vMax).div(new Rational(2n));ms.push(j[second].map(f=>f.evaluate(u,v)));});
   for(const m of ms){const secondSign=strictSign(jets.map(j=>dot(m,j[second])));if(!secondSign)continue;const certificate=Object.freeze({surface,bounds,firstParameter,firstNormal:point3(n[0]!,n[1]!,n[2]!),secondNormal:point3(m[0]!,m[1]!,m[2]!),firstSign,secondSign,patches:Object.freeze(patches.map(p=>Object.freeze({patch:p.patch,bounds:p.bounds})))});owned.add(certificate);return Object.freeze({kind:'certified',certificate});}
  }
 }
 return Object.freeze({kind:'not-certified',surface,bounds,reason:'no-triangular-projection'});
}

/** Evaluate the certified rectangle's interior patch limits. Global default
 * knot-side evaluation may select an excluded outside patch at its boundary. */
export function evaluateNurbsTriangularSurface3(c:NurbsTriangularProjectionCertificate3,uInput:AlgebraicReal|ExactInput,vInput:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 assertOwnedNurbsTriangularProjection3(c);const u=uInput instanceof AlgebraicReal?uInput:AlgebraicReal.fromRational(uInput),v=vInput instanceof AlgebraicReal?vInput:AlgebraicReal.fromRational(vInput),b=c.bounds;
 if(u.compare(AlgebraicReal.fromRational(b.uMin))<0||u.compare(AlgebraicReal.fromRational(b.uMax))>0||v.compare(AlgebraicReal.fromRational(b.vMin))<0||v.compare(AlgebraicReal.fromRational(b.vMax))>0)throw new RangeError('Parameter is outside the certified triangular rectangle');
 const all=nurbsSurfacePatches3(c.surface),candidate=c.patches.find(q=>{const p=all[q.patch]!;return u.compare(AlgebraicReal.fromRational(p.startU))>=0&&u.compare(AlgebraicReal.fromRational(p.endU))<=0&&v.compare(AlgebraicReal.fromRational(p.startV))>=0&&v.compare(AlgebraicReal.fromRational(p.endV))<=0;});if(!candidate)throw new Error('Certified triangular rectangle lost patch coverage');return liftNurbsSectionPatch3(all[candidate.patch]!,u,v);
}
