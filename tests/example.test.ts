import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleFiles, meshToObj, runExample } from '../examples/box-and-cylinder-mesh.ts';
import { m3Specs, runM3Example } from '../examples/primitives-and-sweeps.ts';
import { gridPoints, runIntersectionsExample } from '../examples/intersections.ts';
import { booleanFiles, runBooleansExample, steinmetzVolume } from '../examples/booleans.ts';
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

test('example (M4): primitive intersections carry their class and deviation, and the plate grid classifies without error', () => {
  const k = createKernel();
  const r = unwrap(runIntersectionsExample(k));
  const byName = new Map(r.pairs.map((p) => [p.name, p]));
  assert.deepEqual([...byName.keys()], ['two-cylinders', 'sphere-plane', 'torus-plane', 'torus-oblique-plane']);
  const expect: Record<string, readonly [string, string, number]> = {
    'two-cylinders': ['certified', 'marching', 2],
    'sphere-plane': ['exact', 'closed-form', 1],
    'torus-plane': ['exact', 'closed-form', 2],
    'torus-oblique-plane': ['certified', 'marching', 2],
  };
  for (const [name, [cls, method, n]] of Object.entries(expect)) {
    const p = byName.get(name)!;
    assert.deepEqual([p.class, p.method, p.components.length], [cls, method, n], name);
    for (const c of p.components) {
      assert.equal(c.kind, 'curve', name);
      assert.equal(c.closed, true, name);
      assert.equal(c.contact, 'transversal', name);
      assert.equal(c.curve, cls === 'exact' ? 'circle' : 'nurbs', name);
    }
    assert.ok(p.maxDeviation <= k.tolerances.zoneTol3d, `${name}: ${p.maxDeviation}`);
  }
  // Every OBJ polyline indexes vertices of its own file.
  for (const [name, text] of r.obj) {
    const lines = text.split('\n');
    const v = lines.filter((l) => l.startsWith('v ')).length;
    for (const l of lines.filter((x) => x.startsWith('l '))) for (const i of l.slice(2).split(' ').map(Number)) assert.ok(i >= 1 && i <= v, name);
  }
  const c = r.classification;
  assert.equal(c.points, gridPoints().length);
  assert.equal(c.counts.refused, 0);
  assert.equal(c.disagreements, 0);
  assert.equal(c.counts.inside + c.counts.outside + c.counts.on, c.points);
});

test('example (M5): booleans give valid solids with the analytic volumes and genus, or a refusal by name', () => {
  // The Steinmetz integral of the example: 16/3 for equal unit radii.
  assert.ok(Math.abs(steinmetzVolume(1, 1) - 16 / 3) < 1e-10);
  const r = unwrap(runBooleansExample());
  assert.deepEqual(r.results.map((x) => [x.name, x.status]), [
    ['drilled-plate', 'solid'],
    ['steinmetz', 'solid'],
    ['steinmetz-equal-radii', 'refused'],
    ['box-union-sphere', 'solid'],
    ['box-minus-sphere', 'solid'],
    ['revolve-minus-extrusion', 'solid'],
  ]);
  for (const x of r.results) {
    if (x.status === 'refused') {
      // Equal radii: the singular branch point of the M4 surface/surface intersection (a documented deferral).
      assert.equal(x.refusal, 'tangent contact not resolved', x.name);
      continue;
    }
    assert.equal(x.validTopology, true, x.name);
    assert.equal(x.validGeometry, true, x.name);
    assert.equal(x.roundTripStable, true, x.name);
    assert.equal(x.watertight, true, x.name);
    assert.equal(x.genus, x.expectedGenus, x.name);
    assert.equal(x.counts?.shells, 1, x.name);
    // 2° facets and a 0.1 grid: the trimmed curved faces meet the analytic volume within 1e-3.
    assert.ok(Math.abs(x.volumeRelativeError!) < 1e-3, `${x.name}: ${x.volumeRelativeError}`);
    assert.ok(x.stats!.maxDeviation <= createKernel().tolerances.xsectTol3d, x.name);
  }
  const faces = Object.fromEntries(r.results.map((x) => [x.name, x.counts?.faces]));
  assert.deepEqual(faces, {
    'drilled-plate': 8,
    steinmetz: 3,
    'steinmetz-equal-radii': undefined,
    'box-union-sphere': 7,
    'box-minus-sphere': 7,
    'revolve-minus-extrusion': 5,
  });
  const files = booleanFiles(r);
  assert.equal(JSON.parse(files.get('summary.json')!).length, 6);
  assert.equal([...files.keys()].filter((n) => n.endsWith('.obj')).length, 5);
});
