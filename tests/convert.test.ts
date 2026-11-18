import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { vec3 } from '../src/math/vec.ts';
import { createCircleCurve, createCurveFrame, storedFrameMismatch } from '../src/curve/types.ts';
import { createNurbsCurve } from '../src/nurbs/curve.ts';
import { freezeBrep, topologyIssue, type Brep } from '../src/topology/index.ts';
import { makeBox, makeCylinder, WORLD_PLACEMENT } from '../src/primitive/index.ts';
import { brepToRecord, builderOrderIssue, recordToBrep } from '../src/convert/index.ts';
import { parseRecord, parseRecordText, recordTopology, stringifyRecord, type BrepRecord } from '../src/record/index.ts';

const k = createKernel();
type Json = any;

/**
 * Closed cylinder of radius r, height h about +z: the M3 primitive `makeCylinder` (the single cylinder builder; the
 * ids of the M2 fixture of tests/topology-geometry.test.ts): two circle edges, a seam segment, two discs and the
 * side face whose loop uses the seam twice with pcurves on u = 2π and u = 0.
 */
const cylinder = (r = 2, h = 3): Brep => unwrap(makeCylinder(k, WORLD_PLACEMENT, r, h));

const box = (): Brep => unwrap(makeBox(k, vec3(0.1, -2, 3), 1.5, 2, 3.25));
const json = (r: BrepRecord): Json => JSON.parse(stringifyRecord(r));

function expectReason(r: Result<unknown>, operation: string, reason: string): void {
  assert.equal(r.ok, false, `expected failure: ${reason}`);
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-input', JSON.stringify(r.error));
  if (r.error.kind !== 'invalid-input') return;
  assert.equal(r.error.operation, operation);
  assert.equal(r.error.reason, reason);
}

/** Mutates the box record and expects `recordToBrep` to fail with exactly `reason`. */
function refuses(mutate: (j: Json) => void, reason: string, base: Brep = box()): void {
  const j = json(unwrap(brepToRecord(base)));
  mutate(j);
  expectReason(recordToBrep(k, j as BrepRecord), 'convert.recordToBrep', reason);
}

// ---------------------------------------------------------------------------------------------------------
// Round trips.

test('round trip: recordToBrep(brepToRecord(box)) is the box, field by field', () => {
  const b = box();
  const r = unwrap(brepToRecord(b));
  const back = unwrap(recordToBrep(k, r));
  assert.deepStrictEqual(back, b);
  assert.ok(Object.isFrozen(back) && Object.isFrozen(back.faces[0]) && Object.isFrozen(back.faces[0]!.surface));
  // And through the canonical text.
  assert.deepStrictEqual(unwrap(recordToBrep(k, unwrap(parseRecordText(stringifyRecord(r))))), b);
});

test('round trip: the cylinder (circle edges, closed edges, a seam with two pcurves, a cylinder face)', () => {
  const c = cylinder();
  const r = unwrap(brepToRecord(c));
  assert.deepEqual(r.curves.map((x) => x.kind), ['circle', 'circle', 'line']);
  assert.deepEqual(r.surfaces.map((x) => x.kind), ['plane', 'plane', 'cylinder']);
  assert.equal(r.pcurves.length, 6);
  assert.deepEqual(r.edges.map((e) => [e.start, e.end]), [[0, 0], [1, 1], [0, 1]]);
  const back = unwrap(recordToBrep(k, r));
  assert.deepStrictEqual(back, c);
  // Partners are rebuilt by the builder, not stored.
  assert.deepEqual(back.coedges.map((co) => co.partner), c.coedges.map((co) => co.partner));
  assert.ok(!('partner' in r.coedges[0]!));
});

test('round trip: stringify is a fixed point (box and cylinder), equal bodies give equal bytes', () => {
  for (const make of [box, () => cylinder()]) {
    const text = stringifyRecord(unwrap(brepToRecord(make())));
    assert.equal(stringifyRecord(unwrap(brepToRecord(make()))), text);
    const again = unwrap(brepToRecord(unwrap(recordToBrep(k, unwrap(parseRecordText(text))))));
    assert.equal(stringifyRecord(again), text);
  }
  assert.notEqual(stringifyRecord(unwrap(brepToRecord(cylinder(2, 3)))), stringifyRecord(unwrap(brepToRecord(cylinder(2, 3.5)))));
});

test('round trip of every curve and surface kind through the kernel constructors (topology check only)', () => {
  const j = json(unwrap(brepToRecord(box())));
  const frame = { normal: [0, 0, 1], xAxis: [1, 0, 0], yAxis: [0, 1, 0] };
  const tilted = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(1, 2, 3), vec3(1, 0, 0), 1)).frame;
  const tf = { normal: [tilted.normal.x, tilted.normal.y, tilted.normal.z], xAxis: [tilted.xAxis.x, tilted.xAxis.y, tilted.xAxis.z], yAxis: [tilted.yAxis.x, tilted.yAxis.y, tilted.yAxis.z] };
  j.curves[0] = { kind: 'circle', center: [0, 0, 0], frame: tf, radius: 2, range: [0.5, 1] };
  j.curves[1] = { kind: 'ellipse', center: [1, 2, 3], frame, majorRadius: 3, minorRadius: 2, range: [-1, 1] };
  j.curves[2] = { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 1, 1, 1], points: [[0, 0, 0], [1, 1, 0], [2, 0, 0]], weights: [1, 0.5, 1] };
  j.curves[3] = { kind: 'nurbs', degree: 1, knots: [0, 0, 1, 1], points: [[0, 0, 0], [1, 1, 1]] };
  j.surfaces[0] = { kind: 'cylinder', origin: [0, 0, 0], frame: tf, radius: 1 };
  j.surfaces[1] = { kind: 'cone', origin: [0, 0, 0], frame, baseRadius: 1, semiAngle: -0.3 };
  j.surfaces[2] = { kind: 'sphere', center: [0, 0, 0], frame, radius: 1 };
  j.surfaces[3] = { kind: 'torus', center: [0, 0, 0], frame, majorRadius: 3, minorRadius: 1 };
  j.surfaces[4] = { kind: 'nurbs', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], points: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]] };
  j.surfaces[5] = { ...j.surfaces[4], weights: [[1, 2], [3, 4]] };
  j.pcurves[0] = { degree: 1, knots: [0, 0, 1, 1], points: [[0, 0], [1, 1]], weights: [1, 2] };
  const r = unwrap(parseRecord(j));
  const b = unwrap(recordToBrep(k, r, { checkGeometry: false }));
  assert.deepEqual(b.edges.slice(0, 4).map((e) => e.curve.kind), ['circle', 'ellipse', 'nurbs', 'nurbs']);
  assert.deepEqual(b.faces.map((f) => f.surface.kind), ['cylinder', 'cone', 'sphere', 'torus', 'nurbs', 'nurbs']);
  // The stored (kernel-made) frame is kept bit for bit.
  const circle = b.edges[0]!.curve;
  assert.ok(circle.kind === 'circle' && circle.frame.yAxis.y === tilted.yAxis.y && circle.frame.normal.z === tilted.normal.z);
  const back = unwrap(brepToRecord(b));
  assert.equal(stringifyRecord(back), stringifyRecord(r));
  assert.deepStrictEqual(unwrap(recordToBrep(k, back, { checkGeometry: false })), b);
  // The default also checks the geometry: these curves are not on those faces.
  const geo = recordToBrep(k, r);
  assert.equal(geo.ok, false);
  if (!geo.ok) assert.equal(geo.error.kind, 'invalid-topology');
});

// ---------------------------------------------------------------------------------------------------------
// Kernel refusals, named by record path.

test('the kernel constructors decide geometric validity; failures name the record path', () => {
  refuses((j) => (j.surfaces[0] = { kind: 'cylinder', origin: [0, 0, 0], frame: j.surfaces[0].frame, radius: -1 }),
    'surfaces[0]: radius must be finite and positive (surface.createCylinderSurface)');
  refuses((j) => (j.curves[3].direction = [0, 0, 0]), 'curves[3]: direction of zero length (curve.createLineCurve)');
  refuses((j) => (j.curves[3].range = [1, 0]), 'curves[3]: parameter range must satisfy t0 < t1 (curve.createLineCurve)');
  refuses((j) => (j.pcurves[2].weights = [-1, 1]), 'pcurves[2]: weight 0 must be finite and positive (nurbs.createNurbsCurve)');
  refuses((j) => (j.surfaces[1].frame.normal = [0, 0, 0]), 'surfaces[1]: normal of zero length (curve.createCurveFrame)');
  refuses(
    (j) => (j.surfaces[5] = { kind: 'torus', center: [0, 0, 0], frame: j.surfaces[5].frame, majorRadius: 1, minorRadius: 2 }),
    'surfaces[5]: need majorRadius > minorRadius (horn and spindle tori are not supported) (surface.createTorusSurface)',
  );
  const knots = (() => {
    const j = json(unwrap(brepToRecord(box())));
    j.pcurves[0].knots = [0, 1, 0, 1];
    return recordToBrep(k, j as BrepRecord);
  })();
  assert.equal(knots.ok, false);
  if (!knots.ok && knots.error.kind === 'invalid-input') assert.match(knots.error.reason, /^pcurves\[0\]: .*\(nurbs\.validateKnots\)$/);
});

test('frames: a stored frame must be the kernel frame to rounding (orthonormal, right-handed)', () => {
  const flip = (j: Json): void => {
    const y = j.surfaces[0].frame.yAxis;
    j.surfaces[0].frame.yAxis = y.map((c: number) => -c);
  };
  refuses(flip, "surfaces[0].frame.yAxis: the frame is not orthonormal and right-handed (the kernel's frame differs by more than 1e-12)");
  refuses((j) => (j.surfaces[2].frame.normal = j.surfaces[2].frame.normal.map((c: number) => 2 * c)),
    "surfaces[2].frame.normal: the frame is not orthonormal and right-handed (the kernel's frame differs by more than 1e-12)");
  // A rotated x axis is itself a unit vector, but the stored y axis no longer completes the frame.
  refuses((j) => (j.curves[0].frame.xAxis = [Math.cos(1e-9), Math.sin(1e-9), 0]),
    "curves[0].frame.yAxis: the frame is not orthonormal and right-handed (the kernel's frame differs by more than 1e-12)", cylinder());
});

// ---------------------------------------------------------------------------------------------------------
// Builder order and validation of the built body.

test('builder order: coedges loop by loop in cycle order, child lists ascending and consistent', () => {
  refuses((j) => (j.coedges[0].next = 2), 'coedges[0].next: expected 1 (the loop\'s coedges in cycle order), found 2');
  refuses((j) => (j.coedges[1].prev = 3), 'coedges[1].prev: expected 0 (the loop\'s coedges in cycle order), found 3');
  refuses((j) => (j.loops[1].first = 5), 'loops[1].first: expected 4 (the loop\'s first stored coedge), found 5');
  refuses((j) => (j.coedges[0].loop = 1), 'coedges[0].loop: expected 0 (coedges are stored loop by loop, in loop order), found 1');
  refuses((j) => j.shells[0].faces.reverse(), 'shells[0].faces: expected [0, 1, 2, 3, 4, 5] (the faces naming shells[0], ascending), found [5, 4, 3, 2, 1, 0]');
  refuses((j) => (j.faces[0].loops = []), 'faces[0].loops: expected [0] (the loops naming faces[0], ascending), found []');
  refuses((j) => (j.loops[0].face = 1), 'faces[0].loops: expected [] (the loops naming faces[0], ascending), found [0]');
  refuses((j) => {
    j.bodies.push({ shells: [] });
    j.shells[0].body = 1;
  }, 'bodies[0].shells: expected [] (the shells naming bodies[0], ascending), found [0]');
  // A loop's coedges split into two runs.
  const split = {
    counts: { vertices: 1, curves: 1, surfaces: 1, pcurves: 0 },
    edges: [{ curve: 0, start: 0, end: 0 }],
    coedges: [
      { edge: 0, reversed: false, loop: 0, next: 0, prev: 0, pcurve: null },
      { edge: 0, reversed: true, loop: 1, next: 1, prev: 1, pcurve: null },
      { edge: 0, reversed: true, loop: 0, next: 2, prev: 2, pcurve: null },
    ],
    loops: [{ face: 0, first: 0 }, { face: 0, first: 1 }],
    faces: [{ shell: 0, surface: 0, reversed: false, loops: [0, 1] }],
    shells: [{ body: 0, faces: [0] }],
    bodies: [{ shells: [0] }],
  };
  assert.equal(builderOrderIssue(split), 'coedges[2].loop: found 0, whose coedges are stored before (coedges are stored loop by loop, in loop order)');
  // An empty loop.
  const t = recordTopology(unwrap(brepToRecord(box())));
  assert.equal(builderOrderIssue(t), undefined);
  assert.equal(
    builderOrderIssue({ ...t, loops: [...t.loops, { face: 0, first: 0 }], faces: t.faces.map((f, i) => (i === 0 ? { ...f, loops: [0, 6] } : f)) }),
    'loops[6]: the loop has no coedge',
  );
});

test('the built body is validated: topology (validateBrep) and geometry (validateBrepGeometry)', () => {
  const j = json(unwrap(brepToRecord(box())));
  j.vertices[0].p = [j.vertices[0].p[0] + 0.1, j.vertices[0].p[1], j.vertices[0].p[2]];
  const geo = recordToBrep(k, j as BrepRecord);
  assert.equal(geo.ok, false);
  if (!geo.ok) assert.equal(topologyIssue(geo.error), 'edge-vertex');
  assert.equal(recordToBrep(k, j as BrepRecord, { checkGeometry: false }).ok, true);
  // A combinatorial defect: one coedge runs its edge the wrong way.
  const top = json(unwrap(brepToRecord(box())));
  top.coedges[0].reversed = true;
  const bad = recordToBrep(k, top as BrepRecord, { checkGeometry: false });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.kind, 'invalid-topology');
  // Kernel tolerances come from the Kernel argument: a vertex 2e-6 off passes the default zone, not a tight one.
  const near = json(unwrap(brepToRecord(box())));
  near.vertices[0].p = [near.vertices[0].p[0] + 2e-6, near.vertices[0].p[1], near.vertices[0].p[2]];
  assert.equal(recordToBrep(k, near as BrepRecord).ok, true);
  assert.equal(recordToBrep(createKernel({ zoneTol3d: 1e-7 }), near as BrepRecord).ok, false);
});

test('recordToBrep re-checks its input; hostile values are refused without throwing', () => {
  expectReason(recordToBrep(k, 42 as unknown as BrepRecord), 'convert.recordToBrep', '(root): expected an object, found 42');
  const j = json(unwrap(brepToRecord(box())));
  j.faces[3].loops[0] = 12;
  expectReason(recordToBrep(k, j as BrepRecord), 'convert.recordToBrep', 'faces[3].loops[0]: index 12 out of range (6 loops)');
});

test('brepToRecord refuses invalid bodies, bodies not in builder order and values a record cannot hold', () => {
  const b = box();
  // validateBrep's error is returned as is.
  const broken = freezeBrep({ ...b, loops: b.loops.map((l, i) => (i === 0 ? { ...l, face: 9 as never } : l)) });
  const e1 = brepToRecord(broken);
  assert.equal(e1.ok, false);
  if (!e1.ok) assert.equal(topologyIssue(e1.error), 'id-range');
  // A valid body whose shell lists its faces out of creation order.
  const permuted = freezeBrep({ ...b, shells: [{ body: b.shells[0]!.body, faces: [...b.shells[0]!.faces].reverse() }] });
  expectReason(brepToRecord(permuted), 'convert.brepToRecord',
    'shells[0].faces: expected [0, 1, 2, 3, 4, 5] (the faces naming shells[0], ascending), found [5, 4, 3, 2, 1, 0]');
  // Non-finite coordinates cannot be written.
  const nan = freezeBrep({ ...b, vertices: b.vertices.map((v, i) => (i === 0 ? { point: vec3(NaN, 0, 0) } : v)) });
  expectReason(brepToRecord(nan), 'convert.brepToRecord', 'vertices[0].p[0]: expected a finite number, found NaN');
  // A pcurve that is not 2D.
  const pc3 = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0, 0], [1, 0, 0]]));
  const bad = freezeBrep({ ...b, coedges: b.coedges.map((c, i) => (i === 0 ? { ...c, pcurve: pc3 } : c)) });
  expectReason(brepToRecord(bad), 'convert.brepToRecord', 'pcurves[0].points[0]: expected 2 numbers, found 3 items');
});

test('storedFrameMismatch: the kernel frame check convert uses (rounding accepted, a skewed axis named)', () => {
  const kk = createKernel();
  const built = unwrap(createCurveFrame(kk, vec3(0, 0, 1), vec3(1, 0, 0)));
  assert.equal(storedFrameMismatch(built, built), undefined);
  const nudged = { ...built, xAxis: vec3(1, 1e-13, 0) };
  assert.equal(storedFrameMismatch(nudged, built), undefined);
  assert.equal(storedFrameMismatch({ ...built, yAxis: vec3(0, -1, 0) }, built), 'yAxis');
  assert.equal(storedFrameMismatch({ ...built, normal: vec3(0, 1e-9, 1) }, built), 'normal');
});
