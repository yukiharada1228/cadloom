import {getAlgebraicAxialCoordinates3,getAlgebraicAxialDirections3} from './algebraic-axial-point3.js';
import type {AlgebraicAxialCoordinates3} from './algebraic-axial-point3.js';
import {point3,cross3} from './point3.js';
import type {Vector3} from './point3.js';
import type {Rational} from '../numeric/rational.js';
import {cylinderIntersectionPointBase3,cylinderIntersectionPointCylinders3,pointOnCylinderIntersectionGenerator3} from './cylinder-cylinder3.js';
import {cylinderCoordinates3} from './cylinder-coordinates3.js';
import {snapshotExactPoint3,subtractAlgebraicPoints3,compareAlgebraicPoints3,algebraicPointsEqual3,compareLinearPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import type {Surface3,Cylinder3} from './surface3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import {plane3} from './plane3.js';

/** Straight closed segment with arbitrary exact real algebraic endpoints. */
export interface AlgebraicSegment3 {readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;}
export function algebraicSegment3(start:Point3|AlgebraicCoordinates3,end:Point3|AlgebraicCoordinates3):AlgebraicSegment3 {
  return Object.freeze({start:snapshotExactPoint3(start),end:snapshotExactPoint3(end)});
}
interface RationalLine3 {readonly base:AlgebraicCoordinates3;readonly direction:Vector3;readonly normals:readonly [Vector3,Vector3];}
const lineCache=new WeakMap<AlgebraicCoordinates3,WeakMap<AlgebraicCoordinates3,RationalLine3|null>>();
const parallelDirections=(a:Vector3,b:Vector3)=>{const c=cross3(a,b);return c.x.sign()===0&&c.y.sign()===0&&c.z.sign()===0;};
function axialCoordinates(p:AlgebraicCoordinates3,wanted?:Vector3):AlgebraicAxialCoordinates3|undefined {
 const data=getAlgebraicAxialCoordinates3(p,wanted);if(data&&(!wanted||parallelDirections(data.direction,wanted)))return data;
 const supports=cylinderIntersectionPointCylinders3(p),support=supports?.find(c=>!wanted||parallelDirections(c.axis.direction,wanted));if(!support)return undefined;const base=cylinderIntersectionPointBase3(p,support);return base?{base,direction:support.axis.direction}:undefined;
}
/** Only actual point-construction identities can establish a rational line.
 * Missing provenance leaves the complete general collinearity path active. */
function rationalLine(start:AlgebraicCoordinates3,end:AlgebraicCoordinates3):RationalLine3|null {
 let cache=lineCache.get(start);if(!cache){cache=new WeakMap();lineCache.set(start,cache);}const known=cache.get(end);if(known!==undefined)return known;
 const directions=[...getAlgebraicAxialDirections3(start),...(cylinderIntersectionPointCylinders3(start)??[]).map(c=>c.axis.direction)].filter((d,i,all)=>all.findIndex(e=>parallelDirections(d,e))===i);let result:RationalLine3|null=null;
 for(const d of directions){const b=axialCoordinates(end,d);if(!b)continue;const a=axialCoordinates(start,d);if(!a)continue;const n=cross3(d,d.y.sign()!==0||d.z.sign()!==0?point3(1n,0n):point3(0n,1n)),m=cross3(d,n);if(algebraicPointsEqual3(a.base,b.base)||compareLinearPoints3(a.base,b.base,n)===0&&compareLinearPoints3(a.base,b.base,m)===0){result=Object.freeze({base:a.base,direction:d,normals:Object.freeze([n,m]) as readonly [Vector3,Vector3]});break;}}cache.set(end,result);return result;
}
function storeLine(start:AlgebraicCoordinates3,end:AlgebraicCoordinates3,line:RationalLine3):void {for(const [a,b] of [[start,end],[end,start]] as const){let cache=lineCache.get(a);if(!cache){cache=new WeakMap();lineCache.set(a,cache);}cache.set(b,line);}}
function lineThrough(base:AlgebraicCoordinates3,direction:Vector3):RationalLine3 {const n=cross3(direction,direction.y.sign()!==0||direction.z.sign()!==0?point3(1n,0n):point3(0n,1n));return Object.freeze({base,direction,normals:Object.freeze([n,cross3(direction,n)]) as readonly [Vector3,Vector3]});}
function liesOnLine(p:AlgebraicCoordinates3,line:RationalLine3):boolean {
 const construction=getAlgebraicAxialCoordinates3(p,line.direction);if(construction)return algebraicPointsEqual3(construction.base,line.base)||line.normals.every(n=>compareLinearPoints3(construction.base,line.base,n)===0);
 const support=cylinderIntersectionPointCylinders3(p)?.find(c=>parallelDirections(c.axis.direction,line.direction));if(support){const result=pointOnCylinderIntersectionGenerator3(p,support,line.base);if(result!==undefined)return result;}
 return algebraicPointsEqual3(p,line.base)||line.normals.every(n=>compareLinearPoints3(p,line.base,n)===0);
}
/** Validate a known generator construction before recording its rational line.
 * The anchor is checked on the actual cylinder; endpoints are checked on that
 * line. No caller-provided direction flag grants a certificate. */
export function algebraicCylinderGeneratorSegment3(input:Cylinder3,inputBase:Point3|AlgebraicCoordinates3,start:Point3|AlgebraicCoordinates3,end:Point3|AlgebraicCoordinates3):AlgebraicSegment3 {
 const c=cylinder3(input.axis,input.radiusSquared),base=snapshotExactPoint3(inputBase),s=algebraicSegment3(start,end),line=lineThrough(base,c.axis.direction);if(classifyPointToSurface3(base,{kind:'cylinder',cylinder:c})!==0||!liesOnLine(s.start,line)||!liesOnLine(s.end,line))throw new RangeError('Cylinder generator endpoints must lie on the anchor generator');storeLine(s.start,s.end,line);return s;
}
/** Restrict an actual segment and retain only a validated existing line proof. */
export function restrictAlgebraicSegment3(input:AlgebraicSegment3,start:Point3|AlgebraicCoordinates3,end:Point3|AlgebraicCoordinates3):AlgebraicSegment3 {
 const source=algebraicSegment3(input.start,input.end),s=algebraicSegment3(start,end);if(!pointOnAlgebraicSegment3(s.start,source)||!pointOnAlgebraicSegment3(s.end,source))throw new RangeError('Restricted endpoints must belong to the source segment');const line=rationalLine(source.start,source.end);if(line)storeLine(s.start,s.end,line);return s;
}
export function pointOnAlgebraicSegment3(inputPoint:Point3|AlgebraicCoordinates3,input:AlgebraicSegment3):boolean {
  const s=algebraicSegment3(input.start,input.end),p=snapshotExactPoint3(inputPoint),axes=['x','y','z'] as const;
  const certified=lineCache.get(s.start)?.get(s.end);
  if(certified){
    if(p===s.start||p===s.end)return true;
    if(!liesOnLine(p,certified))return false;
    // A nonzero coordinate of the rational direction is injective on this
    // certified line, including a degenerate segment. One interval suffices.
    const axis=axes.find(k=>certified.direction[k].sign()!==0)!,order=s.start[axis].compare(s.end[axis]),lo=order<=0?s.start[axis]:s.end[axis],hi=order<=0?s.end[axis]:s.start[axis];
    return p[axis].compare(lo)>=0&&p[axis].compare(hi)<=0;
  }
  const k=axes.find(k=>s.start[k].compare(s.end[k])!==0);
  if(k===undefined)return algebraicPointsEqual3(p,s.start);
  if(algebraicPointsEqual3(p,s.start)||algebraicPointsEqual3(p,s.end))return true;
  // Reject mismatched fixed coordinates and every coordinate interval before
  // forming cross products of unrelated algebraic fields.
  const varying=axes.filter(j=>s.start[j].compare(s.end[j])!==0);
  for(const j of axes){const order=s.start[j].compare(s.end[j]);if(order===0){if(p[j].compare(s.start[j])!==0)return false;}else {const lo=order<0?s.start[j]:s.end[j],hi=order<0?s.end[j]:s.start[j];if(p[j].compare(lo)<0||p[j].compare(hi)>0)return false;}}
  if(varying.length===1)return true;
  const line=rationalLine(s.start,s.end);if(line)return liesOnLine(p,line);
  // Certified rational interval cross products reject unrelated field points
  // before exact compositum arithmetic. Unresolved cases retain the full check.
  type Interval=readonly [Rational,Rational];
  const sub=(a:Interval,b:Interval):Interval=>[a[0].sub(b[1]),a[1].sub(b[0])],mul=(a:Interval,b:Interval):Interval=>{const products=[a[0].mul(b[0]),a[0].mul(b[1]),a[1].mul(b[0]),a[1].mul(b[1])].sort((a,b)=>a.compare(b));return [products[0]!,products[3]!];};
  let P=axes.map(j=>p[j]),A=axes.map(j=>s.start[j]),B=axes.map(j=>s.end[j]);const pivot=axes.indexOf(k);
  for(let step=0;step<12;step++){
    const D=B.map((p,i)=>sub([p.lower,p.upper],[A[i]!.lower,A[i]!.upper])),Q=P.map((p,i)=>sub([p.lower,p.upper],[A[i]!.lower,A[i]!.upper]));let exact=true;
    for(const j of varying){if(j===k)continue;const index=axes.indexOf(j),cross=sub(mul(Q[index]!,D[pivot]!),mul(Q[pivot]!,D[index]!));if(cross[0].sign()>0||cross[1].sign()<0)return false;if(cross[0].sign()!==0||cross[1].sign()!==0)exact=false;}
    if(exact)return true;P=P.map(p=>p.refine());A=A.map(p=>p.refine());B=B.map(p=>p.refine());
  }
  const d=subtractAlgebraicPoints3(s.end,s.start),q=subtractAlgebraicPoints3(p,s.start);
  return varying.every(j=>j===k||q[j].mul(d[k]).compare(q[k].mul(d[j]))===0);
}
/** Internal whole-segment support predicate, not an endpoint-only cylinder test. */
export function algebraicSegmentOnSurface3(input:AlgebraicSegment3,inputSurface:Surface3):boolean {
  const s=algebraicSegment3(input.start,input.end);
  let surface:Surface3;
  switch(inputSurface.kind){
    case 'plane':{const p=inputSurface.plane;surface={kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)};break;}
    case 'cylinder':surface={kind:'cylinder',cylinder:cylinder3(inputSurface.cylinder.axis,inputSurface.cylinder.radiusSquared)};break;
    default:throw new RangeError('Unknown analytic surface kind');
  }
  if(surface.kind==='plane')return classifyPointToSurface3(s.start,surface)===0&&classifyPointToSurface3(s.end,surface)===0;
  if(algebraicPointsEqual3(s.start,s.end))return classifyPointToSurface3(s.start,surface)===0;
  const line=rationalLine(s.start,s.end);if(line)return parallelDirections(line.direction,surface.cylinder.axis.direction)&&classifyPointToSurface3(line.base,surface)===0;
  // A nondegenerate straight segment on a circular cylinder is an axial
  // generator: both endpoints have the same exact normal-plane projection.
  const a=cylinderIntersectionPointBase3(s.start,surface.cylinder)??cylinderCoordinates3(surface.cylinder,s.start).base,b=cylinderIntersectionPointBase3(s.end,surface.cylinder)??cylinderCoordinates3(surface.cylinder,s.end).base;
  return compareAlgebraicPoints3(a,b)===0&&classifyPointToSurface3(a,surface)===0;
}
