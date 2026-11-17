/**
 * Axis-aligned box primitive.
 *
 * Upstream consulted (for API shape and argument checks, not translated):
 * `solidcore/crates/solidcore/src/primitive/api_primitives.rs` (`create_box`: lower corner at `origin`,
 * sizes along X, Y, Z, each finite and positive), `primitive/primitive_creation.rs` (`create_box`) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 *
 * The vertex and face tables below are mirrored exactly by `formal/CadloomFormal/Topology.lean`
 * (`boxFaces`) and `formal/CadloomFormal/Mass.lean` (`boxPt`, `boxFaces`).
 */
import { invalidInput, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { isFinite3, vec3, type Point3 } from '../math/vec.ts';
import type { Brep } from '../topology/brep.ts';
import { buildPolyhedron } from '../topology/polyhedron.ts';

const OP = 'primitive.makeBox';

/** Corner `i` is `origin + (dx * bit0(i), dy * bit1(i), dz * bit2(i))`. */
export function boxCorner(origin: Point3, dx: number, dy: number, dz: number, i: number): Point3 {
  return vec3(origin.x + (i & 1 ? dx : 0), origin.y + (i & 2 ? dy : 0), origin.z + (i & 4 ? dz : 0));
}

/**
 * Faces of the box as corner-index cycles, counter-clockwise viewed from outside:
 * bottom (-z), top (+z), front (-y), back (+y), left (-x), right (+x).
 */
export const BOX_FACES: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([0, 2, 3, 1]),
  Object.freeze([4, 5, 7, 6]),
  Object.freeze([0, 1, 5, 4]),
  Object.freeze([2, 6, 7, 3]),
  Object.freeze([0, 4, 6, 2]),
  Object.freeze([1, 3, 7, 5]),
]);

/**
 * The solid box `[ox, ox + dx] x [oy, oy + dy] x [oz, oz + dz]`: 8 vertices, 12 line edges, 6 planar faces
 * with outward normals. Fails with `invalid-input` unless every size is finite and greater than the zone
 * tolerance and the corners are finite.
 */
export function makeBox(kernel: Kernel, origin: Point3, dx: number, dy: number, dz: number): Result<Brep> {
  const tol = kernel.tolerances.zoneTol3d;
  for (const [name, d] of [['dx', dx], ['dy', dy], ['dz', dz]] as const) {
    if (!Number.isFinite(d) || !(d > tol)) return invalidInput(OP, `${name} must be finite and positive (above the zone tolerance)`);
  }
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => boxCorner(origin, dx, dy, dz, i));
  if (!corners.every(isFinite3)) return invalidInput(OP, 'box corners are not finite');
  return buildPolyhedron(kernel, corners, BOX_FACES);
}
