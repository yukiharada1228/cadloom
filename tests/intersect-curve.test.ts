import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import { add3, dot3, length3, scale3, sub3, vec3, type Point3, type Vec3 } from '../src/math/vec.ts';
import { dyadicFromNumber, subDyadic, type Dyadic } from '../src/exact/dyadic.ts';
import {
  circleArcToNurbs,
  createCircleCurve,
  createEllipseCurve,
  createLineCurve,
  createNurbsCurve3,
  curvePoint3,
  curveRange,
  type Curve3,
  type NurbsCurve3,
} from '../src/curve/index.ts';
import { createNurbsCurve, insertKnot } from '../src/nurbs/index.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  planeToNurbs,
  sphereToNurbs,
  surfacePoint3,
  type Surface3,
} from '../src/surface/index.ts';
import { boundCurve, boxesDisjoint3, hullOf, intersect as ivIntersect, type Interval } from '../src/interval/index.ts';
import {
  CURVE_PAIR_BUDGET,
  circlePlaneAngles,
  cramer2,
  intersectCurveSurface,
  intersectCurves,
  intersectCurves2,
  intersectRay,
  krawczyk1,
  krawczykContracts,
  linePlaneParam,
  quadraticRoots,
  refusalReason,
  searchLimits,
  type CurveCurveHit,
  type CurveCurvePoint,
  type CurveSurfaceHit,
  type CurveSurfacePoint,
  type IntersectionResult,
} from '../src/intersect/index.ts';
import { crossesOver, samePlaceOnCurve, separatedAlong } from '../src/intersect/curve-curve.ts';
import { qAdd, qCmp, qMul, qOf, qToNumber } from '../src/exact/rational.ts';
import { ivec3 } from '../src/interval/index.ts';

const kernel = createKernel();
const TOL = kernel.tolerances.zoneTol3d;
const X = vec3(1, 0, 0), Y = vec3(0, 1, 0), Z = vec3(0, 0, 1);

const line = (o: Point3, d: Vec3, r: readonly [number, number]) => unwrap(createLineCurve(o, d, r));
const circleZ = (c: Point3, r: number, range?: readonly [number, number]) => unwrap(createCircleCurve(kernel, c, Z, X, r, range));

/** Bernstein coefficients of the cubic `a0 + a1 t + a2 t² + a3 t³`. */
const bernstein = (a: readonly number[]): number[] => [a[0]!, a[0]! + a[1]! / 3, a[0]! + (2 * a[1]!) / 3 + a[2]! / 3, a[0]! + a[1]! + a[2]! + a[3]!];
/** `s (t - r1)(t - r2)(t - r3)` in the power basis. */
const cubicWithRoots = (r1: number, r2: number, r3: number, s: number): number[] => [
  -s * r1 * r2 * r3,
  s * (r1 * r2 + r1 * r3 + r2 * r3),
  -s * (r1 + r2 + r3),
  s,
];
/** The degree-3 Bézier graph `(t, y(t), z)`, `t ∈ [0, 1]` (x control points at thirds: `x(t) = t`). */
const graph = (ys: readonly number[], z = 0): NurbsCurve3 =>
  unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], ys.map((y, i) => [i / 3, y, z]), undefined))));

const points = <H extends { kind: string }>(r: IntersectionResult<H>) => r.hits.filter((h) => h.kind === 'point');
const ccPoints = (r: IntersectionResult<CurveCurveHit>) => r.hits.filter((h): h is CurveCurvePoint => h.kind === 'point');
const csPoints = (r: IntersectionResult<CurveSurfaceHit>) => r.hits.filter((h): h is CurveSurfacePoint => h.kind === 'point');
const near = (a: number, b: number, eps = 1e-9, msg?: string) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} vs ${b}`);

/** Domain, deviation and order checks shared by every curve/curve answer. */
function checkCurveCurve(A: Curve3, B: Curve3, res: IntersectionResult<CurveCurveHit>): void {
  assert.ok(Object.isFrozen(res) && Object.isFrozen(res.hits));
  const [a0, a1] = curveRange(A), [b0, b1] = curveRange(B);
  let last = -Infinity;
  for (const h of res.hits) {
    assert.ok(Object.isFrozen(h));
    assert.ok(Number.isFinite(h.deviation) && h.deviation <= 2 * TOL, `deviation ${h.deviation}`);
    if (h.kind === 'point') {
      assert.ok(h.tA >= a0 && h.tA <= a1 && h.tB >= b0 && h.tB <= b1, 'parameters inside the ranges');
      const pa = unwrap(curvePoint3(A, h.tA)), pb = unwrap(curvePoint3(B, h.tB));
      assert.ok(length3(sub3(pa, pb)) <= 2 * TOL);
      assert.ok(h.tA >= last);
      last = h.tA;
    } else {
      assert.ok(h.rangeA[0] >= a0 && h.rangeA[1] <= a1 && h.rangeB[0] >= b0 && h.rangeB[1] <= b1);
      assert.ok(h.rangeA[0] <= h.rangeA[1] && h.rangeB[0] <= h.rangeB[1]);
    }
  }
}

function checkCurveSurface(C: Curve3, S: Surface3, res: IntersectionResult<CurveSurfaceHit>): void {
  assert.ok(Object.isFrozen(res) && Object.isFrozen(res.hits));
  const [c0, c1] = curveRange(C);
  for (const h of res.hits) {
    assert.ok(Number.isFinite(h.deviation) && h.deviation <= 2 * TOL);
    if (h.kind === 'point') {
      assert.ok(h.t >= c0 && h.t <= c1);
      const pc = unwrap(curvePoint3(C, h.t)), ps = unwrap(surfacePoint3(S, h.u, h.v));
      assert.ok(length3(sub3(pc, ps)) <= 2 * TOL, `C(t) vs S(u, v): ${length3(sub3(pc, ps))}`);
    } else {
      assert.ok(h.range[0] >= c0 && h.range[1] <= c1 && h.range[0] <= h.range[1]);
    }
  }
}

const cc = (A: Curve3, B: Curve3): IntersectionResult<CurveCurveHit> => {
  const r = unwrap(intersectCurves(kernel, A, B));
  checkCurveCurve(A, B, r);
  return r;
};
const cs = (C: Curve3, S: Surface3): IntersectionResult<CurveSurfaceHit> => {
  const r = unwrap(intersectCurveSurface(kernel, C, S));
  checkCurveSurface(C, S, r);
  return r;
};

const dy = (x: number): Dyadic => unwrap(dyadicFromNumber(x));

// ---------------------------------------------------------------------------------------------
// line / line (Lean: cramer_on_both, parallel_no_solution, coplanar_third_coord, collinear_param)

test('cramer_on_both: the exact Cramer parameters satisfy both line equations (exact rationals)', () => {
  const cases: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 1, 0, 0.25, -1, 0, 1],
    [0.1, 0.2, 0.3, 0.7, 1.3, -0.4, 0.2, 0.9],
    [1e-3, 5, 3, 1e7, -2.5, 1 / 3, 7, -1 / 7],
  ];
  for (const [oAx, oAy, ax, ay, oBx, oBy, bx, by] of cases) {
    // w = oB - oA exactly (dyadic subtraction), as in lineLineExact.
    const w: [Dyadic, Dyadic] = [subDyadic(dy(oBx), dy(oAx)), subDyadic(dy(oBy), dy(oAy))];
    const c = cramer2(w, [dy(ax), dy(ay)], [dy(bx), dy(by)]);
    assert.ok(c !== undefined);
    // oA + s dA == oB + t dB exactly, per coordinate.
    for (const [oa, da, ob, db] of [
      [oAx, ax, oBx, bx],
      [oAy, ay, oBy, by],
    ] as const) {
      assert.equal(qCmp(qAdd(qOf(oa), qMul(c.s, qOf(da))), qAdd(qOf(ob), qMul(c.t, qOf(db)))), 0);
    }
  }
  // The full solver: an exact point, correctly rounded.
  const r = cc(line(vec3(0, 0, 0), X, [-1, 1]), line(vec3(0.25, -1, 0), Y, [0, 2]));
  assert.equal(r.class, 'exact');
  const p = ccPoints(r);
  assert.equal(p.length, 1);
  assert.equal(p[0]!.tA, 0.25);
  assert.equal(p[0]!.tB, 1);
  assert.equal(p[0]!.contact, 'transversal');
  assert.equal(p[0]!.unique, true);
});

test('parallel_no_solution: det = 0 has no Cramer solution; parallel distinct lines do not meet', () => {
  assert.equal(cramer2([dy(0), dy(1)], [dy(1), dy(2)], [dy(-2), dy(-4)]), undefined);
  const r = cc(line(vec3(0, 0, 0), X, [0, 2]), line(vec3(0, 1, 0), X, [0, 2]));
  assert.equal(r.class, 'exact');
  assert.equal(r.hits.length, 0);
  // Skew lines (non-coplanar): no exact point and far apart, none.
  assert.equal(cc(line(vec3(0, 0, 0), X, [-1, 1]), line(vec3(0, -1, 1), Y, [0, 2])).hits.length, 0);
});

test('coplanar_third_coord: 3D lines in a slanted plane meet at the exact point', () => {
  // Both lines lie in the plane x + y + z = 1 and cross at p = (0.25, 0.5, 0.25).
  const p = vec3(0.25, 0.5, 0.25);
  const dA = vec3(1, -1, 0), dB = vec3(0.5, 0.5, -1);
  const A = line(sub3(p, scale3(dA, 0.75)), dA, [0, 2]);
  const B = line(sub3(p, scale3(dB, 1.5)), dB, [-1, 3]);
  const r = cc(A, B);
  assert.equal(r.class, 'exact');
  const q = ccPoints(r);
  assert.equal(q.length, 1);
  near(q[0]!.tA, 0.75, 1e-15);
  near(q[0]!.tB, 1.5, 1e-15);
  assert.ok(length3(sub3(q[0]!.point, p)) <= 1e-15);
});

test('collinear_param: collinear lines overlap on exactly mapped parameter ranges', () => {
  // A = x-axis s ∈ [0, 2]; B = (1,0,0) + t(-2,0,0), t ∈ [-1, 0.25]: B covers x ∈ [0.5, 3].
  const r = cc(line(vec3(0, 0, 0), X, [0, 2]), line(vec3(1, 0, 0), vec3(-2, 0, 0), [-1, 0.25]));
  assert.equal(r.class, 'exact');
  assert.equal(r.hits.length, 1);
  const o = r.hits[0]!;
  assert.equal(o.kind, 'overlap');
  if (o.kind !== 'overlap') return;
  assert.deepEqual([...o.rangeA], [0.5, 2]);
  assert.deepEqual([...o.rangeB], [-0.5, 0.25]);
  assert.equal(o.sameDirection, false);
  // Touching end to end: a single point, flagged tangent (the lines are parallel there).
  const t = cc(line(vec3(0, 0, 0), X, [0, 1]), line(vec3(1, 0, 0), X, [0, 1]));
  assert.equal(t.hits.length, 1);
  assert.equal(t.hits[0]!.kind, 'point');
  assert.equal((t.hits[0] as CurveCurvePoint).contact, 'tangent');
  // Nearly parallel within tol over the whole stretch: a certified overlap, never a point.
  const np = cc(line(vec3(0, 0, 0), X, [0, 1]), line(vec3(0, 1e-7, 0), vec3(1, 1e-8, 0), [0, 1]));
  assert.equal(np.class, 'certified');
  assert.equal(np.hits.length, 1);
  assert.equal(np.hits[0]!.kind, 'overlap');
});

test('qToNumber rounds exact rationals correctly', () => {
  assert.equal(qToNumber({ n: 1n, d: 3n }), 1 / 3);
  assert.equal(qToNumber({ n: -2n, d: 7n }), -2 / 7);
  assert.equal(qToNumber({ n: 10n ** 30n, d: 3n }), 1e30 / 3);
  assert.equal(qToNumber(qOf(0.1)), 0.1);
});

// ---------------------------------------------------------------------------------------------
// line / circle, circle / circle (closed forms with discriminant classification)

test('line/circle: two transversal points, one tangent point, none', () => {
  const C = circleZ(vec3(0, 0, 0), 1);
  const two = ccPoints(cc(line(vec3(-2, 0.5, 0), X, [0, 4]), C));
  assert.equal(two.length, 2);
  near(two[0]!.tA, 2 - Math.sqrt(0.75), 1e-12);
  near(two[1]!.tA, 2 + Math.sqrt(0.75), 1e-12);
  assert.ok(two.every((p) => p.contact === 'transversal' && p.class === 'exact'));
  const tan = cc(line(vec3(-2, 1, 0), X, [0, 4]), C);
  assert.equal(tan.class, 'exact');
  assert.equal(tan.hits.length, 1);
  assert.equal((tan.hits[0] as CurveCurvePoint).contact, 'tangent');
  near((tan.hits[0] as CurveCurvePoint).tB, Math.PI / 2, 1e-12);
  // 1e-9 off tangency (inside the tolerance band): one tangent point, never two.
  for (const e of [1e-9, -1e-9]) {
    const h = ccPoints(cc(line(vec3(-2, 1 + e, 0), X, [0, 4]), C));
    assert.equal(h.length, 1);
    assert.equal(h[0]!.contact, 'tangent');
  }
  assert.equal(cc(line(vec3(-2, 1.1, 0), X, [0, 4]), C).hits.length, 0);
  // Swapped roles give the same point with swapped parameters.
  const sw = ccPoints(cc(C, line(vec3(-2, 0.5, 0), X, [0, 4])));
  assert.equal(sw.length, 2);
  near(sw[0]!.tB, two[1]!.tA, 1e-12);
  // A line crossing the circle's plane: the plane point, kept only when on the circle.
  const thru = ccPoints(cc(line(vec3(1, 0, -1), Z, [0, 2]), C));
  assert.equal(thru.length, 1);
  near(thru[0]!.tA, 1, 1e-12);
});

test('circle/circle: crossing, external and internal tangency, coincident arcs, non-coplanar', () => {
  const two = ccPoints(cc(circleZ(vec3(0, 0, 0), 1), circleZ(vec3(1, 0, 0), 1)));
  assert.equal(two.length, 2);
  near(two[0]!.tA, Math.PI / 3, 1e-12);
  near(two[1]!.tA, (5 * Math.PI) / 3, 1e-12);
  const ext = ccPoints(cc(circleZ(vec3(0, 0, 0), 1), circleZ(vec3(2, 0, 0), 1)));
  assert.equal(ext.length, 1);
  assert.equal(ext[0]!.contact, 'tangent');
  const int = ccPoints(cc(circleZ(vec3(0, 0, 0), 2), circleZ(vec3(1, 0, 0), 1)));
  assert.equal(int.length, 1);
  assert.equal(int[0]!.contact, 'tangent');
  const same = cc(circleZ(vec3(0, 0, 0), 1, [0, Math.PI]), circleZ(vec3(0, 0, 0), 1, [Math.PI / 2, (3 * Math.PI) / 2]));
  assert.equal(same.hits.length, 1);
  const o = same.hits[0]!;
  assert.ok(o.kind === 'overlap');
  near(o.rangeA[0], Math.PI / 2, 1e-12);
  near(o.rangeA[1], Math.PI, 1e-12);
  // Perpendicular circles meeting at two points: x² + y² = 1 (z = 0) and the circle about (1,0,0) in the xz-plane of radius √2.
  const perp = ccPoints(cc(circleZ(vec3(0, 0, 0), 1), unwrap(createCircleCurve(kernel, vec3(1, 0, 0), Y, X, Math.SQRT2))));
  assert.equal(perp.length, 0); // it meets z = 0 at x = 1 ± √2, off the unit circle
  const perp2 = ccPoints(cc(circleZ(vec3(0, 0, 0), 1), unwrap(createCircleCurve(kernel, vec3(0, 0, 0), Y, X, 1))));
  assert.equal(perp2.length, 2); // great circles: (±1, 0, 0)
  assert.equal(cc(circleZ(vec3(0, 0, 0), 1), circleZ(vec3(0, 0, 1), 1)).hits.length, 0); // parallel planes
});

test('circlePlaneAngles: overlap, tangent, two roots, none', () => {
  const c = vec3(0, 0, 0);
  assert.equal(circlePlaneAngles(c, 1, X, Y, vec3(0, 0, 0), Z, TOL), 'overlap');
  const tan = circlePlaneAngles(c, 1, X, Y, vec3(1, 0, 0), X, TOL);
  assert.ok(tan !== 'overlap' && tan.length === 1 && tan[0]!.tangent);
  const two = circlePlaneAngles(c, 1, X, Y, vec3(0.5, 0, 0), X, TOL);
  assert.ok(two !== 'overlap' && two.length === 2);
  for (const r of two) near(Math.cos(r.theta), 0.5, 1e-12);
  assert.deepEqual(circlePlaneAngles(c, 1, X, Y, vec3(2, 0, 0), X, TOL), []);
});

// ---------------------------------------------------------------------------------------------
// General curves: subdivision with proved exclusion (Lean: prune_sound, survivor_complete)

const rootsCubic = cubicWithRoots(0.2, 0.5, 0.8, 4);

test('NURBS/NURBS: two degree-3 curves built to cross at 3 known points', () => {
  const A = graph(bernstein(rootsCubic));
  const B = graph(bernstein(rootsCubic.map((x) => -x)));
  const r = cc(A, B);
  assert.equal(r.class, 'certified');
  const p = ccPoints(r);
  assert.equal(p.length, 3);
  [0.2, 0.5, 0.8].forEach((x, i) => {
    near(p[i]!.tA, x, 1e-12);
    near(p[i]!.tB, x, 1e-12);
    assert.equal(p[i]!.contact, 'transversal');
    assert.equal(p[i]!.unique, true, 'Krawczyk / cone test isolated the root');
  });
  // Against a flat cubic (the x-axis): the same three roots.
  assert.equal(ccPoints(cc(A, graph([0, 0, 0, 0]))).length, 3);
});

test('NURBS/NURBS: a crossing on a knot (piece seam) is reported once', () => {
  const A = graph(bernstein(rootsCubic));
  const Ai = unwrap(createNurbsCurve3(unwrap(insertKnot(A.curve, 0.5, 1))));
  const B = graph(bernstein(rootsCubic.map((x) => -x)));
  const p = ccPoints(cc(Ai, B));
  assert.equal(p.length, 3);
  near(p[1]!.tA, 0.5, 1e-12);
  // A closed NURBS circle crossed by a line through its seam point (1, 0, 0): once at t = 0, not twice.
  const ring = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(circleZ(vec3(0, 0, 0), 1)))));
  const seam = ccPoints(cc(ring, line(vec3(-2, 0, 0), X, [0, 4])));
  assert.equal(seam.length, 2);
  near(seam[0]!.tA, 0, 1e-12);
  near(seam[1]!.tA, Math.PI, 1e-9);
});

test('NURBS/NURBS: a curve against its own refinement is one overlap', () => {
  const A = graph(bernstein(rootsCubic));
  const Ai = unwrap(createNurbsCurve3(unwrap(insertKnot(A.curve, 0.5, 1))));
  const r = cc(A, Ai);
  assert.equal(r.hits.length, 1);
  const o = r.hits[0]!;
  assert.ok(o.kind === 'overlap');
  assert.deepEqual([o.rangeA[0], o.rangeA[1]], [0, 1]);
  assert.equal(o.sameDirection, true);
});

test('near-miss pairs (1e-9 apart): no spurious double count, tangent flagged', () => {
  // y = (x - 1/2)² + e against the x-axis.
  const flat = graph([0, 0, 0, 0]);
  for (const e of [1e-9, -1e-9, 0]) {
    const r = cc(graph(bernstein([0.25 + e, -1, 1, 0])), flat);
    const p = ccPoints(r);
    assert.equal(p.length, 1, `e = ${e}`);
    assert.equal(p[0]!.contact, 'tangent');
    assert.equal(p[0]!.unique, false);
    near(p[0]!.tA, 0.5, 1e-3);
  }
  // Clearly apart: proved empty.
  assert.equal(cc(graph(bernstein([0.25 + 1e-3, -1, 1, 0])), flat).hits.length, 0);
});

test('ellipse/line and ellipse/circle by the general solver', () => {
  const E = unwrap(createEllipseCurve(kernel, vec3(0, 0, 0), Z, X, 2, 1));
  const l = ccPoints(cc(E, line(vec3(0, -3, 0), Y, [0, 6])));
  assert.equal(l.length, 2);
  near(l[0]!.tA, Math.PI / 2, 1e-10);
  near(l[1]!.tA, (3 * Math.PI) / 2, 1e-10);
  // x²/4 + y² = 1 and x² + y² = 2.25: 3x²/4 = 1.25 → four points.
  const c = ccPoints(cc(E, circleZ(vec3(0, 0, 0), 1.5)));
  assert.equal(c.length, 4);
  for (const p of c) near(p.point.x * p.point.x, 5 / 3, 1e-9);
  // Tangent at the vertex (2, 0): one tangent point.
  const t = ccPoints(cc(E, line(vec3(2, -3, 0), Y, [0, 6])));
  assert.equal(t.length, 1);
  assert.equal(t[0]!.contact, 'tangent');
});

test('prune_sound: certified boxes reported disjoint really hold no contact (sampled)', () => {
  const A = graph(bernstein(rootsCubic));
  const B = graph(bernstein(rootsCubic.map((x) => -x)), 0.0);
  let pruned = 0;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const I: Interval = hullOf([i / 16, (i + 1) / 16])!, J: Interval = hullOf([j / 16, (j + 1) / 16])!;
      const bA = unwrap(boundCurve(A, I)), bB = unwrap(boundCurve(B, J));
      if (!unwrap(boxesDisjoint3(bA, bB, TOL))) continue;
      pruned++;
      for (let a = 0; a <= 8; a++) {
        for (let b = 0; b <= 8; b++) {
          const pa = unwrap(curvePoint3(A, I.lo + ((I.hi - I.lo) * a) / 8));
          const pb = unwrap(curvePoint3(B, J.lo + ((J.hi - J.lo) * b) / 8));
          assert.ok(length3(sub3(pa, pb)) > TOL);
        }
      }
    }
  }
  assert.ok(pruned > 100);
});

test('survivor_complete: every analytic crossing is found by the pruned search (random cubics)', () => {
  // Deterministic pseudo-random roots; the solver must find exactly the roots in (0, 1).
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 4; k++) {
    const roots = [0.1 + 0.25 * rnd(), 0.4 + 0.2 * rnd(), 0.7 + 0.25 * rnd()];
    const A = graph(bernstein(cubicWithRoots(roots[0]!, roots[1]!, roots[2]!, 3)));
    const p = ccPoints(cc(A, graph([0, 0, 0, 0])));
    assert.equal(p.length, 3);
    roots.forEach((r, i) => near(p[i]!.tA, r, 1e-10));
  }
});

test('results are deterministic and frozen', () => {
  const A = graph(bernstein(rootsCubic));
  const B = graph(bernstein(rootsCubic.map((x) => -x)));
  const r1 = unwrap(intersectCurves(kernel, A, B));
  const r2 = unwrap(intersectCurves(kernel, A, B));
  assert.deepEqual(r1, r2);
  assert.throws(() => {
    (r1.hits as CurveCurveHit[]).push(r1.hits[0]!);
  });
  const T = unwrap(createTorusSurface(kernel, vec3(0, 0, 0), Z, X, 2, 1));
  const L = line(vec3(-4, 0.3, 0.2), vec3(1, 0.01, 0.02), [0, 8]);
  assert.deepEqual(unwrap(intersectCurveSurface(kernel, L, T)), unwrap(intersectCurveSurface(kernel, L, T)));
});

test('refusals by name: exhausted pair budget and depth limit', () => {
  const A = graph(bernstein(rootsCubic));
  const B = graph(bernstein(rootsCubic.map((x) => -x)));
  const r = intersectCurves(kernel, A, B, { maxPairVisits: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(refusalReason(r.error), 'subdivision budget exceeded');
  const d = intersectCurves(kernel, A, B, { maxDepth: 2 });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(refusalReason(d.error), 'recursion depth exceeded');
  const s = intersectCurveSurface(kernel, A, unwrap(createCylinderSurface(kernel, vec3(0, 0, 0), Z, X, 0.5)), { maxPairVisits: 2 });
  assert.equal(s.ok, false);
  if (!s.ok) assert.equal(refusalReason(s.error), 'subdivision budget exceeded');
  assert.deepEqual(searchLimits(undefined, CURVE_PAIR_BUDGET), { visits: CURVE_PAIR_BUDGET, depth: 80 });
  assert.deepEqual(searchLimits({ maxPairVisits: -3, maxDepth: 1.5 }, 7), { visits: 7, depth: 80 });
});

test('input errors are Results, never throws', () => {
  const bad = intersectCurves(createKernel({ zoneTol3d: 0 }), line(vec3(0, 0, 0), X, [0, 1]), line(vec3(0, 0, 0), Y, [0, 1]));
  assert.equal(bad.ok, false);
  const c2 = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0], [0.5, 1], [1, 0]], undefined));
  const lift = intersectCurves(kernel, { kind: 'nurbs', curve: c2 } as Curve3, line(vec3(0, 0, 0), X, [0, 1]));
  assert.equal(lift.ok, false);
  assert.equal(intersectRay(kernel, vec3(0, 0, 0), vec3(0, 0, 0), unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1))).ok, false);
});

// ---------------------------------------------------------------------------------------------
// Plane curves (pcurves)

test('2D curves: line/circle exact, quadratic NURBS against a line', () => {
  const r = unwrap(
    intersectCurves2(
      kernel,
      { kind: 'line', origin: { x: 0, y: 0 }, direction: { x: 1, y: 1 }, range: [0, 2] },
      { kind: 'circle', center: { x: 0, y: 0 }, radius: 1, range: [0, 2 * Math.PI] },
    ),
  );
  assert.equal(r.class, 'exact');
  assert.equal(r.hits.length, 1);
  const p = r.hits[0]!;
  assert.ok(p.kind === 'point');
  near(p.tA, Math.SQRT1_2, 1e-12);
  assert.deepEqual(Object.keys(p.point).sort(), ['x', 'y']);
  // y = 2t(1 - t) (control points (0,0), (0.5,1), (1,0)) meets y = 1/4 at t = (1 ± √0.5)/2.
  const q = unwrap(
    intersectCurves2(
      kernel,
      { kind: 'nurbs', curve: unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0], [0.5, 1], [1, 0]], undefined)) },
      { kind: 'line', origin: { x: 0, y: 0.25 }, direction: { x: 1, y: 0 }, range: [0, 1] },
    ),
  );
  assert.equal(q.class, 'certified');
  const qp = points(q) as CurveCurvePoint<{ x: number; y: number }>[];
  assert.equal(qp.length, 2);
  near(qp[0]!.tA, (1 - Math.SQRT1_2) / 2, 1e-12);
  near(qp[1]!.tA, (1 + Math.SQRT1_2) / 2, 1e-12);
  // 2D Cramer: exact parameters for a non-axis-aligned pair.
  const l = unwrap(
    intersectCurves2(
      kernel,
      { kind: 'line', origin: { x: 0, y: 0 }, direction: { x: 0.1, y: 0.3 }, range: [0, 10] },
      { kind: 'line', origin: { x: 0.3, y: 0 }, direction: { x: -0.1, y: 0.3 }, range: [0, 10] },
    ),
  );
  assert.equal(l.class, 'exact');
  const lp = l.hits[0]!;
  assert.ok(lp.kind === 'point');
  near(lp.tA, 1.5, 1e-15);
});

// ---------------------------------------------------------------------------------------------
// curve / surface closed forms (Lean: line_plane_on, line_plane_parallel, quadratic_roots,
// disc_neg_no_root, vertex_value, sphere/cylinder/cone_coeffs)

test('line_plane_on: the exact parameter lies on the plane; line_plane_parallel: none', () => {
  const o = vec3(0.1, -0.7, 0.3), d = vec3(0.3, 0.2, 0.9), p0 = vec3(1, 1, 1), n = vec3(0.6, 0.0, 0.8);
  const t = linePlaneParam(o, d, p0, n)!;
  near(dot3(n, add3(o, scale3(d, t))), dot3(n, p0), 1e-15);
  // Correctly rounded: equal to the exactly computed rational rounded once.
  assert.equal(t, (0.6 * (1 - 0.1) + 0 * (1 + 0.7) + 0.8 * (1 - 0.3)) / (0.6 * 0.3 + 0.8 * 0.9));
  assert.equal(linePlaneParam(o, vec3(0.8, 5, -0.6), p0, n), undefined);
  const pl = unwrap(createPlaneSurface(kernel, vec3(0, 0, 1), Z, X));
  const r = cs(line(vec3(0, 0, 0), vec3(1, 1, 1), [-5, 5]), pl);
  assert.equal(r.class, 'exact');
  const h = csPoints(r);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.t, 1);
  assert.equal(cs(line(vec3(0, 0, 0), X, [-5, 5]), pl).hits.length, 0);
  const inPlane = cs(line(vec3(0, 0, 1), X, [-5, 5]), pl);
  assert.equal(inPlane.hits.length, 1);
  assert.equal(inPlane.hits[0]!.kind, 'overlap');
});

test('quadratic_roots / disc_neg_no_root / vertex_value: quadraticRoots', () => {
  const r = quadraticRoots(1, -3, 2);
  assert.deepEqual(r, [1, 2]);
  for (const t of quadraticRoots(2, 1, -3)) near(2 * t * t + t - 3, 0, 1e-14);
  assert.deepEqual(quadraticRoots(1, 0, 1), []); // disc < 0
  const dbl = quadraticRoots(1, -2, 1); // disc = 0: vertex = double root
  assert.deepEqual(dbl, [1, 1]);
  assert.deepEqual(quadraticRoots(0, 2, -1), [0.5]); // linear_root
  assert.deepEqual(quadraticRoots(0, 0, 1), []);
});

test('sphere_coeffs: line/sphere two points, tangent, none (exact class)', () => {
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const two = cs(line(vec3(-2, 0.5, 0), X, [0, 4]), S);
  assert.equal(two.class, 'exact');
  const p = csPoints(two);
  assert.equal(p.length, 2);
  near(p[0]!.t, 2 - Math.sqrt(0.75), 1e-12);
  near(p[1]!.t, 2 + Math.sqrt(0.75), 1e-12);
  assert.ok(p.every((h) => h.contact === 'transversal'));
  for (const e of [0, 1e-9, -1e-9]) {
    const t = csPoints(cs(line(vec3(-2, 0, 1 + e), X, [0, 4]), S));
    assert.equal(t.length, 1, `e = ${e}`);
    assert.equal(t[0]!.contact, 'tangent');
    near(t[0]!.t, 2, 1e-6);
  }
  assert.equal(cs(line(vec3(-2, 0, 1.01), X, [0, 4]), S).hits.length, 0);
});

test('cylinder_coeffs / cone_coeffs: line/cylinder, line/cone and rulings as overlaps', () => {
  const Cy = unwrap(createCylinderSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const a = csPoints(cs(line(vec3(-2, 0, 3), X, [0, 4]), Cy));
  assert.deepEqual(a.map((h) => h.t), [1, 3]);
  const ruling = cs(line(vec3(1, 0, 0), Z, [0, 4]), Cy);
  assert.equal(ruling.hits.length, 1);
  assert.equal(ruling.hits[0]!.kind, 'overlap');
  const tan = csPoints(cs(line(vec3(1, -2, 0), Y, [0, 4]), Cy));
  assert.equal(tan.length, 1);
  assert.equal(tan[0]!.contact, 'tangent');
  // Cone b = 1, α = 45°: radius 1 + z. At z = 1 the radius is 2.
  const Co = unwrap(createConeSurface(kernel, vec3(0, 0, 0), Z, X, 1, Math.PI / 4));
  const c = csPoints(cs(line(vec3(-5, 0, 1), X, [0, 10]), Co));
  assert.equal(c.length, 2);
  near(c[0]!.t, 3, 1e-12);
  near(c[1]!.t, 7, 1e-12);
  const gen = cs(line(vec3(1, 0, 0), vec3(1, 0, 1), [0, 2]), Co);
  assert.equal(gen.hits.length, 1);
  assert.equal(gen.hits[0]!.kind, 'overlap');
  // Below the apex (z < -1) the mirrored nappe is not part of the surface: no hits there.
  assert.equal(cs(line(vec3(-5, 0, -3), X, [0, 10]), Co).hits.length, 0);
});

test('circle/plane exact; circle/sphere certified', () => {
  const pl = unwrap(createPlaneSurface(kernel, vec3(0, 0, 1), Z, X));
  const r = cs(unwrap(createCircleCurve(kernel, vec3(0, 0, 0), Y, X, 2)), pl);
  assert.equal(r.class, 'exact');
  assert.equal(r.hits.length, 2);
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  // (1 + cos θ, 0, sin θ) on |p| = 1: cos θ = -1/2.
  const cp = csPoints(cs(unwrap(createCircleCurve(kernel, vec3(1, 0, 0), Y, X, 1)), S));
  assert.equal(cp.length, 2);
  for (const h of cp) near(Math.cos(h.t), -0.5, 1e-10);
  // A great circle lies on the sphere: one overlap.
  const on = cs(circleZ(vec3(0, 0, 0), 1), S);
  assert.equal(on.hits.length, 1);
  assert.equal(on.hits[0]!.kind, 'overlap');
  // Externally tangent circle: one tangent point.
  const t = csPoints(cs(circleZ(vec3(0, 0, 0), 1), unwrap(createSphereSurface(kernel, vec3(2, 0, 0), Z, X, 1))));
  assert.equal(t.length, 1);
  assert.equal(t[0]!.contact, 'tangent');
});

// ---------------------------------------------------------------------------------------------
// line / torus (Lean: torus_implicit_zero, torus_factor, torus_root_on_tube, monotone_unique_root)

test('torus_root_on_tube: line/torus with 0, 1 (tangent), 2, 3 (one tangent), 4 roots', () => {
  const T = unwrap(createTorusSurface(kernel, vec3(0, 0, 0), Z, X, 2, 1));
  const run = (o: Point3, d: Vec3, r: readonly [number, number]) => {
    const res = cs(line(o, d, r), T);
    assert.equal(res.class, 'certified');
    return csPoints(res);
  };
  const four = run(vec3(-4, 0, 0), X, [0, 8]);
  assert.deepEqual(four.map((h) => Math.round(h.t * 1e9) / 1e9), [1, 3, 5, 7]);
  assert.ok(four.every((h) => h.contact === 'transversal' && h.unique));
  // x = 1 (tangent to the inner equator at y = 0) along y: ρ = 3 at y = ±√8, ρ = 1 touching.
  const three = run(vec3(1, -4, 0), Y, [0, 8]);
  assert.equal(three.length, 3);
  near(three[0]!.t, 4 - Math.sqrt(8), 1e-9);
  near(three[2]!.t, 4 + Math.sqrt(8), 1e-9);
  assert.deepEqual(three.map((h) => h.contact), ['transversal', 'tangent', 'transversal']);
  near(three[1]!.t, 4, 1e-6);
  const two = run(vec3(2, 0, -3), Z, [0, 6]);
  assert.deepEqual(two.map((h) => Math.round(h.t * 1e9) / 1e9), [2, 4]);
  // Along the top circle z = 1 through the axis: two tangent points (double roots of the quartic).
  const twoTan = run(vec3(-4, 0, 1), X, [0, 8]);
  assert.equal(twoTan.length, 2);
  assert.ok(twoTan.every((h) => h.contact === 'tangent'));
  const one = run(vec3(3, -4, 0), Y, [0, 8]);
  assert.equal(one.length, 1);
  assert.equal(one[0]!.contact, 'tangent');
  near(one[0]!.t, 4, 1e-6);
  assert.equal(run(vec3(4, -4, 0), Y, [0, 8]).length, 0);
  // Near misses 1e-9 off the top circle and off the outer equator: tangent points or nothing, never doubled.
  for (const e of [1e-9, -1e-9]) {
    const top = run(vec3(-4, 0, 1 + e), X, [0, 8]);
    assert.equal(top.length, 2);
    assert.ok(top.every((h) => h.contact === 'tangent'));
    const outer = run(vec3(3 + e, -4, 0), Y, [0, 8]);
    assert.equal(outer.length, 1);
    assert.equal(outer[0]!.contact, 'tangent');
  }
  // Every reported root is on the tube: (ρ - R)² + z² = r².
  for (const h of [...four, ...three, ...two]) {
    const rho = Math.hypot(h.point.x, h.point.y);
    near((rho - 2) ** 2 + h.point.z ** 2, 1, 1e-9);
  }
});

test('torus_implicit_zero / torus_factor: oblique line, four certified unique roots', () => {
  const T = unwrap(createTorusSurface(kernel, vec3(0.5, -0.25, 0.125), vec3(0, 0.6, 0.8), X, 2, 1));
  const L = line(vec3(-4, 0.3, 0.2), vec3(1, 0.01, 0.02), [0, 8]);
  const p = csPoints(cs(L, T));
  // Independent count: sign changes of the tube distance along the line (dense sampling, no near-tangency here).
  const tube = (q: Point3): number => {
    const w = sub3(q, T.center);
    const z = dot3(w, T.frame.normal);
    const rho = length3(sub3(w, scale3(T.frame.normal, z)));
    return Math.hypot(rho - 2, z) - 1;
  };
  let changes = 0;
  const roots: number[] = [];
  for (let i = 0, prev = tube(L.origin); i < 20000; i++) {
    const t1 = (8 * (i + 1)) / 20000;
    const cur = tube(add3(L.origin, scale3(L.direction, t1)));
    if (prev < 0 !== cur < 0) {
      changes++;
      roots.push(t1);
    }
    prev = cur;
  }
  assert.ok(changes >= 2);
  assert.equal(p.length, changes);
  p.forEach((h, i) => near(h.t, roots[i]!, 8 / 20000));
  for (const h of p) {
    assert.equal(h.contact, 'transversal');
    assert.equal(h.unique, true);
  }
});

// ---------------------------------------------------------------------------------------------
// Krawczyk tests (Lean: krawczyk_root_mem, krawczyk_excludes, contraction_injective2)

test('krawczyk_root_mem / krawczyk_excludes: krawczyk1 on G(t) = t² - 2', () => {
  // G'(T) = 2T; Gm = [G(m)] exact for dyadic m; y = 1 / G'(m).
  const K = (lo: number, hi: number): Interval => {
    const m = (lo + hi) / 2;
    const T = hullOf([lo, hi])!;
    return krawczyk1(T, m, hullOf([m * m - 2])!, hullOf([2 * lo, 2 * hi])!, 1 / (2 * m));
  };
  const k1 = K(1, 2);
  assert.ok(k1.lo <= Math.SQRT2 && Math.SQRT2 <= k1.hi, 'the root is in K(T)');
  assert.equal(ivIntersect(K(1.5, 2), hullOf([1.5, 2])!), undefined, 'no root in [1.5, 2]: excluded');
  assert.notEqual(ivIntersect(K(1.25, 1.5), hullOf([1.25, 1.5])!), undefined);
});

test('contraction_injective2: krawczykContracts accepts well-conditioned and rejects singular Jacobians', () => {
  const iv = (lo: number, hi: number) => hullOf([lo, hi])!;
  assert.equal(krawczykContracts([[iv(0.9, 1.1), iv(-0.1, 0.1)], [iv(-0.1, 0.1), iv(0.9, 1.1)]]), true);
  // Contains a singular matrix (the second column can equal the first): not injective.
  assert.equal(krawczykContracts([[iv(1, 1), iv(0.5, 1.5)], [iv(1, 1), iv(0.5, 1.5)]]), false);
  assert.equal(krawczykContracts([[iv(1, 1), iv(1, 1)], [iv(1, 1), iv(1, 1)]]), false);
  // 3×3 (curve/NURBS-surface system).
  assert.equal(
    krawczykContracts([
      [iv(1, 1), iv(0, 0.01), iv(0, 0)],
      [iv(0, 0), iv(1, 1.01), iv(0, 0.01)],
      [iv(0.01, 0.02), iv(0, 0), iv(2, 2)],
    ]),
    true,
  );
});

// ---------------------------------------------------------------------------------------------
// General curve / NURBS surface, and the ray helper

test('curve/NURBS surface: line and cubic against a NURBS plane, line against a NURBS sphere', () => {
  const plane = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Y, Z));
  const P = unwrap(createNurbsSurface3(unwrap(planeToNurbs(plane, { u: [-1, 1], v: [-1, 1] }))));
  const l = csPoints(cs(line(vec3(0, -1, 0.2), vec3(0.1, 1, 0), [0, 2]), P));
  assert.equal(l.length, 1);
  near(l[0]!.t, 1, 1e-12);
  // The cubic graph crosses y = 0 at its three roots.
  const A = graph(bernstein(rootsCubic));
  const a = csPoints(cs(A, P));
  assert.deepEqual(a.map((h) => Math.round(h.t * 1e9) / 1e9), [0.2, 0.5, 0.8]);
  assert.ok(a.every((h) => h.unique && h.class === 'certified'));
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const SN = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(S, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }))));
  const s = csPoints(cs(line(vec3(-2, 0.5, 0.1), X, [0, 4]), SN));
  assert.equal(s.length, 2);
  const x = Math.sqrt(1 - 0.25 - 0.01);
  near(s[0]!.t, 2 - x, 1e-9);
  near(s[1]!.t, 2 + x, 1e-9);
  // Also a NURBS curve against an analytic cylinder (certified one-parameter search).
  const cyl = unwrap(createCylinderSurface(kernel, vec3(0, 0, 0), Z, X, 0.5));
  const c = csPoints(cs(A, cyl));
  assert.equal(c.length, 1);
  near(Math.hypot(c[0]!.point.x, c[0]!.point.y), 0.5, 1e-9);
});

test('intersectRay: nearest hit first, inside origin, unbounded plane', () => {
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const r = csPoints(unwrap(intersectRay(kernel, vec3(-5, 0, 0), X, S)));
  assert.deepEqual(r.map((h) => h.t), [4, 6]);
  const inside = csPoints(unwrap(intersectRay(kernel, vec3(0, 0, 0), X, S)));
  assert.deepEqual(inside.map((h) => h.t), [1]);
  assert.equal(unwrap(intersectRay(kernel, vec3(-5, 0, 0), vec3(-1, 0, 0), S)).hits.length, 0);
  const pl = unwrap(createPlaneSurface(kernel, vec3(0, 0, 1), Z, X));
  assert.deepEqual(csPoints(unwrap(intersectRay(kernel, vec3(0, 0, -5), Z, pl))).map((h) => h.t), [6]);
  assert.deepEqual(csPoints(unwrap(intersectRay(kernel, vec3(0, 0, -5), Z, pl, 3))).map((h) => h.t), []);
  const T = unwrap(createTorusSurface(kernel, vec3(0, 0, 0), Z, X, 2, 1));
  assert.deepEqual(csPoints(unwrap(intersectRay(kernel, vec3(-4, 0, 0), X, T))).map((h) => Math.round(h.t * 1e9) / 1e9), [1, 3, 5, 7]);
});

// ---------------------------------------------------------------------------------------------
// Adversarial-review regressions (each failed before the fix it names).

/** The full unit circle as a closed rational quadratic NURBS (seam at (1, 0, 0), t ∈ [0, 1]). */
const nurbsCircle = (): NurbsCurve3 => {
  const w = Math.SQRT1_2;
  return unwrap(
    createNurbsCurve3(
      unwrap(
        createNurbsCurve(
          2,
          [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1],
          [[1, 0, 0], [1, 1, 0], [0, 1, 0], [-1, 1, 0], [-1, 0, 0], [-1, -1, 0], [0, -1, 0], [1, -1, 0], [1, 0, 0]],
          [1, w, 1, w, 1, w, 1, w, 1],
        ),
      ),
    ),
  );
};

/** Every overlap's two ranges describe the same point set: ends (and the middle) map onto each other. */
function checkOverlapMap(A: Curve3, B: Curve3, res: IntersectionResult<CurveCurveHit>): void {
  for (const h of res.hits) {
    if (h.kind !== 'overlap') continue;
    const [a0, a1] = h.rangeA, [b0, b1] = h.rangeB;
    const ends: [number, number][] = h.sameDirection ? [[a0, b0], [a1, b1]] : [[a0, b1], [a1, b0]];
    for (const [ta, tb] of ends) {
      const d = length3(sub3(unwrap(curvePoint3(A, ta)), unwrap(curvePoint3(B, tb))));
      assert.ok(d <= 4 * TOL, `overlap end maps: ${d}`);
    }
  }
}

test('line/quadric and line/circle: a tangent-band vertex beyond the range still reports the crossing in range', () => {
  // The line passes 0.5 tol inside the unit sphere / circle; its range stops before the vertex but
  // after the first root: the segment really pierces the surface once.
  const h = 1 - 0.5 * TOL;
  const L = line(vec3(-10, h, 0), X, [0, 10 - 1.5e-3]);
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const a = csPoints(cs(L, S));
  assert.equal(a.length, 1);
  assert.ok(a[0]!.deviation <= TOL && a[0]!.class === 'exact');
  const b = ccPoints(cc(L, circleZ(vec3(0, 0, 0), 1)));
  assert.equal(b.length, 1);
});

test('rays from far away (1e5..1e7): the quadratic is re-centred at the vertex, hits are kept', () => {
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const C = unwrap(createCylinderSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const xr = Math.sqrt(1 - 0.09);
  for (const d of [1e5, 1e6, 1e7]) {
    for (const surf of [S, C]) {
      const r = csPoints(unwrap(intersectRay(kernel, vec3(-d, 0.3, 0), X, surf)));
      assert.equal(r.length, 2, `distance ${d}`);
      near(r[0]!.t, d - xr, 1e-8 * d);
      assert.ok(r.every((x) => x.deviation <= TOL && x.contact === 'transversal'));
    }
  }
  // A far tangent ray is one tangent point.
  const t = csPoints(unwrap(intersectRay(kernel, vec3(-1e6, 1, 0), X, C)));
  assert.equal(t.length, 1);
  assert.equal(t[0]!.contact, 'tangent');
});

test('coincident circles with rotated frames: each overlap range on B maps onto its range on A', () => {
  const A = circleZ(vec3(0, 0, 0), 1);
  const B = unwrap(createCircleCurve(kernel, vec3(0, 0, 0), Z, vec3(Math.SQRT1_2, Math.SQRT1_2, 0), 1));
  const r = cc(A, B);
  assert.equal(r.hits.length, 2);
  assert.ok(r.hits.every((h) => h.kind === 'overlap' && h.sameDirection));
  checkOverlapMap(A, B, r);
  const Bm = unwrap(createCircleCurve(kernel, vec3(0, 0, 0), vec3(0, 0, -1), vec3(0, 1, 0), 1));
  const m = cc(A, Bm);
  assert.ok(m.hits.every((h) => h.kind === 'overlap' && !h.sameDirection));
  checkOverlapMap(A, Bm, m);
});

test('overlaps across the seam of a closed NURBS curve are split there, with correct ranges', () => {
  const N = nurbsCircle();
  const full = cc(N, circleZ(vec3(0, 0, 0), 1));
  assert.equal(full.hits.length, 1);
  const o = full.hits[0]!;
  assert.ok(o.kind === 'overlap');
  assert.ok(o.rangeB[1] - o.rangeB[0] > 6, 'B range is the full circle, not a point');
  checkOverlapMap(N, circleZ(vec3(0, 0, 0), 1), full);
  const arc = circleZ(vec3(0, 0, 0), 1, [-0.5, 0.5]);
  for (const [A, B] of [[arc, N], [N, arc]] as const) {
    const r = cc(A, B);
    assert.equal(r.hits.length, 2, 'split at the seam of the closed curve');
    checkOverlapMap(A, B, r);
  }
});

test('samePlaceOnCurve: a self-crossing curve keeps both branches through one point (no 3D-only merge)', () => {
  // A cubic loop crossing itself on y = 0 at t = (5 ± √15)/10 (≈ 0.1127, 0.8873).
  const loop = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], [[-1, -1, 0], [3, 3, 0], [3, -3, 0], [-1, 1, 0]], undefined))));
  const t1 = 0.5 - Math.sqrt(15) / 10, t2 = 0.5 + Math.sqrt(15) / 10;
  near(length3(sub3(unwrap(curvePoint3(loop, t1)), unwrap(curvePoint3(loop, t2)))), 0, 1e-12);
  assert.equal(unwrap(samePlaceOnCurve(loop, t1, t2, TOL)), false);
  assert.equal(unwrap(samePlaceOnCurve(loop, 0.3, 0.3 + 1e-9, TOL)), true);
  const N = nurbsCircle();
  assert.equal(unwrap(samePlaceOnCurve(N, 0, 1, TOL)), true, 'seam of a closed curve');
  const plane = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Y, X));
  const a = csPoints(cs(loop, plane));
  assert.deepEqual(a.map((h) => Math.round(h.t * 1e9) / 1e9), [t1, 0.5, t2].map((t) => Math.round(t * 1e9) / 1e9));
  const b = ccPoints(cc(loop, line(vec3(-2, 0, 0), X, [0, 6])));
  assert.equal(b.length, 3);
  const c = ccPoints(cc(line(vec3(-2, 0, 0), X, [0, 6]), loop));
  assert.equal(c.length, 3);
  // A closed curve crossing a plane at its seam is still one hit.
  assert.equal(csPoints(cs(N, plane)).length, 2);
});

test('axis_separation / centered_mem / centered_excludes / sphere_band: near-parallel pairs 2 tol apart are excluded, not refused', () => {
  const N = nurbsCircle();
  const t0 = performance.now();
  assert.equal(cc(N, circleZ(vec3(0, 0, 0), 1 + 2 * TOL)).hits.length, 0);
  const ln = (a: number[], b: number[]) => unwrap(createNurbsCurve3(unwrap(createNurbsCurve(1, [0, 0, 1, 1], [a, b], undefined))));
  assert.equal(cc(ln([0, 0, 0], [1, 1, 0]), ln([0, 2 * TOL, 0], [1, 1 + 2 * TOL, 0])).hits.length, 0);
  // centered_excludes / sphere_band: a circle 2 tol outside an analytic sphere.
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  assert.equal(cs(circleZ(vec3(0, 0, 0), 1 + 2 * TOL), S).hits.length, 0);
  assert.ok(performance.now() - t0 < 4000, 'fast');
});

test('axis_separation: no sampled contact of near-coincident arcs is missed (closed form, delegation, end contacts)', () => {
  // Random short arcs of two nearly coincident coplanar circles. Whenever dense sampling finds the
  // arcs within tol (with margin), the answer must report a contact; whenever it reports nothing,
  // sampling must agree. Exercises the near-coincident delegation, end contacts and the
  // mean-value exclusion of the general solver.
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let empty = 0, found = 0;
  for (let n = 0; n < 120; n++) {
    const c = vec3(rnd() * 1e-4, 0, 0), rB = 1 + (rnd() - 0.5) * 6 * TOL;
    const a0 = rnd() * 6, b0 = a0 + (rnd() - 0.5) * 0.02, w = 1e-3 + rnd() * 0.02;
    const A = circleZ(vec3(0, 0, 0), 1, [a0, a0 + w]);
    const B = unwrap(createCircleCurve(kernel, c, Z, X, rB, [b0, b0 + w]));
    const res = cc(A, B);
    let minD = Infinity;
    for (let i = 0; i <= 400; i++) {
      const p = unwrap(curvePoint3(A, a0 + (w * i) / 400));
      const q = unwrap(curvePoint3(B, clampAngle(Math.atan2(p.y - c.y, p.x - c.x), b0, b0 + w)));
      minD = Math.min(minD, length3(sub3(p, q)));
    }
    if (minD <= 0.9 * TOL) assert.ok(res.hits.length > 0, `missed a contact at ${minD} (case ${n})`);
    if (res.hits.length === 0) {
      empty++;
      assert.ok(minD > 0.99 * TOL, `excluded a contact: ${minD} (case ${n})`);
    } else found++;
  }
  assert.ok(empty > 0 && found > 0);
  // The primitive itself: along u, an enclosure above tol proves |X - Y| > tol.
  const diff = ivec3(hullOf([2 * TOL, 3 * TOL])!, hullOf([-1, 1])!, hullOf([0])!);
  assert.equal(separatedAlong(vec3(1, 0, 0), diff, [], TOL), true);
  assert.equal(separatedAlong(vec3(1, 1, 0), diff, [], TOL), false);
  assert.equal(separatedAlong(vec3(0, 0, 0), diff, [], TOL), false);
});

test('end contacts: arcs / segments meeting at a corner whose vertices differ by under tol are reported', () => {
  // Two arcs meeting at (0, 1) at a 20° corner; B's start is moved 0.6 tol off A's end, so the
  // exact crossing of the full circles lies ≈ 1.7 tol beyond A's range.
  const A = circleZ(vec3(0, 0, 0), 1, [0, Math.PI / 2]);
  const ang = (20 * Math.PI) / 180;
  const corner = vec3(0.6 * TOL * Math.cos(ang), 1 + 0.6 * TOL * Math.sin(ang), 0);
  const dir = vec3(-Math.cos(ang), Math.sin(ang), 0); // B leaves the corner into y > 1
  const cB = add3(corner, scale3(vec3(dir.y, -dir.x, 0), -1));
  const B = unwrap(createCircleCurve(kernel, cB, Z, X, 1, [Math.atan2(corner.y - cB.y, corner.x - cB.x), Math.atan2(corner.y - cB.y, corner.x - cB.x) + 1]));
  const r = ccPoints(cc(A, B));
  assert.equal(r.length, 1);
  near(r[0]!.tA, Math.PI / 2, 1e-4);
  // A segment ending 0.6 tol above a plane it meets at 10°: the end is a contact.
  const plane = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Z, X));
  const t10 = (10 * Math.PI) / 180;
  const seg = line(vec3(-Math.cos(t10), 0, Math.sin(t10) + 0.6 * TOL), vec3(Math.cos(t10), 0, -Math.sin(t10)), [0, 1]);
  const h = csPoints(cs(seg, plane));
  assert.equal(h.length, 1);
  assert.equal(h[0]!.t, 1);
  assert.equal(cs(seg, plane).class, 'certified');
  // The same segment a full 2 tol up has no contact.
  const far = line(vec3(-Math.cos(t10), 0, Math.sin(t10) + 2 * TOL), vec3(Math.cos(t10), 0, -Math.sin(t10)), [0, 1]);
  assert.equal(cs(far, plane).hits.length, 0);
});

/** `θ` moved by multiples of 2π into (or clamped to) `[lo, hi]`. */
function clampAngle(theta: number, lo: number, hi: number): number {
  let x = theta;
  while (x < lo) x += 2 * Math.PI;
  while (x > hi + 2 * Math.PI) x -= 2 * Math.PI;
  if (x > hi) x = x - hi < lo + 2 * Math.PI - x ? hi : lo;
  return Math.min(hi, Math.max(lo, x));
}

test('krawczyk3_row_mem: NURBS-sphere tangency is fast; a line through the poles crosses transversally', () => {
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  const SN = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(S, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }))));
  const t0 = performance.now();
  for (const dz of [0, 1e-9]) {
    const r = csPoints(cs(line(vec3(-2, 1 + dz, 0), X, [0, 4]), SN));
    assert.equal(r.length, 1);
    assert.equal(r[0]!.contact, 'tangent');
    near(r[0]!.t, 2, 1e-6);
  }
  assert.ok(performance.now() - t0 < 3000, `tangent NURBS sphere took ${performance.now() - t0} ms`);
  // crossesOver: the poles are degenerate (S_u = 0), so isolation fails, yet the line crosses.
  const p = csPoints(cs(line(vec3(0, 0, -2), Z, [0, 4]), SN));
  assert.deepEqual(p.map((h) => Math.round(h.t * 1e9) / 1e9), [1, 3]);
  assert.ok(p.every((h) => h.contact === 'transversal' && !h.unique));
});

test('crossesOver: opposite offsets at an angle cross; a touch and a flat inflection stay tangent', () => {
  const o = vec3(0, 0, 0);
  assert.equal(crossesOver(vec3(-1, -1, 0), vec3(-1, 0, 0), vec3(1, 1, 0), vec3(1, 0, 0), 0.01), true);
  assert.equal(crossesOver(vec3(-1, 1, 0), vec3(-1, 0, 0), vec3(1, 1, 0), vec3(1, 0, 0), 0.01), false);
  assert.equal(crossesOver(vec3(-1, -1e-5, 0), vec3(-1, 0, 0), vec3(1, 1e-5, 0), vec3(1, 0, 0), 0.01), false);
  assert.equal(crossesOver(o, o, vec3(1, 1, 0), vec3(1, 0, 0), 0.01), false);
  // y = x³ against the x-axis: an inflection tangency is reported as one tangent point.
  const cub = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], [[-1, -1, 0], [-1 / 3, 1, 0], [1 / 3, -1, 0], [1, 1, 0]], undefined))));
  const r = ccPoints(cc(cub, line(vec3(-2, 0, 0), X, [0, 4])));
  assert.equal(r.length, 1);
  assert.equal(r[0]!.contact, 'tangent');
});

test('precision exhausted is refused, not "no intersection"; a huge ray reach against a torus is clipped', () => {
  const S = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1));
  // From 1e150 away the hit point cannot be placed within tol by doubles.
  const far = intersectRay(kernel, vec3(-1e150, 0.1, 0.2), X, S);
  assert.equal(far.ok, false);
  if (!far.ok) assert.equal(refusalReason(far.error), 'precision exhausted');
  // maxT = 1e300 against a torus: four certified roots (the line is clipped to the torus's ball).
  const T = unwrap(createTorusSurface(kernel, vec3(0, 0, 0), Z, X, 2, 1));
  const r = csPoints(unwrap(intersectRay(kernel, vec3(-4, 0, 0), X, T, 1e300)));
  assert.deepEqual(r.map((h) => Math.round(h.t * 1e9) / 1e9), [1, 3, 5, 7]);
  // A line missing the torus's ball has no hits at all.
  assert.equal(unwrap(intersectCurveSurface(kernel, line(vec3(-4, 5, 0), X, [0, 8]), T)).hits.length, 0);
});

// ---------------------------------------------------------------------------------------------
// Adversarial review regressions.

test('circle/circle: a circle dipping tol/2 through the other plane still meets the other circle where it crosses', () => {
  // A (in the xz-plane) dips 0.5 tol below z = 0 and crosses it at x = ±√(2δ) ≈ ±3.2e-3; B lies in
  // z = 0 through the crossing x1, running along y there. The closed form's single tangent angle
  // (the lowest point of A) is 3e-3 from B; the real crossing must still be reported.
  const d = 0.5 * TOL;
  const A = unwrap(createCircleCurve(kernel, vec3(0, 0, 1 - d), Y, X, 1));
  const x1 = Math.sqrt(1 - (1 - d) ** 2);
  const B = unwrap(createCircleCurve(kernel, vec3(x1 + 1, 0, 0), Z, X, 1));
  const r = cc(A, B);
  const p = ccPoints(r);
  assert.equal(p.length, 1);
  near(p[0]!.point.x, x1, 1e-7);
  near(p[0]!.tB, Math.PI, 1e-6);
  const s = cc(B, A);
  assert.equal(ccPoints(s).length, 1);
});

test('precisionLimited: closed-form crossings beyond double precision are refused, not dropped', () => {
  // A circle of radius 1e12: sin(π)·1e12 ≈ 1.2e-4 > tol, so the crossing at angle π cannot be placed.
  const C = unwrap(createCircleCurve(kernel, vec3(0, 0, 0), Z, X, 1e12));
  const r = intersectCurves(kernel, C, line(vec3(-2e12, 0, 0), X, [0, 4e12]));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(refusalReason(r.error), 'precision exhausted');
  const P = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Y, X));
  const q = intersectCurveSurface(kernel, C, P);
  assert.equal(q.ok, false);
  if (!q.ok) assert.equal(refusalReason(q.error), 'precision exhausted');
  // Moderate scales are unaffected.
  assert.equal(ccPoints(cc(unwrap(createCircleCurve(kernel, vec3(0, 0, 0), Z, X, 1e3)), line(vec3(-2e3, 0, 0), X, [0, 4e3]))).length, 2);
});

test('line/line: an exact crossing within angTolDeg follows the tolerance band like the skew pair', () => {
  const e = 2 ** -30;
  const crossing = cc(line(vec3(0, 0, 0), X, [0, 1]), line(vec3(0, -e / 2, 0), vec3(1, e, 0), [0, 1]));
  const skew = cc(line(vec3(0, 0, 0), X, [0, 1]), line(vec3(0, -e / 2, 1e-7), vec3(1, e, 0), [0, 1]));
  assert.deepEqual(crossing.hits.map((h) => h.kind), ['overlap']);
  assert.deepEqual(skew.hits.map((h) => h.kind), ['overlap']);
  // A crossing at 10° is still one exact transversal point.
  const a = Math.tan((10 * Math.PI) / 180);
  const r = cc(line(vec3(0, 0, 0), X, [0, 1]), line(vec3(0, -a / 2, 0), vec3(1, a, 0), [0, 1]));
  assert.equal(r.class, 'exact');
  assert.deepEqual(r.hits.map((h) => (h.kind === 'point' ? h.contact : h.kind)), ['transversal']);
});

test('contacts at a curve end or a surface edge within tol are found by the subdivision solvers', () => {
  const nurbs2 = (pts: number[][]) => unwrap(createNurbsCurve3(unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], pts, undefined))));
  const B = nurbs2([[-1, 1, 0], [1, 1, 0], [3, 1, 0]]);
  for (const off of [1e-6, 9e-6]) {
    // A ends `off` short of B (Gauss–Newton with the end parameter held at its bound).
    const A = nurbs2([[0, 0, 0], [0.5, 0.2, 0.3], [1, 1 - off, 0]]);
    const p = ccPoints(cc(A, B));
    assert.equal(p.length, 1, `off ${off}`);
    near(p[0]!.tA, 1, 1e-12);
    near(p[0]!.deviation, off, 1e-9);
  }
  assert.equal(cc(nurbs2([[0, 0, 0], [0.5, 0.2, 0.3], [1, 1 - 1.1e-5, 0]]), B).hits.length, 0);
  // A NURBS plane over u ∈ [-1, 5]: a line crossing z = 0 just beside the edge x = 5, and a
  // line ending just below the plane, agree with the analytic plane / the distance.
  const pl = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Z, X));
  const np = unwrap(createNurbsSurface3(unwrap(planeToNurbs(pl, { u: [-1, 5], v: [-3, 3] }))));
  for (const off of [1e-6, 9e-6]) {
    const beside = csPoints(cs(line(vec3(5 + off, 0, -1), Z, [0, 2]), np));
    assert.equal(beside.length, 1);
    near(beside[0]!.deviation, off, 1e-9);
    const short = csPoints(cs(line(vec3(1, 0, -1), Z, [0, 1 - off]), np));
    assert.equal(short.length, 1);
    near(short[0]!.t, 1 - off, 1e-12);
  }
  assert.equal(cs(line(vec3(5 + 1.1e-5, 0, -1), Z, [0, 2]), np).hits.length, 0);
});

test('survivor_complete (3D): random cubics built through a known point always report it once', () => {
  let seed = 777;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const bez = (cp: number[][]) => unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], cp, undefined))));
  for (let trial = 0; trial < 24; trial++) {
    const A = bez(Array.from({ length: 4 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]));
    const ta = 0.1 + 0.8 * rnd();
    const P = unwrap(curvePoint3(A, ta));
    const cb = Array.from({ length: 4 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
    const mid = [0, 1, 2].map((j) => (cb[0]![j]! + 3 * cb[1]![j]! + 3 * cb[2]![j]! + cb[3]![j]!) / 8);
    const off = trial % 3 === 0 ? 1e-9 : 0;
    const target = [P.x, P.y, P.z + off];
    const B = bez(cb.map((c) => c.map((x, j) => x + target[j]! - mid[j]!)));
    const found = ccPoints(cc(A, B)).filter((h) => Math.abs(h.tA - ta) < 1e-4 && Math.abs(h.tB - 0.5) < 1e-4);
    assert.equal(found.length, 1, `trial ${trial}`);
  }
});

test('extendContactEnd: a curve wiggling inside the tolerance band of a plane is one overlap, not a point plus pieces', () => {
  const P = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), Z, X));
  for (const amp of [1.5e-5, 3e-5]) {
    // Control points alternate ±amp in z; the cubic stays within tol of z = 0 except near its ends.
    const n = 40;
    const knots = [0, 0, 0, 0, ...Array.from({ length: n - 4 }, (_, i) => (i + 1) / (n - 3)), 1, 1, 1, 1];
    const W = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, knots, Array.from({ length: n }, (_, i) => [i / (n - 1), 0, amp * (i % 2 ? 1 : -1)]), undefined))));
    const r = cs(W, P);
    assert.equal(r.hits.length, 1, `amp ${amp}`);
    const o = r.hits[0]!;
    assert.equal(o.kind, 'overlap');
    if (o.kind !== 'overlap') continue;
    // The overlap ends where the curve leaves the band (|z| = tol), found by dense sampling.
    let first = -1, last = -1;
    for (let i = 0; i <= 4000; i++) {
      if (Math.abs(unwrap(curvePoint3(W, i / 4000)).z) <= TOL) {
        if (first < 0) first = i / 4000;
        last = i / 4000;
      }
    }
    near(o.range[0], first, 1e-3);
    near(o.range[1], last, 1e-3);
  }
});

test('line/cone: a line along a generator through the apex is one overlap from the apex, never a spurious point', () => {
  // Cone R(v) = 1 + v (45°), apex at z = -1; the cone is one nappe (R >= 0).
  const Co = unwrap(createConeSurface(kernel, vec3(0, 0, 0), Z, X, 1, Math.PI / 4));
  const cases: readonly { d: Vec3; r: readonly [number, number]; want: readonly [number, number] }[] = [
    { d: vec3(1, 0, 1), r: [-3, 3], want: [-1, 3] },
    { d: vec3(1, 0, 1), r: [-3, 0.5], want: [-1, 0.5] },
    { d: vec3(-1, 0, -1), r: [-3, 3], want: [-3, 1] },
  ];
  for (const { d, r, want } of cases) {
    const res = unwrap(intersectCurveSurface(kernel, line(vec3(1, 0, 0), d, r), Co));
    assert.equal(res.hits.length, 1, JSON.stringify(r));
    const h = res.hits[0]!;
    assert.equal(h.kind, 'overlap');
    if (h.kind === 'overlap') {
      assert.ok(Math.abs(h.range[0] - want[0]) <= 1e-12 && Math.abs(h.range[1] - want[1]) <= 1e-12, JSON.stringify(h.range));
      assert.ok(h.deviation <= TOL);
    }
  }
  // Only the other nappe: nothing; ending at the apex: the apex point once.
  assert.equal(unwrap(intersectCurveSurface(kernel, line(vec3(1, 0, 0), vec3(1, 0, 1), [-3, -1.5]), Co)).hits.length, 0);
  const apex = unwrap(intersectCurveSurface(kernel, line(vec3(1, 0, 0), vec3(1, 0, 1), [-3, -1]), Co));
  assert.equal(apex.hits.length, 1);
  assert.ok(apex.hits[0]!.kind === 'point' && length3(sub3(apex.hits[0]!.point, vec3(0, 0, -1))) <= TOL);
  // A ray along the generator (the query's ray picking) sees the same overlap.
  const ray = unwrap(intersectRay(kernel, vec3(-2, 0, -3), vec3(1, 0, 1), Co, 10));
  assert.equal(ray.hits.length, 1);
  assert.ok(ray.hits[0]!.kind === 'overlap' && Math.abs(ray.hits[0]!.range[0] - 2) <= 1e-12);
});
