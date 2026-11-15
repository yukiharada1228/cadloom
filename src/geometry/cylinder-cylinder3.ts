import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Polynomial} from '../numeric/polynomial.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {cylinder3,classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {circle3,fullCircleArc3,splitCircularArc3,interiorPointOnArc3,pointOnArc3,intersectCircles3,containsCircularArcProjection3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import {algebraicQuadraticPoint3,algebraicPoint3,algebraicCoordinates3,snapshotExactPoint3,getQuadraticParameterization3,affineQuadraticPoint3,getPointParameterization3,getBiparameterization3,getRationalParameterization3,rationalPointLinearNumerator3,algebraicRationalPoint3,algebraicBiparametricPoint3,algebraicPointsEqual3,compareAlgebraicPoints3,translateAlgebraicPoint3,signLinearAlgebraicPoint3,compareLinearPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3} from './algebraic-segment-plane3.js';
import {algebraicLine3} from './algebraic-line3.js';
import type {AlgebraicLine3} from './algebraic-line3.js';

export interface CylinderIntersectionArc3 {
  readonly first:Cylinder3;readonly second:Cylinder3;
  /** Projection along the first axis to its normal cross-section circle. */
  readonly base:CircularArc3;
  /** Sign of (secondDirection × (p-secondOrigin)) ·
   * (secondDirection × firstDirection), with zero shared at critical endpoints. */
  readonly branch:-1|1;
  readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;
  readonly baseSample:AlgebraicCoordinates3;readonly sample:AlgebraicCoordinates3;
}
export interface CylinderIntersectionGraph3 {
  readonly arcs:readonly CylinderIntersectionArc3[];
  readonly vertices:readonly AlgebraicCoordinates3[];
  readonly edges:readonly {readonly arc:number;readonly start:number;readonly end:number}[];
  /** Distinct start/end ports, including both ports of a periodic edge. */
  readonly ports:readonly (readonly number[])[];
  readonly isolatedPoints:readonly AlgebraicCoordinates3[];
  /** Valence > 2; no arbitrary through-node pairing is selected. */
  readonly singularVertices:readonly number[];
  /** Dependent supporting-surface normals, even after clipping lowers valence. */
  readonly supportSingularVertices:readonly number[];
  readonly components:readonly {readonly vertices:readonly number[];readonly edges:readonly number[]}[];
}
export type CylinderCylinderIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly cylinder:Cylinder3}
 | {readonly kind:'lines';readonly lines:readonly {readonly line:AlgebraicLine3;readonly multiplicity:1|2}[]}
 | ({readonly kind:'bounded'}&CylinderIntersectionGraph3);
export type BoundedCylinderIntersection3=Extract<CylinderCylinderIntersection3,{kind:'bounded'}>;
const boundedFamilies=new WeakMap<BoundedCylinderIntersection3,Family>();
const axes=['x','y','z'] as const,zero=new Rational(0n),one=new Rational(1n);
const scale=(v:Vector3,s:Rational)=>point3(v.x.mul(s),v.y.mul(s),v.z.mul(s));
function linear(p:AlgebraicCoordinates3,n:Vector3,offset=zero){return evaluatePlaneAtAlgebraicPoint3({normal:n,offset},p);}
function affineTwo(o:Point3,u:Vector3,s:AlgebraicReal,v:Vector3,t:AlgebraicReal):AlgebraicCoordinates3 {
  if(s.rational!==null)return algebraicPoint3(point3(o.x.add(u.x.mul(s.rational)),o.y.add(u.y.mul(s.rational)),o.z.add(u.z.mul(s.rational))),v,t);
  if(t.rational!==null)return algebraicPoint3(point3(o.x.add(v.x.mul(t.rational)),o.y.add(v.y.mul(t.rational)),o.z.add(v.z.mul(t.rational))),u,s);
  return algebraicBiparametricPoint3(o,u,s,v,t);
}
interface Family {
  first:Cylinder3;second:Cylinder3;a:Rational;E:Rational;D:Rational;sealed:boolean;
  n:Vector3;m:Vector3;circle:ReturnType<typeof circle3>;
  events:{q:AlgebraicCoordinates3;p:AlgebraicCoordinates3;singular:boolean}[];
  cache:{q:AlgebraicCoordinates3;branch:-1|1;p:AlgebraicCoordinates3}[];
}
const arcFamilies=new WeakMap<CylinderIntersectionArc3,Family>();
const lifted=new WeakMap<AlgebraicCoordinates3,{family:Family;base:AlgebraicCoordinates3;branch:-1|0|1;height:AlgebraicReal}>();
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>algebraicPointsEqual3(p,q);
function discriminant(f:Family,q:AlgebraicCoordinates3):AlgebraicReal {
  const offset=dot3(f.n,f.second.axis.origin).neg(),data=getPointParameterization3(q);
  if(data){const c=dot3(f.n,data.origin).add(offset),d=dot3(f.n,data.direction);return data.parameter.rationalFunction(new Polynomial([f.a.mul(f.second.radiusSquared).sub(c.mul(c)).mul(f.E),c.mul(d).mul(new Rational(-2n)).mul(f.E),d.mul(d).neg().mul(f.E)]),new Polynomial([1n]));}
  const rational=getRationalParameterization3(q);if(rational){const L=rationalPointLinearNumerator3(rational,f.n,offset),W=rational.denominator.mul(rational.denominator);return rational.parameter.rationalFunction(W.scale(f.a.mul(f.second.radiusSquared).mul(f.E)).sub(L.mul(L).scale(f.E)),W);}
  const L=linear(q,f.n,offset);return L.mul(L).affine(f.E.neg(),f.a.mul(f.second.radiusSquared).mul(f.E));
}
function lift(f:Family,q:AlgebraicCoordinates3,branch:-1|1):AlgebraicCoordinates3 {
  const event=f.events.find(e=>same(q,e.q));if(event)return event.p;
  const known=f.cache.find(e=>e.branch===branch&&same(q,e.q));if(known)return known.p;
  const rational=getRationalParameterization3(q);if(rational){
    const {parameter,numerators,denominator:W}=rational,inv=one.div(f.a),d=f.first.axis.direction,L=rationalPointLinearNumerator3(rational,f.n,dot3(f.n,f.second.axis.origin).neg()),B=rationalPointLinearNumerator3(rational,f.m,dot3(f.m,f.second.axis.origin).neg()),K=W.mul(W).scale(f.a.mul(f.second.radiusSquared).mul(f.E)).sub(L.mul(L).scale(f.E)),sign=parameter.signOf(K);if(sign<0)throw new RangeError('Base point has no real cylinder intersection fiber');
    // sqrt(K/W²)=sqrt(K)/|W|. Keep the source parameter shared by
    // all three coordinates and the radical instead of combining images.
    const coefficient=inv.mul(new Rational(BigInt(branch*parameter.signOf(W)))),N=numerators.map((n,i)=>n.sub(B.scale(d[axes[i]!].mul(inv)))) as [Polynomial,Polynomial,Polynomial],p=algebraicQuadraticPoint3(parameter,N,scale(d,coefficient),K,W),height=parameter.quadraticImage(B.scale(inv.neg()),K,coefficient,W);
    if(!f.sealed)f.cache.push({q,branch,p});lifted.set(p,{family:f,base:q,branch:sign===0?0:branch,height});return p;
  }
  const disc=discriminant(f,q),discSign=disc.sign();if(discSign<0)throw new RangeError('Base point has no real cylinder intersection fiber');
  const root=disc.sqrt(),offset=dot3(f.m,f.second.axis.origin).neg(),data=getPointParameterization3(q),d=f.first.axis.direction,inv=one.div(f.a);
  let p:AlgebraicCoordinates3,height:AlgebraicReal;
  if(data){const b0=dot3(f.m,data.origin).add(offset),b1=dot3(f.m,data.direction),o=point3(...axes.map(k=>data.origin[k].sub(d[k].mul(b0).mul(inv))) as [Rational,Rational,Rational]),u=point3(...axes.map(k=>data.direction[k].sub(d[k].mul(b1).mul(inv))) as [Rational,Rational,Rational]);p=affineTwo(o,u,data.parameter,scale(d,inv.mul(new Rational(BigInt(branch)))),root);height=data.parameter.affine(b1.neg().mul(inv),b0.neg().mul(inv)).add(root.affine(inv.mul(new Rational(BigInt(branch)))));}
  else {const t=linear(q,f.m,offset).neg().add(root.affine(BigInt(branch))).affine(inv);p=algebraicCoordinates3(...axes.map(k=>q[k].add(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);height=t;}
  if(!f.sealed)f.cache.push({q,branch,p});lifted.set(p,{family:f,base:q,branch:discSign===0?0:branch,height});return p;
}
/** Internal supporting identities of an actual factory-generated SSI point. */
export function cylinderIntersectionPointCylinders3(point:AlgebraicCoordinates3):readonly [Cylinder3,Cylinder3]|undefined {const data=lifted.get(point);return data?Object.freeze([data.family.first,data.family.second]):undefined;}
/** Internal exact inverse coordinates of a factory-lifted point on any parallel
 * axial frame. Read-only construction provenance; no public properties trusted. */
export function cylinderIntersectionPointCoordinates3(point:AlgebraicCoordinates3,cylinder:Cylinder3):{base:AlgebraicCoordinates3;height:AlgebraicReal}|undefined {
 const data=lifted.get(point);if(!data)return undefined;const source=data.family.first.axis,d=source.direction,target=cylinder.axis,normal=cross3(d,target.direction);if(dot3(normal,normal).sign()!==0)return undefined;
 const k=axes.find(k=>d[k].sign()!==0)!,ratio=target.direction[k].div(d[k]),shift=dot3(subtract3(target.origin,source.origin),d).div(dot3(d,d));return {base:shift.sign()===0?data.base:translateAlgebraicPoint3(data.base,scale(d,shift)),height:data.height.affine(one.div(ratio),shift.neg().div(ratio))};
}
/** Partial exact generator test for a genuine SSI point. A target on the
 * second support needs only one radial component and the stored branch sign;
 * no secondary projection or square-root coordinate image is constructed. */
export function pointOnCylinderIntersectionGenerator3(point:AlgebraicCoordinates3,input:Cylinder3,inputAnchor:Point3|AlgebraicCoordinates3):boolean|undefined {
 const data=lifted.get(point);if(!data)return undefined;const c=cylinder3(input.axis,input.radiusSquared),f=data.family,first=surfacesCoincide3({kind:'cylinder',cylinder:c},{kind:'cylinder',cylinder:f.first}),second=surfacesCoincide3({kind:'cylinder',cylinder:c},{kind:'cylinder',cylinder:f.second});if(!first&&!second)return undefined;const anchor=snapshotExactPoint3(inputAnchor);if(classifyPointToSurface3(anchor,{kind:'cylinder',cylinder:c})!==0)return false;
 const d=c.axis.direction;if(first){const n=cross3(d,d.y.sign()!==0||d.z.sign()!==0?point3(1n,0n):point3(0n,1n)),m=cross3(d,n);return compareLinearPoints3(data.base,anchor,n)===0&&compareLinearPoints3(data.base,anchor,m)===0;}
 const u=cross3(d,f.first.axis.direction),v=cross3(d,u);if(compareLinearPoints3(data.base,anchor,u)!==0)return false;const sign=signLinearAlgebraicPoint3(anchor,v,dot3(v,c.axis.origin).neg()),expected=data.branch===0?0:-data.branch;return sign===expected;
}
const secondaryBases=new WeakMap<AlgebraicCoordinates3,WeakMap<Cylinder3,AlgebraicCoordinates3>>();
/** Internal radial projection using actual SSI support provenance. The returned
 * point is a coordinate construction, not an unchecked caller-supplied flag. */
export function cylinderIntersectionPointBase3(point:AlgebraicCoordinates3,cylinder:Cylinder3):AlgebraicCoordinates3|undefined {
 const cached=secondaryBases.get(point)?.get(cylinder);if(cached)return cached;
 const parallel=cylinderIntersectionPointCoordinates3(point,cylinder);if(parallel)return parallel.base;const data=lifted.get(point);if(!data||![data.family.first,data.family.second].some(c=>surfacesCoincide3({kind:'cylinder',cylinder:c},{kind:'cylinder',cylinder})))return undefined;
 const d=cylinder.axis.direction,o=cylinder.axis.origin,u=cross3(d,data.family.first.axis.direction),v=cross3(d,u),U=dot3(u,u),V=dot3(v,v);if(U.sign()===0||V.sign()===0)throw new Error('Parallel SSI projection missed its axial inverse');
 const alpha=linear(data.base,u,dot3(u,o).neg()).affine(one.div(U)),squared=alpha.rationalFunction(new Polynomial([cylinder.radiusSquared.div(V),0n,U.neg().div(V)])),sign=signLinearAlgebraicPoint3(point,v,dot3(v,o).neg());if(squared.sign()<0||(squared.sign()===0)!==(sign===0))throw new Error('Certified SSI radial projection has inconsistent signs');const base=affineTwo(o,u,alpha,v,squared.sqrt().affine(BigInt(sign)));
 // Only the actual immutable support objects are cache keys. Mutable caller
 // copies keep the complete uncached path, so changed frames cannot go stale.
 if(cylinder===data.family.first||cylinder===data.family.second){let cache=secondaryBases.get(point);if(!cache){cache=new WeakMap();secondaryBases.set(point,cache);}cache.set(cylinder,base);}return base;
}
function family(arc:CylinderIntersectionArc3){const f=arcFamilies.get(arc);if(!f)throw new RangeError('Expected a factory-created cylinder intersection arc');return f;}
/** Evaluate an owned algebraic SSI branch at a point on its base circular arc. */
export function evaluateCylinderIntersectionArc3(arc:CylinderIntersectionArc3,input:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const f=family(arc),q=snapshotExactPoint3(input);
  if(same(q,arc.base.start))return arc.start;if(same(q,arc.base.end))return arc.end;if(same(q,arc.baseSample))return arc.sample;
  if(!pointOnArc3(q,arc.base))throw new RangeError('SSI parameter must lie on the base arc');return lift(f,q,arc.branch);
}
const projectionCache=new WeakMap<Family,WeakMap<AlgebraicCoordinates3,AlgebraicCoordinates3>>();
const projectionForms=new WeakMap<Family,readonly {normal:Vector3;offset:Rational}[]>();
/** Necessary interval test only: an overlap always falls through to the exact
 * projection/equality check. No support membership follows from these bounds. */
function projectionMayEqual(f:Family,p:AlgebraicCoordinates3,q:AlgebraicCoordinates3):boolean {
 let forms=projectionForms.get(f);if(!forms){const d=f.first.axis.direction,o=f.first.axis.origin,t=dot3(d,o).div(f.D);forms=axes.map(k=>({normal:point3(...axes.map(j=>(k===j?one:zero).sub(d[k].mul(d[j]).div(f.D))) as [Rational,Rational,Rational]),offset:d[k].mul(t)}));projectionForms.set(f,forms);}
 return forms.every((form,i)=>{let lo=form.offset,hi=form.offset;for(const k of axes){const a=form.normal[k],positive=a.sign()>=0;lo=lo.add(a.mul(positive?p[k].lower:p[k].upper));hi=hi.add(a.mul(positive?p[k].upper:p[k].lower));}const v=q[axes[i]!];return hi.compare(v.lower)>=0&&lo.compare(v.upper)<=0;});
}
/** Internal exact recovery from either known root of the same height fiber.
 * Both supports and the base projection are checked. The other root is a
 * rational affine reflection, so an existing RUR need not gain a new radical. */
export function evaluateCylinderIntersectionFiber3(arc:CylinderIntersectionArc3,inputBase:AlgebraicCoordinates3,inputPoint:AlgebraicCoordinates3):AlgebraicCoordinates3|undefined {
 const f=family(arc),q=snapshotExactPoint3(inputBase),p=snapshotExactPoint3(inputPoint);if(!projectionMayEqual(f,p,q)||!same(projectCylinderIntersectionBase3(arc,p),q))return undefined;if(!pointOnArc3(q,arc.base))throw new RangeError('SSI fiber must lie on its base interval');
 const registered=lifted.get(p),known=(c:Cylinder3)=>registered&&[registered.family.first,registered.family.second].some(s=>surfacesCoincide3({kind:'cylinder',cylinder:s},{kind:'cylinder',cylinder:c}));if(!known(f.first)&&classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.first})!==0||!known(f.second)&&classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.second})!==0)return undefined;
 // The validated fiber has one root on each selected sheet (one at a double
 // root). Reuse the actual owned endpoint/sample rather than reconstructing
 // its coordinates by reflecting an unrelated multivariate representation.
 if(same(q,arc.base.start))return arc.start;if(same(q,arc.base.end))return arc.end;if(same(q,arc.baseSample))return arc.sample;
 const offset=dot3(f.m,f.second.axis.origin).neg(),sign=signLinearAlgebraicPoint3(p,f.m,offset);if(sign===0||sign===arc.branch)return p;
 const factor=new Rational(2n).div(f.a),d=f.first.axis.direction,rational=getRationalParameterization3(p),affine=getPointParameterization3(p),pair=getBiparameterization3(p),quadratic=getQuadraticParameterization3(p),reflect=(v:Point3,vector=false)=>{const t=dot3(f.m,v).add(vector?zero:offset).mul(factor);return point3(...axes.map(k=>v[k].sub(d[k].mul(t))) as [Rational,Rational,Rational]);};let result:AlgebraicCoordinates3;
 if(rational){const T=rationalPointLinearNumerator3(rational,f.m,offset).scale(factor);result=algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(d[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
 else if(affine)result=algebraicPoint3(reflect(affine.origin),reflect(affine.direction,true),affine.parameter);
 else if(pair)result=algebraicBiparametricPoint3(reflect(pair.origin),reflect(pair.u,true),pair.s,reflect(pair.v,true),pair.t);
 else if(quadratic)result=affineQuadraticPoint3(quadratic,reflect(point3(0n,0n)),[reflect(point3(1n,0n),true),reflect(point3(0n,1n),true),reflect(point3(0n,0n,1n),true)]);
 else {result=algebraicCoordinates3(...axes.map(k=>{const terms=axes.map(j=>({value:p[j],coefficient:(j===k?one:zero).sub(d[k].mul(f.m[j]).mul(factor))})).filter(t=>t.coefficient.sign()!==0);return terms.reduce((sum,t)=>sum.add(t.value.affine(t.coefficient)),AlgebraicReal.fromRational(d[k].mul(offset).mul(factor).neg()));}) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);}
 const height=linear(result,d,dot3(d,f.first.axis.origin).neg()).affine(one.div(f.D));lifted.set(result,{family:f,base:q,branch:arc.branch,height});return result;
}
/** Exact branch membership, including shared critical endpoints. */
export function pointOnCylinderIntersectionArc3(input:Point3|AlgebraicCoordinates3,arc:CylinderIntersectionArc3):boolean {
  const f=family(arc);
  if(input===arc.start||input===arc.end||input===arc.sample)return true;
  const registered=lifted.get(input as AlgebraicCoordinates3),p=snapshotExactPoint3(input);
  // The private family chart already specifies the exact point and sheet.
  // Resolve it before comparing expensive independent coordinate images.
  if(registered?.family===f)return pointOnArc3(registered.base,arc.base)&&(registered.branch===0||registered.branch===arc.branch);
  if(same(p,arc.start)||same(p,arc.end))return true;
  const known=(c:Cylinder3)=>registered&&[registered.family.first,registered.family.second].some(s=>surfacesCoincide3({kind:'cylinder',cylinder:s},{kind:'cylinder',cylinder:c}));
  if(!known(f.first)&&classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.first})!==0)return false;
  if(!known(f.second)&&classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.second})!==0)return false;
  const sign=signLinearAlgebraicPoint3(p,f.m,dot3(f.m,f.second.axis.origin).neg());return (sign===0||sign===arc.branch)&&containsCircularArcProjection3(p,arc.base);
}

/** Internal projection preserving certified rational/affine source fields. */
export function projectCylinderIntersectionBase3(arc:CylinderIntersectionArc3,input:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const f=family(arc),registered=lifted.get(input as AlgebraicCoordinates3);
  let q:AlgebraicCoordinates3,p=snapshotExactPoint3(input),cache=projectionCache.get(f);if(!cache){cache=new WeakMap();projectionCache.set(f,cache);}const cached=cache.get(p);if(cached)return cached;
  if(registered?.family===f)q=registered.base;
  else {const data=getPointParameterization3(p),pair=getBiparameterization3(p),rational=getRationalParameterization3(p),quadratic=getQuadraticParameterization3(p),d=f.first.axis.direction,o=f.first.axis.origin,project=(v:Point3,vector=false)=>{const t=dot3(d,vector?v:subtract3(v,o)).div(f.D);return point3(v.x.sub(d.x.mul(t)),v.y.sub(d.y.mul(t)),v.z.sub(d.z.mul(t)));};
    if(rational){const T=rationalPointLinearNumerator3(rational,d,dot3(d,o).neg()).scale(one.div(f.D));q=algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(d[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
    else if(data)q=algebraicPoint3(project(data.origin),project(data.direction,true),data.parameter);
    else if(pair)q=affineTwo(project(pair.origin),project(pair.u,true),pair.s,project(pair.v,true),pair.t);
    else if(quadratic)q=affineQuadraticPoint3(quadratic,project(point3(0n,0n)),[project(point3(1n,0n),true),project(point3(0n,1n),true),project(point3(0n,0n,1n),true)]);
    else if(registered&&[registered.family.first,registered.family.second].some(c=>surfacesCoincide3({kind:'cylinder',cylinder:c},{kind:'cylinder',cylinder:f.first}))){
      const base=cylinderIntersectionPointBase3(p,f.first);if(!base)throw new Error('Expected a certified SSI projection');q=base;
    }
    else {const t=linear(p,d,dot3(d,o).neg()).affine(one.div(f.D));q=algebraicCoordinates3(...axes.map(k=>p[k].sub(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);}
  }
  cache.set(p,q);return q;
}

export function assertOwnedCylinderIntersectionArc3(arc:CylinderIntersectionArc3):void {family(arc);}
/** Subdivide one owned branch by verified 3D points, retaining exact cut-point
 * representations instead of recomputing nested radicals at the endpoints. */
export function splitCylinderIntersectionArc3(arc:CylinderIntersectionArc3,input:readonly (Point3|AlgebraicCoordinates3)[]):readonly CylinderIntersectionArc3[] {
  const f=family(arc),cuts=input.map(p=>snapshotExactPoint3(p));if(cuts.some(p=>!pointOnCylinderIntersectionArc3(p,arc)))throw new RangeError('SSI cut point must belong to its arc');
  const points=[{q:arc.base.start,p:arc.start},{q:arc.base.end,p:arc.end},...cuts.map(p=>({p,q:projectCylinderIntersectionBase3(arc,p)}))],pieces=splitCircularArc3(arc.base,points.map(p=>p.q));
  if(pieces.length===1)return Object.freeze([arc]);
  return Object.freeze(pieces.map(base=>{const baseSample=interiorPointOnArc3(base),next=Object.freeze({first:arc.first,second:arc.second,base,branch:arc.branch,start:points.find(p=>same(p.q,base.start))!.p,end:points.find(p=>same(p.q,base.end))!.p,baseSample,sample:lift(f,baseSample,arc.branch)});arcFamilies.set(next,f);return next;}));
}
export function assertOwnedCylinderIntersectionGraph3(input:BoundedCylinderIntersection3):void {if(!boundedFamilies.has(input))throw new RangeError('Expected a factory-created bounded cylinder intersection graph');}
/** Internal support identity even when a clipped graph has no remaining arcs. */
export function cylinderIntersectionSupports3(input:BoundedCylinderIntersection3):readonly [Cylinder3,Cylinder3] {
  assertOwnedCylinderIntersectionGraph3(input);const f=boundedFamilies.get(input)!;return Object.freeze([f.first,f.second]);
}
/** Internal subset graph construction; all arcs and points remain on the same
 * certified supporting pair. Does not claim the subset is the full SSI. */
export function rebuildCylinderIntersectionGraph3(input:BoundedCylinderIntersection3,arcs:readonly CylinderIntersectionArc3[],points:readonly AlgebraicCoordinates3[]):BoundedCylinderIntersection3 {
  assertOwnedCylinderIntersectionGraph3(input);const f=boundedFamilies.get(input)!;
  if(arcs.some(arc=>family(arc)!==f)||points.some(p=>classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.first})!==0||classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.second})!==0))throw new RangeError('SSI subset geometry must lie on its supporting pair');
  return finishBounded(f,arcs,points);
}
function finishBounded(f:Family,arcs:readonly CylinderIntersectionArc3[],points:readonly AlgebraicCoordinates3[]):BoundedCylinderIntersection3 {
  const result=Object.freeze({kind:'bounded' as const,...graph(f,arcs,points)});boundedFamilies.set(result,f);return result;
}
function graph(f:Family,arcs:readonly CylinderIntersectionArc3[],isolated:readonly AlgebraicCoordinates3[]):CylinderIntersectionGraph3 {
  const records=[...arcs.flatMap(a=>[a.start,a.end]),...isolated].sort(compareAlgebraicPoints3),vertices=records.filter((p,i)=>i===0||!same(p,records[i-1]!));
  const index=(p:AlgebraicCoordinates3)=>vertices.findIndex(q=>same(p,q)),edges=arcs.map((_,arc)=>Object.freeze({arc,start:index(arcs[arc]!.start),end:index(arcs[arc]!.end)})),ports:number[][]=vertices.map(()=>[]);
  edges.forEach((e,i)=>{ports[e.start]!.push(2*i);ports[e.end]!.push(2*i+1);});
  const seen=new Set<number>(),components:{readonly vertices:readonly number[];readonly edges:readonly number[]}[]=[];
  vertices.forEach((_,start)=>{if(seen.has(start))return;const ids=[start],used=new Set<number>();seen.add(start);
    for(let i=0;i<ids.length;i++)for(const port of ports[ids[i]!]!){const edge=Math.floor(port/2),e=edges[edge]!,other=port%2===0?e.end:e.start;used.add(edge);if(!seen.has(other)){seen.add(other);ids.push(other);}}
    components.push(Object.freeze({vertices:Object.freeze(ids),edges:Object.freeze([...used].sort((a,b)=>a-b))}));
  });
  return Object.freeze({arcs:Object.freeze([...arcs]),vertices:Object.freeze(vertices),edges:Object.freeze(edges),ports:Object.freeze(ports.map(p=>Object.freeze(p))),isolatedPoints:Object.freeze([...isolated]),singularVertices:Object.freeze(ports.flatMap((p,i)=>p.length>2?[i]:[])),supportSingularVertices:Object.freeze(vertices.flatMap((p,i)=>f.events.some(e=>e.singular&&same(p,e.p))?[i]:[])),components:Object.freeze(components)});
}
/** Complete supporting-surface SSI for arbitrary rational circular cylinders.
 * Nonparallel axes reduce to two real algebraic height sheets over a base circle
 * cut by a strip. Exact critical points split sheets into finite graph edges;
 * isolated tangencies and singular nodes are retained. These generally quartic
 * curves are not approximated or mislabeled as circles/NURBS.
 * No bounded face trimming, pcurve/BRep binding or solid Boolean is supplied here.
 */
export function intersectCylinders3(inputA:Cylinder3,inputB:Cylinder3):CylinderCylinderIntersection3 {
  const first=cylinder3(inputA.axis,inputA.radiusSquared),second=cylinder3(inputB.axis,inputB.radiusSquared),d=first.axis.direction,e=second.axis.direction,n=cross3(d,e),a=dot3(n,n),D=dot3(d,d),E=dot3(e,e),circle=circle3(first.axis.origin,d,first.radiusSquared);
  if(a.sign()===0){
    const offset=dot3(d,subtract3(first.axis.origin,second.axis.origin)).div(D),o=point3(second.axis.origin.x.add(d.x.mul(offset)),second.axis.origin.y.add(d.y.mul(offset)),second.axis.origin.z.add(d.z.mul(offset))),hit=intersectCircles3(circle,circle3(o,d,second.radiusSquared));
    if(hit.kind==='none')return Object.freeze({kind:'none'});if(hit.kind==='coincident')return Object.freeze({kind:'coincident',cylinder:first});
    return Object.freeze({kind:'lines',lines:Object.freeze(hit.points.map(p=>Object.freeze({line:algebraicLine3(p,d),multiplicity:hit.points.length===1?2 as const:1 as const})))});
  }
  const ed=dot3(e,d),m=point3(d.x.mul(E).sub(e.x.mul(ed)),d.y.mul(E).sub(e.y.mul(ed)),d.z.mul(E).sub(e.z.mul(ed))),f:Family={first,second,a,E,D,n,m,circle,events:[],cache:[],sealed:false};
  const center=first.axis.origin,k=dot3(n,subtract3(center,second.axis.origin)),strip=AlgebraicReal.fromRational(a.mul(second.radiusSquared)).sqrt(),extent=AlgebraicReal.fromRational(a.mul(first.radiusSquared)).sqrt();
  if(extent.neg().affine(1n,k).compare(strip)>0||extent.affine(1n,k).compare(strip.neg())<0)return Object.freeze({kind:'none'});
  const v=cross3(d,n),V=dot3(v,v),inv=one.div(a),b0=dot3(m,subtract3(center,second.axis.origin)),bV=dot3(m,v);
  for(const sign of [-1n,1n]){
    const lambda=strip.affine(sign,k.neg()),s=lambda.mul(lambda).affine(inv.neg(),first.radiusSquared);
    if(s.sign()<0)continue;
    const root=s.affine(one.div(V)).sqrt();
    for(const side of s.sign()===0?[1n]:[-1n,1n]){
      const t=root.affine(side),q=affineTwo(center,scale(n,inv),lambda,v,t),o=point3(center.x.sub(d.x.mul(b0).mul(inv)),center.y.sub(d.y.mul(b0).mul(inv)),center.z.sub(d.z.mul(b0).mul(inv))),w=point3(v.x.sub(d.x.mul(bV).mul(inv)),v.y.sub(d.y.mul(bV).mul(inv)),v.z.sub(d.z.mul(bV).mul(inv))),p=affineTwo(o,scale(n,inv),lambda,w,t);
      if(!f.events.some(event=>same(event.q,q))){f.events.push({q,p,singular:s.sign()===0});lifted.set(p,{family:f,base:q,branch:0,height:t.affine(bV.neg().mul(inv),b0.neg().mul(inv))});}
    }
  }
  const arcs:CylinderIntersectionArc3[]=[];
  const full=fullCircleArc3(circle),seam=getPointParameterization3(full.start)!;
  const opposite=algebraicPoint3(center,scale(seam.direction,new Rational(-1n)),seam.parameter);
  for(const base of splitCircularArc3(full,[opposite,...f.events.map(e=>e.q)])){
    const baseSample=interiorPointOnArc3(base),sign=discriminant(f,baseSample).sign();
    if(sign===0)throw new Error('Open SSI angular cell meets an unpartitioned critical point');if(sign<0)continue;
    for(const branch of [-1,1] as const){const arc=Object.freeze({first,second,base,branch,start:lift(f,base.start,branch),end:lift(f,base.end,branch),baseSample,sample:lift(f,baseSample,branch)});arcFamilies.set(arc,f);arcs.push(arc);}
  }
  f.sealed=true;
  const isolated=f.events.filter(e=>!arcs.some(a=>same(e.p,a.start)||same(e.p,a.end))).map(e=>e.p);
  if(!arcs.length&&!isolated.length)return Object.freeze({kind:'none'});
  return finishBounded(f,arcs,isolated);
}
