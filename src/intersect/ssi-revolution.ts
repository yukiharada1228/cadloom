/**
 * Closed forms for surfaces of revolution about one common axis: the intersection of two such
 * surfaces is a union of circles about the axis (and points on it), found by intersecting their
 * **meridians** in the half-plane `(ρ, z)`, `ρ >= 0` (distance from the axis, height along it).
 *
 * With the common axis through `A` along the unit `Z` (`z = (p - A)·Z`), the meridians are:
 * - plane square to the axis: the ray `z = h`, `ρ >= 0`, `h = (O - A)·Z` (any plane meets its
 *   normal line square to it, so a plane and a sphere always share an axis: the line through the
 *   center along the plane normal);
 * - cylinder: the line `ρ = r`;
 * - cone: the ray from the apex `(0, z_a)` along `(sin|α|, σ cos|α|)`, `σ` the side of the nappe
 *   (single nappe, see src/surface/types.ts);
 * - sphere: the circle about `(0, (c - A)·Z)` of radius `r` (any line through the center is an axis);
 * - torus: the circle about `(R, (c - A)·Z)` of radius `r`.
 * Pairs: plane ⟂ axis with a cylinder, cone, sphere or torus; any two of cylinder, cone, sphere,
 * torus sharing the axis (a sphere: its center on the other's axis); two spheres (axis through
 * both centers).
 *
 * Meridian intersections (line/line, line/circle, circle/circle in 2D): each crossing at `ρ > zone`
 * is a circle of radius `ρ` at height `z` (transversal), a double root is a circle along which the
 * surfaces are tangent, and a root on the axis (`ρ <= zone`) is an isolated contact point (a touch
 * or the apex). Two roots closer than `zoneTol3d` are one double root (the rule of the whole
 * module: components within the zone tolerance are one). Identical meridians — or meridians within
 * the zone of each other everywhere (lines: carriers within the zone; circles: `D + |r1 - r2| <= zone`)
 * — are coincident surfaces. The circle/circle case is the radical plane: `x = (D² + r1² - r2²) / (2D)`,
 * `h² = (r1 - x)(r1 + x)` (Lean `sphere_sphere_on_both`); the plane/sphere case is
 * `c' = c - ((n·c - d)/(n·n)) n`, `ρ² = r² - dist²` (Lean `plane_sphere_center_on_plane`,
 * `plane_sphere_circle_on_sphere`), computed as `(r - |dist|)(r + |dist|)`; a plane square to a
 * cylinder gives the circle about `A + h Z` of radius `r` (Lean `plane_cylinder_perp_on_both`).
 *
 * Coaxiality is decided with a rounding-level slack (directions parallel to `1e-12`, axis points
 * within `1e-3 zoneTol3d`); a pair just outside it takes the general (marching) path.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md §5 (plane/sphere √((R - |d|)(R + |d|)), sphere/sphere, sphere/cone with
 *   the centre on the axis, revolution/revolution "circles at the generators' intersections",
 *   plane/torus square to the axis), solidcore/crates/solidcore/src/surface/sphere.rs
 *   (`intersect_with_plane`, `intersect_with_sphere`), surface/surf_of_revolution/p3.rs,
 *   solidcore/crates/ssi/src/quadric.rs. Rewritten for cadloom; not a translation.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createCircleCurve } from '../curve/types.ts';
import { add3, cross3, dot3, length3, normalize3, scale3, sub3, vec3, type Point3, type Vec3 } from '../math/vec.ts';
import type { Surface3 } from '../surface/types.ts';
import { distanceToAxis, EXACT_ANGLE, finishExact, type RawComponent } from './ssi-common.ts';
import type { SurfacePatch } from './ssi-types.ts';
import type { SurfaceIntersection } from './types.ts';

/** A meridian in the `(ρ, z)` half-plane. */
type Meridian =
  | { readonly kind: 'line'; readonly p: readonly [number, number]; readonly d: readonly [number, number]; readonly ray: boolean }
  | { readonly kind: 'circle'; readonly c: readonly [number, number]; readonly r: number };

interface Axis {
  readonly point: Point3;
  readonly dir: Vec3;
}

interface MeridianRoot {
  readonly rho: number;
  readonly z: number;
  readonly tangent: boolean;
}

type MeridianMeet = { readonly coincident: true } | { readonly coincident: false; readonly roots: readonly MeridianRoot[] };

const parallel = (a: Vec3, b: Vec3): boolean => length3(cross3(a, b)) <= EXACT_ANGLE;

/** The meridian of `s` about `axis`, or `undefined` when `s` is not a surface of revolution about it. */
function meridianOf(kernel: Kernel, s: Surface3, axis: Axis): Meridian | undefined {
  const posTol = 1e-3 * kernel.tolerances.zoneTol3d;
  const Z = axis.dir;
  const zOf = (p: Point3): number => dot3(sub3(p, axis.point), Z);
  switch (s.kind) {
    case 'plane':
      if (!parallel(s.frame.normal, Z)) return undefined;
      return { kind: 'line', p: [0, zOf(s.origin)], d: [1, 0], ray: true };
    case 'cylinder':
      if (!parallel(s.frame.normal, Z) || distanceToAxis(s.origin, axis.point, Z) > posTol) return undefined;
      return { kind: 'line', p: [s.radius, zOf(s.origin)], d: [0, 1], ray: false };
    case 'cone': {
      if (!parallel(s.frame.normal, Z) || distanceToAxis(s.origin, axis.point, Z) > posTol) return undefined;
      const t = Math.tan(s.semiAngle);
      const along = dot3(s.frame.normal, Z) > 0 ? 1 : -1;
      const za = zOf(s.origin) + along * (-s.baseRadius / t);
      const sigma = Math.sign(t) * along;
      const a = Math.abs(s.semiAngle);
      return { kind: 'line', p: [0, za], d: [Math.sin(a), sigma * Math.cos(a)], ray: true };
    }
    case 'sphere':
      if (distanceToAxis(s.center, axis.point, Z) > posTol) return undefined;
      return { kind: 'circle', c: [0, zOf(s.center)], r: s.radius };
    case 'torus':
      if (!parallel(s.frame.normal, Z) || distanceToAxis(s.center, axis.point, Z) > posTol) return undefined;
      return { kind: 'circle', c: [s.majorRadius, zOf(s.center)], r: s.minorRadius };
    case 'nurbs':
      return undefined;
  }
}

const isRevolution = (s: Surface3): boolean => s.kind === 'cylinder' || s.kind === 'cone' || s.kind === 'torus';

/** The common axis candidate of a pair (see the module comment), or `undefined`. */
function axisFor(a: Surface3, b: Surface3): Axis | undefined {
  for (const s of [a, b]) {
    if (isRevolution(s) && s.kind !== 'nurbs' && s.kind !== 'plane' && s.kind !== 'sphere') {
      return { point: s.kind === 'torus' ? s.center : s.origin, dir: s.frame.normal };
    }
  }
  if (a.kind === 'sphere' && b.kind === 'sphere') {
    const d = normalize3(sub3(b.center, a.center));
    return { point: a.center, dir: d ?? a.frame.normal };
  }
  if (a.kind === 'plane' && b.kind === 'sphere') return { point: b.center, dir: a.frame.normal };
  if (a.kind === 'sphere' && b.kind === 'plane') return { point: a.center, dir: b.frame.normal };
  return undefined;
}

const cross2 = (a: readonly [number, number], b: readonly [number, number]): number => a[0] * b[1] - a[1] * b[0];

/** Roots of a line/line meet in the half plane. */
function lineLine(m1: Extract<Meridian, { kind: 'line' }>, m2: Extract<Meridian, { kind: 'line' }>, tol: number): MeridianMeet {
  const w: [number, number] = [m2.p[0] - m1.p[0], m2.p[1] - m1.p[1]];
  const c = cross2(m1.d, m2.d);
  if (Math.abs(c) <= EXACT_ANGLE) {
    // Parallel: coincident carriers or nothing (two rays on one carrier overlap when they point
    // the same way; a full line overlaps anything on its carrier).
    if (Math.abs(cross2(w, m1.d)) > tol) return { coincident: false, roots: [] };
    const same = m1.d[0] * m2.d[0] + m1.d[1] * m2.d[1] > 0;
    if (!m1.ray || !m2.ray || same) return { coincident: true };
    // Opposite rays on one carrier meet in a segment between their origins, or a point.
    const gap = w[0] * m1.d[0] + w[1] * m1.d[1];
    if (gap > tol) return { coincident: true };
    if (gap >= -tol) return { coincident: false, roots: [{ rho: m1.p[0], z: m1.p[1], tangent: true }] };
    return { coincident: false, roots: [] };
  }
  const lam = cross2(w, m2.d) / c;
  const mu = cross2(w, m1.d) / c;
  if ((m1.ray && lam < -tol) || (m2.ray && mu < -tol)) return { coincident: false, roots: [] };
  return { coincident: false, roots: [{ rho: m1.p[0] + lam * m1.d[0], z: m1.p[1] + lam * m1.d[1], tangent: false }] };
}

function lineCircle(m: Extract<Meridian, { kind: 'line' }>, c: Extract<Meridian, { kind: 'circle' }>, tol: number): MeridianMeet {
  const lamF = (c.c[0] - m.p[0]) * m.d[0] + (c.c[1] - m.p[1]) * m.d[1];
  const f: [number, number] = [m.p[0] + lamF * m.d[0], m.p[1] + lamF * m.d[1]];
  const delta = Math.hypot(f[0] - c.c[0], f[1] - c.c[1]);
  if (delta > c.r + tol) return { coincident: false, roots: [] };
  const half = Math.sqrt(Math.max(0, (c.r - delta) * (c.r + delta)));
  const cands: { lam: number; tangent: boolean }[] =
    2 * half <= tol ? [{ lam: lamF, tangent: true }] : [{ lam: lamF - half, tangent: false }, { lam: lamF + half, tangent: false }];
  const roots: MeridianRoot[] = [];
  for (const { lam, tangent } of cands) {
    if (m.ray && lam < -tol) continue;
    roots.push({ rho: m.p[0] + lam * m.d[0], z: m.p[1] + lam * m.d[1], tangent });
  }
  return { coincident: false, roots };
}

function circleCircle(a: Extract<Meridian, { kind: 'circle' }>, b: Extract<Meridian, { kind: 'circle' }>, tol: number): MeridianMeet {
  const dx = b.c[0] - a.c[0], dz = b.c[1] - a.c[1];
  const D = Math.hypot(dx, dz);
  // Circles within the zone of each other everywhere (`D + |r1 - r2| <= zone`, the line/line rule:
  // carriers within the zone are one) are coincident, not two circles crossing at a tiny angle.
  if (D + Math.abs(a.r - b.r) <= tol) return { coincident: true };
  if (D <= 1e-3 * tol) return { coincident: false, roots: [] };
  if (D > a.r + b.r + tol || D < Math.abs(a.r - b.r) - tol) return { coincident: false, roots: [] };
  const x = (D * D + a.r * a.r - b.r * b.r) / (2 * D);
  const h = Math.sqrt(Math.max(0, (a.r - x) * (a.r + x)));
  const ux = dx / D, uz = dz / D;
  const fx = a.c[0] + x * ux, fz = a.c[1] + x * uz;
  if (2 * h <= tol) return { coincident: false, roots: [{ rho: fx, z: fz, tangent: true }] };
  // The perpendicular (-uz, ux).
  return {
    coincident: false,
    roots: [
      { rho: fx - h * uz, z: fz + h * ux, tangent: false },
      { rho: fx + h * uz, z: fz - h * ux, tangent: false },
    ],
  };
}

function meet(m1: Meridian, m2: Meridian, tol: number): MeridianMeet {
  if (m1.kind === 'line' && m2.kind === 'line') return lineLine(m1, m2, tol);
  if (m1.kind === 'line' && m2.kind === 'circle') return lineCircle(m1, m2, tol);
  if (m1.kind === 'circle' && m2.kind === 'line') return lineCircle(m2, m1, tol);
  return circleCircle(m1 as Extract<Meridian, { kind: 'circle' }>, m2 as Extract<Meridian, { kind: 'circle' }>, tol);
}

/** A reference x direction for circles about `z`: the surfaces' x axes, the least parallel one. */
function xReference(a: Surface3, b: Surface3, z: Vec3): Vec3 {
  const cands: Vec3[] = [];
  for (const s of [a, b]) {
    if (s.kind === 'nurbs') continue;
    if (isRevolution(s) && parallel(s.frame.normal, z)) return s.frame.xAxis;
    cands.push(s.frame.xAxis, s.frame.yAxis, s.frame.normal);
  }
  cands.push(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1));
  let best = cands[0]!;
  for (const c of cands) if (Math.abs(dot3(c, z)) < Math.abs(dot3(best, z))) best = c;
  return best;
}

/**
 * The closed form for a coaxial pair (see the module comment), or `undefined` when the pair has
 * no common axis.
 */
export function intersectCoaxial(kernel: Kernel, A: SurfacePatch, B: SurfacePatch): Result<SurfaceIntersection | undefined> {
  const a = A.surface, b = B.surface;
  if (a.kind === 'plane' && b.kind === 'plane') return ok(undefined);
  const axis = axisFor(a, b);
  if (axis === undefined) return ok(undefined);
  const ma = meridianOf(kernel, a, axis);
  const mb = meridianOf(kernel, b, axis);
  if (ma === undefined || mb === undefined) return ok(undefined);
  const tol = kernel.tolerances.zoneTol3d;
  const m = meet(ma, mb, tol);
  if (m.coincident) return finishExact(kernel, A, B, [], true);
  const raws: RawComponent[] = [];
  const Z = axis.dir;
  const xRef = xReference(a, b, Z);
  for (const root of m.roots) {
    if (root.rho < -tol) continue;
    const center = add3(axis.point, scale3(Z, root.z));
    if (root.rho <= tol) {
      // Two roots `±h` with `h <= zone` (a circle of diameter up to `2 zone` about the axis whose
      // mirror root survived the `-zone` slack) are one contact point on the axis, not two.
      const same = raws.some((r) => r.kind === 'point' && length3(sub3(r.point, center)) <= tol);
      if (!same) raws.push({ kind: 'point', point: Object.freeze(center) });
      continue;
    }
    const circle = createCircleCurve(kernel, center, Z, xRef, root.rho);
    if (!circle.ok) return circle;
    raws.push({ kind: 'curve', curve: circle.value, contact: root.tangent ? 'tangent' : 'transversal', closed: true });
  }
  return finishExact(kernel, A, B, raws, false);
}
