/**
 * M2 example: build a box and a closed cylinder, round-trip both through the B-rep record (JSON text), and
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
 * The cylinder is the M2 fixture of `tests/topology-geometry.test.ts` and `formal/CadloomFormal/TopologyGeometry.lean`
 * (`cylinderLoops`): two circle edges, one seam edge used twice by the side face (pcurves on u = 2π and u = 0),
 * two planar discs. Analytic cylinder primitives arrive in M3; until then the body is assembled with `BrepBuilder`.
 *
 * Upstream consulted (for the workflow, not translated): `solidcore/crates/solidcore-tess/src/lib.rs`,
 * `solidcore/crates/solidcore-convert/src/lib.rs`, `solidcore/crates/solidcore-record/src/brep.rs` —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrepBuilder,
  brepToRecord,
  createCircleCurve,
  createCylinderSurface,
  createKernel,
  createNurbsCurve,
  createPlaneSurface,
  createSegmentCurve,
  isConsistentlyOriented,
  isWatertight,
  makeBox,
  meshSignedVolume,
  ok,
  parseRecordText,
  planePcurve,
  recordToBrep,
  stringifyRecord,
  tessellate,
  vec3,
  type Brep,
  type Kernel,
  type Mesh,
  type MeshTolerance,
  type NurbsCurve,
  type Result,
} from '../src/index.ts';

const TWO_PI = 2 * Math.PI;

/**
 * A closed cylinder of radius `r` and height `h` about +z, its base on z = 0: vertices (r, 0, 0) and (r, 0, h);
 * edges e0 bottom circle, e1 top circle, e2 seam; faces bottom disc (reversed plane), top disc, side.
 */
export function closedCylinder(kernel: Kernel, r: number, h: number): Result<Brep> {
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  const bottom = createCircleCurve(kernel, vec3(0, 0, 0), z, x, r);
  const top = createCircleCurve(kernel, vec3(0, 0, h), z, x, r);
  const seam = createSegmentCurve(vec3(r, 0, 0), vec3(r, 0, h));
  const p0 = createPlaneSurface(kernel, vec3(0, 0, 0), z, x);
  const p1 = createPlaneSurface(kernel, vec3(0, 0, h), z, x);
  const side = createCylinderSurface(kernel, vec3(0, 0, 0), z, x, r);
  if (!bottom.ok) return bottom;
  if (!top.ok) return top;
  if (!seam.ok) return seam;
  if (!p0.ok) return p0;
  if (!p1.ok) return p1;
  if (!side.ok) return side;
  const pcBottom = planePcurve(kernel, p0.value, { curve: bottom.value, t0: 0, t1: TWO_PI }, true);
  const pcTop = planePcurve(kernel, p1.value, { curve: top.value, t0: 0, t1: TWO_PI }, false);
  if (!pcBottom.ok) return pcBottom;
  if (!pcTop.ok) return pcTop;
  const uv: NurbsCurve[] = [];
  for (const [u0, v0, u1, v1] of [[0, 0, TWO_PI, 0], [TWO_PI, 0, TWO_PI, h], [TWO_PI, h, 0, h], [0, h, 0, 0]] as const) {
    const c = createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0], [u1, v1]]);
    if (!c.ok) return c;
    uv.push(c.value);
  }

  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v0 = b.addVertex(vec3(r, 0, 0));
  const v1 = b.addVertex(vec3(r, 0, h));
  const e0 = b.addEdge(v0, v0, bottom.value);
  const e1 = b.addEdge(v1, v1, top.value);
  const e2 = b.addEdge(v0, v1, seam.value, 0, 1);
  b.addLoop(b.addFace(shell, p0.value, true), [{ edge: e0, reversed: true, pcurve: pcBottom.value }]);
  b.addLoop(b.addFace(shell, p1.value), [{ edge: e1, reversed: false, pcurve: pcTop.value }]);
  b.addLoop(b.addFace(shell, side.value), [
    { edge: e0, reversed: false, pcurve: uv[0]! },
    { edge: e2, reversed: false, pcurve: uv[1]! },
    { edge: e1, reversed: true, pcurve: uv[2]! },
    { edge: e2, reversed: true, pcurve: uv[3]! },
  ]);
  return ok(b.build());
}

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
  const cylinder = closedCylinder(kernel, 2, 3);
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
