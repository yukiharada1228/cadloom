/**
 * B-spline and NURBS curves with dimension-generic control points: validated construction,
 * evaluation by the de Boor triangle and by basis functions, derivatives (The NURBS Book A3.2
 * for the polynomial part, A4.2 quotient rule for rational curves) and the parameter domain.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/crv_basic.rs (Curve::new, counts/weights validity,
 *   param_bounds), solidcore/crates/solidcore/src/nurbs/crv_nurb.rs,
 *   solidcore/crates/solidcore/src/nurbs/b_spline_curve.rs. Rewritten for cadloom.
 *
 * Formal model: `deBoorPoint` is the TS side of `CadloomFormal.Nurbs.deBoor`
 * (formal/CadloomFormal/Nurbs.lean): same base index `s = span - p`, same columns `j`, same knot
 * indices `U[s+j]` and `U[s+j+p+1-r]`. For a span from `findSpan` the denominator is at least
 * `U[span+1] - U[span] > 0` (since `s+j <= span < span+1 <= s+j+p+1-r` for `r <= j`), so the TS
 * guard `den === 0 ? 0` never fires there; it mirrors Lean's `x / 0 = 0` for arbitrary spans. Rational curves run the same triangle on homogeneous points `(w x, w)`.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { basisFuns } from './basis.ts';
import { findSpan, knotDomain, validateKnots, type Knots } from './knots.ts';

/** A control point: `dimension` finite coordinates. */
export type ControlPoint = readonly number[];

/** A polynomial (non-rational) B-spline curve. All arrays are frozen. */
export interface BSplineCurve {
  readonly degree: number;
  readonly knots: Knots;
  readonly controlPoints: readonly ControlPoint[];
  /** Number of coordinates of every control point (>= 1). */
  readonly dimension: number;
}

/** A NURBS curve: a B-spline curve with optional positive weights (absent = non-rational). */
export interface NurbsCurve extends BSplineCurve {
  readonly weights?: readonly number[];
}

function freezePoints(points: readonly ControlPoint[]): readonly ControlPoint[] {
  return Object.freeze(points.map((pt) => Object.freeze(pt.slice())));
}

/**
 * Validates a non-empty list of equal-dimension finite control points and returns the dimension.
 * Shared by the M1 NURBS modules (surfaces, elevation); not re-exported from the public barrel.
 */
export function checkPoints(op: string, points: readonly ControlPoint[]): Result<number> {
  if (points.length === 0) return invalidInput(op, 'no control points');
  const dim = points[0]!.length;
  if (dim < 1) return invalidInput(op, 'control points must have at least one coordinate');
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    if (pt.length !== dim) return invalidInput(op, `control point ${i} has a different dimension`);
    for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, `control point ${i} is not finite`);
  }
  return ok(dim);
}

/** Validates and freezes a polynomial B-spline curve (see `validateKnots` for the knot rules). */
export function createBSplineCurve(
  degree: number,
  knots: readonly number[],
  controlPoints: readonly ControlPoint[],
): Result<BSplineCurve> {
  const op = 'nurbs.createBSplineCurve';
  const dim = checkPoints(op, controlPoints);
  if (!dim.ok) return dim;
  const kv = validateKnots(knots, degree, controlPoints.length);
  if (!kv.ok) return kv;
  return ok(Object.freeze({ degree, knots: kv.value, controlPoints: freezePoints(controlPoints), dimension: dim.value }));
}

/**
 * Validates and freezes a NURBS curve. `weights`, when given, must be finite and strictly
 * positive, one per control point. Control points are Euclidean (not pre-multiplied by weights).
 */
export function createNurbsCurve(
  degree: number,
  knots: readonly number[],
  controlPoints: readonly ControlPoint[],
  weights?: readonly number[],
): Result<NurbsCurve> {
  const op = 'nurbs.createNurbsCurve';
  const base = createBSplineCurve(degree, knots, controlPoints);
  if (!base.ok) return base;
  if (weights === undefined) return base;
  if (weights.length !== controlPoints.length) return invalidInput(op, 'need one weight per control point');
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    if (!Number.isFinite(w) || !(w > 0)) return invalidInput(op, `weight ${i} must be finite and positive`);
    for (const c of controlPoints[i]!) {
      if (!Number.isFinite(c * w)) return invalidInput(op, `homogeneous coordinate of control point ${i} overflows`);
    }
  }
  return ok(Object.freeze({ ...base.value, weights: Object.freeze(weights.slice()) }));
}

export function isRational(curve: NurbsCurve): boolean {
  return curve.weights !== undefined;
}

/** The parameter domain `[U[p], U[n+1]]`. */
export function curveDomain(curve: BSplineCurve): readonly [number, number] {
  return knotDomain(curve.knots, curve.degree);
}

/** Homogeneous control points `(w x, w)` of a rational curve, or the points themselves. */
export function homogeneousPoints(curve: NurbsCurve): readonly ControlPoint[] {
  const w = curve.weights;
  if (w === undefined) return curve.controlPoints;
  return Object.freeze(
    curve.controlPoints.map((pt, i) => {
      const wi = w[i]!;
      return Object.freeze([...pt.map((c) => c * wi), wi]);
    }),
  );
}

/**
 * The de Boor triangle in place (the Lean `deBoor`): `d` holds level 0 (`d[j] = P[s+j]`,
 * `j = 0..p`); for `r = 1..p` and `j = p` down to `r`,
 * `d[j] = (1 - a) d[j-1] + a d[j]` with `a = (u - U[o+s+j]) / (U[o+s+j+p+1-r] - U[o+s+j])`,
 * where `o = knotOffset` (0 for the curve itself, `k` for its k-th derivative curve whose knots
 * are `U[k..m-k]`). Returns `d[p]`.
 */
function deBoorTriangle(
  d: number[][],
  knots: Knots,
  knotOffset: number,
  p: number,
  s: number,
  u: number,
): number[] {
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const lo = knots[knotOffset + s + j]!;
      const den = knots[knotOffset + s + j + p + 1 - r]! - lo;
      const a = den === 0 ? 0 : (u - lo) / den;
      const prev = d[j - 1]!;
      const cur = d[j]!;
      for (let c = 0; c < cur.length; c++) cur[c] = (1 - a) * prev[c]! + a * cur[c]!;
    }
  }
  return d[p]!;
}

/**
 * The de Boor point of the (non-rational) control points `points` of degree `degree` over `knots`
 * at `u`, in the given `span` (`U[span] <= u <= U[span+1]` for the convex-hull guarantee).
 * Low level: no validation; use {@link evaluateCurve} for checked evaluation.
 */
export function deBoorPoint(
  knots: Knots,
  degree: number,
  points: readonly ControlPoint[],
  span: number,
  u: number,
): readonly number[] {
  const s = span - degree;
  const d: number[][] = [];
  for (let j = 0; j <= degree; j++) d.push(points[s + j]!.slice());
  return Object.freeze(deBoorTriangle(d, knots, 0, degree, s, u));
}

function checkParam(op: string, curve: BSplineCurve, u: number): Result<number> {
  const [lo, hi] = curveDomain(curve);
  if (!Number.isFinite(u) || u < lo || u > hi) return invalidInput(op, `parameter ${u} outside the domain [${lo}, ${hi}]`);
  return ok(findSpan(curve.knots, curve.degree, u));
}

/**
 * Floating-point guard: a validated curve can still overflow (huge coordinates, huge derivative
 * factors `p / (U[i+p+1] - U[i+k])`) or, for rational curves, underflow its homogeneous weight to 0.
 * Such results are reported as errors instead of returning `Infinity` / `NaN` coordinates.
 */
export function finiteOr(op: string, v: readonly number[]): Result<readonly number[]> {
  for (const c of v) if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
  return ok(Object.freeze(v));
}

/** Projects a homogeneous point `(w x, w)` (weight at index `dim`) to `x`, guarding weight under/overflow. Internal, shared with surfaces. */
export function projectHomogeneous(op: string, h: readonly number[], dim: number): Result<readonly number[]> {
  const w = h[dim]!;
  if (!(w > 0) || !Number.isFinite(w)) return invalidInput(op, 'homogeneous weight underflowed or overflowed');
  return finiteOr(op, h.slice(0, dim).map((c) => c / w));
}

/** The curve point at `u` by the de Boor triangle (homogeneous for rational curves). */
export function evaluateCurve(curve: NurbsCurve, u: number): Result<readonly number[]> {
  const op = 'nurbs.evaluateCurve';
  const span = checkParam(op, curve, u);
  if (!span.ok) return span;
  const h = deBoorPoint(curve.knots, curve.degree, homogeneousPoints(curve), span.value, u);
  return curve.weights === undefined ? finiteOr(op, h) : projectHomogeneous(op, h, curve.dimension);
}

/** The curve point at `u` as `sum N[i,p](u) P_i` (A3.1 / A4.1 with A2.2); agrees with `evaluateCurve`. */
export function evaluateCurveBasis(curve: NurbsCurve, u: number): Result<readonly number[]> {
  const op = 'nurbs.evaluateCurveBasis';
  const span = checkParam(op, curve, u);
  if (!span.ok) return span;
  const p = curve.degree;
  const N = basisFuns(curve.knots, p, span.value, u);
  const pts = homogeneousPoints(curve);
  const dim = pts[0]!.length;
  const out = new Array<number>(dim).fill(0);
  for (let j = 0; j <= p; j++) {
    const pt = pts[span.value - p + j]!;
    for (let c = 0; c < dim; c++) out[c] = out[c]! + N[j]! * pt[c]!;
  }
  return curve.weights === undefined ? finiteOr(op, out) : projectHomogeneous(op, out, curve.dimension);
}

/**
 * A3.2 CurveDerivCpts restricted to the `p + 1` control points of one span: `pk[k][i]` is the i-th
 * control point (`i = 0..p-k`) of the k-th derivative curve over the local window starting at
 * `P[s]`, `pk[k][i] = (p-k+1) (pk[k-1][i+1] - pk[k-1][i]) / (U[s+i+p+1] - U[s+i+k])`.
 * The k-th derivative curve has degree `p - k` and knots `U[k..m-k]`. A zero knot difference
 * (only possible where the coefficient is never used) gives a zero point.
 */
function localDerivativePoints(
  knots: Knots,
  p: number,
  points: readonly ControlPoint[],
  s: number,
  order: number,
): number[][][] {
  const pk: number[][][] = [[]];
  for (let i = 0; i <= p; i++) pk[0]!.push(points[s + i]!.slice());
  for (let k = 1; k <= order; k++) {
    const prev = pk[k - 1]!;
    const row: number[][] = [];
    for (let i = 0; i <= p - k; i++) {
      const den = knots[s + i + p + 1]! - knots[s + i + k]!;
      const f = den === 0 ? 0 : (p - k + 1) / den;
      const a = prev[i]!;
      const b = prev[i + 1]!;
      row.push(a.map((c, idx) => f * (b[idx]! - c)));
    }
    pk.push(row);
  }
  return pk;
}

/** Derivatives `C^(k)(u)`, `k = 0..order`, of the polynomial curve with control points `points`. */
function polynomialDerivatives(
  knots: Knots,
  p: number,
  points: readonly ControlPoint[],
  span: number,
  u: number,
  order: number,
): number[][] {
  const s = span - p;
  const dim = points[0]!.length;
  const top = Math.min(order, p);
  const pk = localDerivativePoints(knots, p, points, s, top);
  const out: number[][] = [];
  for (let k = 0; k <= order; k++) {
    if (k > top) {
      out.push(new Array<number>(dim).fill(0));
      continue;
    }
    // Derivative curve k: degree p-k, knots U[k + .], same base s, local points pk[k][0..p-k].
    out.push(deBoorTriangle(pk[k]!, knots, k, p - k, s, u));
  }
  return out;
}

/** Binomial coefficient `C(n, k)` as a float (exact for the small degrees/orders used here). Internal, shared with surfaces and elevation. */
export function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * Largest derivative `order` accepted by {@link curveDerivatives} and `surfaceDerivatives`. The
 * output grows with the order (quadratically for surfaces), so an unbounded order could exhaust
 * memory (an uncatchable crash) instead of returning an error. Derivatives above the degree are
 * zero anyway, and degrees are at most 32 (`MAX_ELEVATED_DEGREE`).
 */
export const MAX_DERIVATIVE_ORDER = 64;

/**
 * Derivatives `[C(u), C'(u), ..., C^(order)(u)]`. Polynomial curves use the derivative control
 * points of A3.2 evaluated by de Boor; rational curves apply the A4.2 quotient rule
 * `C^(k) = (A^(k) - sum_{i=1..k} binom(k,i) w^(i) C^(k-i)) / w` to the homogeneous derivatives.
 */
export function curveDerivatives(curve: NurbsCurve, u: number, order: number): Result<readonly (readonly number[])[]> {
  const op = 'nurbs.curveDerivatives';
  if (!Number.isInteger(order) || order < 0) return invalidInput(op, 'order must be a non-negative integer');
  if (order > MAX_DERIVATIVE_ORDER) return invalidInput(op, `order must be at most ${MAX_DERIVATIVE_ORDER}`);
  const span = checkParam(op, curve, u);
  if (!span.ok) return span;
  const hd = polynomialDerivatives(curve.knots, curve.degree, homogeneousPoints(curve), span.value, u, order);
  const finiteRows = (rows: number[][]): Result<readonly (readonly number[])[]> => {
    for (const row of rows) {
      for (const c of row) if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
    }
    return ok(Object.freeze(rows.map((v) => Object.freeze(v))));
  };
  if (curve.weights === undefined) return finiteRows(hd);
  const dim = curve.dimension;
  const w0 = hd[0]![dim]!;
  if (!(w0 > 0) || !Number.isFinite(w0)) return invalidInput(op, 'homogeneous weight underflowed or overflowed');
  const ck: number[][] = [];
  for (let k = 0; k <= order; k++) {
    const v = hd[k]!.slice(0, dim);
    for (let i = 1; i <= k; i++) {
      const coef = binomial(k, i) * hd[i]![dim]!;
      const prev = ck[k - i]!;
      for (let c = 0; c < dim; c++) v[c] = v[c]! - coef * prev[c]!;
    }
    ck.push(v.map((c) => c / w0));
  }
  return finiteRows(ck);
}
