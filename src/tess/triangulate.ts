/**
 * Planar triangulation of a face's boundary in its 2D work plane: ear clipping of a polygon with holes (hole
 * bridging), then Lawson flips on the constrained triangulation, and insertion of interior points.
 *
 * Every orientation decision uses the M0 exact `orient2d`, and every Delaunay decision the exact `incircle`
 * of `src/exact/incircle.ts`, on the given double coordinates: a decision is never contradicted by another one, so
 * collinear and cocircular inputs cannot make the mesher loop or emit crossing triangles.
 *
 * - `loopOrientation`, `segmentsMeet` — the exact ring orientation and segment contact of `src/exact/polygon.ts`
 *   (used by the mesher).
 * - `bridgeHoles` — splices each hole ring (clockwise) into the outer ring (counter-clockwise) by a doubled
 *   bridge edge `p → m … m → p` to a vertex `p` that `m` (the hole's rightmost vertex) sees: inside the
 *   corner cones at both ends and crossing or touching no boundary edge (Lean `bridgeHole`, `bridge_length`,
 *   `bridge_area`).
 * - `earClip` — clips ears of the ring: a node `b` with neighbours `a, c` turning strictly left with no
 *   non-convex node inside or on the triangle `(a, b, c)` (nodes naming the same vertex as `a`, `b` or `c` —
 *   the bridge copies — excepted); failing that, a node lying on the segment between its neighbours (a
 *   collinear boundary sample), as a zero-area triangle. Each step emits `[a, b, c]` and unlinks `b`, the last
 *   three nodes form the last triangle: `n` nodes give `n - 2` triangles (Lean `earClip`, `earClip_length`),
 *   whose signed areas sum to the shoelace area (Lean `earClip_area`).
 * - `Triangulation` — the triangles with their directed-edge adjacency; `legalize` flips non-constrained
 *   edges of strictly convex quadrilaterals whose triangles are not locally Delaunay (or one of which has zero
 *   area); `insertPoint` splits the triangle strictly containing a point (or the two triangles on a
 *   non-constrained edge through it) and legalizes around it.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore-tess/src/mesher/cdt.rs`
 * (constrained triangulation of loops with holes, Delaunay flips, seeds inserted inside), `mesher/shape.rs`,
 * `lib.rs` (`triangulate_planar`: first loop outer, the rest holes) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, invalidInput, ok, type Result } from '../core/error.ts';
import type { Point2 } from '../math/vec.ts';
import { incircleSign } from '../exact/incircle.ts';
import {
  closedSegmentsMeet,
  isFinitePoint2,
  onCollinearSegment,
  orientFinite as orient,
  ringOrientation,
  ringProblem,
} from '../exact/polygon.ts';

export type Tri = readonly [number, number, number];

const OP = 'tess.triangulate';
const failed = <T>(reason: string): Result<T> => err({ kind: 'invalid-topology', operation: OP, reason });

const samePoint = (p: Point2, q: Point2): boolean => p.x === q.x && p.y === q.y;

const between = onCollinearSegment;
const finite = isFinitePoint2;
const meet = closedSegmentsMeet;

/**
 * Whether the direction from `a` to `b` lies strictly inside the corner at `a` between `a0 = prev` and
 * `a1 = next` of a ring with the interior on its left (O'Rourke's `InCone`).
 */
function inCone(a0: Point2, a: Point2, a1: Point2, b: Point2): boolean {
  if (orient(a, a1, a0) >= 0) return orient(a, b, a0) > 0 && orient(b, a, a1) > 0;
  return !(orient(a, b, a1) >= 0 && orient(b, a, a0) >= 0);
}

/**
 * Splices the holes (clockwise rings) into the outer ring (counter-clockwise), in order of decreasing rightmost
 * `x` (ties: larger `y`, then the hole's index). The merged ring repeats both ends of every bridge. Fails
 * (`invalid-input`) for a missing or non-finite point or an empty hole, (`invalid-topology`) when a hole's
 * rightmost vertex sees no vertex of the ring.
 */
export function bridgeHoles(points: readonly Point2[], outer: readonly number[], holes: readonly (readonly number[])[]): Result<readonly number[]> {
  const bad = ringProblem(points, [outer, ...holes]);
  if (bad !== undefined) return invalidInput(OP, bad);
  if (outer.length === 0 || holes.some((h) => h.length === 0)) return invalidInput(OP, 'an empty ring');
  const right = (h: readonly number[]): number => {
    let best = 0;
    for (let i = 1; i < h.length; i++) {
      const p = points[h[i]!]!, q = points[h[best]!]!;
      if (p.x > q.x || (p.x === q.x && p.y > q.y)) best = i;
    }
    return best;
  };
  const order = holes.map((h, i) => ({ h, i, m: right(h) }));
  order.sort((A, B) => {
    const a = points[A.h[A.m]!]!, b = points[B.h[B.m]!]!;
    return b.x - a.x || b.y - a.y || A.i - B.i;
  });
  let ring: number[] = [...outer];
  for (let k = 0; k < order.length; k++) {
    const { h, m: mi } = order[k]!;
    const M = h[mi]!;
    const pm = points[M]!;
    const hn = h.length;
    const mPrev = points[h[(mi + hn - 1) % hn]!]!, mNext = points[h[(mi + 1) % hn]!]!;
    // Boundary edges that a bridge must not meet: the ring, this hole and the holes still to come.
    const edges: [number, number][] = [];
    const addRing = (r: readonly number[]): void => {
      for (let i = 0; i < r.length; i++) edges.push([r[i]!, r[(i + 1) % r.length]!]);
    };
    addRing(ring);
    for (let j = k; j < order.length; j++) addRing(order[j]!.h);
    const cands = ring.map((v, j) => {
      const q = points[v]!;
      return { j, d: (q.x - pm.x) ** 2 + (q.y - pm.y) ** 2 };
    });
    cands.sort((A, B) => A.d - B.d || A.j - B.j);
    let found = -1;
    const rn = ring.length;
    for (const { j } of cands) {
      const P = ring[j]!;
      const pp = points[P]!;
      if (samePoint(pp, pm)) continue;
      if (!inCone(points[ring[(j + rn - 1) % rn]!]!, pp, points[ring[(j + 1) % rn]!]!, pm)) continue;
      if (!inCone(mPrev, pm, mNext, pp)) continue;
      let blocked = false;
      for (const [u, v] of edges) {
        if (u === P || v === P || u === M || v === M) continue;
        if (meet(pm, pp, points[u]!, points[v]!)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        found = j;
        break;
      }
    }
    if (found < 0) return failed('a hole sees no vertex of its outer loop');
    const rotated = [...h.slice(mi), ...h.slice(0, mi)];
    const P = ring[found]!;
    ring = [...ring.slice(0, found + 1), ...rotated, M, P, ...ring.slice(found + 1)];
  }
  return ok(ring);
}

/**
 * Ear clipping of a counter-clockwise ring of point indices (see the module comment). Fails (`invalid-input`)
 * for a missing or non-finite point, (`invalid-topology`) for fewer than three nodes or when no ear can be found
 * (a ring that is not simple).
 *
 * Which ear is clipped never affects validity (Lean `earClip_*` hold for every choice), only the shape of the
 * triangles: after a clip, of the two neighbours that are ears the better shaped one is taken (a floating-point
 * preference, not a decision), so a long strip is zipped across rather than fanned from a corner; otherwise the
 * ring is searched from the last clip. A bucket grid of the nodes limits each ear test to the nodes near its
 * triangle.
 */
export function earClip(points: readonly Point2[], ring: readonly number[]): Result<Tri[]> {
  const bad = ringProblem(points, [ring]);
  if (bad !== undefined) return invalidInput(OP, bad);
  const n = ring.length;
  if (n < 3) return failed('a ring needs three vertices');
  const prev = ring.map((_, i) => (i + n - 1) % n);
  const next = ring.map((_, i) => (i + 1) % n);
  const P = (node: number): Point2 => points[ring[node]!]!;
  const isReflex = (node: number): boolean => orient(P(prev[node]!), P(node), P(next[node]!)) <= 0;
  const reflex = ring.map((_, i) => isReflex(i));
  const tris: Tri[] = [];

  // A uniform bucket grid of the nodes over the ring's box (about one node per cell), so an ear test visits only
  // the nodes in the cells its triangle's box covers. The cell of a coordinate is monotone in it, so every node
  // inside the box lies in a covered cell: the grid only skips work, it decides nothing.
  const alive = ring.map(() => true);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const v of ring) {
    const p = points[v]!;
    bx0 = Math.min(bx0, p.x);
    bx1 = Math.max(bx1, p.x);
    by0 = Math.min(by0, p.y);
    by1 = Math.max(by1, p.y);
  }
  const G = Math.max(1, Math.ceil(Math.sqrt(n)));
  const cellOf = (t: number, lo: number, hi: number): number => {
    const f = Math.floor(((t - lo) / (hi - lo)) * G);
    return Number.isFinite(f) ? Math.min(G - 1, Math.max(0, f)) : 0;
  };
  const cells: number[][] = Array.from({ length: G * G }, () => []);
  for (let i = 0; i < n; i++) {
    const p = P(i);
    cells[cellOf(p.y, by0, by1) * G + cellOf(p.x, bx0, bx1)]!.push(i);
  }

  const isEar = (b: number): boolean => {
    const a = prev[b]!, c = next[b]!;
    const pa = P(a), pb = P(b), pc = P(c);
    if (orient(pa, pb, pc) <= 0) return false;
    const ids = [ring[a]!, ring[b]!, ring[c]!];
    // Bounding box of the triangle: a point outside it is not in the triangle (exact comparisons).
    const x0 = Math.min(pa.x, pb.x, pc.x), x1 = Math.max(pa.x, pb.x, pc.x);
    const y0 = Math.min(pa.y, pb.y, pc.y), y1 = Math.max(pa.y, pb.y, pc.y);
    const cx0 = cellOf(x0, bx0, bx1), cx1 = cellOf(x1, bx0, bx1), cy0 = cellOf(y0, by0, by1), cy1 = cellOf(y1, by0, by1);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const x of cells[cy * G + cx]!) {
          // Every other node still in the ring, as in the walk `next[c] … prev[a]`.
          if (!alive[x] || x === a || x === b || x === c || !reflex[x] || ids.includes(ring[x]!)) continue;
          const p = P(x);
          if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
          if (orient(pa, pb, p) >= 0 && orient(pb, pc, p) >= 0 && orient(pc, pa, p) >= 0) return false;
        }
      }
    }
    return true;
  };
  const isCollinearSample = (b: number): boolean => {
    const pa = P(prev[b]!), pb = P(b), pc = P(next[b]!);
    return orient(pa, pb, pc) === 0 && !samePoint(pa, pc) && between(pa, pb, pc);
  };

  /**
   * The shape quality of the ear at `x`: twice its area over the sum of its squared sides (largest for an
   * equilateral triangle). Floating point, a preference only: it never decides whether a triangle is an ear.
   */
  const quality = (x: number): number => {
    const p = P(prev[x]!), q = P(x), r = P(next[x]!);
    const area2 = (q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y);
    const sides = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (r.x - q.x) ** 2 + (r.y - q.y) ** 2 + (p.x - r.x) ** 2 + (p.y - r.y) ** 2;
    const k = area2 / sides;
    return Number.isFinite(k) ? k : 0;
  };

  let remaining = n;
  let cursor = 0;
  let lastA = -1;
  let lastC = -1;
  while (remaining > 3) {
    let found = -1;
    if (lastA >= 0) {
      const ea = isEar(lastA), ec = isEar(lastC);
      if (ea && ec) found = quality(lastC) > quality(lastA) ? lastC : lastA;
      else if (ea) found = lastA;
      else if (ec) found = lastC;
    }
    for (const test of found >= 0 ? [] : [isEar, isCollinearSample]) {
      let node = cursor;
      for (let k = 0; k < remaining; k++, node = next[node]!) {
        if (test(node)) {
          found = node;
          break;
        }
      }
      if (found >= 0) break;
    }
    if (found < 0) return failed('no ear found (the loop is not simple)');
    const a = prev[found]!, c = next[found]!;
    tris.push([ring[a]!, ring[found]!, ring[c]!]);
    next[a] = c;
    prev[c] = a;
    alive[found] = false;
    remaining--;
    reflex[a] = isReflex(a);
    reflex[c] = isReflex(c);
    cursor = c;
    lastA = a;
    lastC = c;
  }
  const a = prev[cursor]!, c = next[cursor]!;
  if (orient(P(a), P(cursor), P(c)) < 0) return failed('the last triangle turns clockwise (the loop is not simple)');
  tris.push([ring[a]!, ring[cursor]!, ring[c]!]);
  return ok(tris);
}

/**
 * Triangulates the polygon whose first ring is the outer loop (counter-clockwise) and the others holes
 * (clockwise), by hole bridging and ear clipping. Fails (`invalid-input`) for a ring of fewer than three vertices,
 * consecutive coincident vertices or a ring of the wrong orientation; (`invalid-topology`) when bridging or clipping fails.
 */
export function triangulatePolygon(points: readonly Point2[], loops: readonly (readonly number[])[]): Result<Tri[]> {
  const outer = loops[0];
  if (outer === undefined) return invalidInput(OP, 'a polygon needs an outer loop');
  for (const [li, l] of loops.entries()) {
    if (l.length < 3) return invalidInput(OP, `loop ${li} has fewer than three vertices`);
    for (let i = 0; i < l.length; i++) {
      const p = points[l[i]!], q = points[l[(i + 1) % l.length]!];
      if (p === undefined || q === undefined) return invalidInput(OP, `loop ${li} names a missing point`);
      if (!(Number.isFinite(p.x) && Number.isFinite(p.y))) return invalidInput(OP, `loop ${li} has a non-finite point`);
      if (samePoint(p, q)) return invalidInput(OP, `loop ${li} repeats a point`);
    }
    const o = ringOrientation(points, l);
    if (li === 0 && o <= 0) return invalidInput(OP, 'the outer loop is not counter-clockwise');
    if (li > 0 && o >= 0) return invalidInput(OP, `hole ${li} is not clockwise`);
  }
  const ring = bridgeHoles(points, outer, loops.slice(1));
  if (!ring.ok) return ring;
  return earClip(points, ring.value);
}

/** Twice the signed shoelace area of a ring (floating point; for tests and reporting, never for decisions). */
export function shoelace2(points: readonly Point2[], ring: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = points[ring[i]!]!, q = points[ring[(i + 1) % ring.length]!]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s;
}

const KEY = 2 ** 26;
const dkey = (a: number, b: number): number => a * KEY + b;
const ukey = (a: number, b: number): number => (a < b ? a * KEY + b : b * KEY + a);

/** Largest point count a `Triangulation` takes (edge keys are `a * 2^26 + b`). */
export const MAX_TRIANGULATION_POINTS = KEY;

/**
 * A triangulation of points in the plane with counter-clockwise triangles, its directed-edge adjacency and a
 * set of constrained (boundary) edges that flips never remove. The edge map is used for lookups only.
 */
export class Triangulation {
  readonly points: Point2[];
  readonly tris: [number, number, number][];
  readonly #owner = new Map<number, number>();
  readonly #constrained = new Set<number>();
  /** `true`: flip for the Delaunay criterion too; `false`: only to remove zero-area triangles. */
  readonly #delaunay: boolean;
  #last = 0;

  /**
   * A triangulation of `points` (finite) with the counter-clockwise triangles `tris` and the constrained edges
   * `constrained`. Fails with `invalid-input` for a non-finite point, more than `MAX_TRIANGULATION_POINTS`
   * points, or a triangle or edge naming a missing point or repeating one.
   */
  static create(
    points: readonly Point2[],
    tris: readonly Tri[],
    constrained: readonly (readonly [number, number])[],
    delaunay: boolean,
  ): Result<Triangulation> {
    const op = 'tess.Triangulation.create';
    if (points.length > KEY) return invalidInput(op, 'too many points');
    if (!points.every(finite)) return invalidInput(op, 'non-finite point');
    const index = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < points.length;
    for (const t of tris) {
      if (!(index(t[0]) && index(t[1]) && index(t[2])) || t[0] === t[1] || t[1] === t[2] || t[2] === t[0]) {
        return invalidInput(op, 'a triangle names a missing point or repeats one');
      }
    }
    for (const [a, b] of constrained) if (!(index(a) && index(b)) || a === b) return invalidInput(op, 'a constrained edge names a missing point');
    return ok(new Triangulation(points, tris, constrained, delaunay));
  }

  private constructor(points: readonly Point2[], tris: readonly Tri[], constrained: readonly (readonly [number, number])[], delaunay: boolean) {
    this.points = [...points];
    this.tris = [];
    this.#delaunay = delaunay;
    for (const [a, b] of constrained) this.#constrained.add(ukey(a, b));
    for (const t of tris) this.#set(this.tris.length, [t[0], t[1], t[2]]);
  }

  #set(i: number, t: [number, number, number]): void {
    this.tris[i] = t;
    this.#owner.set(dkey(t[0], t[1]), i);
    this.#owner.set(dkey(t[1], t[2]), i);
    this.#owner.set(dkey(t[2], t[0]), i);
  }

  /** The vertex of triangle `i` opposite its directed edge `a → b`. */
  #third(i: number, a: number, b: number): number {
    const t = this.tris[i]!;
    return t[0] !== a && t[0] !== b ? t[0] : t[1] !== a && t[1] !== b ? t[1] : t[2];
  }

  #p(i: number): Point2 {
    return this.points[i]!;
  }

  #shouldFlip(a: number, b: number): boolean {
    if (this.#constrained.has(ukey(a, b))) return false;
    const t1 = this.#owner.get(dkey(a, b)), t2 = this.#owner.get(dkey(b, a));
    if (t1 === undefined || t2 === undefined || t1 === t2) return false;
    const c = this.#third(t1, a, b), d = this.#third(t2, b, a);
    if (c === d) return false;
    const pa = this.#p(a), pb = this.#p(b), pc = this.#p(c), pd = this.#p(d);
    if (!(orient(pa, pd, pc) > 0 && orient(pd, pb, pc) > 0)) return false;
    if (orient(pa, pb, pc) === 0 || orient(pb, pa, pd) === 0) return true;
    return this.#delaunay && incircleSign(pa, pb, pc, pd) > 0;
  }

  /** Replaces the triangles `(a, b, c)`, `(b, a, d)` by `(a, d, c)`, `(d, b, c)`. */
  #flip(a: number, b: number): [number, number] {
    const t1 = this.#owner.get(dkey(a, b))!, t2 = this.#owner.get(dkey(b, a))!;
    const c = this.#third(t1, a, b), d = this.#third(t2, b, a);
    this.#owner.delete(dkey(a, b));
    this.#owner.delete(dkey(b, a));
    this.#set(t1, [a, d, c]);
    this.#set(t2, [d, b, c]);
    return [c, d];
  }

  /**
   * Lawson flips from the given edges until every non-constrained edge is legal (see the module comment).
   * Termination: every flip either removes a zero-area triangle without creating one or, among triangles of
   * positive area, is a Delaunay flip; with exact predicates both are finite. `maxFlips` is a safety bound.
   */
  legalize(edges: readonly (readonly [number, number])[]): void {
    const stack = edges.map(([a, b]) => [a, b] as [number, number]).reverse();
    let flips = 0;
    const maxFlips = 64 * (this.tris.length + 16) * (this.tris.length + 16);
    while (stack.length > 0 && flips < maxFlips) {
      const [a, b] = stack.pop()!;
      if (!this.#shouldFlip(a, b)) continue;
      const [c, d] = this.#flip(a, b);
      flips++;
      stack.push([a, d], [d, b], [b, c], [c, a]);
    }
  }

  /** Legalizes every edge, in triangle order. */
  legalizeAll(): void {
    const edges: [number, number][] = [];
    for (const [a, b, c] of this.tris) edges.push([a, b], [b, c], [c, a]);
    this.legalize(edges);
  }

  /**
   * Where `p` lies: inside triangle `tri` (`edge = -1`), or in the relative interior of side `edge` (0: `t0 t1`,
   * 1: `t1 t2`, 2: `t2 t0`) of `tri`; `tri = -1` when outside every triangle or on a vertex. A walk from the
   * last triangle found, then a scan.
   */
  #locate(p: Point2): { readonly tri: number; readonly edge: number } {
    const classify = (i: number): number => {
      const [a, b, c] = this.tris[i]!;
      const o = [orient(this.#p(a), this.#p(b), p), orient(this.#p(b), this.#p(c), p), orient(this.#p(c), this.#p(a), p)];
      if (o[0]! < 0 || o[1]! < 0 || o[2]! < 0) return -2;
      const zeros = o.filter((x) => x === 0).length;
      if (zeros === 0) return -1;
      if (zeros === 1) return o.indexOf(0);
      return -3; // on a vertex (or a zero-area triangle)
    };
    let t = Math.min(this.#last, this.tris.length - 1);
    for (let steps = 0; steps < this.tris.length && t >= 0; steps++) {
      const k = classify(t);
      if (k === -1 || k >= 0) return { tri: t, edge: k };
      if (k === -3) break;
      const [a, b, c] = this.tris[t]!;
      let moved = false;
      for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
        if (orient(this.#p(u), this.#p(v), p) < 0) {
          const n = this.#owner.get(dkey(v, u));
          if (n !== undefined) {
            t = n;
            moved = true;
          }
          break;
        }
      }
      if (!moved) break;
    }
    for (let i = 0; i < this.tris.length; i++) {
      const k = classify(i);
      if (k === -1 || k >= 0) return { tri: i, edge: k };
    }
    return { tri: -1, edge: -1 };
  }

  /**
   * Inserts `p` when it lies strictly inside a triangle (split in three) or in the relative interior of a
   * non-constrained edge between two triangles (both split in two), then legalizes around it. Returns the new
   * point's index, or `-1` when `p` was not inserted (outside, on a vertex or on a constrained edge, or not finite).
   */
  insertPoint(p: Point2): number {
    if (this.points.length >= KEY || !finite(p)) return -1;
    const { tri: t, edge } = this.#locate(p);
    if (t < 0) return -1;
    const v = this.points.length;
    if (edge < 0) {
      this.points.push(p);
      const [a, b, c] = this.tris[t]!;
      this.#set(t, [a, b, v]);
      this.#set(this.tris.length, [b, c, v]);
      this.#set(this.tris.length, [c, a, v]);
      this.#last = t;
      this.legalize([[a, b], [b, c], [c, a]]);
      return v;
    }
    const tt = this.tris[t]!;
    const a = tt[edge]!, b = tt[(edge + 1) % 3]!, c = tt[(edge + 2) % 3]!;
    if (this.#constrained.has(ukey(a, b))) return -1;
    const t2 = this.#owner.get(dkey(b, a));
    if (t2 === undefined) return -1;
    const d = this.#third(t2, b, a);
    this.points.push(p);
    this.#owner.delete(dkey(a, b));
    this.#owner.delete(dkey(b, a));
    this.#set(t, [a, v, c]);
    this.#set(t2, [v, b, c]);
    this.#set(this.tris.length, [b, v, d]);
    this.#set(this.tris.length, [v, a, d]);
    this.#last = t;
    this.legalize([[b, c], [c, a], [a, d], [d, b]]);
    return v;
  }
}
