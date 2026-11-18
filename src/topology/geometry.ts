/**
 * Geometry of an arena B-rep: points along edges and coedges, `(u, v)` of coedges on their faces, face
 * surfaces and normals, exact planar pcurves, and the geometric validation `validateBrepGeometry`.
 *
 * Parameters. An edge is used through a fraction `s in [0, 1]`: `edgeParam(t0, t1, s) = t0 + s (t1 - t0)`
 * (exactly `t1` at `s = 1`), the formula of `formal/CadloomFormal/TopologyGeometry.lean` (`edgeParam`:
 * `edgeParam_zero`, `edgeParam_one`, `edgeParam_strictMono`, `edgeParam_mem`). A coedge running the edge
 * backwards uses `1 - s` (`coedgeParam`, `coedgeParam_start`, `coedgeParam_end`). A pcurve is used through
 * the same map on its own knot domain, in the coedge's direction.
 *
 * Validation (`validateBrepGeometry`, after the structural `validateBrep`), all within `zoneTol3d` (plus a
 * rounding allowance `64 ε |p|_∞` at the compared point `p`, which only matters far from the origin):
 * - vertices are finite (`non-finite`);
 * - each edge interval is finite, increasing and inside its curve's range (`edge-range`); its curve's end
 *   points are its vertices (`edge-vertex`); some sample is farther than the tolerance from the start
 *   (otherwise `degenerate-edge`: a closed edge must not collapse to a point);
 * - each pcurve has dimension 2 and evaluates on its face's surface (`pcurve-invalid`); its end points map to
 *   the coedge's start and end vertices (`pcurve-endpoint`); `GEOMETRY_SAMPLES` interior samples map onto the
 *   edge curve (`pcurve-deviation`, distance by `closestPointOnCurve`, taken to the nearer end point of the
 *   edge's interval when the closest curve point lies outside it — conservative for an ellipse or NURBS arc);
 *   the nearest edge points of those samples advance along the coedge (`pcurve-direction`: a step back of more
 *   than twice the tolerance in 3D is rejected, so a pcurve that runs a closed edge backwards, whose end points
 *   alone cannot show it, or doubles back on an open edge, fails);
 * - a coedge without pcurve has its edge's end points and `GEOMETRY_SAMPLES` interior samples on the face's
 *   surface (`edge-off-surface`; the signed distance `implicitValue` for analytic surfaces, `projectPoint` for
 *   NURBS surfaces);
 * - both coedges of a seam edge (both coedges on one face) carry pcurves, and these do not coincide at both
 *   ends in `(u, v)` (`seam-pcurves`): a seam of a periodic surface has them a period apart, e.g. `u = 0` and
 *   `u = 2π`; without pcurves the two sides of a seam (or a slit) cannot be told apart.
 * Every failure is `invalid-topology` naming the edge, coedge or vertex (see `topologyIssue`).
 *
 * Not checked: that pcurve samples and edge samples correspond one to one beyond the sampled monotonicity,
 * continuity of a loop's pcurves in `(u, v)` (on analytic surfaces it follows from the end point checks up to
 * a period or a pole), self-intersection of loops in `(u, v)`, loop winding in `(u, v)`, and that a NURBS projection
 * finds the global minimum (M1 limitation).
 *
 * Upstream consulted (for invariants and API shape, not translated): `solidcore/crates/solidcore/src/eval/pcurve.rs`
 * (pcurves on a plane are exact — the curve's knots and weights with the control points mapped by the plane's
 * affine parameters; a seam edge used twice has two pcurves a period apart; each pcurve is checked by lifting
 * it), `topology/edge.rs`, `topology/face.rs`, `topology/integrity.rs`, `crates/solidcore-record/src/brep.rs`
 * (an edge's interval `min < max`, start vertex at min and end vertex at max) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type EntityRef, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3, isFinite3, scale3, vec2, type Point2, type Point3, type Vec3 } from '../math/vec.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { curveToNurbs } from '../curve/conic.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { ROUNDING_SLACK, TWO_PI, curveRange, type Curve3 } from '../curve/types.ts';
import { createNurbsCurve, curveDomain, evaluateCurve, reverseNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { surfaceNormal3, surfacePoint3 } from '../surface/evaluate.ts';
import { implicitValue, projectPoint } from '../surface/implicit.ts';
import { localCoordinates, type PlaneSurface, type Surface3 } from '../surface/types.ts';
import { coedgeEnd, coedgeStart, loopCoedges, type Brep, type CoedgeId, type Edge, type EdgeId, type FaceId } from './brep.ts';
import { topologyError, validateBrep, type TopologyIssue } from './validate.ts';

/** Interior samples per edge / pcurve checked by `validateBrepGeometry` (besides the two end points). */
export const GEOMETRY_SAMPLES = 8;

/** Relative rounding allowance, `64 ε`: coordinates of magnitude `m` carry rounding errors of a few `ε m`. */
const RELATIVE_ROUNDING = 64 * Number.EPSILON;

/**
 * The agreement tolerance at a point: `zoneTol3d + 64 ε |p|_∞`. The second term only matters for coordinates
 * far beyond `zoneTol3d / ε` (about 4.5e10 for the default zone), where doubles cannot resolve the zone.
 */
function tolAt(kernel: Kernel, p: Point3): number {
  return kernel.tolerances.zoneTol3d + RELATIVE_ROUNDING * Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
}

/** `t0 + s (t1 - t0)`, exactly `t1` at `s = 1` (Lean `edgeParam`). */
export function edgeParam(t0: number, t1: number, s: number): number {
  return s === 1 ? t1 : t0 + s * (t1 - t0);
}

/** The edge fraction of a coedge fraction: `s`, or `1 - s` when the coedge runs the edge backwards (Lean `coedgeParam`). */
export function coedgeFraction(reversed: boolean, s: number): number {
  return reversed ? 1 - s : s;
}

const checkFraction = (op: string, s: number): Result<number> =>
  Number.isFinite(s) && s >= 0 && s <= 1 ? ok(s) : invalidInput(op, `fraction ${s} is not in [0, 1]`);

const clamp = (t: number, lo: number, hi: number): number => Math.min(Math.max(t, lo), hi);

/** The point of an edge record's curve at fraction `s` of its interval (clamped into the curve's range). */
function edgePointAt(e: Edge, s: number): Result<Point3> {
  const [r0, r1] = curveRange(e.curve);
  return curvePoint3(e.curve, clamp(edgeParam(e.t0, e.t1, s), r0, r1));
}

/** The point `curve(t0 + s (t1 - t0))` of `edge`, `s in [0, 1]` (`s = 0`: start vertex, `s = 1`: end vertex). */
export function edgeCurvePoint(brep: Brep, edge: EdgeId, s: number): Result<Point3> {
  const op = 'topology.edgeCurvePoint';
  const e = brep.edges[edge];
  if (e === undefined) return err({ kind: 'not-found', operation: op, entity: { kind: 'edge', id: edge } });
  const f = checkFraction(op, s);
  if (!f.ok) return f;
  return edgePointAt(e, s);
}

/** The point at fraction `s` along a coedge, in its direction (`s = 0`: the coedge's start vertex). */
export function coedgePoint(brep: Brep, coedge: CoedgeId, s: number): Result<Point3> {
  const op = 'topology.coedgePoint';
  const c = brep.coedges[coedge];
  if (c === undefined) return err({ kind: 'not-found', operation: op, entity: { kind: 'coedge', id: coedge } });
  const f = checkFraction(op, s);
  if (!f.ok) return f;
  return edgeCurvePoint(brep, c.edge, coedgeFraction(c.reversed, s));
}

/** The `(u, v)` of a 2D pcurve at fraction `s` of its knot domain. */
export function pcurveUv(pcurve: NurbsCurve, s: number): Result<Point2> {
  const op = 'topology.pcurveUv';
  if (pcurve.dimension !== 2) return invalidInput(op, 'a pcurve must have dimension 2');
  const f = checkFraction(op, s);
  if (!f.ok) return f;
  const [a, b] = curveDomain(pcurve);
  const p = evaluateCurve(pcurve, clamp(edgeParam(a, b, s), a, b));
  if (!p.ok) return p;
  return ok(Object.freeze(vec2(p.value[0]!, p.value[1]!)));
}

/** The surface of `face`. */
export function faceSurface(brep: Brep, face: FaceId): Result<Surface3> {
  const f = brep.faces[face];
  if (f === undefined) return err({ kind: 'not-found', operation: 'topology.faceSurface', entity: { kind: 'face', id: face } });
  return ok(f.surface);
}

/** The outward unit normal of `face` at `(u, v)`: the surface normal, negated when the face is reversed. */
export function faceNormalAt(kernel: Kernel, brep: Brep, face: FaceId, u: number, v: number): Result<Vec3> {
  const f = brep.faces[face];
  if (f === undefined) return err({ kind: 'not-found', operation: 'topology.faceNormalAt', entity: { kind: 'face', id: face } });
  const n = surfaceNormal3(kernel, f.surface, u, v);
  if (!n.ok) return n;
  return ok(f.reversed ? Object.freeze(scale3(n.value, -1)) : n.value);
}

/**
 * The `(u, v)` of a coedge at fraction `s` in its direction, on its face's surface: from the pcurve when the
 * coedge has one, otherwise by projecting the edge point onto the surface (M1 `projectPoint`; on a periodic
 * surface the projection returns angles in `[0, 2π)`, so a seam needs pcurves to tell its two sides apart).
 */
export function coedgeUv(kernel: Kernel, brep: Brep, coedge: CoedgeId, s: number): Result<Point2> {
  const op = 'topology.coedgeUv';
  const c = brep.coedges[coedge];
  if (c === undefined) return err({ kind: 'not-found', operation: op, entity: { kind: 'coedge', id: coedge } });
  if (c.pcurve !== undefined) return pcurveUv(c.pcurve, s);
  const face = brep.loops[c.loop]?.face;
  const surface = face === undefined ? undefined : brep.faces[face]?.surface;
  if (surface === undefined) {
    return err({ kind: 'invalid-topology', operation: op, reason: 'coedge names no face', entity: { kind: 'coedge', id: coedge } });
  }
  const p = coedgePoint(brep, coedge, s);
  if (!p.ok) return p;
  return surfaceUv(kernel, surface, p.value);
}

/** `x` moved by whole periods `2π` to within half a period of `near`. */
function unwrapAngle(x: number, near: number): number {
  return x + TWO_PI * Math.round((near - x) / TWO_PI);
}

/** Which parameters of a surface are periodic angles (`u` of a cylinder, cone or sphere; both of a torus). */
function periodicParams(s: Surface3): { readonly u: boolean; readonly v: boolean } {
  switch (s.kind) {
    case 'cylinder':
    case 'cone':
    case 'sphere':
      return { u: true, v: false };
    case 'torus':
      return { u: true, v: true };
    default:
      return { u: false, v: false };
  }
}

/** Whether `u` is undefined at `(·, v)`: a sphere pole or a cone apex. */
function uSingular(s: Surface3, v: number): boolean {
  if (s.kind === 'sphere') return Math.abs(Math.cos(v)) <= 1e-12;
  if (s.kind === 'cone') return Math.abs(s.baseRadius + Math.tan(s.semiAngle) * v) <= 1e-12 * Math.max(1, s.baseRadius);
  return false;
}

/**
 * The `(u, v)` of a point on a surface: the M1 `projectPoint` inversion, and, given `near`, every periodic
 * parameter moved by whole periods to within half a period of `near` (at a sphere pole or cone apex, where `u`
 * is undefined, `near`'s `u`). This is the one point-to-`(u, v)` mapping of the kernel: `coedgeUv` (without
 * `near`) and the display mesher's boundary (with the pcurve or previous sample as `near`) both use it.
 */
export function surfaceUv(kernel: Kernel, surface: Surface3, p: Point3, near?: Point2): Result<Point2> {
  const q = projectPoint(kernel, surface, p);
  if (!q.ok) return q;
  let { u, v } = q.value;
  if (near !== undefined) {
    const per = periodicParams(surface);
    if (per.v) v = unwrapAngle(v, near.y);
    if (per.u) u = uSingular(surface, v) ? near.x : unwrapAngle(u, near.x);
  }
  return ok(Object.freeze(vec2(u, v)));
}

/**
 * The exact pcurve of an edge lying on a plane: the NURBS form of the edge's curve (`curveToNurbs`) over the
 * edge's interval, its control points mapped to the plane's `(u, v)` (affine, so the map is exact), run
 * backwards when the coedge is `reversed`. Fails with `invalid-input` when the interval is not inside the
 * curve's range, when a NURBS edge does not use its whole domain, or when a control point is farther than
 * `zoneTol3d` (plus the rounding allowance) from the plane.
 */
export function planePcurve(
  kernel: Kernel,
  plane: PlaneSurface,
  edge: { readonly curve: Curve3; readonly t0: number; readonly t1: number },
  reversed: boolean,
): Result<NurbsCurve> {
  const op = 'topology.planePcurve';
  const { curve, t0, t1 } = edge;
  const [r0, r1] = curveRange(curve);
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && r0 <= t0 && t0 < t1 && t1 <= r1)) {
    return invalidInput(op, 'edge interval is not inside the curve range');
  }
  let whole: Curve3 = curve;
  if (t0 !== r0 || t1 !== r1) {
    if (curve.kind === 'nurbs') return invalidInput(op, 'a NURBS edge must use its whole knot domain');
    whole = Object.freeze({ ...curve, range: Object.freeze([t0, t1] as const) });
  }
  const nurbs = curveToNurbs(whole);
  if (!nurbs.ok) return nurbs;
  const uv: number[][] = [];
  for (const p of nurbs.value.controlPoints) {
    const q = { x: p[0]!, y: p[1]!, z: p[2]! };
    const [u, v, w] = localCoordinates(plane.frame, plane.origin, q);
    if (!(Math.abs(w) <= tolAt(kernel, q))) return invalidInput(op, 'the curve does not lie on the plane');
    uv.push([u, v]);
  }
  const c = nurbs.value;
  const pc = createNurbsCurve(c.degree, c.knots, uv, c.weights);
  if (!pc.ok || !reversed) return pc;
  return reverseNurbsCurve(pc.value);
}

const OP = 'topology.validateBrepGeometry';
const fail = (issue: TopologyIssue, detail: string, entity: EntityRef): Result<never> => topologyError(OP, issue, detail, entity);

/**
 * Distance from `p` to the part `[t0, t1]` of the edge curve, and the edge fraction of the nearest point (see the
 * module comment): the closest curve point when it lies in the interval, otherwise the nearer end point.
 */
function closestOnEdge(e: Edge, p: Point3): Result<{ readonly distance: number; readonly fraction: number }> {
  const cp = closestPointOnCurve(e.curve, p);
  if (!cp.ok) return cp;
  if (cp.value.t >= e.t0 && cp.value.t <= e.t1) {
    return ok({ distance: cp.value.distance, fraction: clamp((cp.value.t - e.t0) / (e.t1 - e.t0), 0, 1) });
  }
  const a = edgePointAt(e, 0), b = edgePointAt(e, 1);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const da = distance3(p, a.value), db = distance3(p, b.value);
  return ok(da <= db ? { distance: da, fraction: 0 } : { distance: db, fraction: 1 });
}

/** Distance from `p` to a surface: `|implicitValue|` (analytic) or the `projectPoint` distance (NURBS). */
function distanceToSurface(kernel: Kernel, s: Surface3, p: Point3): Result<number> {
  if (s.kind === 'nurbs') {
    const q = projectPoint(kernel, s, p);
    return q.ok ? ok(q.value.distance) : q;
  }
  const d = implicitValue(s, p);
  return d.ok ? ok(Math.abs(d.value)) : d;
}

/** The fractions `0, 1/(N+1), ..., N/(N+1), 1` with `N = GEOMETRY_SAMPLES`. */
const FRACTIONS: readonly number[] = Object.freeze(
  Array.from({ length: GEOMETRY_SAMPLES + 2 }, (_, k) => (k === GEOMETRY_SAMPLES + 1 ? 1 : k / (GEOMETRY_SAMPLES + 1))),
);

/**
 * Checks the geometry of a structurally valid B-rep against its topology (see the module comment). Runs
 * `validateBrep` first and returns its error, if any.
 */
export function validateBrepGeometry(kernel: Kernel, brep: Brep): Result<void> {
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;
  const tol = kernel.tolerances.zoneTol3d;
  const { vertices, edges, coedges, loops, faces } = brep;

  for (const [i, v] of vertices.entries()) {
    if (!isFinite3(v.point)) return fail('non-finite', 'vertex point is not finite', { kind: 'vertex', id: i });
  }

  for (const [i, e] of edges.entries()) {
    const ent = { kind: 'edge', id: i } as const;
    const [r0, r1] = curveRange(e.curve);
    const slack = ROUNDING_SLACK * Math.max(1, Math.abs(r0), Math.abs(r1));
    if (!(Number.isFinite(e.t0) && Number.isFinite(e.t1) && e.t0 < e.t1 && e.t0 >= r0 - slack && e.t1 <= r1 + slack)) {
      return fail('edge-range', `interval [${e.t0}, ${e.t1}] is not an increasing part of the curve range [${r0}, ${r1}]`, ent);
    }
    const start = vertices[e.start]!.point;
    let far = 0;
    for (const s of FRACTIONS) {
      const p = edgePointAt(e, s);
      if (!p.ok) return fail('edge-range', `curve cannot be evaluated at fraction ${s}: ${p.error.kind}`, ent);
      if (s === 0 || s === 1) {
        const which = s === 0 ? 'start' : 'end';
        const v = s === 0 ? e.start : e.end;
        const d = distance3(p.value, vertices[v]!.point);
        if (!(d <= tolAt(kernel, p.value))) return fail('edge-vertex', `curve ${which} point is ${d} from its ${which} vertex ${v}`, ent);
      }
      far = Math.max(far, distance3(p.value, start));
    }
    if (!(far > tol)) return fail('degenerate-edge', 'edge curve does not leave its start vertex (zero length)', ent);
  }

  for (const face of faces) {
    for (const l of face.loops) {
      const cs = loopCoedges(brep, l);
      if (!cs.ok) return cs;
      for (const c of cs.value) {
        const r = checkCoedge(kernel, brep, face.surface, c);
        if (!r.ok) return r;
      }
    }
  }

  // Seams: both coedges of an edge on one face. Each needs a pcurve (without them the two sides of the seam,
  // or a slit, cannot be told apart), and the two pcurves must not be the same (u, v) curve.
  const uses: CoedgeId[][] = edges.map(() => []);
  coedges.forEach((c, i) => uses[c.edge]!.push(i as CoedgeId));
  for (const [i, us] of uses.entries()) {
    const [a, b] = us as [CoedgeId, CoedgeId];
    const ca = coedges[a]!, cb = coedges[b]!;
    if (loops[ca.loop]!.face !== loops[cb.loop]!.face) continue;
    if (ca.pcurve === undefined || cb.pcurve === undefined) {
      return fail('seam-pcurves', `seam edge used twice by face ${loops[ca.loop]!.face} needs a pcurve on both coedges`, { kind: 'edge', id: i });
    }
    const a0 = pcurveUv(ca.pcurve, 0), a1 = pcurveUv(ca.pcurve, 1), b0 = pcurveUv(cb.pcurve, 0), b1 = pcurveUv(cb.pcurve, 1);
    if (!a0.ok || !a1.ok || !b0.ok || !b1.ok) continue; // unreachable: checked per coedge above
    const gap = Math.max(Math.hypot(a0.value.x - b1.value.x, a0.value.y - b1.value.y), Math.hypot(a1.value.x - b0.value.x, a1.value.y - b0.value.y));
    if (!(gap > tol)) return fail('seam-pcurves', `the pcurves of coedges ${a} and ${b} coincide in (u, v)`, { kind: 'edge', id: i });
  }
  return ok(undefined);
}

function checkCoedge(kernel: Kernel, brep: Brep, surface: Surface3, c: CoedgeId): Result<void> {
  const ent = { kind: 'coedge', id: c } as const;
  const co = brep.coedges[c]!;
  const e = brep.edges[co.edge]!;
  const pc = co.pcurve;
  if (pc === undefined) {
    for (const s of FRACTIONS) {
      const p = edgePointAt(e, s);
      if (!p.ok) return fail('edge-off-surface', `edge point cannot be evaluated: ${p.error.kind}`, ent);
      const d = distanceToSurface(kernel, surface, p.value);
      if (!d.ok) return fail('edge-off-surface', `distance to the surface cannot be measured: ${d.error.kind}`, ent);
      if (!(d.value <= tolAt(kernel, p.value))) return fail('edge-off-surface', `edge point at fraction ${s} is ${d.value} off the face surface`, ent);
    }
    return ok(undefined);
  }
  if (pc.dimension !== 2) return fail('pcurve-invalid', `pcurve has dimension ${pc.dimension}, not 2`, ent);
  const startPoint = brep.vertices[coedgeStart(brep, c)!]!.point, endPoint = brep.vertices[coedgeEnd(brep, c)!]!.point;
  // Coedge fraction of the previous sample's nearest edge point, and that lifted sample (direction check).
  let prevFraction = 0;
  let prevPoint = startPoint;
  for (const s of FRACTIONS) {
    const uv = pcurveUv(pc, s);
    if (!uv.ok) return fail('pcurve-invalid', `pcurve cannot be evaluated: ${uv.error.kind}`, ent);
    const p = surfacePoint3(surface, uv.value.x, uv.value.y);
    if (!p.ok) return fail('pcurve-invalid', `surface cannot be evaluated at (${uv.value.x}, ${uv.value.y}): ${p.error.kind}`, ent);
    if (s === 0 || s === 1) {
      const v = s === 0 ? coedgeStart(brep, c)! : coedgeEnd(brep, c)!;
      const d = distance3(p.value, brep.vertices[v]!.point);
      const which = s === 0 ? 'start' : 'end';
      if (!(d <= tolAt(kernel, p.value))) return fail('pcurve-endpoint', `pcurve ${which} maps ${d} away from the coedge's ${which} vertex ${v}`, ent);
    } else {
      const d = closestOnEdge(e, p.value);
      if (!d.ok) return fail('pcurve-deviation', `distance to the edge cannot be measured: ${d.error.kind}`, ent);
      const t = tolAt(kernel, p.value);
      if (!(d.value.distance <= t)) return fail('pcurve-deviation', `pcurve sample at fraction ${s} maps ${d.value.distance} off the edge curve`, ent);
      // The samples must advance along the coedge. Samples still at the start vertex count as fraction 0 and
      // samples at the end vertex as 1 (a closed edge's vertex is both); a step back is tolerated only
      // within the tolerance in 3D.
      let g = coedgeFraction(co.reversed, d.value.fraction);
      if (prevFraction === 0 && distance3(p.value, startPoint) <= t) g = 0;
      else if (distance3(p.value, endPoint) <= t) g = 1;
      if (g < prevFraction && !(distance3(p.value, prevPoint) <= 2 * t)) {
        return fail('pcurve-direction', `pcurve sample at fraction ${s} lies behind the previous one along the coedge`, ent);
      }
      if (g > prevFraction) prevFraction = g;
      prevPoint = p.value;
    }
  }
  return ok(undefined);
}
