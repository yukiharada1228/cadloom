/**
 * Solid sphere primitive, with poles.
 *
 * Upstream consulted (for API shape and topology, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`create_sphere`: a finite non-zero radius; the
 * sphere with poles is 1 face, 1 edge, 2 vertices), `primitive/primitive_creation/p1/primitives.rs`,
 * `topology/vertex.rs` (`inside_face`: a pole is a vertex all of whose edges are seams of one face),
 * `docs/booleans.md` ("Seams and poles"), `surface/sphere.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import type { Point3, Vec3 } from '../math/vec.ts';
import { createCircleCurve, TWO_PI } from '../curve/types.ts';
import { createSphereSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep } from '../topology/brep.ts';
import { checkLength, placedFrame, placedPoint, WORLD_PLACEMENT } from './placement.ts';
import { uvSegment } from '../topology/geometry.ts';

const OP = 'primitive.makeSphere';
const HALF_PI = Math.PI / 2;

/** The orientation of a sphere: its polar axis and the direction of longitude 0. */
export interface SphereAxes {
  readonly axis: Vec3;
  readonly xDirection: Vec3;
}

/**
 * The solid ball of `radius` about `center` (polar axis `axes.axis`, longitude 0 along `axes.xDirection`; default
 * `+z` and `+x`). The face is the sphere `S(u, v) = C + r (cos v e(u) + sin v Z)`, `u` the longitude, `v` the
 * latitude in `[-π/2, π/2]`, outward normal `S_u × S_v`.
 *
 * Topology (Lean `sphereModel`): vertices `v0` the south pole `C - r Z`, `v1` the north pole `C + r Z`; one edge,
 * the seam: the half meridian `u = 0` from `v0` to `v1` (a circle arc about `C` in the plane of `X` and `Z`,
 * `t in [-π/2, π/2]`); one face whose single loop uses the seam twice: forward with the pcurve `u = 2π`
 * (`(2π, -π/2) -> (2π, π/2)`), then reversed with the pcurve `u = 0` (`(0, π/2) -> (0, -π/2)`). **Poles**: there
 * is no degenerate edge (decision, as upstream): between the two pcurves the loop jumps along `v = π/2` (from
 * `u = 2π` to `0`) and `v = -π/2` (from `0` to `2π`), iso-lines the sphere collapses to the pole vertices, which
 * `validateBrepGeometry` accepts and the display mesher fans (`uvGapCollapses`). Counts `V = 2`, `E = 1`, `F = 1`,
 * `L = 1`: genus 0.
 *
 * Fails with `invalid-input` unless `radius` is finite and above `zoneTol3d`, `center` is finite and the axes are
 * valid (`createCurveFrame`); overflowing geometry fails in the constructors.
 */
export function makeSphere(kernel: Kernel, center: Point3, radius: number, axes: SphereAxes = WORLD_PLACEMENT): Result<Brep> {
  const r = checkLength(kernel, OP, 'radius', radius);
  if (!r.ok) return r;
  const f = placedFrame(kernel, OP, { origin: center, axis: axes.axis, xDirection: axes.xDirection });
  if (!f.ok) return f;
  const { origin, frame } = f.value;
  const surface = createSphereSurface(kernel, origin, frame.normal, frame.xAxis, radius);
  if (!surface.ok) return surface;
  // The meridian u = 0: C + r cos t X + r sin t Z, a circle with normal -Y (then its y axis is (-Y) × X = Z).
  const minusY = { x: -frame.yAxis.x, y: -frame.yAxis.y, z: -frame.yAxis.z };
  const meridian = createCircleCurve(kernel, origin, minusY, frame.xAxis, radius, [-HALF_PI, HALF_PI]);
  if (!meridian.ok) return meridian;
  const up = uvSegment(TWO_PI, -HALF_PI, TWO_PI, HALF_PI);
  if (!up.ok) return up;
  const down = uvSegment(0, HALF_PI, 0, -HALF_PI);
  if (!down.ok) return down;

  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const south = b.addVertex(placedPoint(f.value, 0, 0, -radius));
  const north = b.addVertex(placedPoint(f.value, 0, 0, radius));
  const seam = b.addEdge(south, north, meridian.value, -HALF_PI, HALF_PI);
  b.addLoop(b.addFace(shell, surface.value), [
    { edge: seam, reversed: false, pcurve: up.value },
    { edge: seam, reversed: true, pcurve: down.value },
  ]);
  return ok(b.build());
}
