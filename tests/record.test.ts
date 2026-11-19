import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { vec3 } from '../src/math/vec.ts';
import { makeBox } from '../src/primitive/box.ts';
import { brepToRecord } from '../src/convert/index.ts';
import {
  MAX_RECORD_DEGREE,
  MAX_RECORD_ITEMS,
  checkRecordTopology,
  decodeRecordTopology,
  encodeRecordTopology,
  parseRecord,
  parseRecordText,
  recordTopology,
  stringifyRecord,
  topologyRangeIssue,
  type BrepRecord,
  type RecordTopology,
} from '../src/record/index.ts';

const k = createKernel();
const boxRecord = (): BrepRecord => unwrap(brepToRecord(unwrap(makeBox(k, vec3(0.1, -2, 3), 1.5, 2, 3.25))));
const BOX = boxRecord();
const BOX_TEXT = stringifyRecord(BOX);

/** A mutable JSON copy of the box record. */
type Json = any;
const fresh = (): Json => JSON.parse(BOX_TEXT);

function expectReason(r: Result<unknown>, reason: string, operation = 'record.parseRecord'): void {
  assert.equal(r.ok, false, `expected failure: ${reason}`);
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-input');
  if (r.error.kind !== 'invalid-input') return;
  assert.equal(r.error.operation, operation);
  assert.equal(r.error.reason, reason);
}

/** Mutates a fresh copy and expects `parseRecord` to fail with exactly `reason`. */
function rejects(mutate: (j: Json) => void, reason: string): void {
  const j = fresh();
  mutate(j);
  expectReason(parseRecord(j), reason);
}

const nurbsCurve = (): Json => ({ kind: 'nurbs', degree: 2, knots: [0, 0, 0, 1, 1, 1], points: [[0, 0, 0], [1, 1, 0], [2, 0, 0]] });
const nurbsSurface = (): Json => ({
  kind: 'nurbs',
  degreeU: 1,
  degreeV: 1,
  knotsU: [0, 0, 1, 1],
  knotsV: [0, 0, 1, 1],
  points: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]],
});

// ---------------------------------------------------------------------------------------------------------
// Shape and round trip.

test('the box record: counts, envelope and deep freezing', () => {
  assert.equal(BOX.format, 'cadloom-brep');
  assert.equal(BOX.version, 1);
  assert.deepEqual(
    [BOX.vertices, BOX.curves, BOX.surfaces, BOX.pcurves, BOX.edges, BOX.coedges, BOX.loops, BOX.faces, BOX.shells, BOX.bodies].map((a) => a.length),
    [8, 12, 6, 24, 12, 24, 6, 6, 1, 1],
  );
  assert.ok(Object.isFrozen(BOX) && Object.isFrozen(BOX.faces) && Object.isFrozen(BOX.faces[0]) && Object.isFrozen(BOX.faces[0]!.loops));
  assert.ok(Object.isFrozen(BOX.vertices[0]!.p) && Object.isFrozen(BOX.pcurves[0]!.knots));
  assert.ok(Object.isFrozen(BOX.surfaces[0]) && Object.isFrozen((BOX.surfaces[0] as { frame: object }).frame));
});

test('stringify(parse(stringify(r))) === stringify(r), and parse gives the record back field by field', () => {
  const again = unwrap(parseRecordText(BOX_TEXT));
  assert.equal(stringifyRecord(again), BOX_TEXT);
  assert.deepStrictEqual(again, BOX);
});

test('deterministic bytes: equal bodies give equal text; key order and whitespace of the input do not matter', () => {
  assert.equal(stringifyRecord(boxRecord()), BOX_TEXT);
  // Rebuild every object with its keys in reverse order, and pretty-print it.
  const reverseKeys = (v: Json): Json =>
    Array.isArray(v) ? v.map(reverseKeys) : typeof v === 'object' && v !== null
      ? Object.fromEntries(Object.keys(v).reverse().map((key) => [key, reverseKeys(v[key])]))
      : v;
  const pretty = JSON.stringify(reverseKeys(fresh()), null, 2);
  assert.notEqual(pretty, BOX_TEXT);
  assert.equal(stringifyRecord(unwrap(parseRecordText(pretty))), BOX_TEXT);
  // Canonical text: no whitespace, sorted keys.
  assert.ok(!/\s/.test(BOX_TEXT));
  assert.ok(BOX_TEXT.startsWith('{"bodies":[{"shells":[0]}],"coedges":[{"edge":0,"loop":0,"next":1,"pcurve":0,"prev":3,"reversed":false}'));
});

test('numbers: shortest round-trip text, -0 read as 0, extreme finite doubles kept exactly', () => {
  const values = [0.1 + 0.2, 1e-300, 5e-324, Number.MAX_VALUE, -123456.789e10, 1 / 3];
  const j = fresh();
  j.vertices[0].p = values.slice(0, 3);
  j.vertices[1].p = values.slice(3, 6);
  j.vertices[2].p = [-0, 0, -0];
  const r = unwrap(parseRecord(j));
  assert.deepStrictEqual([...r.vertices[0]!.p, ...r.vertices[1]!.p], values);
  assert.ok(r.vertices[2]!.p.every((x) => Object.is(x, 0)));
  const text = stringifyRecord(r);
  assert.ok(text.includes('[0.30000000000000004,1e-300,5e-324]'));
  assert.ok(text.includes('[0,0,0]'));
  const back = unwrap(parseRecordText(text));
  assert.deepStrictEqual(back, r);
  assert.equal(stringifyRecord(back), text);
});

test('every curve and surface kind parses and round-trips through text, optional weights kept or omitted', () => {
  const j = fresh();
  const frame = { normal: [0, 0, 1], xAxis: [1, 0, 0], yAxis: [0, 1, 0] };
  j.curves[0] = { kind: 'circle', center: [0, 0, 0], frame, radius: 2, range: [0, 1] };
  j.curves[1] = { kind: 'ellipse', center: [0, 0, 0], frame, majorRadius: 3, minorRadius: 2, range: [0, 1] };
  j.curves[2] = { ...nurbsCurve(), weights: [1, 0.5, 1] };
  j.curves[3] = nurbsCurve();
  j.surfaces[0] = { kind: 'cylinder', origin: [0, 0, 0], frame, radius: 1 };
  j.surfaces[1] = { kind: 'cone', origin: [0, 0, 0], frame, baseRadius: 1, semiAngle: 0.3 };
  j.surfaces[2] = { kind: 'sphere', center: [0, 0, 0], frame, radius: 1 };
  j.surfaces[3] = { kind: 'torus', center: [0, 0, 0], frame, majorRadius: 3, minorRadius: 1 };
  j.surfaces[4] = nurbsSurface();
  j.surfaces[5] = { ...nurbsSurface(), weights: [[1, 2], [3, 4]] };
  j.pcurves[0] = { degree: 1, knots: [0, 0, 1, 1], points: [[0, 0], [1, 1]], weights: [1, 2] };
  const r = unwrap(parseRecord(j));
  assert.deepEqual(r.curves.map((c) => c.kind).slice(0, 5), ['circle', 'ellipse', 'nurbs', 'nurbs', 'line']);
  assert.deepEqual(r.surfaces.map((s) => s.kind), ['cylinder', 'cone', 'sphere', 'torus', 'nurbs', 'nurbs']);
  assert.ok(!('weights' in r.curves[3]!) && 'weights' in r.curves[2]!);
  const text = stringifyRecord(r);
  assert.equal(stringifyRecord(unwrap(parseRecordText(text))), text);
  assert.deepStrictEqual(unwrap(parseRecordText(text)), r);
});

// ---------------------------------------------------------------------------------------------------------
// Every validation error path, with its exact message.

test('envelope errors: not an object, unknown / missing fields, wrong format and version', () => {
  expectReason(parseRecord(42), '(root): expected an object, found 42');
  expectReason(parseRecord(null), '(root): expected an object, found null');
  expectReason(parseRecord([]), '(root): expected an object, found an array');
  expectReason(parseRecord('x'), '(root): expected an object, found a string');
  rejects((j) => (j.extra = 1), "(root): unknown field 'extra'");
  rejects((j) => delete j.bodies, "(root): missing field 'bodies'");
  rejects((j) => (j.format = 'other'), "format: expected 'cadloom-brep', found a string");
  rejects((j) => (j.version = 2), 'version: unsupported version 2 (this reader reads version 1)');
  rejects((j) => (j.version = '1'), 'version: unsupported version a string (this reader reads version 1)');
  expectReason(parseRecordText('{"format": '), '(root): not JSON text', 'record.parseRecordText');
});

test('number, tuple, boolean and index errors name the field', () => {
  rejects((j) => (j.vertices = {}), 'vertices: expected an array, found a object');
  rejects((j) => (j.vertices[0].p = [1, 2]), 'vertices[0].p: expected 3 numbers, found 2 items');
  rejects((j) => (j.vertices[0].p = [1, 2, 3, 4]), 'vertices[0].p: expected 3 numbers, found 4 items');
  rejects((j) => (j.vertices[0].p[1] = '2'), 'vertices[0].p[1]: expected a number, found a string');
  rejects((j) => (j.vertices[0].p[0] = NaN), 'vertices[0].p[0]: expected a finite number, found NaN');
  rejects((j) => (j.vertices[0].p[2] = Infinity), 'vertices[0].p[2]: expected a finite number, found Infinity');
  rejects((j) => (j.vertices[0].p[2] = null), 'vertices[0].p[2]: expected a number, found null');
  rejects((j) => (j.edges[0].t1 = -Infinity), 'edges[0].t1: expected a finite number, found -Infinity');
  rejects((j) => (j.edges[0].start = -1), 'edges[0].start: expected a non-negative integer index, found -1');
  rejects((j) => (j.edges[0].start = 1.5), 'edges[0].start: expected a non-negative integer index, found 1.5');
  rejects((j) => (j.edges[0].end = '3'), 'edges[0].end: expected a non-negative integer index, found a string');
  rejects((j) => (j.edges[0].curve = 2 ** 53), 'edges[0].curve: expected a non-negative integer index, found 9007199254740992');
  rejects((j) => (j.coedges[0].reversed = 'false'), 'coedges[0].reversed: expected a boolean, found a string');
  rejects((j) => (j.coedges[0].pcurve = null), 'coedges[0].pcurve: expected a non-negative integer index, found null');
  rejects((j) => (j.faces[1].reversed = 0), 'faces[1].reversed: expected a boolean, found 0');
  rejects((j) => (j.faces[1].loops = [true]), 'faces[1].loops[0]: expected a non-negative integer index, found a boolean');
  rejects((j) => (j.shells[0].faces = 3), 'shells[0].faces: expected an array, found 3');
  rejects((j) => (j.bodies[0] = [0]), 'bodies[0]: expected an object, found an array');
  rejects((j) => delete j.loops[2].first, "loops[2]: missing field 'first'");
  rejects((j) => (j.loops[2].firstt = 0), "loops[2]: unknown field 'firstt'");
});

test('index range errors, one per index field, in the order of the Lean validate', () => {
  rejects((j) => (j.edges[0].curve = 12), 'edges[0].curve: index 12 out of range (12 curves)');
  rejects((j) => (j.edges[1].start = 8), 'edges[1].start: index 8 out of range (8 vertices)');
  rejects((j) => (j.edges[2].end = 99), 'edges[2].end: index 99 out of range (8 vertices)');
  rejects((j) => (j.coedges[0].edge = 12), 'coedges[0].edge: index 12 out of range (12 edges)');
  rejects((j) => (j.coedges[1].loop = 6), 'coedges[1].loop: index 6 out of range (6 loops)');
  rejects((j) => (j.coedges[2].next = 24), 'coedges[2].next: index 24 out of range (24 coedges)');
  rejects((j) => (j.coedges[3].prev = 30), 'coedges[3].prev: index 30 out of range (24 coedges)');
  rejects((j) => (j.coedges[4].pcurve = 24), 'coedges[4].pcurve: index 24 out of range (24 pcurves)');
  rejects((j) => (j.loops[0].face = 6), 'loops[0].face: index 6 out of range (6 faces)');
  rejects((j) => (j.loops[1].first = 24), 'loops[1].first: index 24 out of range (24 coedges)');
  rejects((j) => (j.faces[0].shell = 1), 'faces[0].shell: index 1 out of range (1 shells)');
  rejects((j) => (j.faces[0].surface = 6), 'faces[0].surface: index 6 out of range (6 surfaces)');
  rejects((j) => (j.faces[3].loops[0] = 12), 'faces[3].loops[0]: index 12 out of range (6 loops)');
  rejects((j) => (j.shells[0].body = 1), 'shells[0].body: index 1 out of range (1 bodies)');
  rejects((j) => (j.shells[0].faces[5] = 6), 'shells[0].faces[5]: index 6 out of range (6 faces)');
  rejects((j) => (j.bodies[0].shells[0] = 1), 'bodies[0].shells[0]: index 1 out of range (1 shells)');
  // The first failing field (in validate order) is reported.
  rejects((j) => {
    j.bodies[0].shells[0] = 7;
    j.edges[11].end = 9;
  }, 'edges[11].end: index 9 out of range (8 vertices)');
});

test('tagged unions and NURBS count errors', () => {
  rejects((j) => (j.curves[0].kind = 'spline'), "curves[0].kind: expected one of 'line', 'circle', 'ellipse', 'nurbs'");
  rejects((j) => delete j.curves[0].kind, "curves[0]: missing field 'kind'");
  rejects((j) => (j.surfaces[0].kind = 'plane2'), "surfaces[0].kind: expected one of 'plane', 'cylinder', 'cone', 'sphere', 'torus', 'nurbs'");
  rejects((j) => (j.surfaces[0].radius = 1), "surfaces[0]: unknown field 'radius'");
  rejects((j) => (j.surfaces[0].kind = 'cylinder'), "surfaces[0]: missing field 'radius'");
  rejects((j) => (j.curves[0] = { kind: 'circle', center: [0, 0, 0], frame: { normal: [0, 0, 1], xAxis: [1, 0, 0] }, radius: 1, range: [0, 1] }),
    "curves[0].frame: missing field 'yAxis'");
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), knots: [0, 0, 0, 1, 1] }), 'curves[0].knots: expected 6 knots (3 points + degree 2 + 1), found 5');
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), degree: 0 }), `curves[0].degree: expected an integer degree in [1, ${MAX_RECORD_DEGREE}], found 0`);
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), degree: 65 }), `curves[0].degree: expected an integer degree in [1, ${MAX_RECORD_DEGREE}], found 65`);
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), degree: 1.5 }), `curves[0].degree: expected an integer degree in [1, ${MAX_RECORD_DEGREE}], found 1.5`);
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), degree: 3 }), 'curves[0].points: expected at least 4 control points for degree 3, found 3');
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), weights: [1, 1] }), 'curves[0].weights: expected 3 weights (one per point), found 2');
  rejects((j) => (j.curves[0] = { ...nurbsCurve(), points: [[0, 0, 0], [1, 1], [2, 0, 0]] }), 'curves[0].points[1]: expected 3 numbers, found 2 items');
  rejects((j) => (j.surfaces[0] = { ...nurbsSurface(), points: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0]]] }),
    'surfaces[0].points[1]: expected 2 points (the length of row 0), found 1');
  rejects((j) => (j.surfaces[0] = { ...nurbsSurface(), knotsV: [0, 0, 1] }), 'surfaces[0].knotsV: expected 4 knots (2 points + degree 1 + 1), found 3');
  rejects((j) => (j.surfaces[0] = { ...nurbsSurface(), degreeV: 2 }), 'surfaces[0].points[0]: expected at least 3 control points for degree 2, found 2');
  rejects((j) => (j.surfaces[0] = { ...nurbsSurface(), weights: [[1, 1]] }), 'surfaces[0].weights: expected 2 weight rows (one per point row), found 1');
  rejects((j) => (j.surfaces[0] = { ...nurbsSurface(), weights: [[1, 1], [1]] }), 'surfaces[0].weights[1]: expected 2 weights, found 1');
  rejects((j) => (j.pcurves[0].points[0] = [0, 0, 0]), 'pcurves[0].points[0]: expected 2 numbers, found 3 items');
  rejects((j) => (j.pcurves[0].kind = 'nurbs'), "pcurves[0]: unknown field 'kind'");
});

// ---------------------------------------------------------------------------------------------------------
// Hostile inputs: rejected without throwing.

test('hostile: "__proto__" keys are refused as unknown fields and pollute nothing', () => {
  const text = BOX_TEXT.replace('"p":[', '"__proto__":{"polluted":true},"p":[');
  expectReason(parseRecordText(text), "vertices[0]: unknown field '__proto__'");
  const root = BOX_TEXT.replace('{"bodies"', '{"__proto__":{"format":"cadloom-brep"},"bodies"');
  expectReason(parseRecordText(root), "(root): unknown field '__proto__'");
  assert.equal(({} as Json).polluted, undefined);
  // A prototype carrying the fields does not count: only own data properties are read.
  const inherited = Object.create(fresh());
  expectReason(parseRecord(inherited), '(root): expected a plain object');
  const constructorKey = fresh();
  constructorKey.edges[0].constructor = 1;
  expectReason(parseRecord(constructorKey), "edges[0]: unknown field 'constructor'");
});

test('hostile: huge declared array lengths are refused by the item budget before being walked', () => {
  const j = fresh();
  const huge: unknown[] = [];
  huge.length = 2 ** 32 - 1;
  j.vertices = huge;
  const c0 = process.cpuUsage();
  expectReason(parseRecord(j), `vertices: array of ${2 ** 32 - 1} items exceeds the record budget of ${MAX_RECORD_ITEMS} items`);
  const used = process.cpuUsage(c0); // CPU time, independent of the machine's load
  assert.ok((used.user + used.system) / 1000 < 1000);
  // A sparse array of an allowed length fails at its first hole.
  const sparse = fresh();
  sparse.faces[0].loops = [0, , 2];
  expectReason(parseRecord(sparse), 'faces[0].loops[1]: missing item (sparse array)');
  // The budget is shared across arrays: many medium arrays add up.
  const many = fresh();
  many.pcurves[0].knots = new Array(MAX_RECORD_ITEMS).fill(0);
  expectReason(parseRecord(many), 'pcurves[0].knots: array of 4000000 items exceeds the record budget of 4000000 items');
  // Declared NURBS sizes must match the actual arrays (integer checks only).
  rejects((j2) => (j2.curves[0] = { ...nurbsCurve(), knots: new Array(1000).fill(0) }), 'curves[0].knots: expected 6 knots (3 points + degree 2 + 1), found 1000');
});

test('hostile: deep nesting, accessors, symbols, proxies and non-plain objects', () => {
  let deep: unknown = 0;
  for (let i = 0; i < 100_000; i++) deep = [deep];
  rejects((j) => (j.vertices[0].p = deep), 'vertices[0].p: expected 3 numbers, found 1 items');
  rejects((j) => (j.vertices[0].p = [deep, 0, 0]), 'vertices[0].p[0]: expected a number, found an array');
  // Deeply nested JSON text: refused (by JSON.parse or by the reader), never thrown.
  const r = parseRecordText('['.repeat(200_000) + ']'.repeat(200_000));
  assert.equal(r.ok, false);
  // Accessors are never run.
  let calls = 0;
  const j = fresh();
  Object.defineProperty(j.vertices[0], 'p', { get: () => { calls++; return [0, 0, 0]; }, enumerable: true });
  expectReason(parseRecord(j), 'vertices[0].p: expected a data property');
  const arr = fresh();
  Object.defineProperty(arr.vertices[0].p, 1, { get: () => { calls++; return 0; } });
  expectReason(parseRecord(arr), 'vertices[0].p[1]: expected a data property');
  assert.equal(calls, 0);
  const sym = fresh();
  sym.edges[0][Symbol('x')] = 1;
  expectReason(parseRecord(sym), 'edges[0]: unexpected symbol key');
  const prox = new Proxy(fresh(), { ownKeys: () => { throw new Error('trap'); } });
  expectReason(parseRecord(prox), '(root): the input threw while being read');
  expectReason(parseRecord(new Date(0)), '(root): expected a plain object');
  const nullProto = Object.assign(Object.create(null), fresh());
  assert.equal(parseRecord(nullProto).ok, true);
});

// ---------------------------------------------------------------------------------------------------------
// The index structure and its Lean model (formal/CadloomFormal/Record.lean).

/** Deterministic pseudo-random generator (no Math.random). */
function lcg(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return n <= 0 ? 0 : s % n;
  };
}

/** A random topology whose indices are mostly in range, sometimes one past the end. */
function randomTopology(seed: number, slack: number): RecordTopology {
  const rnd = lcg(seed);
  const nE = 1 + rnd(5), nC = 1 + rnd(6), nL = 1 + rnd(4), nF = 1 + rnd(4), nS = 1 + rnd(3), nB = 1 + rnd(2);
  const counts = { vertices: 1 + rnd(5), curves: 1 + rnd(5), surfaces: 1 + rnd(4), pcurves: rnd(4) };
  const idx = (n: number): number => rnd(n + slack);
  const list = (n: number): number[] => Array.from({ length: rnd(4) }, () => idx(n));
  return {
    counts,
    edges: Array.from({ length: nE }, () => ({ curve: idx(counts.curves), start: idx(counts.vertices), end: idx(counts.vertices) })),
    coedges: Array.from({ length: nC }, () => ({
      edge: idx(nE), reversed: rnd(2) === 1, loop: idx(nL), next: idx(nC), prev: idx(nC), pcurve: rnd(2) === 0 ? null : idx(counts.pcurves),
    })),
    loops: Array.from({ length: nL }, () => ({ face: idx(nF), first: idx(nC) })),
    faces: Array.from({ length: nF }, () => ({ shell: idx(nS), surface: idx(counts.surfaces), reversed: rnd(2) === 1, loops: list(nL) })),
    shells: Array.from({ length: nS }, () => ({ body: idx(nB), faces: list(nF) })),
    bodies: Array.from({ length: nB }, () => ({ shells: list(nS) })),
  };
}

/** The Lean `InRange`, stated with lookups: every index field looks up an item. */
function allLookupsSucceed(t: RecordTopology): boolean {
  // A geometry arena of `n` items, looked up like the topology arenas (the Lean `xs.length = n → xs[i]?`).
  const has = (n: number, i: number): boolean => Array.from({ length: n }, (_, j) => j)[i] !== undefined;
  return t.edges.every((e) => has(t.counts.curves, e.curve) && has(t.counts.vertices, e.start) && has(t.counts.vertices, e.end)) &&
    t.coedges.every((c) => t.edges[c.edge] !== undefined && t.loops[c.loop] !== undefined && t.coedges[c.next] !== undefined &&
      t.coedges[c.prev] !== undefined && (c.pcurve === null || has(t.counts.pcurves, c.pcurve))) &&
    t.loops.every((l) => t.faces[l.face] !== undefined && t.coedges[l.first] !== undefined) &&
    t.faces.every((f) => t.shells[f.shell] !== undefined && has(t.counts.surfaces, f.surface) && f.loops.every((l) => t.loops[l] !== undefined)) &&
    t.shells.every((s) => t.bodies[s.body] !== undefined && s.faces.every((f) => t.faces[f] !== undefined)) &&
    t.bodies.every((b) => b.shells.every((s) => t.shells[s] !== undefined));
}

test('validate_iff / validate_complete / validate_sound_*: the range check passes exactly when every lookup succeeds', () => {
  let passed = 0, failed = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const t = randomTopology(seed, seed % 3 === 0 ? 0 : 1);
    const valid = topologyRangeIssue(t) === undefined;
    assert.equal(valid, allLookupsSucceed(t), `seed ${seed}`);
    assert.equal(checkRecordTopology(t).ok, valid);
    if (valid) passed++;
    else failed++;
  }
  assert.ok(passed > 500 && failed > 500, `${passed} / ${failed}`);
  assert.equal(topologyRangeIssue(recordTopology(BOX)), undefined);
});

test('disc_valid / disc_bad_loop: the Lean one-face example', () => {
  const disc: RecordTopology = {
    counts: { vertices: 1, curves: 1, surfaces: 1, pcurves: 1 },
    edges: [{ curve: 0, start: 0, end: 0 }],
    coedges: [{ edge: 0, reversed: false, loop: 0, next: 0, prev: 0, pcurve: 0 }],
    loops: [{ face: 0, first: 0 }],
    faces: [{ shell: 0, surface: 0, reversed: false, loops: [0] }],
    shells: [{ body: 0, faces: [0] }],
    bodies: [{ shells: [0] }],
  };
  assert.equal(topologyRangeIssue(disc), undefined);
  assert.equal(topologyRangeIssue({ ...disc, faces: [{ shell: 0, surface: 0, reversed: false, loops: [1] }] }), 'faces[0].loops[0]: index 1 out of range (1 loops)');
  // disc_roundtrip, and the word layout of the Lean `encode`.
  const words = encodeRecordTopology(disc);
  assert.deepEqual(words, [1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0]);
  assert.deepStrictEqual(unwrap(decodeRecordTopology(words)), disc);
});

test('decode_encode / decList_encList: decoding the words of a topology gives it back (box, random topologies)', () => {
  const box = recordTopology(BOX);
  assert.deepStrictEqual(unwrap(decodeRecordTopology(encodeRecordTopology(box))), box);
  for (let seed = 1; seed <= 1000; seed++) {
    const t = randomTopology(seed, 2);
    const back = unwrap(decodeRecordTopology(encodeRecordTopology(t)));
    assert.deepStrictEqual(back, t, `seed ${seed}`);
    // decode_encode_validate: the range check is preserved.
    assert.equal(topologyRangeIssue(back), topologyRangeIssue(t));
  }
});

test('decodeRecordTopology refuses malformed words without throwing', () => {
  const op = 'record.decodeRecordTopology';
  const words = [...encodeRecordTopology(recordTopology(BOX))];
  expectReason(decodeRecordTopology([...words, 0]), `word ${words.length}: 1 trailing words`, op);
  expectReason(decodeRecordTopology(words.slice(0, -1)), `word ${words.length - 2}: declared length 1 exceeds the remaining 0 words`, op);
  expectReason(decodeRecordTopology([1, 2]), 'word 2: unexpected end of input', op);
  expectReason(decodeRecordTopology([1, 1, 1, -1]), 'word 3: expected a non-negative integer', op);
  expectReason(decodeRecordTopology([1, 1, 1, 0.5]), 'word 3: expected a non-negative integer', op);
  expectReason(decodeRecordTopology([1, 1, 1, '1']), 'word 3: expected a non-negative integer', op);
  // A flag must be 0 or 1 (the Lean `decBool`).
  expectReason(decodeRecordTopology([1, 1, 1, 1, 0, 1, 0, 2, 0, 0, 0, 0]), 'word 7: expected 0 or 1, found 2', op);
  // A huge declared length is refused at once.
  expectReason(decodeRecordTopology([0, 0, 0, 0, 2 ** 52]), `word 4: declared length ${2 ** 52} exceeds the remaining 0 words`, op);
  expectReason(decodeRecordTopology('words' as unknown as number[]), 'expected an array of words', op);
});

// ---------------------------------------------------------------------------------------------------------
// Review regressions.

test('review: long index lists encode and decode without overflowing the call stack', () => {
  const j = fresh();
  j.bodies[0].shells = new Array(300_000).fill(0);
  const t = recordTopology(unwrap(parseRecord(j)));
  const words = encodeRecordTopology(t);
  assert.deepStrictEqual(unwrap(decodeRecordTopology(words)), t);
});

test('review: decode_encode holds for the largest safe pcurve index (its word is 2^53)', () => {
  const t: RecordTopology = {
    counts: { vertices: 0, curves: 0, surfaces: 0, pcurves: 0 },
    edges: [],
    coedges: [{ edge: 0, reversed: true, loop: 0, next: 0, prev: 0, pcurve: Number.MAX_SAFE_INTEGER }],
    loops: [],
    faces: [],
    shells: [],
    bodies: [],
  };
  const words = encodeRecordTopology(t);
  assert.equal(words[11], 2 ** 53);
  assert.deepStrictEqual(unwrap(decodeRecordTopology(words)), t);
  // Other words stay safe integers; past 2^53 the optional word is refused too.
  expectReason(decodeRecordTopology([2 ** 53, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'word 0: expected a non-negative integer', 'record.decodeRecordTopology');
  const over = [...words];
  over[11] = 2 ** 53 + 2;
  expectReason(decodeRecordTopology(over), 'word 11: expected a non-negative integer', 'record.decodeRecordTopology');
});

test('review: decodeRecordTopology never throws on exotic word arrays and runs no accessor', () => {
  const op = 'record.decodeRecordTopology';
  const prox = new Proxy([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { get: () => { throw new Error('trap'); } });
  expectReason(decodeRecordTopology(prox), 'the input threw while being read', op);
  let calls = 0;
  const words: unknown[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  Object.defineProperty(words, 2, { get: () => { calls++; return 0; } });
  expectReason(decodeRecordTopology(words), 'word 2: expected a non-negative integer', op);
  assert.equal(calls, 0);
});

test('review: arrays must be plain arrays (no Array subclasses)', () => {
  class Sneaky extends Array<number> {}
  const j = fresh();
  j.vertices[0].p = Sneaky.from([0, 0, 0]);
  expectReason(parseRecord(j), 'vertices[0].p: expected a plain array');
  const k2 = fresh();
  Object.setPrototypeOf(k2.faces, null);
  // Not an Array.prototype array: refused (Array.isArray still holds for an exotic array object).
  expectReason(parseRecord(k2), 'faces: expected a plain array');
});
