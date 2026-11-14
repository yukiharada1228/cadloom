import { point2 } from "./point2.js";
import type { Point2 } from "./point2.js";
import { cross3, point3, pointsEqual3, segment3 } from "./point3.js";
import type { Point3, Segment3 } from "./point3.js";
import { evaluatePlane3, planeFromPoints } from "./plane3.js";
import { intersectTrianglePlane, pointOnTriangle3, triangle3 } from "./triangle3.js";
import type { Triangle3 } from "./triangle3.js";
import { intersectSegments } from "./segment-intersection.js";
import { orient2d } from "./orient2d.js";

export type TriangleTriangleIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly point: Point3 }
  | { readonly kind: "segment"; readonly segment: Segment3 }
  | { readonly kind: "polygon"; readonly polygon: readonly Point3[] };

const compare3=(a:Point3,b:Point3)=>a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z);
function intervalResult(a:Point3,b:Point3):TriangleTriangleIntersection {
  const order=compare3(a,b);
  if(order>0)return Object.freeze({kind:"none"});
  if(order===0)return Object.freeze({kind:"point",point:a});
  return Object.freeze({kind:"segment",segment:segment3(a,b)});
}

/** Exact closed intersection; polygon output preserves area contacts in a common plane. */
export function intersectTriangles3(first: Triangle3, second: Triangle3): TriangleTriangleIntersection {
  const a=triangle3(...first),b=triangle3(...second);
  const pa=planeFromPoints(...a),pb=planeFromPoints(...b);
  const direction=cross3(pa.normal,pb.normal);
  const parallel=direction.x.sign()===0&&direction.y.sign()===0&&direction.z.sign()===0;
  if(!parallel){
    const ca=intersectTrianglePlane(a,pb),cb=intersectTrianglePlane(b,pa);
    if(ca.kind==="none"||cb.kind==="none")return Object.freeze({kind:"none"});
    if(ca.kind==="coplanar"||cb.kind==="coplanar")throw new Error("Nonparallel face planes cannot contain one another");
    const bounds=(cut:typeof ca):readonly [Point3,Point3]=>cut.kind==="point"?[cut.point,cut.point]:[cut.segment.start,cut.segment.end];
    const [a0,a1]=bounds(ca),[b0,b1]=bounds(cb);
    return intervalResult(compare3(a0,b0)>=0?a0:b0,compare3(a1,b1)<=0?a1:b1);
  }
  if(evaluatePlane3(pa,b[0]).sign()!==0)return Object.freeze({kind:"none"});
  // Cyclic retained axes make positive projected winding a positive component
  // of the 3D area vector. The dominant normal axis is unchanged by scaling.
  const axes=["x","y","z"] as const;
  let drop=0;
  const absolute=(axis:typeof axes[number])=>{
    const v=pa.normal[axis];return v.sign()<0?v.neg():v;
  };
  for(let i=1;i<3;i++)if(absolute(axes[i]!).compare(absolute(axes[drop]!))>0)drop=i;
  const w=axes[drop]!,u=axes[(drop+1)%3]!,v=axes[(drop+2)%3]!;
  const project=(p:Point3)=>point2(p[u],p[v]);
  const lift=(p:Point2):Point3=>{
    const omitted=pa.normal[u].mul(p.x).add(pa.normal[v].mul(p.y)).add(pa.offset).neg().div(pa.normal[w]);
    const coordinates={x:omitted,y:omitted,z:omitted};coordinates[u]=p.x;coordinates[v]=p.y;
    return point3(coordinates.x,coordinates.y,coordinates.z);
  };
  const candidates=new Map<string,{projected:Point2;point:Point3}>();
  const add=(p:Point3)=>{const q=project(p);candidates.set(`${q.x},${q.y}`,{projected:q,point:p});};
  for(const p of a)if(pointOnTriangle3(p,b))add(p);
  for(const p of b)if(pointOnTriangle3(p,a))add(p);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const hit=intersectSegments({start:project(a[i]!),end:project(a[(i+1)%3]!)},
      {start:project(b[j]!),end:project(b[(j+1)%3]!)});
    if(hit.kind==="point")add(lift(hit.point));
    if(hit.kind==="overlap"){add(lift(hit.segment.start));add(lift(hit.segment.end));}
  }
  const sorted=[...candidates.values()].sort((a,b)=>a.projected.x.compare(b.projected.x)||a.projected.y.compare(b.projected.y));
  if(sorted.length===0)return Object.freeze({kind:"none"});
  type Candidate=typeof sorted[number];
  const chain=(points:readonly Candidate[])=>{
    const result:Candidate[]=[];
    for(const p of points){
      while(result.length>=2&&orient2d(result[result.length-2]!.projected,result[result.length-1]!.projected,p.projected)<=0)result.pop();
      result.push(p);
    }
    return result;
  };
  const lower=chain(sorted),upper=chain(sorted.slice().reverse());
  const hull=sorted.length===1?sorted:[...lower.slice(0,-1),...upper.slice(0,-1)];
  if(hull.length===1)return Object.freeze({kind:"point",point:hull[0]!.point});
  if(hull.length===2){
    const p=hull[0]!.point,q=hull[1]!.point;
    return compare3(p,q)<=0?intervalResult(p,q):intervalResult(q,p);
  }
  let start=0;
  for(let i=1;i<hull.length;i++)if(compare3(hull[i]!.point,hull[start]!.point)<0)start=i;
  const polygon=[...hull.slice(start),...hull.slice(0,start)].map(p=>p.point);
  return Object.freeze({kind:"polygon",polygon:Object.freeze(polygon)});
}

export interface TriangleEmbeddingIssue {
  readonly first: number;
  readonly second: number;
  readonly kind: "duplicate-face" | "improper-intersection";
  readonly intersection: TriangleTriangleIntersection;
}
export interface TriangleEmbeddingInspection {
  /** Pairwise geometric conformity; does not assert a closed, manifold or outward surface. */
  readonly embedded: boolean;
  readonly issues: readonly TriangleEmbeddingIssue[];
}

/** Checks that every pair meets only in its shared vertex or shared full edge. O(F²). */
export function inspectTriangleEmbedding(input: readonly Triangle3[]): TriangleEmbeddingInspection {
  const faces=input.map(t=>triangle3(...t)),issues:TriangleEmbeddingIssue[]=[];
  const bounds=faces.map(face=>(['x','y','z'] as const).map(axis=>{
    const values=face.map(p=>p[axis]).sort((a,b)=>a.compare(b));
    return {min:values[0]!,max:values[2]!};
  }));
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
    // Strict separation only: equality must retain vertex/edge/face contacts.
    if(bounds[i]!.some((a,k)=>a.max.compare(bounds[j]![k]!.min)<0||bounds[j]![k]!.max.compare(a.min)<0))continue;
    const a=faces[i]!,b=faces[j]!,hit=intersectTriangles3(a,b);
    const shared=a.filter(p=>b.some(q=>pointsEqual3(p,q))).sort(compare3);
    const proper=shared.length===0?hit.kind==="none":shared.length===1?
      hit.kind==="point"&&pointsEqual3(hit.point,shared[0]!):shared.length===2?
      hit.kind==="segment"&&pointsEqual3(hit.segment.start,shared[0]!)&&pointsEqual3(hit.segment.end,shared[1]!):false;
    if(!proper)issues.push(Object.freeze({first:i,second:j,kind:shared.length===3?"duplicate-face":"improper-intersection",intersection:hit}));
  }
  return Object.freeze({embedded:issues.length===0,issues:Object.freeze(issues)});
}
