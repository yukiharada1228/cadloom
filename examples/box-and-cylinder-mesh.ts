/**
 * M2 example: build a box and a cylinder, round-trip both through the B-rep record (JSON text), and
 * tessellate the round-tripped bodies for display.
 *
 *   npm run example          # writes artifacts/*.json and artifacts/*.obj
 *
 * Written files (artifacts/ is git-ignored):
 * - `<name>.record.json`: the canonical record text (`stringifyRecord`), the neutral data form of the body;
 * - `<name>.mesh.json`: the display mesh (`tessellate`: positions, normals, indices, per-face ranges, stats);
 * - `<name>.obj`: the same mesh as Wavefront OBJ text, for any mesh viewer;
 * - `summary.json`: counts, watertightness and the enclosed volume of each mesh against the exact volume.
 *
 * The functions are exported (and checked by `tests/example.test.ts`); the files are written only when this
 * module is run directly.
 *
 * The cylinder is the M3 primitive `makeCylinder` (the single cylinder builder; it has the ids of the M2 fixture
 * `cylinderLoops` of `formal/CadloomFormal/TopologyGeometry.lean`): two circle edges, one seam edge used twice by
 * the side face (pcurves on u = 2π and u = 0), two planar discs. The M3 example `primitives-and-sweeps.ts` builds
 * every primitive, an extrusion, a revolve and a sweep with the helpers exported here.
 *
 * Upstream consulted (for the workflow, not translated): `solidcore/crates/solidcore-tess/src/lib.rs`,
 * `solidcore/crates/solidcore-convert/src/lib.rs`, `solidcore/crates/solidcore-record/src/brep.rs` —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  brepToRecord,
  createKernel,
  isConsistentlyOriented,
  isWatertight,
  makeBox,
  makeCylinder,
  meshSignedVolume,
  ok,
  parseRecordText,
  recordToBrep,
  stringifyRecord,
  tessellate,
  vec3,
  WORLD_PLACEMENT,
  type Brep,
  type Kernel,
  type Mesh,
  type MeshTolerance,
  type Result,
} from '../src/index.ts';

/** Minimal Wavefront OBJ text of a mesh: `v`, `vn` and `f v//vn` lines (1-based indices). */
export function meshToObj(mesh: Mesh, name: string): string {
  const lines = [`# cadloom display mesh: ${name}`, `o ${name}`];
  for (let i = 0; i + 2 < mesh.positions.length; i += 3) lines.push(`v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`);
  for (let i = 0; i + 2 < mesh.normals.length; i += 3) lines.push(`vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}`);
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const [a, b, c] = [mesh.indices[i]! + 1, mesh.indices[i + 1]! + 1, mesh.indices[i + 2]! + 1];
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  return lines.join('\n') + '\n';
}

export interface ExampleBody {
  readonly name: string;
  /** The canonical record text of the body. */
  readonly recordText: string;
  /** Whether the record of the round-tripped body is byte-identical to `recordText`. */
  readonly roundTripStable: boolean;
  /** The display mesh of the round-tripped body. */
  readonly mesh: Mesh;
  readonly watertight: boolean;
  readonly consistentlyOriented: boolean;
  readonly meshVolume: number;
  readonly exactVolume: number;
}

/** Record round trip, then tessellation, of one body. */
export function processBody(kernel: Kernel, name: string, brep: Brep, exactVolume: number, tol: Partial<MeshTolerance>): Result<ExampleBody> {
  const record = brepToRecord(brep);
  if (!record.ok) return record;
  const recordText = stringifyRecord(record.value);
  const parsed = parseRecordText(recordText);
  if (!parsed.ok) return parsed;
  const back = recordToBrep(kernel, parsed.value);
  if (!back.ok) return back;
  const again = brepToRecord(back.value);
  if (!again.ok) return again;
  const mesh = tessellate(kernel, back.value, tol);
  if (!mesh.ok) return mesh;
  return ok({
    name,
    recordText,
    roundTripStable: stringifyRecord(again.value) === recordText,
    mesh: mesh.value,
    watertight: isWatertight(mesh.value),
    consistentlyOriented: isConsistentlyOriented(mesh.value),
    meshVolume: meshSignedVolume(mesh.value),
    exactVolume,
  });
}

/** The box (2 × 3 × 4 at the origin) and the cylinder (r = 2, h = 3), processed with a 0.01 chord. */
export function runExample(kernel: Kernel = createKernel()): Result<readonly ExampleBody[]> {
  const tol = { chord: 0.01, angleDeg: 15 };
  const box = makeBox(kernel, vec3(0, 0, 0), 2, 3, 4);
  if (!box.ok) return box;
  const cylinder = makeCylinder(kernel, WORLD_PLACEMENT, 2, 3);
  if (!cylinder.ok) return cylinder;
  const out: ExampleBody[] = [];
  for (const [name, brep, volume] of [['box', box.value, 24], ['cylinder', cylinder.value, Math.PI * 2 * 2 * 3]] as const) {
    const r = processBody(kernel, name, brep, volume, tol);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

/** The files of the example, by name (deterministic text). */
export function exampleFiles(bodies: readonly ExampleBody[]): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  const summary = [];
  for (const b of bodies) {
    files.set(`${b.name}.record.json`, b.recordText);
    const { positions, normals, indices, faceRanges, stats } = b.mesh;
    files.set(`${b.name}.mesh.json`, JSON.stringify({ positions, normals, indices, faceRanges, stats }) + '\n');
    files.set(`${b.name}.obj`, meshToObj(b.mesh, b.name));
    summary.push({
      name: b.name,
      vertices: b.mesh.stats.vertices,
      triangles: b.mesh.stats.triangles,
      faces: b.mesh.stats.faces,
      meshedFaces: b.mesh.stats.meshedFaces,
      watertight: b.watertight,
      consistentlyOriented: b.consistentlyOriented,
      roundTripStable: b.roundTripStable,
      meshVolume: b.meshVolume,
      exactVolume: b.exactVolume,
      volumeRelativeError: (b.meshVolume - b.exactVolume) / b.exactVolume,
    });
  }
  files.set('summary.json', JSON.stringify(summary, null, 2) + '\n');
  return files;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runExample();
  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
  } else {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts');
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of exampleFiles(result.value)) writeFileSync(join(dir, name), text);
    for (const b of result.value) {
      console.log(
        `${b.name}: ${b.mesh.stats.triangles} triangles, watertight=${b.watertight}, ` +
          `volume ${b.meshVolume.toFixed(6)} (exact ${b.exactVolume.toFixed(6)}), record round trip stable=${b.roundTripStable}`,
      );
    }
    console.log(`wrote ${[...exampleFiles(result.value).keys()].map((n) => `artifacts/${n}`).join(', ')}`);
  }
}
