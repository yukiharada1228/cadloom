/**
 * Bezier segments: de Casteljau evaluation (The NURBS Book A1.5 deCasteljau1) and subdivision
 * (split at `t` into two Bezier segments of the same degree).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/bezier.rs (split). Rewritten for cadloom.
 *
 * Formal model: the in-place loop `b[i] = (1 - t) b[i] + t b[i+1]` (`k = 1..p`, `i = 0..p-k`,
 * ascending) is `CadloomFormal.Nurbs.casteljau P t k i`; after level `k`, `b[0]` is the k-th left
 * point and `b[p-k]` the (p-k)-th right point of the subdivision.
 * Points are Euclidean; for a rational Bezier segment pass homogeneous points `(w x, w)`.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { ControlPoint } from './curve.ts';

function check(op: string, points: readonly ControlPoint[], t: number): Result<number> {
  if (points.length === 0) return invalidInput(op, 'no control points');
  const dim = points[0]!.length;
  if (dim < 1) return invalidInput(op, 'control points must have at least one coordinate');
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    if (pt.length !== dim) return invalidInput(op, `control point ${i} has a different dimension`);
    for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, `control point ${i} is not finite`);
  }
  if (!Number.isFinite(t) || t < 0 || t > 1) return invalidInput(op, 'parameter must lie in [0, 1]');
  return ok(dim);
}

/** Runs the triangle, calling `visit(k, b)` after every level `k = 0..p`. */
function triangle(points: readonly ControlPoint[], t: number, visit: (k: number, b: readonly number[][]) => void): number[] {
  const p = points.length - 1;
  const b = points.map((pt) => pt.slice());
  visit(0, b);
  for (let k = 1; k <= p; k++) {
    for (let i = 0; i <= p - k; i++) {
      const cur = b[i]!;
      const next = b[i + 1]!;
      for (let c = 0; c < cur.length; c++) cur[c] = (1 - t) * cur[c]! + t * next[c]!;
    }
    visit(k, b);
  }
  return b[0]!;
}

/** The point at `t` in `[0, 1]` of the Bezier segment with control points `points` (degree `points.length - 1`). */
export function deCasteljau(points: readonly ControlPoint[], t: number): Result<readonly number[]> {
  const c = check('nurbs.deCasteljau', points, t);
  if (!c.ok) return c;
  return ok(Object.freeze(triangle(points, t, () => {})));
}

export interface BezierSplit {
  /** Control points of the segment on `[0, t]`, reparametrized to `[0, 1]`. */
  readonly left: readonly ControlPoint[];
  /** Control points of the segment on `[t, 1]`, reparametrized to `[0, 1]`. */
  readonly right: readonly ControlPoint[];
}

/** Splits a Bezier segment at `t` in `[0, 1]`; `left[p] = right[0]` is the point at `t`. */
export function subdivideBezier(points: readonly ControlPoint[], t: number): Result<BezierSplit> {
  const c = check('nurbs.subdivideBezier', points, t);
  if (!c.ok) return c;
  const p = points.length - 1;
  const left: ControlPoint[] = new Array<ControlPoint>(p + 1);
  const right: ControlPoint[] = new Array<ControlPoint>(p + 1);
  triangle(points, t, (k, b) => {
    left[k] = Object.freeze(b[0]!.slice());
    right[p - k] = Object.freeze(b[p - k]!.slice());
  });
  return ok(Object.freeze({ left: Object.freeze(left), right: Object.freeze(right) }));
}
