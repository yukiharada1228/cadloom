/**
 * Mass properties of polyhedral B-reps (planar faces, line edges) by the divergence theorem.
 *
 * Upstream consulted (for the quantities and their conventions, not translated):
 * `solidcore/crates/solidcore/src/mass.rs`, `mass/integrator.rs` (`SmObjProps`: volume, area, centroid via
 * integration over faces), `mass/loop_area.rs` (signed loop areas; inner loops subtract),
 * `mass/enclosure.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT. Upstream integrates curved faces with
 * Gauss quadrature; for planar faces the fan-triangle sums below are exact in exact arithmetic.
 *
 * Model: each loop `q_0 .. q_{n-1}` is fan-triangulated as `(q_0, q_i, q_{i+1})`, `i = 1 .. n-2`, and
 * `V = (1/6) sum det(a - r, b - r, c - r)` over all triangles, for a reference point `r` (the bounding-box
 * centre, to limit cancellation; coordinates are also divided by a power of two to avoid overflow). For a closed surface the sum does not depend on `r`; the exact-rational
 * statements are proved in `formal/CadloomFormal/Mass.lean` (`fanDet`, `boxVolume_eq`).
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, isFinite3, normalize3, scale3, sub3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { faceNormal, loopVertices, type Brep } from '../topology/brep.ts';
import { fanVectorArea2 } from '../topology/polyhedron.ts';
import { validateBrep } from '../topology/validate.ts';

export type Triangle = readonly [Point3, Point3, Point3];

export interface BoundingBox { readonly min: Point3; readonly max: Point3 }

export interface MassProperties {
  readonly volume: number;
  readonly area: number;
  readonly centroid: Point3;
  readonly bbox: BoundingBox;
}

/** `det(a, b, c) = a . (b x c)`, six times the signed volume of the tetrahedron `(0, a, b, c)`. */
export const det3 = (a: Vec3, b: Vec3, c: Vec3): number => dot3(a, cross3(b, c));

/**
 * Signed volume enclosed by a closed, consistently oriented triangle mesh:
 * `(1/6) sum det(a - r, b - r, c - r)` (positive for counter-clockwise triangles seen from outside).
 */
export function signedVolume(triangles: readonly Triangle[], reference: Point3 = vec3(0, 0, 0)): number {
  let sum = 0;
  for (const [a, b, c] of triangles) sum += det3(sub3(a, reference), sub3(b, reference), sub3(c, reference));
  return sum / 6;
}

/** Fan triangles `(q_0, q_i, q_{i+1})` of a polygon, in order. */
export function fanTriangles(points: readonly Point3[]): readonly Triangle[] {
  const out: Triangle[] = [];
  const q0 = points[0];
  if (q0 === undefined) return out;
  for (let i = 1; i + 1 < points.length; i++) out.push([q0, points[i]!, points[i + 1]!]);
  return out;
}

const OP = 'mass.polyhedronMass';

export function boundingBox(points: readonly Point3[]): BoundingBox | undefined {
  if (points.length === 0) return undefined;
  let lo = points[0]!, hi = points[0]!;
  for (const p of points) {
    lo = vec3(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z));
    hi = vec3(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z));
  }
  return Object.freeze({ min: Object.freeze(lo), max: Object.freeze(hi) });
}

/**
 * Local frame of a point set: its bounding-box centre `r` and a power-of-two scale `s` (at least the largest
 * half-extent), so that `(p - r) / s` lies in `[-1, 1]^3`. Products of local coordinates cannot overflow, and
 * scaling by a power of two is exact.
 */
function localFrame(bbox: BoundingBox): { readonly r: Point3; readonly s: number } {
  const r = add3(scale3(bbox.min, 0.5), scale3(bbox.max, 0.5));
  const half = Math.max(bbox.max.x - r.x, bbox.max.y - r.y, bbox.max.z - r.z, r.x - bbox.min.x, r.y - bbox.min.y, r.z - bbox.min.z);
  const s = half > 0 && Number.isFinite(half) ? 2 ** Math.ceil(Math.log2(half)) : 1;
  return { r, s };
}

/**
 * The fan triangles of every loop of every face, in face, loop, fan order, after checking that the B-rep is
 * structurally valid, its points finite, its edges lines, its faces planes containing their loops (within
 * `zoneTol3d`), and that about each face's outward normal the outer loop winds counter-clockwise (positive
 * area) and every inner loop clockwise (negative area). `area` is the total face area.
 */
export function polyhedronTriangles(kernel: Kernel, brep: Brep): Result<{ readonly triangles: readonly Triangle[]; readonly area: number }> {
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;
  if (!brep.vertices.every((v) => isFinite3(v.point))) return invalidInput(OP, 'non-finite vertex');
  if (!brep.edges.every((e) => e.curve.kind === 'line')) return invalidInput(OP, 'unsupported edge curve (lines only)');
  const bbox = boundingBox(brep.vertices.map((v) => v.point));
  if (bbox === undefined) return err({ kind: 'degenerate', operation: OP });
  const { r, s } = localFrame(bbox);
  const local = (p: Point3): Point3 => scale3(sub3(p, r), 1 / s);
  const tol = kernel.tolerances.zoneTol3d;
  const triangles: Triangle[] = [];
  let localArea2 = 0;
  for (const [fi, face] of brep.faces.entries()) {
    if (face.surface.kind !== 'plane') return invalidInput(OP, `face ${fi}: unsupported surface (planes only)`);
    const n = normalize3(face.surface.normal);
    const outward = normalize3(faceNormal(face));
    if (n === undefined || outward === undefined || !isFinite3(face.surface.origin)) {
      return err({ kind: 'degenerate', operation: OP, entity: { kind: 'face', id: fi } });
    }
    for (const [li, l] of face.loops.entries()) {
      const vs = loopVertices(brep, l);
      if (!vs.ok) return vs;
      const ps = vs.value.map((v) => brep.vertices[v]!.point);
      if (!ps.every((p) => Math.abs(dot3(sub3(p, face.surface.origin), n)) <= tol)) {
        return invalidInput(OP, `face ${fi}: loop ${l} does not lie on the face plane`);
      }
      const a2 = dot3(fanVectorArea2(ps.map(local)), outward);
      if (li === 0 ? !(a2 > 0) : !(a2 < 0)) {
        return err({
          kind: 'invalid-topology',
          operation: OP,
          reason: li === 0
            ? `outer loop ${l} does not wind counter-clockwise about the outward normal`
            : `inner loop ${l} does not wind clockwise about the outward normal`,
          entity: { kind: 'face', id: fi },
        });
      }
      localArea2 += a2;
      triangles.push(...fanTriangles(ps));
    }
  }
  return ok(Object.freeze({ triangles: Object.freeze(triangles), area: (localArea2 / 2) * s * s }));
}

/**
 * Volume, surface area, centroid and bounding box of a closed polyhedral B-rep. Sums run in the local frame
 * of the bounding box (centre, power-of-two scale) and are scaled back. Fails as `polyhedronTriangles` does,
 * with `degenerate` when the enclosed volume is not positive, and with `invalid-input` when a result is not
 * representable as a finite double.
 */
export function polyhedronMass(kernel: Kernel, brep: Brep): Result<MassProperties> {
  const tri = polyhedronTriangles(kernel, brep);
  if (!tri.ok) return tri;
  const bbox = boundingBox(brep.vertices.map((v) => v.point))!;
  const { r, s } = localFrame(bbox);
  let d = 0;
  let moment = vec3(0, 0, 0);
  for (const [a, b, c] of tri.value.triangles) {
    const a1 = scale3(sub3(a, r), 1 / s), b1 = scale3(sub3(b, r), 1 / s), c1 = scale3(sub3(c, r), 1 / s);
    const dt = det3(a1, b1, c1);
    d += dt;
    moment = add3(moment, scale3(add3(add3(a1, b1), c1), dt));
  }
  if (!(d > 0)) return err({ kind: 'degenerate', operation: OP, entity: { kind: 'body', id: 0 } });
  const volume = (d / 6) * s * s * s;
  const centroid = Object.freeze(add3(r, scale3(moment, s / (4 * d))));
  const area = tri.value.area;
  if (!Number.isFinite(volume) || !Number.isFinite(area) || !isFinite3(centroid) || !(volume > 0)) {
    return invalidInput(OP, 'mass properties are not representable as finite positive doubles');
  }
  return ok(Object.freeze({ volume, area, centroid, bbox }));
}
