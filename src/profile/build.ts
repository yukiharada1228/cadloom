/**
 * Wire builders for common profile shapes, in the profile plane's 2D coordinates. Every builder returns a closed
 * counter-clockwise wire (or the orientation its input implies, for `polygonWire` and `bulgeWire`); pass the
 * wires to `createProfile`, which checks them and normalises orientation.
 *
 * - `polygonWire(points)`: lines `p_i → p_{(i+1) mod n}` (the segment indexing of `shoelace2` in
 *   `formal/CadloomFormal/Profile.lean`);
 * - `rectangleWire(x, y, w, h)`: the polygon `(x, y), (x + w, y), (x + w, y + h), (x, y + h)`;
 * - `regularPolygonWire(center, circumradius, n, rotation)`: vertices `center + R (cos φ_k, sin φ_k)`,
 *   `φ_k = rotation + 2πk/n`;
 * - `circleWire(center, r)`: one counter-clockwise full arc from angle 0;
 * - `slotWire(c0, c1, r)`: the stadium around the segment `c0 c1` (two lines tangent to two half circles);
 * - `bulgeWire(vertices)`: a polyline with arcs, each vertex carrying the bulge of the segment that starts there
 *   (DXF convention: `bulge = tan(θ/4)` for the signed sweep `θ`, positive counter-clockwise, 0 a line).
 *
 * Upstream consulted (for the shapes, not translated): `solidcore/crates/solidcore/src/prism/profile.rs`
 * (`Seg2::Arc`: center, start angle, signed sweep), `prism/sheet.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import { vec2, type Point2 } from '../math/vec.ts';
import { TWO_PI } from '../curve/types.ts';
import { arcSegment2, lineSegment2, type Segment2, type Wire2 } from './segment.ts';

const OP = 'profile.build';

/** The closed polygon through `points` (at least 3). */
export function polygonWire(points: readonly Point2[]): Result<Wire2> {
  if (points.length < 3) return invalidInput(OP, 'a polygon needs at least 3 points');
  const out: Segment2[] = [];
  for (let i = 0; i < points.length; i++) {
    const s = lineSegment2(points[i]!, points[(i + 1) % points.length]!);
    if (!s.ok) return s;
    out.push(s.value);
  }
  return ok(Object.freeze(out));
}

/** The axis-aligned rectangle with lower-left corner `(x, y)`, width `w > 0`, height `h > 0` (counter-clockwise). */
export function rectangleWire(x: number, y: number, w: number, h: number): Result<Wire2> {
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return invalidInput(OP, 'rectangle sizes must be finite and positive');
  return polygonWire([vec2(x, y), vec2(x + w, y), vec2(x + w, y + h), vec2(x, y + h)]);
}

/** The regular `n`-gon (`n >= 3`) inscribed in the circle of `circumradius` about `center` (counter-clockwise). */
export function regularPolygonWire(center: Point2, circumradius: number, n: number, rotation = 0): Result<Wire2> {
  if (!Number.isInteger(n) || n < 3) return invalidInput(OP, 'a regular polygon needs an integer n >= 3');
  if (!(circumradius > 0) || !Number.isFinite(circumradius)) return invalidInput(OP, 'circumradius must be finite and positive');
  const pts: Point2[] = [];
  for (let k = 0; k < n; k++) {
    const t = rotation + (TWO_PI * k) / n;
    pts.push(vec2(center.x + circumradius * Math.cos(t), center.y + circumradius * Math.sin(t)));
  }
  return polygonWire(pts);
}

/** The full circle of radius `r` about `center`: one counter-clockwise arc from angle 0 to `2π`. */
export function circleWire(center: Point2, r: number): Result<Wire2> {
  const a = arcSegment2(center, r, 0, TWO_PI, true);
  return a.ok ? ok(Object.freeze([a.value])) : a;
}

/** The stadium of radius `r` around the segment from `c0` to `c1` (counter-clockwise: line, arc, line, arc). */
export function slotWire(c0: Point2, c1: Point2, r: number): Result<Wire2> {
  const dx = c1.x - c0.x, dy = c1.y - c0.y, len = Math.hypot(dx, dy);
  if (!(len > 0) || !Number.isFinite(len)) return invalidInput(OP, 'slot centers must be distinct and finite');
  if (!(r > 0) || !Number.isFinite(r)) return invalidInput(OP, 'slot radius must be finite and positive');
  const nx = dy / len, ny = -dx / len; // right of c0 → c1
  const a = Math.atan2(ny, nx);
  const segs = [
    lineSegment2(vec2(c0.x + r * nx, c0.y + r * ny), vec2(c1.x + r * nx, c1.y + r * ny)),
    arcSegment2(c1, r, a, a + Math.PI, true),
    lineSegment2(vec2(c1.x - r * nx, c1.y - r * ny), vec2(c0.x - r * nx, c0.y - r * ny)),
    arcSegment2(c0, r, a + Math.PI, a + TWO_PI, true),
  ];
  const out: Segment2[] = [];
  for (const s of segs) {
    if (!s.ok) return s;
    out.push(s.value);
  }
  return ok(Object.freeze(out));
}

/** A polyline vertex with the bulge of the segment that starts at it (0: a line). */
export interface BulgeVertex {
  readonly point: Point2;
  readonly bulge: number;
}

/**
 * The arc from `p` to `q` of bulge `b = tan(θ/4)` (`θ` the signed sweep, `|b| <= 1` up to a half circle,
 * larger up to almost a full circle): radius `c / (2 |sin(θ/2)|)` for the chord length `c`, center on the
 * chord's left (counter-clockwise, `b > 0`) or right side at `(c/2)(1 - b²)/(2b)` from its midpoint.
 */
export function bulgeArc(p: Point2, q: Point2, b: number): Result<Segment2> {
  if (!Number.isFinite(b) || b === 0) return invalidInput(OP, 'bulge must be finite and non-zero');
  const dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy);
  if (!(c > 0) || !Number.isFinite(c)) return invalidInput(OP, 'bulge arc end points must be distinct and finite');
  const theta = 4 * Math.atan(b);
  const off = (c / 2) * ((1 - b * b) / (2 * b));
  const lx = -dy / c, ly = dx / c; // left of p → q
  const center = vec2((p.x + q.x) / 2 + off * lx, (p.y + q.y) / 2 + off * ly);
  const radius = c / (2 * Math.abs(Math.sin(theta / 2)));
  const a0 = Math.atan2(p.y - center.y, p.x - center.x);
  return arcSegment2(center, radius, a0, a0 + theta, theta > 0);
}

/** The closed polyline with arcs through `vertices` (at least 2; the last segment returns to the first vertex). */
export function bulgeWire(vertices: readonly BulgeVertex[]): Result<Wire2> {
  if (vertices.length < 2) return invalidInput(OP, 'a bulge polyline needs at least 2 vertices');
  const out: Segment2[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!, w = vertices[(i + 1) % vertices.length]!;
    const s = v.bulge === 0 ? lineSegment2(v.point, w.point) : bulgeArc(v.point, w.point, v.bulge);
    if (!s.ok) return s;
    out.push(s.value);
  }
  return ok(Object.freeze(out));
}
