import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { normalize3, vec3, type Point3 } from '../src/math/vec.ts';
import { BrepBuilder, buildPolyhedron, eulerPoincare, faceId, fanVectorArea2, validateBrep, type Brep } from '../src/topology/index.ts';
import { BOX_FACES, boxCorner, makeBox } from '../src/primitive/index.ts';
import { det3, fanTriangles, polyhedronMass, polyhedronTriangles, signedVolume, type Triangle } from '../src/mass/index.ts';

const k = createKernel();

function box(o: Point3, dx: number, dy: number, dz: number): Brep {
  const r = makeBox(k, o, dx, dy, dz);
  assert.ok(r.ok);
  return r.value;
}

const close = (a: number, b: number, rel = 1e-12) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const closePt = (a: Point3, b: Point3, rel = 1e-12) => { close(a.x, b.x, rel); close(a.y, b.y, rel); close(a.z, b.z, rel); };

/** Deterministic pseudo-random integers (no Math.random). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s % 21) - 10;
  };
}
const rndPt = (r: () => number): Point3 => vec3(r(), r(), r());

test('det_cyclic: det(a, b, c) = det(b, c, a)', () => {
  const r = lcg(1);
  for (let i = 0; i < 50; i++) {
    const a = rndPt(r), b = rndPt(r), c = rndPt(r);
    assert.equal(det3(a, b, c), det3(b, c, a));
  }
});

test('det_smul: scaling all three vectors by s multiplies det by s^3 (exact for powers of two)', () => {
  const r = lcg(6);
  for (let i = 0; i < 50; i++) {
    const a = rndPt(r), b = rndPt(r), c = rndPt(r);
    for (const s of [0.5, 2, 2 ** -20, 1024]) {
      const sc = (p: Point3) => vec3(p.x * s, p.y * s, p.z * s);
      assert.equal(det3(sc(a), sc(b), sc(c)), s ** 3 * det3(a, b, c));
    }
  }
});

test('det_swap / tetDet_swap: swapping two vertices negates the signed volume', () => {
  const r = lcg(2);
  for (let i = 0; i < 50; i++) {
    const a = rndPt(r), b = rndPt(r), c = rndPt(r), ref = rndPt(r);
    assert.equal(det3(a, c, b) + 0, -det3(a, b, c) + 0);
    assert.equal(signedVolume([[a, c, b]], ref) + 0, -signedVolume([[a, b, c]], ref) + 0);
  }
});

test('fanDet_split / loopDet_split: a fan splits additively along a diagonal from the first vertex', () => {
  const r = lcg(3);
  for (let n = 4; n <= 9; n++) {
    const poly = Array.from({ length: n }, () => rndPt(r));
    const ref = rndPt(r);
    for (let kk = 2; kk < n - 1; kk++) {
      const whole = signedVolume(fanTriangles(poly), ref);
      const left = signedVolume(fanTriangles(poly.slice(0, kk + 1)), ref);
      const right = signedVolume(fanTriangles([poly[0]!, ...poly.slice(kk)]), ref);
      close(whole, left + right);
      // Integer data: the six-fold sums are exact.
      assert.equal(6 * whole, 6 * left + 6 * right);
    }
  }
});

test('fanDet_reverse / loopDet_reverse: reversing a loop negates its contribution', () => {
  const r = lcg(4);
  for (let n = 3; n <= 9; n++) {
    const poly = Array.from({ length: n }, () => rndPt(r));
    const ref = rndPt(r);
    const reversed = [poly[0]!, ...poly.slice(1).reverse()];
    assert.equal(signedVolume(fanTriangles(reversed), ref) + 0, -signedVolume(fanTriangles(poly), ref) + 0);
  }
});

test('boxVolume_eq: the fan-triangulated BOX_FACES sum is dx*dy*dz for any reference point', () => {
  const r = lcg(5);
  for (let i = 0; i < 20; i++) {
    const o = rndPt(r), ref = rndPt(r);
    const dx = Math.abs(r()) + 1, dy = Math.abs(r()) + 0.5, dz = Math.abs(r()) + 0.25;
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => boxCorner(o, dx, dy, dz, j));
    const tris: Triangle[] = BOX_FACES.flatMap((f) => fanTriangles(f.map((j) => corners[j]!)));
    assert.equal(signedVolume(tris, ref), dx * dy * dz);
    // The same triangles as polyhedronTriangles walks on the B-rep built by makeBox.
    const pt = polyhedronTriangles(k, box(o, dx, dy, dz));
    assert.ok(pt.ok);
    assert.deepEqual(pt.value.triangles, tris);
  }
});

test('box mass: volume dx*dy*dz, area 2(xy + yz + zx), centroid at the centre', () => {
  const cases: [Point3, number, number, number][] = [
    [vec3(0, 0, 0), 1, 2, 3],
    [vec3(10, -20, 30), 0.5, 4, 1.25],
    [vec3(1e6, 1e6, -1e6), 3, 5, 7],
    [vec3(-0.3, 0.7, 0.1), 0.1, 0.2, 0.3],
  ];
  for (const [o, dx, dy, dz] of cases) {
    const m = polyhedronMass(k, box(o, dx, dy, dz));
    assert.ok(m.ok);
    close(m.value.volume, dx * dy * dz, 1e-12);
    close(m.value.area, 2 * (dx * dy + dy * dz + dz * dx), 1e-12);
    closePt(m.value.centroid, vec3(o.x + dx / 2, o.y + dy / 2, o.z + dz / 2), 1e-12);
    assert.deepEqual(m.value.bbox, { min: o, max: vec3(o.x + dx, o.y + dy, o.z + dz) });
    assert.ok(Object.isFrozen(m.value));
  }
});

test('mass of a tetrahedron and of a picture frame (genus 1)', () => {
  const tet = buildPolyhedron(k, [vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)], [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]]);
  assert.ok(tet.ok);
  const mt = polyhedronMass(k, tet.value);
  assert.ok(mt.ok);
  close(mt.value.volume, 1 / 6);
  close(mt.value.area, 1.5 + Math.sqrt(3) / 2);
  closePt(mt.value.centroid, vec3(0.25, 0.25, 0.25));

  const sq = (s: number, z: number): Point3[] => [vec3(-s, -s, z), vec3(s, -s, z), vec3(s, s, z), vec3(-s, s, z)];
  const points = [...sq(2, 0), ...sq(1, 0), ...sq(2, 1), ...sq(1, 1)];
  const o = (i: number) => i % 4, inn = (i: number) => 4 + (i % 4), O = (i: number) => 8 + (i % 4), I = (i: number) => 12 + (i % 4);
  const fs: number[][] = [];
  for (let i = 0; i < 4; i++) {
    fs.push([o(i), o(i + 1), O(i + 1), O(i)], [inn(i + 1), inn(i), I(i), I(i + 1)], [O(i), O(i + 1), I(i + 1), I(i)], [o(i), inn(i), inn(i + 1), o(i + 1)]);
  }
  const fr = buildPolyhedron(k, points, fs);
  assert.ok(fr.ok);
  const mf = polyhedronMass(k, fr.value);
  assert.ok(mf.ok);
  close(mf.value.volume, 12);
  close(mf.value.area, 48);
  closePt(mf.value.centroid, vec3(0, 0, 0.5));
});

test('signedVolume is negative for an inside-out mesh and zero for an empty one', () => {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => boxCorner(vec3(0, 0, 0), 2, 3, 4, j));
  const tris: Triangle[] = BOX_FACES.flatMap((f) => fanTriangles(f.map((j) => corners[j]!)));
  assert.equal(signedVolume(tris.map(([a, b, c]) => [a, c, b] as const)), -24);
  assert.equal(signedVolume([]), 0);
});

test('polyhedronMass rejects non-planar faces, flipped face normals and invalid topology', () => {
  const b = box(vec3(0, 0, 0), 1, 1, 1);
  const lifted: Brep = { ...b, vertices: b.vertices.map((v, i) => (i === 7 ? { point: vec3(1, 1, 1.5) } : v)) };
  const np = polyhedronMass(k, lifted);
  assert.equal(np.ok, false);
  if (!np.ok) assert.equal(np.error.kind, 'invalid-input');

  const flipped: Brep = { ...b, faces: b.faces.map((f, i) => (i === 2 ? { ...f, reversed: true } : f)) };
  const fl = polyhedronMass(k, flipped);
  assert.equal(fl.ok, false);
  if (!fl.ok) assert.deepEqual([fl.error.kind, fl.error.kind === 'invalid-topology' && fl.error.entity], ['invalid-topology', { kind: 'face', id: faceId(2) }]);

  const open: Brep = { ...b, shells: b.shells.map((s) => ({ ...s, faces: s.faces.slice(1) })) };
  const op = polyhedronMass(k, open);
  assert.equal(op.ok, false);
  if (!op.ok) assert.equal(op.error.kind, 'invalid-topology');
});

// --- Review additions: faces with holes, overflow, non-finite data. ---

/** Builds a single-shell B-rep from faces given as lists of loops (outer first) of point indices. */
function withHoles(points: readonly Point3[], fs: readonly (readonly (readonly number[])[])[]): Brep {
  const bld = new BrepBuilder();
  const shell = bld.addShell(bld.addBody());
  const vs = points.map((p) => bld.addVertex(p));
  const edges = new Map<string, { edge: ReturnType<BrepBuilder['addEdge']>; start: number }>();
  for (const loops of fs) {
    const outer = loops[0]!.map((i) => points[i]!);
    const n = normalize3(fanVectorArea2(outer))!;
    const f = bld.addFace(shell, { kind: 'plane', origin: outer[0]!, normal: n });
    for (const loop of loops) {
      bld.addLoop(f, loop.map((a, j) => {
        const c = loop[(j + 1) % loop.length]!;
        const key = a < c ? `${a},${c}` : `${c},${a}`;
        const known = edges.get(key);
        if (known !== undefined) return { edge: known.edge, reversed: known.start !== a };
        const edge = bld.addEdge(vs[a]!, vs[c]!);
        edges.set(key, { edge, start: a });
        return { edge, reversed: false };
      }));
    }
  }
  return bld.build();
}

/** Square block [-2,2]^2 x [0,1] with a square through-hole [-1,1]^2: top and bottom faces have an inner loop. */
function holedBlock(insideOut: boolean): Brep {
  const sq = (s: number, z: number): Point3[] => [vec3(-s, -s, z), vec3(s, -s, z), vec3(s, s, z), vec3(-s, s, z)];
  const points = [...sq(2, 0), ...sq(1, 0), ...sq(2, 1), ...sq(1, 1)];
  const o = (i: number) => i % 4, inn = (i: number) => 4 + (i % 4), O = (i: number) => 8 + (i % 4), I = (i: number) => 12 + (i % 4);
  const rev = (l: number[]) => (insideOut ? [...l].reverse() : l);
  const fs: number[][][] = [
    [[o(0), o(3), o(2), o(1)], rev([inn(0), inn(1), inn(2), inn(3)])], // bottom (-z), hole clockwise
    [[O(0), O(1), O(2), O(3)], rev([I(0), I(3), I(2), I(1)])], // top (+z), hole clockwise
  ];
  for (let i = 0; i < 4; i++) {
    fs.push([[o(i), o(i + 1), O(i + 1), O(i)]]); // outer walls
    fs.push([rev([inn(i + 1), inn(i), I(i), I(i + 1)])]); // hole walls
  }
  return withHoles(points, fs);
}

test('faces with holes: volume, area and genus of a block with a through-hole', () => {
  const b = holedBlock(false);
  const ep = eulerPoincare(b);
  assert.ok(ep.ok, ep.ok ? '' : JSON.stringify(ep.error));
  assert.deepEqual([ep.value.vertices, ep.value.edges, ep.value.faces, ep.value.loops, ep.value.genus], [16, 24, 10, 12, 1]);
  const m = polyhedronMass(k, b);
  assert.ok(m.ok, m.ok ? '' : JSON.stringify(m.error));
  close(m.value.volume, 12);
  close(m.value.area, 2 * 12 + 16 + 8);
  closePt(m.value.centroid, vec3(0, 0, 0.5));
});

test('an inside-out hole (inner loops counter-clockwise) is rejected, not silently mis-measured', () => {
  const b = holedBlock(true);
  // Combinatorially still a consistently oriented closed manifold ...
  assert.deepEqual(validateBrep(b), { ok: true, value: undefined });
  // ... but the hole loops wind the wrong way about the face normal.
  const m = polyhedronMass(k, b);
  assert.equal(m.ok, false);
  if (!m.ok) assert.deepEqual([m.error.kind, m.error.kind === 'invalid-topology' && m.error.entity], ['invalid-topology', { kind: 'face', id: 0 }]);
});

test('huge boxes: finite results are exact-scaled, overflowing ones are errors (never NaN)', () => {
  const big = makeBox(k, vec3(0, 0, 0), 1e100, 1e100, 1e100);
  assert.ok(big.ok);
  const m = polyhedronMass(k, big.value);
  assert.ok(m.ok);
  close(m.value.volume, 1e300, 1e-12);
  close(m.value.area, 6e200, 1e-12);
  closePt(m.value.centroid, vec3(5e99, 5e99, 5e99), 1e-12);
  for (const d of [1e150, 1e200]) {
    const b = makeBox(k, vec3(0, 0, 0), d, d, d);
    assert.ok(b.ok, `makeBox ${d}`);
    const mm = polyhedronMass(k, b.value);
    assert.equal(mm.ok, false);
    if (!mm.ok) assert.equal(mm.error.kind, 'invalid-input');
  }
});

test('tiny and far-translated boxes keep their mass properties', () => {
  for (const [o, d] of [[vec3(0, 0, 0), 2e-5], [vec3(1e9, -1e9, 1e9), 3]] as const) {
    const m = polyhedronMass(k, box(o, d, d, d));
    assert.ok(m.ok);
    close(m.value.volume, d * d * d, 1e-9);
    closePt(m.value.centroid, vec3(o.x + d / 2, o.y + d / 2, o.z + d / 2), 1e-12);
  }
});

test('polyhedronMass rejects a non-finite vertex as a value', () => {
  const b = box(vec3(0, 0, 0), 1, 1, 1);
  const bad: Brep = { ...b, vertices: b.vertices.map((v, i) => (i === 3 ? { point: vec3(Number.NaN, 1, 0) } : v)) };
  const r = polyhedronMass(k, bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'invalid-input');
});
