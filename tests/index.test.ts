import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cadloom from '../src/index.ts';
import {
  clampedUniformKnots,
  createBSplineCurve,
  createKernel,
  evaluateCurve,
  makeBox,
  orient2d,
  polyhedronMass,
  unwrap,
  validateBrep,
  vec2,
  vec3,
} from '../src/index.ts';

test('the package entry exports every M0 area', () => {
  for (const name of [
    'createKernel', 'vec3', 'compose', 'inverse', 'orient2d', 'orient3d', 'dyadicFromNumber',
    'validateKnots', 'evaluateCurve', 'insertKnot', 'deCasteljau', 'BrepBuilder', 'validateBrep',
    'buildPolyhedron', 'makeBox', 'BOX_FACES', 'polyhedronMass', 'signedVolume',
  ]) {
    assert.equal(typeof (cadloom as Record<string, unknown>)[name] !== 'undefined', true, name);
  }
});

test('README example: box volume, NURBS evaluation, orient2d', () => {
  const kernel = createKernel();
  const box = unwrap(makeBox(kernel, vec3(0, 0, 0), 2, 3, 4));
  assert.equal(validateBrep(box).ok, true);
  const mass = unwrap(polyhedronMass(kernel, box));
  assert.equal(mass.volume, 24);
  assert.equal(mass.area, 52);

  const knots = unwrap(clampedUniformKnots(3, 2));
  const curve = unwrap(createBSplineCurve(2, knots, [[0, 0], [1, 2], [2, 0]]));
  assert.deepEqual(unwrap(evaluateCurve(curve, 0.5)), [1, 1]);

  assert.equal(unwrap(orient2d(vec2(0, 0), vec2(1, 0), vec2(0, 1))), 1);
  assert.equal(unwrap(orient2d(vec2(0, 0), vec2(1, 1), vec2(2, 2))), 0);
});

test('the package entry exports every M1 area without name collisions', () => {
  for (const name of [
    // nurbs (surfaces, insertion, elevation)
    'createNurbsSurface', 'evaluateSurface', 'surfaceDerivatives', 'surfaceNormal', 'unitNormalFromPartials',
    'isoparametricCurve', 'insertKnotSurface', 'refineKnotsSurface', 'elevateCurveDegree', 'elevateSurfaceDegree',
    'elevateBezier', 'elevationMatrix', 'MAX_DERIVATIVE_ORDER', 'MAX_ELEVATED_DEGREE',
    // curve
    'createLineCurve', 'createCircleCurve', 'createEllipseCurve', 'evaluateCurve3', 'curveCurvature',
    'curveArcLength', 'unitArcNet', 'rationalQuadraticArc', 'curveToNurbs', 'closestPointOnCurve', 'transformCurve3',
    // surface
    'createPlaneSurface', 'createCylinderSurface', 'createConeSurface', 'createSphereSurface', 'createTorusSurface',
    'evaluateSurface3', 'surfaceNormal3', 'surfaceCurvature', 'normalCurvature', 'implicitValue', 'projectPoint',
    'surfaceToNurbs', 'sphereToNurbs', 'revolveCurveToNurbs', 'transformSurface3',
  ]) {
    assert.equal(typeof (cadloom as Record<string, unknown>)[name] !== 'undefined', true, name);
  }
  // M0 evaluators keep their names; the M1 geometric ones carry a `3` suffix.
  assert.notEqual(cadloom.evaluateCurve as unknown, cadloom.evaluateCurve3 as unknown);
  assert.notEqual(cadloom.evaluateSurface as unknown, cadloom.evaluateSurface3 as unknown);
});

test('README example (M1): sphere NURBS form agrees with the analytic sphere; cylinder curvature', () => {
  const kernel = cadloom.createKernel();
  const sphere = unwrap(cadloom.createSphereSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2));
  const nurbs = unwrap(cadloom.sphereToNurbs(sphere, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }));
  const p = unwrap(cadloom.evaluateSurface(nurbs, 1.0, 0.3));
  assert.ok(Math.abs(Math.hypot(p[0]!, p[1]!, p[2]!) - 2) < 1e-12);
  // Knots are the arc angles, but inside a segment the rational parameter is not the angle:
  // map it with unitArcAngleOfParam (exact inverse of the rational reparametrisation).
  const lon = cadloom.unitArcAngleOfParam(unwrap(cadloom.unitArcNet(0, 2 * Math.PI)), 1.0);
  const lat = cadloom.unitArcAngleOfParam(unwrap(cadloom.unitArcNet(-Math.PI / 2, Math.PI / 2)), 0.3);
  const q = unwrap(cadloom.surfacePoint3(sphere, lon, lat));
  assert.ok(Math.hypot(p[0]! - q.x, p[1]! - q.y, p[2]! - q.z) < 1e-12);

  const cylinder = unwrap(cadloom.createCylinderSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 4));
  const k = unwrap(cadloom.surfaceCurvature(kernel, cylinder, 0.7, 1.5));
  assert.ok(Math.abs(k.gaussian) < 1e-15); // 0 (may be -0)
  assert.ok(Math.abs(k.mean - -1 / 8) < 1e-15);
  assert.ok(Math.abs(k.principal[0]) < 1e-15 && Math.abs(k.principal[1] - -0.25) < 1e-15);
});
