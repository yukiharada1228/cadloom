/**
 * Affine transforms of `Surface3` (an M0 `Transform` `p ↦ L p + t`).
 *
 * - nurbs: control points mapped by `applyPoint`, weights and knots kept (affine invariance of
 *   NURBS; any affine map, also non-uniform, as `transformCurve3` does for curves).
 * - plane: the image of a plane under any affine map whose `L X`, `L Y` are not parallel (within
 *   `angTolDeg`) is the plane through `f(origin)` with normal `L X × L Y` and `xAxis` along
 *   `L X`. The point set is exact; the parametrisation is kept only for a similarity of ratio `λ`
 *   (`f(S(u, v)) = S'(λ u, λ v)`), since a plane's frame is orthonormal.
 * - cylinder, cone, sphere, torus: `L` must be a similarity, `LᵀL = λ² I` within
 *   `ROUNDING_SLACK` (1e-12) relative to `λ²` (rotations, reflections, uniform scaling, with any
 *   translation); otherwise `invalid-input` (the image of a cylinder under a non-uniform scaling
 *   is an elliptic cylinder, not representable by this kind; convert to NURBS first). The new
 *   frame is `x' = L X / λ`, `y' = L Y / λ`, `normal' = x' × y'`; radii are multiplied by `λ`.
 *   With `σ = sign det L`, `L Z = σ λ normal'`, so the parametrisation maps as
 *   cylinder / cone: `f(S(u, v)) = S'(u, σ λ v)` (a cone's semi-angle becomes `σ α`);
 *   sphere / torus: `f(S(u, v)) = S'(u, σ v)`. For a proper map (`σ = 1`) and `λ = 1` the
 *   parametrisation is kept exactly; the outward normal stays outward in every case.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/surface/cone/p1.rs (Cone::transform), surface/sphere.rs,
 *   surface/torus.rs, surface/plane/p1.rs (transform), geom/transform.rs.
 *   Rewritten for cadloom; not a translation.
 */
import { err, invalidInput, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { applyPoint, applyVector, type Transform } from '../math/transform.ts';
import { cross3, dot3, length3, vec3, type Vec3 } from '../math/vec.ts';
import { ROUNDING_SLACK } from '../curve/types.ts';
import { createNurbsSurface } from '../nurbs/surface.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  surfaceOrigin,
  type Surface3,
} from './types.ts';

const OP = 'surface.transformSurface3';

/** `λ` and `σ = ±1` when the images `a, b, c` of an orthonormal frame are a scaled orthonormal frame. */
function similarity(a: Vec3, b: Vec3, c: Vec3): { lambda: number; sigma: 1 | -1 } | undefined {
  const aa = dot3(a, a), bb = dot3(b, b), cc = dot3(c, c);
  const l2 = (aa + bb + cc) / 3;
  if (!(l2 > 0) || !Number.isFinite(l2)) return undefined;
  const tol = ROUNDING_SLACK * l2;
  const close = [aa - l2, bb - l2, cc - l2, dot3(a, b), dot3(a, c), dot3(b, c)].every((x) => Math.abs(x) <= tol);
  if (!close) return undefined;
  const triple = dot3(cross3(a, b), c);
  return { lambda: Math.sqrt(l2), sigma: triple > 0 ? 1 : -1 };
}

/** The image of `s` under `f` (see the module comment for each kind and the parameter map). */
export function transformSurface3(kernel: Kernel, s: Surface3, f: Transform): Result<Surface3> {
  if (s.kind === 'nurbs') {
    const srf = s.surface;
    const net = srf.controlPoints.map((row) =>
      row.map((q) => {
        const p = applyPoint(f, vec3(q[0]!, q[1]!, q[2]!));
        return [p.x, p.y, p.z];
      }),
    );
    const r = createNurbsSurface(srf.degreeU, srf.degreeV, srf.knotsU, srf.knotsV, net, srf.weights);
    if (!r.ok) return r;
    return createNurbsSurface3(r.value);
  }
  const { xAxis: X, yAxis: Y, normal: Z } = s.frame;
  const a = applyVector(f, X), b = applyVector(f, Y), c = applyVector(f, Z);
  const o = applyPoint(f, surfaceOrigin(s));
  if (s.kind === 'plane') {
    const n = cross3(a, b);
    if (!(length3(n) > 0)) return err({ kind: 'degenerate', operation: OP });
    // Parallel images are reported by the frame construction (angular tolerance).
    return createPlaneSurface(kernel, o, n, a);
  }
  const scale2 = (dot3(a, a) + dot3(b, b) + dot3(c, c)) / 3;
  if (!(scale2 > 0) || !Number.isFinite(scale2)) {
    return invalidInput(OP, 'the linear part is singular or its scale is out of the representable range');
  }
  const sim = similarity(a, b, c);
  if (sim === undefined) return invalidInput(OP, 'only similarities (rigid motions, reflections, uniform scaling) map this surface kind to itself');
  const { lambda, sigma } = sim;
  const axis = cross3(a, b); // = λ² (x' × y') = σ λ L Z: the right-handed normal of (L X, L Y)
  switch (s.kind) {
    case 'cylinder':
      return createCylinderSurface(kernel, o, axis, a, lambda * s.radius);
    case 'cone':
      return createConeSurface(kernel, o, axis, a, lambda * s.baseRadius, sigma * s.semiAngle);
    case 'sphere':
      return createSphereSurface(kernel, o, axis, a, lambda * s.radius);
    case 'torus':
      return createTorusSurface(kernel, o, axis, a, lambda * s.majorRadius, lambda * s.minorRadius);
  }
}
