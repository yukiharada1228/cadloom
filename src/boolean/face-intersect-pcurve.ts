/**
 * Pcurves of intersection pieces on a face: the 2D NURBS curve in the face's `(u, v)` whose lift runs along the
 * piece's 3D curve, in the curve's direction, on the face's own period.
 *
 * 1. On a plane: the exact M2 `planePcurve` (the curve's NURBS form mapped by the plane's affine parameters).
 * 2. A ruling of a cylinder or cone, or a circle coaxial with a surface of revolution: the exact linear pcurve of
 *    the M4 closed forms (`exactPcurve`, `src/intersect/ssi-common.ts`; one job, one place).
 * 3. Otherwise (an ellipse on a cylinder, an oblique circle on a sphere, a marched NURBS branch): a fitted cubic
 *    B-spline. The curve is sampled at `n + 1` equal parameter steps, each sample is mapped to `(u, v)` by the
 *    kernel's one point-to-`(u, v)` mapping `surfaceUv` with the previous sample as the hint (unwrapping periodic
 *    angles), starting from the middle sample; the samples are interpolated (the sweep's global interpolation,
 *    `src/sweep/interpolate.ts`) at the curve's parameter fractions, so the pcurve parameter is the curve's. The
 *    fit is accepted when, at every midpoint between samples, `|S(pc(s)) - C(t(s))| <= zoneTol3d / 4` (measured,
 *    not certified); `n` doubles from 16 to 256, then the fit is refused (`precision exhausted`). A curve through
 *    a sphere pole or a cone apex (where `u` is undefined) has no smooth pcurve and is refused that way.
 *
 * Periodic angles are moved by whole periods so that the pcurve's middle lies in the face's `(u, v)` box (the
 * face's period: a cylinder face over `[0, 2π]`, a revolved face over `[-π/2, π/2]`, ...). End points on a seam
 * then sit on the seam's side the piece approaches it from.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/eval/pcurve.rs` (exact
 * pcurves on planes), `solidcore/docs/ssi.md` §4.6 (the boolean drops a closed-form curve onto each face),
 * `solidcore/crates/solidcore/src/boolean/topology_intersector` (pcurves of imprinted edges) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, TWO_PI, type Curve3 } from '../curve/types.ts';
import { exactPcurve } from '../intersect/ssi-common.ts';
import { refusal } from '../intersect/types.ts';
import { distance3, vec2, type Point2 } from '../math/vec.ts';
import { createNurbsCurve, evaluateCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import type { Box2 } from '../interval/box.ts';
import type { Periodicity } from '../query/domain.ts';
import { interpolation } from '../sweep/interpolate.ts';
import type { Surface3 } from '../surface/types.ts';
import { planePcurve, surfaceUv } from '../topology/geometry.ts';

const OP = 'boolean.piecePcurve';

/** The face data a pcurve is made for: its surface, `(u, v)` box and periodic parameters. */
export interface PcurveTarget {
  readonly surface: Surface3;
  readonly uvBox: Box2;
  readonly periodic: Periodicity;
}

/** The whole-period shift `2πk` (`|k| <= 3`) that moves `x` into `[lo, hi]`, or nearest to its middle. */
export function periodShift(x: number, lo: number, hi: number): number {
  const mid = (lo + hi) / 2;
  let best = 0, bestD = Infinity;
  for (let k = -3; k <= 3; k++) {
    const y = x + k * TWO_PI;
    const inside = y >= lo - 1e-9 && y <= hi + 1e-9;
    const d = inside ? -1 / (1 + Math.abs(y - mid)) : Math.abs(y - mid);
    if (d < bestD) {
      bestD = d;
      best = k * TWO_PI;
    }
  }
  return best;
}

/** The pcurve translated by `(du, dv)` (exact on control points; a translation commutes with the rational map). */
function translatePcurve(pc: NurbsCurve, du: number, dv: number): Result<NurbsCurve> {
  if (du === 0 && dv === 0) return ok(pc);
  return createNurbsCurve(pc.degree, pc.knots, pc.controlPoints.map((p) => [p[0]! + du, p[1]! + dv]), pc.weights);
}

/** The pcurve moved by whole periods so that its middle lies in the target's `(u, v)` box. */
export function alignPcurve(target: PcurveTarget, pc: NurbsCurve): Result<NurbsCurve> {
  if (!target.periodic.u && !target.periodic.v) return ok(pc);
  const a = pc.knots[pc.degree]!, b = pc.knots[pc.knots.length - 1 - pc.degree]!;
  const m = evaluateCurve(pc, (a + b) / 2);
  if (!m.ok) return m;
  const du = target.periodic.u ? periodShift(m.value[0]!, target.uvBox.min.x, target.uvBox.max.x) : 0;
  const dv = target.periodic.v ? periodShift(m.value[1]!, target.uvBox.min.y, target.uvBox.max.y) : 0;
  return translatePcurve(pc, du, dv);
}

const FIT_START = 16;
const FIT_MAX = 256;

/** Fitted cubic pcurve with `n` steps (see the module comment), or `undefined` when it misses the tolerance. */
function fitPcurve(kernel: Kernel, target: PcurveTarget, curve: Curve3, n: number): Result<NurbsCurve | undefined> {
  const [t0, t1] = curveRange(curve);
  const tAt = (i: number): number => (i === n ? t1 : t0 + ((t1 - t0) * i) / n);
  const uvs: (Point2 | undefined)[] = new Array<Point2 | undefined>(n + 1).fill(undefined);
  const mid = n >> 1;
  const pm = curvePoint3(curve, tAt(mid));
  if (!pm.ok) return pm;
  const m0 = surfaceUv(kernel, target.surface, pm.value);
  if (!m0.ok) return m0;
  const du = target.periodic.u ? periodShift(m0.value.x, target.uvBox.min.x, target.uvBox.max.x) : 0;
  const dv = target.periodic.v ? periodShift(m0.value.y, target.uvBox.min.y, target.uvBox.max.y) : 0;
  uvs[mid] = vec2(m0.value.x + du, m0.value.y + dv);
  for (const dir of [1, -1]) {
    for (let i = mid + dir; i >= 0 && i <= n; i += dir) {
      const p = curvePoint3(curve, tAt(i));
      if (!p.ok) return p;
      const q = surfaceUv(kernel, target.surface, p.value, uvs[i - dir]);
      if (!q.ok) return q;
      uvs[i] = q.value;
    }
  }
  const params = Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : i / n));
  const ip = interpolation(params, 3);
  if (!ip.ok) return ip;
  const cu = ip.value.solve(uvs.map((p) => p!.x));
  const cv = ip.value.solve(uvs.map((p) => p!.y));
  const pc = createNurbsCurve(ip.value.degree, ip.value.knots, cu.map((x, i) => [x, cv[i]!]));
  if (!pc.ok) return pc;
  const tol = kernel.tolerances.zoneTol3d / 4;
  for (let i = 0; i < n; i++) {
    for (const f of [0.25, 0.5, 0.75]) {
      const s = (i + f) / n;
      const uv = evaluateCurve(pc.value, s);
      if (!uv.ok) return uv;
      const lift = surfacePoint3(target.surface, uv.value[0]!, uv.value[1]!);
      if (!lift.ok) return lift;
      const c = curvePoint3(curve, t0 + (t1 - t0) * s);
      if (!c.ok) return c;
      if (!(distance3(lift.value, c.value) <= tol)) return ok(undefined);
    }
  }
  return ok(pc.value);
}

/** The pcurve of `curve` (lying on the target's surface) on the target face (see the module comment). */
export function piecePcurve(kernel: Kernel, target: PcurveTarget, curve: Curve3): Result<NurbsCurve> {
  const s = target.surface;
  if (s.kind === 'plane') {
    const [t0, t1] = curveRange(curve);
    return planePcurve(kernel, s, { curve, t0, t1 }, false);
  }
  const exact = exactPcurve(kernel, s, curve);
  if (!exact.ok) return exact;
  if (exact.value !== undefined) return alignPcurve(target, exact.value);
  for (let n = FIT_START; n <= FIT_MAX; n *= 2) {
    const f = fitPcurve(kernel, target, curve, n);
    if (!f.ok) return f;
    if (f.value !== undefined) return ok(f.value);
  }
  return { ok: false, error: refusal(OP, 'precision exhausted') };
}
