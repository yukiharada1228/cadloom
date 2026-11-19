import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { distance3, vec2, vec3, type Point2, type Point3 } from '../src/math/vec.ts';
import { curvePoint3 } from '../src/curve/evaluate.ts';
import { createNurbsCurve, evaluateCurve } from '../src/nurbs/curve.ts';
import { implicitValue } from '../src/surface/implicit.ts';
import { surfacePoint3 } from '../src/surface/evaluate.ts';
import { faceId, type Brep, type FaceId, coedgeStart, coedgeEnd, loopCoedges } from '../src/topology/brep.ts';
import { buildPolyhedron, eulerPoincare, validateBrepGeometry } from '../src/topology/index.ts';
import { BOX_FACES, makeBox, makeCylinder, makeSphere, placement } from '../src/primitive/index.ts';
import { tessellate } from '../src/tess/index.ts';
import { isWatertight, meshSignedVolume } from '../src/tess/check.ts';
import { brepToRecord, recordToBrep } from '../src/convert/index.ts';
import { parseRecordText, stringifyRecord } from '../src/record/index.ts';
import { edgeDistance, faceArea, pointInFace, prepareBody } from '../src/query/index.ts';
import { refusalReason } from '../src/intersect/types.ts';
import { faceFaceIntersection, type FaceFaceIntersection, type IntersectionPiece } from '../src/boolean/face-intersect.ts';
import { brepCounts, imprintBodies, imprintBody, type ImprintedBody, type ImprintPair } from '../src/boolean/imprint.ts';
import { IMPRINT_DELTA, applyImprintOp, applyImprintOps, imprintChi, type ImprintOp } from '../src/boolean/imprint-count.ts';
import { arrangementFaces, ringArea2, type ArrangementDart } from '../src/boolean/imprint-arrangement.ts';
import { nurbsSubCurve, splitIntervals, splitNurbsAt } from '../src/boolean/split.ts';

const k = createKernel();
const P = vec3;
const TOL = k.tolerances.zoneTol3d;
const BOTTOM = faceId(0), TOP = faceId(1), FRONT = faceId(2), BACK = faceId(3), LEFT = faceId(4), RIGHT = faceId(5);
const close = (a: number, b: number, tol: number, msg?: string): void => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} vs ${b} (tol ${tol})`);
const box = (o: Point3, dx: number, dy: number, dz: number): Brep => unwrap(makeBox(k, o, dx, dy, dz));

// ---------------------------------------------------------------------------------------------------------
// Fixtures (each pair imprinted once and shared by several tests).

const boxA = box(P(0, 0, 0), 2, 2, 2);
const boxB = box(P(1, 1, 1), 2, 2, 2);
const slab = box(P(1, -1, -1), 2, 4, 4);
const cyl = unwrap(makeCylinder(k, placement(), 1, 2));
const cutter = box(P(0.5, -3, 0.5), 3, 6, 1); // x >= 0.5 band z in [0.5, 1.5]: arcs cross the cylinder's seam
const plate = box(P(0, 0, -1), 4, 4, 2); // its top face z = 1 holds the circle of the pin at (2, 2)
const pin = unwrap(makeCylinder(k, placement(P(2, 2, 0)), 1, 2));
const ball = unwrap(makeSphere(k, P(0, 0, 0), 1));
const floor = box(P(-2, -2, -2), 4, 4, 2); // its top face z = 0 cuts the ball at the equator

const memo = new Map<string, { readonly r: ImprintPair; readonly a: Brep; readonly b: Brep }>();
function pair(name: string, a: Brep, b: Brep): ImprintPair {
  let m = memo.get(name);
  if (m === undefined) {
    m = { r: unwrap(imprintBodies(k, a, b)), a, b };
    memo.set(name, m);
  }
  return m.r;
}

/** Display-mesh volume of a body (watertight). */
function meshVolume(b: Brep): number {
  const m = unwrap(tessellate(k, b));
  assert.ok(isWatertight(m), 'watertight mesh');
  assert.equal(m.stats.failedFaces.length, 0);
  return meshSignedVolume(m);
}

/** Every check a returned imprinted body must pass (the stage's contract). */
function checkImprinted(name: string, original: Brep, ib: ImprintedBody): void {
  unwrap(validateBrepGeometry(k, ib.brep));
  // Watertight with positive volume, equal to the original's within the display tolerance (finer edges move the
  // display mesh of curved faces by up to about a percent).
  const v0 = meshVolume(original), v1 = meshVolume(ib.brep);
  assert.ok(v1 > 0, `${name}: positive volume`);
  close(v1, v0, 2e-2 * v0, `${name}: volume ${v1} vs ${v0}`);
  // The fragments of each source face cover it: their areas add up to the face's area.
  const before = unwrap(prepareBody(k, original)), after = unwrap(prepareBody(k, ib.brep));
  for (let f = 0; f < original.faces.length; f++) {
    const a0 = unwrap(faceArea(k, before, faceId(f)));
    const a1 = sum(ib.fragments.filter((fr) => fr.sourceFace === f).map((fr) => unwrap(faceArea(k, after, fr.face))));
    close(a1, a0, 1e-4 * Math.max(1, a0), `${name}: face ${f} area ${a1} vs ${a0}`);
  }
  // Record round trip.
  const rec = unwrap(brepToRecord(ib.brep));
  const back = unwrap(recordToBrep(k, unwrap(parseRecordText(stringifyRecord(rec)))));
  assert.deepStrictEqual(back, ib.brep, `${name}: record round trip`);
  // Counts: the logged steps applied to the original counts give the result's; genus unchanged.
  assert.deepStrictEqual(applyImprintOps(brepCounts(original), ib.ops), brepCounts(ib.brep), `${name}: counting model`);
  assert.equal(unwrap(eulerPoincare(ib.brep)).genus, unwrap(eulerPoincare(original)).genus);
  // Provenance and the fragment soup.
  assert.equal(ib.faceSource.length, ib.brep.faces.length);
  assert.equal(ib.fragments.length, ib.brep.faces.length);
  assert.equal(ib.edgeSource.length, ib.brep.edges.length);
  for (const fr of ib.fragments) {
    const src = original.faces[fr.sourceFace]!;
    assert.equal(fr.surface, src.surface);
    assert.equal(fr.reversed, src.reversed);
  }
  // Loops closed (vertex to vertex) and pcurves lifting onto their coedges' vertices.
  for (const [fi, f] of ib.brep.faces.entries()) {
    for (const l of f.loops) {
      const cs = unwrap(loopCoedges(ib.brep, l));
      for (const [i, c] of cs.entries()) {
        const nx = cs[(i + 1) % cs.length]!;
        assert.equal(coedgeEnd(ib.brep, c), coedgeStart(ib.brep, nx), `${name}: face ${fi} loop closes`);
        const pc = ib.brep.coedges[c]!.pcurve;
        if (pc === undefined) continue;
        for (const [s, v] of [[0, coedgeStart(ib.brep, c)!], [1, coedgeEnd(ib.brep, c)!]] as const) {
          const dom = [pc.knots[pc.degree]!, pc.knots[pc.knots.length - 1 - pc.degree]!];
          const uv = unwrap(evaluateCurve(pc, s === 0 ? dom[0]! : dom[1]!));
          const p = unwrap(surfacePoint3(f.surface, uv[0]!, uv[1]!));
          assert.ok(distance3(p, ib.brep.vertices[v]!.point) <= TOL, `${name}: pcurve end on its vertex`);
        }
      }
    }
  }
}

/** Fragments of `ib` coming from source face `f`, with their areas. */
function fragmentAreas(ib: ImprintedBody, f: FaceId): number[] {
  const body = unwrap(prepareBody(k, ib.brep));
  return ib.fragments.filter((fr) => fr.sourceFace === f).map((fr) => unwrap(faceArea(k, body, fr.face)));
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Every piece lies on both faces (samples on both surfaces and not outside either face) and ends on its contacts. */
function checkPieces(a: Brep, b: Brep, r: FaceFaceIntersection): void {
  if (r.kind === 'disjoint') return;
  const pa = unwrap(prepareBody(k, a)), pb = unwrap(prepareBody(k, b));
  for (const p of r.pieces) {
    for (const s of [0.1, 0.37, 0.5, 0.81]) {
      const q = unwrap(curvePoint3(p.curve, p.t0 + s * (p.t1 - p.t0)));
      for (const [body, face, surf] of [[pa, r.faceA, a.faces[r.faceA]!.surface], [pb, r.faceB, b.faces[r.faceB]!.surface]] as const) {
        assert.ok(Math.abs(unwrap(implicitValue(surf, q))) <= TOL, 'piece on the surface');
        assert.notEqual(unwrap(pointInFace(k, body, face, { point: q })).class, 'outside', 'piece not outside the face');
      }
    }
    for (const end of [p.start, p.end]) {
      assert.ok(distance3(unwrap(curvePoint3(p.curve, end === p.start ? p.t0 : p.t1)), end.point) <= TOL, 'end point is the curve end');
      for (const c of end.contacts) {
        const brep = c.side === 'A' ? a : b;
        if (c.kind === 'vertex') assert.ok(distance3(brep.vertices[c.vertex]!.point, end.point) <= TOL);
        else assert.ok(unwrap(edgeDistance(brep, c.edge, end.point)).distance <= TOL, 'end on its edge');
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Stage 1: face/face intersection trimmed to faces.

test('faceFaceIntersection: overlapping boxes — every face pair, pieces on both faces ending on edges', () => {
  let total = 0;
  for (let fa = 0; fa < 6; fa++) {
    for (let fb = 0; fb < 6; fb++) {
      const r = unwrap(faceFaceIntersection(k, boxA, faceId(fa), boxB, faceId(fb)));
      checkPieces(boxA, boxB, r);
      if (r.kind === 'curves') {
        total += r.pieces.length;
        for (const p of r.pieces) {
          assert.equal(p.class, 'exact');
          assert.equal(p.curve.kind, 'line');
          // Each end lies on an edge of A or of B (a segment never ends inside both faces).
          assert.ok(p.start.contacts.length > 0 && p.end.contacts.length > 0);
        }
      }
    }
  }
  // Three faces of A meet three faces of B: two pieces each on A's top, right, back, as an L through B's corner edges.
  assert.equal(total, 6);
  const top = unwrap(faceFaceIntersection(k, boxA, TOP, boxB, LEFT));
  assert.equal(top.kind, 'curves');
  if (top.kind !== 'curves') return;
  assert.equal(top.pieces.length, 1);
  const p = top.pieces[0]!;
  const ends = [p.start.point, p.end.point].sort((x, y) => x.y - y.y);
  assert.ok(distance3(ends[0]!, P(1, 1, 2)) <= 1e-12 && distance3(ends[1]!, P(1, 2, 2)) <= 1e-12);
  // (1, 2, 2) is on A's top/back edge, (1, 1, 2) on B's vertical edge x = y = 1 (inside A's top face).
  const hi = p.start.point.y > p.end.point.y ? p.start : p.end;
  const lo = hi === p.start ? p.end : p.start;
  assert.ok(hi.contacts.some((c) => c.side === 'A' && c.kind === 'edge'));
  assert.ok(lo.contacts.every((c) => c.side === 'B'));
});

test('faceFaceIntersection: a box face against a cylinder side — lines and arcs, arcs split at the seam', () => {
  const kinds: string[] = [];
  for (const fa of [BOTTOM, TOP, LEFT]) {
    const r = unwrap(faceFaceIntersection(k, cutter, fa, cyl, faceId(2)));
    checkPieces(cutter, cyl, r);
    assert.equal(r.kind, 'curves');
    if (r.kind !== 'curves') continue;
    for (const p of r.pieces) {
      kinds.push(p.curve.kind);
      assert.ok(p.pcurveA !== undefined && p.pcurveB !== undefined, 'pcurves on both faces');
    }
    if (fa === LEFT) {
      // x = 0.5 meets the side in two rulings, trimmed to z in [0.5, 1.5] by the box face's edges.
      assert.equal(r.pieces.length, 2);
      for (const p of r.pieces) close(distance3(p.start.point, p.end.point), 1, 1e-12);
    } else {
      // The circle at z = 0.5 (1.5) is trimmed to x >= 0.5 and split at the seam (1, 0, z): two arcs of π/3.
      assert.equal(r.pieces.length, 2);
      for (const p of r.pieces) close(p.t1 - p.t0, Math.PI / 3, 1e-9);
      const atSeam = r.pieces.flatMap((p) => [p.start, p.end]).filter((e) => e.contacts.some((c) => c.side === 'B' && c.kind === 'edge' && c.edge === 2));
      assert.equal(atSeam.length, 2, 'both arcs end on the seam edge');
    }
  }
  assert.deepStrictEqual([...kinds].sort(), ['circle', 'circle', 'circle', 'circle', 'line', 'line']);
});

test('faceFaceIntersection: sphere against a box face — the circle trimmed by the face boundary', () => {
  const block = box(P(-0.5, 0.2, -2), 2.5, 1.8, 4);
  const r = unwrap(faceFaceIntersection(k, block, LEFT, ball, faceId(0)));
  checkPieces(block, ball, r);
  assert.equal(r.kind, 'curves');
  if (r.kind !== 'curves') return;
  // x = -0.5 cuts the ball in a circle of radius √0.75 about (-0.5, 0, 0); the face keeps y >= 0.2: one arc.
  assert.equal(r.pieces.length, 1);
  const p = r.pieces[0]!;
  assert.equal(p.curve.kind, 'circle');
  for (const end of [p.start, p.end]) {
    close(end.point.y, 0.2, 1e-12);
    assert.ok(end.contacts.some((c) => c.side === 'A' && c.kind === 'edge'));
  }
  const half = Math.acos(0.2 / Math.sqrt(0.75));
  close(p.t1 - p.t0, 2 * half, 1e-9);
});

test('faceFaceIntersection: coplanar overlapping faces are coincident with the overlap boundary', () => {
  const b = box(P(1, 1, 0), 2, 2, 2);
  const r = unwrap(faceFaceIntersection(k, boxA, TOP, b, TOP));
  assert.equal(r.kind, 'coincident');
  if (r.kind !== 'coincident') return;
  assert.equal(r.sameOrientation, true);
  // The overlap is the square [1, 2]²: two sides from A's edges, two from B's.
  const len = sum(r.pieces.map((p) => distance3(p.start.point, p.end.point)));
  close(len, 4, 1e-12);
  assert.deepStrictEqual(r.pieces.map((p) => p.source).sort(), ['boundary-A', 'boundary-A', 'boundary-B', 'boundary-B']);
  for (const p of r.pieces) {
    for (const s of [0.25, 0.75]) {
      const q = unwrap(curvePoint3(p.curve, p.t0 + s * (p.t1 - p.t0)));
      assert.ok(q.x >= 1 - 1e-12 && q.x <= 2 + 1e-12 && q.y >= 1 - 1e-12 && q.y <= 2 + 1e-12 && q.z === 2);
    }
    // A's edges run along A's boundary; B's edge parts inside A carry a pcurve on A (they will be imprinted there).
    if (p.source === 'boundary-B') assert.ok(p.pcurveA !== undefined);
  }
  // Touching boxes: the shared plane with opposite normals.
  const t = unwrap(faceFaceIntersection(k, box(P(0, 0, 0), 1, 1, 1), RIGHT, box(P(1, 0, 0), 1, 1, 1), LEFT));
  assert.equal(t.kind, 'coincident');
  if (t.kind === 'coincident') assert.equal(t.sameOrientation, false);
});

test('faceFaceIntersection: a tangent contact inside both faces is refused by name; apart faces are disjoint', () => {
  const ground = box(P(-2, 0, -1), 4, 4, 1);
  const roller = unwrap(makeCylinder(k, placement(P(-1, 2, 1), P(1, 0, 0), P(0, 1, 0)), 1, 2));
  const r = faceFaceIntersection(k, ground, TOP, roller, faceId(2));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(refusalReason(r.error), 'tangent contact not resolved');
  const far = unwrap(faceFaceIntersection(k, boxA, TOP, box(P(5, 5, 5), 1, 1, 1), BOTTOM));
  assert.equal(far.kind, 'disjoint');
  const bad = faceFaceIntersection(k, boxA, faceId(17), boxB, TOP);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.kind, 'not-found');
});

// ---------------------------------------------------------------------------------------------------------
// Stages 1 + 2: imprinted bodies.

test('imprint: a square face cut by a crossing line gives 2 fragments whose areas sum to the original', () => {
  const r = pair('slab', boxA, slab);
  checkImprinted('slab A', boxA, r.a);
  checkImprinted('slab B', slab, r.b);
  for (const f of [TOP, BOTTOM, FRONT, BACK]) {
    const areas = fragmentAreas(r.a, f);
    assert.equal(areas.length, 2, `face ${f} split in two`);
    for (const a of areas) close(a, 2, 1e-9);
    close(sum(areas), 4, 1e-9);
  }
  for (const f of [LEFT, RIGHT]) assert.equal(fragmentAreas(r.a, f).length, 1);
});

test('imprint: overlapping boxes — L-shaped imprints through an interior vertex, both bodies valid', () => {
  const r = pair('box/box', boxA, boxB);
  checkImprinted('box/box A', boxA, r.a);
  checkImprinted('box/box B', boxB, r.b);
  for (const f of [TOP, RIGHT, BACK]) {
    const areas = fragmentAreas(r.a, f).sort((x, y) => x - y);
    assert.deepStrictEqual(areas.length, 2);
    close(areas[0]!, 1, 1e-9);
    close(areas[1]!, 3, 1e-9);
  }
  // Each imprinted edge of A pairs with one of B through its piece.
  const piecesA = r.a.edgeSource.filter((s) => s.kind === 'imprint').map((s) => (s.kind === 'imprint' ? s.piece : -1));
  const piecesB = r.b.edgeSource.filter((s) => s.kind === 'imprint').map((s) => (s.kind === 'imprint' ? s.piece : -1));
  assert.deepStrictEqual([...piecesA].sort(), [...piecesB].sort());
  assert.equal(piecesA.length, 6);
});

test('imprint: a circle fully inside a face gives an annulus and a disc whose areas sum to the face', () => {
  const r = pair('plate/pin', plate, pin);
  checkImprinted('plate', plate, r.a);
  checkImprinted('pin', pin, r.b);
  const areas = fragmentAreas(r.a, TOP).sort((x, y) => x - y);
  assert.equal(areas.length, 2);
  close(areas[0]!, Math.PI, 1e-4 * Math.PI);
  close(areas[1]!, 16 - Math.PI, 1e-4 * 16);
  close(sum(areas), 16, 1e-4);
  // The annulus has the circle as a hole: 2 loops; the disc 1.
  const loops = r.a.fragments.filter((f) => f.sourceFace === TOP).map((f) => f.loops.length).sort();
  assert.deepStrictEqual(loops, [1, 2]);
  assert.ok(r.a.ops.includes('ring'));
});

test('imprint: cylinder side imprinted by curves crossing the seam (seam split, fragments across it)', () => {
  // The pin's side is cut by the plate's top at z = 1: one circle crossing the seam, two bands of area 2π.
  const bands = fragmentAreas(pair('plate/pin', plate, pin).b, faceId(2)).sort((x, y) => x - y);
  assert.equal(bands.length, 2);
  for (const a of bands) close(a, 2 * Math.PI, 1e-3);
  // The cutter's band x >= 0.5, z in [0.5, 1.5] straddles the seam: in (u, v) it is two rectangles, one at
  // u in [0, π/3] and one at u in [5π/3, 2π], two fragments sharing the middle piece of the split seam.
  const r = pair('cutter/cyl', cutter, cyl);
  checkImprinted('cutter', cutter, r.a);
  checkImprinted('cyl', cyl, r.b);
  const side = fragmentAreas(r.b, faceId(2)).sort((x, y) => x - y);
  assert.equal(side.length, 3);
  close(side[0]!, Math.PI / 3, 1e-4);
  close(side[1]!, Math.PI / 3, 1e-4);
  close(sum(side), 4 * Math.PI, 1e-3);
  const seamPieces = r.b.edgeSource.filter((s) => s.kind === 'split' && s.edge === 2);
  assert.equal(seamPieces.length, 3, 'the seam is cut at z = 0.5 and z = 1.5');
});

test('imprint: a sphere cut at its equator — two hemispheres, each keeping its pole', () => {
  const r = pair('floor/ball', floor, ball);
  checkImprinted('floor', floor, r.a);
  checkImprinted('ball', ball, r.b);
  const halves = fragmentAreas(r.b, faceId(0));
  assert.equal(halves.length, 2);
  for (const a of halves) close(a, 2 * Math.PI, 1e-3);
  // Each hemisphere's loop: the two halves of the cut seam and the equator; its pole stays a vertex of the seam.
  for (const fr of r.b.fragments) {
    assert.equal(fr.loops.length, 1);
    assert.equal(fr.loops[0]!.length, 3);
    const zs = fr.loops[0]!.flatMap((u) => [r.b.brep.edges[u.edge]!.start, r.b.brep.edges[u.edge]!.end]).map((v) => r.b.brep.vertices[v]!.point.z);
    assert.ok(zs.some((z) => Math.abs(Math.abs(z) - 1) <= 1e-12), 'a pole vertex');
  }
  // The floor's top face: annulus + unit disc.
  const top = fragmentAreas(r.a, TOP).sort((x, y) => x - y);
  close(top[0]!, Math.PI, 1e-3);
  close(sum(top), 16, 1e-4);
});

test('imprint: coplanar faces — the overlap boundary is imprinted on both, bodies stay valid', () => {
  const b = box(P(1, 1, 0), 2, 2, 2);
  const r = unwrap(imprintBodies(k, boxA, b));
  checkImprinted('coplanar A', boxA, r.a);
  checkImprinted('coplanar B', b, r.b);
  assert.ok(r.intersections.some((x) => x.kind === 'coincident'));
  for (const f of [TOP, BOTTOM]) {
    const areas = fragmentAreas(r.a, f).sort((x, y) => x - y);
    assert.equal(areas.length, 2);
    close(areas[0]!, 1, 1e-9);
    close(areas[1]!, 3, 1e-9);
  }
});

test('imprint: coincident cylinder sides — the overlap boundary on both, with aligned and rotated seams', () => {
  const lower = cyl;
  const r = unwrap(faceFaceIntersection(k, lower, faceId(2), unwrap(makeCylinder(k, placement(P(0, 0, 1)), 1, 2)), faceId(2)));
  assert.equal(r.kind, 'coincident');
  if (r.kind === 'coincident') assert.equal(r.sameOrientation, true);
  for (const x of [P(1, 0, 0), P(0, 1, 0)]) {
    const upper = unwrap(makeCylinder(k, placement(P(0, 0, 1), P(0, 0, 1), x), 1, 2));
    const ip = unwrap(imprintBodies(k, lower, upper));
    checkImprinted(`lower ${x.y}`, lower, ip.a);
    checkImprinted(`upper ${x.y}`, upper, ip.b);
    // Each side splits into the overlap band z in [1, 2] and the rest (2π each); with the seams a quarter turn
    // apart, the other cylinder's seam is an edge inside the band and splits it once more (π/2 + 3π/2).
    for (const [ib, f] of [[ip.a, faceId(2)], [ip.b, faceId(2)]] as const) {
      const parts = fragmentAreas(ib, f).sort((p, q) => p - q);
      assert.equal(parts.length, x.y === 0 ? 2 : 3);
      close(sum(parts), 4 * Math.PI, 1e-3);
      if (x.y !== 0) close(parts[0]!, Math.PI / 2, 1e-3);
    }
  }
});

test('imprint: certified (marched) and fitted pcurves — crossing cylinders, an oblique plane on a cylinder', () => {
  const big = unwrap(makeCylinder(k, placement(P(0, 0, -2)), 1, 4));
  const bar = unwrap(makeCylinder(k, placement(P(-2, 0, 0.2), P(1, 0, 0), P(0, 1, 0)), 0.5, 4));
  const r = unwrap(imprintBodies(k, big, bar));
  assert.ok(r.pieces.length > 0 && r.pieces.every((p) => p.class === 'certified' && p.curve.kind === 'nurbs'));
  checkImprinted('cyl/cyl big', big, r.a);
  checkImprinted('cyl/cyl bar', bar, r.b);
  // A plate tilted by 0.3 rad about x: its faces cut the cylinder in ellipses (no exact pcurve on the side).
  const c = Math.cos(0.3), s = Math.sin(0.3);
  const pts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(i & 1 ? 3 : -3, c * (i & 2 ? 3 : -3) - s * (i & 4 ? 0.3 : -0.3), s * (i & 2 ? 3 : -3) + c * (i & 4 ? 0.3 : -0.3) + 1));
  const tilted = unwrap(buildPolyhedron(k, pts, BOX_FACES));
  const t = unwrap(imprintBodies(k, tilted, cyl));
  assert.ok(t.pieces.some((p) => p.curve.kind === 'ellipse'));
  checkImprinted('tilted', tilted, t.a);
  checkImprinted('tilted cyl', cyl, t.b);
});

test('imprint: tilted boxes against a box — clipped SSI lines leave no slivers, every result valid', () => {
  // Deterministic tilted boxes (rotations about z then x) crossing a fixed box; before slivers were dropped, a
  // line clipped xsectTol3d past a face edge left a dangling 2e-5 piece along the other body's edge.
  let seed = 777;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const fixed = box(P(-0.3, -0.4, 0.1), 1.1, 0.9, 1.3);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * 1.2, b = rnd() * 1.2;
    const o = P(-0.8 + rnd(), -0.8 + rnd(), rnd());
    const d = [0.6 + rnd(), 0.6 + rnd(), 0.6 + rnd()] as const;
    const pts = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => {
      const x = j & 1 ? d[0] : 0, y = j & 2 ? d[1] : 0, z = j & 4 ? d[2] : 0;
      const x1 = Math.cos(a) * x - Math.sin(a) * y, y1 = Math.sin(a) * x + Math.cos(a) * y;
      return P(o.x + x1, o.y + Math.cos(b) * y1 - Math.sin(b) * z, o.z + Math.sin(b) * y1 + Math.cos(b) * z);
    });
    const tilted = unwrap(buildPolyhedron(k, pts, BOX_FACES));
    const r = unwrap(imprintBodies(k, tilted, fixed));
    checkImprinted(`tilted ${i} A`, tilted, r.a);
    checkImprinted(`tilted ${i} B`, fixed, r.b);
    for (const piece of r.pieces) assert.ok(distance3(piece.start.point, piece.end.point) > k.tolerances.xsectTol3d || piece.closed);
  }
});

test('imprint: no contact, containment and identical bodies leave the faces whole', () => {
  for (const [a, b] of [
    [boxA, box(P(5, 5, 5), 1, 1, 1)],
    [box(P(0, 0, 0), 4, 4, 4), box(P(1, 1, 1), 1, 1, 1)],
    [boxA, box(P(0, 0, 0), 2, 2, 2)],
  ] as const) {
    const r = unwrap(imprintBodies(k, a, b));
    assert.deepStrictEqual(brepCounts(r.a.brep), brepCounts(a));
    assert.deepStrictEqual(brepCounts(r.b.brep), brepCounts(b));
    assert.equal(r.a.ops.length, 0);
    unwrap(validateBrepGeometry(k, r.a.brep));
  }
});

test('imprint: deterministic — the same input gives the same bodies', () => {
  const x = unwrap(imprintBodies(k, boxA, boxB));
  assert.deepStrictEqual(x, pair('box/box', boxA, boxB));
});

test('imprintBody: a dangling imprinted curve is refused as non-manifold', () => {
  // A segment from (1, 1, 2), inside the top face, to (2, 1, 2) on its edge x = 2: both sides of the curve are
  // one fragment, which a manifold B-rep cannot hold.
  const end = P(2, 1, 2);
  const edge = boxA.edges.findIndex((e, i) => unwrap(edgeDistance(boxA, i as never, end)).distance <= TOL && boxA.vertices[e.start]!.point.z === 2);
  assert.ok(edge >= 0);
  const e = boxA.edges[edge]!;
  const a = boxA.vertices[e.start]!.point, b = boxA.vertices[e.end]!.point;
  const t = (end.y - a.y) / (b.y - a.y);
  const seg = Object.freeze({ kind: 'line', origin: P(1, 1, 2), direction: P(1, 0, 0), range: Object.freeze([0, 1] as const) } as const);
  const pc = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[1, 1], [2, 1]]));
  const r = imprintBody(k, boxA, new Map([[edge as never, [{ t }]]]), [{ face: TOP, curve: seg, pcurve: pc, closed: false }]);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.kind, 'invalid-topology');
    assert.match(r.error.kind === 'invalid-topology' ? r.error.reason : '', /non-manifold imprint/);
  }
  // The same segment continued to the opposite edge is a chord: two fragments.
  const chord = Object.freeze({ kind: 'line', origin: P(0, 1, 2), direction: P(2, 0, 0), range: Object.freeze([0, 1] as const) } as const);
  const pc2 = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 1], [2, 1]]));
  const other = boxA.edges.findIndex((x, i) => unwrap(edgeDistance(boxA, i as never, P(0, 1, 2))).distance <= TOL && boxA.vertices[x.start]!.point.z === 2);
  const ex = boxA.edges[other]!;
  const tx = (1 - boxA.vertices[ex.start]!.point.y) / (boxA.vertices[ex.end]!.point.y - boxA.vertices[ex.start]!.point.y);
  const ok2 = unwrap(imprintBody(k, boxA, new Map([[edge as never, [{ t }]], [other as never, [{ t: tx }]]]), [{ face: TOP, curve: chord, pcurve: pc2, closed: false }]));
  assert.deepStrictEqual(ok2.ops, ['split-edge', 'split-edge', 'chord']);
  checkImprinted('manual chord', boxA, ok2);
});

// ---------------------------------------------------------------------------------------------------------
// Lean correspondence (formal/CadloomFormal/Imprint.lean).

const OPS: readonly ImprintOp[] = ['split-edge', 'spur', 'free-edge', 'chord', 'bridge', 'ring'];

test('chi_apply / chi_run / chi_eq_euler: every imprint step keeps V - E + 2F - L', () => {
  const c0 = { v: 8, e: 12, f: 6, l: 6 };
  for (const op of OPS) assert.equal(imprintChi(applyImprintOp(c0, op)), imprintChi(c0), op);
  let seed = 7;
  for (let n = 0; n < 50; n++) {
    const ops = Array.from({ length: n }, () => OPS[(seed = (seed * 1103515245 + 12345) % 2147483648) % OPS.length]!);
    assert.equal(imprintChi(applyImprintOps(c0, ops)), imprintChi(c0));
  }
  assert.equal(imprintChi(c0), c0.v - c0.e + c0.f - (c0.l - c0.f));
  assert.deepStrictEqual(IMPRINT_DELTA.ring, { v: 1, e: 1, f: 1, l: 2 });
});

test('chord_counts / chord_new_vertices / ring_counts: the counts of a chord and of a ring', () => {
  const c = { v: 8, e: 12, f: 6, l: 6 };
  assert.deepStrictEqual(applyImprintOp(c, 'chord'), { v: 8, e: 13, f: 7, l: 7 });
  assert.deepStrictEqual(applyImprintOps(c, ['split-edge', 'split-edge', 'chord']), { v: 10, e: 15, f: 7, l: 7 });
  assert.deepStrictEqual(applyImprintOps(c, ['ring']), { v: 9, e: 13, f: 7, l: 8 });
  // The plate's top face holds one ring: the imprinted plate has exactly those counts.
  const r = pair('plate/pin', plate, pin);
  assert.deepStrictEqual(r.a.ops, ['ring']);
  assert.deepStrictEqual(brepCounts(r.a.brep), applyImprintOps(brepCounts(plate), ['ring']));
});

test('run_f / run_l: faces and loops predicted by the logged steps match the arrangement', () => {
  pair('box/box', boxA, boxB);
  pair('plate/pin', plate, pin);
  pair('cutter/cyl', cutter, cyl);
  pair('floor/ball', floor, ball);
  for (const [name, m] of memo) {
    for (const [ib, original] of [[m.r.a, m.a], [m.r.b, m.b]] as const) {
      const count = (o: ImprintOp): number => ib.ops.filter((x) => x === o).length;
      assert.equal(ib.brep.faces.length, original.faces.length + count('chord') + count('ring'), `${name}: faces`);
      assert.equal(
        ib.brep.loops.length,
        original.loops.length + count('chord') + count('free-edge') + 2 * count('ring') - count('bridge'),
        `${name}: loops`,
      );
    }
  }
});

test('box_box_log / slab_log / sphere_equator_log: the TS logs of three imprints', () => {
  const bb = pair('box/box', boxA, boxB).a;
  assert.deepStrictEqual(bb.ops, ['split-edge', 'split-edge', 'split-edge', 'spur', 'chord', 'spur', 'chord', 'spur', 'chord']);
  assert.deepStrictEqual(brepCounts(bb.brep), { v: 14, e: 21, f: 9, l: 9 });
  const sl = pair('slab', boxA, slab).a;
  assert.deepStrictEqual(sl.ops, ['split-edge', 'split-edge', 'split-edge', 'split-edge', 'chord', 'chord', 'chord', 'chord']);
  assert.deepStrictEqual(brepCounts(sl.brep), { v: 12, e: 20, f: 10, l: 10 });
  const sp = pair('floor/ball', floor, ball).b;
  assert.deepStrictEqual(sp.ops, ['split-edge', 'chord']);
  assert.deepStrictEqual(brepCounts(sp.brep), { v: 3, e: 3, f: 2, l: 2 });
});

/** A square face as arrangement darts plus imprint darts (both directions) for chords given as polylines. */
function squareWithChords(chords: readonly (readonly Point2[])[]): ArrangementDart[] {
  // Nodes: 0..3 corners, 4 = (2, 0) on the bottom, 5 = (2, 4) on the top (edge cuts).
  const pts = [vec2(0, 0), vec2(4, 0), vec2(4, 4), vec2(0, 4), vec2(2, 0), vec2(2, 4)];
  const d = (a: number, b: number): ArrangementDart => ({ from: a, to: b, poly: [pts[a]!, pts[b]!] });
  const darts = [d(0, 4), d(4, 1), d(1, 2), d(2, 5), d(5, 3), d(3, 0)];
  for (const c of chords) {
    darts.push({ from: 4, to: 5, poly: [...c] });
    darts.push({ from: 5, to: 4, poly: [...c].reverse() });
  }
  return darts;
}

test('chord_split_area / chord_split_diagonal: a chord polyline splits the area into the two parts', () => {
  const zig = [vec2(2, 0), vec2(2.5, 1), vec2(1.5, 2.25), vec2(2, 4)];
  for (const chord of [[vec2(2, 0), vec2(2, 4)], zig]) {
    const faces = unwrap(arrangementFaces(squareWithChords([chord])));
    assert.equal(faces.length, 2);
    // Dyadic coordinates: the shoelace sums are exact.
    assert.equal(faces[0]!.area2 + faces[1]!.area2, ringArea2([vec2(0, 0), vec2(4, 0), vec2(4, 4), vec2(0, 4)]));
  }
});

test('insert_on_segment: cutting a side at a point of its line keeps the area', () => {
  const sq = [vec2(0, 0), vec2(4, 0), vec2(4, 4), vec2(0, 4)];
  for (const s of [0.25, 0.5, 0.75, 1.5, -0.5]) {
    const m = vec2(4 * s, 0);
    assert.equal(ringArea2([sq[0]!, m, ...sq.slice(1)]), ringArea2(sq));
  }
  assert.equal(ringArea2(sq), 32);
});

test('ring_split_area: a ring inside a face gives a hole and a disc whose areas add up', () => {
  const ring = [vec2(1, 1), vec2(3, 1), vec2(3, 3), vec2(1, 3)];
  const sq = [vec2(0, 0), vec2(4, 0), vec2(4, 4), vec2(0, 4)];
  const darts: ArrangementDart[] = sq.map((p, i) => ({ from: i, to: (i + 1) % 4, poly: [p, sq[(i + 1) % 4]!] }));
  // The ring as one closed imprinted curve on node 4, in both directions.
  darts.push({ from: 4, to: 4, poly: [...ring, ring[0]!] });
  darts.push({ from: 4, to: 4, poly: [...ring, ring[0]!].reverse() });
  const faces = unwrap(arrangementFaces(darts));
  assert.equal(faces.length, 2);
  const annulus = faces.find((f) => f.holes.length === 1)!;
  const disc = faces.find((f) => f.holes.length === 0)!;
  const holeArea = ringArea2([...ring].reverse());
  assert.equal(annulus.area2 + holeArea + disc.area2, ringArea2(sq));
  assert.equal(disc.area2, 8);
});

test('splitIntervals_* / split_one: the pieces partition [t0, t1]', () => {
  const pieces = unwrap(splitIntervals(0, 1, [0.25, 0.5, 0.875]));
  assert.deepStrictEqual(pieces, [[0, 0.25], [0.25, 0.5], [0.5, 0.875], [0.875, 1]]);
  assert.equal(pieces.length, 3 + 1); // splitIntervals_length
  assert.equal(pieces[0]![0], 0); // splitIntervals_head
  assert.equal(pieces[pieces.length - 1]![1], 1); // splitIntervals_last
  for (let i = 0; i + 1 < pieces.length; i++) assert.equal(pieces[i]![1], pieces[i + 1]![0]); // splitIntervals_linked
  for (const [a, b] of pieces) assert.ok(a < b); // splitIntervals_increasing
  assert.equal(sum(pieces.map(([a, b]) => b - a)), 1); // splitIntervals_sum (dyadic: exact)
  for (const x of [0, 0.1, 0.25, 0.6, 1]) assert.ok(pieces.some(([a, b]) => a <= x && x <= b)); // splitIntervals_cover
  assert.deepStrictEqual(unwrap(splitIntervals(-1, 3, [0.5])), [[-1, 0.5], [0.5, 3]]); // split_one
  assert.deepStrictEqual(unwrap(splitIntervals(-1, 3, [])), [[-1, 3]]);
  for (const bad of [[0.5, 0.25], [0], [1], [Number.NaN]]) assert.equal(splitIntervals(0, 1, bad).ok, false);
  assert.equal(splitIntervals(1, 0, []).ok, false);
});

test('splitNurbsAt / nurbsSubCurve: the pieces are the curve itself', () => {
  const c = unwrap(createNurbsCurve(2, [0, 0, 0, 0.5, 1, 1, 1], [[0, 0], [1, 2], [2, -1], [3, 1]], [1, 2, 0.5, 1]));
  const [l, r] = unwrap(splitNurbsAt(c, 0.3));
  const sub = unwrap(nurbsSubCurve(c, 0.2, 0.7));
  for (const t of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.7, 0.9, 1]) {
    const p = unwrap(evaluateCurve(c, t));
    const q = unwrap(evaluateCurve(t <= 0.3 ? l : r, t));
    assert.ok(Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) <= 1e-12);
    if (t >= 0.2 && t <= 0.7) {
      const s = unwrap(evaluateCurve(sub, t));
      assert.ok(Math.hypot(p[0]! - s[0]!, p[1]! - s[1]!) <= 1e-12);
    }
  }
  assert.equal(splitNurbsAt(c, 0).ok, false);
});

// Keep the unused-type import honest for readers: a piece is a frozen value.
test('pieces and imprinted bodies are frozen values', () => {
  const r = pair('box/box', boxA, boxB);
  const p: IntersectionPiece = r.pieces[0]!;
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.start) && Object.isFrozen(r.a.fragments) && Object.isFrozen(r.a.brep));
  const res: Result<unknown> = imprintBodies(k, boxA, boxB);
  assert.equal(res.ok, true);
});

// ---------------------------------------------------------------------------------------------------------
// Adversarial review regressions.

test('coincident spheres: orientation is decided away from the poles; tilted axes are refused by name', () => {
  // Regression: the orientation check evaluated the normal at a vertex of A, which on a sphere is a pole
  // (degenerate normal), so identical spheres failed with a raw `surface.surfaceNormal3` error.
  const s = (axes?: ReturnType<typeof placement>): Brep => unwrap(makeSphere(k, P(0, 0, 0), 1, axes));
  const sa = s(), sb = s();
  const r = unwrap(faceFaceIntersection(k, sa, faceId(0), sb, faceId(0)));
  assert.equal(r.kind, 'coincident');
  if (r.kind === 'coincident') assert.equal(r.sameOrientation, true);
  const ip = unwrap(imprintBodies(k, sa, sb));
  checkImprinted('sphere/sphere a', sa, ip.a);
  checkImprinted('sphere/sphere b', sb, ip.b);
  assert.equal(ip.a.brep.faces.length, 1);
  // Same sphere, poles elsewhere: B's seam runs pole to pole inside A's face (a dangling curve on A) — a named
  // refusal, never a degenerate-normal error or an invalid body.
  const tilted = s(placement(P(0, 0, 0), P(1, 0, 0), P(0, 1, 0)));
  const t = imprintBodies(k, s(), tilted);
  assert.equal(t.ok, false);
  if (!t.ok) {
    assert.equal(t.error.kind, 'invalid-topology');
    assert.match(t.error.kind === 'invalid-topology' ? t.error.reason : '', /non-manifold imprint/);
  }
});

test('near-coincident faces (0.5 and 2 zones), edge-on-edge and vertex-on-face contacts give valid bodies', () => {
  const cases: [string, Brep, number, number][] = [
    // Coplanar bottoms within half a zone: coincident, the overlap square imprinted on both bottoms too.
    ['offset 0.5 zone', box(P(1, 1, 0.5 * TOL), 2, 2, 2), 10, 10],
    // Two zones apart: B's bottom is a separate plane crossing A's sides just above A's bottom edge.
    ['offset 2 zones', box(P(1, 1, 2 * TOL), 2, 2, 2), 9, 9],
    // B's vertical edge lies on A's vertical edge x = y = 2: the faces meet only along it.
    ['edge on edge', box(P(2, 2, 0), 1, 1, 2), 6, 6],
    // B's bottom corner (1, 1, 2) touches A's top face: one face of each overlaps (coincident square).
    ['vertex on face', box(P(1, 1, 2), 1, 1, 1), 7, 6],
  ];
  for (const [name, b, fa, fb] of cases) {
    const r = unwrap(imprintBodies(k, boxA, b));
    checkImprinted(`${name} a`, boxA, r.a);
    checkImprinted(`${name} b`, b, r.b);
    assert.deepStrictEqual([r.a.brep.faces.length, r.b.brep.faces.length], [fa, fb], name);
  }
});
