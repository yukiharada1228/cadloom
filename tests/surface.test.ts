import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap, type Result } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import { add3, cross3, distance3, dot3, length3, normalize3, scale3, sub3, vec3, type Point3, type Vec3 } from '../src/math/vec.ts';
import { applyPoint, compose, rotation, scaling, translation, type Transform } from '../src/math/transform.ts';
import { createNurbsCurve, evaluateCurve } from '../src/nurbs/curve.ts';
import { evaluateSurface, surfaceDomain, surfaceNormal } from '../src/nurbs/surface.ts';
import { unitArcAngleOfParam, unitArcNet } from '../src/curve/conic.ts';
import {
  coneToNurbs,
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  cylinderToNurbs,
  evaluateSurface3,
  implicitValue,
  normalCurvature,
  planeToNurbs,
  projectPoint,
  revolveCurveToNurbs,
  sphereToNurbs,
  surfaceCurvature,
  surfaceNormal3,
  surfacePoint3,
  surfaceToNurbs,
  torusToNurbs,
  transformSurface3,
  type ConeSurface,
  type CylinderSurface,
  type ParamBox,
  type SphereSurface,
  type Surface3,
  type TorusSurface,
} from '../src/surface/index.ts';

const K = createKernel();

/** Deterministic pseudo-random numbers (LCG). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const O = vec3(1, -2, 0.5);
const AXIS = vec3(0.3, -0.4, 0.86);
const XREF = vec3(1, 0.2, -0.1);

const cyl = unwrap(createCylinderSurface(K, O, AXIS, XREF, 2.5)) as CylinderSurface;
const cone = unwrap(createConeSurface(K, O, AXIS, XREF, 1.5, 0.4)) as ConeSurface;
const coneNeg = unwrap(createConeSurface(K, O, AXIS, XREF, 2, -0.6)) as ConeSurface;
const sph = unwrap(createSphereSurface(K, O, AXIS, XREF, 3)) as SphereSurface;
const tor = unwrap(createTorusSurface(K, O, AXIS, XREF, 4, 1.25)) as TorusSurface;
const pln = unwrap(createPlaneSurface(K, O, AXIS, XREF));

function close(a: number, b: number, tol: number, msg = ''): void {
  assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a} (tol ${tol})`);
}
function closeVec(a: Vec3, b: Vec3, tol: number, msg = ''): void {
  assert.ok(distance3(a, b) <= tol, `${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function errKind<T>(r: Result<T>): string {
  assert.equal(r.ok, false);
  return r.ok ? '' : r.error.kind;
}
const local = (s: { frame: { xAxis: Vec3; yAxis: Vec3; normal: Vec3 } }, o: Point3, p: Point3): [number, number, number] => {
  const d = sub3(p, o);
  return [dot3(d, s.frame.xAxis), dot3(d, s.frame.yAxis), dot3(d, s.frame.normal)];
};

/** Sample parameters valid for each analytic surface. */
function params(s: Surface3, n = 40, seed = 7): [number, number][] {
  const r = rng(seed);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = -7 + 14 * r();
    let v: number;
    if (s.kind === 'sphere') v = (-0.49 + 0.98 * r()) * Math.PI;
    else if (s.kind === 'cone') v = s.semiAngle > 0 ? -3 + 8 * r() : -4 + 6 * r();
    else if (s.kind === 'torus') v = -7 + 14 * r();
    else v = -5 + 10 * r();
    out.push([u, v]);
  }
  return out;
}

// ------------------------------------------------------------ constructors ---

test('constructors validate and freeze', () => {
  assert.ok(Object.isFrozen(cyl) && Object.isFrozen(cyl.frame) && Object.isFrozen(cyl.origin));
  assert.equal(errKind(createTorusSurface(K, O, AXIS, XREF, 1, 1)), 'invalid-input'); // horn
  assert.equal(errKind(createTorusSurface(K, O, AXIS, XREF, 1, 2)), 'invalid-input'); // spindle
  assert.equal(errKind(createTorusSurface(K, O, AXIS, XREF, 2, 0)), 'invalid-input');
  assert.equal(errKind(createConeSurface(K, O, AXIS, XREF, 1, 0)), 'invalid-input');
  assert.equal(errKind(createConeSurface(K, O, AXIS, XREF, 1, Math.PI / 2)), 'invalid-input');
  assert.equal(errKind(createConeSurface(K, O, AXIS, XREF, -1, 0.3)), 'invalid-input');
  assert.equal(errKind(createSphereSurface(K, O, AXIS, XREF, -1)), 'invalid-input');
  assert.equal(errKind(createSphereSurface(K, O, AXIS, XREF, Number.NaN)), 'invalid-input');
  assert.equal(errKind(createCylinderSurface(K, O, AXIS, AXIS, 1)), 'invalid-input'); // parallel frame
  assert.equal(errKind(createPlaneSurface(K, vec3(Infinity, 0, 0), AXIS, XREF)), 'invalid-input');
  assert.ok(createConeSurface(K, O, AXIS, XREF, 0, 0.3).ok); // apex at the origin
  const flat = unwrap(createNurbsSurface3(unwrap(planeToNurbs(pln, { u: [0, 1], v: [0, 1] }))));
  assert.equal(flat.kind, 'nurbs');
});

test('evaluation rejects parameters outside the surface (sphere latitude, cone past the apex, NaN)', () => {
  assert.equal(errKind(evaluateSurface3(sph, 0, 2)), 'invalid-input');
  assert.equal(errKind(evaluateSurface3(cyl, Number.NaN, 0)), 'invalid-input');
  // apex of `cone` at v = -1.5 / tan 0.4
  const apexV = -1.5 / Math.tan(0.4);
  assert.equal(errKind(evaluateSurface3(cone, 0, apexV - 0.1)), 'invalid-input');
  assert.ok(evaluateSurface3(cone, 0, apexV).ok);
  assert.ok(evaluateSurface3(sph, 0, Math.PI / 2).ok);
});

// --------------------------------------------------------- implicit equations ---

test('cylinder_on_implicit: points satisfy dist(axis)² = r² and height = v', () => {
  for (const [u, v] of params(cyl)) {
    const p = unwrap(surfacePoint3(cyl, u, v));
    const [x, y, z] = local(cyl, O, p);
    close(x * x + y * y, 2.5 * 2.5, 1e-12 * 50);
    close(z, v, 1e-12 * 10);
    close(unwrap(implicitValue(cyl, p)), 0, 1e-12 * 10);
  }
});

test('sphere_on_implicit: |p - c|² = r²', () => {
  for (const [u, v] of params(sph)) {
    const p = unwrap(surfacePoint3(sph, u, v));
    close(dot3(sub3(p, O), sub3(p, O)), 9, 1e-12 * 50);
    close(unwrap(implicitValue(sph, p)), 0, 1e-12 * 10);
  }
});

test('torus_local_implicit / torus_meridian: the quartic and the tube circle in local coordinates', () => {
  const R = 4, r = 1.25;
  for (const [u, v] of params(tor)) {
    const p = unwrap(surfacePoint3(tor, u, v));
    const [x, y, z] = local(tor, O, p);
    const q = x * x + y * y + z * z + R * R - r * r;
    close(q * q, 4 * R * R * (x * x + y * y), 1e-12 * 1e4);
    close((Math.hypot(x, y) - R) ** 2 + z * z, r * r, 1e-12 * 100);
    close(unwrap(implicitValue(tor, p)), 0, 1e-12 * 10);
  }
});

test('cone_on_implicit: dist(axis)² = (b + t h)²', () => {
  for (const s of [cone, coneNeg]) {
    const t = Math.tan(s.semiAngle);
    for (const [u, v] of params(s)) {
      const p = unwrap(surfacePoint3(s, u, v));
      const [x, y, z] = local(s, O, p);
      close(x * x + y * y, (s.baseRadius + t * z) ** 2, 1e-12 * 100);
      close(unwrap(implicitValue(s, p)), 0, 1e-12 * 20);
    }
  }
});

test('plane_signed_distance and plane_normal_eq_cross', () => {
  const r = rng(3);
  for (let i = 0; i < 30; i++) {
    const a = 10 * r() - 5, b = 10 * r() - 5, h = 10 * r() - 5;
    const p = add3(unwrap(surfacePoint3(pln, a, b)), scale3(pln.frame.normal, h));
    close(unwrap(implicitValue(pln, p)), h, 1e-12 * 10);
    const n = unwrap(surfaceNormal3(K, pln, a, b));
    closeVec(n, pln.frame.normal, 1e-15);
    closeVec(cross3(pln.frame.xAxis, pln.frame.yAxis), pln.frame.normal, 1e-15);
  }
});

test('cone_meridian_zero / cone_foot_decomp / cone_foot_radius: implicitValue is the signed distance', () => {
  const r = rng(11);
  for (const s of [cone, coneNeg]) {
    for (let i = 0; i < 200; i++) {
      const p = vec3(O.x + 12 * r() - 6, O.y + 12 * r() - 6, O.z + 12 * r() - 6);
      const val = unwrap(implicitValue(s, p));
      const pr = unwrap(projectPoint(K, s, p));
      close(Math.abs(val), pr.distance, 1e-12 * 100, 'distance');
      close(distance3(p, pr.point), pr.distance, 1e-11, 'point');
      close(unwrap(implicitValue(s, pr.point)), 0, 1e-11, 'on surface');
      // brute force: no sampled surface point is nearer
      for (let k = 0; k < 40; k++) {
        const [u, v] = [2 * Math.PI * r(), params(s, 1, i * 41 + k)[0]![1]];
        const q = unwrap(surfacePoint3(s, u, v));
        assert.ok(distance3(p, q) >= pr.distance - 1e-9);
      }
    }
  }
});

// ------------------------------------------------------------- curvature ---

test('sphere_cross_eq / sphere_gauss / sphere_mean: K = 1/r², H = -1/r, outward normal', () => {
  for (const [u, v] of params(sph)) {
    const c = unwrap(surfaceCurvature(K, sph, u, v));
    const p = unwrap(surfacePoint3(sph, u, v));
    closeVec(c.normal, scale3(sub3(p, O), 1 / 3), 1e-12);
    close(c.gaussian, 1 / 9, 1e-12);
    close(c.mean, -1 / 3, 1e-12);
    close(c.principal[0], -1 / 3, 1e-6);
    close(c.principal[1], -1 / 3, 1e-6);
  }
});

test('cylinder_cross_eq / cylinder_gauss / cylinder_mean: K = 0, H = -1/(2r), principal 0 and -1/r', () => {
  for (const [u, v] of params(cyl)) {
    const c = unwrap(surfaceCurvature(K, cyl, u, v));
    const p = unwrap(surfacePoint3(cyl, u, v));
    const [x, y] = local(cyl, O, p);
    const outward = add3(scale3(cyl.frame.xAxis, x / 2.5), scale3(cyl.frame.yAxis, y / 2.5));
    closeVec(c.normal, outward, 1e-12);
    close(c.gaussian, 0, 1e-15);
    close(c.mean, -1 / 5, 1e-14);
    close(c.principal[0], 0, 1e-14);
    close(c.principal[1], -1 / 2.5, 1e-14);
    close(unwrap(normalCurvature(K, cyl, u, v, 1, 0)), -1 / 2.5, 1e-14);
    close(unwrap(normalCurvature(K, cyl, u, v, 0, 1)), 0, 1e-15);
  }
});

test('torus_cross_eq / torus_gauss: K = cos v / (r (R + r cos v)) changes sign between the equators', () => {
  const R = 4, r = 1.25;
  for (const [u, v] of params(tor)) {
    const c = unwrap(surfaceCurvature(K, tor, u, v));
    close(c.gaussian, Math.cos(v) / (r * (R + r * Math.cos(v))), 1e-13);
    // outward from the core circle
    const p = unwrap(surfacePoint3(tor, u, v));
    const core = add3(O, scale3(add3(scale3(tor.frame.xAxis, Math.cos(u)), scale3(tor.frame.yAxis, Math.sin(u))), R));
    closeVec(c.normal, scale3(sub3(p, core), 1 / r), 1e-12);
  }
  const outer = unwrap(surfaceCurvature(K, tor, 0.3, 0));
  const inner = unwrap(surfaceCurvature(K, tor, 0.3, Math.PI));
  assert.ok(outer.gaussian > 0 && inner.gaussian < 0);
  close(outer.gaussian, 1 / (r * (R + r)), 1e-14);
  close(inner.gaussian, -1 / (r * (R - r)), 1e-14);
  close(unwrap(surfaceCurvature(K, tor, 0.3, Math.PI / 2)).gaussian, 0, 1e-15);
});

test('cone_cross_eq / cone_gauss: K = 0, normal ∝ e - tan(α) Z, H = -cos α / (2 R(v))', () => {
  for (const s of [cone, coneNeg]) {
    const t = Math.tan(s.semiAngle);
    for (const [u, v] of params(s)) {
      const R = s.baseRadius + t * v;
      if (R < 1e-3) continue;
      const c = unwrap(surfaceCurvature(K, s, u, v));
      const e = add3(scale3(s.frame.xAxis, Math.cos(u)), scale3(s.frame.yAxis, Math.sin(u)));
      closeVec(c.normal, normalize3(sub3(e, scale3(s.frame.normal, t)))!, 1e-12);
      close(c.gaussian, 0, 1e-13);
      close(c.mean, -Math.cos(s.semiAngle) / (2 * R), 1e-12 / R);
    }
  }
});

test('analytic partial derivatives agree with central differences', () => {
  const h = 1e-5;
  for (const s of [cyl, cone, sph, tor, pln] as Surface3[]) {
    for (const [u, v] of params(s, 10, 5)) {
      const d = unwrap(evaluateSurface3(s, u, v));
      const P = (a: number, b: number): Point3 => unwrap(evaluateSurface3(s, a, b)).point;
      const D = (a: number, b: number) => unwrap(evaluateSurface3(s, a, b));
      closeVec(d.su, scale3(sub3(P(u + h, v), P(u - h, v)), 1 / (2 * h)), 1e-8);
      closeVec(d.sv, scale3(sub3(P(u, v + h), P(u, v - h)), 1 / (2 * h)), 1e-8);
      closeVec(d.suu, scale3(sub3(D(u + h, v).su, D(u - h, v).su), 1 / (2 * h)), 1e-8);
      closeVec(d.suv, scale3(sub3(D(u, v + h).su, D(u, v - h).su), 1 / (2 * h)), 1e-8);
      closeVec(d.svv, scale3(sub3(D(u, v + h).sv, D(u, v - h).sv), 1 / (2 * h)), 1e-8);
    }
  }
});

test('the normal is degenerate at the sphere poles and the cone apex (no NaN)', () => {
  assert.equal(errKind(surfaceNormal3(K, sph, 0.4, Math.PI / 2)), 'degenerate');
  assert.equal(errKind(surfaceNormal3(K, sph, 0.4, -Math.PI / 2)), 'degenerate');
  assert.equal(errKind(surfaceCurvature(K, sph, 0.4, Math.PI / 2)), 'degenerate');
  const apexV = -1.5 / Math.tan(0.4);
  assert.equal(errKind(surfaceNormal3(K, cone, 1, apexV)), 'degenerate');
  assert.ok(surfaceNormal3(K, sph, 0.4, Math.PI / 2 - 1e-3).ok);
});

// ------------------------------------------------------------- projection ---

test('projection round trips: S(u, v) + h n projects back to (u, v) at distance |h|', () => {
  const r = rng(19);
  const TWO_PI = 2 * Math.PI;
  const angDiff = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const s of [pln, cyl, cone, coneNeg, sph, tor] as Surface3[]) {
    for (const [u, v] of params(s, 60, 23)) {
      const d = unwrap(evaluateSurface3(s, u, v));
      const n = surfaceNormal3(K, s, u, v);
      if (!n.ok) continue;
      // stay well inside the local reach (curvature radius) of the surface
      const h = (r() - 0.5) * (s.kind === 'torus' ? 1.5 : s.kind === 'cone' ? 0.5 : 2);
      const p = add3(d.point, scale3(n.value, h));
      const pr = unwrap(projectPoint(K, s, p));
      close(pr.distance, Math.abs(h), 1e-11, `${s.kind} distance`);
      closeVec(pr.point, d.point, 1e-11, `${s.kind} point`);
      close(unwrap(implicitValue(s, p)), h, 1e-11, `${s.kind} signed`);
      if (s.kind === 'plane') {
        close(pr.u, u, 1e-11);
        close(pr.v, v, 1e-11);
      } else {
        assert.ok(pr.u >= 0 && pr.u < TWO_PI);
        close(angDiff(pr.u, u), 0, 1e-11, `${s.kind} u`);
        if (s.kind === 'torus') close(angDiff(pr.v, v), 0, 1e-11, 'torus v');
        else close(pr.v, v, 1e-11, `${s.kind} v`);
      }
      closeVec(unwrap(surfacePoint3(s, pr.u, pr.v)), pr.point, 1e-11);
    }
  }
});

test('hard projection cases: axis, center and core circle are degenerate; poles and the apex are unique', () => {
  const onAxis = add3(O, scale3(cyl.frame.normal, 1.7));
  assert.equal(errKind(projectPoint(K, cyl, onAxis)), 'degenerate');
  assert.equal(errKind(projectPoint(K, sph, O)), 'degenerate');
  assert.equal(errKind(projectPoint(K, tor, onAxis)), 'degenerate');
  const core = add3(O, scale3(tor.frame.xAxis, 4));
  assert.equal(errKind(projectPoint(K, tor, core)), 'degenerate');
  // sphere pole: unique nearest point, u = 0
  const pole = unwrap(projectPoint(K, sph, add3(O, scale3(sph.frame.normal, 5))));
  assert.equal(pole.u, 0);
  close(pole.v, Math.PI / 2, 1e-15);
  close(pole.distance, 2, 1e-14);
  // cone: inside the nappe on the axis -> a circle of nearest points; beyond the apex -> the apex
  const apexV = -1.5 / Math.tan(0.4);
  assert.equal(errKind(projectPoint(K, cone, add3(O, scale3(cone.frame.normal, 2)))), 'degenerate');
  const beyond = unwrap(projectPoint(K, cone, add3(O, scale3(cone.frame.normal, apexV - 3))));
  close(beyond.v, apexV, 1e-12);
  close(beyond.distance, 3, 1e-12);
  // off the axis but nearest to the apex
  const nearApex = add3(add3(O, scale3(cone.frame.normal, apexV - 2)), scale3(cone.frame.xAxis, 0.1));
  const pa = unwrap(projectPoint(K, cone, nearApex));
  close(pa.v, apexV, 1e-12);
  closeVec(pa.point, add3(O, scale3(cone.frame.normal, apexV)), 1e-12);
  close(unwrap(implicitValue(cone, nearApex)), pa.distance, 1e-12);
  // values on the axis are still defined (no NaN)
  for (const s of [cyl, sph, tor, cone] as Surface3[]) {
    assert.ok(Number.isFinite(unwrap(implicitValue(s, onAxis))));
    assert.ok(Number.isFinite(unwrap(implicitValue(s, O))));
  }
  assert.equal(errKind(implicitValue(sph, vec3(NaN, 0, 0))), 'invalid-input');
  assert.equal(errKind(projectPoint(K, sph, vec3(0, Infinity, 0))), 'invalid-input');
});

// ---------------------------------------------------------- NURBS forms ---

const TOL_REL = 1e-12;

/** Checks that the NURBS form lies on `s` and covers the box through the arc angle maps. */
function checkForm(s: Surface3, box: ParamBox, angularU: boolean, angularV: boolean, scale: number): void {
  const srf = unwrap(surfaceToNurbs(s, box));
  const dom = surfaceDomain(srf);
  assert.deepEqual(dom.u, box.u);
  assert.deepEqual(dom.v, box.v);
  const netU = unwrap(unitArcNet(box.u[0], box.u[1]));
  const netV = unwrap(unitArcNet(box.v[0], box.v[1]));
  const N = 25;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const a = Math.min(box.u[1], box.u[0] + ((box.u[1] - box.u[0]) * i) / N);
      const b = Math.min(box.v[1], box.v[0] + ((box.v[1] - box.v[0]) * j) / N);
      const q = unwrap(evaluateSurface(srf, a, b));
      const p = vec3(q[0]!, q[1]!, q[2]!);
      close(unwrap(implicitValue(s, p)), 0, TOL_REL * scale, `${s.kind} on surface`);
      const th = angularU ? unitArcAngleOfParam(netU, a) : a;
      const ph = angularV ? unitArcAngleOfParam(netV, b) : b;
      closeVec(p, unwrap(surfacePoint3(s, th, ph)), 1e-12 * scale, `${s.kind} parametrisation`);
    }
  }
  // corners are the analytic corners
  for (const a of box.u) for (const b of box.v) {
    const q = unwrap(evaluateSurface(srf, a, b));
    closeVec(vec3(q[0]!, q[1]!, q[2]!), unwrap(surfacePoint3(s, a, b)), 1e-13 * scale);
  }
}

test('revolve_sphere / sphere_segment_patch: sphereToNurbs lies on the sphere and covers the patch', () => {
  checkForm(sph, { u: [0.2, 2.9], v: [-1.2, 0.7] }, true, true, 10);
  checkForm(sph, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }, true, true, 10);
  assert.equal(errKind(sphereToNurbs(sph, { u: [0, 1], v: [-2, 0] })), 'invalid-input');
});

test('revolve_torus: torusToNurbs lies on the torus and covers the patch', () => {
  checkForm(tor, { u: [-1, 2], v: [0.5, 5.5] }, true, true, 10);
  checkForm(tor, { u: [0, 2 * Math.PI], v: [0, 2 * Math.PI] }, true, true, 10);
  assert.equal(errKind(torusToNurbs(tor, { u: [0, 1], v: [0, 7] })), 'invalid-input');
  // a thick ring torus (R < √2 r): middle control points of the tube fall across the axis
  const thick = unwrap(createTorusSurface(K, O, AXIS, XREF, 1.2, 1)) as TorusSurface;
  checkForm(thick, { u: [0, 2 * Math.PI], v: [0, 2 * Math.PI] }, true, true, 10);
});

test('revolve_cone: cylinderToNurbs and coneToNurbs lie on their surfaces and cover the patch', () => {
  checkForm(cyl, { u: [0.3, 4.5], v: [-2, 3] }, true, false, 10);
  checkForm(cone, { u: [0, 2 * Math.PI], v: [-1, 4] }, true, false, 10);
  checkForm(coneNeg, { u: [1, 2], v: [-3, 1] }, true, false, 10);
  // the patch may end at the apex but not cross it
  const apexV = -1.5 / Math.tan(0.4);
  checkForm(cone, { u: [0, 3], v: [apexV, 0] }, true, false, 10);
  assert.equal(errKind(coneToNurbs(cone, { u: [0, 1], v: [apexV - 1, 0] })), 'invalid-input');
  assert.equal(errKind(cylinderToNurbs(cyl, { u: [0, 7], v: [0, 1] })), 'invalid-input');
});

test('planeToNurbs keeps the plane parametrisation exactly', () => {
  const box: ParamBox = { u: [-1, 3], v: [0.5, 2] };
  const srf = unwrap(planeToNurbs(pln, box));
  const r = rng(2);
  for (let i = 0; i < 50; i++) {
    const a = -1 + 4 * r(), b = 0.5 + 1.5 * r();
    const q = unwrap(evaluateSurface(srf, a, b));
    closeVec(vec3(q[0]!, q[1]!, q[2]!), unwrap(surfacePoint3(pln, a, b)), 1e-13);
  }
});

test('rotate_axis_distance / revolve_tensor_x/_y/_z/_w: revolveCurveToNurbs is the rotated profile', () => {
  // A non-planar rational cubic profile.
  const profile = unwrap(
    createNurbsCurve(
      3,
      [0, 0, 0, 0, 0.4, 1, 1, 1, 1],
      [[2, 0, 0], [3, 1, 1], [1.5, -1, 2], [2.5, 0.5, 3], [0.5, 0.2, 4]],
      [1, 2, 0.5, 1.5, 1],
    ),
  );
  const axisPoint = vec3(0.5, -1, 0.2);
  const axisDir = vec3(0.2, 0.1, 1);
  const [t0, t1] = [0.4, 4.4];
  const srf = unwrap(revolveCurveToNurbs(profile, axisPoint, axisDir, t0, t1));
  const net = unwrap(unitArcNet(t0, t1));
  // weights are products (homogeneous tensor product)
  srf.weights!.forEach((row, i) => row.forEach((w, j) => close(w, net.weights[i]! * profile.weights![j]!, 1e-15)));
  const A = normalize3(axisDir)!;
  const axisDist = (p: Point3): number => length3(sub3(sub3(p, axisPoint), scale3(A, dot3(sub3(p, axisPoint), A))));
  const r = rng(29);
  for (let i = 0; i < 100; i++) {
    const a = t0 + (t1 - t0) * r(), b = r();
    const q = unwrap(evaluateSurface(srf, a, b));
    const c = unwrap(evaluateCurve(profile, b));
    const C = vec3(c[0]!, c[1]!, c[2]!);
    const rot: Transform = unwrap(rotation(axisDir, unitArcAngleOfParam(net, a), axisPoint));
    closeVec(vec3(q[0]!, q[1]!, q[2]!), applyPoint(rot, C), 1e-12 * 10);
    close(axisDist(vec3(q[0]!, q[1]!, q[2]!)), axisDist(C), 1e-12 * 10);
  }
  // a profile control point on the axis collapses its row to that point
  const onAxis = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0.5, -1, 0.2], [2, 0, 0]]));
  const cap = unwrap(revolveCurveToNurbs(onAxis, axisPoint, axisDir, 0, Math.PI));
  for (const row of cap.controlPoints) closeVec(vec3(row[0]![0]!, row[0]![1]!, row[0]![2]!), axisPoint, 1e-15);
  assert.equal(errKind(revolveCurveToNurbs(profile, axisPoint, vec3(0, 0, 0), 0, 1)), 'invalid-input');
  assert.equal(errKind(revolveCurveToNurbs(profile, axisPoint, axisDir, 0, 7)), 'invalid-input');
});

test('NURBS surfaces: evaluation, normal and curvature go through the M1 evaluator', () => {
  const box: ParamBox = { u: [0.2, 2.9], v: [-1.2, 0.7] };
  const ns = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, box))));
  const r = rng(31);
  for (let i = 0; i < 30; i++) {
    const a = 0.2 + 2.7 * r(), b = -1.2 + 1.9 * r();
    const c = unwrap(surfaceCurvature(K, ns, a, b));
    close(c.gaussian, 1 / 9, 1e-9);
    close(c.mean, -1 / 3, 1e-9);
    const p = unwrap(surfacePoint3(ns, a, b));
    closeVec(c.normal, scale3(sub3(p, O), 1 / 3), 1e-10);
    closeVec(c.normal, unwrap(surfaceNormal(K, ns.surface, a, b)), 1e-14);
  }
  assert.equal(errKind(implicitValue(ns, O)), 'invalid-input');
  assert.equal(errKind(evaluateSurface3(ns, 10, 0)), 'invalid-input');
});

test('projectPoint on a NURBS surface agrees with the analytic projection', () => {
  const box: ParamBox = { u: [0.2, 2.9], v: [-1.2, 0.7] };
  const ns = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, box))));
  const net = unwrap(unitArcNet(0.2, 2.9));
  const netV = unwrap(unitArcNet(-1.2, 0.7));
  const r = rng(37);
  for (let i = 0; i < 25; i++) {
    const a = 0.3 + 2.5 * r(), b = -1.1 + 1.7 * r();
    const q = unwrap(surfacePoint3(ns, a, b));
    const p = add3(q, scale3(normalize3(sub3(q, O))!, 2 * r() - 0.8));
    const pn = unwrap(projectPoint(K, ns, p));
    const pa = unwrap(projectPoint(K, sph, p));
    closeVec(pn.point, pa.point, 1e-9);
    close(pn.distance, pa.distance, 1e-9);
    close(unitArcAngleOfParam(net, pn.u), pa.u, 1e-8);
    close(unitArcAngleOfParam(netV, pn.v), pa.v, 1e-8);
  }
  // outside the patch: the nearest point is on the boundary (clamped Newton)
  const far = add3(O, scale3(sph.frame.normal, 10));
  const pb = unwrap(projectPoint(K, ns, far));
  close(pb.v, 0.7, 1e-9);
});

// ------------------------------------------------------------- transform ---

test('transformSurface3: rigid motions keep the parametrisation exactly', () => {
  const f = unwrap(compose(unwrap(translation(vec3(3, -1, 2))), unwrap(rotation(vec3(1, 2, -0.5), 0.9, vec3(0.3, 0.1, 0)))));
  for (const s of [pln, cyl, cone, sph, tor] as Surface3[]) {
    const g = unwrap(transformSurface3(K, s, f));
    assert.equal(g.kind, s.kind);
    for (const [u, v] of params(s, 15, 41)) {
      closeVec(unwrap(surfacePoint3(g, u, v)), applyPoint(f, unwrap(surfacePoint3(s, u, v))), 1e-12 * 20, s.kind);
    }
  }
});

test('transformSurface3: uniform scaling and reflections follow the documented parameter map', () => {
  const lam = 2.5;
  const sc = unwrap(scaling(lam, lam, lam, vec3(1, 1, 1)));
  const refl = unwrap(compose(unwrap(scaling(-1, 1, 1)), unwrap(rotation(vec3(0, 1, 1), 0.3))));
  for (const [f, sigma, l] of [[sc, 1, lam], [refl, -1, 1]] as const) {
    for (const s of [cyl, cone, sph, tor] as Surface3[]) {
      const g = unwrap(transformSurface3(K, s, f));
      for (const [u, v] of params(s, 10, 43)) {
        const img = applyPoint(f, unwrap(surfacePoint3(s, u, v)));
        const w = s.kind === 'cylinder' || s.kind === 'cone' ? sigma * l * v : sigma * v;
        closeVec(unwrap(surfacePoint3(g, u, w)), img, 1e-12 * 50, `${s.kind}`);
        close(unwrap(implicitValue(g, img)), 0, 1e-12 * 50);
      }
      // the outward normal stays outward
      const [u, v] = params(s, 1, 47)[0]!;
      const nIm = unwrap(surfaceNormal3(K, g, u, s.kind === 'cylinder' || s.kind === 'cone' ? sigma * l * v : sigma * v));
      const p = unwrap(surfacePoint3(g, u, s.kind === 'cylinder' || s.kind === 'cone' ? sigma * l * v : sigma * v));
      assert.ok(unwrap(implicitValue(g, add3(p, scale3(nIm, 1e-3)))) > 0);
    }
    const gp = unwrap(transformSurface3(K, pln, f));
    for (const [u, v] of params(pln, 10, 53)) {
      const img = applyPoint(f, unwrap(surfacePoint3(pln, u, v)));
      close(unwrap(implicitValue(gp, img)), 0, 1e-12 * 50);
    }
  }
});

test('transformSurface3: non-uniform scaling is an error for analytic surfaces and exact for NURBS and planes', () => {
  const f = unwrap(scaling(1, 2, 3));
  for (const s of [cyl, cone, sph, tor] as Surface3[]) assert.equal(errKind(transformSurface3(K, s, f)), 'invalid-input');
  const box: ParamBox = { u: [0, 2], v: [-1, 1] };
  const ns = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, box))));
  const g = unwrap(transformSurface3(K, ns, f));
  assert.equal(g.kind, 'nurbs');
  const r = rng(59);
  for (let i = 0; i < 20; i++) {
    const a = 2 * r(), b = 2 * r() - 1;
    closeVec(unwrap(surfacePoint3(g, a, b)), applyPoint(f, unwrap(surfacePoint3(ns, a, b))), 1e-12 * 20);
  }
  const gp = unwrap(transformSurface3(K, pln, f));
  for (const [u, v] of params(pln, 10, 61)) {
    close(unwrap(implicitValue(gp, applyPoint(f, unwrap(surfacePoint3(pln, u, v))))), 0, 1e-12 * 50);
  }
  assert.equal(errKind(transformSurface3(K, cyl, unwrap(scaling(0, 0, 0)))), 'invalid-input');
});

// ------------------------------------------------------- review: edge cases ---

test('revolveCurveToNurbs: subnormal axis direction and subnormal radial vectors are Results, not throws', () => {
  const profile = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0, 0], [1, 0, 1]]));
  // `1 / |a|` overflows for a subnormal axis: an error, never an exception or a NaN net.
  assert.equal(errKind(revolveCurveToNurbs(profile, vec3(0, 0, 0), vec3(1e-320, 0, 0), 0, 1)), 'invalid-input');
  // A profile point 1e-310 off the axis is treated as on the axis (finite collapsed row).
  const near = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[1e-310, 0, 0], [1, 0, 1]]));
  const srf = unwrap(revolveCurveToNurbs(near, vec3(0, 0, 0), vec3(0, 0, 1), 0, Math.PI));
  for (const row of srf.controlPoints) for (const p of row) assert.ok(p.every(Number.isFinite));
  for (const row of srf.controlPoints) closeVec(vec3(row[0]![0]!, row[0]![1]!, row[0]![2]!), vec3(0, 0, 0), 1e-300);
});

test('NURBS forms across the seam, at large angles and through the poles stay on the surface', () => {
  const s0 = unwrap(createSphereSurface(K, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2)) as SphereSurface;
  for (const box of [
    { u: [-Math.PI, Math.PI], v: [-1, 1] },
    { u: [1e6, 1e6 + 6], v: [-Math.PI / 2, Math.PI / 2] },
  ] as ParamBox[]) {
    const srf = unwrap(sphereToNurbs(s0, box));
    const dom = surfaceDomain(srf);
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const a = Math.min(dom.u[1], dom.u[0] + ((dom.u[1] - dom.u[0]) * i) / 20);
        const b = Math.min(dom.v[1], dom.v[0] + ((dom.v[1] - dom.v[0]) * j) / 20);
        const q = unwrap(evaluateSurface(srf, a, b));
        close(unwrap(implicitValue(s0, vec3(q[0]!, q[1]!, q[2]!))), 0, 1e-12 * 2);
      }
    }
  }
  // the full-sphere NURBS projection agrees with the analytic one at the pole and seam
  const ns = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(s0, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }))));
  for (const p of [vec3(0, 0, 5), vec3(3, -1e-9, 0), vec3(0, 0, 1e-3)]) {
    close(unwrap(projectPoint(K, ns, p)).distance, unwrap(projectPoint(K, s0, p)).distance, 1e-9);
  }
});

test('transformSurface3: singular or overflowing similarities are Results', () => {
  assert.equal(errKind(transformSurface3(K, sph, unwrap(scaling(0, 0, 0)))), 'invalid-input');
  assert.equal(errKind(transformSurface3(K, sph, unwrap(scaling(1e300, 1e300, 1e300)))), 'invalid-input');
  // a negative uniform scaling (point reflection, det < 0) keeps the cone with σ = -1
  const c = unwrap(transformSurface3(K, cone, unwrap(scaling(-2, -2, -2)))) as ConeSurface;
  close(c.semiAngle, -cone.semiAngle, 0);
  close(c.baseRadius, 2 * cone.baseRadius, 1e-15);
  for (const [u, v] of params(cone, 10)) {
    const p = unwrap(surfacePoint3(cone, u, v));
    close(unwrap(implicitValue(c, scale3(p, -2))), 0, 1e-12 * 20);
  }
});
