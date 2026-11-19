/**
 * Marching (tracing) of one intersection branch from a seed (docs/ssi.md §4.3).
 *
 * - **Predictor**: a step of length `h` along `t = ±(n_A × n_B) / |n_A × n_B|` (Lean
 *   `march_tangent_orth`: `t·n_A = t·n_B = 0`), pulled back to each surface's parameters by the
 *   least-squares normal equations (`tangentParams`).
 * - **Corrector**: `correct` (minimum-norm Gauss–Newton onto both surfaces, residual
 *   `<= 1e-3 approxTol3d`).
 * - **Step control**: the step is accepted when the corrector converges, the chord is between
 *   `h/2` and `3h/2` and points forward, and the tangent turns by at most `maxTurn`; otherwise `h` is
 *   halved (down to `1e-3 zoneTol3d`: then the march stalls, a refusal). A step that turned by less
 *   than `maxTurn / 3` grows `h` by 1.5, up to `hMax`. The turn bound limits the chord's sagitta to
 *   `h·maxTurn/8`, so the curvature of the intersection curve sets the step.
 * - **Singular points**: the march stops as `singular` when `|n_A × n_B|` falls below `1e-6`, or when
 *   the oriented cross product reverses against the travel direction between two points (the
 *   branch crossed a point where the normals are parallel: a branch point or a tangency). The
 *   caller refuses such a branch (`tangent contact not resolved`); it is never stepped through.
 * - **End**: at a non-periodic domain bound (the step is shortened to land on it and the last point
 *   is solved with that parameter fixed), on returning to the branch start (closed loop: the start
 *   is within one step ahead, with its periodic parameters unwrapped next to the current ones), or
 *   after `maxPoints` points (a refusal).
 * Periodic parameters (a full turn of an analytic angle) are unwrapped: they run continuously past
 * the seam.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/surface_intersector/p3.rs (`compute_next_point`),
 *   p4.rs (`trace_curve`: end at a boundary, at the start, after 5000 points), p1.rs
 *   (`compute_step_size`, `test_span_accuracy`: turn limit, halving and 1.5 growth),
 *   solidcore/crates/ssi/src/march.rs (max_step, max_turn), solidcore/docs/ssi.md §4.3–4.4.
 *   Rewritten for cadloom; not a translation.
 */
import { cross3, dot3, length3, scale3, sub3, type Vec3 } from '../math/vec.ts';
import { correct, tangentParams, type SsiContext, type SsiState, type X4 } from './ssi-newton.ts';

export type MarchEnd = 'boundary' | 'closed' | 'singular' | 'stalled' | 'budget';

export interface MarchResult {
  readonly states: readonly SsiState[];
  readonly end: MarchEnd;
}

export interface MarchLimits {
  readonly hInit: number;
  readonly hMax: number;
  readonly hMin: number;
  readonly maxTurn: number;
  readonly maxPoints: number;
}

/** Sine below which the surfaces count as tangent at a point of a branch. */
export const SINGULAR_SIN = 1e-6;

const TWO_PI = 2 * Math.PI;

/** The oriented unit marching direction `sign · n_A × n_B` (zero at a singular point). */
export function marchTangent(s: SsiState, sign: number): Vec3 {
  const c = cross3(s.nA, s.nB);
  const l = length3(c);
  return l > 0 ? scale3(c, sign / l) : c;
}

/** The parameter-space step for a 3D step `h t`; `undefined` at a degenerate point. */
function paramStep(s: SsiState, t: Vec3, h: number): number[] | undefined {
  const a = tangentParams(s.dA, t);
  const b = tangentParams(s.dB, t);
  if (a === undefined || b === undefined) return undefined;
  return [h * a[0], h * a[1], h * b[0], h * b[1]];
}

/** `x` shifted by whole periods in its periodic parameters to lie within half a period of `near`. */
export function unwrapNear(ctx: SsiContext, x: X4, near: X4): X4 {
  return x.map((xi, i) => (ctx.periodic[i] ? xi + TWO_PI * Math.round((near[i]! - xi) / TWO_PI) : xi)) as unknown as X4;
}

/** The first non-periodic bound crossed by the step `cur -> pred`: its index, value and fraction. */
function firstExit(ctx: SsiContext, cur: X4, pred: readonly number[]): { index: number; value: number; f: number } | undefined {
  let best: { index: number; value: number; f: number } | undefined;
  for (let i = 0; i < 4; i++) {
    if (ctx.periodic[i]) continue;
    const p = pred[i]!, c = cur[i]!;
    let value: number | undefined;
    if (p > ctx.hi[i]!) value = ctx.hi[i]!;
    else if (p < ctx.lo[i]!) value = ctx.lo[i]!;
    if (value === undefined) continue;
    const f = p === c ? 0 : (value - c) / (p - c);
    if (best === undefined || f < best.f) best = { index: i, value, f: Math.max(0, Math.min(1, f)) };
  }
  return best;
}

/** Traces from `start` in direction `sign` (see the module comment). `origin` is the branch start for loop closure. */
export function march(ctx: SsiContext, start: SsiState, sign: number, limits: MarchLimits, origin: SsiState): MarchResult {
  const states: SsiState[] = [start];
  let t = marchTangent(start, sign);
  if (start.sin < SINGULAR_SIN || length3(t) === 0) return { states, end: 'singular' };
  let h = limits.hInit;
  while (states.length < limits.maxPoints) {
    const cur = states[states.length - 1]!;
    // Closure: the branch start lies within one step ahead.
    if (states.length >= 4) {
      const toStart = sub3(origin.point, cur.point);
      const dist = length3(toStart);
      if (dist <= 1.5 * h && dot3(toStart, t) > 0.5 * dist) {
        const closeX = unwrapNear(ctx, origin.x, cur.x);
        // The start must also be near in both parameter spaces (not another sheet over the same point).
        const sp = paramStep(cur, t, 2 * h);
        const sameParams =
          sp !== undefined &&
          closeX.every((xi, i) => Math.abs(xi - cur.x[i]!) <= Math.abs(sp[i]!) + 1e-6 * (ctx.periodic[i] ? TWO_PI : ctx.hi[i]! - ctx.lo[i]!));
        if (sameParams) {
          states.push(Object.freeze({ ...origin, x: closeX }));
          return { states, end: 'closed' };
        }
      }
    }
    let accepted: SsiState | undefined;
    let boundary = false;
    for (;;) {
      if (!(h >= limits.hMin && h > 0)) return { states, end: 'stalled' }; // also ends a NaN or zero step
      const step = paramStep(cur, t, h);
      if (step === undefined) return { states, end: 'singular' };
      const pred = cur.x.map((xi, i) => xi + step[i]!);
      const exit = firstExit(ctx, cur.x, pred);
      let next: SsiState | undefined;
      if (exit !== undefined) {
        if (exit.f * h <= 1e-9 * limits.hMax) return { states, end: 'boundary' };
        const xb = cur.x.map((xi, i) => xi + exit.f * step[i]!);
        next = correct(ctx, xb, { index: exit.index, value: exit.value });
        boundary = true;
      } else {
        next = correct(ctx, pred);
        boundary = false;
      }
      if (next === undefined) {
        h /= 2;
        continue;
      }
      const chord = sub3(next.point, cur.point);
      const cl = length3(chord);
      const expected = boundary ? h * (exit?.f ?? 1) : h;
      if (cl > 1.5 * expected + ctx.eps || (!boundary && cl < 0.5 * expected) || dot3(chord, t) < 0.5 * cl) {
        h /= 2;
        continue;
      }
      if (next.sin < SINGULAR_SIN) {
        states.push(next);
        return { states, end: 'singular' };
      }
      const tn = marchTangent(next, sign);
      const cosTurn = dot3(tn, t);
      if (cosTurn <= 0) {
        // The oriented direction reversed: a point with parallel normals lies between.
        if (h > 64 * limits.hMin) {
          h /= 2;
          continue;
        }
        return { states, end: 'singular' };
      }
      const turn = Math.acos(Math.min(1, cosTurn));
      if (turn > limits.maxTurn) {
        h /= 2;
        continue;
      }
      accepted = next;
      t = tn;
      if (turn < limits.maxTurn / 3) h = Math.min(limits.hMax, h * 1.5);
      break;
    }
    states.push(accepted);
    if (boundary) return { states, end: 'boundary' };
  }
  return { states, end: 'budget' };
}
