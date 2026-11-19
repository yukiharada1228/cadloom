/**
 * Newton machinery of the general surface/surface path: the intersection system
 * `F(uA, vA, uB, vB) = S_A(uA, vA) - S_B(uB, vB) = 0` (three equations, four unknowns).
 *
 * - `correct`: the corrector. Gauss–Newton with the minimum-norm step
 *   `Δ = Jᵀ (J Jᵀ)⁻¹ (-F)`, `J = [S_A,u  S_A,v  -S_B,u  -S_B,v]` (`minNormStep`, Lean
 *   `minNormStep_spec`); with one parameter held fixed (a domain boundary) the square 3×3 system by
 *   Cramer's rule (`solve3_spec`). Non-periodic parameters are clamped to the patch domains after
 *   every step; it stops when `|F| <= eps · min(1, sin)` (`residualTarget`, at most 16 steps), else fails. Points come from roots:
 *   every reported point is such a root.
 * - `tangentParams`: the predictor's pull-back of a 3D direction `t` onto a surface, the
 *   least-squares solution of `du S_u + dv S_v ≈ t` by the 2×2 normal equations (`solveSym2`,
 *   Lean `solveSym2_spec`).
 * - `footOn`: the local closest point of `p` on one surface from a start `(u, v)` (M1
 *   `refineProjection`, clamped to the patch), used to measure distances (an upper bound of the true
 *   distance: it is the distance to a surface point).
 * - `contactNewton`: a tangential contact. With `g(uA, vA) = (S_A - S_B(foot)) · n_B` the signed gap
 *   of A over B along B's normal, its gradient is `(S_A,u · n_B, S_A,v · n_B)` and its Hessian at a
 *   contact is `H_ij = S_A,ij · n_B - II_B(a_i, a_j)`, `a_i` the coordinates of `S_A,i` in B's
 *   tangent basis (the difference of the two second fundamental forms read in A's parameters,
 *   docs/ssi.md §4.4). Newton on `∇g = 0` finds the contact; `det H > 0` is an isolated touch (an
 *   extremum of the gap), `det H < 0` a branch point (a saddle: two branches cross), `det H ≈ 0` a
 *   tangent curve or higher-order contact.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/solidcore/src/intersect/surface_intersector/p1.rs (`refine_point`),
 *   solidcore/crates/solidcore/src/intersect/adv_surface_intersector.rs
 *   (`compute_singularity_point`: the Dupin indicatrices' difference),
 *   solidcore/crates/solidcore/src/intersect/adv_surface_intersector/tangent_contacts.rs (WR-74:
 *   Newton on the gap and the tangency), solidcore/crates/ssi/src/march.rs, solidcore/docs/ssi.md
 *   §4.3–4.4. Rewritten for cadloom; not a translation.
 */
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, length3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import { evaluateSurface3, type SurfaceDerivs3 } from '../surface/evaluate.ts';
import { refineProjection } from '../surface/implicit.ts';
import type { Surface3 } from '../surface/types.ts';
import { minNormStep, solveColumns3, solveSym2 } from './linalg.ts';
import type { SurfacePatch } from './ssi-types.ts';

/** `(uA, vA, uB, vB)`. */
export type X4 = readonly [number, number, number, number];

const TWO_PI = 2 * Math.PI;

/** The data the general path shares. */
export interface SsiContext {
  readonly kernel: Kernel;
  readonly A: SurfacePatch;
  readonly B: SurfacePatch;
  /** Which of the four parameters is a full-turn periodic angle (no boundary). */
  readonly periodic: readonly [boolean, boolean, boolean, boolean];
  readonly lo: X4;
  readonly hi: X4;
  /** Corrector residual `|S_A - S_B|`. */
  readonly eps: number;
}

/** Whether a patch parameter is a full period (an analytic angle over a whole turn). */
function fullTurn(p: SurfacePatch, dir: 'u' | 'v'): boolean {
  const s = p.surface;
  const r = p.domain[dir];
  const angular = dir === 'u' ? s.kind === 'cylinder' || s.kind === 'cone' || s.kind === 'sphere' || s.kind === 'torus' : s.kind === 'torus';
  return angular && r[1] - r[0] >= TWO_PI * (1 - 1e-12);
}

export function createContext(kernel: Kernel, A: SurfacePatch, B: SurfacePatch): SsiContext {
  return Object.freeze({
    kernel,
    A,
    B,
    periodic: [fullTurn(A, 'u'), fullTurn(A, 'v'), fullTurn(B, 'u'), fullTurn(B, 'v')] as const,
    lo: [A.domain.u[0], A.domain.v[0], B.domain.u[0], B.domain.v[0]] as const,
    hi: [A.domain.u[1], A.domain.v[1], B.domain.u[1], B.domain.v[1]] as const,
    eps: 1e-3 * kernel.tolerances.approxTol3d,
  });
}

/** Clamps the non-periodic parameters into the domains. */
export function clampX(ctx: SsiContext, x: readonly number[]): X4 {
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const xi = x[i]!;
    out[i] = ctx.periodic[i] ? xi : Math.min(ctx.hi[i]!, Math.max(ctx.lo[i]!, xi));
  }
  return out as unknown as X4;
}

/** A point of the intersection system with everything the tracer needs. */
export interface SsiState {
  readonly x: X4;
  readonly dA: SurfaceDerivs3;
  readonly dB: SurfaceDerivs3;
  /** The midpoint of `S_A` and `S_B`. */
  readonly point: Point3;
  /** `|S_A - S_B|`. */
  readonly residual: number;
  /** Unit normals `S_u × S_v / |S_u × S_v|` (zero at a degenerate point). */
  readonly nA: Vec3;
  readonly nB: Vec3;
  /** `|nA × nB|`, the sine of the angle between the surfaces. */
  readonly sin: number;
}

const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });

function unitNormal(d: SurfaceDerivs3): Vec3 {
  const n = cross3(d.su, d.sv);
  const l = length3(n);
  return l > 0 && Number.isFinite(l) ? scale3(n, 1 / l) : ZERO;
}

function evalAt(s: Surface3, u: number, v: number): SurfaceDerivs3 | undefined {
  const d = evaluateSurface3(s, u, v);
  return d.ok ? d.value : undefined;
}

/** Evaluates both surfaces at `x` (`undefined` when an evaluation fails). */
export function evalState(ctx: SsiContext, x: X4): SsiState | undefined {
  const dA = evalAt(ctx.A.surface, x[0], x[1]);
  if (dA === undefined) return undefined;
  const dB = evalAt(ctx.B.surface, x[2], x[3]);
  if (dB === undefined) return undefined;
  const nA = unitNormal(dA), nB = unitNormal(dB);
  return Object.freeze({
    x,
    dA,
    dB,
    point: scale3(add3(dA.point, dB.point), 0.5),
    residual: length3(sub3(dA.point, dB.point)),
    nA,
    nB,
    sin: length3(cross3(nA, nB)),
  });
}

const MAX_CORRECT = 16;

/**
 * The corrector's stopping residual at `s`: `eps · min(1, sin)`, floored at the rounding of the
 * coordinates. Two surfaces crossing at a small angle `θ` have points `eps` apart up to `eps / sin θ`
 * from their intersection curve, so a fixed `eps` lets a branch between nearly tangent surfaces drift
 * (a small loop spirals open and never closes); scaling by the sine keeps the curve's error near `eps`.
 */
export function residualTarget(ctx: SsiContext, s: SsiState): number {
  const p = s.point;
  const floor = 16 * Number.EPSILON * (1 + Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
  return Math.max(ctx.eps * Math.min(1, s.sin), floor);
}

/**
 * Newton-corrects `x0` onto the intersection (see the module comment). With `fixed`, parameter
 * `fixed.index` is held at `fixed.value`. `undefined` when it does not converge.
 */
export function correct(ctx: SsiContext, x0: readonly number[], fixed?: { readonly index: number; readonly value: number }): SsiState | undefined {
  let x = clampX(ctx, x0);
  if (fixed !== undefined) {
    const y = x.slice();
    y[fixed.index] = fixed.value;
    x = y as unknown as X4;
  }
  for (let it = 0; it <= MAX_CORRECT; it++) {
    const s = evalState(ctx, x);
    if (s === undefined) return undefined;
    if (s.residual <= residualTarget(ctx, s)) return s;
    if (it === MAX_CORRECT) return undefined;
    const F = sub3(s.dA.point, s.dB.point);
    const b = scale3(F, -1);
    const cols = [s.dA.su, s.dA.sv, scale3(s.dB.su, -1), scale3(s.dB.sv, -1)];
    let step: number[];
    if (fixed === undefined) {
      const d = minNormStep(cols, b);
      if (d === undefined) return undefined;
      step = d;
    } else {
      const free = [0, 1, 2, 3].filter((i) => i !== fixed.index);
      const d = solveColumns3(cols[free[0]!]!, cols[free[1]!]!, cols[free[2]!]!, b);
      if (d === undefined) return undefined;
      step = [0, 0, 0, 0];
      free.forEach((i, k) => (step[i] = d[k]!));
    }
    x = clampX(ctx, x.map((xi, i) => xi + step[i]!));
  }
  return undefined;
}

/**
 * The parameter direction `(du, dv)` with `du S_u + dv S_v` closest to `t` (2×2 normal
 * equations); `undefined` at a degenerate point.
 */
export function tangentParams(d: SurfaceDerivs3, t: Vec3): readonly [number, number] | undefined {
  return solveSym2(dot3(d.su, d.su), dot3(d.su, d.sv), dot3(d.sv, d.sv), dot3(t, d.su), dot3(t, d.sv));
}

/**
 * The local closest point of `p` on patch `which` from `(u0, v0)` (M1 `refineProjection` with the
 * patch clamp, no distance stop, at most 24 steps); `undefined` if evaluation fails.
 */
export function footOn(ctx: SsiContext, which: 'A' | 'B', p: Point3, u0: number, v0: number): { readonly u: number; readonly v: number; readonly d: SurfaceDerivs3; readonly distance: number } | undefined {
  const s = which === 'A' ? ctx.A.surface : ctx.B.surface;
  const k = which === 'A' ? 0 : 2;
  const clampUV = (u: number, v: number): readonly [number, number] => {
    const c = clampX(ctx, k === 0 ? [u, v, 0, 0] : [0, 0, u, v]);
    return [c[k]!, c[k + 1]!];
  };
  const [u, v] = clampUV(u0, v0);
  const r = refineProjection(s, p, u, v, { clamp: clampUV, stopDistance: 0, stepTol: 1e-15 * (1 + length3(p)), maxSteps: 24 });
  if (!r.ok) return undefined;
  return { u: r.value.u, v: r.value.v, d: r.value.derivs, distance: r.value.distance };
}

/** A converged tangential contact. */
export interface Contact {
  readonly x: X4;
  readonly point: Point3;
  /** Signed gap of A over B along B's normal. */
  readonly gap: number;
  /** Gap Hessian `[[h11, h12], [h12, h22]]` in A's parameters. */
  readonly h11: number;
  readonly h12: number;
  readonly h22: number;
  /** `|∇g|` at the end (a sine: `S_A,u · n_B` normalised). */
  readonly gradient: number;
  readonly sin: number;
  /** A's first fundamental form `[[iE, iF], [iF, iG]]` at the contact (to read the Hessian in 3D lengths). */
  readonly iE: number;
  readonly iF: number;
  readonly iG: number;
}

/** `II_B(a, b)` for the B-coordinates `a`, `b` of two tangent vectors. */
function secondForm(d: SurfaceDerivs3, n: Vec3, a: readonly [number, number], b: readonly [number, number]): number {
  const L = dot3(d.suu, n), M = dot3(d.suv, n), N = dot3(d.svv, n);
  return a[0] * b[0] * L + (a[0] * b[1] + a[1] * b[0]) * M + a[1] * b[1] * N;
}

/** Newton on the gap's critical point from `x0` (see the module comment); `undefined` if it fails. */
export function contactNewton(ctx: SsiContext, x0: X4): Contact | undefined {
  let x = clampX(ctx, x0);
  for (let it = 0; it < 40; it++) {
    const dA = evalAt(ctx.A.surface, x[0], x[1]);
    if (dA === undefined) return undefined;
    const foot = footOn(ctx, 'B', dA.point, x[2], x[3]);
    if (foot === undefined) return undefined;
    const dB = foot.d;
    const nB = unitNormal(dB);
    if (nB === ZERO) return undefined;
    const gap = dot3(sub3(dA.point, dB.point), nB);
    const g1 = dot3(dA.su, nB), g2 = dot3(dA.sv, nB);
    const aU = tangentParams(dB, dA.su), aV = tangentParams(dB, dA.sv);
    if (aU === undefined || aV === undefined) return undefined;
    const h11 = dot3(dA.suu, nB) - secondForm(dB, nB, aU, aU);
    const h12 = dot3(dA.suv, nB) - secondForm(dB, nB, aU, aV);
    const h22 = dot3(dA.svv, nB) - secondForm(dB, nB, aV, aV);
    const scale = Math.max(length3(dA.su), length3(dA.sv));
    const gradient = Math.hypot(g1, g2) / scale;
    const xNow: X4 = [x[0], x[1], foot.u, foot.v];
    const nA = unitNormal(dA);
    const done = (): Contact =>
      Object.freeze({
        x: xNow, point: dA.point, gap, h11, h12, h22, gradient, sin: length3(cross3(nA, nB)),
        iE: dot3(dA.su, dA.su), iF: dot3(dA.su, dA.sv), iG: dot3(dA.sv, dA.sv),
      });
    if (gradient <= 1e-12) return done();
    const step = solveSym2(h11, h12, h22, -g1, -g2);
    if (step === undefined) return gradient <= 1e-9 ? done() : undefined;
    const next = clampX(ctx, [x[0] + step[0], x[1] + step[1], foot.u, foot.v]);
    const moved = Math.abs(next[0] - x[0]) + Math.abs(next[1] - x[1]);
    x = next;
    if (!(moved > 1e-14 * (1 + Math.abs(x[0]) + Math.abs(x[1])))) return gradient <= 1e-9 ? done() : undefined;
  }
  return undefined;
}

