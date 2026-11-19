/**
 * Clean-up of a valid B-rep: merging adjacent faces that lie on one surface (`mergeCosurfaceFaces`,
 * `mergeCoplanarFaces`) and removing vertices between two edges of one line or circle (`removeRedundantVertices`).
 * The boolean uses these to clean results such as box ∪ box sharing a face.
 *
 * **Same surface** (`surfacesCoincide`). Two planes coincide when their normals are parallel within `angTolDeg`
 * and the second origin is within `zoneTol3d` of the first plane (`same` or `opposite` natural normals). Other
 * surfaces coincide only with the **same parametrisation** (`same`): equal kind, origins / centres within
 * `zoneTol3d`, frames within `angTolDeg`, radii within `zoneTol3d`, semi-angles within `1e-12`; NURBS surfaces
 * must be identical data. Then the pcurves of both faces are pcurves of the merged face as they are; on planes
 * the pcurves are recomputed on the kept plane (`planePcurve`, exact).
 *
 * **Merging faces.** An edge whose two coedges lie on two different faces with coinciding surfaces and the
 * same outward side joins them; the joined classes are formed by `mergeLabels` over face indices (the kept face
 * is the class's smallest index, Lean `runMerges_rep_min`). For each class, every edge between two of its
 * different faces is removed (a seam inside one face is kept), and the loops are re-traced: after a kept coedge
 * `c`, the next kept coedge is `next(c)`, or, while that one's edge is removed, `next(partner(·))` (turning
 * around the vertex inside the merged face). The class is merged only when
 * - the re-traced successor is a permutation of the kept coedges (no pinched vertex),
 * - each new loop closes in the kept surface's `(u, v)` (on a non-plane: every coedge has a pcurve and consecutive
 *   pcurves meet, or their gap collapses onto the shared vertex — `uvGapCollapses`; a loop that wraps around a
 *   periodic direction without a seam does not close and is refused),
 * - exactly one loop is an outer loop (positive `(u, v)` area for a forward face, negative for a reversed one),
 * - and the counts keep Euler–Poincaré: with `k` faces merged, `r` edges removed, `w` vertices left without an
 *   edge, `L` loops before and `L'` after, `L' = L + r - w + 2 - 2k` (Lean `mergeGroup_euler_iff`; two faces across
 *   one edge: `E - 1`, `F - 1`, `L - 1`, Lean `mergeAcrossEdge_euler`).
 * A class failing a condition is left unmerged (that is not an error: the body stays valid). The input must
 * pass `validateBrepGeometry` (its error is returned as is), so an unchanged result is valid; a changed result
 * is checked by `validateBrepGeometry` again and its error returned as is.
 *
 * **Redundant vertices.** A vertex with exactly two incident edges, both open, both lines through it with the
 * three points collinear (the vertex within `zoneTol3d` of the chord and between its ends), or both arcs of one
 * circle (centres and radii within `zoneTol3d`, normals within `angTolDeg`) meeting there, is removed: the two
 * edges become one (`V - 1`, `E - 1`, each of the two loops through it one coedge shorter; Lean
 * `removeVertex_euler`). The merged coedge's pcurve is recomputed on a plane, joined when both pcurves are
 * straight `(u, v)` segments on one line, or absent when both were; otherwise the vertex is kept.
 *
 * Upstream consulted (for the operations and their conditions, not translated): `solidcore/crates/solidcore/src/heal/face_props.rs`,
 * `heal/heal_data.rs`, `heal/stitch.rs`, `topology/face.rs`, `topology/edge.rs` (merging faces of one surface,
 * removing edges between them, removing vertices of degree two), `docs/booleans.md` (clean-up of coplanar faces
 * after a boolean) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, distanceToSegment3, dot3, length3, ringArea2, sub3, type Point2, type Point3, type Vec3 } from '../math/vec.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { createSegmentCurve, ROUNDING_SLACK, TWO_PI, type Curve3 } from '../curve/types.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { localCoordinates, type Surface3 } from '../surface/types.ts';
import type { Brep } from '../topology/brep.ts';
import { pcurveUv, planePcurve, uvGapCollapses, uvSegment, validateBrepGeometry } from '../topology/geometry.ts';
import { buildPlan, planOfBrep, type Plan, type PlanCoedge, type PlanEdge, type PlanFace } from './plan.ts';
import { mergeLabels } from './union-find.ts';

/** Samples per coedge for the `(u, v)` area of a re-traced loop. */
const AREA_SAMPLES = 8;

const cosTol = (kernel: Kernel): number => Math.cos((kernel.tolerances.angTolDeg * Math.PI) / 180);

const sameDirection = (kernel: Kernel, a: Vec3, b: Vec3): boolean => dot3(a, b) >= cosTol(kernel) * length3(a) * length3(b);

/**
 * Whether two surfaces are one: `'same'` (same natural normal; for non-planes, the same parametrisation),
 * `'opposite'` (planes only: the same plane with opposite normals), or `undefined` (see the module comment).
 */
export function surfacesCoincide(kernel: Kernel, a: Surface3, b: Surface3): 'same' | 'opposite' | undefined {
  const tol = kernel.tolerances.zoneTol3d;
  if (a.kind === 'plane' && b.kind === 'plane') {
    const na = a.frame.normal, nb = b.frame.normal;
    const d = dot3(na, nb);
    if (Math.abs(d) < cosTol(kernel)) return undefined;
    if (Math.abs(dot3(sub3(b.origin, a.origin), na)) > tol) return undefined;
    return d > 0 ? 'same' : 'opposite';
  }
  if (a.kind === 'nurbs' || b.kind === 'nurbs') {
    return a.kind === 'nurbs' && b.kind === 'nurbs' && (a.surface === b.surface || JSON.stringify(a.surface) === JSON.stringify(b.surface)) ? 'same' : undefined;
  }
  if (a.kind !== b.kind || a.kind === 'plane' || b.kind === 'plane') return undefined;
  const framesAgree = sameDirection(kernel, a.frame.normal, b.frame.normal) && sameDirection(kernel, a.frame.xAxis, b.frame.xAxis);
  if (!framesAgree) return undefined;
  const near = (x: number, y: number): boolean => Math.abs(x - y) <= tol;
  switch (a.kind) {
    case 'cylinder':
      return b.kind === 'cylinder' && distance3(a.origin, b.origin) <= tol && near(a.radius, b.radius) ? 'same' : undefined;
    case 'cone':
      return b.kind === 'cone' && distance3(a.origin, b.origin) <= tol && near(a.baseRadius, b.baseRadius) && Math.abs(a.semiAngle - b.semiAngle) <= ROUNDING_SLACK
        ? 'same'
        : undefined;
    case 'sphere':
      return b.kind === 'sphere' && distance3(a.center, b.center) <= tol && near(a.radius, b.radius) ? 'same' : undefined;
    case 'torus':
      return b.kind === 'torus' && distance3(a.center, b.center) <= tol && near(a.majorRadius, b.majorRadius) && near(a.minorRadius, b.minorRadius)
        ? 'same'
        : undefined;
  }
}

/** Whether the outward sides of two faces on coinciding surfaces agree. */
function sameSide(kernel: Kernel, a: PlanFace, b: PlanFace): boolean {
  const rel = surfacesCoincide(kernel, a.surface, b.surface);
  if (rel === undefined) return false;
  return (rel === 'same') === (a.reversed === b.reversed);
}

/** Point at fraction `s` of a plan coedge, in its direction. */
function coedgeAt(plan: Plan, c: PlanCoedge, s: number): Result<Point3> {
  const e = plan.edges[c.edge]!;
  const f = c.reversed ? 1 - s : s;
  return curvePoint3(e.curve, f === 1 ? e.t1 : f === 0 ? e.t0 : e.t0 + f * (e.t1 - e.t0));
}

const endVertex = (plan: Plan, c: PlanCoedge): number => (c.reversed ? plan.edges[c.edge]!.start : plan.edges[c.edge]!.end);


/**
 * Twice the signed `(u, v)` area of a loop on `face` (the kept face's surface), or `undefined` when the loop does
 * not close in `(u, v)` (see the module comment).
 */
function loopUvArea(kernel: Kernel, plan: Plan, face: PlanFace, loop: readonly PlanCoedge[]): Result<number | undefined> {
  const s = face.surface;
  const ring: Point2[] = [];
  if (s.kind === 'plane') {
    for (const c of loop) {
      for (let i = 0; i < AREA_SAMPLES; i++) {
        const p = coedgeAt(plan, c, i / AREA_SAMPLES);
        if (!p.ok) return p;
        const [u, v] = localCoordinates(s.frame, s.origin, p.value);
        ring.push({ x: u, y: v });
      }
    }
    return ok(ringArea2(ring));
  }
  for (const [i, c] of loop.entries()) {
    if (c.pcurve === undefined) return ok(undefined);
    for (let k = 0; k < AREA_SAMPLES; k++) {
      const p = pcurveUv(c.pcurve, k / AREA_SAMPLES);
      if (!p.ok) return p;
      ring.push(p.value);
    }
    const next = loop[(i + 1) % loop.length]!;
    if (next.pcurve === undefined) return ok(undefined);
    const end = pcurveUv(c.pcurve, 1), start = pcurveUv(next.pcurve, 0);
    if (!end.ok) return end;
    if (!start.ok) return start;
    if (!uvGapCollapses(kernel, s, end.value, start.value, plan.vertices[endVertex(plan, c)]!)) return ok(undefined);
  }
  return ok(ringArea2(ring));
}

export interface MergeOptions {
  /** Also run `removeRedundantVertices` on the result (default `true`). */
  readonly removeVertices?: boolean;
}

/** Merges adjacent faces on one plane (see the module comment). */
export function mergeCoplanarFaces(kernel: Kernel, brep: Brep, options: MergeOptions = {}): Result<Brep> {
  return mergeFaces(kernel, brep, options, true);
}

/** Merges adjacent faces on one surface of any kind (see the module comment). */
export function mergeCosurfaceFaces(kernel: Kernel, brep: Brep, options: MergeOptions = {}): Result<Brep> {
  return mergeFaces(kernel, brep, options, false);
}

/** `L' = L + r - w + 2 - 2k` (Lean `mergeGroup_euler_iff`): the loop count that keeps Euler–Poincaré. */
export function mergedLoopCount(loopsBefore: number, removedEdges: number, removedVertices: number, mergedFaces: number): number {
  return loopsBefore + removedEdges - removedVertices + 2 - 2 * mergedFaces;
}

function mergeFaces(kernel: Kernel, brep: Brep, options: MergeOptions, planesOnly: boolean): Result<Brep> {
  // The input must be a valid body (structure and geometry): an unchanged result is then valid too.
  const valid = validateBrepGeometry(kernel, brep);
  if (!valid.ok) return valid;
  const planR = planOfBrep(brep);
  if (!planR.ok) return planR;
  const plan = planR.value;

  // Coedges as (face, loop, position); partner by edge.
  type Ref = { readonly face: number; readonly loop: number; readonly pos: number };
  const refs: Ref[] = [];
  const idOf = new Map<string, number>();
  const usesOf: number[][] = plan.edges.map(() => []);
  plan.faces.forEach((f, fi) =>
    f.loops.forEach((l, li) =>
      l.forEach((c, pos) => {
        idOf.set(`${fi},${li},${pos}`, refs.length);
        usesOf[c.edge]!.push(refs.length);
        refs.push({ face: fi, loop: li, pos });
      }),
    ),
  );
  const coedge = (k: number): PlanCoedge => {
    const r = refs[k]!;
    return plan.faces[r.face]!.loops[r.loop]![r.pos]!;
  };
  const nextOf = (k: number): number => {
    const r = refs[k]!;
    const n = plan.faces[r.face]!.loops[r.loop]!.length;
    return idOf.get(`${r.face},${r.loop},${(r.pos + 1) % n}`)!;
  };
  const partnerOf = (k: number): number => {
    const us = usesOf[coedge(k).edge]!;
    return us[0] === k ? us[1]! : us[0]!;
  };

  const pairs: [number, number][] = [];
  for (const us of usesOf) {
    const fa = refs[us[0]!]!.face, fb = refs[us[1]!]!.face;
    if (fa === fb) continue;
    const a = plan.faces[fa]!, b = plan.faces[fb]!;
    if (planesOnly && (a.surface.kind !== 'plane' || b.surface.kind !== 'plane')) continue;
    if (sameSide(kernel, a, b)) pairs.push([fa, fb]);
  }
  const label = mergeLabels(plan.faces.length, pairs);
  const groups = new Map<number, number[]>();
  label.forEach((rep, f) => {
    const g = groups.get(rep);
    if (g === undefined) groups.set(rep, [f]);
    else g.push(f);
  });

  const faces: (PlanFace | undefined)[] = [...plan.faces];
  let mergedAny = false;
  const vertexEdges: number[][] = plan.vertices.map(() => []);
  plan.edges.forEach((e, i) => {
    vertexEdges[e.start]!.push(i);
    if (e.end !== e.start) vertexEdges[e.end]!.push(i);
  });
  for (const [rep, members] of groups) {
    if (members.length < 2) continue;
    const inGroup = new Set(members);
    const removed = new Set<number>();
    plan.edges.forEach((_, e) => {
      const [x, y] = usesOf[e] as [number, number];
      const fx = refs[x]!.face, fy = refs[y]!.face;
      if (fx !== fy && inGroup.has(fx) && inGroup.has(fy)) removed.add(e);
    });
    const kept: number[] = [];
    refs.forEach((r, k) => {
      if (inGroup.has(r.face) && !removed.has(coedge(k).edge)) kept.push(k);
    });
    // Successor after removing the edges.
    const succ = new Map<number, number>();
    let pinched = false;
    for (const k of kept) {
      let n = nextOf(k);
      let guard = 0;
      while (removed.has(coedge(n).edge)) {
        n = nextOf(partnerOf(n));
        if (++guard > refs.length) break;
      }
      if (guard > refs.length) {
        pinched = true;
        break;
      }
      succ.set(k, n);
    }
    if (pinched || kept.length === 0 || new Set(succ.values()).size !== kept.length) continue;
    const seen = new Set<number>();
    const loops: PlanCoedge[][] = [];
    for (const k of kept) {
      if (seen.has(k)) continue;
      const loop: PlanCoedge[] = [];
      for (let c = k; !seen.has(c); c = succ.get(c)!) {
        seen.add(c);
        loop.push(coedge(c));
      }
      loops.push(loop);
    }
    const keptFace = plan.faces[rep]!;
    // Pcurves on the kept plane.
    let failed = false;
    const surfaced: PlanCoedge[][] = [];
    for (const loop of loops) {
      const out: PlanCoedge[] = [];
      for (const c of loop) {
        if (keptFace.surface.kind !== 'plane') {
          out.push(c);
          continue;
        }
        const pc = planePcurve(kernel, keptFace.surface, plan.edges[c.edge]!, c.reversed);
        if (!pc.ok) {
          failed = true;
          break;
        }
        out.push({ edge: c.edge, reversed: c.reversed, pcurve: pc.value });
      }
      surfaced.push(out);
    }
    if (failed) continue;
    const sign = keptFace.reversed ? -1 : 1;
    const outer: PlanCoedge[][] = [];
    const holes: PlanCoedge[][] = [];
    for (const loop of surfaced) {
      const a = loopUvArea(kernel, plan, keptFace, loop);
      if (!a.ok) return a;
      if (a.value === undefined || a.value === 0) {
        failed = true;
        break;
      }
      (sign * a.value > 0 ? outer : holes).push(loop);
    }
    if (failed || outer.length !== 1) continue;
    const loopsBefore = members.reduce((n, f) => n + plan.faces[f]!.loops.length, 0);
    let isolated = 0;
    for (const es of vertexEdges) if (es.length > 0 && es.every((e) => removed.has(e))) isolated++;
    if (surfaced.length !== mergedLoopCount(loopsBefore, removed.size, isolated, members.length)) continue;
    mergedAny = true;
    for (const f of members) faces[f] = undefined;
    faces[rep] = { surface: keptFace.surface, reversed: keptFace.reversed, loops: [...outer, ...holes] };
  }

  if (!mergedAny) return options.removeVertices === false ? ok(brep) : removeRedundantVertices(kernel, brep);
  // Re-index the faces that remain.
  const newIndex: number[] = [];
  const kept: PlanFace[] = [];
  faces.forEach((f, i) => {
    if (f === undefined) return;
    newIndex[i] = kept.length;
    kept.push(f);
  });
  const merged: Plan = {
    vertices: plan.vertices,
    edges: plan.edges,
    faces: kept,
    bodies: plan.bodies.map((body) => body.map((shell) => shell.filter((f) => faces[f] !== undefined).map((f) => newIndex[f]!))),
  };
  const out = buildPlan(merged);
  const check = validateBrepGeometry(kernel, out);
  if (!check.ok) return check;
  return options.removeVertices === false ? ok(out) : removeRedundantVertices(kernel, out);
}

/** The edge joining the far ends `a` (via `e1`) and `b` (via `e2`) of two edges meeting at `v`, if they are one line or circle. */
function joinedEdge(kernel: Kernel, points: readonly Point3[], v: number, e1: PlanEdge, e2: PlanEdge): Result<PlanEdge | undefined> {
  const tol = kernel.tolerances.zoneTol3d;
  const a = e1.start === v ? e1.end : e1.start;
  const b = e2.start === v ? e2.end : e2.start;
  const pa = points[a]!, pb = points[b]!, pv = points[v]!;
  const c1 = e1.curve, c2 = e2.curve;
  if (c1.kind === 'line' && c2.kind === 'line') {
    if (a === b) return ok(undefined);
    if (distanceToSegment3(pv, pa, pb) > tol || dot3(sub3(pv, pa), sub3(pb, pv)) <= 0) return ok(undefined);
    const line = createSegmentCurve(pa, pb);
    if (!line.ok) return ok(undefined);
    return ok({ start: a, end: b, curve: line.value, t0: 0, t1: 1 });
  }
  if (c1.kind === 'circle' && c2.kind === 'circle') {
    if (distance3(c1.center, c2.center) > tol || Math.abs(c1.radius - c2.radius) > tol) return ok(undefined);
    const dot = dot3(c1.frame.normal, c2.frame.normal);
    if (Math.abs(dot) < cosTol(kernel)) return ok(undefined);
    const span1 = e1.t1 - e1.t0, span2 = e2.t1 - e2.t0;
    if (span1 + span2 > TWO_PI * (1 + ROUNDING_SLACK)) return ok(undefined);
    // Extend e1's circle past v by e2's angular span.
    const range: readonly [number, number] = e1.end === v ? [e1.t0, e1.t1 + span2] : [e1.t0 - span2, e1.t1];
    const start = e1.end === v ? e1.start : b;
    const end = e1.end === v ? b : e1.end;
    if (start === end && span1 + span2 < TWO_PI * (1 - ROUNDING_SLACK)) return ok(undefined);
    const curve: Curve3 = Object.freeze({ ...c1, range: Object.freeze(range) });
    // e2's middle must lie on the added arc.
    const mid2 = curvePoint3(c2, (e2.t0 + e2.t1) / 2);
    if (!mid2.ok) return mid2;
    const midNew = curvePoint3(curve, e1.end === v ? e1.t1 + span2 / 2 : e1.t0 - span2 / 2);
    if (!midNew.ok) return midNew;
    if (distance3(mid2.value, midNew.value) > tol) return ok(undefined);
    return ok({ start, end, curve, t0: range[0], t1: range[1] });
  }
  return ok(undefined);
}

/** The pcurve of the joined coedge (see the module comment), `null` for none, `undefined` when it cannot be made. */
function joinedPcurve(kernel: Kernel, face: PlanFace, edge: PlanEdge, reversed: boolean, first: PlanCoedge, second: PlanCoedge): NurbsCurve | null | undefined {
  if (face.surface.kind === 'plane') {
    const pc = planePcurve(kernel, face.surface, edge, reversed);
    return pc.ok ? pc.value : undefined;
  }
  if (first.pcurve === undefined && second.pcurve === undefined) return null;
  if (first.pcurve === undefined || second.pcurve === undefined) return undefined;
  const straight = (c: NurbsCurve): boolean => c.degree === 1 && c.controlPoints.length === 2;
  if (!straight(first.pcurve) || !straight(second.pcurve)) return undefined;
  const p0 = first.pcurve.controlPoints[0]!, p1 = first.pcurve.controlPoints[1]!, q0 = second.pcurve.controlPoints[0]!, q1 = second.pcurve.controlPoints[1]!;
  const scale = Math.max(1, ...[p0, p1, q1].flat().map(Math.abs));
  const eps = 1e-12 * scale;
  if (Math.abs(p1[0]! - q0[0]!) > eps || Math.abs(p1[1]! - q0[1]!) > eps) return undefined;
  const d1 = [p1[0]! - p0[0]!, p1[1]! - p0[1]!], d2 = [q1[0]! - q0[0]!, q1[1]! - q0[1]!];
  if (Math.abs(d1[0]! * d2[1]! - d1[1]! * d2[0]!) > eps * scale || d1[0]! * d2[0]! + d1[1]! * d2[1]! <= 0) return undefined;
  const seg = uvSegment(p0[0]!, p0[1]!, q1[0]!, q1[1]!);
  return seg.ok ? seg.value : undefined;
}

/** Removes vertices between two edges of one line or circle (see the module comment). */
export function removeRedundantVertices(kernel: Kernel, brep: Brep): Result<Brep> {
  // The input must be a valid body (structure and geometry): an unchanged result is then valid too.
  const valid = validateBrepGeometry(kernel, brep);
  if (!valid.ok) return valid;
  const planR = planOfBrep(brep);
  if (!planR.ok) return planR;
  const vertices = planR.value.vertices;
  const edges: (PlanEdge | undefined)[] = [...planR.value.edges];
  const faces: PlanFace[] = [...planR.value.faces];
  let changed = false;
  for (let v = 0; v < vertices.length; v++) {
    const incident: number[] = [];
    let closed = false;
    edges.forEach((e, i) => {
      if (e === undefined || (e.start !== v && e.end !== v)) return;
      if (e.start === e.end) closed = true;
      incident.push(i);
    });
    if (closed || incident.length !== 2) continue;
    const [i1, i2] = incident as [number, number];
    const joined = joinedEdge(kernel, vertices, v, edges[i1]!, edges[i2]!);
    if (!joined.ok) return joined;
    const edge = joined.value;
    if (edge === undefined) continue;
    // Replace the consecutive coedges of i1 and i2 (either order) in every loop.
    const newFaces = [...faces];
    let usable = true;
    let replaced = 0;
    for (const [fi, face] of faces.entries()) {
      if (!face.loops.some((l) => l.some((c) => c.edge === i1 || c.edge === i2))) continue;
      const loops: PlanCoedge[][] = [];
      for (const loop of face.loops) {
        const n = loop.length;
        const idx = loop.findIndex((c, k) => {
          const d = loop[(k + 1) % n]!;
          return n >= 2 && ((c.edge === i1 && d.edge === i2) || (c.edge === i2 && d.edge === i1));
        });
        if (idx < 0) {
          if (loop.some((c) => c.edge === i1 || c.edge === i2)) usable = false;
          loops.push([...loop]);
          continue;
        }
        const rotated = [...loop.slice(idx), ...loop.slice(0, idx)];
        const [first, second] = rotated as [PlanCoedge, PlanCoedge];
        const rest = rotated.slice(2);
        if (rest.some((c) => c.edge === i1 || c.edge === i2)) usable = false;
        const e1Use = first.edge === i1 ? first : second;
        const fromVertex = first.reversed ? edges[first.edge]!.end : edges[first.edge]!.start;
        const reversed = edge.start !== edge.end ? fromVertex !== edge.start : e1Use.reversed;
        const pc = joinedPcurve(kernel, face, edge, reversed, first, second);
        if (pc === undefined) usable = false;
        const c: PlanCoedge = pc === null || pc === undefined ? { edge: i1, reversed } : { edge: i1, reversed, pcurve: pc };
        loops.push([c, ...rest]);
        replaced++;
      }
      if (!usable) break;
      newFaces[fi] = { surface: face.surface, reversed: face.reversed, loops };
    }
    if (!usable || replaced !== 2) continue;
    faces.splice(0, faces.length, ...newFaces);
    edges[i1] = edge;
    edges[i2] = undefined;
    changed = true;
  }
  if (!changed) return ok(brep);
  // Drop the removed edges: renumber.
  const index: number[] = [];
  const live: PlanEdge[] = [];
  edges.forEach((e, i) => {
    if (e === undefined) return;
    index[i] = live.length;
    live.push(e);
  });
  const out = buildPlan({
    vertices,
    edges: live,
    faces: faces.map((f) => ({ surface: f.surface, reversed: f.reversed, loops: f.loops.map((l) => l.map((c) => ({ ...c, edge: index[c.edge]! }))) })),
    bodies: planR.value.bodies,
  });
  const check = validateBrepGeometry(kernel, out);
  return check.ok ? ok(out) : check;
}
