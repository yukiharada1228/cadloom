/**
 * Affine transforms of `Curve3` (an M0 `Transform`).
 *
 * - line: origin and direction are mapped (`applyPoint`, `applyVector`); the parametrisation is
 *   kept exactly (`T(o + t d) = T o + t L d`). A direction mapped to zero is `degenerate`.
 * - circle / ellipse: the image of `c + cos t A + sin t B` (`A = a u`, `B = b v`) is
 *   `T c + cos t L A + sin t L B` with `L A`, `L B` not orthogonal in general. When
 *   `L A`, `L B` are orthogonal with equal lengths (a similarity, within `ROUNDING_SLACK`
 *   relative) the result is a **circle** with the same parameter range. Otherwise it is an
 *   **ellipse** in principal axes: `U' = c0 L A + s0 L B`, `V' = -s0 L A + c0 L B` with
 *   `2 t0 = atan2(2 LA·LB, |LA|² - |LB|²)` (so `U'·V' = 0`, Lean `principal_axes_dot`, and
 *   `U'` is the major axis, Lean `principal_axes_major`), over the shifted range `[t0_, t1_] - t0` (the curve is unchanged,
 *   Lean `principal_axes_reparam`). So a circle under non-uniform scaling becomes an ellipse
 *   (never an error); an image collapsed to a segment or point (`L A × L B` within the angular
 *   tolerance of zero) is `degenerate`. A reflection keeps the parameter direction: the new
 *   normal is `U' × V'`.
 * - nurbs: control points are mapped, weights and knots kept (affine invariance of NURBS).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/curve/native_affine.rs, curve/line.rs (transform),
 *   curve/ellipse/p2.rs (transform of an ellipse, canonical axes), geom/transform.rs.
 *   Rewritten for cadloom; not a translation.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { applyPoint, applyVector, type Transform } from '../math/transform.ts';
import { add3, cross3, dot3, length3, scale3, type Point3, type Vec3 } from '../math/vec.ts';
import { createNurbsCurve } from '../nurbs/curve.ts';
import {
  ROUNDING_SLACK,
  conicRadii,
  createCircleCurve,
  createEllipseCurve,
  createLineCurve,
  createNurbsCurve3,
  type CircleCurve,
  type Curve3,
  type EllipseCurve,
} from './types.ts';

const OP = 'curve.transformCurve3';

/**
 * The circle or ellipse `center + cos t A + sin t B`, `t ∈ range`, for arbitrary (non-parallel)
 * `A`, `B`, re-expressed in principal axes (see the module comment).
 */
export function conicFromConjugateAxes(
  kernel: Kernel,
  center: Point3,
  A: Vec3,
  B: Vec3,
  range: readonly [number, number],
): Result<CircleCurve | EllipseCurve> {
  const aa = dot3(A, A);
  const bb = dot3(B, B);
  const ab = dot3(A, B);
  const n = cross3(A, B);
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  if (!(length3(n) > sinTol * Math.sqrt(aa) * Math.sqrt(bb)) || !Number.isFinite(aa + bb)) {
    return err({ kind: 'degenerate', operation: OP });
  }
  const scale = aa + bb;
  if (Math.abs(aa - bb) <= ROUNDING_SLACK * scale && Math.abs(ab) <= ROUNDING_SLACK * scale) {
    const r = (Math.sqrt(aa) + Math.sqrt(bb)) / 2;
    return createCircleCurve(kernel, center, n, A, r, range);
  }
  const t0 = Math.atan2(2 * ab, aa - bb) / 2;
  const c0 = Math.cos(t0);
  const s0 = Math.sin(t0);
  const U = add3(scale3(A, c0), scale3(B, s0));
  const V = add3(scale3(A, -s0), scale3(B, c0));
  const a = length3(U);
  const b = length3(V);
  const shifted = [range[0] - t0, range[1] - t0] as const;
  // a >= b by the choice of t0 (the maximum of |cos t A + sin t B|²); guard against rounding.
  return createEllipseCurve(kernel, center, n, U, Math.max(a, b), Math.min(a, b), shifted);
}

/** The image of `curve` under the affine map `f` (see the module comment for each kind). */
export function transformCurve3(kernel: Kernel, curve: Curve3, f: Transform): Result<Curve3> {
  switch (curve.kind) {
    case 'line': {
      const d = applyVector(f, curve.direction);
      if (d.x === 0 && d.y === 0 && d.z === 0) return err({ kind: 'degenerate', operation: OP });
      return createLineCurve(applyPoint(f, curve.origin), d, curve.range);
    }
    case 'circle':
    case 'ellipse': {
      const [a, b] = conicRadii(curve);
      const A = applyVector(f, scale3(curve.frame.xAxis, a));
      const B = applyVector(f, scale3(curve.frame.yAxis, b));
      return conicFromConjugateAxes(kernel, applyPoint(f, curve.center), A, B, curve.range);
    }
    case 'nurbs': {
      const c = curve.curve;
      const pts = c.controlPoints.map((q) => {
        const p = applyPoint(f, { x: q[0]!, y: q[1]!, z: q[2]! });
        return [p.x, p.y, p.z];
      });
      const r = createNurbsCurve(c.degree, c.knots, pts, c.weights);
      if (!r.ok) return r;
      return createNurbsCurve3(r.value);
    }
  }
}
