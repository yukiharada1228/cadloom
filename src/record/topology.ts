/**
 * The index structure of a B-rep record: its arena counts and index tuples, without any geometry.
 *
 * - `recordTopology(record)` extracts it;
 * - `topologyRangeIssue(t)` is the range check of a record: every index field names an existing item. It is
 *   the TS side of `CadloomFormal.Record.validate` (formal/CadloomFormal/Record.lean), with the same checks in
 *   the same order: edges (`curve`, `start`, `end`), coedges (`edge`, `loop`, `next`, `prev`, `pcurve`), loops
 *   (`face`, `first`), faces (`shell`, `surface`, each of `loops`), shells (`body`, each of `faces`), bodies
 *   (each of `shells`). Lean proves that the check passing means every lookup by those indices succeeds
 *   (`validate_sound_*`) and that it passes whenever all indices are in range (`validate_complete`);
 * - `encodeRecordTopology` / `decodeRecordTopology` serialise it as a list of non-negative integers, length
 *   prefixed, the Lean `encode` / `decode` (`decode_encode`: decoding an encoding gives the topology back).
 *
 * Word layout: `[nVertices, nCurves, nSurfaces, nPcurves]`, then each arena as its length followed by its
 * items: an edge `curve, start, end`; a coedge `edge, reversed (0/1), loop, next, prev, pcurve` with the
 * optional pcurve as `0` (none) or `k + 1` (so that word may be `2^53`, for `k` the largest safe integer); a loop `face, first`; a face `shell, surface, reversed (0/1)` and
 * its loop list; a shell `body` and its face list; a body its shell list (a list: its length, then its items).
 *
 * Upstream consulted: `solidcore/crates/solidcore-record/src/brep.rs`, `brep/topology.rs` (index checks
 * against the arena counts) — SolidCraft / solidcore, Apache-2.0 OR MIT. Not a translation.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { BrepRecordData } from './types.ts';

export interface TopologyCounts {
  readonly vertices: number;
  readonly curves: number;
  readonly surfaces: number;
  readonly pcurves: number;
}
export interface EdgeTopology { readonly curve: number; readonly start: number; readonly end: number }
export interface CoedgeTopology {
  readonly edge: number;
  readonly reversed: boolean;
  readonly loop: number;
  readonly next: number;
  readonly prev: number;
  /** `null` when the coedge has no pcurve (the Lean `Option.none`). */
  readonly pcurve: number | null;
}
export interface LoopTopology { readonly face: number; readonly first: number }
export interface FaceTopology {
  readonly shell: number;
  readonly surface: number;
  readonly reversed: boolean;
  readonly loops: readonly number[];
}
export interface ShellTopology { readonly body: number; readonly faces: readonly number[] }
export interface BodyTopology { readonly shells: readonly number[] }

/** The index structure of a record (the Lean `Rec`). */
export interface RecordTopology {
  readonly counts: TopologyCounts;
  readonly edges: readonly EdgeTopology[];
  readonly coedges: readonly CoedgeTopology[];
  readonly loops: readonly LoopTopology[];
  readonly faces: readonly FaceTopology[];
  readonly shells: readonly ShellTopology[];
  readonly bodies: readonly BodyTopology[];
}

const freezeList = (xs: readonly number[]): readonly number[] => Object.freeze(xs.slice());

/** The index structure of a record (frozen). Assumes the record's shape (as `parseRecord` checks it). */
export function recordTopology(r: BrepRecordData): RecordTopology {
  return Object.freeze({
    counts: Object.freeze({
      vertices: r.vertices.length,
      curves: r.curves.length,
      surfaces: r.surfaces.length,
      pcurves: r.pcurves.length,
    }),
    edges: Object.freeze(r.edges.map((e) => Object.freeze({ curve: e.curve, start: e.start, end: e.end }))),
    coedges: Object.freeze(
      r.coedges.map((c) =>
        Object.freeze({ edge: c.edge, reversed: c.reversed, loop: c.loop, next: c.next, prev: c.prev, pcurve: c.pcurve ?? null }),
      ),
    ),
    loops: Object.freeze(r.loops.map((l) => Object.freeze({ face: l.face, first: l.first }))),
    faces: Object.freeze(
      r.faces.map((f) => Object.freeze({ shell: f.shell, surface: f.surface, reversed: f.reversed, loops: freezeList(f.loops) })),
    ),
    shells: Object.freeze(r.shells.map((s) => Object.freeze({ body: s.body, faces: freezeList(s.faces) }))),
    bodies: Object.freeze(r.bodies.map((b) => Object.freeze({ shells: freezeList(b.shells) }))),
  });
}

/** `undefined` when `index < count`, else the path-precise reason. */
function outOfRange(path: string, index: number, count: number, arena: string): string | undefined {
  return index < count ? undefined : `${path}: index ${index} out of range (${count} ${arena})`;
}

/**
 * The first index field of `t` that names no item, as `'<path>: index <i> out of range (<n> <arena>)'`
 * (e.g. `'faces[3].loops[0]: index 12 out of range (5 loops)'`), or `undefined` when every index is in range.
 * Indices are assumed to be non-negative integers (as `parseRecord` and `decodeRecordTopology` check);
 * the checks and their order are those of the Lean `validate`.
 */
export function topologyRangeIssue(t: RecordTopology): string | undefined {
  const nV = t.counts.vertices, nCu = t.counts.curves, nSu = t.counts.surfaces, nP = t.counts.pcurves;
  const nE = t.edges.length, nC = t.coedges.length, nL = t.loops.length, nF = t.faces.length;
  const nS = t.shells.length, nB = t.bodies.length;
  let bad: string | undefined;
  for (const [i, e] of t.edges.entries()) {
    const p = `edges[${i}]`;
    bad = outOfRange(`${p}.curve`, e.curve, nCu, 'curves') ??
      outOfRange(`${p}.start`, e.start, nV, 'vertices') ??
      outOfRange(`${p}.end`, e.end, nV, 'vertices');
    if (bad !== undefined) return bad;
  }
  for (const [i, c] of t.coedges.entries()) {
    const p = `coedges[${i}]`;
    bad = outOfRange(`${p}.edge`, c.edge, nE, 'edges') ??
      outOfRange(`${p}.loop`, c.loop, nL, 'loops') ??
      outOfRange(`${p}.next`, c.next, nC, 'coedges') ??
      outOfRange(`${p}.prev`, c.prev, nC, 'coedges') ??
      (c.pcurve === null ? undefined : outOfRange(`${p}.pcurve`, c.pcurve, nP, 'pcurves'));
    if (bad !== undefined) return bad;
  }
  for (const [i, l] of t.loops.entries()) {
    const p = `loops[${i}]`;
    bad = outOfRange(`${p}.face`, l.face, nF, 'faces') ?? outOfRange(`${p}.first`, l.first, nC, 'coedges');
    if (bad !== undefined) return bad;
  }
  for (const [i, f] of t.faces.entries()) {
    const p = `faces[${i}]`;
    bad = outOfRange(`${p}.shell`, f.shell, nS, 'shells') ?? outOfRange(`${p}.surface`, f.surface, nSu, 'surfaces');
    if (bad !== undefined) return bad;
    for (const [k, l] of f.loops.entries()) {
      bad = outOfRange(`${p}.loops[${k}]`, l, nL, 'loops');
      if (bad !== undefined) return bad;
    }
  }
  for (const [i, s] of t.shells.entries()) {
    const p = `shells[${i}]`;
    bad = outOfRange(`${p}.body`, s.body, nB, 'bodies');
    if (bad !== undefined) return bad;
    for (const [k, f] of s.faces.entries()) {
      bad = outOfRange(`${p}.faces[${k}]`, f, nF, 'faces');
      if (bad !== undefined) return bad;
    }
  }
  for (const [i, b] of t.bodies.entries()) {
    for (const [k, s] of b.shells.entries()) {
      bad = outOfRange(`bodies[${i}].shells[${k}]`, s, nS, 'shells');
      if (bad !== undefined) return bad;
    }
  }
  return undefined;
}

/** `topologyRangeIssue` as a result: `invalid-input` (operation `record.checkRecordTopology`) naming the field. */
export function checkRecordTopology(t: RecordTopology): Result<void> {
  const bad = topologyRangeIssue(t);
  return bad === undefined ? ok(undefined) : invalidInput('record.checkRecordTopology', bad);
}

const bit = (b: boolean): number => (b ? 1 : 0);

/** The words of `t` (the Lean `encode`; see the module comment for the layout). */
export function encodeRecordTopology(t: RecordTopology): readonly number[] {
  const w: number[] = [t.counts.vertices, t.counts.curves, t.counts.surfaces, t.counts.pcurves];
  // Item by item: spreading a long list into `push` would overflow the call stack.
  const list = (xs: readonly number[]): void => {
    w.push(xs.length);
    for (const x of xs) w.push(x);
  };
  w.push(t.edges.length);
  for (const e of t.edges) w.push(e.curve, e.start, e.end);
  w.push(t.coedges.length);
  for (const c of t.coedges) w.push(c.edge, bit(c.reversed), c.loop, c.next, c.prev, c.pcurve === null ? 0 : c.pcurve + 1);
  w.push(t.loops.length);
  for (const l of t.loops) w.push(l.face, l.first);
  w.push(t.faces.length);
  for (const f of t.faces) {
    w.push(f.shell, f.surface, bit(f.reversed));
    list(f.loops);
  }
  w.push(t.shells.length);
  for (const s of t.shells) {
    w.push(s.body);
    list(s.faces);
  }
  w.push(t.bodies.length);
  for (const b of t.bodies) list(b.shells);
  return Object.freeze(w);
}

/** A cursor over the words; `undefined` reads mean "malformed" and carry the reason in `error`. */
class Reader {
  readonly #words: readonly unknown[];
  #at = 0;
  error: string | undefined;
  constructor(words: readonly unknown[]) {
    this.#words = words;
  }
  get remaining(): number {
    return this.#words.length - this.#at;
  }
  get position(): number {
    return this.#at;
  }
  /** A non-negative integer word no larger than `max` (default: the largest safe integer). */
  nat(max: number = Number.MAX_SAFE_INTEGER): number {
    if (this.error !== undefined) return 0;
    if (this.#at >= this.#words.length) {
      this.error = `word ${this.#at}: unexpected end of input`;
      return 0;
    }
    // Own data properties only: no accessor of the input runs.
    const d = Object.getOwnPropertyDescriptor(this.#words, this.#at);
    const x: unknown = d !== undefined && 'value' in d ? d.value : undefined;
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > max) {
      this.error = `word ${this.#at}: expected a non-negative integer`;
      return 0;
    }
    this.#at++;
    return x === 0 ? 0 : x;
  }
  /**
   * An optional index word: `0` (none) or `k + 1`. `k` may be any safe integer, so the word may be `2^53`
   * (exact as a double), one more than the largest safe integer.
   */
  optional(): number | null {
    const x = this.nat(Number.MAX_SAFE_INTEGER + 1);
    return x === 0 ? null : x - 1;
  }
  bool(): boolean {
    const at = this.#at;
    const x = this.nat();
    if (this.error === undefined && x > 1) this.error = `word ${at}: expected 0 or 1, found ${x}`;
    return x === 1;
  }
  /** A length prefix for items of at least `minWords` words each, refused when the rest cannot hold them. */
  length(minWords: number): number {
    const at = this.#at;
    const n = this.nat();
    if (this.error === undefined && n * minWords > this.remaining) {
      this.error = `word ${at}: declared length ${n} exceeds the remaining ${this.remaining} words`;
      return 0;
    }
    return n;
  }
  list(): readonly number[] {
    const n = this.length(1);
    const out: number[] = [];
    for (let k = 0; k < n && this.error === undefined; k++) out.push(this.nat());
    return Object.freeze(out);
  }
}

/**
 * Decodes `encodeRecordTopology` words (the Lean `decode`). Fails with `invalid-input` on a word that is not a
 * non-negative safe integer, a flag other than 0/1, a declared length the remaining words cannot hold, an early
 * end, or trailing words; an input that throws while read (a proxy) is reported, not rethrown, and only own
 * data properties are read. Ranges are not checked here (use `checkRecordTopology`).
 */
export function decodeRecordTopology(words: readonly unknown[]): Result<RecordTopology> {
  const op = 'record.decodeRecordTopology';
  try {
    return decodeWords(op, words);
  } catch {
    // Only exotic inputs (proxies whose traps throw) get here: the reader runs no accessor of the input.
    return invalidInput(op, 'the input threw while being read');
  }
}

function decodeWords(op: string, words: readonly unknown[]): Result<RecordTopology> {
  if (!Array.isArray(words)) return invalidInput(op, 'expected an array of words');
  const r = new Reader(words);
  const counts = Object.freeze({ vertices: r.nat(), curves: r.nat(), surfaces: r.nat(), pcurves: r.nat() });
  const many = <T>(minWords: number, item: () => T): readonly T[] => {
    const n = r.length(minWords);
    const out: T[] = [];
    for (let k = 0; k < n && r.error === undefined; k++) out.push(item());
    return Object.freeze(out);
  };
  const edges = many(3, () => Object.freeze({ curve: r.nat(), start: r.nat(), end: r.nat() }));
  const coedges = many(6, () => {
    const edge = r.nat(), reversed = r.bool(), loop = r.nat(), next = r.nat(), prev = r.nat(), pcurve = r.optional();
    return Object.freeze({ edge, reversed, loop, next, prev, pcurve });
  });
  const loops = many(2, () => Object.freeze({ face: r.nat(), first: r.nat() }));
  const faces = many(4, () => {
    const shell = r.nat(), surface = r.nat(), reversed = r.bool();
    return Object.freeze({ shell, surface, reversed, loops: r.list() });
  });
  const shells = many(2, () => {
    const body = r.nat();
    return Object.freeze({ body, faces: r.list() });
  });
  const bodies = many(1, () => Object.freeze({ shells: r.list() }));
  if (r.error !== undefined) return invalidInput(op, r.error);
  if (r.remaining !== 0) return invalidInput(op, `word ${r.position}: ${r.remaining} trailing words`);
  return ok(Object.freeze({ counts, edges, coedges, loops, faces, shells, bodies }));
}
