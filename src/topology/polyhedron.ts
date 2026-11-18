/**
 * Planar polyhedra from indexed faces: points plus faces given as vertex-index cycles, assembled into a
 * validated single-body, single-shell arena B-rep with line edges (segment curves, `t in [0, 1]`), plane
 * surfaces with frames (`u` along the face's first side) and exact linear pcurves on every coedge.
 *
 * Upstream consulted (for API shape, not translated): `solidcore/crates/solidcore/src/topology/brep_constructor.rs`
 * (building a B-rep from index-linked records), `primitive/primitive_creation.rs` (planar faces of a box),
 * `eval/pcurve.rs` (exact pcurves on planes) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, isFinite3, normalize3, scale3, sub3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { createSegmentCurve } from '../curve/types.ts';
import { createPlaneSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep, type CoedgeUse, type Edge, type EdgeId, type VertexId } from './brep.ts';
import { planePcurve, validateBrepGeometry } from './geometry.ts';

const OP = 'topology.buildPolyhedron';

/**
 * Twice the vector area of a closed polygon, by fan triangulation from its first point:
 * `sum_{i=1}^{n-2} (p_i - p_0) x (p_{i+1} - p_0)`. Its direction is the counter-clockwise normal.
 */
export function fanVectorArea2(points: readonly Point3[]): Vec3 {
  const p0 = points[0];
  if (p0 === undefined) return vec3(0, 0, 0);
  let acc = vec3(0, 0, 0);
  for (let i = 1; i + 1 < points.length; i++) {
    acc = add3(acc, cross3(sub3(points[i]!, p0), sub3(points[i + 1]!, p0)));
  }
  return acc;
}

/**
 * Builds a closed polyhedron. Each face is one loop of point indices, counter-clockwise viewed from outside;
 * its plane passes through the loop's first point with the loop's unit fan normal. Fails with
 * `invalid-input` for bad indices or non-finite points, `degenerate` for a zero-area face,
 * `invalid-input` for a face whose points are farther than `zoneTol3d` from its plane, and with the
 * `validateBrepGeometry` (hence `validateBrep`) error when the faces do not close a consistently oriented
 * 2-manifold.
 */
export function buildPolyhedron(kernel: Kernel, points: readonly Point3[], faces: readonly (readonly number[])[]): Result<Brep> {
  if (!points.every(isFinite3)) return invalidInput(OP, 'non-finite point');
  const b = new BrepBuilder();
  const body = b.addBody();
  const shell = b.addShell(body);
  const vs: VertexId[] = points.map((p) => b.addVertex(p));
  const edgeOf = new Map<string, { readonly edge: EdgeId; readonly start: number; readonly geometry: Edge }>();
  const tol = kernel.tolerances.zoneTol3d;
  for (const [fi, face] of faces.entries()) {
    if (face.length < 3) return invalidInput(OP, `face ${fi} has fewer than 3 vertices`);
    if (!face.every((i) => Number.isInteger(i) && i >= 0 && i < points.length)) return invalidInput(OP, `face ${fi} has a bad index`);
    if (new Set(face).size !== face.length) return invalidInput(OP, `face ${fi} repeats a vertex`);
    const ps = face.map((i) => points[i]!);
    const origin = ps[0]!;
    // The normal is computed from differences scaled by a power of two into [-1, 1], so cross products
    // cannot overflow for large faces (scaling does not change the direction).
    const ds = ps.map((p) => sub3(p, origin));
    const extent = Math.max(...ds.map((d) => Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z))));
    if (!Number.isFinite(extent)) return invalidInput(OP, `face ${fi} is too large`);
    const sc = extent > 0 ? 2 ** Math.ceil(Math.log2(extent)) : 1;
    const normal = normalize3(fanVectorArea2(ds.map((d) => scale3(d, 1 / sc))));
    if (normal === undefined) return err({ kind: 'degenerate', operation: OP, entity: { kind: 'face', id: fi } });
    if (!ps.every((p) => Math.abs(dot3(sub3(p, origin), normal)) <= tol)) return invalidInput(OP, `face ${fi} is not planar`);
    const plane = createPlaneSurface(kernel, origin, normal, sub3(ps[1]!, origin));
    if (!plane.ok) return plane;
    const fid = b.addFace(shell, plane.value);
    const uses: CoedgeUse[] = [];
    for (const [k, a] of face.entries()) {
      const c = face[(k + 1) % face.length]!;
      const key = a < c ? `${a},${c}` : `${c},${a}`;
      let known = edgeOf.get(key);
      if (known === undefined) {
        const line = createSegmentCurve(points[a]!, points[c]!);
        if (!line.ok) return line;
        const geometry: Edge = { start: vs[a]!, end: vs[c]!, curve: line.value, t0: 0, t1: 1 };
        known = { edge: b.addEdge(geometry.start, geometry.end, line.value, 0, 1), start: a, geometry };
        edgeOf.set(key, known);
      }
      const reversed = known.start !== a;
      const pcurve = planePcurve(kernel, plane.value, known.geometry, reversed);
      if (!pcurve.ok) return pcurve;
      uses.push({ edge: known.edge, reversed, pcurve: pcurve.value });
    }
    b.addLoop(fid, uses);
  }
  const brep = b.build();
  const valid = validateBrepGeometry(kernel, brep);
  return valid.ok ? { ok: true, value: brep } : valid;
}
