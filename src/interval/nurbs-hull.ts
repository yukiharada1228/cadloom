/**
 * Certified enclosures of NURBS curves and surfaces over parameter intervals, by the convex hull
 * property: over a knot span the curve point is a convex combination of the `p + 1` control
 * points of that span (Lean `Nurbs.deBoor_between`, `NurbsSurface.tensor_between`; for a rational
 * curve with positive weights a convex combination of the Euclidean control points, Lean
 * `Interval.ratio_combo_mem`).
 *
 * Two enclosures are made and intersected (both contain the exact image, so the intersection does):
 * - coarse: the hull of the ORIGINAL control points of the spans meeting the parameter interval.
 *   It involves no arithmetic at all (min / max of the stored doubles), so it is exact.
 * - fine: the sub-curve / sub-patch is extracted by inserting the interval ends up to multiplicity
 *   `p` with the M0 / M1 knot insertion (`insertKnot`, `insertKnotSurface`; no second
 *   implementation here), and the hull of its window of control points is widened by the rounding
 *   error that insertion can carry (derived bound, the one upstream `query/distance_bound.rs` uses):
 *   * each insertion level forms `α P + (1 - α) Q` with `α` within `γ_3`, at most `8 u M` from the
 *     exact value when `|P|, |Q| <= M` (`M` the net's largest homogeneous coefficient; the convex
 *     combinations never leave that size);
 *   * each call of the M0 insertion multiplies into homogeneous form and divides back (`γ_2 M`);
 *   so every homogeneous coefficient is within `err = γ_{16 (L + 2 c + 1)} M` of the exact one
 *   (`L` levels, `c` calls, one more for the final homogeneous form), and a projected point within
 *   `err (1 + |x|) / (w_min - err) + γ_2 |x|` (positive weights proved by `w_min > err`). The
 *   intervals are rounded outward. This bound is a documented derivation (Higham §3.1), checked by
 *   tests against exact rational evaluation; it is not proved in Lean (Lean proves the hull and
 *   the "perturbed points in a widened hull" steps: `Interval.perturbed_combo_mem`).
 * When insertion fails (overflow) or the weights of the extracted piece are not proved positive,
 * the coarse enclosure alone is returned.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/query/distance_bound.rs (`pieces_about`, `widened_box`: the
 *   convex hull of Euclidean control points of a rational patch, the extraction error
 *   `gamma_{16 (p + q)}` and the quotient widening `err (1 + size) / (w_min - err) + gamma_2 size`),
 *   solidcore/crates/solidcore/src/nurbs/certificate.rs (hull boxes of restricted pieces),
 *   solidcore/crates/solidcore/src/nurbs/math.rs (`gamma`). Rewritten for cadloom.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { curveDomain, type ControlPoint, type NurbsCurve } from '../nurbs/curve.ts';
import { insertKnot } from '../nurbs/insert.ts';
import { findSpan, knotMultiplicity, type Knots } from '../nurbs/knots.ts';
import { insertKnotSurface } from '../nurbs/surface-insert.ts';
import { homogeneousNet, surfaceDomain, type ControlNet, type NurbsSurface } from '../nurbs/surface.ts';
import { addUp, divDown, divUp, gamma, mulDown, mulUp, subDown, subUp } from './float.ts';
import { intersect, isBounded, unsafeInterval, type Interval } from './interval.ts';

/**
 * The index window `[first, last]` of the control points whose basis functions may be non-zero on
 * `t`. A degenerate `t = [a, a]` at a knot of multiplicity `>= p` (inside the domain) is the
 * single control point the curve interpolates there (`P[k-p]`, `k` the span of `a`); at the end of
 * a clamped domain it is the last control point.
 */
export function spanWindow(knots: Knots, degree: number, t: Interval): readonly [number, number] {
  const n = knots.length - degree - 2;
  const kLo = findSpan(knots, degree, t.lo);
  if (t.hi === t.lo) {
    const mult = knotMultiplicity(knots, t.lo);
    if (t.lo < knots[n + 1]! && knots[kLo] === t.lo && mult >= degree) return [kLo - degree, kLo - degree];
    if (t.lo === knots[n + 1]! && knots[n + degree + 1] === t.lo && mult >= degree + 1) return [n, n];
    return [kLo - degree, kLo];
  }
  // The last span `[U[k], U[k+1])` that meets `(t.lo, t.hi]`: the largest k <= n with U[k] < t.hi.
  let kHi = n;
  while (kHi > kLo && !(knots[kHi]! < t.hi)) kHi--;
  return [kLo - degree, kHi];
}

function checkParamInterval(op: string, t: Interval, dom: readonly [number, number], name: string): Result<Interval> {
  if (!Number.isFinite(t.lo) || !Number.isFinite(t.hi) || !(t.lo <= t.hi)) return invalidInput(op, `bad ${name} interval`);
  if (t.lo < dom[0] || t.hi > dom[1]) return invalidInput(op, `${name} interval [${t.lo}, ${t.hi}] outside the domain [${dom[0]}, ${dom[1]}]`);
  return ok(t);
}

function checkWeights(op: string, weights: readonly number[] | undefined): Result<void> {
  if (weights === undefined) return ok(undefined);
  for (const w of weights) if (!Number.isFinite(w) || !(w > 0)) return invalidInput(op, 'weights must be finite and positive');
  return ok(undefined);
}

/** Largest homogeneous coefficient `max(|w x_c|, w)` (rounded up). */
function homogeneousSize(points: readonly ControlPoint[], weights: readonly number[] | undefined): number {
  let m = 0;
  points.forEach((pt, i) => {
    const w = weights?.[i] ?? 1;
    m = Math.max(m, w);
    for (const c of pt) m = Math.max(m, mulUp(Math.abs(c), w));
  });
  return m;
}

/** Per-coordinate hull of Euclidean points (exact). */
function hullCoords(points: readonly ControlPoint[], dim: number): Interval[] {
  const out: Interval[] = [];
  for (let c = 0; c < dim; c++) {
    let lo = Infinity, hi = -Infinity;
    for (const pt of points) {
      lo = Math.min(lo, pt[c]!);
      hi = Math.max(hi, pt[c]!);
    }
    out.push(unsafeInterval(lo, hi));
  }
  return out;
}

/**
 * The widening of a projected (Euclidean) window whose homogeneous coefficients are within `err`:
 * `err (1 + size) / (w_min - err) + γ_2 size` (rounded up), or `err` for a polynomial window;
 * `undefined` when the weights are not proved positive or the result is not finite.
 */
function projectedWidening(points: readonly ControlPoint[], weights: readonly number[] | undefined, err: number): number | undefined {
  if (weights === undefined) return Number.isFinite(err) ? err : undefined;
  let size = 0;
  for (const pt of points) for (const c of pt) size = Math.max(size, Math.abs(c));
  const wMin = Math.min(...weights);
  const denom = subDown(wMin, err);
  if (!(denom > 0)) return undefined;
  const widen = addUp(divUp(mulUp(err, addUp(1, size)), denom), mulUp(gamma(2), size));
  return Number.isFinite(widen) ? widen : undefined;
}

function widenAll(hull: readonly Interval[], e: number): Interval[] {
  return hull.map((i) => unsafeInterval(subDown(i.lo, e), addUp(i.hi, e)));
}

/** Intersects the coarse and fine enclosures coordinatewise (falls back to coarse if they miss, which a sound fine bound cannot). */
function combine(coarse: readonly Interval[], fine: readonly Interval[] | undefined): readonly Interval[] {
  if (fine === undefined || !fine.every(isBounded)) return Object.freeze(coarse.slice());
  const out: Interval[] = [];
  for (let c = 0; c < coarse.length; c++) {
    const r = intersect(coarse[c]!, fine[c]!);
    if (r === undefined) return Object.freeze(coarse.slice());
    out.push(r);
  }
  return Object.freeze(out);
}

/** Inserts `t` up to multiplicity `p` (no-op at the domain end or when already full). */
function fillCurveKnot(c: NurbsCurve, t: number): Result<{ readonly curve: NurbsCurve; readonly levels: number; readonly calls: number }> {
  const [, hi] = curveDomain(c);
  const times = c.degree - knotMultiplicity(c.knots, t);
  if (t >= hi || times <= 0) return ok({ curve: c, levels: 0, calls: 0 });
  const r = insertKnot(c, t, times);
  return r.ok ? ok({ curve: r.value, levels: times, calls: 1 }) : r;
}

/** The sub-curve over `t` with its homogeneous error bound, or `undefined` when insertion failed. */
function subCurve(curve: NurbsCurve, t: Interval): { readonly curve: NurbsCurve; readonly err: number } | undefined {
  const a = fillCurveKnot(curve, t.lo);
  if (!a.ok) return undefined;
  const b = t.hi > t.lo ? fillCurveKnot(a.value.curve, t.hi) : ok({ curve: a.value.curve, levels: 0, calls: 0 });
  if (!b.ok) return undefined;
  const steps = a.value.levels + b.value.levels + 2 * (a.value.calls + b.value.calls) + 1;
  const err = mulUp(gamma(16 * steps), homogeneousSize(curve.controlPoints, curve.weights));
  return { curve: b.value.curve, err };
}

/**
 * An enclosure of `{C(t) : t ∈ T}` for a NURBS curve of any dimension: one interval per
 * coordinate. `T` must lie in the curve's domain. Errors: a bad interval, non-positive weights.
 */
export function boundNurbsCurve(curve: NurbsCurve, t: Interval): Result<readonly Interval[]> {
  const op = 'interval.boundNurbsCurve';
  const ti = checkParamInterval(op, t, curveDomain(curve), 't');
  if (!ti.ok) return ti;
  const w = checkWeights(op, curve.weights);
  if (!w.ok) return w;
  const [first, last] = spanWindow(curve.knots, curve.degree, t);
  const coarse = hullCoords(curve.controlPoints.slice(first, last + 1), curve.dimension);
  const sub = subCurve(curve, t);
  let fine: Interval[] | undefined;
  if (sub !== undefined) {
    const c = sub.curve;
    const [f0, f1] = spanWindow(c.knots, c.degree, t);
    const pts = c.controlPoints.slice(f0, f1 + 1);
    const widen = projectedWidening(pts, c.weights?.slice(f0, f1 + 1), sub.err);
    if (widen !== undefined) fine = widenAll(hullCoords(pts, c.dimension), widen);
  }
  return ok(combine(coarse, fine));
}

/** The extracted sub-patch of a NURBS surface over `u × v`, with its homogeneous error bound. */
export interface SubPatch {
  /** The surface after the knot insertions (the whole net; use the windows). */
  readonly surface: NurbsSurface;
  /** Control-point index windows `[first, last]` along u and v. */
  readonly windowU: readonly [number, number];
  readonly windowV: readonly [number, number];
  /** Bound on the absolute error of every coefficient of `homogeneousNet(surface)` against the exact extraction. */
  readonly err: number;
}

function fillSurfaceKnot(
  s: NurbsSurface,
  dir: 'u' | 'v',
  t: number,
): Result<{ readonly surface: NurbsSurface; readonly levels: number; readonly calls: number }> {
  const knots = dir === 'u' ? s.knotsU : s.knotsV;
  const degree = dir === 'u' ? s.degreeU : s.degreeV;
  const hi = (dir === 'u' ? surfaceDomain(s).u : surfaceDomain(s).v)[1];
  const times = degree - knotMultiplicity(knots, t);
  if (t >= hi || times <= 0) return ok({ surface: s, levels: 0, calls: 0 });
  const r = insertKnotSurface(s, dir, t, times);
  return r.ok ? ok({ surface: r.value, levels: times, calls: 1 }) : r;
}

const flatNet = (net: ControlNet): ControlPoint[] => net.flat();
const flatWeights = (s: NurbsSurface): number[] | undefined => s.weights?.flat();

/**
 * The sub-patch over `u × v` (both inside the domain): the interval ends inserted up to full
 * multiplicity with the M1 `insertKnotSurface`. When an insertion fails the original surface is
 * returned with the error of forming its homogeneous net only (`γ_1 M`).
 */
export function subPatch(surface: NurbsSurface, u: Interval, v: Interval): SubPatch {
  const size = homogeneousSize(flatNet(surface.controlPoints), flatWeights(surface));
  let s = surface;
  let levels = 0, calls = 0;
  let failed = false;
  const steps: readonly ['u' | 'v', number, boolean][] = [
    ['u', u.lo, true],
    ['u', u.hi, u.hi > u.lo],
    ['v', v.lo, true],
    ['v', v.hi, v.hi > v.lo],
  ];
  for (const [dir, t, needed] of steps) {
    if (!needed) continue;
    const r = fillSurfaceKnot(s, dir, t);
    if (!r.ok) {
      failed = true;
      break;
    }
    s = r.value.surface;
    levels += r.value.levels;
    calls += r.value.calls;
  }
  if (failed) {
    s = surface;
    levels = 0;
    calls = 0;
  }
  const err = mulUp(gamma(16 * (levels + 2 * calls + 1)), size);
  return Object.freeze({
    surface: s,
    windowU: spanWindow(s.knotsU, s.degreeU, u),
    windowV: spanWindow(s.knotsV, s.degreeV, v),
    err,
  });
}

function windowPoints(s: NurbsSurface, wu: readonly [number, number], wv: readonly [number, number]): {
  readonly points: ControlPoint[];
  readonly weights: number[] | undefined;
} {
  const points: ControlPoint[] = [];
  const weights: number[] | undefined = s.weights === undefined ? undefined : [];
  for (let i = wu[0]; i <= wu[1]; i++) {
    for (let j = wv[0]; j <= wv[1]; j++) {
      points.push(s.controlPoints[i]![j]!);
      weights?.push(s.weights![i]![j]!);
    }
  }
  return { points, weights };
}

function checkSurface(op: string, surface: NurbsSurface, u: Interval, v: Interval): Result<void> {
  const d = surfaceDomain(surface);
  const ui = checkParamInterval(op, u, d.u, 'u');
  if (!ui.ok) return ui;
  const vi = checkParamInterval(op, v, d.v, 'v');
  if (!vi.ok) return vi;
  return checkWeights(op, flatWeights(surface));
}

/**
 * An enclosure of `{S(u, v) : u ∈ U, v ∈ V}` for a NURBS surface of any dimension: one interval per
 * coordinate. `U × V` must lie in the domain. Errors: a bad interval, non-positive weights.
 */
export function boundNurbsSurface(surface: NurbsSurface, u: Interval, v: Interval): Result<readonly Interval[]> {
  const op = 'interval.boundNurbsSurface';
  const chk = checkSurface(op, surface, u, v);
  if (!chk.ok) return chk;
  const coarseWin = windowPoints(surface, spanWindow(surface.knotsU, surface.degreeU, u), spanWindow(surface.knotsV, surface.degreeV, v));
  const coarse = hullCoords(coarseWin.points, surface.dimension);
  const sub = subPatch(surface, u, v);
  const fineWin = windowPoints(sub.surface, sub.windowU, sub.windowV);
  const widen = projectedWidening(fineWin.points, fineWin.weights, sub.err);
  const fine = widen === undefined ? undefined : widenAll(hullCoords(fineWin.points, surface.dimension), widen);
  return ok(combine(coarse, fine));
}

/**
 * Interval enclosures, over `U × V`, of the homogeneous surface `H = (X, W)` (`W = 1` for a
 * polynomial surface) and of its partial derivatives `H_u`, `H_v`, from the extracted sub-patch:
 * `H` by the hull of the window, `H_u` by the hull of the u-hodograph
 * `D[i][j] = p (P[i+1][j] - P[i][j]) / (U[i+p+1] - U[i+1])` (The NURBS Book eq. 3.4 / 3.7, a
 * B-spline of degree `p - 1` on `U[1..m-1]` whose window over a span `k` is `D[k-p..k-1]`),
 * `H_v` likewise (index windows from `hodographWindow`, which also covers degenerate intervals);
 * every coefficient is taken as an interval of half-width `err`.
 * Index `dim` of each array is the weight. For the normal cone (`normal-cone.ts`).
 */
export function homogeneousPartials(
  surface: NurbsSurface,
  u: Interval,
  v: Interval,
): Result<{ readonly h: readonly Interval[]; readonly hu: readonly Interval[]; readonly hv: readonly Interval[] }> {
  const op = 'interval.homogeneousPartials';
  const chk = checkSurface(op, surface, u, v);
  if (!chk.ok) return chk;
  const sub = subPatch(surface, u, v);
  const s = sub.surface;
  const net = homogeneousNet(s);
  const rational = s.weights !== undefined;
  const dim = s.dimension;
  const coord = (pt: ControlPoint, c: number): number => (c < dim ? pt[c]! : rational ? pt[dim]! : 1);
  const e = sub.err;
  const [i0, i1] = sub.windowU;
  const [j0, j1] = sub.windowV;
  const alongU = hodographWindow(s.knotsU, s.degreeU, u, sub.windowU);
  const alongV = hodographWindow(s.knotsV, s.degreeV, v, sub.windowV);
  const h: Interval[] = [], hu: Interval[] = [], hv: Interval[] = [];
  for (let c = 0; c <= dim; c++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const x = coord(net[i]![j]!, c);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    h.push(unsafeInterval(subDown(lo, e), addUp(hi, e)));
    const polynomialWeight = c === dim && !rational;
    hu.push(polynomialWeight ? unsafeInterval(0, 0) : hodographHull(net, s.knotsU, s.degreeU, alongU, [j0, j1], c, coord, e, 'u'));
    hv.push(polynomialWeight ? unsafeInterval(0, 0) : hodographHull(net, s.knotsV, s.degreeV, alongV, [i0, i1], c, coord, e, 'v'));
  }
  const all = [...h, ...hu, ...hv];
  if (!all.every(isBounded)) return invalidInput(op, 'partial bound overflowed');
  return ok(Object.freeze({ h: Object.freeze(h), hu: Object.freeze(hu), hv: Object.freeze(hv) }));
}

/**
 * The index window of the hodograph coefficients `D[i]` whose degree-`(p - 1)` basis functions may
 * be non-zero on `t`. A proper interval: `[first, last - 1]` of the control-point window. A
 * degenerate `t = [a, a]` cannot use the collapsed point window (it would give no coefficient, i.e.
 * a zero derivative): it takes the right derivative's coefficients `D[k-p .. k-1]` (`k` the span of
 * `a`, as the evaluator uses) together with the left derivative's `D[k-m-p .. k-m-1]` when `a` is a
 * knot of multiplicity `m` (the derivative may jump there), clamped at index 0.
 */
function hodographWindow(knots: Knots, p: number, t: Interval, window: readonly [number, number]): readonly [number, number] {
  if (t.hi > t.lo) return [window[0], window[1] - 1];
  const k = findSpan(knots, p, t.lo);
  const mult = knots[k] === t.lo ? knotMultiplicity(knots, t.lo) : 0;
  return [Math.max(0, k - mult - p), k - 1];
}

/** Hull of the hodograph coefficients along `dir` over the index windows, each with input error `e`. */
function hodographHull(
  net: ControlNet,
  knots: Knots,
  p: number,
  along: readonly [number, number],
  across: readonly [number, number],
  c: number,
  coord: (pt: ControlPoint, c: number) => number,
  e: number,
  dir: 'u' | 'v',
): Interval {
  let lo = Infinity, hi = -Infinity;
  for (let i = along[0]; i <= along[1]; i++) {
    const den = knots[i + p + 1]! - knots[i + 1]!; // exact sign; the value is rounded below
    if (!(den > 0)) continue; // that basis function of degree p - 1 is identically zero
    const denLo = subDown(knots[i + p + 1]!, knots[i + 1]!);
    const denHi = subUp(knots[i + p + 1]!, knots[i + 1]!);
    for (let j = across[0]; j <= across[1]; j++) {
      const a = dir === 'u' ? net[i + 1]![j]! : net[j]![i + 1]!;
      const b = dir === 'u' ? net[i]![j]! : net[j]![i]!;
      // Difference within [d - 2e, d + 2e] rounded outward, times p, over [denLo, denHi] > 0.
      const dLo = subDown(subDown(coord(a, c), coord(b, c)), 2 * e);
      const dHi = addUp(subUp(coord(a, c), coord(b, c)), 2 * e);
      const nLo = mulDown(dLo, p), nHi = mulUp(dHi, p);
      const qLo = Math.min(divDown(nLo, denLo), divDown(nLo, denHi));
      const qHi = Math.max(divUp(nHi, denLo), divUp(nHi, denHi));
      lo = Math.min(lo, qLo);
      hi = Math.max(hi, qHi);
    }
  }
  if (lo > hi) return unsafeInterval(0, 0); // no active basis function: the derivative is 0 there
  return unsafeInterval(lo, hi);
}

