import { Rational } from "../numeric/rational.js";
import type { Point2, Segment2 } from "./point2.js";
import { splitSegments } from "./split-segments.js";
import type { SegmentArrangement } from "./split-segments.js";

/** Counterclockwise polar order of nonzero vectors, starting at the positive x axis. */
export function compareDirections(a: Point2, b: Point2): number {
  if (a.x.sign() === 0 && a.y.sign() === 0 || b.x.sign() === 0 && b.y.sign() === 0) {
    throw new RangeError("A direction must be nonzero");
  }
  const half = (p: Point2) => p.y.sign() < 0 || p.y.sign() === 0 && p.x.sign() < 0 ? 1 : 0;
  return half(a) - half(b) || -a.x.mul(b.y).sub(a.y.mul(b.x)).sign() || 0;
}

export interface HalfEdge {
  readonly origin: number;
  readonly target: number;
  readonly edge: number;
  readonly twin: number;
  readonly next: number;
  readonly previous: number;
  readonly boundary: number;
}

export interface BoundaryWalk {
  readonly halfEdges: readonly number[];
  /** Shoelace sum, twice the signed area; bridges can occur twice in a walk. */
  readonly twiceSignedArea: Rational;
}

export interface HalfEdgeArrangement extends SegmentArrangement {
  readonly halfEdges: readonly HalfEdge[];
  readonly outgoing: readonly (readonly number[])[];
  /** Boundary components, not grouped faces: nested/disconnected walks may share a face. */
  readonly boundaries: readonly BoundaryWalk[];
}

/** Builds the exact planar rotation system and left-side boundary walks. */
export function buildHalfEdges(input: readonly Segment2[]): HalfEdgeArrangement {
  const arrangement = splitSegments(input);
  const outgoing: number[][] = arrangement.vertices.map(() => []);
  const halfEdges: {origin: number; target: number; edge: number; twin: number;
    next: number; previous: number; boundary: number}[] = [];
  arrangement.edges.forEach((edge, index) => {
    const first = halfEdges.length;
    for (const [origin, target, twin] of [[edge.start, edge.end, first + 1], [edge.end, edge.start, first]] as const) {
      outgoing[origin]!.push(halfEdges.length);
      halfEdges.push({origin, target, edge: index, twin, next: -1, previous: -1, boundary: -1});
    }
  });
  const direction = (id: number): Point2 => {
    const h = halfEdges[id]!;
    const a = arrangement.vertices[h.origin]!.point;
    const b = arrangement.vertices[h.target]!.point;
    return {x: b.x.sub(a.x), y: b.y.sub(a.y)};
  };
  const position: number[] = [];
  outgoing.forEach(ids => {
    ids.sort((a, b) => compareDirections(direction(a), direction(b)));
    ids.forEach((id, index) => { position[id] = index; });
  });
  halfEdges.forEach((h, id) => {
    const around = outgoing[h.target]!;
    h.next = around[(position[h.twin]! + around.length - 1) % around.length]!;
    halfEdges[h.next]!.previous = id;
  });
  const boundaries: BoundaryWalk[] = [];
  halfEdges.forEach((start, id) => {
    if (start.boundary !== -1) return;
    const ids: number[] = [];
    let area = new Rational(0n);
    let current = id;
    do {
      const h = halfEdges[current]!;
      h.boundary = boundaries.length;
      ids.push(current);
      const a = arrangement.vertices[h.origin]!.point;
      const b = arrangement.vertices[h.target]!.point;
      area = area.add(a.x.mul(b.y).sub(a.y.mul(b.x)));
      current = h.next;
    } while (current !== id);
    boundaries.push(Object.freeze({halfEdges: Object.freeze(ids), twiceSignedArea: area}));
  });
  return Object.freeze({...arrangement,
    halfEdges: Object.freeze(halfEdges.map(h => Object.freeze(h))),
    outgoing: Object.freeze(outgoing.map(ids => Object.freeze(ids))),
    boundaries: Object.freeze(boundaries)});
}
