import {Rational} from '../numeric/rational.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsSurface3,nurbsSurfacePatches3,evaluateNurbsSurface3} from './nurbs-surface3.js';
import type {NurbsSurface3} from './nurbs-surface3.js';
import {nurbsSurfaceSeams3} from './nurbs-surface-regularity3.js';

export interface NurbsAffineParameterRow3 {readonly normal:Point3;readonly offset:Rational;}
/** Owned exact left inverse over the whole active closed parameter rectangle.
 * Certifies a continuous embedding and one-sided rank two, not C1/G1 seams. */
export interface NurbsAffineProjectionCertificate3 {readonly surface:NurbsSurface3;readonly u:NurbsAffineParameterRow3;readonly v:NurbsAffineParameterRow3;}
export type NurbsAffineProjectionResult3=
 | Readonly<{kind:'certified';certificate:NurbsAffineProjectionCertificate3}>
 | Readonly<{kind:'not-certified';surface:NurbsSurface3;reason:'discontinuous-seam'|'no-affine-projection'}>;
const zero=new Rational(0n),one=new Rational(1n),U=new BivariatePolynomial([[0n],[1n]]),V=new BivariatePolynomial([[0n,1n]]),owned=new WeakSet<NurbsAffineProjectionCertificate3>();
/** Exact RREF of six-column homogeneous constraints. Discovery is followed by
 * independent polynomial identity checks before any certificate is owned. */
function nullspace(input:readonly Rational[][]):Rational[][] {
 const rows=input.map(row=>[...row]),pivots:number[]=[];let r=0;
 for(let col=0;col<6&&r<rows.length;col++){
  const at=rows.findIndex((row,i)=>i>=r&&row[col]!.sign()!==0);if(at<0)continue;[rows[r],rows[at]]=[rows[at]!,rows[r]!];const divisor=rows[r]![col]!;rows[r]=rows[r]!.map(x=>x.div(divisor));
  for(let i=0;i<rows.length;i++)if(i!==r){const factor=rows[i]![col]!;if(factor.sign()!==0)rows[i]=rows[i]!.map((x,j)=>x.sub(factor.mul(rows[r]![j]!)));}
  pivots.push(col);r++;
 }
 const result:Rational[][]=[];for(let free=0;free<6;free++)if(!pivots.includes(free)){const vector=Array.from({length:6},()=>zero);vector[free]=one;pivots.forEach((pivot,i)=>{vector[pivot]=rows[i]![free]!.neg();});result.push(vector);}return result;
}
export function certifyNurbsSurfaceAffineProjection3(input:NurbsSurface3):NurbsAffineProjectionResult3 {
 const surface=nurbsSurface3(input.degreeU,input.degreeV,input.controlPoints,input.knotsU,input.knotsV,input.weights),patches=nurbsSurfacePatches3(surface);
 if(nurbsSurfaceSeams3(patches).some(s=>!s.continuous))return Object.freeze({kind:'not-certified',surface,reason:'discontinuous-seam'});
 const rows:Rational[][]=[];
 for(const p of patches){const terms=[p.x,p.y,p.z,p.weight.scale(-1n),U.mul(p.weight).scale(-1n),V.mul(p.weight).scale(-1n)],m=Math.max(...terms.map(p=>p.degreeU)),n=Math.max(...terms.map(p=>p.degreeV));for(let i=0;i<=m;i++)for(let j=0;j<=n;j++){const row=terms.map(p=>p.coefficient(i,j));if(row.some(q=>q.sign()!==0))rows.push(row);}}
 const basis=nullspace(rows);
 for(let i=0;i<basis.length;i++)for(let j=i+1;j<basis.length;j++){
  const a=basis[i]!,b=basis[j]!,det=a[4]!.mul(b[5]!).sub(a[5]!.mul(b[4]!));if(det.sign()===0)continue;
  const row=(axis:'u'|'v'):NurbsAffineParameterRow3=>{const values=[0,1,2].map(k=>axis==='u'?b[5]!.mul(a[k]!).sub(a[5]!.mul(b[k]!)).div(det):a[4]!.mul(b[k]!).sub(b[4]!.mul(a[k]!)).div(det)),offset=axis==='u'?a[5]!.mul(b[3]!).sub(b[5]!.mul(a[3]!)).div(det):b[4]!.mul(a[3]!).sub(a[4]!.mul(b[3]!)).div(det);return Object.freeze({normal:point3(values[0]!,values[1]!,values[2]!),offset});};
  const u=row('u'),v=row('v');
  for(const p of patches)for(const [r,parameter] of [[u,U],[v,V]] as const){const f=p.x.scale(r.normal.x).add(p.y.scale(r.normal.y)).add(p.z.scale(r.normal.z)).add(p.weight.scale(r.offset)).sub(parameter.mul(p.weight));if(f.degreeU>=0)throw new Error('Discovered affine projection failed its exact polynomial identity');}
  const certificate=Object.freeze({surface,u,v});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
 }
 return Object.freeze({kind:'not-certified',surface,reason:'no-affine-projection'});
}
function guard(c:NurbsAffineProjectionCertificate3):void {if(!owned.has(c))throw new RangeError('Operation requires a factory-created affine NURBS projection certificate');}
function parameters(c:NurbsAffineProjectionCertificate3,p:AlgebraicCoordinates3){const apply=(r:NurbsAffineParameterRow3)=>AlgebraicReal.linearCombination([{value:p.x,coefficient:r.normal.x},{value:p.y,coefficient:r.normal.y},{value:p.z,coefficient:r.normal.z}],r.offset);return Object.freeze({u:apply(c.u),v:apply(c.v)});}
/** Projection candidate for any exact spatial point; this alone is NOT an
 * assertion that the point lies on the surface or inside its rectangle. */
export function nurbsAffineProjectionParameters3(c:NurbsAffineProjectionCertificate3,input:Point3|AlgebraicCoordinates3):Readonly<{u:AlgebraicReal;v:AlgebraicReal}> {guard(c);return parameters(c,snapshotExactPoint3(input));}
export function locateAffineProjectedNurbsSurface3(c:NurbsAffineProjectionCertificate3,input:Point3|AlgebraicCoordinates3):'inside'|'boundary'|'outside' {
 guard(c);const p=snapshotExactPoint3(input),{u,v}=parameters(c,p),s=c.surface,a=u.compare(AlgebraicReal.fromRational(s.startU)),b=u.compare(AlgebraicReal.fromRational(s.endU)),d=v.compare(AlgebraicReal.fromRational(s.startV)),e=v.compare(AlgebraicReal.fromRational(s.endV));
 if(a<0||b>0||d<0||e>0||compareAlgebraicPoints3(evaluateNurbsSurface3(s,u,v),p)!==0)return 'outside';return a===0||b===0||d===0||e===0?'boundary':'inside';
}
