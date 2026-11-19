/**
 * The nearest point of a body to a point: `closestPointOnBody` (with the entity hit) and `distancePointBody`.
 *
 * Candidates: every vertex; every edge (`edgeDistance` of `face.ts`: the curve foot inside the edge's interval,
 * else the nearer end); every face whose surface foot (`projectPoint`, the global nearest point of the surface)
 * lies `inside` or `on` the trimmed face (`classifyFaceUv`). When the foot falls outside the face, the face's
 * nearest point is taken to be on its boundary, which the edge and vertex candidates cover. That holds when the
 * foot is the only local minimum of the distance over the surface — planes, cylinders, cones and spheres (away
 * from the degenerate cases below). It is **not** guaranteed for a torus (the distance can have a second local
 * minimum on the far side of the tube) or a NURBS surface (`projectPoint` is sampled and not certified): there a
 * trimmed face's interior minimum can be missed (a limitation). Where the foot is not unique (a point on a cylinder's, cone's or torus's axis, a sphere's
 * center — `projectPoint` reports `degenerate`), the face is sampled on a `SAMPLE_GRID × SAMPLE_GRID` grid of its
 * `(u, v)` box (points inside the face only): `method: 'sampled'`, an upper bound of the face's distance.
 *
 * Pruning: edges and faces are visited in increasing order of their box lower bound `boxDistanceSq` (`box.ts`);
 * once that bound exceeds the best squared distance found, no remaining entity can improve it (Lean
 * `Query.prune_sound`), and the search stops. Ties keep the first candidate in the order vertices, then the
 * visit order (deterministic).
 *
 * Upstream consulted (for the method and API shape, not translated): `solidcore/crates/solidcore/src/query/api_queries.rs`
 * (`brep_closest_point`, `face_closest_point`, `edge_closest_point`, `point_distance`, `vertex_distance`),
 * `query/distance_bound.rs` (box lower bounds pruning the search) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type EntityRef, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, isFinite3, vec2, type Point2, type Point3 } from '../math/vec.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import { projectPoint } from '../surface/implicit.ts';
import { edgeId } from '../topology/brep.ts';
import { boxDistanceSq, canPrune } from './box.ts';
import { prepared, type BodyInput, type FaceDomain, type PreparedBody } from './domain.ts';
import { classifyFaceUv, classifyUv, edgeDistance } from './face.ts';

/** Grid lines per direction of the sampled fallback. */
export const SAMPLE_GRID = 33;

/** The answer of {@link closestPointOnBody}. */
export interface BodyClosestPoint {
  readonly distance: number;
  readonly point: Point3;
  /** The vertex, edge or face the nearest point lies on. */
  readonly entity: EntityRef;
  /** Face parameters (face hits) or the edge curve parameter (edge hits). */
  readonly uv?: Point2;
  readonly t?: number;
  /** How the face candidate was found: surface projection, boundary (edge / vertex), or the sampled fallback. */
  readonly method: 'projection' | 'boundary' | 'sampled';
}

const OP = 'query.closestPointOnBody';

interface Best {
  distance: number;
  point: Point3;
  entity: EntityRef;
  uv?: Point2;
  t?: number;
  method: BodyClosestPoint['method'];
}

/** The sampled nearest point of a face whose surface foot is not unique (see the module comment). */
function sampledFace(dom: FaceDomain, p: Point3): Result<{ distance: number; point: Point3; uv: Point2 } | undefined> {
  let best: { distance: number; point: Point3; uv: Point2 } | undefined;
  const { min, max } = dom.uvBox;
  for (let j = 0; j < SAMPLE_GRID; j++) {
    for (let i = 0; i < SAMPLE_GRID; i++) {
      const uv = vec2(min.x + ((max.x - min.x) * i) / (SAMPLE_GRID - 1), min.y + ((max.y - min.y) * j) / (SAMPLE_GRID - 1));
      if (classifyUv(dom, uv) === 'outside') continue;
      const q = surfacePoint3(dom.surface, uv.x, uv.y);
      if (!q.ok) continue;
      const d = distance3(p, q.value);
      if (best === undefined || d < best.distance) best = { distance: d, point: q.value, uv };
    }
  }
  return ok(best);
}

function search(kernel: Kernel, body: PreparedBody, p: Point3): Result<Best> {
  const brep = body.brep;
  let best: Best | undefined;
  for (const [i, v] of brep.vertices.entries()) {
    const d = distance3(p, v.point);
    if (best === undefined || d < best.distance) best = { distance: d, point: v.point, entity: { kind: 'vertex', id: i }, method: 'boundary' };
  }
  type Cand = { readonly lb: number; readonly kind: 'edge' | 'face'; readonly id: number };
  const cands: Cand[] = [];
  body.edgeBoxes.forEach((b, id) => cands.push({ lb: boxDistanceSq(b, p), kind: 'edge', id }));
  body.faces.forEach((f) => cands.push({ lb: boxDistanceSq(f.box, p), kind: 'face', id: f.face }));
  cands.sort((a, b) => a.lb - b.lb || (a.kind === b.kind ? a.id - b.id : a.kind === 'edge' ? -1 : 1));
  for (const c of cands) {
    if (best !== undefined && canPrune(c.lb, best.distance)) break;
    if (c.kind === 'edge') {
      const d = edgeDistance(brep, edgeId(c.id), p);
      if (!d.ok) return d;
      if (best === undefined || d.value.distance < best.distance) {
        best = { distance: d.value.distance, point: d.value.point, entity: { kind: 'edge', id: c.id }, t: d.value.t, method: 'boundary' };
      }
      continue;
    }
    const dom = body.faces[c.id]!;
    const q = projectPoint(kernel, dom.surface, p);
    if (!q.ok) {
      if (q.error.kind !== 'degenerate') return q;
      const s = sampledFace(dom, p);
      if (!s.ok) return s;
      if (s.value !== undefined && (best === undefined || s.value.distance < best.distance)) {
        best = { distance: s.value.distance, point: s.value.point, entity: { kind: 'face', id: c.id }, uv: s.value.uv, method: 'sampled' };
      }
      continue;
    }
    if (best !== undefined && !(q.value.distance < best.distance)) continue;
    const cl = classifyFaceUv(kernel, body, dom, vec2(q.value.u, q.value.v));
    if (!cl.ok) return cl;
    if (cl.value.class === 'outside') continue;
    best = { distance: q.value.distance, point: q.value.point, entity: { kind: 'face', id: c.id }, uv: cl.value.uv, method: 'projection' };
  }
  if (best === undefined) return invalidInput(OP, 'the body has no geometry');
  return ok(best);
}

/**
 * The nearest point of `body` to `point`, with the vertex, edge or face it lies on (see the module comment).
 * Errors: a non-finite point, preparation errors, and the projection errors of NURBS surfaces.
 */
export function closestPointOnBody(kernel: Kernel, body: BodyInput, point: Point3): Result<BodyClosestPoint> {
  if (!isFinite3(point)) return invalidInput(OP, 'non-finite point');
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  const r = search(kernel, b.value, point);
  if (!r.ok) return r;
  const v = r.value;
  return ok(
    Object.freeze({
      distance: v.distance,
      point: Object.freeze({ x: v.point.x, y: v.point.y, z: v.point.z }),
      entity: Object.freeze(v.entity),
      method: v.method,
      ...(v.uv !== undefined ? { uv: Object.freeze(vec2(v.uv.x, v.uv.y)) } : {}),
      ...(v.t !== undefined ? { t: v.t } : {}),
    }),
  );
}

/** The (unsigned) distance from `point` to the boundary of `body` (`closestPointOnBody(...).distance`). */
export function distancePointBody(kernel: Kernel, body: BodyInput, point: Point3): Result<number> {
  const r = closestPointOnBody(kernel, body, point);
  return r.ok ? ok(r.value.distance) : r;
}
