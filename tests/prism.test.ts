import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { vec2, vec3, type Point2, type Vec3 } from '../src/math/vec.ts';
import { createPlaneSurface, type PlaneSurface } from '../src/surface/types.ts';
import { createNurbsCurve } from '../src/nurbs/curve.ts';
import { eulerPoincare, validateBrep, validateBrepGeometry, pcurveUv, type Brep } from '../src/topology/index.ts';
import { brepToRecord, recordToBrep } from '../src/convert/index.ts';
import { parseRecordText, stringifyRecord } from '../src/record/index.ts';
import { isConsistentlyOriented, isWatertight, meshSignedVolume, tessellate } from '../src/tess/index.ts';
import { polyhedronMass } from '../src/mass/index.ts';
import {
  arcSegment2,
  bulgeArc,
  bulgeWire,
  circleWire,
  createProfile,
  lineSegment2,
  nurbsSegment2,
  polygonWire,
  profileArea,
  rectangleWire,
  regularPolygonWire,
  slotWire,
  type Profile,
  type Wire2,
} from '../src/profile/index.ts';
import { extrude, extrusionOf, prismVolume } from '../src/prism/index.ts';
import { WORLD_PLACEMENT, makeCylinder } from '../src/primitive/index.ts';

const k = createKernel();
const P = (x: number, y: number): Point2 => vec2(x, y);
const xy = unwrap(createPlaneSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0)));
const tilted = unwrap(createPlaneSurface(k, vec3(1, 2, 3), vec3(1, 1, 1), vec3(1, -1, 0)));
const prof = (plane: PlaneSurface, wires: readonly Wire2[]): Profile => unwrap(createProfile(k, plane, wires));
const close = (a: number, b: number, eps: number, msg?: string): void =>
  assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a} (|diff| = ${Math.abs(a - b)})`);
const teardrop = (): Wire2 => [unwrap(nurbsSegment2(unwrap(createNurbsCurve(3, [0, 0, 0, 0, 0.5, 1, 1, 1, 1], [[0, 0], [2, -1], [4, 1], [3, 3], [0, 0]]))))];

interface Case {
  readonly name: string;
  readonly profile: Profile;
  readonly extent: number | Vec3;
  readonly symmetric?: boolean;
  /** Segments per wire of each region (outer first). */
  readonly sizes: readonly (readonly number[])[];
}

const cases: readonly Case[] = [
  { name: 'rectangle', profile: prof(xy, [unwrap(rectangleWire(0, 0, 2, 3))]), extent: 4, sizes: [[4]] },
  { name: 'circle (cylinder)', profile: prof(xy, [unwrap(circleWire(P(0, 0), 2))]), extent: 3, sizes: [[1]] },
  { name: 'plate with a round hole', profile: prof(xy, [unwrap(rectangleWire(-3, -3, 6, 6)), unwrap(circleWire(P(0, 0), 1))]), extent: 2, sizes: [[4, 1]] },
  { name: 'slot on a tilted plane', profile: prof(tilted, [unwrap(slotWire(P(0, 0), P(3, 1), 1))]), extent: 1.5, sizes: [[4]] },
  { name: 'slot, negative distance', profile: prof(tilted, [unwrap(slotWire(P(0, 0), P(3, 1), 1))]), extent: -1.5, sizes: [[4]] },
  {
    name: 'bulges (convex and concave arcs)',
    profile: prof(xy, [unwrap(bulgeWire([{ point: P(0, 0), bulge: 0 }, { point: P(4, 0), bulge: 0.5 }, { point: P(4, 3), bulge: -0.3 }, { point: P(0, 3), bulge: 0 }]))]),
    extent: 2,
    sizes: [[4]],
  },
  { name: 'NURBS loop', profile: prof(xy, [teardrop()]), extent: 1, sizes: [[1]] },
  { name: 'oblique slot (NURBS sides for arcs)', profile: prof(xy, [unwrap(slotWire(P(0, 0), P(3, 1), 1))]), extent: vec3(0.5, 0.3, 2), sizes: [[4]] },
  {
    name: 'symmetric hexagon with two holes',
    profile: prof(xy, [unwrap(regularPolygonWire(P(0, 0), 5, 6)), unwrap(circleWire(P(-2, 0), 1)), unwrap(rectangleWire(1, -1, 2, 2))]),
    extent: 1,
    symmetric: true,
    sizes: [[6, 1, 4]],
  },
  {
    name: 'two regions (island in a hole)',
    profile: prof(xy, [unwrap(rectangleWire(-10, -10, 20, 20)), unwrap(rectangleWire(-5, -5, 10, 10)), unwrap(circleWire(P(0, 0), 2))]),
    extent: 1,
    sizes: [[4, 4], [1]],
  },
];

const built = new Map<string, Brep>();
const brepOf = (c: Case): Brep => {
  let b = built.get(c.name);
  if (b === undefined) {
    b = unwrap(extrude(k, c.profile, c.extent, c.symmetric === undefined ? {} : { symmetric: c.symmetric }));
    built.set(c.name, b);
  }
  return b;
};

for (const c of cases) {
  test(`extrude ${c.name}: validateBrep, validateBrepGeometry, record round trip, watertight mesh`, () => {
    const b = brepOf(c);
    assert.equal(validateBrep(b).ok, true);
    const g = validateBrepGeometry(k, b);
    assert.ok(g.ok, g.ok ? '' : JSON.stringify(g.error));
    // Record round trip: canonical text is stable and the B-rep read back validates.
    const rec = unwrap(brepToRecord(b));
    const text = stringifyRecord(rec);
    const back = unwrap(recordToBrep(k, unwrap(parseRecordText(text))));
    assert.equal(stringifyRecord(unwrap(brepToRecord(back))), text);
    assert.equal(validateBrepGeometry(k, back).ok, true);
    // Display mesh.
    const m = unwrap(tessellate(k, back, { chord: 0.002 }));
    assert.equal(m.stats.failedFaces.length, 0);
    assert.equal(m.stats.failedEdges.length, 0);
    assert.ok(isWatertight(m), 'watertight');
    assert.ok(isConsistentlyOriented(m), 'consistently oriented');
    const v = unwrap(prismVolume(k, c.profile, c.extent));
    close(meshSignedVolume(m), v, 2e-3 * v, 'mesh volume');
  });
}

test('prism_counts / prism_euler_poincare / prism_genus: V = 2N, E = 3N, F = N + 2, L = N + 2(H + 1), genus H', () => {
  for (const c of cases) {
    const b = brepOf(c);
    const ep = unwrap(eulerPoincare(b));
    let V = 0, E = 0, F = 0, L = 0, G = 0;
    for (const ns of c.sizes) {
      const N = ns.reduce((a, x) => a + x, 0), H = ns.length - 1;
      V += 2 * N; E += 3 * N; F += N + 2; L += N + 2 * (H + 1); G += H;
    }
    assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops, ep.shells, ep.genus], [V, E, F, L, c.sizes.length, G], c.name);
    assert.deepEqual(ep.shellGenus, c.sizes.map((ns) => ns.length - 1));
    assert.equal(b.bodies.length, c.sizes.length, 'one body per region');
  }
});

test('examples_close / examples_paired: ids in the order of Prism.lean (edges B_g, T_g, S_g; loops bottom, top, sides)', () => {
  const c = cases.find((x) => x.name === 'plate with a round hole')!;
  const b = brepOf(c);
  const ns = [4, 1], N = 5;
  const next = [1, 2, 3, 0, 4];
  for (let g = 0; g < N; g++) {
    assert.deepEqual([b.edges[g]!.start, b.edges[g]!.end], [g, next[g]], `B_${g}`);
    assert.deepEqual([b.edges[N + g]!.start, b.edges[N + g]!.end], [N + g, N + next[g]!], `T_${g}`);
    assert.deepEqual([b.edges[2 * N + g]!.start, b.edges[2 * N + g]!.end], [g, N + g], `S_${g}`);
  }
  assert.equal(b.faces[0]!.reversed, true);
  assert.equal(b.faces[0]!.loops.length, ns.length);
  assert.equal(b.faces[1]!.loops.length, ns.length);
  // Side loop of g: [B_g fwd, S_next fwd, T_g rev, S_g rev].
  for (let g = 0; g < N; g++) {
    const l = b.loops[b.faces[2 + g]!.loops[0]!]!;
    const ids: [number, boolean][] = [];
    let ce = l.first;
    do {
      ids.push([b.coedges[ce]!.edge, b.coedges[ce]!.reversed]);
      ce = b.coedges[ce]!.next;
    } while (ce !== l.first);
    assert.deepEqual(ids, [[g, false], [2 * N + next[g]!, false], [N + g, true], [2 * N + g, true]]);
  }
});

test('prism_volume / prism_det / wire_det / caps_det / sides_det / prism_volume_shoelace: the polyhedral mass of an extruded polygon is exactly area × height (right and oblique)', () => {
  const outer = unwrap(polygonWire([P(0, 0), P(7, 0), P(9, 4), P(3, 6), P(-1, 3)]));
  const hole = unwrap(rectangleWire(2, 1, 3, 2));
  const pr = prof(xy, [outer, hole]);
  const area = unwrap(profileArea(pr));
  assert.equal(area, 42.5 - 6);
  for (const ext of [5, -3, vec3(1, 2, 4), vec3(-3, 1, -2)] as const) {
    const b = unwrap(extrude(k, pr, ext));
    const h = typeof ext === 'number' ? Math.abs(ext) : Math.abs(ext.z);
    assert.equal(unwrap(polyhedronMass(k, b)).volume, area * h, `extent ${JSON.stringify(ext)}`);
    assert.equal(unwrap(prismVolume(k, pr, ext)), area * h);
  }
  // A non-dyadic polygon on a tilted plane: equal up to rounding.
  const hex = prof(tilted, [unwrap(regularPolygonWire(P(0.3, -0.2), 2, 6, 0.1))]);
  close(unwrap(polyhedronMass(k, unwrap(extrude(k, hex, 1.7)))).volume, unwrap(prismVolume(k, hex, 1.7)), 1e-12);
});

test('cap_tri / side_det: the bottom face is the reversed base plane and side faces face outwards', () => {
  const b = brepOf(cases[0]!);
  const m = unwrap(tessellate(k, b, { chord: 0.01 }));
  assert.ok(meshSignedVolume(m) > 0);
  assert.equal(b.faces[0]!.surface.kind, 'plane');
  assert.equal(b.faces[1]!.reversed, false);
  close(meshSignedVolume(m), 24, 1e-12);
});

test('the mesh volume of curved prisms converges to prismVolume as the chord shrinks', () => {
  for (const c of [cases[1]!, cases[2]!, cases[6]!]) {
    const v = unwrap(prismVolume(k, c.profile, c.extent));
    const errs = [0.05, 0.005, 0.0005].map((chord) => Math.abs(meshSignedVolume(unwrap(tessellate(k, brepOf(c), { chord }))) - v));
    assert.ok(errs[0]! > errs[1]! && errs[1]! > errs[2]!, `${c.name}: ${errs.join(', ')}`);
    assert.ok(errs[2]! < 5e-4 * v, `${c.name}: ${errs[2]}`);
  }
});

test('arc sides are M1 cylinders with u in [0, |sweep|]; a full circle has a seam at u = 2π and u = 0', () => {
  const cyl = brepOf(cases[1]!);
  assert.deepEqual([cyl.vertices.length, cyl.edges.length, cyl.faces.length], [2, 3, 3]);
  const side = cyl.faces[2]!;
  assert.equal(side.surface.kind, 'cylinder');
  assert.equal(side.reversed, false);
  const l = cyl.loops[side.loops[0]!]!;
  const c1 = cyl.coedges[cyl.coedges[l.first]!.next]!, c3 = cyl.coedges[c1.next]!.next;
  assert.equal(c1.edge, cyl.coedges[c3]!.edge, 'the seam is used twice');
  assert.equal(unwrap(pcurveUv(c1.pcurve!, 0)).x, 2 * Math.PI);
  assert.equal(unwrap(pcurveUv(cyl.coedges[c3]!.pcurve!, 0)).x, 0);
  // Bulges: the convex arc is a cylinder face, the concave (clockwise) one a reversed cylinder face.
  const bul = brepOf(cases[5]!);
  const arcs = bul.faces.filter((f) => f.surface.kind === 'cylinder');
  assert.equal(arcs.length, 2);
  assert.deepEqual(arcs.map((f) => f.reversed).sort(), [false, true]);
  for (const f of arcs) {
    const lp = bul.loops[f.loops[0]!]!;
    let ce = lp.first;
    do {
      const pc = bul.coedges[ce]!.pcurve!;
      for (const s of [0, 1]) {
        const u = unwrap(pcurveUv(pc, s)).x;
        assert.ok(u >= 0 && u <= 4 * Math.atan(0.5) + 1e-12, `u = ${u}`);
      }
      ce = bul.coedges[ce]!.next;
    } while (ce !== lp.first);
  }
  // Oblique: arcs become NURBS sides; the hole of a plate stays a reversed cylinder.
  assert.ok(brepOf(cases[7]!).faces.some((f) => f.surface.kind === 'nurbs'));
  assert.ok(brepOf(cases[2]!).faces.some((f) => f.surface.kind === 'cylinder' && f.reversed));
});

test('extrusion extents: symmetric spans ±v/2, vectors along the normal are snapped, bad extents fail', () => {
  const sym = brepOf(cases[8]!);
  const zs = sym.vertices.map((v) => v.point.z);
  assert.equal(Math.min(...zs), -0.5);
  assert.equal(Math.max(...zs), 0.5);
  const e = unwrap(extrusionOf(k, xy, vec3(1e-14, 0, 2)));
  assert.equal(e.normal, true);
  assert.deepEqual(e.vector, { x: 0, y: 0, z: 2 });
  const pr = cases[0]!.profile;
  const bad: Result<unknown>[] = [
    extrude(k, pr, 0),
    extrude(k, pr, NaN),
    extrude(k, pr, 1e-6),
    extrude(k, pr, vec3(1, 0, 0)),
    extrude(k, pr, vec3(1, 0, 0.001)),
    extrude(k, pr, vec3(Infinity, 0, 1)),
    prismVolume(k, pr, 0),
  ];
  for (const r of bad) assert.equal(r.ok ? 'ok' : r.error.kind, 'invalid-input');
  // Negative distances build the same solid as positive ones from the far side.
  const neg = brepOf(cases[4]!), pos = brepOf(cases[3]!);
  close(unwrap(prismVolume(k, cases[4]!.profile, -1.5)), unwrap(prismVolume(k, cases[3]!.profile, 1.5)), 0);
  assert.equal(neg.faces.length, pos.faces.length);
});

test('the extruded circle matches makeCylinder, the single cylinder primitive (same counts, same mesh volume)', () => {
  const b = unwrap(extrude(k, prof(xy, [unwrap(circleWire(P(0, 0), 2))]), 3));
  const ep = unwrap(eulerPoincare(b));
  assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops, ep.genus], [2, 3, 3, 3, 0]);
  const tol = { chord: 0.01, angleDeg: 15 };
  const m = unwrap(tessellate(k, b, tol));
  const old = unwrap(tessellate(k, unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3)), tol));
  close(meshSignedVolume(m), meshSignedVolume(old), 1e-9);
  assert.equal(m.stats.triangles, old.stats.triangles);
  close(meshSignedVolume(unwrap(tessellate(k, b, { chord: 0.0005 }))), Math.PI * 4 * 3, 5e-4 * Math.PI * 12);
  assert.ok(Object.isFrozen(b) && Object.isFrozen(b.faces));
});

test('arcs given as two half circles extrude to two cylinder faces sharing vertical edges', () => {
  const halves: Wire2 = [unwrap(arcSegment2(P(0, 0), 1, 0, Math.PI)), unwrap(arcSegment2(P(0, 0), 1, Math.PI, 2 * Math.PI))];
  const b = unwrap(extrude(k, prof(xy, [halves]), 1));
  assert.equal(b.faces.filter((f) => f.surface.kind === 'cylinder').length, 2);
  const m = unwrap(tessellate(k, b, { chord: 0.001 }));
  assert.ok(isWatertight(m));
  close(meshSignedVolume(m), Math.PI, 5e-3);
});

test('NURBS side faces live on u in [0, 1]: oblique arcs of any sweep and NURBS segments of any knot domain extrude', () => {
  // Regression: with the curve's own domain [a, b] the iso-line pcurve u = b evaluated to b + 1 ulp, outside
  // the NURBS surface's domain, and validateBrepGeometry refused the solid (lens of sweep 4 atan(0.4); [-1.7, 3.3]).
  const lens: Wire2 = [unwrap(bulgeArc(P(0, 0), P(2, 0), 0.4)), unwrap(bulgeArc(P(2, 0), P(0, 0), 0.4))];
  const nearlyFull: Wire2 = [
    unwrap(arcSegment2(P(0, 0), 1, 0.01, 2 * Math.PI - 0.01)),
    unwrap(lineSegment2(P(Math.cos(-0.01), Math.sin(-0.01)), P(Math.cos(0.01), Math.sin(0.01)))),
  ];
  const shifted = (a: number, b: number): Wire2 => {
    const m = (a + b) / 2;
    return [unwrap(nurbsSegment2(unwrap(createNurbsCurve(3, [a, a, a, a, m, b, b, b, b], [[0, 0], [2, -1], [4, 1], [3, 3], [0, 0]]))))];
  };
  const runs: [Wire2, number | Vec3][] = [
    [lens, vec3(0.2, 0.1, 1)],
    [nearlyFull, vec3(0.5, 0, 1)],
    [shifted(-1.7, 3.3), 1],
    [shifted(-1.7, 3.3), vec3(0.3, 0.1, 1)],
    [shifted(2.3, 5.1), vec3(-0.3, 0.2, -1)],
  ];
  for (const [w, e] of runs) {
    const pr = prof(xy, [w]);
    const b = extrude(k, pr, e);
    assert.ok(b.ok, b.ok ? '' : JSON.stringify(b.error));
    for (const f of b.value.faces) {
      if (f.surface.kind !== 'nurbs') continue;
      const ku = f.surface.surface.knotsU;
      assert.deepEqual([ku[0], ku[ku.length - 1]], [0, 1]);
    }
    const m = unwrap(tessellate(k, b.value, { chord: 0.001 }));
    assert.ok(isWatertight(m) && isConsistentlyOriented(m));
    const v = unwrap(prismVolume(k, pr, e));
    close(meshSignedVolume(m), v, 5e-3 * v);
  }
});

test('a NURBS arch closed by a line (adjacent at two corner junctions) extrudes; its volume is area x height', () => {
  const arch: Wire2 = [unwrap(nurbsSegment2(unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[0, 0], [1, 2], [2, 0]])))), unwrap(lineSegment2(P(2, 0), P(0, 0)))];
  const pr = prof(xy, [arch]);
  close(unwrap(profileArea(pr)), 4 / 3, 1e-12);
  const b = unwrap(extrude(k, pr, 1));
  const m = unwrap(tessellate(k, b, { chord: 0.0005 }));
  assert.ok(isWatertight(m));
  close(meshSignedVolume(m), 4 / 3, 2e-3);
});
