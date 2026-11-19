/**
 * Shared result types of the M4 intersection code (curve/curve, curve/surface and surface/surface).
 *
 * Every intersection result says which of three classes it is (upstream `docs/ssi.md` §1, "the one
 * rule", and `docs/definitions-and-certificates.md`):
 *
 * - **exact** — the answer comes from a closed form (line/line by dyadic Cramer's rule, line/plane,
 *   line/quadric by a quadratic with its discriminant classified, coplanar circles, ...). The
 *   number and kind of the components are decided by the closed form; the reported doubles are the
 *   closed form evaluated in floating point, and `deviation` still measures them against the inputs.
 * - **certified** — the components were found by a search that drops a region only by proof
 *   (disjoint certified boxes, `src/interval`), and each reported point is a Newton root whose
 *   `deviation` (the measured distance from the reported point to each input at its parameters) is
 *   given. `unique` says whether an interval Newton / Krawczyk test proved that the parameter box
 *   around the root holds exactly one root of the intersection system.
 * - **refused** — not a value: the function returns a `Result` error whose `operation` names the
 *   reason (see {@link refuse}). A result never silently carries a wrong number of components:
 *   tangential contacts are flagged (`contact: 'tangent'`), coincident stretches are overlaps, and a
 *   contact that cannot be classified is refused.
 *
 * Parameters are always inside the input domains (curve ranges / knot domains, surface parameter
 * boxes). Results are frozen and listed in a deterministic order (by the first curve's parameter).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/api_intersectors.rs (`CurveIntersections`,
 *   `CurveHits`: points plus overlap ranges, an overlap reported as a parameter range),
 *   solidcore/crates/solidcore/src/geom/solution_array.rs (single value vs range of values),
 *   solidcore/docs/ssi.md §1 (exact / certified / refused by name), §8 (invariants),
 *   solidcore/docs/definitions-and-certificates.md (what "certified" means). Rewritten for
 *   cadloom; not a translation.
 */
import type { SolidError } from '../core/error.ts';
import type { Curve3 } from '../curve/types.ts';
import type { Point2, Point3 } from '../math/vec.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';

/** How a component was obtained: by closed form, or by a proof-pruned search plus measured deviation. */
export type IntersectionClass = 'exact' | 'certified';

/**
 * The local kind of a point contact: `transversal` (the inputs cross; the Jacobian of the
 * intersection system is well conditioned there) or `tangent` (a double root: the inputs touch,
 * e.g. a line tangent to a circle, or the minimum of the distance function is a touch). A tangent
 * point is one component, never two.
 */
export type ContactKind = 'transversal' | 'tangent';

/** A closed parameter interval `[t0, t1]`, `t0 <= t1`. */
export type ParamRange = readonly [number, number];

/** A surface parameter pair. */
export interface SurfaceParam {
  readonly u: number;
  readonly v: number;
}

/** What every reported component carries. */
export interface Certificate {
  readonly class: IntersectionClass;
  /**
   * The measured maximum distance between the reported geometry and each input at the reported
   * parameters (model units). For an exact component it is the floating-point residue of the closed
   * form; for a certified one it is the deviation the certificate states.
   */
  readonly deviation: number;
}

/** An isolated intersection point of two curves (3D, or 2D for pcurves): `C_A(tA) ≈ C_B(tB) ≈ point`. */
export interface CurveCurvePoint<P extends Point2 = Point3> extends Certificate {
  readonly kind: 'point';
  readonly tA: number;
  readonly tB: number;
  readonly point: P;
  readonly contact: ContactKind;
  /** A closed form or an interval Newton / Krawczyk test proved the root is the only one near it. */
  readonly unique: boolean;
}

/** A coincident stretch of two curves: `C_A([tA0, tA1])` and `C_B(rangeB)` are the same point set. */
export interface CurveCurveOverlap extends Certificate {
  readonly kind: 'overlap';
  readonly rangeA: ParamRange;
  /** The matching range on B, ordered `lo <= hi`; `sameDirection` says whether B runs with A. */
  readonly rangeB: ParamRange;
  readonly sameDirection: boolean;
}

export type CurveCurveHit<P extends Point2 = Point3> = CurveCurvePoint<P> | CurveCurveOverlap;

/** A point where a curve meets a surface: `C(t) ≈ S(u, v) ≈ point`. */
export interface CurveSurfacePoint extends Certificate {
  readonly kind: 'point';
  readonly t: number;
  readonly u: number;
  readonly v: number;
  readonly point: Point3;
  readonly contact: ContactKind;
  readonly unique: boolean;
}

/** A stretch of the curve lying on the surface (a line in a plane, a ruling of a cylinder or cone). */
export interface CurveSurfaceOverlap extends Certificate {
  readonly kind: 'overlap';
  readonly range: ParamRange;
  /** Surface parameters at `range[0]` and `range[1]`. */
  readonly start: SurfaceParam;
  readonly end: SurfaceParam;
}

export type CurveSurfaceHit = CurveSurfacePoint | CurveSurfaceOverlap;

/**
 * A whole intersection answer. `class` is `exact` iff every hit is exact and the component count
 * itself was decided by a closed form (an empty exact result is a proof of no intersection); a
 * certified answer's emptiness is proved by the exclusion search.
 */
export interface IntersectionResult<H> {
  readonly class: IntersectionClass;
  readonly hits: readonly H[];
}

/** A marched branch as sampled: 3D points and both surfaces' parameters (periodic angles unwrapped). */
export interface SsiPolyline {
  readonly points: readonly Point3[];
  readonly uvA: readonly Point2[];
  readonly uvB: readonly Point2[];
}

/**
 * An intersection curve. `curve` is exact (line / circle / ellipse) for the closed forms and a
 * fitted cubic B-spline (knot domain `[0, 1]`, chord-length parameter) for marched branches.
 * `pcurveA` / `pcurveB` are 2D NURBS curves in the parameters of A / B whose lift runs along
 * `curve` (present where a closed form exists or the branch was marched; a marched branch's
 * pcurves share the 3D curve's knot vector and parameter). Periodic angles in pcurves are
 * unwrapped (they may leave `[0, 2π]` by whole periods). `contact` is `tangent` when the surfaces
 * are tangent along the whole curve (a plane on a cylinder's ruling, a sphere inscribed in a
 * cylinder). `deviation` (the certificate) is the largest measured distance from `curve` to either
 * surface; `pcurveDeviation` the largest measured `|S(pcurve(t)) - curve(t)|`.
 */
export interface SurfaceSurfaceCurve extends Certificate {
  readonly kind: 'curve';
  readonly curve: Curve3;
  readonly pcurveA?: NurbsCurve;
  readonly pcurveB?: NurbsCurve;
  readonly contact: ContactKind;
  readonly closed: boolean;
  /** Marched branches only: the Newton points the curve interpolates. */
  readonly polyline?: SsiPolyline;
  readonly pcurveDeviation?: number;
}

/** An isolated intersection point (a touch point, or the apex of a cone hit by a plane). */
export interface SurfaceSurfacePoint extends Certificate {
  readonly kind: 'point';
  readonly point: Point3;
  readonly a: SurfaceParam;
  readonly b: SurfaceParam;
  readonly contact: ContactKind;
}

export type SurfaceSurfaceHit = SurfaceSurfaceCurve | SurfaceSurfacePoint;

/**
 * The answer of `intersectSurfaces`. `coincident` is true when the two surfaces are the same
 * surface (coincident planes, equal coaxial cylinders or spheres, equal coaxial surfaces of
 * revolution): then `hits` is empty and the region boundary is the faces' business (upstream
 * `TsectCurveType::RegionBoundary`, decided by the boolean before SSI). `method` says which path
 * produced it.
 */
export interface SurfaceIntersection extends IntersectionResult<SurfaceSurfaceHit> {
  readonly coincident: boolean;
  readonly method: 'closed-form' | 'marching';
}

/** `exact` iff all are `exact`. */
export function combineClass(classes: Iterable<IntersectionClass>): IntersectionClass {
  for (const c of classes) if (c === 'certified') return 'certified';
  return 'exact';
}

/** Freezes the hits (in the given order) into a result of class `cls`. */
export function intersectionResult<H>(cls: IntersectionClass, hits: readonly H[]): IntersectionResult<H> {
  return Object.freeze({ class: cls, hits: Object.freeze([...hits]) });
}

/** Why an intersection was refused (the `operation` of the error names it). */
export type RefusalReason =
  | 'tangent contact not resolved'
  | 'subdivision budget exceeded'
  | 'recursion depth exceeded'
  | 'newton did not converge'
  | 'degenerate input'
  | 'precision exhausted';

/**
 * A refusal: a `not-converged` error whose `operation` is `"<op>: <reason>"`, so the reason is
 * machine-readable (`refusalReason`) and the caller never mistakes it for an empty answer.
 */
export function refusal(op: string, reason: RefusalReason, iterations = 0): SolidError {
  return { kind: 'not-converged', operation: `${op}: ${reason}`, iterations };
}

/** The refusal reason of an error made by {@link refusal}, or `undefined`. */
export function refusalReason(error: SolidError): RefusalReason | undefined {
  if (error.kind !== 'not-converged') return undefined;
  const i = error.operation.indexOf(': ');
  if (i < 0) return undefined;
  const r = error.operation.slice(i + 2);
  const reasons: readonly RefusalReason[] = [
    'tangent contact not resolved',
    'subdivision budget exceeded',
    'recursion depth exceeded',
    'newton did not converge',
    'degenerate input',
    'precision exhausted',
  ];
  return reasons.find((x) => x === r);
}
