/**
 * The planar arrangement of one face in its `(u, v)` domain and the extraction of its sub-faces: the combinatorial
 * core of face splitting (imprint).
 *
 * Coordinates are the face's `(u, v)` with `v` negated on a reversed face, so that the material is always on the
 * left of every dart (a face's loops run with the material on their left seen from outside, M2 `Face`) and outer
 * boundaries run counter-clockwise. A **dart** is a directed edge of the arrangement with a polyline in these
 * coordinates; boundary coedges give one dart (their direction), imprinted curves two (`twin`s), pole gaps one.
 *
 * - **Next.** At the node a dart `h` enters, its successor is the first outgoing dart met turning clockwise from
 *   the direction back along `h` (the sharpest left turn): the walk then traces the region on the left of `h`.
 *   Directions are taken from each polyline's first (last) segment of non-zero length; the reverse of `h` itself
 *   is taken only when nothing else leaves the node (a dangling end).
 * - **Cycles.** Following successors partitions the darts into cycles. Twice the signed area of a cycle is the
 *   shoelace sum of its polyline (`ringArea2`, the Lean `Profile.shoelace2`); a positive cycle is the outer
 *   boundary of a sub-face, a non-positive one a hole.
 * - **Holes.** Each hole goes to the smallest outer cycle that contains a point just left of its longest segment
 *   (exact crossing count of `src/query/crossing.ts`). A hole with no outer cycle is an error.
 *
 * Lean: `formal/CadloomFormal/Imprint.lean` proves the area bookkeeping this relies on — a chord polyline between
 * two boundary points splits the shoelace area into the two parts' areas (`chord_split_area`), and inserting a
 * point on a segment (an edge cut) keeps it (`insert_on_segment`). The counts of the result are checked against
 * the counting model of `imprint-count.ts` by the caller.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/boolean/merge.rs`,
 * `boolean/topology_intersector.rs` (imprinted edges split faces into loops), `solidcore/docs/booleans.md` stage 2
 * ("imprint") — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import { ringArea2, vec2, type Point2 } from '../math/vec.ts';
import { crossingCount } from '../query/crossing.ts';

const OP = 'boolean.imprintArrangement';

/** A directed arrangement edge from node `from` to node `to` along `poly` (at least two points). */
export interface ArrangementDart {
  readonly from: number;
  readonly to: number;
  readonly poly: readonly Point2[];
}

/** A sub-face: its outer cycle and its holes, as dart indices in walk order. */
export interface ArrangementFace {
  readonly outer: readonly number[];
  readonly holes: readonly (readonly number[])[];
  /** Twice the signed area of the outer cycle (positive). */
  readonly area2: number;
}

/** Twice the signed area of a closed polygon (shoelace, Lean `Profile.shoelace2`): the kernel's one `ringArea2`. */
export { ringArea2 };

/** The polygon of a cycle: each dart's polyline without its last point (the next dart's first). */
export function cyclePolygon(darts: readonly ArrangementDart[], cycle: readonly number[]): Point2[] {
  const out: Point2[] = [];
  for (const d of cycle) {
    const poly = darts[d]!.poly;
    for (let i = 0; i + 1 < poly.length; i++) out.push(poly[i]!);
  }
  return out;
}

function directionFrom(poly: readonly Point2[], reverse: boolean): number | undefined {
  const n = poly.length;
  const p0 = reverse ? poly[n - 1]! : poly[0]!;
  for (let k = 1; k < n; k++) {
    const q = reverse ? poly[n - 1 - k]! : poly[k]!;
    const dx = q.x - p0.x, dy = q.y - p0.y;
    if (dx !== 0 || dy !== 0) return Math.atan2(dy, dx);
  }
  return undefined;
}

/** The successor of every dart (see the module comment). */
export function arrangementNext(darts: readonly ArrangementDart[]): Result<number[]> {
  const out = new Map<number, number[]>();
  const outAngle: number[] = [];
  for (const [i, d] of darts.entries()) {
    const a = directionFrom(d.poly, false);
    if (a === undefined) return err({ kind: 'degenerate', operation: OP });
    outAngle.push(a);
    const list = out.get(d.from);
    if (list === undefined) out.set(d.from, [i]);
    else list.push(i);
  }
  const next: number[] = [];
  for (const d of darts) {
    const back = directionFrom(d.poly, true);
    if (back === undefined) return err({ kind: 'degenerate', operation: OP });
    const cands = out.get(d.to) ?? [];
    let best = -1, bestTurn = Infinity;
    for (const c of cands) {
      let turn = (back - outAngle[c]!) % (2 * Math.PI);
      if (turn < 0) turn += 2 * Math.PI;
      if (turn <= 1e-12) turn = 2 * Math.PI; // the way back: last resort
      if (turn < bestTurn) {
        bestTurn = turn;
        best = c;
      }
    }
    if (best < 0) return err({ kind: 'invalid-topology', operation: OP, reason: `no dart leaves node ${d.to}` });
    next.push(best);
  }
  return ok(next);
}

/** The cycles of the successor permutation, each from its smallest dart index, in order of that index. */
export function arrangementCycles(darts: readonly ArrangementDart[]): Result<number[][]> {
  const next = arrangementNext(darts);
  if (!next.ok) return next;
  const seen = new Array<boolean>(darts.length).fill(false);
  const cycles: number[][] = [];
  for (let i = 0; i < darts.length; i++) {
    if (seen[i]) continue;
    const cyc: number[] = [];
    let d = i;
    while (!seen[d]) {
      seen[d] = true;
      cyc.push(d);
      d = next.value[d]!;
    }
    if (d !== i) return err({ kind: 'invalid-topology', operation: OP, reason: 'the successor map is not a permutation' });
    cycles.push(cyc);
  }
  return ok(cycles);
}

/** A point just left of the longest segment of a cycle (inside the region the cycle bounds on its left). */
function leftProbe(poly: readonly Point2[]): Point2 {
  let best = 0, bestLen = -1;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i]!, q = poly[(i + 1) % n]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const p = poly[best]!, q = poly[(best + 1) % n]!;
  const len = Math.max(bestLen, Number.MIN_VALUE);
  const dx = (q.x - p.x) / len, dy = (q.y - p.y) / len;
  const off = 1e-6 * bestLen;
  return vec2((p.x + q.x) / 2 - dy * off, (p.y + q.y) / 2 + dx * off);
}

/**
 * The sub-faces of an arrangement (see the module comment): outer cycles in cycle order, each with the holes it
 * owns. Errors: a degenerate dart, a node no dart leaves, a hole outside every outer cycle.
 */
export function arrangementFaces(darts: readonly ArrangementDart[]): Result<ArrangementFace[]> {
  const cycles = arrangementCycles(darts);
  if (!cycles.ok) return cycles;
  const polys = cycles.value.map((c) => cyclePolygon(darts, c));
  const areas = polys.map(ringArea2);
  const outers: number[] = [];
  const holes: number[] = [];
  areas.forEach((a, i) => (a > 0 ? outers : holes).push(i));
  const owned = new Map<number, number[]>();
  for (const h of holes) {
    const probe = leftProbe(polys[h]!);
    let owner = -1;
    for (const o of outers) {
      const c = crossingCount(probe, [polys[o]!]);
      if (c.on || c.count % 2 === 0) continue;
      if (owner < 0 || areas[o]! < areas[owner]!) owner = o;
    }
    if (owner < 0) return err({ kind: 'invalid-topology', operation: OP, reason: 'a hole lies in no sub-face' });
    const list = owned.get(owner);
    if (list === undefined) owned.set(owner, [h]);
    else list.push(h);
  }
  return ok(
    outers.map((o) =>
      Object.freeze({
        outer: Object.freeze(cycles.value[o]!),
        holes: Object.freeze((owned.get(o) ?? []).map((h) => Object.freeze(cycles.value[h]!))),
        area2: areas[o]!,
      }),
    ),
  );
}
