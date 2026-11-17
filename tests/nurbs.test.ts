import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import {
  basisFuns,
  clampedUniformKnots,
  createBSplineCurve,
  createNurbsCurve,
  curveDerivatives,
  curveDomain,
  deBoorPoint,
  deCasteljau,
  dersBasisFuns,
  evaluateCurve,
  evaluateCurveBasis,
  findSpan,
  insertKnot,
  isClamped,
  knotMultiplicity,
  refineKnots,
  subdivideBezier,
  validateKnots,
  type ControlPoint,
  type NurbsCurve,
} from '../src/nurbs/index.ts';

// Deterministic LCG (Numerical Recipes constants), values in [0, 1).
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A random clamped curve: degree 1..4, interior knots with multiplicity <= degree, optional weights. */
function randomCurve(rand: () => number, rational: boolean, dim = 3): NurbsCurve {
  const p = 1 + Math.floor(rand() * 4);
  const n = p + Math.floor(rand() * 6); // n + 1 control points
  const interior: number[] = [];
  const used = new Set<number>();
  while (interior.length < n - p) {
    const v = Math.round(rand() * 64) / 64 - 0.4921875; // distinct dyadic values in (-0.5, 1.5)
    if (used.has(v)) continue;
    used.add(v);
    const mult = 1 + Math.floor(rand() * p); // repeated knots up to the degree
    for (let m = 0; m < mult && interior.length < n - p; m++) interior.push(v);
  }
  interior.sort((a, b) => a - b);
  const knots = [...new Array<number>(p + 1).fill(-0.5), ...interior, ...new Array<number>(p + 1).fill(1.5)];
  const pts: number[][] = [];
  for (let i = 0; i <= n; i++) pts.push(Array.from({ length: dim }, () => rand() * 10 - 5));
  const weights = rational ? pts.map(() => 0.25 + rand() * 2) : undefined;
  return unwrap(createNurbsCurve(p, knots, pts, weights));
}

function params(curve: NurbsCurve, count: number): number[] {
  const [a, b] = curveDomain(curve);
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(a + ((b - a) * i) / count);
  for (const k of curve.knots) if (k >= a && k <= b) out.push(k);
  return out;
}

function close(actual: readonly number[], expected: readonly number[], tol: number, msg = ''): void {
  assert.equal(actual.length, expected.length, msg);
  for (let i = 0; i < actual.length; i++) {
    const d = Math.abs(actual[i]! - expected[i]!);
    assert.ok(d <= tol * Math.max(1, Math.abs(expected[i]!)), `${msg} coord ${i}: ${actual[i]} vs ${expected[i]}`);
  }
}

// ---------------------------------------------------------------- knots

test('validateKnots accepts clamped and unclamped vectors and rejects bad ones', () => {
  assert.ok(validateKnots([0, 0, 0, 1, 1, 1], 2, 3).ok);
  assert.ok(validateKnots([0, 1, 2, 3, 4, 5], 2, 3).ok); // unclamped, domain [2, 3]
  assert.ok(validateKnots([0, 0, 0, 0.5, 0.5, 1, 1, 1], 2, 5).ok);
  assert.equal(validateKnots([0, 0, 0, 1, 1], 2, 3).ok, false); // wrong length
  assert.equal(validateKnots([0, 0, 1, 0, 1, 1], 2, 3).ok, false); // decreasing
  assert.equal(validateKnots([0, 0, 0, NaN, 1, 1, 1], 2, 4).ok, false);
  assert.equal(validateKnots([0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1], 2, 6).ok, false); // interior mult 3 > p
  assert.equal(validateKnots([0, 0, 0, 0, 1, 1, 1], 2, 4).ok, false); // end mult 4 > p + 1
  assert.equal(validateKnots([1, 1, 1, 1, 1, 1], 2, 3).ok, false); // empty domain
  assert.equal(validateKnots([0, 0, 1, 1], 0, 3).ok, false); // degree 0 unsupported
  const v = unwrap(validateKnots([0, 0, 1, 1], 1, 2));
  assert.ok(Object.isFrozen(v));
});

test('findSpan is correct at interior knots and at the last knot', () => {
  const U = [0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 5]; // p = 2, n = 7 (Piegl & Tiller Ex. 2.3)
  const p = 2;
  assert.equal(findSpan(U, p, 0), 2);
  assert.equal(findSpan(U, p, 0.5), 2);
  assert.equal(findSpan(U, p, 1), 3);
  assert.equal(findSpan(U, p, 2.5), 4);
  assert.equal(findSpan(U, p, 4), 7);
  assert.equal(findSpan(U, p, 4.5), 7);
  assert.equal(findSpan(U, p, 5), 7); // u = last knot: last non-empty span
  // brute force: U[k] <= u < U[k+1] for every u strictly below the end
  for (let u = 0; u < 5; u += 0.125) {
    const k = findSpan(U, p, u);
    assert.ok(U[k]! <= u && u < U[k + 1]!, `u=${u}`);
  }
  assert.equal(knotMultiplicity(U, 4), 2);
  assert.equal(knotMultiplicity(U, 5), 3);
  assert.equal(knotMultiplicity(U, 2.5), 0);
  assert.ok(isClamped(U, p));
  assert.equal(isClamped([0, 1, 2, 3, 4, 5], 2), false);
});

test('clampedUniformKnots', () => {
  assert.deepEqual(unwrap(clampedUniformKnots(5, 2)), [0, 0, 0, 1 / 3, 2 / 3, 1, 1, 1]);
  assert.equal(clampedUniformKnots(2, 2).ok, false);
});

// ---------------------------------------------------------------- basis

test('basisFuns: partition of unity and non-negativity', () => {
  const rand = lcg(7);
  for (let trial = 0; trial < 40; trial++) {
    const c = randomCurve(rand, false);
    for (const u of params(c, 37)) {
      const k = findSpan(c.knots, c.degree, u);
      const N = basisFuns(c.knots, c.degree, k, u);
      assert.equal(N.length, c.degree + 1);
      let sum = 0;
      for (const v of N) {
        assert.ok(v >= -1e-15);
        sum += v;
      }
      assert.ok(Math.abs(sum - 1) < 1e-13, `sum ${sum}`);
    }
  }
});

test('basisFuns matches the NURBS Book example 2.3', () => {
  const U = [0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 5];
  const N = basisFuns(U, 2, 4, 2.5);
  close(N, [1 / 8, 6 / 8, 1 / 8], 1e-15);
});

test('dersBasisFuns: row 0 equals basisFuns, derivative rows sum to 0, match finite differences', () => {
  const rand = lcg(11);
  for (let trial = 0; trial < 30; trial++) {
    const c = randomCurve(rand, false);
    const p = c.degree;
    for (const u of params(c, 13)) {
      const k = findSpan(c.knots, p, u);
      const D = dersBasisFuns(c.knots, p, k, u, p + 1);
      close(D[0]!, basisFuns(c.knots, p, k, u), 1e-14);
      for (let r = 1; r <= p + 1; r++) {
        const s = D[r]!.reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(s) < 1e-8 * (1 + Math.max(...D[r]!.map(Math.abs))), `row ${r} sum ${s}`);
      }
      assert.ok(D[p + 1]!.every((v) => v === 0));
      // first derivative vs central difference within the same span
      const h = 1e-6;
      const a = c.knots[k]!, b = c.knots[k + 1]!;
      if (u - h > a && u + h < b) {
        const fp = basisFuns(c.knots, p, k, u + h), fm = basisFuns(c.knots, p, k, u - h);
        close(D[1]!, fp.map((v, j) => (v - fm[j]!) / (2 * h)), 1e-5);
      }
    }
  }
});

// ---------------------------------------------------------------- evaluation

test('de Boor evaluation agrees with basis-function evaluation (random curves, rational and not)', () => {
  const rand = lcg(12345);
  for (let trial = 0; trial < 60; trial++) {
    const c = randomCurve(rand, trial % 2 === 1);
    for (const u of params(c, 29)) {
      close(unwrap(evaluateCurve(c, u)), unwrap(evaluateCurveBasis(c, u)), 1e-12, `trial ${trial} u=${u}`);
    }
  }
});

test('clamped curves interpolate their end control points', () => {
  const rand = lcg(3);
  for (let trial = 0; trial < 20; trial++) {
    const c = randomCurve(rand, trial % 2 === 0);
    const [a, b] = curveDomain(c);
    close(unwrap(evaluateCurve(c, a)), c.controlPoints[0]!, 1e-13);
    close(unwrap(evaluateCurve(c, b)), c.controlPoints[c.controlPoints.length - 1]!, 1e-13);
  }
});

test('evaluation rejects parameters outside the domain', () => {
  const c = unwrap(createBSplineCurve(1, [0, 0, 1, 1], [[0], [1]]));
  assert.equal(evaluateCurve(c, 1.0000001).ok, false);
  assert.equal(evaluateCurve(c, NaN).ok, false);
  assert.equal(createNurbsCurve(1, [0, 0, 1, 1], [[0], [1]], [1, 0]).ok, false);
  assert.equal(createBSplineCurve(1, [0, 0, 1, 1], [[0], [1, 2]]).ok, false);
});

test('deBoor_const: constant control points give that constant (any degree)', () => {
  const rand = lcg(21);
  for (let trial = 0; trial < 30; trial++) {
    const shape = randomCurve(rand, false, 2);
    const cpt = [rand() * 4 - 2, rand() * 4 - 2];
    const c = unwrap(createBSplineCurve(shape.degree, shape.knots, shape.controlPoints.map(() => cpt)));
    for (const u of params(c, 17)) close(unwrap(evaluateCurve(c, u)), cpt, 1e-14);
  }
});

test('deBoor_affine and deBoor_add: evaluation commutes with affine maps of the control points', () => {
  const rand = lcg(22);
  for (let trial = 0; trial < 30; trial++) {
    const c = randomCurve(rand, false, 2);
    const other = unwrap(createBSplineCurve(c.degree, c.knots, c.controlPoints.map(() => [rand(), rand()])));
    const alpha = rand() * 6 - 3, beta = rand() * 6 - 3;
    const mapped = unwrap(createBSplineCurve(c.degree, c.knots, c.controlPoints.map((pt) => pt.map((x) => alpha * x + beta))));
    const summed = unwrap(
      createBSplineCurve(c.degree, c.knots, c.controlPoints.map((pt, i) => pt.map((x, j) => x + other.controlPoints[i]![j]!))),
    );
    for (const u of params(c, 17)) {
      const base = unwrap(evaluateCurve(c, u));
      close(unwrap(evaluateCurve(mapped, u)), base.map((x) => alpha * x + beta), 1e-12);
      const o = unwrap(evaluateCurve(other, u));
      close(unwrap(evaluateCurve(summed, u)), base.map((x, j) => x + o[j]!), 1e-12);
    }
  }
});

test('deBoor_between: the point lies in the bounding box of the p + 1 active control points', () => {
  const rand = lcg(23);
  for (let trial = 0; trial < 40; trial++) {
    const c = randomCurve(rand, false);
    const p = c.degree;
    for (const u of params(c, 23)) {
      const k = findSpan(c.knots, p, u);
      const pt = deBoorPoint(c.knots, p, c.controlPoints, k, u);
      for (let d = 0; d < c.dimension; d++) {
        const vals = c.controlPoints.slice(k - p, k + 1).map((q) => q[d]!);
        assert.ok(pt[d]! >= Math.min(...vals) - 1e-12 && pt[d]! <= Math.max(...vals) + 1e-12);
      }
    }
  }
});

test('rational quarter circle (weights 1, sqrt(2)/2, 1) lies on the unit circle', () => {
  const c = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[1, 0], [1, 1], [0, 1]], [1, Math.SQRT1_2, 1]));
  for (let i = 0; i <= 100; i++) {
    const [x, y] = unwrap(evaluateCurve(c, i / 100)) as [number, number];
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-14, `r=${Math.hypot(x, y)}`);
    assert.ok(x >= -1e-15 && y >= -1e-15);
    // tangent is perpendicular to the radius
    const [, t] = unwrap(curveDerivatives(c, i / 100, 1));
    assert.ok(Math.abs(t![0]! * x + t![1]! * y) < 1e-12);
  }
  close(unwrap(evaluateCurve(c, 0.5)), [Math.SQRT1_2, Math.SQRT1_2], 1e-15);
});

// ---------------------------------------------------------------- derivatives

test('curve derivatives match finite differences (polynomial and rational)', () => {
  const rand = lcg(31);
  let checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    const c = randomCurve(rand, trial % 2 === 1);
    const p = c.degree;
    for (const u of params(c, 19)) {
      const k = findSpan(c.knots, p, u);
      const a = c.knots[k]!, b = c.knots[k + 1]!;
      const h = 1e-5;
      if (!(u - 2 * h > a && u + 2 * h < b)) continue; // stay inside one span (derivatives may jump at knots)
      const D = unwrap(curveDerivatives(c, u, 2));
      close(D[0]!, unwrap(evaluateCurve(c, u)), 1e-12);
      const fp = unwrap(evaluateCurve(c, u + h)), fm = unwrap(evaluateCurve(c, u - h)), f0 = D[0]!;
      const scale = Math.max(1, ...D[1]!.map(Math.abs));
      close(D[1]!.map((v) => v / scale), fp.map((v, j) => (v - fm[j]!) / (2 * h) / scale), 1e-6, `d1 trial ${trial}`);
      const scale2 = Math.max(1, ...D[2]!.map(Math.abs));
      close(
        D[2]!.map((v) => v / scale2),
        fp.map((v, j) => (v - 2 * f0[j]! + fm[j]!) / (h * h) / scale2),
        1e-3,
        `d2 trial ${trial}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 200, `only ${checked} samples`);
});

test('polynomial derivatives (A3.2 + de Boor) agree with dersBasisFuns (A3.1)', () => {
  const rand = lcg(32);
  for (let trial = 0; trial < 30; trial++) {
    const c = randomCurve(rand, false);
    const p = c.degree;
    for (const u of params(c, 11)) {
      const k = findSpan(c.knots, p, u);
      const D = unwrap(curveDerivatives(c, u, p + 1));
      const B = dersBasisFuns(c.knots, p, k, u, p + 1);
      for (let r = 0; r <= p + 1; r++) {
        const expected = new Array<number>(c.dimension).fill(0);
        for (let j = 0; j <= p; j++) {
          const pt = c.controlPoints[k - p + j]!;
          for (let d = 0; d < c.dimension; d++) expected[d] = expected[d]! + B[r]![j]! * pt[d]!;
        }
        const scale = Math.max(1, ...expected.map(Math.abs));
        close(D[r]!.map((v) => v / scale), expected.map((v) => v / scale), 1e-10, `r=${r}`);
      }
    }
  }
});

// ---------------------------------------------------------------- knot insertion

test('knot insertion preserves the curve at many parameters (within 1e-12)', () => {
  const rand = lcg(41);
  let checked = 0;
  for (let trial = 0; trial < 60; trial++) {
    const c = randomCurve(rand, trial % 3 === 0);
    const [a, b] = curveDomain(c);
    const u = a + (b - a) * rand();
    const s = knotMultiplicity(c.knots, u);
    const times = Math.max(1, Math.min(c.degree - s, 1 + Math.floor(rand() * c.degree)));
    if (s + times > c.degree) continue;
    const q = unwrap(insertKnot(c, u, times));
    assert.equal(q.controlPoints.length, c.controlPoints.length + times);
    assert.equal(knotMultiplicity(q.knots, u), s + times);
    for (const t of params(c, 41)) {
      close(unwrap(evaluateCurve(q, t)), unwrap(evaluateCurve(c, t)), 1e-12, `trial ${trial} t=${t}`);
    }
    checked++;
  }
  assert.ok(checked > 40, `only ${checked} insertions`);
});

test('knot insertion at an existing knot and refinement', () => {
  const c = unwrap(createBSplineCurve(3, [0, 0, 0, 0, 0.5, 1, 1, 1, 1], [[0, 0], [1, 2], [2, -1], [3, 3], [4, 0]]));
  const once = unwrap(insertKnot(c, 0.5));
  assert.equal(knotMultiplicity(once.knots, 0.5), 2);
  const twice = unwrap(insertKnot(once, 0.5, 1));
  assert.equal(knotMultiplicity(twice.knots, 0.5), 3);
  // multiplicity p: the curve passes through a control point at u = 0.5
  const mid = unwrap(evaluateCurve(c, 0.5));
  assert.ok(twice.controlPoints.some((pt) => Math.abs(pt[0]! - mid[0]!) < 1e-12 && Math.abs(pt[1]! - mid[1]!) < 1e-12));
  assert.equal(insertKnot(twice, 0.5).ok, false); // would exceed the degree
  assert.equal(insertKnot(c, 1).ok, false); // domain end
  assert.equal(insertKnot(c, -0.1).ok, false);
  const refined = unwrap(refineKnots(c, [0.1, 0.2, 0.3, 0.7, 0.9]));
  assert.equal(refined.controlPoints.length, c.controlPoints.length + 5);
  for (const t of params(c, 50)) close(unwrap(evaluateCurve(refined, t)), unwrap(evaluateCurve(c, t)), 1e-12);
  assert.equal(refineKnots(c, [0.1, 2]).ok, false);
});

test('insAlpha_mem_unit / insertedPts_between: single insertion makes convex combinations of neighbours', () => {
  const rand = lcg(42);
  for (let trial = 0; trial < 60; trial++) {
    const c = randomCurve(rand, false);
    const [a, b] = curveDomain(c);
    const u = a + (b - a) * rand();
    if (knotMultiplicity(c.knots, u) + 1 > c.degree) continue;
    const q = unwrap(insertKnot(c, u));
    const P = c.controlPoints;
    for (let i = 1; i < q.controlPoints.length - 1; i++) {
      const Q = q.controlPoints[i]!;
      for (let d = 0; d < c.dimension; d++) {
        const lo = Math.min(P[i - 1]![d]!, P[i]![d]!), hi = Math.max(P[i - 1]![d]!, P[i]![d]!);
        assert.ok(Q[d]! >= lo - 1e-12 && Q[d]! <= hi + 1e-12, `trial ${trial} i=${i}`);
      }
    }
    assert.deepEqual(q.controlPoints[0], P[0]);
    assert.deepEqual(q.controlPoints[q.controlPoints.length - 1], P[P.length - 1]);
  }
});

test('insert_preserves_point_at_inserted_param (degrees 1..4)', () => {
  const rand = lcg(43);
  let checked = 0;
  for (let trial = 0; trial < 80; trial++) {
    const c = randomCurve(rand, false);
    const [a, b] = curveDomain(c);
    const u = a + (b - a) * rand();
    if (knotMultiplicity(c.knots, u) + 1 > c.degree) continue;
    const q = unwrap(insertKnot(c, u));
    close(unwrap(evaluateCurve(q, u)), unwrap(evaluateCurve(c, u)), 1e-13);
    checked++;
  }
  assert.ok(checked > 60, `only ${checked} insertions`);
});

// ---------------------------------------------------------------- Bezier

test('casteljau_zero / casteljau_one / bezier_endpoints and casteljau_const', () => {
  const pts: ControlPoint[] = [[0, 1], [2, 5], [-1, 3], [4, 4]];
  assert.deepEqual(unwrap(deCasteljau(pts, 0)), [0, 1]);
  assert.deepEqual(unwrap(deCasteljau(pts, 1)), [4, 4]);
  for (let i = 0; i <= 10; i++) close(unwrap(deCasteljau([[3, -2], [3, -2], [3, -2]], i / 10)), [3, -2], 1e-15);
  assert.equal(deCasteljau(pts, 1.5).ok, false);
  assert.equal(deCasteljau([], 0.5).ok, false);
});

test('subdivide_endpoints and subdivision reproduces the segment', () => {
  const rand = lcg(51);
  for (let trial = 0; trial < 30; trial++) {
    const p = 1 + Math.floor(rand() * 5);
    const pts: number[][] = Array.from({ length: p + 1 }, () => [rand() * 4, rand() * 4, rand() * 4]);
    const t = rand();
    const { left, right } = unwrap(subdivideBezier(pts, t));
    assert.deepEqual(left[0], pts[0]);
    assert.deepEqual(right[p], pts[p]);
    assert.deepEqual(left[p], right[0]);
    assert.deepEqual(left[p], unwrap(deCasteljau(pts, t)));
    for (let i = 0; i <= 10; i++) {
      const tau = i / 10;
      close(unwrap(deCasteljau(left, tau)), unwrap(deCasteljau(pts, t * tau)), 1e-12);
      close(unwrap(deCasteljau(right, tau)), unwrap(deCasteljau(pts, t + (1 - t) * tau)), 1e-12);
    }
  }
});

test('deBoor_eq_casteljau: on Bezier knots de Boor and de Casteljau compute the same numbers', () => {
  const rand = lcg(52);
  for (let trial = 0; trial < 30; trial++) {
    const p = 1 + Math.floor(rand() * 6);
    const pts: number[][] = Array.from({ length: p + 1 }, () => [rand() * 4 - 2, rand() * 4 - 2]);
    const knots = [...new Array<number>(p + 1).fill(0), ...new Array<number>(p + 1).fill(1)];
    const c = unwrap(createBSplineCurve(p, knots, pts));
    for (let i = 0; i <= 16; i++) {
      const t = i / 16 + (i < 16 ? rand() / 32 : 0);
      // identical affine combinations in identical order: bitwise equality
      assert.deepEqual(unwrap(evaluateCurve(c, t)), unwrap(deCasteljau(pts, t)));
    }
  }
});

test('returned curves are frozen', () => {
  const c = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0], [1, 1]], [1, 2]));
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.knots) && Object.isFrozen(c.controlPoints));
  assert.ok(Object.isFrozen(c.controlPoints[0]) && Object.isFrozen(c.weights));
  const q = unwrap(insertKnot(c, 0.5));
  assert.ok(Object.isFrozen(q) && q.weights !== undefined);
  close(unwrap(evaluateCurve(q, 0.25)), unwrap(evaluateCurve(c, 0.25)), 1e-15);
});

// ---------------------------------------------------------------- adversarial review regressions

test('validateKnots rejects knot ranges that overflow and subnormal-scale gaps', () => {
  // U[m] - U[0] = Infinity would make every de Boor weight 0 (silently wrong points).
  assert.equal(validateKnots([-1.7e308, -1.7e308, 1.7e308, 1.7e308], 1, 2).ok, false);
  assert.equal(createBSplineCurve(1, [-1.7e308, -1.7e308, 1.7e308, 1.7e308], [[0], [1]]).ok, false);
  // a gap of 5e-324 has an infinite reciprocal: basis functions would be NaN.
  assert.equal(validateKnots([0, 0, 0, 5e-324, 1e-323, 1e-323, 1e-323], 2, 4).ok, false);
  // large but representable ranges and small normal gaps are fine
  assert.ok(validateKnots([-1e307, -1e307, 1e307, 1e307], 1, 2).ok);
  assert.ok(validateKnots([0, 0, 1e-300, 1e-300], 1, 2).ok);
});

test('rational curves never return non-finite points', () => {
  // w * x overflows: rejected at construction
  assert.equal(createNurbsCurve(1, [0, 0, 1, 1], [[1e300], [1]], [1e10, 1]).ok, false);
  // weights that underflow to 0 when combined: an error, not NaN
  const tiny = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[1], [1]], [5e-324, 5e-324]));
  const r = evaluateCurve(tiny, 0.5);
  assert.equal(r.ok, false);
  assert.equal(evaluateCurveBasis(tiny, 0.5).ok, false);
  assert.equal(curveDerivatives(tiny, 0.5, 1).ok, false);
  // end points are still exact (weight not combined)
  assert.deepEqual(unwrap(evaluateCurve(tiny, 0)), [1]);
});

test('polynomial overflow is reported, not returned as Infinity', () => {
  const c = unwrap(createBSplineCurve(2, [0, 0, 0, 1e-300, 1e-300, 1e-300], [[-1e300], [1e300], [-1e300]]));
  const d = curveDerivatives(c, 5e-301, 2);
  assert.equal(d.ok, false);
  assert.ok(evaluateCurve(c, 5e-301).ok);
});

test('dersBasisFuns never throws on a bad order', () => {
  const U = [0, 0, 0, 1, 2, 2, 2];
  assert.equal(dersBasisFuns(U, 2, 2, 0.5, -1).length, 1);
  assert.equal(dersBasisFuns(U, 2, 2, 0.5, NaN).length, 1);
  assert.equal(dersBasisFuns(U, 2, 2, 0.5, 1.7).length, 2);
});

test('unclamped curves: evaluation agrees, insertion (incl. at the domain start) preserves the curve', () => {
  const U = [0, 1, 2, 3, 4, 5, 6, 7]; // p = 3, domain [3, 4]
  const c = unwrap(createNurbsCurve(3, U, [[0, 0], [1, 2], [3, 1], [4, 4]], [1, 2, 0.5, 1]));
  assert.equal(isClamped(c.knots, 3), false);
  for (const u of [3, 3.1, 3.5, 3.999, 4]) close(unwrap(evaluateCurve(c, u)), unwrap(evaluateCurveBasis(c, u)), 1e-13);
  for (const [u, times] of [[3, 1], [3, 2], [3.25, 2], [3.75, 3]] as const) {
    const q = unwrap(insertKnot(c, u, times));
    assert.deepEqual(curveDomain(q), [3, 4]);
    for (let i = 0; i <= 40; i++) {
      const t = 3 + i / 40;
      close(unwrap(evaluateCurve(q, t)), unwrap(evaluateCurve(c, t)), 1e-12, `u=${u} times=${times} t=${t}`);
    }
  }
  assert.equal(insertKnot(c, 3, 3).ok, false); // U[3] = 3 already has multiplicity 1
});

test('insertedPts_eq_prev_of_knot_eq: at an existing knot of multiplicity s, A5.1 copies P[i-1] for i = k-s+1..k', () => {
  // p = 3, u = 0.5 has multiplicity s = 2 at indices 4, 5 (span k = 5).
  const P: number[][] = [[0], [1], [5], [2], [7], [3], [9]];
  const c = unwrap(createBSplineCurve(3, [0, 0, 0, 0, 0.5, 0.5, 1, 1, 1, 1], P.slice(0, 6)));
  const k = findSpan(c.knots, 3, 0.5);
  assert.equal(k, 5);
  const q = unwrap(insertKnot(c, 0.5));
  // Q[i] = P[i] for i <= k-p = 2, Q[i] = P[i-1] for i >= k-s+1 = 4; only Q[3] is computed
  for (let i = 0; i <= 2; i++) assert.deepEqual(q.controlPoints[i], c.controlPoints[i]);
  for (let i = 4; i <= 6; i++) assert.deepEqual(q.controlPoints[i], c.controlPoints[i - 1]);
  // i = k-s = 3 is the only new point: a_3 = (0.5 - U[3]) / (U[6] - U[3]) = 0.5
  close(q.controlPoints[3]!, [0.5 * c.controlPoints[3]![0]! + 0.5 * c.controlPoints[2]![0]!], 1e-15);
});

test('-0 and the domain start/end are handled exactly', () => {
  const c = unwrap(createBSplineCurve(2, [-0, -0, -0, 0.5, 1, 1, 1], [[0], [1], [2], [3]]));
  assert.deepEqual(unwrap(evaluateCurve(c, 0)), [0]);
  assert.deepEqual(unwrap(evaluateCurve(c, -0)), [0]);
  assert.deepEqual(unwrap(evaluateCurve(c, 1)), [3]);
  assert.equal(insertKnot(c, 0).ok, false); // multiplicity already p + 1
  assert.equal(findSpan(c.knots, 2, 1), 3);
  assert.equal(findSpan(c.knots, 2, -0), 2);
});
