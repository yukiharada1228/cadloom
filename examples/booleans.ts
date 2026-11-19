/**
 * M5 example: regularized booleans of M3 bodies. A drilled plate (box minus two cylinders), Steinmetz solids
 * (cylinder ∩ cylinder at right angles: radii 0.8 and 1, and the equal-radii case the M4 surface/surface
 * intersection refuses by name), a box ∪ sphere, a box minus sphere, and a revolved ring minus an extruded
 * cylinder. Every solid result is checked with `validateBrep` and `validateBrepGeometry`, round-tripped through the
 * record text, tessellated (watertight, positive volume) and its mesh volume compared with an analytic volume
 * computed here from closed forms (or a 1-D Simpson integral for the unequal Steinmetz solid), not by the kernel.
 * A refusal is reported with its reason, never as a body.
 *
 *   npm run example          # also writes artifacts/m5/*.obj, *.record.json, *.mesh.json and summary.json
 *
 * The round trip and file helpers are those of the M2 example (`processBody`, `meshToObj`; one job, one place);
 * `tests/example.test.ts` checks the results. Files are written only when this module is run directly.
 *
 * Upstream consulted (for the workflow, not translated): `solidcore/crates/solidcore/src/boolean/api_brep.rs`,
 * `solidcore/docs/booleans.md` (results are valid or refused) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  booleanIntersect,
  booleanSubtract,
  booleanUnion,
  circleWire,
  createKernel,
  createPlaneSurface,
  createProfile,
  eulerPoincare,
  extrude,
  invalidInput,
  makeBox,
  makeCylinder,
  makeSphere,
  ok,
  placement,
  point2,
  rectangleWire,
  refusalReason,
  revolve,
  validateBrep,
  validateBrepGeometry,
  vec3,
  type BooleanOp,
  type BooleanResult,
  type Brep,
  type Kernel,
  type Result,
} from '../src/index.ts';
import { meshToObj, processBody, type ExampleBody } from './box-and-cylinder-mesh.ts';

const PI = Math.PI;

/** One boolean of the example: the operands, the operation and the analytic volume of the result. */
interface Case {
  readonly name: string;
  readonly op: BooleanOp;
  readonly a: Brep;
  readonly b: Brep;
  /** Analytic volume of the result. */
  readonly volume: number;
  /** The genus the result must have (Euler–Poincaré). */
  readonly genus: number;
}

export interface BooleanSummary {
  readonly name: string;
  readonly op: BooleanOp;
  /** `solid`, `empty`, or `refused` (with `refusal`). */
  readonly status: 'solid' | 'empty' | 'refused';
  readonly refusal?: string;
  readonly validTopology?: boolean;
  readonly validGeometry?: boolean;
  readonly roundTripStable?: boolean;
  readonly watertight?: boolean;
  readonly meshVolume?: number;
  readonly analyticVolume: number;
  readonly volumeRelativeError?: number;
  readonly genus?: number;
  readonly expectedGenus: number;
  readonly counts?: { readonly vertices: number; readonly edges: number; readonly faces: number; readonly shells: number; readonly lumps: number };
  readonly stats?: { readonly fragmentsA: number; readonly fragmentsB: number; readonly kept: number; readonly intersectionEdges: number; readonly exactEdges: number; readonly certifiedEdges: number; readonly maxDeviation: number };
}

export interface BooleansExample {
  readonly results: readonly BooleanSummary[];
  /** The processed solid results (record round trip and display mesh), by case name. */
  readonly bodies: ReadonlyMap<string, ExampleBody>;
}

const run = (kernel: Kernel, op: BooleanOp, a: Brep, b: Brep): Result<BooleanResult> =>
  op === 'union' ? booleanUnion(kernel, a, b) : op === 'intersect' ? booleanIntersect(kernel, a, b) : booleanSubtract(kernel, a, b);

/**
 * Volume of `{x² + y² ≤ a², y² + z² ≤ b²}` (`a ≤ b`): `∫ 4 √(a² − y²) √(b² − y²) dy` over `[−a, a]`, with
 * `y = a sin t` (a smooth integrand `4 a² cos² t √(b² − a² sin² t)` over `[−π/2, π/2]`), Simpson with 2000 panels.
 * For `a = b` it is `16 a³ / 3`.
 */
export function steinmetzVolume(a: number, b: number): number {
  const f = (t: number): number => 4 * a * a * Math.cos(t) ** 2 * Math.sqrt(b * b - a * a * Math.sin(t) ** 2);
  const n = 2000, h = PI / n;
  let s = f(-PI / 2) + f(PI / 2);
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * f(-PI / 2 + i * h);
  return (s * h) / 3;
}

/** Volume of a spherical cap of height `h` on a sphere of radius `r`. */
const cap = (r: number, h: number): number => (PI * h * h * (3 * r - h)) / 3;

/** The example's cases (operands built with the M3 constructors). */
export function booleanCases(kernel: Kernel): Result<readonly Case[]> {
  const cases: Case[] = [];
  const Z = vec3(0, 0, 1), X = vec3(1, 0, 0), Y = vec3(0, 1, 0);

  // Drilled plate: a 4 × 3 × 1 box minus two through cylinders of radius 0.4.
  const plate = makeBox(kernel, vec3(0, 0, 0), 4, 3, 1);
  if (!plate.ok) return plate;
  const drill1 = makeCylinder(kernel, placement(vec3(1, 1.5, -0.5), Z, X), 0.4, 2);
  const drill2 = makeCylinder(kernel, placement(vec3(3, 1.5, -0.5), Z, X), 0.4, 2);
  if (!drill1.ok) return drill1;
  if (!drill2.ok) return drill2;
  // Two holes: subtract the first drill, then the second from the result (a chain of booleans).
  const once = booleanSubtract(kernel, plate.value, drill1.value);
  if (!once.ok) return once;
  if (once.value.kind !== 'solid') return invalidInput('example.booleans', 'the first drill emptied the plate');
  cases.push({ name: 'drilled-plate', op: 'subtract', a: once.value.brep, b: drill2.value, volume: 12 - 2 * PI * 0.16, genus: 2 });

  // Steinmetz solids: a vertical cylinder of radius a ∩ a cylinder of radius b along x, axes meeting at the origin.
  const vertical = (r: number) => makeCylinder(kernel, placement(vec3(0, 0, -2), Z, X), r, 4);
  const horizontal = (r: number) => makeCylinder(kernel, placement(vec3(-2, 0, 0), X, Y), r, 4);
  const v8 = vertical(0.8), h1 = horizontal(1), v1 = vertical(1);
  if (!v8.ok) return v8;
  if (!h1.ok) return h1;
  if (!v1.ok) return v1;
  cases.push({ name: 'steinmetz', op: 'intersect', a: v8.value, b: h1.value, volume: steinmetzVolume(0.8, 1), genus: 0 });
  cases.push({ name: 'steinmetz-equal-radii', op: 'intersect', a: v1.value, b: h1.value, volume: (16 / 3) * 1, genus: 0 });

  // Box ∪ sphere and box − sphere: a 2 × 2 × 1 box and a sphere of radius 0.8 centred 0.3 above the middle of its
  // top face, so the box holds a cap of height 0.5 of the sphere.
  const block = makeBox(kernel, vec3(0, 0, 0), 2, 2, 1);
  if (!block.ok) return block;
  const ball = makeSphere(kernel, vec3(1, 1, 1.3), 0.8);
  if (!ball.ok) return ball;
  const inside = cap(0.8, 0.5);
  cases.push({ name: 'box-union-sphere', op: 'union', a: block.value, b: ball.value, volume: 4 + (4 / 3) * PI * 0.8 ** 3 - inside, genus: 0 });
  cases.push({ name: 'box-minus-sphere', op: 'subtract', a: block.value, b: ball.value, volume: 4 - inside, genus: 0 });

  // Revolve minus extrusion: the square [1, 2] × [0, 1] of the xz plane turned once about z (volume 3π, genus 1),
  // minus a cylinder of radius 0.3 extruded through it from a circle at (1.5, 0): genus 2.
  const xz = createPlaneSurface(kernel, vec3(0, 0, 0), vec3(0, -1, 0), X);
  if (!xz.ok) return xz;
  const square = rectangleWire(1, 0, 1, 1);
  if (!square.ok) return square;
  const meridian = createProfile(kernel, xz.value, [square.value]);
  if (!meridian.ok) return meridian;
  const ring = revolve(kernel, meridian.value, { origin: point2(0, 0), direction: point2(0, 1) }, 2 * PI);
  if (!ring.ok) return ring;
  const floor = createPlaneSurface(kernel, vec3(0, 0, -0.5), Z, X);
  if (!floor.ok) return floor;
  const disc = circleWire(point2(1.5, 0), 0.3);
  if (!disc.ok) return disc;
  const discProfile = createProfile(kernel, floor.value, [disc.value]);
  if (!discProfile.ok) return discProfile;
  const pin = extrude(kernel, discProfile.value, 2);
  if (!pin.ok) return pin;
  cases.push({ name: 'revolve-minus-extrusion', op: 'subtract', a: ring.value, b: pin.value, volume: 3 * PI - PI * 0.09, genus: 2 });
  return ok(cases);
}

/** Display-mesh settings: 2° facets and a 0.1 grid step, so trimmed curved faces meet the analytic volumes closely. */
export const BOOLEAN_MESH = Object.freeze({ chord: 0.001, angleDeg: 2, maxEdgeLength: 0.1 });

/** Runs every case; a refused case is a summary row with its reason, not an error of the example. */
export function runBooleansExample(kernel: Kernel = createKernel()): Result<BooleansExample> {
  const cases = booleanCases(kernel);
  if (!cases.ok) return cases;
  const results: BooleanSummary[] = [];
  const bodies = new Map<string, ExampleBody>();
  for (const c of cases.value) {
    const base = { name: c.name, op: c.op, analyticVolume: c.volume, expectedGenus: c.genus };
    const r = run(kernel, c.op, c.a, c.b);
    if (!r.ok) {
      const e = r.error;
      // The reason the stage named: an intersection refusal (`refusalReason`) or the boolean's own reason.
      results.push({ ...base, status: 'refused', refusal: refusalReason(e) ?? ('reason' in e ? e.reason : `${e.kind} (${e.operation})`) });
      continue;
    }
    if (r.value.kind === 'empty') {
      results.push({ ...base, status: 'empty' });
      continue;
    }
    const brep = r.value.brep;
    const processed = processBody(kernel, c.name, brep, c.volume, BOOLEAN_MESH);
    if (!processed.ok) return processed;
    const body = processed.value;
    bodies.set(c.name, body);
    const ep = eulerPoincare(brep);
    if (!ep.ok) return ep;
    const s = r.value.stats;
    results.push({
      ...base,
      status: 'solid',
      validTopology: validateBrep(brep).ok,
      validGeometry: validateBrepGeometry(kernel, brep).ok,
      roundTripStable: body.roundTripStable,
      watertight: body.watertight,
      meshVolume: body.meshVolume,
      volumeRelativeError: (body.meshVolume - c.volume) / c.volume,
      genus: ep.value.genus,
      counts: { vertices: brep.vertices.length, edges: brep.edges.length, faces: brep.faces.length, shells: brep.shells.length, lumps: brep.bodies.length },
      stats: {
        fragmentsA: s.fragmentsA,
        fragmentsB: s.fragmentsB,
        kept: s.keptFragments,
        intersectionEdges: s.intersectionEdges,
        exactEdges: s.exactEdges,
        certifiedEdges: s.certifiedEdges,
        maxDeviation: s.maxDeviation,
      },
    });
  }
  return ok({ results, bodies });
}

/** The files of the example, by name (deterministic text). */
export function booleanFiles(ex: BooleansExample): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  for (const [name, b] of ex.bodies) {
    files.set(`${name}.record.json`, b.recordText);
    const { positions, normals, indices, faceRanges, stats } = b.mesh;
    files.set(`${name}.mesh.json`, JSON.stringify({ positions, normals, indices, faceRanges, stats }) + '\n');
    files.set(`${name}.obj`, meshToObj(b.mesh, name));
  }
  files.set('summary.json', JSON.stringify(ex.results, null, 2) + '\n');
  return files;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runBooleansExample();
  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
  } else {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'm5');
    mkdirSync(dir, { recursive: true });
    const files = booleanFiles(result.value);
    for (const [name, text] of files) writeFileSync(join(dir, name), text);
    for (const r of result.value.results) {
      const head = `${r.name.padEnd(24)} ${r.op.padEnd(9)}`;
      if (r.status !== 'solid') {
        console.log(`${head} ${r.status}${r.refusal !== undefined ? `: ${r.refusal}` : ''}`);
        continue;
      }
      console.log(
        `${head} valid=${r.validTopology && r.validGeometry}  record stable=${r.roundTripStable}  watertight=${r.watertight}  ` +
          `genus ${r.genus}  faces ${r.counts?.faces}  volume ${r.meshVolume?.toFixed(6)} (analytic ${r.analyticVolume.toFixed(6)}, ` +
          `rel. error ${r.volumeRelativeError?.toExponential(2)})`,
      );
    }
    console.log(`wrote ${files.size} files to artifacts/m5/`);
  }
}
