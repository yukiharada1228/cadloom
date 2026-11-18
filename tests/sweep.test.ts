import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel, type Kernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { cross3, distance3, dot3, length3, sub3, vec3, type Vec3 } from '../src/math/vec.ts';
import { applyPoint, rotation } from '../src/math/transform.ts';
import {
  createCircleCurve,
  createEllipseCurve,
  createLineCurve,
  createNurbsCurve3,
  createSegmentCurve,
  TWO_PI,
} from '../src/curve/types.ts';
import { curveArcLength } from '../src/curve/length.ts';
import { curveFrenetFrame, evaluateCurve3 } from '../src/curve/evaluate.ts';
import { createNurbsCurve, type NurbsCurve } from '../src/nurbs/curve.ts';
import { surfacePoint3 } from '../src/surface/evaluate.ts';
import { createPlaneSurface, type PlaneSurface } from '../src/surface/types.ts';
import { faceSurface, loopCoedges, loopId, eulerPoincare, validateBrep, validateBrepGeometry, faceId, type Brep } from '../src/topology/index.ts';
import { brepToRecord, recordToBrep } from '../src/convert/index.ts';
import { parseRecordText, stringifyRecord } from '../src/record/index.ts';
import { isConsistentlyOriented, isWatertight, meshSignedVolume, tessellate, type Mesh } from '../src/tess/index.ts';
import { makeCone, makeSphere, makeTorus, WORLD_PLACEMENT } from '../src/primitive/index.ts';
import { extrude } from '../src/prism/index.ts';
import {
  arcSegment2,
  circleWire,
  createProfile,
  lineSegment2,
  nurbsSegment2,
  point2,
  polygonWire,
  profileAreaProperties,
  rectangleWire,
  type Profile,
  type Segment2,
  type Wire2,
} from '../src/profile/index.ts';
import {
  doubleReflectionStep,
  frameMotion,
  interpolation,
  interpolationValue,
  MAX_SWEEP_STATIONS,
  reflect3,
  revolve,
  revolveVolume,
  rotationMinimizingFrames,
  sweep,
  sweepWithReport,
  type RevolveAxis,
} from '../src/sweep/index.ts';

const k = createKernel();
const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------------------------------------------------
// Helpers

function expectInvalid(r: Result<unknown>, pattern?: RegExp): void {
  assert.equal(r.ok, false, 'expected a failure');
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-input', JSON.stringify(r.error));
  if (pattern !== undefined && r.error.kind === 'invalid-input') assert.match(r.error.reason, pattern);
}

/** A coedge reduced to the Lean `Use`: `[face, edge, reversed]`. */
type Use = readonly [number, number, boolean];
interface UseModel {
  readonly nv: number;
  readonly edges: readonly (readonly [number, number])[];
  readonly nf: number;
  readonly loops: readonly (readonly Use[])[];
}

function useModel(b: Brep): UseModel {
  return {
    nv: b.vertices.length,
    edges: b.edges.map((e) => [e.start, e.end] as const),
    nf: b.faces.length,
    loops: b.loops.map((l, i) => unwrap(loopCoedges(b, loopId(i))).map((c): Use => [l.face, b.coedges[c]!.edge, b.coedges[c]!.reversed])),
  };
}

/** Record round trip through the canonical text: the rebuilt body gives the same text and the same arena. */
function assertRecordRoundTrip(b: Brep, kernel: Kernel = k): Brep {
  const text = stringifyRecord(unwrap(brepToRecord(b)));
  const back = unwrap(recordToBrep(kernel, unwrap(parseRecordText(text))));
  assert.equal(stringifyRecord(unwrap(brepToRecord(back))), text);
  assert.deepEqual(useModel(back), useModel(b));
  return back;
}

function assertGoodMesh(m: Mesh, what: string): void {
  assert.equal(m.stats.failedFaces.length, 0, `${what}: ${JSON.stringify(m.stats.failedFaces)}`);
  assert.equal(m.stats.failedEdges.length, 0, what);
  assert.ok(isWatertight(m), `${what}: not watertight`);
  assert.ok(isConsistentlyOriented(m), `${what}: not consistently oriented`);
  assert.ok(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite), `${what}: non-finite`);
}

/** Surface area of a mesh. */
function meshArea(m: Mesh): number {
  let a = 0;
  const P = (i: number): Vec3 => vec3(m.positions[3 * i]!, m.positions[3 * i + 1]!, m.positions[3 * i + 2]!);
  for (let t = 0; t < m.indices.length; t += 3) {
    const o = P(m.indices[t]!);
    a += length3(cross3(sub3(P(m.indices[t + 1]!), o), sub3(P(m.indices[t + 2]!), o))) / 2;
  }
  return a;
}

/**
 * Validates, round-trips and meshes a solid, and compares the mesh volume with `exact`: every facet lies within the
 * chord of the surface, so the volumes differ by at most the surface area times the chord.
 */
function checkSolid(b: Brep, what: string, exact: number, chord = 0.004, kernel: Kernel = k): number {
  assert.deepEqual(validateBrep(b), { ok: true, value: undefined }, what);
  assert.deepEqual(validateBrepGeometry(kernel, b), { ok: true, value: undefined }, what);
  assert.ok(Object.isFrozen(b) && Object.isFrozen(b.faces) && Object.isFrozen(b.coedges[0]), `${what}: not frozen`);
  const back = assertRecordRoundTrip(b, kernel);
  assert.deepEqual(validateBrepGeometry(kernel, back), { ok: true, value: undefined }, `${what}: after the round trip`);
  const m = unwrap(tessellate(kernel, back, { chord }));
  assertGoodMesh(m, what);
  const v = meshSignedVolume(m);
  assert.ok(Math.abs(v - exact) <= meshArea(m) * chord, `${what}: mesh volume ${v} vs ${exact} (bound ${meshArea(m) * chord})`);
  return v;
}

const near = (a: number, b: number, tol: number, what = ''): void => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

/** The XZ plane: profile `(x, y)` is the world point `(x, 0, y)`; the axis `(0,0)+(0,1)` is the world z axis. */
const XZ: PlaneSurface = unwrap(createPlaneSurface(k, vec3(0, 0, 0), vec3(0, -1, 0), vec3(1, 0, 0)));
const Z_AXIS: RevolveAxis = { origin: point2(0, 0), direction: point2(0, 1) };
const profileOf = (wires: readonly Wire2[], plane: PlaneSurface = XZ, kernel: Kernel = k): Profile => unwrap(createProfile(kernel, plane, wires));
const poly = (...pts: [number, number][]): Wire2 => unwrap(polygonWire(pts.map(([x, y]) => point2(x, y))));
const rect = (x: number, y: number, w: number, h: number): Wire2 => unwrap(rectangleWire(x, y, w, h));
const circ = (x: number, y: number, r: number): Wire2 => unwrap(circleWire(point2(x, y), r));
const halfDisc = (r: number, cy = 0): Wire2 => [
  unwrap(arcSegment2(point2(0, cy), r, -HALF_PI, HALF_PI)),
  unwrap(lineSegment2(point2(0, cy + r), point2(0, cy - r))),
];
const kinds = (b: Brep): string[] => b.faces.map((f) => f.surface.kind);

// ---------------------------------------------------------------------------------------------------------
// Lean mirrors (formal/CadloomFormal/Sweep.lean)

type Kind = 'curved' | 'up' | 'down';

/** Lean `fullModel ks`. */
function fullModelTS(ks: readonly Kind[]): UseModel {
  const N = ks.length;
  const edges: [number, number][] = ks.map((_, g) => [g, g]);
  ks.forEach((kd, g) => { if (kd === 'curved') edges.push([g, (g + 1) % N]); });
  const loops: Use[][] = [];
  let me = N;
  ks.forEach((kd, g) => {
    if (kd === 'curved') loops.push([[g, g, false], [g, me, false], [g, (g + 1) % N, true], [g, me, true]]);
    else if (kd === 'up') loops.push([[g, (g + 1) % N, true]], [[g, g, false]]);
    else loops.push([[g, g, false]], [[g, (g + 1) % N, true]]);
    if (kd === 'curved') me++;
  });
  return { nv: N, edges, nf: N, loops };
}

/** Lean `partialModel ns`. */
function partialModelTS(ns: readonly number[]): UseModel {
  const N = ns.reduce((a, b) => a + b, 0);
  const segs: [number, number][] = [];
  let o = 0;
  for (const n of ns) {
    for (let j = 0; j < n; j++) segs.push([o + j, o + ((j + 1) % n)]);
    o += n;
  }
  const edges: [number, number][] = [
    ...Array.from({ length: N }, (_, g): [number, number] => [g, N + g]),
    ...segs.map(([a, b]): [number, number] => [a, b]),
    ...segs.map(([a, b]): [number, number] => [N + a, N + b]),
  ];
  const loops: Use[][] = [];
  o = 0;
  for (const n of ns) {
    loops.push(segs.slice(o, o + n).map(([a]): Use => [0, N + a, false]));
    o += n;
  }
  o = 0;
  for (const n of ns) {
    loops.push(segs.slice(o, o + n).reverse().map(([a]): Use => [1, 2 * N + a, true]));
    o += n;
  }
  for (const [a, b] of segs) loops.push([[2 + a, a, false], [2 + a, 2 * N + a, false], [2 + a, b, true], [2 + a, N + a, true]]);
  return { nv: 2 * N, edges, nf: N + 2, loops };
}

// ---------------------------------------------------------------------------------------------------------
// Revolve: topology

test('revolve a rectangle: a tube of genus 1 (planes and cylinders), valid, round trip, watertight, Pappus volume', () => {
  const p = profileOf([rect(1, 0, 1, 2)]);
  const b = unwrap(revolve(k, p, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(b), ['plane', 'cylinder', 'plane', 'cylinder']);
  const ep = unwrap(eulerPoincare(b));
  assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops, ep.shells, ep.genus], [4, 6, 4, 6, 1, 1]);
  const exact = Math.PI * (4 - 1) * 2;
  near(unwrap(revolveVolume(k, p, Z_AXIS, TWO_PI)), exact, 1e-12, 'Pappus');
  checkSolid(b, 'tube', exact);
});

test('full_euler_poincare / full_counts / full_examples_close / full_examples_paired: the TS full-turn arena is the Lean fullModel', () => {
  const cases: [Wire2, Kind[]][] = [
    [rect(1, 0, 1, 2), ['up', 'curved', 'down', 'curved']],
    [poly([1, 0], [3, 0.5], [2.5, 2], [1.5, 1.5]), ['curved', 'curved', 'curved', 'curved']],
    [poly([1, 0], [2, 1], [1, 2]), ['curved', 'curved', 'curved']],
    [circ(3, 0, 1), ['curved']],
    [poly([2, 1], [1, 1], [1, 0], [2, 0]), ['down', 'curved', 'up', 'curved']],
  ];
  for (const [w, ks] of cases) {
    const b = unwrap(revolve(k, profileOf([w]), Z_AXIS, TWO_PI));
    assert.deepEqual(useModel(b), fullModelTS(ks), JSON.stringify(ks));
    const ep = unwrap(eulerPoincare(b));
    const M = ks.filter((x) => x === 'curved').length;
    assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops + M, ep.genus], [ks.length, ks.length + M, ks.length, 2 * ks.length, 1]);
  }
});

test('full_circle_is_torus: revolving a circle gives makeTorus’s arena and volume 2π²Rr²', () => {
  const p = profileOf([circ(3, 0, 1)]);
  const b = unwrap(revolve(k, p, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(b), ['torus']);
  assert.deepEqual(useModel(b), useModel(unwrap(makeTorus(k, WORLD_PLACEMENT, 3, 1))));
  const exact = 2 * Math.PI * Math.PI * 3;
  near(unwrap(revolveVolume(k, p, Z_AXIS, TWO_PI)), exact, 1e-9, 'Pappus');
  checkSolid(b, 'torus', exact, 0.01);
});

test('partial_euler_poincare / partial_counts / partial_examples_*: the TS partial-turn arena is the Lean partialModel; holes are tunnels', () => {
  const twoArcs: Wire2 = [unwrap(arcSegment2(point2(2.5, 0.5), 0.2, 0, Math.PI)), unwrap(arcSegment2(point2(2.5, 0.5), 0.2, Math.PI, TWO_PI))];
  const cases: [Wire2[], number[]][] = [
    [[circ(3, 0, 1)], [1]],
    [[poly([1, 0], [2, 1], [1, 2])], [3]],
    [[rect(1, 0, 1, 2)], [4]],
    [[rect(1, -2, 3, 4), circ(2.5, 0, 0.5)], [4, 1]],
    [[poly([1, -2], [5, -1], [1, 3]), circ(2, 0, 0.4), twoArcs], [3, 1, 2]],
  ];
  for (const [ws, ns] of cases) {
    const p = profileOf(ws);
    for (const angle of [HALF_PI, 1.2 * Math.PI]) {
      const b = unwrap(revolve(k, p, Z_AXIS, angle));
      assert.deepEqual(useModel(b), partialModelTS(ns), JSON.stringify(ns));
      const ep = unwrap(eulerPoincare(b));
      const N = ns.reduce((a, c) => a + c, 0);
      assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops, ep.genus], [2 * N, 3 * N, N + 2, N + 2 * ns.length, ns.length - 1]);
    }
  }
  const holed = profileOf([rect(1, -2, 3, 4), circ(2.5, 0, 0.5)]);
  const b = unwrap(revolve(k, holed, Z_AXIS, Math.PI / 3));
  const v = unwrap(revolveVolume(k, holed, Z_AXIS, Math.PI / 3));
  checkSolid(b, 'holed partial', v);
});

test('a hole at a full turn is a void shell; a notch closed by the axis is a separate shell', () => {
  const holed = profileOf([rect(1, -2, 3, 4), circ(2.5, 0, 0.5)]);
  const b = unwrap(revolve(k, holed, Z_AXIS, TWO_PI));
  const ep = unwrap(eulerPoincare(b));
  assert.deepEqual([ep.shells, ep.shellGenus], [2, [1, 1]]);
  const v = unwrap(revolveVolume(k, holed, Z_AXIS, TWO_PI));
  near(v, Math.PI * (16 - 1) * 4 - 2 * Math.PI * Math.PI * 2.5 * 0.25, 1e-9, 'Pappus with a hole');
  checkSolid(b, 'void', v);
  const notch = profileOf([poly([0, 0], [2, 0], [2, 3], [0, 3], [0, 2], [1, 2], [1, 1], [0, 1])]);
  const n = unwrap(revolve(k, notch, Z_AXIS, TWO_PI));
  const en = unwrap(eulerPoincare(n));
  assert.deepEqual([en.shells, en.shellGenus], [2, [0, 0]]);
  const vn = unwrap(revolveVolume(k, notch, Z_AXIS, TWO_PI));
  near(vn, Math.PI * 4 * 3 - Math.PI * 1, 1e-9, 'notch');
  checkSolid(n, 'notch', vn);
});

// ---------------------------------------------------------------------------------------------------------
// Revolve: poles and analytic recognition

test('revolve a profile touching the axis: poles without edges, as makeCone and makeSphere (same arenas, same volumes)', () => {
  // Triangle with a side on the axis: a cone with its apex on top, the arena of makeCone(r1 > 0, r2 = 0).
  const tri = profileOf([poly([0, 0], [1.5, 0], [0, 2.5])]);
  const cone = unwrap(revolve(k, tri, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(cone), ['plane', 'cone']);
  const ref = unwrap(makeCone(k, WORLD_PLACEMENT, 1.5, 0, 2.5));
  assert.deepEqual(useModel(cone), useModel(ref));
  const vCone = (Math.PI / 3) * 2.5 * 1.5 * 1.5;
  near(unwrap(revolveVolume(k, tri, Z_AXIS, TWO_PI)), vCone, 1e-12, 'cone Pappus');
  checkSolid(cone, 'cone', vCone);
  // Half disc: the sphere of makeSphere.
  const half = profileOf([halfDisc(1.5)]);
  const ball = unwrap(revolve(k, half, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(ball), ['sphere']);
  const sph = unwrap(makeSphere(k, vec3(0, 0, 0), 1.5));
  assert.deepEqual(useModel(ball), useModel(sph));
  const vBall = (4 / 3) * Math.PI * 1.5 ** 3;
  near(unwrap(revolveVolume(k, half, Z_AXIS, TWO_PI)), vBall, 1e-12, 'sphere Pappus');
  const mBall = checkSolid(ball, 'ball', vBall);
  const mSph = meshSignedVolume(unwrap(tessellate(k, sph, { chord: 0.004 })));
  near(mBall, mSph, vBall * 1e-3, 'ball vs makeSphere mesh');
  // Rectangle on the axis: a solid cylinder, genus 0 (V 2, E 3, F 3, L 3 as makeCylinder).
  const cyl = unwrap(revolve(k, profileOf([rect(0, 0, 1, 2)]), Z_AXIS, TWO_PI));
  const ec = unwrap(eulerPoincare(cyl));
  assert.deepEqual([ec.vertices, ec.edges, ec.faces, ec.loops, ec.genus], [2, 3, 3, 3, 0]);
  checkSolid(cyl, 'cylinder', 2 * Math.PI);
});

test('partial turns of profiles touching the axis: the axis segment is an edge of both caps, the pole a shared vertex', () => {
  const cases: [string, Wire2, string[]][] = [
    ['cone', poly([0, 0], [1.5, 0], [0, 2.5]), ['plane', 'plane', 'plane', 'cone']],
    ['sphere', halfDisc(1.2), ['plane', 'plane', 'sphere']],
    ['cylinder', rect(0, 0, 1, 2), ['plane', 'plane', 'plane', 'cylinder', 'plane']],
  ];
  for (const [name, w, ks] of cases) {
    const p = profileOf([w]);
    for (const angle of [Math.PI / 3, 1.5 * Math.PI]) {
      const b = unwrap(revolve(k, p, Z_AXIS, angle));
      assert.deepEqual(kinds(b), ks, name);
      assert.equal(unwrap(eulerPoincare(b)).genus, 0, name);
      const v = unwrap(revolveVolume(k, p, Z_AXIS, angle));
      checkSolid(b, `${name} ${angle}`, v);
    }
  }
});

test('partial caps are planar half-planes at u = 0 and u = Θ, facing out; the turn is right-handed about the axis direction', () => {
  const p = profileOf([rect(1, 0, 1, 2)]);
  const theta = 0.7;
  const b = unwrap(revolve(k, p, Z_AXIS, theta));
  const start = b.faces[0]!, end = b.faces[1]!;
  assert.equal(start.surface.kind, 'plane');
  assert.equal(end.surface.kind, 'plane');
  if (start.surface.kind !== 'plane' || end.surface.kind !== 'plane') return;
  // The start cap is the profile plane y = 0 with outward normal -y (the solid lies at y > 0).
  const ns = start.reversed ? -1 : 1;
  near(dot3(start.surface.frame.normal, vec3(0, -1, 0)) * ns, 1, 1e-12, 'start normal');
  const ne = end.reversed ? -1 : 1;
  const out = vec3(-Math.sin(theta), Math.cos(theta), 0);
  near(dot3(end.surface.frame.normal, out) * ne, 1, 1e-12, 'end normal');
  // The turned copy of (2, 0, 2) is the rotation by θ about +z.
  const rot = unwrap(rotation(vec3(0, 0, 1), theta));
  const target = applyPoint(rot, vec3(2, 0, 2));
  assert.ok(b.vertices.some((v) => distance3(v.point, target) < 1e-12));
  // Reversing the axis direction turns the other way: the same volume, mirrored.
  const back = unwrap(revolve(k, p, { origin: point2(0, 0), direction: point2(0, -3) }, theta));
  assert.ok(back.vertices.some((v) => distance3(v.point, applyPoint(unwrap(rotation(vec3(0, 0, -1), theta)), vec3(2, 0, 2))) < 1e-12));
  checkSolid(back, 'reversed axis', unwrap(revolveVolume(k, p, Z_AXIS, theta)));
});

test('analytic recognition: plane, cylinder, cone, sphere, torus per segment; NURBS and horn arcs give the A8.1 surface', () => {
  // A profile with every kind: line ⟂ axis, line ∥ axis, oblique line, arc about the axis (sphere zone), arc off it.
  const w: Segment2[] = [
    unwrap(lineSegment2(point2(1, 0), point2(3, 0))),
    unwrap(arcSegment2(point2(3, 0.5), 0.5, -HALF_PI, HALF_PI)),
    unwrap(lineSegment2(point2(3, 1), point2(3, 2))),
    unwrap(lineSegment2(point2(3, 2), point2(2, 3))),
    unwrap(arcSegment2(point2(0, 0), Math.hypot(2, 3), Math.atan2(3, 2), Math.atan2(3, 1) + 0)),
  ];
  // Close the wire: from the sphere arc's end back down to (1, 0) along a line.
  const e = w[4]!;
  const endP = e.kind === 'arc' ? point2(e.radius * Math.cos(e.endAngle), e.radius * Math.sin(e.endAngle)) : point2(0, 0);
  w.push(unwrap(lineSegment2(endP, point2(1, 0))));
  const p = profileOf([w]);
  const b = unwrap(revolve(k, p, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(b), ['plane', 'torus', 'cylinder', 'cone', 'sphere', 'cone']);
  const v = unwrap(revolveVolume(k, p, Z_AXIS, TWO_PI));
  checkSolid(b, 'mixed', v, 0.01);
  // A NURBS segment (a cubic bulge) and an arc of a spindle torus (center 0.5 from the axis, radius 1, kept off it).
  const bulge = unwrap(createNurbsCurve(3, [0, 0, 0, 0, 1, 1, 1, 1], [[2, 0], [3, 0.5], [3, 1.5], [2, 2]]));
  const nw: Segment2[] = [unwrap(nurbsSegment2(bulge)), unwrap(lineSegment2(point2(2, 2), point2(2, 0)))];
  const np = profileOf([nw]);
  const nb = unwrap(revolve(k, np, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(nb), ['nurbs', 'cylinder']);
  const nv = unwrap(revolveVolume(k, np, Z_AXIS, TWO_PI));
  checkSolid(nb, 'nurbs', nv, 0.01);
  const a0 = -Math.PI / 3, a1 = Math.PI / 3;
  const spindle: Segment2[] = [
    unwrap(arcSegment2(point2(0.5, 0), 1, a0, a1)),
    unwrap(lineSegment2(point2(0.5 + Math.cos(a1), Math.sin(a1)), point2(0.5 + Math.cos(a0), Math.sin(a0)))),
  ];
  const sp = profileOf([spindle]);
  const sb = unwrap(revolve(k, sp, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(sb), ['nurbs', 'cylinder']);
  const sv = unwrap(revolveVolume(k, sp, Z_AXIS, TWO_PI));
  checkSolid(sb, 'spindle', sv, 0.01);
});

test('profiles on the other side, oblique axes and tilted planes revolve to the same solids', () => {
  const vRef = unwrap(revolveVolume(k, profileOf([rect(1, 0, 1, 2)]), Z_AXIS, TWO_PI));
  // Mirror image on the left of the axis.
  const left = profileOf([rect(-2, 0, 1, 2)]);
  const bl = unwrap(revolve(k, left, Z_AXIS, TWO_PI));
  near(unwrap(revolveVolume(k, left, Z_AXIS, TWO_PI)), vRef, 1e-12, 'left Pappus');
  checkSolid(bl, 'left', vRef);
  // A tilted plane and an oblique axis.
  const plane = unwrap(createPlaneSurface(k, vec3(10, -3, 7), vec3(1, 2, 3), vec3(0, 1, 0)));
  const ang = 0.4;
  const axis: RevolveAxis = { origin: point2(0.3, -0.2), direction: point2(Math.cos(ang), Math.sin(ang)) };
  const tp = profileOf([poly([0.6, 1.3], [1.4, 1.2], [1.6, 2.3], [0.5, 2.6])], plane);
  for (const angle of [TWO_PI, 2.0]) {
    const b = unwrap(revolve(k, tp, axis, angle));
    const v = unwrap(revolveVolume(k, tp, axis, angle));
    checkSolid(b, `tilted ${angle}`, v);
  }
});

// ---------------------------------------------------------------------------------------------------------
// Pappus (Lean Sweep.lean (d))

test('momentX_fan / pappus_polygon / pappus_triangle / pappus_volume: revolveVolume is Θ · area · centroid distance', () => {
  const polys: [number, number][][] = [
    [[1, 0], [3, 0.5], [2.5, 2], [1.5, 1.5]],
    [[0.5, -1], [2, 1], [0.7, 3]],
    [[1, 1], [4, 1], [4, 2], [2, 2], [2, 3], [1, 3]],
  ];
  for (const pts of polys) {
    const p = profileOf([poly(...pts)]);
    const ap = unwrap(profileAreaProperties(p));
    for (const theta of [TWO_PI, 1.1]) {
      const v = unwrap(revolveVolume(k, p, Z_AXIS, theta));
      near(v, theta * ap.area * ap.centroid.x, 1e-12 * v, 'Pappus');
      // Fan triangles about the origin: Σ area_i · centroid_i (pappus_polygon).
      let fan = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!, [bx, by] = pts[(i + 1) % pts.length]!;
        fan += ((ax * by - bx * ay) / 2) * ((0 + ax + bx) / 3);
      }
      near(v, theta * fan, 1e-12 * v, 'fan');
    }
  }
  // pappus_triangle: the triangle's volume is Θ · area · (ρa + ρb + ρc) / 3.
  const tri: [number, number][] = [[1, 0], [2, 1], [1, 2]];
  near(unwrap(revolveVolume(k, profileOf([poly(...tri)]), Z_AXIS, TWO_PI)), TWO_PI * 1 * (4 / 3), 1e-12, 'triangle');
});

test('revolve_frustum: the trapezoid on the axis revolves to makeCone’s frustum volume π/3 h (r0² + r0 r1 + r1²)', () => {
  const p = profileOf([poly([0, 0], [2, 0], [1, 2.5], [0, 2.5])]);
  const v = unwrap(revolveVolume(k, p, Z_AXIS, TWO_PI));
  near(v, (Math.PI / 3) * 2.5 * (4 + 2 + 1), 1e-12, 'frustum');
  const b = unwrap(revolve(k, p, Z_AXIS, TWO_PI));
  assert.deepEqual(kinds(b), ['plane', 'cone', 'plane']);
  const ref = meshSignedVolume(unwrap(tessellate(k, unwrap(makeCone(k, WORLD_PLACEMENT, 2, 1, 2.5)), { chord: 0.004 })));
  near(checkSolid(b, 'frustum', v), ref, v * 1e-3, 'frustum mesh vs makeCone mesh');
});

test('mesh volumes converge to the Pappus volume as the chord shrinks', () => {
  const p = profileOf([[unwrap(arcSegment2(point2(2, 0), 1, -HALF_PI, HALF_PI)), unwrap(lineSegment2(point2(2, 1), point2(2, -1)))]]);
  const b = unwrap(revolve(k, p, Z_AXIS, 2.5));
  const v = unwrap(revolveVolume(k, p, Z_AXIS, 2.5));
  let prev = Infinity;
  for (const chord of [0.02, 0.005, 0.001]) {
    const e = Math.abs(meshSignedVolume(unwrap(tessellate(k, b, { chord }))) - v);
    assert.ok(e < prev, `error ${e} does not shrink at chord ${chord}`);
    prev = e;
  }
});

// ---------------------------------------------------------------------------------------------------------
// Revolve: refusals

test('revolve refusals: crossing, pinching, bad angles and axes are invalid-input, never thrown', () => {
  const p = profileOf([rect(1, 0, 1, 2)]);
  expectInvalid(revolve(k, profileOf([rect(-1, 0, 3, 2)]), Z_AXIS, TWO_PI), /crosses the axis/);
  expectInvalid(revolve(k, profileOf([poly([0, 0], [1, -1], [1, 1])]), Z_AXIS, TWO_PI), /pinched/);
  expectInvalid(revolve(k, profileOf([circ(1, 0, 1)]), Z_AXIS, TWO_PI), /touches the axis inside|pinched/);
  expectInvalid(revolve(k, profileOf([circ(0.5, 0, 1)]), Z_AXIS, TWO_PI), /crosses/);
  for (const angle of [0, -1, NaN, Infinity, 7]) expectInvalid(revolve(k, p, Z_AXIS, angle));
  expectInvalid(revolve(k, p, { origin: point2(0, 0), direction: point2(0, 0) }, 1), /direction/);
  expectInvalid(revolve(k, p, { origin: point2(NaN, 0), direction: point2(0, 1) }, 1), /finite/);
  // The axis through the profile's interior.
  expectInvalid(revolve(k, p, { origin: point2(1.5, 0), direction: point2(0, 1) }, 1), /crosses/);
  // A NURBS whose control polygon reaches across the axis is refused (conservative).
  const bad = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[1, 0], [-0.5, 1], [1, 2]]));
  expectInvalid(revolve(k, profileOf([[unwrap(nurbsSegment2(bad)), unwrap(lineSegment2(point2(1, 2), point2(1, 0)))]]), Z_AXIS, TWO_PI));
  // A vertex 1e-4 from the axis turned by 1e-3 rad: its arc would be shorter than the zone tolerance.
  expectInvalid(revolve(k, profileOf([poly([1e-4, 0], [1, 0], [1, 1])]), Z_AXIS, 1e-3), /too close/);
  // A turn just short of 2π: the end cap would lie on the start cap within the zone tolerance (review regression:
  // this used to return a "valid" genus-0 solid with coincident caps). Slightly farther from 2π is a partial turn,
  // within ROUNDING_SLACK of 2π a full one.
  for (const d of [1e-7, 1e-9, 1e-11]) expectInvalid(revolve(k, p, Z_AXIS, TWO_PI - d), /turned copy/);
  assert.equal(unwrap(eulerPoincare(unwrap(revolve(k, p, Z_AXIS, TWO_PI - 1e-3)))).genus, 0);
  assert.equal(unwrap(eulerPoincare(unwrap(revolve(k, p, Z_AXIS, TWO_PI * (1 - 1e-13))))).genus, 1);
  expectInvalid(revolveVolume(k, p, Z_AXIS, 0));
});

test('revolve is deterministic and frozen', () => {
  const p = profileOf([rect(1, 0, 1, 2), circ(1.5, 1, 0.2)]);
  const a = unwrap(revolve(k, p, Z_AXIS, 2)), b = unwrap(revolve(k, p, Z_AXIS, 2));
  assert.equal(stringifyRecord(unwrap(brepToRecord(a))), stringifyRecord(unwrap(brepToRecord(b))));
  assert.ok(Object.isFrozen(a.vertices[0]) && Object.isFrozen(a.edges[0]) && Object.isFrozen(a.faces[0]!.surface));
});

// ---------------------------------------------------------------------------------------------------------
// Frames (Lean Sweep.lean (a), (b))

/** Deterministic pseudo-random numbers in [-1, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}
const rv = (r: () => number): Vec3 => vec3(r(), r(), r());

test('reflect_dot / reflect_involutive / reflect_swap: reflections keep dot products, undo themselves, swap equal-length vectors', () => {
  const r = rng(7);
  for (let i = 0; i < 200; i++) {
    const a = rv(r), b = rv(r), n = rv(r);
    near(dot3(reflect3(a, n), reflect3(b, n)), dot3(a, b), 1e-14, 'reflect_dot');
    assert.ok(distance3(reflect3(reflect3(a, n), n), a) < 1e-14, 'reflect_involutive');
    const s = length3(a) / length3(b);
    const b2 = vec3(b.x * s, b.y * s, b.z * s);
    assert.ok(distance3(reflect3(a, sub3(b2, a)), b2) < 1e-13, 'reflect_swap');
  }
  assert.deepEqual(reflect3(vec3(1, 2, 3), vec3(0, 0, 0)), vec3(1, 2, 3));
});

/** A cubic NURBS interpolating `turns` turns of the helix of radius `r` and pitch `pitch` (per turn) at `n` intervals. */
function helix(r: number, pitch: number, turns: number, n: number): NurbsCurve {
  const params = Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : i / n));
  const ip = unwrap(interpolation(params, 3));
  const pts = params.map((v) => {
    const a = TWO_PI * turns * v;
    return [r * Math.cos(a), r * Math.sin(a), pitch * turns * v];
  });
  const cols = [0, 1, 2].map((d) => ip.solve(pts.map((p) => p[d]!)));
  return unwrap(createNurbsCurve(3, ip.knots, params.map((_, i) => [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!])));
}

test('dr_tangent / dr_orthonormal / dr_frame_orthonormal: frames along a helix are orthonormal and carry the path tangent', () => {
  const path = unwrap(createNurbsCurve3(helix(3, 1, 1.5, 40)));
  const frames = unwrap(rotationMinimizingFrames(k, path, 400, vec3(1, 0, 0)));
  assert.equal(frames.length, 401);
  for (const f of frames) {
    near(length3(f.tangent), 1, 1e-14, 'tangent unit');
    near(length3(f.normal), 1, 1e-12, 'normal unit');
    near(length3(f.binormal), 1, 1e-12, 'binormal unit');
    near(dot3(f.normal, f.tangent), 0, 1e-12, 'normal ⟂ tangent');
    near(dot3(f.binormal, f.normal), 0, 1e-12, 'binormal ⟂ normal');
    near(dot3(f.binormal, f.tangent), 0, 1e-12, 'binormal ⟂ tangent');
    const d = unwrap(evaluateCurve3(path, f.t));
    assert.ok(distance3(f.point, d.point) === 0);
  }
  // One step reflects t_i onto t_{i+1} exactly as the Lean step (dr_tangent).
  const [f0, f1] = [frames[10]!, frames[11]!];
  const v1 = sub3(f1.point, f0.point);
  const tL = reflect3(f0.tangent, v1);
  assert.ok(distance3(reflect3(tL, sub3(f1.tangent, tL)), f1.tangent) < 1e-14);
  assert.ok(distance3(doubleReflectionStep(f0.point, f1.point, f0.tangent, f1.tangent, f0.normal), f1.normal) === 0);
});

test('rotation-minimizing frames: no twist about the tangent, unlike Frenet; exact on a circle and on a helix', () => {
  const R = 3, c = 1 / TWO_PI; // helix (R cos s, R sin s, c s): curvature R / (R² + c²), torsion c / (R² + c²)
  const path = unwrap(createNurbsCurve3(helix(R, 1, 1, 64)));
  /** The turn about `t1` of `n1` relative to `n0` carried by the least rotation from `t0` to `t1`. */
  const twistOf = (t0: Vec3, n0: Vec3, t1: Vec3, n1: Vec3): number => {
    const a = cross3(t0, t1), sn = length3(a), cs = dot3(t0, t1);
    let r = n0;
    if (sn > 0) {
      const u = vec3(a.x / sn, a.y / sn, a.z / sn), un = dot3(u, n0) * (1 - cs), uxn = cross3(u, n0);
      r = vec3(n0.x * cs + uxn.x * sn + u.x * un, n0.y * cs + uxn.y * sn + u.y * un, n0.z * cs + uxn.z * sn + u.z * un);
    }
    return Math.atan2(dot3(n1, cross3(t1, r)), dot3(n1, r));
  };
  const totalTwist = (count: number): readonly [number, number] => {
    const fr = unwrap(rotationMinimizingFrames(k, path, count, vec3(1, 0, 0)));
    let rmf = 0, fre = 0;
    for (let i = 0; i + 1 < fr.length; i++) {
      rmf += twistOf(fr[i]!.tangent, fr[i]!.normal, fr[i + 1]!.tangent, fr[i + 1]!.normal);
      const a = unwrap(curveFrenetFrame(k, path, fr[i]!.t)), b = unwrap(curveFrenetFrame(k, path, fr[i + 1]!.t));
      fre += twistOf(a.tangent, a.normal, b.tangent, b.normal);
    }
    return [rmf, fre];
  };
  const tau = c / (R * R + c * c), L = TWO_PI * Math.hypot(R, c);
  const [rmf128, frenet] = totalTwist(128);
  const [rmf512] = totalTwist(512);
  assert.ok(Math.abs(rmf512) < 1e-5 && Math.abs(rmf512) < Math.abs(rmf128) / 8, `RMF twist ${rmf128}, ${rmf512}`);
  near(Math.abs(frenet), tau * L, 0.01 * tau * L, 'Frenet twist is the total torsion');
  const frames = unwrap(rotationMinimizingFrames(k, path, 512, vec3(1, 0, 0)));
  // On a helix the RMF turns against the Frenet frame at the rate of the torsion: angle(N, r) = τ s + const.
  const angleAt = (i: number): number => {
    const f = frames[i]!, fr = unwrap(curveFrenetFrame(k, path, f.t));
    return Math.atan2(dot3(f.normal, fr.binormal), dot3(f.normal, fr.normal));
  };
  const s = unwrap(curveArcLength(k, path, frames[0]!.t, frames[256]!.t));
  let d = angleAt(256) - angleAt(0);
  d -= TWO_PI * Math.round(d / TWO_PI);
  near(Math.abs(d), tau * s, 1e-4, 'RMF vs Frenet angle');
  // On a circle the frame starting on the circle's normal keeps it (the exact RMF of a planar curve).
  const circle = unwrap(createCircleCurve(k, vec3(1, 2, 3), vec3(0, 0, 1), vec3(1, 0, 0), 2, [0, 5]));
  for (const f of unwrap(rotationMinimizingFrames(k, circle, 100, vec3(0, 0, 1)))) assert.ok(distance3(f.normal, vec3(0, 0, 1)) < 1e-12);
  // Refusals.
  expectInvalid(rotationMinimizingFrames(k, circle, 0, vec3(0, 0, 1)));
  expectInvalid(rotationMinimizingFrames(k, circle, 10, vec3(0, 1, 0)), /parallel/);
  expectInvalid(rotationMinimizingFrames(k, circle, 10, vec3(NaN, 1, 0)));
});

test('interpolation: passes through the data, reproduces cubics, shared knots for every column', () => {
  const params = [0, 0.1, 0.3, 0.35, 0.6, 0.8, 1];
  const ip = unwrap(interpolation(params, 3));
  const f = (x: number): number => 2 - x + 3 * x * x - 0.5 * x * x * x;
  const ys = params.map(f);
  const col = ip.solve(ys);
  params.forEach((p, i) => near(interpolationValue(ip, col, p), ys[i]!, 1e-13, 'interpolates'));
  for (const x of [0.05, 0.42, 0.97]) near(interpolationValue(ip, col, x), f(x), 1e-12, 'reproduces a cubic');
  assert.equal(ip.knots.length, params.length + 4);
  expectInvalid(interpolation([0, 0.5, 0.5, 1], 3));
  expectInvalid(interpolation([0.1, 1], 3));
  expectInvalid(interpolation([0], 3));
});

// ---------------------------------------------------------------------------------------------------------
// Sweep

const XY: PlaneSurface = unwrap(createPlaneSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0)));

test('sweep along a line equals extrude (both frames), forwards and against the normal', () => {
  const p = profileOf([rect(-0.5, -0.25, 1, 0.5), circ(0.2, 0, 0.1)], XY);
  for (const v of [vec3(0.3, 0.2, 2), vec3(0, 0, -1.5)]) {
    const line = unwrap(createSegmentCurve(vec3(5, 5, 5), vec3(5 + v.x, 5 + v.y, 5 + v.z)));
    const d = sub3(unwrap(evaluateCurve3(line, 1)).point, unwrap(evaluateCurve3(line, 0)).point);
    for (const frame of ['rotation-minimizing', 'fixed'] as const) {
      const r = unwrap(sweepWithReport(k, p, line, { frame }));
      assert.equal(r.method, 'extrude');
      const e = unwrap(extrude(k, p, d));
      assert.equal(stringifyRecord(unwrap(brepToRecord(r.brep))), stringifyRecord(unwrap(brepToRecord(e))));
    }
  }
  // A line given with a scaled parameter range sweeps its whole range.
  const l2 = unwrap(createLineCurve(vec3(0, 0, 0), vec3(0, 0, 0.5), [1, 3]));
  const e2 = unwrap(extrude(k, p, vec3(0, 0, 1)));
  assert.equal(stringifyRecord(unwrap(brepToRecord(unwrap(sweep(k, p, l2))))), stringifyRecord(unwrap(brepToRecord(e2))));
});

test('sweep along a circular arc whose axis lies in the profile plane is the revolution about it', () => {
  const p = profileOf([circ(0, 0, 0.3)], XZ);
  // The quarter circle of radius 2 from the origin about the axis through (2, 0, 0) along +z, which lies in the
  // profile plane y = 0; the path leaves the plane square to it (its start tangent is -y).
  const arc = unwrap(createCircleCurve(k, vec3(2, 0, 0), vec3(0, 0, 1), vec3(-1, 0, 0), 2, [0, HALF_PI]));
  const r = unwrap(sweepWithReport(k, p, arc));
  assert.equal(r.method, 'revolve');
  const exact = Math.PI * 0.09 * 2 * HALF_PI; // Pappus–Guldin: area × the centroid's path length
  near(unwrap(revolveVolume(k, p, { origin: point2(2, 0), direction: point2(0, 1) }, HALF_PI)), exact, 1e-12, 'Pappus');
  checkSolid(r.brep, 'arc sweep', exact);
});

test('sweep along a helix (rotation-minimizing): skinned NURBS sides within approxTol3d, planar end caps, extrude’s arena, A·L volume', () => {
  const H = helix(3, 1.2, 0.5, 24);
  const path = unwrap(createNurbsCurve3(H));
  const start = unwrap(evaluateCurve3(path, 0));
  const plane = unwrap(createPlaneSurface(k, start.point, start.d1, vec3(1, 0, 0)));
  const p = profileOf([rect(-0.3, -0.2, 0.6, 0.4)], plane);
  const r = unwrap(sweepWithReport(k, p, path));
  assert.equal(r.method, 'skinned');
  assert.ok(r.deviation <= k.tolerances.approxTol3d && r.stations >= 9 && r.stations <= MAX_SWEEP_STATIONS + 1, JSON.stringify([r.deviation, r.stations]));
  // The arena of extrude (Prism.lean's ids): same use model.
  assert.deepEqual(useModel(r.brep), useModel(unwrap(extrude(k, p, 1))));
  assert.deepEqual(kinds(r.brep), ['plane', 'plane', 'nurbs', 'nurbs', 'nurbs', 'nurbs']);
  // End caps: planar; the end cap is the profile plane moved rigidly to the path end, square to the end tangent.
  const endT = unwrap(evaluateCurve3(path, 1));
  const top = unwrap(faceSurface(r.brep, faceId(1)));
  assert.equal(top.kind, 'plane');
  if (top.kind === 'plane') {
    near(Math.abs(dot3(top.frame.normal, endT.d1)) / length3(endT.d1), 1, 1e-9, 'end cap square to the end tangent');
    assert.ok(distance3(top.origin, endT.point) < 1e-9);
  }
  const L = unwrap(curveArcLength(k, path));
  // Pappus–Guldin for a rotation-minimizing sweep with the centroid on the path: area × length.
  checkSolid(r.brep, 'helix rect', 0.24 * L, 0.004);
});

test('skinned sweep: the measured deviation bounds the surface error against much finer frames', () => {
  const H = helix(3, 1.2, 0.5, 24);
  const path = unwrap(createNurbsCurve3(H));
  const start = unwrap(evaluateCurve3(path, 0));
  const plane = unwrap(createPlaneSurface(k, start.point, start.d1, vec3(1, 0, 0)));
  const corner = point2(0.3, 0.2);
  const p = profileOf([rect(-0.3, -0.2, 0.6, 0.4)], plane);
  const r = unwrap(sweepWithReport(k, p, path));
  // Side 1 runs from corner (0.3, -0.2) to (0.3, 0.2): its u = 1 rail is the corner's trajectory.
  const fine = unwrap(rotationMinimizingFrames(k, path, 4096, plane.frame.xAxis));
  const side = r.brep.faces[3]!.surface;
  const c0 = unwrap(createPlaneSurface(k, start.point, start.d1, vec3(1, 0, 0)));
  const P = vec3(
    c0.origin.x + corner.x * c0.frame.xAxis.x + corner.y * c0.frame.yAxis.x,
    c0.origin.y + corner.x * c0.frame.xAxis.y + corner.y * c0.frame.yAxis.y,
    c0.origin.z + corner.x * c0.frame.xAxis.z + corner.y * c0.frame.yAxis.z,
  );
  let worst = 0;
  const f0 = fine[0]!;
  for (let i = 0; i <= 4096; i += 37) {
    const f = fine[i]!;
    const q = sub3(P, f0.point);
    const moved = vec3(
      f.point.x + f.normal.x * dot3(f0.normal, q) + f.binormal.x * dot3(f0.binormal, q) + f.tangent.x * dot3(f0.tangent, q),
      f.point.y + f.normal.y * dot3(f0.normal, q) + f.binormal.y * dot3(f0.binormal, q) + f.tangent.y * dot3(f0.tangent, q),
      f.point.z + f.normal.z * dot3(f0.normal, q) + f.binormal.z * dot3(f0.binormal, q) + f.tangent.z * dot3(f0.tangent, q),
    );
    worst = Math.max(worst, distance3(unwrap(surfacePoint3(side, 1, i / 4096)), moved));
  }
  // Between the measured stations and with the coarser frames the error stays within a few approxTol3d.
  assert.ok(worst <= 4 * k.tolerances.approxTol3d, `surface error ${worst}`);
});

test('sweep a circle along a helix with a coarser kernel: rational sides, seam rail, watertight, A·L volume', () => {
  const kc = createKernel({ zoneTol3d: 1e-4, xsectTol3d: 2e-4, approxTol3d: 5e-5 });
  const H = helix(2, 1, 0.75, 16);
  const path = unwrap(createNurbsCurve3(H));
  const start = unwrap(evaluateCurve3(path, 0));
  const plane = unwrap(createPlaneSurface(kc, start.point, start.d1, vec3(1, 0, 0)));
  const p = unwrap(createProfile(kc, plane, [circ(0, 0, 0.25)]));
  const r = unwrap(sweepWithReport(kc, p, path));
  assert.equal(r.method, 'skinned');
  assert.ok(r.deviation <= kc.tolerances.approxTol3d);
  const ep = unwrap(eulerPoincare(r.brep));
  assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.genus], [2, 3, 3, 0]);
  const L = unwrap(curveArcLength(kc, path));
  checkSolid(r.brep, 'helix circle', Math.PI * 0.0625 * L, 0.01, kc);
});

test('sweep along an ellipse and an arc whose axis is not in the profile plane: skinned', () => {
  const ell = unwrap(createEllipseCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2, 1.5, [0, 1.2]));
  const s = unwrap(evaluateCurve3(ell, 0));
  const plane = unwrap(createPlaneSurface(k, s.point, s.d1, vec3(0, 0, 1)));
  const p = profileOf([rect(-0.2, -0.2, 0.4, 0.4)], plane);
  const r = unwrap(sweepWithReport(k, p, ell));
  assert.equal(r.method, 'skinned');
  const L = unwrap(curveArcLength(k, ell));
  checkSolid(r.brep, 'ellipse', 0.16 * L, 0.01);
  // An arc path with the profile plane tilted towards the arc's axis: the axis is not in the plane, so it is skinned.
  // The sweep is the rotation of the tilted square about the axis: volume Θ R A (n · t0) (the flux of the rotation).
  const R = 2, theta = 1;
  const arc = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), R, [0, theta]));
  const a0 = unwrap(evaluateCurve3(arc, 0));
  const n = vec3(0, 1, 0.5);
  const tilted = unwrap(createPlaneSurface(k, a0.point, n, vec3(1, 0, 0)));
  const ra = unwrap(sweepWithReport(k, profileOf([rect(-0.2, -0.2, 0.4, 0.4)], tilted), arc));
  assert.equal(ra.method, 'skinned');
  checkSolid(ra.brep, 'tilted arc', theta * R * 0.16 * (1 / length3(n)), 0.01);
});

test('sweep with the fixed frame: exact translational sides S = C(u) + T(v) - T(0); volume area × rise', () => {
  const path = unwrap(createNurbsCurve3(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 0.5, 1, 1, 1, 1], [[0, 0, 0], [0.8, 0.1, 0.7], [-0.5, 0.6, 1.5], [0.4, 0.2, 2.2], [1, 0.5, 3]]))));
  const p = profileOf([rect(-0.3, -0.2, 0.6, 0.4), circ(0.1, 0, 0.1)], XY);
  const r = unwrap(sweepWithReport(k, p, path, { frame: 'fixed' }));
  assert.equal(r.method, 'translational');
  assert.equal(unwrap(eulerPoincare(r.brep)).genus, 1);
  // A side's points are exactly the profile point plus the path displacement.
  const side = r.brep.faces[2]!.surface; // the first side: segment from (-0.3, -0.2) to (0.3, -0.2)
  for (const [u, v] of [[0.2, 0.3], [0.7, 0.9], [0.5, 0.5]] as const) {
    const T = unwrap(evaluateCurve3(path, v)).point;
    const expected = vec3(-0.3 + 0.6 * u + T.x, -0.2 + T.y, T.z);
    assert.ok(distance3(unwrap(surfacePoint3(side, u, v)), expected) < 1e-12);
  }
  const area = 0.24 - Math.PI * 0.01;
  checkSolid(r.brep, 'fixed', area * 3, 0.01); // Cavalieri: area × rise
  // A circle path with the fixed frame is translational (rational path weights). The profile is a diamond so that no
  // side is a planar NURBS patch (the display mesher over-refines those: see the M3 report).
  const arc = unwrap(createCircleCurve(k, vec3(0, -2, 0), vec3(1, 0, 0), vec3(0, 1, 0), 2, [0, 1]));
  const diamond = poly([0.2, 0], [0, 0.2], [-0.2, 0], [0, -0.2]);
  const ra = unwrap(sweepWithReport(k, profileOf([diamond], XY), arc, { frame: 'fixed' }));
  assert.equal(ra.method, 'translational');
  checkSolid(ra.brep, 'fixed arc', 0.08 * 2 * Math.sin(1), 0.01);
});

test('sweep refusals: a path along the profile plane, a bend tighter than the profile, unknown frames', () => {
  const p = profileOf([circ(0, 0, 1.5)], XY);
  const inPlane = unwrap(createCircleCurve(k, vec3(0, 3, 0), vec3(0, 0, 1), vec3(1, 0, 0), 3, [0, 1]));
  expectInvalid(sweep(k, p, inPlane), /along the profile plane/);
  // An ellipse bending with radius 0.25 at its start while the profile reaches 1.5 from the path.
  const ell = unwrap(createEllipseCurve(k, vec3(-4, 0, 0), vec3(0, 1, 0), vec3(1, 0, 0), 4, 1, [Math.PI, 2 * Math.PI]));
  const s = unwrap(evaluateCurve3(ell, Math.PI));
  const plane = unwrap(createPlaneSurface(k, s.point, s.d1, vec3(1, 0, 0)));
  const r = sweep(k, profileOf([circ(0, 0, 1.5)], plane), ell);
  expectInvalid(r, /bends/);
  expectInvalid(sweep(k, p, unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(0, 0, 1))), { frame: 'other' as unknown as 'fixed' }), /unknown frame/);
  // A path along the profile plane with the fixed frame too.
  expectInvalid(sweep(k, p, inPlane, { frame: 'fixed' }), /along the profile plane/);
  // A line path inside the profile plane: extrude refuses it.
  expectInvalid(sweep(k, p, unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(1, 0, 0)))));
});

test('sweep is deterministic: the same call gives the same record text', () => {
  const H = helix(3, 1.2, 0.25, 12);
  const path = unwrap(createNurbsCurve3(H));
  const st = unwrap(evaluateCurve3(path, 0));
  const plane = unwrap(createPlaneSurface(k, st.point, st.d1, vec3(1, 0, 0)));
  const p = profileOf([rect(-0.3, -0.2, 0.6, 0.4)], plane);
  const a = stringifyRecord(unwrap(brepToRecord(unwrap(sweep(k, p, path)))));
  const b = stringifyRecord(unwrap(brepToRecord(unwrap(sweep(k, p, path)))));
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------------------------------------
// Review: hostile and degenerate inputs

test('revolve edge cases: horn and spindle arcs, notches at a partial turn, mixed regions, tilted planes, extreme scales', () => {
  const horn: Wire2 = [
    unwrap(lineSegment2(point2(0, 2), point2(0, 1))),
    unwrap(arcSegment2(point2(1, 1), 1, Math.PI, 1.5 * Math.PI)),
    unwrap(lineSegment2(point2(1, 0), point2(2, 0))),
    unwrap(lineSegment2(point2(2, 0), point2(2, 2))),
    unwrap(lineSegment2(point2(2, 2), point2(0, 2))),
  ];
  const s2 = Math.SQRT2;
  const spindle: Wire2 = [
    unwrap(arcSegment2(point2(-1, 0), 2, -Math.PI / 4, Math.PI / 4)),
    unwrap(lineSegment2(point2(-1 + s2, s2), point2(0.2, s2))),
    unwrap(lineSegment2(point2(0.2, s2), point2(0.2, -s2))),
    unwrap(lineSegment2(point2(0.2, -s2), point2(-1 + s2, -s2))),
  ];
  const tilt = unwrap(createPlaneSurface(k, vec3(1, 2, 3), vec3(1, 1, 1), vec3(1, -1, 0)));
  const cases: [string, Profile, RevolveAxis, number, number][] = [
    ['horn arc tangent to the axis at its end', profileOf([horn]), Z_AXIS, TWO_PI, 0.04],
    ['horn arc, partial', profileOf([horn]), Z_AXIS, 2, 0.04],
    ['spindle arc (centre across the axis)', profileOf([spindle]), Z_AXIS, TWO_PI, 0.01],
    ['notch closed by the axis, partial', profileOf([poly([0, 0], [2, 0], [2, 3], [0, 3], [0, 2], [1, 1.5], [0, 1])]), Z_AXIS, 1, 0.01],
    ['one region on the axis, one off it', profileOf([rect(1, 0, 1, 1), rect(0, 3, 1, 1)]), Z_AXIS, TWO_PI, 0.01],
    ['tilted plane, oblique offset axis', profileOf([rect(0, 0, 1, 1)], tilt), { origin: point2(3, 0), direction: point2(1, 2) }, 2.5, 0.01],
    ['huge', profileOf([rect(1e5, 0, 1e5, 1e5)]), Z_AXIS, TWO_PI, 100],
    ['tiny', profileOf([rect(1e-3, 0, 1e-3, 1e-3)]), Z_AXIS, 1, 1e-5],
  ];
  for (const [what, p, axis, angle, chord] of cases) {
    const b = unwrap(revolve(k, p, axis, angle));
    const v = checkSolid(b, what, unwrap(revolveVolume(k, p, axis, angle)), chord);
    assert.ok(v > 0, `${what}: inside out`);
  }
});

test('sweep: a profile away from the path start is carried rigidly (flux volume ∫ A v_c·N against 4096 finer frames)', () => {
  // A tilted circle path (axis not in the profile plane: skinned) starting 1.6 from the profile's corners.
  const path = unwrap(createCircleCurve(k, vec3(3, 0, 0.3), vec3(0, 0.3, 1), vec3(-1, 0, 0), 3, [0, 1]));
  const p = profileOf([rect(-1, -1, 2, 2)]);
  const r = unwrap(sweepWithReport(k, p, path));
  assert.equal(r.method, 'skinned');
  // Swept volume of a rigidly moving planar area A: ∫ A (ċ · N) dt, c its centroid (the origin), N its normal.
  const n = 4096;
  const fr = unwrap(rotationMinimizingFrames(k, path, n, vec3(1, 0, 0)));
  const mv = fr.map((f) => frameMotion(fr[0]!, f));
  let flux = 0;
  for (let i = 0; i < n; i++) {
    const d = sub3(mv[i + 1]!.point(vec3(0, 0, 0)), mv[i]!.point(vec3(0, 0, 0)));
    const na = mv[i]!.vector(XZ.frame.normal), nb = mv[i + 1]!.vector(XZ.frame.normal);
    flux += dot3(d, vec3((na.x + nb.x) / 2, (na.y + nb.y) / 2, (na.z + nb.z) / 2));
  }
  checkSolid(r.brep, 'offset skinned', 4 * flux, 0.01);
});
