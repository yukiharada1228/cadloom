import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import {
  createNurbsCurve,
  curveDerivatives,
  curveDomain,
  deBoorPoint,
  deCasteljau,
  evaluateCurve,
  findSpan,
  knotMultiplicity,
  type ControlPoint,
  type NurbsCurve,
} from '../src/nurbs/index.ts';
import {
  createBSplineSurface,
  createNurbsSurface,
  elevateBezier,
  elevateCurveDegree,
  elevateSurfaceDegree,
  elevationMatrix,
  evaluateSurface,
  evaluateSurfaceBasis,
  homogeneousNet,
  insertKnotSurface,
  isoparametricCurve,
  isRationalSurface,
  refineKnotsSurface,
  directionCurves,
  surfaceFromDirectionCurves,
  MAX_DERIVATIVE_ORDER,
  surfaceDerivatives,
  surfaceDomain,
  surfaceNormal,
  type NurbsSurface,
} from '../src/nurbs/index.ts';

const kernel = createKernel();

// Deterministic LCG (Numerical Recipes constants), values in [0, 1).
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Clamped knots on [0, 1] with `count` control points, interior multiplicity <= maxMult (dyadic values). */
function randomClampedKnots(rand: () => number, p: number, count: number, maxMult: number): number[] {
  const interior: number[] = [];
  const used = new Set<number>();
  while (interior.length < count - p - 1) {
    const v = Math.round(rand() * 64) / 64;
    if (v <= 0 || v >= 1 || used.has(v)) continue;
    used.add(v);
    const mult = 1 + Math.floor(rand() * maxMult);
    for (let m = 0; m < mult && interior.length < count - p - 1; m++) interior.push(v);
  }
  interior.sort((a, b) => a - b);
  return [...new Array<number>(p + 1).fill(0), ...interior, ...new Array<number>(p + 1).fill(1)];
}

/** Unclamped uniform knots 0, 1, 2, ... (domain [p, count]). */
function uniformKnots(p: number, count: number): number[] {
  return Array.from({ length: count + p + 1 }, (_, i) => i);
}

interface SurfaceOptions {
  readonly rational: boolean;
  readonly dim?: number;
  readonly simpleKnots?: boolean;
  readonly unclamped?: boolean;
}

function randomSurface(rand: () => number, opts: SurfaceOptions): NurbsSurface {
  const dim = opts.dim ?? 3;
  const p = 1 + Math.floor(rand() * 3);
  const q = 1 + Math.floor(rand() * 3);
  const nu = p + 1 + Math.floor(rand() * 4);
  const nv = q + 1 + Math.floor(rand() * 4);
  const ku = opts.unclamped ? uniformKnots(p, nu) : randomClampedKnots(rand, p, nu, opts.simpleKnots ? 1 : p);
  const kv = opts.unclamped ? uniformKnots(q, nv) : randomClampedKnots(rand, q, nv, opts.simpleKnots ? 1 : q);
  const net: number[][][] = [];
  for (let i = 0; i < nu; i++) {
    const row: number[][] = [];
    for (let j = 0; j < nv; j++) row.push(Array.from({ length: dim }, () => rand() * 10 - 5));
    net.push(row);
  }
  const weights = opts.rational ? net.map((row) => row.map(() => 0.25 + rand() * 2)) : undefined;
  return unwrap(createNurbsSurface(p, q, ku, kv, net, weights));
}

function grid(s: NurbsSurface, count: number): [number, number][] {
  const d = surfaceDomain(s);
  const out: [number, number][] = [];
  for (let a = 0; a <= count; a++) {
    for (let b = 0; b <= count; b++) {
      out.push([d.u[0] + ((d.u[1] - d.u[0]) * a) / count, d.v[0] + ((d.v[1] - d.v[0]) * b) / count]);
    }
  }
  // Also every knot pair inside the domain.
  for (const u of s.knotsU) for (const v of s.knotsV) {
    if (u >= d.u[0] && u <= d.u[1] && v >= d.v[0] && v <= d.v[1]) out.push([u, v]);
  }
  return out;
}

function close(a: readonly number[], b: readonly number[], tol: number, msg?: string): void {
  assert.equal(a.length, b.length, msg);
  for (let i = 0; i < a.length; i++) {
    const scale = Math.max(1, Math.abs(a[i]!), Math.abs(b[i]!));
    assert.ok(Math.abs(a[i]! - b[i]!) <= tol * scale, `${msg ?? ''} [${i}]: ${a[i]} vs ${b[i]}`);
  }
}

const CASES: readonly SurfaceOptions[] = [
  { rational: false },
  { rational: true },
  { rational: false, unclamped: true },
  { rational: true, unclamped: true },
];

// ---------------------------------------------------------------------------------------------
// Construction

test('createNurbsSurface validates the net, knots and weights and freezes the result', () => {
  const ku = [0, 0, 1, 1];
  const kv = [0, 0, 0, 1, 1, 1];
  const net = [
    [[0, 0, 0], [0, 1, 0], [0, 2, 0]],
    [[1, 0, 0], [1, 1, 1], [1, 2, 0]],
  ];
  const s = unwrap(createNurbsSurface(1, 2, ku, kv, net));
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.controlPoints) && Object.isFrozen(s.controlPoints[0]![0]));
  assert.equal(s.dimension, 3);
  assert.equal(isRationalSurface(s), false);
  assert.deepEqual(surfaceDomain(s), { u: [0, 1], v: [0, 1] });
  assert.equal(createNurbsSurface(1, 2, ku, kv, []).ok, false);
  assert.equal(createNurbsSurface(1, 2, ku, kv, [net[0]!, net[1]!.slice(0, 2)]).ok, false); // ragged
  assert.equal(createNurbsSurface(1, 2, ku, kv, [net[0]!, [[1, 0], [1, 1, 1], [1, 2, 0]]]).ok, false); // dimension
  assert.equal(createNurbsSurface(1, 2, ku, kv, [net[0]!, [[1, 0, NaN], [1, 1, 1], [1, 2, 0]]]).ok, false);
  assert.equal(createNurbsSurface(1, 2, [0, 0, 1], kv, net).ok, false); // knot count
  assert.equal(createNurbsSurface(2, 2, ku, kv, net).ok, false); // too few rows for degree 2
  assert.equal(createNurbsSurface(1, 2, ku, kv, net, [[1, 1, 1]]).ok, false);
  assert.equal(createNurbsSurface(1, 2, ku, kv, net, [[1, 1, 1], [1, 0, 1]]).ok, false);
  assert.equal(createNurbsSurface(1, 2, ku, kv, net, [[1, 1, 1], [1, 1]]).ok, false);
  assert.equal(createNurbsSurface(1, 2, ku, kv, net, [[1, 1, 1], [1, Infinity, 1]]).ok, false);
  const r = unwrap(createNurbsSurface(1, 2, ku, kv, net, [[1, 2, 1], [1, 1, 3]]));
  assert.ok(isRationalSurface(r) && Object.isFrozen(r.weights) && Object.isFrozen(r.weights![1]));
  assert.deepEqual(homogeneousNet(r)[1]![2], [3, 6, 0, 3]);
  assert.equal(createBSplineSurface(1, 2, ku, kv, net).ok, true);
});

test('evaluation rejects parameters outside the domain and non-finite parameters', () => {
  const s = randomSurface(lcg(1), { rational: false });
  for (const [u, v] of [[-0.1, 0.5], [0.5, 1.1], [NaN, 0.5], [0.5, Infinity]] as const) {
    assert.equal(evaluateSurface(s, u, v).ok, false);
    assert.equal(evaluateSurfaceBasis(s, u, v).ok, false);
    assert.equal(surfaceDerivatives(s, u, v, 1).ok, false);
  }
  assert.equal(surfaceDerivatives(s, 0.5, 0.5, -1).ok, false);
  assert.equal(surfaceDerivatives(s, 0.5, 0.5, 1.5).ok, false);
  assert.equal(isoparametricCurve(s, 'u', 2).ok, false);
  assert.equal(isoparametricCurve(s, 'w' as 'u', 0.5).ok, false);
});

// ---------------------------------------------------------------------------------------------
// Evaluation

test('tensor-product de Boor agrees with basis-function evaluation (A3.5 / A4.3)', () => {
  const rand = lcg(2024);
  for (const opts of CASES) {
    for (let trial = 0; trial < 25; trial++) {
      const s = randomSurface(rand, opts);
      for (const [u, v] of grid(s, 6)) {
        const a = unwrap(evaluateSurface(s, u, v));
        const b = unwrap(evaluateSurfaceBasis(s, u, v));
        assert.ok(Object.isFrozen(a));
        close(a, b, 1e-12, `(${u}, ${v})`);
      }
    }
  }
});

test('tensor_comm: columns-then-row equals rows-then-column de Boor', () => {
  const rand = lcg(77);
  for (const opts of CASES) {
    for (let trial = 0; trial < 15; trial++) {
      const s = randomSurface(rand, opts);
      const Pw = homogeneousNet(s);
      for (const [u, v] of grid(s, 5)) {
        const su = findSpan(s.knotsU, s.degreeU, u);
        const sv = findSpan(s.knotsV, s.degreeV, v);
        const R = Pw.map((row) => deBoorPoint(s.knotsV, s.degreeV, row, sv, v));
        const h = deBoorPoint(s.knotsU, s.degreeU, R, su, u);
        const e = s.weights === undefined ? h : h.slice(0, s.dimension).map((c) => c / h[s.dimension]!);
        close(unwrap(evaluateSurface(s, u, v)), e, 1e-12);
      }
    }
  }
});

test('tensor_const: a constant net reproduces the constant (partition of unity)', () => {
  const rand = lcg(5);
  for (const opts of CASES) {
    for (let trial = 0; trial < 10; trial++) {
      const t = randomSurface(rand, opts);
      const net = t.controlPoints.map((row) => row.map(() => [1.25, -3, 7]));
      const s = unwrap(createNurbsSurface(t.degreeU, t.degreeV, t.knotsU, t.knotsV, net, t.weights));
      for (const [u, v] of grid(s, 5)) {
        close(unwrap(evaluateSurface(s, u, v)), [1.25, -3, 7], 1e-13);
        close(unwrap(evaluateSurfaceBasis(s, u, v)), [1.25, -3, 7], 1e-13);
      }
    }
  }
});

test('tensor_affine: evaluating the affinely mapped net is the affine map of the surface', () => {
  const rand = lcg(6);
  const M = [
    [0.5, -1, 2, 3],
    [1, 0.25, 0, -2],
    [-0.75, 2, 1, 0.5],
  ];
  const apply = (pt: readonly number[]): number[] => M.map((r) => r[0]! * pt[0]! + r[1]! * pt[1]! + r[2]! * pt[2]! + r[3]!);
  for (const opts of CASES) {
    for (let trial = 0; trial < 10; trial++) {
      const s = randomSurface(rand, opts);
      const net = s.controlPoints.map((row) => row.map(apply));
      const t = unwrap(createNurbsSurface(s.degreeU, s.degreeV, s.knotsU, s.knotsV, net, s.weights));
      for (const [u, v] of grid(s, 5)) close(unwrap(evaluateSurface(t, u, v)), apply(unwrap(evaluateSurface(s, u, v))), 1e-12);
    }
  }
});

test('tensor_row_only / tensor_col_only / tensor_product: separable nets give curves and products', () => {
  const rand = lcg(8);
  for (let trial = 0; trial < 20; trial++) {
    const t = randomSurface(rand, { rational: false, dim: 1, unclamped: trial % 2 === 0 });
    const A = t.controlPoints.map(() => rand() * 4 - 2);
    const B = t.controlPoints[0]!.map(() => rand() * 4 - 2);
    const mk = (f: (i: number, j: number) => number): NurbsSurface =>
      unwrap(createNurbsSurface(t.degreeU, t.degreeV, t.knotsU, t.knotsV, A.map((_, i) => B.map((__, j) => [f(i, j)]))));
    const rowOnly = mk((i) => A[i]!);
    const colOnly = mk((_, j) => B[j]!);
    const prod = mk((i, j) => A[i]! * B[j]!);
    const cu = unwrap(createNurbsCurve(t.degreeU, t.knotsU, A.map((a) => [a])));
    const cv = unwrap(createNurbsCurve(t.degreeV, t.knotsV, B.map((b) => [b])));
    for (const [u, v] of grid(t, 5)) {
      const a = unwrap(evaluateCurve(cu, u))[0]!;
      const b = unwrap(evaluateCurve(cv, v))[0]!;
      close(unwrap(evaluateSurface(rowOnly, u, v)), [a], 1e-12, 'tensor_row_only');
      close(unwrap(evaluateSurface(colOnly, u, v)), [b], 1e-12, 'tensor_col_only');
      close(unwrap(evaluateSurface(prod, u, v)), [a * b], 1e-12, 'tensor_product');
    }
  }
});

test('tensor_between: every surface point lies in the bounding box of its (p+1)x(q+1) window', () => {
  const rand = lcg(9);
  for (const opts of [CASES[0]!, CASES[2]!]) {
    for (let trial = 0; trial < 15; trial++) {
      const s = randomSurface(rand, opts);
      for (const [u, v] of grid(s, 6)) {
        const su = findSpan(s.knotsU, s.degreeU, u);
        const sv = findSpan(s.knotsV, s.degreeV, v);
        const pt = unwrap(evaluateSurface(s, u, v));
        for (let c = 0; c < 3; c++) {
          let lo = Infinity;
          let hi = -Infinity;
          for (let i = su - s.degreeU; i <= su; i++) {
            for (let j = sv - s.degreeV; j <= sv; j++) {
              lo = Math.min(lo, s.controlPoints[i]![j]![c]!);
              hi = Math.max(hi, s.controlPoints[i]![j]![c]!);
            }
          }
          assert.ok(pt[c]! >= lo - 1e-12 && pt[c]! <= hi + 1e-12);
        }
      }
    }
  }
});

test('isoU_consistent / isoV_consistent: iso curves evaluate to the surface', () => {
  const rand = lcg(10);
  for (const opts of CASES) {
    for (let trial = 0; trial < 10; trial++) {
      const s = randomSurface(rand, opts);
      const d = surfaceDomain(s);
      for (const [u0, v0] of grid(s, 3)) {
        const cu = unwrap(isoparametricCurve(s, 'u', u0)); // C(v) = S(u0, v)
        const cv = unwrap(isoparametricCurve(s, 'v', v0)); // C(u) = S(u, v0)
        assert.equal(cu.degree, s.degreeV);
        assert.equal(cv.degree, s.degreeU);
        assert.equal(cu.weights !== undefined, opts.rational);
        assert.deepEqual(curveDomain(cu), d.v);
        for (let k = 0; k <= 8; k++) {
          const v = d.v[0] + ((d.v[1] - d.v[0]) * k) / 8;
          close(unwrap(evaluateCurve(cu, v)), unwrap(evaluateSurface(s, u0, v)), 1e-12, 'isoU_consistent');
          const u = d.u[0] + ((d.u[1] - d.u[0]) * k) / 8;
          close(unwrap(evaluateCurve(cv, u)), unwrap(evaluateSurface(s, u, v0)), 1e-12, 'isoV_consistent');
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Derivatives and normals

function farFromKnots(x: number, knots: readonly number[], h: number): boolean {
  return knots.every((k) => Math.abs(k - x) > 20 * h);
}

test('partial derivatives agree with central finite differences (A3.6 / A4.4), up to order 2', () => {
  const rand = lcg(11);
  const h = 1e-5;
  let checked = 0;
  for (const opts of [{ rational: false, simpleKnots: true }, { rational: true, simpleKnots: true }, { rational: true, unclamped: true }]) {
    for (let trial = 0; trial < 15; trial++) {
      const s = randomSurface(rand, opts);
      const d = surfaceDomain(s);
      for (let a = 0; a < 5; a++) {
        for (let b = 0; b < 5; b++) {
          const u = d.u[0] + ((d.u[1] - d.u[0]) * (a + 0.37)) / 5;
          const v = d.v[0] + ((d.v[1] - d.v[0]) * (b + 0.61)) / 5;
          if (!farFromKnots(u, s.knotsU, h) || !farFromKnots(v, s.knotsV, h)) continue;
          const D = unwrap(surfaceDerivatives(s, u, v, 2));
          assert.equal(D.length, 3);
          assert.equal(D[0]!.length, 3);
          assert.equal(D[2]!.length, 1);
          close(D[0]![0]!, unwrap(evaluateSurface(s, u, v)), 1e-12, 'S00');
          const S = (x: number, y: number): readonly number[] => unwrap(evaluateSurface(s, x, y));
          const D1 = (x: number, y: number) => unwrap(surfaceDerivatives(s, x, y, 1));
          const fd = (f: (t: number) => readonly number[], t: number): number[] => {
            const p1 = f(t + h);
            const p0 = f(t - h);
            return p1.map((c, i) => (c - p0[i]!) / (2 * h));
          };
          const relClose = (x: readonly number[], y: readonly number[], msg: string): void => {
            const scale = Math.max(1, ...x.map(Math.abs), ...y.map(Math.abs));
            for (let i = 0; i < x.length; i++) assert.ok(Math.abs(x[i]! - y[i]!) <= 1e-5 * scale, `${msg}: ${x[i]} vs ${y[i]}`);
          };
          relClose(D[1]![0]!, fd((t) => S(t, v), u), 'Su');
          relClose(D[0]![1]!, fd((t) => S(u, t), v), 'Sv');
          relClose(D[2]![0]!, fd((t) => D1(t, v)[1]![0]!, u), 'Suu');
          relClose(D[1]![1]!, fd((t) => D1(u, t)[1]![0]!, v), 'Suv');
          relClose(D[1]![1]!, fd((t) => D1(t, v)[0]![1]!, u), 'Svu');
          relClose(D[0]![2]!, fd((t) => D1(u, t)[0]![1]!, v), 'Svv');
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 400, `checked ${checked}`);
});

test('derivatives above the degree vanish for polynomial surfaces; rational ones match the iso curve derivatives', () => {
  const rand = lcg(12);
  for (let trial = 0; trial < 10; trial++) {
    const s = randomSurface(rand, { rational: false, simpleKnots: true });
    const D = unwrap(surfaceDerivatives(s, 0.3, 0.7, 4));
    for (let k = 0; k <= 4; k++) {
      for (let l = 0; l <= 4 - k; l++) {
        if (k > s.degreeU || l > s.degreeV) assert.ok(D[k]![l]!.every((c) => c === 0));
      }
    }
  }
  // Pure derivatives of a rational surface equal the M0 (A4.2) derivatives of its iso curves.
  for (let trial = 0; trial < 20; trial++) {
    const s = randomSurface(rand, { rational: true, simpleKnots: true });
    for (const [u, v] of [[0.31, 0.47], [0.83, 0.12], [0.5, 0.95]] as const) {
      const D = unwrap(surfaceDerivatives(s, u, v, 3));
      const cu = unwrap(curveDerivatives(unwrap(isoparametricCurve(s, 'u', u)), v, 3)); // d^l/dv^l
      const cv = unwrap(curveDerivatives(unwrap(isoparametricCurve(s, 'v', v)), u, 3)); // d^k/du^k
      for (let k = 0; k <= 3; k++) {
        close(D[0]![k]!, cu[k]!, 1e-9, `S_v^${k}`);
        close(D[k]![0]!, cv[k]!, 1e-9, `S_u^${k}`);
      }
    }
  }
});

test('quarter cylinder: rational quadratic x linear surface lies on x^2 + y^2 = 1 with radial normals', () => {
  const w = Math.SQRT1_2;
  const s = unwrap(
    createNurbsSurface(
      2,
      1,
      [0, 0, 0, 1, 1, 1],
      [0, 0, 1, 1],
      [
        [[1, 0, 0], [1, 0, 2]],
        [[1, 1, 0], [1, 1, 2]],
        [[0, 1, 0], [0, 1, 2]],
      ],
      [[1, 1], [w, w], [1, 1]],
    ),
  );
  for (let a = 0; a <= 40; a++) {
    for (let b = 0; b <= 10; b++) {
      const u = a / 40;
      const v = b / 10;
      const p = unwrap(evaluateSurface(s, u, v));
      assert.ok(Math.abs(Math.hypot(p[0]!, p[1]!) - 1) < 1e-14, `radius at ${u}`);
      assert.ok(Math.abs(p[2]! - 2 * v) < 1e-14);
      assert.ok(p[0]! >= -1e-15 && p[1]! >= -1e-15);
      close(unwrap(evaluateSurfaceBasis(s, u, v)), p, 1e-14);
      const n = unwrap(surfaceNormal(kernel, s, u, v));
      // Su is counter-clockwise tangent, Sv = +z, so Su x Sv points outward.
      close([n.x, n.y, n.z], [p[0]!, p[1]!, 0], 1e-12, 'normal');
      const D = unwrap(surfaceDerivatives(s, u, v, 2));
      // Su is tangent: Su . (x, y) = 0; Suv = 0 (the u-tangent does not depend on v).
      assert.ok(Math.abs(D[1]![0]![0]! * p[0]! + D[1]![0]![1]! * p[1]!) < 1e-12);
      assert.ok(D[1]![1]!.every((c) => Math.abs(c) < 1e-12));
      close(D[0]![1]!, [0, 0, 2], 1e-14);
    }
  }
  assert.deepEqual(unwrap(evaluateSurface(s, 0.5, 0)).map((c) => Math.round(c * 1e12) / 1e12), [w, w, 0].map((c) => Math.round(c * 1e12) / 1e12));
});

test('surfaceNormal: plane normal, degenerate at a collapsed edge, needs 3D', () => {
  const plane = unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], [[[0, 0, 0], [0, 2, 0]], [[3, 0, 0], [3, 2, 0]]]));
  const n = unwrap(surfaceNormal(kernel, plane, 0.25, 0.75));
  assert.deepEqual([n.x, n.y, n.z], [0, 0, 1]);
  assert.ok(Object.isFrozen(n));
  // Triangle-like patch: the row u = 0 collapses to one point, so Sv = 0 there.
  const tri = unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], [[[0, 0, 0], [0, 0, 0]], [[1, 0, 0], [1, 1, 0]]]));
  const bad = surfaceNormal(kernel, tri, 0, 0.5);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.kind, 'degenerate');
  assert.equal(surfaceNormal(kernel, tri, 0.5, 0.5).ok, true);
  // Parallel tangents: a surface folded onto a line.
  const line = unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [2, 0, 0]]]));
  const par = surfaceNormal(kernel, line, 0.5, 0.5);
  assert.equal(par.ok, false);
  if (!par.ok) assert.equal(par.error.kind, 'degenerate');
  const flat = unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], [[[0, 0], [0, 1]], [[1, 0], [1, 1]]]));
  assert.equal(surfaceNormal(kernel, flat, 0.5, 0.5).ok, false);
});

// ---------------------------------------------------------------------------------------------
// Knot insertion

test('insertKnotSurface preserves the surface in u and v (A5.3), polynomial and rational', () => {
  const rand = lcg(13);
  for (const opts of CASES) {
    for (let trial = 0; trial < 12; trial++) {
      const s = randomSurface(rand, opts);
      const d = surfaceDomain(s);
      for (const dir of ['u', 'v'] as const) {
        const [lo, hi] = dir === 'u' ? d.u : d.v;
        const deg = dir === 'u' ? s.degreeU : s.degreeV;
        const knots = dir === 'u' ? s.knotsU : s.knotsV;
        const value = lo + (hi - lo) * (0.1 + 0.8 * rand());
        const times = Math.max(1, Math.min(deg - knotMultiplicity(knots, value), 1 + Math.floor(rand() * deg)));
        if (knotMultiplicity(knots, value) + times > deg) continue;
        const t = unwrap(insertKnotSurface(s, dir, value, times));
        const newKnots = dir === 'u' ? t.knotsU : t.knotsV;
        assert.equal(newKnots.length, knots.length + times);
        assert.equal(knotMultiplicity(newKnots, value), knotMultiplicity(knots, value) + times);
        assert.equal(t.weights !== undefined, opts.rational);
        if (dir === 'u') assert.equal(t.controlPoints.length, s.controlPoints.length + times);
        else assert.equal(t.controlPoints[0]!.length, s.controlPoints[0]!.length + times);
        assert.deepEqual(surfaceDomain(t), d);
        for (const [u, v] of grid(s, 6)) close(unwrap(evaluateSurface(t, u, v)), unwrap(evaluateSurface(s, u, v)), 1e-12);
      }
    }
  }
});

test('refineKnotsSurface preserves the surface; insertion errors are reported', () => {
  const rand = lcg(14);
  const s = randomSurface(rand, { rational: true });
  const t = unwrap(refineKnotsSurface(unwrap(refineKnotsSurface(s, 'u', [0.13, 0.5, 0.77])), 'v', [0.21, 0.66]));
  for (const [u, v] of grid(s, 8)) close(unwrap(evaluateSurface(t, u, v)), unwrap(evaluateSurface(s, u, v)), 1e-12);
  assert.equal(insertKnotSurface(s, 'u', 1).ok, false); // domain end
  assert.equal(insertKnotSurface(s, 'v', -1).ok, false);
  assert.equal(insertKnotSurface(s, 'u', 0.5, s.degreeU + 1).ok, false);
  assert.equal(insertKnotSurface(s, 'x' as 'u', 0.5).ok, false);
});

// ---------------------------------------------------------------------------------------------
// Degree elevation

test('elev_first / elev_last / elev_const / elev_between: closed-form Bezier elevation step', () => {
  const rand = lcg(15);
  for (let p = 1; p <= 8; p++) {
    const P = Array.from({ length: p + 1 }, () => [rand() * 10 - 5, rand() * 10 - 5]);
    const Q = unwrap(elevateBezier(P, 1));
    assert.equal(Q.length, p + 2);
    assert.deepEqual(Q[0], P[0]);
    assert.deepEqual(Q[p + 1], P[p]);
    for (let i = 1; i <= p; i++) {
      for (let c = 0; c < 2; c++) {
        const lo = Math.min(P[i - 1]![c]!, P[i]![c]!);
        const hi = Math.max(P[i - 1]![c]!, P[i]![c]!);
        assert.ok(Q[i]![c]! >= lo - 1e-15 && Q[i]![c]! <= hi + 1e-15);
        const a = i / (p + 1);
        assert.equal(Q[i]![c], a * P[i - 1]![c]! + (1 - a) * P[i]![c]!);
      }
    }
    const C = unwrap(elevateBezier(Array.from({ length: p + 1 }, () => [2.5, -1]), 3));
    assert.equal(C.length, p + 4);
    for (const pt of C) close(pt, [2.5, -1], 1e-15);
  }
});

test('elev_deg1_casteljau / elev_deg2_casteljau: elevated Bezier segments keep their de Casteljau values', () => {
  const rand = lcg(16);
  for (let p = 1; p <= 7; p++) {
    for (let trial = 0; trial < 5; trial++) {
      const P = Array.from({ length: p + 1 }, () => [rand() * 10 - 5, rand() * 10 - 5, 0.5 + rand()]);
      for (const times of [1, 2, 5]) {
        const Q = unwrap(elevateBezier(P, times));
        for (let k = 0; k <= 50; k++) close(unwrap(deCasteljau(Q, k / 50)), unwrap(deCasteljau(P, k / 50)), 1e-12);
      }
    }
  }
  assert.ok(Object.isFrozen(unwrap(elevateBezier([[0], [1]]))));
  assert.equal(elevateBezier([[0]]).ok, false);
  assert.equal(elevateBezier([[0], [1]], -1).ok, false);
  assert.equal(elevateBezier([[0], [NaN]]).ok, false);
});

test('elevationMatrix equals repeated closed-form steps and its rows sum to 1', () => {
  for (let p = 1; p <= 6; p++) {
    for (let t = 1; t <= 4; t++) {
      const M = unwrap(elevationMatrix(p, t));
      assert.equal(M.length, p + t + 1);
      for (const row of M) assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-14);
      // Column j of M is the elevation of the unit polygon e_j.
      for (let j = 0; j <= p; j++) {
        const e: ControlPoint[] = Array.from({ length: p + 1 }, (_, i) => [i === j ? 1 : 0]);
        const Q = unwrap(elevateBezier(e, t));
        for (let i = 0; i <= p + t; i++) assert.ok(Math.abs(Q[i]![0]! - M[i]![j]!) < 1e-14);
      }
    }
  }
  assert.equal(elevationMatrix(0, 1).ok, false);
  assert.equal(elevationMatrix(30, 5).ok, false);
});

function randomClampedCurve(rand: () => number, rational: boolean): NurbsCurve {
  const p = 1 + Math.floor(rand() * 4);
  const count = p + 1 + Math.floor(rand() * 7);
  const knots = randomClampedKnots(rand, p, count, p);
  const pts = Array.from({ length: count }, () => [rand() * 10 - 5, rand() * 10 - 5, rand() * 10 - 5]);
  const weights = rational ? pts.map(() => 0.25 + rand() * 2) : undefined;
  return unwrap(createNurbsCurve(p, knots, pts, weights));
}

test('elevateCurveDegree preserves polynomial and rational curves (A5.9) at many parameters', () => {
  const rand = lcg(17);
  let worst = 0;
  for (const rational of [false, true]) {
    for (let trial = 0; trial < 150; trial++) {
      const c = randomClampedCurve(rand, rational);
      const t = 1 + Math.floor(rand() * 3);
      const e = unwrap(elevateCurveDegree(c, t));
      assert.equal(e.degree, c.degree + t);
      assert.equal(e.weights !== undefined, rational);
      assert.deepEqual(curveDomain(e), curveDomain(c));
      // Every distinct knot gains t in multiplicity, so continuity is unchanged.
      const distinct = [...new Set(c.knots)];
      for (const k of distinct) assert.equal(knotMultiplicity(e.knots, k), knotMultiplicity(c.knots, k) + t);
      assert.equal(e.controlPoints.length, c.controlPoints.length + t * (distinct.length - 1));
      for (let k = 0; k <= 400; k++) {
        const u = k / 400;
        const a = unwrap(evaluateCurve(c, u));
        const b = unwrap(evaluateCurve(e, u));
        for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(a[i]! - b[i]!));
      }
    }
  }
  assert.ok(worst < 1e-12, `worst deviation ${worst}`);
});

test('elevateCurveDegree: t = 0 is the identity; unclamped knots and too high degrees are rejected', () => {
  const c = randomClampedCurve(lcg(18), false);
  assert.equal(unwrap(elevateCurveDegree(c, 0)), c);
  const unclamped = unwrap(createNurbsCurve(2, [0, 1, 2, 3, 4, 5], [[0], [1], [3]]));
  assert.equal(elevateCurveDegree(unclamped, 1).ok, false);
  assert.equal(elevateCurveDegree(c, 40).ok, false);
  assert.equal(elevateCurveDegree(c, 1.5).ok, false);
  // A Bezier curve: A5.9 reduces to the closed form.
  const bez = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0], [1, 2], [3, 0]]));
  const e = unwrap(elevateCurveDegree(bez, 1));
  const closed = unwrap(elevateBezier(bez.controlPoints, 1));
  for (let i = 0; i < closed.length; i++) close(e.controlPoints[i]!, closed[i]!, 1e-15);
  // A full circle-quadrant (rational) stays on the unit circle after elevation.
  const w = Math.SQRT1_2;
  const arc = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[1, 0], [1, 1], [0, 1]], [1, w, 1]));
  const arc4 = unwrap(elevateCurveDegree(arc, 2));
  for (let k = 0; k <= 64; k++) {
    const p = unwrap(evaluateCurve(arc4, k / 64));
    assert.ok(Math.abs(Math.hypot(p[0]!, p[1]!) - 1) < 1e-14);
  }
});

test('elevateSurfaceDegree preserves the surface in both directions', () => {
  const rand = lcg(19);
  for (const opts of [CASES[0]!, CASES[1]!]) {
    for (let trial = 0; trial < 10; trial++) {
      const s = randomSurface(rand, opts);
      const eu = unwrap(elevateSurfaceDegree(s, 'u', 1 + (trial % 2)));
      const ev = unwrap(elevateSurfaceDegree(eu, 'v', 1));
      assert.equal(ev.degreeU, s.degreeU + 1 + (trial % 2));
      assert.equal(ev.degreeV, s.degreeV + 1);
      for (const [u, v] of grid(s, 6)) close(unwrap(evaluateSurface(ev, u, v)), unwrap(evaluateSurface(s, u, v)), 1e-12);
    }
  }
  const un = randomSurface(rand, { rational: false, unclamped: true });
  assert.equal(elevateSurfaceDegree(un, 'u', 1).ok, false);
  assert.equal(unwrap(elevateSurfaceDegree(un, 'u', 0)), un);
});

// ---------------------------------------------------------------------------------------------
// Adversarial review regressions

test('review: huge derivative orders are rejected instead of exhausting memory', () => {
  const s = randomSurface(lcg(31), { rational: true });
  assert.equal(surfaceDerivatives(s, 0.5, 0.5, MAX_DERIVATIVE_ORDER + 1).ok, false);
  assert.equal(surfaceDerivatives(s, 0.5, 0.5, 1e9).ok, false);
  const D = unwrap(surfaceDerivatives(s, 0.5, 0.5, MAX_DERIVATIVE_ORDER));
  assert.equal(D.length, MAX_DERIVATIVE_ORDER + 1);
  assert.ok(D[MAX_DERIVATIVE_ORDER]![0]!.every((c) => Number.isFinite(c)));
});

test('MAX_DERIVATIVE_ORDER also caps M0 curveDerivatives (one limit for curves and surfaces)', () => {
  const c = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0], [1, 2], [2, 0]], [1, 0.5, 1]));
  assert.equal(curveDerivatives(c, 0.5, MAX_DERIVATIVE_ORDER + 1).ok, false);
  assert.equal(curveDerivatives(c, 0.5, 1e9).ok, false);
  const D = unwrap(curveDerivatives(c, 0.5, MAX_DERIVATIVE_ORDER));
  assert.equal(D.length, MAX_DERIVATIVE_ORDER + 1);
  assert.ok(D.every((row) => row.every((x) => Number.isFinite(x))));
});

test('review: direction curve helpers reject bad directions and weighted / mismatched curves', () => {
  const s = randomSurface(lcg(32), { rational: true });
  assert.equal(directionCurves(s, 'x' as 'u').ok, false);
  const curves = unwrap(directionCurves(s, 'u'));
  assert.ok(curves.every((c) => c.weights === undefined && c.dimension === s.dimension + 1));
  const back = unwrap(surfaceFromDirectionCurves(s, 'u', curves));
  for (const [u, v] of grid(s, 4)) close(unwrap(evaluateSurface(back, u, v)), unwrap(evaluateSurface(s, u, v)), 1e-13);
  assert.equal(surfaceFromDirectionCurves(s, 'x' as 'u', curves).ok, false);
  const c0 = curves[0]!;
  const weighted = unwrap(createNurbsCurve(c0.degree, c0.knots, c0.controlPoints, c0.controlPoints.map(() => 2)));
  assert.equal(surfaceFromDirectionCurves(s, 'u', curves.map(() => weighted)).ok, false);
  const flat = unwrap(createNurbsCurve(c0.degree, c0.knots, c0.controlPoints.map((pt) => pt.slice(0, 3))));
  assert.equal(surfaceFromDirectionCurves(s, 'u', curves.map(() => flat)).ok, false);
  assert.equal(refineKnotsSurface(s, 'x' as 'u', []).ok, false);
});

test('review: elevation on shifted, non-dyadic, wide knot ranges with full interior multiplicity', () => {
  const rand = lcg(33);
  let checked = 0;
  for (let trial = 0; trial < 200; trial++) {
    const p = 1 + Math.floor(rand() * 6);
    const lo = (rand() - 0.5) * 1e3;
    const len = 0.01 + rand() * 1e3;
    const interior: number[] = [];
    const nInt = Math.floor(rand() * 6);
    for (let k = 0; k < nInt; k++) {
      const x = lo + len * (0.05 + 0.9 * rand());
      const m = trial % 3 === 0 ? p : 1 + Math.floor(rand() * p);
      for (let r = 0; r < m; r++) interior.push(x);
    }
    interior.sort((a, b) => a - b);
    const knots = [...new Array<number>(p + 1).fill(lo), ...interior, ...new Array<number>(p + 1).fill(lo + len)];
    const count = knots.length - p - 1;
    const pts = Array.from({ length: count }, () => [rand() * 10 - 5, rand() * 10 - 5]);
    const w = trial % 2 === 0 ? pts.map(() => 0.1 + rand() * 5) : undefined;
    const c = unwrap(createNurbsCurve(p, knots, pts, w));
    const e = unwrap(elevateCurveDegree(c, 1 + Math.floor(rand() * 4)));
    const [a, b] = curveDomain(c);
    for (let k = 0; k <= 200; k++) {
      const u = k === 200 ? b : a + ((b - a) * k) / 200;
      close(unwrap(evaluateCurve(e, u)), unwrap(evaluateCurve(c, u)), 1e-10, `trial ${trial} u=${u}`);
    }
    checked++;
  }
  assert.equal(checked, 200);
});

test('review: elevateBezier reports overflow instead of returning Infinity', () => {
  const M = Number.MAX_VALUE;
  const r = elevateBezier([[M], [M], [M]], 3);
  if (r.ok) assert.ok(r.value.every((pt) => pt.every((c) => Number.isFinite(c))));
  const big = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[M], [-M]]));
  const e = elevateCurveDegree(big, 2);
  if (e.ok) assert.ok(e.value.controlPoints.every((pt) => pt.every((c) => Number.isFinite(c))));
});
