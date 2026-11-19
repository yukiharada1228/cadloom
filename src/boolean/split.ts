/**
 * Edge splitting for the imprint stage of the boolean: the parameter partition of an edge at its cuts, curves and
 * pcurves restricted to a parameter window, and the pcurves of the pieces of a split coedge.
 *
 * - `splitIntervals(t0, t1, cuts)`: the cuts must increase strictly inside `(t0, t1)`; the pieces are
 *   `[t0, c1], [c1, c2], ..., [ck, t1]` — the Lean `Imprint.splitIntervals` (`(t0 :: cs).zip (cs ++ [t1])`):
 *   consecutive pieces share their end points, each piece is increasing, the first starts at `t0`, the last ends
 *   at `t1`, the lengths add up to `t1 - t0` and every parameter of `[t0, t1]` lies in a piece
 *   (`splitIntervals_*` in `formal/CadloomFormal/Imprint.lean`).
 * - `restrictCurve(curve, t0, t1)`: the curve over `[t0, t1]` with the same parametrisation: an analytic curve with
 *   its range replaced, a NURBS curve cut out by knot insertion (`nurbsSubCurve`, exact up to the rounding of
 *   Boehm's algorithm, M0 `insertKnot`).
 * - `splitPcurve`: the pcurve of a coedge (a 2D NURBS curve in its face's `(u, v)`, running in the coedge's
 *   direction) cut at the points where its edge is cut. On a plane with an analytic edge the pieces are the exact
 *   M2 `planePcurve`s of the sub-edges; otherwise the pcurve parameter of each cut point is located by lifting the
 *   pcurve (`S(pc(σ))`, closest to the cut point: sampled bracket then golden section, accepted within
 *   `zoneTol3d`) and the pcurve is cut there by knot insertion, so the pieces are the original pcurve itself.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/boolean/topology_intersector`
 * (imprinting splits edges at the proto vertices of the intersection), `solidcore/crates/solidcore/src/topology/edge.rs`
 * (an edge split keeps its curve and narrows the interval), `solidcore/crates/solidcore/src/nurbs/crv_nurb.rs`
 * (curve splitting by knot insertion), `solidcore/docs/booleans.md` (stage 2 "imprint") — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { createNurbsCurve3, curveRange, type Curve3 } from '../curve/types.ts';
import { distance3, type Point3 } from '../math/vec.ts';
import { createNurbsCurve, curveDomain, evaluateCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { insertKnot } from '../nurbs/insert.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import type { Surface3 } from '../surface/types.ts';
import { planePcurve } from '../topology/geometry.ts';

const OP = 'boolean.split';

/** One piece `[a, b]` of a split parameter interval. */
export type ParamInterval = readonly [number, number];

/**
 * The pieces of `[t0, t1]` cut at `cuts` (Lean `splitIntervals`). Fails with `invalid-input` unless `t0 < t1`,
 * all values are finite and the cuts increase strictly inside `(t0, t1)`.
 */
export function splitIntervals(t0: number, t1: number, cuts: readonly number[]): Result<readonly ParamInterval[]> {
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && t0 < t1)) return invalidInput(OP, 'interval must be finite with t0 < t1');
  let prev = t0;
  for (const c of cuts) {
    if (!Number.isFinite(c) || !(c > prev) || !(c < t1)) return invalidInput(OP, 'cuts must increase strictly inside (t0, t1)');
    prev = c;
  }
  const starts = [t0, ...cuts];
  const ends = [...cuts, t1];
  return ok(Object.freeze(starts.map((a, i) => Object.freeze([a, ends[i]!] as const))));
}

/**
 * `curve` split at the interior parameter `u` into `[left, right]` (left over `[lo, u]`, right over `[u, hi]`): `u`
 * is inserted up to multiplicity `degree` and the control points are shared at `C(u)`.
 */
export function splitNurbsAt(curve: NurbsCurve, u: number): Result<readonly [NurbsCurve, NurbsCurve]> {
  const [lo, hi] = curveDomain(curve);
  if (!(Number.isFinite(u) && u > lo && u < hi)) return invalidInput(OP, `split parameter ${u} is not inside (${lo}, ${hi})`);
  const p = curve.degree;
  const mult = curve.knots.filter((k) => k === u).length;
  let c = curve;
  if (mult < p) {
    const ins = insertKnot(curve, u, p - mult);
    if (!ins.ok) return ins;
    c = ins.value;
  }
  const U = c.knots;
  const j = U.indexOf(u);
  if (j < 1) return err({ kind: 'invalid-input', operation: OP, reason: 'knot insertion lost the split knot' });
  const P = c.controlPoints;
  const W = c.weights;
  const leftKnots = [...U.slice(0, j + p), u];
  const rightKnots = [u, ...U.slice(j)];
  const left = createNurbsCurve(p, leftKnots, P.slice(0, j), W?.slice(0, j));
  if (!left.ok) return left;
  const right = createNurbsCurve(p, rightKnots, P.slice(j - 1), W?.slice(j - 1));
  if (!right.ok) return right;
  return ok(Object.freeze([left.value, right.value] as const));
}

/** The part of a NURBS curve over `[a, b]` (inside its domain, `a < b`) as a curve whose domain is `[a, b]`. */
export function nurbsSubCurve(curve: NurbsCurve, a: number, b: number): Result<NurbsCurve> {
  const [lo, hi] = curveDomain(curve);
  if (!(Number.isFinite(a) && Number.isFinite(b) && lo <= a && a < b && b <= hi)) return invalidInput(OP, `window [${a}, ${b}] is not inside [${lo}, ${hi}]`);
  let c = curve;
  if (a > lo) {
    const s = splitNurbsAt(c, a);
    if (!s.ok) return s;
    c = s.value[1];
  }
  if (b < hi) {
    const s = splitNurbsAt(c, b);
    if (!s.ok) return s;
    c = s.value[0];
  }
  return ok(c);
}

/**
 * The curve over `[t0, t1]` (inside its range) with the same parameter: an analytic curve with that range, a NURBS
 * curve cut out by `nurbsSubCurve`. The whole range returns the curve itself.
 */
export function restrictCurve(curve: Curve3, t0: number, t1: number): Result<Curve3> {
  const [r0, r1] = curveRange(curve);
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && t0 < t1)) return invalidInput(OP, 'window must be finite with t0 < t1');
  if (t0 === r0 && t1 === r1) return ok(curve);
  if (curve.kind === 'nurbs') {
    const sub = nurbsSubCurve(curve.curve, Math.max(t0, r0), Math.min(t1, r1));
    if (!sub.ok) return sub;
    return createNurbsCurve3(sub.value);
  }
  if (curve.kind === 'line') {
    if (t0 < r0 || t1 > r1) return invalidInput(OP, 'window leaves the line range');
  } else if (t1 - t0 > 2 * Math.PI * (1 + 1e-12)) return invalidInput(OP, 'angular window exceeds 2π');
  return ok(Object.freeze({ ...curve, range: Object.freeze([t0, t1] as const) }));
}

/** `S(pc(σ))`. */
function liftPcurve(surface: Surface3, pc: NurbsCurve, s: number): Result<Point3> {
  const uv = evaluateCurve(pc, s);
  if (!uv.ok) return uv;
  return surfacePoint3(surface, uv.value[0]!, uv.value[1]!);
}

const LOCATE_SAMPLES = 64;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * The pcurve parameter `σ` whose lift `S(pc(σ))` is closest to `point` (sampled bracket, then golden section).
 * Fails with `invalid-input` when the closest lift is farther than `zoneTol3d` from the point.
 */
export function locateOnPcurve(kernel: Kernel, surface: Surface3, pc: NurbsCurve, point: Point3): Result<number> {
  const [a, b] = curveDomain(pc);
  let best = -1, bestD = Infinity;
  const at = (i: number): number => (i === LOCATE_SAMPLES ? b : a + ((b - a) * i) / LOCATE_SAMPLES);
  for (let i = 0; i <= LOCATE_SAMPLES; i++) {
    const p = liftPcurve(surface, pc, at(i));
    if (!p.ok) return p;
    const d = distance3(p.value, point);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  let lo = at(Math.max(0, best - 1)), hi = at(Math.min(LOCATE_SAMPLES, best + 1));
  const dist = (s: number): Result<number> => {
    const p = liftPcurve(surface, pc, s);
    return p.ok ? ok(distance3(p.value, point)) : p;
  };
  let x1 = hi - GOLDEN * (hi - lo), x2 = lo + GOLDEN * (hi - lo);
  let f1 = dist(x1), f2 = dist(x2);
  for (let k = 0; k < 90 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo), Math.abs(hi)); k++) {
    if (!f1.ok) return f1;
    if (!f2.ok) return f2;
    if (f1.value <= f2.value) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - GOLDEN * (hi - lo);
      f1 = dist(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + GOLDEN * (hi - lo);
      f2 = dist(x2);
    }
  }
  let s = (lo + hi) / 2;
  const dm = dist(s);
  if (!dm.ok) return dm;
  let d = dm.value;
  // The sampled end points are exact candidates too (a cut at the very end of the pcurve).
  if (bestD < d) {
    s = at(best);
    d = bestD;
  }
  if (!(d <= kernel.tolerances.zoneTol3d)) return invalidInput(OP, `point is ${d} from the lifted pcurve`);
  return ok(Math.min(b, Math.max(a, s)));
}

/**
 * The pcurves of the pieces of a coedge whose edge (`curve` over `[t0, t1]`) is cut into `pieces` (edge order, from
 * `splitIntervals`), each in the coedge's direction (`reversed`: from the piece's end to its start). Returned in
 * edge order. `undefined` when the coedge has no pcurve and its face is not a plane (see the module comment).
 */
export function splitPcurve(
  kernel: Kernel,
  surface: Surface3,
  edge: { readonly curve: Curve3; readonly t0: number; readonly t1: number },
  pcurve: NurbsCurve | undefined,
  reversed: boolean,
  pieces: readonly ParamInterval[],
): Result<readonly (NurbsCurve | undefined)[]> {
  if (pieces.length === 1 && pcurve !== undefined) return ok([pcurve]);
  if (surface.kind === 'plane' && edge.curve.kind !== 'nurbs') {
    const out: NurbsCurve[] = [];
    for (const [a, b] of pieces) {
      const pc = planePcurve(kernel, surface, { curve: edge.curve, t0: a, t1: b }, reversed);
      if (!pc.ok) return pc;
      out.push(pc.value);
    }
    return ok(out);
  }
  if (pcurve === undefined) return ok(pieces.map(() => undefined));
  // Pcurve parameters of the cut points, in edge order (they decrease along the edge when the coedge is reversed).
  const sigmas: number[] = [];
  for (let i = 1; i < pieces.length; i++) {
    const p = curvePoint3(edge.curve, pieces[i]![0]);
    if (!p.ok) return p;
    const s = locateOnPcurve(kernel, surface, pcurve, p.value);
    if (!s.ok) return s;
    sigmas.push(s.value);
  }
  const [a, b] = curveDomain(pcurve);
  const bounds = reversed ? [b, ...sigmas, a] : [a, ...sigmas, b];
  const out: NurbsCurve[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const x = bounds[i]!, y = bounds[i + 1]!;
    const lo = Math.min(x, y), hi = Math.max(x, y);
    if (!(lo < hi)) return invalidInput(OP, 'cut points do not advance along the pcurve');
    const sub = nurbsSubCurve(pcurve, lo, hi);
    if (!sub.ok) return sub;
    out.push(sub.value);
  }
  return ok(out);
}
