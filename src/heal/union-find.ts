/**
 * Deterministic equivalence classes for sewing: `mergeLabels` (quick-find with the minimum index as the
 * representative) and `clusterPoints` (points within a tolerance, numbered by sorted coordinate order).
 *
 * `mergeLabels(n, pairs)` starts from `label(x) = x` and processes `pairs` in order; merging `(a, b)` sets
 * `m = min(label a, label b)`, `M = max(label a, label b)` and relabels every `x` with `label x = M` to `m`.
 * This is exactly `runMerges` of `formal/CadloomFormal/Heal.lean`: the result satisfies
 * `label (label x) = label x` (`runMerges_idem`), `label x <= x` (`runMerges_le`), and `label x = label y` iff
 * `x` and `y` are connected by the pairs (`runMerges_sound`, `runMerges_complete`), so the representative of a
 * class is its minimum member (`runMerges_rep_min`). The class member lists make each merge cost the size of
 * the relabelled class (same function as relabelling the whole array, which is what Lean models).
 *
 * `clusterPoints(points, tol)` sorts the points by `(x, y, z)` (ties by input index), pairs every two points
 * within `tol` (a sweep over the sorted `x`), and merges the pairs by `mergeLabels` over **sorted positions**.
 * So the clusters and their numbering (ascending by the sorted position of their minimum member) depend only on
 * the coordinates, not on insertion order. Clusters are the transitive closure of "within `tol`": a chain can
 * be wider than `tol`, which the caller sees in its gap report (and the geometric validation then refuses).
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/heal/stitch.rs`,
 * `heal/stitch/*` (vertex and edge matching within the stitch tolerance), `heal/gap.rs` (the gaps closed) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import type { Point3 } from '../math/vec.ts';
import { distance3 } from '../math/vec.ts';

/**
 * An incremental union–find over `0 .. n - 1` (path halving), for callers that must ask "already connected?"
 * between unions (the imprint arrangement's chord / bridge decision). Batch merges with deterministic labels use
 * `mergeLabels`; both are the kernel's only union–find code.
 */
export function disjointSets(n: number): { readonly find: (x: number) => number; readonly union: (x: number, y: number) => void } {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  return Object.freeze({ find, union: (x: number, y: number): void => void (parent[find(x)] = find(y)) });
}

/**
 * The labels after merging `pairs` in order over `0 .. n - 1` (see the module comment; Lean `runMerges`).
 * Pairs naming an index outside `0 .. n - 1` are a programming error (`RangeError`).
 */
export function mergeLabels(n: number, pairs: readonly (readonly [number, number])[]): readonly number[] {
  const label: number[] = [];
  const members: number[][] = [];
  for (let i = 0; i < n; i++) {
    label.push(i);
    members.push([i]);
  }
  for (const [a, b] of pairs) {
    if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < n && b < n)) {
      throw new RangeError(`mergeLabels: pair (${a}, ${b}) out of range`);
    }
    const la = label[a]!, lb = label[b]!;
    if (la === lb) continue;
    const m = Math.min(la, lb), M = Math.max(la, lb);
    const moved = members[M]!;
    for (const x of moved) label[x] = m;
    members[m]!.push(...moved);
    members[M] = [];
  }
  return Object.freeze(label);
}

export interface PointClusters {
  /** Cluster of each input point, numbered `0 .. count - 1` by the sorted position of the cluster's minimum. */
  readonly clusterOf: readonly number[];
  readonly count: number;
  /** The members (input indices) of each cluster, in sorted coordinate order. */
  readonly members: readonly (readonly number[])[];
}

const comparePoints = (p: Point3, q: Point3): number => p.x - q.x || p.y - q.y || p.z - q.z;

/** Clusters of points within `tol` (transitively), deterministic (see the module comment). */
export function clusterPoints(points: readonly Point3[], tol: number): PointClusters {
  const order = points.map((_, i) => i).sort((i, j) => comparePoints(points[i]!, points[j]!) || i - j);
  const pairs: [number, number][] = [];
  for (let a = 0; a < order.length; a++) {
    const p = points[order[a]!]!;
    for (let b = a + 1; b < order.length; b++) {
      const q = points[order[b]!]!;
      if (q.x - p.x > tol) break;
      if (distance3(p, q) <= tol) pairs.push([a, b]);
    }
  }
  const label = mergeLabels(order.length, pairs);
  const number = new Map<number, number>();
  const clusterOf = new Array<number>(points.length).fill(0);
  const members: number[][] = [];
  for (let a = 0; a < order.length; a++) {
    const rep = label[a]!;
    let k = number.get(rep);
    if (k === undefined) {
      k = members.length;
      number.set(rep, k);
      members.push([]);
    }
    clusterOf[order[a]!] = k;
    members[k]!.push(order[a]!);
  }
  return Object.freeze({
    clusterOf: Object.freeze(clusterOf),
    count: members.length,
    members: Object.freeze(members.map((m) => Object.freeze(m))),
  });
}
