/**
 * Ray queries on a body: `rayBody` (picking: every face hit along a ray, sorted, with entering / leaving) and
 * `classifyPoint` (inside / outside / on a closed solid by ray parity).
 *
 * **`rayBody(kernel, body, origin, direction, maxT?)`.** For each face whose box (grown by `zoneTol3d`) the ray
 * meets (`rayBoxRange`), the M4 curve/surface intersection (`intersectCurveSurface` of `src/intersect`) of the
 * ray's piece inside that box with the face's surface; each point hit is classified in the face
 * (`classifyFaceUv`): `outside` hits are dropped, `inside` hits kept, `on` hits kept with the boundary edge /
 * vertex they lie on (one hit per face: a hit on an edge shared by two faces appears twice, once per face).
 * Each kept hit carries its transition: with the face's outward unit normal `n` (`faceNormalAt`, the surface
 * normal negated on a reversed face) and the unit ray direction `d`, `n·d < 0` is `entering` and `n·d > 0` is
 * `leaving` (Lean `Query.entering_side`, `Query.leaving_side`: along the ray the signed distance to the tangent
 * plane goes from outside to inside exactly when `n·d < 0`); a `tangent` contact from the intersection, a
 * near-grazing hit `|n·d| < sin(angTolDeg)`, or a point without a normal (a pole) is `tangent`. A stretch of the
 * ray lying on a face's surface (a ruling of a cylinder, a line in a plane) is an `overlap` hit when it touches
 * the face (an end or the middle classified `inside` / `on`, or the straight `(u, v)` segment between its ends
 * meeting a ring edge — exact for planes and the rulings of cylinders and cones). Hits are sorted by `t` (then
 * face id). The answer's `class` is `exact` iff every intersection used was exact. Errors (including the named
 * refusals of `src/intersect`) are returned, never an incomplete hit list.
 *
 * **`classifyPoint(kernel, body, point, options?)`** for a closed solid (every edge used by two faces, as
 * `validateBrep` checks):
 * 1. outside the body's box grown by `zoneTol3d`: `outside` (`basis: 'box'`);
 * 2. `on` (`basis: 'tolerance'`) when the point is within `zoneTol3d` of a vertex or edge, or of a face — its
 *    surface foot (`projectPoint`) within `zoneTol3d` and classified `inside` in the face, or `on` its boundary
 *    with the point within `2 zoneTol3d` of that edge / vertex — naming the entity. A foot in a wider edge band
 *    (coarse edge samples, `domain.ts`) farther away leaves the point to the rays, whose hits there are
 *    boundary hits (discarded): such a point is refused rather than guessed;
 * 3. otherwise rays from the point in deterministic directions (`RAY_DIRECTIONS`, a fixed spiral; or
 *    `options.directions`). A ray is **discarded** when its intersection was refused, when it has an overlap or
 *    tangent / grazing hit, when a hit lies on a face's boundary (an edge or vertex: the half-open rule of 3D
 *    rays is not decidable from tolerances, so the ray is replaced instead), or when its transitions do not
 *    alternate as a closed solid's must (from the far end back: leaving, entering, leaving, ...; the first hit is
 *    `leaving` iff the count is odd). An accepted ray votes `inside` for an odd number of hits, `outside` for an
 *    even one (Jordan parity). The answer is returned once one class leads the other by `options.agreement`
 *    votes (default 2: two independent rays agree and none disagree, or more rays outvote a disagreement);
 *    when the directions run out first, the answer is a refusal (`not-converged`, operation
 *    `query.classifyPoint: rays did not agree` / `: every ray was degenerate` / `: too few rays decided`).
 *
 * Upstream consulted (for the method and API shape, not translated): `solidcore/crates/solidcore/src/intersect/ray_tracer.rs`
 * (`RayHit`: parameter, face, `(u, v)`, sorted hits; boxes culling rays), `intersect/point_class.rs`
 * (`PointClassType`: in, out, on a face / edge / vertex), `query/api_queries.rs` (`point_in_solid`: parity of
 * a ray, retried when it meets an edge or grazes), `query/brep.rs` (`BrepClassifier`), `docs/booleans.md`
 * (classification of points against solids) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type EntityRef, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, dot3, isFinite3, length3, scale3, vec2, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import { createLineCurve } from '../curve/types.ts';
import { implicitValue, projectPoint } from '../surface/implicit.ts';
import { faceNormalAt } from '../topology/geometry.ts';
import { closedSegmentsMeet } from '../exact/polygon.ts';
import { box3Contains, box3Diagonal, expandBox3 } from '../interval/box.ts';
import { intersectCurveSurface } from '../intersect/curve-surface.ts';
import { combineClass, type IntersectionClass, type ParamRange } from '../intersect/types.ts';
import { boxDistanceSq, rayBoxRange } from './box.ts';
import { prepared, type BodyInput, type FaceDomain, type PreparedBody } from './domain.ts';
import { classifyFaceUv, edgeDistance, type PointClass } from './face.ts';
import { edgeId, type FaceId } from '../topology/brep.ts';

/** How a ray passes a face at a point hit. */
export type RayTransition = 'entering' | 'leaving' | 'tangent';

/** A point where the ray meets a face (inside it or on its boundary). */
export interface RayFaceHit {
  readonly kind: 'point';
  readonly t: number;
  readonly face: FaceId;
  readonly u: number;
  readonly v: number;
  readonly point: Point3;
  readonly transition: RayTransition;
  /** `n·d` of the outward unit normal and the unit direction (0 where the normal is undefined). */
  readonly cosine: number;
  /** The face edge or vertex the hit lies on (within `zoneTol3d`, or the edge's band), if any. */
  readonly boundary?: EntityRef;
  readonly class: IntersectionClass;
  readonly deviation: number;
}

/** A stretch of the ray lying on a face's surface and touching the face. */
export interface RayFaceOverlap {
  readonly kind: 'overlap';
  readonly range: ParamRange;
  readonly face: FaceId;
  readonly class: IntersectionClass;
  readonly deviation: number;
}

export type RayBodyHit = RayFaceHit | RayFaceOverlap;

/** The answer of {@link rayBody}. */
export interface RayBodyResult {
  readonly class: IntersectionClass;
  readonly hits: readonly RayBodyHit[];
}

const OP_RAY = 'query.rayBody';
const OP_CLASSIFY = 'query.classifyPoint';

/**
 * The unit vector along `d`, or `undefined` for a zero or non-finite one. Scales by the largest component first,
 * so subnormal and huge directions normalize too (`1 / |d|` would overflow or underflow).
 */
function unitDirection(d: Vec3): Vec3 | undefined {
  if (!isFinite3(d)) return undefined;
  const m = Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z));
  if (!(m > 0)) return undefined;
  const s = vec3(d.x / m, d.y / m, d.z / m);
  const u = scale3(s, 1 / length3(s));
  return isFinite3(u) ? u : undefined;
}

const hitT = (h: RayBodyHit): number => (h.kind === 'point' ? h.t : h.range[0]);

/** The parameter past which the ray `o + t d` (unit `d`) has left the body's box. */
function farReach(body: PreparedBody, o: Point3, tol: number): number {
  const b = body.box;
  const c = vec3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  return distance3(o, c) + box3Diagonal(b) / 2 + 4 * tol + 1e-9 * (1 + length3(o));
}

/** Whether a ray overlap on `dom`'s surface touches the face (see the module comment). */
function overlapTouches(kernel: Kernel, body: PreparedBody, dom: FaceDomain, start: { u: number; v: number }, end: { u: number; v: number }): Result<boolean> {
  const mid = { u: (start.u + end.u) / 2, v: (start.v + end.v) / 2 };
  for (const q of [start, mid, end]) {
    const c = classifyFaceUv(kernel, body, dom, vec2(q.u, q.v));
    if (!c.ok) return c;
    if (c.value.class !== 'outside') return ok(true);
  }
  const a = vec2(start.u, start.v), b = vec2(end.u, end.v);
  if (!(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(b.x) && Number.isFinite(b.y))) return ok(false);
  if (a.x === b.x && a.y === b.y) return ok(false);
  for (const ring of dom.rings) {
    for (let i = 0; i < ring.length; i++) {
      if (closedSegmentsMeet(a, b, ring[i]!, ring[(i + 1) % ring.length]!)) return ok(true);
    }
  }
  return ok(false);
}

/** The hits of the ray `o + t d`, `t ∈ [0, maxT]` (unit `d`), with the faces of `body` (see the module comment). */
function traceRay(kernel: Kernel, body: PreparedBody, o: Point3, d: Vec3, maxT: number): Result<RayBodyResult> {
  const tol = kernel.tolerances.zoneTol3d;
  const grazing = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  const hits: RayBodyHit[] = [];
  const classes: IntersectionClass[] = [];
  for (const dom of body.faces) {
    const range = rayBoxRange(dom.box, o, d, maxT, 2 * tol);
    if (range === undefined) continue;
    const [t0, t1] = range;
    if (!(t1 > t0)) continue;
    const line = createLineCurve(o, d, [t0, t1]);
    if (!line.ok) return line;
    const r = intersectCurveSurface(kernel, line.value, dom.surface);
    if (!r.ok) return r;
    classes.push(r.value.class);
    for (const h of r.value.hits) {
      if (h.kind === 'overlap') {
        const touches = overlapTouches(kernel, body, dom, h.start, h.end);
        if (!touches.ok) return touches;
        if (touches.value) hits.push(Object.freeze({ kind: 'overlap', range: h.range, face: dom.face, class: h.class, deviation: h.deviation }));
        continue;
      }
      const c = classifyFaceUv(kernel, body, dom, vec2(h.u, h.v));
      if (!c.ok) return c;
      if (c.value.class === 'outside') continue;
      let cosine = 0;
      let transition: RayTransition = 'tangent';
      if (h.contact === 'transversal') {
        const n = faceNormalAt(kernel, body.brep, dom.face, h.u, h.v);
        if (n.ok) {
          cosine = dot3(n.value, d);
          if (Math.abs(cosine) >= grazing) transition = cosine < 0 ? 'entering' : 'leaving';
        }
      }
      const hit: RayFaceHit = {
        kind: 'point',
        t: h.t,
        face: dom.face,
        u: h.u,
        v: h.v,
        point: h.point,
        transition,
        cosine,
        class: h.class,
        deviation: h.deviation,
        ...(c.value.boundary !== undefined ? { boundary: c.value.boundary } : {}),
      };
      hits.push(Object.freeze(hit));
    }
  }
  hits.sort((a, b) => hitT(a) - hitT(b) || a.face - b.face);
  return ok(Object.freeze({ class: combineClass(classes), hits: Object.freeze(hits) }));
}

/**
 * The hits of the ray from `origin` along `direction` with the faces of `body`. The direction is scaled to unit
 * length, so a hit's `t` is its distance from `origin`. Hits up to
 * `maxT` (default: past the body's box). See the module comment. Errors: a non-finite or zero direction, a bad
 * `maxT`, preparation errors, and the errors / refusals of the intersection.
 */
export function rayBody(kernel: Kernel, body: BodyInput, origin: Point3, direction: Vec3, maxT?: number): Result<RayBodyResult> {
  if (!isFinite3(origin) || !isFinite3(direction)) return invalidInput(OP_RAY, 'non-finite ray');
  const unit = unitDirection(direction);
  if (unit === undefined) return invalidInput(OP_RAY, 'ray direction of zero length');
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  const reach = maxT ?? farReach(b.value, origin, kernel.tolerances.zoneTol3d);
  if (!(reach > 0) || !Number.isFinite(reach)) return invalidInput(OP_RAY, 'maxT must be finite and positive');
  return traceRay(kernel, b.value, origin, unit, reach);
}

/**
 * The default ray directions of `classifyPoint`: 24 unit vectors on a golden-angle spiral, tilted off the
 * coordinate axes and planes (rays along them meet the edges and vertices of axis-aligned models first).
 */
export const RAY_DIRECTIONS: readonly Vec3[] = Object.freeze(
  Array.from({ length: 24 }, (_, i) => {
    const z = 1 - (2 * i + 1) / 24 + 0.0123;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = 0.3711 + i * Math.PI * (3 - Math.sqrt(5));
    const x = r * Math.cos(phi), y = r * Math.sin(phi);
    const n = Math.hypot(x, y, z);
    return Object.freeze(vec3(x / n, y / n, z / n));
  }),
);

/** Options of {@link classifyPoint}. */
export interface ClassifyOptions {
  /** Ray directions to try, in order (default `RAY_DIRECTIONS`). Zero or non-finite ones are skipped. */
  readonly directions?: readonly Vec3[];
  /** The lead of votes that decides (default 2). */
  readonly agreement?: number;
}

/** The answer of {@link classifyPoint}. */
export interface PointClassification {
  readonly class: PointClass;
  /** What decided: the body's box, the tolerance band of a face / edge / vertex, or ray parity. */
  readonly basis: 'box' | 'tolerance' | 'rays';
  /** For `on`: the face, edge or vertex within `zoneTol3d`. */
  readonly entity?: EntityRef;
  /** Rays accepted (that voted) and discarded. */
  readonly rays: number;
  readonly discarded: number;
  /** For `basis: 'rays'`: `exact` iff every intersection of the voting rays was exact. */
  readonly evidence?: IntersectionClass;
}

/** Whether the transitions of a closed solid's ray hits are consistent (see the module comment). */
export function transitionsAlternate(transitions: readonly RayTransition[]): boolean {
  const n = transitions.length;
  // From the last hit backwards: leaving, entering, leaving, ...
  for (let i = 0; i < n; i++) {
    const expected: RayTransition = (n - 1 - i) % 2 === 0 ? 'leaving' : 'entering';
    if (transitions[i] !== expected) return false;
  }
  return true;
}

const refusalOf = (reason: string, iterations: number): SolidError => ({ kind: 'not-converged', operation: `${OP_CLASSIFY}: ${reason}`, iterations });

/** Whether `p` lies within `tol` of a face, edge or vertex of the body (step 2 of the module comment). */
function onBoundary(kernel: Kernel, body: PreparedBody, p: Point3, tol: number): Result<EntityRef | undefined> {
  const brep = body.brep;
  for (const [i, v] of brep.vertices.entries()) if (distance3(p, v.point) <= tol) return ok({ kind: 'vertex', id: i });
  for (const [i, box] of body.edgeBoxes.entries()) {
    if (boxDistanceSq(box, p) > tol * tol) continue;
    const d = edgeDistance(brep, edgeId(i), p);
    if (!d.ok) return d;
    if (d.value.distance <= tol) return ok({ kind: 'edge', id: i });
  }
  for (const dom of body.faces) {
    if (boxDistanceSq(dom.box, p) > tol * tol) continue;
    const q = projectPoint(kernel, dom.surface, p);
    if (!q.ok) {
      if (q.error.kind !== 'degenerate' || dom.surface.kind === 'nurbs') return q;
      // The nearest surface points form a circle or sphere (a point on an axis / the center): its distance is
      // the implicit value's; within the tolerance the foot is not unique and the point cannot be decided.
      const g = implicitValue(dom.surface, p);
      if (!g.ok) return g;
      if (Math.abs(g.value) > tol) continue;
      return err(refusalOf('point on a surface axis within tolerance', 0));
    }
    if (q.value.distance > tol) continue;
    const c = classifyFaceUv(kernel, body, dom, vec2(q.value.u, q.value.v));
    if (!c.ok) return c;
    if (c.value.class === 'outside') continue;
    const bnd = c.value.boundary;
    if (bnd === undefined) return ok({ kind: 'face', id: dom.face });
    // The foot lies in a boundary band. `on` that entity only when the point itself is within `2 tol` of it (the
    // foot is within `tol` of both); a wider band (coarse samples of an edge) leaves the face undecided here.
    const near = bnd.kind === 'edge' ? edgeDistance(brep, edgeId(bnd.id), p) : undefined;
    if (near !== undefined && !near.ok) return near;
    if (near === undefined || near.value.distance <= 2 * tol) return ok(bnd);
  }
  return ok(undefined);
}

/**
 * Classifies `point` against the closed solid `body` as `inside`, `outside` or `on` its boundary (see the module
 * comment). Errors: non-finite input, preparation errors, input errors of the intersection, and a refusal when
 * the rays do not decide.
 */
export function classifyPoint(kernel: Kernel, body: BodyInput, point: Point3, options: ClassifyOptions = {}): Result<PointClassification> {
  if (!isFinite3(point)) return invalidInput(OP_CLASSIFY, 'non-finite point');
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  const pb = b.value;
  const tol = kernel.tolerances.zoneTol3d;
  const grown = expandBox3(pb.box, tol);
  if (!grown.ok) return grown;
  if (!box3Contains(grown.value, point)) {
    return ok(Object.freeze({ class: 'outside', basis: 'box', rays: 0, discarded: 0 }));
  }
  const on = onBoundary(kernel, pb, point, tol);
  if (!on.ok) return on;
  if (on.value !== undefined) {
    return ok(Object.freeze({ class: 'on', basis: 'tolerance', entity: Object.freeze(on.value), rays: 0, discarded: 0 }));
  }
  const agreement = options.agreement !== undefined && Number.isInteger(options.agreement) && options.agreement > 0 ? options.agreement : 2;
  const directions = options.directions ?? RAY_DIRECTIONS;
  const reach = farReach(pb, point, tol);
  let inside = 0, outside = 0, discarded = 0;
  const classes: IntersectionClass[] = [];
  for (const dir of directions) {
    const unit = unitDirection(dir);
    if (unit === undefined) continue;
    const r = traceRay(kernel, pb, point, unit, reach);
    if (!r.ok) {
      if (r.error.kind === 'invalid-input' || r.error.kind === 'invalid-topology' || r.error.kind === 'not-found') return r;
      discarded++;
      continue;
    }
    const hits = r.value.hits;
    const bad = hits.some((h) => h.kind === 'overlap' || h.transition === 'tangent' || h.boundary !== undefined);
    const transitions = hits.map((h) => (h.kind === 'point' ? h.transition : 'tangent'));
    if (bad || !transitionsAlternate(transitions)) {
      discarded++;
      continue;
    }
    classes.push(r.value.class);
    if (hits.length % 2 === 1) inside++;
    else outside++;
    if (Math.abs(inside - outside) >= agreement) {
      return ok(
        Object.freeze({
          class: inside > outside ? 'inside' : 'outside',
          basis: 'rays',
          rays: inside + outside,
          discarded,
          evidence: combineClass(classes),
        }),
      );
    }
  }
  const reason = inside + outside === 0 ? 'every ray was degenerate' : inside > 0 && outside > 0 ? 'rays did not agree' : 'too few rays decided';
  return err(refusalOf(reason, inside + outside + discarded));
}
