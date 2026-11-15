import type {Rational} from '../numeric/rational.js';
import {cylinderIntersectionPointBase3} from './cylinder-cylinder3.js';
import {cylinderCoordinates3} from './cylinder-coordinates3.js';
import {snapshotExactPoint3,subtractAlgebraicPoints3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import type {Surface3} from './surface3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import {plane3} from './plane3.js';

/** Straight closed segment with arbitrary exact real algebraic endpoints. */
export interface AlgebraicSegment3 {readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;}
export function algebraicSegment3(start:Point3|AlgebraicCoordinates3,end:Point3|AlgebraicCoordinates3):AlgebraicSegment3 {
  return Object.freeze({start:snapshotExactPoint3(start),end:snapshotExactPoint3(end)});
}
export function pointOnAlgebraicSegment3(inputPoint:Point3|AlgebraicCoordinates3,input:AlgebraicSegment3):boolean {
  const s=algebraicSegment3(input.start,input.end),p=snapshotExactPoint3(inputPoint),axes=['x','y','z'] as const,k=axes.find(k=>s.start[k].compare(s.end[k])!==0);
  if(k===undefined)return compareAlgebraicPoints3(p,s.start)===0;
  if(compareAlgebraicPoints3(p,s.start)===0||compareAlgebraicPoints3(p,s.end)===0)return true;
  // Reject mismatched fixed coordinates and every coordinate interval before
  // forming cross products of unrelated algebraic fields.
  const varying=axes.filter(j=>s.start[j].compare(s.end[j])!==0);
  for(const j of axes){const order=s.start[j].compare(s.end[j]);if(order===0){if(p[j].compare(s.start[j])!==0)return false;}else {const lo=order<0?s.start[j]:s.end[j],hi=order<0?s.end[j]:s.start[j];if(p[j].compare(lo)<0||p[j].compare(hi)>0)return false;}}
  if(varying.length===1)return true;
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
  // A nondegenerate straight segment on a circular cylinder is an axial
  // generator: both endpoints have the same exact normal-plane projection.
  const a=cylinderIntersectionPointBase3(s.start,surface.cylinder)??cylinderCoordinates3(surface.cylinder,s.start).base,b=cylinderIntersectionPointBase3(s.end,surface.cylinder)??cylinderCoordinates3(surface.cylinder,s.end).base;
  return compareAlgebraicPoints3(a,b)===0&&classifyPointToSurface3(a,surface)===0;
}
