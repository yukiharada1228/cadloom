import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { vec2, vec3, type Point2 } from '../src/math/vec.ts';
import { createPlaneSurface } from '../src/surface/types.ts';
import { createNurbsCurve } from '../src/nurbs/curve.ts';
import { shoelace2 } from '../src/tess/index.ts';
import {
  arcSegment2,
  arcTerm2,
  bulgeWire,
  circleWire,
  createProfile,
  lineSegment2,
  lineTerm2,
  nurbsSegment2,
  pointInWire,
  polygonWire,
  profileArea,
  profileAreaProperties,
  rectangleWire,
  regionAreaProperties,
  regularPolygonWire,
  reverseWire,
  segmentEnd,
  segmentPoint,
  segmentStart,
  segmentTangent,
  segmentToNurbs,
  segmentsContact,
  slotWire,
  wireArea,
  type Profile,
  type Segment2,
  type Wire2,
} from '../src/profile/index.ts';

const k = createKernel();
const tol = k.tolerances.zoneTol3d;
const plane = unwrap(createPlaneSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0)));
const P = (x: number, y: number): Point2 => vec2(x, y);
const close = (a: number, b: number, eps: number, msg?: string): void =>
  assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a} (|diff| = ${Math.abs(a - b)})`);
const profile = (wires: readonly Wire2[]): Result<Profile> => createProfile(k, plane, wires);
const reason = (r: Result<unknown>): string => (r.ok ? 'ok' : r.error.kind === 'invalid-input' ? r.error.reason : r.error.kind);
const nurbs = (deg: number, knots: number[], pts: number[][], w?: number[]): Segment2 =>
  unwrap(nurbsSegment2(unwrap(createNurbsCurve(deg, knots, pts, w))));

// A simple closed cubic loop (a teardrop) and a figure eight.
const teardrop = (): Wire2 => [nurbs(3, [0, 0, 0, 0, 0.5, 1, 1, 1, 1], [[0, 0], [2, -1], [4, 1], [3, 3], [0, 0]])];
const figureEight = (): Wire2 => [nurbs(3, [0, 0, 0, 0, 1, 1, 1, 1], [[0, 0], [3, 3], [3, -3], [0, 0]])];

// ------------------------------------------------------------------------------------------------------
// Segments

test('segment constructors validate their input and never throw', () => {
  assert.equal(lineSegment2(P(NaN, 0), P(1, 1)).ok, false);
  assert.equal(arcSegment2(P(0, 0), 0, 0, 1).ok, false);
  assert.equal(arcSegment2(P(0, 0), -1, 0, 1).ok, false);
  assert.equal(arcSegment2(P(0, 0), 1, 0, 0).ok, false);
  assert.equal(arcSegment2(P(0, 0), 1, 0, 7).ok, false, 'sweep beyond 2π');
  assert.equal(arcSegment2(P(0, 0), 1, 0, 1, false).ok, false, 'ccw must agree with the sweep sign');
  assert.equal(unwrap(arcSegment2(P(0, 0), 1, 1, 0)).ccw, false);
  assert.equal(nurbsSegment2(unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0, 0], [1, 0, 0]]))).ok, false);
  const a = unwrap(arcSegment2(P(1, 2), 2, 0, Math.PI / 2));
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.center));
});

test('segment points, tangents, reversal and exact NURBS forms agree', () => {
  const segs: Segment2[] = [
    unwrap(lineSegment2(P(0, 0), P(3, 1))),
    unwrap(arcSegment2(P(1, 1), 2, 0.3, 2.5)),
    unwrap(arcSegment2(P(1, 1), 2, 2.5, -1)),
    teardrop()[0]!,
  ];
  for (const s of segs) {
    const r = unwrap(reverseWire([s]))[0]!;
    const n = unwrap(segmentToNurbs(s));
    for (const f of [0, 0.25, 0.5, 0.8, 1]) {
      const p = unwrap(segmentPoint(s, f)), q = unwrap(segmentPoint(r, 1 - f));
      close(p.x, q.x, 1e-12); close(p.y, q.y, 1e-12);
    }
    // The NURBS form passes through the segment's points (closest of a dense sampling).
    for (const f of [0.1, 0.5, 0.9]) {
      const p = unwrap(segmentPoint(s, f));
      let best = Infinity;
      for (let i = 0; i <= 2000; i++) {
        const q = unwrap(segmentPoint(unwrap(nurbsSegment2(n)), i / 2000));
        best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
      }
      assert.ok(best < 1e-2 * 2, `nurbs form near ${s.kind} point`);
    }
    const s0 = segmentStart(s), n0 = unwrap(segmentPoint(unwrap(nurbsSegment2(n)), 0));
    close(s0.x, n0.x, 1e-12); close(s0.y, n0.y, 1e-12);
    const e0 = segmentEnd(s), ne = unwrap(segmentPoint(unwrap(nurbsSegment2(n)), 1));
    close(e0.x, ne.x, 1e-12); close(e0.y, ne.y, 1e-12);
    // Tangent by central difference.
    const t = unwrap(segmentTangent(s, 0.5)), a = unwrap(segmentPoint(s, 0.5 - 1e-6)), b = unwrap(segmentPoint(s, 0.5 + 1e-6));
    close(t.x, (b.x - a.x) / 2e-6, 1e-4 * Math.max(1, Math.abs(t.x)));
    close(t.y, (b.y - a.y) / 2e-6, 1e-4 * Math.max(1, Math.abs(t.y)));
  }
});

// ------------------------------------------------------------------------------------------------------
// Areas and centroids

test('areas of the builders: rectangle, circle, regular polygon, slot, bulge, NURBS', () => {
  assert.equal(unwrap(wireArea(unwrap(rectangleWire(1, 2, 3, 4)))), 12);
  close(unwrap(wireArea(unwrap(circleWire(P(5, -3), 2)))), 4 * Math.PI, 1e-12);
  const n = 7, R = 3;
  close(unwrap(wireArea(unwrap(regularPolygonWire(P(1, 1), R, n, 0.2)))), (n / 2) * R * R * Math.sin((2 * Math.PI) / n), 1e-12);
  close(unwrap(wireArea(unwrap(slotWire(P(0, 0), P(3, 4), 1)))), Math.PI + 2 * 5, 1e-12);
  // A semicircle by bulge 1 on the chord (-1,0) -> (1,0) (clockwise below? bulge 1: counter-clockwise arc).
  const semi = unwrap(bulgeWire([{ point: P(1, 0), bulge: 1 }, { point: P(-1, 0), bulge: 0 }]));
  close(unwrap(wireArea(semi)), Math.PI / 2, 1e-12);
  // A polynomial NURBS: area against a fine polyline.
  const td = teardrop();
  let poly = 0;
  const M = 20000;
  for (let i = 0; i < M; i++) {
    const p = unwrap(segmentPoint(td[0]!, i / M)), q = unwrap(segmentPoint(td[0]!, (i + 1) / M));
    poly += (p.x * q.y - q.x * p.y) / 2;
  }
  close(unwrap(wireArea(td)), poly, 1e-6);
  // A rational NURBS circle (the arc's exact form): Gauss–Legendre on sub-intervals.
  const circ = unwrap(nurbsSegment2(unwrap(segmentToNurbs(unwrap(arcSegment2(P(1, 1), 2, 0, 2 * Math.PI))))));
  close(unwrap(wireArea([circ])), 4 * Math.PI, 1e-10);
});

test('centroids: rectangle, semicircle, plate with a hole', () => {
  const pr = unwrap(profile([unwrap(rectangleWire(1, 2, 4, 2))]));
  const c = unwrap(profileAreaProperties(pr)).centroid;
  close(c.x, 3, 1e-12); close(c.y, 3, 1e-12);
  const semi = unwrap(profile([unwrap(bulgeWire([{ point: P(1, 0), bulge: 1 }, { point: P(-1, 0), bulge: 0 }]))]));
  const s = unwrap(profileAreaProperties(semi));
  close(s.area, Math.PI / 2, 1e-12);
  close(s.centroid.x, 0, 1e-12); close(s.centroid.y, 4 / (3 * Math.PI), 1e-12);
  const plate = unwrap(profile([unwrap(rectangleWire(0, 0, 4, 4)), unwrap(circleWire(P(3, 2), 0.5))]));
  const pp = unwrap(regionAreaProperties(plate.regions[0]!));
  const a = 16 - Math.PI / 4;
  close(pp.area, a, 1e-12);
  close(pp.centroid.x, (16 * 2 - (Math.PI / 4) * 3) / a, 1e-12);
  close(pp.centroid.y, 2, 1e-12);
});

// ------------------------------------------------------------------------------------------------------
// Lean theorems of formal/CadloomFormal/Profile.lean

const poly: Point2[] = [P(0, 0), P(5, 0), P(6, 3), P(2, 5), P(-1, 2)];

test('shoelace2_eq_area2 / polySegs_getElem: polygonWire areas are the ring shoelace, segment i = (p_i, p_(i+1) mod n)', () => {
  const w = unwrap(polygonWire(poly));
  assert.equal(2 * unwrap(wireArea(w)), shoelace2(poly, poly.map((_, i) => i)));
  w.forEach((s, i) => {
    assert.equal(s.kind, 'line');
    assert.deepEqual(segmentStart(s), poly[i]);
    assert.deepEqual(segmentEnd(s), poly[(i + 1) % poly.length]);
  });
});

test('shoelace2_translate / lineTerm2_translate: translated polygons have the same area (exactly on integers)', () => {
  const a = unwrap(wireArea(unwrap(polygonWire(poly))));
  assert.equal(unwrap(wireArea(unwrap(polygonWire(poly.map((p) => P(p.x + 1000, p.y - 77)))))), a);
  const d = P(3, -2), p = P(1, 4), q = P(-2, 7);
  assert.equal(lineTerm2(P(p.x + d.x, p.y + d.y), P(q.x + d.x, q.y + d.y)), lineTerm2(p, q) + lineTerm2(p, d) - lineTerm2(q, d));
});

test('greenSum_revSegs / shoelace2_reverse: reversing a wire negates its area', () => {
  for (const w of [unwrap(polygonWire(poly)), unwrap(slotWire(P(0, 0), P(2, 1), 0.5))]) {
    assert.equal(unwrap(wireArea(unwrap(reverseWire(w)))), -unwrap(wireArea(w)));
  }
  // NURBS: the quadrature nodes are mirrored, so equal up to rounding.
  close(unwrap(wireArea(unwrap(reverseWire(teardrop())))), -unwrap(wireArea(teardrop())), 1e-13);
  const rev = [poly[0]!, ...poly.slice(1).reverse()];
  assert.equal(unwrap(wireArea(unwrap(polygonWire(rev)))), -unwrap(wireArea(unwrap(polygonWire(poly)))));
});

test('shoelace2_split: splitting along a diagonal adds the two areas; shoelace2_rotN: start vertex does not matter', () => {
  const whole = unwrap(wireArea(unwrap(polygonWire(poly))));
  const a = unwrap(wireArea(unwrap(polygonWire([poly[0]!, poly[1]!, poly[2]!]))));
  const b = unwrap(wireArea(unwrap(polygonWire([poly[2]!, poly[3]!, poly[4]!, poly[0]!]))));
  assert.equal(a + b, whole);
  for (let r = 1; r < poly.length; r++) {
    assert.equal(unwrap(wireArea(unwrap(polygonWire([...poly.slice(r), ...poly.slice(0, r)])))), whole);
  }
});

test('arcTerm2_chord_segment / arc_triangle / sin_cos_diff: arc term = chord + circular segment', () => {
  for (const [cx, cy, r, t0, t1] of [[1, 2, 3, 0.2, 1.7], [-4, 1, 0.5, 3, -1], [0, 0, 2, 0, 2 * Math.PI]] as const) {
    const p0 = P(cx + r * Math.cos(t0), cy + r * Math.sin(t0)), p1 = P(cx + r * Math.cos(t1), cy + r * Math.sin(t1));
    const sinD = Math.cos(t0) * Math.sin(t1) - Math.sin(t0) * Math.cos(t1);
    const cosD = Math.cos(t0) * Math.cos(t1) + Math.sin(t0) * Math.sin(t1);
    close(sinD * sinD + cosD * cosD, 1, 1e-14);
    close(sinD, Math.sin(t1 - t0), 1e-14);
    close(arcTerm2(cx, cy, r, t0, t1), lineTerm2(p0, p1) + r * r * (t1 - t0 - sinD), 1e-12);
    // r² sin(t1 - t0) is twice the triangle (center, p0, p1).
    const tri = (p0.x - cx) * (p1.y - cy) - (p1.x - cx) * (p0.y - cy);
    close(r * r * sinD, tri, 1e-12);
  }
});

test('arcTerm2_sector / arcTerm2_full / arcTerm2_add / arcTerm2_reverse / arcTerm2_translate', () => {
  close(arcTerm2(0, 0, 2, 0.3, 1.1), 4 * 0.8, 1e-14);
  close(arcTerm2(5, -7, 2, 0, 2 * Math.PI), 8 * Math.PI, 1e-12);
  close(arcTerm2(1, 2, 3, 0.1, 0.9) + arcTerm2(1, 2, 3, 0.9, 2.5), arcTerm2(1, 2, 3, 0.1, 2.5), 1e-12);
  close(arcTerm2(1, 2, 3, 2.5, 0.1), -arcTerm2(1, 2, 3, 0.1, 2.5), 1e-12);
  const d = P(4, -1), t0 = 0.4, t1 = 2.2, r = 1.5;
  const p0 = P(1 + r * Math.cos(t0), 2 + r * Math.sin(t0)), p1 = P(1 + r * Math.cos(t1), 2 + r * Math.sin(t1));
  close(arcTerm2(1 + d.x, 2 + d.y, r, t0, t1), arcTerm2(1, 2, r, t0, t1) + lineTerm2(p0, d) - lineTerm2(p1, d), 1e-12);
  // Mixed wires (lines and arcs) are translation invariant.
  const slot = unwrap(slotWire(P(0, 0), P(3, 1), 1)), moved = unwrap(slotWire(P(10, -5), P(13, -4), 1));
  close(unwrap(wireArea(moved)), unwrap(wireArea(slot)), 1e-12);
});

// ------------------------------------------------------------------------------------------------------
// createProfile

test('createProfile normalises orientation: outer counter-clockwise, holes clockwise', () => {
  const cwOuter = unwrap(reverseWire(unwrap(rectangleWire(0, 0, 10, 10))));
  const ccwHole = unwrap(circleWire(P(5, 5), 2));
  const pr = unwrap(profile([cwOuter, ccwHole]));
  assert.equal(pr.regions.length, 1);
  assert.ok(unwrap(wireArea(pr.regions[0]!.outer)) > 0);
  assert.equal(pr.regions[0]!.holes.length, 1);
  assert.ok(unwrap(wireArea(pr.regions[0]!.holes[0]!)) < 0);
  close(unwrap(profileArea(pr)), 100 - 4 * Math.PI, 1e-12);
  assert.ok(Object.isFrozen(pr) && Object.isFrozen(pr.regions));
});

test('createProfile nests wires: an island inside a hole is a new region', () => {
  const pr = unwrap(profile([
    unwrap(circleWire(P(0, 0), 1)),
    unwrap(rectangleWire(-10, -10, 20, 20)),
    unwrap(rectangleWire(-5, -5, 10, 10)),
    unwrap(rectangleWire(6, 6, 2, 2)),
  ]));
  // Depths: circle 2 (island), outer 0, inner square 1 (hole), small square 1 (hole).
  assert.equal(pr.regions.length, 2);
  assert.equal(pr.regions[0]!.holes.length, 0, 'the island circle has no hole');
  assert.equal(pr.regions[1]!.holes.length, 2);
  close(unwrap(profileArea(pr)), Math.PI + 400 - 100 - 4, 1e-11);
});

test('createProfile rejects self-intersecting, touching and crossing wires', () => {
  assert.match(reason(profile([unwrap(polygonWire([P(0, 0), P(2, 2), P(2, 0), P(0, 2)]))])), /crosses or touches itself/);
  assert.match(reason(profile([unwrap(rectangleWire(0, 0, 2, 2)), unwrap(rectangleWire(1, 1, 2, 2))])), /cross or touch/);
  assert.match(reason(profile([unwrap(rectangleWire(0, 0, 2, 2)), unwrap(rectangleWire(2, 0, 2, 2))])), /cross or touch/, 'shared side');
  // Within the zone tolerance counts as touching; twice the tolerance apart does not.
  assert.match(reason(profile([unwrap(rectangleWire(0, 0, 2, 2)), unwrap(rectangleWire(2 + tol / 2, 0, 2, 2))])), /cross or touch/);
  assert.equal(profile([unwrap(rectangleWire(0, 0, 2, 2)), unwrap(rectangleWire(2 + 2 * tol, 0, 2, 2))]).ok, true);
  // Arc / line and arc / arc.
  assert.match(reason(profile([unwrap(rectangleWire(0, 0, 4, 4)), unwrap(circleWire(P(3.5, 2), 1))])), /cross or touch/);
  assert.match(reason(profile([unwrap(rectangleWire(-9, -9, 20, 20)), unwrap(circleWire(P(0, 0), 1)), unwrap(circleWire(P(1.5, 0), 1))])), /cross or touch/);
  assert.match(reason(profile([unwrap(rectangleWire(-9, -9, 20, 20)), unwrap(circleWire(P(0, 0), 1)), unwrap(circleWire(P(0, 0), 1))])), /cross or touch/, 'coincident circles');
  // A circle tangent to a side from inside touches it.
  assert.match(reason(profile([unwrap(rectangleWire(0, 0, 4, 4)), unwrap(circleWire(P(2, 1), 1))])), /cross or touch/);
  assert.equal(profile([unwrap(rectangleWire(0, 0, 4, 4)), unwrap(circleWire(P(2, 1.001), 1))]).ok, true);
});

test('createProfile rejects open, degenerate and folded wires', () => {
  const open = [unwrap(lineSegment2(P(0, 0), P(1, 0))), unwrap(lineSegment2(P(1, 0), P(1, 1))), unwrap(lineSegment2(P(1, 1), P(0, 0.1)))];
  assert.match(reason(profile([open])), /is open/);
  assert.match(reason(profile([unwrap(polygonWire([P(0, 0), P(1, 0), P(1, tol / 4), P(1, 1)]))])), /degenerate/);
  assert.match(reason(profile([unwrap(polygonWire([P(0, 0), P(2, 0), P(1, 0), P(1, 1)]))])), /folds back/);
  assert.match(reason(profile([[unwrap(arcSegment2(P(0, 0), 1, 0, Math.PI))]])), /is open/);
  assert.match(reason(profile([])), /at least one wire/);
  assert.match(reason(profile([[]])), /no segment/);
  // A hand-made malformed segment is caught, not thrown.
  const bad = { kind: 'arc', center: P(0, 0), radius: -1, startAngle: 0, endAngle: 1, ccw: true } as const;
  assert.match(reason(profile([[bad]])), /radius/);
});

test('createProfile: NURBS segments (simple loop accepted, figure eight and crossings rejected)', () => {
  const pr = unwrap(profile([teardrop()]));
  assert.ok(unwrap(profileArea(pr)) > 0);
  assert.match(reason(profile([figureEight()])), /crosses itself/);
  assert.match(reason(profile([teardrop(), unwrap(polygonWire([P(1, -3), P(2, -3), P(2, 0.5), P(1, 0.5)]))])), /cross or touch/);
  // A NURBS hole inside a rectangle.
  const holed = unwrap(profile([unwrap(rectangleWire(-5, -5, 15, 15)), teardrop()]));
  assert.equal(holed.regions[0]!.holes.length, 1);
  close(unwrap(profileArea(holed)), 225 - unwrap(wireArea(teardrop())), 1e-9);
});

test('createProfile accepts tangent junctions (slot, bulges) and arcs split into pieces', () => {
  assert.equal(profile([unwrap(slotWire(P(0, 0), P(3, 1), 1))]).ok, true);
  const bw = unwrap(bulgeWire([{ point: P(0, 0), bulge: 0 }, { point: P(4, 0), bulge: 0.5 }, { point: P(4, 3), bulge: -0.3 }, { point: P(0, 3), bulge: 0 }]));
  assert.equal(profile([bw]).ok, true);
  // A circle made of two half circles.
  const halves = [unwrap(arcSegment2(P(0, 0), 1, 0, Math.PI)), unwrap(arcSegment2(P(0, 0), 1, Math.PI, 2 * Math.PI))];
  close(unwrap(profileArea(unwrap(profile([halves])))), Math.PI, 1e-12);
  // Two arcs of one circle overlapping (going round more than once) are rejected.
  const over = [unwrap(arcSegment2(P(0, 0), 1, 0, 1.5 * Math.PI)), unwrap(arcSegment2(P(0, 0), 1, 1.5 * Math.PI, 2.6 * Math.PI)), unwrap(lineSegment2(P(Math.cos(2.6 * Math.PI), Math.sin(2.6 * Math.PI)), P(1, 0)))];
  assert.equal(profile([over]).ok, false);
});

test('pointInWire: exact for lines (orient2d), arcs and NURBS by their pieces', () => {
  const sq = unwrap(rectangleWire(0, 0, 1, 1));
  assert.equal(unwrap(pointInWire(k, P(0.5, 0.5), sq)), true);
  assert.equal(unwrap(pointInWire(k, P(1 + 1e-300, 0.5), sq)), false);
  assert.equal(unwrap(pointInWire(k, P(1 - 2 ** -52, 0.5), sq)), true, 'decided exactly next to the side');
  assert.equal(unwrap(pointInWire(k, P(0.5, 0), sq)), true, 'half-open rule on the bottom side');
  const circle = unwrap(circleWire(P(0, 0), 1));
  assert.equal(unwrap(pointInWire(k, P(0.99, 0), circle)), true);
  assert.equal(unwrap(pointInWire(k, P(0, 0.999), circle)), true);
  assert.equal(unwrap(pointInWire(k, P(1.01, 0), circle)), false);
  assert.equal(unwrap(pointInWire(k, P(-0.5, -0.5), unwrap(slotWire(P(0, 0), P(3, 1), 1)))), true);
  assert.equal(unwrap(pointInWire(k, P(2, 0.5), teardrop())), true);
  assert.equal(unwrap(pointInWire(k, P(5, 0.5), teardrop())), false);
});

test('segmentsContact: adjacent segments may meet at their junction only', () => {
  const l = unwrap(lineSegment2(P(-2, -1), P(0, -1)));
  const arc = unwrap(arcSegment2(P(0, 0), 1, -Math.PI / 2, Math.PI / 2));
  assert.equal(unwrap(segmentsContact(k, l, arc, [P(0, -1)])), false, 'tangent junction');
  const crossing = unwrap(lineSegment2(P(0, -1), P(0, 2)));
  assert.equal(unwrap(segmentsContact(k, arc, crossing, [P(0, -1)])), true, 'meets the arc again at its end (0, 1), far from the junction');
  assert.equal(unwrap(segmentsContact(k, l, arc, [])), true, 'not adjacent: they touch');
});

test('createProfile is deterministic and bounded', () => {
  const ws = [unwrap(rectangleWire(-5, -5, 15, 15)), teardrop(), unwrap(circleWire(P(-3, -3), 1))];
  const a = unwrap(profile(ws)), b = unwrap(profile(ws));
  assert.deepEqual(a, b);
  const many: Point2[] = [];
  for (let i = 0; i < 2100; i++) many.push(P(Math.cos((2 * Math.PI * i) / 2100), Math.sin((2 * Math.PI * i) / 2100)));
  assert.match(reason(profile([unwrap(polygonWire(many))])), /more than/);
});

test('segmentsContact on adjacent NURBS segments: located by the chords, not by an average of their ends', () => {
  // Regression: a NURBS arch closed by a line was rejected as crossing itself (the averaged chord ends of a
  // junction leaf lay far from the junction).
  const arch = nurbs(2, [0, 0, 0, 1, 1, 1], [[0, 0], [1, 2], [2, 0]]);
  assert.equal(profile([[arch, unwrap(lineSegment2(P(2, 0), P(0, 0)))]]).ok, true);
  const holed = unwrap(profile([unwrap(rectangleWire(-5, -5, 15, 15)), [arch, unwrap(lineSegment2(P(2, 0), P(0, 0)))]]));
  close(unwrap(profileArea(holed)), 225 - 4 / 3, 1e-9);
  // Still rejected: an adjacent crossing away from the junctions, and an adjacent touch within the tolerance.
  const s = nurbs(3, [0, 0, 0, 0, 1, 1, 1, 1], [[0, 0], [1, 3], [2, -3], [3, 0]]);
  assert.match(reason(profile([[s, unwrap(lineSegment2(P(3, 0), P(0, 0)))]])), /crosses or touches itself/);
  const touch = nurbs(1, [0, 0, 0.25, 0.5, 0.75, 1, 1], [[0, 0], [1, 2], [2, tol / 2], [3, 2], [4, 0]]);
  assert.match(reason(profile([[touch, unwrap(lineSegment2(P(4, 0), P(0, 0)))]])), /crosses or touches itself/);
});

test('hostile input: malformed hand-made segments and non-finite query points give errors, never throw', () => {
  const malformed = [
    { kind: 'nurbs', curve: { dimension: 2, degree: 3, knots: [], controlPoints: [] } },
    { kind: 'nurbs', curve: { dimension: 2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0], [NaN, 1]] } },
    { kind: 'line', start: P(0, 0), end: null },
  ];
  for (const m of malformed) assert.equal(profile([[m as unknown as Segment2]]).ok, false);
  assert.equal(pointInWire(k, P(NaN, 0), unwrap(circleWire(P(0, 0), 1))).ok, false);
  // Tangent circles (inside or outside) touch; a hole touching the outer wire at a vertex too.
  assert.equal(profile([unwrap(circleWire(P(0, 0), 2)), unwrap(circleWire(P(1, 0), 1))]).ok, false);
  assert.equal(profile([unwrap(circleWire(P(0, 0), 1)), unwrap(circleWire(P(2, 0), 1))]).ok, false);
  assert.equal(profile([unwrap(rectangleWire(0, 0, 4, 4)), unwrap(polygonWire([P(0, 0), P(1, 2), P(2, 1)]))]).ok, false);
  assert.equal(profile([unwrap(polygonWire([P(0, 0), P(2, 1), P(4, 0), P(4, 2), P(2, 1), P(0, 2)]))]).ok, false, 'bow tie through a vertex');
});
