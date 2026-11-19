import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { createKernel } from '../src/core/kernel.ts';
import { compareDyadic, dyadicFromNumber, dyadicToFraction, mulDyadic, addDyadic, subDyadic, type Dyadic } from '../src/exact/index.ts';
import { createNurbsCurve, createNurbsSurface, evaluateCurve, findSpan, homogeneousNet, type NurbsCurve, type NurbsSurface } from '../src/nurbs/index.ts';
import { createCircleCurve, createEllipseCurve, createLineCurve, createNurbsCurve3, circleArcToNurbs } from '../src/curve/index.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  sphereToNurbs,
  surfaceNormal3,
  surfacePoint3,
  torusToNurbs,
  type Surface3,
} from '../src/surface/index.ts';
import * as IV from '../src/interval/index.ts';
import type { Box3, Interval } from '../src/interval/index.ts';

const kernel = createKernel();

// ---------------------------------------------------------------------------------------------
// Exact helpers: dyadics (M0) and bigint fractions.

const dy = (x: number): Dyadic => unwrap(dyadicFromNumber(x));
const leD = (a: Dyadic, b: Dyadic): boolean => compareDyadic(a, b) <= 0;
/** Exact `lo <= x <= hi` for a dyadic `x` (infinite endpoints are unattained bounds). */
function inD(x: Dyadic, iv: Interval): boolean {
  const okLo = iv.lo === -Infinity || (Number.isFinite(iv.lo) && leD(dy(iv.lo), x));
  const okHi = iv.hi === Infinity || (Number.isFinite(iv.hi) && leD(x, dy(iv.hi)));
  return okLo && okHi;
}

interface Q {
  readonly n: bigint;
  readonly d: bigint;
}
const babs = (a: bigint): bigint => (a < 0n ? -a : a);
function gcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
function q(n: bigint, d: bigint = 1n): Q {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const qOf = (x: number): Q => {
  const f = dyadicToFraction(dy(x));
  return q(f.num, f.den);
};
const qAdd = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qSub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qMul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
const qDiv = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
const qCmp = (a: Q, b: Q): number => {
  const l = a.n * b.d, r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
const qAbs = (a: Q): Q => ({ n: babs(a.n), d: a.d });

/** A real known as `v ± e`. */
interface Ball {
  readonly v: Q;
  readonly e: Q;
}
const ballQ = (v: Q): Ball => ({ v, e: q(0n) });
const ballAdd = (a: Ball, b: Ball): Ball => ({ v: qAdd(a.v, b.v), e: qAdd(a.e, b.e) });
const ballMul = (a: Ball, b: Ball): Ball => ({
  v: qMul(a.v, b.v),
  e: qAdd(qAdd(qMul(qAbs(a.v), b.e), qMul(qAbs(b.v), a.e)), qMul(a.e, b.e)),
});
/** `[v - e, v + e] ⊆ [lo, hi]` exactly. */
function ballIn(b: Ball, lo: number, hi: number): boolean {
  return qCmp(qOf(lo), qSub(b.v, b.e)) <= 0 && qCmp(qAdd(b.v, b.e), qOf(hi)) <= 0;
}

const BITS = 256n;
const SCALE = 1n << BITS;
/** `sin` / `cos` of a double (exact rational argument, |x| <= 40) by a 256-bit Taylor series, as a ball. */
function trigBall(x: number, which: 'sin' | 'cos'): Ball {
  if (x === 0) return ballQ(q(which === 'sin' ? 0n : 1n));
  const f = qOf(x);
  const X = (f.n * SCALE) / f.d;
  let term = which === 'sin' ? X : SCALE;
  let sum = term;
  let ops = 2n;
  for (let k = 1; k < 400 && term !== 0n; k++) {
    const den = which === 'sin' ? BigInt(2 * k * (2 * k + 1)) : BigInt((2 * k - 1) * (2 * k));
    term = -((((term * X) / SCALE) * X) / SCALE / den);
    sum += term;
    ops += 4n;
  }
  return { v: q(sum, SCALE), e: q(ops * 64n, SCALE) };
}

// Deterministic generator (xorshift32).
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function randomDouble(r: () => number): number {
  const kind = r();
  if (kind < 0.15) return Math.round((r() - 0.5) * 20); // small integers (exact paths)
  const sign = r() < 0.5 ? -1 : 1;
  if (kind < 0.2) return sign * r() * 2 ** -1060; // subnormal
  if (kind < 0.25) return sign * (1 + r()) * 2 ** (990 + Math.floor(r() * 30)); // huge
  return sign * (1 + r()) * 2 ** Math.floor((r() - 0.5) * 120);
}

function randomInterval(r: () => number): Interval {
  const a = randomDouble(r), b = r() < 0.2 ? a : randomDouble(r);
  return unwrap(IV.interval(Math.min(a, b), Math.max(a, b)));
}

/** Endpoints and interior doubles of an interval. */
function samples(iv: Interval, r: () => number): number[] {
  const out = [iv.lo, iv.hi];
  for (let k = 0; k < 3; k++) {
    const t = iv.lo + (iv.hi - iv.lo) * r();
    if (Number.isFinite(t)) out.push(Math.min(iv.hi, Math.max(iv.lo, t)));
    else out.push(iv.lo / 2 + iv.hi / 2);
  }
  return out;
}

const PAIRS = 400;

// ---------------------------------------------------------------------------------------------
// float.ts: neighbours and directed rounding.

test('nextUp / nextDown: edge cases (±0, subnormals, ±MAX, ±Infinity, NaN)', () => {
  assert.equal(IV.nextUp(0), Number.MIN_VALUE);
  assert.equal(IV.nextUp(-0), Number.MIN_VALUE);
  assert.equal(IV.nextDown(0), -Number.MIN_VALUE);
  assert.equal(IV.nextDown(-0), -Number.MIN_VALUE);
  assert.ok(Object.is(IV.nextUp(-Number.MIN_VALUE), -0));
  assert.ok(Object.is(IV.nextDown(Number.MIN_VALUE), 0));
  assert.equal(IV.nextUp(Number.MIN_VALUE), 2 * Number.MIN_VALUE);
  const minNormal = 2 ** -1022;
  assert.equal(IV.nextDown(minNormal), minNormal - Number.MIN_VALUE);
  assert.equal(IV.nextUp(minNormal - Number.MIN_VALUE), minNormal);
  assert.equal(IV.nextUp(1), 1 + 2 ** -52);
  assert.equal(IV.nextDown(1), 1 - 2 ** -53);
  assert.equal(IV.nextUp(-1), -1 + 2 ** -53);
  assert.equal(IV.nextDown(-1), -1 - 2 ** -52);
  assert.equal(IV.nextUp(Number.MAX_VALUE), Infinity);
  assert.equal(IV.nextDown(-Number.MAX_VALUE), -Infinity);
  assert.equal(IV.nextDown(Infinity), Number.MAX_VALUE);
  assert.equal(IV.nextUp(-Infinity), -Number.MAX_VALUE);
  assert.equal(IV.nextUp(Infinity), Infinity);
  assert.equal(IV.nextDown(-Infinity), -Infinity);
  assert.ok(Number.isNaN(IV.nextUp(NaN)));
  assert.equal(IV.nextDown(Number.MAX_VALUE), Number.MAX_VALUE - 2 ** 970);
  // No double strictly between x and nextUp(x): the exact gap is one ulp.
  const r = rng(7);
  for (let k = 0; k < 200; k++) {
    const x = randomDouble(r);
    const u = IV.nextUp(x), d = IV.nextDown(x);
    assert.ok(d < x && x < u);
    assert.ok(IV.nextDown(u) === x && IV.nextUp(d) === x); // === also identifies -0 and +0
  }
});

test('add_rounded_sound / mul_rounded_sound: directed + − × ÷ √ bracket the exact result (dyadic check)', () => {
  const r = rng(11);
  for (let k = 0; k < 2000; k++) {
    const a = randomDouble(r), b = randomDouble(r);
    const A = dy(a), B = dy(b);
    assert.ok(inD(addDyadic(A, B), { lo: IV.addDown(a, b), hi: IV.addUp(a, b) }), `add ${a} ${b}`);
    assert.ok(inD(subDyadic(A, B), { lo: IV.subDown(a, b), hi: IV.subUp(a, b) }), `sub ${a} ${b}`);
    assert.ok(inD(mulDyadic(A, B), { lo: IV.mulDown(a, b), hi: IV.mulUp(a, b) }), `mul ${a} ${b}`);
    // Exactness: when the rounded result equals the exact one, both directions return it.
    const s = a + b;
    if (Number.isFinite(s) && compareDyadic(dy(s), addDyadic(A, B)) === 0) {
      assert.equal(IV.addDown(a, b), s);
      assert.equal(IV.addUp(a, b), s);
    }
    if (b !== 0) {
      const lo = IV.divDown(a, b), hi = IV.divUp(a, b);
      // lo <= a / b <= hi  <=>  lo b <= a <= hi b (b > 0), reversed for b < 0.
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        const lb = mulDyadic(dy(lo), B), hb = mulDyadic(dy(hi), B);
        assert.ok(b > 0 ? leD(lb, A) && leD(A, hb) : leD(hb, A) && leD(A, lb), `div ${a} ${b}`);
      }
      assert.ok(lo <= hi);
    }
    const x = Math.abs(a);
    const sl = IV.sqrtDown(x), sh = IV.sqrtUp(x);
    assert.ok(leD(mulDyadic(dy(sl), dy(sl)), dy(x)) && (sh === Infinity || leD(dy(x), mulDyadic(dy(sh), dy(sh)))), `sqrt ${x}`);
  }
  // Exact cases stay exact.
  assert.equal(IV.mulDown(3, 7), 21);
  assert.equal(IV.mulUp(3, 7), 21);
  assert.equal(IV.divDown(1, 4), 0.25);
  assert.equal(IV.divUp(1, 4), 0.25);
  assert.equal(IV.sqrtDown(9), 3);
  assert.equal(IV.sqrtUp(9), 3);
  assert.equal(IV.divUp(1, 3), IV.nextUp(IV.divDown(1, 3)));
  // Overflow is sound in the extended sense; down never gives +Infinity, up never -Infinity.
  assert.equal(IV.mulUp(1e300, 1e300), Infinity);
  assert.equal(IV.mulDown(1e300, 1e300), Number.MAX_VALUE);
  assert.equal(IV.mulDown(-1e300, 1e300), -Infinity);
  assert.equal(IV.mulUp(-1e300, 1e300), -Number.MAX_VALUE);
  assert.equal(IV.mulDown(0, Infinity), 0);
});

// ---------------------------------------------------------------------------------------------
// interval.ts: inclusion soundness (theorem-named).

function checkBinary(name: string, op: (a: Interval, b: Interval) => Interval, exact: (x: Dyadic, y: Dyadic) => Dyadic, seed: number): void {
  const r = rng(seed);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r), B = randomInterval(r);
    const C = op(A, B);
    assert.ok(!Number.isNaN(C.lo) && !Number.isNaN(C.hi) && C.lo <= C.hi, name);
    assert.ok(C.lo !== Infinity && C.hi !== -Infinity, name);
    for (const x of samples(A, r)) for (const y of samples(B, r)) assert.ok(inD(exact(dy(x), dy(y)), C), `${name} ${x} ${y}`);
  }
}

test('add_sound: x ∈ A, y ∈ B ⇒ x + y ∈ add(A, B) (exact dyadic check, endpoints and interior)', () => {
  checkBinary('add', IV.add, addDyadic, 101);
  assert.deepEqual(IV.add(unwrap(IV.interval(1, 2)), unwrap(IV.interval(3, 4))), { lo: 4, hi: 6 });
  const s = IV.add(unwrap(IV.pointInterval(0.1)), unwrap(IV.pointInterval(0.2)));
  assert.ok(inD(addDyadic(dy(0.1), dy(0.2)), s));
  assert.equal(s.hi, IV.nextUp(s.lo)); // one ulp wide
});

test('sub_sound: x − y ∈ sub(A, B)', () => {
  checkBinary('sub', IV.sub, subDyadic, 102);
});

test('neg_sound: −x ∈ neg(A)', () => {
  const r = rng(103);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r);
    for (const x of samples(A, r)) assert.ok(IV.contains(IV.neg(A), -x));
  }
});

test('mul_sound: x y ∈ mul(A, B) (min / max of the four corners, outward)', () => {
  checkBinary('mul', IV.mul, mulDyadic, 104);
  assert.deepEqual(IV.mul(unwrap(IV.interval(1, 4)), unwrap(IV.interval(-3, 2))), { lo: -12, hi: 8 });
});

test('scale_sound: x s ∈ scale(A, s) for both signs of s', () => {
  const r = rng(105);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r);
    const s = randomDouble(r);
    const C = IV.scale(A, s);
    for (const x of samples(A, r)) assert.ok(inD(mulDyadic(dy(x), dy(s)), C));
  }
});

test('sqr_sound: x² ∈ sqr(A), never below 0, tighter than mul(A, A) across 0', () => {
  const r = rng(106);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r);
    const C = IV.sqr(A);
    assert.ok(C.lo >= 0);
    for (const x of samples(A, r)) assert.ok(inD(mulDyadic(dy(x), dy(x)), C));
  }
  assert.deepEqual(IV.sqr(unwrap(IV.interval(-3, 2))), { lo: 0, hi: 9 });
  assert.deepEqual(IV.mul(unwrap(IV.interval(-3, 2)), unwrap(IV.interval(-3, 2))), { lo: -6, hi: 9 });
});

test('div / sqrt: inclusion (exact cross-multiplied check) and refusals', () => {
  const r = rng(107);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r), B = randomInterval(r);
    const C = IV.div(A, B);
    if (B.lo <= 0 && B.hi >= 0) {
      assert.equal(C.ok, false);
      continue;
    }
    const c = unwrap(C);
    for (const x of samples(A, r)) {
      for (const y of samples(B, r)) {
        // x / y ∈ [lo, hi] <=> lo y <= x <= hi y (y > 0), reversed for y < 0.
        const Y = dy(y), X = dy(x);
        const okLo = c.lo === -Infinity || (y > 0 ? leD(mulDyadic(dy(c.lo), Y), X) : leD(X, mulDyadic(dy(c.lo), Y)));
        const okHi = c.hi === Infinity || (y > 0 ? leD(X, mulDyadic(dy(c.hi), Y)) : leD(mulDyadic(dy(c.hi), Y), X));
        assert.ok(okLo && okHi, `div ${x} / ${y}`);
      }
    }
    const S = IV.sqrt(A);
    if (A.hi < 0) {
      assert.equal(S.ok, false);
      continue;
    }
    const s = unwrap(S);
    assert.ok(s.lo >= 0);
    for (const x of samples(A, r)) {
      if (x < 0) continue;
      assert.ok(leD(mulDyadic(dy(s.lo), dy(s.lo)), dy(x)) && (s.hi === Infinity || leD(dy(x), mulDyadic(dy(s.hi), dy(s.hi)))));
    }
  }
  assert.equal(IV.div(unwrap(IV.interval(1, 2)), unwrap(IV.interval(-1, 0))).ok, false);
  assert.deepEqual(unwrap(IV.sqrt(unwrap(IV.interval(-4, 9)))), { lo: 0, hi: 3 });
  assert.equal(IV.interval(NaN, 1).ok, false);
  assert.equal(IV.interval(2, 1).ok, false);
  assert.equal(IV.interval(0, Infinity).ok, false);
});

test('hull_sound / hull_least, inter_sound / inter_none', () => {
  const r = rng(108);
  for (let k = 0; k < PAIRS; k++) {
    const A = randomInterval(r), B = randomInterval(r);
    const H = IV.hull(A, B);
    for (const x of [...samples(A, r), ...samples(B, r)]) assert.ok(IV.contains(H, x));
    assert.ok(H.lo === Math.min(A.lo, B.lo) && H.hi === Math.max(A.hi, B.hi));
    const X = IV.intersect(A, B);
    for (const x of [...samples(A, r), ...samples(B, r)]) {
      const both = IV.contains(A, x) && IV.contains(B, x);
      if (X === undefined) assert.equal(both, false);
      else assert.equal(IV.contains(X, x), both);
    }
  }
  assert.equal(IV.intersect(unwrap(IV.interval(0, 1)), unwrap(IV.interval(2, 3))), undefined);
  assert.deepEqual(IV.intersect(unwrap(IV.interval(0, 2)), unwrap(IV.interval(2, 3))), { lo: 2, hi: 2 });
});

test('widen_mem / expand_mem / perturbed_mem: widening keeps members; within-e values land in expand(A, e)', () => {
  const r = rng(109);
  for (let k = 0; k < PAIRS; k++) {
    const A = unwrap(IV.interval(...([r() * 10 - 5, r() * 10 + 5] as const)));
    const e = r() * 1e-3;
    const W = IV.expand(A, e);
    assert.ok(W.lo <= A.lo && A.hi <= W.hi);
    for (const x of samples(A, r)) {
      // x ± e exactly (as dyadics) lies in W.
      assert.ok(inD(addDyadic(dy(x), dy(e)), W) && inD(subDyadic(dy(x), dy(e)), W));
    }
  }
  const [L, R] = IV.bisect(unwrap(IV.interval(0, 1)));
  assert.deepEqual([L, R], [{ lo: 0, hi: 0.5 }, { lo: 0.5, hi: 1 }]);
  assert.ok(IV.width(unwrap(IV.interval(0.1, 0.3))) >= 0.3 - 0.1);
});

test('hullList_mem: hullOf contains every listed value (exact min / max)', () => {
  const r = rng(110);
  for (let k = 0; k < 50; k++) {
    const vals = Array.from({ length: 1 + Math.floor(r() * 20) }, () => randomDouble(r));
    const h = IV.hullOf(vals)!;
    for (const v of vals) assert.ok(IV.contains(h, v));
    assert.ok(vals.includes(h.lo) && vals.includes(h.hi));
  }
  assert.equal(IV.hullOf([]), undefined);
});

// ---------------------------------------------------------------------------------------------
// Certified trigonometry.

test('certified sin / cos: contain 256-bit Taylor values at endpoints and Math samples inside', () => {
  const r = rng(201);
  const intervals: Interval[] = [];
  for (let k = 0; k < 300; k++) {
    const a = (r() - 0.5) * 40;
    const w = r() < 0.3 ? 0 : r() < 0.5 ? r() * 1e-6 : r() * 4;
    intervals.push(unwrap(IV.interval(a, Math.min(20, a + w))));
  }
  // Intervals touching the extrema of sin and cos and exact special points.
  for (const x of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 2 * Math.PI, Math.PI / 6, Math.PI / 3, Math.PI / 4]) {
    intervals.push(unwrap(IV.pointInterval(x)), unwrap(IV.interval(x - 1e-9, x + 1e-9)), unwrap(IV.interval(x, x + 1e-12)));
  }
  for (const T of intervals) {
    const S = IV.sinInterval(T), C = IV.cosInterval(T);
    assert.ok(S.lo >= -1 && S.hi <= 1 && C.lo >= -1 && C.hi <= 1);
    for (const x of [T.lo, T.hi]) {
      assert.ok(ballIn(trigBall(x, 'sin'), S.lo, S.hi), `sin ${x}`);
      assert.ok(ballIn(trigBall(x, 'cos'), C.lo, C.hi), `cos ${x}`);
    }
    for (let k = 0; k <= 16; k++) {
      const x = Math.min(T.hi, T.lo + ((T.hi - T.lo) * k) / 16);
      assert.ok(IV.contains(S, Math.sin(x)) && IV.contains(C, Math.cos(x)));
    }
    // Narrow intervals give narrow enclosures (no needless [-1, 1]).
    if (T.hi - T.lo < 1e-6) assert.ok(S.hi - S.lo < 1e-5 && C.hi - C.lo < 1e-5, `narrow ${T.lo}`);
  }
  // Exact-known values: extrema reached, sin 0 = 0, cos 0 = 1 exactly, sin(π/6) ∋ 1/2.
  assert.deepEqual(IV.sinInterval(unwrap(IV.pointInterval(0))), { lo: 0, hi: 0 });
  assert.deepEqual(IV.cosInterval(unwrap(IV.pointInterval(0))), { lo: 1, hi: 1 });
  assert.equal(IV.sinInterval(unwrap(IV.interval(0, 2))).hi, 1);
  assert.equal(IV.cosInterval(unwrap(IV.interval(3, 3.2))).lo, -1);
  assert.deepEqual(IV.sinInterval(unwrap(IV.interval(-10, 10))), { lo: -1, hi: 1 });
  assert.ok(IV.contains(IV.sinInterval(unwrap(IV.pointInterval(Math.PI / 6))), 0.5));
  assert.ok(IV.contains(IV.cosInterval(unwrap(IV.pointInterval(Math.PI / 3))), 0.5));
  assert.ok(IV.contains(IV.cosInterval(unwrap(IV.pointInterval(Math.PI / 2))), 0));
  // The double Math.PI is below π: sin(Math.PI) > 0 exactly (≈ 1.22e-16), and the enclosure keeps it.
  assert.ok(ballIn(trigBall(Math.PI, 'sin'), ...(Object.values(IV.sinInterval(unwrap(IV.pointInterval(Math.PI)))) as [number, number])));
  assert.ok(qCmp(trigBall(Math.PI, 'sin').v, q(0n)) > 0);
  // tan of a semi-angle, refused where cos may vanish.
  const t = unwrap(IV.tanInterval(unwrap(IV.pointInterval(0.5))));
  assert.ok(IV.contains(t, Math.tan(0.5)));
  assert.equal(IV.tanInterval(unwrap(IV.interval(1.5, 1.6))).ok, false);
  // acos bounds.
  for (const c of [-1, -0.3, 0, 0.5, 0.999999, 1]) assert.ok(IV.acosDown(c) <= Math.acos(c) && Math.acos(c) <= IV.acosUp(c));
});

// ---------------------------------------------------------------------------------------------
// Boxes.

const b3 = (a: readonly number[], b: readonly number[]): Box3 =>
  unwrap(IV.box3({ x: a[0]!, y: a[1]!, z: a[2]! }, { x: b[0]!, y: b[1]!, z: b[2]! }));

test('separated_sound / disjoint_sound / disjoint_iff: exact box disjointness with and without a gap', () => {
  const A = b3([0, 0, 0], [1, 1, 1]);
  assert.equal(unwrap(IV.boxesDisjoint3(A, b3([1, 0, 0], [2, 1, 1]))), false); // touching: common face
  assert.equal(IV.boxesOverlap3(A, b3([1, 0, 0], [2, 1, 1])), true);
  assert.equal(unwrap(IV.boxesDisjoint3(A, b3([IV.nextUp(1), 0, 0], [2, 1, 1]))), true);
  // Gap compared exactly: the floating difference rounds onto the gap, the exact one exceeds it.
  const lo = 2 ** 53 + 4, hi = 1.5, gap = 2 ** 53 + 2; // exact difference 2^53 + 2.5, rounded to 2^53 + 2
  const exact = compareDyadic(subDyadic(dy(lo), dy(hi)), dy(gap)) > 0;
  const B = b3([lo, 0, 0], [2 * lo, 1, 1]);
  const Aa = b3([0, 0, 0], [hi, 1, 1]);
  assert.equal(unwrap(IV.boxesDisjoint3(Aa, B, gap)), exact);
  assert.notEqual(lo - hi > gap, exact); // the floating test would answer differently here
  assert.equal(IV.boxesDisjoint3(A, B, -1).ok, false);
  // Random boxes: disjoint at gap 0 <=> not overlapping, and separated boxes keep their members apart.
  const r = rng(301);
  for (let k = 0; k < 500; k++) {
    const mk = (): Box3 => {
      const c = [r() * 4, r() * 4, r() * 4], s = [r(), r(), r()];
      return b3(c, c.map((v, i) => v + s[i]!));
    };
    const P = mk(), Q2 = mk();
    const d0 = unwrap(IV.boxesDisjoint3(P, Q2));
    assert.equal(d0, !IV.boxesOverlap3(P, Q2));
    assert.equal(d0, IV.intersectBox3(P, Q2) === undefined);
    const g = r() * 0.5;
    if (unwrap(IV.boxesDisjoint3(P, Q2, g))) {
      for (let s = 0; s < 10; s++) {
        const p = { x: P.min.x + (P.max.x - P.min.x) * r(), y: P.min.y + (P.max.y - P.min.y) * r(), z: P.min.z + (P.max.z - P.min.z) * r() };
        const qq = { x: Q2.min.x + (Q2.max.x - Q2.min.x) * r(), y: Q2.min.y + (Q2.max.y - Q2.min.y) * r(), z: Q2.min.z + (Q2.max.z - Q2.min.z) * r() };
        assert.ok(Math.abs(p.x - qq.x) > g || Math.abs(p.y - qq.y) > g || Math.abs(p.z - qq.z) > g);
      }
    }
  }
  // 2D boxes.
  const p2 = unwrap(IV.box2({ x: 0, y: 0 }, { x: 1, y: 1 }));
  const q2 = unwrap(IV.box2({ x: 2, y: 0 }, { x: 3, y: 1 }));
  assert.equal(unwrap(IV.boxesDisjoint2(p2, q2)), true);
  assert.equal(unwrap(IV.boxesDisjoint2(p2, q2, 1)), false);
  assert.equal(IV.boxesOverlap2(IV.unionBox2(p2, q2), q2), true);
  assert.deepEqual(unwrap(IV.box2OfPoints([{ x: 3, y: -1 }, { x: 0, y: 2 }])), { min: { x: 0, y: -1 }, max: { x: 3, y: 2 } });
});

test('union3_mem: unionBox3 contains both boxes; expandBox3 rounds outward', () => {
  const A = b3([0, 0, 0], [1, 1, 1]), B = b3([-1, 2, 0.5], [0.5, 3, 4]);
  const U = IV.unionBox3(A, B);
  assert.ok(IV.box3ContainsBox(U, A) && IV.box3ContainsBox(U, B));
  assert.deepEqual(U, b3([-1, 0, 0], [1, 3, 4]));
  const E = unwrap(IV.expandBox3(b3([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]), 0.2));
  for (const k of ['x', 'y', 'z'] as const) {
    const c = { x: 0.1, y: 0.2, z: 0.3 }[k];
    assert.ok(inD(subDyadic(dy(c), dy(0.2)), { lo: E.min[k], hi: E.max[k] }) && inD(addDyadic(dy(c), dy(0.2)), { lo: E.min[k], hi: E.max[k] }));
  }
  assert.equal(IV.expandBox3(A, NaN).ok, false);
  assert.ok(IV.box3Diagonal(b3([0, 0, 0], [3, 4, 0])) >= 5);
  assert.equal(IV.box3(b3([0, 0, 0], [1, 1, 1]).max, { x: 0, y: 0, z: 0 }).ok, false);
  assert.equal(IV.box3OfPoints([]).ok, false);
  const v = IV.ivCross(unwrap(IV.ivecOfPoint({ x: 1, y: 0, z: 0 })), unwrap(IV.ivecOfPoint({ x: 0, y: 1, z: 0 })));
  assert.deepEqual(unwrap(IV.boxOfIVec(v)), b3([0, 0, 1], [0, 0, 1]));
});

test('combo_mem / ratio_combo_mem: exact convex and positively weighted combinations of points stay in their box', () => {
  const r = rng(302);
  for (let k = 0; k < 100; k++) {
    const n = 2 + Math.floor(r() * 5);
    const pts = Array.from({ length: n }, () => ({ x: (r() - 0.5) * 10, y: (r() - 0.5) * 10, z: (r() - 0.5) * 10 }));
    const box = unwrap(IV.box3OfPoints(pts));
    const w = Array.from({ length: n }, () => qOf(r() + 1e-3));
    let sw = q(0n);
    for (const wi of w) sw = qAdd(sw, wi);
    for (const axis of ['x', 'y', 'z'] as const) {
      let s = q(0n);
      pts.forEach((p, i) => (s = qAdd(s, qMul(w[i]!, qOf(p[axis])))));
      const c = qDiv(s, sw);
      assert.ok(qCmp(qOf(box.min[axis]), c) <= 0 && qCmp(c, qOf(box.max[axis])) <= 0);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// NURBS bounds against exact rational evaluation.

/** Exact de Boor (the Lean `deBoor`) of fraction control points at a double parameter. */
function deBoorQ(knots: readonly number[], p: number, P: readonly (readonly Q[])[], span: number, u: number): Q[] {
  const s = span - p;
  const d = Array.from({ length: p + 1 }, (_, j) => P[s + j]!.slice());
  const uq = qOf(u);
  for (let rr = 1; rr <= p; rr++) {
    for (let j = p; j >= rr; j--) {
      const lo = qOf(knots[s + j]!);
      const den = qSub(qOf(knots[s + j + p + 1 - rr]!), lo);
      const a = den.n === 0n ? q(0n) : qDiv(qSub(uq, lo), den);
      const om = qSub(q(1n), a);
      d[j] = d[j]!.map((c, i) => qAdd(qMul(om, d[j - 1]![i]!), qMul(a, c)));
    }
  }
  return d[p]!;
}

/** Exact homogeneous control points (w x, w) of a curve. */
function homQ(points: readonly (readonly number[])[], weights: readonly number[] | undefined): Q[][] {
  return points.map((pt, i) => {
    const w = qOf(weights?.[i] ?? 1);
    return [...pt.map((c) => qMul(qOf(c), w)), w];
  });
}

function exactCurvePoint(c: NurbsCurve, t: number): Q[] {
  const h = deBoorQ(c.knots, c.degree, homQ(c.controlPoints, c.weights), findSpan(c.knots, c.degree, t), t);
  const w = h[c.dimension]!;
  return h.slice(0, c.dimension).map((x) => qDiv(x, w));
}

function exactSurfacePoint(s: NurbsSurface, u: number, v: number): Q[] {
  const net = s.controlPoints.map((row, i) => homQ(row, s.weights?.[i]));
  const su = findSpan(s.knotsU, s.degreeU, u), sv = findSpan(s.knotsV, s.degreeV, v);
  const cols: Q[][] = [];
  for (let j = sv - s.degreeV; j <= sv; j++) cols[j] = deBoorQ(s.knotsU, s.degreeU, net.map((row) => row[j]!), su, u);
  const h = deBoorQ(s.knotsV, s.degreeV, cols, sv, v);
  const w = h[s.dimension]!;
  return h.slice(0, s.dimension).map((x) => qDiv(x, w));
}

function inBoxQ(b: Box3, p: readonly Q[]): boolean {
  return (['x', 'y', 'z'] as const).every((k, i) => qCmp(qOf(b.min[k]), p[i]!) <= 0 && qCmp(p[i]!, qOf(b.max[k])) <= 0);
}

function randomCurve(r: () => number, rational: boolean): NurbsCurve {
  const p = 2 + Math.floor(r() * 2);
  const n = p + 1 + Math.floor(r() * 4);
  const interior = Array.from({ length: n - p - 1 }, () => Math.round(r() * 64) / 64).sort((a, b) => a - b);
  const knots = [...Array<number>(p + 1).fill(0), ...interior, ...Array<number>(p + 1).fill(1)];
  const pts = Array.from({ length: n }, () => [(r() - 0.5) * 10, (r() - 0.5) * 10, (r() - 0.5) * 10]);
  const w = rational ? Array.from({ length: n }, () => 0.25 + r() * 3) : undefined;
  const c = createNurbsCurve(p, knots, pts, w);
  return c.ok ? c.value : randomCurve(r, rational);
}

test('deBoor_in_hull / perturbed_deBoor_mem: NURBS curve boxes contain the exact (rational) curve points', () => {
  const r = rng(401);
  for (let k = 0; k < 40; k++) {
    const c = randomCurve(r, k % 2 === 1);
    const a = Math.round(r() * 32) / 64, b = a + Math.round(r() * 32) / 64;
    const T = unwrap(IV.interval(a, b));
    const box = unwrap(IV.boundCurve(c, T));
    const full = unwrap(IV.boundCurve(c, unwrap(IV.interval(0, 1))));
    assert.ok(IV.box3ContainsBox(full, box) || IV.boxesOverlap3(full, box));
    for (let s = 0; s <= 12; s++) {
      const t = a + ((b - a) * s) / 12;
      assert.ok(inBoxQ(box, exactCurvePoint(c, t)), `curve ${k} t=${t}`);
      const f = unwrap(evaluateCurve(c, t));
      assert.ok(IV.box3Contains(unwrap(IV.expandBox3(box, 1e-12)), { x: f[0]!, y: f[1]!, z: f[2]! }));
    }
  }
  // Wrapped as a Curve3, the same box.
  const c = randomCurve(r, true);
  const T = unwrap(IV.interval(0.25, 0.5));
  assert.deepEqual(unwrap(IV.boundCurve(unwrap(createNurbsCurve3(c)), T)), unwrap(IV.boundCurve(c, T)));
});

test('NURBS curve bounds shrink under subdivision and the sub-curve hull beats the control-window hull', () => {
  const r = rng(402);
  const c = randomCurve(r, true);
  let prev = Infinity;
  let first = 0;
  for (let depth = 0; depth <= 8; depth++) {
    const n = 2 ** depth;
    let maxDiag = 0;
    for (let i = 0; i < n; i++) {
      const box = unwrap(IV.boundCurve(c, unwrap(IV.interval(i / n, (i + 1) / n))));
      maxDiag = Math.max(maxDiag, IV.box3Diagonal(box));
      for (let s = 0; s <= 4; s++) assert.ok(inBoxQ(box, exactCurvePoint(c, i / n + s / (4 * n))));
    }
    // Asymptotically the box diagonal is the chord length: it halves with the interval.
    if (depth >= 6) assert.ok(maxDiag < 0.6 * prev, `depth ${depth}: ${maxDiag} vs ${prev}`);
    else if (depth >= 1) assert.ok(maxDiag <= prev);
    if (depth === 0) first = maxDiag;
    prev = maxDiag;
  }
  assert.ok(prev < first / 10);
  // The extracted sub-curve's hull is much tighter than the hull of the original span window.
  const T = unwrap(IV.interval(0.3, 0.31));
  const [w0, w1] = IV.spanWindow(c.knots, c.degree, T);
  const coarse = unwrap(IV.box3OfPoints(c.controlPoints.slice(w0, w1 + 1).map((p) => ({ x: p[0]!, y: p[1]!, z: p[2]! }))));
  const fine = unwrap(IV.boundCurve(c, T));
  assert.ok(IV.box3ContainsBox(coarse, fine) && IV.box3Diagonal(fine) < 0.2 * IV.box3Diagonal(coarse));
  // A degenerate parameter interval gives a tiny box around the point.
  const pbox = unwrap(IV.boundCurve(c, unwrap(IV.pointInterval(0.3))));
  assert.ok(IV.box3Diagonal(pbox) < 1e-10 && inBoxQ(pbox, exactCurvePoint(c, 0.3)));
});

test('NURBS bounds: refusals (out of domain, non-positive weights, wrong dimension)', () => {
  const c = randomCurve(rng(403), false);
  assert.equal(IV.boundCurve(c, unwrap(IV.interval(-0.5, 0.5))).ok, false);
  const bad = Object.freeze({ ...c, weights: c.controlPoints.map((_, i) => (i === 1 ? 0 : 1)) }) as NurbsCurve;
  assert.equal(IV.boundNurbsCurve(bad, unwrap(IV.interval(0, 1))).ok, false);
  const c2 = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0], [1, 2]]));
  assert.equal(IV.boundCurve(c2, unwrap(IV.interval(0, 1))).ok, false);
  const b2 = unwrap(IV.boundNurbsCurve(c2, unwrap(IV.interval(0, 0.5))));
  assert.ok(IV.contains(b2[0]!, 0.5) && IV.contains(b2[1]!, 1) && IV.contains(b2[0]!, 0));
});

function randomSurface(r: () => number, rational: boolean): NurbsSurface {
  const p = 2, qd = 2 + Math.floor(r() * 2);
  const n = p + 1 + Math.floor(r() * 3), m = qd + 1 + Math.floor(r() * 3);
  const kv = (deg: number, count: number): number[] => {
    const interior = Array.from({ length: count - deg - 1 }, () => Math.round(r() * 32) / 32).sort((a, b) => a - b);
    return [...Array<number>(deg + 1).fill(0), ...interior, ...Array<number>(deg + 1).fill(1)];
  };
  const net = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => [i + (r() - 0.5), j + (r() - 0.5), (r() - 0.5) * 4]));
  const w = rational ? Array.from({ length: n }, () => Array.from({ length: m }, () => 0.5 + r() * 2)) : undefined;
  const s = createNurbsSurface(p, qd, kv(p, n), kv(qd, m), net, w);
  return s.ok ? s.value : randomSurface(r, rational);
}

test('tensor_in_hull / perturbed_tensor_mem: NURBS surface boxes contain the exact surface points', () => {
  const r = rng(501);
  for (let k = 0; k < 16; k++) {
    const s = randomSurface(r, k % 2 === 1);
    const u0 = Math.round(r() * 16) / 32, u1 = u0 + Math.round(r() * 16) / 32;
    const v0 = Math.round(r() * 16) / 32, v1 = v0 + Math.round(r() * 16) / 32;
    const box = unwrap(IV.boundSurface(s, unwrap(IV.interval(u0, u1)), unwrap(IV.interval(v0, v1))));
    for (let a = 0; a <= 5; a++) {
      for (let b = 0; b <= 5; b++) {
        const u = u0 + ((u1 - u0) * a) / 5, v = v0 + ((v1 - v0) * b) / 5;
        assert.ok(inBoxQ(box, exactSurfacePoint(s, u, v)), `surface ${k} (${u}, ${v})`);
      }
    }
  }
});

test('NURBS surface bounds: exact sphere / torus forms, shrinking under subdivision', () => {
  const sphere = unwrap(createSphereSurface(kernel, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 2));
  const ns = unwrap(sphereToNurbs(sphere, { u: [0, Math.PI], v: [-1, 1] }));
  const dom = { u: [ns.knotsU[0]!, ns.knotsU[ns.knotsU.length - 1]!], v: [ns.knotsV[0]!, ns.knotsV[ns.knotsV.length - 1]!] };
  let prev = Infinity;
  for (let depth = 0; depth <= 4; depth++) {
    const n = 2 ** depth;
    let maxDiag = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const U = unwrap(IV.interval(dom.u[0]! + ((dom.u[1]! - dom.u[0]!) * i) / n, dom.u[0]! + ((dom.u[1]! - dom.u[0]!) * (i + 1)) / n));
        const V = unwrap(IV.interval(dom.v[0]! + ((dom.v[1]! - dom.v[0]!) * j) / n, dom.v[0]! + ((dom.v[1]! - dom.v[0]!) * (j + 1)) / n));
        const box = unwrap(IV.boundSurface(ns, U, V));
        maxDiag = Math.max(maxDiag, IV.box3Diagonal(box));
        if (depth <= 2) assert.ok(inBoxQ(box, exactSurfacePoint(ns, U.lo / 2 + U.hi / 2, V.lo / 2 + V.hi / 2)));
      }
    }
    if (depth >= 2) assert.ok(maxDiag < 0.6 * prev);
    prev = maxDiag;
  }
  const torus = unwrap(createTorusSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 3, 1));
  const nt = unwrap(torusToNurbs(torus, { u: [0, 2 * Math.PI], v: [0, 2 * Math.PI] }));
  const whole = unwrap(IV.boundSurface(nt, unwrap(IV.interval(nt.knotsU[0]!, nt.knotsU.at(-1)!)), unwrap(IV.interval(nt.knotsV[0]!, nt.knotsV.at(-1)!))));
  // The torus fits in [-4, 4]² × [-1, 1]; the hull of its control net is a bit larger but finite.
  assert.ok(whole.min.x <= -4 && whole.max.x >= 4 && whole.min.z <= -1 && whole.max.z >= 1);
  assert.ok(whole.max.x < 10);
  assert.equal(IV.boundSurface(nt, unwrap(IV.interval(-1, 0)), unwrap(IV.interval(0, 0.1))).ok, false);
});

// ---------------------------------------------------------------------------------------------
// Analytic curves and surfaces (interval evaluation with certified trig).

const vecBall = (o: { x: number; y: number; z: number }, k: 'x' | 'y' | 'z'): Ball => ballQ(qOf(o[k]));
const numBall = (x: number): Ball => ballQ(qOf(x));

test('analytic curve bounds: line exact, circle / ellipse contain Taylor-exact points, shrink under subdivision', () => {
  const line = unwrap(createLineCurve({ x: 1, y: 2, z: 3 }, { x: 0.5, y: -1, z: 2 }, [-2, 2]));
  const lb = unwrap(IV.boundCurve(line, unwrap(IV.interval(-1, 1))));
  assert.deepEqual(lb, b3([0.5, 1, 1], [1.5, 3, 5]));
  assert.equal(IV.boundCurve(line, unwrap(IV.interval(-3, 0))).ok, false);
  const circle = unwrap(createCircleCurve(kernel, { x: 10, y: -3, z: 7 }, { x: 1, y: 1, z: 1 }, { x: 1, y: -1, z: 0 }, 2.5));
  const ellipse = unwrap(createEllipseCurve(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0.3, z: 1 }, { x: 1, y: 0, z: 0 }, 3, 1));
  for (const curve of [circle, ellipse]) {
    const [a, bb] = curve.kind === 'circle' ? [curve.radius, curve.radius] : [curve.majorRadius, curve.minorRadius];
    let prev = Infinity;
    for (let depth = 0; depth <= 6; depth++) {
      const n = 2 ** depth;
      let maxDiag = 0;
      for (let i = 0; i < n; i++) {
        const T = unwrap(IV.interval((2 * Math.PI * i) / n, (2 * Math.PI * (i + 1)) / n));
        const box = unwrap(IV.boundCurve(curve, T));
        maxDiag = Math.max(maxDiag, IV.box3Diagonal(box));
        for (let s = 0; s <= 3; s++) {
          const t = Math.min(T.hi, T.lo + ((T.hi - T.lo) * s) / 3);
          const cs = trigBall(t, 'cos'), sn = trigBall(t, 'sin');
          for (const k of ['x', 'y', 'z'] as const) {
            const val = ballAdd(
              ballAdd(vecBall(curve.center, k), ballMul(ballMul(numBall(a), cs), vecBall(curve.frame.xAxis, k))),
              ballMul(ballMul(numBall(bb), sn), vecBall(curve.frame.yAxis, k)),
            );
            assert.ok(ballIn(val, box.min[k], box.max[k]), `${curve.kind} t=${t} ${k}`);
          }
        }
      }
      if (depth >= 2) assert.ok(maxDiag < 0.7 * prev);
      prev = maxDiag;
    }
  }
  // The circle box agrees with the hull of its exact NURBS form's box (both contain the arc).
  const arc = unwrap(createCircleCurve(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1, [0, Math.PI / 2]));
  const ab = unwrap(IV.boundCurve(arc, unwrap(IV.interval(0, Math.PI / 2))));
  const nb = unwrap(IV.boundCurve(unwrap(circleArcToNurbs(arc)), unwrap(IV.interval(0, 1))));
  assert.ok(IV.boxesOverlap3(ab, nb));
  assert.ok(ab.max.x >= 1 && ab.max.y >= 1 && ab.min.x <= 0 && ab.max.x - 1 < 1e-14);
});

function analyticPointBall(s: Surface3, u: number, v: number): Ball[] {
  const cu = trigBall(u, 'cos'), su = trigBall(u, 'sin');
  const out: Ball[] = [];
  for (const k of ['x', 'y', 'z'] as const) {
    const X = vecBall(s.kind === 'nurbs' ? { x: 0, y: 0, z: 0 } : s.frame.xAxis, k);
    const Y = vecBall(s.kind === 'nurbs' ? { x: 0, y: 0, z: 0 } : s.frame.yAxis, k);
    const Z = vecBall(s.kind === 'nurbs' ? { x: 0, y: 0, z: 0 } : s.frame.normal, k);
    let a: Ball, b: Ball, c: Ball, o: Ball;
    switch (s.kind) {
      case 'plane':
        [o, a, b, c] = [vecBall(s.origin, k), numBall(u), numBall(v), numBall(0)];
        break;
      case 'cylinder':
        [o, a, b, c] = [vecBall(s.origin, k), ballMul(numBall(s.radius), cu), ballMul(numBall(s.radius), su), numBall(v)];
        break;
      case 'sphere':
      case 'torus': {
        const [R, r] = s.kind === 'sphere' ? [0, s.radius] : [s.majorRadius, s.minorRadius];
        const rho = ballAdd(numBall(R), ballMul(numBall(r), trigBall(v, 'cos')));
        [o, a, b, c] = [vecBall(s.center, k), ballMul(rho, cu), ballMul(rho, su), ballMul(numBall(r), trigBall(v, 'sin'))];
        break;
      }
      default:
        throw new Error('not used');
    }
    out.push(ballAdd(ballAdd(ballAdd(o, ballMul(a, X)), ballMul(b, Y)), ballMul(c, Z)));
  }
  return out;
}

test('analytic surface bounds: plane / cylinder / sphere / torus contain Taylor-exact points; cone contains evaluated points', () => {
  const plane = unwrap(createPlaneSurface(kernel, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }));
  assert.deepEqual(unwrap(IV.boundSurface(plane, unwrap(IV.interval(-1, 2)), unwrap(IV.interval(0, 3)))), b3([0, 1, 1], [3, 4, 1]));
  const cyl = unwrap(createCylinderSurface(kernel, { x: 0, y: 1, z: 0 }, { x: 0.2, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1.5));
  const sph = unwrap(createSphereSurface(kernel, { x: -2, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, 3));
  const tor = unwrap(createTorusSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }, 4, 1));
  for (const s of [plane, cyl, sph, tor] as Surface3[]) {
    const vRange = s.kind === 'sphere' ? [-Math.PI / 2, Math.PI / 2] : s.kind === 'torus' ? [0, 2 * Math.PI] : [-1, 2];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const U = unwrap(IV.interval((2 * Math.PI * i) / 4, (2 * Math.PI * (i + 1)) / 4));
        const V = unwrap(IV.interval(vRange[0]! + ((vRange[1]! - vRange[0]!) * j) / 4, vRange[0]! + ((vRange[1]! - vRange[0]!) * (j + 1)) / 4));
        const box = unwrap(IV.boundSurface(s, U, V));
        for (let a = 0; a <= 2; a++) {
          for (let b = 0; b <= 2; b++) {
            const u = Math.min(U.hi, U.lo + ((U.hi - U.lo) * a) / 2), v = Math.min(V.hi, V.lo + ((V.hi - V.lo) * b) / 2);
            const pb = analyticPointBall(s, u, v);
            (['x', 'y', 'z'] as const).forEach((k, idx) => assert.ok(ballIn(pb[idx]!, box.min[k], box.max[k]), `${s.kind} (${u}, ${v}) ${k}`));
          }
        }
      }
    }
  }
  const cone = unwrap(createConeSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1, 0.4));
  const tanA = Math.tan(0.4);
  const apex = -1 / tanA;
  const coneBox = unwrap(IV.boundSurface(cone, unwrap(IV.interval(0, 2 * Math.PI)), unwrap(IV.interval(apex, 2))));
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const p = surfacePoint3(cone, (2 * Math.PI * a) / 12, apex + ((2 - apex) * b) / 12);
      if (p.ok) assert.ok(IV.box3Contains(unwrap(IV.expandBox3(coneBox, 1e-12)), p.value));
    }
  }
  assert.ok(coneBox.max.z >= 2 && coneBox.min.z <= apex);
  assert.equal(IV.boundSurface(cone, unwrap(IV.interval(0, 1)), unwrap(IV.interval(-20, -10))).ok, false);
  assert.equal(IV.boundSurface(sph, unwrap(IV.interval(0, 1)), unwrap(IV.interval(2, 3))).ok, false);
  // Sphere enclosures shrink with the patch.
  let prev = Infinity;
  for (let depth = 0; depth <= 5; depth++) {
    const w = 1 / 2 ** depth;
    const d = IV.box3Diagonal(unwrap(IV.boundSurface(sph, unwrap(IV.interval(0.3, 0.3 + w)), unwrap(IV.interval(0.2, 0.2 + w)))));
    if (depth >= 1) assert.ok(d < 0.6 * prev);
    prev = d;
  }
});

// ---------------------------------------------------------------------------------------------
// Normal cones.

function angle(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const d = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, d / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))));
}

test('boundNormalCone: sampled unit normals lie within the cone, which narrows with the patch', () => {
  const sph = unwrap(createSphereSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 2));
  const cyl = unwrap(createCylinderSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, 1));
  const cone = unwrap(createConeSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1, -0.3));
  const tor = unwrap(createTorusSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 3, 1));
  const ns = unwrap(createNurbsSurface3(unwrap(sphereToNurbs(sph, { u: [0, Math.PI / 2], v: [0, 1] }))));
  const rs = unwrap(createNurbsSurface3(randomSurface(rng(601), true)));
  const cases: [Surface3, Interval, Interval][] = [
    [sph, unwrap(IV.interval(0.1, 0.4)), unwrap(IV.interval(0.2, 0.5))],
    [sph, unwrap(IV.interval(0, 1)), unwrap(IV.interval(1.2, Math.PI / 2))],
    [cyl, unwrap(IV.interval(1, 1.3)), unwrap(IV.interval(-5, 5))],
    [cone, unwrap(IV.interval(2, 2.5)), unwrap(IV.interval(0, 1))],
    [tor, unwrap(IV.interval(0.5, 0.9)), unwrap(IV.interval(2, 2.6))],
    [ns, unwrap(IV.interval(0.25, 0.5)), unwrap(IV.interval(0.25, 0.5))],
    [rs, unwrap(IV.interval(0.4, 0.45)), unwrap(IV.interval(0.4, 0.45))],
  ];
  for (const [s, U, V] of cases) {
    const cone2 = unwrap(IV.boundNormalCone(s, U, V));
    assert.ok(cone2.halfAngle < Math.PI / 2, `${s.kind}: ${cone2.halfAngle}`);
    for (let a = 0; a <= 6; a++) {
      for (let b = 0; b <= 6; b++) {
        const u = U.lo + ((U.hi - U.lo) * a) / 6, v = V.lo + ((V.hi - V.lo) * b) / 6;
        const n = surfaceNormal3(kernel, s, u, v);
        if (!n.ok) continue;
        assert.ok(angle(n.value, cone2.axis) <= cone2.halfAngle + 1e-12, `${s.kind} (${u}, ${v})`);
      }
    }
  }
  // Narrowing: the sphere's cone half-angle tracks the patch size.
  const small = unwrap(IV.boundNormalCone(sph, unwrap(IV.interval(0.3, 0.31)), unwrap(IV.interval(0.3, 0.31))));
  assert.ok(small.halfAngle < 0.03);
  const plane = unwrap(createPlaneSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }));
  assert.deepEqual(unwrap(IV.boundNormalCone(plane, unwrap(IV.interval(0, 1)), unwrap(IV.interval(0, 1)))), { axis: plane.frame.normal, halfAngle: 0 });
  // A whole sphere: no bounded cone.
  assert.ok(unwrap(IV.boundNormalCone(sph, unwrap(IV.interval(0, 2 * Math.PI)), unwrap(IV.interval(-1.5, 1.5)))).halfAngle >= Math.PI);
});

test('normalConesSeparated: sound on parallel / anti-parallel pairs, true for well-separated cones', () => {
  const z = { x: 0, y: 0, z: 1 }, x = { x: 1, y: 0, z: 0 }, d = { x: 1, y: 0, z: 1 };
  assert.equal(IV.normalConesSeparated({ axis: z, halfAngle: 0.1 }, { axis: x, halfAngle: 0.1 }), true);
  assert.equal(IV.normalConesSeparated({ axis: z, halfAngle: 0 }, { axis: z, halfAngle: 0 }), false);
  assert.equal(IV.normalConesSeparated({ axis: z, halfAngle: 0 }, { axis: { x: 0, y: 0, z: -1 }, halfAngle: 0 }), false);
  // 45° apart: separated only while the half-angles sum below π/4.
  assert.equal(IV.normalConesSeparated({ axis: z, halfAngle: 0.3 }, { axis: d, halfAngle: 0.4 }), true);
  assert.equal(IV.normalConesSeparated({ axis: z, halfAngle: 0.4 }, { axis: d, halfAngle: 0.4 }), false);
  // Patches of a plane and a cylinder side.
  const plane = unwrap(createPlaneSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }));
  const cyl = unwrap(createCylinderSurface(kernel, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1));
  const a = unwrap(IV.boundNormalCone(plane, unwrap(IV.interval(0, 1)), unwrap(IV.interval(0, 1))));
  const b = unwrap(IV.boundNormalCone(cyl, unwrap(IV.interval(0, 0.5)), unwrap(IV.interval(0, 1))));
  assert.equal(IV.normalConesSeparated(a, b), true);
  assert.equal(IV.boundNormalCone(plane, unwrap(IV.interval(0, 1)), { lo: 1, hi: 0 }).ok, false);
});

test('homogeneousPartials: the hodograph enclosures contain the evaluated partial derivatives', () => {
  const s = randomSurface(rng(701), false);
  const U = unwrap(IV.interval(0.2, 0.35)), V = unwrap(IV.interval(0.5, 0.6));
  const p = unwrap(IV.homogeneousPartials(s, U, V));
  const net = homogeneousNet(s);
  assert.ok(net.length > 0);
  for (let a = 0; a <= 4; a++) {
    for (let b = 0; b <= 4; b++) {
      const u = U.lo + ((U.hi - U.lo) * a) / 4, v = V.lo + ((V.hi - V.lo) * b) / 4;
      // Central differences of the point give the partials to ~1e-6.
      const h = 1e-6;
      const pt = (uu: number, vv: number): number[] => exactSurfacePoint(s, uu, vv).map((c) => Number(c.n) / Number(c.d));
      const du = pt(u + h, v).map((c, i) => (c - pt(u - h, v)[i]!) / (2 * h));
      const dv = pt(u, v + h).map((c, i) => (c - pt(u, v - h)[i]!) / (2 * h));
      for (let c = 0; c < 3; c++) {
        assert.ok(IV.contains(IV.expand(p.hu[c]!, 1e-5), du[c]!) && IV.contains(IV.expand(p.hv[c]!, 1e-5), dv[c]!));
      }
    }
  }
  assert.deepEqual(p.hu[3], { lo: 0, hi: 0 });
});

// ---------------------------------------------------------------------------------------------
// Adversarial regressions (review of M4 bounds).

test('homogeneousPartials: degenerate parameter intervals keep the derivative (no collapsed hodograph window)', () => {
  // Bilinear S = (u, v, u v): S_u = (1, 0, v), S_v = (0, 1, u).
  const s = unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 1]]]));
  const V = unwrap(IV.interval(0, 1));
  for (const u of [0, 0.5, 1, 0.25]) {
    const p = unwrap(IV.homogeneousPartials(s, unwrap(IV.pointInterval(u)), V));
    assert.ok(IV.contains(p.hu[0]!, 1) && IV.contains(p.hu[1]!, 0), `u=${u}`);
    assert.ok(IV.contains(p.hu[2]!, 0) && IV.contains(p.hu[2]!, 1), `u=${u}`);
    assert.ok(IV.contains(p.hv[1]!, 1) && IV.contains(p.hv[2]!, u), `u=${u}`);
    // Both directions degenerate.
    const q = unwrap(IV.homogeneousPartials(s, unwrap(IV.pointInterval(u)), unwrap(IV.pointInterval(u))));
    assert.ok(IV.contains(q.hu[0]!, 1) && IV.contains(q.hu[2]!, u) && IV.contains(q.hv[1]!, 1) && IV.contains(q.hv[2]!, u));
  }
  // A C0 crease (u-knot 0.5 of multiplicity 2 = degree): both one-sided u-derivatives are enclosed at u = 0.5.
  const crease = unwrap(
    createNurbsSurface(
      2,
      1,
      [0, 0, 0, 0.5, 0.5, 1, 1, 1],
      [0, 0, 1, 1],
      [0, 1, 2, 3, 4].map((i) => [[i, 0, i === 2 ? 0 : i % 2 === 0 ? 0 : 3], [i, 1, i === 1 ? -2 : 0]]),
    ),
  );
  const at = unwrap(IV.homogeneousPartials(crease, unwrap(IV.pointInterval(0.5)), V));
  for (const v of [0, 0.5, 1]) {
    for (const uu of [0.5 - 2 ** -30, 0.5 + 2 ** -30]) {
      const h = 2 ** -40;
      const a = exactSurfacePoint(crease, uu + h, v), b = exactSurfacePoint(crease, uu - h, v);
      for (let c = 0; c < 3; c++) {
        const diff = qSub(a[c]!, b[c]!);
        const d = Number((diff.n << 96n) / diff.d) / 2 ** 96 / (2 * h);
        assert.ok(IV.contains(IV.expand(at.hu[c]!, 1e-6), d), `crease side ${uu} v=${v} c=${c}: ${d} ∉ [${at.hu[c]!.lo}, ${at.hu[c]!.hi}]`);
      }
    }
  }
});

test('never NaN: unbounded division, non-finite scale / expand, NaN in hullOf and the acos / atan bounds', () => {
  const big = IV.mul(unwrap(IV.interval(1e300, 1e300)), unwrap(IV.interval(1e300, 1e300)));
  assert.equal(big.hi, Infinity);
  const d = unwrap(IV.div(big, big));
  assert.ok(!Number.isNaN(d.lo) && !Number.isNaN(d.hi) && d.lo <= 1 && 1 <= d.hi);
  assert.ok(!Number.isNaN(IV.divDown(Infinity, -Infinity)) && !Number.isNaN(IV.divUp(-Infinity, Infinity)));
  const one = unwrap(IV.interval(1, 2));
  for (const bad of [NaN, Infinity, -Infinity]) {
    const sc = IV.scale(one, bad);
    assert.ok(sc.lo === -Infinity && sc.hi === Infinity && !IV.isBounded(sc));
  }
  for (const bad of [NaN, -1]) {
    const ex = IV.expand(one, bad);
    assert.ok(ex.lo === -Infinity && ex.hi === Infinity);
  }
  assert.equal(IV.hullOf([1, NaN, 2]), undefined);
  assert.ok(IV.acosUp(NaN) > Math.PI && IV.acosDown(NaN) === 0 && IV.atanUp(NaN) > Math.PI / 2);
});

test('deBoor_in_hull (adversarial): high degree, weights over 16 decades, large offsets, knot-aligned and ulp-wide intervals', () => {
  const r = rng(9001);
  let checked = 0;
  for (let k = 0; k < 90; k++) {
    const p = 1 + Math.floor(r() * 9);
    const n = p + 1 + Math.floor(r() * 5);
    const offset = [0, 1e8, -3e12, 1e15][k % 4]!;
    const scl = [1, 1e-6, 1e6][Math.floor(r() * 3)]!;
    const pts = Array.from({ length: n }, () => [offset + (r() - 0.5) * scl, (r() < 0.5 ? -1 : 1) * 1e10 * r(), r() - 0.5]);
    const wmode = k % 3;
    const w = wmode === 0 ? undefined : Array.from({ length: n }, () => (wmode === 1 ? 10 ** ((r() - 0.5) * 16) : 0.5 + r()));
    const interior = Array.from({ length: n - p - 1 }, () => (k % 2 === 0 ? Math.round(r() * 8) / 8 : r())).sort((a, b) => a - b);
    const c = createNurbsCurve(p, [...Array<number>(p + 1).fill(0), ...interior, ...Array<number>(p + 1).fill(1)], pts, w);
    if (!c.ok) continue;
    const cand = [...c.value.knots.filter((x) => x > 0 && x < 1), r(), r(), 0, 1];
    let a = cand[Math.floor(r() * cand.length)]!, b = cand[Math.floor(r() * cand.length)]!;
    if (a > b) [a, b] = [b, a];
    if (r() < 0.3) b = a;
    else if (r() < 0.3 && a < 1) b = Math.min(1, IV.nextUp(IV.nextUp(IV.nextUp(a))));
    const box = unwrap(IV.boundCurve(c.value, unwrap(IV.interval(a, b))));
    for (let s = 0; s <= 4; s++) {
      const t = s === 4 ? b : a + ((b - a) * s) / 4;
      assert.ok(inBoxQ(box, exactCurvePoint(c.value, t)), `curve ${k} p=${p} t=${t} in [${a}, ${b}]`);
      checked++;
    }
  }
  assert.ok(checked > 300);
});
