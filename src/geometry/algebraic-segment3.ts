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
  // Reject mismatched fixed coordinates and every coordinate interval before
  // forming cross products of unrelated algebraic fields.
  const varying=axes.filter(j=>s.start[j].compare(s.end[j])!==0);
  for(const j of axes){const order=s.start[j].compare(s.end[j]);if(order===0){if(p[j].compare(s.start[j])!==0)return false;}else {const lo=order<0?s.start[j]:s.end[j],hi=order<0?s.end[j]:s.start[j];if(p[j].compare(lo)<0||p[j].compare(hi)>0)return false;}}
  if(varying.length===1)return true;
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
  if(classifyPointToSurface3(s.start,surface)!==0||classifyPointToSurface3(s.end,surface)!==0)return false;
  if(surface.kind==='plane')return true;
  const n=surface.cylinder.axis.direction,d=subtractAlgebraicPoints3(s.end,s.start);
  return d.z.affine(n.y).compare(d.y.affine(n.z))===0&&d.x.affine(n.z).compare(d.z.affine(n.x))===0&&d.y.affine(n.x).compare(d.x.affine(n.y))===0;
}
