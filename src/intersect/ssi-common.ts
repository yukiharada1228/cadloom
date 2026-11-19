/**
 * Shared pieces of the closed-form surface/surface classes: certified patch boxes, clipping a
 * line to them, the exact pcurves, the measured certificate of a closed-form component and the
 * assembly of a closed-form result.
 *
 * Exact pcurves (`exactPcurve`), each a 2D NURBS whose lift runs along the 3D curve:
 * - on a plane: any planar curve, by the M2 `planePcurve` (the curve's NURBS form with its control
 *   points mapped to the plane's `(u, v)`, exact);
 * - on a cylinder or cone: a line along a ruling (`u` constant, `v` affine in the line parameter:
 *   degree 1 with knots `[t0, t0, t1, t1]`, the same parameter as the line);
 * - on a cylinder, cone, sphere or torus: a circle coaxial with the surface's own axis (`v`
 *   constant, `u = u0 ± (t - t0)`: degree 1 in the circle's angle);
 * - otherwise none (ellipses on cylinders and cones, circles on spheres not about the polar axis:
 *   their `(u, v)` images are not rational in the curve parameter; the boolean drops the curve onto
 *   the face instead, as upstream does for every closed form, docs/ssi.md §4.6).
 * The `(u, v)` at the start comes from the M1 closed-form `projectPoint`, so periodic angles start
 * in `[0, 2π)` and may run past `2π`.
 *
 * Certificate of a closed-form component: `deviation` is the largest `|implicitValue|` (the M1
 * signed Euclidean distance, exact up to rounding) of 33 samples of the curve against both
 * surfaces; `pcurveDeviation` the largest distance from `S(pcurve(s))` to the curve
 * (`closestPointOnCurve`) at 33 samples. Both measure the floating-point residue of the closed form.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md §5 ("exact pcurves": a plane section on a cylinder, planes), the closed
 *   forms' boxes (`PlaneOwner`), solidcore/crates/solidcore/src/eval/pcurve.rs (pcurves on planes),
 *   solidcore/crates/solidcore/src/intersect/surface_drop_lib.rs. Rewritten for cadloom.
 */
import { ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { curveRange, TWO_PI, type CircleCurve, type Curve3, type LineCurve } from '../curve/types.ts';
import { boundCurve, boundSurface } from '../interval/bound.ts';
import { boxesDisjoint3, expandBox3, intersectBox3, type Box3 } from '../interval/box.ts';
import { interval } from '../interval/interval.ts';
import { add3, cross3, distance3, dot3, length3, scale3, sub3, type Point3, type Vec3 } from '../math/vec.ts';
import { createNurbsCurve, evaluateCurve, type NurbsCurve } from '../nurbs/curve.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import { implicitValue, projectPoint } from '../surface/implicit.ts';
import type { Surface3 } from '../surface/types.ts';
import { surfaceOrigin } from '../surface/types.ts';
import { planePcurve } from '../topology/geometry.ts';
import {
  combineClass,
  type ContactKind,
  type SurfaceIntersection,
  type SurfaceSurfaceCurve,
  type SurfaceSurfaceHit,
  type SurfaceSurfacePoint,
} from './types.ts';
import { surfaceIntersection, type SurfacePatch } from './ssi-types.ts';

/** Relative slack for "exactly parallel / on the axis" decisions of the closed forms. */
export const EXACT_ANGLE = 1e-12;

/** The certified bounding box of a patch (M4 `boundSurface`). */
export function patchBox(p: SurfacePatch): Result<Box3> {
  const u = interval(p.domain.u[0], p.domain.u[1]);
  if (!u.ok) return u;
  const v = interval(p.domain.v[0], p.domain.v[1]);
  if (!v.ok) return v;
  return boundSurface(p.surface, u.value, v.value);
}

/** The overlap of both patch boxes widened by `xsectTol3d`; `undefined` when they are apart. */
export function overlapBox(kernel: Kernel, a: SurfacePatch, b: SurfacePatch): Result<Box3 | undefined> {
  const ba = patchBox(a);
  if (!ba.ok) return ba;
  const bb = patchBox(b);
  if (!bb.ok) return bb;
  const g = kernel.tolerances.xsectTol3d;
  const ea = expandBox3(ba.value, g);
  if (!ea.ok) return ea;
  const eb = expandBox3(bb.value, g);
  if (!eb.ok) return eb;
  return ok(intersectBox3(ea.value, eb.value));
}

const linearPcurve = (t0: number, t1: number, a: readonly [number, number], b: readonly [number, number]): Result<NurbsCurve> =>
  createNurbsCurve(1, [t0, t0, t1, t1], [[a[0], a[1]], [b[0], b[1]]]);

/** Unit axis of a surface of revolution (its frame normal). */
const axisOf = (s: Surface3): Vec3 | undefined => (s.kind === 'nurbs' || s.kind === 'plane' ? undefined : s.frame.normal);

/** Distance from `p` to the line through `o` along the unit `z`. */
export function distanceToAxis(p: Point3, o: Point3, z: Vec3): number {
  const w = sub3(p, o);
  return length3(sub3(w, scale3(z, dot3(w, z))));
}

/** The exact pcurve of `curve` on `s` (see the module comment), or `undefined` when none is known. */
export function exactPcurve(kernel: Kernel, s: Surface3, curve: Curve3): Result<NurbsCurve | undefined> {
  if (s.kind === 'plane') {
    const [t0, t1] = curveRange(curve);
    const pc = planePcurve(kernel, s, { curve, t0, t1 }, false);
    return pc.ok ? pc : ok(undefined);
  }
  const z = axisOf(s);
  if (z === undefined) return ok(undefined);
  if (curve.kind === 'line' && (s.kind === 'cylinder' || s.kind === 'cone')) return rulingPcurve(kernel, s, curve);
  if (curve.kind === 'circle') return coaxialCirclePcurve(kernel, s, curve, z);
  return ok(undefined);
}

function rulingPcurve(kernel: Kernel, s: Surface3, line: LineCurve): Result<NurbsCurve | undefined> {
  const [t0, t1] = line.range;
  const at = (t: number): Point3 => add3(line.origin, scale3(line.direction, t));
  const pa = projectPoint(kernel, s, at(t0));
  const pm = projectPoint(kernel, s, at((t0 + t1) / 2));
  const pb = projectPoint(kernel, s, at(t1));
  if (!pa.ok || !pm.ok || !pb.ok) return ok(undefined);
  // A ruling: the far end has the same angle as the midpoint (the near end may be a cone apex).
  const du = Math.abs(pm.value.u - pb.value.u);
  if (!(Math.min(du, TWO_PI - du) <= 1e-9)) return ok(undefined);
  const pc = linearPcurve(t0, t1, [pm.value.u, pa.value.v], [pm.value.u, pb.value.v]);
  return pc.ok ? pc : ok(undefined);
}

function coaxialCirclePcurve(kernel: Kernel, s: Surface3, circle: CircleCurve, z: Vec3): Result<NurbsCurve | undefined> {
  if (s.kind === 'nurbs' || s.kind === 'plane') return ok(undefined);
  const scale = Math.max(1, circle.radius);
  if (length3(cross3(circle.frame.normal, z)) > 1e-9) return ok(undefined);
  if (distanceToAxis(circle.center, surfaceOrigin(s), z) > 1e-9 * scale) return ok(undefined);
  const [t0, t1] = circle.range;
  const start = curvePoint3(circle, t0);
  if (!start.ok) return start;
  const pr = projectPoint(kernel, s, start.value);
  if (!pr.ok) return ok(undefined);
  const sign = dot3(circle.frame.normal, z) > 0 ? 1 : -1;
  const pc = linearPcurve(t0, t1, [pr.value.u, pr.value.v], [pr.value.u + sign * (t1 - t0), pr.value.v]);
  return pc.ok ? pc : ok(undefined);
}

const SAMPLES = 32;

/** Largest `|implicitValue|` of `curve` samples against the analytic surfaces (see the module comment). */
export function measureCurveDeviation(curve: Curve3, surfaces: readonly Surface3[]): Result<number> {
  const [t0, t1] = curveRange(curve);
  let dev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i === SAMPLES ? t1 : t0 + ((t1 - t0) * i) / SAMPLES;
    const p = curvePoint3(curve, t);
    if (!p.ok) return p;
    for (const s of surfaces) {
      const d = implicitValue(s, p.value);
      if (!d.ok) return d;
      dev = Math.max(dev, Math.abs(d.value));
    }
  }
  return ok(dev);
}

/** Largest distance from `S(pcurve(s))` to `curve` at samples. */
export function measurePcurveDeviation(s: Surface3, pcurve: NurbsCurve, curve: Curve3): Result<number> {
  const a = pcurve.knots[pcurve.degree]!, b = pcurve.knots[pcurve.knots.length - 1 - pcurve.degree]!;
  let dev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i === SAMPLES ? b : a + ((b - a) * i) / SAMPLES;
    const uv = evaluateCurve(pcurve, t);
    if (!uv.ok) return uv;
    const p = surfacePoint3(s, uv.value[0]!, uv.value[1]!);
    if (!p.ok) return p;
    const c = closestPointOnCurve(curve, p.value);
    if (!c.ok) return c;
    dev = Math.max(dev, c.value.distance);
  }
  return ok(dev);
}

/** A closed-form component before its pcurves and certificate. */
export type RawComponent =
  | { readonly kind: 'curve'; readonly curve: Curve3; readonly contact: ContactKind; readonly closed: boolean }
  | { readonly kind: 'point'; readonly point: Point3 };

/** The parameters of `p` on an analytic surface (closed-form `projectPoint`). */
function paramsOf(kernel: Kernel, s: Surface3, p: Point3): Result<{ readonly u: number; readonly v: number }> {
  const r = projectPoint(kernel, s, p);
  if (!r.ok) return r;
  return ok(Object.freeze({ u: r.value.u, v: r.value.v }));
}

/**
 * Assembles a closed-form result: drops components whose certified box is apart from a patch box
 * (by more than `xsectTol3d`), adds the exact pcurves and measures the certificates.
 */
export function finishExact(
  kernel: Kernel,
  a: SurfacePatch,
  b: SurfacePatch,
  raws: readonly RawComponent[],
  coincident: boolean,
): Result<SurfaceIntersection> {
  const boxA = patchBox(a);
  if (!boxA.ok) return boxA;
  const boxB = patchBox(b);
  if (!boxB.ok) return boxB;
  const gap = kernel.tolerances.xsectTol3d;
  const hits: SurfaceSurfaceHit[] = [];
  for (const raw of raws) {
    let box: Box3;
    if (raw.kind === 'point') {
      box = { min: raw.point, max: raw.point };
    } else {
      const [t0, t1] = curveRange(raw.curve);
      const t = interval(t0, t1);
      if (!t.ok) return t;
      const bc = boundCurve(raw.curve, t.value);
      if (!bc.ok) return bc;
      box = bc.value;
    }
    const da = boxesDisjoint3(box, boxA.value, gap);
    if (!da.ok) return da;
    const db = boxesDisjoint3(box, boxB.value, gap);
    if (!db.ok) return db;
    if (da.value || db.value) continue;
    if (raw.kind === 'point') {
      const ua = paramsOf(kernel, a.surface, raw.point);
      if (!ua.ok) return ua;
      const ub = paramsOf(kernel, b.surface, raw.point);
      if (!ub.ok) return ub;
      let dev = 0;
      for (const s of [a.surface, b.surface]) {
        const d = implicitValue(s, raw.point);
        if (!d.ok) return d;
        dev = Math.max(dev, Math.abs(d.value));
      }
      const hit: SurfaceSurfacePoint = Object.freeze({
        kind: 'point', class: 'exact', deviation: dev, point: Object.freeze({ ...raw.point }), a: ua.value, b: ub.value, contact: 'tangent',
      });
      hits.push(hit);
      continue;
    }
    const dev = measureCurveDeviation(raw.curve, [a.surface, b.surface]);
    if (!dev.ok) return dev;
    const pa = exactPcurve(kernel, a.surface, raw.curve);
    if (!pa.ok) return pa;
    const pb = exactPcurve(kernel, b.surface, raw.curve);
    if (!pb.ok) return pb;
    let pdev = 0;
    for (const [s, pc] of [[a.surface, pa.value], [b.surface, pb.value]] as const) {
      if (pc === undefined) continue;
      const d = measurePcurveDeviation(s, pc, raw.curve);
      if (!d.ok) return d;
      pdev = Math.max(pdev, d.value);
    }
    const hit: SurfaceSurfaceCurve = Object.freeze({
      kind: 'curve',
      class: 'exact',
      deviation: dev.value,
      curve: raw.curve,
      ...(pa.value !== undefined ? { pcurveA: pa.value } : {}),
      ...(pb.value !== undefined ? { pcurveB: pb.value } : {}),
      contact: raw.contact,
      closed: raw.closed,
      ...(pa.value !== undefined || pb.value !== undefined ? { pcurveDeviation: pdev } : {}),
    });
    hits.push(hit);
  }
  return ok(surfaceIntersection(combineClass(hits.map((h) => h.class)), hits, coincident, 'closed-form'));
}

/** `true` when `p` is within `tol` of `q`. */
export const near3 = (p: Point3, q: Point3, tol: number): boolean => distance3(p, q) <= tol;
