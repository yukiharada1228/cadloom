/**
 * The prepared form of a body for queries: each face's trimmed `(u, v)` domain as closed polygons (one ring per
 * loop, outer first), each face's and edge's certified bounding box, and the body's box (`bodyBounds`).
 *
 * **Face domain rings.** A loop is walked coedge by coedge; each coedge contributes its edge's samples
 * (`sampleEdge` of `src/tess`, at chord `zoneTol3d` — the finest `meshRules` allows — and the display facet angle)
 * in its own direction, without its last sample (the next coedge's first). The `(u, v)` of a sample is the
 * kernel's one point-to-`(u, v)` mapping `surfaceUv` (`topology/geometry.ts`) with the coedge's pcurve at the
 * same fraction as the hint (so periodic parameters land on the pcurve's period: the two sides of a seam at
 * `u = 0` and `u = 2π`); on a NURBS surface the pcurve value itself; without a pcurve the previous sample as the
 * hint. This is the M2 mesher's boundary mapping itself (`faceBoundaryUv` of `tess/face.ts`, step 1), used here
 * **without** the mesher's later pole merge: where consecutive coedges meet at different `(u, v)` and the straight `(u, v)` segment between them
 * collapses onto their vertex (`uvGapCollapses`: a sphere pole, a cone apex — the M3 convention), both ends enter
 * the ring, so the ring runs along the collapsed iso-line and the polygon is the true parameter domain (e.g. the
 * rectangle `[0, 2π] × [-π/2, π/2]` of a full sphere). A jump that does not collapse is `invalid-topology`.
 * Lines on a plane are exact (two end points; the pcurve is linear); curved trims are polygons whose chords stay
 * within about `zoneTol3d` of the edge in 3D. Vertices lying exactly between their neighbours are dropped
 * (`dropCollinear`, exact): the polygon is unchanged, the straight sides of a cylinder's or torus's rectangle
 * keep only their corners.
 *
 * **Edge bands.** The ring chords follow an edge within `zoneTol3d` only while the sampling met its chord rule:
 * `sampleEdge` caps a curve at `MAX_SEGMENTS` segments (a circle of radius `1e5` at `zoneTol3d = 1e-5` needs far
 * more), and its NURBS rule is not certified. Each edge therefore gets a band (`PreparedBody.edgeBands`,
 * `sampleBand`): the largest gap between the curve at a segment's middle parameter and that segment's chord,
 * measured over every segment; the band is `zoneTol3d` when that gap is within `zoneTol3d`, else twice the gap.
 * Point-in-face reports points within an edge's band as `on` that edge, so a point the coarse polygon could
 * misplace is never decided by it (`classifyPoint` then discards the ray instead of miscounting it).
 *
 * **Bounds.** An edge's box is `boundCurve` over its interval (certified). A face's box is `boundSurface` over
 * the face's `(u, v)` box — the full surface patch over the trimmed face's parameter extent, which contains the
 * face (acceptable over-approximation; it is not tight for trimmed faces) — united with its edges' boxes. The
 * `(u, v)` box is certified from the convex hulls of the pcurves (`boundNurbsCurve`: a NURBS curve with positive
 * weights lies in its control polygon's hull), united with the ring samples. A coedge without pcurve on a
 * non-planar surface has only its samples' `(u, v)`: such a face's (and the body's) box is marked
 * `certified: false`. The body's box is the union of its face, edge and vertex boxes.
 *
 * Upstream consulted (for invariants and API shape, not translated): `solidcore/crates/solidcore/src/query/brep.rs`
 * (`BoundingBoxOptions`, body boxes from face and edge boxes), `query/face.rs`, `query/face_surface.rs` (the face's
 * parameter-space boundary from its pcurves), `query/distance_bound.rs`, `query/api_queries.rs`
 * (`brep_bounding_box`, `face_bounding_box`, `edge_bounding_box`), `solidcore-tess/src/mesher/uv.rs`,
 * `mesher/seam.rs`, `mesher/poles.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distanceToSegment3, vec2, type Point2 } from '../math/vec.ts';
import type { Surface3 } from '../surface/types.ts';
import { surfaceDomain } from '../nurbs/surface.ts';
import { curveDomain } from '../nurbs/curve.ts';
import { edgeId, faceId, loopCoedges, type Brep, type EdgeId, type FaceId, type VertexId } from '../topology/brep.ts';
import { validateBrep } from '../topology/validate.ts';
import { onCollinearSegment, orientFinite } from '../exact/polygon.ts';
import { meshRules, type MeshRules } from '../tess/tolerance.ts';
import { sampleEdge } from '../tess/mesh.ts';
import type { CurveSamples } from '../tess/sample.ts';
import { faceBoundaryUv } from '../tess/face.ts';
import { boundCurve, boundSurface, pointBox } from '../interval/bound.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import { boundNurbsCurve } from '../interval/nurbs-hull.ts';
import { box2OfPoints, unionBox2, unionBox3, type Box2, type Box3 } from '../interval/box.ts';
import { unsafeInterval } from '../interval/interval.ts';

/** Which surface parameters are periodic angles (period `2π`). */
export interface Periodicity {
  readonly u: boolean;
  readonly v: boolean;
}

/** One face prepared for queries. */
export interface FaceDomain {
  readonly face: FaceId;
  readonly surface: Surface3;
  readonly reversed: boolean;
  /** The trimmed `(u, v)` domain: one closed ring per loop (outer first), see the module comment. */
  readonly rings: readonly (readonly Point2[])[];
  /** The face's `(u, v)` box. */
  readonly uvBox: Box2;
  /** A box containing the face (the surface patch over `uvBox`, united with the edges' boxes). */
  readonly box: Box3;
  /** Whether `uvBox` (hence `box`) is certified (every coedge has a pcurve, or is a line on a plane). */
  readonly certified: boolean;
  /** The distinct edges and vertices of the face's loops, in loop order. */
  readonly edges: readonly EdgeId[];
  readonly vertices: readonly VertexId[];
  readonly periodic: Periodicity;
}

/** A body prepared for repeated queries (`prepareBody`). Frozen. */
export interface PreparedBody {
  readonly kind: 'prepared-body';
  readonly brep: Brep;
  readonly faces: readonly FaceDomain[];
  /** `boundCurve` of each edge over its interval (index = edge id). */
  readonly edgeBoxes: readonly Box3[];
  /** The boundary band of each edge (index = edge id; `zoneTol3d` or more, see the module comment). */
  readonly edgeBands: readonly number[];
  /** A box containing the whole body. */
  readonly box: Box3;
  /** Whether every face box is certified. */
  readonly certified: boolean;
}

/** A body as the query functions take it: a B-rep (prepared on each call) or a prepared body. */
export type BodyInput = Brep | PreparedBody;

const OP = 'query.prepareBody';

/** The periodic parameters of a surface (`u` of a cylinder, cone, sphere; both of a torus). */
export function periodicity(s: Surface3): Periodicity {
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

/** The sampling rules of the face domains: chord `zoneTol3d`, the display facet angle. */
export function domainRules(kernel: Kernel): Result<MeshRules> {
  return meshRules(kernel, { chord: kernel.tolerances.zoneTol3d });
}

const faceError = <T>(face: FaceId, reason: string): Result<T> =>
  err({ kind: 'invalid-topology', operation: OP, reason, entity: { kind: 'face', id: face } });

interface Rings {
  readonly rings: Point2[][];
  readonly edges: EdgeId[];
  readonly vertices: VertexId[];
  readonly pcurveBox: Box2 | undefined;
  readonly certified: boolean;
}

function faceRings(kernel: Kernel, brep: Brep, face: FaceId, samples: readonly Result<CurveSamples>[]): Result<Rings> {
  // The (u, v) boundary walk is tess's step 1 (`faceBoundaryUv`); here only the certified pcurve boxes and the
  // incident edges / vertices are added, and each ring is simplified.
  const boundary = faceBoundaryUv(kernel, brep, face, samples, OP);
  if (!boundary.ok) return boundary;
  const f = brep.faces[face]!;
  const s = f.surface;
  const edges: EdgeId[] = [];
  const vertices: VertexId[] = [];
  let pcurveBox: Box2 | undefined;
  let certified = true;
  const grow = (b: Box2): void => {
    pcurveBox = pcurveBox === undefined ? b : unionBox2(pcurveBox, b);
  };
  for (const l of f.loops) {
    const cs = loopCoedges(brep, l);
    if (!cs.ok) return cs;
    for (const c of cs.value) {
      const co = brep.coedges[c]!;
      const e = brep.edges[co.edge]!;
      if (!edges.includes(co.edge)) edges.push(co.edge);
      for (const v of [e.start, e.end]) if (!vertices.includes(v)) vertices.push(v);
      if (co.pcurve !== undefined) {
        const [a, b] = curveDomain(co.pcurve);
        const hull = boundNurbsCurve(co.pcurve, unsafeInterval(a, b));
        if (hull.ok && hull.value.length === 2) {
          const [hu, hv] = [hull.value[0]!, hull.value[1]!];
          grow(Object.freeze({ min: Object.freeze(vec2(hu.lo, hv.lo)), max: Object.freeze(vec2(hu.hi, hv.hi)) }));
        } else certified = false;
      } else if (!(s.kind === 'plane' && e.curve.kind === 'line')) certified = false;
    }
  }
  const rings: Point2[][] = [];
  for (const [i, loop] of boundary.value.loops.entries()) {
    const ring = loop.map((k) => boundary.value.uvs[k]!);
    // Drop consecutive repeats (a closed ring: the last joins the first).
    const clean = ring.filter((p, j) => {
      const q = ring[(j + 1) % ring.length]!;
      return ring.length === 1 || p.x !== q.x || p.y !== q.y;
    });
    const simple = dropCollinear(clean);
    if (simple.length < 3) return faceError(face, `loop ${f.loops[i]} is degenerate in (u, v)`);
    rings.push(simple.map((p) => Object.freeze(vec2(p.x, p.y))));
  }
  return ok({ rings, edges, vertices, pcurveBox, certified });
}

/**
 * The ring without the vertices lying on the segment between their neighbours (exact `orient2d` and coordinate
 * comparisons): the same closed polygon with fewer vertices (straight runs of seams and iso-lines collapse to
 * their ends). Spikes (a vertex beyond its neighbours on their line) are kept.
 */
export function dropCollinear(ring: readonly Point2[]): Point2[] {
  const between = (a: Point2, b: Point2, c: Point2): boolean => orientFinite(a, b, c) === 0 && onCollinearSegment(a, b, c);
  const out: Point2[] = [];
  for (const p of ring) {
    out.push(p);
    while (out.length >= 3 && between(out[out.length - 3]!, out[out.length - 2]!, out[out.length - 1]!)) out.splice(out.length - 2, 1);
  }
  // Wrap-around: the last and first vertices may also sit between their (cyclic) neighbours.
  for (let changed = true; changed && out.length > 3; ) {
    changed = false;
    const n = out.length;
    if (between(out[n - 2]!, out[n - 1]!, out[0]!)) {
      out.pop();
      changed = true;
    } else if (between(out[n - 1]!, out[0]!, out[1]!)) {
      out.shift();
      changed = true;
    }
  }
  return out;
}

/**
 * The boundary band of an edge sampled as `s` (see the module comment): `tol` when every chord stays within
 * `tol` of the curve at its middle parameter, else twice the largest such gap. Lines are exact (`tol`).
 */
export function sampleBand(curve: Curve3, s: CurveSamples, tol: number): Result<number> {
  if (curve.kind === 'line') return ok(tol);
  const [r0, r1] = curveRange(curve);
  let gap = 0;
  for (let i = 0; i + 1 < s.params.length; i++) {
    const tm = Math.min(r1, Math.max(r0, (s.params[i]! + s.params[i + 1]!) / 2));
    const c = curvePoint3(curve, tm);
    if (!c.ok) return c;
    gap = Math.max(gap, distanceToSegment3(c.value, s.points[i]!, s.points[i + 1]!));
  }
  if (!Number.isFinite(gap)) return err({ kind: 'invalid-input', operation: OP, reason: 'edge samples are not finite' });
  return ok(gap <= tol ? tol : 2 * gap);
}

/** Clamps a `(u, v)` box into a NURBS surface's knot domain (the face cannot leave it). */
function clampToSurface(s: Surface3, b: Box2): Box2 {
  if (s.kind !== 'nurbs') return b;
  const d = surfaceDomain(s.surface);
  const c = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);
  return Object.freeze({
    min: Object.freeze(vec2(c(b.min.x, d.u[0], d.u[1]), c(b.min.y, d.v[0], d.v[1]))),
    max: Object.freeze(vec2(c(b.max.x, d.u[0], d.u[1]), c(b.max.y, d.v[0], d.v[1]))),
  });
}

/**
 * Prepares `brep` for queries (see the module comment). Fails with the structural error of `validateBrep`, with
 * the error of an edge that cannot be sampled or bounded, and with `invalid-topology` naming a face whose loops
 * cannot be mapped to closed `(u, v)` rings.
 */
export function prepareBody(kernel: Kernel, brep: Brep): Result<PreparedBody> {
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;
  const rules = domainRules(kernel);
  if (!rules.ok) return rules;
  const samples = brep.edges.map((_, i) => sampleEdge(brep, edgeId(i), rules.value));
  const edgeBoxes: Box3[] = [];
  const edgeBands: number[] = [];
  for (const [i, e] of brep.edges.entries()) {
    const b = boundCurve(e.curve, unsafeInterval(e.t0, e.t1));
    if (!b.ok) return b;
    edgeBoxes.push(b.value);
    const es = samples[i]!;
    if (!es.ok) return es;
    const band = sampleBand(e.curve, es.value, kernel.tolerances.zoneTol3d);
    if (!band.ok) return band;
    edgeBands.push(band.value);
  }
  const faces: FaceDomain[] = [];
  let box: Box3 | undefined;
  let certified = true;
  const add = (b: Box3): void => {
    box = box === undefined ? b : unionBox3(box, b);
  };
  for (let i = 0; i < brep.faces.length; i++) {
    const fid = faceId(i);
    const f = brep.faces[fid]!;
    const r = faceRings(kernel, brep, fid, samples);
    if (!r.ok) return r;
    const pts = r.value.rings.flat();
    const sampleBox = box2OfPoints(pts);
    if (!sampleBox.ok) return sampleBox;
    const uvBox = clampToSurface(f.surface, r.value.pcurveBox === undefined ? sampleBox.value : unionBox2(r.value.pcurveBox, sampleBox.value));
    const fb = boundSurface(f.surface, unsafeInterval(uvBox.min.x, uvBox.max.x), unsafeInterval(uvBox.min.y, uvBox.max.y));
    if (!fb.ok) return fb;
    let faceBox = fb.value;
    for (const e of r.value.edges) faceBox = unionBox3(faceBox, edgeBoxes[e]!);
    certified &&= r.value.certified;
    add(faceBox);
    faces.push(
      Object.freeze({
        face: fid,
        surface: f.surface,
        reversed: f.reversed,
        rings: Object.freeze(r.value.rings.map((ring) => Object.freeze(ring))),
        uvBox,
        box: faceBox,
        certified: r.value.certified,
        edges: Object.freeze(r.value.edges),
        vertices: Object.freeze(r.value.vertices),
        periodic: Object.freeze(periodicity(f.surface)),
      }),
    );
  }
  for (const b of edgeBoxes) add(b);
  for (const v of brep.vertices) {
    const b = pointBox(v.point);
    if (!b.ok) return b;
    add(b.value);
  }
  if (box === undefined) return err({ kind: 'invalid-input', operation: OP, reason: 'the body has no geometry' });
  return ok(
    Object.freeze({
      kind: 'prepared-body',
      brep,
      faces: Object.freeze(faces),
      edgeBoxes: Object.freeze(edgeBoxes),
      edgeBands: Object.freeze(edgeBands),
      box,
      certified,
    }),
  );
}

/** The prepared body of a query input (prepares a bare B-rep). */
export function prepared(kernel: Kernel, body: BodyInput): Result<PreparedBody> {
  return 'kind' in body && body.kind === 'prepared-body' ? ok(body) : prepareBody(kernel, body as Brep);
}

/** A certified box of the body (see the module comment), with whether every face box is certified. */
export interface BodyBounds {
  readonly box: Box3;
  readonly certified: boolean;
}

/**
 * A box containing the body: the union of its faces' surface-patch boxes over their `(u, v)` extents, its edges'
 * `boundCurve` boxes and its vertices. Over-approximates trimmed faces (the full patch over the face's parameter
 * box). `certified` is false when a face's `(u, v)` extent came from samples only (see the module comment).
 */
export function bodyBounds(kernel: Kernel, body: BodyInput): Result<BodyBounds> {
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  return ok(Object.freeze({ box: b.value.box, certified: b.value.certified }));
}
