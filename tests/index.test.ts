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
