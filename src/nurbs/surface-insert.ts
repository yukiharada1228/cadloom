/**
 * Knot insertion and refinement on NURBS surfaces (The NURBS Book A5.3 SurfaceKnotIns): inserting
 * a u-knot applies the curve insertion A5.1 to every column of the net, inserting a v-knot applies
 * it to every row. Rational surfaces are processed on homogeneous points, so the surface (shape and
 * parametrization) is unchanged.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/nurbs/srf_nurb.rs, solidcore/crates/solidcore/src/nurbs/nurbs_srf.rs
 *   (split_srf, decompose_srf), solidcore/crates/solidcore/src/nurbs/srf_basic.rs. Rewritten for cadloom.
 *
 * The per-curve work is the M0 `insertKnot` (src/nurbs/insert.ts); this module only splits the net
 * into direction curves and reassembles it (`directionCurves` / `surfaceFromDirectionCurves`).
 */
import { invalidInput, type Result } from '../core/error.ts';
import type { NurbsCurve } from './curve.ts';
import { insertKnot, refineKnots } from './insert.ts';
import {
  directionCurves,
  surfaceFromDirectionCurves,
  type NurbsSurface,
  type SurfaceDirection,
} from './surface.ts';

/** Applies a curve operation to every direction curve (homogeneous) and rebuilds the surface. */
export function mapDirectionCurves(
  surface: NurbsSurface,
  direction: SurfaceDirection,
  f: (curve: NurbsCurve) => Result<NurbsCurve>,
): Result<NurbsSurface> {
  const curves = directionCurves(surface, direction);
  if (!curves.ok) return curves;
  const mapped: NurbsCurve[] = [];
  for (const c of curves.value) {
    const r = f(c);
    if (!r.ok) return r;
    mapped.push(r.value);
  }
  return surfaceFromDirectionCurves(surface, direction, mapped);
}

/**
 * Inserts the knot `value` `times` times in `direction` (A5.3). The same preconditions as the M0
 * `insertKnot` apply to the knot vector of that direction (`value` in `[lo, hi)`, resulting
 * multiplicity at most the degree). Returns a new surface.
 */
export function insertKnotSurface(
  surface: NurbsSurface,
  direction: SurfaceDirection,
  value: number,
  times = 1,
): Result<NurbsSurface> {
  if (direction !== 'u' && direction !== 'v') return invalidInput('nurbs.insertKnotSurface', "direction must be 'u' or 'v'");
  return mapDirectionCurves(surface, direction, (c) => insertKnot(c, value, times));
}

/** Inserts every value of `values` once, in order, in `direction` (the M0 `refineKnots` on every direction curve). */
export function refineKnotsSurface(
  surface: NurbsSurface,
  direction: SurfaceDirection,
  values: readonly number[],
): Result<NurbsSurface> {
  if (direction !== 'u' && direction !== 'v') return invalidInput('nurbs.refineKnotsSurface', "direction must be 'u' or 'v'");
  return mapDirectionCurves(surface, direction, (c) => refineKnots(c, values));
}
