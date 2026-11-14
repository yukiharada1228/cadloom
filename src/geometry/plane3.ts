import { Rational } from "../numeric/rational.js";
import type { Sign } from "../numeric/rational.js";
import { point2 } from "./point2.js";
import type { ExactInput } from "./point2.js";
import { cross3, dot3, point3, pointsEqual3, segment3, subtract3, vector3 } from "./point3.js";
import type { Point3, Segment3, Vector3 } from "./point3.js";

/** Oriented plane: normal · p + offset = 0. Normal is nonzero, not unit length. */
export interface Plane3 { readonly normal: Vector3; readonly offset: Rational }

function assertNormal(normal: Vector3): void {
  if(normal.x.sign()===0 && normal.y.sign()===0 && normal.z.sign()===0) {
    throw new RangeError("A plane requires a nonzero normal");
  }
}
export function plane3(nx: ExactInput, ny: ExactInput, nz: ExactInput, offset: ExactInput = 0n): Plane3 {
  const normal=vector3(nx,ny,nz);
  assertNormal(normal);
  return Object.freeze({normal,offset:point2(offset,0n).x});
}
export function planeFromPoints(a: Point3, b: Point3, c: Point3): Plane3 {
  const normal=cross3(subtract3(b,a),subtract3(c,a));
  return plane3(normal.x,normal.y,normal.z,dot3(normal,a).neg());
}
export function evaluatePlane3(plane: Plane3, point: Point3): Rational {
  assertNormal(plane.normal);
  return dot3(plane.normal,point).add(plane.offset);
}
export function classifyPointToPlane3(plane: Plane3, point: Point3): Sign {
  return evaluatePlane3(plane,point).sign();
}
export type SegmentPlaneIntersection =
  | { readonly kind: "none" }
  | { readonly kind: "point"; readonly point: Point3; readonly parameter: Rational }
  | { readonly kind: "coplanar"; readonly segment: Segment3 };

/** Exact intersection with a closed segment. A collapsed coplanar segment is a point. */
export function intersectSegmentPlane(segment: Segment3, plane: Plane3): SegmentPlaneIntersection {
  const a=segment.start,b=segment.end;
  const start=evaluatePlane3(plane,a),end=evaluatePlane3(plane,b);
  const startSign=start.sign(),endSign=end.sign();
  if(startSign===0 && endSign===0 && !pointsEqual3(a,b)) {
    return Object.freeze({kind:"coplanar",segment:segment3(a,b)});
  }
  if(startSign===0) {
    return Object.freeze({kind:"point",point:point3(a.x,a.y,a.z),parameter:new Rational(0n)});
  }
  if(endSign===0) {
    return Object.freeze({kind:"point",point:point3(b.x,b.y,b.z),parameter:new Rational(1n)});
  }
  if(startSign===endSign) return Object.freeze({kind:"none"});
  const parameter=start.div(start.sub(end));
  const interpolate=(x:Rational,y:Rational)=>x.add(y.sub(x).mul(parameter));
  return Object.freeze({kind:"point",parameter,
    point:point3(interpolate(a.x,b.x),interpolate(a.y,b.y),interpolate(a.z,b.z))});
}

export type PlanePlaneIntersection3=
 | {readonly kind:'none'}
 | {readonly kind:'coincident';readonly plane:Plane3}
 | {readonly kind:'line';readonly line:import('./surface3.js').Line3};
/** Complete rational supporting-plane intersection; normal sign/scale is immaterial. */
export function intersectPlanes3(inputA:Plane3,inputB:Plane3):PlanePlaneIntersection3 {
  const a=plane3(inputA.normal.x,inputA.normal.y,inputA.normal.z,inputA.offset),b=plane3(inputB.normal.x,inputB.normal.y,inputB.normal.z,inputB.offset),d=cross3(a.normal,b.normal);
  if(dot3(d,d).sign()===0){
    const k=(['x','y','z'] as const).find(k=>a.normal[k].sign()!==0)!,scale=b.normal[k].div(a.normal[k]);
    return a.offset.mul(scale).equals(b.offset)?Object.freeze({kind:'coincident',plane:a}):Object.freeze({kind:'none'});
  }
  const A=dot3(a.normal,a.normal),B=dot3(b.normal,b.normal),C=dot3(a.normal,b.normal),det=A.mul(B).sub(C.mul(C)),k=a.offset.neg(),l=b.offset.neg(),alpha=k.mul(B).sub(l.mul(C)).div(det),beta=l.mul(A).sub(k.mul(C)).div(det);
  const component=(key:'x'|'y'|'z')=>a.normal[key].mul(alpha).add(b.normal[key].mul(beta));
  const line=Object.freeze({origin:point3(component('x'),component('y'),component('z')),direction:d});return Object.freeze({kind:'line',line});
}
