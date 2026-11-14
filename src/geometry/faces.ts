import { Rational } from "../numeric/rational.js";
import { point2 } from "./point2.js";
import type { Point2, Segment2 } from "./point2.js";
import { buildHalfEdges } from "./half-edges.js";
import type { HalfEdgeArrangement } from "./half-edges.js";

export interface ArrangementFace {
  /** Null for the unbounded face (always index 0). */
  readonly outerBoundary: number | null;
  readonly boundaries: readonly number[];
  readonly isolatedVertices: readonly number[];
  /** Exact twice-area, null for the unbounded face. */
  readonly twiceArea: Rational | null;
}
export interface FaceArrangement extends HalfEdgeArrangement {
  readonly faces: readonly ArrangementFace[];
  readonly boundaryFaces: readonly number[];
  readonly halfEdgeFaces: readonly number[];
}
const zero = new Rational(0n), one = new Rational(1n), two = new Rational(2n);
const cross = (a: Point2, b: Point2) => a.x.mul(b.y).sub(a.y.mul(b.x));
const sub = (a: Point2, b: Point2): Point2 => ({x:a.x.sub(b.x), y:a.y.sub(b.y)});

/** Groups boundary walks into faces, including disconnected holes and trees. */
export function buildFaces(input: readonly Segment2[]): FaceArrangement {
  const a = buildHalfEdges(input);
  const endpoints = (id: number): [Point2, Point2] => {
    const h = a.halfEdges[id]!;
    return [a.vertices[h.origin]!.point, a.vertices[h.target]!.point];
  };
  // A rational point immediately to the left: stop before the first ray/graph hit.
  function leftSample(id: number): Point2 {
    const [p,q] = endpoints(id), d = sub(q,p);
    const m = point2(p.x.add(q.x).div(two),p.y.add(q.y).div(two));
    const n = point2(d.y.neg(),d.x);
    let step = one;
    for (const edge of a.edges) {
      const p = a.vertices[edge.start]!.point, q = a.vertices[edge.end]!.point;
      const s = sub(q,p), r = sub(p,m), det = cross(n,s);
      const consider = (t: Rational) => {
        if (t.sign()>0 && t.compare(step.mul(two))<=0) step = t.div(two);
      };
      if (det.sign()!==0) {
        const t = cross(r,s).div(det), u = cross(r,n).div(det);
        if (u.compare(zero)>=0 && u.compare(one)<=0) consider(t);
      } else if (cross(r,n).sign()===0) {
        const axis = n.x.sign()!==0 ? 'x' : 'y';
        consider(p[axis].sub(m[axis]).div(n[axis]));
        consider(q[axis].sub(m[axis]).div(n[axis]));
      }
    }
    return point2(m.x.add(n.x.mul(step)),m.y.add(n.y.mul(step)));
  }
  function winding(boundary: number, p: Point2): number {
    let count=0;
    for (const id of a.boundaries[boundary]!.halfEdges) {
      const [u,v]=endpoints(id), side=cross(sub(v,u),sub(p,u)).sign();
      if (u.y.compare(p.y)<=0 && v.y.compare(p.y)>0 && side>0) count++;
      if (v.y.compare(p.y)<=0 && u.y.compare(p.y)>0 && side<0) count--;
    }
    return count;
  }
  const positive = a.boundaries.map((b,i)=>({b,i})).filter(({b})=>b.twiceSignedArea.sign()>0);
  const faces: {outerBoundary:number|null; boundaries:number[]; isolatedVertices:number[]; twiceArea:Rational|null}[] = [
    {outerBoundary:null,boundaries:[],isolatedVertices:[],twiceArea:null},
    ...positive.map(({i})=>({outerBoundary:i,boundaries:[] as number[],isolatedVertices:[] as number[],twiceArea:zero})),
  ];
  function containing(p: Point2): number {
    let face=0;
    positive.forEach(({b,i},index)=>{
      if (winding(i,p)!==0 && (face===0 || b.twiceSignedArea.compare(a.boundaries[faces[face]!.outerBoundary!]!.twiceSignedArea)<0)) face=index+1;
    });
    return face;
  }
  const boundaryFaces = a.boundaries.map((b,i)=>{
    const own=positive.findIndex(entry=>entry.i===i);
    const face=own>=0 ? own+1 : containing(leftSample(b.halfEdges[0]!));
    const f=faces[face]!;
    f.boundaries.push(i);
    if(f.twiceArea!==null) f.twiceArea=f.twiceArea.add(b.twiceSignedArea);
    return face;
  });
  a.vertices.forEach((v,i)=>{
    if(a.outgoing[i]!.length===0) faces[containing(v.point)]!.isolatedVertices.push(i);
  });
  return Object.freeze({...a,
    faces:Object.freeze(faces.map(f=>Object.freeze({...f,boundaries:Object.freeze(f.boundaries),isolatedVertices:Object.freeze(f.isolatedVertices)}))),
    boundaryFaces:Object.freeze(boundaryFaces),
    halfEdgeFaces:Object.freeze(a.halfEdges.map(h=>boundaryFaces[h.boundary]!))});
}
