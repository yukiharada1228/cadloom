/**
 * The closed-form surface/surface classes that are not coaxial revolutions (those are in
 * `ssi-revolution.ts`), and the dispatcher `intersectSurfacesExact`.
 *
 * - plane/plane: `w = n1 × n2`; parallel (`|w| <= 1e-12` for unit normals) gives nothing or
 *   coincident planes (`|n1·(O2 - O1)| <= zoneTol3d`); otherwise the line through
 *   `P = (d1 (n2 × w) + d2 (w × n1)) / (w·w)` along `w / |w|` (`d_i = n_i·O_i`; Lean
 *   `plane_plane_point_on_first`, `plane_plane_point_on_second`, `plane_plane_dir_orth`).
 * - plane/cylinder, plane parallel to the axis (`|n·Z| <= 1e-12`): `δ = n̂·(A - O)` the signed
 *   distance of the axis; `|δ| > r + zone`: nothing; else the lines `F ± w b + s Z`,
 *   `F = A - δ n̂`, `b = Z × n̂`, `w = √((r - |δ|)(r + |δ|))`, one tangent line when `2w <= zone`.
 *   Oblique: the ellipse about the axis point on the plane `C = A + (n·(O - A) / (n·Z)) Z`, minor
 *   axis `r` along `Z × n`, major axis `r / |n·Z|` along `n × (Z × n)` (docs/ssi.md Figure 3).
 *   Square to the axis: a circle, by the coaxial path.
 * - plane/cone (single nappe, apex `P_a`, nappe axis `Zn`, half-angle `α`, `c = n·Zn`):
 *   through the apex (`|n·(P_a - O)| <= 1e-3 zone`): the generators in the plane, the in-plane unit
 *   vectors `w = (cos α / s) Ẑp ± β m` (`Ẑp` the plane projection of `Zn`, `s = |Zp|`, `m ∥ n × Zn`,
 *   `β = √(1 - cos²α / s²)`): two rays, one tangent ray when they are within the zone over the
 *   patches, only the apex when `cos α > s`; not through the apex with `|c| > sin α` (an ellipse
 *   section): the vertices `V± = P_a + λ± g±` on the two generators `g± = cos α Zn ± sin α ê` of the
 *   symmetry plane, `λ± = -n·(P_a - O) / (n·g±)`, both positive or nothing; center their midpoint,
 *   major radius half their distance, minor radius from the cone equation at the center. Parabola
 *   and hyperbola sections (`|c| <= sin α`, plane not through the apex) have no closed form here:
 *   they go to the general (marching) path, which returns a certified NURBS or refuses.
 * - cylinder/cylinder with parallel, distinct axes: coincident when `D + |r1 - r2| <= zone` (`D`
 *   the axis distance: the surfaces are within the zone everywhere); else the cross-section circles
 *   meet in 0, 1 (tangent) or 2 points (radical line, as sphere/sphere), each a line along the axes.
 * Lines are clipped to the overlap of the patches' certified boxes (rays from the apex too).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md §5 (the table of exact classes, plane/cylinder in detail, WR-510 one
 *   tangent line), solidcore/crates/solidcore/src/surface/plane/p2.rs (`intersect_with_plane`),
 *   solidcore/crates/solidcore/src/surface/cone/p3.rs (`Cone::intersect_with_plane`,
 *   `intersect_with_cone`), solidcore/crates/solidcore/src/surface/surface/p2.rs
 *   (`global_surface_intersect`: special cases first). Rewritten for cadloom; not a translation.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { createEllipseCurve, createLineCurve } from '../curve/types.ts';
import { add3, cross3, dot3, length3, normalize3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import type { ConeSurface, CylinderSurface, PlaneSurface } from '../surface/types.ts';
import { box3Diagonal, lineBoxRange } from '../interval/box.ts';
import { EXACT_ANGLE, finishExact, overlapBox, type RawComponent } from './ssi-common.ts';
import { intersectCoaxial } from './ssi-revolution.ts';
import { checkKernel, checkPatch, type SurfacePatch } from './ssi-types.ts';
import type { SurfaceIntersection } from './types.ts';

/** The plane/plane line point `(d1 (n2 × w) + d2 (w × n1)) / (w·w)`, `w = n1 × n2` (Lean model). */
export function planePlanePoint(n1: Vec3, d1: number, n2: Vec3, d2: number): Point3 {
  const w = cross3(n1, n2);
  const ww = dot3(w, w);
  return scale3(add3(scale3(cross3(n2, w), d1), scale3(cross3(w, n1), d2)), 1 / ww);
}

/** A line component clipped to the patch overlap box (nothing when it misses the box). */
function clippedLine(kernel: Kernel, A: SurfacePatch, B: SurfacePatch, origin: Point3, dir: Vec3, ray: boolean, contact: 'transversal' | 'tangent'): Result<RawComponent | undefined> {
  const box = overlapBox(kernel, A, B);
  if (!box.ok) return box;
  if (box.value === undefined) return ok(undefined);
  const r = lineBoxRange(box.value, origin, dir, ray ? 0 : -Infinity, Infinity);
  // A line that misses the box or only touches it in one point is no component.
  if (r === undefined || !(Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[0] < r[1])) return ok(undefined);
  const line = createLineCurve(origin, dir, [r[0], r[1]]);
  if (!line.ok) return line;
  return ok({ kind: 'curve', curve: line.value, contact, closed: false });
}

function collect(raws: RawComponent[], r: Result<RawComponent | undefined>): Result<void> {
  if (!r.ok) return r;
  if (r.value !== undefined) raws.push(r.value);
  return ok(undefined);
}

function planePlane(kernel: Kernel, A: SurfacePatch, B: SurfacePatch, p: PlaneSurface, q: PlaneSurface): Result<SurfaceIntersection> {
  const n1 = p.frame.normal, n2 = q.frame.normal;
  const w = cross3(n1, n2);
  if (length3(w) <= EXACT_ANGLE) {
    const gap = Math.abs(dot3(n1, sub3(q.origin, p.origin)));
    return finishExact(kernel, A, B, [], gap <= kernel.tolerances.zoneTol3d);
  }
  const P = planePlanePoint(n1, dot3(n1, p.origin), n2, dot3(n2, q.origin));
  const raws: RawComponent[] = [];
  const c = collect(raws, clippedLine(kernel, A, B, P, normalize3(w)!, false, 'transversal'));
  if (!c.ok) return c;
  return finishExact(kernel, A, B, raws, false);
}

function planeCylinder(kernel: Kernel, A: SurfacePatch, B: SurfacePatch, p: PlaneSurface, cyl: CylinderSurface): Result<SurfaceIntersection> {
  const tol = kernel.tolerances.zoneTol3d;
  const n = p.frame.normal, Z = cyl.frame.normal, Ax = cyl.origin, r = cyl.radius;
  const c = dot3(n, Z);
  const raws: RawComponent[] = [];
  if (Math.abs(c) <= EXACT_ANGLE) {
    const nh = normalize3(sub3(n, scale3(Z, c)))!;
    const delta = dot3(nh, sub3(Ax, p.origin));
    if (Math.abs(delta) > r + tol) return finishExact(kernel, A, B, [], false);
    const F = sub3(Ax, scale3(nh, delta));
    const w = Math.sqrt(Math.max(0, (r - Math.abs(delta)) * (r + Math.abs(delta))));
    if (2 * w <= tol) {
      const t = collect(raws, clippedLine(kernel, A, B, F, Z, false, 'tangent'));
      if (!t.ok) return t;
    } else {
      const b = cross3(Z, nh);
      for (const s of [-1, 1]) {
        const t = collect(raws, clippedLine(kernel, A, B, add3(F, scale3(b, s * w)), Z, false, 'transversal'));
        if (!t.ok) return t;
      }
    }
    return finishExact(kernel, A, B, raws, false);
  }
  const C = add3(Ax, scale3(Z, dot3(n, sub3(p.origin, Ax)) / c));
  const m = normalize3(cross3(Z, n))!;
  const M = normalize3(cross3(n, m))!;
  const e = createEllipseCurve(kernel, C, n, M, r / Math.abs(c), r);
  if (!e.ok) return e;
  raws.push({ kind: 'curve', curve: e.value, contact: 'transversal', closed: true });
  return finishExact(kernel, A, B, raws, false);
}

function planeCone(kernel: Kernel, A: SurfacePatch, B: SurfacePatch, p: PlaneSurface, cone: ConeSurface): Result<SurfaceIntersection | undefined> {
  const tol = kernel.tolerances.zoneTol3d;
  const t = Math.tan(cone.semiAngle);
  const Z = cone.frame.normal;
  const apex = add3(cone.origin, scale3(Z, -cone.baseRadius / t));
  const Zn = t > 0 ? Z : scale3(Z, -1);
  const alpha = Math.abs(cone.semiAngle);
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const n = p.frame.normal;
  const c = dot3(n, Zn);
  const delta = dot3(n, sub3(apex, p.origin));
  const raws: RawComponent[] = [];
  if (Math.abs(delta) <= 1e-3 * tol) {
    const Zp = sub3(Zn, scale3(n, c));
    const s = length3(Zp);
    const Zph = scale3(Zp, 1 / s);
    const m = normalize3(cross3(n, Zn))!;
    const a = ca / s;
    const beta2 = 1 - a * a;
    const ov = overlapBox(kernel, A, B);
    if (!ov.ok) return ov;
    const L = ov.value === undefined ? 0 : box3Diagonal(ov.value);
    if (beta2 < 0 && Math.sqrt(-beta2) * L > tol) {
      raws.push({ kind: 'point', point: Object.freeze(apex) });
      return finishExact(kernel, A, B, raws, false);
    }
    const beta = Math.sqrt(Math.max(0, beta2));
    if (2 * beta * L <= tol) {
      const w = normalize3(scale3(Zph, a))!;
      const r = collect(raws, clippedLine(kernel, A, B, apex, w, true, 'tangent'));
      if (!r.ok) return r;
    } else {
      for (const sgn of [-1, 1]) {
        const w = normalize3(add3(scale3(Zph, a), scale3(m, sgn * beta)))!;
        const r = collect(raws, clippedLine(kernel, A, B, apex, w, true, 'transversal'));
        if (!r.ok) return r;
      }
    }
    return finishExact(kernel, A, B, raws, false);
  }
  if (!(Math.abs(c) > sa * (1 + 1e-9))) return ok(undefined); // parabola / hyperbola: no closed form here
  const eh = normalize3(sub3(n, scale3(Zn, c)))!;
  const gp = add3(scale3(Zn, ca), scale3(eh, sa));
  const gm = sub3(scale3(Zn, ca), scale3(eh, sa));
  const lp = -delta / dot3(n, gp);
  const lm = -delta / dot3(n, gm);
  if (!(lp > 0 && lm > 0)) return finishExact(kernel, A, B, [], false);
  const Vp = add3(apex, scale3(gp, lp));
  const Vm = add3(apex, scale3(gm, lm));
  const C = scale3(add3(Vp, Vm), 0.5);
  const major = length3(sub3(Vp, Vm)) / 2;
  const M = normalize3(sub3(Vp, Vm))!;
  const rel = sub3(C, apex);
  const h = dot3(rel, Zn);
  const perp = sub3(rel, scale3(Zn, h));
  const k = sa / ca;
  const minor = Math.min(major, Math.sqrt(Math.max(0, k * k * h * h - dot3(perp, perp))));
  if (!(minor > 0)) return ok(undefined);
  const e = createEllipseCurve(kernel, C, n, M, major, minor);
  if (!e.ok) return e;
  raws.push({ kind: 'curve', curve: e.value, contact: 'transversal', closed: true });
  return finishExact(kernel, A, B, raws, false);
}

function parallelCylinders(kernel: Kernel, A: SurfacePatch, B: SurfacePatch, c1: CylinderSurface, c2: CylinderSurface): Result<SurfaceIntersection> {
  const tol = kernel.tolerances.zoneTol3d;
  const Z = c1.frame.normal;
  const w0 = sub3(c2.origin, c1.origin);
  const q = sub3(w0, scale3(Z, dot3(w0, Z)));
  const D = length3(q);
  const r1 = c1.radius, r2 = c2.radius;
  // Within the zone of each other everywhere: coincident (as the coaxial meridian rule).
  if (D + Math.abs(r1 - r2) <= tol) return finishExact(kernel, A, B, [], true);
  if (D > r1 + r2 + tol || D < Math.abs(r1 - r2) - tol) return finishExact(kernel, A, B, [], false);
  const u = scale3(q, 1 / D);
  const x = (D * D + r1 * r1 - r2 * r2) / (2 * D);
  const h = Math.sqrt(Math.max(0, (r1 - x) * (r1 + x)));
  const F = add3(c1.origin, scale3(u, x));
  const raws: RawComponent[] = [];
  if (2 * h <= tol) {
    const r = collect(raws, clippedLine(kernel, A, B, F, Z, false, 'tangent'));
    if (!r.ok) return r;
  } else {
    const b = cross3(Z, u);
    for (const s of [-1, 1]) {
      const r = collect(raws, clippedLine(kernel, A, B, add3(F, scale3(b, s * h)), Z, false, 'transversal'));
      if (!r.ok) return r;
    }
  }
  return finishExact(kernel, A, B, raws, false);
}

/**
 * The closed-form intersection of two analytic patches when their configuration has one (see
 * this module and `ssi-revolution.ts`), `ok(undefined)` otherwise (NURBS, or a pair whose curve is
 * not a line or a conic: those take the general path).
 */
export function intersectSurfacesExact(kernel: Kernel, A: SurfacePatch, B: SurfacePatch): Result<SurfaceIntersection | undefined> {
  const ck = checkKernel(kernel);
  if (!ck.ok) return ck;
  const pa = checkPatch(A);
  if (!pa.ok) return pa;
  const pb = checkPatch(B);
  if (!pb.ok) return pb;
  const a = A.surface, b = B.surface;
  if (a.kind === 'nurbs' || b.kind === 'nurbs') return ok(undefined);
  if (a.kind === 'plane' && b.kind === 'plane') return planePlane(kernel, A, B, a, b);
  const co = intersectCoaxial(kernel, A, B);
  if (!co.ok || co.value !== undefined) return co;
  if (a.kind === 'plane' && b.kind === 'cylinder') return planeCylinder(kernel, A, B, a, b);
  if (a.kind === 'cylinder' && b.kind === 'plane') return planeCylinder(kernel, A, B, b, a);
  if (a.kind === 'plane' && b.kind === 'cone') return planeCone(kernel, A, B, a, b);
  if (a.kind === 'cone' && b.kind === 'plane') return planeCone(kernel, A, B, b, a);
  if (a.kind === 'cylinder' && b.kind === 'cylinder' && length3(cross3(a.frame.normal, b.frame.normal)) <= EXACT_ANGLE) {
    return parallelCylinders(kernel, A, B, a, b);
  }
  return ok(undefined);
}
