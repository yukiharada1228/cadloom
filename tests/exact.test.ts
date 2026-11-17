import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrap } from '../src/core/error.ts';
import { vec2, vec3, type Point2, type Point3 } from '../src/math/vec.ts';
import {
  addDyadic,
  compareDyadic,
  doubleFields,
  dyadic,
  dyadicEquals,
  dyadicFromNumber,
  dyadicToFraction,
  mulDyadic,
  negDyadic,
  orient2d,
  orient2dExact,
  orient2dFilter,
  orient3d,
  orient3dExact,
  orient3dFilter,
  signDyadic,
  subDyadic,
  type Dyadic,
  type Sign,
} from '../src/exact/index.ts';

// ---------------------------------------------------------------------------------------------
// Independent reference: exact rationals of doubles by repeated doubling (no bit decoding).

interface Frac { readonly n: bigint; readonly d: bigint }

function refFrac(x: number): Frac {
  let k = 0n;
  let v = x;
  while (!Number.isInteger(v)) { v *= 2; k += 1n; } // doubling is exact for finite doubles
  return { n: BigInt(v), d: 1n << k };
}
const fadd = (a: Frac, b: Frac): Frac => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const fsub = (a: Frac, b: Frac): Frac => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const fmul = (a: Frac, b: Frac): Frac => ({ n: a.n * b.n, d: a.d * b.d });
const fsign = (a: Frac): Sign => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0); // denominators positive
const feq = (a: Frac, b: Frac): boolean => a.n * b.d === b.n * a.d;
const dyFrac = (a: Dyadic): Frac => { const f = dyadicToFraction(a); return { n: f.num, d: f.den }; };

function refOrient2d(a: Point2, b: Point2, c: Point2): Sign {
  const [ax, ay, bx, by, cx, cy] = [a.x, a.y, b.x, b.y, c.x, c.y].map(refFrac) as [Frac, Frac, Frac, Frac, Frac, Frac];
  return fsign(fsub(fmul(fsub(bx, ax), fsub(cy, ay)), fmul(fsub(by, ay), fsub(cx, ax))));
}

/** `((b - a) × (c - a)) · (d - a)`, an expansion different from the implementation's. */
function refOrient3d(a: Point3, b: Point3, c: Point3, d: Point3): Sign {
  const f = (p: Point3) => [refFrac(p.x), refFrac(p.y), refFrac(p.z)] as const;
  const [ax, ay, az] = f(a), [bx, by, bz] = f(b), [cx, cy, cz] = f(c), [dx, dy, dz] = f(d);
  const ux = fsub(bx, ax), uy = fsub(by, ay), uz = fsub(bz, az);
  const vx = fsub(cx, ax), vy = fsub(cy, ay), vz = fsub(cz, az);
  const wx = fsub(dx, ax), wy = fsub(dy, ay), wz = fsub(dz, az);
  const nx = fsub(fmul(uy, vz), fmul(uz, vy));
  const ny = fsub(fmul(uz, vx), fmul(ux, vz));
  const nz = fsub(fmul(ux, vy), fmul(uy, vx));
  return fsign(fadd(fadd(fmul(nx, wx), fmul(ny, wy)), fmul(nz, wz)));
}

const naive2d = (a: Point2, b: Point2, c: Point2): Sign =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) as Sign;

/** Deterministic PRNG (mulberry32). */
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

/** Random finite doubles over a wide exponent range, including subnormals. */
function wideDoubles(seed: number, count: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const e = Math.floor(r() * 2000) - 1060;
    const sign = r() < 0.5 ? -1 : 1;
    out.push(sign * (1 + r()) * 2 ** Math.max(e, -1074));
  }
  return out.concat([0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, 2 ** -1022, 0.1, 1 / 3]);
}

const dy = (x: number): Dyadic => unwrap(dyadicFromNumber(x));
const u = 2 ** -53;

// ---------------------------------------------------------------------------------------------
// Dyadic conversion

test('dyadicFromNumber decodes known values exactly', () => {
  assert.deepEqual(dy(0), { num: 0n, exp: 0 });
  assert.deepEqual(dy(-0), { num: 0n, exp: 0 });
  assert.deepEqual(dy(1), { num: 1n, exp: 0 });
  assert.deepEqual(dy(-6), { num: -3n, exp: 1 });
  assert.deepEqual(dy(0.5), { num: 1n, exp: -1 });
  assert.deepEqual(dy(0.1), { num: 3602879701896397n, exp: -55 });
  assert.deepEqual(dy(Number.MIN_VALUE), { num: 1n, exp: -1074 });
  assert.deepEqual(dy(Number.MAX_VALUE), { num: (1n << 53n) - 1n, exp: 971 });
  assert.deepEqual(dy(2 ** -1022 - 2 ** -1074), { num: (1n << 52n) - 1n, exp: -1074 });
});

test('dyadicFromNumber rejects non-finite values', () => {
  for (const x of [NaN, Infinity, -Infinity]) {
    const r = dyadicFromNumber(x);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, 'invalid-input');
  }
});

test('dyadicFromNumber round-trips and is normalised (val_shift, val_zero)', () => {
  for (const x of wideDoubles(1, 2000)) {
    const d = dy(x);
    assert.ok(Object.isFrozen(d));
    if (d.num === 0n) assert.equal(d.exp, 0);
    else assert.equal(d.num & 1n, 1n, 'odd numerator');
    assert.equal(Number(d.num) * 2 ** d.exp, x === 0 ? 0 : x);
    assert.ok(feq(dyFrac(d), refFrac(x)));
  }
});

test('val_shift: dyadic(q * 2^k, e) equals dyadic(q, e + k)', () => {
  for (const [q, k, e] of [[3n, 5, -7], [-5n, 0, 12], [1n, 1000, -2000], [0n, 4, 9]] as const) {
    assert.ok(dyadicEquals(dyadic(q << BigInt(k), e), dyadic(q, e + k)));
  }
  assert.deepEqual(dyadic(0n, 77), { num: 0n, exp: 0 }); // val_zero
});

/** The bit patterns `bits` and `bits + 1` as doubles. */
function fromBits(bits: bigint): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setBigUint64(0, bits);
  return v.getFloat64(0);
}

test('decode_frac_lt / decode_carry_lt: decoding is strictly monotone in the bit pattern', () => {
  const r = rng(7);
  const patterns: bigint[] = [0n, 1n, 0xfffffffffffffn, 0x10000000000000n, 0x7fefffffffffffffn - 1n];
  for (let i = 0; i < 500; i++) patterns.push(BigInt(Math.floor(r() * 2046)) << 52n | (1n << 52n) - 1n); // binade carries
  for (let i = 0; i < 500; i++) patterns.push(BigInt(Math.floor(r() * 0x7fe)) << 52n | BigInt(Math.floor(r() * 2 ** 52)));
  for (const p of patterns) {
    const a = dy(fromBits(p)), b = dy(fromBits(p + 1n));
    assert.equal(compareDyadic(a, b), -1, `pattern ${p.toString(16)}`);
    // Lean `decode` on the fields gives the same value as the implementation
    const f = doubleFields(fromBits(p));
    const lean = f.exponent === 0 ? dyadic(f.fraction, -1074) : dyadic((1n << 52n) + f.fraction, f.exponent - 1075);
    assert.ok(dyadicEquals(lean, a));
  }
});

test('decode_subnormal_boundary: largest subnormal + least subnormal = least normal', () => {
  const maxSub = dy(fromBits(0xfffffffffffffn));
  assert.ok(dyadicEquals(addDyadic(maxSub, dy(Number.MIN_VALUE)), dy(2 ** -1022)));
  assert.ok(dyadicEquals(dyadic(1n << 52n, -1074), dy(2 ** -1022)));
});

// ---------------------------------------------------------------------------------------------
// Dyadic arithmetic

test('add_correct / sub_correct / mul_correct / neg_correct against BigInt fractions', () => {
  const xs = wideDoubles(2, 300);
  const r = rng(3);
  for (let i = 0; i < 2000; i++) {
    const x = xs[Math.floor(r() * xs.length)] as number;
    const y = xs[Math.floor(r() * xs.length)] as number;
    const a = dy(x), b = dy(y), fa = refFrac(x), fb = refFrac(y);
    assert.ok(feq(dyFrac(addDyadic(a, b)), fadd(fa, fb)));
    assert.ok(feq(dyFrac(subDyadic(a, b)), fsub(fa, fb)));
    assert.ok(feq(dyFrac(mulDyadic(a, b)), fmul(fa, fb)));
    assert.ok(feq(dyFrac(negDyadic(a)), { n: -fa.n, d: fa.d }));
  }
});

test('addition cancels exactly where floating point rounds', () => {
  // (1e16 + 1) - 1e16 is 0 in doubles, exactly 1 here
  const big = dy(1e16), one = dy(1);
  assert.deepEqual(subDyadic(addDyadic(big, one), big), { num: 1n, exp: 0 });
  // the exact sum of the doubles 0.1 and 0.2 lies strictly between the doubles 0.3 and 0.30000000000000004
  assert.equal(signDyadic(subDyadic(addDyadic(dy(0.1), dy(0.2)), dy(0.3))), 1);
  assert.equal(compareDyadic(addDyadic(dy(0.1), dy(0.2)), dy(0.30000000000000004)), -1);
});

test('compare_lt_iff / val_pos_iff: compare and sign agree with double ordering', () => {
  const xs = wideDoubles(4, 400);
  for (let i = 0; i + 1 < xs.length; i++) {
    const x = xs[i] as number, y = xs[i + 1] as number;
    assert.equal(compareDyadic(dy(x), dy(y)), x < y ? -1 : x > y ? 1 : 0);
    assert.equal(signDyadic(dy(x)), x > 0 ? 1 : x < 0 ? -1 : 0);
  }
});

// ---------------------------------------------------------------------------------------------
// orient2d

test('orient2d basic signs and conventions (orient2d_eq_cross)', () => {
  const a = vec2(0, 0), b = vec2(1, 0), c = vec2(0, 1);
  assert.equal(unwrap(orient2d(a, b, c)), 1);
  assert.equal(unwrap(orient2d(a, c, b)), -1);
  assert.equal(unwrap(orient2d(a, b, vec2(2, 0))), 0);
});

test('orient2d rejects non-finite input', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const r = orient2d(vec2(0, 0), vec2(bad, 0), vec2(1, 1));
    assert.equal(r.ok, false);
    assert.equal(orient2dExact(vec2(0, 0), vec2(0, bad), vec2(1, 1)).ok, false);
  }
});

test('orient2d is exact near a line where naive floating point fails (Kettner et al.)', () => {
  // p = (0.5 + x u, 0.5 + y u), q = (12, 12), r = (24, 24): p is within a few ulps of the line y = x
  const q = vec2(12, 12), r = vec2(24, 24);
  let naiveWrong = 0, filtered = 0;
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 64; j++) {
      const p = vec2(0.5 + i * u, 0.5 + j * u);
      const ref = refOrient2d(p, q, r);
      assert.equal(ref, Math.sign(j - i)); // exactly: sign of (y - x) for this configuration
      assert.equal(unwrap(orient2d(p, q, r)), ref);
      assert.equal(unwrap(orient2dExact(p, q, r)), ref);
      if (naive2d(p, q, r) !== ref) naiveWrong++;
      const f = orient2dFilter(p, q, r);
      if (f !== undefined) { filtered++; assert.equal(f, ref); }
    }
  }
  assert.ok(naiveWrong > 100, `naive float should fail often here (failed ${naiveWrong})`);
  assert.ok(filtered < 64 * 64, 'the filter must defer on near-degenerate input');
});

test('orient2dDy_val: filtered, exact and reference agree on random near-degenerate input', () => {
  const r = rng(11);
  for (let i = 0; i < 3000; i++) {
    const s = 2 ** (Math.floor(r() * 80) - 40);
    const a = vec2((r() - 0.5) * s, (r() - 0.5) * s);
    const b = vec2((r() - 0.5) * s, (r() - 0.5) * s);
    const t = r() * 4 - 1.5;
    // c near the line ab, perturbed by a few ulps
    const c = vec2(a.x + t * (b.x - a.x) + Math.floor(r() * 5 - 2) * s * u,
                   a.y + t * (b.y - a.y) + Math.floor(r() * 5 - 2) * s * u);
    const ref = refOrient2d(a, b, c);
    assert.equal(unwrap(orient2d(a, b, c)), ref);
    assert.equal(unwrap(orient2dExact(a, b, c)), ref);
    const f = orient2dFilter(a, b, c);
    if (f !== undefined) assert.equal(f, ref);
  }
});

test('orient2d is exact for subnormal and huge coordinates (filter guards)', () => {
  const m = Number.MIN_VALUE;
  const cases: [Point2, Point2, Point2][] = [
    [vec2(0, 0), vec2(3 * m, m), vec2(m, 2 * m)],
    [vec2(0, 0), vec2(2 * m, 2 * m), vec2(5 * m, 5 * m)],
    [vec2(1e-200, 1e-200), vec2(3e-200, 1e-200), vec2(1e-200, 2e-200)],
    [vec2(-1e308, -1e308), vec2(1e308, 1e308), vec2(1e308, 1e308 * (1 - u))],
    [vec2(-1e308, 0), vec2(1e308, 0), vec2(0, m)],
  ];
  for (const [a, b, c] of cases) {
    assert.equal(unwrap(orient2d(a, b, c)), refOrient2d(a, b, c));
    const f = orient2dFilter(a, b, c);
    if (f !== undefined) assert.equal(f, refOrient2d(a, b, c));
  }
  assert.equal(unwrap(orient2d(vec2(-1e308, 0), vec2(1e308, 0), vec2(0, m))), 1);
});

test('orient2d_swap_ab / orient2d_swap_bc / orient2d_swap_ac / orient2d_cyclic', () => {
  const r = rng(5);
  for (let i = 0; i < 500; i++) {
    const a = vec2(0.5 + Math.floor(r() * 8) * u, 0.5 + Math.floor(r() * 8) * u);
    const b = vec2(12, 12), c = vec2(24, 24 + Math.floor(r() * 3 - 1) * 8 * u);
    const s = unwrap(orient2d(a, b, c));
    assert.equal(unwrap(orient2d(b, a, c)), -s || 0);
    assert.equal(unwrap(orient2d(a, c, b)), -s || 0);
    assert.equal(unwrap(orient2d(c, b, a)), -s || 0);
    assert.equal(unwrap(orient2d(b, c, a)), s);
    assert.equal(unwrap(orient2d(c, a, b)), s);
  }
});

test('orient2d_translate: exact translations keep the sign', () => {
  const r = rng(6);
  for (let i = 0; i < 300; i++) {
    const k = Math.floor(r() * 16);
    const a = vec2(0.5 + k * u, 0.5 + Math.floor(r() * 16) * u), b = vec2(12, 12), c = vec2(24, 24);
    // shifted coordinates stay in [0.5, 1) or are small dyadics, so the translation is exact
    const v = vec2(Math.floor(r() * 4) * 2 ** -4, Math.floor(r() * 4) * 2 ** -4);
    const sh = (p: Point2) => vec2(p.x + v.x, p.y + v.y);
    for (const p of [a, b, c]) assert.ok(sh(p).x - v.x === p.x && sh(p).y - v.y === p.y); // exact shift
    assert.equal(unwrap(orient2d(sh(a), sh(b), sh(c))), unwrap(orient2d(a, b, c)));
  }
});

test('orient2d_collinear: (1 - t) a + t b is collinear for exactly representable t', () => {
  const r = rng(8);
  for (let i = 0; i < 500; i++) {
    const a = vec2(Math.floor(r() * 2000) - 1000, Math.floor(r() * 2000) - 1000);
    const b = vec2(Math.floor(r() * 2000) - 1000, Math.floor(r() * 2000) - 1000);
    const t = (Math.floor(r() * 64) - 16) / 16;
    const c = vec2((1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y); // exact: small dyadics
    assert.equal(unwrap(orient2d(a, b, c)), 0);
  }
});

// ---------------------------------------------------------------------------------------------
// orient3d

test('orient3d sign convention (orient3d_eq_triple)', () => {
  const o = vec3(0, 0, 0), x = vec3(1, 0, 0), y = vec3(0, 1, 0);
  assert.equal(unwrap(orient3d(o, x, y, vec3(0, 0, 1))), 1);
  assert.equal(unwrap(orient3d(o, x, y, vec3(0, 0, -1))), -1);
  assert.equal(unwrap(orient3d(o, x, y, vec3(5, -7, 0))), 0);
  assert.equal(unwrap(orient3dExact(o, x, y, vec3(0, 0, 1))), 1);
});

test('orient3d rejects non-finite input', () => {
  assert.equal(orient3d(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, NaN), vec3(0, 0, 1)).ok, false);
  assert.equal(orient3dExact(vec3(Infinity, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)).ok, false);
});

test('orient3d is exact near degenerate configurations where naive floating point fails', () => {
  // a near (0.5, 0.5, 0.5) on the line through b and c: the plane abc is nearly undefined
  const b = vec3(12, 12, 12), c = vec3(24, 24, 24), d = vec3(1, 2, 3);
  const naive3d = (a: Point3): Sign => {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const wx = d.x - a.x, wy = d.y - a.y, wz = d.z - a.z;
    return Math.sign((uy * vz - uz * vy) * wx + (uz * vx - ux * vz) * wy + (ux * vy - uy * vx) * wz) as Sign;
  };
  let naiveWrong = 0;
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const a = vec3(0.5 + i * u, 0.5 + j * u, 0.5);
      const ref = refOrient3d(a, b, c, d);
      assert.equal(unwrap(orient3d(a, b, c, d)), ref);
      assert.equal(unwrap(orient3dExact(a, b, c, d)), ref);
      const f = orient3dFilter(a, b, c, d);
      if (f !== undefined) assert.equal(f, ref);
      if (naive3d(a) !== ref) naiveWrong++;
    }
  }
  assert.ok(naiveWrong > 20, `naive float should fail often here (failed ${naiveWrong})`);
});

test('orient3dDy_val: filtered, exact and reference agree on random near-coplanar input', () => {
  const r = rng(12);
  for (let i = 0; i < 1500; i++) {
    const s = 2 ** (Math.floor(r() * 60) - 30);
    const p = () => vec3((r() - 0.5) * s, (r() - 0.5) * s, (r() - 0.5) * s);
    const a = p(), b = p(), c = p();
    const t1 = r() * 2 - 0.5, t2 = r() * 2 - 0.5;
    const e = () => Math.floor(r() * 5 - 2) * s * u;
    const d = vec3(a.x + t1 * (b.x - a.x) + t2 * (c.x - a.x) + e(),
                   a.y + t1 * (b.y - a.y) + t2 * (c.y - a.y) + e(),
                   a.z + t1 * (b.z - a.z) + t2 * (c.z - a.z) + e());
    const ref = refOrient3d(a, b, c, d);
    assert.equal(unwrap(orient3d(a, b, c, d)), ref);
    assert.equal(unwrap(orient3dExact(a, b, c, d)), ref);
    const f = orient3dFilter(a, b, c, d);
    if (f !== undefined) assert.equal(f, ref);
  }
});

test('orient3d_swap_ab / _bc / _cd / _ad: swapping two points flips the sign', () => {
  const r = rng(13);
  for (let i = 0; i < 400; i++) {
    const a = vec3(0.5 + Math.floor(r() * 8) * u, 0.5 + Math.floor(r() * 8) * u, 0.5);
    const b = vec3(12, 12, 12), c = vec3(24, 24, 24), d = vec3(Math.floor(r() * 5), 2, 3);
    const s = unwrap(orient3d(a, b, c, d));
    assert.equal(unwrap(orient3d(b, a, c, d)), -s || 0);
    assert.equal(unwrap(orient3d(a, c, b, d)), -s || 0);
    assert.equal(unwrap(orient3d(a, b, d, c)), -s || 0);
    assert.equal(unwrap(orient3d(d, b, c, a)), -s || 0);
  }
});

test('orient3d_translate and orient3d_coplanar', () => {
  const r = rng(14);
  const int = () => Math.floor(r() * 2000) - 1000;
  for (let i = 0; i < 400; i++) {
    const a = vec3(int(), int(), int()), b = vec3(int(), int(), int()), c = vec3(int(), int(), int());
    const s = (Math.floor(r() * 64) - 16) / 32, t = (Math.floor(r() * 64) - 16) / 32;
    const d = vec3((1 - s - t) * a.x + s * b.x + t * c.x,
                   (1 - s - t) * a.y + s * b.y + t * c.y,
                   (1 - s - t) * a.z + s * b.z + t * c.z); // exact: small dyadics
    assert.equal(unwrap(orient3d(a, b, c, d)), 0);
    const e = vec3(int(), int(), int());
    const v = vec3(int() / 4, int() / 4, int() / 4);
    const sh = (p: Point3) => vec3(p.x + v.x, p.y + v.y, p.z + v.z);
    assert.equal(unwrap(orient3d(sh(a), sh(b), sh(c), sh(e))), unwrap(orient3d(a, b, c, e)));
    assert.equal(unwrap(orient3d(sh(a), sh(b), sh(c), sh(d))), 0);
  }
});

test('orient3d is exact for tiny and huge coordinates', () => {
  const m = Number.MIN_VALUE;
  const cases: [Point3, Point3, Point3, Point3][] = [
    [vec3(0, 0, 0), vec3(m, 0, 0), vec3(0, m, 0), vec3(0, 0, m)],
    [vec3(0, 0, 0), vec3(1e-120, 0, 0), vec3(0, 1e-120, 0), vec3(1e-120, 1e-120, 1e-300)],
    [vec3(-1e300, 0, 0), vec3(1e300, 0, 0), vec3(0, 1e300, 0), vec3(0, 0, -m)],
  ];
  for (const [a, b, c, d] of cases) {
    assert.equal(unwrap(orient3d(a, b, c, d)), refOrient3d(a, b, c, d));
  }
  assert.equal(unwrap(orient3d(...(cases[0] as [Point3, Point3, Point3, Point3]))), 1);
  assert.equal(unwrap(orient3d(...(cases[2] as [Point3, Point3, Point3, Point3]))), -1);
});

test('the floating-point filter decides well-conditioned input (fast path is used)', () => {
  const r = rng(21);
  let decided2 = 0, decided3 = 0;
  for (let i = 0; i < 1000; i++) {
    const p2 = () => vec2(r() * 100 - 50, r() * 100 - 50);
    const a = p2(), b = p2(), c = p2();
    const f2 = orient2dFilter(a, b, c);
    if (f2 !== undefined) { decided2++; assert.equal(f2, refOrient2d(a, b, c)); }
    const p3 = () => vec3(r() * 100 - 50, r() * 100 - 50, r() * 100 - 50);
    const A = p3(), B = p3(), C = p3(), D = p3();
    const f3 = orient3dFilter(A, B, C, D);
    if (f3 !== undefined) { decided3++; assert.equal(f3, refOrient3d(A, B, C, D)); }
  }
  assert.ok(decided2 > 990 && decided3 > 990);
  // tiny non-zero differences bypass the filter (underflow guard)
  assert.equal(orient2dFilter(vec2(0, 0), vec2(1e-200, 0), vec2(0, 1e-200)), undefined);
  assert.equal(unwrap(orient2d(vec2(0, 0), vec2(1e-200, 0), vec2(0, 1e-200))), 1);
});
