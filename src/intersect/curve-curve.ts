/**
 * Curve/curve intersection, in space (`Curve3`) and in the plane (`Curve2`, e.g. pcurves).
 *
 * Every answer is one of the classes of `types.ts`. The tolerance is `kernel.tolerances.zoneTol3d`
 * (`tol`): two curves are in contact where they come within `tol`.
 *
 * **Exact (closed form).**
 * - line/line: decided in exact dyadic / rational arithmetic on the stored doubles. With
 *   `n = dA × dB` and `w = oB - oA`: `n ≠ 0` and `w · n = 0` (coplanar) gives the unique point by
 *   Cramer's rule in a coordinate plane where `n` has a non-zero component (Lean `coplanar_third_coord`) —
 *   `det = dA_i dB_j - dA_j dB_i`, `s = (w_i dB_j - w_j dB_i) / det`, `t = (w_i dA_j - w_j dA_i) / det`
 *   (Lean `IntersectCurve.cramer_on_both`) — compared exactly with both ranges and correctly rounded;
 *   `n = 0` and `w × dA = 0` (collinear) gives the overlap of the two ranges mapped onto A by
 *   `s(t) = (w + t dB)·dA / dA·dA` (exact rationals, Lean `collinear_param`), a single point when it degenerates;
 *   `n = 0` and `w × dA ≠ 0` has no exact solution (`parallel_no_solution`). When the exact branch
 *   finds nothing, the segments are still checked within `tol` (closest points of the segments, a
 *   `certified` point; nearly parallel lines within `tol` over a stretch longer than `tol` give a
 *   `certified` overlap). An exact crossing of lines at an angle within `angTolDeg` follows the
 *   same tolerance-band rule (overlap, or one tangent point), so moving such a pair off its exact
 *   crossing by less than `tol` does not change the answer.
 * - line/circle: a line within `tol` of the circle's plane over its range is solved in the plane by
 *   the quadratic `a t² + b t + c = 0` (`a = |d|²`, `b = 2 d·w`, `c = |w|² - r²` in plane coordinates,
 *   roots `(-b ± s) / 2a` with `s = √(b² - 4ac)`), formed about the line point at the vertex clamped
 *   to the range (`t = t_c + τ`, so a far line origin does not cancel the coefficients); the contact
 *   is classified geometrically by the distance `h` from the center to the line: `|h - r| <= tol` is
 *   one **tangent** point (at the vertex, or at the nearest range end when the vertex lies beyond
 *   the range and that end is still within `tol`; otherwise the roots on the range), `h < r` two
 *   transversal points, else none. Otherwise the line meets the plane once
 *   (`t = n·(c - o) / n·d`) and that point is kept when it lies within `tol` of the circle.
 * - circle/circle: coplanar circles (normals within `angTolDeg`, centers within `tol` of the other
 *   plane) by the classical construction with the center distance `d` classified against
 *   `r1 + r2` and `|r1 - r2|` within `tol` (tangent contacts flagged); coincident circles give the
 *   overlap of the arcs (both orientations). Non-coplanar circles: circle A meets the plane of B in
 *   closed form (`α cos t + β sin t = -γ`, see `circlePlaneAngles`) and the points within `tol` of B
 *   are kept; parallel distinct planes have none. When A only touches the plane of B (one tangent
 *   angle) its extreme point can lie `≈ √(2 r tol)` from where A really meets B, so that pair goes
 *   to the certified general solver (`circleTouchesOtherPlane`).
 * Arc membership of an angle allows `tol / r` of slack at the ends (then clamps). A closed-form
 * crossing that doubles cannot place within `tol` of both inputs (coordinates so large that 16 ulps
 * exceed `tol`, `precisionLimited`) is refused (`precision exhausted`), never dropped.
 *
 * **Certified (general case: ellipses, NURBS, mixed pairs).** Recursive subdivision of a binary
 * tree of parameter pieces per curve (a NURBS piece is first split at its interior knots, then at
 * midpoints). For a pair of pieces `S × T`:
 * 1. *exclusion*: the certified boxes `boundCurve(A, S)` and `boundCurve(B, T)` are separated by more
 *    than `tol` (`boxesDisjoint3(…, tol)`, exact) — no point of A(S) is within `tol` of B(T)
 *    (Lean `IntersectCurve.prune_sound`, `survivor_complete`); or the mean-value form proves it
 *    along a direction `u` (`separatedAlong`: `u · (A(S) - B(T)) ⊆ u · (c_A - c_B) + (u · A'(S))(S - m)
 *    - (u · B'(T))(T - m)` beyond `±tol`; Lean `axis_separation`, `centered_mem`), tried along the
 *    common normal of the two center tangents — second order in the piece size, so two arcs a few
 *    `tol` apart are excluded instead of subdividing to `tol`-sized pieces;
 * 2. *isolation*: the projected system `G(s, t) = P (A(s) - B(t))` (P: an orthonormal basis of the
 *    plane of the two center tangents, the identity of the plane for 2D curves) passes the Krawczyk
 *    contraction test `‖I - Y J(S×T)‖∞ < 1` with the interval Jacobian `J = P [A'(S), -B'(T)]` and
 *    `Y = mid(J)⁻¹`; then G is injective on `S × T` (mean value form; Lean `contraction_injective2`), so A and B meet at most once
 *    there, transversally — or the tangent cones of the two pieces are separated
 *    (`normalConesSeparated` of the cones of `A'(S)`, `B'(T)`: the chord argument). Then a
 *    Gauss–Newton refinement from the center (clamped to the curve ranges; a parameter stopped by its
 *    bound stays there while the other is re-solved) is accepted when it lands
 *    in `S × T` (relative slack `1e-9`) within `tol`: a **transversal, unique** point;
 * 3. otherwise the piece of A is tested for *contact coverage* (five samples within `tol` of B, via
 *    `closestPointOnCurve`); covered pieces and pairs whose two boxes are below `tol` in diameter
 *    ("leaves") are collected; anything else is split (the piece with the larger box).
 * Covered pieces and leaves are merged into *contact stretches* (maximal runs along A). A stretch is
 * sampled (17 points, closest points on B): one run of samples within `tol` longer than
 * `L_ov = 4 √(2 tol D)` (`D` the diagonal of both curves' box: twice the within-tolerance length of
 * a tangency of relative curvature `1/D`) is an **overlap** (its ends bisected to the `tol`
 * crossing; an end at the stretch boundary is carried on along A while the sampled distance stays
 * within `tol`, `extendContactEnd`, and overlaps that continue each other on both curves are merged);
 * a shorter stretch is one **tangent** point at the minimum distance (Gauss–Newton from
 * the best sample, bounded to the stretch); a stretch whose minimum distance exceeds `tol`, or with
 * several separate runs, is **refused** (`tangent contact not resolved`). A near-tangent crossing
 * whose angle is below what the leaf size can isolate (≈ `κ tol`) is reported as one tangent point.
 * A short stretch whose end offsets `A - B` point to opposite sides at an angle of at least
 * `angTolDeg` (`crossesOver`) is a crossing the isolation test could not certify (a degenerate
 * parametrisation): one **transversal** point, `unique: false`. An overlap that passes the seam of a
 * closed B is split there (`overlapPieces`), so each part maps onto one monotone range of B.
 * Bounds: `CURVE_PAIR_BUDGET` pair visits, `CURVE_MAX_DEPTH` levels; exceeding either is refused.
 *
 * Points closer than `tol` that are the same place on both curves (`samePlaceOnCurve`: seams of
 * closed curves, shared piece boundaries — not two branches of a self-crossing curve) are merged,
 * keeping the smaller `tA`; points inside an overlap are dropped. Results are sorted by `tA`.
 * Deviation of a point: `|A(tA) - B(tB)|` (the reported point is `A(tA)`); of an overlap: the largest
 * sampled distance.
 *
 * 2D curves (`Curve2`): lifted exactly to the plane `z = 0` (coordinates copied, `z = 0`) and
 * intersected in space; the lifted line/line case is exactly the 2D Cramer rule.
 *
 * NOT certified: Gauss–Newton convergence (a root is accepted by its measured residual), the
 * coverage samples between samples, the tangent / overlap decision rule above.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/api_intersectors.rs (`intersect_curves`,
 *   `curve_crossings`: seam crossings merged by 3D distance on both curves, overlaps by range),
 *   solidcore/crates/solidcore/src/intersect/curve_class.rs and curve_class/p1–p9 (curve
 *   classification by subdivision), solidcore/crates/solidcore/src/curve/line.rs, curve/arc.rs,
 *   solidcore/docs/ssi.md §1 (points from roots, regions dropped by proof, tangency refused or
 *   flagged), solidcore/docs/definitions-and-certificates.md (Krawczyk test). Rewritten for
 *   cadloom; not a translation.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, length3, scale3, sub3, vec3, type Point2, type Point3, type Vec2, type Vec3 } from '../math/vec.ts';
import { mulDyadic, subDyadic, addDyadic, signDyadic, type Dyadic } from '../exact/dyadic.ts';
import { dy, qAdd, qCmp, qDiv, qMul, qOf, qOfDyadic, qSub, qToNumber, type Q } from '../exact/rational.ts';
import {
  TWO_PI,
  createCircleCurve,
  createLineCurve,
  createNurbsCurve3,
  curveRange,
  type CircleCurve,
  type Curve3,
  type LineCurve,
} from '../curve/types.ts';
import { evaluateCurve3, type CurveDerivs3 } from '../curve/evaluate.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { createNurbsCurve, curveDomain, type NurbsCurve } from '../nurbs/curve.ts';
import type { NurbsSurface } from '../nurbs/surface.ts';
import {
  add,
  boundCurve,
  boundCurveDerivative,
  boxesDisjoint3,
  box3Diagonal,
  coneOfDirections,
  hullOf,
  ivec3,
  ivSub,
  mul,
  normalConesSeparated,
  nurbsCurveAsSurface,
  scale,
  sub,
  unionBox3,
  type Box3,
  type IVec3,
  type Interval,
} from '../interval/index.ts';
import {
  combineClass,
  intersectionResult,
  refusal,
  type ContactKind,
  type CurveCurveHit,
  type CurveCurveOverlap,
  type CurveCurvePoint,
  type IntersectionClass,
  type IntersectionResult,
  type ParamRange,
} from './types.ts';
import { invertMatrix } from './linalg.ts';

const OP = 'intersect.intersectCurves';
const OP2 = 'intersect.intersectCurves2';

/** Pair visits allowed in one general curve/curve solve. */
export const CURVE_PAIR_BUDGET = 200_000;
/** Deepest piece level of the subdivision. */
export const CURVE_MAX_DEPTH = 80;
/**
 * Optional limits of the subdivision search (defaults `CURVE_PAIR_BUDGET` / `SURFACE_PAIR_BUDGET`
 * visits and `CURVE_MAX_DEPTH` levels); exceeding one is a refusal, never a truncated answer.
 */
export interface IntersectLimits {
  readonly maxPairVisits?: number;
  readonly maxDepth?: number;
}

/** The effective limits (positive integers; invalid values fall back to the defaults). */
export function searchLimits(limits: IntersectLimits | undefined, defaultVisits: number): { readonly visits: number; readonly depth: number } {
  const pick = (x: number | undefined, d: number): number => (x !== undefined && Number.isInteger(x) && x > 0 ? x : d);
  return { visits: pick(limits?.maxPairVisits, defaultVisits), depth: pick(limits?.maxDepth, CURVE_MAX_DEPTH) };
}

/** Pieces at least this deep are tested for contact coverage. */
const COVER_DEPTH = 2;
/** Gauss–Newton iterations. */
const NEWTON_STEPS = 60;


// ---------------------------------------------------------------------------------------------
// Small interval helpers.

/** The interval `[lo, hi]` of finite doubles `lo <= hi` (exact). */
export const ivOf = (lo: number, hi: number): Interval => hullOf([lo, hi])!;
export const ivPt = (x: number): Interval => hullOf([x])!;
export const mag = (a: Interval): number => Math.max(Math.abs(a.lo), Math.abs(a.hi));
/** `v · I` for an exact double vector and an interval vector. */
export const dotVecIv = (v: Vec3, a: IVec3): Interval => add(add(scale(a.x, v.x), scale(a.y, v.y)), scale(a.z, v.z));
export const ivCoords = (a: IVec3): readonly Interval[] => [a.x, a.y, a.z];
export const boxIVec = (b: Box3): IVec3 => ivec3(ivOf(b.min.x, b.max.x), ivOf(b.min.y, b.max.y), ivOf(b.min.z, b.max.z));

/**
 * The Krawczyk contraction test: `‖I - Y J‖∞ < 1` (rounded up) with `Y = mid(J)⁻¹`, for an
 * `n × n` interval matrix `J` enclosing the Jacobian over a convex box. When it holds, the map is
 * injective on the box (two points with equal values would satisfy `x - y = (I - Y J̃)(x - y)` for
 * a mean-value matrix `J̃ ∈ J`, a contraction), so it has at most one root there.
 */
export function krawczykContracts(J: readonly (readonly Interval[])[]): boolean {
  const n = J.length;
  const mid = J.map((row) => row.map((e) => e.lo / 2 + e.hi / 2));
  const Y = invertMatrix(mid);
  if (Y === undefined) return false;
  let norm = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      let e = ivPt(i === j ? 1 : 0);
      for (let k = 0; k < n; k++) e = sub(e, scale(J[k]![j]!, Y[i]![k]!));
      rowSum += mag(e);
    }
    // Rounded up: a relative pad covers the n additions above.
    norm = Math.max(norm, rowSum * (1 + 8 * Number.EPSILON));
  }
  return Number.isFinite(norm) && norm < 1;
}

// ---------------------------------------------------------------------------------------------
// Curve context: certified boxes and derivative enclosures of parameter pieces.

/** A curve with its range and, for NURBS, the curve seen as a surface of v-degree 1 (for `homogeneousPartials`). Internal. */
export interface CurveCtx {
  readonly curve: Curve3;
  readonly range: readonly [number, number];
  readonly wrapped: NurbsSurface | undefined;
  readonly knots: readonly number[];
}

export function curveCtx(curve: Curve3): Result<CurveCtx> {
  const range = curveRange(curve);
  if (curve.kind !== 'nurbs') return ok({ curve, range, wrapped: undefined, knots: [] });
  const c = curve.curve;
  const s = nurbsCurveAsSurface(c);
  if (!s.ok) return s;
  const [a, b] = curveDomain(c);
  const knots = [...new Set(c.knots.filter((k) => k > a && k < b))].sort((x, y) => x - y);
  return ok({ curve, range, wrapped: s.value, knots });
}

/** A node of the parameter-piece tree of a curve (mutable caches; internal). */
export interface CurvePiece {
  readonly lo: number;
  readonly hi: number;
  readonly depth: number;
  readonly box: Box3;
  deriv: IVec3 | null | undefined;
  kids: readonly [CurvePiece, CurvePiece] | null | undefined;
  covered: boolean | undefined;
  center: CurveDerivs3 | null | undefined;
  /** Certified box of the point at the parameter midpoint (`boundCurve` of a point interval). */
  centerBox: Box3 | null | undefined;
}

export function makePiece(ctx: CurveCtx, lo: number, hi: number, depth: number): Result<CurvePiece> {
  const box = boundCurve(ctx.curve, ivOf(lo, hi));
  if (!box.ok) return box;
  return ok({ lo, hi, depth, box: box.value, deriv: undefined, kids: undefined, covered: undefined, center: undefined, centerBox: undefined });
}

export function pieceDeriv(ctx: CurveCtx, p: CurvePiece): IVec3 | null {
  if (p.deriv === undefined) {
    const d = boundCurveDerivative(ctx.curve, ivOf(p.lo, p.hi), ctx.wrapped);
    p.deriv = d.ok ? d.value : null;
  }
  return p.deriv;
}

export function pieceCenter(ctx: CurveCtx, p: CurvePiece): CurveDerivs3 | null {
  if (p.center === undefined) {
    const e = evaluateCurve3(ctx.curve, p.lo / 2 + p.hi / 2);
    p.center = e.ok ? e.value : null;
  }
  return p.center;
}

/** The certified box of `C(m)`, `m` the parameter midpoint of the piece (cached), or `null`. */
export function pieceCenterBox(ctx: CurveCtx, p: CurvePiece): Box3 | null {
  if (p.centerBox === undefined) {
    const b = boundCurve(ctx.curve, ivPt(p.lo / 2 + p.hi / 2));
    p.centerBox = b.ok ? b.value : null;
  }
  return p.centerBox;
}

/** One term `±(e · D)(T - m)` of a centered form: a derivative enclosure, the parameter interval and its sign. */
export interface CenteredTerm {
  readonly deriv: IVec3;
  readonly lo: number;
  readonly hi: number;
  readonly sign: 1 | -1;
}

/**
 * Mean-value separation along one direction (curve/curve and curve/surface exclusion that
 * axis-aligned boxes cannot give, e.g. two arcs `2 tol` apart). With `u = e / |e|` shrunk so that
 * `|u| <= 1` after rounding, `u · (X - Y)` is enclosed by the centered form
 * `u · (c_X - c_Y) + Σ ± (u · D_i)(T_i - m_i)` (`centerDiff` encloses `c_X - c_Y`, the certified
 * boxes of the two center points; per coordinate the mean value theorem puts each increment in
 * `D_i (T_i - m_i)`, Lean `IntersectCurve.centered_mem`). A lower bound above `tol` (or an upper
 * bound below `-tol`) proves `|X - Y| > tol` on the whole pair (Cauchy–Schwarz, Lean
 * `axis_separation`). The dot product with `u` is taken before the product with `T_i - m_i`, so the
 * enclosure is second order in the piece size.
 */
export function separatedAlong(e: Vec3, centerDiff: IVec3, terms: readonly CenteredTerm[], tol: number): boolean {
  const len = length3(e);
  if (!(len > 0) || !Number.isFinite(len)) return false;
  const u = scale3(e, (1 - 8 * Number.EPSILON) / len);
  let d = dotVecIv(u, centerDiff);
  for (const t of terms) {
    const m = t.lo / 2 + t.hi / 2;
    const inc = mul(dotVecIv(u, t.deriv), sub(ivOf(t.lo, t.hi), ivPt(m)));
    d = t.sign > 0 ? add(d, inc) : sub(d, inc);
  }
  return d.lo > tol || d.hi < -tol;
}

/** `w` without its component along `t` (`w` itself when `t` is zero). */
export function rejectFrom(w: Vec3, t: Vec3): Vec3 {
  const tt = dot3(t, t);
  return tt > 0 && Number.isFinite(tt) ? sub3(w, scale3(t, dot3(w, t) / tt)) : w;
}

/**
 * The mean-value separation test for a pair of curve pieces (see {@link separatedAlong}), along
 * the center offset `w = A(m_A) - B(m_B)` and along `w` with its components along the two center
 * tangents removed (the common normal of nearly parallel pieces, where the test is second order).
 * Any direction is sound; these are the ones that work.
 */
function pairSeparated(ca: CurveCtx, P: CurvePiece, cb: CurveCtx, Q: CurvePiece, tol: number): boolean {
  const DA = pieceDeriv(ca, P), DB = pieceDeriv(cb, Q);
  const bA = pieceCenterBox(ca, P), bB = pieceCenterBox(cb, Q);
  const ea = pieceCenter(ca, P), eb = pieceCenter(cb, Q);
  if (DA === null || DB === null || bA === null || bB === null || ea === null || eb === null) return false;
  const centerDiff = ivSub(boxIVec(bA), boxIVec(bB));
  const terms: readonly CenteredTerm[] = [
    { deriv: DA, lo: P.lo, hi: P.hi, sign: 1 },
    { deriv: DB, lo: Q.lo, hi: Q.hi, sign: -1 },
  ];
  const w = sub3(ea.point, eb.point);
  const nA = rejectFrom(w, ea.d1);
  return separatedAlong(nA, centerDiff, terms, tol) || separatedAlong(rejectFrom(nA, rejectFrom(eb.d1, ea.d1)), centerDiff, terms, tol) || separatedAlong(w, centerDiff, terms, tol);
}

/**
 * Whether parameters `t1` and `t2` of `C` name the same place of the curve (so two hits there are
 * one): the curve between them — or, on a closed curve, the way round through its seam — stays
 * within `2 tol` of `C(t1)` (eight samples per path). Two hits at one 3D point on different
 * branches of a self-crossing curve are different places.
 */
export function samePlaceOnCurve(C: Curve3, t1: number, t2: number, tol: number): Result<boolean> {
  const [r0, r1] = curveRange(C);
  const p1 = evaluateCurve3(C, t1);
  if (!p1.ok) return p1;
  const stays = (a: number, b: number): Result<boolean> => {
    for (let k = 0; k <= 8; k++) {
      const e = evaluateCurve3(C, k === 8 ? b : a + ((b - a) * k) / 8);
      if (!e.ok) return e;
      if (!(length3(sub3(e.value.point, p1.value.point)) <= 2 * tol)) return ok(false);
    }
    return ok(true);
  };
  const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
  const direct = stays(lo, hi);
  if (!direct.ok || direct.value) return direct;
  const e0 = evaluateCurve3(C, r0), e1 = evaluateCurve3(C, r1);
  if (!e0.ok) return e0;
  if (!e1.ok) return e1;
  if (!(length3(sub3(e0.value.point, e1.value.point)) <= tol)) return ok(false);
  const a = stays(hi, r1);
  if (!a.ok || !a.value) return a;
  return stays(r0, lo);
}

/** The two halves (at the middle interior knot of a NURBS piece, else the midpoint), or `null` when the piece cannot be split. */
export function pieceKids(ctx: CurveCtx, p: CurvePiece): Result<readonly [CurvePiece, CurvePiece] | null> {
  if (p.kids !== undefined) return ok(p.kids);
  const inner = ctx.knots.filter((k) => k > p.lo && k < p.hi);
  const m = inner.length > 0 ? inner[(inner.length - 1) >> 1]! : p.lo + (p.hi - p.lo) / 2;
  if (!(m > p.lo && m < p.hi)) {
    p.kids = null;
    return ok(null);
  }
  const l = makePiece(ctx, p.lo, m, p.depth + 1);
  if (!l.ok) return l;
  const r = makePiece(ctx, m, p.hi, p.depth + 1);
  if (!r.ok) return r;
  p.kids = [l.value, r.value];
  return ok(p.kids);
}

/** Whether `x` lies in `[lo, hi]` up to a relative slack of `1e-9` of the width (plus a few ulps). */
export function insideSlack(lo: number, hi: number, x: number): boolean {
  const s = 1e-9 * (hi - lo) + 64 * Number.EPSILON * Math.max(1, Math.abs(lo), Math.abs(hi));
  return x >= lo - s && x <= hi + s;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------------------------
// Gauss–Newton refinement of a curve pair.

interface PairRefinement {
  readonly s: number;
  readonly t: number;
  readonly dist: number;
  readonly converged: boolean;
}

/**
 * Gauss–Newton on `F(s, t) = A(s) - B(t)` (Newton for crossing curves, least-squares distance
 * minimisation otherwise), clamped to `sBounds × tBounds`. Returns the best iterate seen.
 */
function refinePair(
  A: Curve3,
  B: Curve3,
  s0: number,
  t0: number,
  sBounds: readonly [number, number],
  tBounds: readonly [number, number],
): Result<PairRefinement> {
  let s = clamp(s0, sBounds[0], sBounds[1]);
  let t = clamp(t0, tBounds[0], tBounds[1]);
  let best: PairRefinement | undefined;
  for (let i = 0; i <= NEWTON_STEPS; i++) {
    const ea = evaluateCurve3(A, s);
    if (!ea.ok) return ea;
    const eb = evaluateCurve3(B, t);
    if (!eb.ok) return eb;
    const F = sub3(ea.value.point, eb.value.point);
    const dist = length3(F);
    if (best === undefined || dist < best.dist) best = { s, t, dist, converged: false };
    if (dist === 0 || i === NEWTON_STEPS) break;
    const a = ea.value.d1, b = scale3(eb.value.d1, -1);
    const aa = dot3(a, a), ab = dot3(a, b), bb = dot3(b, b);
    const ga = dot3(a, F), gb = dot3(b, F);
    const det = aa * bb - ab * ab;
    let ds: number, dt: number;
    if (det > 1e-24 * aa * bb && Number.isFinite(det)) {
      ds = -(bb * ga - ab * gb) / det;
      dt = -(aa * gb - ab * ga) / det;
    } else {
      // Parallel tangents: separate one-dimensional steps.
      ds = aa > 0 ? -ga / aa / 2 : 0;
      dt = bb > 0 ? -gb / bb / 2 : 0;
    }
    if (!Number.isFinite(ds) || !Number.isFinite(dt)) break;
    let ns = clamp(s + ds, sBounds[0], sBounds[1]);
    let nt = clamp(t + dt, tBounds[0], tBounds[1]);
    // A parameter stopped by its bound (a contact at a curve end): the other one is re-solved
    // alone against the linearised offset there, so the iteration reaches the constrained foot
    // instead of stalling beside it.
    if (ns !== s + ds && bb > 0) nt = clamp(t - dot3(b, add3(F, scale3(a, ns - s))) / bb, tBounds[0], tBounds[1]);
    else if (nt !== t + dt && aa > 0) ns = clamp(s - dot3(a, add3(F, scale3(b, nt - t))) / aa, sBounds[0], sBounds[1]);
    const still = Math.abs(ns - s) <= 4 * Number.EPSILON * Math.max(1, Math.abs(s)) && Math.abs(nt - t) <= 4 * Number.EPSILON * Math.max(1, Math.abs(t));
    s = ns;
    t = nt;
    if (still) {
      const fa = evaluateCurve3(A, s), fb = evaluateCurve3(B, t);
      if (fa.ok && fb.ok) {
        const d = length3(sub3(fa.value.point, fb.value.point));
        if (d <= best.dist) best = { s, t, dist: d, converged: true };
        else best = { ...best, converged: true };
      }
      break;
    }
  }
  return ok(best!);
}

// ---------------------------------------------------------------------------------------------
// Result helpers.

interface RawPoint {
  tA: number;
  tB: number;
  point: Point3;
  pointB: Point3;
  contact: ContactKind;
  cls: IntersectionClass;
  deviation: number;
  unique: boolean;
}

function rawPoint(A: Curve3, B: Curve3, tA: number, tB: number, contact: ContactKind, cls: IntersectionClass, unique: boolean): Result<RawPoint> {
  const pa = evaluateCurve3(A, tA);
  if (!pa.ok) return pa;
  const pb = evaluateCurve3(B, tB);
  if (!pb.ok) return pb;
  const deviation = length3(sub3(pa.value.point, pb.value.point));
  return ok({ tA, tB, point: pa.value.point, pointB: pb.value.point, contact, cls, deviation, unique });
}

/**
 * Sorts by `tA` (then `tB`), merges points within `tol` of each other that are the same place on
 * both curves (`samePlaceOnCurve`: a closed curve's seam, a shared piece boundary — not two
 * branches of a self-crossing curve), keeping the first and flagging the merged point tangent if
 * either was; drops points inside an overlap (by parameter, or at the same place as an end).
 */
function finishCurveHits(
  points: readonly RawPoint[],
  inputOverlaps: readonly CurveCurveOverlap[],
  A: Curve3,
  B: Curve3,
  tol: number,
  forceCertified: boolean,
): Result<IntersectionResult<CurveCurveHit>> {
  // Overlaps where one continues the other on both curves, in the same direction (two stretches
  // whose ends were carried into each other, `extendContactEnd`), are one component. Pieces split
  // at the seam of a closed B touch on A but not on B, and stay apart.
  const slackB = 1e-9 * Math.max(1, Math.abs(curveRange(B)[0]), Math.abs(curveRange(B)[1]));
  const overlaps: CurveCurveOverlap[] = [];
  for (const o of [...inputOverlaps].sort((a, b) => a.rangeA[0] - b.rangeA[0] || a.rangeA[1] - b.rangeA[1])) {
    const last = overlaps[overlaps.length - 1];
    // B's parameter at the start of `o` (on A) must lie on `last`'s B range: `o` continues `last`.
    const bStart = o.sameDirection ? o.rangeB[0] : o.rangeB[1];
    if (
      last === undefined ||
      o.rangeA[0] > last.rangeA[1] ||
      o.sameDirection !== last.sameDirection ||
      bStart < last.rangeB[0] - slackB ||
      bStart > last.rangeB[1] + slackB
    ) {
      overlaps.push(o);
      continue;
    }
    overlaps[overlaps.length - 1] = Object.freeze({
      kind: 'overlap',
      rangeA: Object.freeze([last.rangeA[0], Math.max(last.rangeA[1], o.rangeA[1])] as const),
      rangeB: Object.freeze([Math.min(last.rangeB[0], o.rangeB[0]), Math.max(last.rangeB[1], o.rangeB[1])] as const),
      sameDirection: last.sameDirection,
      class: combineClass([last.class, o.class]),
      deviation: Math.max(last.deviation, o.deviation),
    });
  }
  const sorted = [...points].sort((p, q) => p.tA - q.tA || p.tB - q.tB);
  const kept: RawPoint[] = [];
  for (const p of sorted) {
    let same: RawPoint | undefined;
    for (const k of kept) {
      if (!(length3(sub3(k.point, p.point)) <= tol && length3(sub3(k.pointB, p.pointB)) <= tol)) continue;
      const sa = samePlaceOnCurve(A, k.tA, p.tA, tol);
      if (!sa.ok) return sa;
      if (!sa.value) continue;
      const sb = samePlaceOnCurve(B, k.tB, p.tB, tol);
      if (!sb.ok) return sb;
      if (!sb.value) continue;
      same = k;
      break;
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
  const inOverlap = (p: RawPoint): Result<boolean> => {
    for (const o of overlaps) {
      if (p.tA >= o.rangeA[0] && p.tA <= o.rangeA[1]) return ok(true);
      for (const e of o.rangeA) {
        const q = evaluateCurve3(A, e);
        if (!q.ok || !(length3(sub3(q.value.point, p.point)) <= tol)) continue;
        const sp = samePlaceOnCurve(A, e, p.tA, tol);
        if (!sp.ok) return sp;
        if (sp.value) return ok(true);
      }
    }
    return ok(false);
  };
  const hits: CurveCurveHit[] = [];
  for (const p of kept) {
    const io = inOverlap(p);
    if (!io.ok) return io;
    if (io.value) continue;
    hits.push(
      Object.freeze({
        kind: 'point',
        tA: p.tA,
        tB: p.tB,
        point: Object.freeze({ x: p.point.x, y: p.point.y, z: p.point.z }),
        contact: p.contact,
        class: p.cls,
        deviation: p.deviation,
        unique: p.unique,
      }) satisfies CurveCurvePoint,
    );
  }
  for (const o of overlaps) hits.push(o);
  hits.sort((a, b) => (a.kind === 'point' ? a.tA : a.rangeA[0]) - (b.kind === 'point' ? b.tA : b.rangeA[0]));
  for (const h of hits) if (!Number.isFinite(h.deviation)) return invalidInput(OP, 'non-finite deviation');
  const cls: IntersectionClass = forceCertified ? 'certified' : combineClass(hits.map((h) => h.class));
  return ok(intersectionResult(cls, hits));
}

function makeOverlap(
  rangeA: readonly [number, number],
  bAtStart: number,
  bAtEnd: number,
  cls: IntersectionClass,
  deviation: number,
): CurveCurveOverlap {
  const same = bAtEnd >= bAtStart;
  return Object.freeze({
    kind: 'overlap',
    rangeA: Object.freeze([rangeA[0], rangeA[1]] as const),
    rangeB: Object.freeze((same ? [bAtStart, bAtEnd] : [bAtEnd, bAtStart]) as readonly [number, number]),
    sameDirection: same,
    class: cls,
    deviation,
  });
}

/** Maps angle `theta` onto the arc `[t0, t1]` (period 2π) with `slack` radians at the ends; `undefined` off the arc. */
export function arcParam(theta: number, range: ParamRange, slack: number): number | undefined {
  const [t0, t1] = range;
  let x = t0 + ((((theta - t0) % TWO_PI) + TWO_PI) % TWO_PI);
  if (x >= t0 + TWO_PI) x -= TWO_PI;
  if (x <= t1) return x;
  if (x - t1 <= slack) return t1;
  if (t0 + TWO_PI - x <= slack) return t0;
  return undefined;
}

/** A line parameter `t`, accepted within `tol` (3D) beyond the range ends and clamped; `undefined` otherwise. */
export function lineParam(line: { readonly direction: Vec3; readonly range: ParamRange }, t: number, tol: number): number | undefined {
  const [t0, t1] = line.range;
  if (!Number.isFinite(t)) return undefined;
  const slack = tol / length3(line.direction);
  if (t < t0 - slack || t > t1 + slack) return undefined;
  return clamp(t, t0, t1);
}

/**
 * Whether doubles at the magnitude of these coordinates are spaced too coarsely for `tol` (16 ulps
 * of the largest exceed it): a closed-form root may then evaluate farther than `tol` from the
 * inputs. Such a root is refused (`precision exhausted`), never dropped as "no intersection".
 */
export function precisionLimited(tol: number, ...xs: readonly number[]): boolean {
  let m = 0;
  for (const x of xs) m = Math.max(m, Math.abs(x));
  return !(16 * Number.EPSILON * m < tol);
}

/** The angle of `p` in the plane of a circle frame (radians, `atan2`). */
export function circleAngle(c: CircleCurve, p: Point3): number {
  const w = sub3(p, c.center);
  return Math.atan2(dot3(w, c.frame.yAxis), dot3(w, c.frame.xAxis));
}

// ---------------------------------------------------------------------------------------------
// line / line (exact, then within tolerance)

type DVec = readonly [Dyadic, Dyadic, Dyadic];
const dvec = (v: Vec3): DVec => [dy(v.x), dy(v.y), dy(v.z)];
const dsub = (a: DVec, b: DVec): DVec => [subDyadic(a[0], b[0]), subDyadic(a[1], b[1]), subDyadic(a[2], b[2])];
const ddot = (a: DVec, b: DVec): Dyadic => addDyadic(addDyadic(mulDyadic(a[0], b[0]), mulDyadic(a[1], b[1])), mulDyadic(a[2], b[2]));
const dcross = (a: DVec, b: DVec): DVec => [
  subDyadic(mulDyadic(a[1], b[2]), mulDyadic(a[2], b[1])),
  subDyadic(mulDyadic(a[2], b[0]), mulDyadic(a[0], b[2])),
  subDyadic(mulDyadic(a[0], b[1]), mulDyadic(a[1], b[0])),
];
const dzero = (a: DVec): boolean => a.every((x) => signDyadic(x) === 0);

/**
 * 2D Cramer's rule in exact rationals: the parameters `(s, t)` with `oA + s dA = oB + t dB`, where
 * `w = oB - oA`, `det = dA.x dB.y - dA.y dB.x ≠ 0`, `s = (w.x dB.y - w.y dB.x) / det`,
 * `t = (w.x dA.y - w.y dA.x) / det` (Lean `IntersectCurve.cramer_on_both`). `undefined` when `det = 0`.
 */
export function cramer2(
  w: readonly [Dyadic, Dyadic],
  dA: readonly [Dyadic, Dyadic],
  dB: readonly [Dyadic, Dyadic],
): { readonly s: Q; readonly t: Q } | undefined {
  const det = subDyadic(mulDyadic(dA[0], dB[1]), mulDyadic(dA[1], dB[0]));
  if (signDyadic(det) === 0) return undefined;
  const sn = subDyadic(mulDyadic(w[0], dB[1]), mulDyadic(w[1], dB[0]));
  const tn = subDyadic(mulDyadic(w[0], dA[1]), mulDyadic(w[1], dA[0]));
  const dq = qOfDyadic(det);
  return { s: qDiv(qOfDyadic(sn), dq), t: qDiv(qOfDyadic(tn), dq) };
}

const qInRange = (x: Q, r: ParamRange): boolean => qCmp(x, qOf(r[0])) >= 0 && qCmp(x, qOf(r[1])) <= 0;

/** Exact line/line in space. `undefined` when there is no exact common point. */
function lineLineExact(A: LineCurve, B: LineCurve): { kind: 'point'; s: number; t: number } | { kind: 'overlap'; a: [number, number]; b0: number; b1: number } | undefined {
  const dA = dvec(A.direction), dB = dvec(B.direction);
  const w = dsub(dvec(B.origin), dvec(A.origin));
  const n = dcross(dA, dB);
  if (!dzero(n)) {
    if (signDyadic(ddot(w, n)) !== 0) return undefined; // skew
    // A coordinate plane (i, j) whose normal component n_k = dA_i dB_j - dA_j dB_i is non-zero.
    const k = signDyadic(n[2]) !== 0 ? 2 : signDyadic(n[1]) !== 0 ? 1 : 0;
    const [i, j] = k === 2 ? [0, 1] : k === 1 ? [2, 0] : [1, 2];
    const c = cramer2([w[i]!, w[j]!], [dA[i]!, dA[j]!], [dB[i]!, dB[j]!])!;
    if (!qInRange(c.s, A.range) || !qInRange(c.t, B.range)) return undefined;
    return { kind: 'point', s: qToNumber(c.s), t: qToNumber(c.t) };
  }
  if (!dzero(dcross(w, dA))) return undefined; // parallel, distinct
  // Collinear: s(t) = (w + t dB)·dA / dA·dA.
  const aa = qOfDyadic(ddot(dA, dA));
  const wa = qOfDyadic(ddot(w, dA));
  const ba = qOfDyadic(ddot(dB, dA));
  const sOf = (t: number): Q => qDiv(qAdd(wa, qMul(qOf(t), ba)), aa);
  const s0 = sOf(B.range[0]), s1 = sOf(B.range[1]);
  const [smin, smax] = qCmp(s0, s1) <= 0 ? [s0, s1] : [s1, s0];
  const aLo = qOf(A.range[0]), aHi = qOf(A.range[1]);
  const lo = qCmp(smin, aLo) >= 0 ? smin : aLo;
  const hi = qCmp(smax, aHi) <= 0 ? smax : aHi;
  if (qCmp(lo, hi) > 0) return undefined;
  // t(s) = (oA + s dA - oB)·dB / dB·dB = (s dA·dB - w·dB) / dB·dB.
  const bb = qOfDyadic(ddot(dB, dB));
  const wb = qOfDyadic(ddot(w, dB));
  const tOf = (s: Q): number => qToNumber(qDiv(qSub(qMul(s, ba), wb), bb));
  if (qCmp(lo, hi) === 0) return { kind: 'point', s: qToNumber(lo), t: tOf(lo) };
  return { kind: 'overlap', a: [qToNumber(lo), qToNumber(hi)], b0: tOf(lo), b1: tOf(hi) };
}

/** Closest points of the segments `oA + s dA, s ∈ RA` and `oB + t dB, t ∈ RB` (floating point, Ericson §5.1.9). */
function segmentClosest(A: LineCurve, B: LineCurve): { s: number; t: number } {
  const [a0, a1] = A.range, [b0, b1] = B.range;
  const pa = add3(A.origin, scale3(A.direction, a0));
  const pb = add3(B.origin, scale3(B.direction, b0));
  const d1 = scale3(A.direction, a1 - a0), d2 = scale3(B.direction, b1 - b0);
  const r = sub3(pa, pb);
  const a = dot3(d1, d1), e = dot3(d2, d2), f = dot3(d2, r);
  const c = dot3(d1, r), b = dot3(d1, d2);
  const den = a * e - b * b;
  let u = den > 1e-30 * a * e ? clamp((b * f - c * e) / den, 0, 1) : 0;
  let v = (b * u + f) / e;
  if (v < 0) {
    v = 0;
    u = clamp(-c / a, 0, 1);
  } else if (v > 1) {
    v = 1;
    u = clamp((b - c) / a, 0, 1);
  }
  return { s: a0 + u * (a1 - a0), t: b0 + v * (b1 - b0) };
}

function lineLine(kernel: Kernel, A: LineCurve, B: LineCurve): Result<IntersectionResult<CurveCurveHit>> {
  const tol = kernel.tolerances.zoneTol3d;
  const la = length3(A.direction), lb = length3(B.direction);
  const sinAngle = length3(cross3(A.direction, B.direction)) / (la * lb);
  const nearlyParallel = sinAngle <= Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  const ex = lineLineExact(A, B);
  // An exact crossing of lines within the angular tolerance is decided by the tolerance band
  // below, as for skew lines: the same pair moved by 1e-12 off its crossing must not turn from one
  // point into an overlap.
  if (ex !== undefined && !(ex.kind === 'point' && nearlyParallel && sinAngle > 0)) {
    if (ex.kind === 'point') {
      const contact: ContactKind = dzero(dcross(dvec(A.direction), dvec(B.direction))) ? 'tangent' : 'transversal';
      const p = rawPoint(A, B, ex.s, ex.t, contact, 'exact', true);
      if (!p.ok) return p;
      return finishCurveHits([p.value], [], A, B, tol, false);
    }
    const dev = Math.max(...[ex.a[0], ex.a[1]].map((s, i) => {
      const pa = evaluateCurve3(A, s), pb = evaluateCurve3(B, clamp(i === 0 ? ex.b0 : ex.b1, B.range[0], B.range[1]));
      return pa.ok && pb.ok ? length3(sub3(pa.value.point, pb.value.point)) : 0;
    }));
    const o = makeOverlap(ex.a, clamp(ex.b0, B.range[0], B.range[1]), clamp(ex.b1, B.range[0], B.range[1]), 'exact', dev);
    return finishCurveHits([], [o], A, B, tol, false);
  }
  // No exact common point (or an exact crossing at an angle within angTolDeg): contacts within
  // the tolerance.
  const { s, t } = ex !== undefined && ex.kind === 'point' ? { s: ex.s, t: ex.t } : segmentClosest(A, B);
  const pr = rawPoint(A, B, s, t, 'transversal', 'certified', true);
  if (!pr.ok) return pr;
  if (!(pr.value.deviation <= tol)) return finishCurveHits([], [], A, B, tol, false);
  if (nearlyParallel) {
    // Nearly parallel: the s-interval where A(s) is within tol of the segment B.
    const uB = scale3(B.direction, 1 / lb);
    const w0 = sub3(A.origin, B.origin);
    const dPerp = sub3(A.direction, scale3(uB, dot3(A.direction, uB)));
    const wPerp = sub3(w0, scale3(uB, dot3(w0, uB)));
    // |wPerp + s dPerp|² <= tol²
    const qa = dot3(dPerp, dPerp), qb = 2 * dot3(wPerp, dPerp), qc = dot3(wPerp, wPerp) - tol * tol;
    let lo = A.range[0], hi = A.range[1];
    if (qa > 0) {
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        lo = Math.max(lo, (-qb - sq) / (2 * qa));
        hi = Math.min(hi, (-qb + sq) / (2 * qa));
      } else {
        // The band is empty up to rounding (the closest distance is at tol): a touch, not the whole range.
        hi = lo;
      }
    }
    // Foot parameter on B: t(s) = (w0 + s dA)·dB / dB·dB, kept in B's range.
    const bb = lb * lb, tw = dot3(w0, B.direction) / bb, ts = dot3(A.direction, B.direction) / bb;
    if (ts !== 0) {
      const sa = (B.range[0] - tw) / ts, sb = (B.range[1] - tw) / ts;
      lo = Math.max(lo, Math.min(sa, sb));
      hi = Math.min(hi, Math.max(sa, sb));
    }
    if (hi > lo && (hi - lo) * la > tol) {
      const tOf = (x: number): number => clamp(tw + ts * x, B.range[0], B.range[1]);
      const ends = [rawPoint(A, B, lo, tOf(lo), 'tangent', 'certified', false), rawPoint(A, B, hi, tOf(hi), 'tangent', 'certified', false)];
      let dev = 0;
      for (const e of ends) {
        if (!e.ok) return e;
        dev = Math.max(dev, e.value.deviation);
      }
      return finishCurveHits([], [makeOverlap([lo, hi], tOf(lo), tOf(hi), 'certified', dev)], A, B, tol, false);
    }
    pr.value.contact = 'tangent';
    pr.value.unique = false;
  }
  return finishCurveHits([pr.value], [], A, B, tol, false);
}

// ---------------------------------------------------------------------------------------------
// circle / plane (shared with curve/surface), line / circle, circle / circle

/** An angle solution of a circle against a plane. */
export interface AngleRoot {
  readonly theta: number;
  readonly tangent: boolean;
}

/**
 * Where a circle (center `c`, radius `r`, in-plane axes `X`, `Y`) meets the plane through `p0` with
 * unit normal `n`: `f(θ) = γ + α cos θ + β sin θ` with `α = r n·X`, `β = r n·Y`, `γ = n·(c - p0)`,
 * `ρ = hypot(α, β)`, `φ = atan2(β, α)` (so `f = γ + ρ cos(θ - φ)`).
 * - `|γ| + ρ <= tol`: the circle lies within `tol` of the plane (`'overlap'`);
 * - `||γ| - ρ| <= tol`: one tangent point, `θ = φ` (when `γ < 0`) or `φ + π`;
 * - `|γ| < ρ`: two points `θ = φ ± acos(-γ / ρ)`;
 * - else none.
 */
export function circlePlaneAngles(
  c: Point3,
  r: number,
  X: Vec3,
  Y: Vec3,
  p0: Point3,
  n: Vec3,
  tol: number,
): 'overlap' | readonly AngleRoot[] {
  const alpha = r * dot3(n, X), beta = r * dot3(n, Y), gamma = dot3(n, sub3(c, p0));
  const rho = Math.hypot(alpha, beta);
  if (Math.abs(gamma) + rho <= tol) return 'overlap';
  const phi = Math.atan2(beta, alpha);
  if (Math.abs(Math.abs(gamma) - rho) <= tol) return [{ theta: gamma < 0 ? phi : phi + Math.PI, tangent: true }];
  if (!(Math.abs(gamma) < rho)) return [];
  const a = Math.acos(clamp(-gamma / rho, -1, 1));
  return [
    { theta: phi - a, tangent: false },
    { theta: phi + a, tangent: false },
  ];
}

function lineCircle(kernel: Kernel, L: LineCurve, C: CircleCurve): Result<readonly RawPoint[]> {
  const tol = kernel.tolerances.zoneTol3d;
  const n = C.frame.normal, X = C.frame.xAxis, Y = C.frame.yAxis, r = C.radius;
  const [t0, t1] = L.range;
  const e0 = dot3(n, sub3(add3(L.origin, scale3(L.direction, t0)), C.center));
  const e1 = dot3(n, sub3(add3(L.origin, scale3(L.direction, t1)), C.center));
  const w = sub3(L.origin, C.center);
  const ox = dot3(w, X), oy = dot3(w, Y), dx = dot3(L.direction, X), dyy = dot3(L.direction, Y);
  const a = dx * dx + dyy * dyy;
  const out: RawPoint[] = [];
  /**
   * Pushes the point at line parameter `t` (when on both ranges and within `tol`); whether it was
   * pushed. A `strict` root (a closed-form crossing) that doubles cannot place within `tol` is
   * refused (`precision exhausted`).
   */
  const push = (t: number, tangent: boolean, strict = false): Result<boolean> => {
    const tl = lineParam(L, t, tol);
    if (tl === undefined) return ok(false);
    const p = add3(L.origin, scale3(L.direction, tl));
    const th = arcParam(circleAngle(C, p), C.range, tol / r);
    if (th === undefined) return ok(false);
    const rp = rawPoint(L, C, tl, th, tangent ? 'tangent' : 'transversal', 'exact', true);
    if (!rp.ok) return rp;
    if (!(rp.value.deviation <= tol)) {
      const q = rp.value.point;
      const c = C.center;
      if (strict && precisionLimited(tol, q.x, q.y, q.z, c.x, c.y, c.z, r)) return err(refusal(OP, 'precision exhausted'));
      return ok(false);
    }
    out.push(rp.value);
    return ok(true);
  };
  if (Math.abs(e0) <= tol && Math.abs(e1) <= tol && a > 0) {
    // In the plane: a t² + b t + c = 0, re-centred at the vertex clamped to the range (t = tc + τ),
    // so that a far line origin does not cancel the coefficients (a ray from 1e6 away).
    const b0 = 2 * (ox * dx + oy * dyy);
    const tc = clamp(-b0 / (2 * a), t0, t1);
    const qx = ox + tc * dx, qy = oy + tc * dyy;
    const b = 2 * (qx * dx + qy * dyy), c = qx * qx + qy * qy - r * r;
    const tm = tc - b / (2 * a);
    const h = Math.hypot(qx + (tm - tc) * dx, qy + (tm - tc) * dyy);
    if (Math.abs(h - r) <= tol) {
      // A touch: one tangent point at the vertex, or — the vertex beyond the range — at the
      // nearest range end when that end is still within the contact.
      const q = push(tm, true);
      if (!q.ok) return q;
      if (q.value) return ok(out);
      const te = clamp(tm, t0, t1);
      if (te !== tm) {
        const qe = push(te, true);
        if (!qe.ok) return qe;
        if (qe.value) return ok(out);
      }
    }
    if (h < r) {
      const disc = b * b - 4 * a * c;
      const s = Math.sqrt(Math.max(0, disc));
      for (const tau of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        const q = push(tc + tau, false, true);
        if (!q.ok) return q;
      }
    }
    return ok(out);
  }
  const den = dot3(n, L.direction);
  if (den === 0) return ok(out);
  const q = push(-dot3(n, w) / den, false, true);
  return q.ok ? ok(out) : q;
}

function circleCircle(kernel: Kernel, A: CircleCurve, B: CircleCurve): Result<{ points: RawPoint[]; overlaps: CurveCurveOverlap[] }> {
  const tol = kernel.tolerances.zoneTol3d;
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  const nA = A.frame.normal, nB = B.frame.normal;
  const cross = length3(cross3(nA, nB));
  const points: RawPoint[] = [];
  const overlaps: CurveCurveOverlap[] = [];
  const addPoint = (p: Point3, tangent: boolean): Result<void> => {
    const ta = arcParam(circleAngle(A, p), A.range, tol / A.radius);
    const tb = arcParam(circleAngle(B, p), B.range, tol / B.radius);
    if (ta === undefined || tb === undefined) return ok(undefined);
    const rp = rawPoint(A, B, ta, tb, tangent ? 'tangent' : 'transversal', 'exact', true);
    if (!rp.ok) return rp;
    if (rp.value.deviation <= 2 * tol) points.push(rp.value);
    else if (!tangent && precisionLimited(tol, p.x, p.y, p.z, A.center.x, A.center.y, A.center.z, B.center.x, B.center.y, B.center.z, A.radius, B.radius)) {
      return err(refusal(OP, 'precision exhausted'));
    }
    return ok(undefined);
  };
  const cAB = sub3(B.center, A.center);
  if (cross <= sinTol) {
    if (Math.abs(dot3(nA, cAB)) > tol || Math.abs(dot3(nB, cAB)) > tol) return ok({ points, overlaps }); // parallel planes
    const qx = dot3(cAB, A.frame.xAxis), qy = dot3(cAB, A.frame.yAxis);
    const d = Math.hypot(qx, qy);
    const rA = A.radius, rB = B.radius;
    if (d <= tol && Math.abs(rA - rB) <= tol) {
      // Coincident circles: overlap of the arcs. tB = φ + σ tA (mod 2π), σ = ±1.
      const sigma = dot3(nA, nB) > 0 ? 1 : -1;
      const phi = Math.atan2(dot3(A.frame.xAxis, B.frame.yAxis), dot3(A.frame.xAxis, B.frame.xAxis));
      // B's arc pulled back to A's angle: σ = 1: [b0 - φ, b1 - φ]; σ = -1: [φ - b1, φ - b0].
      const [b0, b1] = B.range;
      const base: [number, number] = sigma > 0 ? [b0 - phi, b1 - phi] : [phi - b1, phi - b0];
      const dev = d + Math.abs(rA - rB);
      for (let k = -2; k <= 2; k++) {
        const lo = Math.max(A.range[0], base[0] + k * TWO_PI), hi = Math.min(A.range[1], base[1] + k * TWO_PI);
        if (lo > hi) continue;
        // On this branch tB = tA + φ - 2πk (σ = 1) or φ - tA + 2πk (σ = -1), inside [b0, b1].
        const tbOf = (ta: number): number => clamp(sigma > 0 ? ta + phi - k * TWO_PI : phi - ta + k * TWO_PI, b0, b1);
        if ((hi - lo) * rA <= tol) {
          const q = addPoint(fromAngle(A, (lo + hi) / 2), true);
          if (!q.ok) return q;
          continue;
        }
        overlaps.push(makeOverlap([lo, hi], tbOf(lo), tbOf(hi), 'exact', dev));
      }
      return ok({ points, overlaps });
    }
    if (d <= tol) return ok({ points, overlaps }); // concentric, different radii
    const ux = qx / d, uy = qy / d;
    const inPlane = (along: number, across: number): Point3 =>
      add3(A.center, add3(scale3(A.frame.xAxis, along * ux - across * uy), scale3(A.frame.yAxis, along * uy + across * ux)));
    if (Math.abs(d - (rA + rB)) <= tol) {
      const q = addPoint(inPlane(rA, 0), true);
      return q.ok ? ok({ points, overlaps }) : q;
    }
    if (Math.abs(d - Math.abs(rA - rB)) <= tol) {
      const q = addPoint(inPlane(rA >= rB ? rA : -rA, 0), true);
      return q.ok ? ok({ points, overlaps }) : q;
    }
    if (d > rA + rB || d < Math.abs(rA - rB)) return ok({ points, overlaps });
    const a = (d * d + rA * rA - rB * rB) / (2 * d);
    const h = Math.sqrt(Math.max(0, rA * rA - a * a));
    for (const sgn of [-1, 1]) {
      const q = addPoint(inPlane(a, sgn * h), false);
      if (!q.ok) return q;
    }
    return ok({ points, overlaps });
  }
  // Non-parallel planes: circle A against the plane of B, then on circle B.
  const roots = circlePlaneAngles(A.center, A.radius, A.frame.xAxis, A.frame.yAxis, B.center, nB, tol);
  if (roots === 'overlap') return ok({ points, overlaps }); // unreachable: the planes are not parallel
  for (const r of roots) {
    const p = fromAngle(A, r.theta);
    const w = sub3(p, B.center);
    const inB = sub3(w, scale3(nB, dot3(w, nB)));
    const distToB = Math.hypot(length3(inB) - B.radius, dot3(w, nB));
    if (distToB > tol) continue;
    const q = addPoint(p, r.tangent);
    if (!q.ok) return q;
  }
  return ok({ points, overlaps });
}

const fromAngle = (c: CircleCurve, theta: number): Point3 =>
  add3(c.center, add3(scale3(c.frame.xAxis, c.radius * Math.cos(theta)), scale3(c.frame.yAxis, c.radius * Math.sin(theta))));

// ---------------------------------------------------------------------------------------------
// General solver.

/** Whether the pair `P × Q` provably holds at most one intersection (Krawczyk contraction, or separated tangent cones). */
function isolating(ca: CurveCtx, P: CurvePiece, cb: CurveCtx, Q: CurvePiece): boolean {
  const DA = pieceDeriv(ca, P), DB = pieceDeriv(cb, Q);
  if (DA === null || DB === null) return false;
  const ea = pieceCenter(ca, P), eb = pieceCenter(cb, Q);
  if (ea !== null && eb !== null) {
    const la = length3(ea.d1);
    if (la > 0) {
      const e1 = scale3(ea.d1, 1 / la);
      const b = eb.d1;
      const r = sub3(b, scale3(e1, dot3(b, e1)));
      const lr = length3(r);
      if (lr > 1e-9 * length3(b)) {
        const e2 = scale3(r, 1 / lr);
        const J = [
          [dotVecIv(e1, DA), scale(dotVecIv(e1, DB), -1)],
          [dotVecIv(e2, DA), scale(dotVecIv(e2, DB), -1)],
        ];
        if (krawczykContracts(J)) return true;
      }
    }
  }
  return normalConesSeparated(coneOfDirections(DA), coneOfDirections(DB));
}

interface Stretch {
  lo: number;
  hi: number;
}

/** Merges intervals that touch or overlap into maximal runs (sorted). */
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

function closestDist(B: Curve3, p: Point3): Result<{ t: number; d: number }> {
  const c = closestPointOnCurve(B, p);
  return c.ok ? ok({ t: c.value.t, d: c.value.distance }) : c;
}

/** Five samples of `A` over the piece are within `tol` of `B`. */
function coveredBy(A: Curve3, P: CurvePiece, B: Curve3, tol: number): Result<boolean> {
  for (let k = 0; k <= 4; k++) {
    const s = k === 4 ? P.hi : P.lo + ((P.hi - P.lo) * k) / 4;
    const e = evaluateCurve3(A, s);
    if (!e.ok) return e;
    const c = closestDist(B, e.value.point);
    if (!c.ok) return c;
    if (!(c.value.d <= tol)) return ok(false);
  }
  return ok(true);
}

interface GeneralOutcome {
  readonly points: RawPoint[];
  readonly overlaps: CurveCurveOverlap[];
}

function solveGeneral(kernel: Kernel, A: Curve3, B: Curve3, limits: IntersectLimits | undefined): Result<GeneralOutcome> {
  const tol = kernel.tolerances.zoneTol3d;
  const lim = searchLimits(limits, CURVE_PAIR_BUDGET);
  const ca = curveCtx(A);
  if (!ca.ok) return ca;
  const cb = curveCtx(B);
  if (!cb.ok) return cb;
  const ra = makePiece(ca.value, ca.value.range[0], ca.value.range[1], 0);
  if (!ra.ok) return ra;
  const rb = makePiece(cb.value, cb.value.range[0], cb.value.range[1], 0);
  if (!rb.ok) return rb;
  const D = box3Diagonal(unionBox3(ra.value.box, rb.value.box));
  const minOverlap = 4 * Math.sqrt(2 * tol * D);
  const small = (p: CurvePiece): boolean => box3Diagonal(p.box) <= tol;

  const stack: [CurvePiece, CurvePiece][] = [[ra.value, rb.value]];
  const raw: RawPoint[] = [];
  const contact: Stretch[] = [];
  let visits = 0;
  while (stack.length > 0) {
    const [P, Q] = stack.pop()!;
    if (++visits > lim.visits) return err(refusal(OP, 'subdivision budget exceeded', visits));
    if (P.covered === true) continue;
    const dj = boxesDisjoint3(P.box, Q.box, tol);
    if (!dj.ok) return dj;
    if (dj.value) continue;
    if (P.depth + Q.depth >= 2 && pairSeparated(ca.value, P, cb.value, Q, tol)) continue;
    const splitP = (): Result<boolean> => {
      const sp = small(P), sq = small(Q);
      let pk = sp ? null : pieceKids(ca.value, P);
      let qk = sq ? null : pieceKids(cb.value, Q);
      if (pk !== null && !pk.ok) return pk;
      if (qk !== null && !qk.ok) return qk;
      let pkv = pk === null ? null : pk.value;
      let qkv = qk === null ? null : qk.value;
      if (pkv !== null && qkv !== null) {
        if (box3Diagonal(P.box) >= box3Diagonal(Q.box)) qkv = null;
        else pkv = null;
      }
      if (pkv === null && qkv === null) {
        // Unsplittable but not small: split whichever can be.
        pk = pieceKids(ca.value, P);
        if (!pk.ok) return pk;
        pkv = pk.value;
        if (pkv === null) {
          qk = pieceKids(cb.value, Q);
          if (!qk.ok) return qk;
          qkv = qk.value;
        }
        if (pkv === null && qkv === null) return ok(false);
      }
      if (Math.max(P.depth, Q.depth) >= lim.depth) return err(refusal(OP, 'recursion depth exceeded', visits));
      if (pkv !== null) stack.push([pkv[1], Q], [pkv[0], Q]);
      else stack.push([P, qkv![1]], [P, qkv![0]]);
      return ok(true);
    };
    if (isolating(ca.value, P, cb.value, Q)) {
      const r = refinePair(A, B, P.lo / 2 + P.hi / 2, Q.lo / 2 + Q.hi / 2, ca.value.range, cb.value.range);
      if (!r.ok) return r;
      if (r.value.dist <= tol && insideSlack(P.lo, P.hi, r.value.s) && insideSlack(Q.lo, Q.hi, r.value.t)) {
        const rp = rawPoint(A, B, r.value.s, r.value.t, 'transversal', 'certified', true);
        if (!rp.ok) return rp;
        raw.push(rp.value);
        continue;
      }
      if (small(P) && small(Q)) continue;
      const s = splitP();
      if (!s.ok) return s;
      continue;
    }
    if (P.covered === undefined && P.depth >= COVER_DEPTH) {
      const c = coveredBy(A, P, B, tol);
      if (!c.ok) return c;
      P.covered = c.value;
      if (c.value) {
        contact.push({ lo: P.lo, hi: P.hi });
        continue;
      }
    }
    if (small(P) && small(Q)) {
      contact.push({ lo: P.lo, hi: P.hi });
      continue;
    }
    const s = splitP();
    if (!s.ok) return s;
    if (!s.value) contact.push({ lo: P.lo, hi: P.hi });
  }

  const overlaps: CurveCurveOverlap[] = [];
  const sinAng = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  for (const st of mergeRuns(contact)) {
    const res = resolveStretch(A, B, st, tol, minOverlap, cb.value.range, sinAng);
    if (!res.ok) return res;
    if (res.value.kind === 'overlap') overlaps.push(...res.value.overlaps);
    else raw.push(res.value.point);
  }
  // Transversal roots isolated beside a near-tangency within the tolerance band are the same contact.
  const sorted = [...raw].sort((p, q) => p.tA - q.tA);
  const merged: RawPoint[] = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && (last.contact === 'tangent' || p.contact === 'tangent')) {
      let joined = true;
      for (let k = 1; k <= 7 && joined; k++) {
        const e = evaluateCurve3(A, last.tA + ((p.tA - last.tA) * k) / 8);
        if (!e.ok) return e;
        const c = closestDist(B, e.value.point);
        if (!c.ok) return c;
        joined = c.value.d <= tol;
      }
      if (joined) {
        if (p.contact === 'tangent' && last.contact !== 'tangent') merged[merged.length - 1] = { ...p };
        const kept = merged[merged.length - 1]!;
        kept.contact = 'tangent';
        kept.unique = false;
        continue;
      }
    }
    merged.push({ ...p });
  }
  return ok({ points: merged, overlaps });
}

type StretchOutcome = { kind: 'overlap'; overlaps: CurveCurveOverlap[] } | { kind: 'point'; point: RawPoint };

/**
 * The parameter ranges on B matching an overlap sampled at A-parameters `sA` (increasing) with
 * closest B-parameters `tB`. On a closed B the closest-point parameter jumps by about one period
 * where the overlap passes B's seam (and is ambiguous exactly at it): such an overlap is split there
 * (the A-parameter of the seam bisected), so each part maps onto one monotone range of B.
 */
function overlapPieces(
  A: Curve3,
  B: Curve3,
  sA: readonly number[],
  tB: readonly number[],
  rangeB: readonly [number, number],
  tol: number,
  dev: number,
): Result<CurveCurveOverlap[]> {
  const [b0, b1] = rangeB;
  const n = sA.length;
  const one = (): CurveCurveOverlap[] => [makeOverlap([sA[0]!, sA[n - 1]!], tB[0]!, tB[n - 1]!, 'certified', dev)];
  const e0 = evaluateCurve3(B, b0), e1 = evaluateCurve3(B, b1);
  if (!e0.ok) return e0;
  if (!e1.ok) return e1;
  if (!(length3(sub3(e0.value.point, e1.value.point)) <= tol) || n < 2) return ok(one());
  const period = b1 - b0;
  const atSeam = (x: number): boolean => Math.min(x - b0, b1 - x) <= 1e-9 * period;
  // Choose the seam representative next to the neighbouring sample.
  const t = [...tB];
  for (let k = 0; k < n; k++) {
    if (!atSeam(t[k]!)) continue;
    const ref = k === 0 ? t[1]! : t[k - 1]!;
    t[k] = Math.abs(ref - b0) <= Math.abs(ref - b1) ? b0 : b1;
  }
  const mid = b0 / 2 + b1 / 2;
  const out: CurveCurveOverlap[] = [];
  let startS = sA[0]!, startT = t[0]!;
  for (let k = 0; k + 1 < n; k++) {
    if (!(Math.abs(t[k + 1]! - t[k]!) > period / 2)) continue;
    const high = t[k]! > mid;
    let lo = sA[k]!, hi = sA[k + 1]!;
    for (let it = 0; it < 60; it++) {
      const m = lo / 2 + hi / 2;
      if (m === lo || m === hi) break;
      const e = evaluateCurve3(A, m);
      if (!e.ok) return e;
      const c = closestDist(B, e.value.point);
      if (!c.ok) return c;
      if (!atSeam(c.value.t) && c.value.t > mid === high) lo = m;
      else hi = m;
    }
    const cut = lo / 2 + hi / 2;
    out.push(makeOverlap([startS, cut], startT, high ? b1 : b0, 'certified', dev));
    startS = cut;
    startT = high ? b0 : b1;
  }
  if (out.length === 0) return ok([makeOverlap([sA[0]!, sA[n - 1]!], t[0]!, t[n - 1]!, 'certified', dev)]);
  out.push(makeOverlap([startS, sA[n - 1]!], startT, t[n - 1]!, 'certified', dev));
  return ok(out.filter((o) => o.rangeA[1] > o.rangeA[0]));
}

/**
 * Whether a short contact stretch is a crossing rather than a touch: the offsets `A - B` (to the
 * closest points) at the two stretch ends point to opposite sides, and the crossing angle they
 * measure over the stretch, `(|r_lo| + |r_hi|) / |A(hi) - A(lo)|`, is at least the angular
 * tolerance. A touch (offsets on one side) and a flat inflection-like contact stay `tangent`.
 * Used where the isolation test fails at a degenerate parametrisation (a pole) rather than at a
 * tangency.
 */
export function crossesOver(pLo: Point3, qLo: Point3, pHi: Point3, qHi: Point3, sinAng: number): boolean {
  const rLo = sub3(pLo, qLo), rHi = sub3(pHi, qHi);
  const a = length3(rLo), b = length3(rHi), chord = length3(sub3(pHi, pLo));
  if (!(a > 0 && b > 0 && chord > 0)) return false;
  return dot3(rLo, rHi) < -0.5 * a * b && (a + b) / chord >= sinAng;
}

/**
 * The end of a contact run that reaches the end of its stretch, carried further along the curve
 * while the sampled distance stays within `tol` (fixed steps of `step`, at most 256, then the exit
 * bisected), up to `limit` (a range end). Pieces beside a stretch can be dropped by the search
 * although they stay within `tol` (a monotone piece without a root), so a stretch end is not
 * necessarily where the contact ends; without this one coincident stretch would be reported as
 * several components. Sampled, not certified: an excursion beyond `tol` shorter than a step is
 * stepped over.
 */
export function extendContactEnd(
  dist: (t: number) => Result<number>,
  inside: number,
  limit: number,
  step: number,
  tol: number,
): Result<number> {
  const dir = limit >= inside ? 1 : -1;
  const h = Math.max(Math.abs(step), Math.abs(limit - inside) / 256);
  if (!(h > 0) || !Number.isFinite(h)) return ok(inside);
  let a = inside;
  for (let k = 0; k < 256 && a !== limit; k++) {
    const b = dir > 0 ? Math.min(limit, a + h) : Math.max(limit, a - h);
    if (b === a) break;
    const d = dist(b);
    if (!d.ok) return d;
    if (d.value <= tol) {
      a = b;
      continue;
    }
    let lo = a, hi = b;
    for (let it = 0; it < 60; it++) {
      const m = lo / 2 + hi / 2;
      if (m === lo || m === hi) break;
      const dm = dist(m);
      if (!dm.ok) return dm;
      if (dm.value <= tol) lo = m;
      else hi = m;
    }
    return ok(lo);
  }
  return ok(a);
}

/** Classifies a contact stretch on A (see the module comment). */
function resolveStretch(
  A: Curve3,
  B: Curve3,
  st: Stretch,
  tol: number,
  minOverlap: number,
  rangeB: readonly [number, number],
  sinAng: number,
): Result<StretchOutcome> {
  const N = 16;
  const ss: number[] = [], ds: number[] = [], ts: number[] = [], ps: Point3[] = [];
  for (let k = 0; k <= N; k++) {
    const s = k === N ? st.hi : st.lo + ((st.hi - st.lo) * k) / N;
    const e = evaluateCurve3(A, s);
    if (!e.ok) return e;
    const c = closestDist(B, e.value.point);
    if (!c.ok) return c;
    ss.push(s);
    ds.push(c.value.d);
    ts.push(c.value.t);
    ps.push(e.value.point);
  }
  // Runs of samples within tol.
  const runs: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    if (!(ds[k]! <= tol)) continue;
    const last = runs[runs.length - 1];
    if (last !== undefined && last[1] === k - 1) last[1] = k;
    else runs.push([k, k]);
  }
  const lengthOf = (i: number, j: number): number => {
    let L = 0;
    for (let k = i; k < j; k++) L += length3(sub3(ps[k + 1]!, ps[k]!));
    return L;
  };
  if (runs.length === 1 && lengthOf(runs[0]![0], runs[0]![1]) >= minOverlap) {
    const [i, j] = runs[0]!;
    const refineEnd = (inside: number, outside: number): Result<number> => {
      let a = inside, b = outside;
      for (let it = 0; it < 40; it++) {
        const m = a / 2 + b / 2;
        if (m === a || m === b) break;
        const e = evaluateCurve3(A, m);
        if (!e.ok) return e;
        const c = closestDist(B, e.value.point);
        if (!c.ok) return c;
        if (c.value.d <= tol) a = m;
        else b = m;
      }
      return ok(a);
    };
    const distA = (x: number): Result<number> => {
      const e = evaluateCurve3(A, x);
      if (!e.ok) return e;
      const c = closestDist(B, e.value.point);
      return c.ok ? ok(c.value.d) : c;
    };
    const [ra0, ra1] = curveRange(A);
    const stepA = (st.hi - st.lo) / N;
    const lo = i > 0 ? refineEnd(ss[i]!, ss[i - 1]!) : extendContactEnd(distA, ss[0]!, ra0, stepA, tol);
    if (!lo.ok) return lo;
    const hi = j < N ? refineEnd(ss[j]!, ss[j + 1]!) : extendContactEnd(distA, ss[N]!, ra1, stepA, tol);
    if (!hi.ok) return hi;
    let dev = 0;
    for (let k = i; k <= j; k++) dev = Math.max(dev, ds[k]!);
    const sA: number[] = [], tB: number[] = [];
    const add = (s: number): Result<void> => {
      if (sA.length > 0 && !(s > sA[sA.length - 1]!)) return ok(undefined);
      const e = evaluateCurve3(A, s);
      if (!e.ok) return e;
      const c = closestDist(B, e.value.point);
      if (!c.ok) return c;
      sA.push(s);
      tB.push(c.value.t);
      dev = Math.max(dev, c.value.d);
      return ok(undefined);
    };
    for (const s of [lo.value, ...ss.slice(i, j + 1).filter((x) => x > lo.value && x < hi.value), hi.value]) {
      const q = add(s);
      if (!q.ok) return q;
    }
    const pieces = overlapPieces(A, B, sA, tB, rangeB, tol, dev);
    return pieces.ok ? ok({ kind: 'overlap', overlaps: pieces.value }) : pieces;
  }
  if (runs.length > 1) return err(refusal(OP, 'tangent contact not resolved'));
  let k = 0;
  for (let i = 1; i <= N; i++) if (ds[i]! < ds[k]!) k = i;
  const r = refinePair(A, B, ss[k]!, ts[k]!, [st.lo, st.hi], rangeB);
  if (!r.ok) return r;
  const [s, t, d] = r.value.dist <= ds[k]! ? [r.value.s, r.value.t, r.value.dist] : [ss[k]!, ts[k]!, ds[k]!];
  if (!(d <= tol)) return err(refusal(OP, 'tangent contact not resolved'));
  const qLo = evaluateCurve3(B, ts[0]!), qHi = evaluateCurve3(B, ts[N]!);
  if (!qLo.ok) return qLo;
  if (!qHi.ok) return qHi;
  const crossing = crossesOver(ps[0]!, qLo.value.point, ps[N]!, qHi.value.point, sinAng);
  const rp = rawPoint(A, B, s, t, crossing ? 'transversal' : 'tangent', 'certified', false);
  return rp.ok ? ok({ kind: 'point', point: rp.value }) : rp;
}

// ---------------------------------------------------------------------------------------------
// Public API.

/**
 * Coplanar circles that are not coincident (center distance or radius difference above `tol`) but
 * so close that they stay within `tol` of each other along a stretch (center distance below
 * `4 √(tol r)` with the radii able to meet): their contact is a tolerance-band question, not a
 * closed-form one, so the certified general solver answers it (overlap / tangent / points).
 */
function nearlyCoincidentCircles(kernel: Kernel, A: CircleCurve, B: CircleCurve): boolean {
  const tol = kernel.tolerances.zoneTol3d;
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  if (!(length3(cross3(A.frame.normal, B.frame.normal)) <= sinTol)) return false;
  const cAB = sub3(B.center, A.center);
  if (Math.abs(dot3(A.frame.normal, cAB)) > tol || Math.abs(dot3(B.frame.normal, cAB)) > tol) return false;
  const d = Math.hypot(dot3(cAB, A.frame.xAxis), dot3(cAB, A.frame.yAxis));
  const dr = Math.abs(A.radius - B.radius);
  if (d <= tol && dr <= tol) return false; // coincident: the closed-form overlap
  return d <= 4 * Math.sqrt(tol * Math.max(A.radius, B.radius)) && dr <= d + 2 * tol;
}

/**
 * Circles in non-parallel planes where A only touches the plane of B (within `tol`,
 * `circlePlaneAngles` returns one tangent angle): the closed form replaces A's two near crossings
 * of that plane by its extreme point, which can lie far (`≈ √(2 r tol)`) from a point where A
 * really meets B, so the certified general solver answers instead.
 */
function circleTouchesOtherPlane(kernel: Kernel, A: CircleCurve, B: CircleCurve): boolean {
  const tol = kernel.tolerances.zoneTol3d;
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  if (length3(cross3(A.frame.normal, B.frame.normal)) <= sinTol) return false;
  const roots = circlePlaneAngles(A.center, A.radius, A.frame.xAxis, A.frame.yAxis, B.center, B.frame.normal, tol);
  return roots === 'overlap' || roots.some((r) => r.tangent);
}

/**
 * Contacts at the curve ends that the closed forms miss: an end of one curve within `tol` of the
 * other (closest point over its range) that is not joined to a reported point by a run of `X`
 * within `tol` of `Y` (eight samples) — e.g. two arcs meeting at a corner whose vertices differ by
 * less than `tol`, so the exact crossing of the full circles lies just beyond the arcs. Reported
 * as `certified`, transversal, not unique.
 */
function endContacts(A: Curve3, B: Curve3, found: readonly RawPoint[], tol: number): Result<RawPoint[]> {
  const out: RawPoint[] = [];
  const joined = (X: Curve3, Y: Curve3, t: number, tf: number): Result<boolean> => {
    for (let k = 0; k <= 8; k++) {
      const e = evaluateCurve3(X, t + ((tf - t) * k) / 8);
      if (!e.ok) return e;
      const c = closestPointOnCurve(Y, e.value.point);
      if (!c.ok) return c;
      if (!(c.value.distance <= tol)) return ok(false);
    }
    return ok(true);
  };
  for (const [X, Y, swap] of [[A, B, false], [B, A, true]] as const) {
    for (const t of curveRange(X)) {
      const e = evaluateCurve3(X, t);
      if (!e.ok) return e;
      let seen = false;
      for (const q of [...found, ...out]) {
        if (length3(sub3(q.point, e.value.point)) <= tol) seen = true;
        else {
          const j = joined(X, Y, t, swap ? q.tB : q.tA);
          if (!j.ok) return j;
          seen = j.value;
        }
        if (seen) break;
      }
      if (seen) continue;
      const c = closestPointOnCurve(Y, e.value.point);
      if (!c.ok) return c;
      if (!(c.value.distance <= tol)) continue;
      const rp = swap ? rawPoint(A, B, c.value.t, t, 'transversal', 'certified', false) : rawPoint(A, B, t, c.value.t, 'transversal', 'certified', false);
      if (!rp.ok) return rp;
      if (rp.value.deviation <= tol) out.push(rp.value);
    }
  }
  return ok(out);
}

function swapHits(res: IntersectionResult<CurveCurveHit>): IntersectionResult<CurveCurveHit> {
  const hits = res.hits.map((h): CurveCurveHit =>
    h.kind === 'point'
      ? Object.freeze({ ...h, tA: h.tB, tB: h.tA })
      : Object.freeze({ ...h, rangeA: h.rangeB, rangeB: h.rangeA }),
  );
  hits.sort((a, b) => (a.kind === 'point' ? a.tA : a.rangeA[0]) - (b.kind === 'point' ? b.tA : b.rangeA[0]));
  return intersectionResult(res.class, hits);
}

/**
 * The intersection of two space curves over their ranges (see the module comment): exact for
 * line/line, line/circle and circle/circle, certified (subdivision with proved exclusion) otherwise.
 * Errors: a NURBS curve that is not 3D; refusals (`refusalReason`) for an unresolved tangency or an
 * exhausted budget (`limits`, optional).
 */
export function intersectCurves(kernel: Kernel, a: Curve3, b: Curve3, limits?: IntersectLimits): Result<IntersectionResult<CurveCurveHit>> {
  const tol = kernel.tolerances.zoneTol3d;
  if (!(tol > 0) || !Number.isFinite(tol)) return invalidInput(OP, 'zone tolerance must be finite and positive');
  for (const c of [a, b]) if (c.kind === 'nurbs' && c.curve.dimension !== 3) return invalidInput(OP, 'NURBS curve must have dimension 3');
  if (a.kind === 'line' && b.kind === 'line') return lineLine(kernel, a, b);
  if (a.kind === 'line' && b.kind === 'circle') {
    const r = lineCircle(kernel, a, b);
    if (!r.ok) return r;
    const e = endContacts(a, b, r.value, tol);
    return e.ok ? finishCurveHits([...r.value, ...e.value], [], a, b, tol, false) : e;
  }
  if (a.kind === 'circle' && b.kind === 'line') {
    const r = intersectCurves(kernel, b, a, limits);
    return r.ok ? ok(swapHits(r.value)) : r;
  }
  if (a.kind === 'circle' && b.kind === 'circle' && !nearlyCoincidentCircles(kernel, a, b) && !circleTouchesOtherPlane(kernel, a, b)) {
    const r = circleCircle(kernel, a, b);
    if (!r.ok) return r;
    const e = r.value.overlaps.length > 0 ? ok([]) : endContacts(a, b, r.value.points, tol);
    return e.ok ? finishCurveHits([...r.value.points, ...e.value], r.value.overlaps, a, b, tol, false) : e;
  }
  const g = solveGeneral(kernel, a, b, limits);
  return g.ok ? finishCurveHits(g.value.points, g.value.overlaps, a, b, tol, true) : g;
}

// ---------------------------------------------------------------------------------------------
// Plane curves (pcurves, profiles).

export interface LineCurve2 {
  readonly kind: 'line';
  readonly origin: Point2;
  readonly direction: Vec2;
  readonly range: ParamRange;
}

/** A circle (arc) `center + r (cos t, sin t)`, `t ∈ range` (counter-clockwise). */
export interface CircleCurve2 {
  readonly kind: 'circle';
  readonly center: Point2;
  readonly radius: number;
  readonly range: ParamRange;
}

export interface NurbsCurve2 {
  readonly kind: 'nurbs';
  /** A NURBS curve of dimension 2 (e.g. a pcurve). */
  readonly curve: NurbsCurve;
}

export type Curve2 = LineCurve2 | CircleCurve2 | NurbsCurve2;

const OP_LIFT = 'intersect.liftCurve2';

/** The plane curve as a space curve in `z = 0` (coordinates copied exactly). */
export function liftCurve2(kernel: Kernel, c: Curve2): Result<Curve3> {
  switch (c.kind) {
    case 'line':
      return createLineCurve(vec3(c.origin.x, c.origin.y, 0), vec3(c.direction.x, c.direction.y, 0), c.range);
    case 'circle':
      return createCircleCurve(kernel, vec3(c.center.x, c.center.y, 0), vec3(0, 0, 1), vec3(1, 0, 0), c.radius, c.range);
    case 'nurbs': {
      if (c.curve.dimension !== 2) return invalidInput(OP_LIFT, 'NURBS curve must have dimension 2');
      const n = createNurbsCurve(c.curve.degree, c.curve.knots, c.curve.controlPoints.map((p) => [p[0]!, p[1]!, 0]), c.curve.weights);
      if (!n.ok) return n;
      return createNurbsCurve3(n.value);
    }
  }
}

/**
 * The intersection of two plane curves (lines, circles, 2D NURBS such as pcurves): lifted to
 * `z = 0` and solved by {@link intersectCurves}; points are returned in 2D.
 */
export function intersectCurves2(
  kernel: Kernel,
  a: Curve2,
  b: Curve2,
  limits?: IntersectLimits,
): Result<IntersectionResult<CurveCurveHit<Point2>>> {
  const la = liftCurve2(kernel, a);
  if (!la.ok) return la;
  const lb = liftCurve2(kernel, b);
  if (!lb.ok) return lb;
  const r = intersectCurves(kernel, la.value, lb.value, limits);
  if (!r.ok) return r.error.operation.startsWith(OP) ? err({ ...r.error, operation: r.error.operation.replace(OP, OP2) }) : r;
  const hits = r.value.hits.map((h): CurveCurveHit<Point2> =>
    h.kind === 'point' ? Object.freeze({ ...h, point: Object.freeze({ x: h.point.x, y: h.point.y }) }) : h,
  );
  return ok(Object.freeze({ class: r.value.class, hits: Object.freeze(hits) }));
}
