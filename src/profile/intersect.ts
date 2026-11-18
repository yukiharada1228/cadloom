/**
 * Contact tests between profile segments, for `createProfile`'s check that wires neither cross themselves nor
 * each other, and the even–odd containment of a point in a wire.
 *
 * Two segments are in **contact** when:
 * - they are not adjacent (do not follow one another in a wire): they come within `tol` (`zoneTol3d`) of each
 *   other anywhere — so a wire passing within the zone tolerance of another counts as touching it;
 * - they are adjacent (share the junction point(s) `junctions`): they meet at a point farther than the junction
 *   radius `rho` from every junction, or overlap there. Near a junction adjacent segments legitimately come
 *   within `tol` of each other (they meet there; when tangent they stay close for a stretch of length about
 *   `sqrt(2 R tol)` for a relative curvature `1/R`), so `rho = 10 tol + 2 sqrt(2 L tol)` with `L` the larger
 *   segment size (box diagonal or radius). A fold-back (cusp) at a junction is reported separately
 *   (`junctionCusp`).
 *
 * Methods:
 * - line/line: the exact M0 `orient2d` (`segmentsMeet` of `src/exact`), then the floating segment distance;
 * - line/arc and arc/arc: analytic. Intersection points from the line–circle quadratic and the circle–circle
 *   construction, kept when inside the arc's angular range; the distance between non-adjacent pieces is the least
 *   of its critical candidates (end points to the other piece; for line/arc the circle point toward the foot of the
 *   center on the line; for arc/arc the circle points on the line of centers);
 * - anything with a NURBS segment: recursive subdivision of rational Bézier pieces (the curve's Bézier
 *   extraction by knot insertion, then de Casteljau halving on homogeneous points). A pair of pieces whose
 *   control boxes, grown by `tol`, are disjoint has no contact (convex hull property, positive weights); a pair of
 *   pieces flat within `tol / 4` is decided on their chords. For adjacent segments the contact location is
 *   the chords' crossing point, or a chord end point within reach of the other chord, and it must lie farther
 *   than `rho` from every junction. Limits: the depth is bounded by `PROFILE_CONTACT_MAX_DEPTH`
 *   (pieces then count as flat), so a contact closer than about `2^-PROFILE_CONTACT_MAX_DEPTH` of a segment's size to a junction
 *   is not resolved; a self-intersection of a single NURBS curve is found by the same test between the halves of
 *   each piece, recursively. The answer is conservative by the flatness (`tol / 4` per piece): pieces within
 *   `tol` plus their flatness count as touching.
 *
 * Containment (`pointInWire`): the even–odd rule along the ray from the point toward `+x` with the half-open
 * rule (a point is above the ray when its `y > p.y`), on the wire's vertices (each segment's start point; the
 * previous segment's end is snapped to it). Line pieces are decided by the exact `orient2d`; an arc is split
 * into y-monotone pieces at its extreme angles and its crossing abscissa is computed (floating point); a NURBS
 * segment by the chords of its flattened Bézier pieces (exact `orient2d` on the chord points, which lie within
 * `tol / 4` of the curve). The query point must be farther than `tol` from the wire (guaranteed for the vertices
 * of other wires once the contact tests pass).
 *
 * Upstream consulted (for the method and its refusals, not translated): `solidcore/crates/solidcore/src/prism/profile.rs`
 * (`Loop2::holds`: even–odd with the half-open crossing rule, spans split until decided; `check_regions`;
 * `Seg2::spans`: rational quadratic spans of at most a quarter turn), `prism/measure.rs` — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { vec2, type Point2, type Vec2 } from '../math/vec.ts';
import { orient2d } from '../exact/predicates.ts';
import { segmentsMeet } from '../exact/polygon.ts';
import { TWO_PI } from '../curve/types.ts';
import { subdivideBezier } from '../nurbs/bezier.ts';
import { curveDomain, homogeneousPoints, type NurbsCurve } from '../nurbs/curve.ts';
import { insertKnot } from '../nurbs/insert.ts';
import { knotMultiplicity } from '../nurbs/knots.ts';
import {
  segmentEnd,
  segmentStart,
  segmentTangent,
  segmentToNurbs,
  type ArcSegment2,
  type LineSegment2,
  type Segment2,
  type Wire2,
} from './segment.ts';

/** Subdivision depth bound of the NURBS contact test. */
export const PROFILE_CONTACT_MAX_DEPTH = 30;

const OP = 'profile.intersect';

const sub2 = (a: Point2, b: Point2): Vec2 => vec2(a.x - b.x, a.y - b.y);
const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const dist2 = (a: Point2, b: Point2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Axis-aligned box `[minX, minY, maxX, maxY]`. */
type Box = readonly [number, number, number, number];

const boxOf = (pts: readonly Point2[]): Box => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) {
    a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y);
  }
  return [a, b, c, d];
};
const boxesNear = (p: Box, q: Box, tol: number): boolean =>
  p[0] <= q[2] + tol && q[0] <= p[2] + tol && p[1] <= q[3] + tol && q[1] <= p[3] + tol;
const boxDiag = (b: Box): number => Math.hypot(b[2] - b[0], b[3] - b[1]);

/** Whether angle `t` lies on the arc (its angular interval, modulo `2π`), with angular slack `slack`. */
export function angleOnArc(a: ArcSegment2, t: number, slack = 0): boolean {
  const lo = Math.min(a.startAngle, a.endAngle), hi = Math.max(a.startAngle, a.endAngle);
  const x = lo + ((((t - lo) % TWO_PI) + TWO_PI) % TWO_PI);
  return x <= hi + slack || x - TWO_PI >= lo - slack;
}

/** Bounding box of a segment (an arc's includes its axis extremes; a NURBS segment's is its control box). */
export function segmentBox(seg: Segment2): Box {
  switch (seg.kind) {
    case 'line':
      return boxOf([seg.start, seg.end]);
    case 'arc': {
      const pts = [segmentStart(seg), segmentEnd(seg)];
      for (let k = 0; k < 4; k++) {
        const t = (k * Math.PI) / 2;
        if (angleOnArc(seg, t)) pts.push(vec2(seg.center.x + seg.radius * Math.cos(t), seg.center.y + seg.radius * Math.sin(t)));
      }
      return boxOf(pts);
    }
    case 'nurbs':
      return boxOf(seg.curve.controlPoints.map((c) => vec2(c[0]!, c[1]!)));
  }
}

/** A size of a segment for the junction radius: its box diagonal (and radius, for an arc). */
const segmentSize = (seg: Segment2): number => Math.max(boxDiag(segmentBox(seg)), seg.kind === 'arc' ? seg.radius : 0);

/** The junction radius of two adjacent segments (see the module comment). */
export function junctionRadius(tol: number, a: Segment2, b: Segment2): number {
  const L = Math.max(segmentSize(a), segmentSize(b));
  return 10 * tol + 2 * Math.sqrt(2 * L * tol);
}

/** Distance from `p` to the closed segment `[a, b]`. */
export function pointSegmentDistance(p: Point2, a: Point2, b: Point2): number {
  const d = sub2(b, a), dd = dot2(d, d);
  const t = dd > 0 ? Math.min(1, Math.max(0, dot2(sub2(p, a), d) / dd)) : 0;
  return dist2(p, vec2(a.x + t * d.x, a.y + t * d.y));
}

/** Distance between the closed segments `[a, b]` and `[c, d]` (0 when they meet, decided exactly). */
export function segmentDistance(a: Point2, b: Point2, c: Point2, d: Point2): number {
  const m = segmentsMeet(a, b, c, d);
  if (m.ok && m.value) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

/** Distance from `p` to an arc. */
export function pointArcDistance(p: Point2, a: ArcSegment2): number {
  const v = sub2(p, a.center), len = Math.hypot(v.x, v.y);
  const ends = Math.min(dist2(p, segmentStart(a)), dist2(p, segmentEnd(a)));
  if (len > 0 && angleOnArc(a, Math.atan2(v.y, v.x))) return Math.min(Math.abs(len - a.radius), ends);
  return ends;
}

/** The points of `circle(a) ∩ [p, q]` on the arc `a` (line–circle quadratic). */
function lineArcPoints(p: Point2, q: Point2, a: ArcSegment2, tol: number): Point2[] {
  const d = sub2(q, p), f = sub2(p, a.center);
  const A = dot2(d, d), B = 2 * dot2(f, d), C = dot2(f, f) - a.radius * a.radius;
  if (!(A > 0)) return [];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const slackT = tol / Math.sqrt(A), slackA = tol / a.radius;
  const out: Point2[] = [];
  for (const t of disc === 0 ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)]) {
    if (t < -slackT || t > 1 + slackT) continue;
    const x = vec2(p.x + t * d.x, p.y + t * d.y);
    if (angleOnArc(a, Math.atan2(x.y - a.center.y, x.x - a.center.x), slackA)) out.push(x);
  }
  return out;
}

/** The points of `circle(a) ∩ circle(b)` on both arcs (`undefined` for coincident circles). */
function arcArcPoints(a: ArcSegment2, b: ArcSegment2, tol: number): Point2[] | undefined {
  const dc = sub2(b.center, a.center), D = Math.hypot(dc.x, dc.y);
  if (D <= tol * 1e-3 && Math.abs(a.radius - b.radius) <= tol) return undefined;
  if (D === 0 || D > a.radius + b.radius + tol || D < Math.abs(a.radius - b.radius) - tol) return [];
  const x = (D * D + a.radius * a.radius - b.radius * b.radius) / (2 * D);
  const h = Math.sqrt(Math.max(0, a.radius * a.radius - x * x));
  const ux = dc.x / D, uy = dc.y / D;
  const out: Point2[] = [];
  for (const sgn of h === 0 ? [0] : [-1, 1]) {
    const p = vec2(a.center.x + x * ux - sgn * h * uy, a.center.y + x * uy + sgn * h * ux);
    const onA = angleOnArc(a, Math.atan2(p.y - a.center.y, p.x - a.center.x), tol / a.radius);
    const onB = angleOnArc(b, Math.atan2(p.y - b.center.y, p.x - b.center.x), tol / b.radius);
    if (onA && onB) out.push(p);
  }
  return out;
}

/** Length of the common part of the angular intervals of two arcs on one circle (radians). */
function angularOverlap(a: ArcSegment2, b: ArcSegment2): number {
  const aLo = Math.min(a.startAngle, a.endAngle), aHi = Math.max(a.startAngle, a.endAngle);
  const bLo0 = Math.min(b.startAngle, b.endAngle), bW = Math.abs(b.endAngle - b.startAngle);
  const bLo = aLo + ((((bLo0 - aLo) % TWO_PI) + TWO_PI) % TWO_PI);
  let o = 0;
  for (const s of [bLo - TWO_PI, bLo]) o += Math.max(0, Math.min(aHi, s + bW) - Math.max(aLo, s));
  return o;
}

const farFromAll = (p: Point2, junctions: readonly Point2[], rho: number): boolean => junctions.every((j) => dist2(p, j) > rho);

function lineLineContact(a: LineSegment2, b: LineSegment2, junctions: readonly Point2[], tol: number): boolean {
  // Adjacent lines meet only at their junction unless they fold back (a cusp, reported by `junctionCusp`).
  if (junctions.length > 0) return false;
  return segmentDistance(a.start, a.end, b.start, b.end) <= tol;
}

function lineArcContact(l: LineSegment2, a: ArcSegment2, junctions: readonly Point2[], tol: number, rho: number): boolean {
  const pts = lineArcPoints(l.start, l.end, a, tol);
  if (junctions.length > 0) return pts.some((p) => farFromAll(p, junctions, rho));
  if (pts.length > 0) return true;
  let d = Math.min(
    pointSegmentDistance(segmentStart(a), l.start, l.end),
    pointSegmentDistance(segmentEnd(a), l.start, l.end),
    pointArcDistance(l.start, a),
    pointArcDistance(l.end, a),
  );
  // The circle point toward the foot of the center on the line.
  const dir = sub2(l.end, l.start), dd = dot2(dir, dir);
  const t = dd > 0 ? dot2(sub2(a.center, l.start), dir) / dd : -1;
  if (t >= 0 && t <= 1) {
    const foot = vec2(l.start.x + t * dir.x, l.start.y + t * dir.y);
    const v = sub2(foot, a.center), len = Math.hypot(v.x, v.y);
    if (len > 0 && angleOnArc(a, Math.atan2(v.y, v.x))) d = Math.min(d, Math.abs(len - a.radius));
  }
  return d <= tol;
}

function arcArcContact(a: ArcSegment2, b: ArcSegment2, junctions: readonly Point2[], tol: number, rho: number): boolean {
  const pts = arcArcPoints(a, b, tol);
  if (pts === undefined) {
    // One circle: contact when the arcs overlap by more than the junction allows.
    const o = angularOverlap(a, b) * a.radius;
    return junctions.length > 0 ? o > rho : true;
  }
  if (junctions.length > 0) return pts.some((p) => farFromAll(p, junctions, rho));
  if (pts.length > 0) return true;
  let d = Math.min(pointArcDistance(segmentStart(a), b), pointArcDistance(segmentEnd(a), b), pointArcDistance(segmentStart(b), a), pointArcDistance(segmentEnd(b), a));
  const dc = sub2(b.center, a.center), D = Math.hypot(dc.x, dc.y);
  if (D > 0) {
    const th = Math.atan2(dc.y, dc.x);
    for (const ta of [th, th + Math.PI]) {
      if (!angleOnArc(a, ta)) continue;
      const pa = vec2(a.center.x + a.radius * Math.cos(ta), a.center.y + a.radius * Math.sin(ta));
      for (const tb of [th, th + Math.PI]) {
        if (!angleOnArc(b, tb)) continue;
        d = Math.min(d, dist2(pa, vec2(b.center.x + b.radius * Math.cos(tb), b.center.y + b.radius * Math.sin(tb))));
      }
    }
  }
  return d <= tol;
}

// ---------------------------------------------------------------------------------------------------------
// Rational Bézier pieces.

/** A rational Bézier piece in homogeneous coordinates `[w x, w y, w]`, with its projected control box. */
export interface BezierPiece {
  readonly h: readonly (readonly number[])[];
  readonly pts: readonly Point2[];
  readonly box: Box;
  readonly depth: number;
}

function makePiece(h: readonly (readonly number[])[], depth: number): BezierPiece {
  const pts = h.map((c) => vec2(c[0]! / c[2]!, c[1]! / c[2]!));
  return { h, pts, box: boxOf(pts), depth };
}

/** Bézier extraction of a 2D NURBS curve: every interior knot raised to multiplicity `p` (A5.1). */
export function bezierPieces(curve: NurbsCurve): Result<readonly BezierPiece[]> {
  let c = curve;
  const [lo, hi] = curveDomain(curve);
  const interior = [...new Set(curve.knots.filter((k) => k > lo && k < hi))];
  for (const u of interior) {
    const m = knotMultiplicity(c.knots, u);
    if (m < c.degree) {
      const r = insertKnot(c, u, c.degree - m);
      if (!r.ok) return r;
      c = r.value;
    }
  }
  const hp = homogeneousPoints(c).map((q) => (q.length === 3 ? q : [q[0]!, q[1]!, 1]));
  const p = c.degree;
  const out: BezierPiece[] = [];
  for (let k = 0; k * p + p < hp.length; k++) out.push(makePiece(hp.slice(k * p, k * p + p + 1), 0));
  if (out.length === 0) return invalidInput(OP, 'NURBS curve has no Bézier piece');
  return ok(out);
}

function split(pc: BezierPiece): readonly [BezierPiece, BezierPiece] {
  const s = subdivideBezier(pc.h, 0.5);
  if (!s.ok) return [pc, pc]; // unreachable: finite points, t = 1/2
  return [makePiece(s.value.left, pc.depth + 1), makePiece(s.value.right, pc.depth + 1)];
}

/** Largest distance of a piece's control points from its chord. */
function flatness(pc: BezierPiece): number {
  const a = pc.pts[0]!, b = pc.pts[pc.pts.length - 1]!;
  let m = 0;
  for (let i = 1; i + 1 < pc.pts.length; i++) m = Math.max(m, pointSegmentDistance(pc.pts[i]!, a, b));
  return m;
}

const isLeaf = (pc: BezierPiece, tol: number): boolean => pc.depth >= PROFILE_CONTACT_MAX_DEPTH || flatness(pc) <= tol / 4;

const boxWithin = (b: Box, j: Point2, rho: number): boolean =>
  Math.max(Math.abs(b[0] - j.x), Math.abs(b[2] - j.x)) ** 2 + Math.max(Math.abs(b[1] - j.y), Math.abs(b[3] - j.y)) ** 2 <= rho * rho;

/**
 * Where the chords `[a, b]` and `[c, d]` come within `thr`: their crossing point (when they meet and are not
 * parallel) and every end point within `thr` of the other chord (this covers collinear overlaps and near
 * touches). Empty when the chords are farther apart than `thr`.
 */
function chordContactPoints(a: Point2, b: Point2, c: Point2, d: Point2, thr: number): Point2[] {
  const out: Point2[] = [];
  const m = segmentsMeet(a, b, c, d);
  if (m.ok && m.value) {
    const r = sub2(b, a), s = sub2(d, c), den = r.x * s.y - r.y * s.x;
    if (den !== 0) {
      const t = Math.min(1, Math.max(0, ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den));
      out.push(vec2(a.x + t * r.x, a.y + t * r.y));
    }
  }
  for (const e of [a, b]) if (pointSegmentDistance(e, c, d) <= thr) out.push(e);
  for (const e of [c, d]) if (pointSegmentDistance(e, a, b) <= thr) out.push(e);
  return out;
}

/** Contact of two pieces by recursive subdivision (see the module comment). Bounded by `budget` leaf visits. */
function pieceContact(p: BezierPiece, q: BezierPiece, junctions: readonly Point2[], tol: number, rho: number, budget: { n: number }): boolean {
  if (!boxesNear(p.box, q.box, tol)) return false;
  if (junctions.some((j) => boxWithin(p.box, j, rho) && boxWithin(q.box, j, rho))) return false;
  if (--budget.n < 0) return true; // conservative when the work bound is exhausted
  const lp = isLeaf(p, tol), lq = isLeaf(q, tol);
  if (lp && lq) {
    const a = p.pts[0]!, b = p.pts[p.pts.length - 1]!, c = q.pts[0]!, d = q.pts[q.pts.length - 1]!;
    const thr = tol + flatness(p) + flatness(q);
    if (junctions.length === 0) return segmentDistance(a, b, c, d) <= thr;
    return chordContactPoints(a, b, c, d, thr).some((x) => farFromAll(x, junctions, rho));
  }
  const splitP = !lp && (lq || boxDiag(p.box) >= boxDiag(q.box));
  if (splitP) {
    const [l, r] = split(p);
    return pieceContact(l, q, junctions, tol, rho, budget) || pieceContact(r, q, junctions, tol, rho, budget);
  }
  const [l, r] = split(q);
  return pieceContact(p, l, junctions, tol, rho, budget) || pieceContact(p, r, junctions, tol, rho, budget);
}

/** Self-contact of one piece: its halves tested as adjacent pieces, recursively. */
function pieceSelfContact(p: BezierPiece, tol: number, rho: number, budget: { n: number }): boolean {
  if (isLeaf(p, tol)) return false;
  const [l, r] = split(p);
  const j = l.pts[l.pts.length - 1]!;
  return pieceContact(l, r, [j], tol, rho, budget) || pieceSelfContact(l, tol, rho, budget) || pieceSelfContact(r, tol, rho, budget);
}

/** Leaf visits allowed per NURBS pair test. */
const PIECE_BUDGET = 200000;

function nurbsContact(a: Segment2, b: Segment2, junctions: readonly Point2[], tol: number, rho: number): Result<boolean> {
  const na = segmentToNurbs(a), nb = segmentToNurbs(b);
  if (!na.ok) return na;
  if (!nb.ok) return nb;
  const pa = bezierPieces(na.value), pb = bezierPieces(nb.value);
  if (!pa.ok) return pa;
  if (!pb.ok) return pb;
  const budget = { n: PIECE_BUDGET };
  for (const p of pa.value) for (const q of pb.value) if (pieceContact(p, q, junctions, tol, rho, budget)) return ok(true);
  return ok(false);
}

/**
 * Whether two distinct segments are in contact (see the module comment). `junctions` lists the points where
 * they follow one another in a wire (empty when they are not adjacent).
 */
export function segmentsContact(kernel: Kernel, a: Segment2, b: Segment2, junctions: readonly Point2[]): Result<boolean> {
  const tol = kernel.tolerances.zoneTol3d;
  if (!boxesNear(segmentBox(a), segmentBox(b), tol)) return ok(false);
  const rho = junctionRadius(tol, a, b);
  if (a.kind === 'line' && b.kind === 'line') return ok(lineLineContact(a, b, junctions, tol));
  if (a.kind === 'line' && b.kind === 'arc') return ok(lineArcContact(a, b, junctions, tol, rho));
  if (a.kind === 'arc' && b.kind === 'line') return ok(lineArcContact(b, a, junctions, tol, rho));
  if (a.kind === 'arc' && b.kind === 'arc') return ok(arcArcContact(a, b, junctions, tol, rho));
  return nurbsContact(a, b, junctions, tol, rho);
}

/**
 * Whether a single NURBS segment touches itself away from its own junction(s): between its Bézier pieces
 * (consecutive pieces adjacent at their common point; the first and last adjacent too when `closed`) and
 * within each piece. Lines and arcs cannot cross themselves.
 */
export function segmentSelfContact(kernel: Kernel, seg: Segment2, closed: boolean): Result<boolean> {
  if (seg.kind !== 'nurbs') return ok(false);
  const tol = kernel.tolerances.zoneTol3d;
  const rho = junctionRadius(tol, seg, seg);
  const pcs = bezierPieces(seg.curve);
  if (!pcs.ok) return pcs;
  const ps = pcs.value, n = ps.length;
  const budget = { n: PIECE_BUDGET };
  for (let i = 0; i < n; i++) {
    if (pieceSelfContact(ps[i]!, tol, rho, budget)) return ok(true);
    for (let j = i + 1; j < n; j++) {
      const js: Point2[] = [];
      if (j === i + 1) js.push(ps[j]!.pts[0]!);
      if (closed && i === 0 && j === n - 1) js.push(ps[0]!.pts[0]!);
      if (pieceContact(ps[i]!, ps[j]!, js, tol, rho, budget)) return ok(true);
    }
  }
  return ok(false);
}

/**
 * Whether segment `a` folds back onto `b` at their junction: the end tangent of `a` and the start tangent of `b`
 * are opposite within the kernel's angular tolerance.
 */
export function junctionCusp(kernel: Kernel, a: Segment2, b: Segment2): Result<boolean> {
  const ta = segmentTangent(a, 1), tb = segmentTangent(b, 0);
  if (!ta.ok) return ta;
  if (!tb.ok) return tb;
  const la = Math.hypot(ta.value.x, ta.value.y), lb = Math.hypot(tb.value.x, tb.value.y);
  if (!(la > 0) || !(lb > 0)) return ok(false);
  const c = dot2(ta.value, tb.value) / (la * lb);
  return ok(c < -Math.cos((kernel.tolerances.angTolDeg * Math.PI) / 180));
}

// ---------------------------------------------------------------------------------------------------------
// Containment.

/** One crossing test of the half-open rule on the piece `[a, b]` (exact). */
function lineCrossing(p: Point2, a: Point2, b: Point2): boolean {
  if ((a.y > p.y) === (b.y > p.y)) return false;
  const o = orient2d(a, b, p);
  const s = o.ok ? o.value : 0;
  return b.y > a.y ? s > 0 : s < 0;
}

/** Crossings of the ray from `p` with the arc running from vertex `v0` to vertex `v1` (its snapped ends). */
function arcCrossings(p: Point2, a: ArcSegment2, v0: Point2, v1: Point2): number {
  // Split at the angles k π/2 + π/2 (the y extremes) inside the arc into y-monotone pieces.
  const t0 = a.startAngle, t1 = a.endAngle;
  const cuts: number[] = [];
  const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
  for (let k = Math.ceil((lo - Math.PI / 2) / Math.PI); Math.PI / 2 + k * Math.PI < hi; k++) {
    const t = Math.PI / 2 + k * Math.PI;
    if (t > lo) cuts.push(t);
  }
  if (t1 < t0) cuts.reverse();
  const angles = [t0, ...cuts, t1];
  const at = (t: number): Point2 => vec2(a.center.x + a.radius * Math.cos(t), a.center.y + a.radius * Math.sin(t));
  let n = 0;
  for (let i = 0; i + 1 < angles.length; i++) {
    const q0 = i === 0 ? v0 : at(angles[i]!), q1 = i + 2 === angles.length ? v1 : at(angles[i + 1]!);
    if ((q0.y > p.y) === (q1.y > p.y)) continue;
    const mid = (angles[i]! + angles[i + 1]!) / 2;
    const dy = (p.y - a.center.y) / a.radius;
    const x = a.center.x + Math.sign(Math.cos(mid)) * a.radius * Math.sqrt(Math.max(0, 1 - dy * dy));
    if (x > p.x) n++;
  }
  return n;
}

/** Flattened chord points of a segment (NURBS: its pieces subdivided until flat within `tol / 4`). */
function flattenNurbs(seg: Segment2, tol: number): Result<Point2[]> {
  const nc = segmentToNurbs(seg);
  if (!nc.ok) return nc;
  const pcs = bezierPieces(nc.value);
  if (!pcs.ok) return pcs;
  const out: Point2[] = [];
  const walk = (pc: BezierPiece): void => {
    if (isLeaf(pc, tol)) {
      out.push(pc.pts[0]!);
      return;
    }
    const [l, r] = split(pc);
    walk(l);
    walk(r);
  };
  for (const pc of pcs.value) walk(pc);
  return ok(out);
}

/**
 * Whether `p` lies inside the closed wire by the even–odd rule (see the module comment). `p` must be farther
 * than the zone tolerance from the wire.
 */
export function pointInWire(kernel: Kernel, p: Point2, wire: Wire2): Result<boolean> {
  const tol = kernel.tolerances.zoneTol3d;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return invalidInput(OP, 'query point must be finite');
  const vs = wire.map(segmentStart);
  let n = 0;
  for (const [i, seg] of wire.entries()) {
    const v0 = vs[i]!, v1 = vs[(i + 1) % wire.length]!;
    if (seg.kind === 'line') {
      if (lineCrossing(p, v0, v1)) n++;
    } else if (seg.kind === 'arc') {
      n += arcCrossings(p, seg, v0, v1);
    } else {
      const pts = flattenNurbs(seg, tol);
      if (!pts.ok) return pts;
      const chain = [v0, ...pts.value.slice(1), v1];
      for (let k = 0; k + 1 < chain.length; k++) if (lineCrossing(p, chain[k]!, chain[k + 1]!)) n++;
    }
  }
  return ok(n % 2 === 1);
}
