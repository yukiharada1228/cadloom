import { comparePoints, point2, segment2 } from "./point2.js";
import type { Point2, Segment2 } from "./point2.js";
import { intersectSegments } from "./segment-intersection.js";

export interface SplitVertex {
  readonly point: Point2;
  /** Sorted input indices of every closed segment containing this vertex. */
  readonly sources: readonly number[];
}

export interface SplitEdge {
  /** Indices into vertices; start < end in exact lexicographic coordinate order. */
  readonly start: number;
  readonly end: number;
  /** Sorted input indices of every segment covering the entire edge. */
  readonly sources: readonly number[];
}

export interface SegmentArrangement {
  readonly vertices: readonly SplitVertex[];
  readonly edges: readonly SplitEdge[];
}

function pointKey(point: Point2): string {
  return `${point.x.toString()},${point.y.toString()}`;
}

/**
 * Nodes an exact rational segment set, merging coincident vertices/edges.
 * All endpoints, pairwise intersections and overlap endpoints become vertices.
 * Zero-length inputs remain vertices and split any containing segment.
 * Uses all input pairs, without floating-point geometry or tolerance snapping.
 */
export function splitSegments(input: readonly Segment2[]): SegmentArrangement {
  // Snapshot caller-owned objects; the returned arrangement is deeply immutable.
  const segments = input.map(s => segment2(s.start, s.end));
  const cuts = segments.map(s => new Map([
    [pointKey(s.start), s.start], [pointKey(s.end), s.end],
  ]));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const intersection = intersectSegments(segments[i]!, segments[j]!);
      const points = intersection.kind === "none" ? [] : intersection.kind === "point"
        ? [intersection.point] : [intersection.segment.start, intersection.segment.end];
      for (const point of points) {
        cuts[i]!.set(pointKey(point), point);
        cuts[j]!.set(pointKey(point), point);
      }
    }
  }

  const vertexMap = new Map<string, { point: Point2; sources: number[] }>();
  cuts.forEach((points, source) => {
    for (const [key, point] of points) {
      let vertex = vertexMap.get(key);
      if (!vertex) {
        vertex = { point: point2(point.x, point.y), sources: [] };
        vertexMap.set(key, vertex);
      }
      vertex.sources.push(source);
    }
  });
  const sorted = [...vertexMap.values()].sort((a, b) => comparePoints(a.point, b.point));
  const vertexIndices = new Map(sorted.map((vertex, index) => [pointKey(vertex.point), index]));
  const edgeMap = new Map<string, { start: number; end: number; sources: number[] }>();
  cuts.forEach((points, source) => {
    const ordered = [...points.values()].sort(comparePoints);
    for (let i = 1; i < ordered.length; i++) {
      const start = vertexIndices.get(pointKey(ordered[i - 1]!))!;
      const end = vertexIndices.get(pointKey(ordered[i]!))!;
      const key = `${start}:${end}`;
      let edge = edgeMap.get(key);
      if (!edge) {
        edge = { start, end, sources: [] };
        edgeMap.set(key, edge);
      }
      edge.sources.push(source);
    }
  });
  return Object.freeze({
    vertices: Object.freeze(sorted.map(v => Object.freeze({
      point: v.point, sources: Object.freeze(v.sources),
    }))),
    edges: Object.freeze([...edgeMap.values()]
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map(e => Object.freeze({ ...e, sources: Object.freeze(e.sources) }))),
  });
}
