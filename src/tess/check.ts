/**
 * Checks of a display mesh: welding by exact position, directed edge use counts, watertightness, consistent
 * orientation, and the enclosed signed volume (by the M0 `signedVolume`, not reimplemented here).
 *
 * Model: `formal/CadloomFormal/Tess.lean`. `meshEdgeUseCounts` is Lean `dcount` on the welded triangles,
 * reported per undirected edge in both directions; `isWatertight` is the conclusion of
 * `watertight_of_balanced` (every used edge exactly once each way); `isConsistentlyOriented` is the
 * hypothesis `dcount T e ≤ 1` (no directed edge used twice).
 *
 * Upstream consulted (attribution): `solidcore/crates/solidcore-tess/src/plan.rs` (`welded`: faces joined at
 * shared vertices), `crates/solidcore-tess/src/mesher/mesh_tests.rs` (watertightness by edge use counts) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { boundingBox, signedVolume, type Triangle } from '../mass/polyhedron.ts';
import { vec3, type Point3 } from '../math/vec.ts';
import type { Mesh } from './mesh.ts';

/** One undirected edge `a < b` of the welded mesh with its uses `a → b` (`forward`) and `b → a` (`backward`). */
export interface EdgeUse {
  readonly a: number;
  readonly b: number;
  readonly forward: number;
  readonly backward: number;
}

type MeshData = Pick<Mesh, 'positions' | 'indices'>;

/**
 * The welded id of every vertex: the index of the first vertex with exactly the same position (`-0` and `0`
 * equal). The mesher shares boundary points by value, so welding needs no tolerance.
 */
export function weldVertices(mesh: MeshData): readonly number[] {
  const n = mesh.positions.length / 3;
  const first = new Map<string, number>();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = `${mesh.positions[3 * i]! + 0},${mesh.positions[3 * i + 1]! + 0},${mesh.positions[3 * i + 2]! + 0}`;
    const w = first.get(key);
    if (w === undefined) {
      first.set(key, i);
      out.push(i);
    } else out.push(w);
  }
  return Object.freeze(out);
}

/** The triangles in welded vertex ids. */
export function weldedTriangles(mesh: MeshData): readonly (readonly [number, number, number])[] {
  const w = weldVertices(mesh);
  const out: (readonly [number, number, number])[] = [];
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
    out.push([w[mesh.indices[t]!]!, w[mesh.indices[t + 1]!]!, w[mesh.indices[t + 2]!]!]);
  }
  return Object.freeze(out);
}

/**
 * Every undirected edge of the welded triangles with its use count in each direction, sorted by `(a, b)`.
 * A side of zero length (two welded corners of a triangle equal) is an edge `a = b`, counted `forward`.
 */
export function meshEdgeUseCounts(mesh: MeshData): readonly EdgeUse[] {
  const counts = new Map<string, { a: number; b: number; forward: number; backward: number }>();
  const use = (u: number, v: number): void => {
    const a = Math.min(u, v), b = Math.max(u, v);
    const key = `${a},${b}`;
    let c = counts.get(key);
    if (c === undefined) {
      c = { a, b, forward: 0, backward: 0 };
      counts.set(key, c);
    }
    if (u === a) c.forward++;
    else c.backward++;
  };
  for (const [x, y, z] of weldedTriangles(mesh)) {
    use(x, y);
    use(y, z);
    use(z, x);
  }
  const out = [...counts.values()].map((c) => Object.freeze({ ...c }));
  out.sort((p, q) => p.a - q.a || p.b - q.b);
  return Object.freeze(out);
}

/** Every directed edge used at most once (no two triangles traverse an edge the same way). */
export function isConsistentlyOriented(mesh: MeshData): boolean {
  return meshEdgeUseCounts(mesh).every((e) => e.forward <= 1 && e.backward <= 1);
}

/** Non-empty, and every undirected edge used exactly twice, once in each direction (Lean `watertight_of_balanced`). */
export function isWatertight(mesh: MeshData): boolean {
  const uses = meshEdgeUseCounts(mesh);
  return uses.length > 0 && uses.every((e) => e.a !== e.b && e.forward === 1 && e.backward === 1);
}

/** The triangles as point triples (for the M0 mass functions). */
export function meshTriangles(mesh: MeshData): readonly Triangle[] {
  const P = (i: number): Point3 => vec3(mesh.positions[3 * i]!, mesh.positions[3 * i + 1]!, mesh.positions[3 * i + 2]!);
  const out: Triangle[] = [];
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) out.push([P(mesh.indices[t]!), P(mesh.indices[t + 1]!), P(mesh.indices[t + 2]!)]);
  return Object.freeze(out);
}

/**
 * The signed volume enclosed by the mesh, by the M0 `signedVolume` about the bounding-box centre (positive for
 * an outward-oriented closed mesh). Meaningful only for a watertight mesh; a display quantity, not a measurement
 * of the model (use `src/mass` on the B-rep for that).
 */
export function meshSignedVolume(mesh: MeshData): number {
  const tris = meshTriangles(mesh);
  const pts: Point3[] = [];
  for (const t of tris) pts.push(t[0], t[1], t[2]);
  const box = boundingBox(pts);
  const ref = box === undefined ? vec3(0, 0, 0) : vec3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
  return signedVolume(tris, ref);
}
