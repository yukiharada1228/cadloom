/**
 * Degree elevation: Bezier segments (closed form, The NURBS Book eq. (5.36)), the Bezier
 * elevation matrix (eq. (5.36) iterated, `C(p,j) C(t,i-j) / C(p+t,i)`), B-spline / NURBS curves
 * (A5.9 DegreeElevateCurve: extract Bezier segments by knot insertion, elevate them, remove the
 * surplus knots again) and surfaces (A5.9 applied to every row or column, as A5.10 does).
 * Rational entities are elevated in homogeneous coordinates.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/bezier.rs (elevation_matrix, elevate_degree,
 *   srf_elevate_degree), solidcore/crates/solidcore/src/nurbs/crv_tool/p1.rs (Curve::elevate_degree,
 *   N_CrvElevateDegree / A5.9), solidcore/crates/solidcore/src/nurbs/crv_adv.rs,
 *   solidcore/crates/solidcore/src/nurbs/b_spline_curve_n_lib.rs (degree_elevate). Rewritten for cadloom.
 *
 * Formal model (formal/CadloomFormal/NurbsSurface.lean): one step of {@link elevateBezier} is
 * `elev P p i = (i/(p+1)) P[i-1] + (1 - i/(p+1)) P[i]` for `i = 1..p`, with `Q[0] = P[0]` and
 * `Q[p+1] = P[p]` (the Lean formula at `i = 0` and `i = p + 1` reduces to these).
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { binomial, checkPoints as checkControlPoints, homogeneousPoints, type ControlPoint, type NurbsCurve } from './curve.ts';
import { isClamped } from './knots.ts';
import { mapDirectionCurves } from './surface-insert.ts';
import { curveFromHomogeneous, type NurbsSurface, type SurfaceDirection } from './surface.ts';

/** Highest degree produced by elevation (upstream `nurbs_crv::MAX_DEGREE`); keeps binomials exact-ish and finite. */
export const MAX_ELEVATED_DEGREE = 32;

function checkPoints(op: string, points: readonly ControlPoint[]): Result<number> {
  if (points.length < 2) return invalidInput(op, 'need at least two control points (degree >= 1)');
  return checkControlPoints(op, points);
}

function checkTimes(op: string, degree: number, times: number): Result<number> {
  if (!Number.isInteger(times) || times < 0) return invalidInput(op, 'times must be a non-negative integer');
  if (degree + times > MAX_ELEVATED_DEGREE) return invalidInput(op, `elevated degree exceeds ${MAX_ELEVATED_DEGREE}`);
  return ok(times);
}

/**
 * One closed-form elevation step of a degree-`p` Bezier polygon (`p = points.length - 1`):
 * `Q[0] = P[0]`, `Q[i] = (i/(p+1)) P[i-1] + (1 - i/(p+1)) P[i]` (`i = 1..p`), `Q[p+1] = P[p]`.
 */
function elevateOnce(P: readonly ControlPoint[]): ControlPoint[] {
  const p = P.length - 1;
  const Q: ControlPoint[] = [P[0]!.slice()];
  for (let i = 1; i <= p; i++) {
    const a = i / (p + 1);
    const prev = P[i - 1]!;
    Q.push(P[i]!.map((c, k) => a * prev[k]! + (1 - a) * c));
  }
  Q.push(P[p]!.slice());
  return Q;
}

/**
 * Elevates a Bezier segment (degree `points.length - 1`) by `times` by repeating the closed-form
 * step. The polynomial (or, on homogeneous points, the rational) segment is unchanged.
 */
export function elevateBezier(points: readonly ControlPoint[], times = 1): Result<readonly ControlPoint[]> {
  const op = 'nurbs.elevateBezier';
  const dim = checkPoints(op, points);
  if (!dim.ok) return dim;
  const t = checkTimes(op, points.length - 1, times);
  if (!t.ok) return t;
  let Q: ControlPoint[] = points.map((pt) => pt.slice());
  for (let k = 0; k < times; k++) Q = elevateOnce(Q);
  for (const pt of Q) {
    for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
  }
  return ok(Object.freeze(Q.map((pt) => Object.freeze(pt))));
}

/**
 * The `(p+t+1) x (p+1)` Bezier elevation matrix: `Q[i] = sum_j M[i][j] P[j]` with
 * `M[i][j] = C(p,j) C(t,i-j) / C(p+t,i)` for `max(0, i-t) <= j <= min(p, i)`, else 0
 * (upstream `elevation_matrix`; eq. (5.36)). Rows sum to 1. Rows are filled for `i <= (p+t)/2`
 * and mirrored (`M[i][j] = M[p+t-i][p-j]`), as A5.9 does.
 */
export function elevationMatrix(degree: number, times: number): Result<readonly (readonly number[])[]> {
  const op = 'nurbs.elevationMatrix';
  if (!Number.isInteger(degree) || degree < 1) return invalidInput(op, 'degree must be an integer >= 1');
  const tt = checkTimes(op, degree, times);
  if (!tt.ok) return tt;
  const p = degree;
  const t = times;
  const ph = p + t;
  const ph2 = Math.floor(ph / 2);
  const M: number[][] = Array.from({ length: ph + 1 }, () => new Array<number>(p + 1).fill(0));
  M[0]![0] = 1;
  M[ph]![p] = 1;
  for (let i = 1; i <= ph2; i++) {
    const inv = 1 / binomial(ph, i);
    for (let j = Math.max(0, i - t); j <= Math.min(p, i); j++) M[i]![j] = inv * binomial(p, j) * binomial(t, i - j);
  }
  for (let i = ph2 + 1; i <= ph - 1; i++) {
    for (let j = Math.max(0, i - t); j <= Math.min(p, i); j++) M[i]![j] = M[ph - i]![p - j]!;
  }
  return ok(Object.freeze(M.map((r) => Object.freeze(r))));
}

/** `a * x + (1 - a) * y`, coordinate-wise. */
function blend(a: number, x: readonly number[], y: readonly number[]): number[] {
  return x.map((c, k) => a * c + (1 - a) * y[k]!);
}

/**
 * A5.9 DegreeElevateCurve on (homogeneous) control points `Pw` of a clamped curve of degree `p`
 * over `U`, elevated by `t >= 1`. Returns the new knots and points. Every distinct knot gains `t`
 * in multiplicity; continuity is unchanged.
 */
function degreeElevateA59(
  p: number,
  U: readonly number[],
  Pw: readonly ControlPoint[],
  t: number,
  bezalfs: readonly (readonly number[])[],
): { knots: number[]; points: number[][] } {
  const m = U.length - 1;
  const ph = p + t;
  const dim = Pw[0]!.length;
  const zero = (): number[] => new Array<number>(dim).fill(0);
  const Uh: number[] = [];
  const Qw: number[][] = [];
  const bpts: number[][] = [];
  const nextbpts: number[][] = new Array<number[]>(Math.max(p - 1, 0));
  const ebpts: number[][] = Array.from({ length: ph + 1 }, zero);
  const alfs = new Array<number>(Math.max(p - 1, 0)).fill(0);

  let mh = ph;
  let kind = ph + 1;
  let r = -1;
  let a = p;
  let b = p + 1;
  let cind = 1;
  let ua = U[0]!;
  Qw[0] = Pw[0]!.slice();
  for (let i = 0; i <= ph; i++) Uh[i] = ua;
  for (let i = 0; i <= p; i++) bpts[i] = Pw[i]!.slice();

  while (b < m) {
    const i0 = b;
    while (b < m && U[b] === U[b + 1]) b++;
    const mul = b - i0 + 1;
    mh = mh + mul + t;
    const ub = U[b]!;
    const oldr = r;
    r = p - mul;
    const lbz = oldr > 0 ? Math.floor((oldr + 2) / 2) : 1;
    const rbz = r > 0 ? ph - Math.floor((r + 1) / 2) : ph;
    if (r > 0) {
      // Insert ub r times to isolate the Bezier segment [ua, ub].
      const numer = ub - ua;
      for (let k = p; k > mul; k--) alfs[k - mul - 1] = numer / (U[a + k]! - ua);
      for (let j = 1; j <= r; j++) {
        const save = r - j;
        const s = mul + j;
        for (let k = p; k >= s; k--) bpts[k] = blend(alfs[k - s]!, bpts[k]!, bpts[k - 1]!);
        nextbpts[save] = bpts[p]!.slice();
      }
    }
    // Elevate the Bezier segment.
    for (let i = lbz; i <= ph; i++) {
      const e = zero();
      for (let j = Math.max(0, i - t); j <= Math.min(p, i); j++) {
        const f = bezalfs[i]![j]!;
        const bp = bpts[j]!;
        for (let c = 0; c < dim; c++) e[c] = e[c]! + f * bp[c]!;
      }
      ebpts[i] = e;
    }
    if (oldr > 1) {
      // Remove the knot ua (oldr - 1) times.
      let first = kind - 2;
      let last = kind;
      const den = ub - ua;
      const bet = (ub - Uh[kind - 1]!) / den;
      for (let tr = 1; tr < oldr; tr++) {
        let i = first;
        let j = last;
        let kj = j - kind + 1;
        while (j - i > tr) {
          if (i < cind) {
            const alf = (ub - Uh[i]!) / (ua - Uh[i]!);
            Qw[i] = blend(alf, Qw[i]!, Qw[i - 1]!);
          }
          if (j >= lbz) {
            if (j - tr <= kind - ph + oldr) {
              const gam = (ub - Uh[j - tr]!) / den;
              ebpts[kj] = blend(gam, ebpts[kj]!, ebpts[kj + 1]!);
            } else {
              ebpts[kj] = blend(bet, ebpts[kj]!, ebpts[kj + 1]!);
            }
          }
          i++;
          j--;
          kj--;
        }
        first--;
        last++;
      }
    }
    if (a !== p) {
      for (let i = 0; i < ph - oldr; i++) {
        Uh[kind] = ua;
        kind++;
      }
    }
    for (let j = lbz; j <= rbz; j++) {
      Qw[cind] = ebpts[j]!.slice();
      cind++;
    }
    if (b < m) {
      for (let j = 0; j < r; j++) bpts[j] = nextbpts[j]!;
      for (let j = r; j <= p; j++) bpts[j] = Pw[b - p + j]!.slice();
      a = b;
      b++;
      ua = ub;
    } else {
      for (let i = 0; i <= ph; i++) Uh[kind + i] = ub;
    }
  }
  const nh = mh - ph - 1;
  return { knots: Uh.slice(0, mh + 1), points: Qw.slice(0, nh + 1) };
}

/**
 * Elevates the degree of a clamped B-spline / NURBS curve by `times` (A5.9). The curve (shape and
 * parametrization) is unchanged; every distinct knot's multiplicity grows by `times`. Rational
 * curves are elevated in homogeneous coordinates. `times = 0` returns the curve itself.
 * Unclamped knot vectors are rejected (`invalid-input`).
 */
export function elevateCurveDegree(curve: NurbsCurve, times = 1): Result<NurbsCurve> {
  const op = 'nurbs.elevateCurveDegree';
  const tt = checkTimes(op, curve.degree, times);
  if (!tt.ok) return tt;
  if (times === 0) return ok(curve);
  if (!isClamped(curve.knots, curve.degree)) return invalidInput(op, 'degree elevation needs a clamped knot vector');
  const M = elevationMatrix(curve.degree, times);
  if (!M.ok) return M;
  const { knots, points } = degreeElevateA59(curve.degree, curve.knots, homogeneousPoints(curve), times, M.value);
  for (const pt of points) {
    for (const c of pt) if (!Number.isFinite(c)) return invalidInput(op, 'result is not finite (floating-point overflow)');
  }
  return curveFromHomogeneous(curve.degree + times, knots, points, curve.dimension, curve.weights !== undefined);
}

/**
 * Elevates a surface's degree in `direction` by `times` by elevating every column (`'u'`) or row
 * (`'v'`) of the homogeneous net with {@link elevateCurveDegree}. Needs a clamped knot vector in
 * that direction. The surface is unchanged.
 */
export function elevateSurfaceDegree(
  surface: NurbsSurface,
  direction: SurfaceDirection,
  times = 1,
): Result<NurbsSurface> {
  if (direction !== 'u' && direction !== 'v') return invalidInput('nurbs.elevateSurfaceDegree', "direction must be 'u' or 'v'");
  if (times === 0) return ok(surface);
  return mapDirectionCurves(surface, direction, (c) => elevateCurveDegree(c, times));
}
