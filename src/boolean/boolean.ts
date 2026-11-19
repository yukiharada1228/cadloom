/**
 * Regularized boolean operations on closed solids: `union(kernel, a, b)`, `intersect(kernel, a, b)` and
 * `subtract(kernel, a, b)` (`A - B`). Stages (upstream `docs/booleans.md` §3, `booleans/pipeline.svg`):
 * 1. **Intersect and imprint** (`imprintBodies`, `imprint.ts` / `face-intersect.ts`): face/face intersection
 *    pieces are imprinted on both operands, splitting their faces into fragments.
 * 2. **Classify** (`classifyFragments`, `classify.ts`): each fragment is `in`, `out`, `on-same` or `on-opposite`
 *    relative to the other operand.
 * 3. **Select** (`SELECTION`, `select.ts`): the table keeps, reverses or drops each fragment.
 * 4. **Assemble**: the kept fragments become a face soup (each loop's coedges as edge pieces with their pcurves;
 *    a reversed fragment has its loops run backwards and `reversed` toggled) sewn by heal's `sewFacesReport`.
 *    Sewing must not turn any face over (the selection already orients every face outward of the result: a flip
 *    means the labels were wrong, `orientation mismatch`). Then `mergeCosurfaceFaces` (adjacent faces on one
 *    surface — planes included — become one face) and `removeRedundantVertices`, and finally `validateBrep` and
 *    `validateBrepGeometry`.
 *
 * **Results.** A `BooleanResult` is either `kind: 'solid'` with a valid closed B-rep (one body per lump, voids as
 * inner shells) or `kind: 'empty'` when no fragment is selected (`A ∩ B = ∅`, `A - A`, `A - B` with `A ⊆ B`):
 * there is no valid empty `Brep` in the kernel, so emptiness is a result kind, not a body. Both carry the same
 * statistics and the fragment labels. A failure is a named refusal (`invalid-topology`, operation
 * `boolean.<op>`), never an invalid or silently wrong body:
 * - the refusals of the earlier stages as they are (e.g. `tangent contact not resolved` from the intersection,
 *   `non-manifold imprint`, `inconsistent classification`);
 * - `non-manifold result: ...` when sewing finds an edge used by more than two faces, or two shells of the result
 *   touching (two lumps meeting at an edge or a point);
 * - `orientation mismatch: ...`, `assembly failed: ...` (another sewing refusal: an open soup, a zero volume),
 *   `invalid result: ...` (validation of the cleaned body), `provenance lost: ...`.
 *
 * **Provenance.** For every face of the result, the input faces (operand and original face id) it comes from:
 * each kept fragment's interior sample is located on the result faces of a coinciding surface
 * (`surfacesCoincide`, `pointInFace`), so a face merged from several fragments lists all their sources.
 *
 * **Statistics.** Fragments per operand and kept, intersection edges (pieces), how many are `exact` /
 * `certified` (the rest fitted, M4 classes), and the largest piece deviation.
 *
 * Upstream consulted (for the pipeline and API shape, not translated): `solidcore/crates/solidcore/src/boolean/api_brep.rs`
 * (`brep_union`, `brep_subtract`, `brep_intersect`: results, empty results, refusals), `boolean/merge.rs`,
 * `boolean/merge/*` (assembling the kept faces), `solidcore/docs/booleans.md` (§3 pipeline, §6 tangencies, §8
 * results are valid or refused), `docs/validity-and-tolerances.md`, `docs/layers.md` — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { err, ok, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { distance3 } from '../math/vec.ts';
import { reverseNurbsCurve } from '../nurbs/curve.ts';
import { prepareBody, prepared, type BodyInput, type PreparedBody } from '../query/domain.ts';
import { pointInFace } from '../query/face.ts';
import { faceId, type Brep, type FaceId } from '../topology/brep.ts';
import { validateBrepGeometry } from '../topology/geometry.ts';
import { validateBrep } from '../topology/validate.ts';
import { healIssue } from '../heal/error.ts';
import { mergeCosurfaceFaces, removeRedundantVertices, surfacesCoincide } from '../heal/merge.ts';
import { sewFacesReport, type SoupEdgePiece, type SoupFace } from '../heal/sew.ts';
import { classifyFragments, fragmentSamples, type FragmentClassification, type FragmentSample } from './classify.ts';
import { imprintBodies, type Fragment, type ImprintedBody, type ImprintPair } from './imprint.ts';
import { SELECTION, type BooleanOp, type OperandSide, type SelectAction } from './select.ts';

/** An input face: operand and its face id in that operand. */
export interface FaceOrigin {
  readonly side: OperandSide;
  readonly face: FaceId;
}

export interface BooleanStats {
  readonly fragmentsA: number;
  readonly fragmentsB: number;
  readonly keptFragments: number;
  /** Intersection pieces (edges imprinted or run along by both operands). */
  readonly intersectionEdges: number;
  readonly exactEdges: number;
  readonly certifiedEdges: number;
  /** Largest deviation of an intersection piece from both surfaces (0 when all are exact or none). */
  readonly maxDeviation: number;
  /** Largest gap closed by sewing (vertex moves and edge distances). */
  readonly maxSewGap: number;
}

interface BooleanCommon {
  readonly op: BooleanOp;
  readonly stats: BooleanStats;
  /** The label and action of each fragment of A and of B (index = fragment = face of the imprinted body). */
  readonly fragmentsA: readonly FragmentRecord[];
  readonly fragmentsB: readonly FragmentRecord[];
}

export interface FragmentRecord extends FragmentClassification {
  readonly sourceFace: FaceId;
  readonly action: SelectAction;
}

/** A non-empty result: a valid closed B-rep and the input faces of each of its faces. */
export interface BooleanSolid extends BooleanCommon {
  readonly kind: 'solid';
  readonly brep: Brep;
  /** For each result face (index = face id): the input faces it came from (sorted: A first, then by id). */
  readonly provenance: readonly (readonly FaceOrigin[])[];
}

/** An empty result (no fragment selected). */
export interface BooleanEmpty extends BooleanCommon {
  readonly kind: 'empty';
}

export type BooleanResult = BooleanSolid | BooleanEmpty;

const refuse = (op: BooleanOp, reason: string): Result<never> => err({ kind: 'invalid-topology', operation: `boolean.${op}`, reason });

const reasonOf = (e: SolidError): string =>
  e.kind === 'invalid-topology' || e.kind === 'invalid-input' ? e.reason : e.kind === 'not-converged' ? `not converged (${e.operation})` : `${e.kind} (${e.operation})`;

/** The face of a soup made from a fragment, turned over when `flip` (see stage 4). */
function soupFace(ib: ImprintedBody, fr: Fragment, flip: boolean): Result<SoupFace> {
  const loops: SoupEdgePiece[][] = [];
  for (const loop of fr.loops) {
    const pieces: SoupEdgePiece[] = [];
    for (const use of loop) {
      const e = ib.brep.edges[use.edge]!;
      let pc = use.pcurve;
      if (flip && pc !== undefined) {
        const r = reverseNurbsCurve(pc);
        if (!r.ok) return r;
        pc = r.value;
      }
      const reversed = flip ? !use.reversed : use.reversed;
      pieces.push(pc === undefined ? { curve: e.curve, t0: e.t0, t1: e.t1, reversed } : { curve: e.curve, t0: e.t0, t1: e.t1, reversed, pcurve: pc });
    }
    if (flip) pieces.reverse();
    loops.push(pieces);
  }
  return ok({ surface: fr.surface, reversed: flip ? !fr.reversed : fr.reversed, loops });
}

function pieceStats(pair: ImprintPair): Pick<BooleanStats, 'intersectionEdges' | 'exactEdges' | 'certifiedEdges' | 'maxDeviation'> {
  let exact = 0, certified = 0, dev = 0;
  for (const p of pair.pieces) {
    if (p.class === 'exact') exact++;
    else if (p.class === 'certified') certified++;
    if (Number.isFinite(p.deviation)) dev = Math.max(dev, p.deviation);
  }
  return { intersectionEdges: pair.pieces.length, exactEdges: exact, certifiedEdges: certified, maxDeviation: dev };
}

interface Kept {
  readonly side: OperandSide;
  readonly fragment: Fragment;
  readonly sourceFace: FaceId;
  readonly sample: FragmentSample | undefined;
  /** `keep` or `reverse` (dropped fragments are not kept). */
  readonly action: SelectAction;
}

/** Input faces of each result face (see Provenance). */
function provenanceOf(kernel: Kernel, op: BooleanOp, brep: Brep, kept: readonly Kept[], selfOf: (s: OperandSide) => PreparedBody): Result<FaceOrigin[][]> {
  const body = prepareBody(kernel, brep);
  if (!body.ok) return body;
  const tol = kernel.tolerances.zoneTol3d;
  const sets: Map<string, FaceOrigin>[] = brep.faces.map(() => new Map());
  for (const k of kept) {
    let sample = k.sample;
    if (sample === undefined) {
      const s = fragmentSamples(selfOf(k.side), k.fragment.face);
      if (!s.ok) return s;
      sample = s.value[0];
    }
    if (sample === undefined) return refuse(op, `provenance lost: fragment ${k.fragment.face} of ${k.side} has no interior sample`);
    const hits: number[] = [], near: number[] = [];
    for (const [f, face] of brep.faces.entries()) {
      if (surfacesCoincide(kernel, face.surface, k.fragment.surface) === undefined) continue;
      const c = pointInFace(kernel, body.value, faceId(f), { point: sample.point });
      if (!c.ok) return c;
      if (distance3(c.value.point, sample.point) > tol) continue;
      if (c.value.class === 'inside') hits.push(f);
      else if (c.value.class === 'on') near.push(f);
    }
    const found = hits.length > 0 ? hits : near;
    if (found.length === 0) return refuse(op, `provenance lost: fragment ${k.fragment.face} of ${k.side} is on no result face`);
    for (const f of found) sets[f]!.set(`${k.side}:${k.sourceFace}`, { side: k.side, face: k.sourceFace });
  }
  const out: FaceOrigin[][] = [];
  for (const [f, s] of sets.entries()) {
    if (s.size === 0) return refuse(op, `provenance lost: result face ${f} comes from no fragment`);
    out.push([...s.values()].sort((x, y) => (x.side === y.side ? x.face - y.face : x.side === 'A' ? -1 : 1)));
  }
  return ok(out);
}

/** The boolean `op` of `a` and `b` (see the module comment). */
export function booleanOp(kernel: Kernel, op: BooleanOp, a: BodyInput, b: BodyInput): Result<BooleanResult> {
  const pa = prepared(kernel, a);
  if (!pa.ok) return pa;
  const pb = prepared(kernel, b);
  if (!pb.ok) return pb;
  // 1. Intersect and imprint.
  const pair = imprintBodies(kernel, pa.value, pb.value);
  if (!pair.ok) return pair;
  const ia = prepareBody(kernel, pair.value.a.brep);
  if (!ia.ok) return ia;
  const ibp = prepareBody(kernel, pair.value.b.brep);
  if (!ibp.ok) return ibp;
  // 2. Classify.
  const la = classifyFragments(kernel, pair.value, 'A', ia.value, pb.value);
  if (!la.ok) return la;
  const lb = classifyFragments(kernel, pair.value, 'B', ibp.value, pa.value);
  if (!lb.ok) return lb;
  // 3. Select.
  const kept: Kept[] = [];
  const records = (side: OperandSide, ib: ImprintedBody, labels: readonly FragmentClassification[]): FragmentRecord[] =>
    labels.map((c, f) => {
      const action = SELECTION[op][side][c.label];
      const sourceFace = ib.faceSource[f]!;
      if (action !== 'drop') kept.push({ side, fragment: ib.fragments[f]!, sourceFace, sample: c.sample, action });
      return Object.freeze({ ...c, sourceFace, action });
    });
  const fragmentsA = Object.freeze(records('A', pair.value.a, la.value));
  const fragmentsB = Object.freeze(records('B', pair.value.b, lb.value));
  const ps = pieceStats(pair.value);
  const statsBase = { fragmentsA: fragmentsA.length, fragmentsB: fragmentsB.length, keptFragments: kept.length, ...ps };
  if (kept.length === 0) {
    return ok(Object.freeze({ kind: 'empty' as const, op, stats: Object.freeze({ ...statsBase, maxSewGap: 0 }), fragmentsA, fragmentsB }));
  }
  // 4. Assemble.
  const faces: SoupFace[] = [];
  for (const k of kept) {
    const ib = k.side === 'A' ? pair.value.a : pair.value.b;
    const sf = soupFace(ib, k.fragment, k.action === 'reverse');
    if (!sf.ok) return sf;
    faces.push(sf.value);
  }
  const sewn = sewFacesReport(kernel, { faces });
  if (!sewn.ok) {
    const issue = healIssue(sewn.error);
    if (issue === 'non-manifold' || issue === 'shells-intersect') return refuse(op, `non-manifold result: ${reasonOf(sewn.error)}`);
    return refuse(op, `assembly failed: ${reasonOf(sewn.error)}`);
  }
  if (sewn.value.flippedFaces.length > 0) {
    return refuse(op, `orientation mismatch: sewing turned over ${sewn.value.flippedFaces.length} selected fragment(s)`);
  }
  const merged = mergeCosurfaceFaces(kernel, sewn.value.brep, { removeVertices: false });
  if (!merged.ok) return refuse(op, `invalid result: ${reasonOf(merged.error)}`);
  const clean = removeRedundantVertices(kernel, merged.value);
  if (!clean.ok) return refuse(op, `invalid result: ${reasonOf(clean.error)}`);
  const v1 = validateBrep(clean.value);
  if (!v1.ok) return refuse(op, `invalid result: ${reasonOf(v1.error)}`);
  const v2 = validateBrepGeometry(kernel, clean.value);
  if (!v2.ok) return refuse(op, `invalid result: ${reasonOf(v2.error)}`);
  const prov = provenanceOf(kernel, op, clean.value, kept, (s) => (s === 'A' ? ia.value : ibp.value));
  if (!prov.ok) return prov;
  const g = sewn.value.gaps;
  return ok(
    Object.freeze({
      kind: 'solid' as const,
      op,
      brep: clean.value,
      provenance: Object.freeze(prov.value.map((l) => Object.freeze(l.map((o) => Object.freeze(o))))),
      stats: Object.freeze({ ...statsBase, maxSewGap: Math.max(g.maxVertexGap, g.maxEdgeGap) }),
      fragmentsA,
      fragmentsB,
    }),
  );
}

/** `A ∪ B` (see the module comment). */
export function union(kernel: Kernel, a: BodyInput, b: BodyInput): Result<BooleanResult> {
  return booleanOp(kernel, 'union', a, b);
}

/** `A ∩ B` (see the module comment). */
export function intersect(kernel: Kernel, a: BodyInput, b: BodyInput): Result<BooleanResult> {
  return booleanOp(kernel, 'intersect', a, b);
}

/** `A - B` (see the module comment). */
export function subtract(kernel: Kernel, a: BodyInput, b: BodyInput): Result<BooleanResult> {
  return booleanOp(kernel, 'subtract', a, b);
}
