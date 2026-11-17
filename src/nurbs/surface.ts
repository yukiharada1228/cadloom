/**
 * Tensor-product B-spline and NURBS surfaces with dimension-generic control points: validated
 * construction, evaluation as a "curve of curves" by the M0 de Boor triangle and by basis
 * functions (The NURBS Book A3.5 SurfacePoint / A4.3 NURBS SurfacePoint), partial derivatives
 * (A3.6 SurfaceDerivsAlg1, rational quotient rule A4.4 RatSurfaceDerivs), the unit normal,
 * isoparametric curve extraction and the parameter domain.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/srf_basic.rs (Surface::new, counts_are_valid,
 *   weights_are_valid, is_valid, parameter_bounds), solidcore/crates/solidcore/src/nurbs/srf_nurb.rs
 *   (eval, derivs, eval_pt_deriv_normal_fast), solidcore/crates/solidcore/src/nurbs/nurbs_srf.rs,
 *   solidcore/crates/solidcore/src/nurbs/b_spline_surface.rs, solidcore/crates/solidcore/src/nurbs/funcs_basic.rs.
 *   Rewritten for cadloom; not a translation.
 *
 * Conventions: the net is `P[i][j]`, `i = 0..n` along u (degree `p`, knots `U`, `n + p + 2` of
 * them) and `j = 0..m` along v (degree `q`, knots `V`). Row `i` (`P[i][0..m]`) is a curve in v;
 * column `j` (`P[0..n][j]`) is a curve in u. Rational surfaces carry a positive weight per control
 * point and are evaluated on homogeneous points `(w x, w)`.
 *
 * Formal model (formal/CadloomFormal/NurbsSurface.lean): `evaluateSurface` is `tensor`: for every
 * column `j = sv-q..sv` it takes the M0 `deBoorPoint` over u (base `su = spanU - p`), then the M0
 * `deBoorPoint` over v of those column points (base `sv = spanV - q`). `isoparametricCurve(s, 'u', u)`
 * keeps all `m + 1` column points (`isoU`); `isoparametricCurve(s, 'v', v)` runs de Boor over v on
 * every row (`isoV`).
 */
import { invalidInput, err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { cross3, length3, scale3, vec3, type Vec3 } from '../math/vec.ts';
import { basisFuns, dersBasisFuns } from './basis.ts';
import {
  MAX_DERIVATIVE_ORDER,
  binomial,
  createNurbsCurve,
  deBoorPoint,
  finiteOr,
  projectHomogeneous,
  type ControlPoint,
  type NurbsCurve,
} from './curve.ts';
import { findSpan, knotDomain, validateKnots, type Knots } from './knots.ts';

/** A control net: `net[i][j]`, `i` along u, `j` along v. */
export type ControlNet = readonly (readonly ControlPoint[])[];

/** A polynomial tensor-product B-spline surface. All arrays are frozen. */
export interface BSplineSurface {
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: Knots;
  readonly knotsV: Knots;
  /** `controlPoints[i][j]`: `i = 0..n` along u, `j = 0..m` along v. */
  readonly controlPoints: ControlNet;
  /** Number of coordinates of every control point (>= 1). */
  readonly dimension: number;
}

/** A NURBS surface: a B-spline surface with an optional net of positive weights (absent = non-rational). */
export interface NurbsSurface extends BSplineSurface {
  readonly weights?: readonly (readonly number[])[];
}

/** Parameter direction: `'u'` (first index of the net) or `'v'` (second index). */
export type SurfaceDirection = 'u' | 'v';

export interface SurfaceDomain {
  readonly u: readonly [number, number];
  readonly v: readonly [number, number];
}

function checkNet(op: string, net: ControlNet): Result<{ rows: number; cols: number; dim: number }> {
  if (net.length === 0) return invalidInput(op, 'no control points');
  const cols = net[0]!.length;
  if (cols === 0) return invalidInput(op, 'empty control net row');
  const dim = net[0]![0]!.length;
  if (dim < 1) return invalidInput(op, 'control points must have at least one coordinate');
  for (let i = 0; i < net.length; i++) {
    const row = net[i]!;
    if (row.length !== cols) return invalidInput(op, `row ${i} of the control net has a different length`);
    for (let j = 0; j < cols; j++) {
      const pt = row[j]!;
      if (pt.length !== dim) return invalidInput(op, `control point (${i}, ${j}) has a different dimension`);
      for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, `control point (${i}, ${j}) is not finite`);
    }
  }
  return ok({ rows: net.length, cols, dim });
}

function freezeNet(net: ControlNet): ControlNet {
  return Object.freeze(net.map((row) => Object.freeze(row.map((pt) => Object.freeze(pt.slice())))));
}

/** Validates and freezes a polynomial B-spline surface (each knot vector as in `validateKnots`). */
export function createBSplineSurface(
  degreeU: number,
  degreeV: number,
  knotsU: readonly number[],
  knotsV: readonly number[],
  controlPoints: ControlNet,
): Result<BSplineSurface> {
  const op = 'nurbs.createBSplineSurface';
  const shape = checkNet(op, controlPoints);
  if (!shape.ok) return shape;
  const ku = validateKnots(knotsU, degreeU, shape.value.rows);
  if (!ku.ok) return ku;
  const kv = validateKnots(knotsV, degreeV, shape.value.cols);
  if (!kv.ok) return kv;
  return ok(
    Object.freeze({
      degreeU,
      degreeV,
      knotsU: ku.value,
      knotsV: kv.value,
      controlPoints: freezeNet(controlPoints),
      dimension: shape.value.dim,
    }),
  );
}

/**
 * Validates and freezes a NURBS surface. `weights`, when given, has the shape of the net and holds
 * finite, strictly positive values. Control points are Euclidean (not pre-multiplied by weights).
 */
export function createNurbsSurface(
  degreeU: number,
  degreeV: number,
  knotsU: readonly number[],
  knotsV: readonly number[],
  controlPoints: ControlNet,
  weights?: readonly (readonly number[])[],
): Result<NurbsSurface> {
  const op = 'nurbs.createNurbsSurface';
  const base = createBSplineSurface(degreeU, degreeV, knotsU, knotsV, controlPoints);
  if (!base.ok) return base;
  if (weights === undefined) return base;
  if (weights.length !== controlPoints.length) return invalidInput(op, 'need one weight row per control net row');
  for (let i = 0; i < weights.length; i++) {
    const wr = weights[i]!;
    const pr = controlPoints[i]!;
    if (wr.length !== pr.length) return invalidInput(op, `weight row ${i} has a different length`);
    for (let j = 0; j < wr.length; j++) {
      const w = wr[j]!;
      if (!Number.isFinite(w) || !(w > 0)) return invalidInput(op, `weight (${i}, ${j}) must be finite and positive`);
      for (const c of pr[j]!) {
        if (!Number.isFinite(c * w)) return invalidInput(op, `homogeneous coordinate of control point (${i}, ${j}) overflows`);
      }
    }
  }
  return ok(Object.freeze({ ...base.value, weights: Object.freeze(weights.map((r) => Object.freeze(r.slice()))) }));
}

export function isRationalSurface(surface: NurbsSurface): boolean {
  return surface.weights !== undefined;
}

/** The parameter domain `[U[p], U[n+1]] x [V[q], V[m+1]]`. */
export function surfaceDomain(surface: BSplineSurface): SurfaceDomain {
  return Object.freeze({
    u: knotDomain(surface.knotsU, surface.degreeU),
    v: knotDomain(surface.knotsV, surface.degreeV),
  });
}

/** Homogeneous control net `(w x, w)` of a rational surface, or the net itself. */
export function homogeneousNet(surface: NurbsSurface): ControlNet {
  const w = surface.weights;
  if (w === undefined) return surface.controlPoints;
  return Object.freeze(
    surface.controlPoints.map((row, i) =>
      Object.freeze(
        row.map((pt, j) => {
          const wij = w[i]![j]!;
          return Object.freeze([...pt.map((c) => c * wij), wij]);
        }),
      ),
    ),
  );
}

interface Spans {
  readonly su: number;
  readonly sv: number;
}

function checkParams(op: string, surface: BSplineSurface, u: number, v: number): Result<Spans> {
  const d = surfaceDomain(surface);
  if (!Number.isFinite(u) || u < d.u[0] || u > d.u[1]) {
    return invalidInput(op, `parameter u = ${u} outside the domain [${d.u[0]}, ${d.u[1]}]`);
  }
  if (!Number.isFinite(v) || v < d.v[0] || v > d.v[1]) {
    return invalidInput(op, `parameter v = ${v} outside the domain [${d.v[0]}, ${d.v[1]}]`);
  }
  return ok({ su: findSpan(surface.knotsU, surface.degreeU, u), sv: findSpan(surface.knotsV, surface.degreeV, v) });
}

/** Projects a homogeneous point `(w x, w)` of a rational surface; passes polynomial points through. */
function finish(op: string, surface: NurbsSurface, h: readonly number[]): Result<readonly number[]> {
  return surface.weights === undefined ? finiteOr(op, h) : projectHomogeneous(op, h, surface.dimension);
}

/**
 * The de Boor points over u of the columns `j = from..to` of `net` at `u` in span `su`
 * (`Q[j] = deBoorPoint(U, p, P[.][j], su, u)`). The result is indexed by `j` (sparse outside the
 * range) so it can be fed to the de Boor triangle over v with the original column indices.
 */
function columnPointsAt(
  net: ControlNet,
  knotsU: Knots,
  p: number,
  su: number,
  u: number,
  from: number,
  to: number,
): ControlPoint[] {
  const cols = net[0]!.length;
  const Q = new Array<ControlPoint>(cols);
  const column = new Array<ControlPoint>(net.length);
  for (let j = from; j <= to; j++) {
    for (let i = su - p; i <= su; i++) column[i] = net[i]![j]!;
    Q[j] = deBoorPoint(knotsU, p, column, su, u);
  }
  return Q;
}

/**
 * The surface point at `(u, v)` by the tensor-product de Boor scheme: de Boor over u of the
 * columns `sv-q..sv`, then de Boor over v of the resulting points (homogeneous for rational
 * surfaces). This is the Lean `tensor`.
 */
export function evaluateSurface(surface: NurbsSurface, u: number, v: number): Result<readonly number[]> {
  const op = 'nurbs.evaluateSurface';
  const spans = checkParams(op, surface, u, v);
  if (!spans.ok) return spans;
  const { su, sv } = spans.value;
  const q = surface.degreeV;
  const Q = columnPointsAt(homogeneousNet(surface), surface.knotsU, surface.degreeU, su, u, sv - q, sv);
  return finish(op, surface, deBoorPoint(surface.knotsV, q, Q, sv, v));
}

/**
 * The surface point as `sum_k sum_l N[k,p](u) N[l,q](v) Pw[k][l]` (A3.5 SurfacePoint; A4.3 for
 * rational surfaces via homogeneous points). Agrees with {@link evaluateSurface}.
 */
export function evaluateSurfaceBasis(surface: NurbsSurface, u: number, v: number): Result<readonly number[]> {
  const op = 'nurbs.evaluateSurfaceBasis';
  const spans = checkParams(op, surface, u, v);
  if (!spans.ok) return spans;
  const { su, sv } = spans.value;
  const p = surface.degreeU;
  const q = surface.degreeV;
  const Nu = basisFuns(surface.knotsU, p, su, u);
  const Nv = basisFuns(surface.knotsV, q, sv, v);
  const Pw = homogeneousNet(surface);
  const dim = Pw[0]![0]!.length;
  const out = new Array<number>(dim).fill(0);
  const uind = su - p;
  for (let l = 0; l <= q; l++) {
    const temp = new Array<number>(dim).fill(0);
    const vind = sv - q + l;
    for (let k = 0; k <= p; k++) {
      const pt = Pw[uind + k]![vind]!;
      for (let c = 0; c < dim; c++) temp[c] = temp[c]! + Nu[k]! * pt[c]!;
    }
    for (let c = 0; c < dim; c++) out[c] = out[c]! + Nv[l]! * temp[c]!;
  }
  return finish(op, surface, out);
}

/** Partial derivatives: `ders[k][l] = d^{k+l} S / du^k dv^l` for `k + l <= order` (triangular). */
export type SurfaceDerivatives = readonly (readonly (readonly number[])[])[];

/**
 * Partial derivatives `S_{u^k v^l}(u, v)` for all `k + l <= order`. The polynomial part is A3.6
 * SurfaceDerivsAlg1 (basis-function derivatives from A2.3); rational surfaces apply A4.4
 * RatSurfaceDerivs to the homogeneous derivatives `A_{k,l}` and `w_{k,l}`:
 * `S_{k,l} = (A_{k,l} - sum_{j=1..l} C(l,j) w_{0,j} S_{k,l-j}
 *            - sum_{i=1..k} C(k,i) (w_{i,0} S_{k-i,l} + sum_{j=1..l} C(l,j) w_{i,j} S_{k-i,l-j})) / w_{0,0}`.
 * The result is triangular: `ders[k]` has `order - k + 1` entries.
 */
export function surfaceDerivatives(
  surface: NurbsSurface,
  u: number,
  v: number,
  order: number,
): Result<SurfaceDerivatives> {
  const op = 'nurbs.surfaceDerivatives';
  if (!Number.isInteger(order) || order < 0) return invalidInput(op, 'order must be a non-negative integer');
  if (order > MAX_DERIVATIVE_ORDER) return invalidInput(op, `order must be at most ${MAX_DERIVATIVE_ORDER}`);
  const spans = checkParams(op, surface, u, v);
  if (!spans.ok) return spans;
  const { su, sv } = spans.value;
  const p = surface.degreeU;
  const q = surface.degreeV;
  const d = order;
  const du = Math.min(d, p);
  const dv = Math.min(d, q);
  const Nu = dersBasisFuns(surface.knotsU, p, su, u, du);
  const Nv = dersBasisFuns(surface.knotsV, q, sv, v, dv);
  const Pw = homogeneousNet(surface);
  const hdim = Pw[0]![0]!.length;
  // A3.6: SKL[k][l], zero where k > p or l > q.
  const A: number[][][] = [];
  for (let k = 0; k <= d; k++) {
    const row: number[][] = [];
    for (let l = 0; l <= d - k; l++) row.push(new Array<number>(hdim).fill(0));
    A.push(row);
  }
  for (let k = 0; k <= du; k++) {
    const temp: number[][] = [];
    for (let s = 0; s <= q; s++) {
      const t = new Array<number>(hdim).fill(0);
      for (let r = 0; r <= p; r++) {
        const pt = Pw[su - p + r]![sv - q + s]!;
        const n = Nu[k]![r]!;
        for (let c = 0; c < hdim; c++) t[c] = t[c]! + n * pt[c]!;
      }
      temp.push(t);
    }
    const dd = Math.min(d - k, dv);
    for (let l = 0; l <= dd; l++) {
      const out = A[k]![l]!;
      for (let s = 0; s <= q; s++) {
        const n = Nv[l]![s]!;
        const t = temp[s]!;
        for (let c = 0; c < hdim; c++) out[c] = out[c]! + n * t[c]!;
      }
    }
  }
  const finiteRows = (rows: number[][][]): Result<SurfaceDerivatives> => {
    for (const r of rows) for (const pt of r) for (const c of pt) {
      if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
    }
    return ok(Object.freeze(rows.map((r) => Object.freeze(r.map((pt) => Object.freeze(pt))))));
  };
  if (surface.weights === undefined) return finiteRows(A);
  // A4.4 on the homogeneous derivatives.
  const dim = surface.dimension;
  const w = (k: number, l: number): number => A[k]![l]![dim]!;
  const w00 = w(0, 0);
  if (!(w00 > 0) || !Number.isFinite(w00)) return invalidInput(op, 'homogeneous weight underflowed or overflowed');
  const S: number[][][] = [];
  for (let k = 0; k <= d; k++) {
    const row: number[][] = [];
    S.push(row);
    for (let l = 0; l <= d - k; l++) {
      const val = A[k]![l]!.slice(0, dim);
      for (let j = 1; j <= l; j++) {
        const f = binomial(l, j) * w(0, j);
        const prev = row[l - j]!;
        for (let c = 0; c < dim; c++) val[c] = val[c]! - f * prev[c]!;
      }
      for (let i = 1; i <= k; i++) {
        const bki = binomial(k, i);
        const f = bki * w(i, 0);
        const prev = S[k - i]![l]!;
        for (let c = 0; c < dim; c++) val[c] = val[c]! - f * prev[c]!;
        for (let j = 1; j <= l; j++) {
          const g = bki * binomial(l, j) * w(i, j);
          const pr = S[k - i]![l - j]!;
          for (let c = 0; c < dim; c++) val[c] = val[c]! - g * pr[c]!;
        }
      }
      row.push(val.map((c) => c / w00));
    }
  }
  return finiteRows(S);
}

/**
 * Unit normal `(S_u x S_v) / |S_u x S_v|` from the first partials of any surface (NURBS here,
 * analytic in `src/surface/evaluate.ts`; this is the one place that does the job). Fails with
 * `degenerate` when a partial derivative is shorter than `1e-3 * zoneTol3d` (as upstream's pole
 * test) or when the unit tangents are parallel within `kernel.tolerances.angTolDeg`
 * (`|û x v̂| <= sin(angTol)`), e.g. at a pole, the cone apex or a crease. No limit / pole
 * evaluation is attempted.
 */
export function unitNormalFromPartials(
  kernel: Kernel,
  su: Vec3,
  sv: Vec3,
  operation = 'nurbs.unitNormalFromPartials',
): Result<Vec3> {
  const lu = length3(su);
  const lv = length3(sv);
  const minLen = 1e-3 * kernel.tolerances.zoneTol3d;
  if (!(lu > minLen) || !(lv > minLen) || !Number.isFinite(lu) || !Number.isFinite(lv)) {
    return err({ kind: 'degenerate', operation });
  }
  const n = cross3(scale3(su, 1 / lu), scale3(sv, 1 / lv));
  const ln = length3(n);
  if (!(ln > Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180)) || !Number.isFinite(ln)) {
    return err({ kind: 'degenerate', operation });
  }
  return ok(Object.freeze(scale3(n, 1 / ln)));
}

/** The unit normal of a 3D NURBS surface at `(u, v)` (see {@link unitNormalFromPartials}). */
export function surfaceNormal(kernel: Kernel, surface: NurbsSurface, u: number, v: number): Result<Vec3> {
  const op = 'nurbs.surfaceNormal';
  if (surface.dimension !== 3) return invalidInput(op, 'the surface normal needs 3D control points');
  const ders = surfaceDerivatives(surface, u, v, 1);
  if (!ders.ok) return ders;
  const a = ders.value[1]![0]!;
  const b = ders.value[0]![1]!;
  return unitNormalFromPartials(kernel, vec3(a[0]!, a[1]!, a[2]!), vec3(b[0]!, b[1]!, b[2]!), op);
}

/**
 * Builds a curve from homogeneous (or plain) control points, projecting `(w x, w)` back to
 * `(x, w)` when `rational` (the one place in this area that does the projection; used by
 * {@link isoparametricCurve} and by the degree elevation in `elevate.ts`). A weight that is not
 * finite and positive, or a non-finite projected point, is rejected by `createNurbsCurve`.
 */
export function curveFromHomogeneous(
  degree: number,
  knots: Knots,
  points: readonly ControlPoint[],
  dim: number,
  rational: boolean,
): Result<NurbsCurve> {
  if (!rational) return createNurbsCurve(degree, knots, points);
  const weights = points.map((h) => h[dim]!);
  const pts = points.map((h) => h.slice(0, dim).map((c) => c / h[dim]!));
  return createNurbsCurve(degree, knots, pts, weights);
}

/**
 * The isoparametric curve through the surface at a fixed parameter.
 * - `direction = 'u'`: `u` fixed at `value`; returns `C(v) = S(value, v)` (degree `q`, knots `V`),
 *   control points `Q[j] = ` de Boor over u of column `j` at `value` (Lean `isoU`).
 * - `direction = 'v'`: `v` fixed at `value`; returns `C(u) = S(u, value)` (degree `p`, knots `U`),
 *   control points `R[i] = ` de Boor over v of row `i` at `value` (Lean `isoV`).
 * Rational surfaces give rational curves (computed on homogeneous points).
 */
export function isoparametricCurve(
  surface: NurbsSurface,
  direction: SurfaceDirection,
  value: number,
): Result<NurbsCurve> {
  const op = 'nurbs.isoparametricCurve';
  if (direction !== 'u' && direction !== 'v') return invalidInput(op, "direction must be 'u' or 'v'");
  const d = surfaceDomain(surface);
  const range = direction === 'u' ? d.u : d.v;
  if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
    return invalidInput(op, `parameter ${value} outside the domain [${range[0]}, ${range[1]}]`);
  }
  const Pw = homogeneousNet(surface);
  const rational = surface.weights !== undefined;
  const pts: readonly ControlPoint[] =
    direction === 'u'
      ? columnPointsAt(
          Pw,
          surface.knotsU,
          surface.degreeU,
          findSpan(surface.knotsU, surface.degreeU, value),
          value,
          0,
          Pw[0]!.length - 1,
        )
      : Pw.map((row) => deBoorPoint(surface.knotsV, surface.degreeV, row, findSpan(surface.knotsV, surface.degreeV, value), value));
  for (const pt of pts) {
    for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
  }
  return direction === 'u'
    ? curveFromHomogeneous(surface.degreeV, surface.knotsV, pts, surface.dimension, rational)
    : curveFromHomogeneous(surface.degreeU, surface.knotsU, pts, surface.dimension, rational);
}

/**
 * The curves of the net along `direction`, as polynomial B-spline curves on the homogeneous
 * points (dimension `dimension + 1` for a rational surface): for `'u'` one curve per column `j`
 * (points `Pw[0..n][j]`, degree `p`, knots `U`), for `'v'` one curve per row `i`.
 * Used to apply curve algorithms (knot insertion, degree elevation) row by row.
 */
export function directionCurves(surface: NurbsSurface, direction: SurfaceDirection): Result<readonly NurbsCurve[]> {
  if (direction !== 'u' && direction !== 'v') return invalidInput('nurbs.directionCurves', "direction must be 'u' or 'v'");
  const Pw = homogeneousNet(surface);
  const out: NurbsCurve[] = [];
  if (direction === 'u') {
    for (let j = 0; j < Pw[0]!.length; j++) {
      const c = createNurbsCurve(surface.degreeU, surface.knotsU, Pw.map((row) => row[j]!));
      if (!c.ok) return c;
      out.push(c.value);
    }
  } else {
    for (const row of Pw) {
      const c = createNurbsCurve(surface.degreeV, surface.knotsV, row);
      if (!c.ok) return c;
      out.push(c.value);
    }
  }
  return ok(Object.freeze(out));
}

/**
 * Inverse of {@link directionCurves}: rebuilds a surface from homogeneous curves along
 * `direction` that all share degree and knots, keeping the other direction of `template`.
 */
export function surfaceFromDirectionCurves(
  template: NurbsSurface,
  direction: SurfaceDirection,
  curves: readonly NurbsCurve[],
): Result<NurbsSurface> {
  const op = 'nurbs.surfaceFromDirectionCurves';
  if (direction !== 'u' && direction !== 'v') return invalidInput(op, "direction must be 'u' or 'v'");
  const first = curves[0];
  if (first === undefined) return invalidInput(op, 'no curves');
  const hdim = template.weights === undefined ? template.dimension : template.dimension + 1;
  for (const c of curves) {
    // The curves carry homogeneous points as plain coordinates (as `directionCurves` makes them);
    // a weighted curve would have its weights silently dropped.
    if (c.weights !== undefined) return invalidInput(op, 'direction curves must be non-rational (homogeneous points)');
    if (c.dimension !== hdim) return invalidInput(op, 'direction curves do not match the dimension of the template');
    if (c.degree !== first.degree || c.knots.length !== first.knots.length || c.knots.some((k, i) => k !== first.knots[i])) {
      return invalidInput(op, 'curves do not share degree and knots');
    }
  }
  const count = first.controlPoints.length;
  const hnet: ControlPoint[][] =
    direction === 'u'
      ? Array.from({ length: count }, (_, i) => curves.map((c) => c.controlPoints[i]!))
      : curves.map((c) => c.controlPoints.slice());
  const [pu, pv, ku, kv] =
    direction === 'u'
      ? [first.degree, template.degreeV, first.knots, template.knotsV]
      : [template.degreeU, first.degree, template.knotsU, first.knots];
  if (template.weights === undefined) return createNurbsSurface(pu, pv, ku, kv, hnet);
  const dim = template.dimension;
  const weights = hnet.map((row) => row.map((h) => h[dim]!));
  const net = hnet.map((row) => row.map((h) => h.slice(0, dim).map((c) => c / h[dim]!)));
  return createNurbsSurface(pu, pv, ku, kv, net, weights);
}
