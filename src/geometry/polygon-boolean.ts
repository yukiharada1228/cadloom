import { Rational } from "../numeric/rational.js";
import { comparePoints, point2, segment2 } from "./point2.js";
import type { Point2, Segment2 } from "./point2.js";
import { buildFaces } from "./faces.js";
import type { FaceArrangement } from "./faces.js";

/** Implicitly closed rings; orientation is significant only for the nonzero fill rule. */
export type PolygonRegion = readonly (readonly Point2[])[];
export type BooleanOperation = "union" | "intersection" | "difference" | "xor";
export type FillRule = "even-odd" | "nonzero";
export interface PolygonBooleanResult {
  /** Selected material lies to the left: outer rings CCW, holes CW. */
  readonly rings: PolygonRegion;
  readonly twiceArea: Rational;
  readonly arrangement: FaceArrangement;
  readonly selectedFaces: readonly number[];
}

/** Regularized area Boolean: point/edge-only intersections produce no rings. */
export function booleanPolygons(
  a: PolygonRegion, b: PolygonRegion, operation: BooleanOperation,
  fillRule: FillRule = "even-odd",
): PolygonBooleanResult {
  if (!["union", "intersection", "difference", "xor"].includes(operation)) {
    throw new RangeError("Unknown Boolean operation");
  }
  if (fillRule !== "even-odd" && fillRule !== "nonzero") throw new RangeError("Unknown fill rule");
  const segments: Segment2[] = [];
  const owners: number[] = [];
  [a,b].forEach((region, owner) => {
    for (const ring of region) {
      if (ring.length < 3) throw new RangeError("A ring requires at least three points");
      for (let i=0; i<ring.length; i++) {
        segments.push(segment2(ring[i]!, ring[(i+1)%ring.length]!));
        owners.push(owner);
      }
    }
  });
  const arrangement = buildFaces(segments);
  type Winding = readonly [number, number];
  const adjacency: {face: number; delta: Winding}[][] = arrangement.faces.map(() => []);
  arrangement.edges.forEach((edge, i) => {
    const delta: [number,number] = [0,0];
    for (const source of edge.sources) {
      const s = segments[source]!;
      delta[owners[source]! as 0|1] += comparePoints(s.start,s.end) < 0 ? 1 : -1;
    }
    const left = arrangement.halfEdgeFaces[2*i]!, right = arrangement.halfEdgeFaces[2*i+1]!;
    adjacency[right]!.push({face:left,delta});
    adjacency[left]!.push({face:right,delta:[-delta[0],-delta[1]]});
  });
  const windings: (Winding | undefined)[] = arrangement.faces.map(() => undefined);
  windings[0] = [0,0];
  const queue = [0];
  for (let i=0; i<queue.length; i++) {
    const face = queue[i]!, value = windings[face]!;
    for (const edge of adjacency[face]!) {
      const next: Winding = [value[0]+edge.delta[0],value[1]+edge.delta[1]];
      const prior = windings[edge.face];
      if (prior === undefined) {
        windings[edge.face] = next;
        queue.push(edge.face);
      } else if (prior[0]!==next[0] || prior[1]!==next[1]) {
        throw new Error("Inconsistent face winding propagation");
      }
    }
  }
  const inside = (n:number) => fillRule === "nonzero" ? n!==0 : n%2!==0;
  const selected = windings.map(w => {
    if (w === undefined) throw new Error("Disconnected face adjacency");
    const x=inside(w[0]), y=inside(w[1]);
    switch(operation) {
      case "union": return x || y;
      case "intersection": return x && y;
      case "difference": return x && !y;
      case "xor": return x !== y;
    }
  });
  const boundary = new Set<number>();
  arrangement.halfEdges.forEach((h,i) => {
    if (selected[arrangement.halfEdgeFaces[i]!] && !selected[arrangement.halfEdgeFaces[h.twin]!]) boundary.add(i);
  });
  const positions: number[] = [];
  arrangement.outgoing.forEach(ids => ids.forEach((id,index) => {positions[id]=index;}));
  const successors = new Map<number,number>();
  for (const id of boundary) {
    const h=arrangement.halfEdges[id]!, around=arrangement.outgoing[h.target]!;
    for (let offset=1; offset<=around.length; offset++) {
      const next=around[(positions[h.twin]!+around.length-offset)%around.length]!;
      if(boundary.has(next)) {successors.set(id,next);break;}
    }
    if (!successors.has(id)) throw new Error("Open Boolean boundary");
  }
  const visited=new Set<number>(), rings: (readonly Point2[])[]=[];
  for (const start of boundary) {
    if(visited.has(start)) continue;
    const ring: Point2[]=[];
    let id=start;
    do {
      if(visited.has(id)) throw new Error("Non-cyclic Boolean boundary");
      visited.add(id);
      const p=arrangement.vertices[arrangement.halfEdges[id]!.origin]!.point;
      ring.push(point2(p.x,p.y));
      id=successors.get(id)!;
    } while(id!==start);
    rings.push(Object.freeze(ring));
  }
  const selectedFaces=selected.flatMap((yes,i)=>yes?[i]:[]);
  const twiceArea=selectedFaces.reduce((sum,i)=>sum.add(arrangement.faces[i]!.twiceArea!),new Rational(0n));
  return Object.freeze({rings:Object.freeze(rings),twiceArea,arrangement,selectedFaces:Object.freeze(selectedFaces)});
}
