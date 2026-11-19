/**
 * Interval vectors (`IVec3`) and axis-aligned boxes (`Box3`, `Box2`) with outward-rounded
 * vector arithmetic, union / intersection / expansion, closed-overlap tests and an exact
 * disjointness test.
 *
 * A box `{min, max}` is the closed set `min.x <= x <= max.x` (and so on); its corners are finite
 * doubles with `min <= max`. Comparisons of doubles are exact, so overlap / disjointness at gap 0
 * are exact; the separation test with a gap compares the exact difference `b.min - a.max` with the
 * gap in dyadic arithmetic (M0 `src/exact/dyadic.ts`), so it never answers "separated" wrongly
 * and never misses a separation (Lean `separated_sound`).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/geom/extent2d.rs (closed extents, union, overlap),
 *   solidcore/crates/solidcore/src/query/distance_bound.rs (the hull box of a patch, widened by
 *   its error), solidcore/crates/ssi (box pruning of patch pairs). Rewritten for cadloom.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { compareDyadic, dyadicFromNumber, subDyadic, type Dyadic } from '../exact/dyadic.ts';
import type { Point2, Point3, Vec3 } from '../math/vec.ts';
import { addUp, mulUp, sqrtUp, subDown } from './float.ts';
import {
  add,
  hull,
  intersect as intersectInterval,
  isBounded,
  mul,
  scale,
  sqr,
  sub,
  unsafeInterval,
  type Interval,
} from './interval.ts';

/** A vector of three intervals: every real vector with coordinates in them. */
export interface IVec3 {
  readonly x: Interval;
  readonly y: Interval;
  readonly z: Interval;
}

/** A closed axis-aligned 3D box. */
export interface Box3 {
  readonly min: Point3;
  readonly max: Point3;
}

/** A closed axis-aligned 2D box (for parameter rectangles and planar profiles). */
export interface Box2 {
  readonly min: Point2;
  readonly max: Point2;
}

type Axis3 = 'x' | 'y' | 'z';
const AXES3: readonly Axis3[] = ['x', 'y', 'z'];
const AXES2: readonly ('x' | 'y')[] = ['x', 'y'];
const nz = (v: number): number => (v === 0 ? 0 : v);

export function ivec3(x: Interval, y: Interval, z: Interval): IVec3 {
  return Object.freeze({ x, y, z });
}

/** The exact point vector of a finite `Vec3`. */
export function ivecOfPoint(p: Vec3): Result<IVec3> {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    return invalidInput('interval.ivecOfPoint', 'non-finite point');
  }
  return ok(ivec3(unsafeInterval(p.x, p.x), unsafeInterval(p.y, p.y), unsafeInterval(p.z, p.z)));
}

export function ivAdd(a: IVec3, b: IVec3): IVec3 {
  return ivec3(add(a.x, b.x), add(a.y, b.y), add(a.z, b.z));
}

export function ivSub(a: IVec3, b: IVec3): IVec3 {
  return ivec3(sub(a.x, b.x), sub(a.y, b.y), sub(a.z, b.z));
}

/** `s · a` for an interval scalar `s`. */
export function ivScale(a: IVec3, s: Interval): IVec3 {
  return ivec3(mul(a.x, s), mul(a.y, s), mul(a.z, s));
}

/** `s · v` for an interval scalar and an exact double vector (the frame axes of a surface). */
export function ivScaleVec(v: Vec3, s: Interval): IVec3 {
  return ivec3(scale(s, v.x), scale(s, v.y), scale(s, v.z));
}

export function ivDot(a: IVec3, b: IVec3): Interval {
  return add(add(mul(a.x, b.x), mul(a.y, b.y)), mul(a.z, b.z));
}

export function ivCross(a: IVec3, b: IVec3): IVec3 {
  return ivec3(
    sub(mul(a.y, b.z), mul(a.z, b.y)),
    sub(mul(a.z, b.x), mul(a.x, b.z)),
    sub(mul(a.x, b.y), mul(a.y, b.x)),
  );
}

/** `{|v|² : v ∈ a}` (with `sqr`, so it never goes below 0). */
export function ivNormSq(a: IVec3): Interval {
  return add(add(sqr(a.x), sqr(a.y)), sqr(a.z));
}

/** Whether the vector box contains the zero vector. */
export function ivContainsZero(a: IVec3): boolean {
  return AXES3.every((k) => a[k].lo <= 0 && 0 <= a[k].hi);
}

/** The box of an interval vector; `invalid-input` when an endpoint overflowed. */
export function boxOfIVec(a: IVec3): Result<Box3> {
  if (!AXES3.every((k) => isBounded(a[k]))) return invalidInput('interval.boxOfIVec', 'bound overflowed');
  return ok(
    Object.freeze({
      min: Object.freeze({ x: nz(a.x.lo), y: nz(a.y.lo), z: nz(a.z.lo) }),
      max: Object.freeze({ x: nz(a.x.hi), y: nz(a.y.hi), z: nz(a.z.hi) }),
    }),
  );
}

export function ivecOfBox(b: Box3): IVec3 {
  return ivec3(unsafeInterval(b.min.x, b.max.x), unsafeInterval(b.min.y, b.max.y), unsafeInterval(b.min.z, b.max.z));
}

/** The interval of axis `k` of a box. */
export function boxAxis(b: Box3, k: Axis3): Interval {
  return unsafeInterval(b.min[k], b.max[k]);
}

/** A validated box: finite corners, `min <= max` per axis. */
export function box3(min: Point3, max: Point3): Result<Box3> {
  for (const k of AXES3) {
    if (!Number.isFinite(min[k]) || !Number.isFinite(max[k])) return invalidInput('interval.box3', 'non-finite corner');
    if (!(min[k] <= max[k])) return invalidInput('interval.box3', 'need min <= max on every axis');
  }
  return ok(Object.freeze({ min: Object.freeze({ x: nz(min.x), y: nz(min.y), z: nz(min.z) }), max: Object.freeze({ x: nz(max.x), y: nz(max.y), z: nz(max.z) }) }));
}

export function box2(min: Point2, max: Point2): Result<Box2> {
  for (const k of AXES2) {
    if (!Number.isFinite(min[k]) || !Number.isFinite(max[k])) return invalidInput('interval.box2', 'non-finite corner');
    if (!(min[k] <= max[k])) return invalidInput('interval.box2', 'need min <= max on every axis');
  }
  return ok(Object.freeze({ min: Object.freeze({ x: nz(min.x), y: nz(min.y) }), max: Object.freeze({ x: nz(max.x), y: nz(max.y) }) }));
}

/** The smallest box containing the points (exact min / max). */
export function box3OfPoints(points: readonly Point3[]): Result<Box3> {
  if (points.length === 0) return invalidInput('interval.box3OfPoints', 'no points');
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    for (const k of AXES3) {
      if (!Number.isFinite(p[k])) return invalidInput('interval.box3OfPoints', 'non-finite point');
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  }
  return box3(min, max);
}

export function box2OfPoints(points: readonly Point2[]): Result<Box2> {
  if (points.length === 0) return invalidInput('interval.box2OfPoints', 'no points');
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const p of points) {
    for (const k of AXES2) {
      if (!Number.isFinite(p[k])) return invalidInput('interval.box2OfPoints', 'non-finite point');
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  }
  return box2(min, max);
}

/** Whether the closed boxes share a point (touching counts). */
export function boxesOverlap3(a: Box3, b: Box3): boolean {
  return AXES3.every((k) => a.min[k] <= b.max[k] && b.min[k] <= a.max[k]);
}

export function boxesOverlap2(a: Box2, b: Box2): boolean {
  return AXES2.every((k) => a.min[k] <= b.max[k] && b.min[k] <= a.max[k]);
}

/** Exact `lo - hi > gap` for finite doubles (dyadic subtraction and comparison). */
function exceedsGap(lo: number, hi: number, gap: number): boolean {
  if (gap === 0) return lo > hi;
  const d = (x: number): Dyadic => {
    const r = dyadicFromNumber(x);
    if (!r.ok) throw new Error('interval.exceedsGap: non-finite value (checked by the callers)');
    return r.value;
  };
  return compareDyadic(subDyadic(d(lo), d(hi)), d(gap)) > 0;
}

const finiteBox = (b: Box3 | Box2): boolean =>
  [b.min, b.max].every((p) => Object.values(p).every((c) => typeof c === 'number' && Number.isFinite(c)));

function checkGap(op: string, gap: number): Result<number> {
  if (!Number.isFinite(gap) || !(gap >= 0)) return invalidInput(op, 'gap must be finite and >= 0');
  return ok(gap);
}

/**
 * Exact separation: `true` iff along some axis one box lies beyond the other by strictly more
 * than `gap` (`b.min - a.max > gap` or `a.min - b.max > gap`, compared exactly). With `gap = 0`
 * this is exactly "the closed boxes have no common point". When `true`, every point of `a` and
 * every point of `b` differ by more than `gap` in that coordinate (Lean `separated_sound`).
 */
export function boxesDisjoint3(a: Box3, b: Box3, gap = 0): Result<boolean> {
  const g = checkGap('interval.boxesDisjoint3', gap);
  if (!g.ok) return g;
  if (!finiteBox(a) || !finiteBox(b)) return invalidInput('interval.boxesDisjoint3', 'non-finite box corner');
  return ok(AXES3.some((k) => exceedsGap(b.min[k], a.max[k], gap) || exceedsGap(a.min[k], b.max[k], gap)));
}

export function boxesDisjoint2(a: Box2, b: Box2, gap = 0): Result<boolean> {
  const g = checkGap('interval.boxesDisjoint2', gap);
  if (!g.ok) return g;
  if (!finiteBox(a) || !finiteBox(b)) return invalidInput('interval.boxesDisjoint2', 'non-finite box corner');
  return ok(AXES2.some((k) => exceedsGap(b.min[k], a.max[k], gap) || exceedsGap(a.min[k], b.max[k], gap)));
}

/** The smallest box containing both (exact). */
export function unionBox3(a: Box3, b: Box3): Box3 {
  const i = (k: Axis3): Interval => hull(boxAxis(a, k), boxAxis(b, k));
  return boxOfIVecUnchecked(ivec3(i('x'), i('y'), i('z')));
}

export function unionBox2(a: Box2, b: Box2): Box2 {
  return Object.freeze({
    min: Object.freeze({ x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y) }),
    max: Object.freeze({ x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y) }),
  });
}

/** The common box, or `undefined` when the boxes do not overlap (exact). */
export function intersectBox3(a: Box3, b: Box3): Box3 | undefined {
  const parts: Interval[] = [];
  for (const k of AXES3) {
    const r = intersectInterval(boxAxis(a, k), boxAxis(b, k));
    if (r === undefined) return undefined;
    parts.push(r);
  }
  return boxOfIVecUnchecked(ivec3(parts[0]!, parts[1]!, parts[2]!));
}

function boxOfIVecUnchecked(a: IVec3): Box3 {
  return Object.freeze({
    min: Object.freeze({ x: nz(a.x.lo), y: nz(a.y.lo), z: nz(a.z.lo) }),
    max: Object.freeze({ x: nz(a.x.hi), y: nz(a.y.hi), z: nz(a.z.hi) }),
  });
}

/** The box grown by `tol >= 0` on every side, rounded outward; `invalid-input` on a bad tolerance or overflow. */
export function expandBox3(b: Box3, tol: number): Result<Box3> {
  const g = checkGap('interval.expandBox3', tol);
  if (!g.ok) return g;
  return box3(
    { x: subDown(b.min.x, tol), y: subDown(b.min.y, tol), z: subDown(b.min.z, tol) },
    { x: addUp(b.max.x, tol), y: addUp(b.max.y, tol), z: addUp(b.max.z, tol) },
  );
}

export function expandBox2(b: Box2, tol: number): Result<Box2> {
  const g = checkGap('interval.expandBox2', tol);
  if (!g.ok) return g;
  return box2({ x: subDown(b.min.x, tol), y: subDown(b.min.y, tol) }, { x: addUp(b.max.x, tol), y: addUp(b.max.y, tol) });
}

export function box3Contains(b: Box3, p: Point3): boolean {
  return AXES3.every((k) => b.min[k] <= p[k] && p[k] <= b.max[k]);
}

export function box2Contains(b: Box2, p: Point2): boolean {
  return AXES2.every((k) => b.min[k] <= p[k] && p[k] <= b.max[k]);
}

/** Whether `inner ⊆ outer`. */
export function box3ContainsBox(outer: Box3, inner: Box3): boolean {
  return box3Contains(outer, inner.min) && box3Contains(outer, inner.max);
}

/** An upper bound of the length of the box diagonal. */
export function box3Diagonal(b: Box3): number {
  let s = 0;
  for (const k of AXES3) {
    const d = addUp(b.max[k], -b.min[k]);
    s = addUp(s, mulUp(d, d));
  }
  return sqrtUp(s);
}

/**
 * The parameters `[t0, t1] ⊆ [tMin, tMax]` where the line `o + t d` lies in `b` (slab method), or
 * `undefined` when it misses. Each slab's range `[a, c]` is first widened by
 * `relSlack · max(1, |a|, |c|)` so that rounding never cuts a grazing hit (`relSlack = 0`: the plain
 * floating-point slab range). A zero direction component keeps the line inside that slab or outside
 * it entirely. The range may be a single point (`t0 = t1`) or unbounded when `tMin` / `tMax` are.
 * This is the one line/box clipping routine (used by the surface/surface closed forms and the ray
 * pruning of `src/query`).
 */
export function lineBoxRange(b: Box3, o: Point3, d: Vec3, tMin: number, tMax: number, relSlack = 0): readonly [number, number] | undefined {
  let t0 = tMin, t1 = tMax;
  for (const k of AXES3) {
    const ok = o[k], dk = d[k];
    if (dk === 0) {
      if (ok < b.min[k] || ok > b.max[k]) return undefined;
      continue;
    }
    let a = (b.min[k] - ok) / dk, c = (b.max[k] - ok) / dk;
    if (a > c) [a, c] = [c, a];
    const slack = relSlack * Math.max(1, Math.abs(a), Math.abs(c));
    t0 = Math.max(t0, a - slack);
    t1 = Math.min(t1, c + slack);
    if (!(t0 <= t1)) return undefined;
  }
  return [t0, t1];
}
