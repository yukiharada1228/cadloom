/**
 * Display meshes of B-rep bodies: `tessellate(kernel, brep, tol)`.
 *
 * Every edge is sampled once (`sampleEdge`: the `sample.ts` rules over the edge's interval, with the first and
 * last points replaced by the edge's vertex points, so all edges at a vertex end on the same numbers). Each
 * face is meshed in its own `(u, v)` from those samples (`face.ts`). Neighbouring faces therefore share their
 * boundary points exactly, and the mesh welds into a closed, consistently oriented surface (`check.ts`,
 * Lean `union_balanced`, `patches_balanced`).
 *
 * The mesh is per face: each face has its own vertices (positions repeat across faces, with that face's
 * normals). A face or edge that cannot be meshed is reported in `stats` and left out (a face whose edge failed
 * is left out too); the rest of the body is still meshed, as upstream. `tessellate` fails only for an invalid
 * tolerance (`invalid-input`) or a structurally invalid B-rep (the `validateBrep` error).
 *
 * A display mesh is drawn, never measured: nothing a model depends on is decided from it.
 *
 * Upstream consulted (for the API shape, not translated): `solidcore/crates/solidcore-tess/src/lib.rs` (one
 * mesher; every edge sampled once so neighbouring faces share their boundary points; a face that cannot be
 * meshed is named in the stats and the rest of the body is meshed), `plan.rs` (per-face plans and ranges),
 * `mesh.rs` (`Mesh`: positions, normals, triangles, the face of each triangle, edge polylines),
 * `stats.rs` (`PlanStats`: unmeshed faces, unsampled edges, capped edges) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, ok, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import type { Point3 } from '../math/vec.ts';
import { edgeId, faceId, type Brep, type EdgeId, type FaceId } from '../topology/brep.ts';
import { validateBrep } from '../topology/validate.ts';
import { meshFace } from './face.ts';
import { curvePoints, type CurveSamples } from './sample.ts';
import { meshRules, type MeshRules, type MeshTolerance } from './tolerance.ts';

/** The triangles and vertices of one face in a `Mesh`. */
export interface FaceRange {
  readonly face: FaceId;
  /** Triangles `firstTriangle .. firstTriangle + triangleCount - 1` (indices into `indices / 3`). */
  readonly firstTriangle: number;
  readonly triangleCount: number;
  /** Vertices `firstVertex .. firstVertex + vertexCount - 1`. */
  readonly firstVertex: number;
  readonly vertexCount: number;
  /** Each loop's boundary vertices in loop order (mesh vertex indices). */
  readonly loops: readonly (readonly number[])[];
}

/** The display polyline of one edge, from its start vertex to its end vertex: flat `x, y, z` triples. */
export interface EdgePolyline {
  readonly edge: EdgeId;
  readonly points: readonly number[];
}

export interface MeshStats {
  readonly faces: number;
  readonly meshedFaces: number;
  readonly triangles: number;
  readonly vertices: number;
  /** Faces left out, with why. */
  readonly failedFaces: readonly { readonly face: FaceId; readonly error: SolidError }[];
  /** Edges that could not be sampled (no polyline), with why. */
  readonly failedEdges: readonly { readonly edge: EdgeId; readonly error: SolidError }[];
  /** Edges whose sampling a bound stopped (their chords may exceed the tolerance). */
  readonly cappedEdges: readonly EdgeId[];
  /** Faces whose grid a bound thinned. */
  readonly cappedFaces: readonly FaceId[];
}

/**
 * An indexed triangle mesh: `positions` and `normals` are flat `x, y, z` triples (one normal per position, the
 * unit outward surface normal), `indices` flat triangles, counter-clockwise seen from outside.
 */
export interface Mesh {
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly indices: readonly number[];
  readonly faceRanges: readonly FaceRange[];
  readonly edgePolylines: readonly EdgePolyline[];
  readonly stats: MeshStats;
}

/**
 * The display samples of edge `edge`: `curvePoints` over its interval, with the end points replaced by its
 * start and end vertex points (exactly).
 */
export function sampleEdge(brep: Brep, edge: EdgeId, rules: MeshRules): Result<CurveSamples> {
  const e = brep.edges[edge];
  if (e === undefined) return err({ kind: 'not-found', operation: 'tess.sampleEdge', entity: { kind: 'edge', id: edge } });
  const s = curvePoints(e.curve, [e.t0, e.t1], rules);
  if (!s.ok) return s;
  const start = brep.vertices[e.start]?.point, end = brep.vertices[e.end]?.point;
  if (start === undefined || end === undefined) {
    return err({ kind: 'invalid-topology', operation: 'tess.sampleEdge', reason: 'edge names a missing vertex', entity: { kind: 'edge', id: edge } });
  }
  if (![start, end].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) {
    return err({ kind: 'invalid-input', operation: 'tess.sampleEdge', reason: `edge ${edge}: a vertex point is not finite` });
  }
  const points: Point3[] = [...s.value.points];
  points[0] = start;
  points[points.length - 1] = end;
  return ok(Object.freeze({ ...s.value, points: Object.freeze(points) }));
}

const flat = (ps: readonly Point3[], out: number[]): void => {
  for (const p of ps) out.push(p.x, p.y, p.z);
};

/** The display mesh of `brep` at the tolerance `tol` (defaults: `defaultMeshTolerance`). See the module comment. */
export function tessellate(kernel: Kernel, brep: Brep, tol: Partial<MeshTolerance> = {}): Result<Mesh> {
  const rules = meshRules(kernel, tol);
  if (!rules.ok) return rules;
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;

  const samples = brep.edges.map((_, i) => sampleEdge(brep, edgeId(i), rules.value));
  const edgePolylines: EdgePolyline[] = [];
  const failedEdges: { edge: EdgeId; error: SolidError }[] = [];
  const cappedEdges: EdgeId[] = [];
  samples.forEach((s, i) => {
    if (!s.ok) {
      failedEdges.push(Object.freeze({ edge: edgeId(i), error: s.error }));
      return;
    }
    if (s.value.capped) cappedEdges.push(edgeId(i));
    const pts: number[] = [];
    flat(s.value.points, pts);
    edgePolylines.push(Object.freeze({ edge: edgeId(i), points: Object.freeze(pts) }));
  });

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const faceRanges: FaceRange[] = [];
  const failedFaces: { face: FaceId; error: SolidError }[] = [];
  const cappedFaces: FaceId[] = [];
  for (let i = 0; i < brep.faces.length; i++) {
    const fid = faceId(i);
    const m = meshFace(kernel, brep, fid, samples, rules.value);
    if (!m.ok) {
      failedFaces.push(Object.freeze({ face: fid, error: m.error }));
      continue;
    }
    if (m.value.capped) cappedFaces.push(fid);
    const base = positions.length / 3;
    const firstTriangle = indices.length / 3;
    flat(m.value.positions, positions);
    flat(m.value.normals, normals);
    for (const [a, b, c] of m.value.triangles) indices.push(base + a, base + b, base + c);
    faceRanges.push(
      Object.freeze({
        face: fid,
        firstTriangle,
        triangleCount: m.value.triangles.length,
        firstVertex: base,
        vertexCount: m.value.positions.length,
        loops: Object.freeze(m.value.loops.map((r) => Object.freeze(r.map((v) => base + v)))),
      }),
    );
  }
  for (const x of [...positions, ...normals]) {
    if (!Number.isFinite(x)) return err({ kind: 'invalid-input', operation: 'tess.tessellate', reason: 'mesh coordinate is not finite (overflow)' });
  }
  const stats: MeshStats = Object.freeze({
    faces: brep.faces.length,
    meshedFaces: faceRanges.length,
    triangles: indices.length / 3,
    vertices: positions.length / 3,
    failedFaces: Object.freeze(failedFaces),
    failedEdges: Object.freeze(failedEdges),
    cappedEdges: Object.freeze(cappedEdges),
    cappedFaces: Object.freeze(cappedFaces),
  });
  return ok(
    Object.freeze({
      positions: Object.freeze(positions),
      normals: Object.freeze(normals),
      indices: Object.freeze(indices),
      faceRanges: Object.freeze(faceRanges),
      edgePolylines: Object.freeze(edgePolylines),
      stats,
    }),
  );
}
