/**
 * Meshing one B-rep face in its own `(u, v)`.
 *
 * 1. Boundary. Each loop is walked coedge by coedge; a coedge contributes its edge's samples (shared with the
 *    other coedge of the edge, `sampleEdge` in `mesh.ts`) in its own direction, without its last sample (the
 *    next coedge's first). The 3D points are those samples exactly. Their `(u, v)`: on an analytic surface the
 *    closed-form inversion (`surfaceUv` of `topology/geometry.ts`, over M1 `projectPoint`), with periodic parameters (`u` of a cylinder, cone, sphere or
 *    torus, `v` of a torus) moved by whole periods to the coedge's pcurve value at the same fraction (the
 *    "hint"; without a pcurve, the previous sample's `(u, v)`) — this is what puts the two sides of a seam at
 *    `u = 0` and `u = 2π`; at a pole or apex, where `u` is undefined, the hint's `u`. On a NURBS surface the
 *    pcurve value itself (else `projectPoint`). A loop must close in `(u, v)` (a band around a cylinder without
 *    a seam does not, and is reported).
 * 2. Work plane. `(u, v)` is mapped to `w = (s_u u, ±s_v v)`, with `s_u`, `s_v` the surface's speeds (`|S_u|`,
 *    `|S_v|` at the middle of the face's box: `r` for a cylinder's `u`), so that Delaunay triangles in `w` are
 *    well shaped in 3D, and `v` negated on a reversed face, so that every outer loop runs counter-clockwise in
 *    `w` (material on the left) and counter-clockwise triangles in `w` face outwards in 3D.
 * 3. Triangulation. Hole bridging and ear clipping (`triangulate.ts`), then — on curved faces, and on planar
 *    faces when a maximum edge length is given — interior grid points inserted with Lawson flips (exact
 *    incircle); on other planar faces flips only remove zero-area triangles. Boundary edges are constrained, so
 *    every boundary sample segment stays the side of exactly one triangle of the face.
 * 4. Grid. The `(u, v)` box of the boundary is divided by the circle rule of `sample.ts` along each curved
 *    direction (radius `r` for a cylinder's `u`, the larger end radius of a cone, `r` both ways on a sphere,
 *    `R + r` and `r` on a torus; a NURBS surface by its largest principal curvature over a 5×5 sampling and the
 *    longest sampled iso-line), straight directions only by the maximum edge length; on surfaces curved both
 *    ways (sphere, torus, NURBS) with half the chord each way, since a cell's diagonal sags by about the sum of
 *    its sides' sags; at most `MAX_GRID` lines per direction (reported as capped). Grid points strictly inside a triangle are inserted.
 * 5. Sag refinement (curved faces): for at most `MAX_SAG_ROUNDS` rounds, the `(u, v)` centroid of every triangle
 *    whose 3D centroid stands farther than the chord from the surface point there is inserted (at most
 *    `MAX_SAG_POINTS` points, reported as capped). The centroid is a proxy for the facet's largest deviation.
 * 6. Normals: the surface normal at each vertex's `(u, v)` (negated on a reversed face); where the surface has
 *    none (a pole, an apex), the normalised sum of the face's triangle normals at the vertex.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore-tess/src/mesher/mod.rs`
 * (face planning: boundary from shared edge samples, uv of nodes from pcurves, seams), `mesher/uv.rs`,
 * `mesher/seam.rs` (the two sides of a seam a period apart), `mesher/grid.rs`, `mesher/size.rs` (grid spacing
 * from curvature and tolerance), `mesher/cdt.rs`, `mesher/poles.rs` (normals at poles) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, normalize3, sub3, vec2, vec3, type Point2, type Point3, type Vec3 } from '../math/vec.ts';
import { evaluateSurface3, surfaceCurvature, surfaceNormal3, surfacePoint3 } from '../surface/evaluate.ts';
import type { Surface3 } from '../surface/types.ts';
import { loopCoedges, type Brep, type FaceId } from '../topology/brep.ts';
import { coedgeFraction, pcurveUv, surfaceUv } from '../topology/geometry.ts';
import { circleStepCount, type CurveSamples } from './sample.ts';
import type { MeshRules } from './tolerance.ts';
import { Triangulation, triangulatePolygon, type Tri } from './triangulate.ts';

/** Grid lines per direction of a face at most. */
export const MAX_GRID = 256;
/** Rounds of sag refinement of a curved face at most. */
export const MAX_SAG_ROUNDS = 6;
/** Points sag refinement adds to one face at most. */
export const MAX_SAG_POINTS = 50000;

/** The mesh of one face, in local vertex indices. */
export interface FaceMesh {
  readonly positions: readonly Point3[];
  readonly normals: readonly Vec3[];
  readonly uvs: readonly Point2[];
  readonly triangles: readonly Tri[];
  /** Each loop's boundary vertices in loop order (local indices). */
  readonly loops: readonly (readonly number[])[];
  /** A grid bound limited the face. */
  readonly capped: boolean;
}

const OP = 'tess.meshFace';
/** `-v` without negative zeros. */
const negate = (v: Vec3): Vec3 => vec3(0 - v.x, 0 - v.y, 0 - v.z);
const faceError = <T>(face: FaceId, reason: string): Result<T> =>
  err({ kind: 'invalid-topology', operation: OP, reason, entity: { kind: 'face', id: face } });

/**
 * The `(u, v)` of a boundary point (see step 1 of the module comment): on a NURBS surface the pcurve value;
 * otherwise the kernel's one point-to-`(u, v)` mapping, `surfaceUv`, moved to the hint; the hint itself where
 * the inversion fails.
 */
function boundaryUv(kernel: Kernel, s: Surface3, p: Point3, hint: Point2 | undefined, fromPcurve: boolean): Result<Point2> {
  if (s.kind === 'nurbs' && hint !== undefined && fromPcurve) return ok(hint);
  const q = surfaceUv(kernel, s, p, hint);
  if (!q.ok) return hint !== undefined ? ok(hint) : q;
  return q;
}

/** The work-plane scales `(s_u, s_v)` at `(u, v)` (positive and finite; 1 where the speed is not). */
function workScales(s: Surface3, u: number, v: number): readonly [number, number] {
  const pos = (x: number): number => (Number.isFinite(x) && x > 0 ? x : 1);
  switch (s.kind) {
    case 'plane':
      return [1, 1];
    case 'cylinder':
      return [pos(s.radius), 1];
    case 'cone':
      return [pos(Math.abs(s.baseRadius + Math.tan(s.semiAngle) * v)), pos(1 / Math.cos(s.semiAngle))];
    case 'sphere':
      return [pos(s.radius * Math.max(Math.cos(v), 0.05)), pos(s.radius)];
    case 'torus':
      return [pos(s.majorRadius + s.minorRadius * Math.cos(v)), pos(s.minorRadius)];
    case 'nurbs': {
      const d = evaluateSurface3(s, u, v);
      if (!d.ok) return [1, 1];
      return [pos(Math.hypot(d.value.su.x, d.value.su.y, d.value.su.z)), pos(Math.hypot(d.value.sv.x, d.value.sv.y, d.value.sv.z))];
    }
  }
}

interface Grid { readonly nu: number; readonly nv: number; readonly capped: boolean }

function straightCount(length: number, rules: MeshRules): { steps: number; capped: boolean } {
  const n = Math.ceil(length / rules.maxEdgeLength);
  if (!(n <= MAX_GRID)) return { steps: MAX_GRID, capped: true };
  return { steps: Math.max(1, n), capped: false };
}

function curvedCount(radius: number, sweep: number, rules: MeshRules): { steps: number; capped: boolean } {
  const c = circleStepCount(radius, sweep, rules);
  if (c.capped || c.steps > MAX_GRID) return { steps: MAX_GRID, capped: true };
  return { steps: c.steps, capped: false };
}

/** Grid divisions of the box `[u0, u1] × [v0, v1]` (step 4 of the module comment). */
function gridCounts(kernel: Kernel, s: Surface3, u0: number, u1: number, v0: number, v1: number, base: MeshRules): Grid {
  const du = u1 - u0, dv = v1 - v0;
  // Curved both ways, a cell's diagonal sags by about the sum of its sides' sags: half the chord each way.
  const doubly = s.kind === 'sphere' || s.kind === 'torus' || s.kind === 'nurbs';
  const rules: MeshRules = doubly ? { ...base, chord: base.chord / 2 } : base;
  let a: { steps: number; capped: boolean };
  let b: { steps: number; capped: boolean };
  switch (s.kind) {
    case 'plane':
      a = straightCount(du, rules);
      b = straightCount(dv, rules);
      break;
    case 'cylinder':
      a = curvedCount(s.radius, du, rules);
      b = straightCount(dv, rules);
      break;
    case 'cone': {
      const t = Math.tan(s.semiAngle);
      const R = Math.max(Math.abs(s.baseRadius + t * v0), Math.abs(s.baseRadius + t * v1));
      a = R > 0 ? curvedCount(R, du, rules) : { steps: 1, capped: false };
      b = straightCount(dv / Math.cos(s.semiAngle), rules);
      break;
    }
    case 'sphere':
      a = curvedCount(s.radius, du, rules);
      b = curvedCount(s.radius, dv, rules);
      break;
    case 'torus':
      a = curvedCount(s.majorRadius + s.minorRadius, du, rules);
      b = curvedCount(s.minorRadius, dv, rules);
      break;
    case 'nurbs': {
      // Largest principal curvature and longest iso-lines over a 5x5 sampling of the box.
      const N = 5;
      let kmax = 0;
      let lu = 0, lv = 0;
      const pts: (Point3 | undefined)[][] = [];
      for (let i = 0; i < N; i++) {
        const row: (Point3 | undefined)[] = [];
        for (let j = 0; j < N; j++) {
          const u = u0 + (du * i) / (N - 1), v = v0 + (dv * j) / (N - 1);
          const k = surfaceCurvature(kernel, s, u, v);
          if (k.ok) kmax = Math.max(kmax, Math.abs(k.value.principal[0]), Math.abs(k.value.principal[1]));
          const p = surfacePoint3(s, u, v);
          row.push(p.ok ? p.value : undefined);
        }
        pts.push(row);
      }
      const len = (a0: Point3 | undefined, a1: Point3 | undefined): number =>
        a0 === undefined || a1 === undefined ? 0 : Math.hypot(a1.x - a0.x, a1.y - a0.y, a1.z - a0.z);
      for (let j = 0; j < N; j++) {
        let su = 0, sv = 0;
        for (let i = 0; i + 1 < N; i++) {
          su += len(pts[i]![j], pts[i + 1]![j]);
          sv += len(pts[j]![i], pts[j]![i + 1]);
        }
        lu = Math.max(lu, su);
        lv = Math.max(lv, sv);
      }
      if (Number.isFinite(kmax) && kmax > 0) {
        const rho = 1 / kmax;
        // Iso-lines bent like circles of radius rho: their sweep is length / rho.
        a = curvedCount(rho, lu / rho, rules);
        b = curvedCount(rho, lv / rho, rules);
      } else {
        a = straightCount(lu, rules);
        b = straightCount(lv, rules);
      }
      break;
    }
  }
  return { nu: a.steps, nv: b.steps, capped: a.capped || b.capped };
}

/**
 * Meshes face `face` from the shared edge samples (`edgeSamples[e]`, end points equal to the vertex points).
 * Fails with the error of the first edge it needs that could not be sampled, with `invalid-topology` naming the
 * face when a loop cannot be mapped to `(u, v)` or triangulated, and with the evaluator's error where the
 * surface does not evaluate.
 */
export function meshFace(
  kernel: Kernel,
  brep: Brep,
  face: FaceId,
  edgeSamples: readonly Result<CurveSamples>[],
  rules: MeshRules,
): Result<FaceMesh> {
  const f = brep.faces[face];
  if (f === undefined) return err({ kind: 'not-found', operation: OP, entity: { kind: 'face', id: face } });
  const s = f.surface;
  const positions: Point3[] = [];
  const uvs: Point2[] = [];
  const loops: number[][] = [];

  for (const l of f.loops) {
    const cs = loopCoedges(brep, l);
    if (!cs.ok) return cs;
    const ring: number[] = [];
    let prevUv: Point2 | undefined;
    let firstUv: Point2 | undefined;
    let endUv: Point2 | undefined;
    for (const c of cs.value) {
      const co = brep.coedges[c]!;
      const e = brep.edges[co.edge];
      const es = edgeSamples[co.edge];
      if (e === undefined || es === undefined) return faceError(face, `coedge ${c} names a missing edge`);
      if (!es.ok) return es;
      const m = es.value.params.length;
      const span = e.t1 - e.t0;
      for (let step = 0; step < m; step++) {
        const k = co.reversed ? m - 1 - step : step;
        const t = es.value.params[k]!;
        const sEdge = k === 0 ? 0 : k === m - 1 ? 1 : Math.min(1, Math.max(0, (t - e.t0) / span));
        let hint = prevUv;
        if (co.pcurve !== undefined) {
          const h = pcurveUv(co.pcurve, coedgeFraction(co.reversed, sEdge));
          if (!h.ok) return h;
          hint = h.value;
        }
        const uv = boundaryUv(kernel, s, es.value.points[k]!, hint, co.pcurve !== undefined);
        if (!uv.ok) return uv;
        if (step === m - 1) {
          endUv = uv.value; // the next coedge's start: not added
          prevUv = uv.value;
          continue;
        }
        if (firstUv === undefined) firstUv = uv.value;
        prevUv = uv.value;
        ring.push(positions.length);
        positions.push(es.value.points[k]!);
        uvs.push(uv.value);
      }
    }
    if (firstUv === undefined || endUv === undefined) return faceError(face, 'empty loop');
    const gap = Math.max(Math.abs(firstUv.x - endUv.x), Math.abs(firstUv.y - endUv.y));
    if (!(gap <= 1e-6 * Math.max(1, Math.abs(firstUv.x), Math.abs(firstUv.y)) + 1e-9)) {
      return faceError(face, `loop ${l} does not close in (u, v) (gap ${gap})`);
    }
    loops.push(ring);
  }
  if (loops.length === 0) return faceError(face, 'face has no loop');

  // Work plane.
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of uvs) {
    u0 = Math.min(u0, p.x);
    u1 = Math.max(u1, p.x);
    v0 = Math.min(v0, p.y);
    v1 = Math.max(v1, p.y);
  }
  const [su, sv0] = workScales(s, (u0 + u1) / 2, (v0 + v1) / 2);
  const sv = f.reversed ? -sv0 : sv0;
  const toWork = (p: Point2): Point2 => vec2(su * p.x, sv * p.y);
  const work = uvs.map(toWork);
  if (!work.every((w) => Number.isFinite(w.x) && Number.isFinite(w.y))) return faceError(face, 'boundary (u, v) is not finite');

  const tris = triangulatePolygon(work, loops);
  if (!tris.ok) {
    const e = tris.error;
    return faceError(face, e.kind === 'invalid-topology' || e.kind === 'invalid-input' ? e.reason : e.kind);
  }
  const constrained: [number, number][] = [];
  for (const r of loops) for (let i = 0; i < r.length; i++) constrained.push([r[i]!, r[(i + 1) % r.length]!]);
  const curved = s.kind !== 'plane';
  const refine = curved || Number.isFinite(rules.maxEdgeLength);
  const created = Triangulation.create(work, tris.value, constrained, refine);
  if (!created.ok) return faceError(face, created.error.kind === 'invalid-input' ? created.error.reason : created.error.kind);
  const tri = created.value;
  tri.legalizeAll();

  let capped = false;
  if (refine) {
    const g = gridCounts(kernel, s, u0, u1, v0, v1, rules);
    capped = g.capped;
    for (let j = 1; j < g.nv; j++) {
      for (let i = 1; i < g.nu; i++) {
        const uv = vec2(u0 + ((u1 - u0) * i) / g.nu, v0 + ((v1 - v0) * j) / g.nv);
        const p = surfacePoint3(s, uv.x, uv.y);
        if (!p.ok) continue;
        const w = toWork(uv);
        if (tri.insertPoint(w) >= 0) {
          positions.push(p.value);
          uvs.push(uv);
        }
      }
    }
  }

  // Sag refinement (curved faces): insert the (u, v) centroid of every triangle whose centroid stands more than
  // the chord off the surface, for a few rounds.
  if (curved) {
    let added = 0;
    for (let round = 0; round < MAX_SAG_ROUNDS && !capped; round++) {
      const cand: { uv: Point2; p: Point3 }[] = [];
      for (const [a, b, c] of tri.tris) {
        const ua = uvs[a]!, ub = uvs[b]!, uc = uvs[c]!;
        const uv = vec2((ua.x + ub.x + uc.x) / 3, (ua.y + ub.y + uc.y) / 3);
        const p = surfacePoint3(s, uv.x, uv.y);
        if (!p.ok) continue;
        const pa = positions[a]!, pb = positions[b]!, pc = positions[c]!;
        const g = vec3((pa.x + pb.x + pc.x) / 3, (pa.y + pb.y + pc.y) / 3, (pa.z + pb.z + pc.z) / 3);
        if (Math.hypot(p.value.x - g.x, p.value.y - g.y, p.value.z - g.z) > rules.chord) cand.push({ uv, p: p.value });
      }
      if (cand.length === 0) break;
      let inserted = 0;
      for (const { uv, p } of cand) {
        if (added >= MAX_SAG_POINTS) {
          capped = true;
          break;
        }
        if (tri.insertPoint(toWork(uv)) >= 0) {
          positions.push(p);
          uvs.push(uv);
          added++;
          inserted++;
        }
      }
      if (inserted === 0) break;
    }
  }

  // Normals.
  const normals: (Vec3 | undefined)[] = [];
  const planeNormal = s.kind === 'plane' ? (f.reversed ? negate(s.frame.normal) : s.frame.normal) : undefined;
  for (const p of uvs) {
    if (planeNormal !== undefined) {
      normals.push(planeNormal);
      continue;
    }
    const n = surfaceNormal3(kernel, s, p.x, p.y);
    normals.push(n.ok ? (f.reversed ? negate(n.value) : n.value) : undefined);
  }
  if (normals.some((n) => n === undefined)) {
    const sum: Vec3[] = positions.map(() => vec3(0, 0, 0));
    for (const [a, b, c] of tri.tris) {
      const pa = positions[a]!, pb = positions[b]!, pc = positions[c]!;
      const n = cross3(sub3(pb, pa), sub3(pc, pa));
      for (const v of [a, b, c]) sum[v] = add3(sum[v]!, n);
    }
    for (let i = 0; i < normals.length; i++) {
      if (normals[i] === undefined) normals[i] = normalize3(sum[i]!) ?? planeNormal ?? vec3(0, 0, 0);
    }
  }

  return ok(
    Object.freeze({
      positions: Object.freeze(positions),
      normals: Object.freeze(normals.map((n) => n!)),
      uvs: Object.freeze(uvs),
      triangles: Object.freeze(tri.tris.map((t) => Object.freeze([t[0], t[1], t[2]] as const))),
      loops: Object.freeze(loops.map((r) => Object.freeze(r))),
      capped,
    }),
  );
}
