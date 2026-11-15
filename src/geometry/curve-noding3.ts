import {commonAlgebraicAxialLine3} from './algebraic-axial-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,cross3,dot3} from './point3.js';
import {algebraicCoordinates3,compareAlgebraicPoints3,compareLinearPoints3,signLinearAlgebraicPoint3,subtractAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import type {AlgebraicSegment3} from './algebraic-segment3.js';
import {ellipse3,intersectEllipses3,intersectAlgebraicSegmentEllipse3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';
import {planeFrame3} from './plane-frame3.js';
import {snapshotCurve3,curveEndpoints3,pointOnCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
const axes=['x','y','z'] as const;
export function support(c:Curve3):Ellipse3|null {
  if(c.kind==='elliptic-arc')return c.arc.ellipse;
  if(c.kind==='planar-arc'){
    const f=c.arc.frame,C=c.arc.arc.circle.center,r=c.arc.arc.circle.radiusSquared;
    return ellipse3(planeFrame3(point3(f.origin.x.add(f.u.x.mul(C.x)).add(f.v.x.mul(C.y)),f.origin.y.add(f.u.y.mul(C.x)).add(f.v.y.mul(C.y)),f.origin.z.add(f.u.z.mul(C.x)).add(f.v.z.mul(C.y))),f.u,f.v),r,r);
  }
  if(c.kind==='circular-arc'){
    const circle=c.arc.circle,n=circle.normal,u=n.y.sign()!==0||n.z.sign()!==0?cross3(n,vector3(1n,0n,0n)):cross3(n,vector3(0n,1n,0n)),v=cross3(n,u);
    return ellipse3(planeFrame3(circle.center,u,v),circle.radiusSquared.div(dot3(u,u)),circle.radiusSquared.div(dot3(v,v)));
  }
  return null;
}
export function segmentCross(a:AlgebraicSegment3,b:AlgebraicSegment3):readonly AlgebraicCoordinates3[] {
  // Reject disjoint finite intervals before creating any composite field.
  for(const k of axes){const aa=a.start[k].compare(a.end[k])<=0?[a.start[k],a.end[k]] as const:[a.end[k],a.start[k]] as const,bb=b.start[k].compare(b.end[k])<=0?[b.start[k],b.end[k]] as const:[b.end[k],b.start[k]] as const;if(aa[1].compare(bb[0])<0||bb[1].compare(aa[0])<0)return [];}
  const support=(s:AlgebraicSegment3)=>{
    const known=commonAlgebraicAxialLine3(s.start,s.end);if(known)return known;
    if(axes.every(k=>s.start[k].rational!==null&&s.end[k].rational!==null)){
      const d=vector3(...axes.map(k=>s.end[k].rational!.sub(s.start[k].rational!)) as Parameters<typeof vector3>);
      if(dot3(d,d).sign()!==0)return {base:s.start,direction:d};
    }
    return null;
  };
  const first=support(a),second=support(b);
  if(first&&second){
    const onLine=(p:AlgebraicCoordinates3,line:NonNullable<typeof first>)=>{
      const d=line.direction,n=cross3(d,d.y.sign()!==0||d.z.sign()!==0?vector3(1n,0n,0n):vector3(0n,1n,0n)),m=cross3(d,n);
      if(axes.every(k=>line.base[k].rational!==null)){const o=point3(line.base.x.rational!,line.base.y.rational!,line.base.z.rational!);return [n,m].every(normal=>signLinearAlgebraicPoint3(p,normal,dot3(normal,o).neg())===0);}
      return [n,m].every(normal=>compareLinearPoints3(p,line.base,normal)===0);
    };
    const inBounds=(p:AlgebraicCoordinates3,s:AlgebraicSegment3,d:typeof first.direction)=>{const k=axes.find(k=>d[k].sign()!==0)!,ascending=s.start[k].compare(s.end[k])<=0,lo=ascending?s.start[k]:s.end[k],hi=ascending?s.end[k]:s.start[k];return p[k].compare(lo)>=0&&p[k].compare(hi)<=0;};
    const cross=cross3(first.direction,second.direction);
    if(dot3(cross,cross).sign()===0){
      if(!onLine(a.start,second))return [];
      return [a.start,a.end,b.start,b.end].filter(p=>inBounds(p,a,first.direction)&&inBounds(p,b,second.direction));
    }
    // A nonparallel pair has at most one meeting point. Existing boundary
    // endpoints retain their source fields instead of being reconstructed.
    for(const [segment,other,line] of [[a,b,second],[b,a,first]] as const)for(const p of [segment.start,segment.end])if(inBounds(p,other,line.direction)&&onLine(p,line))return [p];
  }
  const A=subtractAlgebraicPoints3(a.end,a.start),B=subtractAlgebraicPoints3(b.end,b.start),q=subtractAlgebraicPoints3(b.start,a.start),pairs=[['x','y'],['y','z'],['z','x']] as const;
  for(const [i,j] of pairs){
    const det=A[i].mul(B[j]).sub(A[j].mul(B[i]));if(det.sign()===0)continue;
    const t=q[i].mul(B[j]).sub(q[j].mul(B[i])).div(det),p=algebraicCoordinates3(...axes.map(k=>a.start[k].add(A[k].mul(t))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
    return pointOnAlgebraicSegment3(p,a)&&pointOnAlgebraicSegment3(p,b)?[p]:[];
  }
  return [a.start,a.end,b.start,b.end].filter(p=>pointOnAlgebraicSegment3(p,a)&&pointOnAlgebraicSegment3(p,b));
}

/** Finite noding events for bounded native lines and conic arcs. Includes
 * isolated intersections and ends of coincident overlaps. A coincident closed
 * curve contributes its representation seam; the points are NOT a complete
 * point-set intersection or a tangency/multiplicity certificate.
 * Exact, unique lexicographic order is independent of argument/traversal order.
 */
export function curveNodingPoints3(inputA:Curve3,inputB:Curve3):readonly AlgebraicCoordinates3[] {
 const canonical=(input:Curve3):Curve3=>{
  const c=snapshotCurve3(input);
  if(c.kind!=='line')return c;
  const [start,end]=curveEndpoints3(c);
  return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(start,end)});
 };
 const a=canonical(inputA),b=canonical(inputB),A=support(a),B=support(b);
 let points:readonly AlgebraicCoordinates3[];
 if(a.kind==='algebraic-segment'&&b.kind==='algebraic-segment')points=segmentCross(a.segment,b.segment);
 else if(A&&B){
  const hit=intersectEllipses3(A,B);
  points=hit.kind==='points'?hit.points:hit.kind==='coincident'?[...curveEndpoints3(a),...curveEndpoints3(b)]:[];
 }else {
  const segment=a.kind==='algebraic-segment'?a:b,ellipse=A??B;
  if(segment.kind!=='algebraic-segment'||!ellipse)throw new RangeError('Noding requires bounded native lines or conic arcs');
  points=intersectAlgebraicSegmentEllipse3(segment.segment,ellipse);
 }
 const sorted=points.filter(p=>pointOnCurve3(p,a)&&pointOnCurve3(p,b)).sort(compareAlgebraicPoints3);
 return Object.freeze(sorted.filter((p,i)=>i===0||compareAlgebraicPoints3(sorted[i-1]!,p)!==0));
}

export interface CurveNodingEvent3 {
 readonly point:AlgebraicCoordinates3;
 /** Input curve indexes meeting at this endpoint or pairwise cut event. */
 readonly curves:readonly number[];
}
/** Endpoints plus pairwise cut events with exact source-curve incidence.
 * Does not split edges, infer crossing multiplicity, or certify face domains.
 */
export function collectCurveNodingEvents3(inputs:readonly Curve3[]):readonly CurveNodingEvent3[] {
 const curves=inputs.map(snapshotCurve3),records:{point:AlgebraicCoordinates3;curves:readonly number[];order:number}[]=[];
 const add=(point:AlgebraicCoordinates3,ids:readonly number[])=>records.push({point,curves:ids,order:records.length});
 curves.forEach((curve,i)=>{
  for(const point of curveEndpoints3(curve))add(point,[i]);
  for(let j=0;j<i;j++)for(const point of curveNodingPoints3(curve,curves[j]!))add(point,[j,i]);
 });
 records.sort((a,b)=>compareAlgebraicPoints3(a.point,b.point)||a.order-b.order);
 const result:CurveNodingEvent3[]=[];
 for(let i=0;i<records.length;){
  const first=records[i]!,ids=new Set<number>();let j=i;
  while(j<records.length&&compareAlgebraicPoints3(first.point,records[j]!.point)===0){for(const id of records[j]!.curves)ids.add(id);j++;}
  result.push(Object.freeze({point:first.point,curves:Object.freeze([...ids].sort((a,b)=>a-b))}));i=j;
 }
 return Object.freeze(result);
}
