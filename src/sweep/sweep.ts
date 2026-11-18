/**
 * Sweep of a planar profile along a path curve into a solid B-rep.
 *
 * `sweep(kernel, profile, path, { frame })` moves the profile rigidly along `path` (a `Curve3`, swept over its whole
 * parameter range `[t_0, t_1]`): the profile is taken where it lies, and a point `p` of it is carried to
 * `x(t) + R(t) (p - x(t_0))`, `x` the path and `R(t)` the rotation of the frame at `t` relative to the frame at `t_0`.
 * `frame` is `'rotation-minimizing'` (default; the frame turns with the tangent and never about it) or `'fixed'`
 * (`R = I`: a translational sweep, the profile keeps its orientation). The path's start tangent must not lie in the
 * profile plane (within `angTolDeg`). One body per region, as `extrude`.
 *
 * **Methods** (one job, one place: the exact cases delegate):
 * - a **line** path is the extrusion by `x(t_1) - x(t_0)` (both frames are constant): `extrude` of `src/prism`;
 * - a **circle** (arc) path with the rotation-minimizing frame whose axis lies in the profile plane (the axis point
 *   within `zoneTol3d` of the plane, the direction tilted out of it by less than `zoneTol3d` over the profile's
 *   reach) is the revolution about that axis by the arc's sweep: `revolve` (its rotation-minimizing frame is the
 *   rotation about the axis);
 * - `'fixed'` on any other path is **translational** and exact: each side is the tensor-product NURBS
 *   `S(u, v) = C(u) + T(v) - x(t_0)` with net `C_j + Q_i - x(t_0)` and weights `w_j ω_i` (`C` the segment's exact
 *   NURBS form, `T` the path's, `curveToNurbs`), which equals the sum because the denominators factor;
 * - otherwise (NURBS, ellipse, an arc not about an axis of the plane) the sides are **skinned**: rotation-minimizing
 *   frames by double reflection (`frames.ts`) at `2m + 1` stations equally spaced in `t`; the sections at the even
 *   stations `v_i = i / m` (every control point `C_j` of every segment moved rigidly, weights kept) are interpolated
 *   across by cubic B-splines with shared averaged knots (`interpolate.ts`), giving one NURBS surface per segment,
 *   degree `(p, 3)`, `u` the segment's knots mapped onto `[0, 1]`, `v = (t - t_0) / (t_1 - t_0)`.
 *   **Approximation and its measure**: the moved control points at the odd stations (computed with the same frames,
 *   between the interpolated ones) are compared with the interpolating columns there; since a NURBS point at fixed
 *   `v` is a convex combination of its control points, the largest column error bounds the surface error at those
 *   `v`. `m` starts at `max(8, 4 · knot spans)` (NURBS) or one station per `π/8` of the range (ellipse, circle), and
 *   doubles until the measured error is at most `approxTol3d`, up to `MAX_SWEEP_STATIONS` (`not-converged` beyond).
 *   The error between the measured stations and of the double-reflection frames themselves (fourth order) is not
 *   bounded (documented limitation; tests measure it against a much finer frame computation).
 *   **Curvature check** (`invalid-input`): with `reach` the largest distance from `x(t_0)` to a control point of the
 *   profile (an upper bound of the profile's distance from the path), every station must have curvature
 *   `κ · reach < 1`: a path that bends tighter than the profile is wide would fold the swept sides. Sampled at the
 *   `2m + 1` stations only; global self-intersection is out of scope.
 *
 * Layout (skinned and translational, the ids of `extrude`, `formal/CadloomFormal/Prism.lean`): vertices bottom `b_g`
 * (the profile's) then top `t_g` (the moved profile's); edges bottom `B_g` (the segment on the profile plane), top
 * `T_g` (the segment on the end plane — the profile plane moved rigidly — exactly the `v = 1` iso-curve of the side
 * up to rounding), rail `S_g` (`b_g → t_g`, the side's `u = 0` iso-curve); faces the start cap (reversed, wires
 * backwards), the end cap (wires forwards), then one side per segment with the loop
 * `[B_g fwd, S_next fwd, T_g rev, S_g rev]` on the `(u, v)` square. When the path starts against the profile normal
 * the profile is reflected into the opposite plane frame and its wires reversed first (`mapWire`), so the material is
 * always on the left of the wires about the start tangent and all side surfaces face outwards. The B-rep is checked
 * by `validateBrepGeometry` before it is returned.
 *
 * Upstream consulted (for the methods and refusals, not translated): `solidcore/docs/procedural-sweep.md` (§2 a
 * linear sweep is an extrusion and a rotational sweep a revolution, exact; §3.2 the rotation-minimizing frame; §3.4
 * the fitted net skinned across the stations; §5 a net is an approximation with a stated bound),
 * `solidcore/crates/solidcore/src/sweep/trans_sweep_geometry.rs` (the translational sweep `S(u) + T(v)`),
 * `sweep/directed.rs` (a profile moved along a path by a frame), `sweep/stations.rs` (stations equally spaced along the
 * path, the transport from the start), `sweep/api_brep.rs` (capped sweeps), `sweep/rotational_sweep_geometry.rs` —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { cross3, distance3, dot3, isFinite3, length3, normalize3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import { curveCurvature, evaluateCurve3 } from '../curve/evaluate.ts';
import { curveToNurbs } from '../curve/conic.ts';
import { createNurbsCurve3, curveRange, type Curve3 } from '../curve/types.ts';
import { curveDomain, type NurbsCurve } from '../nurbs/curve.ts';
import { createNurbsSurface, isoparametricCurve, type NurbsSurface } from '../nurbs/surface.ts';
import { createNurbsSurface3, createPlaneSurface, localCoordinates, type PlaneSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep } from '../topology/brep.ts';
import { uvSegment, validateBrepGeometry } from '../topology/geometry.ts';
import { regionWires, type Profile } from '../profile/profile.ts';
import type { Wire2 } from '../profile/segment.ts';
import { extrude } from '../prism/extrude.ts';
import { frameMotion, rotationMinimizingFrames, type PathFrame } from './frames.ts';
import { interpolation, interpolationValue } from './interpolate.ts';
import { revolve } from './revolve.ts';
import { mapWire } from './section.ts';
import { buildPrismRegion, segmentNurbs3, unitKnots } from '../prism/layout.ts';

export type SweepFrame = 'rotation-minimizing' | 'fixed';

export interface SweepOptions {
  readonly frame?: SweepFrame;
}

/** How a sweep was built, and the measured approximation of a skinned one. */
export interface SweepReport {
  readonly brep: Brep;
  readonly method: 'extrude' | 'revolve' | 'translational' | 'skinned';
  /** Interpolated stations `m + 1` of a skinned sweep (0 otherwise). */
  readonly stations: number;
  /** Largest measured column error at the odd stations of a skinned sweep (0 for the exact methods). */
  readonly deviation: number;
}

/** Most interpolation intervals `m` of a skinned sweep. */
export const MAX_SWEEP_STATIONS = 512;

const OP = 'sweep.sweep';

/** A region in the effective plane: wires (outer first) with each segment's placed exact NURBS form. */
interface Region {
  readonly wires: readonly Wire2[];
  readonly curves: readonly NurbsCurve[];
}

/** The side surface of one segment: control net `net[j][i]` over the segment's (unit) knots and the given `v` knots. */
function sideSurface(curve: NurbsCurve, degreeV: number, knotsV: readonly number[], net: number[][][], weightsV: readonly number[] | undefined): Result<NurbsSurface> {
  const [a, b] = curveDomain(curve);
  if (!(b - a > 0) || !Number.isFinite(b - a)) return invalidInput(OP, 'segment curve has an empty or unbounded domain');
  const wu = curve.weights;
  const weights = wu === undefined && weightsV === undefined
    ? undefined
    : net.map((col, j) => col.map((_, i) => (wu?.[j] ?? 1) * (weightsV?.[i] ?? 1)));
  return createNurbsSurface(curve.degree, degreeV, unitKnots(curve.knots, a, b), knotsV, net, weights);
}

/**
 * Builds one region as a body of `b` in the prism layout of `extrude` (`buildPrismRegion`, one job, one place):
 * the rails are the sides' `u = 0` iso-curves, every side its NURBS surface on the unit `(u, v)` square.
 */
function buildRegion(
  kernel: Kernel,
  b: BrepBuilder,
  base: PlaneSurface,
  far: PlaneSurface,
  region: Region,
  sides: readonly NurbsSurface[],
): Result<void> {
  const square: NurbsCurve[] = [];
  for (const [u0, v0, u1, v1] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]] as const) {
    const c = uvSegment(u0, v0, u1, v1);
    if (!c.ok) return c;
    square.push(c.value);
  }
  const pcurves = [square[0]!, square[1]!, square[2]!, square[3]!] as const;
  return buildPrismRegion(kernel, b, base, far, region.wires, {
    rail: (g) => {
      const iso = isoparametricCurve(sides[g]!, 'u', 0);
      if (!iso.ok) return iso;
      const c = createNurbsCurve3(iso.value);
      return c.ok ? ok({ curve: c.value, t0: 0, t1: 1 }) : c;
    },
    side: (e) => {
      const s3 = createNurbsSurface3(sides[e.index]!);
      return s3.ok ? ok({ surface: s3.value, reversed: false, pcurves }) : s3;
    },
  });
}

/** Point and unit tangent of the path at `t`. */
function pathStation(path: Curve3, t: number): Result<{ readonly point: Point3; readonly tangent: Vec3 }> {
  const e = evaluateCurve3(path, t);
  if (!e.ok) return e;
  const tangent = normalize3(e.value.d1);
  if (tangent === undefined) return err({ kind: 'degenerate', operation: OP });
  return ok({ point: e.value.point, tangent });
}

/**
 * The profile in the plane frame where the start tangent `t0` has a positive normal component: the profile's own
 * plane, or its reflection (normal `-n`, `y` flipped) with the wires reversed.
 */
function effectiveRegions(kernel: Kernel, profile: Profile, t0: Vec3): Result<{ readonly plane: PlaneSurface; readonly regions: readonly Region[] }> {
  const p = profile.plane;
  const dn = dot3(t0, p.frame.normal);
  if (!(Math.abs(dn) > Math.sin((kernel.tolerances.angTolDeg * Math.PI) / 180))) {
    return invalidInput(OP, 'the path starts along the profile plane');
  }
  const flip = dn < 0;
  let plane = p;
  if (flip) {
    const fp = createPlaneSurface(kernel, p.origin, scale3(p.frame.normal, -1), p.frame.xAxis);
    if (!fp.ok) return fp;
    plane = fp.value;
  }
  const regions: Region[] = [];
  for (const region of profile.regions) {
    const wires: Wire2[] = [];
    for (const w of regionWires(region)) {
      const m = flip ? mapWire(w, { m00: 1, m01: 0, m10: 0, m11: -1, tx: 0, ty: 0 }, true) : ok(w);
      if (!m.ok) return m;
      wires.push(m.value);
    }
    const curves: NurbsCurve[] = [];
    for (const s of wires.flat()) {
      const c = segmentNurbs3(plane, s);
      if (!c.ok) return c;
      curves.push(c.value);
    }
    regions.push({ wires, curves });
  }
  return ok({ plane, regions });
}

const toArr = (p: Point3): number[] => [p.x, p.y, p.z];
const fromArr = (a: readonly number[]): Point3 => ({ x: a[0]!, y: a[1]!, z: a[2]! });

/** The revolution a circle path stands for, when its axis lies in the profile plane (see the module comment). */
function circleAxis(kernel: Kernel, profile: Profile, path: Curve3 & { kind: 'circle' }): { origin: { x: number; y: number }; direction: { x: number; y: number } } | undefined {
  const p = profile.plane;
  const tol = kernel.tolerances.zoneTol3d;
  const [ax, ay, az] = localCoordinates(p.frame, p.origin, path.center);
  const n = path.frame.normal;
  const dz = dot3(n, p.frame.normal);
  let reach = 0;
  for (const region of profile.regions) {
    for (const s of regionWires(region).flat()) {
      const c = segmentNurbs3(p, s);
      if (!c.ok) return undefined;
      for (const q of c.value.controlPoints) reach = Math.max(reach, distance3(fromArr(q), path.center));
    }
  }
  if (!(Math.abs(az) <= tol) || !(Math.abs(dz) * reach <= tol)) return undefined;
  return { origin: { x: ax, y: ay }, direction: { x: dot3(n, p.frame.xAxis), y: dot3(n, p.frame.yAxis) } };
}

/** The translational (`'fixed'`) sweep: exact tensor-product sides. */
function translational(kernel: Kernel, plane: PlaneSurface, regions: readonly Region[], path: Curve3, x0: Point3, x1: Point3): Result<Brep> {
  const pn = curveToNurbs(path);
  if (!pn.ok) return pn;
  const T = pn.value;
  const [a, bEnd] = curveDomain(T);
  const knotsV = unitKnots(T.knots, a, bEnd);
  const far = createPlaneSurface(kernel, { x: plane.origin.x + x1.x - x0.x, y: plane.origin.y + x1.y - x0.y, z: plane.origin.z + x1.z - x0.z }, plane.frame.normal, plane.frame.xAxis);
  if (!far.ok) return far;
  const b = new BrepBuilder();
  for (const region of regions) {
    const sides: NurbsSurface[] = [];
    for (const c of region.curves) {
      const net = c.controlPoints.map((cj) => T.controlPoints.map((qi) => [cj[0]! + qi[0]! - x0.x, cj[1]! + qi[1]! - x0.y, cj[2]! + qi[2]! - x0.z]));
      const s = sideSurface(c, T.degree, knotsV, net, T.weights);
      if (!s.ok) return s;
      sides.push(s.value);
    }
    const r = buildRegion(kernel, b, plane, far.value, region, sides);
    if (!r.ok) return r;
  }
  return ok(b.build());
}

/** The initial interval count of a skinned sweep. */
function initialStations(path: Curve3): number {
  if (path.kind === 'nurbs') {
    const [a, b] = curveDomain(path.curve);
    const spans = new Set(path.curve.knots.filter((k) => k >= a && k < b)).size;
    return Math.max(8, 4 * spans);
  }
  const [t0, t1] = curveRange(path);
  return Math.max(8, Math.ceil((t1 - t0) / (Math.PI / 8)));
}

/** The skinned rotation-minimizing sweep at `m` intervals, with its measured column error. */
function skinnedAt(
  kernel: Kernel,
  plane: PlaneSurface,
  regions: readonly Region[],
  frames: readonly PathFrame[],
  m: number,
): Result<{ readonly sides: readonly (readonly NurbsSurface[])[]; readonly far: PlaneSurface; readonly deviation: number }> {
  const params = Array.from({ length: m + 1 }, (_, i) => (i === m ? 1 : i / m));
  const ip = interpolation(params, 3);
  if (!ip.ok) return ip;
  const f0 = frames[0]!;
  const motions = frames.map((f) => frameMotion(f0, f));
  let deviation = 0;
  const sides: NurbsSurface[][] = [];
  for (const region of regions) {
    const rs: NurbsSurface[] = [];
    for (const c of region.curves) {
      const net: number[][][] = [];
      for (const cj of c.controlPoints) {
        const p = fromArr(cj);
        const cols = [0, 1, 2].map((d) => ip.value.solve(params.map((_, i) => toArr(motions[2 * i]!.point(p))[d]!)));
        for (let i = 0; i < m; i++) {
          const v = (2 * i + 1) / (2 * m);
          const exact = motions[2 * i + 1]!.point(p);
          const got = { x: interpolationValue(ip.value, cols[0]!, v), y: interpolationValue(ip.value, cols[1]!, v), z: interpolationValue(ip.value, cols[2]!, v) };
          deviation = Math.max(deviation, distance3(exact, got));
        }
        net.push(params.map((_, i) => [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!]));
      }
      const s = sideSurface(c, ip.value.degree, ip.value.knots, net, undefined);
      if (!s.ok) return s;
      rs.push(s.value);
    }
    sides.push(rs);
  }
  const end = motions[2 * m]!;
  const far = createPlaneSurface(kernel, end.point(plane.origin), end.vector(plane.frame.normal), end.vector(plane.frame.xAxis));
  if (!far.ok) return far;
  return ok({ sides, far: far.value, deviation });
}

/** The skinned rotation-minimizing sweep (see the module comment). */
function skinned(kernel: Kernel, plane: PlaneSurface, regions: readonly Region[], path: Curve3, x0: Point3, t0: Vec3): Result<SweepReport> {
  let reach = 0;
  for (const r of regions) for (const c of r.curves) for (const q of c.controlPoints) reach = Math.max(reach, distance3(fromArr(q), x0));
  const { xAxis: X, yAxis: Y } = plane.frame;
  const r0 = length3(cross3(X, t0)) >= length3(cross3(Y, t0)) ? X : Y;
  for (let m = initialStations(path); m <= MAX_SWEEP_STATIONS; m *= 2) {
    const frames = rotationMinimizingFrames(kernel, path, 2 * m, r0);
    if (!frames.ok) return frames;
    for (const f of frames.value) {
      const k = curveCurvature(path, f.t);
      if (!k.ok) return k;
      if (!(k.value * reach < 1)) {
        return invalidInput(OP, `the path bends with radius ${1 / k.value} at t = ${f.t}, tighter than the profile's reach ${reach} from the path`);
      }
    }
    const s = skinnedAt(kernel, plane, regions, frames.value, m);
    if (!s.ok) return s;
    if (s.value.deviation <= kernel.tolerances.approxTol3d) {
      const b = new BrepBuilder();
      for (const [ri, region] of regions.entries()) {
        const r = buildRegion(kernel, b, plane, s.value.far, region, s.value.sides[ri]!);
        if (!r.ok) return r;
      }
      return ok(Object.freeze({ brep: b.build(), method: 'skinned', stations: m + 1, deviation: s.value.deviation }));
    }
  }
  return err({ kind: 'not-converged', operation: OP, iterations: MAX_SWEEP_STATIONS });
}

/** The sweep and how it was built (see the module comment). */
export function sweepWithReport(kernel: Kernel, profile: Profile, path: Curve3, options: SweepOptions = {}): Result<SweepReport> {
  const frame = options.frame ?? 'rotation-minimizing';
  if (frame !== 'rotation-minimizing' && frame !== 'fixed') return invalidInput(OP, `unknown frame '${String(frame)}'`);
  if (profile.plane.kind !== 'plane' || profile.regions.length === 0) return invalidInput(OP, 'a profile made by createProfile is required');
  const [t0, t1] = curveRange(path);
  const s0 = pathStation(path, t0);
  if (!s0.ok) return s0;
  const end = evaluateCurve3(path, t1);
  if (!end.ok) return end;
  const x0 = s0.value.point, x1 = end.value.point;

  if (path.kind === 'line') {
    const b = extrude(kernel, profile, sub3(x1, x0));
    return b.ok ? ok(Object.freeze({ brep: b.value, method: 'extrude', stations: 0, deviation: 0 })) : b;
  }
  if (path.kind === 'circle' && frame === 'rotation-minimizing') {
    const axis = circleAxis(kernel, profile, path);
    if (axis !== undefined) {
      const b = revolve(kernel, profile, axis, t1 - t0);
      return b.ok ? ok(Object.freeze({ brep: b.value, method: 'revolve', stations: 0, deviation: 0 })) : b;
    }
  }
  const eff = effectiveRegions(kernel, profile, s0.value.tangent);
  if (!eff.ok) return eff;
  if (!isFinite3(x1)) return invalidInput(OP, 'the path end is not finite');
  let report: Result<SweepReport>;
  if (frame === 'fixed') {
    const b = translational(kernel, eff.value.plane, eff.value.regions, path, x0, x1);
    report = b.ok ? ok(Object.freeze({ brep: b.value, method: 'translational', stations: 0, deviation: 0 })) : b;
  } else {
    report = skinned(kernel, eff.value.plane, eff.value.regions, path, x0, s0.value.tangent);
  }
  if (!report.ok) return report;
  const valid = validateBrepGeometry(kernel, report.value.brep);
  return valid.ok ? report : valid;
}

/** The solid swept by `profile` along `path` (see the module comment). */
export function sweep(kernel: Kernel, profile: Profile, path: Curve3, options: SweepOptions = {}): Result<Brep> {
  const r = sweepWithReport(kernel, profile, path, options);
  return r.ok ? ok(r.value.brep) : r;
}
