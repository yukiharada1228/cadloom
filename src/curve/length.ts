/**
 * Arc length of `Curve3`: exact closed forms for lines (`|d| (t1 - t0)`) and circles
 * (`r (t1 - t0)`); adaptive Gauss-Legendre quadrature of the speed `|C'(t)|` for ellipses and
 * NURBS curves (NURBS curves are first split at their distinct knots, where the speed may only be
 * piecewise smooth).
 *
 * Adaptive scheme (deterministic, no recursion): an interval is accepted when its 8-point
 * Gauss-Legendre value and the sum over its two halves agree within the interval's share of the
 * tolerance `kernel.tolerances.approxTol3d` (absolute, in length units, floored at 64 ulp of the
 * interval's value so that very large curves converge); otherwise both halves are
 * processed. Intervals are visited in parameter order. More than `MAX_INTERVALS` subdivisions or
 * a depth beyond `MAX_DEPTH` give `not-converged`.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/curve/line.rs (Length), curve/ellipse/p1.rs (arc length of an
 *   ellipse), curve/length_bound.rs. Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { length3 } from '../math/vec.ts';
import { evaluateCurve3 } from './evaluate.ts';
import { curveRange, type Curve3 } from './types.ts';

// 8-point Gauss-Legendre nodes (positive half) and weights on [-1, 1].
const GL_X = [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363] as const;
const GL_W = [0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763] as const;

const MAX_DEPTH = 40;
const MAX_INTERVALS = 20000;
/** Relative rounding floor of the acceptance test (64 ulp). */
const ROUNDING_FLOOR = 64 * Number.EPSILON;

function gauss(speed: (t: number) => Result<number>, a: number, b: number): Result<number> {
  const h = (b - a) / 2;
  const m = (a + b) / 2;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const dx = h * GL_X[i]!;
    const f1 = speed(m - dx);
    if (!f1.ok) return f1;
    const f2 = speed(m + dx);
    if (!f2.ok) return f2;
    sum += GL_W[i]! * (f1.value + f2.value);
  }
  return ok(sum * h);
}

function adaptive(speed: (t: number) => Result<number>, a: number, b: number, tol: number, budget: { n: number }): Result<number> {
  const op = 'curve.curveArcLength';
  const first = gauss(speed, a, b);
  if (!first.ok) return first;
  // Explicit stack, processed so that intervals are summed in parameter order.
  const stack: { a: number; b: number; whole: number; depth: number }[] = [{ a, b, whole: first.value, depth: 0 }];
  const width = b - a;
  let total = 0;
  while (stack.length > 0) {
    const iv = stack.pop()!;
    const mid = (iv.a + iv.b) / 2;
    const left = gauss(speed, iv.a, mid);
    if (!left.ok) return left;
    const right = gauss(speed, mid, iv.b);
    if (!right.ok) return right;
    const halves = left.value + right.value;
    const share = (tol * (iv.b - iv.a)) / width;
    // The absolute tolerance is floored at the rounding level of the interval's value, so that a
    // large curve (|halves| * 2^-46 > tol) still converges instead of hitting the budget.
    const floor = ROUNDING_FLOOR * Math.abs(halves);
    if (Math.abs(halves - iv.whole) <= Math.max(share, floor) || !(mid > iv.a && mid < iv.b)) {
      total += halves;
      continue;
    }
    if (iv.depth >= MAX_DEPTH || ++budget.n > MAX_INTERVALS) {
      return err({ kind: 'not-converged', operation: op, iterations: budget.n });
    }
    stack.push({ a: mid, b: iv.b, whole: right.value, depth: iv.depth + 1 });
    stack.push({ a: iv.a, b: mid, whole: left.value, depth: iv.depth + 1 });
  }
  return ok(total);
}

/**
 * Length of `curve` between parameters `from` and `to` (default: its whole range; `from <= to`,
 * both inside the range). Exact for lines and circles; adaptive Gauss-Legendre otherwise.
 */
export function curveArcLength(kernel: Kernel, curve: Curve3, from?: number, to?: number): Result<number> {
  const op = 'curve.curveArcLength';
  const [r0, r1] = curveRange(curve);
  const a = from ?? r0;
  const b = to ?? r1;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < r0 || b > r1 || a > b) {
    return invalidInput(op, `interval [${a}, ${b}] not inside [${r0}, ${r1}]`);
  }
  if (a === b) return ok(0);
  if (curve.kind === 'line' || curve.kind === 'circle') {
    const len = curve.kind === 'line' ? length3(curve.direction) * (b - a) : curve.radius * (b - a);
    return Number.isFinite(len) ? ok(len) : invalidInput(op, 'length is not finite');
  }
  const tol = kernel.tolerances.approxTol3d;
  if (!(tol > 0)) return invalidInput(op, 'approximation tolerance must be positive');
  const speed = (t: number): Result<number> => {
    const e = evaluateCurve3(curve, t);
    return e.ok ? ok(length3(e.value.d1)) : e;
  };
  // Breakpoints: distinct knots strictly inside (a, b) for NURBS.
  const cuts = [a];
  if (curve.kind === 'nurbs') {
    for (const k of curve.curve.knots) if (k > cuts[cuts.length - 1]! && k < b) cuts.push(k);
  }
  cuts.push(b);
  const budget = { n: 0 };
  let total = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i]!;
    const hi = cuts[i + 1]!;
    const piece = adaptive(speed, lo, hi, (tol * (hi - lo)) / (b - a), budget);
    if (!piece.ok) return piece;
    total += piece.value;
  }
  if (!Number.isFinite(total)) return invalidInput(op, 'length is not finite');
  return ok(total);
}
