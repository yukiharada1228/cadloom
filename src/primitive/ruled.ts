/**
 * The one builder of the solids bounded by a ruled surface of revolution between two parallel circles: the
 * cylinder (`makeCylinder`) and the cone or frustum (`makeCone`), each end either a planar disc or an apex.
 *
 * Layout (ids in creation order; mirrored by `formal/CadloomFormal/Primitive.lean`, `cylinderModel`,
 * `coneApexTopModel`, `coneApexBottomModel`): in the placement's frame `(X, Y, Z)` with `v` the height along `Z`,
 * - vertices: `v0` the bottom point `(r1, 0, 0)` (the apex `(0, 0, 0)` when `r1 = 0`), `v1` the top point
 *   `(r2, 0, h)` (the apex `(0, 0, h)` when `r2 = 0`);
 * - edges: the bottom circle `(v0, v0)` when `r1 > 0`, the top circle `(v1, v1)` when `r2 > 0`, then the seam
 *   segment `v0 -> v1` (the line `u = 0` of the lateral surface);
 * - faces: the bottom disc (the plane `z = 0` with normal `Z`, reversed: outward is `-Z`) when `r1 > 0`, the top
 *   disc (the plane `z = h`) when `r2 > 0`, then the lateral face, each with one loop;
 * - the lateral loop, counter-clockwise in `(u, v)` (material on the left, outward normal `S_u × S_v`): bottom
 *   circle forward on `v = 0` (`u: 0 -> 2π`), seam forward on `u = 2π`, top circle reversed on `v = h`
 *   (`u: 2π -> 0`), seam reversed on `u = 0`. At an apex the circle is absent: the two seam pcurves end at
 *   `(2π, h)` and `(0, h)` (or start at `(0, 0)`, `(2π, 0)`), and the straight `(u, v)` segment between them is
 *   the apex line `R(v) = 0` of the cone, which the surface collapses to the apex vertex (a pole gap, accepted by
 *   `validateBrepGeometry` and fanned by the display mesher; see `uvGapCollapses`).
 *
 * The disc pcurves are the exact `planePcurve`s of the circles; the lateral pcurves are straight segments, exact
 * for both the cylinder `S(u, v) = O + r e(u) + v Z` and the cone `S(u, v) = O + R(v) e(u) + v Z`.
 *
 * Upstream consulted (for the topology, not translated): `solidcore/crates/solidcore/src/primitive/api_primitives.rs`
 * (`create_cylinder`, `create_cone`: base circle at the origin, top circle at `height` along Z; a cylinder and a
 * frustum have 3 faces, 3 edges, 2 vertices), `primitive/primitive_creation/p1/primitives.rs` (`create_cylinder`,
 * `create_cone`), `primitive/primitive_creation/p2/rotational.rs` (solids of revolution, seams at the profile) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createCircleCurve, createSegmentCurve, TWO_PI, type CircleCurve } from '../curve/types.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { createPlaneSurface, type ConeSurface, type CylinderSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep, type CoedgeUse, type EdgeId, type ShellId } from '../topology/brep.ts';
import { planePcurve, uvSegment } from '../topology/geometry.ts';
import { placedPoint, type PlacedFrame } from './placement.ts';

/** One end of the solid: a disc of `radius > 0` at height `z`, or an apex (`radius === 0`). */
interface End {
  readonly z: number;
  readonly radius: number;
}

/** The circle of an end disc and its planar cap face's surface and pcurve. */
interface Cap {
  readonly circle: CircleCurve;
  readonly add: (b: BrepBuilder, shell: ShellId, edge: EdgeId) => void;
}

function cap(kernel: Kernel, f: PlacedFrame, end: End, bottom: boolean): Result<Cap> {
  const { normal: Z, xAxis: X } = f.frame;
  const center = placedPoint(f, 0, 0, end.z);
  const circle = createCircleCurve(kernel, center, Z, X, end.radius);
  if (!circle.ok) return circle;
  const plane = createPlaneSurface(kernel, center, Z, X);
  if (!plane.ok) return plane;
  // The bottom disc faces -Z: its face is reversed and its loop runs the circle backwards (clockwise about Z).
  const pc = planePcurve(kernel, plane.value, { curve: circle.value, t0: 0, t1: TWO_PI }, bottom);
  if (!pc.ok) return pc;
  return ok({
    circle: circle.value,
    add: (b, shell, edge) => {
      b.addLoop(b.addFace(shell, plane.value, bottom), [{ edge, reversed: bottom, pcurve: pc.value }]);
    },
  });
}

/**
 * The solid between the end at `z = 0` (radius `r1`) and the end at `z = h` (radius `r2`) of the lateral surface
 * `lateral` (a cylinder when `r1 = r2`, else a cone), at most one radius 0. The lateral pcurves run from `v = 0`
 * to `v = vTop` (default `h`; at a top apex the surface's own apex parameter, which differs from `h` only by
 * rounding). Arguments are checked by the callers; the constructors' errors (overflow) are returned.
 */
export function buildRuledSolid(
  kernel: Kernel,
  f: PlacedFrame,
  r1: number,
  h: number,
  r2: number,
  lateral: CylinderSurface | ConeSurface,
  vTop: number = h,
): Result<Brep> {
  const bottom: End = { z: 0, radius: r1 };
  const top: End = { z: h, radius: r2 };
  const p0 = placedPoint(f, r1, 0, 0);
  const p1 = placedPoint(f, r2, 0, h);
  const seamCurve = createSegmentCurve(p0, p1);
  if (!seamCurve.ok) return seamCurve;
  const bottomCap = r1 > 0 ? cap(kernel, f, bottom, true) : undefined;
  const topCap = r2 > 0 ? cap(kernel, f, top, false) : undefined;
  if (bottomCap !== undefined && !bottomCap.ok) return bottomCap;
  if (topCap !== undefined && !topCap.ok) return topCap;

  const seg: NurbsCurve[] = [];
  for (const [u0, v0, u1, v1] of [[0, 0, TWO_PI, 0], [TWO_PI, 0, TWO_PI, vTop], [TWO_PI, vTop, 0, vTop], [0, vTop, 0, 0]] as const) {
    const c = uvSegment(u0, v0, u1, v1);
    if (!c.ok) return c;
    seg.push(c.value);
  }

  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v0 = b.addVertex(p0);
  const v1 = b.addVertex(p1);
  const eBottom = bottomCap === undefined ? undefined : b.addEdge(v0, v0, bottomCap.value.circle);
  const eTop = topCap === undefined ? undefined : b.addEdge(v1, v1, topCap.value.circle);
  const eSeam = b.addEdge(v0, v1, seamCurve.value, 0, 1);
  if (bottomCap !== undefined && eBottom !== undefined) bottomCap.value.add(b, shell, eBottom);
  if (topCap !== undefined && eTop !== undefined) topCap.value.add(b, shell, eTop);
  const side: CoedgeUse[] = [];
  if (eBottom !== undefined) side.push({ edge: eBottom, reversed: false, pcurve: seg[0]! });
  side.push({ edge: eSeam, reversed: false, pcurve: seg[1]! });
  if (eTop !== undefined) side.push({ edge: eTop, reversed: true, pcurve: seg[2]! });
  side.push({ edge: eSeam, reversed: true, pcurve: seg[3]! });
  b.addLoop(b.addFace(shell, lateral), side);
  return ok(b.build());
}
