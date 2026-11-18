/**
 * The meridian half-plane of a revolution: a profile and an axis in its plane re-expressed in the coordinates
 * `(ρ, h)` (distance from the axis, height along it), with the checks that make a revolution a valid solid.
 *
 * Coordinates. The axis is a point `a` and a direction `d` (any length) in the profile plane's own 2D coordinates,
 * so it lies in the plane by construction. With `d` normalised and `d⊥ = (-d.y, d.x)`, a profile point `p` has the
 * signed distance `(p - a)·d⊥` from the axis. The profile must lie on one side (`side = ±1`): `ρ = side (p - a)·d⊥`,
 * `h = (p - a)·d`. In 3D the axis point is `A` (the profile point of `a`), the axis `Z` (the profile vector of `d`),
 * the radial direction `X` (the profile vector of `side d⊥`) and `Y = Z × X` (the kernel frame `createCurveFrame(Z, X)`).
 * A meridian point `(ρ, h)` is `A + ρ X + h Z`; rotating it by `u` about `Z` (right-handed) gives
 * `A + ρ (cos u X + sin u Y) + h Z`. `plane` is the half-plane `u = 0` as a plane surface whose `(u, v)` are `(ρ, h)`
 * (normal `X × Z = -Y`).
 *
 * The map profile → meridian is a plane isometry of determinant `-side`; when it is a reflection the wires are
 * reversed, so that in the meridian plane **the material is on the left of every wire** (outer wires
 * counter-clockwise in `(ρ, h)`, holes clockwise), whatever the side or the axis direction.
 *
 * Checks (`invalid-input`):
 * - the axis direction is finite and non-zero; the profile has a point farther than `zoneTol3d` from the axis;
 * - **crossing**: no segment reaches `ρ < -zoneTol3d` on the other side (lines by their ends, arcs by their
 *   extreme points, NURBS by their control points — conservative: a control polygon that crosses is refused);
 * - **touching**: a profile vertex within `zoneTol3d` of the axis is *on* the axis (its `ρ` is snapped to 0). A
 *   segment whose two ends are on the axis is an *axis segment* (it must be a line; the solid's boundary does not
 *   include it at a full turn). A vertex on the axis must end or start an axis segment: otherwise the solid would be
 *   pinched to a point there (two apexes meeting, a horn torus), which is not a manifold. A segment that comes within
 *   `zoneTol3d` of the axis inside (an arc through its point nearest the axis, a NURBS interior control point) is
 *   refused for the same reason.
 *
 * Upstream consulted (for the checks and the layout, not translated):
 * `solidcore/crates/solidcore/src/sweep/analytic_revolution.rs` (the curve must lie in one half-plane through the
 * axis; `u` the turn from the profile, `v` along the curve), `sweep/rotational_sweep_geometry.rs` (degenerate sides
 * where the profile meets the axis), `sweep/api_brep.rs` (a revolve's profile may touch but not cross the axis) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { cross3, isFinite3, type Point2, type Point3, type Vec2, type Vec3 } from '../math/vec.ts';
import { createCurveFrame, TWO_PI, type CurveFrame } from '../curve/types.ts';
import { createPlaneSurface, vecFromLocal, type PlaneSurface } from '../surface/types.ts';
import { angleOnArc, segmentBox } from '../profile/intersect.ts';
import { profilePoint, regionWires, type Profile } from '../profile/profile.ts';
import { segmentStart, type Segment2, type Wire2 } from '../profile/segment.ts';
import { mapWire, type Iso2 } from './section.ts';

/** An axis in the profile plane: a point and a direction (any non-zero length), in the plane's 2D coordinates. */
export interface RevolveAxis {
  readonly origin: Point2;
  readonly direction: Vec2;
}

/** One wire in meridian coordinates, with its contact with the axis. */
export interface MeridianWire {
  readonly segments: Wire2;
  /** Start point of segment `g` (`ρ` snapped to exactly 0 on the axis). */
  readonly starts: readonly Point2[];
  /** Whether the start vertex of segment `g` is on the axis. */
  readonly onAxis: readonly boolean[];
  /** Whether segment `g` lies on the axis (both ends on it; a line). */
  readonly axisSegment: readonly boolean[];
}

export interface MeridianRegion {
  /** Outer wire first, then the holes. */
  readonly wires: readonly MeridianWire[];
}

export interface Meridian {
  /** The axis point `A`. */
  readonly axisPoint: Point3;
  /** `normal` = the axis `Z`, `xAxis` = the radial direction `X` of the profile, `yAxis = Z × X`. */
  readonly frame: CurveFrame;
  /** The half-plane `u = 0`: origin `A`, `(u, v) = (ρ, h)`. */
  readonly plane: PlaneSurface;
  /** Which side of the axis the profile lies on, in the profile's own coordinates. */
  readonly side: 1 | -1;
  /** The map profile 2D → `(ρ, h)`. */
  readonly iso: Iso2;
  /** Whether the wires were reversed (the map is a reflection). */
  readonly reversed: boolean;
  readonly regions: readonly MeridianRegion[];
}

const OP = 'sweep.revolve';

/** Whether arc `a` reaches angle `t` strictly inside (not at its ends, up to `slack` in angle). */
function arcHasInside(a: Segment2 & { kind: 'arc' }, t: number): boolean {
  if (!angleOnArc(a, t)) return false;
  const near = (x: number): boolean => {
    const d = (((x - t) % TWO_PI) + TWO_PI) % TWO_PI;
    return Math.min(d, TWO_PI - d) <= 1e-12;
  };
  return !near(a.startAngle) && !near(a.endAngle);
}

/** Checks one meridian wire for touching the axis (see the module comment). */
function analyseWire(kernel: Kernel, wire: Wire2, label: string): Result<MeridianWire> {
  const tol = kernel.tolerances.zoneTol3d;
  const n = wire.length;
  const starts: Point2[] = [];
  const onAxis: boolean[] = [];
  for (const s of wire) {
    const p = segmentStart(s);
    const on = Math.abs(p.x) <= tol;
    onAxis.push(on);
    starts.push(Object.freeze({ x: on ? 0 : p.x, y: p.y }));
  }
  const axisSegment = wire.map((s, g) => onAxis[g]! && onAxis[(g + 1) % n]! && n > 1 && s.kind === 'line');
  for (const [g, s] of wire.entries()) {
    const at = `${label} segment ${g}`;
    if (axisSegment[g]!) continue;
    if (s.kind === 'arc' && arcHasInside(s, Math.PI) && s.center.x - s.radius <= tol) {
      return invalidInput(OP, `${at} touches the axis inside the arc (the solid would be pinched)`);
    }
    if (s.kind === 'nurbs') {
      const cps = s.curve.controlPoints;
      for (let j = 1; j + 1 < cps.length; j++) {
        if (!(cps[j]![0]! > tol)) return invalidInput(OP, `${at}: a NURBS control point is within the zone tolerance of the axis`);
      }
    }
  }
  for (let g = 0; g < n; g++) {
    if (onAxis[g]! && !axisSegment[g]! && !axisSegment[(g + n - 1) % n]!) {
      return invalidInput(OP, `${label} touches the axis at the start of segment ${g} without a segment along it (the solid would be pinched to a point)`);
    }
  }
  return ok(Object.freeze({
    segments: wire,
    starts: Object.freeze(starts),
    onAxis: Object.freeze(onAxis),
    axisSegment: Object.freeze(axisSegment),
  }));
}

/** The meridian form of `profile` about `axis` (see the module comment). */
export function meridianOf(kernel: Kernel, profile: Profile, axis: RevolveAxis): Result<Meridian> {
  const tol = kernel.tolerances.zoneTol3d;
  const { origin: a, direction } = axis;
  if (![a.x, a.y, direction.x, direction.y].every(Number.isFinite)) return invalidInput(OP, 'the axis must be finite');
  const len = Math.hypot(direction.x, direction.y);
  if (!(len > 0) || !Number.isFinite(len)) return invalidInput(OP, 'the axis direction must be non-zero');
  const dx = direction.x / len, dy = direction.y / len;
  // Raw signed distance (p - a)·d⊥ as the first coordinate (a reflection; only its x range is used).
  const raw: Iso2 = { m00: -dy, m01: dx, m10: dx, m11: dy, tx: dy * a.x - dx * a.y, ty: -(dx * a.x + dy * a.y) };
  let lo = Infinity, hi = -Infinity;
  for (const region of profile.regions) {
    for (const w of regionWires(region)) {
      const m = mapWire(w, raw, false);
      if (!m.ok) return m;
      for (const s of m.value) {
        const [x0, , x1] = segmentBox(s);
        lo = Math.min(lo, x0);
        hi = Math.max(hi, x1);
      }
    }
  }
  if (hi > tol && lo < -tol) return invalidInput(OP, 'the profile crosses the axis');
  if (!(hi > tol) && !(lo < -tol)) return invalidInput(OP, 'the profile lies on the axis');
  const side: 1 | -1 = hi > tol ? 1 : -1;
  // ρ = side (p - a)·d⊥, h = (p - a)·d; determinant -side.
  const iso: Iso2 = side === 1 ? raw : { m00: dy, m01: -dx, m10: dx, m11: dy, tx: -(dy * a.x - dx * a.y), ty: -(dx * a.x + dy * a.y) };
  const reversed = side === 1;

  const plane0 = profile.plane;
  const A = profilePoint(profile, a);
  const Z: Vec3 = vecFromLocal(plane0.frame, dx, dy, 0);
  const X: Vec3 = vecFromLocal(plane0.frame, -side * dy, side * dx, 0);
  if (!isFinite3(A)) return invalidInput(OP, 'the axis point is not finite');
  const frame = createCurveFrame(kernel, Z, X);
  if (!frame.ok) return frame;
  const plane = createPlaneSurface(kernel, A, cross3(frame.value.xAxis, frame.value.normal), frame.value.xAxis);
  if (!plane.ok) return plane;

  const regions: MeridianRegion[] = [];
  for (const [ri, region] of profile.regions.entries()) {
    const wires: MeridianWire[] = [];
    for (const [wi, w] of regionWires(region).entries()) {
      const m = mapWire(w, iso, reversed);
      if (!m.ok) return m;
      const label = `region ${ri} ${wi === 0 ? 'outer wire' : `hole ${wi - 1}`}`;
      const mw = analyseWire(kernel, m.value, label);
      if (!mw.ok) return mw;
      if (wi > 0 && mw.value.onAxis.some(Boolean)) return invalidInput(OP, `${label} touches the axis`);
      wires.push(mw.value);
    }
    regions.push(Object.freeze({ wires: Object.freeze(wires) }));
  }
  return ok(Object.freeze({
    axisPoint: A,
    frame: frame.value,
    plane: plane.value,
    side,
    iso: Object.freeze(iso),
    reversed,
    regions: Object.freeze(regions),
  }));
}
