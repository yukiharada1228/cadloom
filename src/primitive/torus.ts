/**
 * Solid (ring) torus primitive.
 *
 * Upstream consulted (for API shape and topology, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`create_torus`: 1 face, 2 edges, 1 vertex),
 * `primitive/primitive_creation/p1/primitives.rs` (`create_torus`), `surface/torus.rs` (`SmTorus`: radius checks,
 * `S = O + (R + r cos v) e(u) + r sin v Z`) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createCircleCurve, TWO_PI } from '../curve/types.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { createTorusSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep } from '../topology/brep.ts';
import { checkLength, placedFrame, placedPoint, type Placement } from './placement.ts';
import { uvSegment } from '../topology/geometry.ts';

const OP = 'primitive.makeTorus';

/**
 * The solid ring torus about the placement's axis through its origin: tube centre circle of radius `R`
 * (`majorRadius`), tube radius `r` (`minorRadius`), `R > r > zoneTol3d`. The face is the torus
 * `S(u, v) = O + (R + r cos v) e(u) + r sin v Z`, outward normal `S_u × S_v`.
 *
 * Topology (Lean `torusModel`, genus 1): one vertex `(R + r, 0, 0)`; edges `eu` the outer equator `v = 0` (the
 * circle of radius `R + r` about the axis) and `ev` the tube circle `u = 0` (radius `r` about `(R, 0, 0)` in the
 * plane of `X` and `Z`), both closed at the vertex; one face whose loop is `eu` forward on `v = 0`, `ev` forward on
 * `u = 2π`, `eu` reversed on `v = 2π`, `ev` reversed on `u = 0`: the square `[0, 2π]²`, each seam used twice.
 * Counts `V = 1`, `E = 2`, `F = 1`, `L = 1`: `V - E + F - (L - F) = 0 = 2 (1 - G)`, `G = 1`.
 *
 * Fails with `invalid-input` unless both radii are finite and above `zoneTol3d` with `R > r` (horn and spindle
 * tori self-intersect, as M1 `createTorusSurface`), and the placement is valid.
 */
export function makeTorus(kernel: Kernel, place: Placement, majorRadius: number, minorRadius: number): Result<Brep> {
  const R = checkLength(kernel, OP, 'majorRadius', majorRadius);
  if (!R.ok) return R;
  const r = checkLength(kernel, OP, 'minorRadius', minorRadius);
  if (!r.ok) return r;
  if (!(majorRadius > minorRadius)) return invalidInput(OP, 'need majorRadius > minorRadius (a ring torus)');
  const f = placedFrame(kernel, OP, place);
  if (!f.ok) return f;
  const { origin, frame } = f.value;
  const surface = createTorusSurface(kernel, origin, frame.normal, frame.xAxis, majorRadius, minorRadius);
  if (!surface.ok) return surface;
  const outer = createCircleCurve(kernel, origin, frame.normal, frame.xAxis, majorRadius + minorRadius);
  if (!outer.ok) return outer;
  // S(0, v) = O + (R + r cos v) X + r sin v Z: about O + R X with normal -Y (y axis (-Y) × X = Z).
  const minusY = { x: -frame.yAxis.x, y: -frame.yAxis.y, z: -frame.yAxis.z };
  const tube = createCircleCurve(kernel, placedPoint(f.value, majorRadius, 0, 0), minusY, frame.xAxis, minorRadius);
  if (!tube.ok) return tube;
  const seg: NurbsCurve[] = [];
  for (const [u0, v0, u1, v1] of [[0, 0, TWO_PI, 0], [TWO_PI, 0, TWO_PI, TWO_PI], [TWO_PI, TWO_PI, 0, TWO_PI], [0, TWO_PI, 0, 0]] as const) {
    const c = uvSegment(u0, v0, u1, v1);
    if (!c.ok) return c;
    seg.push(c.value);
  }

  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v = b.addVertex(placedPoint(f.value, majorRadius + minorRadius, 0, 0));
  const eu = b.addEdge(v, v, outer.value);
  const ev = b.addEdge(v, v, tube.value);
  b.addLoop(b.addFace(shell, surface.value), [
    { edge: eu, reversed: false, pcurve: seg[0]! },
    { edge: ev, reversed: false, pcurve: seg[1]! },
    { edge: eu, reversed: true, pcurve: seg[2]! },
    { edge: ev, reversed: true, pcurve: seg[3]! },
  ]);
  return ok(b.build());
}
