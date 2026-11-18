import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { cross3, distance3, dot3, sub3, vec2, vec3, type Point3, type Vec3 } from '../src/math/vec.ts';
import { createCircleCurve, createNurbsCurve3, TWO_PI } from '../src/curve/types.ts';
import { createNurbsCurve, type NurbsCurve } from '../src/nurbs/curve.ts';
import { surfaceNormal3, surfacePoint3 } from '../src/surface/evaluate.ts';
import { createConeSurface, createSphereSurface } from '../src/surface/types.ts';
import {
  BrepBuilder,
  coedgeEnd,
  coedgeStart,
  eulerPoincare,
  faceId,
  freezeBrep,
  loopCoedges,
  loopId,
  topologyIssue,
  uvGapCollapses,
  validateBrep,
  validateBrepGeometry,
  type Brep,
  type Coedge,
  type CoedgeUse,
  type TopologyIssue,
} from '../src/topology/index.ts';
import { brepToRecord, recordToBrep } from '../src/convert/index.ts';
import { parseRecordText, stringifyRecord } from '../src/record/index.ts';
import { isConsistentlyOriented, isWatertight, meshSignedVolume, tessellate, weldVertices, type Mesh } from '../src/tess/index.ts';
import { WORLD_PLACEMENT, makeBox, makeCone, makeCylinder, makeSphere, makeTorus, placement, type Placement } from '../src/primitive/index.ts';

const k = createKernel();
const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------------------------------------------------
// Helpers

function expectIssue(r: Result<unknown>, issue: TopologyIssue, entity?: { kind: string; id: number }): void {
  assert.equal(r.ok, false, `expected ${issue}`);
  if (r.ok) return;
  assert.equal(topologyIssue(r.error), issue, r.error.kind === 'invalid-topology' ? r.error.reason : r.error.kind);
  if (entity !== undefined && r.error.kind === 'invalid-topology') assert.deepEqual(r.error.entity, entity);
}

function expectInvalid(r: Result<unknown>, pattern?: RegExp): void {
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-input', JSON.stringify(r.error));
  if (pattern !== undefined && r.error.kind === 'invalid-input') assert.match(r.error.reason, pattern);
}

/** A coedge reduced to the Lean `Use`: `[face, edge, reversed]`. */
type Use = readonly [number, number, boolean];

/** The Lean `Model` of a B-rep: vertex count, edge end pairs, face count, loops of uses in `next` order. */
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

/** Lean `countUsed` / `Model.V`, `E`, `F`, `L`, `chi` on a use model. */
function counts(m: UseModel): { V: number; E: number; F: number; L: number; chi: number } {
  const uses = m.loops.flat();
  const start = ([, e, rev]: Use): number => (rev ? m.edges[e]![1] : m.edges[e]![0]);
  const used = (n: number, p: (i: number) => boolean): number => Array.from({ length: n }, (_, i) => i).filter(p).length;
  const V = used(m.nv, (v) => uses.some((c) => start(c) === v));
  const E = used(m.edges.length, (e) => uses.some((c) => c[1] === e));
  const F = used(m.nf, (f) => uses.some((c) => c[0] === f));
  const L = m.loops.length;
  return { V, E, F, L, chi: V - E + F - (L - F) };
}

/** Lean `contract`: drop loops all of whose uses are edge `e`, and every other use of `e`. */
function contract(m: UseModel, e: number): UseModel {
  return { ...m, loops: m.loops.filter((l) => !l.every((c) => c[1] === e)).map((l) => l.filter((c) => c[1] !== e)) };
}

/** Lean `PairedAt` for every edge, and `loopCloses` for every loop. */
function pairedAndClosed(m: UseModel): { paired: boolean; closed: boolean } {
  const uses = m.loops.flat();
  const paired = m.edges.every((_, e) => {
    const revs = uses.filter((c) => c[1] === e).map((c) => c[2]);
    return revs.length === 2 && revs[0] !== revs[1];
  });
  const start = ([, e, rev]: Use): number => (rev ? m.edges[e]![1] : m.edges[e]![0]);
  const end = ([, e, rev]: Use): number => (rev ? m.edges[e]![0] : m.edges[e]![1]);
  const closed = m.loops.every((l) => l.every((c, i) => end(c) === start(l[(i + 1) % l.length]!)));
  return { paired, closed };
}

/** Record round trip through the canonical JSON text: the rebuilt body gives the same text again. */
function assertRecordRoundTrip(b: Brep): Brep {
  const text = stringifyRecord(unwrap(brepToRecord(b)));
  const back = unwrap(recordToBrep(k, unwrap(parseRecordText(text))));
  assert.equal(stringifyRecord(unwrap(brepToRecord(back))), text);
  assert.deepEqual(useModel(back), useModel(b));
  return back;
}

const P = (m: Mesh, i: number): Point3 => vec3(m.positions[3 * i]!, m.positions[3 * i + 1]!, m.positions[3 * i + 2]!);
const N = (m: Mesh, i: number): Vec3 => vec3(m.normals[3 * i]!, m.normals[3 * i + 1]!, m.normals[3 * i + 2]!);

/** Watertight, consistently oriented, finite, no zero-area triangle, each triangle facing its vertex normals. */
function assertGoodMesh(m: Mesh, what: string): void {
  assert.equal(m.stats.failedFaces.length, 0, `${what}: ${JSON.stringify(m.stats.failedFaces)}`);
  assert.equal(m.stats.failedEdges.length, 0, what);
  assert.ok(isWatertight(m), `${what}: not watertight`);
  assert.ok(isConsistentlyOriented(m), `${what}: not consistently oriented`);
  assert.ok(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite), `${what}: non-finite`);
  for (let i = 0; i < m.normals.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!) - 1) < 1e-9, `${what}: normal not unit`);
  }
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
    const n = cross3(sub3(P(m, b), P(m, a)), sub3(P(m, c), P(m, a)));
    assert.ok(Math.hypot(n.x, n.y, n.z) > 0, `${what}: zero-area triangle ${t / 3}`);
    for (const v of [a, b, c]) assert.ok(dot3(n, N(m, v)) > 0, `${what}: triangle ${t / 3} faces against its normals`);
  }
}

const tilted: Placement = placement(vec3(10, -3, 7), vec3(1, 2, 3), vec3(0, 1, 0));

interface Case {
  readonly name: string;
  readonly make: (p: Placement) => Result<Brep>;
  readonly volume: number;
  readonly area: number;
  /** Convex: the inscribed mesh never exceeds the exact volume. */
  readonly convex: boolean;
}

const r = 1.5, h = 2.5;
const frustumSlant = Math.hypot(h, 2 - 1);
const coneSlant = Math.hypot(h, r);
const CASES: readonly Case[] = [
  { name: 'cylinder', make: (p) => makeCylinder(k, p, r, h), volume: Math.PI * r * r * h, area: TWO_PI * r * h + TWO_PI * r * r, convex: true },
  {
    name: 'frustum',
    make: (p) => makeCone(k, p, 2, 1, h),
    volume: (Math.PI / 3) * h * (4 + 2 + 1),
    area: Math.PI * (2 + 1) * frustumSlant + Math.PI * (4 + 1),
    convex: true,
  },
  { name: 'cone apex on top', make: (p) => makeCone(k, p, r, 0, h), volume: (Math.PI / 3) * h * r * r, area: Math.PI * r * coneSlant + Math.PI * r * r, convex: true },
  { name: 'cone apex at the base', make: (p) => makeCone(k, p, 0, r, h), volume: (Math.PI / 3) * h * r * r, area: Math.PI * r * coneSlant + Math.PI * r * r, convex: true },
  { name: 'sphere', make: (p) => makeSphere(k, p.origin, r, p), volume: (4 / 3) * Math.PI * r ** 3, area: 4 * Math.PI * r * r, convex: true },
  { name: 'torus', make: (p) => makeTorus(k, p, 3, 1), volume: 2 * Math.PI * Math.PI * 3 * 1, area: 4 * Math.PI * Math.PI * 3 * 1, convex: false },
];

// ---------------------------------------------------------------------------------------------------------
// Every constructor: validation, record round trip, watertight display mesh

for (const c of CASES) {
  test(`${c.name}: validates (structure and geometry), round-trips through the record, meshes watertight`, () => {
    for (const p of [WORLD_PLACEMENT, tilted]) {
      const b = unwrap(c.make(p));
      assert.deepEqual(validateBrep(b), { ok: true, value: undefined });
      assert.deepEqual(validateBrepGeometry(k, b), { ok: true, value: undefined });
      assert.ok(Object.isFrozen(b) && Object.isFrozen(b.vertices) && Object.isFrozen(b.coedges[0]));
      const back = assertRecordRoundTrip(b);
      assert.deepEqual(validateBrepGeometry(k, back), { ok: true, value: undefined });
      const m = unwrap(tessellate(k, back, { chord: 0.01 }));
      assertGoodMesh(m, c.name);
      assert.ok(Math.abs(meshSignedVolume(m) - c.volume) <= c.area * 0.01, `${c.name}: volume ${meshSignedVolume(m)} vs ${c.volume}`);
    }
  });
}

test('volume convergence: the mesh volume approaches πr²h, π/3 h(r1² + r1r2 + r2²), 4/3 πr³, 2π²Rr² within area × chord, monotonically', () => {
  for (const c of CASES) {
    const b = unwrap(c.make(WORLD_PLACEMENT));
    let prev = Infinity;
    for (const chord of [0.05, 0.01, 0.002]) {
      const m = unwrap(tessellate(k, b, { chord }));
      assert.ok(isWatertight(m), c.name);
      const v = meshSignedVolume(m);
      const e = Math.abs(c.volume - v);
      // Every facet lies within the chord of the surface (vertices on it): the solids differ by at most a shell
      // of thickness `chord` over the surface area.
      assert.ok(e <= c.area * chord, `${c.name} chord ${chord}: error ${e} > ${c.area * chord}`);
      // Inscribed in a convex solid: never larger.
      if (c.convex) assert.ok(v <= c.volume * (1 + 1e-12), `${c.name}: inscribed mesh exceeds the solid`);
      assert.ok(e < prev, `${c.name}: error does not shrink at chord ${chord}`);
      prev = e;
    }
  }
});

// ---------------------------------------------------------------------------------------------------------
// Lean Primitive.lean: the combinatorial models

const cylinderModel: UseModel = {
  nv: 2,
  edges: [[0, 0], [1, 1], [0, 1]],
  nf: 3,
  loops: [[[0, 0, true]], [[1, 1, false]], [[2, 0, false], [2, 2, false], [2, 1, true], [2, 2, true]]],
};
const coneApexTopModel: UseModel = { nv: 2, edges: [[0, 0], [0, 1]], nf: 2, loops: [[[0, 0, true]], [[1, 0, false], [1, 1, false], [1, 1, true]]] };
const coneApexBottomModel: UseModel = { nv: 2, edges: [[1, 1], [0, 1]], nf: 2, loops: [[[0, 0, false]], [[1, 1, false], [1, 0, true], [1, 1, true]]] };
const sphereModel: UseModel = { nv: 2, edges: [[0, 1]], nf: 1, loops: [[[0, 0, false], [0, 0, true]]] };
const torusModel: UseModel = { nv: 1, edges: [[0, 0], [0, 0]], nf: 1, loops: [[[0, 0, false], [0, 1, false], [0, 0, true], [0, 1, true]]] };

const MODELS: readonly { name: string; brep: () => Brep; model: UseModel; counts: [number, number, number, number]; genus: number }[] = [
  { name: 'cylinder_model_eq / cylinder_counts_agree / cylinder_prim_counts / cylinder_prim_euler_poincare / cylinder_prim_genus / cylinder_prim_loops_close / cylinder_prim_paired', brep: () => unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3)), model: cylinderModel, counts: [2, 3, 3, 3], genus: 0 },
  { name: 'frustum (cylinderModel)', brep: () => unwrap(makeCone(k, WORLD_PLACEMENT, 2, 1, 3)), model: cylinderModel, counts: [2, 3, 3, 3], genus: 0 },
  { name: 'coneApexTop_counts / coneApexTop_euler_poincare / coneApexTop_genus / coneApexTop_loops_close / coneApexTop_paired', brep: () => unwrap(makeCone(k, WORLD_PLACEMENT, 2, 0, 3)), model: coneApexTopModel, counts: [2, 2, 2, 2], genus: 0 },
  { name: 'coneApexBottom_counts / coneApexBottom_euler_poincare / coneApexBottom_genus / coneApexBottom_loops_close / coneApexBottom_paired', brep: () => unwrap(makeCone(k, WORLD_PLACEMENT, 0, 2, 3)), model: coneApexBottomModel, counts: [2, 2, 2, 2], genus: 0 },
  { name: 'sphere_counts / sphere_euler_poincare / sphere_genus / sphere_loops_close / sphere_paired', brep: () => unwrap(makeSphere(k, vec3(0, 0, 0), 2)), model: sphereModel, counts: [2, 1, 1, 1], genus: 0 },
  { name: 'torus_counts / torus_euler_poincare / torus_genus / torus_loops_close / torus_paired', brep: () => unwrap(makeTorus(k, WORLD_PLACEMENT, 3, 1)), model: torusModel, counts: [1, 2, 1, 1], genus: 1 },
];

for (const M of MODELS) {
  test(`${M.name}: the TS body is the Lean model; eulerPoincare agrees`, () => {
    const b = M.brep();
    assert.deepEqual(useModel(b), M.model);
    const c = counts(M.model);
    assert.deepEqual([c.V, c.E, c.F, c.L], M.counts);
    assert.equal(c.chi, 2 * (1 - M.genus));
    const ep = unwrap(eulerPoincare(b));
    assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.loops, ep.shells, ep.genus], [...M.counts, 1, M.genus]);
    assert.deepEqual(pairedAndClosed(M.model), { paired: true, closed: true });
  });
}

test('sphere_seam_one_face / torus_seams_one_face: every edge of the sphere and the torus is a seam of its one face', () => {
  for (const b of [unwrap(makeSphere(k, vec3(1, 2, 3), 2)), unwrap(makeTorus(k, WORLD_PLACEMENT, 3, 1))]) {
    for (const co of b.coedges) assert.equal(b.loops[co.loop]!.face, 0);
    for (let e = 0; e < b.edges.length; e++) assert.equal(b.coedges.filter((c) => c.edge === e).length, 2);
  }
  // The poles are the start vertices of the two seam coedges (upstream `inside_face`).
  const s = unwrap(makeSphere(k, vec3(0, 0, 0), 2));
  assert.deepEqual([coedgeStart(s, 0 as never), coedgeEnd(s, 0 as never)], [0, 1]);
  assert.deepEqual(s.vertices.map((v) => v.point), [vec3(0, 0, -2), vec3(0, 0, 2)]);
});

test('pole_contraction_euler / pole_contraction_paired / cylinder_contract_top / cylinder_contract_both: contracting caps to poles keeps V - E + F - (L - F)', () => {
  const cyl = useModel(unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3)));
  const top = contract(cyl, 1);
  const both = contract(top, 0);
  const apex = counts(useModel(unwrap(makeCone(k, WORLD_PLACEMENT, 2, 0, 3))));
  const ball = counts(useModel(unwrap(makeSphere(k, vec3(0, 0, 0), 2))));
  for (const [m, want] of [[top, apex], [both, ball]] as const) {
    const c = counts(m);
    assert.deepEqual([c.V, c.E, c.F, c.L], [want.V, want.E, want.F, want.L]);
    assert.equal(c.chi, counts(cyl).chi);
    // Every remaining edge is still paired, and the loops still close (each removed coedge ran a closed edge).
    const used = new Set(m.loops.flat().map((u) => u[1]));
    const uses = m.loops.flat();
    for (const e of used) {
      const revs = uses.filter((u) => u[1] === e).map((u) => u[2]);
      assert.ok(revs.length === 2 && revs[0] !== revs[1]);
    }
  }
});

/** A unit sphere with explicit degenerate pole edges (constant NURBS curves): one coedge each, or two. */
function sphereWithPoleEdges(twoUses: boolean): Brep {
  const L = (a: number, b: number, c: number, d: number): NurbsCurve => unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[a, b], [c, d]]));
  const pointCurve = (p: Point3) => unwrap(createNurbsCurve3(unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[p.x, p.y, p.z], [p.x, p.y, p.z]]))));
  const b = new BrepBuilder();
  const sh = b.addShell(b.addBody());
  const S = vec3(0, 0, -1), Nn = vec3(0, 0, 1);
  const vs = b.addVertex(S), vn = b.addVertex(Nn);
  const seam = b.addEdge(vs, vn, unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, -1, 0), vec3(1, 0, 0), 1, [-HALF_PI, HALF_PI])), -HALF_PI, HALF_PI);
  const dn = b.addEdge(vn, vn, pointCurve(Nn), 0, 1);
  const ds = b.addEdge(vs, vs, pointCurve(S), 0, 1);
  const f = b.addFace(sh, unwrap(createSphereSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1)));
  const uses: CoedgeUse[] = twoUses
    ? [
        { edge: seam, reversed: false, pcurve: L(TWO_PI, -HALF_PI, TWO_PI, HALF_PI) },
        { edge: dn, reversed: false, pcurve: L(TWO_PI, HALF_PI, Math.PI, HALF_PI) },
        { edge: dn, reversed: true, pcurve: L(Math.PI, HALF_PI, 0, HALF_PI) },
        { edge: seam, reversed: true, pcurve: L(0, HALF_PI, 0, -HALF_PI) },
        { edge: ds, reversed: false, pcurve: L(0, -HALF_PI, Math.PI, -HALF_PI) },
        { edge: ds, reversed: true, pcurve: L(Math.PI, -HALF_PI, TWO_PI, -HALF_PI) },
      ]
    : [
        { edge: seam, reversed: false, pcurve: L(TWO_PI, -HALF_PI, TWO_PI, HALF_PI) },
        { edge: dn, reversed: false, pcurve: L(TWO_PI, HALF_PI, 0, HALF_PI) },
        { edge: seam, reversed: true, pcurve: L(0, HALF_PI, 0, -HALF_PI) },
        { edge: ds, reversed: false, pcurve: L(0, -HALF_PI, TWO_PI, -HALF_PI) },
      ];
  b.addLoop(f, uses);
  return b.build();
}

test('degenerate_pole_edge_shift / degenerate_pole_edge_unpaired / degenerate_pole_edge_two_uses: an explicit pole edge shifts the count and is rejected', () => {
  const sphere = counts(sphereModel);
  // One coedge per pole edge (upstream / SMLib style): chi drops by one per pole edge, and the edge is unpaired.
  const one = sphereWithPoleEdges(false);
  const m1 = useModel(one);
  assert.equal(counts(m1).chi, sphere.chi - 2);
  assert.equal(pairedAndClosed(m1).paired, false);
  expectIssue(validateBrep(one), 'edge-use-count', { kind: 'edge', id: 1 });
  // Two coedges: paired and closed, but chi = 0 (it would read as a torus); validateBrep sees a pinched vertex.
  const two = sphereWithPoleEdges(true);
  const m2 = useModel(two);
  assert.deepEqual(pairedAndClosed(m2), { paired: true, closed: true });
  assert.equal(counts(m2).chi, 0);
  expectIssue(validateBrep(two), 'non-manifold-vertex');
  // And cadloom's vertex-only sphere has none of this.
  assert.equal(counts(useModel(unwrap(makeSphere(k, vec3(0, 0, 0), 1)))).chi, 2);
});

test('frustum_volume_difference / frustum_volume_apex / frustum_volume_cylinder: the frustum is the difference of two similar cones', () => {
  for (const [r1, r2, hh] of [[2, 1, 3], [5, 0.5, 1], [1, 3, 2], [2, 2, 4], [3, 0, 2]] as const) {
    const formula = (Math.PI / 3) * hh * (r1 * r1 + r1 * r2 + r2 * r2);
    if (r1 !== r2) {
      // Heights of the full cones over r1 and r2: h1 = h r1 / (r1 - r2), h2 = h r2 / (r1 - r2) (h1 r2 = h2 r1).
      const h1 = (hh * r1) / (r1 - r2), h2 = (hh * r2) / (r1 - r2);
      assert.ok(Math.abs(h1 * r2 - h2 * r1) <= 1e-12 * Math.abs(h1 * r2));
      assert.ok(Math.abs((Math.PI / 3) * (h1 * r1 * r1 - h2 * r2 * r2) - formula) <= 1e-12 * formula);
      if (r2 === 0) assert.equal(h2, 0);
    } else {
      assert.ok(Math.abs(formula - Math.PI * r1 * r1 * hh) <= 1e-12 * formula);
    }
    // The mesh of makeCone converges to the formula (makeCone with r1 = r2 is a cylinder).
    const m = unwrap(tessellate(k, unwrap(makeCone(k, WORLD_PLACEMENT, r1, r2, hh)), { chord: 0.002 }));
    assert.ok(Math.abs(meshSignedVolume(m) - formula) <= 2e-3 * formula, `${r1}, ${r2}, ${hh}`);
  }
});

// ---------------------------------------------------------------------------------------------------------
// Poles: validation and display mesh

test('uvGapCollapses: the pole iso-lines of a sphere and the apex line of a cone collapse to their point; other gaps do not', () => {
  const s = unwrap(createSphereSurface(k, vec3(1, 2, 3), vec3(0, 0, 1), vec3(1, 0, 0), 2));
  assert.equal(uvGapCollapses(k, s, vec2(TWO_PI, HALF_PI), vec2(0, HALF_PI), vec3(1, 2, 5)), true);
  assert.equal(uvGapCollapses(k, s, vec2(0, -HALF_PI), vec2(TWO_PI, -HALF_PI), vec3(1, 2, 1)), true);
  assert.equal(uvGapCollapses(k, s, vec2(0, -HALF_PI), vec2(TWO_PI, -HALF_PI), vec3(1, 2, 5)), false); // wrong pole
  assert.equal(uvGapCollapses(k, s, vec2(TWO_PI, 0), vec2(0, 0), unwrap(surfacePoint3(s, 0, 0))), false); // equator
  assert.equal(uvGapCollapses(k, s, vec2(1, 0.5), vec2(1, 0.5), unwrap(surfacePoint3(s, 1, 0.5))), true); // no gap
  const cone = unwrap(createConeSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2, Math.atan(-2 / 3)));
  const apex = unwrap(surfacePoint3(cone, 0, 3));
  assert.ok(distance3(apex, vec3(0, 0, 3)) < 1e-12);
  assert.equal(uvGapCollapses(k, cone, vec2(TWO_PI, 3), vec2(0, 3), apex), true);
  assert.equal(uvGapCollapses(k, cone, vec2(TWO_PI, 0), vec2(0, 0), unwrap(surfacePoint3(cone, 0, 0))), false);
  assert.equal(uvGapCollapses(k, cone, vec2(NaN, 3), vec2(0, 3), apex), false);
});

/** `b` with the pcurve of coedge `i` replaced. */
function withPcurve(b: Brep, i: number, pc: NurbsCurve): Brep {
  return freezeBrep({ ...b, coedges: b.coedges.map((co, j): Coedge => (j === i ? { ...co, pcurve: pc } : co)) });
}
const seg = (u0: number, v0: number, u1: number, v1: number): NurbsCurve => unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0], [u1, v1]]));

test('loop-uv-gap: consecutive pcurves must meet in (u, v) unless the gap is a pole of their vertex', () => {
  // The cylinder's top circle pcurve one period up (u: 4π -> 2π) lifts onto the same circle, but the loop now
  // jumps along v = h, which is a whole circle, not the vertex.
  const cyl = unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3));
  expectIssue(validateBrepGeometry(k, withPcurve(cyl, 4, seg(2 * TWO_PI, 3, TWO_PI, 3))), 'loop-uv-gap', { kind: 'coedge', id: 4 });
  // The cone's apex gap is accepted; its base circle pcurve one period over (u: 2π -> 4π) is not: walking the loop
  // from that coedge, it ends at (4π, 0) and the seam (coedge 2) starts at (2π, 0), a whole circle away.
  const cone = unwrap(makeCone(k, WORLD_PLACEMENT, 2, 0, 3));
  assert.deepEqual(validateBrepGeometry(k, cone), { ok: true, value: undefined });
  assert.deepEqual(useModel(cone).loops[1]![0], [1, 0, false]); // coedge 1: the base circle on the side face
  expectIssue(validateBrepGeometry(k, withPcurve(cone, 1, seg(TWO_PI, 0, 2 * TWO_PI, 0))), 'loop-uv-gap', { kind: 'coedge', id: 2 });
  // The sphere's pole gaps are accepted; a seam pcurve on another meridian is caught by its own checks first.
  const ball = unwrap(makeSphere(k, vec3(0, 0, 0), 2));
  assert.deepEqual(validateBrepGeometry(k, ball), { ok: true, value: undefined });
  expectIssue(validateBrepGeometry(k, withPcurve(ball, 1, seg(Math.PI, HALF_PI, Math.PI, -HALF_PI))), 'pcurve-deviation', { kind: 'coedge', id: 1 });
});

test('sphere mesh: one pole vertex per pole, fanned, with the exact axis normal; no zero-area or flipped triangle', () => {
  for (const chord of [0.2, 0.05, 0.01]) {
    for (const p of [WORLD_PLACEMENT, tilted]) {
      const b = unwrap(makeSphere(k, p.origin, 2, p));
      const m = unwrap(tessellate(k, b, { chord }));
      assertGoodMesh(m, `sphere chord ${chord}`);
      const axis = b.faces[0]!.surface.kind === 'sphere' ? b.faces[0]!.surface.frame.normal : vec3(0, 0, 0);
      for (const [vi, sign] of [[0, -1], [1, 1]] as const) {
        const pole = b.vertices[vi]!.point;
        const at = [...Array(m.positions.length / 3).keys()].filter((i) => distance3(P(m, i), pole) === 0);
        assert.equal(at.length, 1, 'the pole is one mesh vertex');
        const n = N(m, at[0]!);
        assert.deepEqual(n, sign > 0 ? axis : vec3(0 - axis.x, 0 - axis.y, 0 - axis.z));
        // Its fan: at least three triangles, all around it.
        const fan = [];
        for (let t = 0; t < m.indices.length; t += 3) if ([0, 1, 2].some((j) => m.indices[t + j] === at[0])) fan.push(t);
        assert.ok(fan.length >= 3);
      }
      // Interior vertices carry the surface normal (radial).
      for (let i = 0; i < m.positions.length / 3; i++) {
        const radial = sub3(P(m, i), p.origin);
        assert.ok(dot3(radial, N(m, i)) > 2 * (1 - 1e-9));
      }
    }
  }
});

test('cone apex mesh: the apex is one vertex with the axis normal pointing out of the tip; the boundary ring visits it once', () => {
  for (const [r1, r2] of [[2, 0], [0, 2]] as const) {
    const b = unwrap(makeCone(k, tilted, r1, r2, 3));
    const m = unwrap(tessellate(k, b, { chord: 0.01 }));
    assertGoodMesh(m, `cone ${r1}, ${r2}`);
    const apexV = b.vertices[r1 === 0 ? 0 : 1]!.point;
    const side = m.faceRanges[m.faceRanges.length - 1]!;
    const ring = side.loops[0]!;
    assert.equal(ring.filter((v) => distance3(P(m, v), apexV) === 0).length, 1);
    const surf = b.faces[b.faces.length - 1]!.surface;
    assert.equal(surf.kind, 'cone');
    if (surf.kind !== 'cone') continue;
    const apexIdx = ring.find((v) => distance3(P(m, v), apexV) === 0)!;
    const tip = r1 === 0 ? -1 : 1; // the tip points down when the apex is at the base
    assert.deepEqual(N(m, apexIdx), tip > 0 ? surf.frame.normal : vec3(0 - surf.frame.normal.x, 0 - surf.frame.normal.y, 0 - surf.frame.normal.z));
    // Welded, the whole body has one apex vertex.
    const w = weldVertices(m);
    const apexes = new Set([...Array(m.positions.length / 3).keys()].filter((i) => distance3(P(m, i), apexV) === 0).map((i) => w[i]));
    assert.equal(apexes.size, 1);
  }
});

test('display normals at the pole are the surface limit: sphere ±Z exactly, and the surface has no normal there', () => {
  const s = unwrap(createSphereSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 1));
  assert.equal(surfaceNormal3(k, s, 0, HALF_PI).ok, false); // S_u = 0: no normal of its own
  const near = unwrap(surfaceNormal3(k, s, 0.3, HALF_PI - 1e-7));
  assert.ok(near.z > 1 - 1e-12); // the limit along v
});

// ---------------------------------------------------------------------------------------------------------
// Arguments, placement, layout

test('argument checks: invalid sizes, placements and radii are invalid-input, never thrown', () => {
  const tol = k.tolerances.zoneTol3d;
  for (const bad of [0, -1, NaN, Infinity, tol / 2]) {
    expectInvalid(makeCylinder(k, WORLD_PLACEMENT, bad, 1), /radius/);
    expectInvalid(makeCylinder(k, WORLD_PLACEMENT, 1, bad), /height/);
    expectInvalid(makeSphere(k, vec3(0, 0, 0), bad), /radius/);
    expectInvalid(makeTorus(k, WORLD_PLACEMENT, 3, bad), /minorRadius/);
    expectInvalid(makeCone(k, WORLD_PLACEMENT, 1, 1, bad), /height/);
  }
  expectInvalid(makeCone(k, WORLD_PLACEMENT, -1, 1, 1), /r1/);
  expectInvalid(makeCone(k, WORLD_PLACEMENT, 1, NaN, 1), /r2/);
  expectInvalid(makeCone(k, WORLD_PLACEMENT, 0, 0, 1), /at least one radius/);
  expectInvalid(makeCone(k, WORLD_PLACEMENT, tol / 2, tol / 3, 1), /at least one radius/);
  expectInvalid(makeTorus(k, WORLD_PLACEMENT, 1, 1), /majorRadius > minorRadius/);
  expectInvalid(makeTorus(k, WORLD_PLACEMENT, 1, 2), /majorRadius > minorRadius/);
  expectInvalid(makeCylinder(k, placement(vec3(0, 0, 0), vec3(0, 0, 0)), 1, 1), /placement/);
  expectInvalid(makeCylinder(k, placement(vec3(0, 0, 0), vec3(0, 0, 1), vec3(0, 0, 2)), 1, 1), /placement/);
  expectInvalid(makeCylinder(k, placement(vec3(NaN, 0, 0)), 1, 1), /origin/);
  expectInvalid(makeSphere(k, vec3(0, 0, 0), 1, { axis: vec3(1, 0, 0), xDirection: vec3(1, 0, 0) }), /placement/);
  // Overflow is refused by the constructors, not returned as a non-finite body.
  assert.equal(makeSphere(k, vec3(0, 0, 0), 1e300).ok, false);
  assert.equal(makeCylinder(k, placement(vec3(1e308, 0, 0)), 1e308, 1).ok, false);
});

test('makeCone: a radius at or below the zone tolerance is an apex; equal radii give the cylinder', () => {
  const tiny = unwrap(makeCone(k, WORLD_PLACEMENT, 2, k.tolerances.zoneTol3d / 2, 3));
  assert.deepEqual(useModel(tiny), coneApexTopModel);
  assert.deepEqual(tiny.vertices[1]!.point, vec3(0, 0, 3));
  const same = unwrap(makeCone(k, WORLD_PLACEMENT, 2, 2, 3));
  assert.equal(same.faces[2]!.surface.kind, 'cylinder');
  assert.equal(stringifyRecord(unwrap(brepToRecord(same))), stringifyRecord(unwrap(brepToRecord(unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3))))));
  const frustum = unwrap(makeCone(k, WORLD_PLACEMENT, 2, 1, 3));
  const side = frustum.faces[2]!.surface;
  assert.equal(side.kind, 'cone');
  if (side.kind === 'cone') assert.ok(Math.abs(Math.tan(side.semiAngle) * 3 + 2 - 1) < 1e-12); // R(h) = r2
});

test('placement: vertices and surfaces follow the frame; the world cylinder has the M2 fixture vertices exactly', () => {
  const c = unwrap(makeCylinder(k, WORLD_PLACEMENT, 2, 3));
  assert.deepEqual(c.vertices.map((v) => v.point), [vec3(2, 0, 0), vec3(2, 0, 3)]);
  assert.deepEqual(c.faces.map((f) => [f.surface.kind, f.reversed]), [['plane', true], ['plane', false], ['cylinder', false]]);
  const p = placement(vec3(1, 2, 3), vec3(0, 1, 0), vec3(0, 0, 1)); // axis +y, u = 0 along +z
  const t = unwrap(makeCylinder(k, p, 2, 5));
  assert.ok(distance3(t.vertices[0]!.point, vec3(1, 2, 5)) < 1e-12);
  assert.ok(distance3(t.vertices[1]!.point, vec3(1, 7, 5)) < 1e-12);
  const tor = unwrap(makeTorus(k, p, 3, 1));
  assert.ok(distance3(tor.vertices[0]!.point, vec3(1, 2, 7)) < 1e-12);
  const s = unwrap(makeSphere(k, vec3(1, 2, 3), 2, { axis: vec3(1, 0, 0), xDirection: vec3(0, 1, 0) }));
  assert.ok(distance3(s.vertices[0]!.point, vec3(-1, 2, 3)) < 1e-12 && distance3(s.vertices[1]!.point, vec3(3, 2, 3)) < 1e-12);
  // No negative zeros in vertex points (records read -0 as 0).
  for (const b of [c, t, tor, s]) for (const v of b.vertices) for (const x of [v.point.x, v.point.y, v.point.z]) assert.ok(!Object.is(x, -0));
});

test('scale: tiny and huge primitives validate and mesh watertight with the same relative volume', () => {
  const rel = (s: number): number[] =>
    CASES.map((c) => {
      const b = unwrap(c.make(placement(vec3(0, 0, 0))));
      const scaled = unwrap(
        c.name === 'sphere'
          ? makeSphere(k, vec3(0, 0, 0), r * s)
          : c.name === 'torus'
            ? makeTorus(k, WORLD_PLACEMENT, 3 * s, s)
            : c.name === 'cylinder'
              ? makeCylinder(k, WORLD_PLACEMENT, r * s, h * s)
              : c.name === 'frustum'
                ? makeCone(k, WORLD_PLACEMENT, 2 * s, s, h * s)
                : c.name === 'cone apex on top'
                  ? makeCone(k, WORLD_PLACEMENT, r * s, 0, h * s)
                  : makeCone(k, WORLD_PLACEMENT, 0, r * s, h * s),
      );
      assert.deepEqual(validateBrepGeometry(k, scaled), { ok: true, value: undefined }, `${c.name} at scale ${s}`);
      assert.deepEqual(useModel(scaled), useModel(b));
      const m = unwrap(tessellate(k, scaled, { chord: 0.01 * s }));
      assert.ok(isWatertight(m) && isConsistentlyOriented(m), `${c.name} at scale ${s}`);
      return meshSignedVolume(m) / (c.volume * s ** 3);
    });
  const base = rel(1);
  // Equal up to sag-refinement decisions taken right at the chord threshold (last-bit differences of the scaled
  // coordinates); the chord bound itself is 1e-2 relative.
  for (const s of [1e-3, 1e4]) rel(s).forEach((x, i) => assert.ok(Math.abs(x - base[i]!) < 1e-5, `${CASES[i]!.name} at scale ${s}: ${x} vs ${base[i]}`));
});

test('deterministic and frozen: the same call gives the same body; the box primitive is unchanged', () => {
  for (const c of CASES) {
    const a = stringifyRecord(unwrap(brepToRecord(unwrap(c.make(tilted)))));
    const b = stringifyRecord(unwrap(brepToRecord(unwrap(c.make(tilted)))));
    assert.equal(a, b);
  }
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 1, 2, 3));
  assert.deepEqual(validateBrepGeometry(k, box), { ok: true, value: undefined });
  assert.equal(faceId(0), 0);
});

// ---------------------------------------------------------------------------------------------------------
// Review regressions: extreme but valid proportions

/** Validates, round-trips and meshes watertight (default display tolerance unless a chord is given). */
function assertThreeChecks(b: Brep, what: string, volume: number, chord?: number): void {
  assert.deepEqual(validateBrep(b), { ok: true, value: undefined }, what);
  assert.deepEqual(validateBrepGeometry(k, b), { ok: true, value: undefined }, what);
  assertRecordRoundTrip(b);
  const m = unwrap(tessellate(k, b, chord === undefined ? {} : { chord }));
  assert.ok(isWatertight(m) && isConsistentlyOriented(m), `${what}: mesh not watertight`);
  assert.equal(m.stats.failedFaces.length, 0, what);
  const v = meshSignedVolume(m);
  assert.ok(v > 0 && Math.abs(v - volume) < 0.05 * volume, `${what}: volume ${v} vs ${volume}`);
}

test('steep cones: the apex lies on the surface despite tan of the rounded semi-angle; too flat cones are invalid-input', () => {
  // α = atan2(-1e3, 1e-3) is within 1e-6 of -π/2: tan(α) h misses -r1 by about 1e-7 relative, so R(h) < 0 past
  // the M1 rounding slack. The apex pcurves end on the surface's own apex line instead.
  for (const [r1, r2] of [[1e3, 0], [0, 1e3], [1e3, 1]] as const) {
    const b = unwrap(makeCone(k, WORLD_PLACEMENT, r1, r2, 1e-3));
    assertThreeChecks(b, `cone ${r1} -> ${r2}`, (Math.PI / 3) * 1e-3 * (r1 * r1 + r1 * r2 + r2 * r2));
  }
  // Slope 1e8: the stored angle cannot reproduce r2 within approxTol3d.
  expectInvalid(makeCone(k, WORLD_PLACEMENT, 1, 1e5, 1e-3), /too flat/);
  expectInvalid(makeCone(k, WORLD_PLACEMENT, 1e5, 0, 2e-5), /too flat/);
});

test('thin and nearly horn tori mesh watertight: square work cells, a cell budget, the torus u scale is its mean speed', () => {
  // R / r = 1e4: ~1000 grid columns ~0.06 apart around a tube 0.006 round. The grid was capped at MAX_GRID
  // columns, and its cells were far wider than tall in the work plane, so Delaunay joined v = 0 to v = 2π (the
  // same circle) between two columns: not watertight. The chord is below the tube radius (at a coarser chord the
  // ring's chords stray farther than the tube is thick, a display tolerance limit).
  const thin = unwrap(makeTorus(k, tilted, 10, 1e-3));
  assertThreeChecks(thin, 'thin torus', 2 * Math.PI ** 2 * 10 * 1e-6, 1e-4);
  const m = unwrap(tessellate(k, thin, { chord: 1e-4 }));
  assertGoodMesh(m, 'thin torus');
  // R - r = 1e-9: the speed at the middle of the face's v range (the inner equator) squashed the work plane in u.
  assertThreeChecks(unwrap(makeTorus(k, WORLD_PLACEMENT, 1, 1 - 1e-9)), 'nearly horn torus', 2 * Math.PI ** 2);
});
