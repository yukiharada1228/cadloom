/**
 * Curve sampling for display: the parameters along a `Curve3` at which its polyline is drawn, by the chord and
 * angle rules of a `MeshRules`. A B-rep edge is sampled once (`sampleEdge`), and both of its coedges read the
 * same numbers, so the faces on either side share their boundary points exactly.
 *
 * Rules:
 * - line: the end points only (split uniformly when longer than `maxEdgeLength`, into at most
 *   `MAX_LINE_SEGMENTS` segments);
 * - circle: a uniform angle step `θ = min(angle, π/2, 2 acos(1 - chord / r), maxEdgeLength / r)`; the
 *   sagitta of a step, `r (1 - cos(θ/2))`, is then at most `chord` (`sagitta`, Lean `sagitta_eq_gap`,
 *   `sagitta_le_iff`), and `n = ceil(sweep / θ)` steps of `sweep / n <= θ` (Lean `step_le`) cover the arc;
 * - ellipse: a uniform parameter step `Δ = min(angle · b / a, π/2, sqrt(8 chord / a), maxEdgeLength / a)`:
 *   with `|C''| <= a` a chord's deviation is at most `Δ² a / 8 <= chord`, and the tangent turns at most
 *   `Δ · a / b` per step;
 * - nurbs: adaptive bisection from the knot spans inside the interval (at least four segments for a closed
 *   curve): a segment is split while the curve at its midpoint or quarter points is farther than `chord`
 *   from the chord, its end tangents turn more than `angle`, or it is longer than `maxEdgeLength`; at most
 *   `MAX_BISECT_DEPTH` levels (a segment left unsplit by the cap is reported as `capped`).
 * No curve gets more than `MAX_SEGMENTS` segments (`capped` again).
 *
 * Upstream consulted (for the rules, not translated): `solidcore/crates/solidcore-tess/src/curve.rs`
 * (`curve_points`: chord and facet angle, four segments for a closed curve), `mesher/edges.rs` (each edge sampled
 * once, shared by its faces; bisection), `mesher/sag.rs` (sag of a chord) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { curvePoint3, curveTangent } from '../curve/evaluate.ts';
import { curveRange, type Curve3 } from '../curve/types.ts';
import { distance3, dot3, sub3, type Point3 } from '../math/vec.ts';
import { edgeParam } from '../topology/geometry.ts';
import type { MeshRules } from './tolerance.ts';

/** Segments per curve at most. */
export const MAX_SEGMENTS = 4096;
/**
 * Segments of a line at most. A line is split only for `maxEdgeLength`, which bounds the grid of a face to
 * `MAX_GRID` (256) lines per direction too; finer boundary splits would only make the face's triangulation
 * slower (its ear clipping is quadratic on dense straight runs), so the split stops here (reported as `capped`).
 */
export const MAX_LINE_SEGMENTS = 256;
/** Bisection levels of a NURBS segment at most. */
export const MAX_BISECT_DEPTH = 20;

/** Sample parameters (increasing, `t0` first and `t1` last), the points there, and whether a cap stopped it. */
export interface CurveSamples {
  readonly params: readonly number[];
  readonly points: readonly Point3[];
  readonly capped: boolean;
}

/** The sagitta `r (1 - cos(θ/2))` of a chord spanning the angle `θ` on a circle of radius `r` (Lean `sagitta`). */
export function sagitta(radius: number, theta: number): number {
  return radius * (1 - Math.cos(theta / 2));
}

/** The largest angle whose chord's sagitta on radius `r` is at most `chord`: `2 acos(1 - chord / r)` (`π` past `2r`). */
export function chordAngle(radius: number, chord: number): number {
  const c = 1 - chord / radius;
  return c <= -1 ? 2 * Math.PI : 2 * Math.acos(c);
}

/**
 * The number of uniform steps of an arc of radius `r` and sweep `sweep` (radians): `ceil(sweep / θ)` with the
 * step bound `θ` of the module comment, at least 1. `capped` when `MAX_SEGMENTS` limited it.
 */
export function circleStepCount(radius: number, sweep: number, rules: MeshRules): { readonly steps: number; readonly capped: boolean } {
  const theta = Math.min(rules.angle, Math.PI / 2, chordAngle(radius, rules.chord), rules.maxEdgeLength / radius);
  return stepCount(sweep, theta);
}

function stepCount(span: number, step: number, max = MAX_SEGMENTS): { readonly steps: number; readonly capped: boolean } {
  const n = step > 0 ? Math.ceil(span / step) : Infinity;
  if (!(n <= max)) return { steps: max, capped: true };
  return { steps: Math.max(1, n), capped: false };
}

/** Uniform parameters `edgeParam(t0, t1, k / n)`, `k = 0 .. n` (exactly `t1` last). */
function uniform(t0: number, t1: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(edgeParam(t0, t1, k / n));
  return out;
}

/** Distance from `p` to the segment `[a, b]`. */
export function distanceToSegment(p: Point3, a: Point3, b: Point3): number {
  const ab = sub3(b, a);
  const len2 = dot3(ab, ab);
  if (!(len2 > 0)) return distance3(p, a);
  const t = Math.min(1, Math.max(0, dot3(sub3(p, a), ab) / len2));
  return distance3(p, { x: a.x + t * ab.x, y: a.y + t * ab.y, z: a.z + t * ab.z });
}

function nurbsParams(curve: Curve3 & { kind: 'nurbs' }, t0: number, t1: number, rules: MeshRules): Result<{ params: number[]; capped: boolean }> {
  const at = (t: number): Result<Point3> => curvePoint3(curve, t);
  // Initial nodes: the interval ends and the distinct knots strictly inside.
  const nodes: number[] = [t0];
  for (const k of curve.curve.knots) if (k > nodes[nodes.length - 1]! && k < t1) nodes.push(k);
  nodes.push(t1);
  const p0 = at(t0), p1 = at(t1);
  if (!p0.ok) return p0;
  if (!p1.ok) return p1;
  let initial = nodes;
  if (distance3(p0.value, p1.value) <= rules.chord && nodes.length < 5) {
    initial = uniform(t0, t1, 4);
  }
  const out: number[] = [initial[0]!];
  let capped = false;
  let segments = 0;
  const cosAngle = Math.cos(rules.angle);
  // Explicit stack (depth-first, left to right) so the output is in increasing order.
  for (let i = 0; i + 1 < initial.length; i++) {
    const a0 = initial[i]!, b0 = initial[i + 1]!;
    const stack: { a: number; b: number; depth: number }[] = [{ a: a0, b: b0, depth: 0 }];
    while (stack.length > 0) {
      const { a, b, depth } = stack.pop()!;
      const pa = at(a), pb = at(b);
      if (!pa.ok) return pa;
      if (!pb.ok) return pb;
      let split = distance3(pa.value, pb.value) > rules.maxEdgeLength;
      for (const f of [0.25, 0.5, 0.75]) {
        if (split) break;
        const q = at(a + f * (b - a));
        if (!q.ok) return q;
        if (distanceToSegment(q.value, pa.value, pb.value) > rules.chord) split = true;
      }
      if (!split) {
        const ta = curveTangent(curve, a), tb = curveTangent(curve, b);
        if (ta.ok && tb.ok && dot3(ta.value, tb.value) < cosAngle) split = true;
      }
      const m = a + 0.5 * (b - a);
      if (split && depth < MAX_BISECT_DEPTH && m > a && m < b && segments + stack.length < MAX_SEGMENTS) {
        stack.push({ a: m, b, depth: depth + 1 }, { a, b: m, depth: depth + 1 });
      } else {
        if (split) capped = true;
        out.push(b);
        segments++;
      }
    }
  }
  return ok({ params: out, capped });
}

/**
 * The display samples of `curve` over `[t0, t1]` (inside its range), by the rules of the module comment.
 * Fails with `invalid-input` for an interval that is not finite and increasing inside the curve's range, and
 * with the evaluator's error where the curve does not evaluate.
 */
export function curvePoints(curve: Curve3, interval: readonly [number, number], rules: MeshRules): Result<CurveSamples> {
  const op = 'tess.curvePoints';
  const [t0, t1] = interval;
  const [r0, r1] = curveRange(curve);
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && t0 < t1)) return invalidInput(op, `interval [${t0}, ${t1}] is not finite and increasing`);
  const slack = 1e-12 * Math.max(1, Math.abs(r0), Math.abs(r1));
  if (!(t0 >= r0 - slack && t1 <= r1 + slack)) return invalidInput(op, `interval [${t0}, ${t1}] is outside the curve range [${r0}, ${r1}]`);
  const a = Math.max(t0, r0), b = Math.min(t1, r1);
  let params: number[];
  let capped = false;
  switch (curve.kind) {
    case 'line': {
      const len = Math.hypot(curve.direction.x, curve.direction.y, curve.direction.z) * (b - a);
      const n = stepCount(len, rules.maxEdgeLength, MAX_LINE_SEGMENTS);
      params = uniform(a, b, n.steps);
      capped = n.capped;
      break;
    }
    case 'circle': {
      const n = circleStepCount(curve.radius, b - a, rules);
      params = uniform(a, b, n.steps);
      capped = n.capped;
      break;
    }
    case 'ellipse': {
      const ma = curve.majorRadius, mb = curve.minorRadius;
      const step = Math.min((rules.angle * mb) / ma, Math.PI / 2, Math.sqrt((8 * rules.chord) / ma), rules.maxEdgeLength / ma);
      const n = stepCount(b - a, step);
      params = uniform(a, b, n.steps);
      capped = n.capped;
      break;
    }
    case 'nurbs': {
      const r = nurbsParams(curve, a, b, rules);
      if (!r.ok) return r;
      params = r.value.params;
      capped = r.value.capped;
      break;
    }
  }
  const points: Point3[] = [];
  for (const t of params) {
    const p = curvePoint3(curve, t);
    if (!p.ok) return p;
    points.push(p.value);
  }
  return ok(Object.freeze({ params: Object.freeze(params), points: Object.freeze(points), capped }));
}
