/**
 * Curve/surface intersection, and the ray (half-line) helper of the query code.
 *
 * Every answer is one of the classes of `types.ts`; contact means "within `tol`"
 * (`kernel.tolerances.zoneTol3d`). Results carry `(t, u, v)`: `t` in the curve's range, `(u, v)`
 * from the surface's own point inversion (`projectPoint`: `u ∈ [0, 2π)` for the periodic
 * directions, the sphere latitude in `[-π/2, π/2]`, a NURBS surface's knot domain).
 *
 * **Exact (closed form).**
 * - line/plane: `t = n·(p0 - o) / n·d` (Lean `IntersectCurve.line_plane_on`), formed in exact dyadic
 *   arithmetic from the stored doubles and correctly rounded; `n·d = 0` exactly is parallel (no
 *   solution, `line_plane_parallel`) unless the line lies within `tol` of the plane (an overlap).
 * - line/sphere, line/cylinder, line/cone: the quadratic `A t² + B t + C = 0` of the implicit
 *   equation in the surface frame (sphere `|x|² = r²`, cylinder `x² + y² = r²`, cone
 *   `x² + y² = (b + τ z)²`, `τ = tan α`), roots `(-B ± s) / 2A` with `s² = B² - 4AC` (Lean
 *   `quadratic_roots`, and `disc_neg_no_root`: a negative discriminant has no real root; the coefficients
 *   are Lean `sphere_coeffs` / `cylinder_coeffs` / `cone_coeffs`, the vertex test `vertex_value`).
 *   The coefficients are formed about the line point at the vertex clamped to the range
 *   (`t = t_c + τ`): a ray from 1e6 away would otherwise cancel `B² - 4AC` to noise.
 *   Contacts are classified geometrically at the vertex `t_m = -B / 2A` of the quadratic: when the
 *   signed distance there (`implicitValue`) is within `tol`, the line touches the surface: **one
 *   tangent point** (both roots, if any, lie within the contact) at the vertex — or, the vertex
 *   beyond the range, at the nearest range end if that end is within `tol`, else the roots on the
 *   range; otherwise the real roots are transversal points. Cone roots must lie on the stored nappe (`b + τ z >= 0`). A line within
 *   `tol` of the surface at both ends and the middle lies on it (a ruling / generator): an overlap.
 * - circle/plane: `γ + α cos θ + β sin θ = 0` (`circlePlaneAngles` of `curve-curve.ts`); a crossing
 *   that doubles cannot place within `tol` is refused (`precision exhausted`, `precisionLimited`).
 *
 * **Certified, analytic surfaces (any curve; line/torus, circle/sphere, NURBS/cylinder, ...).** A
 * one-parameter search along the curve with the algebraic implicit `G` of the surface
 * (plane `z`, sphere `|x|² - r²`, cylinder `x² + y² - r²`, cone `x² + y² - (b + τ z)²`, torus
 * `(|x|² + R² - r²)² - 4R²(x² + y²)` — the quartic for a line, whose every root lies on the tube for
 * `R > r`: Lean `torus_root_on_tube`) and a lower bound of the geometric
 * distance (`z`; `|x| - r`; `ρ - r`; the cone's meridian distance `(ρ - b) cos α - z sin α`;
 * `√((ρ - R)² + z²) - r`), both evaluated in outward-rounded interval arithmetic on the certified
 * box of a curve piece (`boundCurve`, frame coordinates by interval dot products):
 * 1. *exclusion*: the distance enclosure lies beyond `±tol`: no contact on the piece; or the
 *    centered form `G(m) + G'(T)(T - m)` (Lean `centered_mem`) lies beyond the band `gBand` that
 *    `|G|` cannot exceed within `tol` of the surface (`sphere_band`, `prod_bound`) — second order
 *    in the piece size, so a circle `2 tol` off a sphere is excluded without `tol`-sized pieces;
 * 2. *isolation*: `0 ∉ G'(T) = ∇G(box) · C'(T)` (interval chain rule): `G` is strictly monotone on
 *    the piece, so it has at most one root there (Lean `monotone_unique_root`); the Krawczyk
 *    operator `K(T) = m - y G(m) + (1 - y G'(T))(T - m)` with `K ∩ T = ∅` also proves no root
 *    (`krawczyk_excludes`, from the mean-value containment `krawczyk_root_mem`). The root is then
 *    bracketed by the signs of `G` at the piece ends and solved by Illinois regula falsi (60 steps):
 *    a **transversal, unique** point. A monotone piece without sign change has no root; at a
 *    range end it may still come within `tol` (an end contact, reported).
 * 3. otherwise as in curve/curve: contact coverage (five samples within `tol`), leaves of box
 *    diameter `<= tol`, splitting; contact stretches become an overlap (one run of samples within
 *    `tol` longer than `4 √(2 tol D)`, `D` the curve's box diagonal; an end at the stretch boundary is
 *    carried on while the curve stays within `tol`, `extendContactEnd`, and overlapping overlaps are
 *    merged), one **tangent** point at the
 *    minimum distance (golden-section search on `|implicitValue|`), or a refusal. So a line tangent
 *    to a torus is one tangent point, and two roots closer than the tolerance lets the search
 *    separate are one tangent point, never two spurious ones.
 * The isolation and exclusion tests hold for the algebraic form of the stored doubles up to the
 * frame being orthonormal (as `implicitValue` assumes); the root and its deviation are floating.
 *
 * **Certified, NURBS surfaces.** Subdivision of (curve piece) × (surface patch): exclusion by
 * `boundCurve` / `boundSurface` boxes separated by more than `tol`, or the mean-value form along the
 * surface normal at the linearised foot of the curve center (`separatedAlong`, Lean
 * `axis_separation`), or — on isolating pairs — the 3×3 Krawczyk operator missing the box
 * (`krawczykExcludes3`, Lean `krawczyk3_row_mem`: a transversal contact is an exact zero of
 * `C(t) - S(u, v)`; not used on pairs at a curve end or at an edge of the surface domain, where a
 * contact within `tol` can have its exact zero beyond the domain); isolation by the Krawczyk
 * contraction test on the square system `F(t, u, v) = C(t) - S(u, v)` with the interval Jacobian
 * `[C'(T), -S_u, -S_v]` (`S_u = (W X_u - W_u X) / W²` from `homogeneousPartials`); then
 * Gauss–Newton in `(t, u, v)` from the center (variables stopped by a bound stay there and the free
 * ones are re-solved, so a contact at a curve end or a domain edge is reached); non-isolating pairs as above (coverage by
 * `projectPoint`, which for NURBS is sampled, so a missed nearer point only makes coverage fail —
 * the conservative side). Bounds: `SURFACE_PAIR_BUDGET` visits, `CURVE_MAX_DEPTH` levels.
 *
 * A short contact stretch whose end offsets `C - S` lie on opposite sides at an angle of at least
 * `angTolDeg` (`crossesOver`) is a crossing the isolation could not certify (a pole of a NURBS
 * sphere): one **transversal** point, `unique: false`.
 *
 * Duplicates (points within `tol` that are the same place of the curve, `samePlaceOnCurve`: a seam
 * or a piece boundary, not two branches of a self-crossing curve) are merged keeping the smaller `t`; points inside an overlap are dropped; hits are sorted by `t`.
 * Deviation: `|C(t) - S(u, v)|` for a point, the largest sampled distance for an overlap.
 *
 * Closed forms whose exact root on the range cannot be placed within `tol` by doubles (coordinates
 * whose spacing exceeds `tol`) are refused (`precision exhausted`), never reported empty. A line
 * against a torus is first clipped to the ball holding the torus (same parametrisation).
 *
 * Ray helper: {@link intersectRay} intersects the segment `origin + t d`, `t ∈ [0, maxT]`; by
 * default `maxT` reaches past a bounded surface's box (sphere, torus, NURBS) and to `1e9` model
 * units (scaled by the origin's size) for the unbounded plane, cylinder and cone.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/api_intersectors.rs (`intersect_curve_surface`,
 *   `curve_plane_crossings`: overlaps as curve ranges, isolated points, a closed curve's seam once),
 *   solidcore/crates/solidcore/src/intersect/ray_tracer.rs (ray against faces: the nearest hits in
 *   ray order), solidcore/crates/solidcore/src/intersect/point_class.rs (tolerance of contacts),
 *   solidcore/crates/solidcore/src/surface/implicit.rs (the implicit forms),
 *   solidcore/docs/ssi.md §4.2 (boundary curves against the other surface), §1 (refuse by name),
 *   solidcore/docs/definitions-and-certificates.md (interval enclosures, Krawczyk). Rewritten for
 *   cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, length3, scale3, sub3, isFinite3, type Point3, type Vec3 } from '../math/vec.ts';
import { addDyadic, mulDyadic, signDyadic, subDyadic } from '../exact/dyadic.ts';
import { createLineCurve, curveRange, type CircleCurve, type Curve3, type LineCurve } from '../curve/types.ts';
import { evaluateCurve3 } from '../curve/evaluate.ts';
import { evaluateSurface3 } from '../surface/evaluate.ts';
import { implicitValue, projectPoint } from '../surface/implicit.ts';
import { localCoordinates, surfaceOrigin, type AnalyticSurface3, type NurbsSurface3, type Surface3 } from '../surface/types.ts';
import { surfaceDomain } from '../nurbs/surface.ts';
import {
  add,
  boundSurface,
  boxesDisjoint3,
  box3Diagonal,
  div,
  homogeneousPartials,
  intersect as ivIntersect,
  ivec3,
  ivSub,
  mul,
  scale,
  sqr,
  sqrt as ivSqrt,
  sub,
  type Box3,
  type IVec3,
  type Interval,
} from '../interval/index.ts';
import {
  arcParam,
  boxIVec,
  circlePlaneAngles,
  crossesOver,
  curveCtx,
  dotVecIv,
  insideSlack,
  ivOf,
  ivPt,
  krawczykContracts,
  lineParam,
  makePiece,
  pieceCenterBox,
  pieceDeriv,
  pieceKids,
  samePlaceOnCurve,
  separatedAlong,
  precisionLimited,
  extendContactEnd,
  searchLimits,
  type IntersectLimits,
  type CurveCtx,
  type CurvePiece,
} from './curve-curve.ts';
import { dy, qDiv, qOfDyadic, qToNumber } from '../exact/rational.ts';
import { invertMatrix } from './linalg.ts';
import {
  combineClass,
  intersectionResult,
  refusal,
  type ContactKind,
  type CurveSurfaceHit,
  type CurveSurfaceOverlap,
  type CurveSurfacePoint,
  type IntersectionClass,
  type IntersectionResult,
} from './types.ts';

const OP = 'intersect.intersectCurveSurface';
const OP_RAY = 'intersect.intersectRay';

/** Pair visits allowed in one NURBS-surface solve, piece visits in one analytic solve. */
export const SURFACE_PAIR_BUDGET = 200_000;
const COVER_DEPTH = 2;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------------------------
// Hit assembly.

interface RawHit {
  t: number;
  u: number;
  v: number;
  point: Point3;
  contact: ContactKind;
  cls: IntersectionClass;
  deviation: number;
  unique: boolean;
}

/** A hit at curve parameter `t` (point `p = C(t)`), with `(u, v)` and the deviation from the surface's inversion. */
function hitAt(kernel: Kernel, surface: Surface3, t: number, p: Point3, contact: ContactKind, cls: IntersectionClass, unique: boolean): Result<RawHit> {
  const pr = projectPoint(kernel, surface, p);
  if (!pr.ok) return pr;
  return ok({ t, u: pr.value.u, v: pr.value.v, point: p, contact, cls, deviation: pr.value.distance, unique });
}

function curvePoint(curve: Curve3, t: number): Result<Point3> {
  const e = evaluateCurve3(curve, t);
  return e.ok ? ok(e.value.point) : e;
}

function makeSurfaceOverlap(
  kernel: Kernel,
  curve: Curve3,
  surface: Surface3,
  lo: number,
  hi: number,
  cls: IntersectionClass,
  deviation: number,
): Result<CurveSurfaceOverlap> {
  const uv: { u: number; v: number }[] = [];
  let dev = deviation;
  for (const t of [lo, hi]) {
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    const pr = projectPoint(kernel, surface, p.value);
    if (!pr.ok) return pr;
    uv.push({ u: pr.value.u, v: pr.value.v });
    dev = Math.max(dev, pr.value.distance);
  }
  return ok(
    Object.freeze({
      kind: 'overlap',
      range: Object.freeze([lo, hi] as const),
      start: Object.freeze(uv[0]!),
      end: Object.freeze(uv[1]!),
      class: cls,
      deviation: dev,
    }),
  );
}

function finishSurfaceHits(
  curve: Curve3,
  points: readonly RawHit[],
  inputOverlaps: readonly CurveSurfaceOverlap[],
  tol: number,
  forceCertified: boolean,
): Result<IntersectionResult<CurveSurfaceHit>> {
  // Overlaps that share curve parameters (two stretches whose ends were carried into each other,
  // `extendContactEnd`) are one component.
  const byStart = [...inputOverlaps].sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
  const mergedOverlaps: CurveSurfaceOverlap[] = [];
  for (const o of byStart) {
    const last = mergedOverlaps[mergedOverlaps.length - 1];
    if (last === undefined || o.range[0] > last.range[1]) {
      mergedOverlaps.push(o);
      continue;
    }
    if (o.range[1] <= last.range[1]) {
      mergedOverlaps[mergedOverlaps.length - 1] = Object.freeze({ ...last, deviation: Math.max(last.deviation, o.deviation), class: combineClass([last.class, o.class]) });
      continue;
    }
    mergedOverlaps[mergedOverlaps.length - 1] = Object.freeze({
      kind: 'overlap',
      range: Object.freeze([last.range[0], o.range[1]] as const),
      start: last.start,
      end: o.end,
      class: combineClass([last.class, o.class]),
      deviation: Math.max(last.deviation, o.deviation),
    });
  }
  const overlaps: readonly CurveSurfaceOverlap[] = mergedOverlaps;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const kept: RawHit[] = [];
  for (const p of sorted) {
    // One hit per place of the curve: a closed curve's seam or a piece boundary merges, two
    // branches of a self-crossing curve through one surface point do not (`samePlaceOnCurve`).
    let same: RawHit | undefined;
    for (const k of kept) {
      if (!(length3(sub3(k.point, p.point)) <= tol)) continue;
      const sp = samePlaceOnCurve(curve, k.t, p.t, tol);
      if (!sp.ok) return sp;
      if (sp.value) {
        same = k;
        break;
      }
    }
    if (same !== undefined) {
      if (p.contact === 'tangent') same.contact = 'tangent';
      if (p.cls === 'certified') same.cls = 'certified';
      same.unique = same.unique && p.unique && same.contact === 'transversal';
      same.deviation = Math.max(same.deviation, p.deviation);
      continue;
    }
    kept.push({ ...p });
  }
  const inOverlap = (p: RawHit): Result<boolean> => {
    for (const o of overlaps) {
      if (p.t >= o.range[0] - 1e-12 * (1 + Math.abs(p.t)) && p.t <= o.range[1] + 1e-12 * (1 + Math.abs(p.t))) return ok(true);
      for (const e of o.range) {
        const q = curvePoint(curve, e);
        if (!q.ok || !(length3(sub3(q.value, p.point)) <= tol)) continue;
        const sp = samePlaceOnCurve(curve, e, p.t, tol);
        if (!sp.ok) return sp;
        if (sp.value) return ok(true);
      }
    }
    return ok(false);
  };
  const hits: CurveSurfaceHit[] = [];
  for (const p of kept) {
    const io = inOverlap(p);
    if (!io.ok) return io;
    if (io.value) continue;
    hits.push(
      Object.freeze({
        kind: 'point',
        t: p.t,
        u: p.u,
        v: p.v,
        point: Object.freeze({ x: p.point.x, y: p.point.y, z: p.point.z }),
        contact: p.contact,
        class: p.cls,
        deviation: p.deviation,
        unique: p.unique,
      }) satisfies CurveSurfacePoint,
    );
  }
  hits.push(...overlaps);
  hits.sort((a, b) => (a.kind === 'point' ? a.t : a.range[0]) - (b.kind === 'point' ? b.t : b.range[0]));
  for (const h of hits) if (!Number.isFinite(h.deviation)) return invalidInput(OP, 'non-finite deviation');
  return ok(intersectionResult(forceCertified ? 'certified' : combineClass(hits.map((h) => h.class)), hits));
}

// ---------------------------------------------------------------------------------------------
// Closed forms: line / plane, line / quadric, circle / plane.

interface Outcome {
  readonly points: RawHit[];
  readonly overlaps: CurveSurfaceOverlap[];
}

/**
 * Line/plane with the plane through `p0` with normal `n` (as stored): exact rational
 * `t = n·(p0 - o) / n·d`, or `undefined` when `n·d = 0` exactly.
 */
export function linePlaneParam(o: Point3, d: Vec3, p0: Point3, n: Vec3): number | undefined {
  const nx = dy(n.x), ny = dy(n.y), nz = dy(n.z);
  const den = addDyadic(addDyadic(mulDyadic(nx, dy(d.x)), mulDyadic(ny, dy(d.y))), mulDyadic(nz, dy(d.z)));
  if (signDyadic(den) === 0) return undefined;
  const w = [subDyadic(dy(p0.x), dy(o.x)), subDyadic(dy(p0.y), dy(o.y)), subDyadic(dy(p0.z), dy(o.z))] as const;
  const num = addDyadic(addDyadic(mulDyadic(nx, w[0]), mulDyadic(ny, w[1])), mulDyadic(nz, w[2]));
  return qToNumber(qDiv(qOfDyadic(num), qOfDyadic(den)));
}

/** A line lying within `tol` of the surface at both ends and the middle: an overlap (the line is a ruling / generator / in the plane). */
function lineOnSurface(kernel: Kernel, L: LineCurve, s: AnalyticSurface3, tol: number): Result<CurveSurfaceOverlap | undefined> {
  const [t0, t1] = L.range;
  let dev = 0;
  for (let k = 0; k <= 4; k++) {
    const t = k === 4 ? t1 : t0 + ((t1 - t0) * k) / 4;
    const g = implicitValue(s, add3(L.origin, scale3(L.direction, t)));
    if (!g.ok) return g;
    dev = Math.max(dev, Math.abs(g.value));
    if (!(dev <= tol)) return ok(undefined);
  }
  return makeSurfaceOverlap(kernel, L, s, t0, t1, s.kind === 'plane' ? 'exact' : 'certified', dev);
}

function linePlane(kernel: Kernel, L: LineCurve, s: AnalyticSurface3 & { kind: 'plane' }, tol: number): Result<Outcome> {
  const on = lineOnSurface(kernel, L, s, tol);
  if (!on.ok) return on;
  if (on.value !== undefined) return ok({ points: [], overlaps: [on.value] });
  const t = linePlaneParam(L.origin, L.direction, s.origin, s.frame.normal);
  if (t === undefined) return ok({ points: [], overlaps: [] });
  const tl = lineParam(L, t, tol);
  if (tl === undefined) return ok({ points: [], overlaps: [] });
  const h = hitAt(kernel, s, tl, add3(L.origin, scale3(L.direction, tl)), 'transversal', 'exact', true);
  if (!h.ok) return h;
  // An exact root on the range that doubles cannot place within tol (coordinates so large that
  // their spacing exceeds tol): refused, never reported as "no intersection".
  if (!(h.value.deviation <= tol)) return tl === t ? err(refusal(OP, 'precision exhausted')) : ok({ points: [], overlaps: [] });
  return ok({ points: [h.value], overlaps: [] });
}

/** The coefficients `[A, B, C]` of the quadric's equation along the line, in the surface frame. */
function quadricCoefficients(origin: Point3, L: LineCurve, s: AnalyticSurface3 & { kind: 'sphere' | 'cylinder' | 'cone' }): readonly [number, number, number] {
  const o0 = surfaceOrigin(s);
  const [ox, oy, oz] = localCoordinates(s.frame, o0, origin);
  const d = L.direction, F = s.frame;
  const dx = dot3(d, F.xAxis), dyy = dot3(d, F.yAxis), dz = dot3(d, F.normal);
  switch (s.kind) {
    case 'sphere':
      return [dx * dx + dyy * dyy + dz * dz, 2 * (ox * dx + oy * dyy + oz * dz), ox * ox + oy * oy + oz * oz - s.radius * s.radius];
    case 'cylinder':
      return [dx * dx + dyy * dyy, 2 * (ox * dx + oy * dyy), ox * ox + oy * oy - s.radius * s.radius];
    case 'cone': {
      const tau = Math.tan(s.semiAngle), R0 = s.baseRadius + tau * oz;
      return [dx * dx + dyy * dyy - tau * tau * dz * dz, 2 * (ox * dx + oy * dyy - tau * R0 * dz), ox * ox + oy * oy - R0 * R0];
    }
  }
}

/** The real roots `(-B ± s) / 2A`, `s = √(B² - 4AC)` (none when the discriminant is negative). */
export function quadraticRoots(A: number, B: number, C: number): readonly number[] {
  if (A === 0) return B === 0 ? [] : [-C / B];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [(-B - s) / (2 * A), (-B + s) / (2 * A)].sort((x, y) => x - y);
}

/**
 * A line running along a generator of the cone through its apex: the cone surface is one nappe
 * (`R(v) >= 0`), so only the part of the line on the nappe side of the apex lies on it. Along such
 * a line the quadratic's coefficients all vanish (to rounding), so the general formula would place
 * a spurious "tangent" point; this reports the one overlap, from the apex to the range end, instead.
 * `undefined` when the line does not cross the apex plane inside its range or that part is not on
 * the cone.
 */
function coneGeneratorPiece(kernel: Kernel, L: LineCurve, s: AnalyticSurface3 & { kind: 'cone' }, tol: number): Result<CurveSurfaceOverlap | undefined> {
  const tau = Math.tan(s.semiAngle);
  const rate = tau * dot3(L.direction, s.frame.normal);
  if (!(rate !== 0) || !Number.isFinite(rate)) return ok(undefined);
  const oz = localCoordinates(s.frame, s.origin, L.origin)[2];
  const ta = -(s.baseRadius + tau * oz) / rate;
  const [t0, t1] = L.range;
  if (!(ta > t0 && ta < t1)) return ok(undefined);
  // R(t) = b + τ (oz + t d_z) grows with t when rate > 0: the nappe is t >= ta.
  const side: readonly [number, number] = rate > 0 ? [ta, t1] : [t0, ta];
  // A piece shorter than the tolerance is the apex touch only: left to the point formulas.
  if (!((side[1] - side[0]) * length3(L.direction) > tol)) return ok(undefined);
  const sub = createLineCurve(L.origin, L.direction, side);
  if (!sub.ok) return ok(undefined);
  const on = lineOnSurface(kernel, sub.value, s, tol);
  if (!on.ok || on.value === undefined) return on;
  // Same origin and direction: the sub-line's parameters are L's.
  return makeSurfaceOverlap(kernel, L, s, side[0], side[1], 'certified', on.value.deviation);
}

function lineQuadric(kernel: Kernel, L: LineCurve, s: AnalyticSurface3 & { kind: 'sphere' | 'cylinder' | 'cone' }, tol: number): Result<Outcome> {
  const on = lineOnSurface(kernel, L, s, tol);
  if (!on.ok) return on;
  if (on.value !== undefined) return ok({ points: [], overlaps: [on.value] });
  if (s.kind === 'cone') {
    const piece = coneGeneratorPiece(kernel, L, s, tol);
    if (!piece.ok) return piece;
    if (piece.value !== undefined) return ok({ points: [], overlaps: [piece.value] });
  }
  const at = (t: number): Point3 => add3(L.origin, scale3(L.direction, t));
  // Coefficients about the line point at the vertex clamped to the range (t = tc + τ): a far line
  // origin (a ray from 1e6 away) would otherwise cancel B² - 4AC to noise.
  const [A0, B0] = quadricCoefficients(L.origin, L, s);
  const tc = A0 !== 0 && Number.isFinite(A0) && Number.isFinite(B0) ? clamp(-B0 / (2 * A0), L.range[0], L.range[1]) : 0;
  const [A, B, C] = quadricCoefficients(at(tc), L, s);
  const onNappe = (p: Point3): boolean => {
    if (s.kind !== 'cone') return true;
    const z = localCoordinates(s.frame, s.origin, p)[2];
    return s.baseRadius + Math.tan(s.semiAngle) * z >= -tol;
  };
  const points: RawHit[] = [];
  /**
   * Records the hit at `t` when on the range (and nappe) within `tol`; whether it did. A root
   * (`strict`) strictly on the range that doubles cannot place within `tol` is refused.
   */
  const consider = (t: number, contact: ContactKind, strict = false): Result<boolean> => {
    const tl = lineParam(L, t, tol);
    if (tl === undefined) return ok(false);
    const p = at(tl);
    if (!onNappe(p)) return ok(false);
    const h = hitAt(kernel, s, tl, p, contact, 'exact', true);
    if (!h.ok) return h;
    if (!(h.value.deviation <= tol)) return strict && tl === t ? err(refusal(OP, 'precision exhausted')) : ok(false);
    points.push(h.value);
    return ok(true);
  };
  if (A !== 0 && Number.isFinite(A)) {
    const tm = tc - B / (2 * A);
    const g = implicitValue(s, at(tm));
    if (g.ok && Math.abs(g.value) <= tol && onNappe(at(tm))) {
      // A touch: the tangent point at the vertex, or — the vertex beyond the range — at the
      // nearest range end when it is still within the contact; else the roots in range.
      const q = consider(tm, 'tangent');
      if (!q.ok) return q;
      if (q.value) return ok({ points, overlaps: [] });
      const te = clamp(tm, L.range[0], L.range[1]);
      if (te !== tm) {
        const qe = consider(te, 'tangent');
        if (!qe.ok) return qe;
        if (qe.value) return ok({ points, overlaps: [] });
      }
    }
  }
  for (const tau of quadraticRoots(A, B, C)) {
    const q = consider(tc + tau, 'transversal', true);
    if (!q.ok) return q;
  }
  return ok({ points, overlaps: [] });
}

function circlePlane(kernel: Kernel, c: CircleCurve, s: AnalyticSurface3 & { kind: 'plane' }, tol: number): Result<Outcome> {
  const roots = circlePlaneAngles(c.center, c.radius, c.frame.xAxis, c.frame.yAxis, s.origin, s.frame.normal, tol);
  if (roots === 'overlap') {
    const o = makeSurfaceOverlap(kernel, c, s, c.range[0], c.range[1], 'exact', 0);
    return o.ok ? ok({ points: [], overlaps: [o.value] }) : o;
  }
  const points: RawHit[] = [];
  for (const r of roots) {
    const th = arcParam(r.theta, c.range, tol / c.radius);
    if (th === undefined) continue;
    const p = curvePoint(c, th);
    if (!p.ok) return p;
    const h = hitAt(kernel, s, th, p.value, r.tangent ? 'tangent' : 'transversal', 'exact', true);
    if (!h.ok) return h;
    if (h.value.deviation <= tol) points.push(h.value);
    else if (!r.tangent && precisionLimited(tol, p.value.x, p.value.y, p.value.z, c.center.x, c.center.y, c.center.z, c.radius)) {
      // A crossing that doubles cannot place within tol: refused, never "no intersection".
      return err(refusal(OP, 'precision exhausted'));
    }
  }
  return ok({ points, overlaps: [] });
}

// ---------------------------------------------------------------------------------------------
// One-parameter search against an analytic surface.

interface ImplicitEnclosure {
  /** Algebraic implicit `G`. */
  readonly g: Interval;
  /** `∇G` in frame coordinates. */
  readonly grad: readonly [Interval, Interval, Interval];
  /** Lower bound (in magnitude, with sign) of the signed distance: excluded when `lo > tol` or `hi < -tol`. */
  readonly dist: Interval;
}

const ZERO = ivPt(0);

/** Frame coordinates `(x, y, z)` of a world interval vector. */
function localIv(s: AnalyticSurface3, p: IVec3): readonly [Interval, Interval, Interval] {
  const o = surfaceOrigin(s);
  const w = ivSub(p, ivec3(ivPt(o.x), ivPt(o.y), ivPt(o.z)));
  return [dotVecIv(s.frame.xAxis, w), dotVecIv(s.frame.yAxis, w), dotVecIv(s.frame.normal, w)];
}

/** The algebraic implicit, its gradient and a signed distance bound over frame-coordinate intervals. */
function implicitEnclosure(s: AnalyticSurface3, x: Interval, y: Interval, z: Interval): Result<ImplicitEnclosure> {
  const rho2 = add(sqr(x), sqr(y));
  const rho = ivSqrt(rho2);
  if (!rho.ok) return rho;
  switch (s.kind) {
    case 'plane':
      return ok({ g: z, grad: [ZERO, ZERO, ivPt(1)], dist: z });
    case 'sphere': {
      const r2 = add(rho2, sqr(z));
      const n = ivSqrt(r2);
      if (!n.ok) return n;
      return ok({ g: sub(r2, sqr(ivPt(s.radius))), grad: [scale(x, 2), scale(y, 2), scale(z, 2)], dist: sub(n.value, ivPt(s.radius)) });
    }
    case 'cylinder':
      return ok({ g: sub(rho2, sqr(ivPt(s.radius))), grad: [scale(x, 2), scale(y, 2), ZERO], dist: sub(rho.value, ivPt(s.radius)) });
    case 'cone': {
      const tau = Math.tan(s.semiAngle);
      const R = add(ivPt(s.baseRadius), scale(z, tau));
      const ca = Math.cos(s.semiAngle), sa = Math.sin(s.semiAngle);
      // (ρ - b) cos α - z sin α, the trig values padded by one rounding each.
      const cI = ivOf(ca - 2 * Number.EPSILON * Math.abs(ca), ca + 2 * Number.EPSILON * Math.abs(ca));
      const sI = ivOf(Math.min(sa * (1 - 2 * Number.EPSILON), sa * (1 + 2 * Number.EPSILON)), Math.max(sa * (1 - 2 * Number.EPSILON), sa * (1 + 2 * Number.EPSILON)));
      const dist = sub(mul(sub(rho.value, ivPt(s.baseRadius)), cI), mul(z, sI));
      return ok({ g: sub(rho2, sqr(R)), grad: [scale(x, 2), scale(y, 2), scale(R, -2 * tau)], dist });
    }
    case 'torus': {
      const R = s.majorRadius, r = s.minorRadius;
      const q = add(add(rho2, sqr(z)), ivPt(R * R - r * r));
      const g = sub(sqr(q), scale(rho2, 4 * R * R));
      const gx = sub(scale(mul(q, x), 4), scale(x, 8 * R * R));
      const gy = sub(scale(mul(q, y), 4), scale(y, 8 * R * R));
      const gz = scale(mul(q, z), 4);
      const tube = ivSqrt(add(sqr(sub(rho.value, ivPt(R))), sqr(z)));
      if (!tube.ok) return tube;
      return ok({ g, grad: [gx, gy, gz], dist: sub(tube.value, ivPt(r)) });
    }
  }
}

/**
 * An upper bound of `|G|` at every point of the box `(x, y, z)` (frame coordinates) that lies
 * within `tol` of the surface (its `dist` of `implicitEnclosure` in `[-tol, tol]`), or `undefined`:
 * plane `tol`; sphere / cylinder `tol (2r + tol)` (`G = d (d + 2r)`, Lean `sphere_band`); cone
 * `tol / cos α · |ρ + R|` (`G = (ρ - R)(ρ + R)`, `ρ - R = d / cos α`); torus
 * `tol (2r + tol) · ((ρ + R)² + z² - r²)` (`torus_factor`). Rounded up.
 */
function gBand(s: AnalyticSurface3, x: Interval, y: Interval, z: Interval, tol: number): number | undefined {
  const up = (v: number): number => (Number.isFinite(v) && v >= 0 ? v * (1 + 1e-12) + Number.MIN_VALUE : NaN);
  let b: number;
  switch (s.kind) {
    case 'plane':
      b = up(tol);
      break;
    case 'sphere':
    case 'cylinder':
      b = up(tol * (2 * s.radius + tol));
      break;
    case 'cone': {
      const rho = ivSqrt(add(sqr(x), sqr(y)));
      if (!rho.ok) return undefined;
      const R = add(ivPt(s.baseRadius), scale(z, Math.tan(s.semiAngle)));
      const c = Math.cos(s.semiAngle);
      if (!(c > 0)) return undefined;
      const sum = add(rho.value, R);
      b = up(((tol / c) * (1 + 4 * Number.EPSILON)) * Math.max(Math.abs(sum.lo), Math.abs(sum.hi)));
      break;
    }
    case 'torus': {
      const rho = ivSqrt(add(sqr(x), sqr(y)));
      if (!rho.ok) return undefined;
      const f2 = sub(add(sqr(add(rho.value, ivPt(s.majorRadius))), sqr(z)), sqr(ivPt(s.minorRadius)));
      b = up(tol * (2 * s.minorRadius + tol) * Math.max(Math.abs(f2.lo), Math.abs(f2.hi)));
      break;
    }
  }
  return Number.isFinite(b) ? b : undefined;
}

/** The algebraic implicit `G` at a point (floating point; for bracketing). */
function implicitAt(s: AnalyticSurface3, p: Point3): number {
  const [x, y, z] = localCoordinates(s.frame, surfaceOrigin(s), p);
  switch (s.kind) {
    case 'plane':
      return z;
    case 'sphere':
      return x * x + y * y + z * z - s.radius * s.radius;
    case 'cylinder':
      return x * x + y * y - s.radius * s.radius;
    case 'cone': {
      const R = s.baseRadius + Math.tan(s.semiAngle) * z;
      return x * x + y * y - R * R;
    }
    case 'torus': {
      const q = x * x + y * y + z * z + s.majorRadius * s.majorRadius - s.minorRadius * s.minorRadius;
      return q * q - 4 * s.majorRadius * s.majorRadius * (x * x + y * y);
    }
  }
}

/**
 * The one-dimensional Krawczyk operator `K(T) = m - y·Gm + (1 - y·D)(T - m)` (`D ⊇ G'(T)`,
 * `Gm ∋ G(m)`, `y` any double): every root of `G` in `T` lies in `K(T)` (Lean `krawczyk_root_mem`),
 * so `K(T) ∩ T = ∅` proves there is none.
 */
export function krawczyk1(T: Interval, m: number, Gm: Interval, D: Interval, y: number): Interval {
  const mI = ivPt(m);
  return add(sub(mI, scale(Gm, y)), mul(sub(ivPt(1), scale(D, y)), sub(T, mI)));
}

interface Stretch {
  lo: number;
  hi: number;
}

function mergeRuns(items: readonly Stretch[]): Stretch[] {
  const s = [...items].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const out: Stretch[] = [];
  for (const it of s) {
    const last = out[out.length - 1];
    if (last !== undefined && it.lo <= last.hi) last.hi = Math.max(last.hi, it.hi);
    else out.push({ lo: it.lo, hi: it.hi });
  }
  return out;
}

/** Root of `f` in `[a, b]` with `f(a) f(b) < 0` by the Illinois variant of regula falsi (bounded). */
function bracketRoot(f: (t: number) => number, a: number, b: number, fa: number, fb: number): number {
  let side = 0;
  for (let i = 0; i < 100; i++) {
    let c = (a * fb - b * fa) / (fb - fa);
    if (!(c > a && c < b)) c = a / 2 + b / 2;
    if (c === a || c === b) break;
    const fc = f(c);
    if (fc === 0) return c;
    if (fc > 0 === fb > 0) {
      b = c;
      fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
    if (b - a <= 4 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b))) break;
  }
  return Math.abs(fa) <= Math.abs(fb) ? a : b;
}

/** Golden-section minimum of `f` on `[a, b]` (60 steps). */
function goldenMin(f: (t: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = f(c), fd = f(d);
  for (let i = 0; i < 60 && b - a > 4 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)); i++) {
    if (fc <= fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return fc <= fd ? c : d;
}

function absDistance(s: Surface3, curve: Curve3, t: number): number {
  const p = evaluateCurve3(curve, t);
  if (!p.ok) return Infinity;
  const g = implicitValue(s, p.value.point);
  return g.ok ? Math.abs(g.value) : Infinity;
}

/** Classifies a contact stretch by sampled distances (shared by the analytic and NURBS searches). */
function resolveStretch(
  kernel: Kernel,
  curve: Curve3,
  surface: Surface3,
  st: Stretch,
  dist: (t: number) => Result<number>,
  tol: number,
  minOverlap: number,
  minimize: (lo: number, hi: number, t0: number) => Result<number>,
): Result<{ kind: 'overlap'; overlap: CurveSurfaceOverlap } | { kind: 'point'; point: RawHit }> {
  const sinAng = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  const N = 16;
  const ts: number[] = [], ds: number[] = [], ps: Point3[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k === N ? st.hi : st.lo + ((st.hi - st.lo) * k) / N;
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    const d = dist(t);
    if (!d.ok) return d;
    ts.push(t);
    ds.push(d.value);
    ps.push(p.value);
  }
  const runs: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    if (!(ds[k]! <= tol)) continue;
    const last = runs[runs.length - 1];
    if (last !== undefined && last[1] === k - 1) last[1] = k;
    else runs.push([k, k]);
  }
  let L = 0;
  if (runs.length === 1) for (let k = runs[0]![0]; k < runs[0]![1]; k++) L += length3(sub3(ps[k + 1]!, ps[k]!));
  if (runs.length === 1 && L >= minOverlap) {
    const [i, j] = runs[0]!;
    const refine = (inside: number, outside: number): Result<number> => {
      let a = inside, b = outside;
      for (let it = 0; it < 40; it++) {
        const m = a / 2 + b / 2;
        if (m === a || m === b) break;
        const d = dist(m);
        if (!d.ok) return d;
        if (d.value <= tol) a = m;
        else b = m;
      }
      return ok(a);
    };
    // A run reaching the stretch end continues while the curve stays within tol (`extendContactEnd`).
    const [c0, c1] = curveRange(curve);
    const step = (st.hi - st.lo) / N;
    const lo = i > 0 ? refine(ts[i]!, ts[i - 1]!) : extendContactEnd(dist, ts[0]!, c0, step, tol);
    if (!lo.ok) return lo;
    const hi = j < N ? refine(ts[j]!, ts[j + 1]!) : extendContactEnd(dist, ts[N]!, c1, step, tol);
    if (!hi.ok) return hi;
    let dev = 0;
    for (let k = i; k <= j; k++) dev = Math.max(dev, ds[k]!);
    const o = makeSurfaceOverlap(kernel, curve, surface, lo.value, hi.value, 'certified', dev);
    return o.ok ? ok({ kind: 'overlap', overlap: o.value }) : o;
  }
  if (runs.length > 1) return err(refusal(OP, 'tangent contact not resolved'));
  let k = 0;
  for (let i = 1; i <= N; i++) if (ds[i]! < ds[k]!) k = i;
  const m = minimize(st.lo, st.hi, ts[k]!);
  if (!m.ok) return m;
  const dm = dist(m.value);
  if (!dm.ok) return dm;
  const t = dm.value <= ds[k]! ? m.value : ts[k]!;
  const p = curvePoint(curve, t);
  if (!p.ok) return p;
  // A crossing the isolation test could not certify (a degenerate parametrisation such as a pole)
  // is told from a touch by the offsets at the stretch ends (`crossesOver`).
  const fLo = projectPoint(kernel, surface, ps[0]!), fHi = projectPoint(kernel, surface, ps[N]!);
  if (!fLo.ok) return fLo;
  if (!fHi.ok) return fHi;
  const crossing = crossesOver(ps[0]!, fLo.value.point, ps[N]!, fHi.value.point, sinAng);
  const h = hitAt(kernel, surface, t, p.value, crossing ? 'transversal' : 'tangent', 'certified', false);
  if (!h.ok) return h;
  if (!(h.value.deviation <= tol)) return err(refusal(OP, 'tangent contact not resolved'));
  return ok({ kind: 'point', point: h.value });
}

function solveAnalytic(kernel: Kernel, curve: Curve3, s: AnalyticSurface3, limits: IntersectLimits | undefined): Result<Outcome> {
  const tol = kernel.tolerances.zoneTol3d;
  const lim = searchLimits(limits, SURFACE_PAIR_BUDGET);
  const cc = curveCtx(curve);
  if (!cc.ok) return cc;
  const ctx = cc.value;
  const [r0, r1] = ctx.range;
  const root = makePiece(ctx, r0, r1, 0);
  if (!root.ok) return root;
  // The overlap threshold's scale: the larger of the curve's box and the surface's own size (so
  // that clipping a long line to a torus does not turn a tangency into an "overlap").
  const sSize = s.kind === 'sphere' || s.kind === 'cylinder' ? 2 * s.radius : s.kind === 'torus' ? 2 * (s.majorRadius + s.minorRadius) : s.kind === 'cone' ? 2 * s.baseRadius : 0;
  const minOverlap = 4 * Math.sqrt(2 * tol * Math.max(box3Diagonal(root.value.box), sSize));
  const G = (t: number): number => {
    const p = evaluateCurve3(curve, t);
    return p.ok ? implicitAt(s, p.value.point) : NaN;
  };
  const distAt = (t: number): Result<number> => {
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    const g = implicitValue(s, p.value);
    return g.ok ? ok(Math.abs(g.value)) : g;
  };
  const points: RawHit[] = [];
  const contact: Stretch[] = [];
  const stack: CurvePiece[] = [root.value];
  let visits = 0;
  const push = (t: number, contactKind: ContactKind, unique: boolean): Result<void> => {
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    if (s.kind === 'cone') {
      const z = localCoordinates(s.frame, s.origin, p.value)[2];
      if (s.baseRadius + Math.tan(s.semiAngle) * z < -tol) return ok(undefined);
    }
    const h = hitAt(kernel, s, t, p.value, contactKind, 'certified', unique);
    if (!h.ok) return h;
    if (h.value.deviation <= tol) points.push(h.value);
    return ok(undefined);
  };
  while (stack.length > 0) {
    const P = stack.pop()!;
    if (++visits > lim.visits) return err(refusal(OP, 'subdivision budget exceeded', visits));
    const [x, y, z] = localIv(s, boxIVec(P.box));
    const enc = implicitEnclosure(s, x, y, z);
    if (!enc.ok) return enc;
    if (enc.value.dist.lo > tol || enc.value.dist.hi < -tol) continue;
    const D = pieceDeriv(ctx, P);
    let monotone = false;
    if (D !== null) {
      const [cx, cy, cz] = [dotVecIv(s.frame.xAxis, D), dotVecIv(s.frame.yAxis, D), dotVecIv(s.frame.normal, D)];
      const [gx, gy, gz] = enc.value.grad;
      const dG = add(add(mul(gx, cx), mul(gy, cy)), mul(gz, cz));
      monotone = dG.lo > 0 || dG.hi < 0;
      const m = P.lo / 2 + P.hi / 2;
      const bm = pieceCenterBox(ctx, P);
      // Centered-form exclusion: G(T) ⊆ G(m) + G'(T)(T - m) (Lean `centered_mem`) beyond the band
      // `|G| <= gBand` that every point within tol of the surface satisfies (`sphere_band`, `prod_bound`).
      if (bm !== null) {
        const [mx, my, mz] = localIv(s, boxIVec(bm));
        const em = implicitEnclosure(s, mx, my, mz);
        const band = gBand(s, x, y, z, tol);
        if (em.ok && band !== undefined) {
          const Gc = add(em.value.g, mul(dG, sub(ivOf(P.lo, P.hi), ivPt(m))));
          if (Gc.lo > band || Gc.hi < -band) continue;
        }
      }
      // Krawczyk exclusion: no root of G on the piece.
      if (bm !== null && dG.lo / 2 + dG.hi / 2 !== 0) {
        const [mx, my, mz] = localIv(s, boxIVec(bm));
        const em = implicitEnclosure(s, mx, my, mz);
        if (em.ok) {
          const K = krawczyk1(ivOf(P.lo, P.hi), m, em.value.g, dG, 1 / (dG.lo / 2 + dG.hi / 2));
          const excluded = ivIntersect(K, ivOf(P.lo, P.hi)) === undefined;
          // Excluded: no exact root; an end contact within tol is still possible at a range end.
          if (excluded && P.lo !== r0 && P.hi !== r1) continue;
        }
      }
    }
    if (monotone) {
      const gl = G(P.lo), gh = G(P.hi);
      if (gl === 0) {
        const q = push(P.lo, 'transversal', true);
        if (!q.ok) return q;
      } else if (gh === 0) {
        const q = push(P.hi, 'transversal', true);
        if (!q.ok) return q;
      } else if (gl < 0 !== gh < 0 && Number.isFinite(gl) && Number.isFinite(gh)) {
        const q = push(bracketRoot(G, P.lo, P.hi, gl, gh), 'transversal', true);
        if (!q.ok) return q;
      } else {
        // No root: an end of the curve may still come within tol.
        for (const t of [P.lo, P.hi]) {
          if (t !== r0 && t !== r1) continue;
          const d = distAt(t);
          if (!d.ok) return d;
          if (d.value <= tol) {
            const q = push(t, 'transversal', true);
            if (!q.ok) return q;
          }
        }
      }
      continue;
    }
    if (P.covered === undefined && P.depth >= COVER_DEPTH) {
      let all = true;
      for (let k = 0; k <= 4 && all; k++) {
        const d = distAt(k === 4 ? P.hi : P.lo + ((P.hi - P.lo) * k) / 4);
        if (!d.ok) return d;
        all = d.value <= tol;
      }
      P.covered = all;
      if (all) {
        contact.push({ lo: P.lo, hi: P.hi });
        continue;
      }
    }
    const kids = box3Diagonal(P.box) <= tol ? ok(null) : pieceKids(ctx, P);
    if (!kids.ok) return kids;
    if (kids.value === null) {
      contact.push({ lo: P.lo, hi: P.hi });
      continue;
    }
    if (P.depth + 1 >= lim.depth) return err(refusal(OP, 'recursion depth exceeded', visits));
    stack.push(kids.value[1], kids.value[0]);
  }
  const overlaps: CurveSurfaceOverlap[] = [];
  for (const st of mergeRuns(contact)) {
    const r = resolveStretch(kernel, curve, s, st, distAt, tol, minOverlap, (lo, hi) => ok(goldenMin((t) => absDistance(s, curve, t), lo, hi)));
    if (!r.ok) return r;
    if (r.value.kind === 'overlap') overlaps.push(r.value.overlap);
    else points.push(r.value.point);
  }
  const merged = absorbConnected(points, distAt, tol);
  return merged.ok ? ok({ points: merged.value, overlaps }) : merged;
}

/**
 * Merges consecutive points (in `t` order) between which the curve stays within `tol` of the
 * surface (seven samples): they are one contact, reported once as tangent (the tangent one, else
 * the first, is kept). This absorbs the transversal roots that a search isolates on either side
 * of a near-tangency inside the tolerance band.
 */
function absorbConnected(points: readonly RawHit[], dist: (t: number) => Result<number>, tol: number): Result<RawHit[]> {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const out: RawHit[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && (last.contact === 'tangent' || p.contact === 'tangent')) {
      let joined = true;
      for (let k = 1; k <= 7 && joined; k++) {
        const d = dist(last.t + ((p.t - last.t) * k) / 8);
        if (!d.ok) return d;
        joined = d.value <= tol;
      }
      if (joined) {
        if (p.contact === 'tangent' && last.contact !== 'tangent') out[out.length - 1] = { ...p };
        const kept = out[out.length - 1]!;
        kept.contact = 'tangent';
        kept.unique = false;
        continue;
      }
    }
    out.push({ ...p });
  }
  return ok(out);
}

// ---------------------------------------------------------------------------------------------
// NURBS surfaces: (curve piece) × (surface patch) subdivision.

interface Patch {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly depth: number;
  readonly box: Box3;
  partials: { readonly su: IVec3; readonly sv: IVec3 } | null | undefined;
  kids: readonly [Patch, Patch] | null | undefined;
}

function makePatch(s: NurbsSurface3, u0: number, u1: number, v0: number, v1: number, depth: number): Result<Patch> {
  const b = boundSurface(s, ivOf(u0, u1), ivOf(v0, v1));
  if (!b.ok) return b;
  return ok({ u0, u1, v0, v1, depth, box: b.value, partials: undefined, kids: undefined });
}

function patchPartials(s: NurbsSurface3, P: Patch): { readonly su: IVec3; readonly sv: IVec3 } | null {
  if (P.partials !== undefined) return P.partials;
  P.partials = null;
  const r = homogeneousPartials(s.surface, ivOf(P.u0, P.u1), ivOf(P.v0, P.v1));
  if (!r.ok) return null;
  const { h, hu, hv } = r.value;
  const W = h[3]!;
  if (!(W.lo > 0)) return null;
  const den = sqr(W);
  const su: Interval[] = [], sv: Interval[] = [];
  for (let k = 0; k < 3; k++) {
    const a = div(sub(mul(hu[k]!, W), mul(h[k]!, hu[3]!)), den);
    const b = div(sub(mul(hv[k]!, W), mul(h[k]!, hv[3]!)), den);
    if (!a.ok || !b.ok) return null;
    su.push(a.value);
    sv.push(b.value);
  }
  P.partials = { su: ivec3(su[0]!, su[1]!, su[2]!), sv: ivec3(sv[0]!, sv[1]!, sv[2]!) };
  return P.partials;
}

function patchKids(s: NurbsSurface3, P: Patch): Result<readonly [Patch, Patch] | null> {
  if (P.kids !== undefined) return ok(P.kids);
  const ns = s.surface;
  const inner = (knots: readonly number[], a: number, b: number): number[] => [...new Set(knots.filter((k) => k > a && k < b))].sort((x, y) => x - y);
  const ku = inner(ns.knotsU, P.u0, P.u1), kv = inner(ns.knotsV, P.v0, P.v1);
  let dir: 'u' | 'v';
  let m: number;
  if (ku.length > 0 && ku.length >= kv.length) {
    dir = 'u';
    m = ku[(ku.length - 1) >> 1]!;
  } else if (kv.length > 0) {
    dir = 'v';
    m = kv[(kv.length - 1) >> 1]!;
  } else {
    const um = P.u0 / 2 + P.u1 / 2, vm = P.v0 / 2 + P.v1 / 2;
    const at = (u: number, v: number): Point3 | undefined => {
      const e = evaluateSurface3(s, u, v);
      return e.ok ? e.value.point : undefined;
    };
    const a = at(P.u0, vm), b = at(P.u1, vm), c = at(um, P.v0), d = at(um, P.v1);
    const lu = a && b ? length3(sub3(b, a)) : 0, lv = c && d ? length3(sub3(d, c)) : 0;
    dir = lu >= lv ? 'u' : 'v';
    if (dir === 'u' && !(um > P.u0 && um < P.u1)) dir = 'v';
    if (dir === 'v' && !(vm > P.v0 && vm < P.v1)) dir = um > P.u0 && um < P.u1 ? 'u' : 'v';
    m = dir === 'u' ? um : vm;
    if (dir === 'v' && !(vm > P.v0 && vm < P.v1)) {
      P.kids = null;
      return ok(null);
    }
  }
  const l = dir === 'u' ? makePatch(s, P.u0, m, P.v0, P.v1, P.depth + 1) : makePatch(s, P.u0, P.u1, P.v0, m, P.depth + 1);
  if (!l.ok) return l;
  const r = dir === 'u' ? makePatch(s, m, P.u1, P.v0, P.v1, P.depth + 1) : makePatch(s, P.u0, P.u1, m, P.v1, P.depth + 1);
  if (!r.ok) return r;
  P.kids = [l.value, r.value];
  return ok(P.kids);
}

interface TripleRefinement {
  readonly t: number;
  readonly u: number;
  readonly v: number;
  readonly dist: number;
}

/** Gauss–Newton (lightly damped) on `C(t) - S(u, v)`, clamped to the bounds; the best iterate. */
function refineTriple(
  curve: Curve3,
  s: NurbsSurface3,
  t0: number,
  u0: number,
  v0: number,
  tb: readonly [number, number],
  ub: readonly [number, number],
  vb: readonly [number, number],
): Result<TripleRefinement> {
  let t = clamp(t0, tb[0], tb[1]), u = clamp(u0, ub[0], ub[1]), v = clamp(v0, vb[0], vb[1]);
  let best: TripleRefinement | undefined;
  for (let i = 0; i <= 60; i++) {
    const c = evaluateCurve3(curve, t);
    if (!c.ok) return c;
    const e = evaluateSurface3(s, u, v);
    if (!e.ok) return e;
    const F = sub3(c.value.point, e.value.point);
    const dist = length3(F);
    if (best === undefined || dist < best.dist) best = { t, u, v, dist };
    if (dist === 0 || i === 60) break;
    const cols = [c.value.d1, scale3(e.value.su, -1), scale3(e.value.sv, -1)];
    const M = cols.map((a) => cols.map((b) => dot3(a, b)));
    const g = cols.map((a) => dot3(a, F));
    const lam = 1e-14 * Math.max(M[0]![0]!, M[1]![1]!, M[2]![2]!);
    for (let k = 0; k < 3; k++) M[k]![k] = M[k]![k]! + lam;
    const Mi = invertMatrix(M);
    if (Mi === undefined) break;
    const step = Mi.map((row) => -(row[0]! * g[0]! + row[1]! * g[1]! + row[2]! * g[2]!));
    const x = [t, u, v], bounds = [tb, ub, vb];
    let nx = x.map((xi, k) => clamp(xi + step[k]!, bounds[k]![0], bounds[k]![1]));
    // Variables stopped by their bounds (a contact at a curve end or a domain edge) stay there;
    // the free ones are re-solved from the reduced normal equations, so the iteration reaches the
    // constrained foot instead of stalling beside it.
    const free = [0, 1, 2].filter((k) => nx[k] === x[k]! + step[k]!);
    if (free.length > 0 && free.length < 3) {
      const dc = [0, 1, 2].map((k) => (free.includes(k) ? 0 : nx[k]! - x[k]!));
      const rhs = free.map((i) => -(g[i]! + M[i]![0]! * dc[0]! + M[i]![1]! * dc[1]! + M[i]![2]! * dc[2]!));
      const Mr = invertMatrix(free.map((i) => free.map((j) => M[i]![j]!)));
      if (Mr !== undefined) {
        nx = [...nx];
        free.forEach((i, a) => {
          const d = Mr[a]!.reduce((acc, m, b) => acc + m * rhs[b]!, 0);
          nx[i] = clamp(x[i]! + d, bounds[i]![0], bounds[i]![1]);
        });
      }
    }
    const nt = nx[0]!, nu = nx[1]!, nv = nx[2]!;
    const tiny = (a: number, b: number): boolean => Math.abs(a - b) <= 4 * Number.EPSILON * Math.max(1, Math.abs(a));
    const still = tiny(nt, t) && tiny(nu, u) && tiny(nv, v);
    t = nt;
    u = nu;
    v = nv;
    if (still) break;
  }
  return ok(best!);
}

/**
 * Mean-value separation of a curve piece and a surface patch along the direction between their
 * center points (`separatedAlong`): `C(T) - S(U, V) ⊆ C(tm) + C'(T)(T - tm) - S(um, vm) -
 * S_u(U - um) - S_v(V - vm)` per coordinate.
 */
function pairPatchSeparated(ctx: CurveCtx, P: CurvePiece, s: NurbsSurface3, S: Patch, tol: number): boolean {
  const D = pieceDeriv(ctx, P), bC = pieceCenterBox(ctx, P), SP = patchPartials(s, S);
  if (D === null || bC === null || SP === null) return false;
  const um = S.u0 / 2 + S.u1 / 2, vm = S.v0 / 2 + S.v1 / 2;
  const bS = boundSurface(s, ivPt(um), ivPt(vm));
  if (!bS.ok) return false;
  const c = evaluateCurve3(ctx.curve, P.lo / 2 + P.hi / 2), e = evaluateSurface3(s, um, vm);
  if (!c.ok || !e.ok) return false;
  const centerDiff = ivSub(boxIVec(bC), boxIVec(bS.value));
  const terms = [
    { deriv: D, lo: P.lo, hi: P.hi, sign: 1 },
    { deriv: SP.su, lo: S.u0, hi: S.u1, sign: -1 },
    { deriv: SP.sv, lo: S.v0, hi: S.v1, sign: -1 },
  ] as const;
  // Along the surface normal at the patch point nearest the curve center (the linearised foot,
  // clamped to the patch: second order in the piece sizes), then along the center offset.
  const w = sub3(c.value.point, e.value.point);
  const { su, sv } = e.value;
  const a11 = dot3(su, su), a12 = dot3(su, sv), a22 = dot3(sv, sv), b1 = dot3(su, w), b2 = dot3(sv, w);
  const det = a11 * a22 - a12 * a12;
  let foot = e.value;
  if (det > 0 && Number.isFinite(det)) {
    const fu = clamp(um + (a22 * b1 - a12 * b2) / det, S.u0, S.u1), fv = clamp(vm + (a11 * b2 - a12 * b1) / det, S.v0, S.v1);
    const f = evaluateSurface3(s, fu, fv);
    if (f.ok) foot = f.value;
  }
  const n = cross3(foot.su, foot.sv);
  const nn = dot3(n, sub3(c.value.point, foot.point)) < 0 ? scale3(n, -1) : n;
  return separatedAlong(nn, centerDiff, terms, tol) || separatedAlong(w, centerDiff, terms, tol);
}

/**
 * The 3×3 Krawczyk exclusion for `F(t, u, v) = C(t) - S(u, v)` on `X = T × U × V`:
 * `K = m - Y F(m) + (I - Y J)(X - m)` with `Y = mid(J)⁻¹` (`F(m)` enclosed by the certified boxes
 * of the two center points, `J ⊇ F'(X)`); `K_i ∩ X_i = ∅` for some `i` proves `F` has no zero on
 * `X` (every zero lies in `K`: the mean-value argument of Lean `krawczyk_root_mem`, per row).
 * Run only on isolating pairs, whose transversal contacts are exact zeros of `F`.
 */
function krawczykExcludes3(ctx: CurveCtx, P: CurvePiece, s: NurbsSurface3, S: Patch, J: readonly (readonly Interval[])[]): boolean {
  const Y = invertMatrix(J.map((row) => row.map((e) => e.lo / 2 + e.hi / 2)));
  const bC = pieceCenterBox(ctx, P);
  if (Y === undefined || bC === null) return false;
  const m = [P.lo / 2 + P.hi / 2, S.u0 / 2 + S.u1 / 2, S.v0 / 2 + S.v1 / 2];
  const bS = boundSurface(s, ivPt(m[1]!), ivPt(m[2]!));
  if (!bS.ok) return false;
  const Fm = ivSub(boxIVec(bC), boxIVec(bS.value));
  const F = [Fm.x, Fm.y, Fm.z];
  const X = [ivOf(P.lo, P.hi), ivOf(S.u0, S.u1), ivOf(S.v0, S.v1)];
  const dX = X.map((x, i) => sub(x, ivPt(m[i]!)));
  for (let i = 0; i < 3; i++) {
    let k = ivPt(m[i]!);
    for (let j = 0; j < 3; j++) {
      k = sub(k, scale(F[j]!, Y[i]![j]!));
      let e = ivPt(i === j ? 1 : 0);
      for (let l = 0; l < 3; l++) e = sub(e, scale(J[l]![j]!, Y[i]![l]!));
      k = add(k, mul(e, dX[j]!));
    }
    if (ivIntersect(k, X[i]!) === undefined) return true;
  }
  return false;
}

function solveNurbsSurface(kernel: Kernel, curve: Curve3, s: NurbsSurface3, limits: IntersectLimits | undefined): Result<Outcome> {
  const tol = kernel.tolerances.zoneTol3d;
  const lim = searchLimits(limits, SURFACE_PAIR_BUDGET);
  const cc = curveCtx(curve);
  if (!cc.ok) return cc;
  const ctx: CurveCtx = cc.value;
  const dom = surfaceDomain(s.surface);
  const rootC = makePiece(ctx, ctx.range[0], ctx.range[1], 0);
  if (!rootC.ok) return rootC;
  const rootS = makePatch(s, dom.u[0], dom.u[1], dom.v[0], dom.v[1], 0);
  if (!rootS.ok) return rootS;
  const minOverlap = 4 * Math.sqrt(2 * tol * box3Diagonal(rootC.value.box));
  const distAt = (t: number): Result<number> => {
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    const pr = projectPoint(kernel, s, p.value);
    return pr.ok ? ok(pr.value.distance) : pr;
  };
  const points: RawHit[] = [];
  const contact: Stretch[] = [];
  const stack: [CurvePiece, Patch][] = [[rootC.value, rootS.value]];
  let visits = 0;
  while (stack.length > 0) {
    const [P, S] = stack.pop()!;
    if (++visits > lim.visits) return err(refusal(OP, 'subdivision budget exceeded', visits));
    if (P.covered === true) continue;
    const dj = boxesDisjoint3(P.box, S.box, tol);
    if (!dj.ok) return dj;
    if (dj.value) continue;
    if (P.depth + S.depth >= 2 && pairPatchSeparated(ctx, P, s, S, tol)) continue;
    const smallP = box3Diagonal(P.box) <= tol, smallS = box3Diagonal(S.box) <= tol;
    const split = (): Result<boolean> => {
      const pk = smallP ? ok(null) : pieceKids(ctx, P);
      if (!pk.ok) return pk;
      const sk = smallS ? ok(null) : patchKids(s, S);
      if (!sk.ok) return sk;
      if (pk.value === null && sk.value === null) return ok(false);
      if (Math.max(P.depth, S.depth) + 1 >= lim.depth) return err(refusal(OP, 'recursion depth exceeded', visits));
      if (pk.value !== null && (sk.value === null || box3Diagonal(P.box) >= box3Diagonal(S.box))) stack.push([pk.value[1], S], [pk.value[0], S]);
      else stack.push([P, sk.value![1]], [P, sk.value![0]]);
      return ok(true);
    };
    const D = pieceDeriv(ctx, P);
    const SP = patchPartials(s, S);
    let iso = false;
    if (D !== null && SP !== null) {
      const cD = [D.x, D.y, D.z], su = [SP.su.x, SP.su.y, SP.su.z], sv = [SP.sv.x, SP.sv.y, SP.sv.z];
      const J = [0, 1, 2].map((i) => [cD[i]!, scale(su[i]!, -1), scale(sv[i]!, -1)]);
      iso = krawczykContracts(J);
      // Excluded: no exact zero of F on the box. A pair at a curve end or at the boundary of the
      // surface domain may still hold a contact within tol whose exact zero lies beyond the domain
      // (a curve ending just short of the surface, or passing just beside its edge): kept, and the
      // clamped refinement below finds it.
      const atBoundary =
        P.lo === ctx.range[0] || P.hi === ctx.range[1] || S.u0 === dom.u[0] || S.u1 === dom.u[1] || S.v0 === dom.v[0] || S.v1 === dom.v[1];
      if (iso && !atBoundary && krawczykExcludes3(ctx, P, s, S, J)) continue;
    }
    if (iso) {
      const r = refineTriple(curve, s, P.lo / 2 + P.hi / 2, S.u0 / 2 + S.u1 / 2, S.v0 / 2 + S.v1 / 2, ctx.range, dom.u, dom.v);
      if (!r.ok) return r;
      const q = r.value;
      if (q.dist <= tol && insideSlack(P.lo, P.hi, q.t) && insideSlack(S.u0, S.u1, q.u) && insideSlack(S.v0, S.v1, q.v)) {
        const p = curvePoint(curve, q.t);
        if (!p.ok) return p;
        points.push({ t: q.t, u: q.u, v: q.v, point: p.value, contact: 'transversal', cls: 'certified', deviation: q.dist, unique: true });
        continue;
      }
      if (smallP && smallS) continue;
      const sp = split();
      if (!sp.ok) return sp;
      continue;
    }
    if (P.covered === undefined && P.depth >= COVER_DEPTH) {
      let all = true;
      for (let k = 0; k <= 4 && all; k++) {
        const d = distAt(k === 4 ? P.hi : P.lo + ((P.hi - P.lo) * k) / 4);
        if (!d.ok) return d;
        all = d.value <= tol;
      }
      P.covered = all;
      if (all) {
        contact.push({ lo: P.lo, hi: P.hi });
        continue;
      }
    }
    if (smallP && smallS) {
      contact.push({ lo: P.lo, hi: P.hi });
      continue;
    }
    const sp = split();
    if (!sp.ok) return sp;
    if (!sp.value) contact.push({ lo: P.lo, hi: P.hi });
  }
  const overlaps: CurveSurfaceOverlap[] = [];
  for (const st of mergeRuns(contact)) {
    const minimize = (lo: number, hi: number, t0: number): Result<number> => {
      const p = curvePoint(curve, t0);
      if (!p.ok) return p;
      const pr = projectPoint(kernel, s, p.value);
      if (!pr.ok) return pr;
      const r = refineTriple(curve, s, t0, pr.value.u, pr.value.v, [lo, hi], dom.u, dom.v);
      return r.ok ? ok(r.value.t) : r;
    };
    const r = resolveStretch(kernel, curve, s, st, distAt, tol, minOverlap, minimize);
    if (!r.ok) return r;
    if (r.value.kind === 'overlap') overlaps.push(r.value.overlap);
    else points.push(r.value.point);
  }
  const merged = absorbConnected(points, distAt, tol);
  return merged.ok ? ok({ points: merged.value, overlaps }) : merged;
}

// ---------------------------------------------------------------------------------------------
// Public API.

/**
 * Where a curve (over its range) meets a surface (an analytic surface over its whole natural
 * extent, a NURBS surface over its knot domain); see the module comment for the classes.
 * Errors: a NURBS curve / surface that is not 3D; refusals (`refusalReason`) for an unresolved
 * tangency or an exhausted budget (`limits`, optional); errors of the surface inversion (`projectPoint`).
 */
export function intersectCurveSurface(
  kernel: Kernel,
  curve: Curve3,
  surface: Surface3,
  limits?: IntersectLimits,
): Result<IntersectionResult<CurveSurfaceHit>> {
  const tol = kernel.tolerances.zoneTol3d;
  if (!(tol > 0) || !Number.isFinite(tol)) return invalidInput(OP, 'zone tolerance must be finite and positive');
  if (curve.kind === 'nurbs' && curve.curve.dimension !== 3) return invalidInput(OP, 'NURBS curve must have dimension 3');
  if (surface.kind === 'nurbs' && surface.surface.dimension !== 3) return invalidInput(OP, 'NURBS surface must have dimension 3');
  let out: Result<Outcome>;
  let certified = true;
  if (surface.kind === 'nurbs') out = solveNurbsSurface(kernel, curve, surface, limits);
  else if (curve.kind === 'line' && surface.kind === 'plane') {
    out = linePlane(kernel, curve, surface, tol);
    certified = false;
  } else if (curve.kind === 'line' && (surface.kind === 'sphere' || surface.kind === 'cylinder' || surface.kind === 'cone')) {
    out = lineQuadric(kernel, curve, surface, tol);
    certified = false;
  } else if (curve.kind === 'circle' && surface.kind === 'plane') {
    out = circlePlane(kernel, curve, surface, tol);
    certified = false;
  } else if (curve.kind === 'line' && surface.kind === 'torus') {
    // Clipped to the ball holding the torus first (a ray with a huge reach is otherwise bisected
    // down from its full length); the parametrisation is unchanged, only the range shrinks.
    const c = clipLineToBall(curve, surface.center, surface.majorRadius + surface.minorRadius + 2 * tol);
    if (!c.ok) return c;
    out = c.value === undefined ? ok({ points: [], overlaps: [] }) : solveAnalytic(kernel, c.value, surface, limits);
  } else out = solveAnalytic(kernel, curve, surface, limits);
  if (!out.ok) return out;
  let points = out.value.points;
  if (!certified && out.value.overlaps.length === 0) {
    const e = surfaceEndContacts(kernel, curve, surface, points, tol);
    if (!e.ok) return e;
    points = [...points, ...e.value];
  }
  return finishSurfaceHits(curve, points, out.value.overlaps, tol, certified);
}

/**
 * The line restricted to the parameters where it lies in the ball `|x - c| <= R` (padded by a
 * relative `1e-9` and an absolute `R / 2^20` in `t`, so rounding never shrinks it below the true
 * set), or `undefined` when they miss the line's range.
 */
function clipLineToBall(L: LineCurve, c: Point3, R: number): Result<LineCurve | undefined> {
  const w = sub3(L.origin, c), d = L.direction;
  const a = dot3(d, d);
  // Re-centred at the foot of c (clamped to the range) for accuracy, as in lineQuadric.
  const tc = clamp(-dot3(w, d) / a, L.range[0], L.range[1]);
  const q = add3(w, scale3(d, tc));
  const b = 2 * dot3(q, d), cc = dot3(q, q) - R * R;
  const disc = b * b - 4 * a * cc;
  if (!(disc >= 0)) return ok(undefined);
  const sq = Math.sqrt(disc);
  const pad = 1e-9 * (Math.abs(tc) + sq / a) + R / Math.sqrt(a) / 2 ** 20;
  const lo = Math.max(L.range[0], tc + (-b - sq) / (2 * a) - pad), hi = Math.min(L.range[1], tc + (-b + sq) / (2 * a) + pad);
  // A touch of the padded ball (lo = hi) cannot reach the surface inside it.
  if (!(lo < hi)) return ok(undefined);
  if (lo === L.range[0] && hi === L.range[1]) return ok(L);
  const r = createLineCurve(L.origin, L.direction, [lo, hi]);
  return r.ok ? ok(r.value) : r;
}

/**
 * Contacts at the ends of a curve that a closed form misses: an end within `tol` of the surface
 * with no reported point within `tol` (a segment ending just short of a plane it meets at a shallow
 * angle: the exact crossing lies beyond the range). Reported `certified`, transversal, not unique.
 */
function surfaceEndContacts(kernel: Kernel, curve: Curve3, surface: Surface3, found: readonly RawHit[], tol: number): Result<RawHit[]> {
  const out: RawHit[] = [];
  const [t0, t1] = curve.kind === 'line' || curve.kind === 'circle' ? curve.range : [0, 0];
  for (const t of [t0, t1]) {
    const p = curvePoint(curve, t);
    if (!p.ok) return p;
    let seen = false;
    for (const q of [...found, ...out]) {
      seen = length3(sub3(q.point, p.value)) <= tol;
      // Joined to a reported point by a run of the curve within tol: the same contact.
      for (let k = 0; k <= 8 && !seen; k++) {
        const x = curvePoint(curve, t + ((q.t - t) * k) / 8);
        if (!x.ok) return x;
        const g = implicitValue(surface, x.value);
        if (!g.ok) return g;
        if (!(Math.abs(g.value) <= tol)) break;
        if (k === 8) seen = true;
      }
      if (seen) break;
    }
    if (seen) continue;
    if (surface.kind === 'cone') {
      const z = localCoordinates(surface.frame, surface.origin, p.value)[2];
      if (surface.baseRadius + Math.tan(surface.semiAngle) * z < -tol) continue;
    }
    // The signed distance first: only an end within tol is projected (a ray from a sphere's
    // center must not ask for the center's projection).
    const g = implicitValue(surface, p.value);
    if (!g.ok) return g;
    if (!(Math.abs(g.value) <= tol)) continue;
    const h = hitAt(kernel, surface, t, p.value, 'transversal', 'certified', false);
    if (!h.ok) return h;
    if (h.value.deviation <= tol) out.push(h.value);
  }
  return ok(out);
}

/** A rough far reach of a surface from a point: past its bounding extent for bounded kinds, else `undefined`. */
function boundedReach(s: Surface3, o: Point3): number | undefined {
  switch (s.kind) {
    case 'sphere':
      return length3(sub3(o, s.center)) + s.radius;
    case 'torus':
      return length3(sub3(o, s.center)) + s.majorRadius + s.minorRadius;
    case 'nurbs': {
      const d = surfaceDomain(s.surface);
      const b = boundSurface(s, ivOf(d.u[0], d.u[1]), ivOf(d.v[0], d.v[1]));
      if (!b.ok) return undefined;
      const c = scale3(add3(b.value.min, b.value.max), 0.5);
      return length3(sub3(o, c)) + box3Diagonal(b.value);
    }
    default:
      return undefined;
  }
}

/**
 * The hits of the ray `origin + t direction`, `t ∈ [0, maxT]`, with `surface`, sorted by `t` (the
 * first hit is the nearest). `maxT` defaults to past a bounded surface or `1e9 (1 + |origin|) / |d|`
 * for an unbounded one. Errors: a non-finite or zero direction / origin, a bad `maxT`, and those of
 * {@link intersectCurveSurface}.
 */
export function intersectRay(
  kernel: Kernel,
  origin: Point3,
  direction: Vec3,
  surface: Surface3,
  maxT?: number,
  limits?: IntersectLimits,
): Result<IntersectionResult<CurveSurfaceHit>> {
  if (!isFinite3(origin) || !isFinite3(direction)) return invalidInput(OP_RAY, 'non-finite ray');
  const len = length3(direction);
  if (!(len > 0)) return invalidInput(OP_RAY, 'ray direction of zero length');
  let reach = maxT;
  if (reach === undefined) {
    const r = boundedReach(surface, origin);
    reach = r !== undefined ? (r + kernel.tolerances.zoneTol3d) / len + 1 : (1e9 * (1 + length3(origin))) / len;
  }
  if (!(reach > 0) || !Number.isFinite(reach)) return invalidInput(OP_RAY, 'maxT must be finite and positive');
  const line = createLineCurve(origin, direction, [0, reach]);
  if (!line.ok) return line;
  const r = intersectCurveSurface(kernel, line.value, surface, limits);
  if (!r.ok) return r.error.operation.startsWith(OP) ? err({ ...r.error, operation: r.error.operation.replace(OP, OP_RAY) }) : r;
  return r;
}
