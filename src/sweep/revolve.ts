/**
 * Revolution of a planar profile about an axis in its plane into a solid B-rep, and its Pappus volume.
 *
 * `revolve(kernel, profile, axis, angle)` turns every region of the profile about `axis` (a point and a direction in
 * the profile plane's 2D coordinates, see `meridian.ts`) by `angle` radians, right-handed about the axis direction,
 * `0 < angle <= 2π`. The profile is first expressed in its meridian coordinates `(ρ, h)` (`meridianOf`: one side of
 * the axis, touching it only along segments that lie on it, material on the left of every wire).
 *
 * **Faces by segment** (analytic recognition; the surface's `u` is the turn from the profile, `0 .. Θ`):
 * - a line on the axis: no face (at a full turn); an edge of both end caps (at a partial turn);
 * - a line perpendicular to the axis (`|Δh| <= approxTol3d`): a **plane** (annulus, disc, or their sectors), its
 *   pcurves the exact `planePcurve`s;
 * - a line parallel to the axis (`|Δρ| <= approxTol3d`): a **cylinder**, `v` the height from the segment's start;
 * - any other line: a **cone**, `v` the height from the segment's start, base radius the start's `ρ` (0 at an
 *   apex), apex parameter `v = -R0 / tan α` where the line ends on the axis (as `makeCone`);
 * - an arc whose center is on the axis (`|c.ρ| <= approxTol3d`): a **sphere** about that center, `v` the latitude (the
 *   arc's meridian angle shifted into `[-π/2, π/2]`);
 * - any other arc with `c.ρ > r` (a ring torus): a **torus**, `v` the arc's angle;
 * - a NURBS segment, an arc of a horn or spindle torus, or an analytic surface that fails its construction or
 *   rounding check: the exact A8.1 surface of revolution `revolveCurveToNurbs` (M1) of the segment's NURBS form,
 *   `u` the A7.1 arc parameter (equal to the angle at its knots), `v` the segment's own parameter.
 * Each face is reversed when its surface's natural normal `S_u × S_v` points into the material (`v` running against
 * the segment, or a plane whose normal is the axis direction with the material above it).
 *
 * **Full turn** (`angle = 2π` up to `ROUNDING_SLACK`). Each wire of each region is split into its *runs*, the maximal
 * chains of segments not on the axis (a wire that does not touch the axis is one cyclic run); every run is one
 * closed shell (an outer shell, a void shell for each hole, a separate shell for each notch closed off by the
 * axis), all in the region's body. For a run of segments `i = 0 .. n-1` with vertex positions `k` (cyclic, or
 * `0 .. n` with poles at both ends):
 * - vertices: position `k` in order when it is off the axis or a curved (non-planar) face's meridian ends there;
 * - edges: the full circle `c_k` (closed at its vertex) of every position off the axis, in order, then the meridian
 *   `m_i` (the segment on the half-plane `u = 0`, a seam) of every curved segment, in order;
 * - faces: one per segment; a curved face has the loop `[c_i fwd on v = v0, m_i fwd on u = 2π, c_{i+1} rev on
 *   v = v1, m_i rev on u = 0]` (circles absent at a pole: the loop then jumps along the collapsed iso-line, the
 *   pole gap of `uvGapCollapses`, as `makeSphere` / `makeCone`); a planar face has one loop per circle that exists
 *   (`[c_i fwd]`, `[c_{i+1} rev]`), the larger radius (outer) first.
 *   A cyclic run of `N` segments, `M` of them curved, has `V = N`, `E = N + M`, `F = N`, `L = 2N - M`: genus 1
 *   (`formal/CadloomFormal/Sweep.lean`, `full_euler_poincare`; Lean `fullModel` has these ids and coedge orders).
 * **Partial turn** (refused when a vertex off the axis would lie within `zoneTol3d` of its turned copy, at distance
 * `2 ρ sin(Θ/2)`: a turn too small, or so close to 2π that the end cap would touch the start cap). One shell per
 * region; with `g` the segments of all its wires in order (outer first):
 * - vertices: `v_g` the start of every segment (in the profile), then `w_g` its turned copy for every `g` off the
 *   axis (a vertex on the axis is its own copy);
 * - edges: the arc `a_g` (`v_g → w_g`, the circle of the vertex over `[0, Θ]`) of every `g` off the axis, the
 *   profile edge `p_g` (`v_g → v_next`, on the half-plane `u = 0`) of every segment, the turned edge `q_g`
 *   (`w_g → w_next`, on the half-plane `u = Θ`) of every segment not on the axis;
 * - faces: the start cap (the half-plane `u = 0`, normal `-Y`, loops the wires forwards), the end cap (the half-plane
 *   `u = Θ`, reversed, loops the wires backwards, an axis segment's `p_g` standing for its `q_g`), then one side face
 *   per segment not on the axis with the loop `[a_g fwd, q_g fwd, a_next rev, p_g rev]`.
 *   Without axis contact `V = 2N`, `E = 3N`, `F = N + 2`, `L = N + 2 (1 + H)`: genus `H`, the number of holes
 *   (`partial_euler_poincare`; Lean `partialModel` has these ids and coedge orders).
 * The B-rep is checked by `validateBrepGeometry` before it is returned.
 *
 * `revolveVolume(kernel, profile, axis, angle)` is Pappus: `Θ ∫∫ ρ dA`, the Green moment `mx` (`wireGreen` of
 * `src/profile`, exact for lines and arcs) of the meridian wires — which for a line is the frustum term
 * `(h1 - h0)(ρ0² + ρ0 ρ1 + ρ1²) / 6` (`formal/CadloomFormal/Sweep.lean`: `pappus_polygon`, `pappus_triangle`), so
 * `Θ · area · ρ̄` with `ρ̄` the centroid's distance from the axis.
 *
 * Upstream consulted (for the recognition, the topology and the refusals, not translated):
 * `solidcore/crates/solidcore/src/sweep/analytic_revolution.rs` (cylinder for a line parallel to the axis, cone for
 * another line not perpendicular to it, sphere for an arc centred on the axis, torus for one off it; `u` the turn,
 * `v` the curve), `sweep/rotational_sweep_geometry.rs` (the B-spline surface of revolution, degenerate sides on the
 * axis), `sweep/api_brep.rs` (`rotational_sweep`: end caps for a partial turn, seams for a whole one),
 * `primitive/primitive_creation/p2/rotational.rs`, `mass/` (Pappus) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, scale3, type Point2, type Point3 } from '../math/vec.ts';
import { createCircleCurve, ROUNDING_SLACK, TWO_PI } from '../curve/types.ts';
import { curveDomain } from '../nurbs/curve.ts';
import {
  createConeSurface,
  createCylinderSurface,
  createNurbsSurface3,
  createPlaneSurface,
  createSphereSurface,
  createTorusSurface,
  type PlaneSurface,
  type Surface3,
} from '../surface/types.ts';
import { revolveCurveToNurbs } from '../surface/nurbs-form.ts';
import { BrepBuilder, type Brep, type CoedgeUse, type EdgeId, type ShellId, type VertexId } from '../topology/brep.ts';
import { planePcurve, uvSegment, validateBrepGeometry } from '../topology/geometry.ts';
import { wireGreen } from '../profile/area.ts';
import type { Profile } from '../profile/profile.ts';
import type { Segment2 } from '../profile/segment.ts';
import { meridianOf, type Meridian, type MeridianWire, type RevolveAxis } from './meridian.ts';
import { onPlane, placeSegment, segmentNurbs3, type EdgeGeom } from '../prism/layout.ts';

const OP = 'sweep.revolve';
const HALF_PI = Math.PI / 2;

/** The turn: `Θ` (exactly `2π` for a full turn) and whether it is full. */
interface Turn {
  readonly theta: number;
  readonly full: boolean;
}

function turnOf(angle: number): Result<Turn> {
  if (!Number.isFinite(angle) || !(angle > 0)) return invalidInput(OP, 'the angle must be finite and positive');
  if (angle > TWO_PI * (1 + ROUNDING_SLACK)) return invalidInput(OP, 'the angle exceeds 2π');
  const full = Math.abs(angle - TWO_PI) <= TWO_PI * ROUNDING_SLACK;
  return ok({ theta: full ? TWO_PI : angle, full });
}

/** The surface of a side face and where the segment's ends lie on its `v` (non-planar faces). */
interface SideGeom {
  readonly surface: Surface3;
  readonly reversed: boolean;
  /** The plane, when the face is planar (its pcurves are then `planePcurve`s). */
  readonly plane?: PlaneSurface;
  readonly v0: number;
  readonly v1: number;
}

/** The axis point at height `h`. */
const axisAt = (m: Meridian, h: number): Point3 => add3(m.axisPoint, scale3(m.frame.normal, h));

/** `x - 2πk` with `k` chosen so that `mid - 2πk` lies within half a period of `centre`. */
const shiftBy = (mid: number, centre: number): number => TWO_PI * Math.round((mid - centre) / TWO_PI);

/** The exact A8.1 surface of revolution of a segment (the fallback of every kind). */
function nurbsSide(m: Meridian, seg: Segment2, theta: number): Result<SideGeom> {
  const c = segmentNurbs3(m.plane, seg);
  if (!c.ok) return c;
  const s = revolveCurveToNurbs(c.value, m.axisPoint, m.frame.normal, 0, theta);
  if (!s.ok) return s;
  const s3 = createNurbsSurface3(s.value);
  if (!s3.ok) return s3;
  const [v0, v1] = curveDomain(c.value);
  return ok({ surface: s3.value, reversed: false, v0, v1 });
}

/** The face geometry of a segment that is not on the axis (see the module comment). */
function sideGeom(kernel: Kernel, m: Meridian, seg: Segment2, p0: Point2, p1: Point2, on0: boolean, on1: boolean, theta: number): Result<SideGeom> {
  const tol = kernel.tolerances.approxTol3d;
  const { normal: Z, xAxis: X } = m.frame;
  if (seg.kind === 'line') {
    const dr = p1.x - p0.x, dh = p1.y - p0.y;
    if (Math.abs(dh) <= tol) {
      const plane = createPlaneSurface(kernel, axisAt(m, (p0.y + p1.y) / 2), Z, X);
      if (!plane.ok) return plane;
      return ok({ surface: plane.value, reversed: dr > 0, plane: plane.value, v0: 0, v1: 0 });
    }
    if (Math.abs(dr) <= tol && !on0 && !on1) {
      const cyl = createCylinderSurface(kernel, axisAt(m, p0.y), Z, X, (p0.x + p1.x) / 2);
      if (cyl.ok) return ok({ surface: cyl.value, reversed: dh < 0, v0: 0, v1: dh });
      return nurbsSide(m, seg, theta);
    }
    const base = on0 ? 0 : p0.x;
    const cone = createConeSurface(kernel, axisAt(m, p0.y), Z, X, base, Math.atan(dr / dh));
    if (cone.ok) {
      const t = Math.tan(cone.value.semiAngle);
      const v1 = on1 ? -base / t : dh;
      if (Number.isFinite(v1) && Math.abs(base + t * dh - p1.x) <= tol) return ok({ surface: cone.value, reversed: dh < 0, v0: 0, v1 });
    }
    return nurbsSide(m, seg, theta);
  }
  if (seg.kind === 'arc') {
    const { center: c, radius: r } = seg;
    const mid = (seg.startAngle + seg.endAngle) / 2;
    if (Math.abs(c.x) <= tol) {
      const k = shiftBy(mid, 0);
      const clampLat = (x: number): number => Math.min(HALF_PI, Math.max(-HALF_PI, x));
      const a0 = seg.startAngle - k, a1 = seg.endAngle - k;
      if (Math.max(Math.abs(a0), Math.abs(a1)) <= HALF_PI * (1 + 1e-9)) {
        const sph = createSphereSurface(kernel, axisAt(m, c.y), Z, X, r);
        if (sph.ok) return ok({ surface: sph.value, reversed: !seg.ccw, v0: clampLat(a0), v1: clampLat(a1) });
      }
      return nurbsSide(m, seg, theta);
    }
    if (c.x > r) {
      const k = shiftBy(mid, 0);
      const tor = createTorusSurface(kernel, axisAt(m, c.y), Z, X, c.x, r);
      if (tor.ok) return ok({ surface: tor.value, reversed: !seg.ccw, v0: seg.startAngle - k, v1: seg.endAngle - k });
    }
    return nurbsSide(m, seg, theta);
  }
  return nurbsSide(m, seg, theta);
}

/** Builder state shared by the full and partial layouts. */
interface Ctx {
  readonly kernel: Kernel;
  readonly m: Meridian;
  readonly theta: number;
  /** The half-plane `u = Θ` (`(u, v) = (ρ, h)`). */
  readonly endPlane: PlaneSurface;
}

/** The circle (arc over `[0, Θ]`) of a meridian point about the axis. */
function circleOf(ctx: Ctx, p: Point2): Result<EdgeGeom> {
  const { m } = ctx;
  const c = createCircleCurve(ctx.kernel, axisAt(m, p.y), m.frame.normal, m.frame.xAxis, p.x, [0, ctx.theta]);
  return c.ok ? ok({ curve: c.value, t0: 0, t1: ctx.theta }) : c;
}

/** The coedge of a side face: straight `(u, v)` pcurve on a curved face, `planePcurve` on a planar one. */
function sideUse(ctx: Ctx, side: SideGeom, edge: EdgeId, geom: EdgeGeom, reversed: boolean, line: readonly [number, number, number, number]): Result<CoedgeUse> {
  const pc = side.plane !== undefined ? planePcurve(ctx.kernel, side.plane, geom, reversed) : uvSegment(...line);
  if (!pc.ok) return pc;
  return ok({ edge, reversed, pcurve: pc.value });
}

/**
 * One closed shell of a full turn: the run `segs` (indices into `w`), cyclic or from a pole to a pole.
 */
function buildFullRun(ctx: Ctx, b: BrepBuilder, shell: ShellId, w: MeridianWire, segs: readonly number[], cyclic: boolean): Result<void> {
  const { kernel, m, theta } = ctx;
  const n = segs.length;
  const K = cyclic ? n : n + 1;
  const wn = w.segments.length;
  const wireIndex = (k: number): number => (k < n ? segs[k]! : (segs[n - 1]! + 1) % wn);
  const pos = (k: number): Point2 => w.starts[wireIndex(k)]!;
  const on = (k: number): boolean => w.onAxis[wireIndex(k)]!;
  const after = (i: number): number => (cyclic ? (i + 1) % n : i + 1);

  const sides: SideGeom[] = [];
  for (let i = 0; i < n; i++) {
    const g = segs[i]!;
    const s = sideGeom(kernel, m, w.segments[g]!, pos(i), pos(after(i)), on(i), on(after(i)), theta);
    if (!s.ok) return s;
    sides.push(s.value);
  }
  const curved = (i: number): boolean => sides[i]!.plane === undefined;

  const vid: (VertexId | undefined)[] = [];
  for (let k = 0; k < K; k++) {
    const before = cyclic ? (k + n - 1) % n : k - 1;
    const need = !on(k) || (before >= 0 && curved(before)) || (k < n && curved(k));
    vid.push(need ? b.addVertex(onPlane(m.plane, pos(k).x, pos(k).y)) : undefined);
  }
  const circleGeom: (EdgeGeom | undefined)[] = [];
  const circle: (EdgeId | undefined)[] = [];
  for (let k = 0; k < K; k++) {
    if (on(k)) {
      circleGeom.push(undefined);
      circle.push(undefined);
      continue;
    }
    const c = circleOf(ctx, pos(k));
    if (!c.ok) return c;
    circleGeom.push(c.value);
    circle.push(b.addEdge(vid[k]!, vid[k]!, c.value.curve, c.value.t0, c.value.t1));
  }
  const meridian: (EdgeId | undefined)[] = [];
  for (let i = 0; i < n; i++) {
    if (!curved(i)) {
      meridian.push(undefined);
      continue;
    }
    const k1 = after(i);
    const pa = pos(i), pb = pos(k1);
    const geom = placeSegment(kernel, m.plane, w.segments[segs[i]!]!, onPlane(m.plane, pa.x, pa.y), onPlane(m.plane, pb.x, pb.y));
    if (!geom.ok) return geom;
    meridian.push(b.addEdge(vid[i]!, vid[k1]!, geom.value.curve, geom.value.t0, geom.value.t1));
  }

  for (let i = 0; i < n; i++) {
    const side = sides[i]!;
    const k0 = i, k1 = after(i);
    const face = b.addFace(shell, side.surface, side.reversed);
    if (curved(i)) {
      const { v0, v1 } = side;
      const uses: CoedgeUse[] = [];
      const push = (u: Result<CoedgeUse>): Result<void> => {
        if (!u.ok) return u;
        uses.push(u.value);
        return ok(undefined);
      };
      if (circle[k0] !== undefined) {
        const r = push(sideUse(ctx, side, circle[k0]!, circleGeom[k0]!, false, [0, v0, theta, v0]));
        if (!r.ok) return r;
      }
      const mf = uvSegment(theta, v0, theta, v1);
      if (!mf.ok) return mf;
      uses.push({ edge: meridian[i]!, reversed: false, pcurve: mf.value });
      if (circle[k1] !== undefined) {
        const r = push(sideUse(ctx, side, circle[k1]!, circleGeom[k1]!, true, [theta, v1, 0, v1]));
        if (!r.ok) return r;
      }
      const mr = uvSegment(0, v1, 0, v0);
      if (!mr.ok) return mr;
      uses.push({ edge: meridian[i]!, reversed: true, pcurve: mr.value });
      b.addLoop(face, uses);
    } else {
      const loops: { readonly radius: number; readonly use: CoedgeUse }[] = [];
      for (const [k, rev] of [[k0, false], [k1, true]] as const) {
        if (circle[k] === undefined) continue;
        const u = sideUse(ctx, side, circle[k]!, circleGeom[k]!, rev, [0, 0, 0, 0]);
        if (!u.ok) return u;
        loops.push({ radius: pos(k).x, use: u.value });
      }
      if (loops.length === 2 && loops[1]!.radius > loops[0]!.radius) loops.reverse();
      for (const l of loops) b.addLoop(face, [l.use]);
    }
  }
  return ok(undefined);
}

/** The runs of a wire at a full turn: maximal chains of segments not on the axis (one cyclic run without contact). */
function runsOf(w: MeridianWire): { readonly segs: readonly number[]; readonly cyclic: boolean }[] {
  const n = w.segments.length;
  const firstAxis = w.axisSegment.indexOf(true);
  if (firstAxis < 0) return [{ segs: Array.from({ length: n }, (_, i) => i), cyclic: true }];
  const runs: { segs: number[]; cyclic: boolean }[] = [];
  let cur: number[] = [];
  for (let j = 1; j <= n; j++) {
    const g = (firstAxis + j) % n;
    if (w.axisSegment[g]!) {
      if (cur.length > 0) runs.push({ segs: cur, cyclic: false });
      cur = [];
    } else {
      cur.push(g);
    }
  }
  return runs;
}

/** One region at a partial turn: one shell (see the module comment). */
function buildPartialRegion(ctx: Ctx, b: BrepBuilder, wires: readonly MeridianWire[]): Result<void> {
  const { kernel, m, theta, endPlane } = ctx;
  const shell = b.addShell(b.addBody());
  type Item = { readonly w: MeridianWire; readonly g: number; readonly next: number };
  const items: Item[] = [];
  const wireStart: number[] = [];
  for (const w of wires) {
    const o = items.length;
    wireStart.push(o);
    const n = w.segments.length;
    for (let g = 0; g < n; g++) items.push({ w, g, next: o + ((g + 1) % n) });
  }
  const N = items.length;
  const start = (x: number): Point2 => items[x]!.w.starts[items[x]!.g]!;
  const on = (x: number): boolean => items[x]!.w.onAxis[items[x]!.g]!;
  const axisSeg = (x: number): boolean => items[x]!.w.axisSegment[items[x]!.g]!;
  const segOf = (x: number): Segment2 => items[x]!.w.segments[items[x]!.g]!;

  const v: VertexId[] = [];
  for (let x = 0; x < N; x++) v.push(b.addVertex(onPlane(m.plane, start(x).x, start(x).y)));
  const wv: VertexId[] = [];
  for (let x = 0; x < N; x++) wv.push(on(x) ? v[x]! : b.addVertex(onPlane(endPlane, start(x).x, start(x).y)));

  const arcGeom: (EdgeGeom | undefined)[] = [];
  const arc: (EdgeId | undefined)[] = [];
  for (let x = 0; x < N; x++) {
    if (on(x)) {
      arcGeom.push(undefined);
      arc.push(undefined);
      continue;
    }
    const c = circleOf(ctx, start(x));
    if (!c.ok) return c;
    arcGeom.push(c.value);
    arc.push(b.addEdge(v[x]!, wv[x]!, c.value.curve, c.value.t0, c.value.t1));
  }
  const pGeom: EdgeGeom[] = [];
  const p: EdgeId[] = [];
  for (let x = 0; x < N; x++) {
    const nx = items[x]!.next;
    const g = placeSegment(kernel, m.plane, segOf(x), onPlane(m.plane, start(x).x, start(x).y), onPlane(m.plane, start(nx).x, start(nx).y));
    if (!g.ok) return g;
    pGeom.push(g.value);
    p.push(b.addEdge(v[x]!, v[nx]!, g.value.curve, g.value.t0, g.value.t1));
  }
  const qGeom: (EdgeGeom | undefined)[] = [];
  const q: (EdgeId | undefined)[] = [];
  for (let x = 0; x < N; x++) {
    if (axisSeg(x)) {
      qGeom.push(undefined);
      q.push(undefined);
      continue;
    }
    const nx = items[x]!.next;
    const g = placeSegment(kernel, endPlane, segOf(x), onPlane(endPlane, start(x).x, start(x).y), onPlane(endPlane, start(nx).x, start(nx).y));
    if (!g.ok) return g;
    qGeom.push(g.value);
    q.push(b.addEdge(wv[x]!, wv[nx]!, g.value.curve, g.value.t0, g.value.t1));
  }

  // Caps.
  const startCap = b.addFace(shell, m.plane, false);
  for (const [k, w] of wires.entries()) {
    const uses: CoedgeUse[] = [];
    for (let j = 0; j < w.segments.length; j++) {
      const x = wireStart[k]! + j;
      const pc = planePcurve(kernel, m.plane, pGeom[x]!, false);
      if (!pc.ok) return pc;
      uses.push({ edge: p[x]!, reversed: false, pcurve: pc.value });
    }
    b.addLoop(startCap, uses);
  }
  const endCap = b.addFace(shell, endPlane, true);
  for (const [k, w] of wires.entries()) {
    const uses: CoedgeUse[] = [];
    for (let j = w.segments.length - 1; j >= 0; j--) {
      const x = wireStart[k]! + j;
      const [edge, geom] = axisSeg(x) ? [p[x]!, pGeom[x]!] : [q[x]!, qGeom[x]!];
      const pc = planePcurve(kernel, endPlane, geom, true);
      if (!pc.ok) return pc;
      uses.push({ edge, reversed: true, pcurve: pc.value });
    }
    b.addLoop(endCap, uses);
  }

  // Sides.
  for (let x = 0; x < N; x++) {
    if (axisSeg(x)) continue;
    const nx = items[x]!.next;
    const side = sideGeom(kernel, m, segOf(x), start(x), start(nx), on(x), on(nx), theta);
    if (!side.ok) return side;
    const s = side.value;
    const { v0, v1 } = s;
    const face = b.addFace(shell, s.surface, s.reversed);
    const uses: CoedgeUse[] = [];
    const parts: [EdgeId | undefined, EdgeGeom | undefined, boolean, readonly [number, number, number, number]][] = [
      [arc[x], arcGeom[x], false, [0, v0, theta, v0]],
      [q[x], qGeom[x], false, [theta, v0, theta, v1]],
      [arc[nx], arcGeom[nx], true, [theta, v1, 0, v1]],
      [p[x], pGeom[x], true, [0, v1, 0, v0]],
    ];
    for (const [edge, geom, rev, line] of parts) {
      if (edge === undefined || geom === undefined) continue;
      const u = sideUse(ctx, s, edge, geom, rev, line);
      if (!u.ok) return u;
      uses.push(u.value);
    }
    b.addLoop(face, uses);
  }
  return ok(undefined);
}

/** The context of a revolution: checks the arcs of a partial turn are not degenerate. */
function contextOf(kernel: Kernel, m: Meridian, turn: Turn): Result<Ctx> {
  const tol = kernel.tolerances.zoneTol3d;
  if (!turn.full) {
    // The distance `2 ρ sin(Θ/2)` between a vertex and its turned copy: small for a small turn (a degenerate arc) and
    // for a turn just short of 2π (the end cap would lie on the start cap within the tolerance).
    const chord = 2 * Math.sin(turn.theta / 2);
    for (const r of m.regions) {
      for (const w of r.wires) {
        for (const [g, s] of w.starts.entries()) {
          if (!w.onAxis[g]! && !(s.x * chord > tol)) {
            return invalidInput(OP, `a profile vertex is too close to its turned copy for this angle (within the zone tolerance: the turn is too small, or so close to 2π that the end cap meets the start cap)`);
          }
        }
      }
    }
  }
  const { xAxis: X, yAxis: Y, normal: Z } = m.frame;
  const c = Math.cos(turn.theta), s = Math.sin(turn.theta);
  const xT = add3(scale3(X, c), scale3(Y, s));
  const endPlane = createPlaneSurface(kernel, m.axisPoint, cross3(xT, Z), xT);
  if (!endPlane.ok) return endPlane;
  return ok({ kernel, m, theta: turn.theta, endPlane: endPlane.value });
}

/**
 * The solid of revolution of `profile` about `axis` by `angle` (see the module comment). Fails with `invalid-input`
 * for an angle not in `(0, 2π]`, an axis the profile crosses or touches at an isolated point (`meridianOf`), a
 * partial turn that brings a vertex within `zoneTol3d` of its turned copy (`2 ρ sin(Θ/2)`: a tiny turn, or one so
 * close to 2π that the end cap would meet the start cap); with the errors of the curve and surface constructors; and with
 * the `validateBrepGeometry` error if the result does not validate.
 */
export function revolve(kernel: Kernel, profile: Profile, axis: RevolveAxis, angle: number): Result<Brep> {
  const turn = turnOf(angle);
  if (!turn.ok) return turn;
  const m = meridianOf(kernel, profile, axis);
  if (!m.ok) return m;
  const ctx = contextOf(kernel, m.value, turn.value);
  if (!ctx.ok) return ctx;
  const b = new BrepBuilder();
  for (const region of m.value.regions) {
    if (turn.value.full) {
      const body = b.addBody();
      for (const w of region.wires) {
        for (const run of runsOf(w)) {
          const r = buildFullRun(ctx.value, b, b.addShell(body), w, run.segs, run.cyclic);
          if (!r.ok) return r;
        }
      }
    } else {
      const r = buildPartialRegion(ctx.value, b, region.wires);
      if (!r.ok) return r;
    }
  }
  const brep = b.build();
  const valid = validateBrepGeometry(kernel, brep);
  return valid.ok ? ok(brep) : valid;
}

/**
 * Pappus: the volume of `revolve(kernel, profile, axis, angle)`, `Θ · Σ mx` over the meridian wires (outer wires
 * counter-clockwise add, holes subtract), i.e. `Θ · area · ρ̄`. Exact in closed form for lines and arcs (up to
 * rounding), Gauss–Legendre for NURBS segments (`wireGreen`).
 */
export function revolveVolume(kernel: Kernel, profile: Profile, axis: RevolveAxis, angle: number): Result<number> {
  const turn = turnOf(angle);
  if (!turn.ok) return turn;
  const m = meridianOf(kernel, profile, axis);
  if (!m.ok) return m;
  let mx = 0;
  for (const r of m.value.regions) {
    for (const w of r.wires) {
      const g = wireGreen(w.segments);
      if (!g.ok) return g;
      mx += g.value.mx;
    }
  }
  const v = turn.value.theta * mx;
  if (!Number.isFinite(v)) return invalidInput('sweep.revolveVolume', 'volume is not finite');
  return ok(v);
}
