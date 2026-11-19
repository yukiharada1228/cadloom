/**
 * The counting model of imprinting: how each elementary imprint step changes the counts `(V, E, F, L)` of a
 * B-rep, and the Euler–Poincaré quantity `χ = V - E + 2F - L` (`V - E + F - (L - F)`, which equals
 * `2 (S - G)` for `S` shells of total genus `G`, M0 `eulerPoincare`). Every step preserves `χ`, so imprinting
 * never changes the genus. The table is the Lean `Imprint.delta` (`formal/CadloomFormal/Imprint.lean`):
 *
 * | step | meaning | ΔV | ΔE | ΔF | ΔL |
 * |---|---|---|---|---|---|
 * | `split-edge` | a new vertex inside an edge: the edge (both coedges) becomes two | +1 | +1 | 0 | 0 |
 * | `spur` | a new edge from a vertex of the face's graph to a new vertex | +1 | +1 | 0 | 0 |
 * | `free-edge` | a new edge between two new vertices, apart from the graph: a new hole loop | +2 | +1 | 0 | +1 |
 * | `chord` | a new edge between two vertices of one connected boundary: the face splits | 0 | +1 | +1 | +1 |
 * | `bridge` | a new edge joining two loops of one face: they become one loop | 0 | +1 | 0 | -1 |
 * | `ring` | a closed edge on a new vertex inside the face: a hole and a new face | +1 | +1 | +1 | +2 |
 *
 * A chord between two points inside edges is `split-edge`, `split-edge`, `chord`: `V + 2, E + 3, F + 1, L + 1`
 * (Lean `chord_new_vertices`); a closed curve inside a face is one `ring` (Lean `ring_counts`).
 *
 * The imprint (`imprint.ts`) logs one step per edge cut and per imprinted curve: the curves of a face are added
 * in an order that attaches each to the graph built so far when it can, and union–find over the `(u, v)` graph's
 * components decides chord / bridge / spur / free-edge / ring. The faces and loops the arrangement walk then
 * finds must equal the counts this model predicts (`applyImprintOps` from `F = 1`, `L = loops of the face`),
 * otherwise the imprint is refused; and the resulting body's counts equal the original counts with all logged
 * steps applied (tested).
 *
 * Upstream consulted (for the invariant, not translated): `solidcore/crates/solidcore/src/topology/brep.rs`
 * (Euler operators keep `V - E + F - (L - F) = 2 (S - G)`), `solidcore/docs/booleans.md` stage 2 ("imprint") —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */

/** One elementary imprint step (see the module table). */
export type ImprintOp = 'split-edge' | 'spur' | 'free-edge' | 'chord' | 'bridge' | 'ring';

/** Entity counts of a B-rep (or of one face's share of them). */
export interface ImprintCounts {
  readonly v: number;
  readonly e: number;
  readonly f: number;
  readonly l: number;
}

/** The count change of each step (Lean `delta`). */
export const IMPRINT_DELTA: Readonly<Record<ImprintOp, ImprintCounts>> = Object.freeze({
  'split-edge': Object.freeze({ v: 1, e: 1, f: 0, l: 0 }),
  spur: Object.freeze({ v: 1, e: 1, f: 0, l: 0 }),
  'free-edge': Object.freeze({ v: 2, e: 1, f: 0, l: 1 }),
  chord: Object.freeze({ v: 0, e: 1, f: 1, l: 1 }),
  bridge: Object.freeze({ v: 0, e: 1, f: 0, l: -1 }),
  ring: Object.freeze({ v: 1, e: 1, f: 1, l: 2 }),
});

/** `counts + delta(op)` (Lean `apply`). */
export function applyImprintOp(c: ImprintCounts, op: ImprintOp): ImprintCounts {
  const d = IMPRINT_DELTA[op];
  return Object.freeze({ v: c.v + d.v, e: c.e + d.e, f: c.f + d.f, l: c.l + d.l });
}

/** The steps applied in order (Lean `run`). */
export function applyImprintOps(c: ImprintCounts, ops: readonly ImprintOp[]): ImprintCounts {
  return ops.reduce(applyImprintOp, Object.freeze({ ...c }));
}

/** `χ = V - E + 2F - L` (Lean `chi`). */
export function imprintChi(c: ImprintCounts): number {
  return c.v - c.e + 2 * c.f - c.l;
}
