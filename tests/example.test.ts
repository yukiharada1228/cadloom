import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleFiles, meshToObj, runExample } from '../examples/box-and-cylinder-mesh.ts';
import { m3Specs, runM3Example } from '../examples/primitives-and-sweeps.ts';
import { createKernel, eulerPoincare, unwrap, validateBrep, validateBrepGeometry, type Brep } from '../src/index.ts';

test('example: every M3 body validates (structure and geometry) with the expected genus', () => {
  const k = createKernel();
  const specs = unwrap(m3Specs(k));
  const genus: Record<string, number> = { torus: 1, 'extrude-plate-with-holes': 2, 'revolve-ring-with-hole': 1 };
  for (const s of specs) {
    const b: Brep = unwrap(s.brep);
    assert.equal(validateBrep(b).ok, true, s.name);
    assert.deepEqual(validateBrepGeometry(k, b), { ok: true, value: undefined }, s.name);
    assert.equal(unwrap(eulerPoincare(b)).genus, genus[s.name] ?? 0, s.name);
  }
  const cyl = unwrap(eulerPoincare(unwrap(specs.find((s) => s.name === 'cylinder')!.brep)));
  assert.deepEqual([cyl.vertices, cyl.edges, cyl.faces, cyl.genus], [2, 3, 3, 0]);
});

test('example (M3): primitives, extrusion, revolve and helix sweep round-trip, mesh watertight, and meet the analytic volumes', () => {
  const bodies = unwrap(runM3Example());
  assert.deepEqual(bodies.map((b) => b.name), [
    'box', 'cylinder', 'cone-frustum', 'cone-apex', 'sphere', 'torus', 'extrude-plate-with-holes', 'revolve-ring-with-hole', 'sweep-helix',
  ]);
  for (const b of bodies) {
    assert.equal(b.roundTripStable, true, b.name);
    assert.equal(b.watertight, true, b.name);
    assert.equal(b.consistentlyOriented, true, b.name);
    assert.equal(b.mesh.stats.failedFaces.length, 0, b.name);
    // Chord 0.001 on radii >= 0.4: a relative volume error below 0.5 %.
    assert.ok(Math.abs(b.meshVolume - b.exactVolume) <= 5e-3 * b.exactVolume, `${b.name}: ${b.meshVolume} vs ${b.exactVolume}`);
  }
});

test('example: box and cylinder round-trip through the record text and mesh watertight with the right volume', () => {
  const bodies = unwrap(runExample());
  assert.deepEqual(bodies.map((b) => b.name), ['box', 'cylinder']);
  for (const b of bodies) {
    assert.equal(b.roundTripStable, true, b.name);
    assert.equal(b.watertight, true, b.name);
    assert.equal(b.consistentlyOriented, true, b.name);
    assert.equal(b.mesh.stats.failedFaces.length, 0, b.name);
    // Inscribed facets: the volume error is below area × chord (chord 0.01).
    assert.ok(Math.abs(b.meshVolume - b.exactVolume) <= 0.01 * 70, `${b.name}: ${b.meshVolume} vs ${b.exactVolume}`);
  }
  assert.equal(bodies[0]!.meshVolume, 24);
});

test('example: the written files are deterministic and the OBJ text indexes every vertex', () => {
  const a = exampleFiles(unwrap(runExample()));
  const b = exampleFiles(unwrap(runExample()));
  assert.deepEqual([...a.keys()], [...b.keys()]);
  for (const [name, text] of a) assert.equal(text, b.get(name), name);
  const bodies = unwrap(runExample());
  const obj = meshToObj(bodies[1]!.mesh, 'cylinder');
  const lines = obj.split('\n');
  const v = lines.filter((l) => l.startsWith('v ')).length;
  const f = lines.filter((l) => l.startsWith('f '));
  assert.equal(v, bodies[1]!.mesh.positions.length / 3);
  assert.equal(f.length, bodies[1]!.mesh.indices.length / 3);
  for (const l of f) for (const idx of l.slice(2).split(' ').map((s) => Number(s.split('//')[0]))) assert.ok(idx >= 1 && idx <= v);
  assert.ok(JSON.parse(a.get('summary.json')!).length === 2);
});
