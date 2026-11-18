/**
 * The one conversion between the B-rep record (src/record) and the kernel's arena `Brep` (src/topology), both
 * ways, field by field.
 *
 * - `brepToRecord(brep)` copies every field of a structurally valid `Brep` (`validateBrep`) into record data
 *   and reads it back with `parseRecord`, so its output is exactly what a reader accepts (non-finite
 *   coordinates, a pcurve that is not 2D or a curve that is not 3D are refused there, naming the field).
 * - `recordToBrep(kernel, record)` re-checks the record with `parseRecord`, rebuilds every curve, surface and
 *   pcurve through the kernel's validated constructors (`createLineCurve`, `createCircleCurve`, ...,
 *   `createNurbsCurve`, `createNurbsSurface`), assembles the body with `BrepBuilder` and validates it
 *   (`validateBrepGeometry`, or only the combinatorial `validateBrep` with `{ checkGeometry: false }`).
 *
 * Round trip. Both directions keep arena indices: item `i` of each record arena is item `i` of the kernel arena.
 * The builder hands out ids in creation order and derives `next`/`prev` (a cycle per loop) and the partner
 * links, so a record is accepted only in *builder order* (`builderOrderIssue`): coedges stored loop by loop
 * (loop 0's first, ...) with each loop's coedges in cycle order, and every child list (`bodies[b].shells`,
 * `shells[s].faces`, `faces[f].loops`) equal to the items naming that parent, ascending. Every `Brep` made by
 * `BrepBuilder` is in builder order; `brepToRecord` refuses one that is not (`invalid-input`). Then
 * `recordToBrep(k, brepToRecord(b))` is field-by-field equal to `b` (numbers compared with `===`; the record
 * reads `-0` as `0`).
 *
 * Frames. The kernel builds a frame from a normal and an x reference (`createCurveFrame`: normalise, project);
 * that is not idempotent in floating point (re-running it on its own output moves the last bits). So a record
 * keeps all three axes, `recordToBrep` runs the kernel's constructor (which decides validity: non-degenerate,
 * radii, ranges) and keeps the *stored* axes when the kernel's `storedFrameMismatch` (src/curve/types.ts) accepts
 * them against the frame it built (each component within `ROUNDING_SLACK`, 1e-12); a frame that is not
 * orthonormal and right-handed to that slack is refused. There is no arithmetic here: everything else is
 * copied (upstream's layer rule, `docs/layers.md`).
 *
 * Errors: `invalid-input` with operation `convert.brepToRecord` / `convert.recordToBrep` and a reason that
 * starts with the record path (`'curves[2]: radius must be finite and positive (curve.createCircleCurve)'`);
 * the validation errors of the built body are returned as they are (`invalid-topology`).
 *
 * Upstream consulted (for the shape, not translated): `solidcore/crates/solidcore-convert/src/lib.rs` (field
 * by field conversion, no maths), `crates/solidcore-convert/src/brep.rs` and `brep/record.rs` (record to
 * kernel body and back, then the kernel's checks), `crates/solidcore-record/src/brep.rs` — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { vec3, type Vec3 } from '../math/vec.ts';
import {
  ROUNDING_SLACK,
  storedFrameMismatch,
  createCircleCurve,
  createEllipseCurve,
  createLineCurve,
  createNurbsCurve3,
  freezeVec,
  type Curve3,
  type CurveFrame,
} from '../curve/types.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  type Surface3,
} from '../surface/types.ts';
import { createNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { createNurbsSurface } from '../nurbs/surface.ts';
import { BrepBuilder, type Brep, type CoedgeUse, type EdgeId, type VertexId } from '../topology/brep.ts';
import { validateBrep } from '../topology/validate.ts';
import { validateBrepGeometry } from '../topology/geometry.ts';
import { parseRecord } from '../record/parse.ts';
import { recordTopology, type RecordTopology } from '../record/topology.ts';
import {
  RECORD_FORMAT,
  RECORD_VERSION,
  type BrepRecord,
  type CurveRecord,
  type FrameRecord,
  type PcurveRecord,
  type RecordVec3,
  type SurfaceRecord,
} from '../record/types.ts';

const OP_TO_RECORD = 'convert.brepToRecord';
const OP_TO_BREP = 'convert.recordToBrep';

// ---------------------------------------------------------------------------------------------------------
// Builder order.

const sameList = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const show = (xs: readonly number[]): string => `[${xs.join(', ')}]`;

/** The items of `parents.length` parents named by `parentOf`, in item order. */
function childrenByParent(count: number, parentOf: readonly number[]): number[][] {
  const out: number[][] = Array.from({ length: count }, () => []);
  parentOf.forEach((p, i) => out[p]?.push(i));
  return out;
}

/**
 * Why a range-checked record topology is not in builder order (see the module comment), as
 * `'<path>: <reason>'`, or `undefined` when it is. Only index comparisons.
 */
export function builderOrderIssue(t: RecordTopology): string | undefined {
  const lists: readonly [string, string, readonly (readonly number[])[], readonly number[]][] = [
    ['bodies', 'shells', t.bodies.map((b) => b.shells), t.shells.map((s) => s.body)],
    ['shells', 'faces', t.shells.map((s) => s.faces), t.faces.map((f) => f.shell)],
    ['faces', 'loops', t.faces.map((f) => f.loops), t.loops.map((l) => l.face)],
  ];
  for (const [parent, child, given, parentOf] of lists) {
    const want = childrenByParent(given.length, parentOf);
    for (const [i, g] of given.entries()) {
      const w = want[i]!;
      if (!sameList(g, w)) {
        return `${parent}[${i}].${child}: expected ${show(w)} (the ${child} naming ${parent}[${i}], ascending), found ${show(g)}`;
      }
    }
  }
  let c = 0;
  for (const [l, loop] of t.loops.entries()) {
    const start = c;
    while (c < t.coedges.length && t.coedges[c]!.loop === l) c++;
    const n = c - start;
    if (n === 0) {
      return c < t.coedges.length
        ? `coedges[${c}].loop: expected ${l} (coedges are stored loop by loop, in loop order), found ${t.coedges[c]!.loop}`
        : `loops[${l}]: the loop has no coedge`;
    }
    if (loop.first !== start) return `loops[${l}].first: expected ${start} (the loop's first stored coedge), found ${loop.first}`;
    for (let i = 0; i < n; i++) {
      const co = t.coedges[start + i]!;
      const next = start + ((i + 1) % n), prev = start + ((i + n - 1) % n);
      if (co.next !== next) return `coedges[${start + i}].next: expected ${next} (the loop's coedges in cycle order), found ${co.next}`;
      if (co.prev !== prev) return `coedges[${start + i}].prev: expected ${prev} (the loop's coedges in cycle order), found ${co.prev}`;
    }
  }
  if (c < t.coedges.length) {
    const l = t.coedges[c]!.loop;
    return `coedges[${c}].loop: found ${l}, whose coedges are stored before (coedges are stored loop by loop, in loop order)`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Kernel to record.

const rv = (v: Vec3): RecordVec3 => [v.x, v.y, v.z];
const rframe = (f: CurveFrame): FrameRecord => ({ normal: rv(f.normal), xAxis: rv(f.xAxis), yAxis: rv(f.yAxis) });

function curveData(c: Curve3): CurveRecord {
  switch (c.kind) {
    case 'line':
      return { kind: 'line', origin: rv(c.origin), direction: rv(c.direction), range: c.range };
    case 'circle':
      return { kind: 'circle', center: rv(c.center), frame: rframe(c.frame), radius: c.radius, range: c.range };
    case 'ellipse':
      return {
        kind: 'ellipse', center: rv(c.center), frame: rframe(c.frame), majorRadius: c.majorRadius, minorRadius: c.minorRadius, range: c.range,
      };
    case 'nurbs': {
      const n = c.curve;
      const base = { kind: 'nurbs' as const, degree: n.degree, knots: n.knots, points: n.controlPoints as readonly RecordVec3[] };
      return n.weights === undefined ? base : { ...base, weights: n.weights };
    }
  }
}

function surfaceData(s: Surface3): SurfaceRecord {
  switch (s.kind) {
    case 'plane':
      return { kind: 'plane', origin: rv(s.origin), frame: rframe(s.frame) };
    case 'cylinder':
      return { kind: 'cylinder', origin: rv(s.origin), frame: rframe(s.frame), radius: s.radius };
    case 'cone':
      return { kind: 'cone', origin: rv(s.origin), frame: rframe(s.frame), baseRadius: s.baseRadius, semiAngle: s.semiAngle };
    case 'sphere':
      return { kind: 'sphere', center: rv(s.center), frame: rframe(s.frame), radius: s.radius };
    case 'torus':
      return { kind: 'torus', center: rv(s.center), frame: rframe(s.frame), majorRadius: s.majorRadius, minorRadius: s.minorRadius };
    case 'nurbs': {
      const n = s.surface;
      const base = {
        kind: 'nurbs' as const,
        degreeU: n.degreeU,
        degreeV: n.degreeV,
        knotsU: n.knotsU,
        knotsV: n.knotsV,
        points: n.controlPoints as readonly (readonly RecordVec3[])[],
      };
      return n.weights === undefined ? base : { ...base, weights: n.weights };
    }
  }
}

function pcurveData(c: NurbsCurve): PcurveRecord {
  const base = { degree: c.degree, knots: c.knots, points: c.controlPoints as PcurveRecord['points'] };
  return c.weights === undefined ? base : { ...base, weights: c.weights };
}

/**
 * The record of a structurally valid B-rep in builder order (see the module comment). Fails with the
 * `validateBrep` error, or `invalid-input` (operation `convert.brepToRecord`) when the body is not in builder
 * order or a value cannot be held by a record (a non-finite number, a pcurve that is not 2D).
 */
export function brepToRecord(brep: Brep): Result<BrepRecord> {
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;
  const pcurves: PcurveRecord[] = [];
  const data = {
    format: RECORD_FORMAT,
    version: RECORD_VERSION,
    vertices: brep.vertices.map((v) => ({ p: rv(v.point) })),
    curves: brep.edges.map((e) => curveData(e.curve)),
    surfaces: brep.faces.map((f) => surfaceData(f.surface)),
    pcurves,
    edges: brep.edges.map((e, i) => ({ curve: i, t0: e.t0, t1: e.t1, start: e.start, end: e.end })),
    coedges: brep.coedges.map((c) => {
      const base = { edge: c.edge, reversed: c.reversed, loop: c.loop, next: c.next, prev: c.prev };
      if (c.pcurve === undefined) return base;
      pcurves.push(pcurveData(c.pcurve));
      return { ...base, pcurve: pcurves.length - 1 };
    }),
    loops: brep.loops.map((l) => ({ face: l.face, first: l.first })),
    faces: brep.faces.map((f, i) => ({ shell: f.shell, surface: i, loops: f.loops, reversed: f.reversed })),
    shells: brep.shells.map((s) => ({ body: s.body, faces: s.faces })),
    bodies: brep.bodies.map((b) => ({ shells: b.shells })),
  };
  const record = parseRecord(data);
  if (!record.ok) return invalidInput(OP_TO_RECORD, reasonOf(record.error));
  const order = builderOrderIssue(recordTopology(record.value));
  if (order !== undefined) return invalidInput(OP_TO_RECORD, order);
  return record;
}

// ---------------------------------------------------------------------------------------------------------
// Record to kernel.

function reasonOf(e: SolidError): string {
  return e.kind === 'invalid-input' || e.kind === 'invalid-topology' ? e.reason : e.kind;
}

/** A kernel constructor's failure, prefixed with the record path. */
const at = <T>(path: string, e: SolidError): Result<T> => invalidInput(OP_TO_BREP, `${path}: ${reasonOf(e)} (${e.operation})`);

const kv = (v: RecordVec3): Vec3 => vec3(v[0], v[1], v[2]);

/** The stored frame, when the kernel's `storedFrameMismatch` accepts it against the frame `k` it built. */
function adoptFrame(path: string, stored: FrameRecord, k: CurveFrame): Result<CurveFrame> {
  const frame = { normal: freezeVec(kv(stored.normal)), xAxis: freezeVec(kv(stored.xAxis)), yAxis: freezeVec(kv(stored.yAxis)) };
  const bad = storedFrameMismatch(frame, k);
  if (bad !== undefined) {
    return invalidInput(OP_TO_BREP, `${path}.frame.${bad}: the frame is not orthonormal and right-handed (the kernel's frame differs by more than ${ROUNDING_SLACK})`);
  }
  return ok(Object.freeze(frame));
}

/** A kernel value made with a frame, with the stored frame adopted. */
function withFrame<T extends { readonly frame: CurveFrame }>(path: string, made: Result<T>, stored: FrameRecord): Result<T> {
  if (!made.ok) return at(path, made.error);
  const frame = adoptFrame(path, stored, made.value.frame);
  if (!frame.ok) return frame;
  return ok(Object.freeze({ ...made.value, frame: frame.value }));
}

function toCurve(kernel: Kernel, path: string, c: CurveRecord): Result<Curve3> {
  switch (c.kind) {
    case 'line': {
      const r = createLineCurve(kv(c.origin), kv(c.direction), c.range);
      return r.ok ? r : at(path, r.error);
    }
    case 'circle':
      return withFrame(path, createCircleCurve(kernel, kv(c.center), kv(c.frame.normal), kv(c.frame.xAxis), c.radius, c.range), c.frame);
    case 'ellipse':
      return withFrame(
        path,
        createEllipseCurve(kernel, kv(c.center), kv(c.frame.normal), kv(c.frame.xAxis), c.majorRadius, c.minorRadius, c.range),
        c.frame,
      );
    case 'nurbs': {
      const n = createNurbsCurve(c.degree, c.knots, c.points, c.weights);
      if (!n.ok) return at(path, n.error);
      const r = createNurbsCurve3(n.value);
      return r.ok ? r : at(path, r.error);
    }
  }
}

function toSurface(kernel: Kernel, path: string, s: SurfaceRecord): Result<Surface3> {
  switch (s.kind) {
    case 'plane':
      return withFrame(path, createPlaneSurface(kernel, kv(s.origin), kv(s.frame.normal), kv(s.frame.xAxis)), s.frame);
    case 'cylinder':
      return withFrame(path, createCylinderSurface(kernel, kv(s.origin), kv(s.frame.normal), kv(s.frame.xAxis), s.radius), s.frame);
    case 'cone':
      return withFrame(
        path,
        createConeSurface(kernel, kv(s.origin), kv(s.frame.normal), kv(s.frame.xAxis), s.baseRadius, s.semiAngle),
        s.frame,
      );
    case 'sphere':
      return withFrame(path, createSphereSurface(kernel, kv(s.center), kv(s.frame.normal), kv(s.frame.xAxis), s.radius), s.frame);
    case 'torus':
      return withFrame(
        path,
        createTorusSurface(kernel, kv(s.center), kv(s.frame.normal), kv(s.frame.xAxis), s.majorRadius, s.minorRadius),
        s.frame,
      );
    case 'nurbs': {
      const n = createNurbsSurface(s.degreeU, s.degreeV, s.knotsU, s.knotsV, s.points, s.weights);
      if (!n.ok) return at(path, n.error);
      const r = createNurbsSurface3(n.value);
      return r.ok ? r : at(path, r.error);
    }
  }
}

function toPcurve(path: string, c: PcurveRecord): Result<NurbsCurve> {
  const r = createNurbsCurve(c.degree, c.knots, c.points, c.weights);
  return r.ok ? r : at(path, r.error);
}

/** Options of `recordToBrep`. */
export interface RecordToBrepOptions {
  /** Validate the geometry against the topology (`validateBrepGeometry`, the default) or only the topology (`validateBrep`). */
  readonly checkGeometry?: boolean;
}

/**
 * The B-rep of a record (see the module comment): the record re-checked, its geometry rebuilt by the kernel's
 * constructors, the body assembled by `BrepBuilder` and validated. Fails with `invalid-input` (record
 * structure, builder order, a constructor's refusal, a frame that is not orthonormal) naming the record path,
 * or with the validation error of the built body.
 */
export function recordToBrep(kernel: Kernel, record: BrepRecord, options: RecordToBrepOptions = {}): Result<Brep> {
  const parsed = parseRecord(record);
  if (!parsed.ok) return invalidInput(OP_TO_BREP, reasonOf(parsed.error));
  const r = parsed.value;
  const order = builderOrderIssue(recordTopology(r));
  if (order !== undefined) return invalidInput(OP_TO_BREP, order);

  const curves: Curve3[] = [];
  for (const [i, c] of r.curves.entries()) {
    const k = toCurve(kernel, `curves[${i}]`, c);
    if (!k.ok) return k;
    curves.push(k.value);
  }
  const surfaces: Surface3[] = [];
  for (const [i, s] of r.surfaces.entries()) {
    const k = toSurface(kernel, `surfaces[${i}]`, s);
    if (!k.ok) return k;
    surfaces.push(k.value);
  }
  const pcurves: NurbsCurve[] = [];
  for (const [i, c] of r.pcurves.entries()) {
    const k = toPcurve(`pcurves[${i}]`, c);
    if (!k.ok) return k;
    pcurves.push(k.value);
  }

  // Ids are in range and in builder order (checked above), so the builder never throws here.
  const b = new BrepBuilder();
  const vs: VertexId[] = r.vertices.map((v) => b.addVertex(freezeVec(kv(v.p))));
  const es: EdgeId[] = r.edges.map((e) => b.addEdge(vs[e.start]!, vs[e.end]!, curves[e.curve]!, e.t0, e.t1));
  const bodies = r.bodies.map(() => b.addBody());
  const shells = r.shells.map((s) => b.addShell(bodies[s.body]!));
  const faces = r.faces.map((f) => b.addFace(shells[f.shell]!, surfaces[f.surface]!, f.reversed));
  // Coedges are stored loop by loop: loop `l` owns the run of coedges whose `loop` is `l`.
  const runs: CoedgeUse[][] = r.loops.map(() => []);
  for (const co of r.coedges) {
    const use: CoedgeUse = co.pcurve === undefined
      ? { edge: es[co.edge]!, reversed: co.reversed }
      : { edge: es[co.edge]!, reversed: co.reversed, pcurve: pcurves[co.pcurve]! };
    runs[co.loop]!.push(use);
  }
  r.loops.forEach((l, i) => b.addLoop(faces[l.face]!, runs[i]!));
  const brep = b.build();

  const valid = options.checkGeometry === false ? validateBrep(brep) : validateBrepGeometry(kernel, brep);
  return valid.ok ? ok(brep) : valid;
}
