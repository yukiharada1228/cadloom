import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Polynomial} from '../numeric/polynomial.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {circle3,fullCircleArc3,splitCircularArc3,interiorPointOnArc3,pointOnArc3,intersectCircles3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import {algebraicPoint3,algebraicCoordinates3,snapshotExactPoint3,getPointParameterization3,getBiparameterization3,getRationalParameterization3,rationalPointLinearNumerator3,algebraicRationalPoint3,algebraicBiparametricPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
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
const lifted=new WeakMap<AlgebraicCoordinates3,{family:Family;base:AlgebraicCoordinates3;branch:-1|0|1}>();
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
function discriminant(f:Family,q:AlgebraicCoordinates3):AlgebraicReal {
  const offset=dot3(f.n,f.second.axis.origin).neg(),data=getPointParameterization3(q);
  if(data){const c=dot3(f.n,data.origin).add(offset),d=dot3(f.n,data.direction);return data.parameter.rationalFunction(new Polynomial([f.a.mul(f.second.radiusSquared).sub(c.mul(c)).mul(f.E),c.mul(d).mul(new Rational(-2n)).mul(f.E),d.mul(d).neg().mul(f.E)]),new Polynomial([1n]));}
  const L=linear(q,f.n,offset);return L.mul(L).affine(f.E.neg(),f.a.mul(f.second.radiusSquared).mul(f.E));
}
function lift(f:Family,q:AlgebraicCoordinates3,branch:-1|1):AlgebraicCoordinates3 {
  const event=f.events.find(e=>same(q,e.q));if(event)return event.p;
  const known=f.cache.find(e=>e.branch===branch&&same(q,e.q));if(known)return known.p;
  const disc=discriminant(f,q),discSign=disc.sign();if(discSign<0)throw new RangeError('Base point has no real cylinder intersection fiber');
  const root=disc.sqrt(),offset=dot3(f.m,f.second.axis.origin).neg(),data=getPointParameterization3(q),d=f.first.axis.direction,inv=one.div(f.a);
  let p:AlgebraicCoordinates3;
  if(data){const b0=dot3(f.m,data.origin).add(offset),b1=dot3(f.m,data.direction),o=point3(...axes.map(k=>data.origin[k].sub(d[k].mul(b0).mul(inv))) as [Rational,Rational,Rational]),u=point3(...axes.map(k=>data.direction[k].sub(d[k].mul(b1).mul(inv))) as [Rational,Rational,Rational]);p=affineTwo(o,u,data.parameter,scale(d,inv.mul(new Rational(BigInt(branch)))),root);}
  else {const t=linear(q,f.m,offset).neg().add(root.affine(BigInt(branch))).affine(inv);p=algebraicCoordinates3(...axes.map(k=>q[k].add(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);}
  if(!f.sealed)f.cache.push({q,branch,p});lifted.set(p,{family:f,base:q,branch:discSign===0?0:branch});return p;
}
function family(arc:CylinderIntersectionArc3){const f=arcFamilies.get(arc);if(!f)throw new RangeError('Expected a factory-created cylinder intersection arc');return f;}
/** Evaluate an owned algebraic SSI branch at a point on its base circular arc. */
export function evaluateCylinderIntersectionArc3(arc:CylinderIntersectionArc3,input:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const f=family(arc),q=snapshotExactPoint3(input);
  if(same(q,arc.base.start))return arc.start;if(same(q,arc.base.end))return arc.end;if(same(q,arc.baseSample))return arc.sample;
  if(!pointOnArc3(q,arc.base))throw new RangeError('SSI parameter must lie on the base arc');return lift(f,q,arc.branch);
}
/** Exact branch membership, including shared critical endpoints. */
export function pointOnCylinderIntersectionArc3(input:Point3|AlgebraicCoordinates3,arc:CylinderIntersectionArc3):boolean {
  const f=family(arc);
  if(input===arc.start||input===arc.end||input===arc.sample)return true;
  const registered=lifted.get(input as AlgebraicCoordinates3),p=snapshotExactPoint3(input),q=projectCylinderIntersectionBase3(arc,input);
  if(!pointOnArc3(q,arc.base))return false;
  if(registered?.family===f)return registered.branch===0||registered.branch===arc.branch;
  if(classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.second})!==0)return false;
  const sign=linear(p,f.m,dot3(f.m,f.second.axis.origin).neg()).sign();return sign===0||sign===arc.branch;
}

/** Internal projection preserving certified rational/affine source fields. */
export function projectCylinderIntersectionBase3(arc:CylinderIntersectionArc3,input:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const f=family(arc),registered=lifted.get(input as AlgebraicCoordinates3);
  let q:AlgebraicCoordinates3,p=snapshotExactPoint3(input);
  if(registered?.family===f)q=registered.base;
  else {const data=getPointParameterization3(p),pair=getBiparameterization3(p),rational=getRationalParameterization3(p),d=f.first.axis.direction,o=f.first.axis.origin,project=(v:Point3,vector=false)=>{const t=dot3(d,vector?v:subtract3(v,o)).div(f.D);return point3(v.x.sub(d.x.mul(t)),v.y.sub(d.y.mul(t)),v.z.sub(d.z.mul(t)));};
    if(rational){const T=rationalPointLinearNumerator3(rational,d,dot3(d,o).neg()).scale(one.div(f.D));q=algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(d[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
    else if(data)q=algebraicPoint3(project(data.origin),project(data.direction,true),data.parameter);
    else if(pair)q=affineTwo(project(pair.origin),project(pair.u,true),pair.s,project(pair.v,true),pair.t);
    else {const t=linear(p,d,dot3(d,o).neg()).affine(one.div(f.D));q=algebraicCoordinates3(...axes.map(k=>p[k].sub(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);}
  }
  return q;
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
      if(!f.events.some(event=>same(event.q,q))){f.events.push({q,p,singular:s.sign()===0});lifted.set(p,{family:f,base:q,branch:0});}
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
