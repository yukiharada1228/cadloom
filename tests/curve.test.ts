import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import { add3, cross3, distance3, dot3, length3, normalize3, scale3, sub3, vec3, type Vec3 } from '../src/math/vec.ts';
import { compose, rotation, scaling, translation, applyPoint } from '../src/math/transform.ts';
import { createNurbsCurve, curveDerivatives, evaluateCurve } from '../src/nurbs/curve.ts';
import {
  circleArcToNurbs,
  closestPointOnCurve,
  conicFromConjugateAxes,
  createCircleCurve,
  createCurveFrame,
  createEllipseCurve,
  createLineCurve,
  createNurbsCurve3,
  createSegmentCurve,
  curveArcLength,
  curveCurvature,
  curveFrenetFrame,
  curvePoint3,
  curveRange,
  curveTangent,
  curveToNurbs,
  ellipseArcToNurbs,
  evaluateCurve3,
  lineProjectionParam,
  lineToNurbs,
  rationalQuadraticArc,
  transformCurve3,
  unitArcAngleOfParam,
  unitArcNet,
  unitArcParamOfAngle,
  type CircleCurve,
  type Curve3,
  type EllipseCurve,
} from '../src/curve/index.ts';

const K = createKernel();
const KFINE = createKernel({ approxTol3d: 1e-12 });

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const close = (a: number, b: number, tol: number, msg?: string): void =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}, got ${a} (tol ${tol})`);
const closeV = (a: Vec3, b: Vec3, tol: number, msg?: string): void =>
  assert.ok(distance3(a, b) <= tol, `${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const P = (a: readonly number[]): Vec3 => vec3(a[0]!, a[1]!, a[2]!);

/** A tilted frame used by many tests. */
const tiltedNormal = vec3(1, 2, 3);
const tiltedRef = vec3(-2, 1, 0.5);
const circleT = unwrap(createCircleCurve(K, vec3(1, -2, 0.5), tiltedNormal, tiltedRef, 2.5)) as CircleCurve;
const ellipseT = unwrap(createEllipseCurve(K, vec3(0.3, 0.1, -1), tiltedNormal, tiltedRef, 3, 1.25)) as EllipseCurve;

/** In-plane ellipse residual `(x/a)² + (y/b)² - 1` of a 3D point, and its distance from the plane. */
function ellipseResidual(e: EllipseCurve | CircleCurve, p: Vec3): { implicit: number; offPlane: number } {
  const q = sub3(p, e.center);
  const a = e.kind === 'circle' ? e.radius : e.majorRadius;
  const b = e.kind === 'circle' ? e.radius : e.minorRadius;
  const x = dot3(q, e.frame.xAxis) / a;
  const y = dot3(q, e.frame.yAxis) / b;
  return { implicit: x * x + y * y - 1, offPlane: dot3(q, e.frame.normal) };
}

// ---------------------------------------------------------------- constructors

test('constructors validate and freeze', () => {
  const f = unwrap(createCurveFrame(K, vec3(0, 0, 2), vec3(1, 1, 5)));
  closeV(f.xAxis, normalize3(vec3(1, 1, 0))!, 1e-15);
  closeV(f.yAxis, cross3(f.normal, f.xAxis), 1e-15);
  assert.ok(Object.isFrozen(f) && Object.isFrozen(f.xAxis));
  assert.equal(createCurveFrame(K, vec3(0, 0, 1), vec3(0, 0, 3)).ok, false); // parallel
  assert.equal(createCurveFrame(K, vec3(0, 0, 0), vec3(1, 0, 0)).ok, false);
  assert.equal(createCurveFrame(K, vec3(NaN, 0, 1), vec3(1, 0, 0)).ok, false);
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 0).ok, false);
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), -1).ok, false);
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, [0, 7]).ok, false);
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, [1, 1]).ok, false);
  assert.equal(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, 2).ok, false); // minor > major
  assert.equal(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2, 2).ok, true);
  assert.equal(createLineCurve(vec3(0, 0, 0), vec3(0, 0, 0), [0, 1]).ok, false);
  assert.equal(createLineCurve(vec3(0, 0, 0), vec3(1, 0, 0), [0, Infinity]).ok, false);
  assert.equal(createLineCurve(vec3(0, 0, 0), vec3(1e300, 0, 0), [0, 1e10]).ok, false);
  const two = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0], [1, 1]]));
  assert.equal(createNurbsCurve3(two).ok, false);
  assert.ok(Object.isFrozen(circleT) && Object.isFrozen(circleT.range));
});

// ---------------------------------------------------------------- evaluation

test('evaluateCurve3 derivatives agree with central differences', () => {
  const line = unwrap(createLineCurve(vec3(1, 2, 3), vec3(0.5, -1, 2), [-2, 3]));
  const nurbs = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 0.4, 1, 1, 1, 1],
    [[0, 0, 0], [1, 2, 0], [2, -1, 1], [3, 1, 2], [4, 0, 0]], [1, 2, 0.5, 1, 1.5]))));
  const h = 1e-5;
  for (const c of [line, circleT, ellipseT, nurbs] as Curve3[]) {
    const [t0, t1] = curveRange(c);
    for (const f of [0.2, 0.5, 0.77]) {
      const t = t0 + f * (t1 - t0);
      const e = unwrap(evaluateCurve3(c, t));
      const pm = unwrap(evaluateCurve3(c, t - h));
      const pp = unwrap(evaluateCurve3(c, t + h));
      closeV(e.d1, scale3(sub3(pp.point, pm.point), 1 / (2 * h)), 1e-6, c.kind);
      closeV(e.d2, scale3(sub3(pp.d1, pm.d1), 1 / (2 * h)), 1e-5, c.kind);
    }
  }
  assert.equal(evaluateCurve3(circleT, -0.1).ok, false);
  assert.equal(evaluateCurve3(line, NaN).ok, false);
  assert.ok(Object.isFrozen(unwrap(evaluateCurve3(circleT, 1))));
});

test('circle_frame_radius / circle_deriv_orthogonal / circle_speed_sq / circle_second_deriv', () => {
  const r = circleT.radius;
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * 2 * Math.PI;
    const e = unwrap(evaluateCurve3(circleT, t));
    const radial = sub3(e.point, circleT.center);
    close(dot3(radial, radial), r * r, 1e-12);
    close(dot3(e.d1, radial), 0, 1e-12);
    close(dot3(e.d1, e.d1), r * r, 1e-12);
    closeV(e.d2, scale3(radial, -1), 1e-14);
    close(dot3(radial, circleT.frame.normal), 0, 1e-14);
  }
});

test('curvature of a circle is 1/r (closed form and |C\' x C\'\'| / |C\'|^3)', () => {
  for (const r of [0.01, 1, 2.5, 1e4]) {
    const c = unwrap(createCircleCurve(K, vec3(3, 0, 1), tiltedNormal, tiltedRef, r));
    for (const t of [0, 1, 4]) {
      close(unwrap(curveCurvature(c, t)), 1 / r, 1e-15 / r);
      const e = unwrap(evaluateCurve3(c, t));
      close(length3(cross3(e.d1, e.d2)) / length3(e.d1) ** 3, 1 / r, 1e-12 / r);
    }
    // The NURBS form has the same curvature everywhere (it is the same circle).
    const n = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(c))));
    for (const u of [0.3, 1.7, 2.9, 5.5]) close(unwrap(curveCurvature(n, u)), 1 / r, 1e-9 / r);
  }
  const line = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(1, 1, 1)));
  assert.equal(unwrap(curveCurvature(line, 0.5)), 0);
  // Ellipse vertex curvatures: a/b² at the major vertex, b/a² at the minor vertex.
  close(unwrap(curveCurvature(ellipseT, 0)), 3 / 1.25 ** 2, 1e-12);
  close(unwrap(curveCurvature(ellipseT, Math.PI / 2)), 1.25 / 9, 1e-12);
});

test('tangent and Frenet frame; straight lines have no normal', () => {
  const ff = unwrap(curveFrenetFrame(K, circleT, 0.7));
  const e = unwrap(evaluateCurve3(circleT, 0.7));
  closeV(ff.tangent, normalize3(e.d1)!, 1e-15);
  closeV(ff.normal, normalize3(sub3(circleT.center, e.point))!, 1e-14); // towards the center
  closeV(ff.binormal, circleT.frame.normal, 1e-14);
  close(ff.curvature, 1 / circleT.radius, 1e-15);
  closeV(unwrap(curveTangent(circleT, 0.7)), ff.tangent, 0);
  const line = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(1, 2, 3)));
  const lf = curveFrenetFrame(K, line, 0.5);
  assert.ok(!lf.ok && lf.error.kind === 'degenerate');
  // A straight degree-2 NURBS (collinear points) also has no Frenet normal.
  const straight = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0, 0], [1, 1, 1], [3, 3, 3]]))));
  const sf = curveFrenetFrame(K, straight, 0.5);
  assert.ok(!sf.ok && sf.error.kind === 'degenerate');
  // A cusp: all control points equal => zero derivative.
  const cusp = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[1, 1, 1], [1, 1, 1]]))));
  const ct = curveTangent(cusp, 0.5);
  assert.ok(!ct.ok && ct.error.kind === 'degenerate');
});

// ---------------------------------------------------------------- arc length

test('arc length of a circle is r times the sweep (exact), and its NURBS form agrees', () => {
  close(unwrap(curveArcLength(K, circleT)), 2 * Math.PI * 2.5, 1e-14);
  const arc = unwrap(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2, [0.25, 2.25]));
  close(unwrap(curveArcLength(K, arc)), 4, 1e-15);
  close(unwrap(curveArcLength(K, arc, 1, 2)), 2, 1e-15);
  const n = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(circleT))));
  close(unwrap(curveArcLength(KFINE, n)), 2 * Math.PI * 2.5, 1e-10);
  const line = unwrap(createLineCurve(vec3(0, 0, 0), vec3(3, 4, 0), [-1, 2]));
  close(unwrap(curveArcLength(K, line)), 15, 1e-14);
  assert.equal(curveArcLength(K, arc, 0, 1).ok, false); // outside the range
  assert.equal(unwrap(curveArcLength(K, arc, 1, 1)), 0);
});

test('arc length of an ellipse by adaptive Gauss-Legendre matches the series value', () => {
  // Perimeter of a=3, b=1.25 by the Gauss-Kummer series in h = ((a-b)/(a+b))^2.
  const a = 3, b = 1.25;
  const h = ((a - b) / (a + b)) ** 2;
  let sum = 1, coef = 1;
  for (let n = 1; n < 60; n++) {
    coef *= ((0.5 - (n - 1)) / n);
    sum += coef * coef * h ** n;
  }
  const perimeter = Math.PI * (a + b) * sum;
  close(unwrap(curveArcLength(KFINE, ellipseT)), perimeter, 1e-10);
  // The default tolerance (approxTol3d = 5e-6) is honoured.
  close(unwrap(curveArcLength(K, ellipseT)), perimeter, 5e-6);
  // Quarter arcs are a quarter of the perimeter by symmetry.
  close(unwrap(curveArcLength(KFINE, ellipseT, 0, Math.PI / 2)), perimeter / 4, 1e-10);
  // A very flat ellipse still converges.
  const flat = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, 1e-6));
  close(unwrap(curveArcLength(KFINE, flat)), 4, 1e-9);
});

// ---------------------------------------------------------------- exact NURBS forms

test('A7.1 knot vector and weights for 90/180/270/360 degree arcs', () => {
  const expectSeg = [1, 2, 3, 4];
  for (let q = 1; q <= 4; q++) {
    const end = (q * Math.PI) / 2;
    const net = unwrap(unitArcNet(0, end));
    assert.equal(net.segments, expectSeg[q - 1]);
    const n = net.segments;
    assert.equal(net.knots.length, 2 * n + 4);
    assert.equal(net.points.length, 2 * n + 1);
    assert.deepEqual(net.knots.slice(0, 3), [0, 0, 0]);
    assert.deepEqual(net.knots.slice(-3), [end, end, end]);
    for (let i = 1; i < n; i++) {
      const k = net.knots[1 + 2 * i]!;
      assert.equal(net.knots[2 + 2 * i], k, 'interior knots are double');
      close(k, (i * Math.PI) / 2, 1e-15);
    }
    for (let i = 0; i < net.weights.length; i++) {
      close(net.weights[i]!, i % 2 === 0 ? 1 : Math.SQRT1_2, 1e-15);
    }
    // Quarter-circle middle points are the corners (±1, ±1).
    for (let i = 0; i < n; i++) {
      const [x, y] = net.points[2 * i + 1]!;
      close(Math.abs(x), 1, 1e-15);
      close(Math.abs(y), 1, 1e-15);
    }
  }
  // 120 degrees: two segments of 60, weight cos 30.
  const n120 = unwrap(unitArcNet(0, (2 * Math.PI) / 3));
  assert.equal(n120.segments, 2);
  close(n120.weights[1]!, Math.cos(Math.PI / 6), 1e-15);
  // 300 degrees: four segments of 75.
  const n300 = unwrap(unitArcNet(1, 1 + (5 * Math.PI) / 3));
  assert.equal(n300.segments, 4);
  close(n300.weights[1]!, Math.cos((5 * Math.PI) / 24), 1e-15);
  // Bad sweeps.
  assert.equal(unitArcNet(0, 0).ok, false);
  assert.equal(unitArcNet(1, 0).ok, false);
  assert.equal(unitArcNet(0, 7).ok, false);
  assert.equal(unitArcNet(0, NaN).ok, false);
});

test('arc_on_unit_circle / arc_denominator_pos: NURBS circle and ellipse arcs lie on the analytic curve', () => {
  const rnd = lcg(7);
  const curves: (CircleCurve | EllipseCurve)[] = [circleT, ellipseT];
  for (const [s, e] of [[0, 0.3], [-1, 1.5], [2, 5], [0.5, 0.5 + 2 * Math.PI], [0, Math.PI / 2], [0, Math.PI]]) {
    curves.push(unwrap(createCircleCurve(K, vec3(1e3, -2, 7), vec3(0.2, -1, 0.4), vec3(1, 0, 0), 1e3, [s!, e!])) as CircleCurve);
    curves.push(unwrap(createEllipseCurve(K, vec3(-1, 4, 2), vec3(0, 1, 1), vec3(1, 0, 0), 5, 0.1, [s!, e!])) as EllipseCurve);
  }
  for (const c of curves) {
    const nurbs = unwrap(curveToNurbs(c));
    const scale = c.kind === 'circle' ? c.radius : c.majorRadius;
    const [u0, u1] = [nurbs.knots[0]!, nurbs.knots[nurbs.knots.length - 1]!];
    assert.deepEqual([u0, u1], [...c.range]);
    for (let i = 0; i <= 200; i++) {
      const u = i === 200 ? u1 : u0 + (u1 - u0) * rnd();
      const p = P(unwrap(evaluateCurve(nurbs, u)));
      const res = ellipseResidual(c, p);
      assert.ok(Math.abs(res.implicit) <= 1e-12, `implicit residual ${res.implicit}`);
      assert.ok(Math.abs(res.offPlane) <= 1e-12 * Math.max(scale, length3(c.center)), `off plane ${res.offPlane}`);
    }
    // Endpoints and tangent directions match the analytic curve.
    for (const [u, t] of [[u0, c.range[0]], [u1, c.range[1]]] as const) {
      const a = unwrap(evaluateCurve3(c, t));
      const d = unwrap(curveDerivatives(nurbs, u, 1));
      closeV(P(d[0]!), a.point, 1e-12 * (scale + length3(c.center)));
      closeV(normalize3(P(d[1]!))!, normalize3(a.d1)!, 1e-12);
    }
    // Every homogeneous weight is positive (denominator has no zero).
    assert.ok(nurbs.weights!.every((w) => w > 0));
  }
});

test('arc_reparam_x / arc_reparam_y: the NURBS point at u is the analytic point at unitArcAngleOfParam(u)', () => {
  for (const [s, e] of [[0, 2 * Math.PI], [0.4, 2.1], [-3, -0.2]] as const) {
    const net = unwrap(unitArcNet(s, e));
    const c = unwrap(createEllipseCurve(K, vec3(1, 2, 3), tiltedNormal, tiltedRef, 2, 0.7, [s, e])) as EllipseCurve;
    const nurbs = unwrap(ellipseArcToNurbs(c));
    for (let i = 0; i <= 50; i++) {
      const u = s + ((e - s) * i) / 50;
      const theta = unitArcAngleOfParam(net, u);
      closeV(P(unwrap(evaluateCurve(nurbs, u))), unwrap(curvePoint3(c, theta)), 1e-13);
      close(unitArcParamOfAngle(net, theta), u, 1e-13);
    }
    // At knots, parameter = angle.
    for (const k of net.knots) close(unitArcAngleOfParam(net, k), k, 1e-15);
  }
});

test('quarter_on_unit_circle: the textbook quarter (1,0),(1,1),(0,1) with weights 1, √2/2, 1', () => {
  const q = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[1, 0], [1, 1], [0, 1]], [1, Math.SQRT1_2, 1]));
  for (let i = 0; i <= 64; i++) {
    const [x, y] = unwrap(evaluateCurve(q, i / 64));
    close(x! * x! + y! * y!, 1, 2e-16 * 4);
  }
  const net = unwrap(unitArcNet(0, Math.PI / 2));
  close(net.points[1]![0], 1, 1e-15);
  close(net.points[1]![1], 1, 1e-15);
});

test('rational_unit_circle and ellipse_point_on_ellipse / ellipse_arc_on_ellipse', () => {
  for (const T of [-3, -1, -0.25, 0, 0.5, 2, 1e3]) {
    const w = 1 + T * T;
    close(((1 - T * T) / w) ** 2 + ((2 * T) / w) ** 2, 1, 4e-16);
  }
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * 2 * Math.PI;
    const r = ellipseResidual(ellipseT, unwrap(curvePoint3(ellipseT, t)));
    close(r.implicit, 0, 1e-15);
  }
  // rationalQuadraticArc accepts non-orthogonal conjugate axes: the image is still exact.
  const A = vec3(2, 0.5, 0), B = vec3(0.3, 1, 0.2);
  const arc = unwrap(rationalQuadraticArc(vec3(1, 1, 1), A, B, 1, 1, 0, 2 * Math.PI));
  const conic = unwrap(conicFromConjugateAxes(K, vec3(1, 1, 1), A, B, [0, 2 * Math.PI]));
  for (let i = 0; i <= 40; i++) {
    const p = P(unwrap(evaluateCurve(arc, (i / 40) * 2 * Math.PI)));
    const r = ellipseResidual(conic, p);
    close(r.implicit, 0, 1e-13);
    close(r.offPlane, 0, 1e-13);
  }
});

test('lineToNurbs keeps the parametrisation exactly', () => {
  const line = unwrap(createLineCurve(vec3(1, 2, 3), vec3(-1, 0.5, 2), [-2, 5]));
  const n = unwrap(lineToNurbs(line));
  assert.deepEqual([...n.knots], [-2, -2, 5, 5]);
  for (const t of [-2, -0.5, 0, 3.25, 5]) closeV(P(unwrap(evaluateCurve(n, t))), unwrap(curvePoint3(line, t)), 1e-14);
  const nc = unwrap(createNurbsCurve3(n));
  assert.equal(unwrap(curveToNurbs(nc)), n);
});

// ---------------------------------------------------------------- closest point

test('line_closest_orthogonal / line_closest_min: projection parameter of a line', () => {
  const rnd = lcg(11);
  const line = unwrap(createLineCurve(vec3(1, -1, 2), vec3(2, 3, -1), [-100, 100]));
  for (let i = 0; i < 50; i++) {
    const p = vec3(10 * rnd() - 5, 10 * rnd() - 5, 10 * rnd() - 5);
    const ts = lineProjectionParam(line, p);
    const q = unwrap(curvePoint3(line, ts));
    close(dot3(sub3(p, q), line.direction), 0, 1e-12);
    const c = unwrap(closestPointOnCurve(line, p));
    close(c.t, ts, 0);
    for (const dt of [-1, -1e-3, 1e-3, 2]) {
      const other = unwrap(curvePoint3(line, ts + dt));
      assert.ok(c.distance <= distance3(other, p));
    }
  }
  // Clamping to the range.
  const seg = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(1, 0, 0)));
  assert.equal(unwrap(closestPointOnCurve(seg, vec3(5, 1, 0))).t, 1);
  assert.equal(unwrap(closestPointOnCurve(seg, vec3(-5, 1, 0))).t, 0);
});

/** Brute-force minimum over the range: dense sampling then golden-section refinement. */
function bruteClosest(c: Curve3, p: Vec3): number {
  const [t0, t1] = curveRange(c);
  const N = 20000;
  let bestT = t0, bestD = Infinity;
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const d = distance3(unwrap(curvePoint3(c, t)), p);
    if (d < bestD) { bestD = d; bestT = t; }
  }
  let lo = Math.max(t0, bestT - (t1 - t0) / N), hi = Math.min(t1, bestT + (t1 - t0) / N);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) {
    const a = hi - g * (hi - lo), b = lo + g * (hi - lo);
    if (distance3(unwrap(curvePoint3(c, a)), p) < distance3(unwrap(curvePoint3(c, b)), p)) hi = b; else lo = a;
  }
  const t = (lo + hi) / 2;
  return Math.min(distance3(unwrap(curvePoint3(c, t)), p), bestD);
}

test('circle closest point: exact angle, arcs, and a point on the axis', () => {
  const rnd = lcg(3);
  for (let i = 0; i < 30; i++) {
    const p = add3(circleT.center, vec3(8 * rnd() - 4, 8 * rnd() - 4, 8 * rnd() - 4));
    const c = unwrap(closestPointOnCurve(circleT, p));
    // Exact: the closest point is center + r * unit(in-plane component).
    const q = sub3(p, circleT.center);
    const inPlane = sub3(q, scale3(circleT.frame.normal, dot3(q, circleT.frame.normal)));
    closeV(c.point, add3(circleT.center, scale3(normalize3(inPlane)!, circleT.radius)), 1e-13);
  }
  const arc = unwrap(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, [0, Math.PI / 2]));
  assert.equal(unwrap(closestPointOnCurve(arc, vec3(1, -0.1, 0))).t, 0);
  assert.equal(unwrap(closestPointOnCurve(arc, vec3(-0.1, 1, 0))).t, Math.PI / 2);
  close(unwrap(closestPointOnCurve(arc, vec3(1, 1, 5))).t, Math.PI / 4, 1e-15);
  // Point on the axis: every point is equidistant; the start of the range is returned.
  const onAxis = unwrap(closestPointOnCurve(circleT, add3(circleT.center, scale3(circleT.frame.normal, 2))));
  assert.equal(onAxis.t, 0);
  close(onAxis.distance, Math.hypot(2, circleT.radius), 1e-14);
});

test('ellipse closest point: random points agree with brute force', () => {
  const rnd = lcg(5);
  const e = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 3, 1)) as EllipseCurve;
  for (let i = 0; i < 40; i++) {
    const p = vec3(8 * rnd() - 4, 4 * rnd() - 2, rnd() - 0.5);
    const c = unwrap(closestPointOnCurve(e, p));
    close(c.distance, bruteClosest(e, p), 1e-9, `point ${JSON.stringify(p)}`);
    close(distance3(unwrap(curvePoint3(e, c.t)), p), c.distance, 1e-15);
  }
});

test('ellipse closest point: hard cases (center, axes, near the major-axis evolute, arcs)', () => {
  const a = 3, b = 1;
  const e = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), a, b)) as EllipseCurve;
  // Center: nearest points are the minor vertices; the smaller parameter (π/2) is returned.
  const c0 = unwrap(closestPointOnCurve(e, vec3(0, 0, 0)));
  close(c0.distance, 1, 1e-15);
  close(c0.t, Math.PI / 2, 1e-15);
  // The evolute meets the major axis at x = (a² - b²)/a = 8/3. Inside it, a point on the axis
  // has two off-axis nearest points; outside, the vertex is nearest.
  const xe = (a * a - b * b) / a;
  for (const x of [0.5, 1, 2, xe - 1e-6, xe - 1e-12, xe, xe + 1e-12, xe + 1e-3, 2.9, 3, 3.5]) {
    for (const y of [0, 1e-300, 1e-14, 1e-9, 1e-6, -1e-9, 1e-3]) {
      for (const sx of [1, -1]) {
        const p = vec3(sx * x, y, 0);
        const c = unwrap(closestPointOnCurve(e, p));
        const ref = bruteClosest(e, p);
        close(c.distance, ref, 1e-9, `point (${sx * x}, ${y})`);
        // Stationarity: (C - p)·C' = 0 at the returned parameter. (Ties within rounding, e.g. the
        // vertex θ = 0 against the true minimum θ ≈ 3e-10 for y = 1e-9, are broken towards the
        // smaller parameter, so the residual is only bounded by the size of y there.)
        const ev = unwrap(evaluateCurve3(e, c.t));
        close(dot3(sub3(ev.point, p), ev.d1), 0, 1e-8);
      }
    }
  }
  // On the major axis inside the evolute: the closest point is off the axis, X = a² x / (a² - b²).
  const c1 = unwrap(closestPointOnCurve(e, vec3(1, 0, 0)));
  close(c1.point.x, (a * a * 1) / (a * a - b * b), 1e-14);
  // Near the minor axis.
  for (const y of [0, 0.5, 2, -0.3]) {
    const p = vec3(1e-10, y, 0);
    close(unwrap(closestPointOnCurve(e, p)).distance, bruteClosest(e, p), 1e-9);
  }
  // Arcs: the global nearest point is outside the arc, the second local minimum is inside.
  const lower = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), a, b, [Math.PI, 2 * Math.PI])) as EllipseCurve;
  for (const p of [vec3(1, 0.05, 0), vec3(1, 1e-300, 0), vec3(2, 1e-12, 0), vec3(-2, 0.01, 0), vec3(0.3, 0.2, 0), vec3(5, 3, 1)]) {
    close(unwrap(closestPointOnCurve(lower, p)).distance, bruteClosest(lower, p), 1e-9);
  }
  const small = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), a, b, [-0.4, 0.3])) as EllipseCurve;
  for (const p of [vec3(0, 0, 0), vec3(0, 5, 0), vec3(-3, 0, 0), vec3(2, -0.1, 0)]) {
    close(unwrap(closestPointOnCurve(small, p)).distance, bruteClosest(small, p), 1e-9);
  }
  // Very eccentric ellipse.
  const thin = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, 1e-4)) as EllipseCurve;
  for (const p of [vec3(0.5, 1e-6, 0), vec3(0.999, 1e-5, 0), vec3(0, 0, 0), vec3(0.2, 0.3, 0)]) {
    close(unwrap(closestPointOnCurve(thin, p)).distance, bruteClosest(thin, p), 1e-9);
  }
  // Tilted 3D ellipse: in-plane solve plus the out-of-plane offset.
  const rnd = lcg(9);
  for (let i = 0; i < 10; i++) {
    const p = vec3(6 * rnd() - 3, 6 * rnd() - 3, 6 * rnd() - 3);
    close(unwrap(closestPointOnCurve(ellipseT, p)).distance, bruteClosest(ellipseT, p), 1e-9);
  }
});

test('NURBS closest point agrees with brute force', () => {
  const nurbs = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 0.3, 0.6, 1, 1, 1, 1],
    [[0, 0, 0], [1, 2, 0], [2, -1, 1], [3, 1, 2], [4, 0, 0], [5, 1, 1]], [1, 2, 0.5, 1, 1.5, 1]))));
  const rnd = lcg(21);
  for (let i = 0; i < 15; i++) {
    const p = vec3(6 * rnd() - 1, 4 * rnd() - 2, 3 * rnd() - 1);
    close(unwrap(closestPointOnCurve(nurbs, p)).distance, bruteClosest(nurbs, p), 1e-9);
  }
  // On the NURBS form of a circle, the projection matches the analytic one.
  const nc = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(circleT))));
  const p = vec3(2, 1, -1);
  close(unwrap(closestPointOnCurve(nc, p)).distance, unwrap(closestPointOnCurve(circleT, p)).distance, 1e-12);
  assert.equal(closestPointOnCurve(nc, vec3(NaN, 0, 0)).ok, false);
});

// ---------------------------------------------------------------- transforms

test('transforms: rigid motions keep circles; the image curve is the image of the points', () => {
  const rot = unwrap(rotation(vec3(1, 1, 0), 0.7, vec3(1, 2, 3)));
  const f = unwrap(compose(unwrap(translation(vec3(5, -1, 2))), rot));
  const line = unwrap(createLineCurve(vec3(1, 0, 0), vec3(0, 1, 1), [-1, 2]));
  const nurbs = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(circleT))));
  for (const c of [line, circleT, ellipseT, nurbs] as Curve3[]) {
    const g = unwrap(transformCurve3(K, c, f));
    assert.equal(g.kind, c.kind);
    const [t0, t1] = curveRange(c);
    const [s0] = curveRange(g);
    const shift = s0 - t0; // rigid motions do not shift (except for rounding of a principal-axis shift)
    for (let i = 0; i <= 10; i++) {
      const t = t0 + ((t1 - t0) * i) / 10;
      closeV(unwrap(curvePoint3(g, Math.min(curveRange(g)[1], t + shift))), applyPoint(f, unwrap(curvePoint3(c, t))), 1e-12, c.kind);
    }
  }
  const gc = unwrap(transformCurve3(K, circleT, f)) as CircleCurve;
  close(gc.radius, circleT.radius, 1e-14);
  assert.deepEqual(gc.range, circleT.range);
});

test('transforms: a circle under non-uniform scaling becomes an ellipse (principal_axes_reparam / principal_axes_dot)', () => {
  const s = unwrap(scaling(2, 0.5, 1));
  const tilted = unwrap(createCircleCurve(K, vec3(1, 1, 0), vec3(0, 0, 1), vec3(1, 1, 0), 1, [0.2, 4]));
  const g = unwrap(transformCurve3(K, tilted, s));
  assert.equal(g.kind, 'ellipse');
  const e = g as EllipseCurve;
  close(dot3(e.frame.xAxis, e.frame.yAxis), 0, 1e-15);
  assert.ok(e.majorRadius >= e.minorRadius);
  const shift = e.range[0] - 0.2;
  close(e.range[1] - e.range[0], 3.8, 1e-14);
  for (let i = 0; i <= 20; i++) {
    const t = 0.2 + (3.8 * i) / 20;
    closeV(unwrap(curvePoint3(e, Math.min(e.range[1], Math.max(e.range[0], t + shift)))), applyPoint(s, unwrap(curvePoint3(tilted, t))), 1e-13);
  }
  // Scaling by (2, 0.5) of a unit circle in the xy plane has semi-axes 2 and 0.5.
  const unit = unwrap(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1));
  const ue = unwrap(transformCurve3(K, unit, s)) as EllipseCurve;
  close(ue.majorRadius, 2, 1e-15);
  close(ue.minorRadius, 0.5, 1e-15);
  // Uniform scaling keeps a circle.
  const uc = unwrap(transformCurve3(K, circleT, unwrap(scaling(3, 3, 3)))) as CircleCurve;
  assert.equal(uc.kind, 'circle');
  close(uc.radius, 7.5, 1e-14);
  // An ellipse can be scaled back into a circle.
  const back = unwrap(transformCurve3(K, ue, unwrap(scaling(0.5, 2, 1))));
  assert.equal(back.kind, 'circle');
  // A reflection keeps the parameter direction (the normal flips).
  const mirror = unwrap(transformCurve3(K, unit, unwrap(scaling(1, -1, 1)))) as CircleCurve;
  closeV(unwrap(curvePoint3(mirror, 1)), vec3(Math.cos(1), -Math.sin(1), 0), 1e-15);
  close(mirror.frame.normal.z, -1, 0);
  // Collapsing the plane is degenerate.
  const flat = transformCurve3(K, unit, unwrap(scaling(1, 0, 1)));
  assert.ok(!flat.ok && flat.error.kind === 'degenerate');
  const lineFlat = transformCurve3(K, unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(0, 1, 0))), unwrap(scaling(1, 0, 1)));
  assert.ok(!lineFlat.ok && lineFlat.error.kind === 'degenerate');
});

test('line_dist_decomp: dist²(t) = dist²(t*) + (t - t*)² (d·d)', () => {
  const line = unwrap(createLineCurve(vec3(0.5, -1, 2), vec3(1, -2, 0.5), [-10, 10]));
  const p = vec3(3, 1, -2);
  const ts = lineProjectionParam(line, p);
  const d2 = (t: number): number => distance3(unwrap(curvePoint3(line, t)), p) ** 2;
  const dd = dot3(line.direction, line.direction);
  for (const t of [-7, -1, 0, 0.3, 4, 9]) close(d2(t), d2(ts) + (t - ts) ** 2 * dd, 1e-12);
});

test('principal_axes_dot / principal_axes_reparam: conicFromConjugateAxes yields orthogonal axes and the same curve', () => {
  const rnd = lcg(31);
  for (let i = 0; i < 20; i++) {
    const A = vec3(4 * rnd() - 2, 4 * rnd() - 2, 4 * rnd() - 2);
    const B = vec3(4 * rnd() - 2, 4 * rnd() - 2, 4 * rnd() - 2);
    const c = vec3(rnd(), rnd(), rnd());
    const g = conicFromConjugateAxes(K, c, A, B, [0, 2 * Math.PI]);
    if (!g.ok) continue; // nearly parallel A, B
    const e = g.value;
    close(dot3(e.frame.xAxis, e.frame.yAxis), 0, 1e-15);
    const shift = e.range[0];
    for (let j = 0; j <= 12; j++) {
      const t = (j / 12) * 2 * Math.PI;
      const expected = add3(c, add3(scale3(A, Math.cos(t)), scale3(B, Math.sin(t))));
      const s = Math.min(e.range[1], Math.max(e.range[0], t + shift));
      closeV(unwrap(curvePoint3(e, s)), expected, 1e-12);
    }
  }
});

// ---------------------------------------------------------------- adversarial review regressions

test('arc_mid_from_ends: the middle point is (P0 + P2) / (2 w²) and w P1 is the mid direction', () => {
  for (const [s, e] of [[0, 2 * Math.PI], [0.3, 1.1], [-2, 2.5]] as const) {
    const net = unwrap(unitArcNet(s, e));
    for (let i = 0; i < net.segments; i++) {
      const lo = net.knots[2 + 2 * i]!, hi = net.knots[3 + 2 * i]!;
      const w = net.weights[2 * i + 1]!;
      close(w, Math.cos((hi - lo) / 2), 1e-15);
      const [x, y] = net.points[2 * i + 1]!;
      const m = (lo + hi) / 2;
      close(w * x, Math.cos(m), 1e-15);
      close(w * y, Math.sin(m), 1e-15);
    }
  }
});

test('unitArcNet stays exact for large start angles (segments built from their own knots)', () => {
  for (const s of [1e3, 1e8, 1e15]) {
    const c = unwrap(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, [s, s + 2 * Math.PI])) as CircleCurve;
    const n = unwrap(circleArcToNurbs(c));
    const [u0, u1] = [n.knots[0]!, n.knots[n.knots.length - 1]!];
    for (let i = 0; i <= 200; i++) {
      const [x, y] = unwrap(evaluateCurve(n, u0 + ((u1 - u0) * i) / 200));
      close(Math.hypot(x!, y!), 1, 1e-14, `start ${s}`);
    }
  }
});

test('principal_axes_major: the first principal axis is the major one', () => {
  const rnd = lcg(77);
  for (let i = 0; i < 50; i++) {
    const A = vec3(4 * rnd() - 2, 4 * rnd() - 2, 4 * rnd() - 2);
    const B = vec3(4 * rnd() - 2, 4 * rnd() - 2, 4 * rnd() - 2);
    const g = conicFromConjugateAxes(K, vec3(0, 0, 0), A, B, [0, 1]);
    if (!g.ok || g.value.kind !== 'ellipse') continue;
    const e = g.value;
    // The point at the shifted parameter 0 (t = t0) is at distance a: the maximum over t.
    const t0 = -e.range[0];
    const U = add3(scale3(A, Math.cos(t0)), scale3(B, Math.sin(t0)));
    close(length3(U), e.majorRadius, 1e-13);
    for (let j = 0; j < 64; j++) {
      const t = (j / 64) * 2 * Math.PI;
      assert.ok(length3(add3(scale3(A, Math.cos(t)), scale3(B, Math.sin(t)))) <= e.majorRadius * (1 + 1e-13));
    }
  }
});

test('no ok result carries Infinity or NaN: radius / length overflow, underflowing directions', () => {
  // 1/r overflows (curvature) and r * sweep overflows (length): rejected at construction.
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1e-310).ok, false);
  assert.equal(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1e308).ok, false);
  assert.equal(createLineCurve(vec3(0, 0, 0), vec3(1e154, 0, 0), [-1e154, 1e154]).ok, false);
  // |d|² underflows: the projection parameter would be NaN.
  assert.equal(createLineCurve(vec3(0, 0, 0), vec3(1e-200, 0, 0), [0, 1]).ok, false);
  const tinyOk = unwrap(createLineCurve(vec3(0, 0, 0), vec3(1e-150, 0, 0), [0, 1]));
  assert.equal(unwrap(closestPointOnCurve(tinyOk, vec3(1, 1, 0))).t, 1);
  // A large ellipse: the arc length converges (rounding floor) and is finite.
  const big = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1e10, 1e10 / 3)) as EllipseCurve;
  const L = unwrap(curveArcLength(K, big));
  const small = unwrap(createEllipseCurve(KFINE, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, 1 / 3)) as EllipseCurve;
  close(L / 1e10, unwrap(curveArcLength(KFINE, small)), 1e-12);
});

test('ellipse closest point: huge coordinates and an axis ratio whose e·|y| underflows', () => {
  // Squared distances overflow beyond ~1e154: candidates must still be compared correctly.
  const huge = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1e300, 1e299)) as EllipseCurve;
  const p = vec3(0.5e300, 0.01e299, 0);
  const c = unwrap(closestPointOnCurve(huge, p));
  close(c.distance / 1e299, bruteClosest(huge, p) / 1e299, 1e-9);
  assert.ok(c.distance < 1e299);
  // e = 1e-300 and y1 = 1e-301: e·y1 underflows to 0, the point is on the axis to double precision.
  const flat = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1e300, 1)) as EllipseCurve;
  const r = unwrap(closestPointOnCurve(flat, vec3(0.5e300, 0.1, 0)));
  close(r.t, (5 * Math.PI) / 3, 1e-12); // the axis solution (±π/3; ties broken in parameter order)
  assert.ok(Number.isFinite(r.distance) && r.distance < 1e285);
});

test('outputs are deeply frozen', () => {
  const e = unwrap(evaluateCurve3(circleT, 1));
  assert.ok(Object.isFrozen(e.point) && Object.isFrozen(e.d1) && Object.isFrozen(e.d2));
  const f = unwrap(curveFrenetFrame(K, ellipseT, 0.4));
  assert.ok(Object.isFrozen(f) && Object.isFrozen(f.tangent) && Object.isFrozen(f.normal) && Object.isFrozen(f.binormal));
  assert.ok(Object.isFrozen(unwrap(curveTangent(ellipseT, 0.4))));
  const cp = unwrap(closestPointOnCurve(ellipseT, vec3(1, 2, 3)));
  assert.ok(Object.isFrozen(cp) && Object.isFrozen(cp.point));
  const net = unwrap(unitArcNet(0, 4));
  assert.ok(Object.isFrozen(net.points) && net.points.every((q) => Object.isFrozen(q)) && Object.isFrozen(net.weights));
});

test('seams: full-range arcs starting at -π, end parameters, and 2π wraps', () => {
  const e = unwrap(createEllipseCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 3, 1, [-Math.PI, Math.PI])) as EllipseCurve;
  for (const y of [1e-20, -1e-12, 0.3, -0.3]) {
    const p = vec3(-5, y, 0);
    const c = unwrap(closestPointOnCurve(e, p));
    close(c.distance, bruteClosest(e, p), 1e-9);
    assert.ok(c.t >= -Math.PI && c.t <= Math.PI);
  }
  // NURBS form evaluates at both end knots and matches the analytic end points.
  const n = unwrap(ellipseArcToNurbs(e));
  closeV(P(unwrap(evaluateCurve(n, -Math.PI))), unwrap(curvePoint3(e, -Math.PI)), 1e-15);
  closeV(P(unwrap(evaluateCurve(n, Math.PI))), unwrap(curvePoint3(e, Math.PI)), 1e-15);
  // An arc starting at 3π/2 wrapping past 2π: closest point on the wrapped part.
  const w = unwrap(createCircleCurve(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1, [1.5 * Math.PI, 2.5 * Math.PI])) as CircleCurve;
  close(unwrap(closestPointOnCurve(w, vec3(2, 0.1, 0))).t, 2 * Math.PI + Math.atan2(0.1, 2), 1e-14);
});
