/**
 * Evaluation of `Curve3`: point and derivatives up to order 2, unit tangent, curvature
 * `|C' × C''| / |C'|³` and the Frenet frame.
 *
 * Closed forms (formal model `CadloomFormal.Curve` in formal/CadloomFormal/Curve.lean):
 * - circle `C = o + r cos t u + r sin t v`, `C' = -r sin t u + r cos t v`, `C'' = -(C - o)`
 *   (`circlePt`, `circleD1`, `circleD2`; `circle_speed_sq`, `circle_second_deriv` give the
 *   curvature `1/r`); the ellipse is the same with `a`, `b` in place of `r`;
 * - line `C = o + t d`, `C' = d`, `C'' = 0`;
 * - NURBS: the M0 `curveDerivatives` (The NURBS Book A3.2 / A4.2).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/eval/curve.rs (curve frames / curvature),
 *   solidcore/crates/solidcore/src/curve/ellipse/p1.rs (EvaluateSTEP), curve/line.rs (evaluate).
 *   Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, isFinite3, length3, normalize3, scale3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { curveDerivatives } from '../nurbs/curve.ts';
import { conicRadii, curveRange, type Curve3 } from './types.ts';

/** `C(t)`, `C'(t)`, `C''(t)`. */
export interface CurveDerivs3 {
  readonly point: Point3;
  readonly d1: Vec3;
  readonly d2: Vec3;
}

export interface FrenetFrame {
  readonly tangent: Vec3;
  /** Principal normal, towards the centre of curvature. */
  readonly normal: Vec3;
  readonly binormal: Vec3;
  readonly curvature: number;
}

const fromArray = (a: readonly number[]): Vec3 => vec3(a[0]!, a[1]!, a[2]!);
const frozen = (v: Vec3): Vec3 => (Object.isFrozen(v) ? v : Object.freeze(v));

/** Point and first two derivatives at `t` (which must lie in `curveRange(curve)`). */
export function evaluateCurve3(curve: Curve3, t: number): Result<CurveDerivs3> {
  const op = 'curve.evaluateCurve3';
  const [t0, t1] = curveRange(curve);
  if (!Number.isFinite(t) || t < t0 || t > t1) return invalidInput(op, `parameter ${t} outside [${t0}, ${t1}]`);
  let out: CurveDerivs3;
  switch (curve.kind) {
    case 'line':
      out = { point: add3(curve.origin, scale3(curve.direction, t)), d1: curve.direction, d2: vec3(0, 0, 0) };
      break;
    case 'circle':
    case 'ellipse': {
      const [a, b] = conicRadii(curve);
      const { xAxis: u, yAxis: v } = curve.frame;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const radial = add3(scale3(u, a * c), scale3(v, b * s));
      out = {
        point: add3(curve.center, radial),
        d1: add3(scale3(u, -a * s), scale3(v, b * c)),
        d2: scale3(radial, -1),
      };
      break;
    }
    case 'nurbs': {
      const d = curveDerivatives(curve.curve, t, 2);
      if (!d.ok) return d;
      out = { point: fromArray(d.value[0]!), d1: fromArray(d.value[1]!), d2: fromArray(d.value[2]!) };
      break;
    }
  }
  if (!isFinite3(out.point) || !isFinite3(out.d1) || !isFinite3(out.d2)) return invalidInput(op, 'result is not finite');
  return ok(Object.freeze({ point: frozen(out.point), d1: frozen(out.d1), d2: frozen(out.d2) }));
}

/** The point `C(t)`. */
export function curvePoint3(curve: Curve3, t: number): Result<Point3> {
  const e = evaluateCurve3(curve, t);
  return e.ok ? ok(e.value.point) : e;
}

/** The unit tangent `C'/|C'|`; `degenerate` where `C'` vanishes (a NURBS cusp). */
export function curveTangent(curve: Curve3, t: number): Result<Vec3> {
  const e = evaluateCurve3(curve, t);
  if (!e.ok) return e;
  const u = normalize3(e.value.d1);
  if (u === undefined) return err({ kind: 'degenerate', operation: 'curve.curveTangent' });
  return ok(frozen(u));
}

/**
 * Curvature `|C' × C''| / |C'|³`. Exact closed forms for analytic curves: 0 for a line, `1/r`
 * for a circle. `degenerate` where `C'` vanishes.
 */
export function curveCurvature(curve: Curve3, t: number): Result<number> {
  const e = evaluateCurve3(curve, t);
  if (!e.ok) return e;
  if (curve.kind === 'line') return ok(0);
  if (curve.kind === 'circle') {
    const k = 1 / curve.radius; // finite: guaranteed by createCircleCurve, re-checked here
    return Number.isFinite(k) ? ok(k) : err({ kind: 'degenerate', operation: 'curve.curveCurvature' });
  }
  const speed = length3(e.value.d1);
  if (!(speed > 0)) return err({ kind: 'degenerate', operation: 'curve.curveCurvature' });
  const k = length3(cross3(e.value.d1, e.value.d2)) / (speed * speed * speed);
  if (!Number.isFinite(k)) return err({ kind: 'degenerate', operation: 'curve.curveCurvature' });
  return ok(k);
}

/**
 * The Frenet frame `(T, N, B)` at `t`: `T = C'/|C'|`, `B = (C' × C'')/|C' × C''|`, `N = B × T`.
 * `degenerate` when the curve is straight there: always for a line, and where `C''` is zero or
 * within `kernel.tolerances.angTolDeg` of parallel to `C'` (so the normal is undefined).
 */
export function curveFrenetFrame(kernel: Kernel, curve: Curve3, t: number): Result<FrenetFrame> {
  const op = 'curve.curveFrenetFrame';
  const e = evaluateCurve3(curve, t);
  if (!e.ok) return e;
  if (curve.kind === 'line') return err({ kind: 'degenerate', operation: op });
  const { d1, d2 } = e.value;
  const tangent = normalize3(d1);
  if (tangent === undefined) return err({ kind: 'degenerate', operation: op });
  const c = cross3(d1, d2);
  const cl = length3(c);
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  if (!(cl > sinTol * length3(d1) * length3(d2))) return err({ kind: 'degenerate', operation: op });
  const binormal = normalize3(c);
  if (binormal === undefined) return err({ kind: 'degenerate', operation: op });
  const normal = normalize3(cross3(binormal, tangent));
  if (normal === undefined) return err({ kind: 'degenerate', operation: op });
  const speed = length3(d1);
  const curvature = curve.kind === 'circle' ? 1 / curve.radius : cl / (speed * speed * speed);
  if (!Number.isFinite(curvature)) return err({ kind: 'degenerate', operation: op });
  return ok(Object.freeze({ tangent: frozen(tangent), normal: frozen(normal), binormal: frozen(binormal), curvature }));
}
