/**
 * Surface/surface intersection: `intersectSurfaces` tries the closed forms first (`ssi-exact.ts`,
 * `ssi-revolution.ts`; class `exact`) and otherwise runs the general path `marchSurfaces` (class
 * `certified`, or a refusal). docs/ssi.md §4 is the pipeline:
 *
 * 1. **Subdivision** (`ssi-subdivide.ts`): patch pairs are dropped only by disjoint certified
 *    boxes; loop-free pairs (separated normal cones) of at most `leafSize` are **leaves**; pairs
 *    neither apart nor loop-free at `minSize` are **unresolved**. Budgets refuse.
 *    `scale` = the smaller patch box diagonal, `leafSize = scale / 8`, `minSize = max(scale / 512,
 *    20 zoneTol3d)`.
 * 2. **Seeds**: first the **boundary crossings** (`ssi-boundary.ts`): every non-degenerate domain
 *    boundary iso-curve of each patch against the other surface by the curve/surface intersector
 *    (`intersectCurveSurface`, which isolates each crossing or refuses), so every open branch has a
 *    seed at its ends; then, for each leaf, its **boundary seeds** — a leaf side lying on a
 *    non-periodic domain bound of A or B is solved with that parameter fixed (Newton, 3×3 Cramer)
 *    from the leaf center, a local start search that also covers degenerate sides (a pole, the
 *    apex) — then its **interior seed**, the minimum-norm Newton root from the leaf center. A seed is kept when it lies in the leaf pair's parameter boxes widened by half
 *    their size; seeds are traced in that order (boundary seeds of all leaves first).
 * 3. **Tracing** (`ssi-march.ts`) from each seed not already on a traced branch, forward and
 *    backward along `n_A × n_B`, joined into one branch running along `n_A × n_B`; a branch that
 *    closes is a loop. A march that meets parallel normals (sine `< 1e-6`, or the oriented direction
 *    reversing) is refused: `tangent contact not resolved` — branch points are never stepped through.
 * 4. **Contacts** (`contactNewton`) for every unresolved pair no branch passes through: Newton on
 *    the gap's critical point. A definite contact (an extremum of the gap) with `|gap| <= zoneTol3d`
 *    is an isolated **touch point** when it is on the separating side (a minimum above zero or a
 *    maximum below), or on the crossing side with a loop whose largest 3D semi-axis
 *    `sqrt(2 |gap| / κ_min)` is within `zoneTol3d` (the closed forms' rule: a circle collapses only
 *    when its radius is within the zone, not merely its cap — upstream's WR-79 "small circle taken
 *    as a point"); a definite contact whose gap is on the separating side beyond the zone is a near
 *    miss (accepted on that measurement); any other crossing-side one must be enclosed by a traced
 *    closed branch (the small loop around it); a saddle or a degenerate contact at zero gap (branch point, tangent curve,
 *    higher-order contact) is refused. Anything else first tries to exclude the pair by further
 *    box subdivision, then refuses.
 * 5. **Completeness check**: every leaf must be passed through by a traced branch (its parameter
 *    polylines meet both of the leaf's parameter boxes widened by a quarter), contain a touch point,
 *    yield a new seed (then traced), or be excluded by further box subdivision; otherwise the call
 *    is refused (`subdivision budget exceeded`). A branch is never dropped silently.
 * 6. **Fitting** (`ssi-fit.ts`): each branch becomes a cubic B-spline with both pcurves on one knot
 *    vector and its measured deviation; a branch whose points all lie within `zoneTol3d` of its first
 *    (`2 zoneTol3d` for a loop) is reported as one point instead (a curve grazing a domain corner, a
 *    loop of radius within the zone: the closed forms' collapse rule).
 * Output order is deterministic (`sortHits`: curves, then points, by their first point).
 *
 * Not certified (measured or heuristic, documented): the coverage test of step 5 (a second arc
 * within a quarter cell of a traced one in both parameter spaces is taken as covered), the near-miss
 * acceptance of step 4, and the deviation between fitted points.
 *
 * Upstream consulted (SolidCraft solidcore, MIT OR Apache-2.0, commit 41ee3e5):
 *   solidcore/docs/ssi.md (the whole pipeline; §4.2 start points, §4.4 singularities, §4.6 caps),
 *   solidcore/crates/solidcore/src/intersect/surface_intersector.rs and surface_intersector/p5.rs
 *   (`do_intersection_with_caches`), adv_surface_intersector.rs (`find_interior_curves`),
 *   surface_tracer.rs, topology_solver.rs (ordering of curves), solidcore/crates/ssi/src/intersect.rs
 *   (`intersect_bodies`: closed forms first). Rewritten for cadloom; not a translation.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { box3Diagonal, boxesDisjoint3, type Box3 } from '../interval/box.ts';
import { distance3, distanceToSegment3, length3, type Point3 } from '../math/vec.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import { boundaryCrossings } from './ssi-boundary.ts';
import { patchBox } from './ssi-common.ts';
import { intersectSurfacesExact } from './ssi-exact.ts';
import { fitBranch } from './ssi-fit.ts';
import { march, SINGULAR_SIN, unwrapNear, type MarchLimits, type MarchResult } from './ssi-march.ts';
import { contactNewton, correct, createContext, footOn, type Contact, type SsiContext, type SsiState, type X4 } from './ssi-newton.ts';
import { PatchCache, subdivide, type PairCell, type Rect } from './ssi-subdivide.ts';
import {
  checkKernel,
  checkOptions,
  checkPatch,
  surfaceIntersection,
  type SsiOptions,
  type SurfacePatch,
} from './ssi-types.ts';
import { combineClass, refusal, type SurfaceIntersection, type SurfaceSurfaceHit, type SurfaceSurfacePoint } from './types.ts';

const OP = 'intersect.surfaceSurface';
/** Sine under which a stalled march is reported as an unresolved tangency. */
const STALL_TANGENT_SIN = 1e-3;

/**
 * Intersects two patches: the closed form when the pair has one (class `exact`), the general path
 * otherwise (class `certified`), or a refusal (see the module comment).
 */
export function intersectSurfaces(kernel: Kernel, a: SurfacePatch, b: SurfacePatch, options: SsiOptions = {}): Result<SurfaceIntersection> {
  const co = checkOptions(options);
  if (!co.ok) return co;
  if (options.forceMarching !== true) {
    const e = intersectSurfacesExact(kernel, a, b);
    if (!e.ok) return e;
    if (e.value !== undefined) return ok(e.value);
  }
  return marchSurfaces(kernel, a, b, options);
}

interface Branch {
  readonly states: readonly SsiState[];
  readonly closed: boolean;
}

interface Run {
  readonly ctx: SsiContext;
  readonly limits: MarchLimits;
  readonly branches: Branch[];
  readonly touches: Contact[];
  /** Touches and measured near misses: leaves next to them need no other explanation. */
  readonly contacts: Contact[];
  readonly cacheA: PatchCache;
  readonly cacheB: PatchCache;
  readonly leafSize: number;
}

const center = (c: PairCell): X4 => [(c.a.u0 + c.a.u1) / 2, (c.a.v0 + c.a.v1) / 2, (c.b.u0 + c.b.u1) / 2, (c.b.v0 + c.b.v1) / 2];

/** `x` lies in the cell's parameter boxes widened by `grow` times their size (periodic dims unwrapped). */
function inCell(ctx: SsiContext, c: PairCell, x: X4, grow: number): boolean {
  const lo = [c.a.u0, c.a.v0, c.b.u0, c.b.v0], hi = [c.a.u1, c.a.v1, c.b.u1, c.b.v1];
  const xx = unwrapNear(ctx, x, center(c));
  for (let i = 0; i < 4; i++) {
    const w = hi[i]! - lo[i]!;
    if (xx[i]! < lo[i]! - grow * w - 1e-12 || xx[i]! > hi[i]! + grow * w + 1e-12) return false;
  }
  return true;
}

/** Liang–Barsky: does the segment `p -> q` meet the rectangle? */
function segmentHitsRect(p0: number, p1: number, q0: number, q1: number, r: Rect): boolean {
  let t0 = 0, t1 = 1;
  const d = [q0 - p0, q1 - p1];
  const o = [p0, p1];
  const lo = [r.u0, r.v0], hi = [r.u1, r.v1];
  for (let k = 0; k < 2; k++) {
    if (d[k] === 0) {
      if (o[k]! < lo[k]! || o[k]! > hi[k]!) return false;
      continue;
    }
    let a = (lo[k]! - o[k]!) / d[k]!, b = (hi[k]! - o[k]!) / d[k]!;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}

const grown = (r: Rect, g: number): Rect => {
  const du = (r.u1 - r.u0) * g + 1e-12, dv = (r.v1 - r.v0) * g + 1e-12;
  return { u0: r.u0 - du, u1: r.u1 + du, v0: r.v0 - dv, v1: r.v1 + dv };
};

/** A traced branch passes through the cell (see the module comment, step 5). */
function covered(run: Run, c: PairCell): boolean {
  const ra = grown(c.a, 0.25), rb = grown(c.b, 0.25);
  const mid = center(c);
  for (const br of run.branches) {
    const st = br.states;
    for (let i = 0; i + 1 < Math.max(2, st.length); i++) {
      const x0 = unwrapNear(run.ctx, st[i]!.x, mid);
      const shift = x0.map((v, k) => v - st[i]!.x[k]!);
      const x1 = st[Math.min(i + 1, st.length - 1)]!.x.map((v, k) => v + shift[k]!);
      if (segmentHitsRect(x0[0], x0[1], x1[0]!, x1[1]!, ra) && segmentHitsRect(x0[2], x0[3], x1[2]!, x1[3]!, rb)) return true;
    }
  }
  return false;
}

/** The seed lies on a traced branch (3D near a segment and near it in parameters). */
function onBranch(run: Run, s: SsiState): boolean {
  const tol = 10 * run.ctx.kernel.tolerances.zoneTol3d;
  for (const br of run.branches) {
    const st = br.states;
    // A one-point branch (a graze of a domain corner) is the degenerate segment from it to itself.
    for (let i = 0; i + 1 < Math.max(2, st.length); i++) {
      const a = st[i]!, b = st[Math.min(i + 1, st.length - 1)]!;
      const seg = distance3(a.point, b.point);
      if (distanceToSegment3(s.point, a.point, b.point) > tol + 0.05 * seg) continue;
      const xs = unwrapNear(run.ctx, s.x, a.x);
      // Per surface, the slack is the segment's whole parameter step (|Δu| + |Δv|): near an extremum
      // of one parameter along the branch its own span is tiny while the arc still bulges past it.
      // Plus the 3D slack read in that parameter (`slack3d / |S_k|`): a seed within the 3D test of a
      // short segment (a branch end grazing a domain bound, where the boundary Newton may land
      // anywhere along the graze) is within that much of it in parameters too.
      const slack3d = tol + 0.05 * seg;
      const speeds = [length3(a.dA.su), length3(a.dA.sv), length3(a.dB.su), length3(a.dB.sv)];
      const span = (k: number): number => {
        const j = k < 2 ? 0 : 2;
        return Math.abs(b.x[j]! - a.x[j]!) + Math.abs(b.x[j + 1]! - a.x[j + 1]!);
      };
      const near = xs.every((v, k) => {
        const sp = speeds[k]!;
        const metric = sp > 0 && Number.isFinite(sp) ? slack3d / sp : Infinity;
        return Math.abs(v - a.x[k]!) <= span(k) + metric + 1e-6 * (1 + Math.abs(v)) + 1e-9;
      });
      if (near) return true;
    }
  }
  return false;
}

function marchError(m: MarchResult): Result<never> | undefined {
  switch (m.end) {
    case 'singular':
      return err(refusal(OP, 'tangent contact not resolved', m.states.length));
    case 'stalled': {
      // A march that stalls with the surfaces within ~0.06° of tangent stalled at a tangency (the
      // corrector's Jacobian degenerates there): name it so.
      const last = m.states[m.states.length - 1]!;
      return err(refusal(OP, last.sin < STALL_TANGENT_SIN ? 'tangent contact not resolved' : 'newton did not converge', m.states.length));
    }
    case 'budget':
      return err(refusal(OP, 'subdivision budget exceeded', m.states.length));
    default:
      return undefined;
  }
}

/** Traces the branch through `seed` (both directions) and records it. */
function trace(run: Run, seed: SsiState): Result<void> {
  const fw = march(run.ctx, seed, 1, run.limits, seed);
  const fe = marchError(fw);
  if (fe !== undefined) return fe;
  if (fw.end === 'closed') {
    run.branches.push({ states: fw.states, closed: true });
    return ok(undefined);
  }
  const bw = march(run.ctx, seed, -1, run.limits, seed);
  const be = marchError(bw);
  if (be !== undefined) return be;
  const states = [...bw.states.slice().reverse(), ...fw.states.slice(1)];
  run.branches.push({ states, closed: false });
  return ok(undefined);
}

/** Traces `seed` unless it is singular or already on a branch. */
function traceIfNew(run: Run, seed: SsiState | undefined): Result<boolean> {
  if (seed === undefined || seed.sin < SINGULAR_SIN || onBranch(run, seed)) return ok(false);
  const r = trace(run, seed);
  return r.ok ? ok(true) : r;
}

/** The boundary seeds of a leaf (see the module comment, step 2). */
function boundarySeeds(ctx: SsiContext, c: PairCell): SsiState[] {
  const out: SsiState[] = [];
  const sides: [number, number, number][] = [
    [0, c.a.u0, ctx.lo[0]], [0, c.a.u1, ctx.hi[0]], [1, c.a.v0, ctx.lo[1]], [1, c.a.v1, ctx.hi[1]],
    [2, c.b.u0, ctx.lo[2]], [2, c.b.u1, ctx.hi[2]], [3, c.b.v0, ctx.lo[3]], [3, c.b.v1, ctx.hi[3]],
  ];
  for (const [index, side, bound] of sides) {
    if (ctx.periodic[index] || side !== bound) continue;
    const s = correct(ctx, center(c), { index, value: bound });
    if (s !== undefined && inCell(ctx, c, s.x, 0.5)) out.push(s);
  }
  return out;
}

/**
 * Halves `cell` with boxes only (no cones) up to `extra` more levels; returns `excluded` when every
 * sub-pair is apart, else a Newton root found in a surviving sub-pair, else `stuck`.
 */
function refine(run: Run, cell: PairCell, extra: number): Result<{ kind: 'excluded' } | { kind: 'seed'; seed: SsiState } | { kind: 'stuck' }> {
  let level: { a: Rect; b: Rect }[] = [{ a: cell.a, b: cell.b }];
  let budget = 1024;
  for (let d = 0; d <= extra && level.length > 0; d++) {
    const next: { a: Rect; b: Rect }[] = [];
    for (const p of level) {
      if (--budget < 0) return ok({ kind: 'stuck' });
      const ba = run.cacheA.box(p.a);
      if (!ba.ok) return ba;
      const bb = run.cacheB.box(p.b);
      if (!bb.ok) return bb;
      const apart = boxesDisjoint3(ba.value, bb.value);
      if (!apart.ok) return apart;
      if (apart.value) continue;
      const sub: PairCell = { a: p.a, b: p.b, boxA: ba.value, boxB: bb.value, depth: 0 };
      const s = correct(run.ctx, center(sub));
      if (s !== undefined && s.sin >= SINGULAR_SIN && inCell(run.ctx, sub, s.x, 0.5) && !onBranch(run, s)) return ok({ kind: 'seed', seed: s });
      if (d === extra) continue;
      if (box3Diagonal(ba.value) >= box3Diagonal(bb.value)) for (const a of run.cacheA.split(p.a)) next.push({ a, b: p.b });
      else for (const b of run.cacheB.split(p.b)) next.push({ a: p.a, b });
    }
    if (next.length === 0 && d < extra) return ok({ kind: 'excluded' });
    level = next;
  }
  return ok(level.length === 0 ? { kind: 'excluded' } : { kind: 'stuck' });
}

const boxDistance = (b: Box3, p: Point3): number =>
  Math.hypot(
    Math.max(0, b.min.x - p.x, p.x - b.max.x),
    Math.max(0, b.min.y - p.y, p.y - b.max.y),
    Math.max(0, b.min.z - p.z, p.z - b.max.z),
  );

/** A touch point recorded within the cell's widened boxes. */
function holdsTouch(run: Run, c: PairCell): boolean {
  return run.touches.some((t) => inCell(run.ctx, c, t.x, 0.5));
}

/** A recorded contact (touch or near miss) within `2 leafSize` of both of the cell's boxes. */
function nearContact(run: Run, c: PairCell): boolean {
  const r = 2 * run.leafSize;
  return run.contacts.some((t) => boxDistance(c.boxA, t.point) <= r && boxDistance(c.boxB, t.point) <= r);
}

/** The contact lies in the cell's widened boxes or within `2 leafSize` of both of its 3D boxes. */
function contactNear(run: Run, c: PairCell, k: Contact): boolean {
  const r = 2 * run.leafSize;
  return inCell(run.ctx, c, k.x, 1) || (boxDistance(c.boxA, k.point) <= r && boxDistance(c.boxB, k.point) <= r);
}

/** Seeds on the small loop around a crossing-side definite contact (`g ≈ gap + ½ h_ii t²` along each parameter of A). */
function loopSeeds(run: Run, k: Contact): Result<void> {
  for (const [i, hii] of [[0, k.h11], [1, k.h22]] as const) {
    if (!(hii * k.gap < 0)) continue;
    const t = Math.sqrt((-2 * k.gap) / hii);
    for (const sgn of [1, -1]) {
      const x = k.x.slice();
      x[i] = x[i]! + sgn * t;
      // B's parameters follow to the foot of the moved A point: at the contact both tangent planes
      // coincide, so the corrector's four columns would be coplanar (a singular Gram matrix).
      const pa = surfacePoint3(run.ctx.A.surface, x[0]!, x[1]!);
      if (!pa.ok) continue;
      const foot = footOn(run.ctx, 'B', pa.value, x[2]!, x[3]!);
      if (foot !== undefined) {
        x[2] = foot.u;
        x[3] = foot.v;
      }
      const s = correct(run.ctx, x);
      const r = traceIfNew(run, s);
      if (!r.ok) return r;
    }
  }
  return ok(undefined);
}

/**
 * The largest 3D semi-axis `sqrt(2 |gap| / |κ|min)` of the small loop around a definite contact,
 * `κ` the generalized eigenvalues of the gap Hessian `H` against A's first fundamental form `I`
 * (`det(H - κ I) = 0`: the gap's curvatures in 3D lengths). `Infinity` when degenerate.
 */
function capSemiAxis(k: Contact): number {
  const a = k.iE * k.iG - k.iF * k.iF;
  const b = -(k.h11 * k.iG + k.h22 * k.iE - 2 * k.h12 * k.iF);
  const c = k.h11 * k.h22 - k.h12 * k.h12;
  if (!(a > 0) || !Number.isFinite(a + b + c)) return Infinity;
  const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, b * b - 4 * a * c))) / 2;
  if (q === 0) return Infinity;
  const kmin = Math.min(Math.abs(q / a), Math.abs(c / q));
  const s = Math.sqrt((2 * Math.abs(k.gap)) / kmin);
  return Number.isFinite(s) ? s : Infinity;
}

/** A traced closed branch around `p` within `radius`. */
function enclosingLoop(run: Run, p: Point3, radius: number): boolean {
  return run.branches.some((b) => b.closed && b.states.every((s) => distance3(s.point, p) <= radius));
}

/** Step 4 for one unresolved cell. */
function resolveContact(run: Run, c: PairCell): Result<void> {
  const tol = run.ctx.kernel.tolerances.zoneTol3d;
  if (covered(run, c) || holdsTouch(run, c)) return ok(undefined);
  const contact = contactNewton(run.ctx, center(c));
  if (contact !== undefined && contactNear(run, c, contact)) {
    const { h11, h12, h22, gap } = contact;
    const det = h11 * h22 - h12 * h12;
    const scale = h11 * h11 + 2 * h12 * h12 + h22 * h22;
    const definite = det > 1e-8 * scale;
    const known = run.contacts.some((t) => distance3(t.point, contact.point) <= tol);
    const minimum = h11 > 0;
    const crossing = definite && ((minimum && gap < 0) || (!minimum && gap > 0));
    const semiAxis = definite ? capSemiAxis(contact) : Infinity;
    const radius = 4 * semiAxis + run.leafSize;
    // A touch: a near miss within the zone, or a crossing whose loop has a semi-axis of at most
    // `zoneTol3d` (the closed forms' rule, ssi-revolution.ts: a circle collapses to a point only when
    // its radius is within the zone, never merely its cap, docs/ssi.md §7 WR-79), unless that loop
    // was traced already.
    if (definite && Math.abs(gap) <= tol && (!crossing || semiAxis <= tol) && !enclosingLoop(run, contact.point, radius)) {
      if (!known) {
        run.touches.push(contact);
        run.contacts.push(contact);
      }
      return ok(undefined);
    }
    if (definite) {
      if (!crossing) {
        if (!known) run.contacts.push(contact); // near miss (measured)
        return ok(undefined);
      }
      if (!enclosingLoop(run, contact.point, radius)) {
        const ls = loopSeeds(run, contact);
        if (!ls.ok) return ls;
      }
      if (enclosingLoop(run, contact.point, radius)) {
        if (!known) run.contacts.push(contact);
        return ok(undefined);
      }
    }
    if (Math.abs(gap) <= tol) return err(refusal(OP, 'tangent contact not resolved'));
  }
  const r = refine(run, c, 16);
  if (!r.ok) return r;
  if (r.value.kind === 'excluded') return ok(undefined);
  if (r.value.kind === 'seed') {
    const t = traceIfNew(run, r.value.seed);
    return t.ok ? ok(undefined) : t;
  }
  return err(refusal(OP, 'tangent contact not resolved'));
}

/** Step 5 for one leaf. */
function verifyLeaf(run: Run, c: PairCell): Result<void> {
  if (covered(run, c) || holdsTouch(run, c)) return ok(undefined);
  const near = nearContact(run, c);
  const s = correct(run.ctx, center(c));
  if (s !== undefined && inCell(run.ctx, c, s.x, 0.5)) {
    const t = traceIfNew(run, s);
    if (!t.ok) return t;
    if (covered(run, c)) return ok(undefined);
  }
  if (near) return ok(undefined);
  for (let round = 0; round < 8; round++) {
    const r = refine(run, c, 12);
    if (!r.ok) return r;
    if (r.value.kind === 'excluded') return ok(undefined);
    if (r.value.kind === 'stuck') break;
    const t = traceIfNew(run, r.value.seed);
    if (!t.ok) return t;
    if (!t.value || covered(run, c)) return ok(undefined);
  }
  if (covered(run, c)) return ok(undefined);
  return err(refusal(OP, 'subdivision budget exceeded'));
}

/**
 * The general path only (subdivision, marching, contacts, fitting); see the module comment. Used
 * by `intersectSurfaces` for pairs without a closed form; callable directly for any pair.
 */
export function marchSurfaces(kernel: Kernel, a: SurfacePatch, b: SurfacePatch, options: SsiOptions = {}): Result<SurfaceIntersection> {
  const co = checkOptions(options);
  if (!co.ok) return co;
  const ck = checkKernel(kernel);
  if (!ck.ok) return ck;
  const pa = checkPatch(a);
  if (!pa.ok) return pa;
  const pb = checkPatch(b);
  if (!pb.ok) return pb;
  const ba = patchBox(a);
  if (!ba.ok) return ba;
  const bb = patchBox(b);
  if (!bb.ok) return bb;
  const scale = Math.min(box3Diagonal(ba.value), box3Diagonal(bb.value));
  if (!(scale > 0) || !Number.isFinite(scale)) return err(refusal(OP, 'degenerate input'));
  const tol = kernel.tolerances.zoneTol3d;
  const ctx = createContext(kernel, a, b);
  const leafSize = scale / 8;
  const minSize = Math.max(scale / 512, 20 * tol);
  const cacheA = new PatchCache(a.surface), cacheB = new PatchCache(b.surface);
  const rect = (p: SurfacePatch): Rect => ({ u0: p.domain.u[0], u1: p.domain.u[1], v0: p.domain.v[0], v1: p.domain.v[1] });
  const sub = subdivide(cacheA, cacheB, rect(a), rect(b), {
    maxPairs: options.maxPairs ?? 60000,
    maxDepth: options.maxDepth ?? 64,
    leafSize,
    minSize,
  });
  if (!sub.ok) return sub;
  const hMax = scale / 16;
  const run: Run = {
    ctx,
    limits: { hInit: hMax / 4, hMax, hMin: 1e-3 * tol, maxTurn: options.maxTurn ?? 0.05, maxPoints: options.maxBranchPoints ?? 1500 },
    branches: [],
    touches: [],
    contacts: [],
    cacheA,
    cacheB,
    leafSize,
  };
  // Step 2–3: the boundary crossings (curve/surface), the boundary seeds of all leaves, then
  // interior seeds.
  const crossings = boundaryCrossings(ctx);
  if (!crossings.ok) return crossings;
  for (const s of crossings.value) {
    const t = traceIfNew(run, s);
    if (!t.ok) return t;
  }
  for (const leaf of sub.value.leaves) {
    for (const s of boundarySeeds(ctx, leaf)) {
      const t = traceIfNew(run, s);
      if (!t.ok) return t;
    }
  }
  for (const leaf of sub.value.leaves) {
    const s = correct(ctx, center(leaf));
    if (s === undefined || !inCell(ctx, leaf, s.x, 0.5)) continue;
    const t = traceIfNew(run, s);
    if (!t.ok) return t;
  }
  // Step 4: contacts.
  for (const cell of sub.value.unresolved) {
    const r = resolveContact(run, cell);
    if (!r.ok) return r;
  }
  // Step 5: completeness.
  for (const leaf of sub.value.leaves) {
    const r = verifyLeaf(run, leaf);
    if (!r.ok) return r;
  }
  // Step 6: fitting.
  const hits: SurfaceSurfaceHit[] = [];
  for (const br of run.branches) {
    // A branch within the zone (a curve grazing a domain corner, a loop of radius within the zone)
    // is one point, as the closed forms collapse such a circle (and a single Newton point cannot be
    // fitted).
    const first = br.states[0]!;
    const extent = br.states.reduce((m, s) => Math.max(m, distance3(s.point, first.point)), 0);
    if (extent <= (br.closed ? 2 : 1) * tol) {
      const mid = br.states[Math.floor(br.states.length / 2)]!;
      hits.push(
        Object.freeze({
          kind: 'point',
          class: 'certified',
          deviation: Math.max(extent, mid.residual / 2),
          point: Object.freeze({ ...mid.point }),
          a: Object.freeze({ u: mid.x[0], v: mid.x[1] }),
          b: Object.freeze({ u: mid.x[2], v: mid.x[3] }),
          contact: br.closed ? 'tangent' : 'transversal',
        }) satisfies SurfaceSurfacePoint,
      );
      continue;
    }
    const f = fitBranch(ctx, br.states, br.closed);
    if (!f.ok) return f;
    hits.push(f.value);
  }
  for (const t of run.touches) {
    const hit: SurfaceSurfacePoint = Object.freeze({
      kind: 'point',
      class: 'certified',
      deviation: Math.abs(t.gap),
      point: Object.freeze({ ...t.point }),
      a: Object.freeze({ u: t.x[0], v: t.x[1] }),
      b: Object.freeze({ u: t.x[2], v: t.x[3] }),
      contact: 'tangent',
    });
    hits.push(hit);
  }
  return ok(surfaceIntersection(hits.length === 0 ? 'certified' : combineClass(hits.map((h) => h.class)), hits, false, 'marching'));
}
