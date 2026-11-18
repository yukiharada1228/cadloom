import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap, type Result } from '../src/core/error.ts';
import { distance3, vec3, type Point3 } from '../src/math/vec.ts';
import { createCircleCurve, createSegmentCurve, TWO_PI, type Curve3 } from '../src/curve/types.ts';
import { createNurbsCurve, type NurbsCurve } from '../src/nurbs/curve.ts';
import { createCylinderSurface, createPlaneSurface } from '../src/surface/types.ts';
import { surfacePoint3 } from '../src/surface/evaluate.ts';
import {
  BrepBuilder,
  coedgeEnd,
  coedgeFraction,
  coedgeId,
  coedgePoint,
  coedgeStart,
  coedgeUv,
  edgeCurvePoint,
  edgeId,
  edgeParam,
  eulerPoincare,
  faceId,
  faceNormal,
  faceNormalAt,
  faceSurface,
  loopCoedges,
  loopId,
  pcurveUv,
  planePcurve,
  surfaceUv,
  topologyIssue,
  validateBrep,
  validateBrepGeometry,
  type Brep,
  type CoedgeUse,
  type TopologyIssue,
} from '../src/topology/index.ts';
import { makeBox } from '../src/primitive/index.ts';
import { polyhedronMass } from '../src/mass/index.ts';

const k = createKernel();

function expectIssue(r: Result<unknown>, issue: TopologyIssue, entity?: { kind: string; id: number }): void {
  assert.equal(r.ok, false, `expected ${issue}`);
  if (r.ok) return;
  assert.equal(r.error.kind, 'invalid-topology', JSON.stringify(r.error));
  assert.equal(topologyIssue(r.error), issue, r.error.kind === 'invalid-topology' ? r.error.reason : '');
  if (entity !== undefined && r.error.kind === 'invalid-topology') assert.deepEqual(r.error.entity, entity);
}

const closePt = (a: Point3, b: Point3, tol = 1e-9): void => assert.ok(distance3(a, b) <= tol, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

/** Degree-1 (u, v) segment pcurve. */
const uvLine = (u0: number, v0: number, u1: number, v1: number): NurbsCurve =>
  unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0], [u1, v1]]));

interface CylinderOptions {
  /** Replace the pcurve of a cylinder-face coedge (index 0..3 in loop order: bottom, seam up, top, seam down). */
  readonly sidePcurve?: (i: number, pc: NurbsCurve) => NurbsCurve | undefined;
  /** Move the top vertex. */
  readonly topVertex?: Point3;
  /** The bottom circle edge's curve (default: radius r). */
  readonly bottomCurve?: Curve3;
  readonly radius?: number;
  readonly height?: number;
  /** Leave the two disc coedges without pcurves. */
  readonly noDiscPcurves?: boolean;
}

/**
 * Closed cylinder of radius r, height h about +z (the combinatorics of the Lean `cylinderLoops`):
 * vertices v0 = (r, 0, 0), v1 = (r, 0, h); edges e0 bottom circle (v0 -> v0), e1 top circle (v1 -> v1),
 * e2 seam segment (v0 -> v1); faces F0 bottom disc (plane +z, reversed), F1 top disc (plane +z),
 * F2 cylinder. F2's single loop is: e0 forward (v = 0, u: 0 -> 2π), e2 forward (u = 2π), e1 reversed
 * (v = h, u: 2π -> 0), e2 reversed (u = 0). Coedge ids: 0 (F0: e0 rev), 1 (F1: e1 fwd), 2..5 (F2).
 */
function cylinder(opts: CylinderOptions = {}): Brep {
  const r = opts.radius ?? 2, h = opts.height ?? 3;
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v0 = b.addVertex(vec3(r, 0, 0));
  const v1 = b.addVertex(opts.topVertex ?? vec3(r, 0, h));
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  const bottom = opts.bottomCurve ?? unwrap(createCircleCurve(k, vec3(0, 0, 0), z, x, r));
  const top = unwrap(createCircleCurve(k, vec3(0, 0, h), z, x, r));
  const e0 = b.addEdge(v0, v0, bottom);
  const e1 = b.addEdge(v1, v1, top);
  const e2 = b.addEdge(v0, v1, unwrap(createSegmentCurve(vec3(r, 0, 0), vec3(r, 0, h))), 0, 1);
  const p0 = unwrap(createPlaneSurface(k, vec3(0, 0, 0), z, x));
  const p1 = unwrap(createPlaneSurface(k, vec3(0, 0, h), z, x));
  const f0 = b.addFace(shell, p0, true);
  const flatBottom = unwrap(createCircleCurve(k, vec3(0, 0, 0), z, x, r));
  const disc = (edge: CoedgeUse['edge'], reversed: boolean, pc: NurbsCurve): CoedgeUse =>
    opts.noDiscPcurves === true ? { edge, reversed } : { edge, reversed, pcurve: pc };
  b.addLoop(f0, [disc(e0, true, unwrap(planePcurve(k, p0, { curve: flatBottom, t0: 0, t1: TWO_PI }, true)))]);
  const f1 = b.addFace(shell, p1);
  b.addLoop(f1, [disc(e1, false, unwrap(planePcurve(k, p1, { curve: top, t0: 0, t1: TWO_PI }, false)))]);
  const cyl = unwrap(createCylinderSurface(k, vec3(0, 0, 0), z, x, r));
  const f2 = b.addFace(shell, cyl);
  const side: [CoedgeUse['edge'], boolean, NurbsCurve][] = [
    [e0, false, uvLine(0, 0, TWO_PI, 0)],
    [e2, false, uvLine(TWO_PI, 0, TWO_PI, h)],
    [e1, true, uvLine(TWO_PI, h, 0, h)],
    [e2, true, uvLine(0, h, 0, 0)],
  ];
  b.addLoop(f2, side.map(([edge, reversed, pc], i) => {
    const p = opts.sidePcurve === undefined ? pc : opts.sidePcurve(i, pc);
    return p === undefined ? { edge, reversed } : { edge, reversed, pcurve: p };
  }));
  return b.build();
}

test('cylinder fixture: a closed cylinder with a seam edge validates (structure and geometry)', () => {
  const c = cylinder();
  assert.deepEqual(validateBrep(c), { ok: true, value: undefined });
  assert.deepEqual(validateBrepGeometry(k, c), { ok: true, value: undefined });
  assert.deepEqual([c.vertices.length, c.edges.length, c.coedges.length, c.loops.length, c.faces.length], [2, 3, 6, 3, 3]);
  assert.ok(Object.isFrozen(c.coedges[2]!.pcurve));
  assert.ok(Object.isFrozen(c.edges[0]!.curve));
});

test('cylinder_euler_poincare: V=2, E=3 (two circles + seam), F=3, L=3 give V - E + F - (L - F) = 2 (S - G), G = 0', () => {
  const ep = eulerPoincare(cylinder());
  assert.ok(ep.ok, ep.ok ? '' : JSON.stringify(ep.error));
  const { vertices: V, edges: E, faces: F, loops: L, shells: S, genus: G } = ep.value;
  assert.deepEqual([V, E, F, L, S, G], [2, 3, 3, 3, 1, 0]);
  assert.equal(V - E + F - (L - F), 2 * (S - G));
  assert.deepEqual(ep.value.shellGenus, [0]);
});

test('cylinder_loops_close / cylinder_paired: the seam is used twice by one face in opposite directions, with pcurves on u = 0 and u = 2π', () => {
  const c = cylinder();
  const seamUses = c.coedges.map((co, i) => ({ co, i })).filter(({ co }) => co.edge === edgeId(2));
  assert.equal(seamUses.length, 2);
  const [a, b] = seamUses as [typeof seamUses[0], typeof seamUses[0]];
  assert.equal(c.loops[a.co.loop]!.face, c.loops[b.co.loop]!.face);
  assert.notEqual(a.co.reversed, b.co.reversed);
  assert.equal(a.co.partner, b.i);
  assert.equal(b.co.partner, a.i);
  const us = [a, b].map(({ i }) => [0, 0.5, 1].map((s) => unwrap(coedgeUv(k, c, coedgeId(i), s)).x));
  assert.deepEqual(us, [[TWO_PI, TWO_PI, TWO_PI], [0, 0, 0]]);
  // Every loop closes: each coedge ends where the next starts (Lean `cylinder_loops_close`).
  for (let l = 0; l < c.loops.length; l++) {
    const cs = unwrap(loopCoedges(c, loopId(l)));
    for (const [j, co] of cs.entries()) assert.equal(coedgeEnd(c, co), coedgeStart(c, cs[(j + 1) % cs.length]!));
  }
  // Each edge: two coedges, opposite directions (Lean `cylinder_paired`).
  for (let e = 0; e < c.edges.length; e++) {
    const rs = c.coedges.filter((co) => co.edge === e).map((co) => co.reversed);
    assert.equal(rs.length, 2);
    assert.notEqual(rs[0], rs[1]);
  }
});

/** Reverses the orientation of the faces in `set`: flips each face's sense and its coedges, swaps next/prev. */
function reverseFaces(b: Brep, set: ReadonlySet<number>): Brep {
  const inSet = (loop: number): boolean => set.has(b.loops[loop]!.face);
  return {
    ...b,
    faces: b.faces.map((f, i) => (set.has(i) ? { ...f, reversed: !f.reversed } : f)),
    coedges: b.coedges.map((c) => {
      if (!inSet(c.loop)) return c;
      const { pcurve: _drop, ...rest } = c;
      return { ...rest, reversed: !c.reversed, next: c.prev, prev: c.next };
    }),
  };
}

test('flip_preserves_paired / seam_flip_preserves_paired: reversing an edge-closed face set keeps every edge paired; a seam face alone keeps its seam paired', () => {
  const c = cylinder();
  // All faces (closed under edge sharing): still a valid oriented manifold.
  assert.deepEqual(validateBrep(reverseFaces(c, new Set([0, 1, 2]))), { ok: true, value: undefined });
  // Only the cylindrical face: not edge-closed (the circles are shared with the discs), so a circle breaks ...
  const side = reverseFaces(c, new Set([2]));
  expectIssue(validateBrep(side), 'edge-orientation', { kind: 'edge', id: 0 });
  // ... but the seam, both of whose coedges lie on that face, stays paired.
  const seam = side.coedges.filter((co) => co.edge === edgeId(2)).map((co) => co.reversed);
  assert.notEqual(seam[0], seam[1]);
});

test('edgeParam_zero / edgeParam_one / edgeParam_strictMono / edgeParam_mem: s -> t0 + s (t1 - t0)', () => {
  for (const [t0, t1] of [[0, 1], [0, TWO_PI], [-3.5, 7.25], [1e-3, 2e-3]] as const) {
    assert.equal(edgeParam(t0, t1, 0), t0);
    assert.equal(edgeParam(t0, t1, 1), t1);
    let prev = -Infinity;
    for (let i = 0; i <= 64; i++) {
      const t = edgeParam(t0, t1, i / 64);
      assert.ok(t > prev, 'strictly increasing');
      assert.ok(t >= t0 && t <= t1, 'inside [t0, t1]');
      prev = t;
    }
  }
});

test('coedgeParam_start / coedgeParam_end / coedgeParam_reverse: a coedge starts at its start vertex whichever way it runs the edge; partners run it backwards', () => {
  const c = cylinder();
  assert.equal(coedgeFraction(false, 0), 0);
  assert.equal(coedgeFraction(true, 0), 1);
  for (let i = 0; i < c.coedges.length; i++) {
    const ci = coedgeId(i);
    closePt(unwrap(coedgePoint(c, ci, 0)), c.vertices[coedgeStart(c, ci)!]!.point);
    closePt(unwrap(coedgePoint(c, ci, 1)), c.vertices[coedgeEnd(c, ci)!]!.point);
  }
  for (let i = 0; i < c.coedges.length; i++) {
    const p = c.coedges[i]!.partner!;
    for (const s of [0, 0.2, 0.5, 0.9, 1]) closePt(unwrap(coedgePoint(c, p, s)), unwrap(coedgePoint(c, coedgeId(i), 1 - s)), 1e-12);
  }
  closePt(unwrap(edgeCurvePoint(c, edgeId(2), 0.5)), vec3(2, 0, 1.5), 1e-15);
  closePt(unwrap(edgeCurvePoint(c, edgeId(0), 0.25)), vec3(0, 2, 0), 1e-12);
  assert.equal(edgeCurvePoint(c, edgeId(9), 0).ok, false);
  assert.equal(edgeCurvePoint(c, edgeId(0), 1.5).ok, false);
  assert.equal(edgeCurvePoint(c, edgeId(0), Number.NaN).ok, false);
});

test('pcurves lift onto their edges: S(pcurve(s)) is on the edge curve for the cylinder', () => {
  const c = cylinder();
  for (let i = 0; i < c.coedges.length; i++) {
    const surf = unwrap(faceSurface(c, c.loops[c.coedges[i]!.loop]!.face));
    for (const s of [0, 0.3, 0.5, 1]) {
      const uv = unwrap(coedgeUv(k, c, coedgeId(i), s));
      const p = unwrap(surfacePoint3(surf, uv.x, uv.y));
      if (s === 0) closePt(p, c.vertices[coedgeStart(c, coedgeId(i))!]!.point);
      if (s === 1) closePt(p, c.vertices[coedgeEnd(c, coedgeId(i))!]!.point);
      // On the cylinder of radius 2 at height 0 or 3, or on the seam x = 2, y = 0.
      assert.ok(Math.abs(Math.hypot(p.x, p.y) - 2) < 1e-9);
    }
  }
});

test('faceNormalAt: the cylinder points outwards, the reversed bottom disc points down', () => {
  const c = cylinder();
  closePt(unwrap(faceNormalAt(k, c, faceId(2), Math.PI / 2, 1)), vec3(0, 1, 0), 1e-15);
  closePt(unwrap(faceNormalAt(k, c, faceId(0), 0.3, 0.4)), vec3(0, 0, -1), 0);
  closePt(faceNormal(c.faces[1]!)!, vec3(0, 0, 1), 0);
  assert.equal(faceNormal(c.faces[2]!), undefined);
  assert.equal(faceNormalAt(k, c, faceId(7), 0, 0).ok, false);
  const missing = faceSurface(c, faceId(7));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.kind, 'not-found');
});

// --- Corruption: geometric validation names the right issue and entity. ---

test('a pcurve endpoint off the coedge start vertex is rejected (pcurve-endpoint, coedge)', () => {
  // Seam-up coedge (id 3) moved from u = 2π to u = π: it would start at (-2, 0, 0), not at v0.
  const c = cylinder({ sidePcurve: (i, pc) => (i === 1 ? uvLine(Math.PI, 0, Math.PI, 3) : pc) });
  assert.deepEqual(validateBrep(c), { ok: true, value: undefined });
  expectIssue(validateBrepGeometry(k, c), 'pcurve-endpoint', { kind: 'coedge', id: 3 });
});

test('a pcurve whose interior leaves the edge is rejected (pcurve-deviation, coedge)', () => {
  const bent = unwrap(createNurbsCurve(2, [0, 0, 0, 1, 1, 1], [[TWO_PI, 0], [TWO_PI - 0.5, 1.5], [TWO_PI, 3]]));
  const c = cylinder({ sidePcurve: (i, pc) => (i === 1 ? bent : pc) });
  expectIssue(validateBrepGeometry(k, c), 'pcurve-deviation', { kind: 'coedge', id: 3 });
});

test('a pcurve that is not 2D is rejected (pcurve-invalid, coedge)', () => {
  const pc3 = unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[0, 0, 0], [TWO_PI, 0, 0]]));
  const c = cylinder({ sidePcurve: (i, pc) => (i === 0 ? pc3 : pc) });
  expectIssue(validateBrepGeometry(k, c), 'pcurve-invalid', { kind: 'coedge', id: 2 });
});

test('a seam whose two pcurves coincide in (u, v) is rejected (seam-pcurves, edge)', () => {
  // Both seam pcurves on u = 0 (the bottom and top pcurves adjusted to match): a slit, not a seam.
  const c = cylinder({ sidePcurve: (i, pc) => (i === 1 ? uvLine(0, 0, 0, 3) : pc) });
  expectIssue(validateBrepGeometry(k, c), 'seam-pcurves', { kind: 'edge', id: 2 });
});

test('a vertex off its edge curve is rejected (edge-vertex, edge)', () => {
  const c = cylinder({ topVertex: vec3(2, 0, 3.1) });
  assert.deepEqual(validateBrep(c), { ok: true, value: undefined });
  expectIssue(validateBrepGeometry(k, c), 'edge-vertex', { kind: 'edge', id: 1 });
});

test('an edge interval outside its curve range is rejected (edge-range, edge)', () => {
  const c = cylinder();
  const bad: Brep = { ...c, edges: c.edges.map((e, i) => (i === 2 ? { ...e, t1: 2 } : e)) };
  expectIssue(validateBrepGeometry(k, bad), 'edge-range', { kind: 'edge', id: 2 });
  const flat: Brep = { ...c, edges: c.edges.map((e, i) => (i === 2 ? { ...e, t0: 1, t1: 1 } : e)) };
  expectIssue(validateBrepGeometry(k, flat), 'edge-range', { kind: 'edge', id: 2 });
});

test('a closed line edge is structurally degenerate; a collapsed closed circle is geometrically degenerate', () => {
  const c = cylinder();
  const closedLine: Brep = { ...c, edges: c.edges.map((e, i) => (i === 2 ? { ...e, end: e.start } : e)) };
  expectIssue(validateBrep(closedLine), 'degenerate-edge', { kind: 'edge', id: 2 });
  const tiny = cylinder({ radius: 1e-7 });
  assert.deepEqual(validateBrep(tiny), { ok: true, value: undefined });
  expectIssue(validateBrepGeometry(k, tiny), 'degenerate-edge', { kind: 'edge', id: 0 });
});

/** Strip the side face's circle pcurves (the seam keeps its two: a seam needs them). */
const noCirclePcurves = (i: number, pc: NurbsCurve): NurbsCurve | undefined => (i === 1 || i === 3 ? pc : undefined);

test('coedges without pcurves: edges are checked against the surface and (u, v) comes from projection', () => {
  const c = cylinder({ sidePcurve: noCirclePcurves });
  assert.deepEqual(validateBrepGeometry(k, c), { ok: true, value: undefined });
  const uv = unwrap(coedgeUv(k, c, coedgeId(2), 0.25)); // bottom circle forward: angle π/2 at height 0
  assert.ok(Math.abs(uv.x - Math.PI / 2) < 1e-12 && Math.abs(uv.y) < 1e-12);
  // A bottom circle of the wrong radius lies off the cylinder: its vertex check fails first.
  const off = cylinder({ sidePcurve: noCirclePcurves, bottomCurve: unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2.5)) });
  expectIssue(validateBrepGeometry(k, off), 'edge-vertex', { kind: 'edge', id: 0 });
  // A circle through v0 but tilted: its end points agree, its interior leaves both the disc plane and the cylinder.
  const tiltedCircle = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0.2, 1), vec3(1, 0, 0), 2));
  // With the disc's (flat) pcurve, that pcurve no longer lifts onto the edge.
  expectIssue(validateBrepGeometry(k, cylinder({ bottomCurve: tiltedCircle })), 'pcurve-deviation', { kind: 'coedge', id: 0 });
  // Without any pcurve, the edge samples are measured against the disc plane.
  expectIssue(validateBrepGeometry(k, cylinder({ bottomCurve: tiltedCircle, noDiscPcurves: true, sidePcurve: noCirclePcurves })), 'edge-off-surface', { kind: 'coedge', id: 0 });
});

test('box: every coedge has a planar pcurve that agrees with its edge and with projection', () => {
  const b = unwrap(makeBox(k, vec3(1, -2, 0.5), 2, 3, 4));
  assert.deepEqual(validateBrepGeometry(k, b), { ok: true, value: undefined });
  const stripped: Brep = { ...b, coedges: b.coedges.map(({ pcurve: _p, ...rest }) => rest) };
  assert.deepEqual(validateBrepGeometry(k, stripped), { ok: true, value: undefined });
  for (let i = 0; i < b.coedges.length; i++) {
    const co = b.coedges[i]!;
    assert.ok(co.pcurve !== undefined && co.pcurve.dimension === 2 && co.pcurve.degree === 1, `coedge ${i}`);
    const face = b.faces[b.loops[co.loop]!.face]!;
    assert.equal(face.surface.kind, 'plane');
    for (const s of [0, 0.25, 0.5, 1]) {
      const uv = unwrap(coedgeUv(k, b, coedgeId(i), s));
      closePt(unwrap(surfacePoint3(face.surface, uv.x, uv.y)), unwrap(coedgePoint(b, coedgeId(i), s)), 1e-12);
      const projected = unwrap(coedgeUv(k, stripped, coedgeId(i), s));
      assert.ok(Math.abs(projected.x - uv.x) < 1e-12 && Math.abs(projected.y - uv.y) < 1e-12);
    }
    // The pcurve runs in the coedge's direction.
    const pc = co.pcurve;
    const start = unwrap(pcurveUv(pc, 0));
    closePt(unwrap(surfacePoint3(face.surface, start.x, start.y)), b.vertices[coedgeStart(b, coedgeId(i))!]!.point, 1e-12);
  }
  // Corrupt one box pcurve: rejected with that coedge named.
  const pc0 = b.coedges[0]!.pcurve!;
  const shifted = unwrap(createNurbsCurve(1, [0, 0, 1, 1], pc0.controlPoints.map(([u, v]) => [u! + 0.5, v!])));
  const bad: Brep = { ...b, coedges: b.coedges.map((co, i) => (i === 0 ? { ...co, pcurve: shifted } : co)) };
  expectIssue(validateBrepGeometry(k, bad), 'pcurve-endpoint', { kind: 'coedge', id: 0 });
  // Move a vertex: the line edges no longer end at it.
  const moved: Brep = { ...b, vertices: b.vertices.map((v, i) => (i === 7 ? { point: vec3(3, 1, 4.6) } : v)) };
  const mr = validateBrepGeometry(k, moved);
  expectIssue(mr, 'edge-vertex');
});

test('polyhedronMass refuses the cylinder with a clear error naming a non-planar face', () => {
  const m = polyhedronMass(k, cylinder());
  assert.equal(m.ok, false);
  if (!m.ok) {
    assert.equal(m.error.kind, 'invalid-input');
    assert.match(m.error.kind === 'invalid-input' ? m.error.reason : '', /face 2: unsupported cylinder surface/);
  }
  // The box still has its mass properties.
  const box = unwrap(polyhedronMass(k, unwrap(makeBox(k, vec3(0, 0, 0), 2, 3, 4))));
  assert.ok(Math.abs(box.volume - 24) < 1e-12);
});

test('planePcurve rejects curves off the plane and intervals outside the range', () => {
  const plane = unwrap(createPlaneSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0)));
  const up = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(0, 0, 1)));
  assert.equal(planePcurve(k, plane, { curve: up, t0: 0, t1: 1 }, false).ok, false);
  const flat = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(2, 0, 0)));
  assert.equal(planePcurve(k, plane, { curve: flat, t0: 0, t1: 2 }, false).ok, false);
  const half = unwrap(planePcurve(k, plane, { curve: flat, t0: 0.5, t1: 1 }, true));
  assert.deepEqual([unwrap(pcurveUv(half, 0)), unwrap(pcurveUv(half, 1))].map((p) => [p.x, p.y]), [[2, 0], [1, 0]]);
  assert.equal(pcurveUv(half, 2).ok, false);
});

// --- Adversarial review additions: pcurve direction, (u, v) loop continuity, seams without pcurves. ---

test('a pcurve running a closed edge backwards is rejected (pcurve-direction, coedge)', () => {
  // The side face's bottom coedge runs the circle forward (u: 0 -> 2π); a pcurve from 2π to 0 has the right
  // end points (both lift to v0) and lies on the circle, but runs against the coedge.
  const back = cylinder({ sidePcurve: (i, pc) => (i === 0 ? uvLine(TWO_PI, 0, 0, 0) : pc) });
  expectIssue(validateBrepGeometry(k, back), 'pcurve-direction', { kind: 'coedge', id: 2 });
  // The same on a disc: the exact plane pcurve of the circle, built for the wrong direction.
  const b = cylinder();
  const flat = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2));
  const p0 = b.faces[0]!.surface;
  assert.equal(p0.kind, 'plane');
  if (p0.kind !== 'plane') return;
  const wrong = unwrap(planePcurve(k, p0, { curve: flat, t0: 0, t1: TWO_PI }, false));
  const disc: Brep = { ...b, coedges: b.coedges.map((co, i) => (i === 0 ? { ...co, pcurve: wrong } : co)) };
  expectIssue(validateBrepGeometry(k, disc), 'pcurve-direction', { kind: 'coedge', id: 0 });
});

test('a seam without pcurves is rejected (seam-pcurves, edge): its two sides cannot be told apart', () => {
  expectIssue(validateBrepGeometry(k, cylinder({ sidePcurve: () => undefined })), 'seam-pcurves', { kind: 'edge', id: 2 });
  expectIssue(validateBrepGeometry(k, cylinder({ sidePcurve: (i, pc) => (i === 3 ? undefined : pc) })), 'seam-pcurves', { kind: 'edge', id: 2 });
});

test('a pcurve that doubles back along an open edge is rejected (pcurve-direction, coedge)', () => {
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 1, 1, 1));
  const pc0 = box.coedges[0]!.pcurve!;
  const [a, b] = [pc0.controlPoints[0]!, pc0.controlPoints[1]!];
  // a -> b -> a -> b: correct end points, every sample on the edge, but it runs back and forth.
  const zig = unwrap(createNurbsCurve(1, [0, 0, 1 / 3, 2 / 3, 1, 1], [a, b, a, b]));
  const bad: Brep = { ...box, coedges: box.coedges.map((co, i) => (i === 0 ? { ...co, pcurve: zig } : co)) };
  expectIssue(validateBrepGeometry(k, bad), 'pcurve-direction', { kind: 'coedge', id: 0 });
  // A reparameterised but monotone pcurve of the same segment is fine.
  const mid = [(a[0]! + 3 * b[0]!) / 4, (a[1]! + 3 * b[1]!) / 4];
  const slow = unwrap(createNurbsCurve(1, [0, 0, 0.8, 1, 1], [a, mid, b]));
  const ok2: Brep = { ...box, coedges: box.coedges.map((co, i) => (i === 0 ? { ...co, pcurve: slow } : co)) };
  assert.deepEqual(validateBrepGeometry(k, ok2), { ok: true, value: undefined });
});

test('cylinder fixtures at tiny and huge scales validate; Euler–Poincaré is scale-free', () => {
  for (const [r, h] of [[1e-3, 2e-3], [1, 1e-3], [1e6, 3e6], [1e9, 1e9]] as const) {
    const c = cylinder({ radius: r, height: h });
    assert.deepEqual(validateBrepGeometry(k, c), { ok: true, value: undefined }, `r=${r} h=${h}`);
    const ep = unwrap(eulerPoincare(c));
    assert.equal(ep.genus, 0);
  }
});

test('surfaceUv: the one point-to-(u, v) mapping; periodic parameters follow the hint, coedgeUv agrees without one', () => {
  const cyl = unwrap(createCylinderSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2));
  const p = unwrap(surfacePoint3(cyl, 0.25, 1.5));
  const plain = unwrap(surfaceUv(k, cyl, p));
  assert.ok(Math.abs(plain.x - 0.25) < 1e-12 && Math.abs(plain.y - 1.5) < 1e-12);
  // Near u = 2π the same point reads u = 2π + 0.25; v (not periodic on a cylinder) is untouched.
  const near = unwrap(surfaceUv(k, cyl, p, { x: TWO_PI, y: -100 }));
  assert.ok(Math.abs(near.x - (TWO_PI + 0.25)) < 1e-12 && Math.abs(near.y - 1.5) < 1e-12);
  assert.ok(Object.isFrozen(near));
  // The seam vertex (r, 0, 0) is u = 0 or u = 2π depending on the hint.
  assert.equal(unwrap(surfaceUv(k, cyl, vec3(2, 0, 0), { x: 6, y: 0 })).x, TWO_PI);
  assert.equal(unwrap(surfaceUv(k, cyl, vec3(2, 0, 0), { x: 0.1, y: 0 })).x, 0);
  // coedgeUv without a pcurve is surfaceUv of the coedge point.
  const c = cylinder({ sidePcurve: (i, pc) => (i === 0 ? undefined : pc) });
  const viaCoedge = unwrap(coedgeUv(k, c, coedgeId(2), 0.25));
  const viaSurface = unwrap(surfaceUv(k, cyl, unwrap(coedgePoint(c, coedgeId(2), 0.25))));
  assert.deepEqual(viaCoedge, viaSurface);
});
