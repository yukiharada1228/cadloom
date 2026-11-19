import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { distance3, length3, vec2, vec3, type Point2, type Point3, type Vec3 } from '../src/math/vec.ts';
import { faceId, edgeId, type Brep, type FaceId } from '../src/topology/brep.ts';
import { makeBox, makeCone, makeCylinder, makeSphere, makeTorus, WORLD_PLACEMENT } from '../src/primitive/index.ts';
import { createPlaneSurface } from '../src/surface/types.ts';
import { projectPoint } from '../src/surface/implicit.ts';
import { createProfile, circleWire, point2, rectangleWire } from '../src/profile/index.ts';
import { extrude } from '../src/prism/index.ts';
import { revolve, sweep } from '../src/sweep/index.ts';
import { createNurbsCurve } from '../src/nurbs/curve.ts';
import { createNurbsCurve3 } from '../src/curve/types.ts';
import { tessellate } from '../src/tess/index.ts';
import { box3Contains, expandBox3 } from '../src/interval/box.ts';
import { refusalReason } from '../src/intersect/types.ts';
import {
  RAY_DIRECTIONS,
  axisGap,
  bodyBounds,
  boxDistanceSq,
  canPrune,
  classifyPoint,
  closestPointOnBody,
  crossingCount,
  distancePointBody,
  edgeCrossing,
  edgeLength,
  faceArea,
  pointInFace,
  edgeDistance,
  prepareBody,
  rayBody,
  rayBoxRange,
  transitionsAlternate,
  type PreparedBody,
  type RayFaceHit,
} from '../src/query/index.ts';

const k = createKernel();
const TWO_PI = 2 * Math.PI;
const P = vec3;

const prep = (b: Result<Brep>): PreparedBody => unwrap(prepareBody(k, unwrap(b)));
const cls = (body: PreparedBody, p: Point3): string => unwrap(classifyPoint(k, body, p)).class;
const close = (a: number, b: number, tol: number, msg?: string): void => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} vs ${b} (tol ${tol})`);

/** Deterministic pseudo-random numbers in [0, 1) (a linear congruential generator). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const box = prep(makeBox(k, P(0, 0, 0), 1, 2, 3));
const cube = prep(makeBox(k, P(0, 0, 0), 1, 1, 1));
const cylinder = prep(makeCylinder(k, WORLD_PLACEMENT, 1, 2));
const sphere = prep(makeSphere(k, P(0, 0, 0), 1.5));
const cone = prep(makeCone(k, WORLD_PLACEMENT, 2, 0, 3)); // apex at (0, 0, 3)
const torus = prep(makeTorus(k, WORLD_PLACEMENT, 3, 1));
const xy = unwrap(createPlaneSurface(k, P(0, 0, 0), P(0, 0, 1), P(1, 0, 0)));
const plate = prep(
  extrude(k, unwrap(createProfile(k, xy, [unwrap(rectangleWire(0, 0, 4, 3)), unwrap(circleWire(point2(1, 1.5), 0.5)), unwrap(circleWire(point2(3, 1.5), 0.5))])), 1),
);
const xz = unwrap(createPlaneSurface(k, P(0, 0, 0), P(0, -1, 0), P(1, 0, 0)));
const ring = prep(revolve(k, unwrap(createProfile(k, xz, [unwrap(rectangleWire(1, 0, 1, 1))])), { origin: point2(0, 0), direction: point2(0, 1) }, TWO_PI));

// ---------------------------------------------------------------------------------------------------------------
// Lean Query: the crossing rule.

const Q = vec2(0, 0);

test('pass_through_count / pass_through_left: a polygon passing through the ray at a vertex counts once', () => {
  const v = vec2(2, 0);
  for (const [a, b] of [
    [vec2(1, -1), vec2(3, 1)],
    [vec2(3, 1), vec2(1, -1)],
    [vec2(5, -2), vec2(-1, 7)],
  ] as const) {
    const n = [edgeCrossing(Q, a, v), edgeCrossing(Q, v, b)].filter((c) => c === 'cross').length;
    assert.equal(n, 1);
  }
  // The vertex left of q: the ray misses it, 0 crossings.
  const w = vec2(-2, 0);
  assert.equal([edgeCrossing(Q, vec2(-3, -1), w), edgeCrossing(Q, w, vec2(-1, 1))].filter((c) => c === 'cross').length, 0);
});

test('touch_count_even / touch_count_above / touch_count_below: a polygon touching the ray at a vertex counts 0 or 2', () => {
  const v = vec2(2, 0);
  const above = [edgeCrossing(Q, vec2(1, 1), v), edgeCrossing(Q, v, vec2(3, 2))].filter((c) => c === 'cross').length;
  const below = [edgeCrossing(Q, vec2(1, -1), v), edgeCrossing(Q, v, vec2(3, -2))].filter((c) => c === 'cross').length;
  assert.equal(above, 2);
  assert.equal(below, 0);
});

test('horizontal_zero / horizontal_run_pass: edges on the ray line count 0, a pass along a run counts once', () => {
  assert.equal(edgeCrossing(Q, vec2(1, 0), vec2(4, 0)), 'none');
  assert.equal(edgeCrossing(Q, vec2(-1, 0), vec2(4, 0)), 'on');
  const run = [edgeCrossing(Q, vec2(1, -1), vec2(2, 0)), edgeCrossing(Q, vec2(2, 0), vec2(3, 0)), edgeCrossing(Q, vec2(3, 0), vec2(4, 1))];
  assert.equal(run.filter((c) => c === 'cross').length, 1);
  const bump = [edgeCrossing(Q, vec2(1, 1), vec2(2, 0)), edgeCrossing(Q, vec2(2, 0), vec2(3, 0)), edgeCrossing(Q, vec2(3, 0), vec2(4, 1))];
  assert.equal(bump.filter((c) => c === 'cross').length % 2, 0);
});

test('crosses_symm / crossCount_reverse / inside_reverse: reversing a polygon keeps every edge crossing and the count', () => {
  const rnd = lcg(7);
  for (let trial = 0; trial < 200; trial++) {
    const n = 3 + Math.floor(rnd() * 8);
    // Small integer coordinates make vertices on the ray line common.
    const ring = Array.from({ length: n }, () => vec2(Math.floor(rnd() * 7) - 3, Math.floor(rnd() * 7) - 3));
    const q = vec2(Math.floor(rnd() * 5) - 2 + 0.5 * Math.floor(rnd() * 2), Math.floor(rnd() * 5) - 2);
    for (let i = 0; i < n; i++) {
      const a = ring[i]!, b = ring[(i + 1) % n]!;
      assert.equal(edgeCrossing(q, a, b), edgeCrossing(q, b, a));
    }
    const fwd = crossingCount(q, [ring]), back = crossingCount(q, [[...ring].reverse()]);
    assert.equal(fwd.on, back.on);
    if (!fwd.on) assert.equal(fwd.count, back.count);
  }
});

test('crossingCount: parity of a square with collinear samples, holes and boundary points', () => {
  const square = [vec2(0, 0), vec2(1, 0), vec2(2, 0), vec2(2, 1), vec2(2, 2), vec2(0, 2), vec2(0, 1)];
  const hole = [vec2(0.5, 0.5), vec2(0.5, 1.5), vec2(1.5, 1.5), vec2(1.5, 0.5)];
  const inside = (p: Point2): boolean => crossingCount(p, [square, hole]).count % 2 === 1;
  assert.equal(inside(vec2(0.25, 1)), true); // ray through the vertices (2, 1) and the hole's sides
  assert.equal(inside(vec2(1, 1)), false); // in the hole
  assert.equal(inside(vec2(3, 1)), false);
  assert.equal(inside(vec2(0.25, 0.5)), true); // ray along the hole's bottom side at its height
  assert.equal(crossingCount(vec2(1, 0), [square]).on, true);
  assert.equal(crossingCount(vec2(0.5, 1), [square, hole]).on, true);
});

// ---------------------------------------------------------------------------------------------------------------
// Lean Query: the box lower bound and pruning.

test('boxDistSq_le / prune_sound / gap_sq_le / gap_cases: the box bound never exceeds the distance to a point of the box', () => {
  const rnd = lcg(11);
  const b = { min: P(-1, 0, 2), max: P(1, 3, 2.5) };
  for (let i = 0; i < 500; i++) {
    const p = P(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 2);
    const x = P(b.min.x + rnd() * 2, b.min.y + rnd() * 3, b.min.z + rnd() * 0.5);
    const lb = boxDistanceSq(b, p);
    const d2 = (x.x - p.x) ** 2 + (x.y - p.y) ** 2 + (x.z - p.z) ** 2;
    assert.ok(lb <= d2 * (1 + 1e-12));
    if (canPrune(lb, Math.sqrt(d2))) assert.fail('a box holding a point at the best distance was pruned');
  }
  assert.equal(axisGap(0, 1, 0.5), 0);
  assert.equal(axisGap(0, 1, -2), 2);
  assert.equal(axisGap(0, 1, 4), 3);
  assert.equal(boxDistanceSq(b, P(0, 1, 2.2)), 0);
  assert.equal(boxDistanceSq(b, P(3, 1, 2.2)), 4);
  const range = rayBoxRange(b, P(-5, 1, 2.2), P(1, 0, 0), 100, 0)!;
  close(range[0], 4, 1e-10);
  close(range[1], 6, 1e-10);
  assert.ok(range[0] <= 4 && range[1] >= 6);
  assert.equal(rayBoxRange(b, P(-5, 1, 2.2), P(-1, 0, 0), 100, 0), undefined);
  assert.equal(rayBoxRange(b, P(-5, 5, 2.2), P(1, 0, 0), 100, 0), undefined);
});

// ---------------------------------------------------------------------------------------------------------------
// Lean Query: entering / leaving.

test('entering_side / leaving_side / transition_entering_iff: rayBody transitions follow the sign of n·d against the outward normal', () => {
  const r = unwrap(rayBody(k, box, P(-1, 0.5, 0.5), P(1, 0, 0)));
  assert.equal(r.class, 'exact');
  const hits = r.hits as readonly RayFaceHit[];
  assert.deepEqual(
    hits.map((h) => [h.t, h.transition]),
    [
      [1, 'entering'],
      [2, 'leaving'],
    ],
  );
  assert.ok(hits[0]!.cosine < 0 && hits[1]!.cosine > 0);
  // Reversed direction from the far side: still entering first.
  const back = unwrap(rayBody(k, box, P(3, 0.5, 0.5), P(-2, 0, 0)));
  assert.deepEqual(
    back.hits.map((h) => (h.kind === 'point' ? [h.t, h.transition] : [])),
    [
      [2, 'entering'],
      [3, 'leaving'],
    ],
  );
  // The inner (reversed) cylinder of the revolved ring: the outward normal points to the axis.
  const rr = unwrap(rayBody(k, ring, P(0, 0, 0.5), P(1, 0, 0)));
  assert.deepEqual(
    rr.hits.map((h) => (h.kind === 'point' ? [Math.round(h.t * 1e9) / 1e9, h.transition] : [])),
    [
      [1, 'entering'],
      [2, 'leaving'],
    ],
  );
});

// ---------------------------------------------------------------------------------------------------------------
// rayBody

test('rayBody: hit counts, sorting and entering/leaving alternation on primitives', () => {
  const cases: { name: string; body: PreparedBody; o: Point3; d: Vec3; ts: number[] }[] = [
    { name: 'sphere', body: sphere, o: P(-5, 0.1, 0.2), d: P(1, 0, 0), ts: [5 - Math.sqrt(2.25 - 0.05), 5 + Math.sqrt(2.25 - 0.05)] },
    { name: 'torus along x', body: torus, o: P(-6, 0, 0.3), d: P(1, 0, 0), ts: [] },
    { name: 'cylinder along z', body: cylinder, o: P(0.2, 0.1, -1), d: P(0, 0, 1), ts: [1, 3] },
    { name: 'plate through a hole', body: plate, o: P(1, 1.5, -1), d: P(0, 0, 1), ts: [] },
    { name: 'plate through material', body: plate, o: P(2, 1.5, -1), d: P(0, 0, 1), ts: [1, 2] },
    { name: 'plate across both holes', body: plate, o: P(-1, 1.5, 0.5), d: P(1, 0, 0), ts: [1, 1.5, 2.5, 3.5, 4.5, 5] },
  ];
  const t4 = (x: number): number => Math.sqrt(Math.max(0, x));
  // Torus at height 0.3: ring radii 3 ± sqrt(1 - 0.09).
  const w = t4(1 - 0.09);
  cases[1]!.ts = [6 - 3 - w, 6 - 3 + w, 6 + 3 - w, 6 + 3 + w];
  for (const c of cases) {
    const r = unwrap(rayBody(k, c.body, c.o, c.d));
    const pts = r.hits.filter((h): h is RayFaceHit => h.kind === 'point');
    assert.equal(pts.length, c.ts.length, c.name);
    pts.forEach((h, i) => close(h.t, c.ts[i]!, 1e-7, `${c.name} hit ${i}: ${h.t} vs ${c.ts[i]}`));
    assert.equal(transitionsAlternate(pts.map((h) => h.transition)), true, c.name);
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i]!.t >= pts[i - 1]!.t);
    for (const h of pts) assert.ok(distance3(h.point, P(c.o.x + h.t * c.d.x, c.o.y + h.t * c.d.y, c.o.z + h.t * c.d.z)) < 1e-6);
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.hits));
  }
});

test('rayBody: hits on edges are kept once per face with the boundary entity; maxT limits the ray', () => {
  // Through the edge x = 1, z = 0 ... of the cube: along the diagonal of the face y = 0.5 plane.
  const r = unwrap(rayBody(k, cube, P(2, 0.5, -1), P(-1, 0, 1)));
  const onEdge = r.hits.filter((h) => h.kind === 'point' && h.boundary !== undefined);
  assert.equal(onEdge.length, 4); // two edges, two faces each
  for (const h of onEdge) if (h.kind === 'point') assert.equal(h.boundary!.kind, 'edge');
  const short = unwrap(rayBody(k, box, P(-1, 0.5, 0.5), P(1, 0, 0), 1.5));
  assert.equal(short.hits.length, 1);
  assert.equal(rayBody(k, box, P(0, 0, 0), P(0, 0, 0)).ok, false);
  assert.equal(rayBody(k, box, P(NaN, 0, 0), P(1, 0, 0)).ok, false);
  // A ray lying in the plane of a face (overlap): reported as an overlap of that face.
  const ov = unwrap(rayBody(k, cube, P(-1, 0.5, 1), P(1, 0, 0)));
  const topFace = cube.faces.find((f) => f.surface.kind === 'plane' && f.box.min.z === 1 && f.box.max.z === 1)!.face;
  const overlaps = ov.hits.filter((h) => h.kind === 'overlap');
  assert.ok(overlaps.length >= 1 && overlaps.every((h) => h.kind === 'overlap' && h.face === topFace));
  assert.ok(overlaps.some((h) => h.kind === 'overlap' && h.range[0] <= 1 && h.range[1] >= 2));
  // ... and a coplanar ray that misses the face is not.
  const miss = unwrap(rayBody(k, cube, P(-1, 5, 1), P(1, 0, 0)));
  assert.equal(miss.hits.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// classifyPoint

test('classifyPoint: box, cylinder, sphere', () => {
  assert.equal(cls(box, P(0.5, 1, 1.5)), 'inside');
  assert.equal(cls(box, P(0.999, 1.999, 2.999)), 'inside');
  assert.equal(cls(box, P(1.001, 1, 1)), 'outside');
  assert.equal(cls(box, P(-5, 1, 1)), 'outside');
  const onFace = unwrap(classifyPoint(k, box, P(1, 1, 1)));
  assert.equal(onFace.class, 'on');
  assert.equal(onFace.entity!.kind, 'face');
  assert.equal(unwrap(classifyPoint(k, box, P(1, 2, 1))).entity!.kind, 'edge');
  assert.equal(unwrap(classifyPoint(k, box, P(1, 2, 3 + 5e-6))).entity!.kind, 'vertex');
  assert.equal(cls(box, P(1 + 2e-5, 1, 1)), 'outside');

  assert.equal(cls(cylinder, P(0, 0, 1)), 'inside'); // on the axis
  assert.equal(cls(cylinder, P(0.7, 0.7, 0.01)), 'inside');
  assert.equal(cls(cylinder, P(0.72, 0.72, 1)), 'outside');
  assert.equal(cls(cylinder, P(0, 0, 2.5)), 'outside');
  assert.equal(cls(cylinder, P(1, 0, 1)), 'on'); // on the seam
  assert.equal(unwrap(classifyPoint(k, cylinder, P(1, 0, 1))).entity!.kind, 'edge');
  assert.equal(cls(cylinder, P(0, 1, 1)), 'on');
  assert.equal(cls(cylinder, P(0.3, 0.3, 2)), 'on');

  assert.equal(cls(sphere, P(0, 0, 0)), 'inside');
  assert.equal(cls(sphere, P(0, 0, 1.49)), 'inside');
  assert.equal(cls(sphere, P(0, 0, 1.51)), 'outside');
  assert.equal(cls(sphere, P(1.06, 1.06, 0)), 'inside'); // |p| = 1.4991
  assert.equal(cls(sphere, P(1.061, 1.061, 0)), 'outside'); // |p| = 1.5005
  assert.equal(unwrap(classifyPoint(k, sphere, P(0, 0, 1.5))).entity!.kind, 'vertex'); // the pole
  assert.equal(cls(sphere, P(1.5 * Math.cos(1), 0, 1.5 * Math.sin(1))), 'on'); // on the seam meridian
});

test('classifyPoint: cone apex region, torus hole, plate holes, revolved ring', () => {
  // Cone: base radius 2 at z = 0, apex (0, 0, 3); radius at height z is 2 (1 - z / 3).
  assert.equal(cls(cone, P(0, 0, 2.99)), 'inside');
  assert.equal(cls(cone, P(0, 0, 3.01)), 'outside');
  assert.equal(cls(cone, P(0.02, 0, 2.99)), 'outside'); // radius there is 0.00667
  assert.equal(cls(cone, P(0.005, 0, 2.99)), 'inside');
  assert.equal(unwrap(classifyPoint(k, cone, P(0, 0, 3))).entity!.kind, 'vertex');
  assert.equal(cls(cone, P(1.95, 0, 0.1)), 'outside'); // radius 1.933 there
  assert.equal(cls(cone, P(1.5, 0, 0.1)), 'inside');

  assert.equal(cls(torus, P(0, 0, 0)), 'outside'); // the hole
  assert.equal(cls(torus, P(1.5, 0, 0)), 'outside');
  assert.equal(cls(torus, P(3, 0, 0)), 'inside'); // the core circle
  assert.equal(cls(torus, P(0, -3.5, 0.5)), 'inside');
  assert.equal(cls(torus, P(0, -3.5, 0.9)), 'outside');
  assert.equal(cls(torus, P(4, 0, 0)), 'on');

  assert.equal(cls(plate, P(1, 1.5, 0.5)), 'outside'); // hole centers
  assert.equal(cls(plate, P(3, 1.5, 0.5)), 'outside');
  assert.equal(cls(plate, P(1.3, 1.5, 0.5)), 'outside');
  assert.equal(cls(plate, P(2, 1.5, 0.5)), 'inside');
  assert.equal(cls(plate, P(0.2, 0.2, 0.9)), 'inside');
  assert.equal(cls(plate, P(1.5, 1.5, 0.5)), 'on'); // the hole wall

  assert.equal(cls(ring, P(0, 0, 0.5)), 'outside');
  assert.equal(cls(ring, P(0.9, 0, 0.5)), 'outside');
  assert.equal(cls(ring, P(1.5, 0, 0.5)), 'inside');
  assert.equal(cls(ring, P(-1.1, -1.1, 0.5)), 'inside');
  assert.equal(cls(ring, P(1.5, 0, 1.2)), 'outside');
  assert.equal(cls(ring, P(0, 2, 0.5)), 'on');
});

test('classifyPoint: matches the analytic membership on random points (sphere, torus, ring)', () => {
  const rnd = lcg(3);
  const truth: [PreparedBody, (p: Point3) => number][] = [
    [sphere, (p) => 1.5 - length3(p)],
    [torus, (p) => 1 - Math.hypot(Math.hypot(p.x, p.y) - 3, p.z)],
    [ring, (p) => Math.min(Math.hypot(p.x, p.y) - 1, 2 - Math.hypot(p.x, p.y), p.z, 1 - p.z)],
  ];
  for (const [body, f] of truth) {
    for (let i = 0; i < 25; i++) {
      const p = P(rnd() * 9 - 4.5, rnd() * 9 - 4.5, rnd() * 3 - 1);
      const s = f(p);
      if (Math.abs(s) < 1e-3) continue;
      assert.equal(cls(body, p), s > 0 ? 'inside' : 'outside', JSON.stringify(p));
    }
  }
});

test('classifyPoint: rays through vertices and edges are discarded and retried, deterministically', () => {
  const c = P(0.5, 0.5, 0.5);
  // The first ray runs to the vertex (1, 1, 1), the second to the edge x = y = 1.
  const opts = { directions: [P(1, 1, 1), P(1, 1, 0), ...RAY_DIRECTIONS] };
  const a = unwrap(classifyPoint(k, cube, c, opts));
  assert.equal(a.class, 'inside');
  assert.equal(a.discarded, 2);
  assert.equal(a.rays, 2);
  assert.deepEqual(unwrap(classifyPoint(k, cube, c, opts)), a);
  // Grazing: a ray along a face's plane (overlap) is discarded too.
  const g = unwrap(classifyPoint(k, cube, P(0.5, 0.5, 0.999), { directions: [P(1, 0, 0), P(0, 0, 1), P(0.3, 0.2, 1), P(0.1, -0.4, 1)] }));
  assert.equal(g.class, 'inside');
  // Only degenerate rays: refused by name, never guessed.
  const r = classifyPoint(k, cube, c, { directions: [P(1, 1, 1), P(-1, -1, -1), P(1, 1, 0)] });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.kind, 'not-converged');
    assert.match(r.error.operation, /every ray was degenerate/);
    assert.equal(refusalReason(r.error), undefined);
  }
  // A sphere's poles: a ray along the polar axis meets the pole vertices and is retried.
  const s = unwrap(classifyPoint(k, sphere, P(0, 0, 0.2), { directions: [P(0, 0, 1), ...RAY_DIRECTIONS] }));
  assert.equal(s.class, 'inside');
  assert.equal(s.discarded, 1);
  // A larger agreement needs more rays.
  assert.equal(unwrap(classifyPoint(k, cube, c, { agreement: 4 })).rays, 4);
});

test('classifyPoint: input errors and a bare B-rep', () => {
  assert.equal(classifyPoint(k, cube, P(NaN, 0, 0)).ok, false);
  assert.equal(unwrap(classifyPoint(k, unwrap(makeBox(k, P(0, 0, 0), 1, 1, 1)), P(0.5, 0.5, 0.5))).class, 'inside');
  const r = unwrap(classifyPoint(k, cube, P(0.25, 0.5, 0.75)));
  assert.ok(Object.isFrozen(r));
  assert.equal(r.basis, 'rays');
  assert.equal(r.evidence, 'exact');
});

// ---------------------------------------------------------------------------------------------------------------
// pointInFace

test('pointInFace: trimmed planar faces, seams and poles', () => {
  const top = plate.faces.find((f) => f.surface.kind === 'plane' && f.rings.length === 3 && f.box.min.z > 0.5)!;
  assert.ok(top !== undefined);
  assert.equal(unwrap(pointInFace(k, plate, top.face, { point: P(2, 1.5, 1) })).class, 'inside');
  assert.equal(unwrap(pointInFace(k, plate, top.face, { point: P(1, 1.5, 1) })).class, 'outside');
  assert.equal(unwrap(pointInFace(k, plate, top.face, { point: P(5, 1.5, 1) })).class, 'outside');
  const rim = unwrap(pointInFace(k, plate, top.face, { point: P(1, 2, 1) }));
  assert.equal(rim.class, 'on');
  assert.equal(rim.boundary!.kind, 'edge');
  assert.equal(unwrap(pointInFace(k, plate, top.face, { point: P(1.5, 1.5, 1) })).boundary!.kind, 'vertex'); // the circle's seam vertex

  const side = cylinder.faces.find((f) => f.surface.kind === 'cylinder')!;
  assert.equal(unwrap(pointInFace(k, cylinder, side.face, { uv: vec2(1, 1) })).class, 'inside');
  assert.equal(unwrap(pointInFace(k, cylinder, side.face, { uv: vec2(1 - TWO_PI, 1) })).class, 'inside'); // shifted a period
  assert.equal(unwrap(pointInFace(k, cylinder, side.face, { uv: vec2(1, 2.5) })).class, 'outside');
  assert.equal(unwrap(pointInFace(k, cylinder, side.face, { uv: vec2(0, 1) })).boundary!.kind, 'edge'); // the seam
  assert.equal(unwrap(pointInFace(k, cylinder, side.face, { uv: vec2(TWO_PI, 1) })).class, 'on');

  const sf = sphere.faces[0]!;
  assert.deepEqual(sf.rings[0]!.length, 4); // the parameter rectangle, pole lines included
  assert.equal(unwrap(pointInFace(k, sphere, sf.face, { uv: vec2(3, 1.5) })).class, 'inside');
  assert.equal(unwrap(pointInFace(k, sphere, sf.face, { uv: vec2(3, Math.PI / 2) })).boundary!.kind, 'vertex');
  assert.equal(pointInFace(k, sphere, faceId(9), { uv: vec2(0, 0) }).ok, false);
  assert.equal(pointInFace(k, sphere, sf.face, { uv: vec2(NaN, 0) }).ok, false);
});

// ---------------------------------------------------------------------------------------------------------------
// Distances

test('closestPointOnBody / distancePointBody: analytic distances and entities', () => {
  const s = unwrap(closestPointOnBody(k, sphere, P(3, 4, 0)));
  close(s.distance, 5 - 1.5, 1e-12);
  assert.equal(s.entity.kind, 'face');
  assert.equal(s.method, 'projection');
  close(unwrap(distancePointBody(k, sphere, P(0.3, 0, 0.4))), 1.0, 1e-12);

  const corner = unwrap(closestPointOnBody(k, box, P(2, 3, 4)));
  close(corner.distance, Math.sqrt(3), 1e-12);
  assert.equal(corner.entity.kind, 'vertex');
  const edge = unwrap(closestPointOnBody(k, box, P(2, 3, 1.5)));
  close(edge.distance, Math.sqrt(2), 1e-12);
  assert.equal(edge.entity.kind, 'edge');
  const face = unwrap(closestPointOnBody(k, box, P(0.5, 1, -2)));
  close(face.distance, 2, 1e-12);
  assert.equal(face.entity.kind, 'face');
  close(unwrap(distancePointBody(k, box, P(0.5, 1, 1.4))), 0.5, 1e-12); // inside: to the nearest face

  close(unwrap(distancePointBody(k, cylinder, P(3, 0, 1))), 2, 1e-12);
  const rimPt = unwrap(closestPointOnBody(k, cylinder, P(0, 3, 4)));
  close(rimPt.distance, Math.hypot(2, 2), 1e-9);
  assert.equal(rimPt.entity.kind, 'edge');
  close(unwrap(distancePointBody(k, cylinder, P(0, 0, 0.5))), 0.5, 1e-12); // on the axis: the bottom cap

  close(unwrap(distancePointBody(k, torus, P(5, 0, 0))), 1, 1e-12);
  close(unwrap(distancePointBody(k, torus, P(0, 4.5, 1))), Math.hypot(1.5, 1) - 1, 1e-12);
  // On the axis every point of a parallel is nearest (the projection is degenerate, the face is sampled); the
  // seam circle u = 0 holds a nearest point, so the edge candidate gives the exact distance.
  const axis = unwrap(closestPointOnBody(k, torus, P(0, 0, 2)));
  close(axis.distance, Math.hypot(3, 2) - 1, 1e-12);
  assert.equal(axis.entity.kind, 'edge');
  close(unwrap(distancePointBody(k, sphere, P(0, 0, 0))), 1.5, 1e-12); // the center: every point is nearest

  // A point above the cone's apex: the apex vertex.
  const apex = unwrap(closestPointOnBody(k, cone, P(0, 0, 4)));
  close(apex.distance, 1, 1e-12);
  assert.equal(apex.entity.kind, 'vertex');
  // The plate's hole wall from the hole's center.
  close(unwrap(distancePointBody(k, plate, P(1, 1.5, 0.5))), 0.5, 1e-9);
  assert.equal(distancePointBody(k, plate, P(Infinity, 0, 0)).ok, false);
});

test('closestPointOnBody: pruning agrees with the unpruned minimum over every entity', () => {
  const rnd = lcg(5);
  for (const body of [box, cylinder, plate, ring, sphere]) {
    for (let i = 0; i < 8; i++) {
      const p = P(rnd() * 8 - 2, rnd() * 8 - 2, rnd() * 4 - 1.5);
      const r = unwrap(closestPointOnBody(k, body, p));
      // Brute force without pruning: every vertex, every edge, every face whose foot is in the face.
      let best = Infinity;
      for (const v of body.brep.vertices) best = Math.min(best, distance3(p, v.point));
      body.brep.edges.forEach((_, e) => (best = Math.min(best, unwrap(edgeDistance(body.brep, edgeId(e), p)).distance)));
      for (const f of body.faces) {
        const q = projectPoint(k, f.surface, p);
        if (!q.ok) continue;
        if (unwrap(pointInFace(k, body, f.face, { uv: vec2(q.value.u, q.value.v) })).class !== 'outside') best = Math.min(best, q.value.distance);
      }
      close(r.distance, best, 1e-12, `${JSON.stringify(p)}: ${r.distance} vs ${best}`);
      close(distance3(p, r.point), r.distance, 1e-9);
      // And never above a tessellation vertex (points of the body).
      const mesh = unwrap(tessellate(k, body.brep));
      for (let j = 0; j < mesh.positions.length; j += 3) {
        assert.ok(r.distance <= distance3(p, P(mesh.positions[j]!, mesh.positions[j + 1]!, mesh.positions[j + 2]!)) + 1e-9);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Bounds and measures

test('bodyBounds: certified boxes contain every tessellation vertex', () => {
  for (const body of [box, cylinder, sphere, cone, torus, plate, ring]) {
    const b = unwrap(bodyBounds(k, body));
    assert.equal(b.certified, true);
    const mesh = unwrap(tessellate(k, body.brep));
    for (let j = 0; j < mesh.positions.length; j += 3) {
      assert.ok(box3Contains(b.box, P(mesh.positions[j]!, mesh.positions[j + 1]!, mesh.positions[j + 2]!)));
    }
    for (const f of body.faces) {
      const grown = unwrap(expandBox3(b.box, 0));
      assert.ok(box3Contains(grown, f.box.min) && box3Contains(grown, f.box.max));
    }
  }
  const s = unwrap(bodyBounds(k, sphere)).box;
  close(s.max.z, 1.5, 1e-9);
  close(s.min.x, -1.5, 1e-9);
  const t = unwrap(bodyBounds(k, unwrap(makeTorus(k, WORLD_PLACEMENT, 3, 1)))).box;
  close(t.max.x, 4, 1e-9);
  close(t.max.z, 1, 1e-9);
});

test('faceArea: primitive faces against 2πrh, 4πr², 4π²Rr, πrs and planar areas', () => {
  const area = (body: PreparedBody, f: FaceId): number => unwrap(faceArea(k, body, f));
  const kindArea = (body: PreparedBody, kind: string): number => body.faces.filter((f) => f.surface.kind === kind).reduce((s, f) => s + area(body, f.face), 0);
  close(kindArea(cylinder, 'cylinder'), TWO_PI * 1 * 2, 1e-9);
  close(kindArea(sphere, 'sphere'), 4 * Math.PI * 1.5 * 1.5, 1e-9);
  close(kindArea(torus, 'torus'), 4 * Math.PI * Math.PI * 3, 1e-8);
  close(kindArea(cone, 'cone'), Math.PI * 2 * Math.hypot(2, 3), 1e-8);
  close(kindArea(box, 'plane'), 2 * (2 + 3 + 6), 1e-12);
  close(kindArea(ring, 'cylinder'), TWO_PI * (1 + 2), 1e-9);
  // Planar faces bounded by circles: quadrature over the polygonal (u, v) trim, off by about perimeter × chord.
  close(kindArea(cylinder, 'plane'), 2 * Math.PI, 1e-4);
  close(kindArea(ring, 'plane'), 2 * Math.PI * (4 - 1), 1e-3);
  close(kindArea(plate, 'plane'), 2 * (12 - 2 * Math.PI * 0.25) + 2 * (4 + 3), 1e-4);
  assert.equal(faceArea(k, box, faceId(99)).ok, false);
});

test('edgeLength: the arc length of each edge over its interval', () => {
  const lens = cylinder.brep.edges.map((_, i) => unwrap(edgeLength(k, cylinder.brep, edgeId(i))));
  assert.deepEqual(
    lens.map((x) => Math.round(x * 1e9) / 1e9).sort(),
    [2, Math.round(TWO_PI * 1e9) / 1e9, Math.round(TWO_PI * 1e9) / 1e9].sort(),
  );
  const sphereSeam = unwrap(edgeLength(k, sphere.brep, edgeId(0)));
  close(sphereSeam, Math.PI * 1.5, 1e-12);
  assert.equal(edgeLength(k, box.brep, edgeId(100)).ok, false);
  const total = box.brep.edges.reduce((s, _, i) => s + unwrap(edgeLength(k, box.brep, edgeId(i))), 0);
  close(total, 4 * (1 + 2 + 3), 1e-12);
});

test('NURBS faces (a swept square): classification, rays, bounds and areas against the mesh', () => {
  const path = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], [[0, 0, 0], [0, 0, 1], [1, 0, 2], [2, 0.5, 3]]))));
  const body = prep(sweep(k, unwrap(createProfile(k, xy, [unwrap(rectangleWire(-0.3, -0.3, 0.6, 0.6))])), path));
  assert.ok(body.faces.filter((f) => f.surface.kind === 'nurbs').length === 4);
  const c = (u: number): Point3 => {
    const b1 = 3 * u * (1 - u) ** 2, b2 = 3 * u * u * (1 - u), b3 = u ** 3;
    return P(b2 * 1 + b3 * 2, b3 * 0.5, b1 + 2 * b2 + 3 * b3);
  };
  for (const u of [0.2, 0.5, 0.8]) {
    assert.equal(cls(body, c(u)), 'inside');
    assert.equal(cls(body, P(c(u).x + 0.8, c(u).y, c(u).z)), 'outside');
  }
  const r = unwrap(rayBody(k, body, P(c(0.5).x, -3, c(0.5).z), P(0, 1, 0)));
  assert.equal(r.class, 'certified');
  assert.equal(r.hits.length, 2);
  assert.equal(transitionsAlternate(r.hits.map((h) => (h.kind === 'point' ? h.transition : 'tangent'))), true);
  const mesh = unwrap(tessellate(k, body.brep, { chord: 1e-4 }));
  const bb = unwrap(bodyBounds(k, body));
  let meshArea = 0;
  for (let j = 0; j < mesh.indices.length; j += 3) {
    const at = (i: number): Point3 => P(mesh.positions[3 * i]!, mesh.positions[3 * i + 1]!, mesh.positions[3 * i + 2]!);
    const a = at(mesh.indices[j]!), b = at(mesh.indices[j + 1]!), d = at(mesh.indices[j + 2]!);
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = d.x - a.x, vy = d.y - a.y, vz = d.z - a.z;
    meshArea += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  for (let j = 0; j < mesh.positions.length; j += 3) assert.ok(box3Contains(bb.box, P(mesh.positions[j]!, mesh.positions[j + 1]!, mesh.positions[j + 2]!)));
  const total = body.faces.reduce((acc, f) => acc + unwrap(faceArea(k, body, f.face)), 0);
  close(total, meshArea, 2e-3 * meshArea);
});

test('prepareBody: frozen face domains with closed (u, v) rings; deterministic', () => {
  assert.ok(Object.isFrozen(torus) && Object.isFrozen(torus.faces) && Object.isFrozen(torus.faces[0]!.rings[0]));
  assert.deepEqual(torus.faces[0]!.rings[0]!.length, 4); // the period square
  assert.equal(torus.faces[0]!.periodic.v, true);
  const again = prep(makeTorus(k, WORLD_PLACEMENT, 3, 1));
  assert.deepEqual(again.faces[0]!.rings, torus.faces[0]!.rings);
  assert.equal(plate.faces.filter((f) => f.rings.length === 3).length, 2); // top and bottom with two holes
});

// ---------------------------------------------------------------------------------------------------------------
// Review regressions.

test('cnt_left_zero: an edge with both ends left of q never crosses (the crossingCount pre-filter skips nothing)', () => {
  const rnd = lcg(31);
  for (let i = 0; i < 2000; i++) {
    const q = vec2(Math.floor(rnd() * 5) - 2, Math.floor(rnd() * 5) - 2);
    const a = vec2(q.x - 1 - Math.floor(rnd() * 4), Math.floor(rnd() * 9) - 4);
    const b = vec2(q.x - 0.5 - Math.floor(rnd() * 4), Math.floor(rnd() * 9) - 4);
    assert.notEqual(edgeCrossing(q, a, b), 'cross');
  }
});

test('capped edge samples: the boundary band widens, so a coarse polygon never misplaces a point', () => {
  // A circle of radius 1e5 at zoneTol3d = 1e-5 needs more chords than the sampler allows: its polygon strays
  // about 0.03 inside the true rim. A point 0.01 inside the rim and 0.001 below the top must still be inside.
  const r = 1e5, h = 1e5;
  const big = prep(makeCylinder(k, WORLD_PLACEMENT, r, h));
  const circleBands = big.faces.flatMap((f) => (f.surface.kind === 'plane' ? f.edges.map((e) => big.edgeBands[e]!) : []));
  assert.ok(circleBands.every((b) => b > 10 * k.tolerances.zoneTol3d && b < 1), `${circleBands}`);
  assert.ok(cylinder.edgeBands.every((b) => b === k.tolerances.zoneTol3d));
  const th = Math.PI / 4096;
  const inner = P((r - 0.01) * Math.cos(th), (r - 0.01) * Math.sin(th), h - 0.001);
  const c = unwrap(classifyPoint(k, big, inner));
  assert.equal(c.class, 'inside');
  assert.ok(c.discarded > 0);
  // The same point 0.005 beyond the rim, on the cap's plane: never `on` the cap (it is 0.005 off the solid).
  const beyond = P((r + 0.005) * Math.cos(th), (r + 0.005) * Math.sin(th), h);
  const cb = classifyPoint(k, big, beyond);
  assert.ok(!cb.ok || cb.value.class === 'outside', JSON.stringify(cb));
  const top = big.faces.find((f) => f.surface.kind === 'plane' && f.box.min.z > h / 2)!;
  const pf = unwrap(pointInFace(k, big, top.face, { point: P(inner.x, inner.y, h) }));
  assert.equal(pf.class, 'on');
  assert.equal(pf.boundary?.kind, 'edge');
});

test('rayBody: subnormal and huge directions are normalized, not turned into Infinity', () => {
  const tiny = unwrap(rayBody(k, cube, P(-1, 0.5, 0.5), P(5e-324, 0, 0)));
  assert.deepEqual(tiny.hits.map((h) => (h.kind === 'point' ? h.t : NaN)), [1, 2]);
  const huge = unwrap(rayBody(k, cube, P(-1, 0.5, 0.5), P(1.5e308, 0, 0)));
  assert.equal(huge.hits.length, 2);
  const c = unwrap(classifyPoint(k, cube, P(0.3, 0.4, 0.45), { directions: [P(5e-324, 1e-323, 2e-323), P(-1e308, 3e307, 2e307), P(1e-310, -2e-310, 3e-310)] }));
  assert.equal(c.class, 'inside');
  assert.equal(c.rays, 2);
});

test('classifyPoint: near-boundary points at 1e-9 and just beyond the tolerance (box, cylinder, sphere)', () => {
  const t = k.tolerances.zoneTol3d;
  for (const e of [1e-9, 0.5 * t]) {
    assert.equal(cls(cube, P(1 + e, 0.5, 0.5)), 'on');
    assert.equal(cls(cube, P(1 - e, 0.5, 0.5)), 'on');
    assert.equal(cls(cylinder, P(1 + e, 0, 1)), 'on');
    assert.equal(cls(sphere, P(0, 1.5 - e, 0)), 'on');
  }
  for (const e of [3 * t, 1e-3]) {
    assert.equal(cls(cube, P(1 - e, 0.5, 0.5)), 'inside');
    assert.equal(cls(cube, P(1 - e, 1 - e, 1 - e)), 'inside');
    assert.equal(cls(cylinder, P(1 - e, 0, 1)), 'inside'); // on the seam's half-plane
    assert.equal(cls(cylinder, P(1 + e, 0, 1)), 'outside');
    assert.equal(cls(sphere, P(0, 0, 1.5 - e)), 'inside'); // below the pole
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Adversarial review regressions.

test('ringEdges_reverse / chain_rotate / ringInside_reverse: the TS ring edges (ring[i], ring[(i+1)%n]) reversed or rotated keep the count', () => {
  const rnd = lcg(77);
  for (let trial = 0; trial < 300; trial++) {
    const n = 1 + Math.floor(rnd() * 9);
    const ring = Array.from({ length: n }, () => vec2(Math.floor(rnd() * 7) - 3, Math.floor(rnd() * 7) - 3));
    const q = vec2(Math.floor(rnd() * 5) - 2 + 0.5 * Math.floor(rnd() * 2), Math.floor(rnd() * 5) - 2);
    const base = crossingCount(q, [ring]);
    const rev = crossingCount(q, [[...ring].reverse()]);
    const s = Math.floor(rnd() * n);
    const rot = crossingCount(q, [[...ring.slice(s), ...ring.slice(0, s)]]);
    assert.equal(rev.on, base.on);
    assert.equal(rot.on, base.on);
    if (!base.on) {
      assert.equal(rev.count, base.count);
      assert.equal(rot.count, base.count);
    }
  }
});

test('classifyPoint: points 2e-5..1.2e-4 off seams, poles, apex, holes and edges match the analytic side', () => {
  const rnd = lcg(5);
  const sgn = (): number => (rnd() < 0.5 ? -1 : 1);
  const off = (): number => sgn() * (2e-5 + rnd() * 1e-4);
  const cases: [PreparedBody, () => [Point3, number]][] = [
    [cylinder, () => { const a = (rnd() - 0.5) * 1e-4, e = off(); return [P((1 + e) * Math.cos(a), (1 + e) * Math.sin(a), 0.001 + rnd() * 1.998), -e]; }],
    [sphere, () => { const a = rnd() * TWO_PI, th = rnd() * 1e-3, e = off(), r = 1.5 + e; return [P(r * Math.sin(th) * Math.cos(a), r * Math.sin(th) * Math.sin(a), r * Math.cos(th)), -e]; }],
    [cone, () => { const a = rnd() * TWO_PI, z = 3 - rnd() * 0.01, e = off() * 1.5; return [P((2 * (1 - z / 3) + e) * Math.cos(a), (2 * (1 - z / 3) + e) * Math.sin(a), z), -e]; }],
    [torus, () => { const a = (rnd() - 0.5) * 1e-4, b = (rnd() - 0.5) * 1e-4 + (rnd() < 0.5 ? 0 : Math.PI), e = off(), R0 = 3 + (1 + e) * Math.cos(b); return [P(R0 * Math.cos(a), R0 * Math.sin(a), (1 + e) * Math.sin(b)), -e]; }],
    [plate, () => { const a = rnd() * TWO_PI, e = off(); return [P(1 + (0.5 + e) * Math.cos(a), 1.5 + (0.5 + e) * Math.sin(a), 0.001 + rnd() * 0.998), e]; }],
    [cube, () => { const e1 = off(), e2 = off(); return [P(1 + e1, 1 + e2, rnd()), Math.min(-e1, -e2)]; }],
  ];
  for (const [body, gen] of cases) {
    for (let i = 0; i < 40; i++) {
      const [p, s] = gen();
      const r = unwrap(classifyPoint(k, body, p));
      assert.equal(r.class, s > 0 ? 'inside' : 'outside', JSON.stringify(p));
    }
  }
});

test('classifyPoint: rays tangent to a cylinder (and within 1e-5 of tangency) are discarded, never counted', () => {
  for (const dy of [0, 1e-9, -1e-9, -1e-7, -1e-6, -1e-5]) {
    const p = P(-0.5, 1 + dy, 1);
    const r = unwrap(classifyPoint(k, cylinder, p, { directions: [P(1, 0, 0), ...RAY_DIRECTIONS] }));
    assert.equal(r.class, 'outside');
    assert.equal(r.discarded, 1, `dy = ${dy}`);
    const hits = unwrap(rayBody(k, cylinder, p, P(1, 0, 0))).hits;
    assert.ok(hits.length >= 1 && hits.every((h) => h.kind === 'point' && h.transition === 'tangent'));
  }
});

test('classifyPoint / faceArea: a partial revolve and extreme scales against the exact membership', () => {
  const a0 = -2, span = 1.5 * Math.PI;
  const pl = unwrap(createPlaneSurface(k, P(0, 0, 0), P(Math.sin(a0), -Math.cos(a0), 0), P(Math.cos(a0), Math.sin(a0), 0)));
  const part = prep(revolve(k, unwrap(createProfile(k, pl, [unwrap(circleWire(point2(3, 0), 1))])), { origin: point2(0, 0), direction: point2(0, 1) }, span));
  const total = part.faces.reduce((s, f) => s + unwrap(faceArea(k, part, f.face)), 0);
  // The two end discs are quadrature over inscribed polygons (sag zoneTol3d): about (2/3) 2π zoneTol3d short each.
  close(total, 4 * Math.PI * Math.PI * 3 * (span / TWO_PI) + 2 * Math.PI, 2e-4);
  const rnd = lcg(9);
  for (let i = 0; i < 60; i++) {
    const p = P(rnd() * 9 - 4.5, rnd() * 9 - 4.5, rnd() * 2.4 - 1.2);
    const d = (((Math.atan2(p.y, p.x) - a0) % TWO_PI) + TWO_PI) % TWO_PI;
    const tube = 1 - Math.hypot(Math.hypot(p.x, p.y) - 3, p.z);
    const r = unwrap(classifyPoint(k, part, p));
    if (Math.abs(tube) < 1e-4 || Math.abs(d - span) < 1e-3 || d < 1e-3) continue;
    assert.equal(r.class, d <= span && tube > 0 ? 'inside' : 'outside', JSON.stringify(p));
  }
  const scaled: [Result<Brep>, (p: Point3) => number, Point3, number][] = [
    [makeBox(k, P(0, 0, 0), 1e-3, 2e-3, 3e-3), (p) => Math.min(p.x, 1e-3 - p.x, p.y, 2e-3 - p.y, p.z, 3e-3 - p.z), P(0, 0, 0), 4e-3],
    [makeBox(k, P(1e6, 2e6, -3e6), 1, 2, 3), (p) => Math.min(p.x - 1e6, 1e6 + 1 - p.x, p.y - 2e6, 2e6 + 2 - p.y, p.z + 3e6, -3e6 + 3 - p.z), P(1e6, 2e6, -3e6), 4],
    [makeTorus(k, WORLD_PLACEMENT, 3e5, 1e5), (p) => 1e5 - Math.hypot(Math.hypot(p.x, p.y) - 3e5, p.z), P(-4.5e5, -4.5e5, -1.5e5), 9e5],
  ];
  for (const [b, f, o, s] of scaled) {
    const body = prep(b);
    for (let i = 0; i < 40; i++) {
      const p = P(o.x + rnd() * s, o.y + rnd() * s, o.z + rnd() * s);
      const v = f(p);
      if (Math.abs(v) < 1e-4 * s) continue;
      assert.equal(cls(body, p), v > 0 ? 'inside' : 'outside', JSON.stringify(p));
    }
  }
});

test('classifyPoint / rayBody: hostile options and far rays are bounded refusals, never wrong answers', () => {
  const c = P(0.5, 0.5, 0.5);
  for (const opts of [{ directions: [] }, { directions: [P(NaN, 0, 0), P(0, 0, 0), P(Infinity, 1, 0)] }, { agreement: 1e9 }]) {
    const r = classifyPoint(k, cube, c, opts);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, 'not-converged');
  }
  assert.equal(unwrap(classifyPoint(k, cube, P(1e300, 0, 0))).class, 'outside');
  // From 1e20 away the ray's points cannot resolve the unit cube: a named refusal, not a guess.
  const far = rayBody(k, cube, P(-1e20, 0.5, 0.5), P(1, 0, 0));
  assert.ok(!far.ok || far.value.hits.length === 2);
  assert.equal(rayBody(k, cube, P(-1, 0.5, 0.5), P(1, 0, 0), Infinity).ok, false);
  assert.equal(unwrap(rayBody(k, cube, P(-1, 0.5, 0.5), P(1, 0, 0), 1e308)).hits.length, 2);
});
