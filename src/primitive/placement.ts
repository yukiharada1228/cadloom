/**
 * Placement of the curved primitives, and the pieces they share: the placement's frame, exact points in it,
 * straight `(u, v)` pcurves and the planar end caps.
 *
 * A placement is an origin, an axis (`Z`, any non-zero length) and a reference direction for `u = 0` (`X`,
 * projected square to the axis). Its frame is the kernel's `createCurveFrame` (`Y = Z × X`), the same frame every
 * analytic surface and circle of `src/curve` / `src/surface` is placed by, so the primitives pass `frame.normal`
 * and `frame.xAxis` on to those constructors unchanged.
 *
 * Upstream consulted (for the placement convention, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`xy_frame`: the canonical XY frame at the origin,
 * `SmAxis2Placement`), `primitive/primitive_creation/p1/primitives.rs` (primitives take an axis placement) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { isFinite3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { createCurveFrame, type CurveFrame } from '../curve/types.ts';
import { fromLocal } from '../surface/types.ts';

/** Where a primitive stands: `origin`, the axis `axis` (`v` / height direction) and `u = 0` along `xDirection`. */
export interface Placement {
  readonly origin: Point3;
  readonly axis: Vec3;
  readonly xDirection: Vec3;
}

/** The world placement: origin `(0, 0, 0)`, axis `+z`, `u = 0` along `+x`. */
export const WORLD_PLACEMENT: Placement = Object.freeze({
  origin: Object.freeze(vec3(0, 0, 0)),
  axis: Object.freeze(vec3(0, 0, 1)),
  xDirection: Object.freeze(vec3(1, 0, 0)),
});

/** A frozen placement; omitted parts are those of `WORLD_PLACEMENT`. */
export function placement(origin: Point3 = WORLD_PLACEMENT.origin, axis: Vec3 = WORLD_PLACEMENT.axis, xDirection: Vec3 = WORLD_PLACEMENT.xDirection): Placement {
  return Object.freeze({ origin: Object.freeze({ ...origin }), axis: Object.freeze({ ...axis }), xDirection: Object.freeze({ ...xDirection }) });
}

/** A placement checked against the kernel: a finite origin and the orthonormal frame of `createCurveFrame`. */
export interface PlacedFrame {
  readonly origin: Point3;
  readonly frame: CurveFrame;
}

/** The frame of a placement (`invalid-input` for a non-finite origin, and the errors of `createCurveFrame`). */
export function placedFrame(kernel: Kernel, op: string, p: Placement): Result<PlacedFrame> {
  if (!isFinite3(p.origin)) return invalidInput(op, 'placement origin is not finite');
  const frame = createCurveFrame(kernel, p.axis, p.xDirection);
  if (!frame.ok) return invalidInput(op, `placement: ${frame.error.kind === 'invalid-input' ? frame.error.reason : frame.error.kind}`);
  return ok(Object.freeze({ origin: Object.freeze(vec3(p.origin.x, p.origin.y, p.origin.z)), frame: frame.value }));
}

const noNegativeZero = (x: number): number => (x === 0 ? 0 : x);

/** `origin + a X + b Y + c Z` of a placed frame, frozen, without negative zeros (records read `-0` as `0`). */
export function placedPoint(f: PlacedFrame, a: number, b: number, c: number): Point3 {
  const p = fromLocal(f.frame, f.origin, a, b, c);
  return Object.freeze(vec3(noNegativeZero(p.x), noNegativeZero(p.y), noNegativeZero(p.z)));
}

/** Checks that a length is finite and above the zone tolerance. */
export function checkLength(kernel: Kernel, op: string, name: string, x: number): Result<number> {
  if (!Number.isFinite(x) || !(x > kernel.tolerances.zoneTol3d)) {
    return invalidInput(op, `${name} must be finite and above the zone tolerance ${kernel.tolerances.zoneTol3d}`);
  }
  return ok(x);
}
