/**
 * M4 example: surface/surface intersections of M3 primitives and point classification against a solid.
 *
 * - Two crossing cylinders of different radii (the general path: subdivision + marching, class `certified`),
 *   a sphere cut by a plane (a closed-form circle, class `exact`), a torus cut by a plane square to its axis
 *   (two exact circles) and by an oblique plane (certified). Each intersection curve is written as an OBJ
 *   polyline, and `summary.json` lists every pair's class, method and components with their measured deviation.
 * - A grid of points classified (`classifyPoint`) against the M3 plate with a round hole and a slot; the answers
 *   are compared with the plate's analytic description (computed here, not by the kernel).
 *
 *   npm run example          # also writes artifacts/m4/*.obj and artifacts/m4/summary.json
 *
 * The plate is the M3 example's body (`m3Specs`, one job, one place); `tests/example.test.ts` checks the results.
 * Files are written only when this module is run directly.
 *
 * Upstream consulted (for the workflow, not translated): `solidcore/docs/ssi.md` (exact / certified / refused),
 * `solidcore/crates/solidcore/src/query/api_queries.rs` (point containment) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyPoint,
  createKernel,
  createPlaneSurface,
  curvePoint3,
  curveRange,
  intersectSurfaces,
  makeCylinder,
  makeSphere,
  makeTorus,
  ok,
  placement,
  prepareBody,
  surfacePatch,
  vec3,
  WORLD_PLACEMENT,
  type Brep,
  type IntersectionClass,
  type Kernel,
  type PointClass,
  type Point3,
  type Result,
  type Surface3,
  type SurfaceIntersection,
  type SurfacePatch,
  type Vec3,
} from '../src/index.ts';
import { m3Specs } from './primitives-and-sweeps.ts';

/** One component of a pair's answer, as summarised. */
export interface ComponentSummary {
  readonly kind: 'curve' | 'point';
  /** For curves: `line`, `circle`, `ellipse` or `nurbs` (a fitted B-spline of a marched branch). */
  readonly curve?: string;
  readonly closed?: boolean;
  readonly contact: 'transversal' | 'tangent';
  readonly class: IntersectionClass;
  readonly deviation: number;
}

/** One intersected pair. */
export interface PairSummary {
  readonly name: string;
  readonly class: IntersectionClass;
  readonly method: 'closed-form' | 'marching';
  readonly components: readonly ComponentSummary[];
  /** The largest certificate deviation over the components. */
  readonly maxDeviation: number;
}

/** The classification of the point grid against the plate. */
export interface ClassificationSummary {
  readonly body: string;
  readonly points: number;
  readonly counts: Readonly<Record<PointClass | 'refused', number>>;
  /** Points whose answer differs from the analytic one (`on` counts as agreeing within the tolerance). */
  readonly disagreements: number;
  readonly exactEvidence: number;
}

export interface IntersectionsExample {
  readonly pairs: readonly PairSummary[];
  /** OBJ polyline text per pair. */
  readonly obj: ReadonlyMap<string, string>;
  readonly classification: ClassificationSummary;
}

/** The patch of the first face of `brep` whose surface is of `kind`, over that face's `(u, v)` box. */
function facePatch(kernel: Kernel, brep: Result<Brep>, kind: Surface3['kind']): Result<SurfacePatch> {
  if (!brep.ok) return brep;
  const prepared = prepareBody(kernel, brep.value);
  if (!prepared.ok) return prepared;
  const f = prepared.value.faces.find((d) => d.surface.kind === kind);
  if (f === undefined) return { ok: false, error: { kind: 'invalid-input', operation: 'example.facePatch', reason: `no ${kind} face` } };
  return surfacePatch(f.surface, { u: [f.uvBox.min.x, f.uvBox.max.x], v: [f.uvBox.min.y, f.uvBox.max.y] });
}

/** A square plane patch `[-s, s]²` through `origin` with unit `normal`. */
function planePatch(kernel: Kernel, origin: Point3, normal: Vec3, xDirection: Vec3, s: number): Result<SurfacePatch> {
  const p = createPlaneSurface(kernel, origin, normal, xDirection);
  if (!p.ok) return p;
  return surfacePatch(p.value, { u: [-s, s], v: [-s, s] });
}

/** The pairs of the example (all built from M3 primitives; planes are bare surfaces). */
function pairs(kernel: Kernel): Result<readonly { name: string; a: SurfacePatch; b: SurfacePatch }[]> {
  const out: { name: string; a: SurfacePatch; b: SurfacePatch }[] = [];
  const add = (name: string, a: Result<SurfacePatch>, b: Result<SurfacePatch>): Result<void> => {
    if (!a.ok) return a;
    if (!b.ok) return b;
    out.push({ name, a: a.value, b: b.value });
    return ok(undefined);
  };
  // A vertical cylinder of radius 1 and a horizontal one of radius 0.6 through its axis: two closed loops.
  const vertical = facePatch(kernel, makeCylinder(kernel, placement(vec3(0, 0, -2)), 1, 4), 'cylinder');
  const horizontal = facePatch(kernel, makeCylinder(kernel, placement(vec3(-2, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0)), 0.6, 4), 'cylinder');
  const steps: Result<void>[] = [
    add('two-cylinders', vertical, horizontal),
    add('sphere-plane', facePatch(kernel, makeSphere(kernel, vec3(0, 0, 0), 1.5), 'sphere'), planePatch(kernel, vec3(0, 0, 0.5), vec3(0, 0, 1), vec3(1, 0, 0), 3)),
    add('torus-plane', facePatch(kernel, makeTorus(kernel, WORLD_PLACEMENT, 2, 0.5), 'torus'), planePatch(kernel, vec3(0, 0, 0.25), vec3(0, 0, 1), vec3(1, 0, 0), 3)),
    add(
      'torus-oblique-plane',
      facePatch(kernel, makeTorus(kernel, WORLD_PLACEMENT, 2, 0.5), 'torus'),
      planePatch(kernel, vec3(0, 0, 0.1), vec3(0, Math.sin(0.15), Math.cos(0.15)), vec3(1, 0, 0), 3),
    ),
  ];
  for (const s of steps) if (!s.ok) return s;
  return ok(out);
}

const SAMPLES = 128;
const fmt = (x: number): string => (Object.is(x, -0) ? 0 : x).toFixed(6);

/** The answer as OBJ polylines (`l`) and points (`p`). */
function intersectionObj(name: string, r: SurfaceIntersection): Result<string> {
  const lines = [`# cadloom M4 intersection: ${name} (${r.class}, ${r.method})`, `o ${name}`];
  let n = 0;
  for (const h of r.hits) {
    if (h.kind === 'point') {
      lines.push(`v ${fmt(h.point.x)} ${fmt(h.point.y)} ${fmt(h.point.z)}`, `p ${++n}`);
      continue;
    }
    const [t0, t1] = curveRange(h.curve);
    const count = h.closed ? SAMPLES : SAMPLES + 1;
    const first = n + 1;
    for (let i = 0; i < count; i++) {
      const p = curvePoint3(h.curve, t0 + ((t1 - t0) * i) / SAMPLES);
      if (!p.ok) return p;
      lines.push(`v ${fmt(p.value.x)} ${fmt(p.value.y)} ${fmt(p.value.z)}`);
      n++;
    }
    const idx = Array.from({ length: count }, (_, i) => first + i);
    if (h.closed) idx.push(first);
    lines.push(`l ${idx.join(' ')}`);
  }
  return ok(lines.join('\n') + '\n');
}

/** Inside the plate (4 × 3 × 1.5, round hole r 0.6 at (1, 1.5), slot of half-width 0.4 from (2.4, 0.8) to (2.4, 2.2)). */
function plateTruth(p: Point3): 'inside' | 'outside' {
  const inBox = p.x > 0 && p.x < 4 && p.y > 0 && p.y < 3 && p.z > 0 && p.z < 1.5;
  const inHole = Math.hypot(p.x - 1, p.y - 1.5) < 0.6;
  const sy = Math.min(2.2, Math.max(0.8, p.y));
  const inSlot = Math.hypot(p.x - 2.4, p.y - sy) < 0.4;
  return inBox && !inHole && !inSlot ? 'inside' : 'outside';
}

/** A 14 × 11 grid over the plate's footprint (and around it), at half height and above the plate. */
export function gridPoints(): Point3[] {
  const pts: Point3[] = [];
  for (const z of [0.75, 1.9]) {
    for (let j = 0; j < 11; j++) for (let i = 0; i < 14; i++) pts.push(vec3(-0.35 + 0.35 * i, -0.3 + 0.35 * j, z));
  }
  return pts;
}

function classifyPlate(kernel: Kernel): Result<ClassificationSummary> {
  const specs = m3Specs(kernel);
  if (!specs.ok) return specs;
  const spec = specs.value.find((s) => s.name === 'extrude-plate-with-holes')!;
  if (!spec.brep.ok) return spec.brep;
  const body = prepareBody(kernel, spec.brep.value);
  if (!body.ok) return body;
  const counts = { inside: 0, outside: 0, on: 0, refused: 0 };
  let disagreements = 0, exactEvidence = 0;
  const pts = gridPoints();
  for (const p of pts) {
    const c = classifyPoint(kernel, body.value, p);
    if (!c.ok) {
      counts.refused++;
      continue;
    }
    counts[c.value.class]++;
    if (c.value.evidence === 'exact') exactEvidence++;
    if (c.value.class !== 'on' && c.value.class !== plateTruth(p)) disagreements++;
  }
  return ok(Object.freeze({ body: spec.name, points: pts.length, counts: Object.freeze(counts), disagreements, exactEvidence }));
}

/** Runs every pair and the classification grid. */
export function runIntersectionsExample(kernel: Kernel = createKernel()): Result<IntersectionsExample> {
  const ps = pairs(kernel);
  if (!ps.ok) return ps;
  const summaries: PairSummary[] = [];
  const obj = new Map<string, string>();
  for (const { name, a, b } of ps.value) {
    const r = intersectSurfaces(kernel, a, b);
    if (!r.ok) return r;
    const components: ComponentSummary[] = r.value.hits.map((h) =>
      h.kind === 'curve'
        ? { kind: 'curve', curve: h.curve.kind, closed: h.closed, contact: h.contact, class: h.class, deviation: h.deviation }
        : { kind: 'point', contact: h.contact, class: h.class, deviation: h.deviation },
    );
    const maxDeviation = Math.max(0, ...components.map((c) => c.deviation));
    summaries.push({ name, class: r.value.class, method: r.value.method, components, maxDeviation });
    const text = intersectionObj(name, r.value);
    if (!text.ok) return text;
    obj.set(`${name}.obj`, text.value);
  }
  const classification = classifyPlate(kernel);
  if (!classification.ok) return classification;
  return ok({ pairs: summaries, obj, classification: classification.value });
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runIntersectionsExample();
  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
  } else {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'm4');
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of result.value.obj) writeFileSync(join(dir, name), text);
    const summary = { pairs: result.value.pairs, classification: result.value.classification };
    writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    for (const p of result.value.pairs) {
      const kinds = p.components.map((c) => (c.kind === 'curve' ? `${c.curve}${c.closed ? '(closed)' : ''}` : 'point')).join(', ');
      console.log(`${p.name.padEnd(20)} ${p.class.padEnd(9)} ${p.method.padEnd(11)} ${String(p.components.length).padStart(2)} components [${kinds}]  max deviation ${p.maxDeviation.toExponential(2)}`);
    }
    const c = result.value.classification;
    console.log(
      `classify ${c.points} points against ${c.body}: inside ${c.counts.inside}, outside ${c.counts.outside}, on ${c.counts.on}, ` +
        `refused ${c.counts.refused}; disagreements with the analytic plate ${c.disagreements}; exact evidence ${c.exactEvidence}`,
    );
    console.log(`wrote ${result.value.obj.size + 1} files to artifacts/m4/ (OBJ polylines, summary.json)`);
  }
}
