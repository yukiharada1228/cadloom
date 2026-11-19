/**
 * Boundary seeds of the general surface/surface path: every point where an intersection branch
 * crosses a patch's domain boundary, found by the **curve/surface intersector** (`curve-surface.ts`,
 * one job, one place) between each non-periodic, non-degenerate boundary iso-curve of one patch and
 * the other surface (docs/ssi.md §4.2 "start points on the boundaries").
 *
 * Why not only the subdivision leaves: one Newton start per leaf side finds one crossing per side,
 * so two short arcs dipping into a patch through the same leaf side (both well within one leaf)
 * left the second arc untraced, and the coverage test then took the leaf as explained by the first
 * (found in the M4 adversarial review). Every open branch ends on a domain boundary, so the
 * curve/surface search — which isolates each crossing (Krawczyk / monotonicity) or refuses — gives
 * every open branch a seed.
 *
 * Boundary iso-curves (`S(u0, ·)` over the patch's `v` range, `S(·, v0)` over its `u` range):
 * - plane: lines; cylinder: rulings (`u` fixed) and circles about the axis (`v` fixed);
 * - cone: rulings and circles of radius `R(v)` (none at the apex, `R(v) = 0`);
 * - sphere: meridian arcs (`u` fixed) and latitude circles of radius `r cos v` (none at a pole);
 * - torus: tube circles (`u` fixed) and circles about the axis (`v` fixed);
 * - NURBS: the M1 `isoparametricCurve` over the whole knot range (hits outside the patch's range
 *   are dropped).
 * A side on a full-turn periodic parameter is no boundary; a degenerate side (a pole, the apex, a
 * collapsed NURBS edge) is a point and is left to the leaf seeds of `surface-surface.ts`.
 *
 * Each hit `(t, u, v)` is kept when `(u, v)` lies in the other patch's parameter box (angles moved
 * by whole turns into it) and `t` in the side's range, then polished by the corrector with the side
 * parameter held fixed (`correct`). Overlaps (an iso-curve lying on the other surface: a shared
 * edge) give seeds at both ends and the middle. A refusal of the curve/surface search (an
 * unresolved tangency or budget) is returned as is: a branch is never dropped silently. The search
 * runs on the other surface's whole natural extent, so a contact outside the other patch may cause
 * such a refusal (conservative).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md §4.2 (boundary start points from curve/surface intersections),
 *   solidcore/crates/solidcore/src/intersect/surface_intersector/p5.rs (boundary curves of each
 *   surface against the other), solidcore/crates/solidcore/src/intersect/adv_surface_intersector.rs
 *   (`find_boundary_points`). Rewritten for cadloom; not a translation.
 */
import { ok, type Result } from '../core/error.ts';
import { createCircleCurve, createLineCurve, createNurbsCurve3, type Curve3 } from '../curve/types.ts';
import { add3, cross3, scale3, type Vec3 } from '../math/vec.ts';
import { isoparametricCurve } from '../nurbs/surface.ts';
import type { Surface3 } from '../surface/types.ts';
import { intersectCurveSurface } from './curve-surface.ts';
import { correct, type SsiContext, type SsiState } from './ssi-newton.ts';
import type { SurfacePatch } from './ssi-types.ts';

const TWO_PI = 2 * Math.PI;

/** Whether parameter `dir` of `s` is an angle (defined modulo `2π`). */
function angular(s: Surface3, dir: 'u' | 'v'): boolean {
  if (dir === 'u') return s.kind === 'cylinder' || s.kind === 'cone' || s.kind === 'sphere' || s.kind === 'torus';
  return s.kind === 'torus';
}

/**
 * The iso-curve of `p` with parameter `fixed` held at `value`, over the patch range of the other
 * parameter (curve parameter = that surface parameter), or `undefined` when it degenerates to a point.
 */
export function boundaryIsoCurve(ctx: SsiContext, p: SurfacePatch, fixed: 'u' | 'v', value: number): Result<Curve3 | undefined> {
  const s = p.surface;
  const range = fixed === 'u' ? p.domain.v : p.domain.u;
  const kernel = ctx.kernel;
  const tiny = 1e-3 * kernel.tolerances.zoneTol3d;
  const e = (u: number, X: Vec3, Y: Vec3): Vec3 => add3(scale3(X, Math.cos(u)), scale3(Y, Math.sin(u)));
  switch (s.kind) {
    case 'plane': {
      const { xAxis: X, yAxis: Y } = s.frame;
      return fixed === 'u' ? createLineCurve(add3(s.origin, scale3(X, value)), Y, range) : createLineCurve(add3(s.origin, scale3(Y, value)), X, range);
    }
    case 'cylinder': {
      const { xAxis: X, yAxis: Y, normal: Z } = s.frame;
      if (fixed === 'u') return createLineCurve(add3(s.origin, scale3(e(value, X, Y), s.radius)), Z, range);
      return createCircleCurve(kernel, add3(s.origin, scale3(Z, value)), Z, X, s.radius, range);
    }
    case 'cone': {
      const { xAxis: X, yAxis: Y, normal: Z } = s.frame;
      const t = Math.tan(s.semiAngle);
      if (fixed === 'u') {
        const eu = e(value, X, Y);
        return createLineCurve(add3(s.origin, scale3(eu, s.baseRadius)), add3(scale3(eu, t), Z), range);
      }
      const R = s.baseRadius + t * value;
      if (!(R > tiny)) return ok(undefined);
      return createCircleCurve(kernel, add3(s.origin, scale3(Z, value)), Z, X, R, range);
    }
    case 'sphere': {
      const { xAxis: X, yAxis: Y, normal: Z } = s.frame;
      if (fixed === 'u') {
        const eu = e(value, X, Y);
        return createCircleCurve(kernel, s.center, cross3(eu, Z), eu, s.radius, range);
      }
      const R = s.radius * Math.cos(value);
      if (!(R > tiny)) return ok(undefined);
      return createCircleCurve(kernel, add3(s.center, scale3(Z, s.radius * Math.sin(value))), Z, X, R, range);
    }
    case 'torus': {
      const { xAxis: X, yAxis: Y, normal: Z } = s.frame;
      if (fixed === 'u') {
        const eu = e(value, X, Y);
        return createCircleCurve(kernel, add3(s.center, scale3(eu, s.majorRadius)), cross3(eu, Z), eu, s.minorRadius, range);
      }
      const R = s.majorRadius + s.minorRadius * Math.cos(value);
      return createCircleCurve(kernel, add3(s.center, scale3(Z, s.minorRadius * Math.sin(value))), Z, X, R, range);
    }
    case 'nurbs': {
      const c = isoparametricCurve(s.surface, fixed, value);
      if (!c.ok) return c;
      // A collapsed NURBS edge (all control points within the zone of the first) is a point.
      const pts = c.value.controlPoints;
      const p0 = pts[0]!;
      const span = pts.reduce((m, q) => Math.max(m, Math.hypot(q[0]! - p0[0]!, q[1]! - p0[1]!, q[2]! - p0[2]!)), 0);
      if (!(span > tiny)) return ok(undefined);
      return createNurbsCurve3(c.value);
    }
  }
}

/** Moves an angle by whole turns into `[lo, hi]` (with `slack`), or `undefined` when it does not fit. */
function intoRange(x: number, lo: number, hi: number, isAngle: boolean, slack: number): number | undefined {
  if (x >= lo - slack && x <= hi + slack) return Math.min(hi, Math.max(lo, x));
  if (!isAngle) return undefined;
  const k = Math.ceil((lo - slack - x) / TWO_PI);
  const y = x + k * TWO_PI;
  return y <= hi + slack ? Math.min(hi, Math.max(lo, y)) : undefined;
}

const paramSlack = (r: readonly [number, number]): number => 1e-9 * (1 + Math.abs(r[0]) + Math.abs(r[1]));

/**
 * The boundary seeds of the pair (see the module comment), in a deterministic order: A's sides
 * (`u0`, `u1`, `v0`, `v1`), then B's, each side's hits in curve order.
 */
export function boundaryCrossings(ctx: SsiContext): Result<SsiState[]> {
  const out: SsiState[] = [];
  const sides: ['A' | 'B', 'u' | 'v', 0 | 1][] = [];
  for (const which of ['A', 'B'] as const) for (const dir of ['u', 'v'] as const) for (const end of [0, 1] as const) sides.push([which, dir, end]);
  for (const [which, dir, end] of sides) {
    const base = which === 'A' ? 0 : 2;
    const index = base + (dir === 'u' ? 0 : 1);
    if (ctx.periodic[index]) continue;
    const P = which === 'A' ? ctx.A : ctx.B;
    const Q = which === 'A' ? ctx.B : ctx.A;
    const value = P.domain[dir][end];
    const iso = boundaryIsoCurve(ctx, P, dir, value);
    if (!iso.ok) return iso;
    if (iso.value === undefined) continue;
    const hits = intersectCurveSurface(ctx.kernel, iso.value, Q.surface);
    if (!hits.ok) return hits;
    const tRange = dir === 'u' ? P.domain.v : P.domain.u;
    const freeIsAngle = angular(P.surface, dir === 'u' ? 'v' : 'u');
    const starts: { t: number; u: number; v: number }[] = [];
    for (const h of hits.value.hits) {
      if (h.kind === 'point') starts.push({ t: h.t, u: h.u, v: h.v });
      else {
        const [t0, t1] = h.range;
        starts.push({ t: t0, u: h.start.u, v: h.start.v }, { t: t1, u: h.end.u, v: h.end.v });
        // The middle: its other-surface parameters come from the corrector (started at the start's).
        starts.push({ t: (t0 + t1) / 2, u: h.start.u, v: h.start.v });
      }
    }
    for (const st of starts) {
      const t = intoRange(st.t, tRange[0], tRange[1], freeIsAngle, paramSlack(tRange));
      if (t === undefined) continue;
      const qu = intoRange(st.u, Q.domain.u[0], Q.domain.u[1], angular(Q.surface, 'u'), paramSlack(Q.domain.u));
      const qv = intoRange(st.v, Q.domain.v[0], Q.domain.v[1], angular(Q.surface, 'v'), paramSlack(Q.domain.v));
      if (qu === undefined || qv === undefined) continue;
      const pu = dir === 'u' ? value : t, pv = dir === 'u' ? t : value;
      const x0 = which === 'A' ? [pu, pv, qu, qv] : [qu, qv, pu, pv];
      const s = correct(ctx, x0, { index, value });
      if (s !== undefined) out.push(s);
    }
  }
  return ok(out);
}

