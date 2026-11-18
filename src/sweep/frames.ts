/**
 * Rotation-minimizing frames along a path by the double reflection method (Wang, Jüttler, Zheng, Liu, "Computation
 * of rotation minimizing frames", ACM TOG 27(1), 2008, Algorithm 1).
 *
 * A frame at a station is `(r, s, t)`: `t` the unit tangent, `r` a unit reference vector square to it,
 * `s = t × r`. One step from station `i` to `i + 1` (`doubleReflectionStep`, the formulas of
 * `formal/CadloomFormal/Sweep.lean`, `drStep`):
 *   `v1 = x_{i+1} - x_i`,  `r^L = R_{v1}(r_i)`,  `t^L = R_{v1}(t_i)`,
 *   `v2 = t_{i+1} - t^L`,  `r_{i+1} = R_{v2}(r^L)`,
 * with the reflection `R_n(v) = v - (2 (v·n) / (n·n)) n`, and `R_n` the identity when `n·n = 0` (the TS and the Lean
 * model skip a zero reflection the same way). Lean proves that a reflection keeps dot products and is an involution
 * (`reflect_dot`, `reflect_involutive`), that `R_{v2}(t^L) = t_{i+1}` whenever `|t_{i+1}| = |t_i|`
 * (`dr_tangent`), and that the step maps an orthonormal `(r_i, t_i)` to an orthonormal `(r_{i+1}, t_{i+1})`
 * (`dr_orthonormal`, `dr_frame_orthonormal` with `s = t × r`), exactly over the rationals. In floating point the
 * frames are orthonormal up to rounding, which accumulates linearly with the number of stations (tested). The method
 * is fourth-order accurate: the frame converges to the exact rotation-minimizing frame (no rotation about the
 * tangent, `ω · t = 0`) as the stations get denser.
 *
 * `rotationMinimizingFrames(kernel, path, count, r0)` samples the path at `count + 1` stations equally spaced in its
 * parameter (`edgeParam` of `src/topology`, so the last station is the curve end exactly) and transports `r0`
 * (projected square to the first tangent). Fails with `invalid-input` for a bad count or reference, and with
 * `degenerate` where the path has no tangent or two stations coincide.
 *
 * Upstream consulted (for the definition, not translated): `solidcore/docs/procedural-sweep.md` §3.2 (the
 * rotation-minimizing frame `z' = -(z·x') x`, its angular velocity has no component along the tangent; the projection
 * rule of the fitted net), `solidcore/crates/solidcore/src/sweep/stations.rs` (stations along a path, the transport
 * `Map` from the path start), `sweep/directed.rs` (a section moved by a frame) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, isFinite3, length3, normalize3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import { evaluateCurve3 } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import { edgeParam } from '../topology/geometry.ts';

/** A frame at a path station. */
export interface PathFrame {
  /** The path parameter of the station. */
  readonly t: number;
  readonly point: Point3;
  /** Unit tangent. */
  readonly tangent: Vec3;
  /** Unit reference vector, square to the tangent (the transported `r`). */
  readonly normal: Vec3;
  /** `tangent × normal`. */
  readonly binormal: Vec3;
}

/** The reflection `R_n(v) = v - (2 (v·n) / (n·n)) n`; the identity when `n·n = 0` (Lean `reflect`). */
export function reflect3(v: Vec3, n: Vec3): Vec3 {
  const nn = dot3(n, n);
  if (nn === 0) return v;
  return sub3(v, scale3(n, (2 * dot3(v, n)) / nn));
}

/**
 * One double reflection step (Lean `drStep`): from the frame `(r0, t0)` at `x0` to the reference vector at `x1`
 * with tangent `t1`. Returns `r1` (the caller sets `s1 = t1 × r1`).
 */
export function doubleReflectionStep(x0: Point3, x1: Point3, t0: Vec3, t1: Vec3, r0: Vec3): Vec3 {
  const v1 = sub3(x1, x0);
  const rL = reflect3(r0, v1);
  const tL = reflect3(t0, v1);
  const v2 = sub3(t1, tL);
  return reflect3(rL, v2);
}

const OP = 'sweep.rotationMinimizingFrames';

/** Most stations of one frame computation. */
export const MAX_FRAME_STATIONS = 1 << 16;

/** Point and unit tangent of `path` at `t`. */
function stationOf(path: Curve3, t: number): Result<{ readonly point: Point3; readonly tangent: Vec3 }> {
  const e = evaluateCurve3(path, t);
  if (!e.ok) return e;
  const tangent = normalize3(e.value.d1);
  if (tangent === undefined || !isFinite3(tangent)) return err({ kind: 'degenerate', operation: OP });
  return ok({ point: e.value.point, tangent });
}

/**
 * Rotation-minimizing frames at `count + 1` stations equally spaced in the parameter of `path`, starting from the
 * reference `r0` projected square to the first tangent (see the module comment).
 */
export function rotationMinimizingFrames(kernel: Kernel, path: Curve3, count: number, r0: Vec3): Result<readonly PathFrame[]> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_FRAME_STATIONS) return invalidInput(OP, `count must be an integer in [1, ${MAX_FRAME_STATIONS}]`);
  if (!isFinite3(r0)) return invalidInput(OP, 'reference vector is not finite');
  const [a, b] = curveRange(path);
  const first = stationOf(path, a);
  if (!first.ok) return first;
  const t0 = first.value.tangent;
  const rn = normalize3(r0);
  const sinTol = Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180);
  if (rn === undefined || !(length3(cross3(rn, t0)) > sinTol)) return invalidInput(OP, 'the reference vector is zero or parallel to the path tangent');
  const r = normalize3(sub3(rn, scale3(t0, dot3(rn, t0))))!;
  const frames: PathFrame[] = [Object.freeze({ t: a, point: first.value.point, tangent: t0, normal: r, binormal: cross3(t0, r) })];
  for (let i = 1; i <= count; i++) {
    const t = edgeParam(a, b, i / count);
    const st = stationOf(path, t);
    if (!st.ok) return st;
    const prev = frames[i - 1]!;
    if (!(length3(sub3(st.value.point, prev.point)) > 0)) return err({ kind: 'degenerate', operation: OP });
    const ri = doubleReflectionStep(prev.point, st.value.point, prev.tangent, st.value.tangent, prev.normal);
    if (!isFinite3(ri)) return err({ kind: 'degenerate', operation: OP });
    frames.push(Object.freeze({ t, point: st.value.point, tangent: st.value.tangent, normal: ri, binormal: cross3(st.value.tangent, ri) }));
  }
  return ok(Object.freeze(frames));
}

/**
 * The rigid motion carrying the frame `f0` to `f`: `p ↦ f.point + R (p - f0.point)` with
 * `R v = r (r0·v) + s (s0·v) + t (t0·v)`.
 */
export function frameMotion(f0: PathFrame, f: PathFrame): { readonly point: (p: Point3) => Point3; readonly vector: (v: Vec3) => Vec3 } {
  const vector = (v: Vec3): Vec3 =>
    add3(add3(scale3(f.normal, dot3(f0.normal, v)), scale3(f.binormal, dot3(f0.binormal, v))), scale3(f.tangent, dot3(f0.tangent, v)));
  return { point: (p: Point3) => add3(f.point, vector(sub3(p, f0.point))), vector };
}
