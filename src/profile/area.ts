/**
 * Areas and centroids of profile wires and regions by Green's theorem.
 *
 * For a closed, counter-clockwise boundary `∂R`: `A = ½ ∮ (x dy - y dx)`, `∫∫ x dA = ½ ∮ x² dy`,
 * `∫∫ y dA = -½ ∮ y² dx`. A wire's integrals are the sums of its segments' terms (`segmentGreen`):
 * - line `p → q`: area `½ (p × q)` (the shoelace term, `p × q = p.x q.y - q.x p.y`), moments
 *   `(q.y - p.y)(p.x² + p.x q.x + q.x²) / 6` and `-(q.x - p.x)(p.y² + p.y q.y + q.y²) / 6`;
 * - arc about `c` of radius `r` from `θ0` to `θ1` (either direction): area
 *   `(r²/2)(θ1 - θ0) + ½ (c.x (y1 - y0) - c.y (x1 - x0))` with `(x_k, y_k) = c + r (cos θ_k, sin θ_k)` — the
 *   sector about `c` plus the chord terms of the center; equivalently the shoelace term of the chord plus the
 *   circular segment `(r²/2)(θ1 - θ0 - sin(θ1 - θ0))` (`formal/CadloomFormal/Profile.lean`: `arcTerm2_chord_segment`);
 *   moments in closed form from `∫cos`, `∫cos²`, `∫cos³` (and the sines);
 * - NURBS: Gauss–Legendre quadrature (8 points) of `½ (x y' - y x')`, `½ x² y'`, `-½ y² x'` on every non-empty
 *   knot span (a Bézier piece). For a polynomial curve of degree `p <= 5` the integrands are polynomials of degree
 *   at most `3p - 1 <= 15` on each span, so the rule is exact up to rounding; rational curves and higher degrees
 *   use 16 sub-intervals per span (approximate, error far below the zone tolerance for reasonable curves).
 *
 * A region's area is its outer wire's (counter-clockwise, positive) plus its holes' (clockwise, negative).
 *
 * Formal model: `formal/CadloomFormal/Profile.lean` (`shoelace2` = twice the area of a polygon wire with the same
 * segment indexing as the TS `polygonWire`, `arcTerm2` = twice the arc term above).
 *
 * Upstream consulted (for the Green terms, not translated): `solidcore/crates/solidcore/src/prism/profile.rs`
 * (`Seg2::area_term`: a loop's signed area as the sum of its segments' Green terms, `½ ∫ x dy - y dx`),
 * `solidcore/crates/solidcore/src/mass/loop_area.rs` (signed loop areas, inner loops subtract) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { vec2, type Point2 } from '../math/vec.ts';
import { curveDerivatives, curveDomain, type NurbsCurve } from '../nurbs/curve.ts';
import type { Segment2, Wire2 } from './segment.ts';

/** The Green integrals of a boundary piece: `½ ∮ x dy - y dx`, `½ ∮ x² dy`, `-½ ∮ y² dx`. */
export interface GreenTerms {
  readonly area: number;
  readonly mx: number;
  readonly my: number;
}

const OP = 'profile.area';

/** Twice the signed area term of the line `p → q`: `p × q` (Lean `Profile.lineTerm2`). */
export const lineTerm2 = (p: Point2, q: Point2): number => p.x * q.y - q.x * p.y;

/**
 * Twice the Green area term of an arc (Lean `Profile.arcTerm2`): `r² (θ1 - θ0) + c.x (y1 - y0) - c.y (x1 - x0)`,
 * with the end points `c + r (cos θ, sin θ)`.
 */
export function arcTerm2(cx: number, cy: number, r: number, t0: number, t1: number): number {
  const x0 = cx + r * Math.cos(t0), y0 = cy + r * Math.sin(t0);
  const x1 = cx + r * Math.cos(t1), y1 = cy + r * Math.sin(t1);
  return r * r * (t1 - t0) + cx * (y1 - y0) - cy * (x1 - x0);
}

function lineGreen(p: Point2, q: Point2): GreenTerms {
  return {
    area: lineTerm2(p, q) / 2,
    mx: ((q.y - p.y) * (p.x * p.x + p.x * q.x + q.x * q.x)) / 6,
    my: (-(q.x - p.x) * (p.y * p.y + p.y * q.y + q.y * q.y)) / 6,
  };
}

function arcGreen(cx: number, cy: number, r: number, t0: number, t1: number): GreenTerms {
  const s0 = Math.sin(t0), s1 = Math.sin(t1), c0 = Math.cos(t0), c1 = Math.cos(t1);
  const dt = t1 - t0;
  // ∫cos = sin, ∫cos² = t/2 + sin 2t / 4, ∫cos³ = sin - sin³/3 (and the sine analogues), over [t0, t1].
  const iCos = s1 - s0, iSin = c0 - c1;
  const iCos2 = dt / 2 + (Math.sin(2 * t1) - Math.sin(2 * t0)) / 4;
  const iSin2 = dt / 2 - (Math.sin(2 * t1) - Math.sin(2 * t0)) / 4;
  const iCos3 = iCos - (s1 * s1 * s1 - s0 * s0 * s0) / 3;
  const iSin3 = iSin - (c0 * c0 * c0 - c1 * c1 * c1) / 3;
  return {
    area: arcTerm2(cx, cy, r, t0, t1) / 2,
    mx: (cx * cx * r * iCos + 2 * cx * r * r * iCos2 + r * r * r * iCos3) / 2,
    my: (cy * cy * r * iSin + 2 * cy * r * r * iSin2 + r * r * r * iSin3) / 2,
  };
}

/** Gauss–Legendre, 8 points on `[-1, 1]`: `[node, weight]` (the negative nodes mirror these). */
const GL8: readonly (readonly [number, number])[] = Object.freeze([
  [0.1834346424956498, 0.362683783378362],
  [0.525532409916329, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745],
  [0.9602898564975363, 0.1012285362903763],
] as const);

function nurbsGreen(c: NurbsCurve): Result<GreenTerms> {
  const [lo, hi] = curveDomain(c);
  const exact = c.weights === undefined && c.degree <= 5;
  const sub = exact ? 1 : 16;
  const knots: number[] = [];
  for (const k of c.knots) if (k >= lo && k <= hi && (knots.length === 0 || k > knots[knots.length - 1]!)) knots.push(k);
  let area = 0, mx = 0, my = 0;
  for (let i = 0; i + 1 < knots.length; i++) {
    const a = knots[i]!, b = knots[i + 1]!;
    for (let j = 0; j < sub; j++) {
      const u0 = a + ((b - a) * j) / sub, u1 = j + 1 === sub ? b : a + ((b - a) * (j + 1)) / sub;
      const half = (u1 - u0) / 2, mid = (u0 + u1) / 2;
      for (const [x, w] of GL8) {
        for (const u of [mid - half * x, mid + half * x]) {
          const d = curveDerivatives(c, u, 1);
          if (!d.ok) return d;
          const [px, py] = d.value[0]! as [number, number], [dx, dy] = d.value[1]! as [number, number];
          area += w * half * (px * dy - py * dx) / 2;
          mx += w * half * (px * px * dy) / 2;
          my -= w * half * (py * py * dx) / 2;
        }
      }
    }
  }
  return ok({ area, mx, my });
}

/** The Green integrals of one segment in its direction (see the module comment). */
export function segmentGreen(seg: Segment2): Result<GreenTerms> {
  switch (seg.kind) {
    case 'line':
      return ok(Object.freeze(lineGreen(seg.start, seg.end)));
    case 'arc':
      return ok(Object.freeze(arcGreen(seg.center.x, seg.center.y, seg.radius, seg.startAngle, seg.endAngle)));
    case 'nurbs': {
      const g = nurbsGreen(seg.curve);
      return g.ok ? ok(Object.freeze(g.value)) : g;
    }
  }
}

/** The sums of the segments' Green integrals of a wire (signed: positive when counter-clockwise). */
export function wireGreen(wire: Wire2): Result<GreenTerms> {
  let area = 0, mx = 0, my = 0;
  for (const s of wire) {
    const g = segmentGreen(s);
    if (!g.ok) return g;
    area += g.value.area;
    mx += g.value.mx;
    my += g.value.my;
  }
  if (!Number.isFinite(area) || !Number.isFinite(mx) || !Number.isFinite(my)) return invalidInput(OP, 'area integrals overflow');
  return ok(Object.freeze({ area, mx, my }));
}

/** The signed area of a wire (positive counter-clockwise). */
export function wireArea(wire: Wire2): Result<number> {
  const g = wireGreen(wire);
  return g.ok ? ok(g.value.area) : g;
}

/** Area and centroid of a set of wires taken together (outer counter-clockwise, holes clockwise). */
export interface AreaProperties {
  readonly area: number;
  readonly centroid: Point2;
}

/** Area and centroid of the region bounded by `wires` (their signed Green integrals summed). */
export function wiresAreaProperties(wires: readonly Wire2[]): Result<AreaProperties> {
  let area = 0, mx = 0, my = 0;
  for (const w of wires) {
    const g = wireGreen(w);
    if (!g.ok) return g;
    area += g.value.area;
    mx += g.value.mx;
    my += g.value.my;
  }
  if (!(Math.abs(area) > 0)) return invalidInput(OP, 'zero area');
  const centroid = Object.freeze(vec2(mx / area, my / area));
  if (!Number.isFinite(centroid.x) || !Number.isFinite(centroid.y)) return invalidInput(OP, 'centroid is not finite');
  return ok(Object.freeze({ area, centroid }));
}
