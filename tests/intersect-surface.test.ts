import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap, type Result } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import { closestPointOnCurve, curvePoint3, type Curve3 } from '../src/curve/index.ts';
import { cross3, dot3, length3, normalize3, sub3, vec3, type Point3, type Vec3 } from '../src/math/vec.ts';
import { createNurbsSurface, evaluateCurve } from '../src/nurbs/index.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  implicitValue,
  planeToNurbs,
  projectPoint,
  sphereToNurbs,
  surfacePoint3,
  type Surface3,
} from '../src/surface/index.ts';
import {
  intersectSurfaces,
  intersectSurfacesExact,
  marchSurfaces,
  planePlanePoint,
  surfacePatch,
  type SurfaceIntersection,
  type SurfacePatch,
  type SurfaceSurfaceCurve,
  type SurfaceSurfacePoint,
} from '../src/intersect/index.ts';
import { refusalReason } from '../src/intersect/types.ts';
import { minNormStep, solve3, solveSym2 } from '../src/intersect/linalg.ts';
import { correct, createContext } from '../src/intersect/ssi-newton.ts';
import { marchTangent } from '../src/intersect/ssi-march.ts';
import { boundaryIsoCurve } from '../src/intersect/ssi-boundary.ts';

const kernel = createKernel();
const TOL = kernel.tolerances.zoneTol3d;
const APPROX = kernel.tolerances.approxTol3d;
const TWO_PI = 2 * Math.PI;
const v = vec3;
const unit = (x: number, y: number, z: number): Vec3 => normalize3(v(x, y, z))!;

/** A deterministic pseudo-random sequence (LCG) for the property tests. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

const ref = (n: Vec3): Vec3 => (Math.abs(n.x) < 0.9 ? v(1, 0, 0) : v(0, 1, 0));
const planeP = (o: Point3, n: Vec3, half = 5): SurfacePatch =>
  unwrap(surfacePatch(unwrap(createPlaneSurface(kernel, o, n, ref(n))), { u: [-half, half], v: [-half, half] }));
const cylP = (o: Point3, axis: Vec3, r: number, h = 5): SurfacePatch =>
  unwrap(surfacePatch(unwrap(createCylinderSurface(kernel, o, axis, ref(axis), r)), { u: [0, TWO_PI], v: [-h, h] }));
const sphereP = (c: Point3, r: number, axis: Vec3 = v(0, 0, 1)): SurfacePatch =>
  unwrap(surfacePatch(unwrap(createSphereSurface(kernel, c, axis, ref(axis), r))));
const coneP = (o: Point3, axis: Vec3, base: number, angle: number, v0: number, v1: number): SurfacePatch =>
  unwrap(surfacePatch(unwrap(createConeSurface(kernel, o, axis, ref(axis), base, angle)), { u: [0, TWO_PI], v: [v0, v1] }));
const torusP = (c: Point3, axis: Vec3, R: number, r: number): SurfacePatch =>
  unwrap(surfacePatch(unwrap(createTorusSurface(kernel, c, axis, ref(axis), R, r))));

const curves = (r: SurfaceIntersection): SurfaceSurfaceCurve[] => r.hits.filter((h): h is SurfaceSurfaceCurve => h.kind === 'curve');
const points = (r: SurfaceIntersection): SurfaceSurfacePoint[] => r.hits.filter((h): h is SurfaceSurfacePoint => h.kind === 'point');

/** Largest distance of curve samples to an analytic surface (exact signed distance) or NURBS (projection). */
function distTo(s: Surface3, p: Point3): number {
  if (s.kind === 'nurbs') return unwrap(projectPoint(kernel, s, p)).distance;
  return Math.abs(unwrap(implicitValue(s, p)));
}

function curveSamples(c: Curve3, n = 40): Point3[] {
  const r = c.kind === 'nurbs' ? [c.curve.knots[0]!, c.curve.knots[c.curve.knots.length - 1]!] : c.range;
  const out: Point3[] = [];
  for (let i = 0; i <= n; i++) out.push(unwrap(curvePoint3(c, r[0] + ((r[1] - r[0]) * i) / n)));
  return out;
}

function assertOnBoth(c: Curve3, a: Surface3, b: Surface3, tol: number): void {
  for (const p of curveSamples(c)) {
    assert.ok(distTo(a, p) <= tol, `distance to A ${distTo(a, p)}`);
    assert.ok(distTo(b, p) <= tol, `distance to B ${distTo(b, p)}`);
  }
}

/** Every pcurve lifts onto the 3D curve. */
function assertPcurves(h: SurfaceSurfaceCurve, a: Surface3, b: Surface3, tol: number): void {
  for (const [s, pc] of [[a, h.pcurveA], [b, h.pcurveB]] as const) {
    if (pc === undefined) continue;
    const k0 = pc.knots[0]!, k1 = pc.knots[pc.knots.length - 1]!;
    for (let i = 0; i <= 16; i++) {
      const uv = unwrap(evaluateCurve(pc, k0 + ((k1 - k0) * i) / 16));
      const p = unwrap(surfacePoint3(s, uv[0]!, uv[1]!));
      assert.ok(unwrap(closestPointOnCurve(h.curve, p)).distance <= tol, 'pcurve lifts onto the curve');
    }
  }
}

function refused(r: Result<SurfaceIntersection>): string | undefined {
  return r.ok ? undefined : refusalReason(r.error);
}

// ---------------------------------------------------------------------------------------------
// Lean theorems (formal/CadloomFormal/IntersectSurface.lean), one test each.

test('plane_plane_point_on_first / plane_plane_point_on_second / plane_plane_dir_orth', () => {
  const r = rng(7);
  for (let i = 0; i < 200; i++) {
    const n1 = v(r(), r(), r()), n2 = v(r(), r(), r());
    const d1 = 3 * r(), d2 = 3 * r();
    const w = cross3(n1, n2);
    if (length3(w) < 1e-3) continue;
    const P = planePlanePoint(n1, d1, n2, d2);
    assert.ok(Math.abs(dot3(n1, P) - d1) <= 1e-12 * (1 + Math.abs(d1)) / dot3(w, w));
    assert.ok(Math.abs(dot3(n2, P) - d2) <= 1e-12 * (1 + Math.abs(d2)) / dot3(w, w));
    assert.ok(Math.abs(dot3(w, n1)) <= 1e-15 && Math.abs(dot3(w, n2)) <= 1e-15);
  }
});

test('plane_sphere_center_on_plane / plane_sphere_circle_on_sphere: the exact circle of a plane and a sphere', () => {
  const c = v(0.3, -0.2, 0.5), R = 2;
  const n = unit(0.2, 0.4, 1);
  const O = v(0.5, 0.1, 1.2);
  const res = unwrap(intersectSurfaces(kernel, planeP(O, n), sphereP(c, R)));
  assert.equal(res.class, 'exact');
  const [h] = curves(res);
  assert.ok(h !== undefined && h.curve.kind === 'circle');
  const s = dot3(n, c) - dot3(n, O); // (n·c - d) / (n·n), unit normal
  const center = sub3(c, v(s * n.x, s * n.y, s * n.z));
  assert.ok(length3(sub3(h.curve.center, center)) <= 1e-14);
  assert.ok(Math.abs(dot3(n, h.curve.center) - dot3(n, O)) <= 1e-14);
  assert.ok(Math.abs(h.curve.radius - Math.sqrt(R * R - s * s)) <= 1e-14);
  assertOnBoth(h.curve, res === undefined ? (null as never) : planeP(O, n).surface, sphereP(c, R).surface, 1e-14);
  assert.equal(h.contact, 'transversal');
  assert.ok(h.pcurveA !== undefined, 'plane pcurve');
  assertPcurves(h, planeP(O, n).surface, sphereP(c, R).surface, 1e-12);
});

test('plane_sphere_rho_ts: the compensated radius keeps a tiny circle, and merges below the zone', () => {
  const R = 1;
  for (const gap of [1e-9, 1e-12]) {
    const res = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, R - gap), v(0, 0, 1)), sphereP(v(0, 0, 0), R)));
    const rho = Math.sqrt((R - (R - gap)) * (R + (R - gap)));
    if (2 * rho > TOL) {
      const [h] = curves(res);
      assert.ok(h !== undefined && h.curve.kind === 'circle');
      assert.ok(Math.abs(h.curve.radius - rho) <= 1e-12 * rho + 1e-15, `radius ${h.curve.radius} vs ${rho}`);
    } else {
      assert.equal(curves(res).length, 0);
      const [p] = points(res);
      assert.ok(p !== undefined && p.contact === 'tangent');
    }
  }
});

test('march_tangent_orth / unit_cross_sq: the marching direction is orthogonal to both normals', () => {
  const A = cylP(v(0, 0, 0), v(0, 0, 1), 1, 2), B = cylP(v(0, 0, 0), v(1, 0, 0), 0.5, 2);
  const ctx = createContext(kernel, A, B);
  const s = correct(ctx, [0.4, 0.3, 1.2, 0.9]);
  assert.ok(s !== undefined);
  const t = marchTangent(s, 1);
  assert.ok(Math.abs(dot3(t, s.nA)) <= 1e-14 && Math.abs(dot3(t, s.nB)) <= 1e-14);
  assert.ok(Math.abs(length3(t) - 1) <= 1e-14);
  const c = dot3(s.nA, s.nB);
  assert.ok(Math.abs(s.sin * s.sin - (1 - c * c)) <= 1e-14);
});

test('cross_parallel_zero / lagrange_identity / cross_zero_cauchy', () => {
  const r = rng(11);
  for (let i = 0; i < 100; i++) {
    const a = v(r(), r(), r()), b = v(r(), r(), r()), k = r();
    const c = cross3(a, b);
    const lhs = dot3(c, c), rhs = dot3(a, a) * dot3(b, b) - dot3(a, b) ** 2;
    assert.ok(Math.abs(lhs - rhs) <= 1e-15);
    const z = cross3(a, v(k * a.x, k * a.y, k * a.z));
    assert.ok(length3(z) <= 1e-16);
    assert.ok(Math.abs(dot3(a, v(k * a.x, k * a.y, k * a.z)) ** 2 - dot3(a, a) * dot3(a, a) * k * k) <= 1e-15);
  }
});

test('plane_cylinder_perp_on_both: a plane square to the axis cuts the circle A + hZ of radius r', () => {
  const axis = unit(0.3, -0.1, 1), A = v(0.2, 0.4, -0.3), r = 0.75;
  const O = v(1, -0.5, 2);
  for (const n of [axis, v(-axis.x, -axis.y, -axis.z)]) {
    const P = planeP(O, n, 10), C = cylP(A, axis, r, 10);
    const res = unwrap(intersectSurfaces(kernel, P, C));
    assert.equal(res.class, 'exact');
    const [h] = curves(res);
    assert.ok(h !== undefined && h.curve.kind === 'circle' && h.closed);
    const hgt = dot3(sub3(O, A), axis);
    assert.ok(length3(sub3(h.curve.center, v(A.x + hgt * axis.x, A.y + hgt * axis.y, A.z + hgt * axis.z))) <= 1e-14);
    assert.ok(Math.abs(h.curve.radius - r) <= 1e-15);
    assertOnBoth(h.curve, P.surface, C.surface, 1e-14);
    // The pcurve on the cylinder is the horizontal line v = h.
    assert.ok(h.pcurveB !== undefined);
    for (const cp of h.pcurveB.controlPoints) assert.ok(Math.abs(cp[1]! - hgt) <= 1e-14);
    assertPcurves(h, P.surface, C.surface, 1e-12);
  }
});

test('meridian_line_line: coaxial cylinder and cone meet in one circle', () => {
  const axis = unit(0, 1, 1);
  const cone = coneP(v(0, 0, 0), axis, 0, Math.PI / 6, 0, 4);
  const cyl = cylP(v(0, 0, 0), axis, 1, 6);
  const res = unwrap(intersectSurfaces(kernel, cyl, cone));
  assert.equal(res.class, 'exact');
  const [h] = curves(res);
  assert.equal(curves(res).length, 1);
  assert.ok(h !== undefined && h.curve.kind === 'circle');
  assert.ok(Math.abs(h.curve.radius - 1) <= 1e-14);
  assert.ok(Math.abs(dot3(h.curve.center, axis) - 1 / Math.tan(Math.PI / 6)) <= 1e-13);
  assertOnBoth(h.curve, cyl.surface, cone.surface, 1e-13);
  assert.ok(h.pcurveA !== undefined && h.pcurveB !== undefined, 'coaxial circles have pcurves on both');
  assertPcurves(h, cyl.surface, cone.surface, 1e-12);
});

test('sphere_sphere_on_both: two spheres meet in the radical circle; touch points; concentric', () => {
  const c1 = v(0, 0, 0), c2 = v(1, 1, 0.5), r1 = 1.2, r2 = 1;
  const A = sphereP(c1, r1), B = sphereP(c2, r2, unit(1, 0, 1));
  const res = unwrap(intersectSurfaces(kernel, A, B));
  const [h] = curves(res);
  assert.ok(h !== undefined && h.curve.kind === 'circle');
  const D = length3(c2);
  const x = (D * D + r1 * r1 - r2 * r2) / (2 * D);
  assert.ok(Math.abs(h.curve.radius - Math.sqrt(r1 * r1 - x * x)) <= 1e-14);
  assertOnBoth(h.curve, A.surface, B.surface, 1e-14);
  // External and internal touch: one tangent point each.
  const ext = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(2, 0, 0), 1)));
  assert.deepEqual([curves(ext).length, points(ext).length], [0, 1]);
  assert.ok(length3(sub3(points(ext)[0]!.point, v(1, 0, 0))) <= 1e-15);
  const int = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 2), sphereP(v(0, 1, 0), 1)));
  assert.deepEqual([curves(int).length, points(int).length], [0, 1]);
  assert.equal(points(int)[0]!.contact, 'tangent');
  // Apart, nested, coincident.
  assert.equal(unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(3, 0, 0), 1))).hits.length, 0);
  assert.equal(unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 3), sphereP(v(0.1, 0, 0), 1))).hits.length, 0);
  const co = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(0, 0, 0), 1, v(1, 0, 0))));
  assert.equal(co.coincident, true);
});

test('solveSym2_spec / solve3_spec / minNormStep_spec', () => {
  const r = rng(3);
  for (let i = 0; i < 200; i++) {
    const a = 1 + r(), b = r(), c = 1 + r(), f = r(), g = r();
    const s = solveSym2(a, b, c, f, g);
    assert.ok(s !== undefined);
    assert.ok(Math.abs(a * s[0] + b * s[1] - f) <= 1e-13 && Math.abs(b * s[0] + c * s[1] - g) <= 1e-13);
    const m = [r(), r(), r(), r(), r(), r(), r(), r(), r()] as const;
    const rhs = [r(), r(), r()] as const;
    const y = solve3(m, rhs);
    if (y !== undefined) {
      for (let k = 0; k < 3; k++) {
        const row = m[3 * k]! * y[0] + m[3 * k + 1]! * y[1] + m[3 * k + 2]! * y[2];
        assert.ok(Math.abs(row - rhs[k]!) <= 1e-9 * (1 + Math.abs(y[0]) + Math.abs(y[1]) + Math.abs(y[2])));
      }
    }
    const cols = [v(r(), r(), r()), v(r(), r(), r()), v(r(), r(), r()), v(r(), r(), r())];
    const bb = v(r(), r(), r());
    const d = minNormStep(cols, bb);
    assert.ok(d !== undefined);
    const J = cols.reduce((acc, col, k) => v(acc.x + d[k]! * col.x, acc.y + d[k]! * col.y, acc.z + d[k]! * col.z), v(0, 0, 0));
    assert.ok(length3(sub3(J, bb)) <= 1e-10);
  }
  assert.equal(solveSym2(1, 1, 1, 0, 0), undefined, 'singular');
});

// ---------------------------------------------------------------------------------------------
// The exact classes.

test('plane/plane: line on both with exact pcurves; parallel; coincident', () => {
  const A = planeP(v(0, 0, 0.5), unit(0.1, 0.2, 1)), B = planeP(v(1, 0, 0), unit(1, -0.3, 0.2));
  const res = unwrap(intersectSurfaces(kernel, A, B));
  assert.equal(res.class, 'exact');
  assert.equal(res.method, 'closed-form');
  const [h] = curves(res);
  assert.ok(h !== undefined && h.curve.kind === 'line' && !h.closed);
  assertOnBoth(h.curve, A.surface, B.surface, 1e-14);
  assert.ok(h.deviation <= 1e-14);
  assertPcurves(h, A.surface, B.surface, 1e-12);
  // Its direction is n1 × n2.
  const w = normalize3(cross3(A.surface.kind === 'plane' ? A.surface.frame.normal : v(0, 0, 0), B.surface.kind === 'plane' ? B.surface.frame.normal : v(0, 0, 0)))!;
  assert.ok(length3(sub3(normalize3(h.curve.direction)!, w)) <= 1e-14);
  assert.equal(unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0), v(0, 0, 1)), planeP(v(0, 0, 1), v(0, 0, -1)))).hits.length, 0);
  const co = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0), v(0, 0, 1)), planeP(v(2, 1, 0), v(0, 0, -1))));
  assert.deepEqual([co.coincident, co.hits.length, co.class], [true, 0, 'exact']);
  // The line is dropped when it misses the patch boxes.
  const far = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0), v(0, 0, 1), 1), planeP(v(10, 0, 0), v(1, 0, 0.0), 1)));
  assert.equal(far.hits.length, 0);
});

test('plane/cylinder: two lines, one tangent line, none, oblique ellipse axes', () => {
  const C = cylP(v(0, 0, 0), v(0, 0, 1), 1);
  const two = unwrap(intersectSurfaces(kernel, planeP(v(0.6, 0, 0), v(1, 0, 0)), C));
  assert.equal(curves(two).length, 2);
  for (const h of curves(two)) {
    assert.ok(h.curve.kind === 'line' && h.contact === 'transversal');
    assertOnBoth(h.curve, two.hits.length ? planeP(v(0.6, 0, 0), v(1, 0, 0)).surface : C.surface, C.surface, 1e-14);
    assert.ok(h.pcurveB !== undefined, 'a ruling pcurve on the cylinder');
    assert.equal(h.pcurveB.controlPoints[0]![0], h.pcurveB.controlPoints[1]![0]);
    assertPcurves(h, planeP(v(0.6, 0, 0), v(1, 0, 0)).surface, C.surface, 1e-12);
  }
  // A plane a hair inside the wall: one tangent line, not two lines microns apart.
  const tan = unwrap(intersectSurfaces(kernel, planeP(v(1 - 1e-14, 0, 0), v(1, 0, 0)), C));
  assert.equal(curves(tan).length, 1);
  assert.equal(curves(tan)[0]!.contact, 'tangent');
  assert.equal(unwrap(intersectSurfaces(kernel, planeP(v(1.5, 0, 0), v(1, 0, 0)), C)).hits.length, 0);
  // Oblique: ellipse with minor radius r and major radius r / |cos θ|.
  const theta = 0.6;
  const n = v(Math.sin(theta), 0, Math.cos(theta));
  const P = planeP(v(0, 0, 0.3), n);
  const res = unwrap(intersectSurfaces(kernel, P, C));
  const [e] = curves(res);
  assert.ok(e !== undefined && e.curve.kind === 'ellipse' && e.closed);
  assert.ok(Math.abs(e.curve.minorRadius - 1) <= 1e-14);
  assert.ok(Math.abs(e.curve.majorRadius - 1 / Math.cos(theta)) <= 1e-14);
  assert.ok(length3(sub3(e.curve.center, v(0, 0, 0.3))) <= 1e-14);
  assertOnBoth(e.curve, P.surface, C.surface, 1e-14);
  assert.ok(e.pcurveA !== undefined && e.pcurveB === undefined, 'exact pcurve on the plane only');
  assertPcurves(e, P.surface, C.surface, 1e-12);
});

test('plane/cone: square circle, apex point, rays through the apex, oblique ellipse, hyperbola marched', () => {
  const a = Math.PI / 6;
  const K = coneP(v(0, 0, 0), v(0, 0, 1), 0, a, 0, 3);
  const circ = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 2), v(0, 0, 1)), K));
  assert.equal(curves(circ)[0]!.curve.kind, 'circle');
  assert.ok(Math.abs((curves(circ)[0]!.curve as { radius: number }).radius - 2 * Math.tan(a)) <= 1e-14);
  const apex = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0), v(0, 0, 1)), K));
  assert.deepEqual([curves(apex).length, points(apex).length], [0, 1]);
  assert.ok(length3(points(apex)[0]!.point) <= 1e-15);
  const below = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, -1), v(0, 0, 1)), K));
  assert.equal(below.hits.length, 0, 'the single nappe does not reach below the apex');
  // A plane through the axis: two generators (rays from the apex).
  const Pax = planeP(v(0, 0, 0), v(0, 1, 0));
  const rays = unwrap(intersectSurfaces(kernel, Pax, K));
  assert.equal(curves(rays).length, 2);
  for (const h of curves(rays)) {
    assert.equal(h.curve.kind, 'line');
    assertOnBoth(h.curve, Pax.surface, K.surface, 1e-13);
    assert.ok(h.pcurveB !== undefined);
  }
  // Oblique ellipse section.
  const n = unit(0.3, 0, 1);
  const Pe = planeP(v(0, 0, 1.5), n);
  const ell = unwrap(intersectSurfaces(kernel, Pe, K));
  assert.equal(ell.class, 'exact');
  assert.ok(curves(ell)[0]!.curve.kind === 'ellipse');
  assertOnBoth(curves(ell)[0]!.curve, Pe.surface, K.surface, 1e-13);
  // Hyperbola: no closed form here, the general path returns a certified curve.
  const Ph = planeP(v(0.3, 0, 0), v(1, 0, 0));
  const hyp = unwrap(intersectSurfaces(kernel, Ph, K));
  assert.deepEqual([hyp.class, hyp.method, curves(hyp).length], ['certified', 'marching', 1]);
  const [hc] = curves(hyp);
  assert.ok(hc !== undefined && hc.deviation <= APPROX);
  assertOnBoth(hc.curve, Ph.surface, K.surface, APPROX);
});

test('coaxial: cylinders coincident / apart, parallel cylinders, cylinder/sphere circles and inscribed tangency', () => {
  const ax = unit(1, 1, 0);
  assert.equal(unwrap(intersectSurfaces(kernel, cylP(v(0, 0, 0), ax, 1), cylP(v(1, 1, 0), ax, 1))).coincident, true);
  assert.equal(unwrap(intersectSurfaces(kernel, cylP(v(0, 0, 0), ax, 1), cylP(v(0, 0, 0), ax, 2))).hits.length, 0);
  const p1 = cylP(v(0, 0, 0), v(0, 0, 1), 1), p2 = cylP(v(1.5, 0, 0), v(0, 0, 1), 1);
  const par = unwrap(intersectSurfaces(kernel, p1, p2));
  assert.equal(curves(par).length, 2);
  for (const h of curves(par)) {
    assertOnBoth(h.curve, p1.surface, p2.surface, 1e-14);
    assert.ok(h.pcurveA !== undefined && h.pcurveB !== undefined);
  }
  const tl = unwrap(intersectSurfaces(kernel, p1, cylP(v(2, 0, 0), v(0, 0, 1), 1)));
  assert.equal(curves(tl).length, 1);
  assert.equal(curves(tl)[0]!.contact, 'tangent');
  // Cylinder about the sphere's center: two circles at ±sqrt(R² - r²).
  const C = cylP(v(0, 0, 0), v(0, 0, 1), 0.6), S = sphereP(v(0, 0, 0), 1);
  const cs = unwrap(intersectSurfaces(kernel, C, S));
  assert.equal(curves(cs).length, 2);
  const zs = curves(cs).map((h) => (h.curve.kind === 'circle' ? h.curve.center.z : NaN));
  assert.deepEqual(zs.map((z) => Math.round(z * 1e12) / 1e12), [-0.8, 0.8]);
  for (const h of curves(cs)) {
    assertOnBoth(h.curve, C.surface, S.surface, 1e-14);
    assert.ok(h.pcurveA !== undefined && h.pcurveB !== undefined);
    assertPcurves(h, C.surface, S.surface, 1e-12);
  }
  const ins = unwrap(intersectSurfaces(kernel, cylP(v(0, 0, 0), v(0, 0, 1), 1), S));
  assert.equal(curves(ins).length, 1);
  assert.equal(curves(ins)[0]!.contact, 'tangent');
});

test('coaxial revolutions: torus with a square plane, a sphere and a cylinder', () => {
  const T = torusP(v(0, 0, 0), v(0, 0, 1), 2, 0.5);
  const pt = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0.3), v(0, 0, 1)), T));
  assert.equal(curves(pt).length, 2);
  const radii = curves(pt).map((h) => (h.curve.kind === 'circle' ? h.curve.radius : NaN)).sort((x, y) => x - y);
  assert.ok(Math.abs(radii[0]! - 1.6) <= 1e-14 && Math.abs(radii[1]! - 2.4) <= 1e-14);
  for (const h of curves(pt)) assertPcurves(h, planeP(v(0, 0, 0.3), v(0, 0, 1)).surface, T.surface, 1e-12);
  const top = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0.5), v(0, 0, 1)), T));
  assert.equal(curves(top).length, 1, 'the top circle of the tube is one tangent circle');
  assert.equal(curves(top)[0]!.contact, 'tangent');
  const S = sphereP(v(0, 0, 0), 2);
  const ts = unwrap(intersectSurfaces(kernel, T, S));
  assert.equal(curves(ts).length, 2);
  for (const h of curves(ts)) assertOnBoth(h.curve, T.surface, S.surface, 1e-13);
  const tc = unwrap(intersectSurfaces(kernel, T, cylP(v(0, 0, 0), v(0, 0, 1), 2)));
  assert.equal(curves(tc).length, 2);
  for (const h of curves(tc)) assertOnBoth(h.curve, T.surface, cylP(v(0, 0, 0), v(0, 0, 1), 2).surface, 1e-13);
});

// ---------------------------------------------------------------------------------------------
// The general path.

function assertBranches(res: SurfaceIntersection, A: SurfacePatch, B: SurfacePatch): void {
  assert.equal(res.class, 'certified');
  for (const h of curves(res)) {
    assert.ok(h.polyline !== undefined && h.pcurveA !== undefined && h.pcurveB !== undefined);
    for (const p of h.polyline.points) {
      assert.ok(distTo(A.surface, p) <= TOL && distTo(B.surface, p) <= TOL, 'Newton points on both surfaces');
    }
    assert.ok(h.deviation <= APPROX, `fitted deviation ${h.deviation}`);
    assert.ok((h.pcurveDeviation ?? Infinity) <= APPROX, `pcurve deviation ${h.pcurveDeviation}`);
    assertOnBoth(h.curve, A.surface, B.surface, APPROX);
  }
}

test('perpendicular cylinders of different radii (Steinmetz): two closed branches', () => {
  const A = cylP(v(0, 0, 0), v(0, 0, 1), 1, 2), B = cylP(v(0, 0, 0), v(1, 0, 0), 0.5, 2);
  const res = unwrap(intersectSurfaces(kernel, A, B));
  assert.equal(res.method, 'marching');
  assert.equal(curves(res).length, 2);
  assert.ok(curves(res).every((h) => h.closed));
  assertBranches(res, A, B);
  // Branches run along n_A × n_B.
  for (const h of curves(res)) {
    const ctx = createContext(kernel, A, B);
    const pl = h.polyline!;
    const s = correct(ctx, [pl.uvA[0]!.x, pl.uvA[0]!.y, pl.uvB[0]!.x, pl.uvB[0]!.y])!;
    const t = marchTangent(s, 1);
    assert.ok(dot3(sub3(pl.points[1]!, pl.points[0]!), t) > 0);
  }
  // Deterministic: the same call gives the same answer.
  assert.equal(JSON.stringify(unwrap(intersectSurfaces(kernel, A, B))), JSON.stringify(res));
});

test('perpendicular cylinders of equal radii: the figure eight is refused at its singular points', () => {
  const A = cylP(v(0, 0, 0), v(0, 0, 1), 1, 2), B = cylP(v(0, 0, 0), v(1, 0, 0), 1, 2);
  assert.equal(refused(intersectSurfaces(kernel, A, B)), 'tangent contact not resolved');
});

const saddle = (): SurfacePatch => {
  const a = [1, -1, 1], xs = [-1, 0, 1];
  const net = xs.map((x, i) => xs.map((y, j) => [x, y, a[i]! - a[j]!]));
  return unwrap(surfacePatch(unwrap(createNurbsSurface3(unwrap(createNurbsSurface(2, 2, [0, 0, 0, 1, 1, 1], [0, 0, 0, 1, 1, 1], net))))));
};

test('NURBS saddle z = x² - y² against planes: two hyperbola branches; the branch point is refused', () => {
  const S = saddle();
  const plane = unwrap(createPlaneSurface(kernel, v(0, 0, 0.25), v(0, 0, 1), v(1, 0, 0)));
  const nurbsPlane = unwrap(surfacePatch(unwrap(createNurbsSurface3(unwrap(planeToNurbs(plane, { u: [-2, 2], v: [-2, 2] }))))));
  for (const P of [planeP(v(0, 0, 0.25), v(0, 0, 1), 2), nurbsPlane]) {
    const res = unwrap(intersectSurfaces(kernel, S, P));
    assert.equal(curves(res).length, 2);
    assert.ok(curves(res).every((h) => !h.closed));
    assertBranches(res, S, P);
    // Each branch ends on the saddle's domain boundary (y = ±1, i.e. v ∈ {0, 1}).
    for (const h of curves(res)) {
      const uv = h.polyline!.uvA;
      for (const e of [uv[0]!, uv[uv.length - 1]!]) {
        assert.ok([e.x, e.y].some((t) => Math.abs(t) <= 1e-12 || Math.abs(t - 1) <= 1e-12), 'ends on the boundary');
      }
      // On the saddle the plane z = 1/4 is x² - y² = 1/4.
      for (const p of h.polyline!.points) assert.ok(Math.abs(p.x * p.x - p.y * p.y - 0.25) <= 1e-8);
    }
  }
  const tilted = planeP(v(0, 0, 0.1), unit(0.2, 0.1, 1), 2);
  assertBranches(unwrap(intersectSurfaces(kernel, S, tilted)), S, tilted);
  assert.equal(refused(intersectSurfaces(kernel, S, planeP(v(0, 0, 0), v(0, 0, 1), 2))), 'tangent contact not resolved');
});

test('NURBS sphere against nearly tangent planes: touch point, near miss within the zone, small loop', () => {
  const sph = unwrap(createSphereSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0), 1));
  const S = unwrap(surfacePatch(unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, { u: [0, TWO_PI], v: [-Math.PI / 2, Math.PI / 2] }))))));
  const n = unit(Math.cos(1), Math.sin(1), 0.3);
  const at = (d: number): SurfacePatch => planeP(v(d * n.x, d * n.y, d * n.z), n, 3);
  // Exact touch: one tangent point (not a circle, not two points).
  const touch = unwrap(intersectSurfaces(kernel, S, at(1)));
  assert.deepEqual([curves(touch).length, points(touch).length], [0, 1]);
  const [p] = points(touch);
  assert.ok(p !== undefined && p.contact === 'tangent' && length3(sub3(p.point, n)) <= 1e-9);
  // A loop of radius ~0.014 (cap 1e-4 > zone): one closed branch.
  const loop = unwrap(intersectSurfaces(kernel, S, at(1 - 1e-4)));
  assert.deepEqual([curves(loop).length, points(loop).length], [1, 0]);
  assert.ok(curves(loop)[0]!.closed);
  assertBranches(loop, S, at(1 - 1e-4));
  const rad = Math.sqrt(1 - (1 - 1e-4) ** 2);
  for (const q of curves(loop)[0]!.polyline!.points) {
    assert.ok(Math.abs(length3(sub3(q, v((1 - 1e-4) * n.x, (1 - 1e-4) * n.y, (1 - 1e-4) * n.z))) - rad) <= 1e-8);
  }
});

test('forced marching agrees with the closed form (plane / analytic sphere)', () => {
  const S = sphereP(v(0, 0, 0), 1, unit(1, 0, 0));
  const P = planeP(v(0, 0, 0.4), unit(0.1, 0.2, 1), 2);
  const exact = unwrap(intersectSurfaces(kernel, P, S));
  const marched = unwrap(intersectSurfaces(kernel, P, S, { forceMarching: true }));
  assert.equal(marched.method, 'marching');
  assert.equal(curves(marched).length, 1);
  assertBranches(marched, P, S);
  const circle = curves(exact)[0]!.curve;
  for (const q of curves(marched)[0]!.polyline!.points) assert.ok(unwrap(closestPointOnCurve(circle, q)).distance <= 1e-8);
  assert.equal(unwrap(marchSurfaces(kernel, P, sphereP(v(0, 0, 5), 1))).hits.length, 0, 'apart: proved empty');
});

test('patches, results and refusals: validation, frozen values, budgets', () => {
  assert.equal(surfacePatch(unwrap(createPlaneSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0)))).ok, false);
  assert.equal(surfacePatch(unwrap(createSphereSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0), 1)), { u: [0, 1], v: [-2, 0] }).ok, false);
  assert.equal(surfacePatch(unwrap(createConeSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0), 0, 0.5)), { u: [0, 1], v: [-1, 1] }).ok, false);
  assert.equal(surfacePatch(saddle().surface, { u: [0, 2], v: [0, 1] }).ok, false);
  const res = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, 0), v(0, 0, 1)), sphereP(v(0, 0, 0), 1)));
  assert.ok(Object.isFrozen(res) && Object.isFrozen(res.hits) && Object.isFrozen(res.hits[0]));
  const A = cylP(v(0, 0, 0), v(0, 0, 1), 1, 2), B = cylP(v(0, 0, 0), v(1, 0, 0), 0.5, 2);
  assert.equal(refused(intersectSurfaces(kernel, A, B, { maxPairs: 10 })), 'subdivision budget exceeded');
  assert.equal(refused(intersectSurfaces(kernel, A, B, { maxDepth: 2 })), 'recursion depth exceeded');
  const ex = unwrap(intersectSurfacesExact(kernel, saddle(), planeP(v(0, 0, 0), v(0, 0, 1))));
  assert.equal(ex, undefined, 'no closed form for NURBS');
});

// ---------------------------------------------------------------------------------------------
// Adversarial review regressions.

test('coaxial near tangency: a circle of radius within the zone is one point, never two', () => {
  for (const f of [0.6, 0.9]) {
    const rho = f * TOL;
    const ps = unwrap(intersectSurfaces(kernel, planeP(v(0, 0, Math.sqrt(1 - rho * rho)), v(0, 0, 1)), sphereP(v(0, 0, 0), 1)));
    assert.deepEqual([curves(ps).length, points(ps).length], [0, 1], `plane/sphere rho = ${f} zone`);
    const ss = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(2 * Math.sqrt(1 - rho * rho), 0, 0), 1)));
    assert.deepEqual([curves(ss).length, points(ss).length], [0, 1], `sphere/sphere h = ${f} zone`);
  }
});

test('small loops within the zone gap: a loop wider than the zone is a loop (marching agrees with the closed form)', () => {
  const sph = unwrap(createSphereSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0), 1));
  const SN = unwrap(surfacePatch(unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, { u: [0, TWO_PI], v: [-Math.PI / 2, Math.PI / 2] }))))));
  const n = unit(Math.cos(1), Math.sin(1), 0.3);
  const at = (d: number): SurfacePatch => planeP(v(d * n.x, d * n.y, d * n.z), n, 3);
  // Cap 5e-6 < zone, loop radius 3.2e-3 >> zone: one closed loop on every path (before the review:
  // a touch point on the NURBS path, a loop plus a touch point on the forced analytic path).
  for (const gap of [5e-6, 1e-9]) {
    const P = at(1 - gap);
    const rho = Math.sqrt(1 - (1 - gap) ** 2);
    for (const res of [unwrap(intersectSurfaces(kernel, SN, P)), unwrap(intersectSurfaces(kernel, P, sphereP(v(0, 0, 0), 1), { forceMarching: true }))]) {
      assert.deepEqual([curves(res).length, points(res).length], [1, 0], `gap ${gap}`);
      const [h] = curves(res);
      assert.ok(h !== undefined && h.closed);
      for (const q of h.polyline!.points) {
        assert.ok(Math.abs(length3(sub3(q, v((1 - gap) * n.x, (1 - gap) * n.y, (1 - gap) * n.z))) - rho) <= 1e-3 * rho, 'on the circle (no spiral)');
      }
    }
  }
  // Radius within the zone: one touch point, as the closed form.
  const tiny = unwrap(intersectSurfaces(kernel, SN, at(1 - 2e-11)));
  assert.deepEqual([curves(tiny).length, points(tiny).length], [0, 1]);
});

test('torus against planes parallel to its axis: ovals, a 1e-9 crossing loop, a touch, the saddle refused', () => {
  const T = torusP(v(0, 0, 0), v(0, 0, 1), 2, 0.5);
  const at = (d: number): SurfacePatch => unwrap(surfacePatch(unwrap(createPlaneSurface(kernel, v(d, 0, 0), v(1, 0, 0), v(0, 1, 0))), { u: [-4, 4], v: [-4, 4] }));
  const count = (d: number): [number, number] => {
    const r = unwrap(intersectSurfaces(kernel, at(d), T));
    return [curves(r).length, points(r).length];
  };
  assert.deepEqual(count(0.3), [2, 0]);
  assert.deepEqual(count(1.499), [2, 0]);
  assert.deepEqual(count(1.501), [1, 0]);
  assert.deepEqual(count(2.5 - 1e-9), [1, 0], 'loop of semi-axes 3e-5 and 7e-5');
  assert.deepEqual(count(2.5), [0, 1]);
  // A near miss within the zone: a touch, or nothing when the certified boxes are already apart
  // (the subdivision drops pairs by exact disjointness, with no zone slack) — never a curve.
  const miss = count(2.5 + 1e-9);
  assert.ok(miss[0] === 0 && miss[1] <= 1);
  assert.deepEqual(count(2.6), [0, 0]);
  assert.equal(refused(intersectSurfaces(kernel, at(1.5), T)), 'tangent contact not resolved');
});

test('curves grazing a patch boundary: no duplicated arcs, no refusal of a corner graze', () => {
  const S = sphereP(v(0, 0, 0), 1);
  const pl = unwrap(createPlaneSurface(kernel, v(0, 0, Math.sqrt(0.75)), v(0, 0, 1), v(1, 0, 0)));
  const run = (u: readonly [number, number], w: readonly [number, number]): SurfaceIntersection =>
    unwrap(intersectSurfaces(kernel, unwrap(surfacePatch(pl, { u, v: w })), S, { forceMarching: true }));
  // Clearly inside / clearly cut (beyond the zone): exact counts.
  assert.deepEqual(run([-0.5 - 1e-5, 0.5 + 1e-5], [-1, 1]).hits.map((h) => h.kind === 'curve' && h.closed), [true]);
  assert.deepEqual(run([-1, 0.5 - 1e-4], [-1, 1]).hits.map((h) => h.kind === 'curve' && h.closed), [false]);
  assert.equal(curves(run([-0.5 + 1e-4, 0.5 - 1e-4], [-1, 1])).length, 2);
  // Within the zone of both bounds: one loop or its two halves, never an arc twice.
  for (const e of [1e-8, 1e-10, 0, -1e-10, -1e-8]) {
    const r = run([-0.5 - e, 0.5 + e], [-1, 1]);
    const cs = curves(r);
    assert.ok(cs.length >= 1 && cs.length <= 2, `strip ${e}: ${cs.length}`);
    if (cs.length === 2) {
      const mids = cs.map((h) => h.polyline!.points[Math.floor(h.polyline!.points.length / 2)]!);
      assert.ok(Math.abs(mids[0]!.y - mids[1]!.y) > 0.5, 'the two halves are different arcs');
    }
  }
  // The circle through a patch corner: the big arc plus at most a point there.
  const a = 0.5 * Math.SQRT1_2;
  for (const e of [1e-12, 0, -1e-10]) {
    const r = run([-1, a + e], [-1, a + e]);
    assert.equal(curves(r).length, 1);
    assert.ok(points(r).length <= 1);
  }
});

test('validation: hand-made patches, options and kernel tolerances are checked', () => {
  const pl = unwrap(createPlaneSurface(kernel, v(0, 0, 0.2), v(0, 0, 1), v(1, 0, 0)));
  const sph = unwrap(createSphereSurface(kernel, v(0, 0, 0), v(0, 0, 1), v(1, 0, 0), 1));
  const P = unwrap(surfacePatch(pl, { u: [-2, 2], v: [-2, 2] }));
  const bad: SurfacePatch = { surface: sph, domain: { u: [0, 1], v: [-3, 3] } };
  assert.equal(intersectSurfaces(kernel, P, bad).ok, false);
  assert.equal(marchSurfaces(kernel, P, bad).ok, false);
  assert.equal(intersectSurfacesExact(kernel, P, bad).ok, false);
  const S = sphereP(v(0, 0, 0), 1);
  for (const o of [{ maxPairs: NaN }, { maxDepth: 0 }, { maxBranchPoints: 1.5 }, { maxTurn: 0 }, { maxTurn: 1 }, { maxTurn: NaN }]) {
    const r = intersectSurfaces(kernel, P, S, { ...o, forceMarching: true });
    assert.ok(!r.ok && r.error.kind === 'invalid-input', JSON.stringify(o));
  }
  for (const zone of [0, NaN, Infinity]) {
    const k = createKernel({ zoneTol3d: zone, xsectTol3d: 2 * zone, approxTol3d: zone / 2 });
    assert.equal(intersectSurfaces(k, P, S).ok, false);
    assert.equal(marchSurfaces(k, P, S).ok, false);
  }
});

// ---------------------------------------------------------------------------------------------
// Second adversarial review regressions.

test('boundary_meridian_frame / boundary_meridian_normal_unit: every boundary iso-curve runs on its surface', () => {
  const patches: SurfacePatch[] = [
    unwrap(surfacePatch(unwrap(createPlaneSurface(kernel, v(0.1, 0.2, 0.3), unit(0.2, 0.3, 1), v(1, 0, 0))), { u: [-1, 2], v: [-0.5, 1.5] })),
    unwrap(surfacePatch(unwrap(createCylinderSurface(kernel, v(0.1, 0, 0), unit(0.1, 1, 0.2), v(1, 0, 0), 0.7)), { u: [0.3, 4], v: [-1, 2] })),
    unwrap(surfacePatch(unwrap(createConeSurface(kernel, v(0, 0.2, 0), unit(1, 0.2, 0.1), v(0, 0, 1), 0.4, -0.3)), { u: [1, 5], v: [-1, 1] })),
    unwrap(surfacePatch(unwrap(createSphereSurface(kernel, v(0, 0, 1), unit(0.3, 0.1, 1), v(1, 0, 0), 1.3)), { u: [0.5, 3], v: [-1, 1.2] })),
    unwrap(surfacePatch(unwrap(createTorusSurface(kernel, v(1, 0, 0), unit(0, 0.4, 1), v(1, 0, 0), 2, 0.5)), { u: [-1, 2], v: [0.5, 4] })),
    saddle(),
  ];
  for (const P of patches) {
    const ctx = createContext(kernel, P, P);
    for (const dir of ['u', 'v'] as const) {
      for (const value of P.domain[dir]) {
        const iso = unwrap(boundaryIsoCurve(ctx, P, dir, value));
        assert.ok(iso !== undefined, `${P.surface.kind} ${dir}`);
        const [t0, t1] = dir === 'u' ? P.domain.v : P.domain.u;
        for (let i = 0; i <= 8; i++) {
          const t = i === 8 ? t1 : t0 + ((t1 - t0) * i) / 8;
          const c = unwrap(curvePoint3(iso, t));
          const q = unwrap(surfacePoint3(P.surface, dir === 'u' ? value : t, dir === 'u' ? t : value));
          assert.ok(length3(sub3(c, q)) <= 1e-12 * 8, `${P.surface.kind} ${dir}=${value} t=${t}`);
        }
      }
    }
  }
  // A pole and a cone apex are no curves.
  const S = sphereP(v(0, 0, 0), 1);
  assert.equal(unwrap(boundaryIsoCurve(createContext(kernel, S, S), S, 'v', Math.PI / 2)), undefined);
  const K = coneP(v(0, 0, 0), v(0, 0, 1), 0, 0.5, 0, 2);
  assert.equal(unwrap(boundaryIsoCurve(createContext(kernel, K, K), K, 'v', 0)), undefined);
});

/** The graph `z = y - 1 + d(x)` with `d` a cubic B-spline equal to `amp` at `bumps` and `base` elsewhere. */
function bumpyGraph(bumps: readonly number[], amp: number, base: number): SurfacePatch {
  const h = 0.025, n = 120;
  const knots = [-1.5, -1.5, -1.5];
  for (let i = 0; i <= n; i++) knots.push(-1.5 + i * h);
  knots.push(1.5, 1.5, 1.5);
  const net: number[][][] = [];
  for (let i = 0; i < knots.length - 4; i++) {
    const x = (knots[i + 1]! + knots[i + 2]! + knots[i + 3]!) / 3;
    const d = bumps.some((b) => Math.abs(x - b) < 1e-9) ? amp : base;
    net.push([-1.5, 1.5].map((y) => [x, y, y - 1 + d]));
  }
  return unwrap(surfacePatch(unwrap(createNurbsSurface3(unwrap(createNurbsSurface(3, 1, knots, [0, 0, 1, 1], net))))));
}

test('boundary crossings: two short arcs dipping through one leaf side are both traced', () => {
  // Before the review one Newton start per leaf side found one of the two arcs (both within one
  // subdivision leaf on the plane patch's edge y = 1); the coverage test then took the leaf as
  // explained and the second arc was dropped silently.
  const P = planeP(v(0, 0, 0), v(0, 0, 1), 1);
  const B = bumpyGraph([0, 0.05], 0.012, -0.01);
  // Ground truth: the arcs are where d(x) = z(x, y = 1) >= 0 on the edge (sign changes, dense samples).
  const ends: number[] = [];
  let prev = false;
  for (let i = 0; i <= 4000; i++) {
    const x = -1 + i / 2000;
    const inside = unwrap(surfacePoint3(B.surface, x, 2.5 / 3)).z >= 0;
    if (inside !== prev) ends.push(x);
    prev = inside;
  }
  assert.equal(ends.length, 4, 'two arcs on the edge');
  const res = unwrap(intersectSurfaces(kernel, P, B));
  assert.equal(curves(res).length, 2);
  assert.equal(points(res).length, 0);
  assertBranches(res, P, B);
  const got = curves(res).flatMap((h) => [h.polyline!.points[0]!.x, h.polyline!.points[h.polyline!.points.length - 1]!.x]).sort((a, b) => a - b);
  got.forEach((x, i) => assert.ok(Math.abs(x - ends[i]!) <= 1e-3, `arc end ${x} vs ${ends[i]}`));
});

test('coincident within the zone: parallel cylinders and spheres offset by less than the zone', () => {
  // Before the review: two transversal lines / a transversal great circle between surfaces that
  // are within the zone of each other everywhere.
  for (const [d, dr] of [[0.5, 0], [0.5, 0.2], [0.9, 0.05]] as const) {
    const cc = unwrap(intersectSurfaces(kernel, cylP(v(0, 0, 0), v(0, 0, 1), 1), cylP(v(d * TOL, 0, 0), v(0, 0, 1), 1 + dr * TOL)));
    assert.ok(cc.coincident && cc.hits.length === 0, `cylinders ${d} ${dr}`);
    const ss = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(d * TOL, 0, 0), 1 + dr * TOL)));
    assert.ok(ss.coincident && ss.hits.length === 0, `spheres ${d} ${dr}`);
  }
  // Just outside the zone: the crossing lines and circle are kept.
  const cc = unwrap(intersectSurfaces(kernel, cylP(v(0, 0, 0), v(0, 0, 1), 1), cylP(v(2 * TOL, 0, 0), v(0, 0, 1), 1)));
  assert.equal(cc.coincident, false);
  assert.equal(curves(cc).length, 2);
  const ss = unwrap(intersectSurfaces(kernel, sphereP(v(0, 0, 0), 1), sphereP(v(2 * TOL, 0, 0), 1)));
  assert.equal(ss.coincident, false);
  assert.equal(curves(ss).length, 1);
});

test('a march stalling at the tangency of a Viviani curve is refused as a tangent contact', () => {
  // Cylinder of radius 1/2 through the center of the unit sphere: the figure eight touches itself
  // where the surfaces are tangent, at (1, 0, 0). Before the review: 'newton did not converge'.
  const S = unwrap(surfacePatch(unwrap(createSphereSurface(kernel, v(0, 0, 0), v(1, 0, 0), v(0, 1, 0), 1))));
  const C = cylP(v(0.5, 0, 0), v(0, 0, 1), 0.5, 2);
  assert.equal(refused(intersectSurfaces(kernel, C, S)), 'tangent contact not resolved');
});
