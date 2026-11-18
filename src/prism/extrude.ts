/**
 * Linear extrusion of a planar profile into a solid B-rep (a prism with planar caps).
 *
 * `extrude(kernel, profile, extent, { symmetric })` sweeps every region of the profile along the vector `v`
 * (`extent` itself, or `extent` times the plane's unit normal `n` for a number) and caps it at both ends; with
 * `symmetric` the solid spans `-v/2 .. v/2` about the profile plane. Each region becomes one body with one shell.
 * When `h = v · n < 0` the solid is built from the far plane back towards the profile plane, so faces always face
 * outwards. `h` must exceed the zone tolerance in size, and `v` must not lie within the angular tolerance of the
 * plane.
 *
 * Topology of a region with wires `k = 0 .. H` (outer first, then the `H` holes) of `n_k` segments,
 * `N = sum n_k`, global segment index `g` (wire by wire), `next(g)` the following segment of the same wire
 * (cyclically). Ids are assigned by `buildPrismRegion` of `layout.ts` (shared with the sweeps) in this order (the
 * order `formal/CadloomFormal/Prism.lean` models):
 * - vertices: bottom `b_g = g` (the start of segment `g` on the base plane), then top `t_g = N + g` (`b_g + v`):
 *   `V = 2N`;
 * - edges: bottom `B_g = g` (`b_g → b_next(g)`, the segment's curve on the base plane), top `T_g = N + g`
 *   (`t_g → t_next(g)`), vertical `S_g = 2N + g` (`b_g → t_g`, a line): `E = 3N`;
 * - faces: bottom (the base plane, reversed: outward normal `-n`), top (the far plane), then one side face per
 *   segment: `F = N + 2`;
 * - loops: the bottom face has one loop per wire, each running its wire backwards
 *   (`B_{n-1} rev, …, B_0 rev`), then the top face one per wire forwards (`T_0, …, T_{n-1}`), then side face `g`
 *   the loop `[B_g fwd, S_next(g) fwd, T_g rev, S_g rev]`: `L = N + 2(1 + H)`.
 * So `V - E + F - (L - F) = 2 - 2H = 2(S - G)` with `S = 1`, genus `G = H` (each hole is a through hole). A
 * one-segment wire (a full circle, a closed NURBS curve) has one vertex per level and its side face uses its
 * vertical edge twice: a seam with pcurves a period apart.
 *
 * Geometry: caps are the profile plane moved to each level, with the same frame, so a bottom pcurve is the
 * segment itself (`planePcurve` of `src/topology`, exact). Side faces by segment kind:
 * - line: the plane through `b_g` spanned by the segment and `v` (normal `d × v`, outward since the material is
 *   on the left of every wire); `planePcurve` pcurves;
 * - arc with `v` along `n`: the M1 cylinder about the arc's axis, `u = 0` at the arc's start (counter-clockwise
 *   arc, face not reversed: material inside the circle) or at its end (clockwise arc, face reversed: material
 *   outside), so `u` runs over `[0, |sweep|]` and `v` over `[0, h]`; pcurves are lines in `(u, v)`; a full circle's
 *   seam has pcurves `u = 2π` and `u = 0`;
 * - arc with an oblique `v`, and NURBS segments: the NURBS surface `S(u, w) = C(u) + w v`, `w in [0, 1]` (the
 *   segment's exact NURBS form `C` on the base plane with its knots mapped affinely onto `u in [0, 1]`, degree 1
 *   in `w`, made by the M1 `createNurbsSurface`); pcurves are the iso-parameter lines `u = 0, 1` and `w = 0, 1`
 *   (end values a degree-1 pcurve reproduces exactly, so they never fall outside the NURBS domain).
 * The B-rep is checked by `validateBrepGeometry` (hence `validateBrep`) before it is returned.
 *
 * Upstream consulted (for the construction and its refusals, not translated):
 * `solidcore/crates/solidcore/src/prism/extrude.rs` (`extrude_region`: a region's curves placed on the frame at
 * the lower level and swept along the normal by the height, capped at both ends; levels finite and increasing),
 * `solidcore/crates/solidcore/src/sweep/extrude.rs` (a direction of usable length, a distance finite and positive),
 * `solidcore/crates/solidcore/src/prism/profile.rs` (`curve_on_frame`: an arc as its own circle with angle 0 at
 * its start, a clockwise arc about the reversed normal) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { add3, cross3, dot3, isFinite3, length3, scale3, sub3, type Vec3 } from '../math/vec.ts';
import { createSegmentCurve } from '../curve/types.ts';
import { curveToNurbs } from '../curve/conic.ts';
import { curveDomain, type NurbsCurve } from '../nurbs/curve.ts';
import { createNurbsSurface } from '../nurbs/surface.ts';
import { createCylinderSurface, createNurbsSurface3, createPlaneSurface, vecFromLocal, type PlaneSurface } from '../surface/types.ts';
import { BrepBuilder, type Brep } from '../topology/brep.ts';
import { planePcurve, uvSegment, validateBrepGeometry } from '../topology/geometry.ts';
import { regionWires, type Profile } from '../profile/profile.ts';
import { arcSpan, buildPrismRegion, onPlane, unitKnots, type PrismLayout, type PrismSide, type PrismSideEdges } from './layout.ts';

export interface ExtrudeOptions {
  /** Span `-v/2 .. v/2` about the profile plane instead of `0 .. v`. */
  readonly symmetric?: boolean;
}

const OP = 'prism.extrude';

/** The extrusion vector of `extent` (a vector, or a signed distance along the plane normal) and its height. */
export interface Extrusion {
  /** The vector the profile is swept along. */
  readonly vector: Vec3;
  /** `vector · n`, the signed height above the profile plane. */
  readonly height: number;
  /** Whether `vector` is along the plane normal (then arcs extrude to cylinders). */
  readonly normal: boolean;
}

/**
 * The extrusion of `extent` on `plane`: a number `d` is `d n`; a vector is used as given, and snapped onto the
 * normal when its in-plane part is below `1e-12` of its length. Fails (`invalid-input`) for a non-finite extent, a
 * height `|v · n|` not above `zoneTol3d`, or a vector within `angTolDeg` of the plane.
 */
export function extrusionOf(kernel: Kernel, plane: PlaneSurface, extent: number | Vec3): Result<Extrusion> {
  const n = plane.frame.normal;
  const tol = kernel.tolerances;
  if (typeof extent === 'number') {
    if (!Number.isFinite(extent) || !(Math.abs(extent) > tol.zoneTol3d)) return invalidInput(OP, 'distance must be finite and above the zone tolerance');
    const v = scale3(n, extent);
    if (!isFinite3(v)) return invalidInput(OP, 'extrusion vector overflows');
    return ok(Object.freeze({ vector: Object.freeze(v), height: extent, normal: true }));
  }
  if (!isFinite3(extent) || !Number.isFinite(length3(extent))) return invalidInput(OP, 'extrusion vector must be finite');
  const h = dot3(extent, n), len = length3(extent);
  if (!(Math.abs(h) > tol.zoneTol3d)) return invalidInput(OP, 'extrusion height must exceed the zone tolerance');
  if (!(Math.abs(h) > len * Math.sin((tol.angTolDeg * Math.PI) / 180))) return invalidInput(OP, 'extrusion vector lies in the profile plane');
  const inPlane = sub3(extent, scale3(n, h));
  if (length3(inPlane) <= 1e-12 * len) return ok(Object.freeze({ vector: Object.freeze(scale3(n, h)), height: h, normal: true }));
  return ok(Object.freeze({ vector: Object.freeze({ x: extent.x, y: extent.y, z: extent.z }), height: h, normal: false }));
}

const movedPlane = (p: PlaneSurface, by: Vec3): PlaneSurface =>
  Object.freeze({ kind: 'plane', origin: Object.freeze(add3(p.origin, by)), frame: p.frame });

/** The side surface of segment `seg` and the four pcurves of its loop `[B fwd, S_next fwd, T rev, S rev]`. */
function sideFace(kernel: Kernel, base: PlaneSurface, ext: Extrusion, e: PrismSideEdges): Result<PrismSide> {
  const v = ext.vector;
  const seg = e.segment;
  if (seg.kind === 'line' && e.bottom.curve.kind === 'line') {
    const d = e.bottom.curve.direction;
    const plane = createPlaneSurface(kernel, e.bottom.curve.origin, cross3(d, v), d);
    if (!plane.ok) return plane;
    const pcs: NurbsCurve[] = [];
    for (const [g, rev] of [[e.bottom, false], [e.railNext, false], [e.top, true], [e.rail, true]] as const) {
      const pc = planePcurve(kernel, plane.value, g, rev);
      if (!pc.ok) return pc;
      pcs.push(pc.value);
    }
    return ok({ surface: plane.value, reversed: false, pcurves: [pcs[0]!, pcs[1]!, pcs[2]!, pcs[3]!] });
  }
  if (seg.kind === 'arc' && ext.normal) {
    const S = arcSpan(seg), H = Math.abs(ext.height);
    const ref = seg.ccw ? seg.startAngle : seg.endAngle;
    const cyl = createCylinderSurface(
      kernel,
      onPlane(base, seg.center.x, seg.center.y),
      base.frame.normal,
      vecFromLocal(base.frame, Math.cos(ref), Math.sin(ref), 0),
      seg.radius,
    );
    if (!cyl.ok) return cyl;
    const pcs = pcurves4(seg.ccw
      ? [[0, 0, S, 0], [S, 0, S, H], [S, H, 0, H], [0, H, 0, 0]]
      : [[S, 0, 0, 0], [0, 0, 0, H], [0, H, S, H], [S, H, S, 0]]);
    if (!pcs.ok) return pcs;
    return ok({ surface: cyl.value, reversed: !seg.ccw, pcurves: pcs.value });
  }
  // NURBS side: C(u) + w v, with the u knots mapped affinely onto [0, 1] (`unitKnots`). The iso-line pcurves then
  // sit exactly on the domain ends 0 and 1, which a degree-1 pcurve reproduces without rounding. With the curve's
  // own domain [a, b], (1 - s) b + s b can round to b + ulp, which the NURBS surface evaluator rejects as outside
  // its domain (seen for arcs of sweep 4 atan(0.4) and for NURBS segments on [-1.7, 3.3]).
  const c = curveToNurbs(e.bottom.curve);
  if (!c.ok) return c;
  const cv = c.value;
  const [a, bEnd] = curveDomain(cv);
  const width = bEnd - a;
  if (!(width > 0) || !Number.isFinite(width)) return invalidInput(OP, 'side curve has an empty or unbounded domain');
  const net = cv.controlPoints.map((q) => [[q[0]!, q[1]!, q[2]!], [q[0]! + v.x, q[1]! + v.y, q[2]! + v.z]]);
  const weights = cv.weights?.map((w) => [w, w]);
  const ns = createNurbsSurface(cv.degree, 1, unitKnots(cv.knots, a, bEnd), [0, 0, 1, 1], net, weights);
  if (!ns.ok) return ns;
  const s3 = createNurbsSurface3(ns.value);
  if (!s3.ok) return s3;
  const pcs = pcurves4([[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]]);
  if (!pcs.ok) return pcs;
  return ok({ surface: s3.value, reversed: false, pcurves: pcs.value });
}

function pcurves4(lines: readonly (readonly [number, number, number, number])[]): Result<PrismSide['pcurves']> {
  const out: NurbsCurve[] = [];
  for (const [u0, v0, u1, v1] of lines) {
    const c = uvSegment(u0, v0, u1, v1);
    if (!c.ok) return c;
    out.push(c.value);
  }
  return ok([out[0]!, out[1]!, out[2]!, out[3]!]);
}

/** The extrusion's prism layout: straight rails `b_g → t_g` and the sides of `sideFace`. */
function extrusionLayout(kernel: Kernel, base: PlaneSurface, ext: Extrusion): PrismLayout {
  return {
    rail: (_g, from, to) => {
      const c = createSegmentCurve(from, to);
      return c.ok ? ok({ curve: c.value, t0: 0, t1: 1 }) : c;
    },
    side: (e) => sideFace(kernel, base, ext, e),
  };
}

/**
 * The solid swept by `profile` along `extent` (see the module comment). Fails with `invalid-input` for a bad
 * extent (`extrusionOf`), with the errors of the curve and surface constructors, and with the
 * `validateBrepGeometry` error if the result does not validate (not expected for a profile made by
 * `createProfile`).
 */
export function extrude(kernel: Kernel, profile: Profile, extent: number | Vec3, options: ExtrudeOptions = {}): Result<Brep> {
  const plane = profile.plane;
  if (plane.kind !== 'plane' || profile.regions.length === 0) return invalidInput(OP, 'a profile made by createProfile is required');
  const e = extrusionOf(kernel, plane, extent);
  if (!e.ok) return e;
  let start: Vec3 = options.symmetric === true ? scale3(e.value.vector, -0.5) : { x: 0, y: 0, z: 0 };
  let ext = e.value;
  if (ext.height < 0) {
    start = add3(start, ext.vector);
    ext = Object.freeze({ vector: Object.freeze(scale3(ext.vector, -1)), height: -ext.height, normal: ext.normal });
  }
  const base = movedPlane(plane, start);
  const far = movedPlane(plane, add3(start, ext.vector));
  if (!isFinite3(base.origin) || !isFinite3(far.origin)) return invalidInput(OP, 'extruded caps overflow');
  const b = new BrepBuilder();
  const layout = extrusionLayout(kernel, base, ext);
  for (const region of profile.regions) {
    const r = buildPrismRegion(kernel, b, base, far, regionWires(region), layout);
    if (!r.ok) return r;
  }
  const brep = b.build();
  const valid = validateBrepGeometry(kernel, brep);
  return valid.ok ? ok(brep) : valid;
}
