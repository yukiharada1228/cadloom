import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedCylinder, exampleFiles, meshToObj, runExample } from '../examples/box-and-cylinder-mesh.ts';
import { createKernel, eulerPoincare, unwrap, validateBrep, validateBrepGeometry } from '../src/index.ts';

test('example: the cylinder fixture validates (structure and geometry) with genus 0', () => {
  const k = createKernel();
  const c = unwrap(closedCylinder(k, 2, 3));
  assert.equal(validateBrep(c).ok, true);
  assert.deepEqual(validateBrepGeometry(k, c), { ok: true, value: undefined });
  const ep = unwrap(eulerPoincare(c));
  assert.deepEqual([ep.vertices, ep.edges, ep.faces, ep.genus], [2, 3, 3, 0]);
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
