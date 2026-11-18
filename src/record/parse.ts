/**
 * Reading a record: `parseRecord(json)` checks the structure of untrusted plain data and returns a frozen,
 * branded `BrepRecord`; `parseRecordText(text)` does the same from JSON text.
 *
 * The checks are structural only (no maths): the envelope (`format`, `version`); every object a plain object
 * with exactly the known fields (unknown fields, such as `"__proto__"`, are refused, upstream's
 * `deny_unknown_fields`); data properties only (no accessors run); arrays plain (`Array.prototype`; their
 * non-index properties are never read), dense and within the item budget
 * `MAX_RECORD_ITEMS`, which is charged before an array is walked, so a huge declared length costs nothing;
 * tagged unions by `kind`; numbers finite (`-0` read as `0`); indices non-negative safe integers; booleans;
 * fixed-size tuples; NURBS counts by integer arithmetic on lengths only (`1 <= degree <= MAX_RECORD_DEGREE`,
 * `points.length >= degree + 1`, `knots.length === points.length + degree + 1`, one weight per point, equal
 * net rows); and finally every index in range (`topologyRangeIssue`, the Lean-modelled check). The reader
 * walks the fixed schema, never the input's own nesting, so deep nesting is refused at the first level
 * where a number or tuple is expected.
 *
 * Every failure is `invalid-input` (operation `record.parseRecord`) whose reason starts with the path of the
 * offending field, e.g. `'faces[3].loops[0]: index 12 out of range (5 loops)'` or
 * `'curves[1].knots: expected 7 knots (4 points + degree 2 + 1), found 6'`. Nothing is thrown: exceptions
 * raised by exotic inputs (proxies) are caught and reported as `invalid-input`.
 *
 * Upstream consulted: `solidcore/crates/solidcore-record/src/brep.rs` (`Brep::validate`: budget, finite
 * numbers, knot counts; tagged kinds; unknown fields refused), `crates/solidcore-record/src/native.rs` (the
 * versioned envelope) — SolidCraft / solidcore, Apache-2.0 OR MIT. Not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { recordTopology, topologyRangeIssue } from './topology.ts';
import {
  MAX_RECORD_DEGREE,
  MAX_RECORD_ITEMS,
  RECORD_FORMAT,
  RECORD_VERSION,
  type BodyRecord,
  type BrepRecord,
  type BrepRecordData,
  type CoedgeRecord,
  type CurveRecord,
  type EdgeRecord,
  type FaceRecord,
  type FrameRecord,
  type LoopRecord,
  type PcurveRecord,
  type RecordVec2,
  type RecordVec3,
  type ShellRecord,
  type SurfaceRecord,
  type VertexRecord,
} from './types.ts';

const OP = 'record.parseRecord';

/** A failed read: the path-precise reason. */
class Bad {
  readonly reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }
}
const bad = (path: string, message: string): Bad => new Bad(`${path}: ${message}`);
type P<T> = T | Bad;

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : String(v);
  if (typeof v === 'string') return 'a string';
  return `a ${typeof v}`;
}

/** The item budget shared by the reads of one input. */
class Budget {
  remaining = MAX_RECORD_ITEMS;
}

/** The own data properties of a plain object with exactly the `required` and (some of the) `optional` keys. */
function readObject(
  path: string,
  v: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): P<Readonly<Record<string, unknown>>> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad(path, `expected an object, found ${describe(v)}`);
  const proto: unknown = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return bad(path, 'expected a plain object');
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string') return bad(path, 'unexpected symbol key');
    if (!required.includes(key) && !optional.includes(key)) return bad(path, `unknown field '${key}'`);
    const d = Object.getOwnPropertyDescriptor(v, key);
    if (d === undefined || !('value' in d)) return bad(`${path}.${key}`, 'expected a data property');
    out[key] = d.value;
  }
  for (const key of required) if (!(key in out)) return bad(path, `missing field '${key}'`);
  return out;
}

/** The items of a dense array, charged to the budget before they are read. */
function readArray(path: string, v: unknown, budget: Budget): P<readonly unknown[]> {
  if (!Array.isArray(v)) return bad(path, `expected an array, found ${describe(v)}`);
  if (Object.getPrototypeOf(v) !== Array.prototype) return bad(path, 'expected a plain array');
  const n = v.length;
  if (n > budget.remaining) return bad(path, `array of ${n} items exceeds the record budget of ${MAX_RECORD_ITEMS} items`);
  budget.remaining -= n;
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const d = Object.getOwnPropertyDescriptor(v, i);
    if (d === undefined) return bad(`${path}[${i}]`, 'missing item (sparse array)');
    if (!('value' in d)) return bad(`${path}[${i}]`, 'expected a data property');
    out.push(d.value);
  }
  return out;
}

/** Reads every item of an array with `item`, freezing the result. */
function readList<T>(path: string, v: unknown, budget: Budget, item: (path: string, v: unknown) => P<T>): P<readonly T[]> {
  const xs = readArray(path, v, budget);
  if (xs instanceof Bad) return xs;
  const out: T[] = [];
  for (const [i, x] of xs.entries()) {
    const y = item(`${path}[${i}]`, x);
    if (y instanceof Bad) return y;
    out.push(y);
  }
  return Object.freeze(out);
}

function readNumber(path: string, v: unknown): P<number> {
  if (typeof v !== 'number') return bad(path, `expected a number, found ${describe(v)}`);
  if (!Number.isFinite(v)) return bad(path, `expected a finite number, found ${describe(v)}`);
  return v === 0 ? 0 : v;
}

function readIndex(path: string, v: unknown): P<number> {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
    return bad(path, `expected a non-negative integer index, found ${describe(v)}`);
  }
  return v === 0 ? 0 : v;
}

function readBoolean(path: string, v: unknown): P<boolean> {
  return typeof v === 'boolean' ? v : bad(path, `expected a boolean, found ${describe(v)}`);
}

function readTuple(path: string, v: unknown, size: number, budget: Budget): P<readonly number[]> {
  const xs = readArray(path, v, budget);
  if (xs instanceof Bad) return xs;
  if (xs.length !== size) return bad(path, `expected ${size} numbers, found ${xs.length} items`);
  const out: number[] = [];
  for (const [i, x] of xs.entries()) {
    const n = readNumber(`${path}[${i}]`, x);
    if (n instanceof Bad) return n;
    out.push(n);
  }
  return Object.freeze(out);
}

const readVec3 = (budget: Budget) => (path: string, v: unknown): P<RecordVec3> =>
  readTuple(path, v, 3, budget) as P<RecordVec3>;
const readVec2 = (budget: Budget) => (path: string, v: unknown): P<RecordVec2> =>
  readTuple(path, v, 2, budget) as P<RecordVec2>;

function readFrame(path: string, v: unknown, budget: Budget): P<FrameRecord> {
  const o = readObject(path, v, ['normal', 'xAxis', 'yAxis']);
  if (o instanceof Bad) return o;
  const normal = readVec3(budget)(`${path}.normal`, o['normal']);
  if (normal instanceof Bad) return normal;
  const xAxis = readVec3(budget)(`${path}.xAxis`, o['xAxis']);
  if (xAxis instanceof Bad) return xAxis;
  const yAxis = readVec3(budget)(`${path}.yAxis`, o['yAxis']);
  if (yAxis instanceof Bad) return yAxis;
  return Object.freeze({ normal, xAxis, yAxis });
}

/** Reads named number fields of `o`, in order. */
function readNumbers<K extends string>(path: string, o: Readonly<Record<string, unknown>>, keys: readonly K[]): P<Record<K, number>> {
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const n = readNumber(`${path}.${k}`, o[k]);
    if (n instanceof Bad) return n;
    out[k] = n;
  }
  return out;
}

function readDegree(path: string, v: unknown): P<number> {
  const d = readIndex(path, v);
  if (d instanceof Bad) return bad(path, `expected an integer degree in [1, ${MAX_RECORD_DEGREE}], found ${describe(v)}`);
  if (d < 1 || d > MAX_RECORD_DEGREE) return bad(path, `expected an integer degree in [1, ${MAX_RECORD_DEGREE}], found ${d}`);
  return d;
}

/** The knot vector of `count` control points of `degree`: `count >= degree + 1`, `count + degree + 1` knots. */
function readKnots(path: string, pointsPath: string, v: unknown, count: number, degree: number, budget: Budget): P<readonly number[]> {
  if (count < degree + 1) return bad(pointsPath, `expected at least ${degree + 1} control points for degree ${degree}, found ${count}`);
  const knots = readList(path, v, budget, readNumber);
  if (knots instanceof Bad) return knots;
  const want = count + degree + 1;
  if (knots.length !== want) {
    return bad(path, `expected ${want} knots (${count} points + degree ${degree} + 1), found ${knots.length}`);
  }
  return knots;
}

/** Fields shared by 3D and 2D NURBS curves. */
function readNurbsCurveFields<T>(
  path: string,
  o: Readonly<Record<string, unknown>>,
  budget: Budget,
  point: (path: string, v: unknown) => P<T>,
): P<{ degree: number; knots: readonly number[]; points: readonly T[]; weights?: readonly number[] }> {
  const degree = readDegree(`${path}.degree`, o['degree']);
  if (degree instanceof Bad) return degree;
  const points = readList(`${path}.points`, o['points'], budget, point);
  if (points instanceof Bad) return points;
  const knots = readKnots(`${path}.knots`, `${path}.points`, o['knots'], points.length, degree, budget);
  if (knots instanceof Bad) return knots;
  if (!('weights' in o)) return { degree, knots, points };
  const weights = readList(`${path}.weights`, o['weights'], budget, readNumber);
  if (weights instanceof Bad) return weights;
  if (weights.length !== points.length) {
    return bad(`${path}.weights`, `expected ${points.length} weights (one per point), found ${weights.length}`);
  }
  return { degree, knots, points, weights };
}

const CURVE_KINDS = ['line', 'circle', 'ellipse', 'nurbs'] as const;
const SURFACE_KINDS = ['plane', 'cylinder', 'cone', 'sphere', 'torus', 'nurbs'] as const;

/** The `kind` of a tagged object, read before its other fields. */
function readKind<K extends string>(path: string, v: unknown, kinds: readonly K[]): P<K> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad(path, `expected an object, found ${describe(v)}`);
  const d = Object.getOwnPropertyDescriptor(v, 'kind');
  if (d === undefined) return bad(path, "missing field 'kind'");
  if (!('value' in d)) return bad(`${path}.kind`, 'expected a data property');
  const k: unknown = d.value;
  if (typeof k !== 'string' || !(kinds as readonly string[]).includes(k)) {
    return bad(`${path}.kind`, `expected one of ${kinds.map((x) => `'${x}'`).join(', ')}`);
  }
  return k as K;
}

function readCurve(budget: Budget) {
  return (path: string, v: unknown): P<CurveRecord> => {
    const kind = readKind(path, v, CURVE_KINDS);
    if (kind instanceof Bad) return kind;
    const vec3 = readVec3(budget);
    switch (kind) {
      case 'line': {
        const o = readObject(path, v, ['kind', 'origin', 'direction', 'range']);
        if (o instanceof Bad) return o;
        const origin = vec3(`${path}.origin`, o['origin']);
        if (origin instanceof Bad) return origin;
        const direction = vec3(`${path}.direction`, o['direction']);
        if (direction instanceof Bad) return direction;
        const range = readVec2(budget)(`${path}.range`, o['range']);
        if (range instanceof Bad) return range;
        return Object.freeze({ kind, origin, direction, range });
      }
      case 'circle':
      case 'ellipse': {
        const radii = kind === 'circle' ? (['radius'] as const) : (['majorRadius', 'minorRadius'] as const);
        const o = readObject(path, v, ['kind', 'center', 'frame', ...radii, 'range']);
        if (o instanceof Bad) return o;
        const center = vec3(`${path}.center`, o['center']);
        if (center instanceof Bad) return center;
        const frame = readFrame(`${path}.frame`, o['frame'], budget);
        if (frame instanceof Bad) return frame;
        const r = readNumbers(path, o, radii);
        if (r instanceof Bad) return r;
        const range = readVec2(budget)(`${path}.range`, o['range']);
        if (range instanceof Bad) return range;
        return Object.freeze(
          kind === 'circle'
            ? { kind, center, frame, radius: (r as Record<'radius', number>).radius, range }
            : { kind, center, frame, ...(r as Record<'majorRadius' | 'minorRadius', number>), range },
        ) as CurveRecord;
      }
      case 'nurbs': {
        const o = readObject(path, v, ['kind', 'degree', 'knots', 'points'], ['weights']);
        if (o instanceof Bad) return o;
        const f = readNurbsCurveFields(path, o, budget, vec3);
        if (f instanceof Bad) return f;
        return Object.freeze({ kind, ...f });
      }
    }
  };
}

function readSurface(budget: Budget) {
  return (path: string, v: unknown): P<SurfaceRecord> => {
    const kind = readKind(path, v, SURFACE_KINDS);
    if (kind instanceof Bad) return kind;
    if (kind === 'nurbs') return readNurbsSurface(path, v, budget);
    const at = kind === 'sphere' || kind === 'torus' ? 'center' : 'origin';
    const scalars: readonly string[] = {
      plane: [],
      cylinder: ['radius'],
      cone: ['baseRadius', 'semiAngle'],
      sphere: ['radius'],
      torus: ['majorRadius', 'minorRadius'],
    }[kind];
    const o = readObject(path, v, ['kind', at, 'frame', ...scalars]);
    if (o instanceof Bad) return o;
    const point = readVec3(budget)(`${path}.${at}`, o[at]);
    if (point instanceof Bad) return point;
    const frame = readFrame(`${path}.frame`, o['frame'], budget);
    if (frame instanceof Bad) return frame;
    const nums = readNumbers(path, o, scalars);
    if (nums instanceof Bad) return nums;
    return Object.freeze({ kind, [at]: point, frame, ...nums }) as unknown as SurfaceRecord;
  };
}

function readNurbsSurface(path: string, v: unknown, budget: Budget): P<SurfaceRecord> {
  const o = readObject(path, v, ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'points'], ['weights']);
  if (o instanceof Bad) return o;
  const degreeU = readDegree(`${path}.degreeU`, o['degreeU']);
  if (degreeU instanceof Bad) return degreeU;
  const degreeV = readDegree(`${path}.degreeV`, o['degreeV']);
  if (degreeV instanceof Bad) return degreeV;
  const points = readList(`${path}.points`, o['points'], budget, (p, row) => readList(p, row, budget, readVec3(budget)));
  if (points instanceof Bad) return points;
  const cols = points[0]?.length ?? 0;
  for (const [i, row] of points.entries()) {
    if (row.length !== cols) return bad(`${path}.points[${i}]`, `expected ${cols} points (the length of row 0), found ${row.length}`);
  }
  const knotsU = readKnots(`${path}.knotsU`, `${path}.points`, o['knotsU'], points.length, degreeU, budget);
  if (knotsU instanceof Bad) return knotsU;
  const knotsV = readKnots(`${path}.knotsV`, `${path}.points[0]`, o['knotsV'], cols, degreeV, budget);
  if (knotsV instanceof Bad) return knotsV;
  const base = { kind: 'nurbs' as const, degreeU, degreeV, knotsU, knotsV, points };
  if (!('weights' in o)) return Object.freeze(base);
  const weights = readList(`${path}.weights`, o['weights'], budget, (p, row) => readList(p, row, budget, readNumber));
  if (weights instanceof Bad) return weights;
  if (weights.length !== points.length) {
    return bad(`${path}.weights`, `expected ${points.length} weight rows (one per point row), found ${weights.length}`);
  }
  for (const [i, row] of weights.entries()) {
    if (row.length !== cols) return bad(`${path}.weights[${i}]`, `expected ${cols} weights, found ${row.length}`);
  }
  return Object.freeze({ ...base, weights });
}

function readPcurve(budget: Budget) {
  return (path: string, v: unknown): P<PcurveRecord> => {
    const o = readObject(path, v, ['degree', 'knots', 'points'], ['weights']);
    if (o instanceof Bad) return o;
    const f = readNurbsCurveFields(path, o, budget, readVec2(budget));
    if (f instanceof Bad) return f;
    return Object.freeze(f);
  };
}

function readVertex(budget: Budget) {
  return (path: string, v: unknown): P<VertexRecord> => {
    const o = readObject(path, v, ['p']);
    if (o instanceof Bad) return o;
    const p = readVec3(budget)(`${path}.p`, o['p']);
    return p instanceof Bad ? p : Object.freeze({ p });
  };
}

/** Reads the named index fields of `o`, in order. */
function readIndices<K extends string>(path: string, o: Readonly<Record<string, unknown>>, keys: readonly K[]): P<Record<K, number>> {
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const n = readIndex(`${path}.${k}`, o[k]);
    if (n instanceof Bad) return n;
    out[k] = n;
  }
  return out;
}

function readEdge(path: string, v: unknown): P<EdgeRecord> {
  const o = readObject(path, v, ['curve', 't0', 't1', 'start', 'end']);
  if (o instanceof Bad) return o;
  const curve = readIndex(`${path}.curve`, o['curve']);
  if (curve instanceof Bad) return curve;
  const t = readNumbers(path, o, ['t0', 't1'] as const);
  if (t instanceof Bad) return t;
  const ends = readIndices(path, o, ['start', 'end'] as const);
  if (ends instanceof Bad) return ends;
  return Object.freeze({ curve, t0: t.t0, t1: t.t1, start: ends.start, end: ends.end });
}

function readCoedge(path: string, v: unknown): P<CoedgeRecord> {
  const o = readObject(path, v, ['edge', 'reversed', 'loop', 'next', 'prev'], ['pcurve']);
  if (o instanceof Bad) return o;
  const edge = readIndex(`${path}.edge`, o['edge']);
  if (edge instanceof Bad) return edge;
  const reversed = readBoolean(`${path}.reversed`, o['reversed']);
  if (reversed instanceof Bad) return reversed;
  const links = readIndices(path, o, ['loop', 'next', 'prev'] as const);
  if (links instanceof Bad) return links;
  const base = { edge, reversed, loop: links.loop, next: links.next, prev: links.prev };
  if (!('pcurve' in o)) return Object.freeze(base);
  const pcurve = readIndex(`${path}.pcurve`, o['pcurve']);
  return pcurve instanceof Bad ? pcurve : Object.freeze({ ...base, pcurve });
}

function readLoop(path: string, v: unknown): P<LoopRecord> {
  const o = readObject(path, v, ['face', 'first']);
  if (o instanceof Bad) return o;
  const f = readIndices(path, o, ['face', 'first'] as const);
  return f instanceof Bad ? f : Object.freeze({ face: f.face, first: f.first });
}

function readFace(budget: Budget) {
  return (path: string, v: unknown): P<FaceRecord> => {
    const o = readObject(path, v, ['shell', 'surface', 'loops', 'reversed']);
    if (o instanceof Bad) return o;
    const f = readIndices(path, o, ['shell', 'surface'] as const);
    if (f instanceof Bad) return f;
    const loops = readList(`${path}.loops`, o['loops'], budget, readIndex);
    if (loops instanceof Bad) return loops;
    const reversed = readBoolean(`${path}.reversed`, o['reversed']);
    if (reversed instanceof Bad) return reversed;
    return Object.freeze({ shell: f.shell, surface: f.surface, loops, reversed });
  };
}

function readShell(budget: Budget) {
  return (path: string, v: unknown): P<ShellRecord> => {
    const o = readObject(path, v, ['body', 'faces']);
    if (o instanceof Bad) return o;
    const body = readIndex(`${path}.body`, o['body']);
    if (body instanceof Bad) return body;
    const faces = readList(`${path}.faces`, o['faces'], budget, readIndex);
    return faces instanceof Bad ? faces : Object.freeze({ body, faces });
  };
}

function readBody(budget: Budget) {
  return (path: string, v: unknown): P<BodyRecord> => {
    const o = readObject(path, v, ['shells']);
    if (o instanceof Bad) return o;
    const shells = readList(`${path}.shells`, o['shells'], budget, readIndex);
    return shells instanceof Bad ? shells : Object.freeze({ shells });
  };
}

const ROOT_KEYS = [
  'format', 'version', 'vertices', 'curves', 'surfaces', 'pcurves', 'edges', 'coedges', 'loops', 'faces', 'shells', 'bodies',
] as const;

function readRecord(json: unknown): P<BrepRecordData> {
  const budget = new Budget();
  const o = readObject('(root)', json, ROOT_KEYS);
  if (o instanceof Bad) return o;
  if (o['format'] !== RECORD_FORMAT) return bad('format', `expected '${RECORD_FORMAT}', found ${describe(o['format'])}`);
  const version = o['version'];
  if (version !== RECORD_VERSION) {
    return bad('version', `unsupported version ${describe(version)} (this reader reads version ${RECORD_VERSION})`);
  }
  const vertices = readList('vertices', o['vertices'], budget, readVertex(budget));
  if (vertices instanceof Bad) return vertices;
  const curves = readList('curves', o['curves'], budget, readCurve(budget));
  if (curves instanceof Bad) return curves;
  const surfaces = readList('surfaces', o['surfaces'], budget, readSurface(budget));
  if (surfaces instanceof Bad) return surfaces;
  const pcurves = readList('pcurves', o['pcurves'], budget, readPcurve(budget));
  if (pcurves instanceof Bad) return pcurves;
  const edges = readList('edges', o['edges'], budget, readEdge);
  if (edges instanceof Bad) return edges;
  const coedges = readList('coedges', o['coedges'], budget, readCoedge);
  if (coedges instanceof Bad) return coedges;
  const loops = readList('loops', o['loops'], budget, readLoop);
  if (loops instanceof Bad) return loops;
  const faces = readList('faces', o['faces'], budget, readFace(budget));
  if (faces instanceof Bad) return faces;
  const shells = readList('shells', o['shells'], budget, readShell(budget));
  if (shells instanceof Bad) return shells;
  const bodies = readList('bodies', o['bodies'], budget, readBody(budget));
  if (bodies instanceof Bad) return bodies;
  const record: BrepRecordData = Object.freeze({
    format: RECORD_FORMAT,
    version: RECORD_VERSION,
    vertices,
    curves,
    surfaces,
    pcurves,
    edges,
    coedges,
    loops,
    faces,
    shells,
    bodies,
  });
  const issue = topologyRangeIssue(recordTopology(record));
  return issue === undefined ? record : new Bad(issue);
}

/**
 * Checks the structure of `json` (plain data, e.g. from `JSON.parse`) and returns it as a frozen record (see
 * the module comment). Never throws.
 */
export function parseRecord(json: unknown): Result<BrepRecord> {
  let r: P<BrepRecordData>;
  try {
    r = readRecord(json);
  } catch {
    // Only exotic objects (proxies whose traps throw) can get here: the reader itself runs no input code.
    return invalidInput(OP, '(root): the input threw while being read');
  }
  return r instanceof Bad ? invalidInput(OP, r.reason) : ok(r as BrepRecord);
}

/** `parseRecord` of JSON text; text that is not JSON fails with `invalid-input` (operation `record.parseRecordText`). */
export function parseRecordText(text: string): Result<BrepRecord> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return invalidInput('record.parseRecordText', '(root): not JSON text');
  }
  return parseRecord(json);
}
