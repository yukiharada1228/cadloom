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
 *    a seam does not, and is reported), and consecutive coedges must meet there, except at a **pole**: where a
 *    coedge ends at `(u, v)` and the next starts elsewhere and the straight segment between them collapses onto
 *    their vertex (`uvGapCollapses` of `topology/geometry.ts`: the line `v = ±π/2` of a sphere, the apex line
 *    of a cone), the vertex enters the ring twice, once at each end of the segment ("pole copies").
 * 2. Work plane. `(u, v)` is mapped to `w = (s_u u, ±s_v v)`, with `s_u`, `s_v` the surface's speeds (`|S_u|`,
 *    `|S_v|` at the middle of the face's box: `r` for a cylinder's `u`; a torus's `u` speed averaged over the box's
 *    `v` span; and `s_u` rescaled where the step-4 grid cells would be more than `MAX_CELL_ASPECT` times wider
 *    than tall or the reverse, or the grid is capped, so that its cells are square in `w`), so that Delaunay triangles in `w` are
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
 *    its sides' sags; at most `MAX_GRID²` cells, and `MAX_GRID` lines per direction unless the other direction
 *    needs fewer (reported as capped; the work plane's `u` scale is then set so that the capped cells are square
 *    in `w`). Grid points strictly inside a triangle are inserted.
 * 5. Sag refinement (curved faces): for at most `MAX_SAG_ROUNDS` rounds, the `(u, v)` centroid of every triangle
 *    whose 3D centroid stands farther than the chord from the surface point there is inserted (at most
 *    `MAX_SAG_POINTS` points, reported as capped). The centroid is a proxy for the facet's largest deviation.
 *    Triangles at a pole copy are skipped: the copy's `u` is arbitrary, so their `(u, v)` centroid is not over
 *    the facet (inserting it would fold the fan).
 * 6. Poles: each pair of pole copies is merged into one vertex. The single triangle on the pole segment (it has
 *    both copies) becomes degenerate and is dropped; every other triangle at a copy keeps its other two vertices,
 *    so the triangles around the pole form one fan, with no zero-area triangle, and the ring lists the pole once.
 * 7. Normals: the surface normal at each vertex's `(u, v)` (negated on a reversed face); at a pole the limit of the
 *    surface normal (`poleNormal`: the axis `±Z` on a sphere, the axis out of the tip on a cone — the mean of
 *    the generators' normals); where the surface has none otherwise (a collapsed NURBS boundary), the
 *    normalised sum of the face's triangle normals at the vertex.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore-tess/src/mesher/mod.rs`
 * (face planning: boundary from shared edge samples, uv of nodes from pcurves, seams), `mesher/uv.rs`,
 * `mesher/seam.rs` (the two sides of a seam a period apart), `mesher/grid.rs`, `mesher/size.rs` (grid spacing
 * from curvature and tolerance), `mesher/cdt.rs`, `mesher/poles.rs` (normals at poles, fans), `solidcore/src/eval/pole.rs`
 * (the normal at a pole as a limit along the parameter lines) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, normalize3, sub3, vec2, vec3, type Point2, type Point3, type Vec3 } from '../math/vec.ts';
import { evaluateSurface3, surfaceCurvature, surfaceNormal3, surfacePoint3 } from '../surface/evaluate.ts';
import type { Surface3 } from '../surface/types.ts';
import { loopCoedges, type Brep, type FaceId } from '../topology/brep.ts';
import { coedgeFraction, pcurveUv, surfaceUv, uvGapCollapses } from '../topology/geometry.ts';
import { circleStepCount, type CurveSamples } from './sample.ts';
import type { MeshRules } from './tolerance.ts';
import { Triangulation, triangulatePolygon, type Tri } from './triangulate.ts';

/**
 * Grid bound of a face: at most `MAX_GRID²` grid cells, and at most `MAX_GRID` lines per direction unless the
 * other direction needs fewer (a thin torus needs ~1000 lines along its ring but a handful around its tube).
 */
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

/** The boundary of a face in its own `(u, v)` (step 1 of the module comment). */
export interface FaceBoundary {
  /** Ring vertices of all loops: the edge samples' 3D points (pole copies repeat their vertex). */
  readonly positions: readonly Point3[];
  /** Their `(u, v)`. */
  readonly uvs: readonly Point2[];
  /** Each loop as indices into `positions` / `uvs`, in loop order (a closed ring: the last joins the first). */
  readonly loops: readonly (readonly number[])[];
  /** Pole copies: `[a, b]` are two ring vertices of one pole vertex (same 3D point, different `(u, v)`). */
  readonly poles: readonly (readonly [number, number])[];
}

/**
 * Step 1 of the module comment: walks the loops of `face` over the shared edge samples and maps every sample to
 * the face's `(u, v)` (pcurve hints, seams a period apart, pole copies). The one face-boundary mapping of the
 * kernel: `meshFace` and the face domains of `src/query` both build on it. `op` names the operation in errors.
 * Errors: a missing face or edge, a loop that jumps or does not close in `(u, v)` (`invalid-topology`), those of
 * the edge samples and of the `(u, v)` inversion.
 */
export function faceBoundaryUv(
  kernel: Kernel,
  brep: Brep,
  face: FaceId,
  edgeSamples: readonly Result<CurveSamples>[],
  op: string = OP,
): Result<FaceBoundary> {
  const faceError = <T>(reason: string): Result<T> =>
    err({ kind: 'invalid-topology', operation: op, reason, entity: { kind: 'face', id: face } });
  const f = brep.faces[face];
  if (f === undefined) return err({ kind: 'not-found', operation: op, entity: { kind: 'face', id: face } });
  const s = f.surface;
  const positions: Point3[] = [];
  const uvs: Point2[] = [];
  const loops: number[][] = [];
  // Pole copies: `[a, b]` are two ring vertices of one pole vertex (same 3D point, different `(u, v)`).
  const poles: (readonly [number, number])[] = [];
  const gapTol = (p: Point2): number => 1e-6 * Math.max(1, Math.abs(p.x), Math.abs(p.y)) + 1e-9;
  const uvGap = (a: Point2, b: Point2): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  for (const l of f.loops) {
    const cs = loopCoedges(brep, l);
    if (!cs.ok) return cs;
    const ring: number[] = [];
    let prevUv: Point2 | undefined;
    let firstUv: Point2 | undefined;
    let endUv: Point2 | undefined;
    let endPoint: Point3 | undefined;
    for (const c of cs.value) {
      const co = brep.coedges[c]!;
      const e = brep.edges[co.edge];
      const es = edgeSamples[co.edge];
      if (e === undefined || es === undefined) return faceError(`coedge ${c} names a missing edge`);
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
          endPoint = es.value.points[k]!;
          prevUv = uv.value;
          continue;
        }
        if (step === 0 && endUv !== undefined && endPoint !== undefined && uvGap(endUv, uv.value) > gapTol(endUv)) {
          // The previous coedge ended elsewhere in (u, v): a pole gap (the surface collapses the segment to the
          // vertex) gets a second ring vertex for the pole; any other jump leaves the boundary open.
          if (!uvGapCollapses(kernel, s, endUv, uv.value, endPoint)) return faceError(`loop ${l} jumps in (u, v) before coedge ${c}`);
          poles.push([positions.length, positions.length + 1]);
          ring.push(positions.length);
          positions.push(endPoint);
          uvs.push(endUv);
        }
        if (firstUv === undefined) firstUv = uv.value;
        prevUv = uv.value;
        ring.push(positions.length);
        positions.push(es.value.points[k]!);
        uvs.push(uv.value);
      }
    }
    if (firstUv === undefined || endUv === undefined || endPoint === undefined) return faceError('empty loop');
    const gap = uvGap(firstUv, endUv);
    if (!(gap <= gapTol(firstUv))) {
      if (!uvGapCollapses(kernel, s, endUv, firstUv, endPoint)) return faceError(`loop ${l} does not close in (u, v) (gap ${gap})`);
      poles.push([positions.length, ring[0]!]);
      ring.push(positions.length);
      positions.push(endPoint);
      uvs.push(endUv);
    }
    loops.push(ring);
  }
  if (loops.length === 0) return faceError('face has no loop');
  return ok(
    Object.freeze({
      positions: Object.freeze(positions),
      uvs: Object.freeze(uvs),
      loops: Object.freeze(loops.map((r) => Object.freeze(r))),
      poles: Object.freeze(poles.map((p) => Object.freeze(p))),
    }),
  );
}

/** The work-plane scales `(s_u, s_v)` at `(u, v)` (positive and finite; 1 where the speed is not). */
function workScales(s: Surface3, u: number, v: number, vSpan: number): readonly [number, number] {
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
    case 'torus': {
      // The mean of `|S_u| = R + r cos v` over the box's `v` span (`R` over a full turn): its value at the
      // middle alone is `R - r` on a full torus, near 0 for a nearly horn torus, which squashes `w` in `u`.
      const h = vSpan / 2;
      const meanCos = h > 1e-9 ? (Math.cos(v) * Math.sin(h)) / h : Math.cos(v);
      return [pos(s.majorRadius + s.minorRadius * meanCos), pos(s.minorRadius)];
    }
    case 'nurbs': {
      const d = evaluateSurface3(s, u, v);
      if (!d.ok) return [1, 1];
      return [pos(Math.hypot(d.value.su.x, d.value.su.y, d.value.su.z)), pos(Math.hypot(d.value.sv.x, d.value.sv.y, d.value.sv.z))];
    }
  }
}

interface Grid { readonly nu: number; readonly nv: number; readonly capped: boolean }

/** Grid cells wider or taller than this in the work plane are made square (step 2 of the module comment). */
const MAX_CELL_ASPECT = 4;

/** Lines one direction of a grid may have at most (when the other needs few): the curve sampling bound. */
const MAX_GRID_LINE = MAX_GRID * MAX_GRID;

function straightCount(length: number, rules: MeshRules): { steps: number; capped: boolean } {
  const n = Math.ceil(length / rules.maxEdgeLength);
  if (!(n <= MAX_GRID_LINE)) return { steps: MAX_GRID_LINE, capped: true };
  return { steps: Math.max(1, n), capped: false };
}

function curvedCount(radius: number, sweep: number, rules: MeshRules): { steps: number; capped: boolean } {
  const c = circleStepCount(radius, sweep, rules);
  if (c.capped || c.steps > MAX_GRID_LINE) return { steps: Math.min(c.steps, MAX_GRID_LINE), capped: true };
  return { steps: c.steps, capped: false };
}

/**
 * Applies the grid bound (`MAX_GRID`): at most `MAX_GRID²` cells; a direction keeps more than `MAX_GRID` lines
 * only while the other has at most `MAX_GRID`. Capping a thin direction to `MAX_GRID` while the other needs few
 * would leave cells whose chords stray farther than the surface is thick (a thin torus folds through itself).
 */
function boundGrid(nu: number, nv: number, capped: boolean): Grid {
  const budget = MAX_GRID * MAX_GRID;
  if (nu * nv <= budget) return { nu, nv, capped };
  if (nu <= MAX_GRID) return { nu, nv: Math.max(1, Math.floor(budget / nu)), capped: true };
  if (nv <= MAX_GRID) return { nu: Math.max(1, Math.floor(budget / nv)), nv, capped: true };
  return { nu: MAX_GRID, nv: MAX_GRID, capped: true };
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
  return boundGrid(a.steps, b.steps, a.capped || b.capped);
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
  const boundary = faceBoundaryUv(kernel, brep, face, edgeSamples, OP);
  if (!boundary.ok) return boundary;
  const positions: Point3[] = [...boundary.value.positions];
  const uvs: Point2[] = [...boundary.value.uvs];
  const loops: number[][] = boundary.value.loops.map((r) => [...r]);
  const poles = boundary.value.poles;

  // Work plane.
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of uvs) {
    u0 = Math.min(u0, p.x);
    u1 = Math.max(u1, p.x);
    v0 = Math.min(v0, p.y);
    v1 = Math.max(v1, p.y);
  }
  const curved = s.kind !== 'plane';
  const refine = curved || Number.isFinite(rules.maxEdgeLength);
  const grid = refine ? gridCounts(kernel, s, u0, u1, v0, v1, rules) : undefined;
  let [su, sv0] = workScales(s, (u0 + u1) / 2, (v0 + v1) / 2, v1 - v0);
  if (grid !== undefined && grid.nu > 1 && grid.nv > 1 && u1 > u0 && v1 > v0) {
    // Grid cells far from square in `w` (a capped grid, or a thin torus: ~1000 columns 6 apart along the ring
    // around a tube 0.006 round) let Delaunay triangles skip the grid rows between two columns, from `v = 0`
    // straight to `v = 2π` — the same circle. Rescale `u` so that such cells are square in `w`.
    const aspect = (su * (u1 - u0) * grid.nv) / (sv0 * (v1 - v0) * grid.nu);
    if (Number.isFinite(aspect) && aspect > 0 && (grid.capped || aspect > MAX_CELL_ASPECT || aspect < 1 / MAX_CELL_ASPECT)) su /= aspect;
  }
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
  const created = Triangulation.create(work, tris.value, constrained, refine);
  if (!created.ok) return faceError(face, created.error.kind === 'invalid-input' ? created.error.reason : created.error.kind);
  const tri = created.value;
  tri.legalizeAll();

  let capped = false;
  if (grid !== undefined) {
    const g = grid;
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

  const atPole = new Set<number>(poles.flat());

  // Sag refinement (curved faces): insert the (u, v) centroid of every triangle whose centroid stands more than
  // the chord off the surface, for a few rounds.
  if (curved) {
    let added = 0;
    for (let round = 0; round < MAX_SAG_ROUNDS && !capped; round++) {
      const cand: { uv: Point2; p: Point3 }[] = [];
      for (const [a, b, c] of tri.tris) {
        // A pole copy has no `u` of its own: the (u, v) centroid of a triangle at a pole is not over the facet.
        if (atPole.has(a) || atPole.has(b) || atPole.has(c)) continue;
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

  // Poles: each pair of copies becomes one vertex; the one triangle on the pole segment (both copies) vanishes,
  // the others around the pole form its fan.
  const fold = collapsePoles(positions.length, tri.tris, loops, poles);
  // Compact in place: `keep` is increasing with `keep[j] >= j`, so a forward copy never overwrites a kept entry.
  for (let j = 0; j < fold.keep.length; j++) {
    positions[j] = positions[fold.keep[j]!]!;
    uvs[j] = uvs[fold.keep[j]!]!;
  }
  positions.length = fold.keep.length;
  uvs.length = fold.keep.length;
  const poleVertices = new Set<number>(poles.map(([a]) => fold.index[a]!));

  // Normals.
  const normals: (Vec3 | undefined)[] = [];
  const planeNormal = s.kind === 'plane' ? (f.reversed ? negate(s.frame.normal) : s.frame.normal) : undefined;
  for (const p of uvs) {
    if (planeNormal !== undefined) {
      normals.push(planeNormal);
      continue;
    }
    const n = poleVertices.has(normals.length) ? poleNormal(s, p.y) : surfaceNormal3(kernel, s, p.x, p.y);
    normals.push(n.ok ? (f.reversed ? negate(n.value) : n.value) : undefined);
  }
  if (normals.some((n) => n === undefined)) {
    const sum: Vec3[] = positions.map(() => vec3(0, 0, 0));
    for (const [a, b, c] of fold.tris) {
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
      triangles: Object.freeze(fold.tris.map((t) => Object.freeze([t[0], t[1], t[2]] as const))),
      loops: Object.freeze(fold.loops.map((r) => Object.freeze(r))),
      capped,
    }),
  );
}

/**
 * Merges each pole pair `[a, b]` into its lower index and compacts the vertex numbering: `index[i]` is the new
 * index of old vertex `i`, `keep` the old index of each new vertex. Triangles with a repeated vertex after the
 * merge (the one on the pole segment) are dropped; each loop lists the pole once.
 */
function collapsePoles(
  n: number,
  tris: readonly (readonly [number, number, number])[],
  loops: readonly (readonly number[])[],
  poles: readonly (readonly [number, number])[],
): { index: number[]; keep: number[]; tris: Tri[]; loops: number[][] } {
  const to = Array.from({ length: n }, (_, i) => i);
  for (const [a, b] of poles) to[Math.max(a, b)] = Math.min(a, b);
  const index: number[] = new Array<number>(n).fill(-1);
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    if (to[i] === i) {
      index[i] = keep.length;
      keep.push(i);
    }
  }
  for (let i = 0; i < n; i++) index[i] = index[to[i]!]!;
  const out: Tri[] = [];
  for (const [a, b, c] of tris) {
    const t: Tri = [index[a]!, index[b]!, index[c]!];
    if (t[0] !== t[1] && t[1] !== t[2] && t[2] !== t[0]) out.push(t);
  }
  const rings = loops.map((r) => {
    const m = r.map((v) => index[v]!);
    return m.filter((v, i) => v !== m[(i + 1) % m.length]);
  });
  return { index, keep, tris: out, loops: rings };
}

/**
 * The normal at a pole or apex as the limit of the surface normal (upstream `eval/pole.rs`: a pole's normal is
 * a limit along the parameter lines into the face). On a sphere every approach gives the axis `±Z` (the sign of
 * `sin v`). On a cone the limit along the generator `u` is that generator's normal, which depends on `u`; the
 * vertex, shared by every generator, takes their mean over a full turn, the axis pointing out of the tip,
 * `-sign(tan α) Z` (the side normals are `(e(u) - tan α Z) / |...|`). Other surfaces have no closed form here:
 * the caller falls back to the triangle normals.
 */
function poleNormal(s: Surface3, v: number): Result<Vec3> {
  if (s.kind === 'sphere') return ok(v > 0 ? s.frame.normal : negate(s.frame.normal));
  if (s.kind === 'cone') return ok(s.semiAngle > 0 ? negate(s.frame.normal) : s.frame.normal);
  return err({ kind: 'degenerate', operation: OP });
}
