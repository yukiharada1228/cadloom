import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { add3, scale3, vec3, type Point3, type Vec3 } from '../src/math/vec.ts';
import { makeBox, makeCylinder, makeSphere, placement } from '../src/primitive/index.ts';
import { faceId, type Brep } from '../src/topology/brep.ts';
import { faceNormalAt, validateBrepGeometry } from '../src/topology/geometry.ts';
import { eulerPoincare, validateBrep } from '../src/topology/validate.ts';
import { tessellate } from '../src/tess/mesh.ts';
import { isWatertight, meshSignedVolume } from '../src/tess/check.ts';
import { brepToRecord, recordToBrep } from '../src/convert/index.ts';
import { parseRecordText, stringifyRecord } from '../src/record/index.ts';
import { bodyBounds, classifyPoint, prepareBody } from '../src/query/index.ts';
import { createPlaneSurface } from '../src/surface/index.ts';
import { createProfile, point2, polygonWire } from '../src/profile/index.ts';
import { extrude } from '../src/prism/index.ts';
import {
  BOOLEAN_OPS,
  FRAGMENT_LABELS,
  LABEL_SIDES,
  OPERAND_SIDES,
  SELECTION,
  fragmentSamples,
  intersect,
  opEval,
  selectAction,
  sideModelAction,
  subtract,
  union,
  type BooleanOp,
  type BooleanResult,
  type BooleanSolid,
  type FragmentLabel,
  type OperandSide,
} from '../src/boolean/index.ts';

const k = createKernel();
const P = vec3;
const box = (o: Point3, dx: number, dy: number, dz: number): Brep => unwrap(makeBox(k, o, dx, dy, dz));
const cyl = (o: Point3, axis: Vec3, xDir: Vec3, r: number, h: number): Brep => unwrap(makeCylinder(k, placement(o, axis, xDir), r, h));
const zCyl = (o: Point3, r: number, h: number): Brep => cyl(o, P(0, 0, 1), P(1, 0, 0), r, h);
const close = (a: number, b: number, tol: number, msg?: string): void => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} vs ${b} (tol ${tol})`);

// ---------------------------------------------------------------------------------------------------------
// The site model of Boolean.lean, in TS (same definitions), for the Lean-named tests.

interface Site {
  readonly aF: boolean;
  readonly aB: boolean;
  readonly bF: boolean;
  readonly bB: boolean;
}

/** Lean `labelAt`. */
function labelAt(o: boolean, oF: boolean, oB: boolean): FragmentLabel {
  const f = o ? oF : oB, b = o ? oB : oF;
  return f ? (b ? 'in' : 'on-opposite') : b ? 'on-same' : 'out';
}

/** Lean `fromSide`, through the TS `SELECTION`. */
function fromSide(op: BooleanOp, side: OperandSide, ownF: boolean, ownB: boolean, otherF: boolean, otherB: boolean): boolean[] {
  if (ownF === ownB) return [];
  const o = ownB;
  const a = SELECTION[op][side][labelAt(o, otherF, otherB)];
  return a === 'keep' ? [o] : a === 'reverse' ? [!o] : [];
}

const emit = (op: BooleanOp, s: Site): boolean[] => [...fromSide(op, 'A', s.aF, s.aB, s.bF, s.bB), ...fromSide(op, 'B', s.bF, s.bB, s.aF, s.aB)];

function expected(op: BooleanOp, s: Site): boolean[] {
  const f = opEval(op, s.aF, s.bF), b = opEval(op, s.aB, s.bB);
  return f === b ? [] : [b];
}

const BOOLS = [false, true] as const;
const sites: Site[] = BOOLS.flatMap((aF) => BOOLS.flatMap((aB) => BOOLS.flatMap((bF) => BOOLS.map((bB) => ({ aF, aB, bF, bB })))));

// ---------------------------------------------------------------------------------------------------------
// Checks every returned solid must pass (the boolean's contract).

interface Expect {
  readonly volume?: number;
  /** Relative tolerance of the mesh volume (planar results are exact up to rounding). */
  readonly volumeTol?: number;
  readonly genus?: number;
  readonly lumps?: number;
  readonly shells?: number;
  readonly counts?: readonly [v: number, e: number, f: number, l: number];
  /** A finer display mesh for curved results (volume checks): 2° facets, 0.1 grid step. */
  readonly fine?: boolean;
}

/** Display-mesh volume (watertight); `fine` meshes curved trimmed faces densely enough for 1e-3 checks. */
function meshVolume(brep: Brep, fine = false): number {
  const m = unwrap(tessellate(k, brep, fine ? { angleDeg: 2, maxEdgeLength: 0.1 } : {}));
  assert.ok(isWatertight(m), 'watertight display mesh');
  assert.equal(m.stats.failedFaces.length, 0);
  return meshSignedVolume(m);
}

function solid(name: string, r: Result<BooleanResult>, e: Expect = {}): BooleanSolid {
  const v = unwrap(r);
  assert.equal(v.kind, 'solid', `${name}: a solid`);
  if (v.kind !== 'solid') throw new Error('unreachable');
  const b = v.brep;
  unwrap(validateBrep(b));
  unwrap(validateBrepGeometry(k, b));
  // Record round trip (text and back).
  const rec = unwrap(brepToRecord(b));
  const back = unwrap(recordToBrep(k, unwrap(parseRecordText(stringifyRecord(rec)))));
  assert.deepStrictEqual(back, b, `${name}: record round trip`);
  // Watertight mesh with positive volume.
  const vol = meshVolume(b, e.fine);
  assert.ok(vol > 0, `${name}: positive volume ${vol}`);
  if (e.volume !== undefined) close(vol, e.volume, (e.volumeTol ?? 1e-9) * Math.max(1, e.volume), `${name}: volume ${vol} vs ${e.volume}`);
  // Euler–Poincaré with the expected genus.
  const ep = unwrap(eulerPoincare(b));
  if (e.genus !== undefined) assert.equal(ep.genus, e.genus, `${name}: genus`);
  if (e.lumps !== undefined) assert.equal(b.bodies.length, e.lumps, `${name}: lumps`);
  if (e.shells !== undefined) assert.equal(b.shells.length, e.shells, `${name}: shells`);
  if (e.counts !== undefined) assert.deepStrictEqual([b.vertices.length, b.edges.length, b.faces.length, b.loops.length], e.counts, `${name}: counts`);
  // Provenance: every result face comes from at least one input face with a coinciding surface.
  assert.equal(v.provenance.length, b.faces.length);
  for (const origins of v.provenance) assert.ok(origins.length > 0, `${name}: a face without provenance`);
  // Statistics are consistent.
  assert.equal(v.stats.fragmentsA, v.fragmentsA.length);
  assert.equal(v.stats.fragmentsB, v.fragmentsB.length);
  assert.equal(v.stats.keptFragments, [...v.fragmentsA, ...v.fragmentsB].filter((f) => f.action !== 'drop').length);
  assert.ok(v.stats.exactEdges + v.stats.certifiedEdges <= v.stats.intersectionEdges);
  assert.ok(Number.isFinite(v.stats.maxDeviation) && v.stats.maxDeviation <= k.tolerances.xsectTol3d);
  for (const f of [...v.fragmentsA, ...v.fragmentsB]) assert.equal(f.action, selectAction(v.op, v.fragmentsA.includes(f) ? 'A' : 'B', f.label));
  return v;
}

/** Every face's outward normal points out of the result: just in front outside, just behind inside. */
function assertOutward(name: string, b: Brep): void {
  const pb = unwrap(prepareBody(k, b));
  const bounds = unwrap(bodyBounds(k, pb));
  const d = 1e-3 * Math.max(1, bounds.box.max.x - bounds.box.min.x);
  for (let f = 0; f < b.faces.length; f++) {
    const s = unwrap(fragmentSamples(pb, faceId(f)))[0];
    assert.ok(s !== undefined, `${name}: face ${f} has an interior sample`);
    const n = unwrap(faceNormalAt(k, b, faceId(f), s.uv.x, s.uv.y));
    assert.equal(unwrap(classifyPoint(k, pb, add3(s.point, scale3(n, d)))).class, 'outside', `${name}: face ${f} front`);
    assert.equal(unwrap(classifyPoint(k, pb, add3(s.point, scale3(n, -d)))).class, 'inside', `${name}: face ${f} back`);
  }
}

function refusedWith(r: Result<BooleanResult>, pattern: RegExp): void {
  assert.equal(r.ok, false, 'refused');
  if (r.ok) return;
  const text = r.error.kind === 'invalid-topology' || r.error.kind === 'invalid-input' ? r.error.reason : r.error.operation;
  assert.match(text, pattern);
}

// Fixtures.
const A2 = box(P(0, 0, 0), 2, 2, 2);
const B2 = box(P(1, 1, 1), 2, 2, 2);
const unit = box(P(0, 0, 0), 1, 1, 1);

const memo = new Map<string, Result<BooleanResult>>();
const run = (name: string, f: () => Result<BooleanResult>): Result<BooleanResult> => {
  let r = memo.get(name);
  if (r === undefined) {
    r = f();
    memo.set(name, r);
  }
  return r;
};
const cornerUnion = () => run('cu', () => union(k, A2, B2));
const cornerInter = () => run('ci', () => intersect(k, A2, B2));
const cornerSub = () => run('cs', () => subtract(k, A2, B2));

// ---------------------------------------------------------------------------------------------------------
// (a) The selection table and its model.

test('table_eq_model: SELECTION equals the side model for every op, side and label', () => {
  for (const op of BOOLEAN_OPS) {
    for (const side of OPERAND_SIDES) {
      for (const l of FRAGMENT_LABELS) assert.equal(SELECTION[op][side][l], sideModelAction(op, side, l), `${op} ${side} ${l}`);
    }
  }
  // The rules as stated: union = A.out + B.out + on-same once; intersect = A.in + B.in + on-same once;
  // subtract = A.out + reversed(B.in) + on-opposite once (from A).
  const kept = (op: BooleanOp, side: OperandSide): string[] => FRAGMENT_LABELS.filter((l) => SELECTION[op][side][l] !== 'drop').map((l) => `${l}:${SELECTION[op][side][l]}`);
  assert.deepStrictEqual(kept('union', 'A'), ['out:keep', 'on-same:keep']);
  assert.deepStrictEqual(kept('union', 'B'), ['out:keep']);
  assert.deepStrictEqual(kept('intersect', 'A'), ['in:keep', 'on-same:keep']);
  assert.deepStrictEqual(kept('intersect', 'B'), ['in:keep']);
  assert.deepStrictEqual(kept('subtract', 'A'), ['out:keep', 'on-opposite:keep']);
  assert.deepStrictEqual(kept('subtract', 'B'), ['in:reverse']);
  assert.deepStrictEqual(LABEL_SIDES['on-same'], [false, true]);
  assert.ok(Object.isFrozen(SELECTION) && Object.isFrozen(SELECTION.union) && Object.isFrozen(SELECTION.union.A));
});

test('emit_eq_expected / emit_length_le_one / kept_iff_boundary_A / kept_iff_boundary_B: the table emits the regularized boundary once', () => {
  for (const op of BOOLEAN_OPS) {
    for (const s of sites) {
      assert.deepStrictEqual(emit(op, s), expected(op, s), `${op} ${JSON.stringify(s)}`);
      assert.ok(emit(op, s).length <= 1);
    }
    for (const aB of BOOLS) {
      for (const bF of BOOLS) {
        assert.equal(fromSide(op, 'A', !aB, aB, bF, bF).length > 0, opEval(op, !aB, bF) !== opEval(op, aB, bF));
        assert.equal(fromSide(op, 'B', !aB, aB, bF, bF).length > 0, opEval(op, bF, !aB) !== opEval(op, bF, aB));
      }
    }
  }
});

test('union_comm / intersect_comm / union_assoc / intersect_assoc / de_morgan_* / subtract_eq_intersect_compl / *_idem / subtract_self', () => {
  const flip = (xs: boolean[]): boolean[] => xs.map((o) => !o);
  for (const s of sites) {
    const sw = { aF: s.bF, aB: s.bB, bF: s.aF, bB: s.aB };
    assert.deepStrictEqual(emit('union', s), emit('union', sw));
    assert.deepStrictEqual(emit('intersect', s), emit('intersect', sw));
    const comp = { aF: !s.aF, aB: !s.aB, bF: !s.bF, bB: !s.bB };
    assert.deepStrictEqual(emit('union', comp), flip(emit('intersect', s)));
    assert.deepStrictEqual(emit('intersect', comp), flip(emit('union', s)));
    assert.deepStrictEqual(emit('subtract', s), emit('intersect', { ...s, bF: !s.bF, bB: !s.bB }));
    for (const cF of BOOLS) {
      for (const cB of BOOLS) {
        for (const op of ['union', 'intersect'] as const) {
          const left = emit(op, { aF: opEval(op, s.aF, s.bF), aB: opEval(op, s.aB, s.bB), bF: cF, bB: cB });
          const right = emit(op, { aF: s.aF, aB: s.aB, bF: opEval(op, s.bF, cF), bB: opEval(op, s.bB, cB) });
          assert.deepStrictEqual(left, right);
        }
      }
    }
    const self = { aF: s.aF, aB: s.aB, bF: s.aF, bB: s.aB };
    const own = s.aF === s.aB ? [] : [s.aB];
    assert.deepStrictEqual(emit('union', self), own);
    assert.deepStrictEqual(emit('intersect', self), own);
    assert.deepStrictEqual(emit('subtract', self), []);
  }
});

test('subtract_B_in_reversed / subtract_A_out_kept / sign_flip: subtract turns B inside A over', () => {
  for (const o of BOOLS) {
    assert.deepStrictEqual(emit('subtract', { aF: true, aB: true, bF: !o, bB: o }), [!o]);
    assert.deepStrictEqual(expected('subtract', { aF: true, aB: true, bF: !o, bB: o }), [!o]);
    assert.deepStrictEqual(emit('subtract', { aF: !o, aB: o, bF: false, bB: false }), [o]);
  }
  // On a real result: the faces that came from B (the hole's walls) point out of A - B, into the hole.
  const r = solid('through hole', run('th', () => subtract(k, box(P(0, 0, 0), 3, 3, 1), box(P(1, 1, -1), 1, 1, 3))));
  const fromB = r.provenance.flatMap((o, f) => (o.some((x) => x.side === 'B') ? [f] : []));
  assert.equal(fromB.length, 4);
  for (const f of fromB) {
    const pb = unwrap(prepareBody(k, r.brep));
    const s = unwrap(fragmentSamples(pb, faceId(f)))[0]!;
    const n = unwrap(faceNormalAt(k, r.brep, faceId(f), s.uv.x, s.uv.y));
    // The hole's axis is x = y = 1.5: the outward normal points towards it.
    assert.ok(n.x * (1.5 - s.point.x) + n.y * (1.5 - s.point.y) > 0, `face ${f} points into the hole`);
  }
  assertOutward('through hole', r.brep);
});

// ---------------------------------------------------------------------------------------------------------
// Box / box.

test('corner_union_counts: box ∪ box overlapping by a corner — 20 V, 30 E, 12 F, 12 L, volume 15', () => {
  const r = solid('corner union', cornerUnion(), { volume: 15, genus: 0, lumps: 1, counts: [20, 30, 12, 12] });
  const ep = unwrap(eulerPoincare(r.brep));
  assert.equal(ep.vertices - ep.edges + ep.faces - (ep.loops - ep.faces), 2);
  // Labels: A's three faces at the corner split in two (one part in B): 3 in, 6 out; same for B.
  const count = (xs: readonly { label: FragmentLabel }[], l: FragmentLabel): number => xs.filter((x) => x.label === l).length;
  assert.equal(r.fragmentsA.length, 9);
  assert.equal(count(r.fragmentsA, 'in'), 3);
  assert.equal(count(r.fragmentsA, 'out'), 6);
  assert.equal(count(r.fragmentsB, 'in'), 3);
  // Flood fill: the three untouched faces and three outer parts form one region, labelled from samples.
  assert.ok(r.fragmentsA.some((f) => f.basis === 'propagated'));
  // Every intersection edge is exact (planes), six of them.
  assert.equal(r.stats.intersectionEdges, 6);
  assert.equal(r.stats.exactEdges, 6);
  assert.equal(r.stats.maxDeviation, 0);
  // Provenance: six faces from A, six from B, one source each.
  assert.equal(r.provenance.filter((o) => o.length === 1 && o[0]!.side === 'A').length, 6);
  assert.equal(r.provenance.filter((o) => o.length === 1 && o[0]!.side === 'B').length, 6);
  assertOutward('corner union', r.brep);
});

test('corner_intersect_counts / corner_subtract_counts: box ∩ box and box − box by a corner, inclusion–exclusion', () => {
  const i = solid('corner intersect', cornerInter(), { volume: 1, genus: 0, counts: [8, 12, 6, 6] });
  const s = solid('corner subtract', cornerSub(), { volume: 7, genus: 0, counts: [14, 21, 9, 9] });
  // |A ∪ B| = |A| + |B| - |A ∩ B|, |A - B| = |A| - |A ∩ B|.
  const u = unwrap(cornerUnion()) as BooleanSolid;
  close(meshVolume(u.brep), 8 + 8 - meshVolume(i.brep), 1e-9);
  close(meshVolume(s.brep), 8 - meshVolume(i.brep), 1e-9);
  assertOutward('corner subtract', s.brep);
  // Commutativity on real bodies: B ∪ A gives the same counts and volume, B ∩ A too.
  const u2 = solid('corner union swapped', union(k, B2, A2), { volume: 15, counts: [20, 30, 12, 12] });
  assert.equal(u2.brep.faces.length, 12);
  solid('corner intersect swapped', intersect(k, B2, A2), { volume: 1, counts: [8, 12, 6, 6] });
});

test('box ∪ box sharing a whole face merges into one box with 6 faces; provenance lists both inputs', () => {
  const r = solid('shared face', union(k, unit, box(P(1, 0, 0), 1, 1, 1)), { volume: 2, genus: 0, counts: [8, 12, 6, 6] });
  // The four side faces were merged from one face of each box.
  assert.equal(r.provenance.filter((o) => o.length === 2 && o[0]!.side === 'A' && o[1]!.side === 'B').length, 4);
  // The shared faces are coincident with opposite orientation and are dropped by the union.
  assert.equal(r.fragmentsA.filter((f) => f.label === 'on-opposite' && f.action === 'drop').length, 1);
  assert.equal(r.fragmentsB.filter((f) => f.label === 'on-opposite' && f.action === 'drop').length, 1);
  // Part of a face shared (a step): 12 faces, volume 8.
  solid('partly shared face', union(k, box(P(0, 0, 0), 2, 2, 1), box(P(1, 1, 1), 2, 2, 1)), { volume: 8, genus: 0 });
  // An L of two boxes sharing a face strip: coplanar faces merge, 8 faces.
  solid('L shape', union(k, box(P(0, 0, 0), 2, 1, 1), box(P(0, 1, 0), 1, 1, 1)), { volume: 3, genus: 0, counts: [12, 18, 8, 8] });
});

test('box ∪ / − / ∩ a box inside it: the outer box, a void shell, the inner box', () => {
  const outer = box(P(0, 0, 0), 3, 3, 3), inner = box(P(1, 1, 1), 1, 1, 1);
  solid('union contains', union(k, outer, inner), { volume: 27, counts: [8, 12, 6, 6] });
  const v = solid('subtract void', subtract(k, outer, inner), { volume: 26, lumps: 1, shells: 2 });
  assert.ok(v.fragmentsB.every((f) => f.label === 'in' && f.action === 'reverse'));
  assertOutward('void', v.brep);
  solid('intersect contained', intersect(k, outer, inner), { volume: 1, counts: [8, 12, 6, 6] });
  // The inner box minus the outer one is empty.
  const e = unwrap(subtract(k, inner, outer));
  assert.equal(e.kind, 'empty');
});

test('through_hole_genus: box − box through it is genus 1; a blind pocket is genus 0', () => {
  solid('through hole', run('th', () => subtract(k, box(P(0, 0, 0), 3, 3, 1), box(P(1, 1, -1), 1, 1, 3))), {
    volume: 8,
    genus: 1,
    counts: [16, 24, 10, 12],
  });
  const p = solid('pocket', subtract(k, box(P(0, 0, 0), 3, 3, 2), box(P(1, 1, 1), 1, 1, 2)), { volume: 17, genus: 0, counts: [16, 24, 11, 12] });
  // The pocket's top face: B's top coincides with nothing; A's top keeps a square hole (the B part inside is dropped).
  assert.ok(p.fragmentsB.some((f) => f.label === 'in' && f.action === 'reverse'));
  assertOutward('pocket', p.brep);
});

// ---------------------------------------------------------------------------------------------------------
// Curved operands.

test('drilled_hole_genus: box − cylinder — the cylindrical face trimmed to the box, genus 1', () => {
  const r = solid('drill', subtract(k, box(P(-2, -2, 0), 4, 4, 2), zCyl(P(0, 0, -1), 1, 4)), {
    volume: 32 - 2 * Math.PI,
    volumeTol: 5e-4,
    fine: true,
    genus: 1,
    counts: [10, 15, 7, 9],
  });
  const side = r.brep.faces.findIndex((f) => f.surface.kind === 'cylinder');
  assert.ok(side >= 0);
  // Trimmed: the cylinder face lies within z in [0, 2] (the box), and points into the hole (reversed).
  const pb = unwrap(prepareBody(k, r.brep));
  const dom = pb.faces[side]!;
  assert.ok(dom.box.min.z >= -1e-9 && dom.box.max.z <= 2 + 1e-9, 'cylinder face trimmed to the box');
  assert.equal(r.brep.faces[side]!.reversed, true);
  assert.deepStrictEqual(r.provenance[side], [{ side: 'B', face: 2 }]);
  assertOutward('drill', r.brep);
});

test('box ∪ cylinder and box ∩ cylinder: inclusion–exclusion of the volumes', () => {
  const b = box(P(-2, -2, 0), 4, 4, 2), c = zCyl(P(0, 0, 1), 1, 3);
  const u = solid('box ∪ cylinder', union(k, b, c), { volume: 32 + 2 * Math.PI, volumeTol: 5e-4, fine: true, genus: 0 });
  const i = solid('box ∩ cylinder', intersect(k, b, c), { volume: Math.PI, volumeTol: 5e-4, fine: true, genus: 0 });
  close(meshVolume(u.brep, true), 32 + 3 * Math.PI - meshVolume(i.brep, true), 2e-2);
});

test('sphere − box: a hemisphere (a cut sphere keeps its pole)', () => {
  const r = solid('sphere - box', subtract(k, unwrap(makeSphere(k, P(0, 0, 0), 1)), box(P(0, -2, -2), 2, 4, 4)), {
    volume: (2 * Math.PI) / 3,
    volumeTol: 1e-3,
    fine: true,
    genus: 0,
  });
  assert.equal(r.brep.faces.length, 2);
  assertOutward('hemisphere', r.brep);
  // A box minus a sphere inside it: a curved void.
  const v = solid('box - ball', subtract(k, box(P(-2, -2, -2), 4, 4, 4), unwrap(makeSphere(k, P(0, 0, 0), 1))), {
    volume: 64 - (4 * Math.PI) / 3,
    volumeTol: 5e-4,
    fine: true,
    shells: 2,
  });
  assert.equal(v.brep.bodies.length, 1);
});

test('cylinder ∩ cylinder at right angles: Steinmetz volume (unequal radii certified; equal radii refused by name)', () => {
  const a = 0.8, b = 1;
  const r = solid('steinmetz', intersect(k, zCyl(P(0, 0, -2), a, 4), cyl(P(-2, 0, 0), P(1, 0, 0), P(0, 1, 0), b, 4)), { genus: 0 });
  // V = ∫ 4 √(a² − y²) √(b² − y²) dy over [−a, a] (midpoint rule); for a = b it is the Steinmetz 16 r³ / 3.
  const steinmetz = (ra: number, rb: number): number => {
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const y = -ra + ((i + 0.5) * 2 * ra) / n;
      sum += 4 * Math.sqrt(ra * ra - y * y) * Math.sqrt(rb * rb - y * y);
    }
    return (sum * 2 * ra) / n;
  };
  close(steinmetz(1, 1), 16 / 3, 1e-6);
  const exact = steinmetz(a, b);
  close(meshVolume(r.brep, true), exact, 1e-3 * exact, `steinmetz volume vs ${exact}`);
  assert.ok(r.stats.certifiedEdges > 0, 'marched intersection curves are certified');
  assert.ok(r.stats.maxDeviation > 0 && r.stats.maxDeviation <= k.tolerances.xsectTol3d);
  // Equal radii: the two ellipses cross at singular points (M4 refuses the branch point by name).
  const eq = intersect(k, zCyl(P(0, 0, -2), 1, 4), cyl(P(-2, 0, 0), P(1, 0, 0), P(0, 1, 0), 1, 4));
  refusedWith(eq, /tangent contact not resolved/);
});

// ---------------------------------------------------------------------------------------------------------
// Special cases: disjoint, identical, empty, tangent, non-manifold.

test('disjoint_union_counts: disjoint union is two lumps; disjoint intersection is empty', () => {
  const far = box(P(3, 0, 0), 1, 1, 1);
  const r = solid('disjoint union', union(k, unit, far), { volume: 2, lumps: 2, shells: 2, counts: [16, 24, 12, 12] });
  assert.equal(unwrap(eulerPoincare(r.brep)).genus, 0);
  assert.equal(r.stats.intersectionEdges, 0);
  const i = unwrap(intersect(k, unit, far));
  assert.equal(i.kind, 'empty');
  assert.equal(i.stats.keptFragments, 0);
  // Boxes touching along a face: their intersection has no volume (on-opposite dropped), so it is empty.
  const touch = unwrap(intersect(k, unit, box(P(1, 0, 0), 1, 1, 1)));
  assert.equal(touch.kind, 'empty');
  assert.ok(touch.fragmentsA.some((f) => f.label === 'on-opposite'));
  // A - (far box) = A.
  solid('subtract disjoint', subtract(k, unit, far), { volume: 1, counts: [8, 12, 6, 6] });
});

test('A − A is empty, A ∪ A = A, A ∩ A = A (coincident faces kept once)', () => {
  const e = unwrap(subtract(k, unit, unit));
  assert.equal(e.kind, 'empty');
  assert.ok(e.fragmentsA.every((f) => f.label === 'on-same' && f.action === 'drop'));
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.stats));
  const u = solid('A ∪ A', union(k, unit, unit), { volume: 1, counts: [8, 12, 6, 6] });
  assert.ok(u.provenance.every((o) => o.length === 1 && o[0]!.side === 'A'));
  solid('A ∩ A', intersect(k, unit, unit), { volume: 1, counts: [8, 12, 6, 6] });
  // A cylinder with itself.
  const c = zCyl(P(0, 0, 0), 1, 2);
  const cc = solid('cyl ∪ cyl', union(k, c, c), { volume: 2 * Math.PI, volumeTol: 5e-4, fine: true });
  assert.deepStrictEqual([cc.brep.vertices.length, cc.brep.edges.length, cc.brep.faces.length], [c.vertices.length, c.edges.length, c.faces.length]);
  assert.equal(unwrap(subtract(k, c, c)).kind, 'empty');
});

test('tangent contact (a sphere touching a box face) is a named refusal; edge contact is non-manifold', () => {
  const ball = unwrap(makeSphere(k, P(1, 1, 3), 1));
  for (const op of [union, subtract, intersect]) refusedWith(op(k, A2, ball), /tangent contact not resolved/);
  // Two boxes sharing only an edge: the union would be non-manifold.
  refusedWith(union(k, unit, box(P(1, 1, 0), 1, 1, 1)), /non-manifold/);
});

test('cylinder − box tunnel: genus 1 with curved and planar faces; results are deterministic and frozen', () => {
  const c = zCyl(P(0, 0, 0), 1, 2), slot = box(P(-2, -0.5, 0.5), 4, 1, 1);
  const r1 = solid('tunnel', subtract(k, c, slot), {
    volume: 2 * Math.PI - (2 * Math.asin(0.5) + Math.sqrt(0.75)),
    volumeTol: 5e-4,
    fine: true,
    genus: 1,
  });
  const r2 = unwrap(subtract(k, c, slot)) as BooleanSolid;
  assert.equal(stringifyRecord(unwrap(brepToRecord(r1.brep))), stringifyRecord(unwrap(brepToRecord(r2.brep))));
  assert.deepStrictEqual(r1.provenance, r2.provenance);
  assert.ok(Object.isFrozen(r1) && Object.isFrozen(r1.provenance) && Object.isFrozen(r1.fragmentsA) && Object.isFrozen(r1.stats));
  assertOutward('tunnel', r1.brep);
});

// ---------------------------------------------------------------------------------------------------------
// Adversarial regressions (review): near-coincident offsets, coplanar covers, edge / vertex contacts, scales,
// coaxial curved faces with rotated seams, a comb (many fragments per region), commutativity on real bodies.

/** A vertical prism over a polygon in the xy plane (rotated placements without a body transform). */
const prismZ = (pts: readonly (readonly [number, number])[], z0: number, h: number): Brep => {
  const pl = unwrap(createPlaneSurface(k, P(0, 0, z0), P(0, 0, 1), P(1, 0, 0)));
  return unwrap(extrude(k, unwrap(createProfile(k, pl, [unwrap(polygonWire(pts.map(([x, y]) => point2(x, y))))])), h));
};

test('review: faces offset by 0.5 and 2 zone tolerances — snapped coincident or kept as thin slabs, never invalid', () => {
  const z = k.tolerances.zoneTol3d;
  // 0.5 zone gap: the faces are coincident within tolerance (on-opposite), union is one solid; intersect empty.
  solid('gap 0.5 zone union', union(k, unit, box(P(0.5, 0.5, 1 + 0.5 * z), 1, 1, 1)), { volume: 2, volumeTol: 1e-5, lumps: 1 });
  assert.equal(unwrap(intersect(k, unit, box(P(0.5, 0.5, 1 + 0.5 * z), 1, 1, 1))).kind, 'empty');
  // 2 zone gap: two lumps.
  solid('gap 2 zone union', union(k, unit, box(P(0.5, 0.5, 1 + 2 * z), 1, 1, 1)), { volume: 2, lumps: 2 });
  // Nearly coplanar bottom / top faces 2 zone apart: thin slabs survive with the exact volumes.
  const d = 2 * z, E = box(P(0.5, -0.5, d), 1, 1, 1 - 2 * d), h = 1 - 2 * d;
  solid('near-coplanar union', union(k, unit, E), { volume: 1 + h - 0.25 * h, volumeTol: 1e-9 });
  solid('near-coplanar subtract', subtract(k, unit, E), { volume: 1 - 0.25 * h, volumeTol: 1e-9 });
  solid('near-coplanar intersect', intersect(k, unit, E), { volume: 0.25 * h, volumeTol: 1e-9, counts: [8, 12, 6, 6] });
  // A 2-zone overlap of stacked boxes is a sliver thinner than the imprint can split: a named refusal.
  const sliver = union(k, unit, box(P(0.5, 0.5, 1 - d), 1, 1, 1));
  if (!sliver.ok) refusedWith(sliver, /non-manifold|tangent|not resolved/);
  else solid('sliver union', sliver, { volume: 2 - 0.25 * d, volumeTol: 1e-6 });
});

test('review: coplanar covers, flush pockets and plates (on-same / on-opposite), both operand orders', () => {
  const cover = box(P(-1, -1, 0.5), 3, 3, 0.5);
  solid('cover union', union(k, unit, cover), { volume: 5, genus: 0 });
  solid('cover union swapped', union(k, cover, unit), { volume: 5, genus: 0 });
  solid('cover subtract', subtract(k, unit, cover), { volume: 0.5, counts: [8, 12, 6, 6] });
  solid('cover subtract swapped', subtract(k, cover, unit), { volume: 4, genus: 1 }); // a square hole through the plate
  solid('cover intersect', intersect(k, unit, cover), { volume: 0.5, counts: [8, 12, 6, 6] });
  const plate = box(P(-1, -1, 1), 3, 3, 0.5);
  solid('plate union', union(k, unit, plate), { volume: 5.5, genus: 0, counts: [16, 24, 11, 12] });
  assert.equal(unwrap(intersect(k, unit, plate)).kind, 'empty');
  const big = box(P(0, 0, 0), 2, 2, 2), flush = box(P(0.5, 0.5, 1), 1, 1, 1);
  const pocket = solid('flush pocket', subtract(k, big, flush), { volume: 7, genus: 0, counts: [16, 24, 11, 12] });
  assertOutward('flush pocket', pocket.brep);
  solid('flush union', union(k, big, flush), { volume: 8, counts: [8, 12, 6, 6] });
  assert.equal(unwrap(subtract(k, flush, big)).kind, 'empty');
});

test('review: edge-on-edge and vertex-on-face contacts — subtract / intersect exact, union refused as non-manifold', () => {
  for (const other of [box(P(1, 0.5, 1), 1, 1, 1), box(P(1, 1, 1), 1, 1, 1)]) {
    solid('contact subtract', subtract(k, unit, other), { volume: 1, counts: [8, 12, 6, 6] });
    assert.equal(unwrap(intersect(k, unit, other)).kind, 'empty');
    refusedWith(union(k, unit, other), /non-manifold/);
  }
  // A diamond prism inscribed in the box footprint (its vertical edges lie on the box faces).
  const diamond = prismZ([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], -1, 3);
  solid('inscribed union', union(k, unit, diamond), { volume: 2, genus: 0, counts: [24, 44, 22, 22] });
  solid('inscribed intersect', intersect(k, unit, diamond), { volume: 0.5, counts: [8, 12, 6, 6] });
  // The box minus it is four prisms meeting along edges: non-manifold.
  refusedWith(subtract(k, unit, diamond), /non-manifold/);
});

test('review: a rotated (45°) square through a box, a comb cut (genus 3), tiny and huge scales', () => {
  const c = 0.6 * Math.SQRT1_2;
  const diamond = prismZ([[0.5, 0.5 - c], [0.5 + c, 0.5], [0.5, 0.5 + c], [0.5 - c, 0.5]], -1, 3);
  const area = 2 * c * c;
  solid('diamond union', union(k, unit, diamond), { volume: 1 + 2 * area, volumeTol: 1e-9, genus: 0 });
  solid('diamond subtract', subtract(k, unit, diamond), { volume: 1 - area, volumeTol: 1e-9, genus: 1 });
  solid('diamond intersect', intersect(k, unit, diamond), { volume: area, volumeTol: 1e-9, counts: [8, 12, 6, 6] });
  // Three teeth enter through y = 0 and a back leaves through y = 1: one cavity with four openings, genus 3.
  const comb = prismZ([[0.1, -1], [0.2, -1], [0.2, 0.5], [0.3, 0.5], [0.3, -1], [0.4, -1], [0.4, 0.5], [0.5, 0.5], [0.5, -1], [0.6, -1], [0.6, 2], [0.1, 2]], 0.25, 0.5);
  solid('comb subtract', subtract(k, unit, comb), { volume: 0.8, volumeTol: 1e-9, genus: 3 });
  solid('comb intersect', intersect(k, unit, comb), { volume: 0.2, volumeTol: 1e-9, genus: 0 });
  for (const s of [1e-3, 1e3]) {
    const a = box(P(0, 0, 0), 2 * s, 2 * s, 2 * s), b = box(P(s, s, s), 2 * s, 2 * s, 2 * s);
    const v = s ** 3;
    const vols = [
      meshVolume(solid(`scale ${s} union`, union(k, a, b), { counts: [20, 30, 12, 12] }).brep),
      meshVolume(solid(`scale ${s} subtract`, subtract(k, a, b), { counts: [14, 21, 9, 9] }).brep),
      meshVolume(solid(`scale ${s} intersect`, intersect(k, a, b), { counts: [8, 12, 6, 6] }).brep),
    ];
    for (const [i, want] of [15, 7, 1].entries()) close(vols[i]!, want * v, 1e-9 * want * v, `scale ${s}: ${vols[i]} vs ${want * v}`);
  }
});

test('review: coaxial cylinders (coincident curved faces, seams rotated by 90°), commutative and deterministic', () => {
  const c1 = zCyl(P(0, 0, 0), 1, 2), c2 = cyl(P(0, 0, 1), P(0, 0, 1), P(0, 1, 0), 1, 2);
  const tol = { volumeTol: 1e-3, fine: true, genus: 0 } as const;
  const u = solid('coaxial union', union(k, c1, c2), { volume: 3 * Math.PI, ...tol });
  const u2 = solid('coaxial union swapped', union(k, c2, c1), { volume: 3 * Math.PI, ...tol });
  close(meshVolume(u.brep, true), meshVolume(u2.brep, true), 1e-9);
  solid('coaxial intersect', intersect(k, c1, c2), { volume: Math.PI, ...tol });
  solid('coaxial subtract', subtract(k, c1, c2), { volume: Math.PI, ...tol });
  const again = unwrap(union(k, c1, c2)) as BooleanSolid;
  assert.equal(stringifyRecord(unwrap(brepToRecord(again.brep))), stringifyRecord(unwrap(brepToRecord(u.brep))));
  // A cylinder whose axis lies on a box edge: a quarter of it is inside.
  const q = Math.PI * 0.09;
  const ec = zCyl(P(1, 1, -1), 0.3, 3);
  solid('edge cylinder subtract', subtract(k, unit, ec), { volume: 1 - q / 4, ...tol });
  solid('edge cylinder intersect', intersect(k, unit, ec), { volume: q / 4, ...tol });
});
