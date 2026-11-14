import { cross3, dot3, point3, pointsEqual3, segment3, subtract3 } from "./point3.js";
import type { Point3, Segment3 } from "./point3.js";
import { evaluatePlane3, intersectSegmentPlane, planeFromPoints } from "./plane3.js";
import type { Plane3 } from "./plane3.js";
import type { Rational } from "../numeric/rational.js";

export type Triangle3 = readonly [Point3, Point3, Point3];

/** Nondegenerate oriented triangle. All three points are snapshotted. */
export function triangle3(a: Point3, b: Point3, c: Point3): Triangle3 {
  planeFromPoints(a,b,c); // Reject repeated/collinear vertices.
  return Object.freeze([point3(a.x,a.y,a.z),point3(b.x,b.y,b.z),point3(c.x,c.y,c.z)]);
}

/** Closed triangle membership, including its edges. Degenerate triangles are rejected. */
export function pointOnTriangle3(point: Point3, input: Triangle3): boolean {
  const triangle=triangle3(...input),plane=planeFromPoints(...triangle);
  if(evaluatePlane3(plane,point).sign()!==0)return false;
  return triangle.every((a,i)=>{
    const b=triangle[(i+1)%3]!;
    return dot3(cross3(subtract3(b,a),subtract3(point,a)),plane.normal).sign()>=0;
  });
}

export type TrianglePlaneIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly point: Point3 }
  | { readonly kind: "segment"; readonly segment: Segment3 }
  | { readonly kind: "coplanar"; readonly triangle: Triangle3 };

export interface TrianglePlaneSplit {
  /** Nonzero-area triangles in the closed positive halfspace, with input winding. */
  readonly positive: readonly Triangle3[];
  readonly negative: readonly Triangle3[];
  /** Coplanar area is returned once here, never duplicated into both side lists. */
  readonly coplanar: Triangle3 | null;
  readonly intersection: TrianglePlaneIntersection;
}

function cutData(input: Triangle3, plane: Plane3) {
  const triangle=triangle3(...input);
  const values=triangle.map(p=>evaluatePlane3(plane,p));
  const cuts:(Point3|undefined)[]=[];
  for(let i=0;i<3;i++){
    if(values[i]!.sign()*values[(i+1)%3]!.sign()<0){
      const hit=intersectSegmentPlane(segment3(triangle[i]!,triangle[(i+1)%3]!),plane);
      if(hit.kind!=="point")throw new Error("Strictly crossing edge did not yield a point");
      cuts[i]=hit.point;
    }
  }
  return {triangle,values,cuts};
}
function intersectionOf(triangle: Triangle3, values: readonly Rational[], cuts: readonly (Point3|undefined)[]): TrianglePlaneIntersection {
  if(values.every(v=>v.sign()===0))return Object.freeze({kind:"coplanar",triangle});
  const points:Point3[]=[];
  triangle.forEach((p,i)=>{
    if(values[i]!.sign()===0)points.push(p);
    if(cuts[i])points.push(cuts[i]!);
  });
  const unique=points.filter((p,i)=>points.findIndex(q=>pointsEqual3(p,q))===i);
  unique.sort((a,b)=>a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z));
  if(unique.length===0)return Object.freeze({kind:"none"});
  if(unique.length===1)return Object.freeze({kind:"point",point:unique[0]!});
  if(unique.length!==2)throw new Error("Non-coplanar triangle intersection must have at most two endpoints");
  return Object.freeze({kind:"segment",segment:segment3(unique[0]!,unique[1]!)});
}
export function intersectTrianglePlane(input: Triangle3, plane: Plane3): TrianglePlaneIntersection {
  const {triangle,values,cuts}=cutData(input,plane);
  return intersectionOf(triangle,values,cuts);
}

/** Splits a triangle at a plane, discarding only zero-area side fragments. */
export function splitTriangleByPlane(input: Triangle3, plane: Plane3): TrianglePlaneSplit {
  const {triangle,values,cuts}=cutData(input,plane);
  const intersection=intersectionOf(triangle,values,cuts);
  const empty:readonly Triangle3[]=Object.freeze([]);
  if(intersection.kind==="coplanar"){
    return Object.freeze({positive:empty,negative:empty,coplanar:triangle,intersection});
  }
  function clip(side:1|-1):readonly Triangle3[]{
    const polygon:Point3[]=[];
    triangle.forEach((p,i)=>{
      if(values[i]!.sign()*side>=0)polygon.push(p);
      if(cuts[i])polygon.push(cuts[i]!);
    });
    const pieces:Triangle3[]=[];
    for(let i=1;i+1<polygon.length;i++){
      pieces.push(triangle3(polygon[0]!,polygon[i]!,polygon[i+1]!));
    }
    return Object.freeze(pieces);
  }
  return Object.freeze({positive:clip(1),negative:clip(-1),coplanar:null,intersection});
}
