/**
 * M3 example: every primitive (box, cylinder, frustum and apex cones, sphere, torus), an extrusion of a profile
 * with holes, a partial revolve of a profile with a hole, and a rotation-minimizing sweep along a helix. Each body
 * is round-tripped through the B-rep record text, tessellated, and its mesh volume compared with an analytic
 * volume computed here from closed-form formulas (not by the kernel).
 *
 *   npm run example          # also writes artifacts/m3/*.obj, *.record.json, *.mesh.json and summary.json
 *
 * The round trip and file helpers are those of the M2 example (`processBody`, `exampleFiles`, one job, one place);
 * `tests/example.test.ts` checks the bodies. Files are written only when this module is run directly.
 *
 * Upstream consulted (for the workflow, not translated): `solidcore/crates/solidcore/src/primitive/api_primitives.rs`,
 * `solidcore/crates/solidcore/src/prism/extrude.rs`, `solidcore/docs/procedural-sweep.md` — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  circleWire,
  createKernel,
  createNurbsCurve,
  createNurbsCurve3,
  createPlaneSurface,
  createProfile,
  curveArcLength,
  evaluateCurve3,
  extrude,
  interpolation,
  makeBox,
  makeCone,
  makeCylinder,
  makeSphere,
  makeTorus,
  ok,
  placement,
  point2,
  rectangleWire,
  revolve,
  slotWire,
  sweepWithReport,
  vec3,
  WORLD_PLACEMENT,
  type Brep,
  type Curve3,
  type Kernel,
  type Result,
} from '../src/index.ts';
import { exampleFiles, processBody, type ExampleBody } from './box-and-cylinder-mesh.ts';

const PI = Math.PI;

/** A body to process: its name, B-rep and analytic volume. */
interface Spec {
  readonly name: string;
  readonly brep: Result<Brep>;
  readonly volume: number;
}

/** A cubic B-spline interpolating `turns` turns of the helix of radius `r` and `pitch` per turn at `n` intervals. */
export function helixPath(r: number, pitch: number, turns: number, n: number): Result<Curve3> {
  const params = Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : i / n));
  const ip = interpolation(params, 3);
  if (!ip.ok) return ip;
  const pts = params.map((v) => {
    const a = 2 * PI * turns * v;
    return [r * Math.cos(a), r * Math.sin(a), pitch * turns * v];
  });
  const cols = [0, 1, 2].map((d) => ip.value.solve(pts.map((p) => p[d]!)));
  const c = createNurbsCurve(3, ip.value.knots, params.map((_, i) => [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!]));
  return c.ok ? createNurbsCurve3(c.value) : c;
}

/** The bodies of the example with their analytic volumes. */
export function m3Specs(kernel: Kernel): Result<readonly Spec[]> {
  const specs: Spec[] = [];
  specs.push({ name: 'box', brep: makeBox(kernel, vec3(0, 0, 0), 2, 3, 4), volume: 24 });
  // A tilted, off-origin cylinder.
  specs.push({
    name: 'cylinder',
    brep: makeCylinder(kernel, placement(vec3(1, -2, 0.5), vec3(0, 1, 1), vec3(1, 0, 0)), 1, 2),
    volume: PI * 1 * 1 * 2,
  });
  const frustum = (r1: number, r2: number, h: number): number => (PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
  specs.push({ name: 'cone-frustum', brep: makeCone(kernel, WORLD_PLACEMENT, 1.5, 0.5, 2), volume: frustum(1.5, 0.5, 2) });
  specs.push({ name: 'cone-apex', brep: makeCone(kernel, WORLD_PLACEMENT, 1, 0, 2), volume: frustum(1, 0, 2) });
  specs.push({ name: 'sphere', brep: makeSphere(kernel, vec3(0, 0, 0), 1.5), volume: (4 / 3) * PI * 1.5 ** 3 });
  specs.push({ name: 'torus', brep: makeTorus(kernel, WORLD_PLACEMENT, 2, 0.5), volume: 2 * PI * PI * 2 * 0.5 * 0.5 });

  // Extrusion: a 4 × 3 plate with a round hole and a slot, 1.5 thick.
  const xy = createPlaneSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0));
  if (!xy.ok) return xy;
  const plate = rectangleWire(0, 0, 4, 3);
  const hole = circleWire(point2(1, 1.5), 0.6);
  const slot = slotWire(point2(2.4, 0.8), point2(2.4, 2.2), 0.4);
  if (!plate.ok) return plate;
  if (!hole.ok) return hole;
  if (!slot.ok) return slot;
  const plateProfile = createProfile(kernel, xy.value, [plate.value, hole.value, slot.value]);
  if (!plateProfile.ok) return plateProfile;
  const plateArea = 12 - PI * 0.36 - (2 * 0.4 * 1.4 + PI * 0.16);
  specs.push({ name: 'extrude-plate-with-holes', brep: extrude(kernel, plateProfile.value, 1.5), volume: plateArea * 1.5 });

  // Revolve: the square [1, 3] × [0, 2] with a round hole at (2, 1), in the xz plane, three quarters of a turn
  // about z. Pappus: Θ (A_square x_square - A_hole x_hole).
  const xz = createPlaneSurface(kernel, vec3(0, 0, 0), vec3(0, -1, 0), vec3(1, 0, 0));
  if (!xz.ok) return xz;
  const sq = rectangleWire(1, 0, 2, 2);
  const ring = circleWire(point2(2, 1), 0.5);
  if (!sq.ok) return sq;
  if (!ring.ok) return ring;
  const meridian = createProfile(kernel, xz.value, [sq.value, ring.value]);
  if (!meridian.ok) return meridian;
  const theta = 1.5 * PI;
  specs.push({
    name: 'revolve-ring-with-hole',
    brep: revolve(kernel, meridian.value, { origin: point2(0, 0), direction: point2(0, 1) }, theta),
    volume: theta * (4 * 2 - PI * 0.25 * 2),
  });

  // Sweep: a 0.6 × 0.4 rectangle (centroid on the path) along half a turn of a helix, rotation-minimizing frame.
  // For a rotation-minimizing sweep with the centroid on the path the volume is area × path length.
  const helix = helixPath(3, 1.2, 0.5, 24);
  if (!helix.ok) return helix;
  const start = evaluateCurve3(helix.value, 0);
  if (!start.ok) return start;
  const normalPlane = createPlaneSurface(kernel, start.value.point, start.value.d1, vec3(1, 0, 0));
  if (!normalPlane.ok) return normalPlane;
  const rect = rectangleWire(-0.3, -0.2, 0.6, 0.4);
  if (!rect.ok) return rect;
  const section = createProfile(kernel, normalPlane.value, [rect.value]);
  if (!section.ok) return section;
  const swept = sweepWithReport(kernel, section.value, helix.value);
  if (!swept.ok) return swept;
  const length = curveArcLength(kernel, helix.value);
  if (!length.ok) return length;
  specs.push({ name: 'sweep-helix', brep: ok(swept.value.brep), volume: 0.24 * length.value });
  return ok(specs);
}

/** Builds, round-trips and tessellates every body (chord 0.001, 15°). */
export function runM3Example(kernel: Kernel = createKernel()): Result<readonly ExampleBody[]> {
  const specs = m3Specs(kernel);
  if (!specs.ok) return specs;
  const tol = { chord: 0.001, angleDeg: 15 };
  const out: ExampleBody[] = [];
  for (const s of specs.value) {
    if (!s.brep.ok) return s.brep;
    const r = processBody(kernel, s.name, s.brep.value, s.volume, tol);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runM3Example();
  if (!result.ok) {
    console.error(JSON.stringify(result.error));
    process.exitCode = 1;
  } else {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts', 'm3');
    mkdirSync(dir, { recursive: true });
    const files = exampleFiles(result.value);
    for (const [name, text] of files) writeFileSync(join(dir, name), text);
    for (const b of result.value) {
      const rel = (b.meshVolume - b.exactVolume) / b.exactVolume;
      console.log(
        `${b.name.padEnd(26)} ${String(b.mesh.stats.triangles).padStart(6)} triangles  watertight=${b.watertight}  ` +
          `oriented=${b.consistentlyOriented}  record stable=${b.roundTripStable}  ` +
          `volume ${b.meshVolume.toFixed(6)} vs analytic ${b.exactVolume.toFixed(6)} (${(rel * 100).toFixed(4)}%)`,
      );
    }
    console.log(`wrote ${files.size} files to artifacts/m3/ (OBJ, record, mesh, summary.json)`);
  }
}
