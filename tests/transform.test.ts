import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { dot3, vec3, type Vec3 } from '../src/math/vec.ts';
import {
  IDENTITY_TRANSFORM,
  applyPoint,
  applyVector,
  compose,
  determinant,
  determinantSign,
  inverse,
  rotation,
  scaling,
  transformFromMatrix,
  translation,
  type Transform,
} from '../src/math/transform.ts';

/** `compose` returns a `Result` (overflow is an error); these tests compose finite small maps. */
const comp = (f: Transform, g: Transform): Transform => unwrap(compose(f, g));

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small-integer entries: every product and sum below is exact in doubles, so laws hold exactly. */
function intTransform(r: () => number): Transform {
  return unwrap(transformFromMatrix(Array.from({ length: 12 }, () => Math.floor(r() * 9) - 4)));
}
const intPoint = (r: () => number): Vec3 => vec3(Math.floor(r() * 21) - 10, Math.floor(r() * 21) - 10, Math.floor(r() * 21) - 10);

/** `-0` and `0` are the same value here (signs of zero are not part of the model). */
const z = (v: Vec3): Vec3 => vec3(v.x + 0, v.y + 0, v.z + 0);

function near(a: Vec3, b: Vec3, tol = 1e-12): void {
  assert.ok(Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.z - b.z) <= tol,
    `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

/** Exact determinant of integer entries via BigInt (reference for determinantSign). */
function refDetSign(t: Transform): number {
  const [a, b, c, , d, e, f, , g, h, i] = t.m.map((x) => BigInt(x));
  const det = a! * (e! * i! - f! * h!) - b! * (d! * i! - f! * g!) + c! * (d! * h! - e! * g!);
  return det > 0n ? 1 : det < 0n ? -1 : 0;
}

test('apply_compose / applyVector_compose: compose(f, g) applies g first, then f', () => {
  const r = rng(1);
  for (let i = 0; i < 300; i++) {
    const f = intTransform(r), g = intTransform(r), p = intPoint(r);
    assert.deepEqual(z(applyPoint(comp(f, g), p)), z(applyPoint(f, applyPoint(g, p))));
    assert.deepEqual(z(applyVector(comp(f, g), p)), z(applyVector(f, applyVector(g, p))));
  }
});

test('compose_assoc', () => {
  const r = rng(2);
  for (let i = 0; i < 200; i++) {
    const f = intTransform(r), g = intTransform(r), h = intTransform(r);
    assert.deepEqual(comp(comp(f, g), h), comp(f, comp(g, h)));
  }
});

test('compose_id_left / compose_id_right / apply_identity', () => {
  const r = rng(3);
  for (let i = 0; i < 100; i++) {
    const f = intTransform(r), p = intPoint(r);
    assert.deepEqual(comp(IDENTITY_TRANSFORM, f), f);
    assert.deepEqual(comp(f, IDENTITY_TRANSFORM), f);
    assert.deepEqual(z(applyPoint(IDENTITY_TRANSFORM, p)), z(p));
  }
});

test('applyVector_eq_sub: the vector map is the difference of point images', () => {
  const r = rng(4);
  for (let i = 0; i < 100; i++) {
    const f = intTransform(r), p = intPoint(r), q = intPoint(r);
    const fp = applyPoint(f, p), fq = applyPoint(f, q);
    assert.deepEqual(z(applyVector(f, vec3(p.x - q.x, p.y - q.y, p.z - q.z))), z(vec3(fp.x - fq.x, fp.y - fq.y, fp.z - fq.z)));
  }
});

test('det_compose: det(f ∘ g) = det f * det g', () => {
  const r = rng(5);
  for (let i = 0; i < 300; i++) {
    const f = intTransform(r), g = intTransform(r);
    assert.equal(determinant(comp(f, g)) + 0, determinant(f) * determinant(g) + 0);
  }
});

test('det_identity / det_translation / det_scaling / translation_apply / scaling_fixes_center', () => {
  assert.equal(determinant(IDENTITY_TRANSFORM), 1);
  const t = unwrap(translation(vec3(1, -2, 3)));
  assert.equal(determinant(t), 1);
  assert.deepEqual(applyPoint(t, vec3(4, 5, 6)), vec3(5, 3, 9));
  assert.deepEqual(applyVector(t, vec3(4, 5, 6)), vec3(4, 5, 6));
  const c = vec3(1, 2, 3);
  const s = unwrap(scaling(2, -3, 0.5, c));
  assert.equal(determinant(s), -3);
  assert.deepEqual(applyPoint(s, c), c);
  assert.deepEqual(applyPoint(s, vec3(2, 3, 5)), vec3(3, -1, 4));
});

test('determinantSign is exact (agrees with BigInt on integer matrices, including singular ones)', () => {
  const r = rng(6);
  let singular = 0;
  for (let i = 0; i < 2000; i++) {
    const f = unwrap(transformFromMatrix(Array.from({ length: 12 }, () => Math.floor(r() * 3) - 1)));
    const ref = refDetSign(f);
    assert.equal(determinantSign(f), ref);
    if (ref === 0) { singular++; assert.equal(inverse(f).ok, false); }
  }
  assert.ok(singular > 100);
  // a determinant of 2^-60: tiny but non-zero, so invertible
  const tiny = unwrap(transformFromMatrix([1, 1, 0, 0, 1, 1 + 2 ** -52, 0, 0, 0, 0, 2 ** -8, 0]));
  assert.equal(determinantSign(tiny), 1);
  assert.ok(inverse(tiny).ok);
});

test('apply_inverse_left / apply_inverse_right / det_inverse', () => {
  const r = rng(7);
  let tested = 0;
  for (let i = 0; i < 300; i++) {
    const f = intTransform(r);
    const inv = inverse(f);
    if (determinantSign(f) === 0) { assert.equal(inv.ok, false); continue; }
    const g = unwrap(inv);
    tested++;
    const p = intPoint(r);
    near(applyPoint(g, applyPoint(f, p)), p, 1e-9);
    near(applyPoint(f, applyPoint(g, p)), p, 1e-9);
    assert.ok(Math.abs(determinant(g) * determinant(f) - 1) < 1e-12);
  }
  assert.ok(tested > 100);
  // exact case: powers of two and integer translation
  const s = unwrap(scaling(2, 4, 0.5, vec3(1, 1, 1)));
  assert.deepEqual(unwrap(inverse(s)), unwrap(scaling(0.5, 0.25, 2, vec3(1, 1, 1))));
  assert.deepEqual(unwrap(inverse(unwrap(translation(vec3(1, 2, 3))))), unwrap(translation(vec3(-1, -2, -3))));
});

test('rodrigues_det / rodrigues_fixes_axis / rodrigues_fixes_origin / rodrigues_preserves_dot', () => {
  const r = rng(8);
  for (let i = 0; i < 300; i++) {
    const axis = vec3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const len = Math.hypot(axis.x, axis.y, axis.z);
    if (len < 1e-3) continue;
    const k = vec3(axis.x / len, axis.y / len, axis.z / len);
    const o = vec3(r() * 10, r() * 10, r() * 10);
    const R = unwrap(rotation(vec3(axis.x * 7, axis.y * 7, axis.z * 7), r() * 20 - 10, o));
    assert.ok(Math.abs(determinant(R) - 1) < 1e-14);
    near(applyVector(R, k), k, 1e-14);
    near(applyPoint(R, o), o, 1e-12);
    const a = vec3(r(), r(), r()), b = vec3(r(), r(), r());
    assert.ok(Math.abs(dot3(applyVector(R, a), applyVector(R, b)) - dot3(a, b)) < 1e-14);
  }
});

test('rotation is right-handed and accepts tiny or huge axes', () => {
  const q = unwrap(rotation(vec3(0, 0, 1), Math.PI / 2));
  near(applyVector(q, vec3(1, 0, 0)), vec3(0, 1, 0), 1e-15);
  near(applyVector(q, vec3(0, 1, 0)), vec3(-1, 0, 0), 1e-15);
  for (const scale of [1e-300, 1e300, Number.MIN_VALUE]) {
    const t = unwrap(rotation(vec3(0, 0, scale), Math.PI / 2));
    near(applyVector(t, vec3(1, 0, 0)), vec3(0, 1, 0), 1e-15);
  }
  // about a point: (2, 1, 0) turned a quarter about the z line through (1, 1, 0)
  near(applyPoint(unwrap(rotation(vec3(0, 0, 1), Math.PI / 2, vec3(1, 1, 0))), vec3(2, 1, 0)), vec3(1, 2, 0), 1e-15);
});

test('constructors reject invalid input', () => {
  assert.equal(rotation(vec3(0, 0, 0), 1).ok, false);
  assert.equal(rotation(vec3(1, 0, 0), NaN).ok, false);
  assert.equal(rotation(vec3(1, 0, Infinity), 1).ok, false);
  assert.equal(translation(vec3(NaN, 0, 0)).ok, false);
  assert.equal(scaling(1, Infinity, 1).ok, false);
  assert.equal(transformFromMatrix([1, 2, 3]).ok, false);
  assert.equal(transformFromMatrix(Array.from({ length: 12 }, () => NaN)).ok, false);
  assert.equal(inverse(unwrap(scaling(1, 0, 1))).ok, false);
  const r = rotation(vec3(0, 0, 0), 1);
  if (!r.ok) assert.equal(r.error.kind, 'invalid-input');
});

test('inverse reports overflow instead of returning non-finite entries', () => {
  // the inverse translation -(2^1000 * 1e300) is not a double
  const tiny = unwrap(transformFromMatrix([2 ** -1000, 0, 0, 0, 0, 2 ** -1000, 0, 0, 0, 0, 2 ** -1000, 1e300]));
  assert.equal(inverse(tiny).ok, false);
  // but the same linear part with a small translation inverts (det 2^-3000 is handled by scaling)
  assert.deepEqual(unwrap(inverse(unwrap(scaling(2 ** -1000, 2 ** -1000, 2 ** -1000)))), unwrap(scaling(2 ** 1000, 2 ** 1000, 2 ** 1000)));
  const sub = unwrap(transformFromMatrix([Number.MIN_VALUE, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]));
  const r = inverse(sub); // 2^1074 is not a double
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'invalid-input');
});

test('apply_inverse_scaled_left / apply_inverse_scaled_right: badly scaled maps invert exactly', () => {
  // det = 1e-600 underflows in doubles; the row-scaled inverse is still exact for powers of two
  const d = unwrap(scaling(2 ** -700, 2 ** -650, 2 ** 600, vec3(3, -5, 7)));
  const inv = unwrap(inverse(d));
  assert.deepEqual(inv, unwrap(scaling(2 ** 700, 2 ** 650, 2 ** -600, vec3(3, -5, 7))));
  // generic badly scaled map: rows of very different magnitudes
  const r = rng(31);
  for (let i = 0; i < 200; i++) {
    const e = [Math.floor(r() * 1200) - 600, Math.floor(r() * 1200) - 600, Math.floor(r() * 1200) - 600];
    const f0 = intTransform(r);
    if (determinantSign(f0) === 0) continue;
    // f = S0 f0 with S0 = diag(2^e): every entry exact
    const f = unwrap(transformFromMatrix(f0.m.map((x, j) => x * 2 ** (e[Math.floor(j / 4)] ?? 0))));
    const g = unwrap(inverse(f));
    const p = intPoint(r);
    const back = applyPoint(g, applyPoint(f, p));
    near(back, p, 1e-9);
    const q = vec3(p.x * 2 ** (e[0] ?? 0), p.y * 2 ** (e[1] ?? 0), p.z * 2 ** (e[2] ?? 0));
    const fq = applyPoint(f, applyPoint(g, q));
    // compare in the row scales: (f g q)_i 2^-e_i must be close to p_i
    near(vec3(fq.x * 2 ** -(e[0] ?? 0), fq.y * 2 ** -(e[1] ?? 0), fq.z * 2 ** -(e[2] ?? 0)), p, 1e-9);
  }
});

test('inverse rejects a nearly singular map whose floating determinant has the wrong sign', () => {
  // exact det > 0 but tiny relative to the entries: rounding may flip the float determinant
  let checked = 0;
  const r = rng(32);
  for (let i = 0; i < 2000; i++) {
    const a = 1 + Math.floor(r() * 1000) * 2 ** -52, b = 1 + Math.floor(r() * 1000) * 2 ** -52;
    const f = unwrap(transformFromMatrix([a, b, 1, 0, b, a, 1, 0, 1 / 3, 1 / 3, 2 / 3, 0]));
    const res = inverse(f);
    if (determinantSign(f) === 0) { assert.equal(res.ok, false); continue; }
    if (!res.ok) continue;
    checked++;
    // whenever an inverse is returned, its determinant has the exact sign of f's
    assert.equal(Math.sign(determinant(res.value)), determinantSign(f));
  }
  assert.ok(checked > 0);
});

test('constructors and compose report overflow instead of storing non-finite entries', () => {
  assert.equal(scaling(1e300, 1, 1, vec3(1e300, 0, 0)).ok, false);
  assert.equal(rotation(vec3(1, 1, 1), 1, vec3(1.7e308, 1.7e308, 1.7e308)).ok, false);
  const big = unwrap(transformFromMatrix([1e200, 0, 0, 0, 0, 1e200, 0, 0, 0, 0, 1e200, 0]));
  const c = compose(big, big);
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.error.kind, 'invalid-input');
  // neither determinantSign nor inverse can throw: every Transform is finite
  assert.doesNotThrow(() => { determinantSign(big); inverse(big); });
});

test('transforms are frozen', () => {
  const t = unwrap(translation(vec3(1, 2, 3)));
  assert.ok(Object.isFrozen(t));
  assert.ok(Object.isFrozen(t.m));
  assert.ok(Object.isFrozen(comp(t, t).m));
  assert.ok(Object.isFrozen(IDENTITY_TRANSFORM.m));
});
