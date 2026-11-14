import { test } from "node:test";
import assert from "node:assert/strict";
import { Rational, point2 as p, segment2 as s, pointsEqual, comparePoints,
  pointOnSegment, intersectSegments, splitSegments } from "../dist/index.js";
import type { Segment2, SegmentArrangement } from "../dist/index.js";

const indices = <T>(values: readonly T[], predicate: (value: T) => boolean) =>
  values.flatMap((value, index) => predicate(value) ? [index] : []);

/** Checks the public contract, including complete reconstruction of each input. */
function verify(input: readonly Segment2[], output = splitSegments(input)): void {
  const { vertices, edges } = output;
  vertices.forEach((v, i) => {
    if (i) assert.equal(comparePoints(vertices[i - 1]!.point, v.point), -1);
    assert.deepEqual(v.sources, indices(input, source => pointOnSegment(v.point, source)));
  });
  const geometry = edges.map(e => s(vertices[e.start]!.point, vertices[e.end]!.point));
  edges.forEach((e, i) => {
    assert.ok(e.start < e.end);
    if (i) {
      const previous = edges[i - 1]!;
      assert.ok(previous.start < e.start || previous.start === e.start && previous.end < e.end);
    }
    const edge = geometry[i]!;
    assert.deepEqual(e.sources, indices(input, source =>
      pointOnSegment(edge.start, source) && pointOnSegment(edge.end, source)));
    assert.ok(e.sources.length > 0);
    for (const v of vertices) {
      if (pointOnSegment(v.point, edge)) {
        assert.ok(pointsEqual(v.point, edge.start) || pointsEqual(v.point, edge.end),
          "no vertex may remain inside an edge");
      }
    }
    for (let j = i + 1; j < geometry.length; j++) {
      const other = geometry[j]!;
      const hit = intersectSegments(edge, other);
      assert.notEqual(hit.kind, "overlap", "output edges cannot overlap");
      if (hit.kind === "point") {
        assert.ok(pointsEqual(hit.point, edge.start) || pointsEqual(hit.point, edge.end));
        assert.ok(pointsEqual(hit.point, other.start) || pointsEqual(hit.point, other.end));
      }
    }
  });
  input.forEach((source, index) => {
    if (pointsEqual(source.start, source.end)) {
      assert.ok(vertices.some(v => pointsEqual(v.point, source.start) && v.sources.includes(index)));
      assert.ok(edges.every(e => !e.sources.includes(index)));
      return;
    }
    const pieces = geometry.filter((_, i) => edges[i]!.sources.includes(index))
      .sort((a, b) => comparePoints(a.start, b.start));
    assert.ok(pieces.length > 0);
    const forward = comparePoints(source.start, source.end) < 0;
    assert.deepEqual(pieces[0]!.start, forward ? source.start : source.end);
    assert.deepEqual(pieces.at(-1)!.end, forward ? source.end : source.start);
    for (let i = 1; i < pieces.length; i++) assert.deepEqual(pieces[i - 1]!.end, pieces[i]!.start);
  });
}

function shape(result: SegmentArrangement) {
  return { vertices: result.vertices.map(v => v.point), edges: result.edges.map(e => [e.start, e.end]) };
}

test("crossing segments create one shared vertex and four edges", () => {
  const input = [s(p(-1n, 0n), p(1n, 0n)), s(p(0n, -1n), p(0n, 1n))];
  const output = splitSegments(input);
  assert.deepEqual(output, {
    vertices: [
      { point: p(-1n, 0n), sources: [0] }, { point: p(0n, -1n), sources: [1] },
      { point: p(0n, 0n), sources: [0, 1] }, { point: p(0n, 1n), sources: [1] },
      { point: p(1n, 0n), sources: [0] },
    ],
    edges: [
      { start: 0, end: 2, sources: [0] }, { start: 1, end: 2, sources: [1] },
      { start: 2, end: 3, sources: [1] }, { start: 2, end: 4, sources: [0] },
    ],
  });
  verify(input, output);
});

test("nested/reversed overlaps merge edges while preserving every owner", () => {
  const input = [s(p(0n, 0n), p(4n, 0n)), s(p(3n, 0n), p(1n, 0n)),
    s(p(0n, 0n), p(4n, 0n)), s(p(2n, -1n), p(2n, 1n))];
  const output = splitSegments(input);
  verify(input, output);
  const shared = output.edges.filter(e => e.sources.length === 3);
  assert.equal(shared.length, 2);
  shared.forEach(e => assert.deepEqual(e.sources, [0, 1, 2]));
});

test("empty input, isolated points, duplicates, T-junctions and endpoint contacts", () => {
  assert.deepEqual(splitSegments([]), { vertices: [], edges: [] });
  const input = [s(p(0n, 0n), p(2n, 0n)), s(p(1n, 0n), p(1n, 1n)),
    s(p(2n, 0n), p(3n, 1n)), s(p(1n, 0n), p(1n, 0n)),
    s(p(9n, 9n), p(9n, 9n)), s(p(9n, 9n), p(9n, 9n))];
  const output = splitSegments(input);
  verify(input, output);
  assert.deepEqual(output.vertices.at(-1), { point: p(9n, 9n), sources: [4, 5] });
  assert.equal(output.edges.length, 4);
});

test("exact fractions, large coordinates and tiny distances do not snap", () => {
  const n = 10n ** 100n;
  const input = [s(p(n, 0n), p(n + 1n, 1n)), s(p(n, 1n), p(n + 2n, 0n)),
    s(p(n, "1/100000000000000000000"), p(n + 1n, "1/100000000000000000000"))];
  const output = splitSegments(input);
  verify(input, output);
  assert.ok(output.vertices.some(v => v.point.x.equals(new Rational(n).add(new Rational(2n, 3n))) &&
    v.point.y.equals(new Rational(2n, 3n))));
});

test("result is deeply immutable and independent of caller-owned objects", () => {
  const start = { x: new Rational(0n), y: new Rational(0n) };
  const input = [{ start, end: p(1n, 0n) }];
  const output = splitSegments(input);
  start.x = new Rational(99n);
  assert.deepEqual(output.vertices[0]!.point, p(0n, 0n));
  for (const value of [output, output.vertices, output.edges,
    ...output.vertices.flatMap(v => [v, v.point, v.sources]),
    ...output.edges.flatMap(e => [e, e.sources])]) assert.ok(Object.isFrozen(value));
});

test("all 6,561 segment pairs on a 3x3 grid satisfy arrangement invariants", () => {
  const points = [-1n, 0n, 1n].flatMap(x => [-1n, 0n, 1n].map(y => p(x, y)));
  const segments = points.flatMap(a => points.map(b => s(a, b)));
  for (const a of segments) for (const b of segments) verify([a, b]);
});

test("seeded segment sets preserve coverage, provenance, permutation and idempotence", () => {
  let seed = 71237;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const coordinate = () => new Rational(BigInt(next() % 11) - 5n, BigInt(next() % 3) + 1n);
  for (let sample = 0; sample < 120; sample++) {
    const input = Array.from({ length: 7 }, () => s(p(coordinate(), coordinate()), p(coordinate(), coordinate())));
    if (sample % 2 === 0) input.push(s(input[0]!.end, input[0]!.start));
    if (sample % 3 === 0) input.push(s(input[1]!.start, input[1]!.start));
    const output = splitSegments(input);
    verify(input, output);
    const reversed = splitSegments([...input].reverse().map(v => s(v.end, v.start)));
    assert.deepEqual(shape(reversed), shape(output));
    output.vertices.forEach((v, i) => assert.deepEqual(reversed.vertices[i]!.sources,
      v.sources.map(index => input.length - 1 - index).sort((a, b) => a - b)));
    output.edges.forEach((e, i) => assert.deepEqual(reversed.edges[i]!.sources,
      e.sources.map(index => input.length - 1 - index).sort((a, b) => a - b)));
    const noded = [...output.edges.map(e => s(output.vertices[e.start]!.point, output.vertices[e.end]!.point)),
      ...output.vertices.map(v => s(v.point, v.point))];
    assert.deepEqual(shape(splitSegments(noded)), shape(output));
  }
});
