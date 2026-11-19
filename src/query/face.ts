/**
 * Point-in-face classification of a trimmed face in its `(u, v)` domain, and the distance from a point to an edge.
 *
 * `pointInFace(kernel, body, face, at)` classifies a surface point — given by `{ uv }`, or by `{ point }` which
 * is first mapped to `(u, v)` by the surface's inversion (`surfaceUv`, the M1 `projectPoint`; the face's foot
 * point is then classified) — as `inside`, `outside` or `on` the face:
 * 1. **Boundary band (3D).** The surface point `S(u, v)` within `zoneTol3d` of a vertex of the face, or within
 *    an edge's band (`zoneTol3d`, wider where the edge's samples stray further: `domain.ts`), is `on`, naming
 *    that vertex or edge. Seams count as boundary (they are
 *    edges of the face), and so do poles (their vertices). Edges are pruned by their certified boxes.
 * 2. **Parity (2D).** Otherwise the crossing number of `(u, v)` against the face's rings (`domain.ts`) by the
 *    exact half-open rule of `crossing.ts`: odd is `inside`. A point lying exactly on a ring edge in `(u, v)`
 *    (only possible within about the chord of a curved trim) is `on` without an entity. Periodic parameters
 *    are tried at every shift by whole periods `2π` that lands in the face's `(u, v)` box (padded by `1e-9`):
 *    a hit at `u ∈ [0, 2π)` from the inversion is classified on whichever period the face's domain uses
 *    (e.g. a face spanning `[-π/2, π/2]` in `u`); `inside` on any shift wins, then `on`.
 *
 * Guarantee: a point outside every edge's band is decided against the polygonal domain, whose chords follow
 * each edge within its band (measured at the chords' middle parameters); so the answer is exact for straight trims in
 * `(u, v)` (lines on planes, seams, iso-lines) and may differ from the true trim only within that chord band
 * beyond the `on` band (not certified).
 *
 * `edgeDistance` is the distance from a point to the part `[t0, t1]` of an edge's curve: the M1
 * `closestPointOnCurve` foot when it lies in the interval, otherwise the nearer end vertex (exact for lines and
 * circles, whose distance along the curve has one minimum; conservative for ellipses and NURBS edges, where
 * a second local minimum inside the interval could be missed). A point on a circle's axis (every curve point
 * equidistant) uses the start vertex.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/query/face.rs`
 * (`face_classify_uv`: inside / outside / on the boundary in the face's parameters), `query/api_queries.rs`
 * (`face_classify_uv`, `edge_closest_point`), `intersect/point_class.rs` (`PointClassType`: on a vertex, an
 * edge, a face), `topology/vertex.rs` (poles are vertices of seams) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type EntityRef, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, isFinite3, vec2, type Point2, type Point3 } from '../math/vec.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { TWO_PI } from '../curve/types.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import type { Brep, EdgeId, FaceId } from '../topology/brep.ts';
import { surfaceUv } from '../topology/geometry.ts';
import { boxDistanceSq } from './box.ts';
import { crossingCount } from './crossing.ts';
import { prepared, type BodyInput, type FaceDomain, type PreparedBody } from './domain.ts';

/** Where a point lies relative to a face, a solid, ... */
export type PointClass = 'inside' | 'outside' | 'on';

/** The answer of {@link pointInFace}. */
export interface FacePointClass {
  readonly class: PointClass;
  /** The classified parameters (as given, or the inversion of the given point). */
  readonly uv: Point2;
  /** `S(u, v)`. */
  readonly point: Point3;
  /** For `on`: the vertex within `zoneTol3d` or the edge within its band (absent when only the `(u, v)` ring decided `on`). */
  readonly boundary?: EntityRef;
}

/** The nearest point of an edge to a point. */
export interface EdgeFoot {
  readonly distance: number;
  readonly t: number;
  readonly point: Point3;
}

const OP = 'query.pointInFace';

/** Distance from `p` to edge `edge` over its interval (see the module comment). */
export function edgeDistance(brep: Brep, edge: EdgeId, p: Point3): Result<EdgeFoot> {
  const e = brep.edges[edge];
  if (e === undefined) return err({ kind: 'not-found', operation: 'query.edgeDistance', entity: { kind: 'edge', id: edge } });
  const a = brep.vertices[e.start]?.point, b = brep.vertices[e.end]?.point;
  if (a === undefined || b === undefined) {
    return err({ kind: 'invalid-topology', operation: 'query.edgeDistance', reason: 'edge names a missing vertex', entity: { kind: 'edge', id: edge } });
  }
  const da = distance3(p, a), db = distance3(p, b);
  let best: EdgeFoot = da <= db ? { distance: da, t: e.t0, point: a } : { distance: db, t: e.t1, point: b };
  const cp = closestPointOnCurve(e.curve, p);
  if (cp.ok) {
    if (cp.value.t >= e.t0 && cp.value.t <= e.t1 && cp.value.distance < best.distance) best = cp.value;
  } else if (cp.error.kind !== 'degenerate') return cp;
  return ok(Object.freeze({ distance: best.distance, t: best.t, point: best.point }));
}

/**
 * The boundary entity of `dom` near `p`: a vertex within `tol` first, then the nearest edge within its band
 * (`max(tol, edgeBands[e])`, see `domain.ts`), if any.
 */
export function boundaryNear(body: PreparedBody, dom: FaceDomain, p: Point3, tol: number): Result<EntityRef | undefined> {
  const brep = body.brep;
  for (const v of dom.vertices) {
    const q = brep.vertices[v]?.point;
    if (q !== undefined && distance3(p, q) <= tol) return ok({ kind: 'vertex', id: v });
  }
  let best: { e: EdgeId; d: number } | undefined;
  for (const e of dom.edges) {
    const band = Math.max(tol, body.edgeBands[e] ?? tol);
    const box = body.edgeBoxes[e];
    if (box !== undefined && boxDistanceSq(box, p) > band * band) continue;
    const d = edgeDistance(brep, e, p);
    if (!d.ok) return d;
    if (d.value.distance <= band && (best === undefined || d.value.distance < best.d)) best = { e, d: d.value.distance };
  }
  return ok(best === undefined ? undefined : { kind: 'edge', id: best.e });
}

/** The shifts of `x` by whole periods `2π` (at most two either way) that land in `[lo, hi]` padded by `1e-9`. */
function periodShifts(x: number, lo: number, hi: number, periodic: boolean): number[] {
  if (!periodic) return [x];
  const pad = 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi));
  const out: number[] = [];
  for (let k = -2; k <= 2; k++) {
    const y = x + k * TWO_PI;
    if (y >= lo - pad && y <= hi + pad) out.push(y);
  }
  return out.length > 0 ? out : [x];
}

/** Parity of `uv` against the face's rings over the periodic shifts (see the module comment). */
export function classifyUv(dom: FaceDomain, uv: Point2): 'inside' | 'outside' | 'on' {
  let on = false;
  for (const u of periodShifts(uv.x, dom.uvBox.min.x, dom.uvBox.max.x, dom.periodic.u)) {
    for (const v of periodShifts(uv.y, dom.uvBox.min.y, dom.uvBox.max.y, dom.periodic.v)) {
      const c = crossingCount(vec2(u, v), dom.rings);
      if (c.on) on = true;
      else if (c.count % 2 === 1) return 'inside';
    }
  }
  return on ? 'on' : 'outside';
}

/** The face domain of `face` in a prepared body, or `not-found`. */
export function faceDomain(body: PreparedBody, face: FaceId, op: string): Result<FaceDomain> {
  const d = body.faces[face];
  return d === undefined ? err({ kind: 'not-found', operation: op, entity: { kind: 'face', id: face } }) : ok(d);
}

/** Classifies `(u, v)` of a prepared face (steps 1 and 2 of the module comment). */
export function classifyFaceUv(kernel: Kernel, body: PreparedBody, dom: FaceDomain, uv: Point2): Result<FacePointClass> {
  if (!Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return invalidInput(OP, 'non-finite (u, v)');
  const p = surfacePoint3(dom.surface, uv.x, uv.y);
  if (!p.ok) return p;
  const near = boundaryNear(body, dom, p.value, kernel.tolerances.zoneTol3d);
  if (!near.ok) return near;
  const fuv = Object.freeze(vec2(uv.x, uv.y));
  if (near.value !== undefined) return ok(Object.freeze({ class: 'on', uv: fuv, point: p.value, boundary: Object.freeze(near.value) }));
  return ok(Object.freeze({ class: classifyUv(dom, uv), uv: fuv, point: p.value }));
}

/**
 * Classifies a point of face `face` as `inside`, `outside` or `on` its trimmed domain (see the module comment).
 * `at` gives the surface parameters, or a 3D point whose foot on the surface is classified. Errors: an unknown
 * face (`not-found`), non-finite input (`invalid-input`), the preparation errors of `prepareBody`, and the
 * inversion / evaluation errors of the surface.
 */
export function pointInFace(
  kernel: Kernel,
  body: BodyInput,
  face: FaceId,
  at: { readonly uv: Point2 } | { readonly point: Point3 },
): Result<FacePointClass> {
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  const dom = faceDomain(b.value, face, OP);
  if (!dom.ok) return dom;
  let uv: Point2;
  if ('uv' in at) uv = at.uv;
  else {
    if (!isFinite3(at.point)) return invalidInput(OP, 'non-finite point');
    const q = surfaceUv(kernel, dom.value.surface, at.point);
    if (!q.ok) return q;
    uv = q.value;
  }
  return classifyFaceUv(kernel, b.value, dom.value, uv);
}
