/**
 * Imprinting — stage 2 of the boolean pipeline (upstream `docs/booleans.md` §3): the intersection pieces become
 * edges of both bodies. Each body's edges are split where pieces end on them or where they cross a face of the
 * other body, and each face is split along the pieces lying inside it, into **fragments**: faces of the same
 * surface and orientation, each with its outer loop and holes, knowing which face they came from. Nothing is
 * classified inside or outside here (that is stage 3).
 *
 * `imprintBody(kernel, body, cuts, imprints)` rebuilds one body:
 * 1. **Vertices.** The original vertices keep their ids; every new point is looked up among all vertices within
 *    `zoneTol3d` first (one vertex per place), else added.
 * 2. **Edge splits.** The cuts of each edge strictly inside its interval (farther than `zoneTol3d` from its ends
 *    and from each other) split it into `splitIntervals` pieces sharing the curve; both coedges follow, with
 *    `splitPcurve` pieces. A cut landing on an existing vertex is refused (the edge would touch another).
 * 3. **Imprinted edges.** One edge per imprinted curve (closed curves are closed edges); duplicates on a face (the
 *    same curve from two face pairs) are dropped.
 * 4. **Face splitting.** A face without imprints keeps its loops (with the split edges). Otherwise its
 *    arrangement in `(u, v)` (`imprint-arrangement.ts`): boundary darts from the split coedges (pcurves, or the
 *    edge sampled and mapped by `surfaceUv`), **pole** darts where consecutive coedges jump along a collapsed
 *    iso-line (`uvGapCollapses`: a sphere pole, a cone apex), and two darts per imprinted curve. A vertex has one
 *    arrangement node per place it occupies in `(u, v)` (a seam vertex at `u = 0` and `u = 2π`): an imprinted
 *    curve's end takes the nearest node of its vertex, or, at a pole, a new node splitting the pole dart at its
 *    `u`; its pcurve's end control points are snapped to the node (so consecutive pcurves meet exactly).
 *    The arrangement's sub-faces become the fragments; pole darts stay implicit between coedges (M3 convention).
 * 5. **Counting check.** Each imprinted curve is logged as a step of the counting model (`imprint-count.ts`),
 *    decided by union–find over the components of the `(u, v)` graph; the sub-faces and loops found must be the
 *    counts the model predicts, and no sub-face may use both sides of an imprinted edge (a dangling curve or a
 *    bridge between loops: `non-manifold imprint`). Otherwise the imprint is refused.
 * 6. **Validation.** The rebuilt body must pass `validateBrepGeometry` (hence `validateBrep`); its error is
 *    returned otherwise. A returned body is a valid closed B-rep with the same genus (`imprint-count.ts`).
 *
 * `imprintBodies(kernel, a, b)` runs stage 1 and 2 for a pair: every face pair (`intersectFaces`, boxes pruned),
 * the cuts from the pieces' end contacts and from every edge of one body crossing a face of the other
 * (`edgeSurfaceHits`, kept unless the crossing is `outside` that face), the imprinted curves (a piece goes to a
 * face whose interior it crosses: not `onBoundary` there), then `imprintBody` for both. Each imprinted edge knows
 * its piece (`EdgeSource.piece`), so the next stage can pair the two copies.
 *
 * Upstream consulted (for the method, not translated): `solidcore/docs/booleans.md` §3 (stage 2: "the kept curve
 * intervals and points become proto edges and vertices, are resolved against each other and imprinted as edges in
 * both bodies; the two copies of each are mated"), `solidcore/crates/solidcore/src/boolean/topology_intersector.rs`
 * (`intersect_insert_relate`, `imprint_intersections`), `boolean/merge.rs`, `boolean/merge/p4.rs`,
 * `solidcore/crates/solidcore/src/topology/vertex.rs` (poles), `solidcore/docs/validity-and-tolerances.md` (one
 * vertex per place within the zone) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import { distance3, vec2, type Point2, type Point3 } from '../math/vec.ts';
import { createNurbsCurve, curveDomain, evaluateCurve, reverseNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { prepared, type BodyInput, type PreparedBody } from '../query/domain.ts';
import type { Surface3 } from '../surface/types.ts';
import {
  BrepBuilder,
  edgeId,
  faceId,
  loopCoedges,
  type Brep,
  type CoedgeUse,
  type EdgeId,
  type FaceId,
  type ShellId,
  type VertexId,
} from '../topology/brep.ts';
import { surfaceUv, uvGapCollapses, validateBrepGeometry } from '../topology/geometry.ts';
import { arrangementFaces, type ArrangementDart } from './imprint-arrangement.ts';
import { applyImprintOps, type ImprintCounts, type ImprintOp } from './imprint-count.ts';
import {
  edgeSurfaceHits,
  facePairContext,
  intersectFaces,
  type BodySide,
  type FaceFaceIntersection,
  type FacePairContext,
  type IntersectionPiece,
} from './face-intersect.ts';
import { pointInFace } from '../query/face.ts';
import { disjointSets } from '../heal/union-find.ts';
import { splitIntervals, splitPcurve, type ParamInterval } from './split.ts';

const OP = 'boolean.imprint';

/** A place to cut an edge: its edge parameter. */
export interface EdgeCut {
  readonly t: number;
}

/** A curve to imprint on face `face`: `curve` over its range with its pcurve on the face (curve direction). */
export interface FaceImprint {
  readonly face: FaceId;
  readonly curve: Curve3;
  readonly pcurve: NurbsCurve;
  /** A whole closed curve (one vertex at its start). */
  readonly closed: boolean;
  /** Caller's tag (the piece index for `imprintBodies`). */
  readonly piece?: number;
}

/** Where an edge of an imprinted body came from. */
export type EdgeSource =
  | { readonly kind: 'split'; readonly edge: EdgeId; readonly t0: number; readonly t1: number }
  | { readonly kind: 'imprint'; readonly piece: number | undefined };

/** A face of an imprinted body with its provenance (the fragment soup of the next stage). */
export interface Fragment {
  readonly face: FaceId;
  readonly sourceBody: string;
  readonly sourceFace: FaceId;
  readonly surface: Surface3;
  readonly reversed: boolean;
  /** Outer loop first, as oriented edge pieces with their pcurves. */
  readonly loops: readonly (readonly CoedgeUse[])[];
}

/** A body after imprinting (see the module comment). */
export interface ImprintedBody {
  readonly brep: Brep;
  /** The source face of each face (index = new face id). */
  readonly faceSource: readonly FaceId[];
  /** The source of each edge (index = new edge id). */
  readonly edgeSource: readonly EdgeSource[];
  /** The counting-model steps performed (edge splits, then the imprinted curves face by face). */
  readonly ops: readonly ImprintOp[];
  readonly fragments: readonly Fragment[];
}

/** The `(V, E, F, L)` counts of a B-rep. */
export function brepCounts(brep: Brep): ImprintCounts {
  return Object.freeze({ v: brep.vertices.length, e: brep.edges.length, f: brep.faces.length, l: brep.loops.length });
}

const fail = <T>(reason: string, face?: number): Result<T> =>
  err({ kind: 'invalid-topology', operation: OP, reason, ...(face !== undefined ? { entity: { kind: 'face', id: face } } : {}) });

/** A dart of a face arrangement with what the B-rep needs (see the module comment). */
interface Dart extends ArrangementDart {
  from: number;
  to: number;
  poly: Point2[];
  readonly kind: 'boundary' | 'pole' | 'imprint';
  readonly edge: EdgeId | undefined;
  readonly reversed: boolean;
  readonly pcurve: NurbsCurve | undefined;
  /** For imprint darts: the index of the imprinted edge on this face. */
  readonly imprint: number | undefined;
  /** Original-coordinate `(u, v)` of its ends (for pole darts and snapping). */
  readonly vStart: VertexId;
  readonly vEnd: VertexId;
}

interface SubEdge {
  readonly id: EdgeId;
  readonly interval: ParamInterval;
  readonly start: VertexId;
  readonly end: VertexId;
}

const PC_SAMPLES = 32;

/** `(u, v)` samples of a pcurve (two for a straight one). */
function samplePcurve(pc: NurbsCurve): Result<Point2[]> {
  const [a, b] = curveDomain(pc);
  const straight = pc.degree === 1 && pc.controlPoints.length === 2;
  const n = straight ? 1 : PC_SAMPLES;
  const out: Point2[] = [];
  for (let i = 0; i <= n; i++) {
    const p = evaluateCurve(pc, i === n ? b : a + ((b - a) * i) / n);
    if (!p.ok) return p;
    out.push(vec2(p.value[0]!, p.value[1]!));
  }
  return ok(out);
}

/** The pcurve with its end control points moved to `a` and `b` (clamped: they are its end points). */
function snapPcurve(pc: NurbsCurve, a: Point2, b: Point2): Result<NurbsCurve> {
  const pts = pc.controlPoints.map((p) => [p[0]!, p[1]!]);
  pts[0] = [a.x, a.y];
  pts[pts.length - 1] = [b.x, b.y];
  return createNurbsCurve(pc.degree, pc.knots, pts, pc.weights);
}

/** Builder state shared by the steps of `imprintBody`. */
class Rebuild {
  readonly b = new BrepBuilder();
  readonly points: Point3[] = [];
  readonly edgeSource: EdgeSource[] = [];
  readonly ops: ImprintOp[] = [];
  readonly faceSource: FaceId[] = [];
  readonly kernel: Kernel;
  constructor(kernel: Kernel) {
    this.kernel = kernel;
  }

  /** The vertex within `zoneTol3d` of `p` (nearest), else a new one; `created` says which. */
  vertexAt(p: Point3): { readonly id: VertexId; readonly created: boolean } {
    let best = -1, bestD = Infinity;
    for (const [i, q] of this.points.entries()) {
      const d = distance3(p, q);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= this.kernel.tolerances.zoneTol3d) return { id: best as VertexId, created: false };
    this.points.push(p);
    return { id: this.b.addVertex(p), created: true };
  }

  addEdge(start: VertexId, end: VertexId, curve: Curve3, t0: number, t1: number, source: EdgeSource): EdgeId {
    this.edgeSource.push(Object.freeze(source));
    return this.b.addEdge(start, end, curve, t0, t1);
  }
}

/** Splits every edge at its cuts (step 2). */
function splitEdges(rb: Rebuild, brep: Brep, cuts: ReadonlyMap<EdgeId, readonly EdgeCut[]>): Result<SubEdge[][]> {
  const tol = rb.kernel.tolerances.zoneTol3d;
  const subs: SubEdge[][] = [];
  for (const [i, e] of brep.edges.entries()) {
    const ps = brep.vertices[e.start]!.point, pe = brep.vertices[e.end]!.point;
    const raw = [...(cuts.get(edgeId(i)) ?? [])].map((c) => c.t).filter((t) => t > e.t0 && t < e.t1).sort((x, y) => x - y);
    const kept: { t: number; p: Point3 }[] = [];
    for (const t of raw) {
      const p = curvePoint3(e.curve, t);
      if (!p.ok) return p;
      if (distance3(p.value, ps) <= tol || distance3(p.value, pe) <= tol) continue;
      if (kept.some((k) => distance3(k.p, p.value) <= tol)) continue;
      kept.push({ t, p: p.value });
    }
    const intervals = splitIntervals(e.t0, e.t1, kept.map((k) => k.t));
    if (!intervals.ok) return intervals;
    const vs: VertexId[] = [e.start];
    for (const k of kept) {
      const v = rb.vertexAt(k.p);
      if (!v.created) return fail(`a cut of edge ${i} lands on vertex ${v.id}`);
      rb.ops.push('split-edge');
      vs.push(v.id);
    }
    vs.push(e.end);
    subs.push(
      intervals.value.map((iv, j) => ({
        id: rb.addEdge(vs[j]!, vs[j + 1]!, e.curve, iv[0], iv[1], { kind: 'split', edge: edgeId(i), t0: iv[0], t1: iv[1] }),
        interval: iv,
        start: vs[j]!,
        end: vs[j + 1]!,
      })),
    );
  }
  return ok(subs);
}

/** The darts of one loop of a face from its split coedges, with pole darts between jumps (step 4). */
function loopDarts(
  rb: Rebuild,
  brep: Brep,
  face: FaceId,
  loop: number,
  subs: readonly SubEdge[][],
  flip: number,
): Result<Dart[]> {
  const kernel = rb.kernel;
  const f = brep.faces[face]!;
  const s = f.surface;
  const cs = loopCoedges(brep, loop as never);
  if (!cs.ok) return cs;
  const out: Dart[] = [];
  let prevUv: Point2 | undefined;
  for (const c of cs.value) {
    const co = brep.coedges[c]!;
    const e = brep.edges[co.edge]!;
    const pieces = subs[co.edge]!;
    const pcs = splitPcurve(kernel, s, e, co.pcurve, co.reversed, pieces.map((p) => p.interval));
    if (!pcs.ok) return pcs;
    const order = pieces.map((_, i) => i);
    if (co.reversed) order.reverse();
    for (const k of order) {
      const sub = pieces[k]!;
      const pc = pcs.value[k];
      let poly: Point2[];
      if (pc !== undefined) {
        const sp = samplePcurve(pc);
        if (!sp.ok) return sp;
        poly = sp.value;
      } else {
        poly = [];
        const n = e.curve.kind === 'line' ? 1 : PC_SAMPLES;
        for (let i = 0; i <= n; i++) {
          const fr = co.reversed ? 1 - i / n : i / n;
          const t = fr === 1 ? sub.interval[1] : sub.interval[0] + fr * (sub.interval[1] - sub.interval[0]);
          const p = curvePoint3(e.curve, t);
          if (!p.ok) return p;
          const q = surfaceUv(kernel, s, p.value, prevUv);
          if (!q.ok) return q;
          poly.push(q.value);
          prevUv = q.value;
        }
      }
      prevUv = poly[poly.length - 1];
      out.push({
        kind: 'boundary',
        edge: sub.id,
        reversed: co.reversed,
        pcurve: pc,
        imprint: undefined,
        from: -1,
        to: -1,
        poly,
        vStart: co.reversed ? sub.end : sub.start,
        vEnd: co.reversed ? sub.start : sub.end,
      });
    }
  }
  // Pole darts where consecutive darts jump in (u, v) along a collapsed iso-line.
  const withPoles: Dart[] = [];
  for (const [i, d] of out.entries()) {
    withPoles.push(d);
    const nx = out[(i + 1) % out.length]!;
    const a = d.poly[d.poly.length - 1]!, b = nx.poly[0]!;
    const gapTol = 1e-9 * Math.max(1, Math.abs(a.x), Math.abs(a.y));
    if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= gapTol) continue;
    const vertex = rb.points[d.vEnd]!;
    if (!uvGapCollapses(kernel, s, a, b, vertex)) return fail(`loop ${loop} jumps in (u, v)`, face);
    withPoles.push({ kind: 'pole', edge: undefined, reversed: false, pcurve: undefined, imprint: undefined, from: -1, to: -1, poly: [a, b], vStart: d.vEnd, vEnd: d.vEnd });
  }
  // Arrangement coordinates: v negated on a reversed face.
  for (const d of withPoles) d.poly = d.poly.map((p) => vec2(p.x, flip * p.y));
  return ok(withPoles);
}

/** Nodes of a face arrangement: one per place a vertex occupies in `(u, v)`. */
class Nodes {
  readonly uv: Point2[] = [];
  readonly vertex: VertexId[] = [];
  readonly sites = new Map<VertexId, number[]>();
  add(v: VertexId, uv: Point2): number {
    this.uv.push(uv);
    this.vertex.push(v);
    const list = this.sites.get(v);
    if (list === undefined) this.sites.set(v, [this.uv.length - 1]);
    else list.push(this.uv.length - 1);
    return this.uv.length - 1;
  }
  /** The node of `v` at `uv` within `tol` (max norm), else a new one. */
  at(v: VertexId, uv: Point2, tol: number): number {
    for (const n of this.sites.get(v) ?? []) {
      const q = this.uv[n]!;
      if (Math.max(Math.abs(q.x - uv.x), Math.abs(q.y - uv.y)) <= tol) return n;
    }
    return this.add(v, uv);
  }
}

interface FaceImprintEdge {
  readonly edge: EdgeId;
  readonly pcurve: NurbsCurve;
  readonly start: VertexId;
  readonly end: VertexId;
  readonly closed: boolean;
}

/** Splits one face along its imprinted edges (step 4 and 5); returns the loops of each fragment. */
function splitFace(
  rb: Rebuild,
  brep: Brep,
  face: FaceId,
  subs: readonly SubEdge[][],
  imprints: readonly FaceImprintEdge[],
): Result<{ readonly loops: CoedgeUse[][]; readonly faces: number }[]> {
  const f = brep.faces[face]!;
  const flip = f.reversed ? -1 : 1;
  const nodes = new Nodes();
  const darts: Dart[] = [];
  for (const l of f.loops) {
    const ds = loopDarts(rb, brep, face, l, subs, flip);
    if (!ds.ok) return ds;
    for (const d of ds.value) {
      const p0 = d.poly[0]!, p1 = d.poly[d.poly.length - 1]!;
      const tol = (p: Point2): number => 1e-9 * Math.max(1, Math.abs(p.x), Math.abs(p.y));
      d.from = nodes.at(d.vStart, p0, tol(p0));
      d.to = nodes.at(d.vEnd, p1, tol(p1));
      darts.push(d);
    }
  }
  const toArr = (p: Point2): Point2 => vec2(p.x, flip * p.y);
  /** The node of an imprinted curve's end at `uv` (arrangement coordinates) on vertex `v` (see the module comment). */
  const nodeFor = (v: VertexId, uv: Point2): number => {
    const sites = nodes.sites.get(v);
    if (sites === undefined) return nodes.add(v, uv);
    // At a pole: the pole dart whose u-span holds uv.x is split there.
    for (const [i, d] of darts.entries()) {
      if (d.kind !== 'pole' || d.vStart !== v) continue;
      const a = nodes.uv[d.from]!, b = nodes.uv[d.to]!;
      const tol = 1e-9 * Math.max(1, Math.abs(uv.x));
      if (Math.abs(uv.x - a.x) <= tol) return d.from;
      if (Math.abs(uv.x - b.x) <= tol) return d.to;
      if ((uv.x - a.x) * (uv.x - b.x) < 0) {
        const n = nodes.add(v, vec2(uv.x, a.y + ((b.y - a.y) * (uv.x - a.x)) / (b.x - a.x)));
        const second: Dart = { ...d, from: n, to: d.to, poly: [nodes.uv[n]!, b] };
        d.to = n;
        d.poly = [a, nodes.uv[n]!];
        darts.splice(i + 1, 0, second);
        return n;
      }
    }
    let best = sites[0]!, bestD = Infinity;
    for (const n of sites) {
      const q = nodes.uv[n]!;
      const dd = Math.hypot(q.x - uv.x, q.y - uv.y);
      if (dd < bestD) {
        bestD = dd;
        best = n;
      }
    }
    return best;
  };
  const imprintNodes: [number, number][] = [];
  for (const [k, im] of imprints.entries()) {
    const [a, b] = curveDomain(im.pcurve);
    const s0 = evaluateCurve(im.pcurve, a);
    if (!s0.ok) return s0;
    const s1 = evaluateCurve(im.pcurve, b);
    if (!s1.ok) return s1;
    const n0 = nodeFor(im.start, toArr(vec2(s0.value[0]!, s0.value[1]!)));
    const n1 = nodeFor(im.end, toArr(vec2(s1.value[0]!, s1.value[1]!)));
    const u0 = toArr(nodes.uv[n0]!), u1 = toArr(nodes.uv[n1]!);
    const snapped = snapPcurve(im.pcurve, u0, u1);
    if (!snapped.ok) return snapped;
    const back = reverseNurbsCurve(snapped.value);
    if (!back.ok) return back;
    const poly = samplePcurve(snapped.value);
    if (!poly.ok) return poly;
    const arr = poly.value.map(toArr);
    arr[0] = nodes.uv[n0]!;
    arr[arr.length - 1] = nodes.uv[n1]!;
    const base = { kind: 'imprint' as const, edge: im.edge, imprint: k };
    darts.push({ ...base, reversed: false, pcurve: snapped.value, from: n0, to: n1, poly: arr, vStart: im.start, vEnd: im.end });
    darts.push({ ...base, reversed: true, pcurve: back.value, from: n1, to: n0, poly: [...arr].reverse(), vStart: im.end, vEnd: im.start });
    imprintNodes.push([n0, n1]);
  }
  // Step 5: the counting model's steps for the imprinted curves (attached first, union-find over components).
  const uf = disjointSets(nodes.uv.length);
  const inGraph = new Array<boolean>(nodes.uv.length).fill(false);
  for (const d of darts) {
    if (d.kind === 'imprint') continue;
    inGraph[d.from] = inGraph[d.to] = true;
    uf.union(d.from, d.to);
  }
  const ops: ImprintOp[] = [];
  const todo = imprintNodes.map((_, i) => i);
  while (todo.length > 0) {
    let pick = todo.findIndex((i) => inGraph[imprintNodes[i]![0]]! || inGraph[imprintNodes[i]![1]]!);
    if (pick < 0) pick = 0;
    const [x, y] = imprintNodes[todo[pick]!]!;
    todo.splice(pick, 1);
    let op: ImprintOp;
    if (x === y) op = inGraph[x] ? 'chord' : 'ring';
    else if (inGraph[x] && inGraph[y]) op = uf.find(x) === uf.find(y) ? 'chord' : 'bridge';
    else if (inGraph[x] || inGraph[y]) op = 'spur';
    else op = 'free-edge';
    ops.push(op);
    inGraph[x] = inGraph[y] = true;
    uf.union(x, y);
  }
  const predicted = applyImprintOps({ v: 0, e: 0, f: 1, l: f.loops.length }, ops);
  const sub = arrangementFaces(darts);
  if (!sub.ok) return { ok: false, error: { ...sub.error, operation: OP } as SolidError };
  let loops = 0;
  for (const sf of sub.value) {
    loops += 1 + sf.holes.length;
    for (const cyc of [sf.outer, ...sf.holes]) {
      const seen = new Set<number>();
      for (const d of cyc) {
        const im = darts[d]!.imprint;
        if (im === undefined) continue;
        if (seen.has(im)) return fail('non-manifold imprint: a fragment uses both sides of an imprinted curve', face);
        seen.add(im);
      }
    }
  }
  if (sub.value.length !== predicted.f || loops !== predicted.l) {
    return fail(`imprint arrangement has ${sub.value.length} faces and ${loops} loops, the counting model ${predicted.f} and ${predicted.l}`, face);
  }
  rb.ops.push(...ops);
  const uses = (cyc: readonly number[]): CoedgeUse[] => {
    const real = cyc.filter((d) => darts[d]!.kind !== 'pole');
    return real.map((d) => {
      const dd = darts[d]!;
      return dd.pcurve !== undefined ? { edge: dd.edge!, reversed: dd.reversed, pcurve: dd.pcurve } : { edge: dd.edge!, reversed: dd.reversed };
    });
  };
  return ok(sub.value.map((sf) => ({ loops: [uses(sf.outer), ...sf.holes.map(uses)], faces: 1 })));
}

/**
 * Imprints `body` (see the module comment): `cuts` per edge, `imprints` per face. `sourceBody` labels the
 * fragments. Errors: the preparation errors of `prepareBody`, `invalid-topology` (`boolean.imprint`) for a cut on
 * an existing vertex, a non-manifold imprint or an arrangement the counting model disagrees with, the errors of
 * the pcurve splitting, and the `validateBrepGeometry` error of the rebuilt body.
 */
export function imprintBody(
  kernel: Kernel,
  body: BodyInput,
  cuts: ReadonlyMap<EdgeId, readonly EdgeCut[]>,
  imprints: readonly FaceImprint[],
  sourceBody = 'A',
): Result<ImprintedBody> {
  const pb = prepared(kernel, body);
  if (!pb.ok) return pb;
  const brep = pb.value.brep;
  const rb = new Rebuild(kernel);
  const bodyIds = brep.bodies.map(() => rb.b.addBody());
  const shellIds: ShellId[] = brep.shells.map((s) => rb.b.addShell(bodyIds[s.body]!));
  for (const v of brep.vertices) {
    rb.points.push(v.point);
    rb.b.addVertex(v.point);
  }
  const subs = splitEdges(rb, brep, cuts);
  if (!subs.ok) return subs;

  // Step 3: imprinted edges per face, without duplicates.
  const tol = kernel.tolerances.zoneTol3d;
  const perFace = new Map<FaceId, (FaceImprintEdge & { mid: Point3 })[]>();
  for (const im of imprints) {
    if (brep.faces[im.face] === undefined) return err({ kind: 'not-found', operation: OP, entity: { kind: 'face', id: im.face } });
    const [t0, t1] = curveRange(im.curve);
    const p0 = curvePoint3(im.curve, t0);
    if (!p0.ok) return p0;
    const p1 = curvePoint3(im.curve, t1);
    if (!p1.ok) return p1;
    const pm = curvePoint3(im.curve, (t0 + t1) / 2);
    if (!pm.ok) return pm;
    const sv = rb.vertexAt(p0.value).id;
    const ev = im.closed ? sv : rb.vertexAt(p1.value).id;
    let closed = im.closed;
    if (sv === ev && !closed) {
      if (im.curve.kind === 'line') continue;
      closed = true;
    }
    const list = perFace.get(im.face) ?? [];
    const dup = list.some(
      (x) => ((x.start === sv && x.end === ev) || (x.start === ev && x.end === sv)) && distance3(x.mid, pm.value) <= tol,
    );
    if (dup) continue;
    const edge = rb.addEdge(sv, ev, im.curve, t0, t1, { kind: 'imprint', piece: im.piece });
    list.push({ edge, pcurve: im.pcurve, start: sv, end: ev, closed, mid: pm.value });
    perFace.set(im.face, list);
  }

  // Step 4: faces.
  const fragments: Fragment[] = [];
  for (const [fi, f] of brep.faces.entries()) {
    const fid = faceId(fi);
    const shell = shellIds[f.shell]!;
    const ims = perFace.get(fid) ?? [];
    let parts: { readonly loops: CoedgeUse[][] }[];
    if (ims.length === 0) {
      const loops: CoedgeUse[][] = [];
      for (const l of f.loops) {
        const ds = loopDarts(rb, brep, fid, l, subs.value, 1);
        if (!ds.ok) return ds;
        loops.push(
          ds.value
            .filter((d) => d.kind !== 'pole')
            .map((d) => (d.pcurve !== undefined ? { edge: d.edge!, reversed: d.reversed, pcurve: d.pcurve } : { edge: d.edge!, reversed: d.reversed })),
        );
      }
      parts = [{ loops }];
    } else {
      const sf = splitFace(rb, brep, fid, subs.value, ims);
      if (!sf.ok) return sf;
      parts = sf.value;
    }
    for (const part of parts) {
      const nf = rb.b.addFace(shell, f.surface, f.reversed);
      for (const l of part.loops) rb.b.addLoop(nf, l);
      rb.faceSource.push(fid);
      fragments.push(
        Object.freeze({
          face: nf,
          sourceBody,
          sourceFace: fid,
          surface: f.surface,
          reversed: f.reversed,
          loops: Object.freeze(part.loops.map((l) => Object.freeze(l.map((u) => Object.freeze({ ...u }))))),
        }),
      );
    }
  }
  const out = rb.b.build();
  const valid = validateBrepGeometry(kernel, out);
  if (!valid.ok) return valid;
  return ok(
    Object.freeze({
      brep: out,
      faceSource: Object.freeze(rb.faceSource),
      edgeSource: Object.freeze(rb.edgeSource),
      ops: Object.freeze(rb.ops),
      fragments: Object.freeze(fragments),
    }),
  );
}

/** Stages 1 and 2 for a pair of bodies (see the module comment). */
export interface ImprintPair {
  readonly a: ImprintedBody;
  readonly b: ImprintedBody;
  /** The face pairs that are not disjoint, in face order of A then B. */
  readonly intersections: readonly FaceFaceIntersection[];
  /** All pieces, numbered as `EdgeSource.piece` and `FaceImprint.piece`. */
  readonly pieces: readonly IntersectionPiece[];
}

function pushCut(cuts: Map<EdgeId, EdgeCut[]>, edge: EdgeId, t: number): void {
  const list = cuts.get(edge);
  if (list === undefined) cuts.set(edge, [{ t }]);
  else list.push({ t });
}

/** Cuts of the edges of `side` where they cross faces of the other body (not outside them). */
function crossingCuts(ctx: FacePairContext, side: BodySide, cuts: Map<EdgeId, EdgeCut[]>): Result<void> {
  const self = side === 'A' ? ctx.a : ctx.b;
  const otherBody: PreparedBody = side === 'A' ? ctx.b : ctx.a;
  for (let e = 0; e < self.brep.edges.length; e++) {
    for (let g = 0; g < otherBody.brep.faces.length; g++) {
      const hits = edgeSurfaceHits(ctx, side, edgeId(e), faceId(g));
      if (!hits.ok) return hits;
      for (const h of hits.value) {
        const pts = h.kind === 'point' ? [{ t: h.t, p: h.point }] : [{ t: h.t0, p: h.p0 }, { t: h.t1, p: h.p1 }];
        for (const { t, p } of pts) {
          const c = pointInFace(ctx.kernel, otherBody, faceId(g), { point: p });
          if (!c.ok) return c;
          if (c.value.class !== 'outside') pushCut(cuts, edgeId(e), t);
        }
      }
    }
  }
  return ok(undefined);
}

/**
 * Intersects every face pair of `a` and `b` and imprints both bodies (see the module comment). Errors: those of
 * `intersectFaces` (refusals included) and of `imprintBody`.
 */
export function imprintBodies(kernel: Kernel, a: BodyInput, b: BodyInput): Result<ImprintPair> {
  const ctx = facePairContext(kernel, a, b);
  if (!ctx.ok) return ctx;
  const c = ctx.value;
  const intersections: FaceFaceIntersection[] = [];
  const pieces: IntersectionPiece[] = [];
  const imprintsA: FaceImprint[] = [], imprintsB: FaceImprint[] = [];
  const cutsA = new Map<EdgeId, EdgeCut[]>(), cutsB = new Map<EdgeId, EdgeCut[]>();
  for (let fa = 0; fa < c.a.brep.faces.length; fa++) {
    for (let fb = 0; fb < c.b.brep.faces.length; fb++) {
      const r = intersectFaces(c, faceId(fa), faceId(fb));
      if (!r.ok) return r;
      if (r.value.kind === 'disjoint') continue;
      intersections.push(r.value);
      for (const p of r.value.pieces) {
        const id = pieces.length;
        pieces.push(p);
        if (p.pcurveA !== undefined && p.onBoundaryA === undefined) imprintsA.push({ face: faceId(fa), curve: p.curve, pcurve: p.pcurveA, closed: p.closed, piece: id });
        if (p.pcurveB !== undefined && p.onBoundaryB === undefined) imprintsB.push({ face: faceId(fb), curve: p.curve, pcurve: p.pcurveB, closed: p.closed, piece: id });
        for (const end of [p.start, p.end]) {
          for (const ct of end.contacts) if (ct.kind === 'edge') pushCut(ct.side === 'A' ? cutsA : cutsB, ct.edge, ct.t);
        }
      }
    }
  }
  const xa = crossingCuts(c, 'A', cutsA);
  if (!xa.ok) return xa;
  const xb = crossingCuts(c, 'B', cutsB);
  if (!xb.ok) return xb;
  const ia = imprintBody(kernel, c.a, cutsA, imprintsA, 'A');
  if (!ia.ok) return ia;
  const ib = imprintBody(kernel, c.b, cutsB, imprintsB, 'B');
  if (!ib.ok) return ib;
  return ok(Object.freeze({ a: ia.value, b: ib.value, intersections: Object.freeze(intersections), pieces: Object.freeze(pieces) }));
}
