/**
 * Sewing a face soup into a closed B-rep: `sewFaces(kernel, soup, options)`.
 *
 * Input (`FaceSoup`): faces, each a surface, a `reversed` flag and loops (outer first) of oriented **edge
 * pieces** — a `Curve3` over `[t0, t1]`, run backwards when `reversed`, with an optional pcurve in the face's
 * `(u, v)` running in the piece's direction. This is what the boolean assembly produces: every face carries its
 * own copy of each boundary curve, possibly in another representation (a circle on a planar cap, its NURBS form
 * on a NURBS side).
 *
 * Steps (each deterministic: no step depends on hash or insertion order beyond the soup's own order):
 * 1. **Vertices.** The start and end points of all pieces are clustered within `vertexTolerance` (default
 *    `zoneTol3d`) by `clusterPoints` (sorted-order union-find, Lean `runMerges`). A cluster's point is its
 *    members' point when they are all equal, else their centroid. Consecutive pieces of a loop must meet in one
 *    cluster (`loop-gap`); a piece whose ends meet in one cluster must be a closed curve, not a line nor a piece
 *    whose middle is also at that vertex (`degenerate-piece`).
 * 2. **Edges.** Pieces with the same unordered pair of end clusters are compared geometrically: each samples the
 *    other at `EDGE_SAMPLE_FRACTIONS` (distance to the other's interval by `closestPointOnCurve`, the nearer end
 *    point when the foot leaves the interval), both ways, so curves of different representation (a circle arc and
 *    its NURBS form) match while two different arcs between the same vertices do not. Pieces within
 *    `edgeTolerance` (default `xsectTol3d`) of a group's first piece join it. Each group must have exactly two
 *    pieces: one is `not-closed`, three or more `non-manifold`. The edge keeps the first analytic piece's curve
 *    (else the first piece's) and its interval; each piece becomes a coedge, with its own pcurve kept, running the
 *    edge backwards when it starts at the edge's end vertex (for a closed edge: when its samples at 1/4 and 3/4
 *    project in decreasing order onto the edge).
 * 3. **Orientation.** `propagateOrientation` (BFS over faces through shared edges, Lean `propagate_complete`)
 *    flips faces so that every edge is used in opposite directions, or refuses `non-orientable`.
 * 4. **Shells.** The connected components are oriented outward and nested into lumps with voids by
 *    `layoutShells` (mesh signed volume; shells whose boundaries meet are refused, `shells-intersect`, by the M4
 *    curve/surface and surface/surface intersections with `pointInFace`; nesting by `classifyPoint`).
 * 5. The plan is built by `BrepBuilder` (`buildPlan`) and checked by `validateBrepGeometry`, whose error is
 *    returned as is: a sewn body is valid or refused, never returned invalid.
 *
 * The gap report says how much was closed: the largest distance a piece end moved onto its vertex, and the
 * largest sampled distance between two pieces merged into one edge.
 *
 * Upstream consulted (for the method and failure cases, not translated): `solidcore/crates/solidcore/src/heal/stitch.rs`,
 * `heal/stitch/*` (match vertices, then edges with the same end vertices and coincident geometry, within the
 * stitch tolerance; open and non-manifold results), `heal/gap.rs` (gap measurement), `heal/heal_data.rs`,
 * `topology/brep_constructor.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, vec3, type Point3 } from '../math/vec.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import type { Surface3 } from '../surface/types.ts';
import { faceId, loopCoedges, type Brep, type FaceId } from '../topology/brep.ts';
import { validateBrepGeometry } from '../topology/geometry.ts';
import { healError } from './error.ts';
import { propagateOrientation, type EdgeUsePair } from './orient.ts';
import { buildPlan, flipPlanFace, type PlanCoedge, type PlanEdge, type PlanFace } from './plan.ts';
import { layoutShells } from './shells.ts';
import { clusterPoints } from './union-find.ts';

/** One oriented piece of a face boundary: `curve` over `[t0, t1]`, run from `t1` to `t0` when `reversed`. */
export interface SoupEdgePiece {
  readonly curve: Curve3;
  readonly t0: number;
  readonly t1: number;
  readonly reversed: boolean;
  /** The piece in the face's `(u, v)`, in the piece's direction (see `Coedge.pcurve`). */
  readonly pcurve?: NurbsCurve;
}

export interface SoupFace {
  readonly surface: Surface3;
  /** Outward normal is the surface normal negated (as `Face.reversed`; sewing may flip the face). */
  readonly reversed: boolean;
  /** Loops of pieces, outer first; each runs counter-clockwise seen from the face's outer side. */
  readonly loops: readonly (readonly SoupEdgePiece[])[];
}

export interface FaceSoup {
  readonly faces: readonly SoupFace[];
}

export interface SewOptions {
  /** Distance within which piece ends are one vertex (default `zoneTol3d`). */
  readonly vertexTolerance?: number;
  /** Distance within which pieces are one edge (default `xsectTol3d`). */
  readonly edgeTolerance?: number;
}

export interface GapReport {
  /** Largest distance from a piece's end point to the vertex it was merged into. */
  readonly maxVertexGap: number;
  /** Largest sampled distance between two pieces merged into one edge. */
  readonly maxEdgeGap: number;
  /** Piece end points and the vertices they became. */
  readonly endPoints: number;
  readonly vertices: number;
  /** Pieces and the edges they became. */
  readonly pieces: number;
  readonly edges: number;
}

export interface SewResult {
  readonly brep: Brep;
  readonly gaps: GapReport;
  /** Soup faces whose orientation sewing reversed (ascending soup indices). */
  readonly flippedFaces: readonly number[];
  /** The B-rep face of each soup face. */
  readonly faceOf: readonly FaceId[];
}

/** Fractions at which two pieces are compared (interior points; the ends are compared as vertices). */
export const EDGE_SAMPLE_FRACTIONS: readonly number[] = Object.freeze([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);

const OP = 'heal.sewFaces';

interface Piece {
  readonly face: number;
  readonly piece: SoupEdgePiece;
  /** Start / end points in the piece's direction. */
  readonly a: Point3;
  readonly b: Point3;
}

/** The point at fraction `s` of a piece, in its direction. */
function pieceAt(p: SoupEdgePiece, s: number): Result<Point3> {
  const f = p.reversed ? 1 - s : s;
  return curvePoint3(p.curve, f === 1 ? p.t1 : p.t0 + f * (p.t1 - p.t0));
}

/** Distance from `q` to `curve` over `[t0, t1]`, and the interval fraction of the foot. */
function distanceToPiece(p: SoupEdgePiece, q: Point3): Result<{ readonly distance: number; readonly fraction: number }> {
  const c = closestPointOnCurve(p.curve, q);
  if (!c.ok) return c;
  if (c.value.t >= p.t0 && c.value.t <= p.t1) return ok({ distance: c.value.distance, fraction: (c.value.t - p.t0) / (p.t1 - p.t0) });
  const a = pieceAt({ ...p, reversed: false }, 0), b = pieceAt({ ...p, reversed: false }, 1);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const da = distance3(a.value, q), db = distance3(b.value, q);
  return ok(da <= db ? { distance: da, fraction: 0 } : { distance: db, fraction: 1 });
}

/** Largest sampled distance from `p` to `q` (samples of `p` at `EDGE_SAMPLE_FRACTIONS`). */
function sampledDeviation(p: SoupEdgePiece, q: SoupEdgePiece): Result<number> {
  let worst = 0;
  for (const s of EDGE_SAMPLE_FRACTIONS) {
    const x = pieceAt(p, s);
    if (!x.ok) return x;
    const d = distanceToPiece(q, x.value);
    if (!d.ok) return d;
    worst = Math.max(worst, d.value.distance);
  }
  return ok(worst);
}

function checkPiece(p: SoupEdgePiece): string | undefined {
  const [r0, r1] = curveRange(p.curve);
  if (!(Number.isFinite(p.t0) && Number.isFinite(p.t1) && r0 <= p.t0 && p.t0 < p.t1 && p.t1 <= r1)) return 'interval is not inside the curve range';
  if (p.pcurve !== undefined && p.pcurve.dimension !== 2) return 'pcurve is not 2D';
  return undefined;
}

/** Sews `soup` into a closed B-rep (see the module comment). */
export function sewFaces(kernel: Kernel, soup: FaceSoup, options: SewOptions = {}): Result<Brep> {
  const r = sewFacesReport(kernel, soup, options);
  return r.ok ? ok(r.value.brep) : r;
}

/** `sewFaces` with the gap report, the faces it flipped and the face map. */
export function sewFacesReport(kernel: Kernel, soup: FaceSoup, options: SewOptions = {}): Result<SewResult> {
  const vtol = options.vertexTolerance ?? kernel.tolerances.zoneTol3d;
  const etol = options.edgeTolerance ?? kernel.tolerances.xsectTol3d;
  if (!(Number.isFinite(vtol) && vtol > 0 && Number.isFinite(etol) && etol > 0)) {
    return err({ kind: 'invalid-input', operation: OP, reason: 'tolerances must be finite and positive' });
  }
  if (soup.faces.length === 0) return healError(OP, 'empty-soup', 'the soup has no faces');

  // Pieces, loop by loop.
  const pieces: Piece[] = [];
  const loopsOf: number[][][] = [];
  for (const [fi, face] of soup.faces.entries()) {
    if (face.loops.length === 0) return healError(OP, 'invalid-piece', `face ${fi} has no loop`, { kind: 'face', id: fi });
    const loops: number[][] = [];
    for (const loop of face.loops) {
      if (loop.length === 0) return healError(OP, 'invalid-piece', `face ${fi} has an empty loop`, { kind: 'face', id: fi });
      const ids: number[] = [];
      for (const piece of loop) {
        const bad = checkPiece(piece);
        if (bad !== undefined) return healError(OP, 'invalid-piece', `face ${fi}: ${bad}`, { kind: 'face', id: fi });
        const a = pieceAt(piece, 0), b = pieceAt(piece, 1);
        if (!a.ok) return a;
        if (!b.ok) return b;
        ids.push(pieces.length);
        pieces.push({ face: fi, piece, a: a.value, b: b.value });
      }
      loops.push(ids);
    }
    loopsOf.push(loops);
  }

  // 1. Vertices.
  const ends: Point3[] = [];
  for (const p of pieces) ends.push(p.a, p.b);
  const clusters = clusterPoints(ends, vtol);
  const vertices: Point3[] = [];
  let maxVertexGap = 0;
  for (const members of clusters.members) {
    const pts = members.map((i) => ends[i]!);
    const p0 = pts[0]!;
    let point = p0;
    if (!pts.every((p) => p.x === p0.x && p.y === p0.y && p.z === p0.z)) {
      let x = 0, y = 0, z = 0;
      for (const p of pts) {
        x += p.x;
        y += p.y;
        z += p.z;
      }
      point = vec3(x / pts.length, y / pts.length, z / pts.length);
    }
    for (const p of pts) maxVertexGap = Math.max(maxVertexGap, distance3(p, point));
    vertices.push(Object.freeze(point));
  }
  const startOf = (k: number): number => clusters.clusterOf[2 * k]!;
  const endOf = (k: number): number => clusters.clusterOf[2 * k + 1]!;
  for (const [fi, loops] of loopsOf.entries()) {
    for (const loop of loops) {
      for (const [i, k] of loop.entries()) {
        const next = loop[(i + 1) % loop.length]!;
        if (endOf(k) !== startOf(next)) {
          return healError(OP, 'loop-gap', `face ${fi}: a piece ends ${distance3(pieces[k]!.b, pieces[next]!.a)} from where the next starts`, { kind: 'face', id: fi });
        }
      }
    }
  }
  for (const [k, p] of pieces.entries()) {
    if (startOf(k) !== endOf(k)) continue;
    const mid = pieceAt(p.piece, 0.5);
    if (!mid.ok) return mid;
    if (p.piece.curve.kind === 'line' || distance3(mid.value, vertices[startOf(k)]!) <= vtol) {
      return healError(OP, 'degenerate-piece', `face ${p.face}: a piece starts and ends at one vertex`, { kind: 'face', id: p.face });
    }
  }

  // 2. Edges.
  const groups = new Map<string, number[]>();
  const keys: string[] = [];
  for (let k = 0; k < pieces.length; k++) {
    const s = startOf(k), e = endOf(k);
    const key = s < e ? `${s},${e}` : `${e},${s}`;
    let g = groups.get(key);
    if (g === undefined) {
      g = [];
      groups.set(key, g);
      keys.push(key);
    }
    g.push(k);
  }
  const edgeGroups: number[][] = [];
  let maxEdgeGap = 0;
  for (const key of keys) {
    const local: { pieces: number[]; gap: number }[] = [];
    for (const k of groups.get(key)!) {
      let joined = false;
      for (const g of local) {
        const first = pieces[g.pieces[0]!]!.piece;
        const d1 = sampledDeviation(pieces[k]!.piece, first);
        if (!d1.ok) return d1;
        if (d1.value > etol) continue;
        const d2 = sampledDeviation(first, pieces[k]!.piece);
        if (!d2.ok) return d2;
        if (d2.value > etol) continue;
        g.pieces.push(k);
        g.gap = Math.max(g.gap, d1.value, d2.value);
        joined = true;
        break;
      }
      if (!joined) local.push({ pieces: [k], gap: 0 });
    }
    for (const g of local) {
      edgeGroups.push(g.pieces);
      maxEdgeGap = Math.max(maxEdgeGap, g.gap);
    }
  }
  // Non-manifold edges are reported before open ones (a third face on an edge is the more specific fault).
  for (const g of edgeGroups) {
    const face = pieces[g[0]!]!.face;
    if (g.length > 2) return healError(OP, 'non-manifold', `an edge of face ${face} is used by ${g.length} faces`, { kind: 'face', id: face });
  }
  for (const g of edgeGroups) {
    const face = pieces[g[0]!]!.face;
    if (g.length === 1) return healError(OP, 'not-closed', `an edge of face ${face} is used by no other face`, { kind: 'face', id: face });
  }

  const edges: PlanEdge[] = [];
  const coedgeOf: PlanCoedge[] = new Array<PlanCoedge>(pieces.length);
  const uses: EdgeUsePair[] = [];
  for (const g of edgeGroups) {
    const repIndex = g.find((k) => pieces[k]!.piece.curve.kind !== 'nurbs') ?? g[0]!;
    const rep = pieces[repIndex]!.piece;
    const start = rep.reversed ? endOf(repIndex) : startOf(repIndex);
    const end = rep.reversed ? startOf(repIndex) : endOf(repIndex);
    const edge = edges.length;
    edges.push({ start, end, curve: rep.curve, t0: rep.t0, t1: rep.t1 });
    const dirs: boolean[] = [];
    for (const k of g) {
      const p = pieces[k]!.piece;
      let reversed: boolean;
      if (k === repIndex) reversed = rep.reversed;
      else if (start !== end) reversed = startOf(k) !== start;
      else {
        const q1 = pieceAt(p, 0.25), q3 = pieceAt(p, 0.75);
        if (!q1.ok) return q1;
        if (!q3.ok) return q3;
        const f1 = distanceToPiece(rep, q1.value), f3 = distanceToPiece(rep, q3.value);
        if (!f1.ok) return f1;
        if (!f3.ok) return f3;
        reversed = !(f1.value.fraction < f3.value.fraction);
      }
      dirs.push(reversed);
      coedgeOf[k] = p.pcurve === undefined ? { edge, reversed } : { edge, reversed, pcurve: p.pcurve };
    }
    uses.push({ f1: pieces[g[0]!]!.face, d1: dirs[0]!, f2: pieces[g[1]!]!.face, d2: dirs[1]! });
  }

  // 3. Orientation.
  const orient = propagateOrientation(soup.faces.length, uses);
  if (!orient.ok) {
    const u = uses[orient.use]!;
    return healError(OP, 'non-orientable', `no orientation of the faces uses the edge between faces ${u.f1} and ${u.f2} in opposite directions`, { kind: 'face', id: u.f2 });
  }
  const faces: PlanFace[] = [];
  for (const [fi, face] of soup.faces.entries()) {
    const pf: PlanFace = { surface: face.surface, reversed: face.reversed, loops: loopsOf[fi]!.map((loop) => loop.map((k) => coedgeOf[k]!)) };
    if (!orient.flip[fi]) {
      faces.push(pf);
      continue;
    }
    const g = flipPlanFace(pf);
    if (!g.ok) return g;
    faces.push(g.value);
  }

  // 4. Shells, lumps, voids.
  const plan = { vertices, edges, faces, bodies: [] };
  const layout = layoutShells(kernel, OP, plan, orient.components);
  if (!layout.ok) return layout;

  // 5. Build and validate.
  const brep = buildPlan({ vertices, edges, faces: layout.value.faces, bodies: layout.value.bodies });
  const valid = validateBrepGeometry(kernel, brep);
  if (!valid.ok) return valid;
  const faceOf = new Array<FaceId>(soup.faces.length);
  let next = 0;
  for (const body of layout.value.bodies) for (const shell of body) for (const f of shell) faceOf[f] = faceId(next++);
  const layoutFlipped = new Set(layout.value.flipped);
  const flippedFaces = soup.faces.flatMap((_, f) => ((orient.flip[f] ?? false) !== layoutFlipped.has(f) ? [f] : []));
  return ok(
    Object.freeze({
      brep,
      gaps: Object.freeze({
        maxVertexGap,
        maxEdgeGap,
        endPoints: ends.length,
        vertices: vertices.length,
        pieces: pieces.length,
        edges: edges.length,
      }),
      flippedFaces: Object.freeze(flippedFaces),
      faceOf: Object.freeze(faceOf),
    }),
  );
}

/**
 * The face soup of a structurally valid B-rep: every coedge becomes a piece with its edge's curve, interval and
 * its own pcurve (the inverse of sewing, used to re-sew or to edit faces independently).
 */
export function faceSoupOfBrep(brep: Brep): Result<FaceSoup> {
  const faces: SoupFace[] = [];
  for (const f of brep.faces) {
    const loops: SoupEdgePiece[][] = [];
    for (const l of f.loops) {
      const cs = loopCoedges(brep, l);
      if (!cs.ok) return cs;
      loops.push(
        cs.value.map((c) => {
          const co = brep.coedges[c]!;
          const e = brep.edges[co.edge]!;
          const p = { curve: e.curve, t0: e.t0, t1: e.t1, reversed: co.reversed };
          return Object.freeze(co.pcurve === undefined ? p : { ...p, pcurve: co.pcurve });
        }),
      );
    }
    faces.push(Object.freeze({ surface: f.surface, reversed: f.reversed, loops }));
  }
  return ok(Object.freeze({ faces: Object.freeze(faces) }));
}
