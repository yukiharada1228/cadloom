import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel, type Kernel } from '../src/core/kernel.ts';
import { unwrap } from '../src/core/error.ts';
import { add3, distance3, scale3, sub3, vec3, type Point3 } from '../src/math/vec.ts';
import { createCircleCurve, createNurbsCurve3, createSegmentCurve, TWO_PI, type Curve3 } from '../src/curve/types.ts';
import { circleArcToNurbs } from '../src/curve/conic.ts';
import { createCylinderSurface, createNurbsSurface3, createPlaneSurface, type Surface3 } from '../src/surface/types.ts';
import { cylinderToNurbs } from '../src/surface/nurbs-form.ts';
import { BOX_FACES, boxCorner, makeBox } from '../src/primitive/box.ts';
import { makeCylinder } from '../src/primitive/cylinder.ts';
import { makeSphere } from '../src/primitive/sphere.ts';
import { placement } from '../src/primitive/placement.ts';
import { WORLD_PLACEMENT } from '../src/primitive/placement.ts';
import { buildPolyhedron } from '../src/topology/polyhedron.ts';
import { planePcurve, uvSegment, validateBrepGeometry } from '../src/topology/geometry.ts';
import { eulerPoincare } from '../src/topology/validate.ts';
import type { Brep } from '../src/topology/brep.ts';
import { tessellate } from '../src/tess/mesh.ts';
import { isWatertight, meshSignedVolume } from '../src/tess/check.ts';
import { brepToRecord, recordToBrep } from '../src/convert/brep.ts';
import { classifyPoint } from '../src/query/classify.ts';
import {
  clusterPoints,
  faceSoupOfBrep,
  healIssue,
  mergeCoplanarFaces,
  mergeCosurfaceFaces,
  mergeLabels,
  mergedLoopCount,
  propagateOrientation,
  removeRedundantVertices,
  sewFaces,
  sewFacesReport,
  surfacesCoincide,
  usesOpposite,
  type EdgeUsePair,
  type FaceSoup,
  type SoupEdgePiece,
  type SoupFace,
} from '../src/heal/index.ts';

const k: Kernel = createKernel();
const zone = k.tolerances.zoneTol3d;

/** Deterministic pseudo-random numbers in [0, 1) (an LCG; tests only). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A point moved by `amount` in a pseudo-random direction. */
function jitter(p: Point3, amount: number, r: () => number): Point3 {
  const d = vec3(r() - 0.5, r() - 0.5, r() - 0.5);
  const n = Math.hypot(d.x, d.y, d.z) || 1;
  return add3(p, scale3(d, amount / n));
}

/** Six independent faces of the box `[o, o + d]`, every face with its own copy of the corners moved by `amount`. */
function boxSoup(origin: Point3, d: Point3, amount: number, seed: number): FaceSoup {
  const r = rng(seed);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => boxCorner(origin, d.x, d.y, d.z, i));
  const faces: SoupFace[] = BOX_FACES.map((cycle) => {
    const exact = cycle.map((i) => corners[i]!);
    const moved = exact.map((p) => jitter(p, amount, r));
    const n = unwrapNormal(exact);
    const plane = unwrap(createPlaneSurface(k, exact[0]!, n, sub3(exact[1]!, exact[0]!)));
    const loop: SoupEdgePiece[] = moved.map((a, i) => {
      const b = moved[(i + 1) % moved.length]!;
      const curve = unwrap(createSegmentCurve(a, b));
      const pcurve = unwrap(planePcurve(k, plane, { curve, t0: 0, t1: 1 }, false));
      return { curve, t0: 0, t1: 1, reversed: false, pcurve };
    });
    return { surface: plane, reversed: false, loops: [loop] };
  });
  return { faces };
}

function unwrapNormal(ps: readonly Point3[]): Point3 {
  const a = sub3(ps[1]!, ps[0]!), b = sub3(ps[2]!, ps[0]!);
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/** A soup face with the opposite orientation (reversed flag toggled, loops run backwards). */
function flipSoupFace(f: SoupFace): SoupFace {
  return {
    surface: f.surface,
    reversed: !f.reversed,
    loops: f.loops.map((l) =>
      [...l].reverse().map((p) => {
        const out: SoupEdgePiece = { curve: p.curve, t0: p.t0, t1: p.t1, reversed: !p.reversed };
        if (p.pcurve === undefined) return out;
        const pts = [...p.pcurve.controlPoints].reverse();
        const [a, b] = [p.pcurve.knots[0]!, p.pcurve.knots[p.pcurve.knots.length - 1]!];
        const knots = p.pcurve.knots.map((t) => a + b - t).reverse();
        const pc = p.pcurve.weights === undefined ? undefined : [...p.pcurve.weights].reverse();
        return { ...out, pcurve: { ...p.pcurve, knots, controlPoints: pts, ...(pc === undefined ? {} : { weights: pc }) } };
      }),
    ),
  };
}

function volumeOf(brep: Brep, chord = 1e-3): number {
  const m = unwrap(tessellate(k, brep, { chord, angleDeg: 5 }));
  assert.ok(isWatertight(m), 'mesh is watertight');
  return meshSignedVolume(m);
}

/** The full correctness contract of a healed body. */
function assertValidSolid(brep: Brep): void {
  unwrap(validateBrepGeometry(k, brep));
  const back = unwrap(recordToBrep(k, unwrap(brepToRecord(brep))));
  assert.deepEqual(back, brep);
  assert.ok(volumeOf(brep, 1e-2) > 0);
}

const issueOf = (r: { ok: boolean; error?: unknown }): string | undefined =>
  r.ok ? undefined : healIssue((r as { error: Parameters<typeof healIssue>[0] }).error);

// ------------------------------------------------------------------------------------------------------
// Lean-mirrored properties.

test('runMerges_idem / runMerges_le / runMerges_rep_min / runMerges_example: labels are fixed points and class minima', () => {
  assert.deepEqual(mergeLabels(5, [[3, 1], [4, 3], [0, 2]]), [0, 1, 0, 1, 1]);
  const r = rng(7);
  for (let trial = 0; trial < 50; trial++) {
    const n = 1 + Math.floor(r() * 30);
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.floor(r() * 40); i++) pairs.push([Math.floor(r() * n), Math.floor(r() * n)]);
    const label = mergeLabels(n, pairs);
    for (let x = 0; x < n; x++) {
      assert.equal(label[label[x]!], label[x]);
      assert.ok(label[x]! <= x);
      for (let y = 0; y < n; y++) if (label[y] === label[x]) assert.ok(label[x]! <= y);
    }
  }
});

test('runMerges_sound / runMerges_complete: same label iff connected by the pairs', () => {
  const r = rng(11);
  for (let trial = 0; trial < 50; trial++) {
    const n = 1 + Math.floor(r() * 25);
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.floor(r() * 30); i++) pairs.push([Math.floor(r() * n), Math.floor(r() * n)]);
    const label = mergeLabels(n, pairs);
    // Connectivity by graph search.
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of pairs) {
      adj[a]!.push(b);
      adj[b]!.push(a);
    }
    for (let x = 0; x < n; x++) {
      const seen = new Set([x]);
      const stack = [x];
      for (let v = stack.pop(); v !== undefined; v = stack.pop()) for (const w of adj[v]!) if (!seen.has(w)) (seen.add(w), stack.push(w));
      for (let y = 0; y < n; y++) assert.equal(label[x] === label[y], seen.has(y), `${x} ~ ${y}`);
    }
  }
});

test('clusterPoints is independent of input order', () => {
  const r = rng(3);
  const base = [vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(1, 1, 1)];
  const pts: Point3[] = [];
  for (const b of base) for (let i = 0; i < 4; i++) pts.push(jitter(b, 0.3 * zone, r));
  const a = clusterPoints(pts, zone);
  assert.equal(a.count, 4);
  const perm = pts.map((_, i) => (i * 7) % pts.length);
  const b = clusterPoints(perm.map((i) => pts[i]!), zone);
  assert.equal(b.count, 4);
  perm.forEach((src, i) => assert.equal(b.clusterOf[i], a.clusterOf[src]));
});

test('propagate_complete / propagate_eq_sigma / propagate_steps_opposite / check_sound: an orientable face graph is always oriented by the BFS', () => {
  const r = rng(5);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(r() * 12);
    const sigma = Array.from({ length: n }, () => r() < 0.5);
    const uses: EdgeUsePair[] = [];
    // A random connected graph whose uses are consistent with sigma.
    for (let g = 1; g < n; g++) uses.push(consistentUse(Math.floor(r() * g), g, sigma, r));
    for (let i = 0; i < n; i++) uses.push(consistentUse(Math.floor(r() * n), Math.floor(r() * n), sigma, r));
    const o = propagateOrientation(n, uses);
    assert.ok(o.ok);
    if (!o.ok) continue;
    for (const u of uses) assert.ok(usesOpposite(o.flip, u));
    assert.equal(o.components.length, 1);
    assert.equal(o.steps.length, n - 1);
    // The propagated assignment is sigma up to a global flip (Lean `propagate_eq_sigma`).
    const s0 = sigma[0]!;
    for (let f = 0; f < n; f++) assert.equal(o.flip[f], sigma[f] !== s0);
  }
});

function consistentUse(f1: number, f2: number, sigma: readonly boolean[], r: () => number): EdgeUsePair {
  const d1 = r() < 0.5;
  // (d1 xor sigma f1) != (d2 xor sigma f2)
  const d2 = !(d1 !== sigma[f1]!) !== sigma[f2]!;
  return { f1, d1, f2, d2 };
}

test('propagate_refusal_sound / moebius_not_orientable: a Möbius strip of three faces is refused, and no assignment fixes it', () => {
  // Faces 0-1, 1-2 glued normally, 2-0 glued with a twist.
  const uses: EdgeUsePair[] = [
    { f1: 0, d1: false, f2: 1, d2: true },
    { f1: 1, d1: false, f2: 2, d2: true },
    { f1: 2, d1: false, f2: 0, d2: false },
  ];
  assert.equal(propagateOrientation(3, uses).ok, false);
  for (let m = 0; m < 8; m++) {
    const flip = [0, 1, 2].map((i) => ((m >> i) & 1) === 1);
    assert.ok(!uses.every((u) => usesOpposite(flip, u)));
  }
  // A seam used twice the same way can never be fixed.
  assert.equal(propagateOrientation(1, [{ f1: 0, d1: true, f2: 0, d2: true }]).ok, false);
});

test('mergeGroup_euler_iff / mergedLoopCount_examples / mergeAcrossEdge_is_group / splitLoop_euler: the loop count that keeps V - E + F - (L - F)', () => {
  // Two faces across one edge: L 2 -> 1. Two faces across two separated edges (a ring): L 2 -> 2.
  assert.equal(mergedLoopCount(2, 1, 0, 2), 1);
  assert.equal(mergedLoopCount(2, 2, 0, 2), 2);
  // Four faces around an interior vertex: 4 edges and the vertex removed.
  assert.equal(mergedLoopCount(4, 4, 1, 4), 1);
});

// ------------------------------------------------------------------------------------------------------
// Sewing.

test('sew a box from six independent faces with vertices moved by 0.3 zone', () => {
  const soup = boxSoup(vec3(1, -2, 0.5), vec3(1, 2, 3), 0.3 * zone, 1);
  const r = unwrap(sewFacesReport(k, soup));
  const brep = r.brep;
  assert.equal(brep.vertices.length, 8);
  assert.equal(brep.edges.length, 12);
  assert.equal(brep.faces.length, 6);
  assert.equal(brep.bodies.length, 1);
  assertValidSolid(brep);
  assert.ok(Math.abs(volumeOf(brep) - 6) < 1e-3);
  assert.ok(r.gaps.maxVertexGap > 0 && r.gaps.maxVertexGap <= 0.6 * zone);
  assert.ok(r.gaps.maxEdgeGap > 0 && r.gaps.maxEdgeGap <= k.tolerances.xsectTol3d);
  assert.equal(r.gaps.endPoints, 48);
  assert.equal(r.gaps.pieces, 24);
  assert.deepEqual(r.flippedFaces, []);
  assert.equal(eulerPoincare(brep).ok, true);
  // Deterministic regardless of the face order of the soup.
  const shuffled = unwrap(sewFaces(k, { faces: [...soup.faces].reverse() }));
  assert.deepEqual(shuffled.vertices, brep.vertices);
});

test('sew with one face flipped: the face is turned back', () => {
  const soup = boxSoup(vec3(0, 0, 0), vec3(2, 2, 2), 0.3 * zone, 2);
  const faces = soup.faces.map((f, i) => (i === 3 ? flipSoupFace(f) : f));
  const r = unwrap(sewFacesReport(k, { faces }));
  assert.deepEqual(r.flippedFaces, [3]);
  assertValidSolid(r.brep);
  assert.ok(Math.abs(volumeOf(r.brep) - 8) < 1e-3);
});

test('sew an inside-out box: the whole shell is turned outward', () => {
  const soup = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0, 2);
  const r = unwrap(sewFacesReport(k, { faces: soup.faces.map(flipSoupFace) }));
  assert.deepEqual(r.flippedFaces, [0, 1, 2, 3, 4, 5]);
  assertValidSolid(r.brep);
});

test('sew a cylinder from planar caps and a NURBS side: circle and NURBS edges merge', () => {
  const radius = 2, h = 3;
  const cyl = unwrap(makeCylinder(k, WORLD_PLACEMENT, radius, h));
  const soup = unwrap(faceSoupOfBrep(cyl));
  const sideIndex = soup.faces.findIndex((f) => f.surface.kind === 'cylinder');
  const side = soup.faces[sideIndex]!;
  if (side.surface.kind !== 'cylinder') throw new Error('unreachable');
  const nurbsSide: Surface3 = unwrap(createNurbsSurface3(unwrap(cylinderToNurbs(side.surface, { u: [0, TWO_PI], v: [0, h] }))));
  const loops = side.loops.map((l) =>
    l.map((p): SoupEdgePiece => {
      if (p.curve.kind !== 'circle') return p;
      const nurbs = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(p.curve))));
      const [t0, t1] = [nurbs.curve.knots[0]!, nurbs.curve.knots[nurbs.curve.knots.length - 1]!];
      return { ...p, curve: nurbs, t0, t1 };
    }),
  );
  const faces = soup.faces.map((f, i) => (i === sideIndex ? { surface: nurbsSide, reversed: false, loops } : f));
  assert.ok(faces[sideIndex]!.loops[0]!.some((p) => p.curve.kind === 'nurbs'));
  const r = unwrap(sewFacesReport(k, { faces }));
  assert.equal(r.brep.edges.length, 3);
  assert.equal(r.brep.vertices.length, 2);
  assert.equal(r.brep.faces.length, 3);
  // The analytic circle is kept for the merged edges.
  assert.equal(r.brep.edges.filter((e) => e.curve.kind === 'circle').length, 2);
  assertValidSolid(r.brep);
  assert.ok(Math.abs(volumeOf(r.brep, 1e-2) - Math.PI * radius * radius * h) < 0.01 * Math.PI * radius * radius * h);
});

test('open soup (a box without its top) is refused: not-closed', () => {
  const soup = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0, 4);
  const r = sewFaces(k, { faces: soup.faces.filter((_, i) => i !== 1) });
  assert.equal(issueOf(r), 'not-closed');
});

test('three faces on an edge are refused: non-manifold', () => {
  const soup = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0, 4);
  const r = sewFaces(k, { faces: [...soup.faces, soup.faces[2]!] });
  assert.equal(issueOf(r), 'non-manifold');
});

test('a gap wider than the tolerance is refused (not-closed), never sewn into a body', () => {
  const soup = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0, 4);
  const moved = soup.faces.map((f, i) => {
    if (i !== 1) return f;
    const loop = f.loops[0]!.map((p) => {
      const a = add3(unwrap(curveEnd(p, 0)), vec3(0, 0, 10 * zone));
      const b = add3(unwrap(curveEnd(p, 1)), vec3(0, 0, 10 * zone));
      return { curve: unwrap(createSegmentCurve(a, b)), t0: 0, t1: 1, reversed: false };
    });
    return { ...f, loops: [loop] };
  });
  const r = sewFaces(k, { faces: moved });
  assert.equal(r.ok, false);
  assert.equal(issueOf(r), 'not-closed');
});

function curveEnd(p: SoupEdgePiece, s: 0 | 1): { ok: true; value: Point3 } {
  if (p.curve.kind !== 'line') throw new Error('line expected');
  const t = s === 0 ? p.t0 : p.t1;
  return { ok: true, value: add3(p.curve.origin, scale3(p.curve.direction, t)) };
}

test('an empty soup is a named refusal', () => {
  assert.equal(issueOf(sewFaces(k, { faces: [] })), 'empty-soup');
});

test('two separate boxes sew into two lumps', () => {
  const a = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0.3 * zone, 5);
  const b = boxSoup(vec3(3, 0, 0), vec3(1, 2, 1), 0.3 * zone, 6);
  const brep = unwrap(sewFaces(k, { faces: [...a.faces, ...b.faces] }));
  assert.equal(brep.bodies.length, 2);
  assert.equal(brep.shells.length, 2);
  assertValidSolid(brep);
  assert.ok(Math.abs(volumeOf(brep) - 3) < 1e-3);
});

test('a box with an inner box sews into one lump with a void shell', () => {
  const outer = boxSoup(vec3(0, 0, 0), vec3(4, 4, 4), 0.3 * zone, 8);
  const inner = boxSoup(vec3(1, 1, 1), vec3(1, 2, 1), 0.3 * zone, 9);
  const r = unwrap(sewFacesReport(k, { faces: [...inner.faces, ...outer.faces] }));
  const brep = r.brep;
  assert.equal(brep.bodies.length, 1);
  assert.equal(brep.bodies[0]!.shells.length, 2);
  // The outer shell comes first; the inner faces were turned to face the void.
  assert.deepEqual(r.flippedFaces, [0, 1, 2, 3, 4, 5]);
  assertValidSolid(brep);
  assert.ok(Math.abs(volumeOf(brep) - (64 - 2)) < 1e-3);
  assert.equal(unwrap(classifyPoint(k, brep, vec3(1.5, 2, 1.5))).class, 'outside');
  assert.equal(unwrap(classifyPoint(k, brep, vec3(0.5, 0.5, 0.5))).class, 'inside');
});

test('crossing shells are refused: shells-intersect', () => {
  const a = boxSoup(vec3(0, 0, 0), vec3(2, 2, 2), 0, 12);
  const b = boxSoup(vec3(1, 1, 1), vec3(2, 2, 2), 0, 13);
  assert.equal(issueOf(sewFaces(k, { faces: [...a.faces, ...b.faces] })), 'shells-intersect');
});

// ------------------------------------------------------------------------------------------------------
// Face merging and redundant vertices.

/** A 2 x 1 x 1 box whose top is split at x = 1 into two faces (10 vertices, 15 edges, 7 faces). */
function splitTopBox(): Brep {
  const c = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => boxCorner(vec3(0, 0, 0), 2, 1, 1, i));
  const pts = [...c, vec3(1, 0, 1), vec3(1, 1, 1)];
  const faces = [
    [0, 2, 3, 1],
    [4, 8, 9, 6],
    [8, 5, 7, 9],
    [0, 1, 5, 8, 4],
    [2, 6, 9, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ];
  return unwrap(buildPolyhedron(k, pts, faces));
}

test('mergeAcrossEdge_euler: merging two faces across one edge gives E - 1, F - 1, L - 1', () => {
  const split = splitTopBox();
  const merged = unwrap(mergeCoplanarFaces(k, split, { removeVertices: false }));
  assert.equal(merged.faces.length, split.faces.length - 1);
  assert.equal(merged.edges.length, split.edges.length - 1);
  assert.equal(merged.loops.length, split.loops.length - 1);
  assert.equal(merged.vertices.length, split.vertices.length);
  assert.equal(unwrap(eulerPoincare(merged)).genus, unwrap(eulerPoincare(split)).genus);
  assertValidSolid(merged);
});

test('removeVertex_euler: removing a vertex between collinear edges gives V - 1, E - 1', () => {
  const merged = unwrap(mergeCoplanarFaces(k, splitTopBox(), { removeVertices: false }));
  const cleaned = unwrap(removeRedundantVertices(k, merged));
  assert.equal(cleaned.vertices.length, merged.vertices.length - 2);
  assert.equal(cleaned.edges.length, merged.edges.length - 2);
  assert.equal(unwrap(eulerPoincare(cleaned)).genus, 0);
  assertValidSolid(cleaned);
});

test('mergeCoplanarFaces on a box with a split side gives back the 6-face box', () => {
  const box = unwrap(mergeCoplanarFaces(k, splitTopBox()));
  assert.equal(box.faces.length, 6);
  assert.equal(box.edges.length, 12);
  assert.equal(box.vertices.length, 8);
  assertValidSolid(box);
  assert.ok(Math.abs(volumeOf(box) - 2) < 1e-9);
  // A plain box has nothing to merge.
  const plain = unwrap(makeBox(k, vec3(0, 0, 0), 1, 1, 1));
  assert.equal(unwrap(mergeCosurfaceFaces(k, plain)), plain);
});

test('box ∪ box sharing a face: sewing the outer faces then merging gives one box', () => {
  // The union's boundary as the boolean assembly would produce it: each box without the shared face.
  const a = boxSoup(vec3(0, 0, 0), vec3(1, 1, 1), 0, 10);
  const b = boxSoup(vec3(1, 0, 0), vec3(1, 1, 1), 0, 11);
  // BOX_FACES index 5 is +x, 4 is -x.
  const faces = [...a.faces.filter((_, i) => i !== 5), ...b.faces.filter((_, i) => i !== 4)];
  // The four side faces of each box have edges on the shared square: those edges join the two boxes.
  const sewn = unwrap(sewFaces(k, { faces }));
  assert.equal(sewn.faces.length, 10);
  const box = unwrap(mergeCoplanarFaces(k, sewn));
  assert.equal(box.faces.length, 6);
  assert.equal(box.edges.length, 12);
  assertValidSolid(box);
  assert.ok(Math.abs(volumeOf(box) - 2) < 1e-9);
});

const R = 1, H = 2;
const circleAt = (z: number) => unwrap(createCircleCurve(k, vec3(0, 0, z), vec3(0, 0, 1), vec3(1, 0, 0), R));
const planeAt = (z: number) => unwrap(createPlaneSurface(k, vec3(0, 0, z), vec3(0, 0, 1), vec3(1, 0, 0)));
const cylSurface = () => unwrap(createCylinderSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), R));

/** A piece of `curve` over `[t0, t1]` on a plane, with its exact pcurve. */
function planarPiece(plane: ReturnType<typeof planeAt>, curve: Curve3, t0: number, t1: number, reversed: boolean): SoupEdgePiece {
  return { curve, t0, t1, reversed, pcurve: unwrap(planePcurve(k, plane, { curve, t0, t1 }, reversed)) };
}
const sidePiece = (curve: Curve3, t0: number, t1: number, reversed: boolean, uv: readonly [number, number, number, number]): SoupEdgePiece => ({
  curve, t0, t1, reversed, pcurve: unwrap(uvSegment(...uv)),
});

test('a cylinder whose top circle is split in two: removeRedundantVertices joins the arcs', () => {
  const bottom = circleAt(0), top = circleAt(H);
  const seam = unwrap(createSegmentCurve(vec3(R, 0, 0), vec3(R, 0, H)));
  const pb = planeAt(0), pt = planeAt(H);
  const faces: SoupFace[] = [
    { surface: pb, reversed: true, loops: [[planarPiece(pb, bottom, 0, TWO_PI, true)]] },
    { surface: pt, reversed: false, loops: [[planarPiece(pt, top, 0, Math.PI, false), planarPiece(pt, top, Math.PI, TWO_PI, false)]] },
    {
      surface: cylSurface(),
      reversed: false,
      loops: [[
        sidePiece(bottom, 0, TWO_PI, false, [0, 0, TWO_PI, 0]),
        sidePiece(seam, 0, 1, false, [TWO_PI, 0, TWO_PI, H]),
        sidePiece(top, Math.PI, TWO_PI, true, [TWO_PI, H, Math.PI, H]),
        sidePiece(top, 0, Math.PI, true, [Math.PI, H, 0, H]),
        sidePiece(seam, 0, 1, true, [0, H, 0, 0]),
      ]],
    },
  ];
  const sewn = unwrap(sewFaces(k, { faces }));
  assert.equal(sewn.vertices.length, 3);
  assert.equal(sewn.edges.length, 4);
  assertValidSolid(sewn);
  const cleaned = unwrap(removeRedundantVertices(k, sewn));
  assert.equal(cleaned.vertices.length, 2);
  assert.equal(cleaned.edges.length, 3);
  assert.ok(cleaned.edges.some((e) => e.curve.kind === 'circle' && e.start === e.end && e.t1 - e.t0 === TWO_PI));
  assertValidSolid(cleaned);
  assert.ok(Math.abs(volumeOf(cleaned, 1e-2) - volumeOf(sewn, 1e-2)) < 1e-9);
  // A plain cylinder has nothing to remove or merge.
  const cyl = unwrap(makeCylinder(k, WORLD_PLACEMENT, 1, 2));
  assert.equal(unwrap(removeRedundantVertices(k, cyl)), cyl);
  assert.equal(unwrap(mergeCosurfaceFaces(k, cyl)), cyl);
});

test('two half-cylinders on one surface are not merged when the merged face would lose its seam', () => {
  const bottom = circleAt(0), top = circleAt(H);
  const l0 = unwrap(createSegmentCurve(vec3(R, 0, 0), vec3(R, 0, H)));
  const lpi = unwrap(createSegmentCurve(vec3(-R, 0, 0), vec3(-R, 0, H)));
  const pb = planeAt(0), pt = planeAt(H);
  const s = cylSurface();
  const faces: SoupFace[] = [
    { surface: pb, reversed: true, loops: [[planarPiece(pb, bottom, Math.PI, TWO_PI, true), planarPiece(pb, bottom, 0, Math.PI, true)]] },
    { surface: pt, reversed: false, loops: [[planarPiece(pt, top, 0, Math.PI, false), planarPiece(pt, top, Math.PI, TWO_PI, false)]] },
    {
      surface: s,
      reversed: false,
      loops: [[
        sidePiece(bottom, 0, Math.PI, false, [0, 0, Math.PI, 0]),
        sidePiece(lpi, 0, 1, false, [Math.PI, 0, Math.PI, H]),
        sidePiece(top, 0, Math.PI, true, [Math.PI, H, 0, H]),
        sidePiece(l0, 0, 1, true, [0, H, 0, 0]),
      ]],
    },
    {
      surface: s,
      reversed: false,
      loops: [[
        sidePiece(bottom, Math.PI, TWO_PI, false, [Math.PI, 0, TWO_PI, 0]),
        sidePiece(l0, 0, 1, false, [TWO_PI, 0, TWO_PI, H]),
        sidePiece(top, Math.PI, TWO_PI, true, [TWO_PI, H, Math.PI, H]),
        sidePiece(lpi, 0, 1, true, [Math.PI, H, Math.PI, 0]),
      ]],
    },
  ];
  const sewn = unwrap(sewFaces(k, { faces }));
  assert.equal(sewn.faces.length, 4);
  assert.equal(sewn.edges.length, 6);
  assertValidSolid(sewn);
  assert.equal(surfacesCoincide(k, sewn.faces[2]!.surface, sewn.faces[3]!.surface), 'same');
  // The merge would leave the side face without a seam (its loops do not close in (u, v)): it is not made.
  assert.equal(unwrap(mergeCosurfaceFaces(k, sewn)), sewn);
  // The planar caps are each one face already; mergeCoplanarFaces changes nothing either.
  assert.equal(unwrap(mergeCoplanarFaces(k, sewn)), sewn);
});

test('surfacesCoincide: planes by normal and offset, cylinders by parametrisation', () => {
  const p = unwrap(createPlaneSurface(k, vec3(0, 0, 1), vec3(0, 0, 1), vec3(1, 0, 0)));
  const q = unwrap(createPlaneSurface(k, vec3(5, 3, 1 + 0.5 * zone), vec3(0, 0, -1), vec3(0, 1, 0)));
  const s = unwrap(createPlaneSurface(k, vec3(0, 0, 1 + 3 * zone), vec3(0, 0, 1), vec3(1, 0, 0)));
  assert.equal(surfacesCoincide(k, p, p), 'same');
  assert.equal(surfacesCoincide(k, p, q), 'opposite');
  assert.equal(surfacesCoincide(k, p, s), undefined);
  const cyl = unwrap(makeCylinder(k, WORLD_PLACEMENT, 1, 2)).faces.find((f) => f.surface.kind === 'cylinder')!.surface;
  assert.equal(surfacesCoincide(k, cyl, cyl), 'same');
  assert.equal(surfacesCoincide(k, cyl, p), undefined);
  assert.ok(distance3(vec3(0, 0, 0), vec3(0, 0, 0)) === 0);
});

// ------------------------------------------------------------------------------------------------------
// Review additions: forests, contact between shells, invalid input to clean-up, holes, determinism.

test('propagate_complete_forest / consistent_xorOn_closed / forest_example: several components are each oriented', () => {
  // forest_example: faces 0-1 and 2-3, roots 0 and 2.
  const ex: EdgeUsePair[] = [{ f1: 0, d1: false, f2: 1, d2: false }, { f1: 2, d1: true, f2: 3, d2: false }];
  const o0 = propagateOrientation(4, ex);
  assert.ok(o0.ok);
  if (o0.ok) {
    assert.deepEqual(o0.components, [[0, 1], [2, 3]]);
    for (const u of ex) assert.ok(usesOpposite(o0.flip, u));
  }
  const r = rng(17);
  for (let trial = 0; trial < 60; trial++) {
    const sizes = [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
    const n = sizes.reduce((a, b) => a + b, 0);
    const sigma = Array.from({ length: n }, () => r() < 0.5);
    const uses: EdgeUsePair[] = [];
    let base = 0;
    for (const m of sizes) {
      for (let g = 1; g < m; g++) uses.push(consistentUse(base + Math.floor(r() * g), base + g, sigma, r));
      for (let i = 0; i < m; i++) uses.push(consistentUse(base + Math.floor(r() * m), base + Math.floor(r() * m), sigma, r));
      base += m;
    }
    const o = propagateOrientation(n, uses);
    assert.ok(o.ok);
    if (!o.ok) continue;
    assert.equal(o.components.length, sizes.filter((m) => m > 0).length);
    for (const u of uses) assert.ok(usesOpposite(o.flip, u));
    // Each root keeps flip false.
    for (const c of o.components) assert.equal(o.flip[c[0]!], false);
  }
});

/** The face soup of a valid body. */
const soupOf = (b: Brep): readonly SoupFace[] => unwrap(faceSoupOfBrep(b)).faces;

test('shells whose boundaries cross with every vertex outside the other are refused: shells-intersect', () => {
  // Two bars crossing like a plus sign: no vertex of either lies inside the other.
  const a = unwrap(makeBox(k, vec3(-2, -0.5, -0.5), 4, 1, 1));
  const b = unwrap(makeBox(k, vec3(-0.5, -2, -0.5), 1, 4, 1));
  assert.equal(issueOf(sewFaces(k, { faces: [...soupOf(a), ...soupOf(b)] })), 'shells-intersect');
  // A cylinder through a box.
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 2, 2, 2));
  const cyl = unwrap(makeCylinder(k, placement(vec3(1, 1, -1)), 0.5, 4));
  assert.equal(issueOf(sewFaces(k, { faces: [...soupOf(box), ...soupOf(cyl)] })), 'shells-intersect');
});

test('shells touching along an edge or at a point inside two faces are refused: shells-intersect', () => {
  // A bar with a diamond cross-section resting on its lower edge on top of a cube, longer than the cube.
  const pts: Point3[] = [];
  for (const x of [-1, 3]) pts.push(vec3(x, 1, 2), vec3(x, 1.3, 2.3), vec3(x, 0.7, 2.3), vec3(x, 1, 2.6));
  const bar = unwrap(buildPolyhedron(k, pts, [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [1, 5, 7, 3], [3, 7, 6, 2], [2, 6, 4, 0]]));
  const cube = unwrap(makeBox(k, vec3(0, 0, 0), 2, 2, 2));
  assert.equal(issueOf(sewFaces(k, { faces: [...soupOf(cube), ...soupOf(bar)] })), 'shells-intersect');
  // Two spheres touching at (0, 1, 0), a point inside a face of each (away from seams and poles).
  const s1 = unwrap(makeSphere(k, vec3(0, 0, 0), 1));
  const s2 = unwrap(makeSphere(k, vec3(0, 2, 0), 1));
  const r = sewFaces(k, { faces: [...soupOf(s1), ...soupOf(s2)] });
  assert.equal(issueOf(r), 'shells-intersect');
  assert.match(r.ok ? '' : (r.error as { reason: string }).reason, /faces .* meet/);
  // Separated by 3 zone: two lumps.
  const s3 = unwrap(makeSphere(k, vec3(0, 2 + 3 * zone, 0), 1));
  const two = unwrap(sewFaces(k, { faces: [...soupOf(s1), ...soupOf(s3)] }));
  assert.equal(two.bodies.length, 2);
  assertValidSolid(two);
});

test('a sphere inside a box sews into one lump with a curved void', () => {
  const box = unwrap(makeBox(k, vec3(-2, -2, -2), 4, 4, 4));
  const ball = unwrap(makeSphere(k, vec3(0.2, 0.1, 0), 1));
  const brep = unwrap(sewFaces(k, { faces: [...soupOf(ball), ...soupOf(box)] }));
  assert.equal(brep.bodies.length, 1);
  assert.equal(brep.bodies[0]!.shells.length, 2);
  assertValidSolid(brep);
  const v = volumeOf(brep, 1e-2);
  assert.ok(Math.abs(v - (64 - (4 / 3) * Math.PI)) < 0.05, `${v}`);
  assert.equal(unwrap(classifyPoint(k, brep, vec3(0.2, 0.1, 0))).class, 'outside');
});

test('sewing is deterministic: the same soup gives byte-identical records', () => {
  const soup = boxSoup(vec3(0.5, 0, -1), vec3(1, 2, 3), 0.4 * zone, 21);
  const a = JSON.stringify(unwrap(brepToRecord(unwrap(sewFaces(k, soup)))));
  const b = JSON.stringify(unwrap(brepToRecord(unwrap(sewFaces(k, soup)))));
  assert.equal(a, b);
});

/** A 3 x 3 x 1 block whose top is a 3 x 3 grid of unit squares with the middle one a pocket of depth 0.5. */
function pocketBlock(): Brep {
  const pts: Point3[] = [];
  const g = (i: number, j: number): number => i * 4 + j;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) pts.push(vec3(i, j, 1));
  pts.push(vec3(0, 0, 0), vec3(3, 0, 0), vec3(3, 3, 0), vec3(0, 3, 0), vec3(1, 1, 0.5), vec3(2, 1, 0.5), vec3(2, 2, 0.5), vec3(1, 2, 0.5));
  const B = 16, P = 20;
  const faces: number[][] = [
    [B + 3, B + 2, B + 1, B],
    [B, B + 1, g(3, 0), g(2, 0), g(1, 0), g(0, 0)],
    [B + 1, B + 2, g(3, 3), g(3, 2), g(3, 1), g(3, 0)],
    [B + 2, B + 3, g(0, 3), g(1, 3), g(2, 3), g(3, 3)],
    [B + 3, B, g(0, 0), g(0, 1), g(0, 2), g(0, 3)],
    [P, P + 1, P + 2, P + 3],
    [g(1, 1), P, P + 3, g(1, 2)],
    [g(2, 1), P + 1, P, g(1, 1)],
    [g(2, 2), P + 2, P + 1, g(2, 1)],
    [g(1, 2), P + 3, P + 2, g(2, 2)],
  ];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) faces.push([g(i, j), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1)]);
  return unwrap(buildPolyhedron(k, pts, faces));
}

test('mergeCoplanarFaces turns a ring of eight squares into one face with a hole', () => {
  const block = pocketBlock();
  assertValidSolid(block);
  assert.equal(block.faces.length, 18);
  const merged = unwrap(mergeCoplanarFaces(k, block));
  assert.equal(merged.faces.length, 11);
  assert.equal(merged.loops.length, 12);
  assert.equal(merged.vertices.length, 16);
  assert.equal(merged.edges.length, 24);
  assert.equal(merged.faces.filter((f) => f.loops.length === 2).length, 1);
  assertValidSolid(merged);
  assert.ok(Math.abs(volumeOf(merged) - 8.5) < 1e-9);
  assert.equal(unwrap(eulerPoincare(merged)).genus, 0);
  // Deterministic.
  assert.equal(JSON.stringify(unwrap(brepToRecord(unwrap(mergeCoplanarFaces(k, block))))), JSON.stringify(unwrap(brepToRecord(merged))));
});

test('clean-up refuses an input that is not geometrically valid instead of returning it', () => {
  // The second top face of the split box lies 2 zone above its edges.
  const split = splitTopBox();
  const faces = split.faces.map((f, i) => {
    if (i !== 2 || f.surface.kind !== 'plane') return f;
    const s = unwrap(createPlaneSurface(k, vec3(1.5, 0.5, 1 + 2 * zone), vec3(0, 0, 1), vec3(1, 0, 0)));
    return { ...f, surface: s };
  });
  const bad: Brep = { ...split, faces };
  assert.equal(validateBrepGeometry(k, bad).ok, false);
  assert.equal(mergeCoplanarFaces(k, bad).ok, false);
  assert.equal(removeRedundantVertices(k, bad).ok, false);
});
