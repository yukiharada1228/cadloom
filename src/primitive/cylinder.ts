/**
 * Solid cylinder primitive.
 *
 * Upstream consulted (for API shape and argument checks, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`create_cylinder`: radius and height finite and
 * above `SM_EFF_ZERO`; base circle at the origin, height along Z; 3 faces, 3 edges, 2 vertices),
 * `primitive/primitive_creation/p1/primitives.rs` (`create_cylinder`) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import type { Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createCylinderSurface } from '../surface/types.ts';
import type { Brep } from '../topology/brep.ts';
import { checkLength, placedFrame, type Placement } from './placement.ts';
import { buildRuledSolid } from './ruled.ts';

const OP = 'primitive.makeCylinder';

/**
 * The solid cylinder of `radius` from the disc at the placement's origin to the disc `height` along its axis.
 * Topology (`buildRuledSolid`, the M2 fixture and Lean `cylinderLoops`): vertices `(r, 0, 0)` and `(r, 0, h)`;
 * edges bottom circle, top circle, seam; faces bottom disc (reversed plane), top disc, side (cylinder surface
 * `S(u, v) = O + r e(u) + v Z`) whose loop uses the seam twice, with pcurves on `u = 2π` and `u = 0`.
 * Fails with `invalid-input` unless `radius` and `height` are finite and above `zoneTol3d` and the placement is
 * valid; overflowing geometry fails in the curve and surface constructors.
 */
export function makeCylinder(kernel: Kernel, place: Placement, radius: number, height: number): Result<Brep> {
  const r = checkLength(kernel, OP, 'radius', radius);
  if (!r.ok) return r;
  const h = checkLength(kernel, OP, 'height', height);
  if (!h.ok) return h;
  const f = placedFrame(kernel, OP, place);
  if (!f.ok) return f;
  const side = createCylinderSurface(kernel, f.value.origin, f.value.frame.normal, f.value.frame.xAxis, radius);
  if (!side.ok) return side;
  return buildRuledSolid(kernel, f.value, radius, height, radius, side.value);
}

