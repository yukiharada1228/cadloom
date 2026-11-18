/**
 * Solid cone and frustum primitive.
 *
 * Upstream consulted (for API shape and argument checks, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`create_cone`, `cone_dims_valid`: finite radii,
 * not negative and not both at or below `SM_EFF_ZERO`; a positive height; a frustum has 3 faces, 3 edges,
 * 2 vertices), `primitive/primitive_creation/p1/primitives.rs` (`create_cone`), `surface/cone.rs` (`SmCone`: base
 * radius at the origin and a signed semi-angle) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createConeSurface, createCylinderSurface } from '../surface/types.ts';
import type { Brep } from '../topology/brep.ts';
import { checkLength, placedFrame, type Placement } from './placement.ts';
import { buildRuledSolid } from './ruled.ts';

const OP = 'primitive.makeCone';

/**
 * The solid cone or frustum from the disc of radius `r1` at the placement's origin to the disc of radius `r2` at
 * `height` along its axis. The lateral face is the cone `S(u, v) = O + R(v) e(u) + v Z`,
 * `R(v) = r1 + tan(α) v`, `α = atan2(r2 - r1, h)` (the M1 single nappe, `v` the height).
 *
 * - A radius at or below `zoneTol3d` (upstream: `SM_EFF_ZERO`) is an **apex**: that end has no circle and no
 *   disc, the seam ends at the apex vertex on the axis, and the lateral loop jumps along the apex line between the
 *   seam's two pcurves (a pole gap, see `buildRuledSolid`). `r1 = 0`: apex at the origin; `r2 = 0`: apex on top.
 * - `r1 = r2` (both above the tolerance) is a cylinder: the lateral surface is a cylinder surface (an M1 cone needs
 *   a non-zero semi-angle), with the same topology as `makeCylinder`.
 * Fails with `invalid-input` for a negative or non-finite radius, both radii at or below `zoneTol3d`, a height not
 * finite and above `zoneTol3d`, an invalid placement, or a cone so flat (`|r2 - r1| / h` huge) that the rounded
 * semi-angle's `tan` misses `r2` at `v = h` by more than `approxTol3d`.
 */
export function makeCone(kernel: Kernel, place: Placement, r1: number, r2: number, height: number): Result<Brep> {
  for (const [name, r] of [['r1', r1], ['r2', r2]] as const) {
    if (!Number.isFinite(r) || r < 0) return invalidInput(OP, `${name} must be finite and not negative`);
  }
  const tol = kernel.tolerances.zoneTol3d;
  const a = r1 > tol ? r1 : 0, b = r2 > tol ? r2 : 0;
  if (a === 0 && b === 0) return invalidInput(OP, 'at least one radius must be above the zone tolerance');
  const h = checkLength(kernel, OP, 'height', height);
  if (!h.ok) return h;
  const f = placedFrame(kernel, OP, place);
  if (!f.ok) return f;
  const { origin, frame } = f.value;
  if (a === b) {
    const cyl = createCylinderSurface(kernel, origin, frame.normal, frame.xAxis, a);
    if (!cyl.ok) return cyl;
    return buildRuledSolid(kernel, f.value, a, height, b, cyl.value);
  }
  const semiAngle = Math.atan2(b - a, height);
  const side = createConeSurface(kernel, origin, frame.normal, frame.xAxis, a, semiAngle);
  if (!side.ok) return side;
  // The surface radius is `R(v) = a + tan(α) v` with the stored `α`: near `±π/2` (a very flat cone) `tan` of the
  // rounded angle misses `b` at `v = h` by `|b - a| · ulp / (π/2 - |α|)`, which can exceed the tolerance.
  const t = Math.tan(semiAngle);
  if (!(Math.abs(a + t * height - b) <= kernel.tolerances.approxTol3d)) {
    return invalidInput(OP, 'the cone is too flat: its semi-angle cannot reproduce the radii within the tolerance');
  }
  // An apex on top: the lateral pcurves end on the surface's own apex line `v = -a / tan(α)` (`R = 0` up to
  // rounding), not at `v = h`, where rounding may put `R(h)` past the apex (the other nappe).
  const vTop = b === 0 ? -a / t : height;
  return buildRuledSolid(kernel, f.value, a, height, b, side.value, vTop);
}
