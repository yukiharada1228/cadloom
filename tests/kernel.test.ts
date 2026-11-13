import { test } from "node:test";
import assert from "node:assert/strict";
import { Rational as R, point2 as p, segment2 as s, orient2d, intersectSegments as intersect,
  pointOnSegment } from "../dist/index.js";
import type { Point2, Segment2, SegmentIntersection } from "../dist/index.js";

test("rational normalization, decimals, arithmetic and invalid input", () => {
  assert.equal(new R(6n, -8n).toString(), "-3/4");
  assert.equal(new R(0n, -999n).toString(), "0");
  assert.equal(R.parse("-0.125").toString(), "-1/8");
  assert.equal(R.parse("+12.50").toString(), "25/2");
  assert.equal(R.parse("1/-3").toString(), "-1/3");
  const a = R.parse("1/3"), b = R.parse("2/5");
  assert.equal(a.add(b).toString(), "11/15");
  assert.equal(a.sub(b).toString(), "-1/15");
  assert.equal(a.mul(b).toString(), "2/15");
  assert.equal(a.div(b).toString(), "5/6");
  assert.equal(a.compare(b), -1);
  assert.equal(a.neg().sign(), -1);
  assert.ok(Object.isFrozen(a));
  assert.equal(JSON.stringify(a), '"1/3"');
  assert.throws(() => new R(1n, 0n), RangeError);
  assert.throws(() => a.div(new R(0n)), RangeError);
  for (const text of ["", "NaN", "Infinity", "1e3", "1/2/3", "0x10", ".5"]) {
    assert.throws(() => R.parse(text), SyntaxError);
  }
  // Runtime rejection for untyped JS callers as well as compile-time rejection.
  assert.throws(() => p(0.1 as never, 0n), TypeError);
  assert.throws(() => new R(1 as never), TypeError);
});

test("orientation remains exact beyond Number precision", () => {
  const n = 10n ** 100n;
  assert.equal(orient2d(p(n, n), p(n + 1n, n), p(n, n + 1n)), 1);
  assert.equal(orient2d(p(n, n), p(n, n + 1n), p(n + 1n, n)), -1);
  assert.equal(orient2d(p(0n, 0n), p("1/3", "1/7"), p("2/3", "2/7")), 0);
});

test("intersection fixtures cover crossing, touching, overlap and degeneracy", () => {
  const cases: [Segment2, Segment2, SegmentIntersection][] = [
    [s(p(0n, 0n), p(1n, 1n)), s(p(0n, 1n), p(2n, 0n)), { kind: "point", point: p("2/3", "2/3") }],
    [s(p(0n, 0n), p(1n, 0n)), s(p(1n, 0n), p(2n, 1n)), { kind: "point", point: p(1n, 0n) }],
    [s(p(0n, 0n), p(3n, 0n)), s(p(4n, 0n), p(1n, 0n)), { kind: "overlap", segment: s(p(1n, 0n), p(3n, 0n)) }],
    [s(p(0n, 3n), p(0n, 0n)), s(p(0n, 1n), p(0n, 2n)), { kind: "overlap", segment: s(p(0n, 1n), p(0n, 2n)) }],
    [s(p(0n, 0n), p(1n, 0n)), s(p(2n, 0n), p(3n, 0n)), { kind: "none" }],
    [s(p(0n, 0n), p(1n, 0n)), s(p(0n, 1n), p(1n, 1n)), { kind: "none" }],
    [s(p(2n, 0n), p(2n, 0n)), s(p(0n, 0n), p(1n, 0n)), { kind: "none" }],
    [s(p(1n, 0n), p(1n, 0n)), s(p(0n, 0n), p(2n, 0n)), { kind: "point", point: p(1n, 0n) }],
    [s(p(1n, 1n), p(1n, 1n)), s(p(1n, 1n), p(1n, 1n)), { kind: "point", point: p(1n, 1n) }],
    [s(p(1n, 1n), p(1n, 1n)), s(p(2n, 2n), p(2n, 2n)), { kind: "none" }],
    [s(p(0n, 0n), p(1n, 0n)), s(p(2n, -1n), p(2n, 1n)), { kind: "none" }],
    [s(p(0n, 0n), p("0.00000000000000000001", 0n)), s(p("0.000000000000000000005", -1n), p("0.000000000000000000005", 1n)), {kind: "point", point: p("0.000000000000000000005", 0n)}],
  ];
  for (const [a, b, expected] of cases) {
    for (const aa of [a, s(a.end, a.start)]) for (const bb of [b, s(b.end, b.start)]) {
      assert.deepEqual(intersect(aa, bb), expected);
      assert.deepEqual(intersect(bb, aa), expected);
    }
  }
});

// Independent bounded-integer oracle: determinants via BigInt, no Rational geometry.
function oracle(a: Segment2, b: Segment2): boolean {
  const cross = (a: Point2, b: Point2, c: Point2) =>
    (b.x.numerator - a.x.numerator) * (c.y.numerator - a.y.numerator) -
    (b.y.numerator - a.y.numerator) * (c.x.numerator - a.x.numerator);
  const sign = (x: bigint) => x < 0n ? -1 : x > 0n ? 1 : 0;
  const axisOverlap = (values: bigint[]) => {
    const [a, b, c, d] = values as [bigint, bigint, bigint, bigint];
    return (a < b ? a : b) <= (c > d ? c : d) && (c < d ? c : d) <= (a > b ? a : b);
  };
  return axisOverlap([a.start.x.numerator, a.end.x.numerator, b.start.x.numerator, b.end.x.numerator]) &&
    axisOverlap([a.start.y.numerator, a.end.y.numerator, b.start.y.numerator, b.end.y.numerator]) &&
    sign(cross(a.start, a.end, b.start)) * sign(cross(a.start, a.end, b.end)) <= 0 &&
    sign(cross(b.start, b.end, a.start)) * sign(cross(b.start, b.end, a.end)) <= 0;
}

test("exhaustive 3x3 integer grid: 6,561 segment pairs against independent oracle", () => {
  const points = [-1n, 0n, 1n].flatMap(x => [-1n, 0n, 1n].map(y => p(x, y)));
  const segments = points.flatMap(a => points.map(b => s(a, b)));
  for (const a of segments) for (const b of segments) {
    const result = intersect(a, b);
    assert.equal(result.kind !== "none", oracle(a, b));
    assert.deepEqual(result, intersect(b, a));
    if (result.kind === "point") {
      assert.ok(pointOnSegment(result.point, a) && pointOnSegment(result.point, b));
    } else if (result.kind === "overlap") {
      for (const end of [result.segment.start, result.segment.end]) {
        assert.ok(pointOnSegment(end, a) && pointOnSegment(end, b));
      }
    }
  }
});

test("seeded rational cases preserve intersection under translation and signed scaling", () => {
  let seed = 20261114;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const rational = () => new R(BigInt(random() % 201) - 100n, BigInt(random() % 19 + 1));
  for (let i = 0; i < 1000; i++) {
    const a = s(p(rational(), rational()), p(rational(), rational()));
    const b = s(p(rational(), rational()), p(rational(), rational()));
    const scale = new R(i % 2 ? -7n : 3n, 11n), dx = rational(), dy = rational();
    const transform = (v: Point2) => p(v.x.mul(scale).add(dx), v.y.mul(scale).add(dy));
    const result = intersect(a, b);
    const changed = intersect(s(transform(a.start), transform(a.end)), s(transform(b.start), transform(b.end)));
    assert.equal(changed.kind, result.kind);
    if (result.kind === "point" && changed.kind === "point") assert.deepEqual(changed.point, transform(result.point));
    if (result.kind === "point") assert.ok(pointOnSegment(result.point, a) && pointOnSegment(result.point, b));
    assert.deepEqual(intersect(s(a.end, a.start), b), result);
  }
});
