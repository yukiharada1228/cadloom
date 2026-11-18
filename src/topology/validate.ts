/**
 * Structural validation of an arena B-rep and its Euler–Poincaré counts.
 *
 * Upstream consulted (for invariants, not translated): `solidcore/crates/solidcore/src/topology/integrity.rs`
 * (every stored id names a live record; cached links agree with their derivation),
 * `topology/brep/validation*` (`ValidatePointers`), `topology/shell.rs`, `topology/edgeuse.rs`
 * (edge-use mates on a manifold edge) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 *
 * Every failure is an `invalid-topology` error whose `reason` starts with a stable `TopologyIssue` code
 * followed by `': '` and a detail, and whose `entity` names the offending record.
 */
import { err, ok, type EntityRef, type Result, type SolidError } from '../core/error.ts';
import {
  coedgeEnd,
  coedgeStart,
  coedgeId,
  type Brep,
  type CoedgeId,
  type EdgeId,
  type ShellId,
  type VertexId,
} from './brep.ts';

export type TopologyIssue =
  | 'id-range' // an id field names no record
  | 'empty' // a body, shell or face has no children
  | 'degenerate-edge' // a line edge starts and ends at one vertex, or an edge's curve has (near) zero length
  | 'parent-link' // a child's parent link and the parent's child list disagree
  | 'next-prev' // `next` and `prev` are not inverse
  | 'loop-open' // walking `next` does not return to the loop's first coedge
  | 'loop-membership' // a coedge is on no loop walk, or on the walk of another loop
  | 'vertex-mismatch' // a coedge ends at a vertex other than where the next one starts
  | 'edge-use-count' // an edge does not have exactly two coedges
  | 'edge-orientation' // the two coedges of an edge run it in the same direction
  | 'partner' // partner links are not the symmetric pair of an edge's coedges
  | 'shell-crossing' // the two coedges of an edge lie in faces of different shells
  | 'unused-vertex' // a vertex bounds no edge
  | 'non-manifold-vertex' // the faces around a vertex form more than one fan (cone)
  | 'shell-disconnected' // the faces of a shell are not connected across shared edges
  | 'euler-poincare' // counts give a negative or fractional genus
  // Geometric issues (`validateBrepGeometry`, src/topology/geometry.ts):
  | 'non-finite' // a vertex point is not finite
  | 'edge-range' // an edge interval is not finite, not increasing, or outside its curve's range
  | 'edge-vertex' // an edge's curve end point is farther than zoneTol3d from its vertex
  | 'pcurve-invalid' // a pcurve is not a 2D curve, or cannot be evaluated on its face's surface
  | 'pcurve-endpoint' // a pcurve end point does not map onto the coedge's start / end vertex
  | 'pcurve-deviation' // an interior pcurve sample does not map onto the edge curve
  | 'pcurve-direction' // the lifted pcurve samples run the edge against the coedge's direction
  | 'edge-off-surface' // a coedge without pcurve has edge samples off its face's surface
  | 'seam-pcurves' // a seam edge lacks a pcurve on a coedge, or its two pcurves coincide in (u, v)
  | 'loop-uv-gap'; // consecutive pcurves of a loop do not meet in (u, v), nor jump along a pole of their vertex

const OP = 'topology.validateBrep';

/** An `invalid-topology` error of `operation` whose reason starts with the issue code (shared with `geometry.ts`). */
export function topologyError(operation: string, issue: TopologyIssue, detail: string, entity: EntityRef): Result<never> {
  return err({ kind: 'invalid-topology', operation, reason: `${issue}: ${detail}`, entity });
}

const fail = (issue: TopologyIssue, detail: string, entity: EntityRef): Result<never> => topologyError(OP, issue, detail, entity);

/** The `TopologyIssue` code of an error produced by this module, if it is one. */
export function topologyIssue(error: SolidError): TopologyIssue | undefined {
  if (error.kind !== 'invalid-topology') return undefined;
  const code = error.reason.split(':', 1)[0];
  return ISSUES.has(code as TopologyIssue) ? (code as TopologyIssue) : undefined;
}

const ISSUES: ReadonlySet<TopologyIssue> = new Set<TopologyIssue>([
  'id-range', 'empty', 'degenerate-edge', 'parent-link', 'next-prev', 'loop-open', 'loop-membership',
  'vertex-mismatch', 'edge-use-count', 'edge-orientation', 'partner', 'shell-crossing', 'unused-vertex',
  'non-manifold-vertex', 'shell-disconnected', 'euler-poincare', 'non-finite', 'edge-range', 'edge-vertex',
  'pcurve-invalid', 'pcurve-endpoint', 'pcurve-deviation', 'pcurve-direction', 'edge-off-surface',
  'seam-pcurves', 'loop-uv-gap',
]);

const inRange = (id: number, length: number): boolean => Number.isInteger(id) && id >= 0 && id < length;

/**
 * Checks that `brep` is a valid closed, oriented 2-manifold B-rep (combinatorics only; the geometry is
 * checked by `validateBrepGeometry`): ids in range; no closed line edge; parent/child links agree;
 * `next`/`prev` inverse; each loop a closed cycle with matching vertices; each edge used by exactly two
 * coedges in opposite directions, linked as partners, within one shell; no isolated vertex; the faces
 * around each vertex form a single fan (disc link, so shells cannot touch at a vertex); each shell
 * edge-connected. The first violation found (in that order) is returned.
 *
 * Seam edges are accepted: an edge whose two coedges lie in the same face (e.g. the seam of a cylinder's
 * side face) satisfies every rule above as long as they run it in opposite directions, and `eulerPoincare`
 * counts it once as an edge (the face's single loop uses it twice).
 */
export function validateBrep(brep: Brep): Result<void> {
  const { vertices, edges, coedges, loops, faces, shells, bodies } = brep;
  const nV = vertices.length, nE = edges.length, nC = coedges.length, nL = loops.length, nF = faces.length;
  const nS = shells.length, nB = bodies.length;

  // 1. Id ranges and non-empty containers.
  for (const [i, e] of edges.entries()) {
    const ent: EntityRef = { kind: 'edge', id: i };
    if (!inRange(e.start, nV) || !inRange(e.end, nV)) return fail('id-range', 'edge vertex', ent);
    // A closed edge (start === end) needs a curve that can close: never a line.
    if (e.start === e.end && e.curve.kind === 'line') return fail('degenerate-edge', 'line edge starts and ends at one vertex', ent);
  }
  for (const [i, c] of coedges.entries()) {
    const ent: EntityRef = { kind: 'coedge', id: i };
    if (!inRange(c.edge, nE)) return fail('id-range', 'coedge edge', ent);
    if (!inRange(c.loop, nL)) return fail('id-range', 'coedge loop', ent);
    if (!inRange(c.next, nC) || !inRange(c.prev, nC)) return fail('id-range', 'coedge next/prev', ent);
    if (c.partner !== null && !inRange(c.partner, nC)) return fail('id-range', 'coedge partner', ent);
  }
  for (const [i, l] of loops.entries()) {
    const ent: EntityRef = { kind: 'loop', id: i };
    if (!inRange(l.face, nF)) return fail('id-range', 'loop face', ent);
    if (!inRange(l.first, nC)) return fail('id-range', 'loop first coedge', ent);
  }
  for (const [i, f] of faces.entries()) {
    const ent: EntityRef = { kind: 'face', id: i };
    if (!inRange(f.shell, nS)) return fail('id-range', 'face shell', ent);
    if (f.loops.length === 0) return fail('empty', 'face has no loop', ent);
    if (!f.loops.every((l) => inRange(l, nL))) return fail('id-range', 'face loop', ent);
  }
  for (const [i, s] of shells.entries()) {
    const ent: EntityRef = { kind: 'shell', id: i };
    if (!inRange(s.body, nB)) return fail('id-range', 'shell body', ent);
    if (s.faces.length === 0) return fail('empty', 'shell has no face', ent);
    if (!s.faces.every((f) => inRange(f, nF))) return fail('id-range', 'shell face', ent);
  }
  for (const [i, b] of bodies.entries()) {
    const ent: EntityRef = { kind: 'body', id: i };
    if (b.shells.length === 0) return fail('empty', 'body has no shell', ent);
    if (!b.shells.every((s) => inRange(s, nS))) return fail('id-range', 'body shell', ent);
  }

  // 2. Parent links: each child is listed exactly once, by the parent it names.
  const listed = (n: number): number[] => new Array<number>(n).fill(0);
  const shellListed = listed(nS), faceListed = listed(nF), loopListed = listed(nL);
  for (const [i, b] of bodies.entries()) {
    for (const s of b.shells) {
      if (shells[s]!.body !== i) return fail('parent-link', `body ${i} lists shell ${s} of another body`, { kind: 'shell', id: s });
      shellListed[s]!++;
    }
  }
  for (const [i, s] of shells.entries()) {
    if (shellListed[i] !== 1) return fail('parent-link', 'shell is not listed exactly once by its body', { kind: 'shell', id: i });
    for (const f of s.faces) {
      if (faces[f]!.shell !== i) return fail('parent-link', `shell ${i} lists face ${f} of another shell`, { kind: 'face', id: f });
      faceListed[f]!++;
    }
  }
  for (const [i, f] of faces.entries()) {
    if (faceListed[i] !== 1) return fail('parent-link', 'face is not listed exactly once by its shell', { kind: 'face', id: i });
    for (const l of f.loops) {
      if (loops[l]!.face !== i) return fail('parent-link', `face ${i} lists loop ${l} of another face`, { kind: 'loop', id: l });
      loopListed[l]!++;
    }
  }
  for (let i = 0; i < nL; i++) {
    if (loopListed[i] !== 1) return fail('parent-link', 'loop is not listed exactly once by its face', { kind: 'loop', id: i });
  }

  // 3. next/prev are inverse permutations.
  for (const [i, c] of coedges.entries()) {
    if (coedges[c.next]!.prev !== i) return fail('next-prev', 'coedge.next.prev is not the coedge', { kind: 'coedge', id: i });
    if (coedges[c.prev]!.next !== i) return fail('next-prev', 'coedge.prev.next is not the coedge', { kind: 'coedge', id: i });
  }

  // 4. Loops are closed cycles of their own coedges with matching vertices; each coedge on exactly one.
  const visited = new Array<boolean>(nC).fill(false);
  for (const [i, l] of loops.entries()) {
    let c: CoedgeId = l.first;
    let steps = 0;
    do {
      const co = coedges[c]!;
      if (co.loop !== i || visited[c]) return fail('loop-membership', `coedge ${c} belongs to another loop`, { kind: 'coedge', id: c });
      visited[c] = true;
      if (coedgeEnd(brep, c) !== coedgeStart(brep, co.next)) {
        return fail('vertex-mismatch', `coedge ${c} ends where coedge ${co.next} does not start`, { kind: 'coedge', id: c });
      }
      c = co.next;
      if (++steps > nC) return fail('loop-open', 'walking next does not return to the first coedge', { kind: 'loop', id: i });
    } while (c !== l.first);
  }
  const stray = visited.indexOf(false);
  if (stray >= 0) return fail('loop-membership', 'coedge is on no loop', { kind: 'coedge', id: stray });

  // 5. Each edge has exactly two coedges, in opposite directions, partnered, within one shell.
  const uses: CoedgeId[][] = edges.map(() => []);
  coedges.forEach((c, i) => uses[c.edge]!.push(coedgeId(i)));
  const shellOf = (c: CoedgeId): ShellId => faces[loops[coedges[c]!.loop]!.face]!.shell;
  for (const [i, us] of uses.entries()) {
    const ent: EntityRef = { kind: 'edge', id: i };
    if (us.length !== 2) return fail('edge-use-count', `edge has ${us.length} coedges, not 2`, ent);
    const [a, b] = us as [CoedgeId, CoedgeId];
    const ca = coedges[a]!, cb = coedges[b]!;
    if (ca.reversed === cb.reversed) return fail('edge-orientation', 'both coedges run the edge the same way', ent);
    if (ca.partner !== b) return fail('partner', `partner of coedge ${a} is not coedge ${b}`, { kind: 'coedge', id: a });
    if (cb.partner !== a) return fail('partner', `partner of coedge ${b} is not coedge ${a}`, { kind: 'coedge', id: b });
    if (shellOf(a) !== shellOf(b)) return fail('shell-crossing', 'edge joins faces of different shells', ent);
  }

  // 6. No isolated vertices.
  const used = new Array<boolean>(nV).fill(false);
  for (const e of edges) used[e.start] = used[e.end] = true;
  const isolated = used.indexOf(false);
  if (isolated >= 0) return fail('unused-vertex', 'vertex bounds no edge', { kind: 'vertex', id: isolated });

  // 7. Manifold vertices: `sigma(c) = partner(prev(c))` permutes the coedges leaving a vertex (prev(c) ends
  //    where c starts and its partner runs back out of that vertex). The faces around a manifold vertex form
  //    one disc, so its outgoing coedges are a single sigma-orbit.
  const orbitSeen = new Array<boolean>(nC).fill(false);
  const orbits = new Array<number>(nV).fill(0);
  for (let c0 = 0; c0 < nC; c0++) {
    if (orbitSeen[c0]) continue;
    const v = coedgeStart(brep, coedgeId(c0))!;
    if (++orbits[v]! > 1) return fail('non-manifold-vertex', 'faces around the vertex form more than one fan', { kind: 'vertex', id: v });
    let c = c0;
    do {
      orbitSeen[c] = true;
      c = coedges[coedges[c]!.prev]!.partner!;
    } while (c !== c0);
  }

  // 8. Each shell is connected across shared edges (partners never leave the shell, by step 5).
  const faceSeen = new Array<boolean>(nF).fill(false);
  for (const [i, s] of shells.entries()) {
    const stack = [s.faces[0]!];
    faceSeen[stack[0]!] = true;
    let reached = 1;
    for (let f = stack.pop(); f !== undefined; f = stack.pop()) {
      for (const l of faces[f]!.loops) {
        const first = loops[l]!.first;
        let c = first;
        do {
          const g = loops[coedges[coedges[c]!.partner!]!.loop]!.face;
          if (!faceSeen[g]) {
            faceSeen[g] = true;
            reached++;
            stack.push(g);
          }
          c = coedges[c]!.next;
        } while (c !== first);
      }
    }
    if (reached !== s.faces.length) return fail('shell-disconnected', 'faces of the shell are not edge-connected', { kind: 'shell', id: i });
  }

  return ok(undefined);
}

/** `V - E + F` over the whole arena. */
export function eulerCharacteristic(brep: Brep): number {
  return brep.vertices.length - brep.edges.length + brep.faces.length;
}

export interface EulerPoincare {
  readonly vertices: number;
  readonly edges: number;
  readonly faces: number;
  readonly loops: number;
  readonly shells: number;
  /** Total genus (sum of the per-shell genera). */
  readonly genus: number;
  /** Genus of each shell, by shell id. */
  readonly shellGenus: readonly number[];
}

/**
 * Validates `brep`, then computes the genus of each shell from its own counts,
 * `G_s = 1 - (V_s - E_s + F_s - (L_s - F_s)) / 2`, and checks the Euler–Poincaré relation
 * `V - E + F - (L - F) = 2 (S - G)` for the whole B-rep. Fails with `euler-poincare` when a shell's genus is
 * negative or fractional, or when the global relation fails (unreachable once `validateBrep` holds, since
 * shells then share no vertex; kept as a cross-check).
 */
export function eulerPoincare(brep: Brep): Result<EulerPoincare> {
  const valid = validateBrep(brep);
  if (!valid.ok) return valid;
  const shellGenus: number[] = [];
  for (const [s, shell] of brep.shells.entries()) {
    const vs = new Set<VertexId>(), es = new Set<EdgeId>();
    let nLoops = 0;
    for (const f of shell.faces) {
      for (const l of brep.faces[f]!.loops) {
        nLoops++;
        const first = brep.loops[l]!.first;
        let c = first;
        do {
          const co = brep.coedges[c]!;
          es.add(co.edge);
          vs.add(coedgeStart(brep, c)!);
          c = co.next;
        } while (c !== first);
      }
    }
    const nF = shell.faces.length;
    const chi = vs.size - es.size + nF - (nLoops - nF);
    const g = (2 - chi) / 2;
    if (!Number.isInteger(g) || g < 0) {
      return fail('euler-poincare', `shell counts give genus ${g}`, { kind: 'shell', id: s });
    }
    shellGenus.push(g);
  }
  const genus = shellGenus.reduce((a, b) => a + b, 0);
  const counts = {
    vertices: brep.vertices.length,
    edges: brep.edges.length,
    faces: brep.faces.length,
    loops: brep.loops.length,
    shells: brep.shells.length,
  };
  const lhs = counts.vertices - counts.edges + counts.faces - (counts.loops - counts.faces);
  if (lhs !== 2 * (counts.shells - genus)) {
    return fail('euler-poincare', 'V - E + F - (L - F) != 2 (S - G): shells share vertices', { kind: 'body', id: 0 });
  }
  return ok(Object.freeze({ ...counts, genus, shellGenus: Object.freeze(shellGenus) }));
}

