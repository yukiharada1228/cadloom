import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel, cross3, dot3, normalize3, vec3 } from '../src/index.ts';

test('cross product is orthogonal to its arguments', () => {
  const a = vec3(1, 2, 3), b = vec3(-4, 0.5, 2);
  const c = cross3(a, b);
  assert.equal(dot3(c, a), 0);
  assert.equal(dot3(c, b), 0);
});

test('normalize rejects the zero vector', () => {
  assert.equal(normalize3(vec3(0, 0, 0)), undefined);
});

test('kernel tolerances derive from the zone tolerance', () => {
  const k = createKernel();
  assert.equal(k.tolerances.xsectTol3d, 2e-5);
  assert.ok(Object.isFrozen(k.tolerances));
});
