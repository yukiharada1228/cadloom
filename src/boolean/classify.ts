/**
 * Classification — stage 3 of the boolean pipeline (upstream `docs/booleans.md` §3 "classify"): every fragment
 * of each imprinted operand gets a label relative to the other operand: `in`, `out`, `on-same` or `on-opposite`
 * (`select.ts`).
 *
 * `classifyFragments(kernel, pair, side, other)`:
 * 1. **Regions.** Fragments of one operand are joined across every edge that is not an intersection edge
 *    (union–find over the imprinted body's edges). An edge separates when it is imprinted (`EdgeSource.imprint`),
 *    or when it is a piece of an original edge whose middle lies within `zoneTol3d` of an intersection piece (the
 *    edge runs along the other operand's boundary, e.g. a box edge on a face of the other box). Inside a region
 *    the boundary of the operand does not meet the other's boundary, so the label is constant there.
 * 2. **Samples.** A fragment's sample is an interior point of its trimmed `(u, v)` domain (`fragmentSample`): the
 *    point of a `SAMPLE_GRID²` grid over the face's `(u, v)` box that the M4 parity (`classifyUv`) puts inside,
 *    with the largest clearance from the domain's rings (distances scaled by the surface's speeds at the box
 *    centre, so roughly in 3D units). Candidates are tried in order of decreasing clearance.
 * 3. **Labels.** The sample's 3D point is classified against the other operand by the M4 `classifyPoint`:
 *    `inside` → `in`, `outside` → `out`; `on` a face → compare the fragment's outward normal with that face's
 *    (both by `faceNormalAt`): parallel within `angTolDeg` gives `on-same` / `on-opposite`, and the coincidence
 *    record of `imprintBodies` for that face pair (`FaceFaceCoincident.sameOrientation`) must exist and agree; a
 *    sample `on` an edge or vertex, a refused classification, or normals that are not parallel (a tangent touch at
 *    the sample) moves to the next candidate (up to `SAMPLE_TRIES`).
 * 4. **Propagation and consistency.** In each region, fragments are sampled in order until `CHECKS_PER_REGION`
 *    labels are decided (or the region is exhausted); they must agree (`inconsistent classification`), and the
 *    region's label is given to all its fragments. A region where no fragment could be classified is refused
 *    (`fragment not classified`).
 *
 * Refusals are `invalid-topology` errors of operation `boolean.classify` whose reason names the case.
 *
 * Not certified: `classifyPoint` decides by rays (exactness reported per ray); the clearance of a sample is
 * measured on polygonal rings in scaled `(u, v)`, not in 3D.
 *
 * Upstream consulted (for the method, not translated): `solidcore/docs/booleans.md` §3 (stage 3 "classify": a
 * point of each face piece is classified against the other body; the in / out / on state spreads to pieces not
 * separated by intersection edges), `docs/booleans/classify.svg`, `solidcore/crates/solidcore/src/intersect/point_class.rs`
 * (`PointClassType`), `boolean/merge.rs`, `boolean/merge/p4.rs` (face states) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { closestPointOnCurve } from '../curve/closest.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { distance3, dot3, length3, vec2, type Point2, type Point3 } from '../math/vec.ts';
import type { PreparedBody } from '../query/domain.ts';
import { classifyPoint } from '../query/classify.ts';
import { classifyUv } from '../query/face.ts';
import { surfacePoint3 } from '../surface/evaluate.ts';
import { faceId, type FaceId } from '../topology/brep.ts';
import { faceNormalAt, surfaceUv } from '../topology/geometry.ts';
import { mergeLabels } from '../heal/union-find.ts';
import type { ImprintedBody, ImprintPair } from './imprint.ts';
import type { FragmentLabel, OperandSide } from './select.ts';

const OP = 'boolean.classify';

/** Grid size per direction for interior samples. */
export const SAMPLE_GRID = 20;
/** Sample candidates tried per fragment. */
export const SAMPLE_TRIES = 4;
/** Fragments whose labels must agree per region (fewer when the region is smaller). */
export const CHECKS_PER_REGION = 2;

/** An interior sample of a fragment. */
export interface FragmentSample {
  readonly uv: Point2;
  readonly point: Point3;
  /** Scaled `(u, v)` distance to the domain's rings (about a 3D length). */
  readonly clearance: number;
}

/** The label of one fragment and how it was found. */
export interface FragmentClassification {
  readonly face: FaceId;
  readonly label: FragmentLabel;
  /** The region (smallest fragment index of its region). */
  readonly region: number;
  /** `sampled`: classified at its own sample; `propagated`: from its region. */
  readonly basis: 'sampled' | 'propagated';
  /** The sample used (for `sampled`). */
  readonly sample?: FragmentSample;
}

const refuse = <T>(reason: string, face?: number): Result<T> =>
  err({ kind: 'invalid-topology', operation: OP, reason, ...(face !== undefined ? { entity: { kind: 'face' as const, id: face } } : {}) });

/** Squared distance from `p` to segment `ab` in scaled coordinates. */
function segDist2(p: Point2, a: Point2, b: Point2, su: number, sv: number): number {
  const ax = (a.x - p.x) * su, ay = (a.y - p.y) * sv, bx = (b.x - p.x) * su, by = (b.y - p.y) * sv;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return x * x + y * y;
}

/**
 * Interior sample candidates of face `face` of a prepared body, best clearance first (see the module comment).
 * Empty when no grid point is inside (a sliver thinner than the grid).
 */
export function fragmentSamples(body: PreparedBody, face: FaceId): Result<readonly FragmentSample[]> {
  const dom = body.faces[face];
  if (dom === undefined) return err({ kind: 'not-found', operation: OP, entity: { kind: 'face', id: face } });
  const { min, max } = dom.uvBox;
  const du = max.x - min.x, dv = max.y - min.y;
  if (!(du > 0 && dv > 0 && Number.isFinite(du) && Number.isFinite(dv))) return ok([]);
  // Surface speeds at the box centre (scale of u and v in 3D).
  const cu = (min.x + max.x) / 2, cv = (min.y + max.y) / 2;
  const h = 1e-4;
  const p0 = surfacePoint3(dom.surface, cu, cv);
  const pu = surfacePoint3(dom.surface, cu + h * du, cv);
  const pv = surfacePoint3(dom.surface, cu, cv + h * dv);
  if (!p0.ok) return p0;
  if (!pu.ok) return pu;
  if (!pv.ok) return pv;
  const su = Math.max(distance3(pu.value, p0.value) / (h * du), 1e-12);
  const sv = Math.max(distance3(pv.value, p0.value) / (h * dv), 1e-12);
  const out: { uv: Point2; clearance: number }[] = [];
  for (let i = 0; i < SAMPLE_GRID; i++) {
    for (let j = 0; j < SAMPLE_GRID; j++) {
      const uv = vec2(min.x + ((i + 0.5) * du) / SAMPLE_GRID, min.y + ((j + 0.5) * dv) / SAMPLE_GRID);
      if (classifyUv(dom, uv) !== 'inside') continue;
      let best = Infinity;
      for (const ring of dom.rings) {
        for (let k = 0; k < ring.length; k++) best = Math.min(best, segDist2(uv, ring[k]!, ring[(k + 1) % ring.length]!, su, sv));
      }
      out.push({ uv, clearance: Math.sqrt(best) });
    }
  }
  // Best clearance first; ties by grid order (deterministic: the sort is stable).
  out.sort((x, y) => y.clearance - x.clearance);
  const samples: FragmentSample[] = [];
  for (const c of out) {
    // Spread the candidates: skip one closer to a chosen one than its clearance.
    if (samples.some((s) => Math.hypot((s.uv.x - c.uv.x) * su, (s.uv.y - c.uv.y) * sv) < s.clearance)) continue;
    const p = surfacePoint3(dom.surface, c.uv.x, c.uv.y);
    if (!p.ok) return p;
    samples.push(Object.freeze({ uv: Object.freeze(c.uv), point: p.value, clearance: c.clearance }));
    if (samples.length >= SAMPLE_TRIES) break;
  }
  return ok(Object.freeze(samples));
}

/** Which faces of the imprinted body are separated across each edge (see step 1). */
function separatingEdges(kernel: Kernel, ib: ImprintedBody, pair: ImprintPair): Result<boolean[]> {
  const tol = kernel.tolerances.zoneTol3d;
  const sep: boolean[] = [];
  for (const [i, e] of ib.brep.edges.entries()) {
    const src = ib.edgeSource[i]!;
    if (src.kind === 'imprint') {
      sep.push(true);
      continue;
    }
    const mid = curvePoint3(e.curve, (e.t0 + e.t1) / 2);
    if (!mid.ok) return mid;
    let on = false;
    for (const p of pair.pieces) {
      // Cheap reject by the piece's end points' box.
      const span = distance3(p.start.point, p.end.point);
      const reach = Math.min(distance3(mid.value, p.start.point), distance3(mid.value, p.end.point));
      if (!p.closed && p.curve.kind === 'line' && reach > span + tol) continue;
      const c = closestPointOnCurve(p.curve, mid.value);
      if (!c.ok) return c;
      const lo = Math.min(p.t0, p.t1), hi = Math.max(p.t0, p.t1);
      const pad = 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi));
      if (c.value.distance <= tol && c.value.t >= lo - pad && c.value.t <= hi + pad) {
        on = true;
        break;
      }
    }
    sep.push(on);
  }
  return ok(sep);
}

/** The regions of the imprinted body (step 1): the smallest face index of each face's region. */
export function fragmentRegions(kernel: Kernel, ib: ImprintedBody, pair: ImprintPair): Result<readonly number[]> {
  const sep = separatingEdges(kernel, ib, pair);
  if (!sep.ok) return sep;
  const faceOfEdge: number[][] = ib.brep.edges.map(() => []);
  for (const c of ib.brep.coedges) faceOfEdge[c.edge]!.push(ib.brep.loops[c.loop]!.face);
  const pairs: [number, number][] = [];
  for (const [e, fs] of faceOfEdge.entries()) {
    if (sep.value[e] || fs.length !== 2 || fs[0] === fs[1]) continue;
    pairs.push([fs[0]!, fs[1]!]);
  }
  return ok(Object.freeze(mergeLabels(ib.brep.faces.length, pairs)));
}

/** The label of one sample, or `undefined` when it does not decide (step 3). */
function labelAt(
  kernel: Kernel,
  side: OperandSide,
  self: PreparedBody,
  face: FaceId,
  sourceFace: FaceId,
  other: PreparedBody,
  pair: ImprintPair,
  s: FragmentSample,
): Result<FragmentLabel | undefined> {
  const c = classifyPoint(kernel, other, s.point);
  if (!c.ok) {
    if (c.error.kind === 'not-converged') return ok(undefined);
    return c;
  }
  if (c.value.class === 'inside') return ok('in');
  if (c.value.class === 'outside') return ok('out');
  const ent = c.value.entity;
  if (ent === undefined || ent.kind !== 'face') return ok(undefined);
  const g = faceId(ent.id);
  const n1 = faceNormalAt(kernel, self.brep, face, s.uv.x, s.uv.y);
  if (!n1.ok) return n1;
  const gf = other.brep.faces[g];
  if (gf === undefined) return err({ kind: 'not-found', operation: OP, entity: { kind: 'face', id: g } });
  const uv = surfaceUv(kernel, gf.surface, s.point);
  if (!uv.ok) return uv;
  const n2 = faceNormalAt(kernel, other.brep, g, uv.value.x, uv.value.y);
  if (!n2.ok) return n2;
  const cos = dot3(n1.value, n2.value) / (length3(n1.value) * length3(n2.value));
  if (Math.abs(cos) < Math.cos((kernel.tolerances.angTolDeg * Math.PI) / 180)) return ok(undefined);
  const same = cos > 0;
  const [fa, fb] = side === 'A' ? [sourceFace, g] : [g, sourceFace];
  const rec = pair.intersections.find((x) => x.kind === 'coincident' && x.faceA === fa && x.faceB === fb);
  if (rec === undefined || rec.kind !== 'coincident') {
    return refuse(`coincidence not imprinted: fragment of ${side} face ${sourceFace} lies on face ${g} of the other operand without a coincidence record`, face);
  }
  if (rec.sameOrientation !== same) {
    return refuse(`inconsistent classification: normals at the sample and the coincidence record of faces ${fa}/${fb} disagree on orientation`, face);
  }
  return ok(same ? 'on-same' : 'on-opposite');
}

/**
 * Labels every fragment of the imprinted operand `side` of `pair` relative to `other` (the other operand,
 * prepared; see the module comment). `self` is the imprinted body prepared. The answer is indexed by fragment
 * (= face of the imprinted body).
 */
export function classifyFragments(
  kernel: Kernel,
  pair: ImprintPair,
  side: OperandSide,
  self: PreparedBody,
  other: PreparedBody,
): Result<readonly FragmentClassification[]> {
  const ib = side === 'A' ? pair.a : pair.b;
  const regions = fragmentRegions(kernel, ib, pair);
  if (!regions.ok) return regions;
  const members = new Map<number, number[]>();
  for (const [f, r] of regions.value.entries()) {
    const list = members.get(r);
    if (list === undefined) members.set(r, [f]);
    else list.push(f);
  }
  const out = new Array<FragmentClassification>(ib.brep.faces.length);
  for (const [region, faces] of [...members.entries()].sort((x, y) => x[0] - y[0])) {
    const decided: { face: number; label: FragmentLabel; sample: FragmentSample }[] = [];
    for (const f of faces) {
      if (decided.length >= CHECKS_PER_REGION) break;
      const samples = fragmentSamples(self, faceId(f));
      if (!samples.ok) return samples;
      for (const s of samples.value) {
        const l = labelAt(kernel, side, self, faceId(f), ib.faceSource[f]!, other, pair, s);
        if (!l.ok) return l;
        if (l.value === undefined) continue;
        decided.push({ face: f, label: l.value, sample: s });
        break;
      }
    }
    const first = decided[0];
    if (first === undefined) return refuse(`fragment not classified: no sample of ${side} region ${region} was decided`, region);
    for (const d of decided) {
      if (d.label !== first.label) {
        return refuse(`inconsistent classification: ${side} fragments ${first.face} (${first.label}) and ${d.face} (${d.label}) of one region`, d.face);
      }
    }
    for (const f of faces) {
      const own = decided.find((d) => d.face === f);
      out[f] = Object.freeze(
        own !== undefined
          ? { face: faceId(f), label: first.label, region, basis: 'sampled' as const, sample: own.sample }
          : { face: faceId(f), label: first.label, region, basis: 'propagated' as const },
      );
    }
  }
  return ok(Object.freeze(out));
}
