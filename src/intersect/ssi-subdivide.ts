/**
 * Patch-pair subdivision of the general surface/surface path (the "boxes" and "loop test" steps of
 * docs/ssi.md §4.2).
 *
 * A pair of parameter rectangles `(RA, RB)` is examined in a deterministic breadth-first order:
 * - **apart**: the certified boxes of `S_A(RA)` and `S_B(RB)` (M4 `boundSurface`) are disjoint
 *   (`boxesDisjoint3`, exact): no intersection there, dropped (a drop is always a proof);
 * - **leaf**: the normal cones (M4 `boundNormalCone`) admit no parallel pair
 *   (`normalConesSeparated`, Sederberg–Meyers): no tangency and no closed loop inside the pair,
 *   every curve through it crosses its boundary; kept as a seeding cell once both boxes are at most
 *   `leafSize` across (larger loop-free pairs are still halved, so one cell rarely holds two arcs);
 * - **unresolved**: neither, with both boxes at most `minSize` across: a tangency, a singular point,
 *   a tiny loop or merely loose boxes near a contact — resolved later by contact analysis or refused;
 * - otherwise the patch with the larger box is halved across its longer parameter direction
 *   (measured as `|S_u| Δu` against `|S_v| Δv` at the rectangle's center).
 * Budgets: more than `maxPairs` pairs examined, or a pair deeper than `maxDepth`, is a refusal
 * (`subdivision budget exceeded`, `recursion depth exceeded`), never a silent truncation.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/crates/ssi/src/piece.rs and intersect.rs (pairs halved until apart or loop-free,
 *   refused below the resolution), solidcore/crates/solidcore/src/intersect/surface_intersector/
 *   p5.rs (`do_intersection_with_caches`: box tests, leaf pairs), solidcore/docs/ssi.md §4.2.
 *   Rewritten for cadloom; not a translation.
 */
import { err, ok, type Result } from '../core/error.ts';
import { boundSurface } from '../interval/bound.ts';
import { box3Diagonal, boxesDisjoint3, type Box3 } from '../interval/box.ts';
import { interval, type Interval } from '../interval/interval.ts';
import { boundNormalCone, normalConesSeparated, type NormalCone } from '../interval/normal-cone.ts';
import { length3 } from '../math/vec.ts';
import { evaluateSurface3 } from '../surface/evaluate.ts';
import type { Surface3 } from '../surface/types.ts';
import { refusal } from './types.ts';

/** A parameter rectangle `[u0, u1] × [v0, v1]`. */
export interface Rect {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
}

export interface PairCell {
  readonly a: Rect;
  readonly b: Rect;
  readonly boxA: Box3;
  readonly boxB: Box3;
  readonly depth: number;
}

export interface SubdivisionResult {
  readonly leaves: readonly PairCell[];
  readonly unresolved: readonly PairCell[];
  readonly pairs: number;
}

export interface SubdivisionLimits {
  readonly maxPairs: number;
  readonly maxDepth: number;
  readonly leafSize: number;
  readonly minSize: number;
}

const OP = 'intersect.surfaceSurface';

function intervals(r: Rect): Result<readonly [Interval, Interval]> {
  const u = interval(r.u0, r.u1);
  if (!u.ok) return u;
  const v = interval(r.v0, r.v1);
  if (!v.ok) return v;
  return ok([u.value, v.value]);
}

/** Per-surface caches of boxes, cones and split directions (keyed by the rectangle). */
export class PatchCache {
  readonly surface: Surface3;
  private readonly boxes = new Map<string, Box3>();
  private readonly cones = new Map<string, NormalCone>();
  constructor(surface: Surface3) {
    this.surface = surface;
  }
  private static key(r: Rect): string {
    return `${r.u0},${r.u1},${r.v0},${r.v1}`;
  }
  box(r: Rect): Result<Box3> {
    const k = PatchCache.key(r);
    const hit = this.boxes.get(k);
    if (hit !== undefined) return ok(hit);
    const iv = intervals(r);
    if (!iv.ok) return iv;
    const b = boundSurface(this.surface, iv.value[0], iv.value[1]);
    if (b.ok) this.boxes.set(k, b.value);
    return b;
  }
  cone(r: Rect): Result<NormalCone> {
    const k = PatchCache.key(r);
    const hit = this.cones.get(k);
    if (hit !== undefined) return ok(hit);
    const iv = intervals(r);
    if (!iv.ok) return iv;
    const c = boundNormalCone(this.surface, iv.value[0], iv.value[1]);
    if (c.ok) this.cones.set(k, c.value);
    return c;
  }
  /** Halves `r` across its longer direction in 3D. */
  split(r: Rect): readonly [Rect, Rect] {
    const um = (r.u0 + r.u1) / 2, vm = (r.v0 + r.v1) / 2;
    const d = evaluateSurface3(this.surface, um, vm);
    let alongU = r.u1 - r.u0 >= r.v1 - r.v0;
    if (d.ok) {
      const lu = length3(d.value.su) * (r.u1 - r.u0);
      const lv = length3(d.value.sv) * (r.v1 - r.v0);
      if (Number.isFinite(lu) && Number.isFinite(lv) && lu + lv > 0) alongU = lu >= lv;
    }
    // Never split a direction below rounding.
    if (alongU && !(um > r.u0 && um < r.u1)) alongU = false;
    if (!alongU && !(vm > r.v0 && vm < r.v1)) alongU = true;
    return alongU
      ? [{ ...r, u1: um }, { ...r, u0: um }]
      : [{ ...r, v1: vm }, { ...r, v0: vm }];
  }
}

/** Runs the subdivision from the root pair (see the module comment). */
export function subdivide(ca: PatchCache, cb: PatchCache, ra: Rect, rb: Rect, limits: SubdivisionLimits): Result<SubdivisionResult> {
  const leaves: PairCell[] = [];
  const unresolved: PairCell[] = [];
  let queue: { a: Rect; b: Rect; depth: number }[] = [{ a: ra, b: rb, depth: 0 }];
  let pairs = 0;
  while (queue.length > 0) {
    const next: { a: Rect; b: Rect; depth: number }[] = [];
    for (const item of queue) {
      pairs++;
      if (pairs > limits.maxPairs) return err(refusal(OP, 'subdivision budget exceeded', pairs));
      const boxA = ca.box(item.a);
      if (!boxA.ok) return boxA;
      const boxB = cb.box(item.b);
      if (!boxB.ok) return boxB;
      const apart = boxesDisjoint3(boxA.value, boxB.value);
      if (!apart.ok) return apart;
      if (apart.value) continue;
      const dA = box3Diagonal(boxA.value), dB = box3Diagonal(boxB.value);
      const cell: PairCell = { a: item.a, b: item.b, boxA: boxA.value, boxB: boxB.value, depth: item.depth };
      const coneA = ca.cone(item.a);
      if (!coneA.ok) return coneA;
      const coneB = cb.cone(item.b);
      if (!coneB.ok) return coneB;
      const separated = normalConesSeparated(coneA.value, coneB.value);
      if (separated && dA <= limits.leafSize && dB <= limits.leafSize) {
        leaves.push(cell);
        continue;
      }
      if (!separated && dA <= limits.minSize && dB <= limits.minSize) {
        unresolved.push(cell);
        continue;
      }
      if (item.depth >= limits.maxDepth) return err(refusal(OP, 'recursion depth exceeded', item.depth));
      const bound = separated ? limits.leafSize : limits.minSize;
      const splitA = dA >= dB ? dA > bound : !(dB > bound);
      if (splitA) {
        for (const a of ca.split(item.a)) next.push({ a, b: item.b, depth: item.depth + 1 });
      } else {
        for (const b of cb.split(item.b)) next.push({ a: item.a, b, depth: item.depth + 1 });
      }
    }
    queue = next;
  }
  return ok({ leaves, unresolved, pairs });
}
