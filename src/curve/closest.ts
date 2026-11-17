/**
 * Closest point on a `Curve3` (point inversion / projection).
 *
 * - line: `t* = (p - o)·d / (d·d)` clamped to the range (exact; Lean `line_closest_orthogonal`,
 *   `line_closest_min`);
 * - circle: the angle `atan2((p-c)·v, (p-c)·u)` of the in-plane component (exact up to rounding),
 *   compared with the arc's end points when the arc does not contain it. A point on the axis is
 *   equidistant from the whole circle: the start of the range is returned (deterministic);
 * - ellipse: every stationary point of the squared distance is found and the nearest one on the
 *   arc (or an arc end point) is returned. With the major radius scaled to 1 (`e = b/a`, in-plane
 *   point `(y0, y1)`), the stationary points off the axes are `X = (y0/(t+1), e² y1/(t+e²))` for
 *   the roots `t` of `F(t) = (y0/(t+1))² + (e y1/(t+e²))² - 1` (Eberly, "Distance from a point to
 *   an ellipse"). `F` decreases on `(-e², ∞)` (one root: the global minimum) and is convex on
 *   `(-1, -e²)` with its minimum in closed form (zero, one or two roots: the second local minimum
 *   near the major-axis evolute and a local maximum). Each root is found by Newton's method
 *   safeguarded by bisection inside an explicit bracket; the axis solutions (`t = -e²`, `t = -1`,
 *   stationary for points on an axis) and the four vertices are always candidates. Candidates are
 *   then polished by Newton on the angle equation. Failure to converge gives `not-converged`;
 * - nurbs: not certified. Each knot span is sampled at 9 points, every local minimum of the
 *   sampled distance is refined by safeguarded Newton on `C'·(C - p) = 0`, and the best is
 *   returned. A minimum narrower than the sampling can be missed.
 * Ties are broken towards the smaller parameter (candidates are compared in parameter order).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/curve/line.rs (drop_point_fast, global_point_solve_step),
 *   solidcore/crates/solidcore/src/curve/ellipse/p2.rs (point solve on an ellipse),
 *   solidcore/crates/solidcore/src/curve/proximity.rs. Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import { distance3, dot3, sub3, isFinite3, type Point3 } from '../math/vec.ts';
import { evaluateCurve3 } from './evaluate.ts';
import { TWO_PI, ROUNDING_SLACK, conicRadii, curveRange, type CircleCurve, type Curve3, type EllipseCurve, type LineCurve, type NurbsCurve3 } from './types.ts';

export interface ClosestPoint3 {
  /** Parameter of the closest point. */
  readonly t: number;
  readonly point: Point3;
  readonly distance: number;
}

const OP = 'curve.closestPointOnCurve';
const MAX_ITER = 400;
/** Relative widening of the analytic brackets so that rounding cannot put a root outside. */
const BRACKET_MARGIN = 1e-9;

/**
 * Bisection point of `[lo, hi]`: the geometric mean when the bracket has one sign and spans more
 * than a factor 4 (so a bracket like `[1e-300, 1]` shrinks in ~60 steps, not ~1000), else the
 * midpoint.
 */
function bisect(lo: number, hi: number): number {
  if (lo > 0 && hi > 4 * lo) return Math.sqrt(lo) * Math.sqrt(hi);
  if (hi < 0 && lo < 4 * hi) return -Math.sqrt(-lo) * Math.sqrt(-hi);
  return (lo + hi) / 2;
}

/**
 * Root of a function on `[lo, hi]` whose values at the ends have opposite signs (or vanish), by
 * Newton's method safeguarded with bisection: a Newton step leaving the current bracket, or not
 * halving it, is replaced by bisection (see `bisect`). Returns `not-converged` after `MAX_ITER` steps.
 */
function bracketedNewton(f: (x: number) => number, df: (x: number) => number, lo: number, hi: number): Result<number> {
  let flo = f(lo);
  const fhi = f(hi);
  if (flo === 0) return ok(lo);
  if (fhi === 0) return ok(hi);
  if (!(Number.isFinite(flo) && Number.isFinite(fhi)) || flo > 0 === fhi > 0) {
    return err({ kind: 'not-converged', operation: OP, iterations: 0 });
  }
  let x = bisect(lo, hi);
  for (let i = 1; i <= MAX_ITER; i++) {
    const fx = f(x);
    if (fx === 0 || !Number.isFinite(fx)) return Number.isFinite(fx) ? ok(x) : err({ kind: 'not-converged', operation: OP, iterations: i });
    if (fx > 0 === flo > 0) {
      lo = x;
      flo = fx;
    } else {
      hi = x;
    }
    const width = hi - lo;
    if (!(width > 4 * Number.EPSILON * Math.max(Math.abs(lo), Math.abs(hi), Number.MIN_VALUE))) return ok(x);
    const d = df(x);
    const nx = x - fx / d;
    const mid = bisect(lo, hi);
    // Accept the Newton step only strictly inside the bracket and when it is not slower than bisection.
    x = Number.isFinite(nx) && nx > lo && nx < hi && Math.abs(nx - x) < width / 2 ? nx : mid;
    if (x === lo || x === hi) return ok(x);
  }
  return err({ kind: 'not-converged', operation: OP, iterations: MAX_ITER });
}

function result(curve: Curve3, t: number, p: Point3): Result<ClosestPoint3> {
  const e = evaluateCurve3(curve, t);
  if (!e.ok) return e;
  const distance = distance3(e.value.point, p);
  if (!Number.isFinite(distance)) return invalidInput(OP, 'distance overflows');
  return ok(Object.freeze({ t, point: e.value.point, distance }));
}

function closestOnLine(line: LineCurve, p: Point3): Result<ClosestPoint3> {
  const ts = lineProjectionParam(line, p);
  const [t0, t1] = line.range;
  const t = Math.min(t1, Math.max(t0, ts));
  return result(line, t, p);
}

/** Maps an angle into `[t0, t0 + 2π)`; returns it if it is in `[t0, t1]` (with rounding slack). */
function onArc(theta: number, t0: number, t1: number): number | undefined {
  let x = t0 + ((((theta - t0) % TWO_PI) + TWO_PI) % TWO_PI);
  if (x >= t0 + TWO_PI) x -= TWO_PI;
  const slack = ROUNDING_SLACK * Math.max(1, Math.abs(t0), Math.abs(t1));
  if (x <= t1) return x;
  if (x - t1 <= slack) return t1;
  if (t0 + TWO_PI - x <= slack) return t0;
  return undefined;
}

/** Picks the candidate angle on the arc nearest to `(X, Y)` in the conic's plane. */
function pickConic(a: number, b: number, X: number, Y: number, candidates: readonly number[], range: readonly [number, number]): number {
  const [t0, t1] = range;
  const ts: number[] = [t0, t1];
  for (const c of candidates) {
    const t = onArc(c, t0, t1);
    if (t !== undefined) ts.push(t);
  }
  ts.sort((u, v) => u - v);
  let best = t0;
  let bestD = Infinity;
  for (const t of ts) {
    // hypot, not dx² + dy²: the squares overflow for coordinates beyond ~1e154 (every candidate
    // would then compare as Infinity and the range start would be returned).
    const d = Math.hypot(a * Math.cos(t) - X, b * Math.sin(t) - Y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function planeCoords(curve: CircleCurve | EllipseCurve, p: Point3): readonly [number, number] {
  const q = sub3(p, curve.center);
  return [dot3(q, curve.frame.xAxis), dot3(q, curve.frame.yAxis)];
}

function closestOnCircle(circle: CircleCurve, p: Point3): Result<ClosestPoint3> {
  const [X, Y] = planeCoords(circle, p);
  const r = circle.radius;
  const cands = X === 0 && Y === 0 ? [] : [Math.atan2(Y, X)];
  return result(circle, pickConic(r, r, X, Y, cands, circle.range), p);
}

/**
 * Stationary angles of the squared distance from `(y0, y1)` to the ellipse `(cos θ, e sin θ)`,
 * `0 < e <= 1` (see the module comment). Always includes the four vertices.
 */
function ellipseStationaryAngles(e: number, y0: number, y1: number): Result<number[]> {
  const out = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const e2 = e * e;
  const delta = (1 - e) * (1 + e); // 1 - e², accurately
  const fromX = (X0: number, X1: number): number => Math.atan2(X1 / e, X0);
  if (delta === 0) {
    // A circle: the only off-vertex stationary points are along the radius.
    if (y0 !== 0 || y1 !== 0) out.push(Math.atan2(y1, y0), Math.atan2(-y1, -y0));
    return ok(out);
  }
  // Axis solutions (t = -e² for y1 = 0, t = -1 for y0 = 0). They are always added: off the axes
  // they are merely extra points of the ellipse, and for a tiny non-zero coordinate (where the
  // branches below may underflow, e.g. |y1| = 1e-300) they are the stationary points to rounding.
  {
    const X0 = y0 / delta;
    if (Math.abs(X0) <= 1) {
      const s = Math.sqrt(1 - X0 * X0);
      out.push(Math.atan2(s, X0), Math.atan2(-s, X0));
    }
  }
  {
    const X1 = -(e2 * y1) / delta;
    if (Math.abs(X1) <= e) {
      const c = Math.sqrt(Math.max(0, 1 - (X1 / e) * (X1 / e)));
      out.push(fromX(c, X1), fromX(-c, X1));
    }
  }
  const ay0 = Math.abs(y0);
  const ey1 = e * Math.abs(y1);
  // Branch I1, variable σ = t + e² ∈ (0, ∞): F(σ) = (y0/(σ+δ))² + (e y1/σ)² - 1, decreasing.
  // Skipped when `e |y1|` underflows to 0 (a point on the major axis to double precision): then
  // the axis solutions above are the stationary points (and the bracket would be empty).
  if (ey1 > 0) {
    const F = (s: number): number => (y0 / (s + delta)) ** 2 + (ey1 / s) ** 2 - 1;
    const dF = (s: number): number => (-2 * (y0 / (s + delta)) ** 2) / (s + delta) - (2 * (ey1 / s) ** 2) / s;
    // F(lo) >= 0 (second term is 1); F(hi) < 0 (both terms below their sum's bound, with margin).
    const lo = ey1;
    const hi = Math.hypot(y0, ey1) * (1 + BRACKET_MARGIN);
    const r = bracketedNewton(F, dF, lo, hi);
    if (!r.ok) return r;
    const s = r.value;
    out.push(fromX(y0 / (s + delta), (e2 * y1) / s));
  }
  // Branch I2, variable ρ = t + 1 ∈ (0, δ), σ = ρ - δ < 0: F convex, minimum in closed form.
  if (y0 !== 0 && ey1 > 0) {
    const F = (r: number): number => (y0 / r) ** 2 + (ey1 / (r - delta)) ** 2 - 1;
    const dF = (r: number): number => (-2 * (y0 / r) ** 2) / r - (2 * (ey1 / (r - delta)) ** 2) / (r - delta);
    const k = Math.cbrt((ay0 / ey1) ** 2);
    const rm = Number.isFinite(k) ? (delta * k) / (1 + k) : delta;
    if (rm > 0 && rm < delta && F(rm) < 0) {
      // Left root in ρ ∈ [|y0| (1 - margin), ρm]: there the first term alone exceeds 1.
      const left = bracketedNewton(F, dF, Math.min(ay0 * (1 - BRACKET_MARGIN), rm), rm);
      if (!left.ok) return left;
      out.push(fromX(y0 / left.value, (e2 * y1) / (left.value - delta)));
      // Right root in σ = ρ - δ ∈ [σm, -e|y1| (1 - margin)], solved in σ so that σ near 0 keeps
      // its relative precision (ρ - δ would cancel for points near the major axis).
      const G = (s: number): number => (y0 / (s + delta)) ** 2 + (ey1 / s) ** 2 - 1;
      const dG = (s: number): number => (-2 * (y0 / (s + delta)) ** 2) / (s + delta) - (2 * (ey1 / s) ** 2) / s;
      const sm = -delta / (1 + k);
      const right = bracketedNewton(G, dG, sm, Math.max(sm, -ey1 * (1 - BRACKET_MARGIN)));
      if (!right.ok) return right;
      out.push(fromX(y0 / (right.value + delta), (e2 * y1) / right.value));
    }
  }
  return ok(out);
}

/**
 * Newton polish of a stationary angle of `|(a cos θ, b sin θ) - (X, Y)|²` on `g(θ) = (E - q)·E'`
 * (`g' = |E'|² + (E - q)·E''`). Steps are taken only where `g' > 0` (near a minimum), when they
 * are small and reduce `|g|`; otherwise the angle is kept. (Comparing distances instead would
 * stall: near a minimum they change below their rounding.)
 */
function polishAngle(a: number, b: number, X: number, Y: number, theta: number): number {
  const g = (t: number): number => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return (a * c - X) * (-a * s) + (b * s - Y) * (b * c);
  };
  let t = theta;
  let gt = g(t);
  for (let i = 0; i < 6 && gt !== 0; i++) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const dg = a * a * s * s + b * b * c * c - (a * c - X) * a * c - (b * s - Y) * b * s;
    if (!(dg > 0)) break;
    const step = gt / dg;
    if (!(Math.abs(step) < 0.1)) break;
    const nt = t - step;
    const gn = g(nt);
    if (!(Math.abs(gn) < Math.abs(gt))) break;
    t = nt;
    gt = gn;
  }
  return t;
}

function closestOnEllipse(ellipse: EllipseCurve, p: Point3): Result<ClosestPoint3> {
  const [a, b] = conicRadii(ellipse);
  const [X, Y] = planeCoords(ellipse, p);
  const angles = ellipseStationaryAngles(b / a, X / a, Y / a);
  if (!angles.ok) return angles;
  const cands = angles.value.map((t) => polishAngle(a, b, X, Y, t));
  return result(ellipse, pickConic(a, b, X, Y, cands, ellipse.range), p);
}

function closestOnNurbs(nc: NurbsCurve3, p: Point3): Result<ClosestPoint3> {
  const [r0, r1] = curveRange(nc);
  const knots = nc.curve.knots;
  const breaks = [r0];
  for (const k of knots) if (k > breaks[breaks.length - 1]! && k < r1) breaks.push(k);
  breaks.push(r1);
  const samples: number[] = [];
  const SUB = 8;
  for (let i = 0; i + 1 < breaks.length; i++) {
    const lo = breaks[i]!;
    const hi = breaks[i + 1]!;
    for (let j = 0; j < SUB; j++) samples.push(lo + ((hi - lo) * j) / SUB);
  }
  samples.push(r1);
  const dist: number[] = [];
  for (const t of samples) {
    const e = evaluateCurve3(nc, t);
    if (!e.ok) return e;
    dist.push(distance3(e.value.point, p));
  }
  let best: ClosestPoint3 | undefined;
  for (let j = 0; j < samples.length; j++) {
    const dj = dist[j]!;
    if ((j > 0 && dist[j - 1]! < dj) || (j + 1 < samples.length && dist[j + 1]! < dj)) continue;
    const lo = samples[Math.max(0, j - 1)]!;
    const hi = samples[Math.min(samples.length - 1, j + 1)]!;
    let t = samples[j]!;
    // g(t) = C'·(C - p); safeguarded Newton within [lo, hi] (the bracket is narrowed by sign).
    const g = (x: number): number => {
      const e = evaluateCurve3(nc, x);
      return e.ok ? dot3(e.value.d1, sub3(e.value.point, p)) : NaN;
    };
    const dg = (x: number): number => {
      const e = evaluateCurve3(nc, x);
      return e.ok ? dot3(e.value.d1, e.value.d1) + dot3(e.value.d2, sub3(e.value.point, p)) : NaN;
    };
    const glo = g(lo);
    const ghi = g(hi);
    if (glo < 0 && ghi > 0) {
      const r = bracketedNewton(g, dg, lo, hi);
      if (!r.ok) return r;
      t = r.value;
    }
    const cand = result(nc, t, p);
    if (!cand.ok) return cand;
    if (best === undefined || cand.value.distance < best.distance) best = cand.value;
  }
  return best === undefined ? result(nc, r0, p) : ok(best);
}

/** The closest point of `curve` (within its range) to `p`. See the module comment for each kind. */
export function closestPointOnCurve(curve: Curve3, p: Point3): Result<ClosestPoint3> {
  if (!isFinite3(p)) return invalidInput(OP, 'non-finite point');
  switch (curve.kind) {
    case 'line':
      return closestOnLine(curve, p);
    case 'circle':
      return closestOnCircle(curve, p);
    case 'ellipse':
      return closestOnEllipse(curve, p);
    case 'nurbs':
      return closestOnNurbs(curve, p);
  }
}

/** The unclamped projection parameter `(p - o)·d / (d·d)` of a line (Lean `lineParam`). */
export function lineProjectionParam(line: LineCurve, p: Point3): number {
  return dot3(sub3(p, line.origin), line.direction) / dot3(line.direction, line.direction);
}

