/**
 * Certified bounding boxes of curves and surfaces over parameter intervals: `boundCurve` and
 * `boundSurface` return an axis-aligned box that provably contains the exact image
 * `{C(t) : t ∈ T}` / `{S(u, v) : u ∈ U, v ∈ V}` of the stored definition (its doubles taken as
 * exact reals). This is the exclusion primitive of the M4 intersection code: two curves / surfaces
 * whose boxes are disjoint (`boxesDisjoint3`) cannot meet there.
 *
 * - line / plane: the parametrisation evaluated in interval arithmetic (`o + T d`,
 *   `o + U X + V Y`); exact when the products and sums are (outward rounding otherwise);
 * - circle, ellipse, cylinder, cone, sphere, torus: their parametrisations (the closed forms of
 *   `src/curve/evaluate.ts` / `src/surface/evaluate.ts`) evaluated with the certified interval
 *   `sin` / `cos` of `trig.ts` and outward-rounded products with the stored frame axes;
 *   the cone radius `R(v) = b + tan(α) v` is clamped at 0 (the single nappe; parameters past the
 *   apex are rejected as by the evaluator when the whole `V` lies past it), the sphere latitude is
 *   clamped to `[-π/2, π/2]` as the evaluator clamps it;
 * - NURBS: the convex hull of the extracted sub-curve / sub-patch (`nurbs-hull.ts`).
 * `boundCurveDerivative` encloses a curve's derivative the same way (the one curve-derivative
 * bound of the intersection code).
 * Every box is the image's enclosure, not its tight hull: subdividing the parameter interval
 * shrinks it (the interval evaluation is Lipschitz in the interval width, the hull of the
 * extracted control points converges quadratically).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/surface_intersector.rs (patch boxes for pruning),
 *   solidcore/crates/solidcore/src/query/distance_bound.rs (hull boxes, analytic forms' budget),
 *   solidcore/crates/solidcore/src/eval/ (curve / surface evaluation), solidcore/docs/ssi.md.
 *   Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { ROUNDING_SLACK, conicRadii, curveRange, type Curve3 } from '../curve/types.ts';
import type { Point3, Vec3 } from '../math/vec.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { createNurbsSurface, type NurbsSurface } from '../nurbs/surface.ts';
import { coneRadiusAt } from '../surface/evaluate.ts';
import type { Surface3, SurfaceFrame } from '../surface/types.ts';
import { boxOfIVec, ivAdd, ivec3, ivScaleVec, type Box3, type IVec3 } from './box.ts';
import { add, div, intersect, mul, scale, sqr, sub, unsafeInterval, type Interval } from './interval.ts';
import { boundNurbsCurve, boundNurbsSurface, homogeneousPartials } from './nurbs-hull.ts';
import { cosInterval, sinInterval, tanInterval } from './trig.ts';

const HALF_PI = Math.PI / 2;

const pointIVec = (p: Point3): IVec3 => ivec3(unsafeInterval(p.x, p.x), unsafeInterval(p.y, p.y), unsafeInterval(p.z, p.z));

function checkInterval(op: string, t: Interval, name: string): Result<Interval> {
  if (!Number.isFinite(t.lo) || !Number.isFinite(t.hi) || !(t.lo <= t.hi)) return invalidInput(op, `bad ${name} interval`);
  return ok(t);
}

function boxOfCoords(op: string, c: readonly Interval[]): Result<Box3> {
  if (c.length !== 3) return invalidInput(op, 'a 3D box needs a curve / surface of dimension 3');
  const b = boxOfIVec(ivec3(c[0]!, c[1]!, c[2]!));
  return b.ok ? b : invalidInput(op, 'bound overflowed');
}

/** `o + a X + b Y + c Z` for interval coefficients and an exact frame. */
function frameCombination(o: Point3, frame: SurfaceFrame, a: Interval, b: Interval, c: Interval): IVec3 {
  return ivAdd(ivAdd(ivAdd(pointIVec(o), ivScaleVec(frame.xAxis, a)), ivScaleVec(frame.yAxis, b)), ivScaleVec(frame.normal, c));
}

const isNurbsCurve = (c: Curve3 | NurbsCurve): c is NurbsCurve => !('kind' in c);
const isNurbsSurface = (s: Surface3 | NurbsSurface): s is NurbsSurface => !('kind' in s);

/**
 * A box containing `{C(t) : t ∈ T}`. `T` must lie in the curve's parameter range (`curveRange`,
 * or the knot domain of a bare `NurbsCurve`, which must have dimension 3).
 * Errors: a bad or out-of-range interval, non-positive weights, a non-3D NURBS curve, overflow.
 */
export function boundCurve(curve: Curve3 | NurbsCurve, t: Interval): Result<Box3> {
  const op = 'interval.boundCurve';
  const ti = checkInterval(op, t, 't');
  if (!ti.ok) return ti;
  if (isNurbsCurve(curve) || curve.kind === 'nurbs') {
    const c = isNurbsCurve(curve) ? curve : curve.curve;
    if (c.dimension !== 3) return invalidInput(op, 'NURBS curve must have dimension 3 (use boundNurbsCurve)');
    const r = boundNurbsCurve(c, t);
    return r.ok ? boxOfCoords(op, r.value) : r;
  }
  const [t0, t1] = curveRange(curve);
  if (t.lo < t0 || t.hi > t1) return invalidInput(op, `t interval outside the range [${t0}, ${t1}]`);
  let v: IVec3;
  if (curve.kind === 'line') {
    v = ivAdd(pointIVec(curve.origin), ivScaleVec(curve.direction, t));
  } else {
    const [a, b] = conicRadii(curve);
    const { xAxis: X, yAxis: Y } = curve.frame;
    v = ivAdd(ivAdd(pointIVec(curve.center), ivScaleVec(X, scale(cosInterval(t), a))), ivScaleVec(Y, scale(sinInterval(t), b)));
  }
  const box = boxOfIVec(v);
  return box.ok ? box : invalidInput(op, 'bound overflowed');
}

/** The cone radius interval `max(0, b + tan(α) V)`; `invalid-input` when all of `V` lies past the apex. */
function coneRadius(op: string, baseRadius: number, semiAngle: number, v: Interval): Result<Interval> {
  const tan = tanInterval(unsafeInterval(semiAngle, semiAngle));
  if (!tan.ok) return tan;
  const tf = Math.tan(semiAngle);
  if (coneRadiusAt(baseRadius, tf, v.lo) === undefined && coneRadiusAt(baseRadius, tf, v.hi) === undefined) {
    return invalidInput(op, 'cone parameter v lies past the apex (R(v) < 0)');
  }
  const r = add(unsafeInterval(baseRadius, baseRadius), mul(tan.value, v));
  return ok(unsafeInterval(Math.max(0, r.lo), Math.max(0, r.hi)));
}

/** The sphere latitude interval clamped to `[-π/2, π/2]` (the evaluator's clamp); errors beyond its slack. */
function sphereLatitude(op: string, v: Interval): Result<Interval> {
  const limit = HALF_PI * (1 + ROUNDING_SLACK);
  if (v.lo > limit || v.hi < -limit) return invalidInput(op, 'sphere latitude v must lie in [-π/2, π/2]');
  const lo = Math.min(HALF_PI, Math.max(-HALF_PI, v.lo));
  const hi = Math.max(lo, Math.min(HALF_PI, Math.max(-HALF_PI, v.hi)));
  return ok(unsafeInterval(lo, hi));
}

/**
 * A box containing `{S(u, v) : u ∈ U, v ∈ V}`. Analytic surfaces take any finite intervals
 * (a cone's `V` not entirely past the apex, a sphere's `V` meeting `[-π/2, π/2]`); a NURBS
 * surface's `U × V` must lie in its knot domain and it must have dimension 3.
 */
export function boundSurface(surface: Surface3 | NurbsSurface, u: Interval, v: Interval): Result<Box3> {
  const op = 'interval.boundSurface';
  const ui = checkInterval(op, u, 'u');
  if (!ui.ok) return ui;
  const vi = checkInterval(op, v, 'v');
  if (!vi.ok) return vi;
  if (isNurbsSurface(surface) || surface.kind === 'nurbs') {
    const s = isNurbsSurface(surface) ? surface : surface.surface;
    if (s.dimension !== 3) return invalidInput(op, 'NURBS surface must have dimension 3 (use boundNurbsSurface)');
    const r = boundNurbsSurface(s, u, v);
    return r.ok ? boxOfCoords(op, r.value) : r;
  }
  const zero = unsafeInterval(0, 0);
  let p: IVec3;
  switch (surface.kind) {
    case 'plane':
      p = frameCombination(surface.origin, surface.frame, u, v, zero);
      break;
    case 'cylinder': {
      const r = surface.radius;
      p = frameCombination(surface.origin, surface.frame, scale(cosInterval(u), r), scale(sinInterval(u), r), v);
      break;
    }
    case 'cone': {
      const R = coneRadius(op, surface.baseRadius, surface.semiAngle, v);
      if (!R.ok) return R;
      p = frameCombination(surface.origin, surface.frame, mul(R.value, cosInterval(u)), mul(R.value, sinInterval(u)), v);
      break;
    }
    case 'sphere':
    case 'torus': {
      const lat = surface.kind === 'sphere' ? sphereLatitude(op, v) : ok(v);
      if (!lat.ok) return lat;
      const [R, r] = surface.kind === 'sphere' ? [0, surface.radius] : [surface.majorRadius, surface.minorRadius];
      const rho = add(unsafeInterval(R, R), scale(cosInterval(lat.value), r));
      // On the sphere rho = r cos v >= 0 exactly; keep the enclosure non-negative.
      const rhoC = surface.kind === 'sphere' ? (intersect(rho, unsafeInterval(0, r)) ?? rho) : rho;
      p = frameCombination(surface.center, surface.frame, mul(rhoC, cosInterval(u)), mul(rhoC, sinInterval(u)), scale(sinInterval(lat.value), r));
      break;
    }
  }
  const box = boxOfIVec(p);
  return box.ok ? box : invalidInput(op, 'bound overflowed');
}

/** The exact (point) box of a finite vector, a convenience for callers mixing points and bounds. */
export function pointBox(p: Vec3): Result<Box3> {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return invalidInput('interval.pointBox', 'non-finite point');
  return boxOfIVec(pointIVec(p));
}

/**
 * A NURBS curve as the degree-`(p, 1)` surface constant in `v` (both `v` rows equal the control
 * polygon), so the surface hodograph enclosure (`homogeneousPartials`) bounds the curve's derivative.
 */
export function nurbsCurveAsSurface(c: NurbsCurve): Result<NurbsSurface> {
  const net = c.controlPoints.map((p) => [p, p]);
  const w = c.weights?.map((x) => [x, x]);
  return createNurbsSurface(c.degree, 1, c.knots, [0, 0, 1, 1], net, w);
}

/**
 * An enclosure of the derivative `{C'(t) : t ∈ T}` (`T` inside the curve's range): the constant
 * direction of a line, `-a sin(T) X + b cos(T) Y` for a circle / ellipse, and for a NURBS curve the
 * quotient rule `(H' W - H W') / W²` over the hodograph enclosure of its homogeneous form.
 * `wrapped` may cache `nurbsCurveAsSurface(curve.curve)` across calls. Errors: a bad interval, a
 * weight not proved positive, those of `homogeneousPartials`.
 */
export function boundCurveDerivative(curve: Curve3, t: Interval, wrapped?: NurbsSurface): Result<IVec3> {
  const op = 'interval.boundCurveDerivative';
  const ti = checkInterval(op, t, 't');
  if (!ti.ok) return ti;
  switch (curve.kind) {
    case 'line':
      return ok(pointIVec(curve.direction));
    case 'circle':
    case 'ellipse': {
      const [a, b] = conicRadii(curve);
      return ok(ivAdd(ivScaleVec(curve.frame.xAxis, scale(sinInterval(t), -a)), ivScaleVec(curve.frame.yAxis, scale(cosInterval(t), b))));
    }
    case 'nurbs': {
      let srf = wrapped;
      if (srf === undefined) {
        const w = nurbsCurveAsSurface(curve.curve);
        if (!w.ok) return w;
        srf = w.value;
      }
      const p = homogeneousPartials(srf, t, unsafeInterval(0, 0));
      if (!p.ok) return p;
      const { h, hu } = p.value;
      const W = h[3]!, Wu = hu[3]!;
      if (!(W.lo > 0)) return invalidInput(op, 'weight not proved positive');
      const den = sqr(W);
      const out: Interval[] = [];
      for (let k = 0; k < 3; k++) {
        const q = div(sub(mul(hu[k]!, W), mul(h[k]!, Wu)), den);
        if (!q.ok) return q;
        out.push(q.value);
      }
      return ok(ivec3(out[0]!, out[1]!, out[2]!));
    }
  }
}
