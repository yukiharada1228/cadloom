/**
 * The curve of a marched branch: one cubic B-spline in 3D and one in each surface's parameters on
 * **one knot vector** (upstream `solidcore-ssi/src/curves.rs`, `flush_curve`), interpolating the
 * Newton points at their normalised chord-length parameters (global interpolation, The NURBS Book
 * A9.1, the kernel's `interpolation` of src/sweep/interpolate.ts — not a second solver).
 *
 * Certificate (class `certified`): `deviation` is the largest distance, measured at the middle of
 * every span and at the data points, from the 3D curve to each surface (the distance to the local
 * foot point found by Gauss–Newton from the pcurve's `(u, v)`: an upper bound of the true distance,
 * since it is a distance to a surface point); `pcurveDeviation` the largest `|S(pcurve(s)) - C(s)|`
 * at the same parameters. When the deviation exceeds `approxTol3d`, Newton points are added in the
 * offending spans (at most 4 rounds) and the curve refitted; a fit whose measured deviation or
 * pcurve deviation is still above `zoneTol3d` is refused (`precision exhausted`). This is a
 * measurement at samples, not a proved bound between them (docs/ssi.md §6.1 says the same of upstream's two implementations).
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore-ssi/src/curves.rs (3D and UV curves on one knot vector, points added
 *   where the measured deviation is over the tolerance, up to six rounds),
 *   solidcore/crates/solidcore/src/intersect/surface_intersector/p2.rs (`flush_curve`: curve type
 *   and largest deviation). Rewritten for cadloom; not a translation.
 */
import { err, ok, type Result } from '../core/error.ts';
import { createNurbsCurve3 } from '../curve/types.ts';
import { distance3, vec2, vec3, type Point2, type Point3 } from '../math/vec.ts';
import { createNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import { interpolation, interpolationValue, type Interpolation } from '../sweep/interpolate.ts';
import { correct, footOn, type SsiContext, type SsiState } from './ssi-newton.ts';
import type { SsiPolyline, SurfaceSurfaceCurve } from './types.ts';
import { refusal } from './types.ts';

const OP = 'intersect.surfaceSurface';
const MAX_ROUNDS = 4;

interface Fit {
  readonly ip: Interpolation;
  /** Control columns: x, y, z, uA, vA, uB, vB. */
  readonly cols: readonly number[][];
}

/** Chord-length parameters in `[0, 1]`, dropping repeated points; `undefined` if fewer than 2 remain. */
function parametrise(states: readonly SsiState[]): { readonly kept: SsiState[]; readonly params: number[] } | undefined {
  const kept: SsiState[] = [states[0]!];
  const acc: number[] = [0];
  for (let i = 1; i < states.length; i++) {
    const d = distance3(states[i]!.point, kept[kept.length - 1]!.point);
    if (!(d > 0)) continue;
    kept.push(states[i]!);
    acc.push(acc[acc.length - 1]! + d);
  }
  const total = acc[acc.length - 1]!;
  if (kept.length < 2 || !(total > 0)) return undefined;
  const params = acc.map((a, i) => (i === acc.length - 1 ? 1 : a / total));
  for (let i = 1; i < params.length; i++) if (!(params[i]! > params[i - 1]!)) return undefined;
  return { kept, params };
}

function fit(kept: readonly SsiState[], params: readonly number[]): Result<Fit> {
  const ip = interpolation(params, 3);
  if (!ip.ok) return ip;
  const column = (f: (s: SsiState) => number): number[] => ip.value.solve(kept.map(f));
  const cols = [
    column((s) => s.point.x),
    column((s) => s.point.y),
    column((s) => s.point.z),
    column((s) => s.x[0]),
    column((s) => s.x[1]),
    column((s) => s.x[2]),
    column((s) => s.x[3]),
  ];
  for (const c of cols) if (!c.every(Number.isFinite)) return err(refusal(OP, 'degenerate input'));
  return ok({ ip: ip.value, cols });
}

const value = (f: Fit, k: number, s: number): number => interpolationValue(f.ip, f.cols[k]!, s);

interface SpanCheck {
  readonly deviation: number;
  readonly pcurveDeviation: number;
}

/** Measured deviations at parameter `s` (see the module comment). */
function check(ctx: SsiContext, f: Fit, s: number): SpanCheck | undefined {
  const p = vec3(value(f, 0, s), value(f, 1, s), value(f, 2, s));
  const uA = value(f, 3, s), vA = value(f, 4, s), uB = value(f, 5, s), vB = value(f, 6, s);
  const fa = footOn(ctx, 'A', p, uA, vA);
  const fb = footOn(ctx, 'B', p, uB, vB);
  if (fa === undefined || fb === undefined) return undefined;
  const sa = surfacePoint3(ctx.A.surface, uA, vA);
  const sb = surfacePoint3(ctx.B.surface, uB, vB);
  if (!sa.ok || !sb.ok) return undefined;
  return { deviation: Math.max(fa.distance, fb.distance), pcurveDeviation: Math.max(distance3(sa.value, p), distance3(sb.value, p)) };
}

/** Fits a branch (see the module comment). `states` are Newton points in order. */
export function fitBranch(ctx: SsiContext, states: readonly SsiState[], closed: boolean): Result<SurfaceSurfaceCurve> {
  const tol = ctx.kernel.tolerances.approxTol3d;
  let current = states.slice();
  for (let round = 0; ; round++) {
    const pr = parametrise(current);
    if (pr === undefined) return err(refusal(OP, 'degenerate input'));
    const { kept, params } = pr;
    const f = fit(kept, params);
    if (!f.ok) return f;
    let deviation = 0, pcurveDeviation = 0;
    const bad: number[] = [];
    for (let i = 0; i < kept.length; i++) deviation = Math.max(deviation, kept[i]!.residual / 2);
    for (let i = 0; i + 1 < kept.length; i++) {
      const c = check(ctx, f.value, (params[i]! + params[i + 1]!) / 2);
      if (c === undefined) return err(refusal(OP, 'newton did not converge'));
      deviation = Math.max(deviation, c.deviation);
      pcurveDeviation = Math.max(pcurveDeviation, c.pcurveDeviation);
      if (c.deviation > tol / 2 || c.pcurveDeviation > tol) bad.push(i);
    }
    if ((deviation <= tol && pcurveDeviation <= tol) || round >= MAX_ROUNDS || bad.length === 0) {
      return build(ctx, f.value, kept, deviation, pcurveDeviation, closed);
    }
    // Refine: a Newton point in the middle of every offending span.
    const refined: SsiState[] = [];
    let b = 0;
    for (let i = 0; i < kept.length; i++) {
      refined.push(kept[i]!);
      if (b < bad.length && bad[b] === i) {
        b++;
        const x0 = kept[i]!.x, x1 = kept[i + 1]!.x;
        const mid = correct(ctx, x0.map((v, k) => (v + x1[k]!) / 2));
        if (mid !== undefined) refined.push(mid);
      }
    }
    if (refined.length === kept.length) return build(ctx, f.value, kept, deviation, pcurveDeviation, closed);
    current = refined;
  }
}

function build(ctx: SsiContext, f: Fit, kept: readonly SsiState[], deviation: number, pcurveDeviation: number, closed: boolean): Result<SurfaceSurfaceCurve> {
  // A fit still farther than the zone from a surface after the refinement rounds is no
  // certificate: refused, never reported as a curve of the intersection.
  const zone = ctx.kernel.tolerances.zoneTol3d;
  if (!(deviation <= zone && pcurveDeviation <= zone)) return err(refusal(OP, 'precision exhausted'));
  const knots = f.ip.knots, p = f.ip.degree;
  const n = f.cols[0]!.length;
  const at = (ks: readonly number[]): number[][] => Array.from({ length: n }, (_, i) => ks.map((k) => f.cols[k]![i]!));
  const c3 = createNurbsCurve(p, knots, at([0, 1, 2]));
  if (!c3.ok) return c3;
  const curve = createNurbsCurve3(c3.value);
  if (!curve.ok) return curve;
  const pa: Result<NurbsCurve> = createNurbsCurve(p, knots, at([3, 4]));
  if (!pa.ok) return pa;
  const pb: Result<NurbsCurve> = createNurbsCurve(p, knots, at([5, 6]));
  if (!pb.ok) return pb;
  const polyline: SsiPolyline = Object.freeze({
    points: Object.freeze(kept.map((s): Point3 => Object.freeze({ ...s.point }))),
    uvA: Object.freeze(kept.map((s): Point2 => Object.freeze(vec2(s.x[0], s.x[1])))),
    uvB: Object.freeze(kept.map((s): Point2 => Object.freeze(vec2(s.x[2], s.x[3])))),
  });
  return ok(
    Object.freeze({
      kind: 'curve',
      class: 'certified',
      deviation,
      curve: curve.value,
      pcurveA: pa.value,
      pcurveB: pb.value,
      contact: 'transversal',
      closed,
      polyline,
      pcurveDeviation,
    }),
  );
}
