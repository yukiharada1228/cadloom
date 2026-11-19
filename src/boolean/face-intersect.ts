/**
 * Face/face intersection trimmed to both faces — stage 1 ("intersect") of the boolean pipeline (upstream
 * `docs/booleans.md` §3): the M4 surface/surface intersection of the two faces' surfaces, cut down to the parts
 * that lie on both trimmed faces, as **pieces**: a 3D curve over `[t0, t1]`, its pcurves on the faces it crosses
 * the interior of, its end points labelled by what they lie on, and its certificate class.
 *
 * Steps of `intersectFaces` (one face pair of a `FacePairContext`):
 * 1. **Prune.** The faces' certified boxes (M4 `prepareBody`) apart by more than `xsectTol3d`: `disjoint`.
 * 2. **SSI.** `intersectSurfaces` on the two surfaces as patches over the faces' `(u, v)` boxes. A refusal is
 *    returned as is (`refusalReason` names it). A coincident answer (same plane, same cylinder, ...) goes to 5.
 * 3. **Trim** each curve component `C` over its range (closed components over their whole period):
 *    - candidates: every boundary edge of A against B's surface and every boundary edge of B against A's surface
 *      (M4 `intersectCurveSurface`; an edge lies on its own face, so where it meets the other surface it meets the
 *      intersection curve), kept when within `zoneTol3d` of `C` (M1 `closestPointOnCurve` gives the parameter on
 *      `C`); an edge lying on the other surface (an overlap) gives both its ends;
 *    - candidates within `zoneTol3d` of each other are one (their labels united); a closed NURBS branch also
 *      gets its own start as a candidate (its pieces cannot wrap past the end of the knot domain);
 *    - each arc between consecutive candidates (open curves also from / to their range ends) is classified at its
 *      middle by the M4 `pointInFace` on both faces; an arc is kept when neither face says `outside`. Slivers are
 *      dropped: an arc whose ends and middle lie within `xsectTol3d` of each other, and an arc from a free end of
 *      an open curve (an SSI line is clipped to the patch boxes padded by `xsectTol3d`) that runs `on` a boundary. An arc whose
 *      middle is `on` a face runs along that face's boundary edge (`onBoundaryA` / `onBoundaryB`): it is not
 *      imprinted on that face (the edge is already there) and gets no pcurve there.
 * 4. **Labels and pcurves.** A piece end carries its contacts: on vertex `v` of A or B (within `zoneTol3d` of
 *    it), on edge `e` of A or B at edge parameter `t`; no contact means the end is inside both faces (only possible
 *    at the free end of an open curve). Pcurves come from `piecePcurve` (exact on planes, rulings and coaxial
 *    circles; fitted and measured otherwise). A component with `contact: 'tangent'` that keeps any piece, and an
 *    isolated SSI point that lies on both faces, are refused: `tangent contact not resolved` (the boolean does not
 *    resolve tangencies; never a silently wrong answer).
 * 5. **Coincident faces.** Two faces on one surface share the region where both are; its boundary is made of
 *    their edges. Each boundary edge of A is cut where it meets edges of B (M4 `intersectCurves`, crossings and
 *    overlaps) and, when closed, at its own vertex, and the parts whose middles are not `outside` B are kept; then each edge of B against A, keeping
 *    the parts strictly `inside` A (an edge part on both boundaries is reported once, from A). The record says
 *    whether the outward normals agree (`sameOrientation`).
 *
 * Every piece is frozen; pieces are listed per component in the curve's parameter order, components in the M4
 * order (deterministic). Not certified: the arc classification is the M4 point-in-face of the arc's middle (exact
 * for straight `(u, v)` trims, polygonal within the edge band for curved ones), and fitted pcurves are measured.
 *
 * Upstream consulted (for the method, not translated): `solidcore/docs/booleans.md` §3 (stage 1 "intersect": face
 * pairs whose boxes meet, the coincidence check, else SSI; curves classified on both faces), §5 (coincident faces
 * give their edge curves trimmed to each other), §6 (tangent contacts), §7 (trimming);
 * `solidcore/crates/solidcore/src/boolean/topology_intersector.rs`, `boolean/topology_intersector/curve_class.rs`
 * (classifying intersection curve intervals as in / on / out of a face), `boolean/topology_intersector/topology_solver.rs`
 * (curve against face boundary edges), `solidcore/crates/solidcore/src/topology/face/p3.rs` (`face_intersect`) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import { boxesDisjoint3 } from '../interval/box.ts';
import { intersectCurves } from '../intersect/curve-curve.ts';
import { intersectCurveSurface } from '../intersect/curve-surface.ts';
import { surfacePatch, type SurfacePatch } from '../intersect/ssi-types.ts';
import { intersectSurfaces } from '../intersect/surface-surface.ts';
import { combineClass, refusal, type IntersectionClass, type SurfaceSurfaceCurve } from '../intersect/types.ts';
import { distance3, dot3, type Point3 } from '../math/vec.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';
import { prepared, type BodyInput, type FaceDomain, type PreparedBody } from '../query/domain.ts';
import { pointInFace, type PointClass } from '../query/face.ts';
import { surfaceDomain } from '../nurbs/surface.ts';
import type { EdgeId, FaceId, VertexId } from '../topology/brep.ts';
import { faceNormalAt, surfaceUv } from '../topology/geometry.ts';
import { piecePcurve } from './face-intersect-pcurve.ts';
import { restrictCurve } from './split.ts';

const OP = 'boolean.faceFaceIntersection';
const TWO_PI = 2 * Math.PI;

/** Which operand of a pair an entity belongs to. */
export type BodySide = 'A' | 'B';

/** What a piece end lies on: a vertex, or an edge at edge parameter `t`, of operand `side`. */
export type EndContact =
  | { readonly side: BodySide; readonly kind: 'vertex'; readonly vertex: VertexId }
  | { readonly side: BodySide; readonly kind: 'edge'; readonly edge: EdgeId; readonly t: number };

/** One end of a piece: its parameter on the piece's curve, its point and its contacts (none: inside both faces). */
export interface PieceEnd {
  readonly t: number;
  readonly point: Point3;
  readonly contacts: readonly EndContact[];
}

/**
 * A piece of a face/face intersection: `curve` over `[t0, t1]` (its range; a NURBS piece is cut out to its own
 * knot domain), running from `start` to `end`. `closed` pieces are whole closed curves lying inside both faces
 * (`start` and `end` are one point). `pcurveA` / `pcurveB` (in the curve's direction) are present on the faces
 * whose interior the piece crosses; `onBoundaryA` / `onBoundaryB` name the edge the piece runs along instead.
 */
export interface IntersectionPiece {
  readonly curve: Curve3;
  readonly t0: number;
  readonly t1: number;
  readonly closed: boolean;
  readonly start: PieceEnd;
  readonly end: PieceEnd;
  readonly class: IntersectionClass;
  readonly deviation: number;
  readonly pcurveA?: NurbsCurve;
  readonly pcurveB?: NurbsCurve;
  readonly onBoundaryA?: EdgeId;
  readonly onBoundaryB?: EdgeId;
  /** `ssi`: a surface/surface curve; `boundary-A` / `boundary-B`: an edge of that face (coincident faces). */
  readonly source: 'ssi' | 'boundary-A' | 'boundary-B';
}

/** The faces' boxes are apart: no intersection. */
export interface FaceFaceDisjoint {
  readonly kind: 'disjoint';
  readonly faceA: FaceId;
  readonly faceB: FaceId;
}

/** Transversal intersection curves trimmed to both faces (possibly none). */
export interface FaceFaceCurves {
  readonly kind: 'curves';
  readonly faceA: FaceId;
  readonly faceB: FaceId;
  readonly class: IntersectionClass;
  readonly pieces: readonly IntersectionPiece[];
}

/** The faces lie on one surface: `pieces` bound their overlap region (empty when they do not overlap). */
export interface FaceFaceCoincident {
  readonly kind: 'coincident';
  readonly faceA: FaceId;
  readonly faceB: FaceId;
  /** Whether the two faces' outward normals agree. */
  readonly sameOrientation: boolean;
  readonly class: IntersectionClass;
  readonly pieces: readonly IntersectionPiece[];
}

export type FaceFaceIntersection = FaceFaceDisjoint | FaceFaceCurves | FaceFaceCoincident;

/** A meeting of an edge with a surface, in the edge's own parameter. */
export type EdgeSurfaceHit =
  | { readonly kind: 'point'; readonly t: number; readonly point: Point3 }
  | { readonly kind: 'overlap'; readonly t0: number; readonly t1: number; readonly p0: Point3; readonly p1: Point3 };

/** Two operands prepared for face/face work, with a cache of edge/surface meetings (per call; no global state). */
export interface FacePairContext {
  readonly kernel: Kernel;
  readonly a: PreparedBody;
  readonly b: PreparedBody;
  readonly edgeHits: Map<string, Result<readonly EdgeSurfaceHit[]>>;
}

/** Prepares (or takes) both operands (M4 `prepareBody`). */
export function facePairContext(kernel: Kernel, a: BodyInput, b: BodyInput): Result<FacePairContext> {
  const pa = prepared(kernel, a);
  if (!pa.ok) return pa;
  const pb = prepared(kernel, b);
  if (!pb.ok) return pb;
  return ok({ kernel, a: pa.value, b: pb.value, edgeHits: new Map() });
}

const bodyOf = (ctx: FacePairContext, side: BodySide): PreparedBody => (side === 'A' ? ctx.a : ctx.b);
const other = (side: BodySide): BodySide => (side === 'A' ? 'B' : 'A');

function domainOf(ctx: FacePairContext, side: BodySide, face: FaceId): Result<FaceDomain> {
  const d = bodyOf(ctx, side).faces[face];
  return d === undefined ? err({ kind: 'not-found', operation: OP, entity: { kind: 'face', id: face } }) : ok(d);
}

/** The edge's curve over its interval (`restrictCurve`). */
export function edgeCurve(body: PreparedBody, edge: EdgeId): Result<Curve3> {
  const e = body.brep.edges[edge];
  if (e === undefined) return err({ kind: 'not-found', operation: OP, entity: { kind: 'edge', id: edge } });
  return restrictCurve(e.curve, e.t0, e.t1);
}

/**
 * Where edge `edge` of operand `side` meets the surface of face `face` of the other operand (M4
 * `intersectCurveSurface`, cached in the context). Points and overlaps in the edge's parameter.
 */
export function edgeSurfaceHits(ctx: FacePairContext, side: BodySide, edge: EdgeId, face: FaceId): Result<readonly EdgeSurfaceHit[]> {
  const key = `${side}:${edge}:${face}`;
  const cached = ctx.edgeHits.get(key);
  if (cached !== undefined) return cached;
  const r = computeEdgeSurfaceHits(ctx, side, edge, face);
  ctx.edgeHits.set(key, r);
  return r;
}

function computeEdgeSurfaceHits(ctx: FacePairContext, side: BodySide, edge: EdgeId, face: FaceId): Result<readonly EdgeSurfaceHit[]> {
  const body = bodyOf(ctx, side);
  const dom = domainOf(ctx, other(side), face);
  if (!dom.ok) return dom;
  const box = body.edgeBoxes[edge];
  if (box !== undefined) {
    const apart = boxesDisjoint3(box, dom.value.box, ctx.kernel.tolerances.xsectTol3d);
    if (!apart.ok) return apart;
    if (apart.value) return ok([]);
  }
  const c = edgeCurve(body, edge);
  if (!c.ok) return c;
  const r = intersectCurveSurface(ctx.kernel, c.value, dom.value.surface);
  if (!r.ok) return r;
  const out: EdgeSurfaceHit[] = [];
  for (const h of r.value.hits) {
    if (h.kind === 'point') out.push(Object.freeze({ kind: 'point', t: h.t, point: h.point }));
    else {
      const p0 = curvePoint3(c.value, h.range[0]);
      if (!p0.ok) return p0;
      const p1 = curvePoint3(c.value, h.range[1]);
      if (!p1.ok) return p1;
      out.push(Object.freeze({ kind: 'overlap', t0: h.range[0], t1: h.range[1], p0: p0.value, p1: p1.value }));
    }
  }
  return ok(Object.freeze(out));
}

/** The contact of a point at edge parameter `t` of `edge`: its vertex when within `zoneTol3d`, else the edge. */
export function edgeContact(ctx: FacePairContext, side: BodySide, edge: EdgeId, t: number, p: Point3): EndContact {
  const brep = bodyOf(ctx, side).brep;
  const e = brep.edges[edge]!;
  const tol = ctx.kernel.tolerances.zoneTol3d;
  for (const v of [e.start, e.end]) {
    if (distance3(brep.vertices[v]!.point, p) <= tol) return Object.freeze({ side, kind: 'vertex', vertex: v });
  }
  return Object.freeze({ side, kind: 'edge', edge, t });
}

const sameContact = (a: EndContact, b: EndContact): boolean =>
  a.side === b.side && a.kind === b.kind && (a.kind === 'vertex' ? a.vertex === (b as { vertex: VertexId }).vertex : a.edge === (b as { edge: EdgeId }).edge);

function unite(a: readonly EndContact[], b: readonly EndContact[]): EndContact[] {
  const out = [...a];
  for (const c of b) if (!out.some((x) => sameContact(x, c))) out.push(c);
  return out;
}

interface Candidate {
  t: number;
  point: Point3;
  contacts: EndContact[];
}

/** The class of a point on a face, with the boundary edge it lies on (for `on`). */
interface FaceClass {
  readonly cls: PointClass;
  readonly edge?: EdgeId;
}

function classifyOn(ctx: FacePairContext, side: BodySide, face: FaceId, p: Point3): Result<FaceClass> {
  const r = pointInFace(ctx.kernel, bodyOf(ctx, side), face, { point: p });
  if (!r.ok) return r;
  const b = r.value.boundary;
  return ok(r.value.class === 'on' && b !== undefined && b.kind === 'edge' ? { cls: 'on', edge: b.id as EdgeId } : { cls: r.value.class });
}

/** A kept arc of a trimmed curve, before its pcurves. */
interface Arc {
  readonly t0: number;
  readonly t1: number;
  readonly closed: boolean;
  readonly start: PieceEnd;
  readonly end: PieceEnd;
  readonly onA?: EdgeId;
  readonly onB?: EdgeId;
  readonly midA: PointClass;
  readonly midB: PointClass;
}

/**
 * Splits `curve` at the candidates and keeps the arcs `keep` accepts (see the module comment, step 3). `closed`:
 * the curve is a whole closed curve (its range one period). `endContacts` label the range ends of an open curve.
 */
function trimCurve(
  ctx: FacePairContext,
  curve: Curve3,
  closed: boolean,
  raw: readonly Candidate[],
  endContacts: readonly [readonly EndContact[], readonly EndContact[]],
  classify: (p: Point3) => Result<{ readonly a: FaceClass; readonly b: FaceClass }>,
  keep: (a: FaceClass, b: FaceClass) => boolean,
): Result<Arc[]> {
  const tol = ctx.kernel.tolerances.zoneTol3d;
  const [r0, r1] = curveRange(curve);
  const period = r1 - r0;
  const norm = (t: number): number => {
    if (!closed) return Math.min(r1, Math.max(r0, t));
    let x = r0 + ((((t - r0) % period) + period) % period);
    if (x >= r1) x = r0;
    return x;
  };
  const at = (t: number): Result<Point3> => curvePoint3(curve, norm(t));
  const cands: Candidate[] = raw.map((c) => ({ t: norm(c.t), point: c.point, contacts: [...c.contacts] }));
  if (closed && curve.kind === 'nurbs') {
    const p = at(r0);
    if (!p.ok) return p;
    cands.push({ t: r0, point: p.value, contacts: [] });
  }
  cands.sort((x, y) => x.t - y.t);
  const merged: Candidate[] = [];
  for (const c of cands) {
    const last = merged[merged.length - 1];
    if (last !== undefined && distance3(last.point, c.point) <= tol) {
      last.contacts = unite(last.contacts, c.contacts);
      // A point at the start of a closed NURBS domain keeps that parameter (its arcs cannot wrap).
      if (closed && curve.kind === 'nurbs' && c.t === r0) last.t = r0;
    } else merged.push(c);
  }
  if (closed && merged.length >= 2 && distance3(merged[0]!.point, merged[merged.length - 1]!.point) <= tol) {
    const last = merged.pop()!;
    merged[0]!.contacts = unite(merged[0]!.contacts, last.contacts);
  }
  type End = { t: number; point: Point3; contacts: EndContact[] };
  const ends: End[] = [];
  if (closed) {
    if (merged.length === 0) {
      const p = at(r0);
      if (!p.ok) return p;
      ends.push({ t: r0, point: p.value, contacts: [] }, { t: r1, point: p.value, contacts: [] });
    } else {
      for (const m of merged) ends.push(m);
      const first = merged[0]!;
      ends.push({ t: curve.kind === 'nurbs' && first.t === r0 ? r1 : first.t + period, point: first.point, contacts: first.contacts });
    }
  } else {
    const p0 = at(r0);
    if (!p0.ok) return p0;
    const p1 = at(r1);
    if (!p1.ok) return p1;
    const inner = merged.filter((m) => m.t > r0 && m.t < r1);
    const startC: End = { t: r0, point: p0.value, contacts: [...endContacts[0]] };
    const endC: End = { t: r1, point: p1.value, contacts: [...endContacts[1]] };
    for (const m of merged) {
      if (distance3(m.point, p0.value) <= tol) startC.contacts = unite(startC.contacts, m.contacts);
      else if (distance3(m.point, p1.value) <= tol) endC.contacts = unite(endC.contacts, m.contacts);
    }
    ends.push(startC, ...inner.filter((m) => distance3(m.point, p0.value) > tol && distance3(m.point, p1.value) > tol), endC);
  }
  const arcs: Arc[] = [];
  const wholeLoop = closed && merged.length === 0;
  for (let i = 0; i + 1 < ends.length; i++) {
    const s = ends[i]!, e = ends[i + 1]!;
    if (!(e.t > s.t)) continue;
    const mid = at((s.t + e.t) / 2);
    if (!mid.ok) return mid;
    // A sliver within the intersection tolerance is no piece (an SSI line is clipped to the patch boxes padded by
    // xsectTol3d, so it may run that far past a face's edge).
    const xt = ctx.kernel.tolerances.xsectTol3d;
    if (!wholeLoop && distance3(mid.value, s.point) <= xt && distance3(mid.value, e.point) <= xt && distance3(s.point, e.point) <= xt) continue;
    const c = classify(mid.value);
    if (!c.ok) return c;
    if (!keep(c.value.a, c.value.b)) continue;
    // An arc from a free curve end (no contact) along a face's boundary is the same overrun.
    const freeEnd = s.contacts.length === 0 || e.contacts.length === 0;
    if (!wholeLoop && freeEnd && (c.value.a.cls === 'on' || c.value.b.cls === 'on')) continue;
    const freezeEnd = (x: End): PieceEnd => Object.freeze({ t: x.t, point: Object.freeze({ ...x.point }), contacts: Object.freeze([...x.contacts]) });
    arcs.push({
      t0: s.t,
      t1: e.t,
      closed: wholeLoop,
      start: freezeEnd(s),
      end: freezeEnd(e),
      ...(c.value.a.cls === 'on' && c.value.a.edge !== undefined ? { onA: c.value.a.edge } : {}),
      ...(c.value.b.cls === 'on' && c.value.b.edge !== undefined ? { onB: c.value.b.edge } : {}),
      midA: c.value.a.cls,
      midB: c.value.b.cls,
    });
  }
  return ok(arcs);
}

/** The candidates on `curve` from the edges of face `face` of operand `side` meeting the other face's surface. */
function boundaryCandidates(ctx: FacePairContext, curve: Curve3, side: BodySide, face: FaceId, otherFace: FaceId): Result<Candidate[]> {
  const dom = domainOf(ctx, side, face);
  if (!dom.ok) return dom;
  const tol = ctx.kernel.tolerances.zoneTol3d;
  const out: Candidate[] = [];
  const add = (edge: EdgeId, t: number, p: Point3): Result<void> => {
    const cp = closestPointOnCurve(curve, p);
    if (!cp.ok) return cp;
    if (cp.value.distance <= tol) out.push({ t: cp.value.t, point: p, contacts: [edgeContact(ctx, side, edge, t, p)] });
    return ok(undefined);
  };
  for (const edge of dom.value.edges) {
    const hits = edgeSurfaceHits(ctx, side, edge, otherFace);
    if (!hits.ok) return hits;
    for (const h of hits.value) {
      const r = h.kind === 'point' ? add(edge, h.t, h.point) : add(edge, h.t0, h.p0);
      if (!r.ok) return r;
      if (h.kind === 'overlap') {
        const r2 = add(edge, h.t1, h.p1);
        if (!r2.ok) return r2;
      }
    }
  }
  return ok(out);
}

/** The patch of a face for SSI: its surface over its `(u, v)` box (angular ranges at most a period). */
function facePatch(dom: FaceDomain): Result<SurfacePatch> {
  let [u0, u1] = [dom.uvBox.min.x, dom.uvBox.max.x];
  let [v0, v1] = [dom.uvBox.min.y, dom.uvBox.max.y];
  const s = dom.surface;
  if (s.kind !== 'plane' && s.kind !== 'nurbs' && u1 - u0 > TWO_PI) u1 = u0 + TWO_PI;
  if (s.kind === 'torus' && v1 - v0 > TWO_PI) v1 = v0 + TWO_PI;
  if (s.kind === 'sphere') {
    v0 = Math.max(v0, -Math.PI / 2);
    v1 = Math.min(v1, Math.PI / 2);
  }
  if (s.kind === 'nurbs') {
    const d = surfaceDomain(s.surface);
    u0 = Math.max(u0, d.u[0]);
    u1 = Math.min(u1, d.u[1]);
    v0 = Math.max(v0, d.v[0]);
    v1 = Math.min(v1, d.v[1]);
  }
  return surfacePatch(s, { u: [u0, u1], v: [v0, v1] });
}

/** Builds the frozen piece of an arc: the restricted curve and the pcurves on the faces whose interior it crosses. */
function makePiece(
  ctx: FacePairContext,
  curve: Curve3,
  arc: Arc,
  domA: FaceDomain,
  domB: FaceDomain,
  cls: IntersectionClass,
  deviation: number,
  source: IntersectionPiece['source'],
  wantA: boolean,
  wantB: boolean,
): Result<IntersectionPiece> {
  const c = restrictCurve(curve, arc.t0, arc.t1);
  if (!c.ok) return c;
  const [t0, t1] = curveRange(c.value);
  let pcurveA: NurbsCurve | undefined;
  let pcurveB: NurbsCurve | undefined;
  if (wantA) {
    const p = piecePcurve(ctx.kernel, domA, c.value);
    if (!p.ok) return p;
    pcurveA = p.value;
  }
  if (wantB) {
    const p = piecePcurve(ctx.kernel, domB, c.value);
    if (!p.ok) return p;
    pcurveB = p.value;
  }
  return ok(
    Object.freeze({
      curve: c.value,
      t0,
      t1,
      closed: arc.closed,
      start: arc.start,
      end: arc.end,
      class: cls,
      deviation,
      ...(pcurveA !== undefined ? { pcurveA } : {}),
      ...(pcurveB !== undefined ? { pcurveB } : {}),
      ...(arc.onA !== undefined ? { onBoundaryA: arc.onA } : {}),
      ...(arc.onB !== undefined ? { onBoundaryB: arc.onB } : {}),
      source,
    }),
  );
}

const notOutside = (a: FaceClass, b: FaceClass): boolean => a.cls !== 'outside' && b.cls !== 'outside';

function trimComponent(
  ctx: FacePairContext,
  faceA: FaceId,
  faceB: FaceId,
  domA: FaceDomain,
  domB: FaceDomain,
  comp: SurfaceSurfaceCurve,
): Result<IntersectionPiece[]> {
  const ca = boundaryCandidates(ctx, comp.curve, 'A', faceA, faceB);
  if (!ca.ok) return ca;
  const cb = boundaryCandidates(ctx, comp.curve, 'B', faceB, faceA);
  if (!cb.ok) return cb;
  const classify = (p: Point3): Result<{ a: FaceClass; b: FaceClass }> => {
    const a = classifyOn(ctx, 'A', faceA, p);
    if (!a.ok) return a;
    const b = classifyOn(ctx, 'B', faceB, p);
    if (!b.ok) return b;
    return ok({ a: a.value, b: b.value });
  };
  const arcs = trimCurve(ctx, comp.curve, comp.closed, [...ca.value, ...cb.value], [[], []], classify, notOutside);
  if (!arcs.ok) return arcs;
  if (arcs.value.length > 0 && comp.contact === 'tangent') return err(refusal(OP, 'tangent contact not resolved'));
  const out: IntersectionPiece[] = [];
  for (const arc of arcs.value) {
    const p = makePiece(ctx, comp.curve, arc, domA, domB, comp.class, comp.deviation, 'ssi', arc.midA === 'inside', arc.midB === 'inside');
    if (!p.ok) return p;
    out.push(p.value);
  }
  return ok(out);
}

/**
 * Whether the outward normals of the two coincident faces agree. The surfaces are one, so any point of it where
 * both faces' normals are regular decides: a few fixed points of A's `(u, v)` box are tried in order (a vertex,
 * or the box middle, may be a pole or apex of either surface, where the normal is degenerate).
 */
function sameOrientation(ctx: FacePairContext, domA: FaceDomain, faceA: FaceId, domB: FaceDomain, faceB: FaceId): Result<boolean> {
  const sa = domA.surface, sb = domB.surface;
  if (sa.kind === 'plane' && sb.kind === 'plane') {
    const na = dot3(sa.frame.normal, sb.frame.normal);
    return ok((na > 0) === (domA.reversed === domB.reversed));
  }
  const { min, max } = domA.uvBox;
  let last: Result<boolean> = err({ kind: 'degenerate', operation: OP });
  for (const [fu, fv] of [[0.5, 0.5], [0.3, 0.4], [0.7, 0.6], [0.2, 0.7], [0.8, 0.3]] as const) {
    const u = min.x + fu * (max.x - min.x), v = min.y + fv * (max.y - min.y);
    const p = surfacePoint3(sa, u, v);
    if (!p.ok) return p;
    const ub = surfaceUv(ctx.kernel, sb, p.value);
    if (!ub.ok) return ub;
    const na = faceNormalAt(ctx.kernel, ctx.a.brep, faceA, u, v);
    const nb = faceNormalAt(ctx.kernel, ctx.b.brep, faceB, ub.value.x, ub.value.y);
    if (!na.ok) {
      last = na;
      continue;
    }
    if (!nb.ok) {
      last = nb;
      continue;
    }
    return ok(dot3(na.value, nb.value) > 0);
  }
  return last;
}

/** A crossing of edge `ea` of A with edge `eb` of B: parameters on both and the point (overlaps give two). */
interface EdgeEdgeHit {
  readonly tA: number;
  readonly tB: number;
  readonly point: Point3;
}

function edgeEdgeHits(ctx: FacePairContext, ea: EdgeId, eb: EdgeId): Result<EdgeEdgeHit[]> {
  const boxA = ctx.a.edgeBoxes[ea], boxB = ctx.b.edgeBoxes[eb];
  if (boxA !== undefined && boxB !== undefined) {
    const apart = boxesDisjoint3(boxA, boxB, ctx.kernel.tolerances.xsectTol3d);
    if (!apart.ok) return apart;
    if (apart.value) return ok([]);
  }
  const ca = edgeCurve(ctx.a, ea);
  if (!ca.ok) return ca;
  const cb = edgeCurve(ctx.b, eb);
  if (!cb.ok) return cb;
  const r = intersectCurves(ctx.kernel, ca.value, cb.value);
  if (!r.ok) return r;
  const out: EdgeEdgeHit[] = [];
  for (const h of r.value.hits) {
    if (h.kind === 'point') out.push({ tA: h.tA, tB: h.tB, point: h.point });
    else {
      for (const k of [0, 1] as const) {
        const tA = h.rangeA[k];
        const tB = h.sameDirection ? h.rangeB[k] : h.rangeB[1 - k]!;
        const p = curvePoint3(ca.value, tA);
        if (!p.ok) return p;
        out.push({ tA, tB, point: p.value });
      }
    }
  }
  return ok(out);
}

function coincidentPieces(ctx: FacePairContext, faceA: FaceId, faceB: FaceId, domA: FaceDomain, domB: FaceDomain): Result<IntersectionPiece[]> {
  const hits = new Map<string, EdgeEdgeHit[]>();
  for (const ea of domA.edges) {
    for (const eb of domB.edges) {
      const h = edgeEdgeHits(ctx, ea, eb);
      if (!h.ok) return h;
      hits.set(`${ea}:${eb}`, h.value);
    }
  }
  const pieces: IntersectionPiece[] = [];
  for (const side of ['A', 'B'] as const) {
    const dom = side === 'A' ? domA : domB, otherDom = side === 'A' ? domB : domA;
    const otherFace = side === 'A' ? faceB : faceA;
    const body = bodyOf(ctx, side);
    for (const e of dom.edges) {
      const curve = edgeCurve(body, e);
      if (!curve.ok) return curve;
      const ed = body.brep.edges[e]!;
      const cands: Candidate[] = [];
      for (const f of otherDom.edges) {
        for (const h of hits.get(side === 'A' ? `${e}:${f}` : `${f}:${e}`) ?? []) {
          const tSelf = side === 'A' ? h.tA : h.tB, tOther = side === 'A' ? h.tB : h.tA;
          cands.push({
            t: tSelf,
            point: h.point,
            contacts: [edgeContact(ctx, side, e, tSelf, h.point), edgeContact(ctx, other(side), f, tOther, h.point)],
          });
        }
      }
      const startV: EndContact = Object.freeze({ side, kind: 'vertex', vertex: ed.start });
      const endV: EndContact = Object.freeze({ side, kind: 'vertex', vertex: ed.end });
      // A closed edge's own vertex splits its parts too (other imprinted edges may end there).
      if (ed.start === ed.end) cands.push({ t: curveRange(curve.value)[0], point: body.brep.vertices[ed.start]!.point, contacts: [startV] });
      const classify = (p: Point3): Result<{ a: FaceClass; b: FaceClass }> => {
        const c = classifyOn(ctx, other(side), otherFace, p);
        if (!c.ok) return c;
        const self: FaceClass = { cls: 'on', edge: e };
        return ok(side === 'A' ? { a: self, b: c.value } : { a: c.value, b: self });
      };
      // A's edges keep their parts inside or on B; B's edges only the parts strictly inside A (no duplicates).
      const keep = side === 'A' ? notOutside : (a: FaceClass): boolean => a.cls === 'inside';
      const arcs = trimCurve(ctx, curve.value, ed.start === ed.end, cands, [[startV], [endV]], classify, keep);
      if (!arcs.ok) return arcs;
      for (const arc of arcs.value) {
        // Ends of the edge's own parts carry the edge contact of their side.
        const label = (end: PieceEnd): PieceEnd =>
          end.contacts.some((c) => c.side === side)
            ? end
            : Object.freeze({ ...end, contacts: Object.freeze([...end.contacts, Object.freeze({ side, kind: 'edge', edge: e, t: end.t } as const)]) });
        const a2: Arc = { ...arc, start: label(arc.start), end: label(arc.end) };
        const wantA = side === 'B' && arc.midA === 'inside';
        const wantB = side === 'A' && arc.midB === 'inside';
        const p = makePiece(ctx, curve.value, a2, domA, domB, 'exact', 0, side === 'A' ? 'boundary-A' : 'boundary-B', wantA, wantB);
        if (!p.ok) return p;
        pieces.push(p.value);
      }
    }
  }
  return ok(pieces);
}

/** Face/face intersection of face `faceA` of `ctx.a` with face `faceB` of `ctx.b` (see the module comment). */
export function intersectFaces(ctx: FacePairContext, faceA: FaceId, faceB: FaceId): Result<FaceFaceIntersection> {
  const domA = domainOf(ctx, 'A', faceA);
  if (!domA.ok) return domA;
  const domB = domainOf(ctx, 'B', faceB);
  if (!domB.ok) return domB;
  const apart = boxesDisjoint3(domA.value.box, domB.value.box, ctx.kernel.tolerances.xsectTol3d);
  if (!apart.ok) return apart;
  if (apart.value) return ok(Object.freeze({ kind: 'disjoint', faceA, faceB }));
  const pa = facePatch(domA.value);
  if (!pa.ok) return pa;
  const pb = facePatch(domB.value);
  if (!pb.ok) return pb;
  const ssi = intersectSurfaces(ctx.kernel, pa.value, pb.value);
  if (!ssi.ok) return ssi;
  if (ssi.value.coincident) {
    const same = sameOrientation(ctx, domA.value, faceA, domB.value, faceB);
    if (!same.ok) return same;
    const pieces = coincidentPieces(ctx, faceA, faceB, domA.value, domB.value);
    if (!pieces.ok) return pieces;
    return ok(Object.freeze({ kind: 'coincident', faceA, faceB, sameOrientation: same.value, class: ssi.value.class, pieces: Object.freeze(pieces.value) }));
  }
  const pieces: IntersectionPiece[] = [];
  for (const hit of ssi.value.hits) {
    if (hit.kind === 'point') {
      const a = classifyOn(ctx, 'A', faceA, hit.point);
      if (!a.ok) return a;
      const b = classifyOn(ctx, 'B', faceB, hit.point);
      if (!b.ok) return b;
      if (a.value.cls !== 'outside' && b.value.cls !== 'outside') return err(refusal(OP, 'tangent contact not resolved'));
      continue;
    }
    const ps = trimComponent(ctx, faceA, faceB, domA.value, domB.value, hit);
    if (!ps.ok) return ps;
    pieces.push(...ps.value);
  }
  return ok(Object.freeze({ kind: 'curves', faceA, faceB, class: combineClass([ssi.value.class, ...pieces.map((p) => p.class)]), pieces: Object.freeze(pieces) }));
}

/**
 * The intersection of face `faceA` of body `a` with face `faceB` of body `b`, trimmed to both faces (see the module
 * comment). Errors: unknown faces (`not-found`), the preparation errors of `prepareBody`, the refusals of the M4
 * intersectors and `tangent contact not resolved`.
 */
export function faceFaceIntersection(kernel: Kernel, a: BodyInput, faceA: FaceId, b: BodyInput, faceB: FaceId): Result<FaceFaceIntersection> {
  const ctx = facePairContext(kernel, a, b);
  if (!ctx.ok) return ctx;
  return intersectFaces(ctx.value, faceA, faceB);
}
