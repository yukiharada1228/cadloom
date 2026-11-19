/**
 * Edge and face measures: `edgeLength` and `faceArea`.
 *
 * - `edgeLength(kernel, brep, edge)` — the M1 arc length `curveArcLength` of the edge's curve over its interval
 *   `[t0, t1]` (exact for lines and circles, adaptive Gauss–Legendre otherwise).
 * - `faceArea(kernel, body, face)` — `∫∫ |S_u × S_v| du dv` over the face's trimmed `(u, v)` domain. The domain is
 *   the face's rings (`domain.ts`): exact where the trims are straight in `(u, v)` (lines on planes, seams,
 *   iso-lines, the collapsed pole lines), a polygon following curved trims within about `zoneTol3d` in 3D
 *   otherwise — **this is quadrature over a polygonal `(u, v)` approximation of curved trims**, so a face bounded
 *   by circles on a plane is off by about (perimeter × chord) in the worst case. A domain that is a single
 *   axis-aligned rectangle (a cylinder's, sphere's or torus's full parameter rectangle, a whole NURBS patch) is
 *   integrated as that rectangle; any other is triangulated by the M2 mesher's `triangulatePolygon` (hole
 *   bridging and ear clipping, exact `orient2d`; rings re-oriented outer counter-clockwise, holes clockwise — area
 *   does not depend on orientation). On a NURBS surface each piece is first cut along the knot lines crossing it
 *   (`splitAtKnots`: the integrand is smooth inside a knot cell, not across it). Rectangles take the tensor
 *   `GL_POINTS × GL_POINTS` Gauss–Legendre rule, triangles the collapsed (Duffy) product rule; a piece is split
 *   into four (center lines / edge midpoints) until the split sum agrees with the parent within its area share of
 *   `max(AREA_REL_TOL · |estimate|, approxTol3d²)` (or a rounding floor for slivers); at most `MAX_AREA_DEPTH`
 *   levels and `MAX_AREA_PIECES` pieces (`not-converged` beyond). The integrand is smooth on analytic surfaces
 *   (it vanishes at poles), so faces of primitives converge to rounding.
 *
 * Upstream consulted (for the method and API shape, not translated): `solidcore/crates/solidcore/src/query/edge.rs`
 * (edge length from the curve's arc length over the edge's interval), `query/face.rs`, `query/poly_properties.rs`
 * (face area by quadrature over the face's parameter domain), `crates/solidcore-tess/src/lib.rs`
 * (`triangulate_planar`) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { cross3, length3, vec2, vec3, type Point2 } from '../math/vec.ts';
import { surfaceDerivatives, surfaceDomain } from '../nurbs/surface.ts';
import { curveArcLength } from '../curve/length.ts';
import { evaluateSurface3 } from '../surface/evaluate.ts';
import type { Surface3 } from '../surface/types.ts';
import type { Brep, EdgeId, FaceId } from '../topology/brep.ts';
import { ringOrientation } from '../exact/polygon.ts';
import { triangulatePolygon } from '../tess/triangulate.ts';
import { prepared, type BodyInput } from './domain.ts';
import { faceDomain } from './face.ts';

/** Gauss–Legendre points per direction of the triangle rule. */
export const GL_POINTS = 5;
/** Relative tolerance of the adaptive area quadrature. */
export const AREA_REL_TOL = 1e-9;
/** Refinement levels of one triangle at most. */
export const MAX_AREA_DEPTH = 12;
/** Quadrature pieces integrated per face at most. */
export const MAX_AREA_PIECES = 200000;

// 5-point Gauss–Legendre nodes and weights on [0, 1].
const GL_X = [0.04691007703066802, 0.23076534494715845, 0.5, 0.7692346550528415, 0.9530899229693319] as const;
const GL_W = [0.11846344252809454, 0.23931433524968324, 0.28444444444444444, 0.23931433524968324, 0.11846344252809454] as const;

/** The length of `edge` (see the module comment). */
export function edgeLength(kernel: Kernel, brep: Brep, edge: EdgeId): Result<number> {
  const e = brep.edges[edge];
  if (e === undefined) return err({ kind: 'not-found', operation: 'query.edgeLength', entity: { kind: 'edge', id: edge } });
  return curveArcLength(kernel, e.curve, e.t0, e.t1);
}

/** `|S_u × S_v|` at `(u, v)` (first derivatives only for a NURBS surface). */
function areaDensity(s: Surface3, u: number, v: number): Result<number> {
  if (s.kind === 'nurbs') {
    const d = surfaceDerivatives(s.surface, u, v, 1);
    if (!d.ok) return d;
    const su = d.value[1]![0]!, sv = d.value[0]![1]!;
    return ok(length3(cross3(vec3(su[0]!, su[1]!, su[2]!), vec3(sv[0]!, sv[1]!, sv[2]!))));
  }
  const d = evaluateSurface3(s, u, v);
  if (!d.ok) return d;
  return ok(length3(cross3(d.value.su, d.value.sv)));
}

/** The collapsed Gauss–Legendre rule on the `(u, v)` triangle `(a, b, c)`. */
function triangleRule(s: Surface3, a: Point2, b: Point2, c: Point2): Result<number> {
  const ab = vec2(b.x - a.x, b.y - a.y), bc = vec2(c.x - b.x, c.y - b.y);
  const jac = Math.abs(ab.x * bc.y - ab.y * bc.x);
  if (jac === 0) return ok(0);
  let sum = 0;
  for (let i = 0; i < GL_POINTS; i++) {
    const si = GL_X[i]!;
    for (let j = 0; j < GL_POINTS; j++) {
      const tj = GL_X[j]!;
      // x(s, t) = a + s (b - a) + s t (c - b), Jacobian s |(b - a) × (c - b)|.
      const f = areaDensity(s, a.x + si * ab.x + si * tj * bc.x, a.y + si * ab.y + si * tj * bc.y);
      if (!f.ok) return f;
      sum += GL_W[i]! * GL_W[j]! * si * f.value;
    }
  }
  return ok(sum * jac);
}

/** The distinct interior knots of a NURBS surface in `u` and `v` (where `|S_u × S_v|` loses smoothness); none otherwise. */
function knotCuts(s: Surface3): { readonly u: readonly number[]; readonly v: readonly number[] } {
  if (s.kind !== 'nurbs') return { u: [], v: [] };
  const d = surfaceDomain(s.surface);
  const inner = (knots: readonly number[], [a, b]: readonly [number, number]): number[] =>
    knots.filter((x, i) => x > a && x < b && knots[i - 1] !== x);
  return { u: inner(s.surface.knotsU, d.u), v: inner(s.surface.knotsV, d.v) };
}

/** The part of a convex polygon with `lo <= p[axis] <= hi` (Sutherland–Hodgman against two half-planes). */
function clipConvex(poly: readonly Point2[], axis: 'x' | 'y', lo: number, hi: number): Point2[] {
  const clip = (pts: readonly Point2[], keep: (p: Point2) => number): Point2[] => {
    const out: Point2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      const fp = keep(p), fq = keep(q);
      if (fp >= 0) out.push(p);
      if ((fp > 0 && fq < 0) || (fp < 0 && fq > 0)) {
        const t = fp / (fp - fq);
        out.push(vec2(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y)));
      }
    }
    return out;
  };
  return clip(clip(poly, (p) => p[axis] - lo), (p) => hi - p[axis]);
}

/** A quadrature piece of the `(u, v)` domain: an axis-aligned rectangle or a triangle. */
type Piece =
  | { readonly kind: 'rect'; readonly u0: number; readonly u1: number; readonly v0: number; readonly v1: number }
  | { readonly kind: 'tri'; readonly a: Point2; readonly b: Point2; readonly c: Point2 };

/** The axis-aligned rectangle a 4-point ring is, if it is one. */
function asRect(ring: readonly Point2[]): Piece | undefined {
  if (ring.length !== 4) return undefined;
  const xs = [...new Set(ring.map((p) => p.x))], ys = [...new Set(ring.map((p) => p.y))];
  if (xs.length !== 2 || ys.length !== 2) return undefined;
  const corners = new Set(ring.map((p) => `${p.x},${p.y}`));
  if (corners.size !== 4) return undefined;
  for (let i = 0; i < 4; i++) {
    const p = ring[i]!, q = ring[(i + 1) % 4]!;
    if (p.x !== q.x && p.y !== q.y) return undefined; // a diagonal side
  }
  return { kind: 'rect', u0: Math.min(...xs), u1: Math.max(...xs), v0: Math.min(...ys), v1: Math.max(...ys) };
}

/**
 * A piece cut along the knot lines crossing it (each knot cell's part of a triangle fan-triangulated, of a
 * rectangle a rectangle), so that the quadrature never straddles a knot line of a NURBS surface.
 */
function splitAtKnots(piece: Piece, cuts: { readonly u: readonly number[]; readonly v: readonly number[] }): Piece[] {
  const [ulo, uhi, vlo, vhi] =
    piece.kind === 'rect'
      ? [piece.u0, piece.u1, piece.v0, piece.v1]
      : [Math.min(piece.a.x, piece.b.x, piece.c.x), Math.max(piece.a.x, piece.b.x, piece.c.x), Math.min(piece.a.y, piece.b.y, piece.c.y), Math.max(piece.a.y, piece.b.y, piece.c.y)];
  const us = cuts.u.filter((k) => k > ulo && k < uhi), vs = cuts.v.filter((k) => k > vlo && k < vhi);
  if (us.length === 0 && vs.length === 0) return [piece];
  const out: Piece[] = [];
  if (piece.kind === 'rect') {
    const ub = [ulo, ...us, uhi], vb = [vlo, ...vs, vhi];
    for (let i = 0; i + 1 < ub.length; i++) for (let j = 0; j + 1 < vb.length; j++) out.push({ kind: 'rect', u0: ub[i]!, u1: ub[i + 1]!, v0: vb[j]!, v1: vb[j + 1]! });
    return out;
  }
  const ub = [-Infinity, ...us, Infinity], vb = [-Infinity, ...vs, Infinity];
  for (let i = 0; i + 1 < ub.length; i++) {
    const col = clipConvex([piece.a, piece.b, piece.c], 'x', ub[i]!, ub[i + 1]!);
    if (col.length < 3) continue;
    for (let j = 0; j + 1 < vb.length; j++) {
      const cell = clipConvex(col, 'y', vb[j]!, vb[j + 1]!);
      for (let m = 1; m + 1 < cell.length; m++) out.push({ kind: 'tri', a: cell[0]!, b: cell[m]!, c: cell[m + 1]! });
    }
  }
  return out;
}

/** The tensor `GL_POINTS × GL_POINTS` Gauss–Legendre rule on a `(u, v)` rectangle. */
function rectRule(s: Surface3, u0: number, u1: number, v0: number, v1: number): Result<number> {
  const du = u1 - u0, dv = v1 - v0;
  if (!(du > 0 && dv > 0)) return ok(0);
  let sum = 0;
  for (let i = 0; i < GL_POINTS; i++) {
    for (let j = 0; j < GL_POINTS; j++) {
      const f = areaDensity(s, u0 + GL_X[i]! * du, v0 + GL_X[j]! * dv);
      if (!f.ok) return f;
      sum += GL_W[i]! * GL_W[j]! * f.value;
    }
  }
  return ok(sum * du * dv);
}

const mid = (p: Point2, q: Point2): Point2 => vec2((p.x + q.x) / 2, (p.y + q.y) / 2);
const uvArea = (a: Point2, b: Point2, c: Point2): number => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;

const pieceRule = (s: Surface3, p: Piece): Result<number> => (p.kind === 'rect' ? rectRule(s, p.u0, p.u1, p.v0, p.v1) : triangleRule(s, p.a, p.b, p.c));
const pieceArea = (p: Piece): number => (p.kind === 'rect' ? (p.u1 - p.u0) * (p.v1 - p.v0) : uvArea(p.a, p.b, p.c));

/** The four halves-by-halves children of a piece (edge midpoints of a triangle, center lines of a rectangle). */
function children(p: Piece): Piece[] {
  if (p.kind === 'rect') {
    const um = (p.u0 + p.u1) / 2, vm = (p.v0 + p.v1) / 2;
    return [
      { kind: 'rect', u0: p.u0, u1: um, v0: p.v0, v1: vm },
      { kind: 'rect', u0: um, u1: p.u1, v0: p.v0, v1: vm },
      { kind: 'rect', u0: p.u0, u1: um, v0: vm, v1: p.v1 },
      { kind: 'rect', u0: um, u1: p.u1, v0: vm, v1: p.v1 },
    ];
  }
  const mab = mid(p.a, p.b), mbc = mid(p.b, p.c), mca = mid(p.c, p.a);
  return [
    { kind: 'tri', a: p.a, b: mab, c: mca },
    { kind: 'tri', a: mab, b: p.b, c: mbc },
    { kind: 'tri', a: mca, b: mbc, c: p.c },
    { kind: 'tri', a: mab, b: mbc, c: mca },
  ];
}

/**
 * The rounding floor of a refinement test: corners of magnitude `M` and a longest side `L` give the `(u, v)` area
 * of a split an error of about `ε M L`, which a sliver (area ≪ M L) cannot resolve below; scaled by the mean density.
 */
function roundingFloor(p: Piece, value: number): number {
  const pts = p.kind === 'rect' ? [vec2(p.u0, p.v0), vec2(p.u1, p.v1)] : [p.a, p.b, p.c];
  const M = Math.max(1, ...pts.map((q) => Math.max(Math.abs(q.x), Math.abs(q.y))));
  const L =
    p.kind === 'rect'
      ? Math.max(p.u1 - p.u0, p.v1 - p.v0)
      : Math.max(Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y), Math.hypot(p.c.x - p.b.x, p.c.y - p.b.y), Math.hypot(p.a.x - p.c.x, p.a.y - p.c.y));
  const area = pieceArea(p);
  return 64 * Number.EPSILON * (Math.abs(value) + (area > 0 ? (M * L * Math.abs(value)) / area : 0));
}

/**
 * The area of face `face` (see the module comment). Errors: an unknown face, preparation errors, a domain the
 * mesher cannot triangulate (`invalid-topology` / `invalid-input` from `triangulatePolygon`), surface evaluation
 * errors, and `not-converged` past the refinement bounds.
 */
export function faceArea(kernel: Kernel, body: BodyInput, face: FaceId): Result<number> {
  const op = 'query.faceArea';
  const b = prepared(kernel, body);
  if (!b.ok) return b;
  const dom = faceDomain(b.value, face, op);
  if (!dom.ok) return dom;
  const s = dom.value.surface;
  let pieces: Piece[];
  const rect = dom.value.rings.length === 1 ? asRect(dom.value.rings[0]!) : undefined;
  if (rect !== undefined) pieces = [rect];
  else {
    const points: Point2[] = [];
    const loops: number[][] = [];
    for (const [li, ring] of dom.value.rings.entries()) {
      const idx = ring.map((p) => points.push(p) - 1);
      const o = ringOrientation(points, idx);
      if (o === 0) return invalidInput(op, `loop ${li} has no orientation in (u, v)`);
      if ((li === 0) !== (o > 0)) idx.reverse();
      loops.push(idx);
    }
    const tris = triangulatePolygon(points, loops);
    if (!tris.ok) return tris;
    pieces = tris.value.map(([i, j, k]) => ({ kind: 'tri', a: points[i]!, b: points[j]!, c: points[k]! }));
  }
  const cuts = knotCuts(s);
  pieces = pieces.flatMap((p) => splitAtKnots(p, cuts));
  const domainArea = pieces.reduce((acc, p) => acc + pieceArea(p), 0);
  if (!(domainArea > 0)) return ok(0);
  const stack: { readonly piece: Piece; readonly value: number; readonly depth: number }[] = [];
  let estimate = 0;
  for (const piece of pieces) {
    const v = pieceRule(s, piece);
    if (!v.ok) return v;
    estimate += v.value;
    stack.push({ piece, value: v.value, depth: 0 });
  }
  const tol = Math.max(AREA_REL_TOL * Math.abs(estimate), kernel.tolerances.approxTol3d ** 2);
  let total = 0;
  let visited = stack.length;
  while (stack.length > 0) {
    const t = stack.pop()!;
    const kids = children(t.piece);
    const vals: number[] = [];
    for (const kid of kids) {
      const v = pieceRule(s, kid);
      if (!v.ok) return v;
      vals.push(v.value);
    }
    const fine = vals[0]! + vals[1]! + vals[2]! + vals[3]!;
    const share = (tol * pieceArea(t.piece)) / domainArea;
    if (Math.abs(fine - t.value) <= Math.max(share, roundingFloor(t.piece, fine))) {
      total += fine;
      continue;
    }
    if (t.depth >= MAX_AREA_DEPTH || visited + 4 > MAX_AREA_PIECES) return err({ kind: 'not-converged', operation: op, iterations: visited });
    visited += 4;
    kids.forEach((piece, i) => stack.push({ piece, value: vals[i]!, depth: t.depth + 1 }));
  }
  if (!Number.isFinite(total)) return invalidInput(op, 'area is not finite');
  return ok(total);
}
