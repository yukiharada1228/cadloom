import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { vec3, type Point3 } from '../src/math/vec.ts';
import type { Result } from '../src/core/error.ts';
import {
  BrepBuilder,
  buildPolyhedron,
  coedgeEnd,
  coedgeId,
  coedgeStart,
  eulerCharacteristic,
  eulerPoincare,
  faceId,
  faceNormal,
  faces,
  faceVertices,
  loopCoedges,
  loopId,
  topologyIssue,
  validateBrep,
  vertexId,
  type Brep,
  type TopologyIssue,
} from '../src/topology/index.ts';
import { BOX_FACES, makeBox } from '../src/primitive/index.ts';

const k = createKernel();

function box(o: Point3 = vec3(0, 0, 0), dx = 1, dy = 2, dz = 3): Brep {
  const r = makeBox(k, o, dx, dy, dz);
  assert.ok(r.ok, 'makeBox failed');
  return r.value;
}

function expectIssue(r: Result<unknown>, issue: TopologyIssue, entity?: { kind: string; id: number }): void {
  assert.equal(r.ok, false, `expected ${issue}`);
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-topology');
  assert.equal(topologyIssue(r.error), issue, r.error.kind === 'invalid-topology' ? r.error.reason : '');
  if (entity !== undefined && r.error.kind === 'invalid-topology') assert.deepEqual(r.error.entity, entity);
}

/** Total length of all loops (number of directed edge uses). */
function sumLoopLengths(b: Brep): number {
  let n = 0;
  for (let l = 0; l < b.loops.length; l++) {
    const cs = loopCoedges(b, loopId(l));
    assert.ok(cs.ok);
    n += cs.value.length;
  }
  return n;
}

/** Picture-frame solid (a polyhedral torus, genus 1): outer square [-2,2]^2, hole [-1,1]^2, z in [0,1]. */
function frame(): { points: Point3[]; faces: number[][] } {
  const sq = (s: number, z: number): Point3[] => [vec3(-s, -s, z), vec3(s, -s, z), vec3(s, s, z), vec3(-s, s, z)];
  const points = [...sq(2, 0), ...sq(1, 0), ...sq(2, 1), ...sq(1, 1)];
  const o = (i: number) => i % 4, inn = (i: number) => 4 + (i % 4), O = (i: number) => 8 + (i % 4), I = (i: number) => 12 + (i % 4);
  const fs: number[][] = [];
  for (let i = 0; i < 4; i++) {
    fs.push([o(i), o(i + 1), O(i + 1), O(i)]); // outer wall
    fs.push([inn(i + 1), inn(i), I(i), I(i + 1)]); // inner wall, facing the hole
    fs.push([O(i), O(i + 1), I(i + 1), I(i)]); // top
    fs.push([o(i), inn(i), inn(i + 1), o(i + 1)]); // bottom
  }
  return { points, faces: fs };
}

test('makeBox builds a valid B-rep with 8 vertices, 12 edges, 6 faces', () => {
  const b = box();
  assert.deepEqual(validateBrep(b), { ok: true, value: undefined });
  assert.equal(b.vertices.length, 8);
  assert.equal(b.edges.length, 12);
  assert.equal(b.faces.length, 6);
  assert.equal(b.loops.length, 6);
  assert.equal(b.coedges.length, 24);
  assert.equal(b.shells.length, 1);
  assert.equal(b.bodies.length, 1);
});

test('box_counts / box_euler: V - E + F = 2', () => {
  const b = box(vec3(5, -3, 2), 0.5, 7, 1.25);
  assert.equal(eulerCharacteristic(b), 2);
});

test('box_genus / genus_of_euler_poincare: the box has genus 0', () => {
  const r = eulerPoincare(box());
  assert.ok(r.ok);
  assert.deepEqual(
    { v: r.value.vertices, e: r.value.edges, f: r.value.faces, l: r.value.loops, s: r.value.shells, g: r.value.genus },
    { v: 8, e: 12, f: 6, l: 6, s: 1, g: 0 },
  );
  assert.equal(r.value.vertices - r.value.edges + r.value.faces - (r.value.loops - r.value.faces), 2 * (r.value.shells - r.value.genus));
});

test('genus_of_euler_poincare: a picture frame has genus 1 (V - E + F = 0)', () => {
  const { points, faces: fs } = frame();
  const r = buildPolyhedron(k, points, fs);
  assert.ok(r.ok, r.ok ? '' : JSON.stringify(r.error));
  assert.equal(eulerCharacteristic(r.value), 0);
  const ep = eulerPoincare(r.value);
  assert.ok(ep.ok);
  assert.equal(ep.value.genus, 1);
  assert.deepEqual(ep.value.shellGenus, [1]);
});

test('box_edge_uses_opposite: each edge is used by two coedges in opposite directions, as partners', () => {
  const b = box();
  const uses = new Map<string, number>();
  for (let c = 0; c < b.coedges.length; c++) {
    const key = `${coedgeStart(b, coedgeId(c))},${coedgeEnd(b, coedgeId(c))}`;
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  for (const [key, n] of uses) {
    const [s, e] = key.split(',');
    assert.equal(n, 1, key);
    assert.equal(uses.get(`${e},${s}`), 1, `reverse of ${key}`);
  }
  for (const [i, c] of b.coedges.entries()) {
    assert.notEqual(c.partner, null);
    const p = b.coedges[c.partner!]!;
    assert.equal(p.partner, i);
    assert.equal(p.edge, c.edge);
    assert.notEqual(p.reversed, c.reversed);
  }
});

test('uses_length / two_mul_edges_eq_sum_face_lengths: 2E = sum of loop lengths', () => {
  const tet = buildPolyhedron(k, [vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)], [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]]);
  assert.ok(tet.ok);
  const fr = frame();
  const frb = buildPolyhedron(k, fr.points, fr.faces);
  assert.ok(frb.ok);
  for (const b of [box(), tet.value, frb.value]) {
    const total = sumLoopLengths(b);
    assert.equal(total, b.coedges.length); // uses_length
    assert.equal(2 * b.edges.length, total); // two_mul_edges_eq_sum_face_lengths
  }
});

test('box faces follow BOX_FACES and have outward normals', () => {
  const o = vec3(1, 2, 3);
  const b = box(o, 2, 4, 6);
  const centre = vec3(2, 4, 6);
  const expected = [vec3(0, 0, -1), vec3(0, 0, 1), vec3(0, -1, 0), vec3(0, 1, 0), vec3(-1, 0, 0), vec3(1, 0, 0)];
  assert.deepEqual(faces(b), [0, 1, 2, 3, 4, 5]);
  for (const f of faces(b)) {
    const vs = faceVertices(b, f);
    assert.ok(vs.ok);
    assert.deepEqual([...vs.value], [...BOX_FACES[f]!]);
    const face = b.faces[f]!;
    const n = faceNormal(face);
    assert.deepEqual({ x: n.x + 0, y: n.y + 0, z: n.z + 0 }, expected[f]);
    const p = face.surface.origin;
    assert.ok((p.x - centre.x) * n.x + (p.y - centre.y) * n.y + (p.z - centre.z) * n.z > 0);
  }
});

test('accessors walk loops and coedge ends', () => {
  const b = box();
  const cs = loopCoedges(b, loopId(0));
  assert.ok(cs.ok);
  assert.equal(cs.value.length, 4);
  for (const [i, c] of cs.value.entries()) {
    assert.equal(coedgeEnd(b, c), coedgeStart(b, cs.value[(i + 1) % 4]!));
  }
  assert.equal(coedgeStart(b, coedgeId(999)), undefined);
  assert.equal(loopCoedges(b, loopId(99)).ok, false);
  assert.equal(faceVertices(b, faceId(99)).ok, false);
});

test('B-rep values are frozen', () => {
  const b = box();
  assert.ok(Object.isFrozen(b));
  assert.ok(Object.isFrozen(b.coedges));
  assert.ok(Object.isFrozen(b.coedges[0]));
  assert.ok(Object.isFrozen(b.faces[0]!.loops));
  assert.ok(Object.isFrozen(b.vertices[0]!.point));
});

test('makeBox rejects non-positive and non-finite sizes', () => {
  for (const [dx, dy, dz] of [[0, 1, 1], [1, -1, 1], [1, 1, Number.NaN], [Number.POSITIVE_INFINITY, 1, 1]] as const) {
    const r = makeBox(k, vec3(0, 0, 0), dx, dy, dz);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, 'invalid-input');
  }
  const far = makeBox(k, vec3(Number.MAX_VALUE, 0, 0), Number.MAX_VALUE, 1, 1);
  assert.equal(far.ok, false);
  assert.equal(makeBox(k, vec3(Number.NaN, 0, 0), 1, 1, 1).ok, false);
});

// --- Corruption: validation names the right issue and entity. ---

const withCoedge = (b: Brep, i: number, patch: Partial<Brep['coedges'][number]>): Brep => ({
  ...b,
  coedges: b.coedges.map((c, j) => (j === i ? { ...c, ...patch } : c)),
});

test('validation catches a broken next pointer', () => {
  const b = box();
  const c0 = b.coedges[0]!;
  const wrong = c0.next === coedgeId(2) ? coedgeId(3) : coedgeId(2);
  expectIssue(validateBrep(withCoedge(b, 0, { next: wrong })), 'next-prev', { kind: 'coedge', id: 0 });
});

test('validation catches a flipped coedge', () => {
  const b = box();
  const c = b.coedges[5]!;
  expectIssue(validateBrep(withCoedge(b, 5, { reversed: !c.reversed })), 'vertex-mismatch');
});

test('validation catches a face dropped from its shell', () => {
  const b = box();
  const dropped: Brep = { ...b, shells: b.shells.map((s) => ({ ...s, faces: s.faces.filter((f) => f !== faceId(4)) })) };
  expectIssue(validateBrep(dropped), 'parent-link', { kind: 'face', id: 4 });
});

test('validation catches a missing face (open box): edges with one coedge', () => {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => vec3(i & 1, (i >> 1) & 1, (i >> 2) & 1));
  const r = buildPolyhedron(k, corners, BOX_FACES.slice(0, 5));
  expectIssue(r, 'edge-use-count');
});

test('validation catches inconsistent face orientation', () => {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => vec3(i & 1, (i >> 1) & 1, (i >> 2) & 1));
  const fs = BOX_FACES.map((f, i) => (i === 1 ? [...f].reverse() : [...f]));
  expectIssue(buildPolyhedron(k, corners, fs), 'edge-orientation');
});

test('validation catches broken partners, dangling ids, isolated vertices, empty shells', () => {
  const b = box();
  const p0 = b.coedges[0]!.partner!;
  const other = p0 === coedgeId(1) ? coedgeId(2) : coedgeId(1);
  expectIssue(validateBrep(withCoedge(b, 0, { partner: other })), 'partner', { kind: 'coedge', id: 0 });
  expectIssue(validateBrep(withCoedge(b, 3, { edge: 40 as never })), 'id-range', { kind: 'coedge', id: 3 });
  expectIssue(validateBrep({ ...b, vertices: [...b.vertices, { point: vec3(9, 9, 9) }] }), 'unused-vertex', { kind: 'vertex', id: 8 });
  expectIssue(validateBrep({ ...b, edges: b.edges.map((e, i) => (i === 0 ? { ...e, end: e.start } : e)) }), 'degenerate-edge');
  expectIssue(validateBrep({ ...b, shells: [...b.shells, { body: b.shells[0]!.body, faces: [] }] }), 'empty', { kind: 'shell', id: 1 });
  expectIssue(eulerPoincare(withCoedge(b, 0, { partner: null })), 'partner');
});

test('validation catches a loop listing a coedge of another loop', () => {
  const b = box();
  // Coedge 0 claims loop 1, so loop 0's walk meets a coedge of another loop.
  expectIssue(validateBrep(withCoedge(b, 0, { loop: loopId(1) })), 'loop-membership');
});

test('BrepBuilder throws on ids it did not hand out (programming error)', () => {
  const bld = new BrepBuilder();
  const v = bld.addVertex(vec3(0, 0, 0));
  assert.throws(() => bld.addEdge(v, vertexId(7)), RangeError);
  const body = bld.addBody();
  const shell = bld.addShell(body);
  const f = bld.addFace(shell, { kind: 'plane', origin: vec3(0, 0, 0), normal: vec3(0, 0, 1) });
  assert.throws(() => bld.addLoop(f, []), RangeError);
});

test('buildPolyhedron rejects bad faces as values', () => {
  const pts = [vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)];
  const bad = (r: Result<Brep>, kind: string) => {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, kind);
  };
  bad(buildPolyhedron(k, pts, [[0, 1]]), 'invalid-input');
  bad(buildPolyhedron(k, pts, [[0, 1, 9]]), 'invalid-input');
  bad(buildPolyhedron(k, pts, [[0, 1, 1]]), 'invalid-input');
  bad(buildPolyhedron(k, [vec3(0, 0, 0), vec3(1, 0, 0), vec3(2, 0, 0)], [[0, 1, 2]]), 'degenerate');
  bad(buildPolyhedron(k, [...pts, vec3(1, 1, 0.5)], [[0, 1, 4, 2]]), 'invalid-input');
  bad(buildPolyhedron(k, [vec3(Number.NaN, 0, 0)], []), 'invalid-input');
});

test('box_counts: edges are created in the order of the Lean model boxEdges (first use of each key)', () => {
  const b = box();
  const keys = b.edges.map((e) => [Math.min(e.start, e.end), Math.max(e.start, e.end)]);
  // `#eval CadloomFormal.Topology.boxEdges`
  assert.deepEqual(keys, [[0, 2], [2, 3], [1, 3], [0, 1], [4, 5], [5, 7], [6, 7], [4, 6], [1, 5], [0, 4], [2, 6], [3, 7]]);
});

// --- Review additions: manifoldness and shell connectivity. ---

test('validation rejects two boxes in one shell (shell-disconnected)', () => {
  const c = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => vec3(i & 1, (i >> 1) & 1, (i >> 2) & 1));
  const far = c.map((p) => vec3(p.x + 5, p.y, p.z));
  const r = buildPolyhedron(k, [...c, ...far], [...BOX_FACES.map((f) => [...f]), ...BOX_FACES.map((f) => f.map((i) => i + 8))]);
  expectIssue(r, 'shell-disconnected', { kind: 'shell', id: 0 });
});

test('validation rejects two tetrahedra touching at one vertex (non-manifold-vertex)', () => {
  const tet = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]];
  const pts = [vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(1, 1, 1), vec3(2, 1, 1), vec3(1, 2, 1), vec3(1, 1, 2)];
  // Second tetrahedron: vertex 0 of the pattern is shared vertex 3.
  const map = [3, 4, 5, 6];
  const r = buildPolyhedron(k, pts, [...tet, ...tet.map((f) => f.map((i) => map[i]!))]);
  expectIssue(r, 'non-manifold-vertex', { kind: 'vertex', id: 3 });
});

test('validateBrep: a single-face digon sphere is a valid (degenerate-geometry) cell structure', () => {
  // Topologically a sphere: one face whose loop runs an edge forward and back. V - E + F = 2.
  const bld = new BrepBuilder();
  const a = bld.addVertex(vec3(0, 0, 0)), c = bld.addVertex(vec3(1, 0, 0));
  const e = bld.addEdge(a, c);
  const f = bld.addFace(bld.addShell(bld.addBody()), { kind: 'plane', origin: vec3(0, 0, 0), normal: vec3(0, 0, 1) });
  bld.addLoop(f, [{ edge: e, reversed: false }, { edge: e, reversed: true }]);
  const b = bld.build();
  assert.deepEqual(validateBrep(b), { ok: true, value: undefined });
  const ep = eulerPoincare(b);
  assert.ok(ep.ok);
  assert.equal(ep.value.genus, 0);
});
