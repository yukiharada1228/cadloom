/**
 * Surface/surface intersection (SSI): patches, results and options.
 *
 * A surface/surface answer is one of the three classes of `types.ts` (shared with the curve
 * intersectors): **exact** (a closed form decided the number and kind of the components: plane
 * sections of quadrics, coaxial surfaces of revolution, parallel cylinders), **certified** (the
 * general path: components found by a subdivision that drops pairs only by proof, each traced by
 * Newton-corrected marching and fitted with a cubic B-spline whose deviation from both surfaces was
 * measured), or **refused** (a `Result` error made by `refusal`, whose operation names the reason,
 * e.g. `'intersect.surfaceSurface: tangent contact not resolved'`). A result never silently carries
 * a wrong number of components.
 *
 * The result types (`SurfaceIntersection`, `SurfaceSurfaceCurve`, ...) live with the other M4
 * result types in `types.ts`; this file holds the inputs (patches, options) and their checks.
 *
 * Inputs are **patches**: a surface and a closed parameter box. Analytic surfaces are unbounded
 * (plane, cylinder, cone in `v`), so the box bounds the search and the extent of reported lines.
 * Closed-form components are reported on the whole analytic surfaces (full circles and ellipses,
 * lines clipped to the overlap of the two patches' certified bounding boxes) and are dropped only
 * when their box is proved disjoint from a patch box; trimming them to the parameter boxes is the
 * face classification's job (upstream `face_intersect`, docs/ssi.md §4.6). Marched components lie
 * inside both boxes.
 *
 * Orientation: every curve runs along `n_A × n_B` (the parametric unit normals `S_u × S_v` of A
 * and B) where that is defined; closed-form conics run counter-clockwise about their frame normal.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md (§1 the one rule, §4.6 what the boolean takes, §5 the exact classes,
 *   §6 certification), solidcore/crates/solidcore/src/intersect/surface_intersector.rs
 *   (`TsectCurveType`, curves with deviations and both UV curves), solidcore/crates/ssi/src/lib.rs
 *   (refusals by name), solidcore/crates/solidcore-ssi/src/curves.rs (one knot vector for the 3D
 *   and both UV curves). Rewritten for cadloom; not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { ROUNDING_SLACK } from '../curve/types.ts';
import type { Point3 } from '../math/vec.ts';
import { surfaceDomain } from '../nurbs/surface.ts';
import type { Surface3 } from '../surface/types.ts';
import type { IntersectionClass, SurfaceIntersection, SurfaceSurfaceHit } from './types.ts';

/** A closed parameter box `u ∈ [u0, u1]`, `v ∈ [v0, v1]`. */
export interface ParamDomain {
  readonly u: readonly [number, number];
  readonly v: readonly [number, number];
}

/** A surface restricted to a parameter box. */
export interface SurfacePatch {
  readonly surface: Surface3;
  readonly domain: ParamDomain;
}

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

function checkRange(op: string, what: string, r: readonly [number, number]): Result<readonly [number, number]> {
  const [a, b] = r;
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(a < b) || !Number.isFinite(b - a)) {
    return invalidInput(op, `${what} range must be finite with start < end`);
  }
  return ok(Object.freeze([a, b] as const));
}

/**
 * A patch of `surface` over `domain`. A NURBS surface defaults to (and must lie in) its knot
 * domain; a sphere defaults to `[0, 2π] × [-π/2, π/2]` and a torus to `[0, 2π]²`; a plane, cylinder
 * or cone needs an explicit domain (it is unbounded). A sphere's `v` must lie in `[-π/2, π/2]`,
 * angular ranges span at most `2π`, and a cone's `v` must stay on its nappe (`R(v) >= 0`).
 */
export function surfacePatch(surface: Surface3, domain?: ParamDomain): Result<SurfacePatch> {
  const op = 'intersect.surfacePatch';
  let d = domain;
  if (d === undefined) {
    switch (surface.kind) {
      case 'nurbs':
        d = surfaceDomain(surface.surface);
        break;
      case 'sphere':
        d = { u: [0, TWO_PI], v: [-HALF_PI, HALF_PI] };
        break;
      case 'torus':
        d = { u: [0, TWO_PI], v: [0, TWO_PI] };
        break;
      default:
        return invalidInput(op, `a ${surface.kind} is unbounded: give a parameter domain`);
    }
  }
  const u = checkRange(op, 'u', d.u);
  if (!u.ok) return u;
  const v = checkRange(op, 'v', d.v);
  if (!v.ok) return v;
  const slack = 1 + ROUNDING_SLACK;
  if (surface.kind === 'nurbs') {
    const k = surfaceDomain(surface.surface);
    if (u.value[0] < k.u[0] || u.value[1] > k.u[1] || v.value[0] < k.v[0] || v.value[1] > k.v[1]) {
      return invalidInput(op, 'domain must lie in the knot domain');
    }
  } else {
    const angularU = surface.kind !== 'plane';
    if (angularU && u.value[1] - u.value[0] > TWO_PI * slack) return invalidInput(op, 'u range exceeds 2π');
    if (surface.kind === 'torus' && v.value[1] - v.value[0] > TWO_PI * slack) return invalidInput(op, 'v range exceeds 2π');
    if (surface.kind === 'sphere' && (v.value[0] < -HALF_PI * slack || v.value[1] > HALF_PI * slack)) {
      return invalidInput(op, 'sphere latitude range must lie in [-π/2, π/2]');
    }
    if (surface.kind === 'cone') {
      const t = Math.tan(surface.semiAngle);
      const slackR = ROUNDING_SLACK * Math.max(1, surface.baseRadius);
      if (surface.baseRadius + t * v.value[0] < -slackR || surface.baseRadius + t * v.value[1] < -slackR) {
        return invalidInput(op, 'cone v range must stay on the nappe (R(v) >= 0)');
      }
    }
  }
  return ok(Object.freeze({ surface, domain: Object.freeze({ u: u.value, v: v.value }) }));
}

/**
 * Re-validates a patch given as a plain object (the public functions accept any `SurfacePatch`,
 * not only one made by `surfacePatch`): the same checks as `surfacePatch`.
 */
export function checkPatch(p: SurfacePatch): Result<SurfacePatch> {
  return surfacePatch(p.surface, p.domain);
}

/** Budgets and step limits of the general path (all bounded: the computation is deterministic). */
export interface SsiOptions {
  /** Maximum patch pairs examined by the subdivision (a positive integer, default 60000). */
  readonly maxPairs?: number;
  /** Maximum subdivision depth (one patch halved per level, a positive integer, default 64). */
  readonly maxDepth?: number;
  /** Maximum points per marched branch (a positive integer, default 1500). */
  readonly maxBranchPoints?: number;
  /**
   * Largest tangent turn per marching step, radians, in `(0, 0.5]` (default 0.05). Larger turns let
   * a step jump past a loop's start or another branch, so they are rejected.
   */
  readonly maxTurn?: number;
  /** Skip the closed forms (tests use this to march pairs that have one). */
  readonly forceMarching?: boolean;
}

/** The kernel tolerances the surface/surface code reads must be positive and finite. */
export function checkKernel(kernel: Kernel): Result<Kernel> {
  const { zoneTol3d, xsectTol3d, approxTol3d } = kernel.tolerances;
  if (!(zoneTol3d > 0 && xsectTol3d > 0 && approxTol3d > 0 && Number.isFinite(zoneTol3d + xsectTol3d + approxTol3d))) {
    return invalidInput('intersect.surfaceSurface', 'the kernel tolerances must be positive and finite');
  }
  return ok(kernel);
}

/** Validates `options` (see `SsiOptions`). */
export function checkOptions(options: SsiOptions): Result<SsiOptions> {
  const op = 'intersect.surfaceSurface';
  for (const key of ['maxPairs', 'maxDepth', 'maxBranchPoints'] as const) {
    const x = options[key];
    if (x !== undefined && !(Number.isSafeInteger(x) && x > 0)) return invalidInput(op, `${key} must be a positive integer`);
  }
  const t = options.maxTurn;
  if (t !== undefined && !(t > 0 && t <= 0.5)) return invalidInput(op, 'maxTurn must lie in (0, 0.5]');
  return ok(options);
}

/** Frozen result helper. */
export function surfaceIntersection(
  cls: IntersectionClass,
  hits: readonly SurfaceSurfaceHit[],
  coincident: boolean,
  method: 'closed-form' | 'marching',
): SurfaceIntersection {
  return Object.freeze({ class: cls, hits: Object.freeze(sortHits(hits)), coincident, method });
}

function keyPoint(h: SurfaceSurfaceHit): Point3 {
  if (h.kind === 'point') return h.point;
  if (h.polyline !== undefined) return h.polyline.points[0]!;
  const c = h.curve;
  switch (c.kind) {
    case 'line':
      return { x: c.origin.x + c.range[0] * c.direction.x, y: c.origin.y + c.range[0] * c.direction.y, z: c.origin.z + c.range[0] * c.direction.z };
    case 'circle':
    case 'ellipse':
      return c.center;
    case 'nurbs': {
      const p = c.curve.controlPoints[0]!;
      return { x: p[0]!, y: p[1]!, z: p[2]! };
    }
  }
}

/** Deterministic order: curves before points, then by the key point lexicographically (x, y, z). */
export function sortHits(hits: readonly SurfaceSurfaceHit[]): SurfaceSurfaceHit[] {
  const decorated = hits.map((h, i) => ({ h, i, k: keyPoint(h) }));
  decorated.sort((p, q) => {
    if (p.h.kind !== q.h.kind) return p.h.kind === 'curve' ? -1 : 1;
    return p.k.x - q.k.x || p.k.y - q.k.y || p.k.z - q.k.z || p.i - q.i;
  });
  return decorated.map((d) => d.h);
}
