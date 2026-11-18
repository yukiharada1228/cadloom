/**
 * Arena boundary representation: vertices, edges, coedges, loops, faces, shells and bodies held in
 * flat arrays and linked by typed numeric ids (array indices). Edges carry an M1 `Curve3` over a parameter
 * interval, faces an M1 `Surface3`, coedges an optional 2D NURBS pcurve in their face's `(u, v)`.
 *
 * Upstream consulted (for invariants and API shape, not translated):
 * `solidcore/crates/solidcore/src/topology.rs`, `topology/brep.rs`, `topology/brep_data.rs`,
 * `topology/brep_constructor.rs`, `topology/edge.rs`, `topology/edgeuse.rs`, `topology/loopuse.rs`,
 * `topology/face.rs`, `topology/integrity.rs`, `crates/solidcore-record/src/brep.rs` (which fields a B-rep
 * needs: an edge's curve, interval `min < max` and `[start, end]` vertices, equal for a closed edge; a face's
 * surface and sense; an oriented edge's pcurve, two of them on one face for a seam) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 *
 * Simplifications against upstream: one coedge per (edge, face side) replaces upstream's edge use / loop use /
 * face use triple; the manifold `partner` link is upstream's edge-use mate; pcurves run in the coedge's
 * direction (upstream's record runs them along the edge's interval whatever the use's sense); no per-entity
 * tolerances (the `Kernel` tolerances apply).
 */
import type { Point3, Vec3 } from '../math/vec.ts';
import { scale3 } from '../math/vec.ts';
import { err, ok, type Result } from '../core/error.ts';
import { createSegmentCurve, curveRange, type Curve3 } from '../curve/types.ts';
import type { Surface3 } from '../surface/types.ts';
import type { NurbsCurve } from '../nurbs/curve.ts';

declare const idTag: unique symbol;
/** A number branded with an entity tag. The brand is type-only: at run time an id is its array index. */
type Id<Tag extends string> = number & { readonly [idTag]: Tag };

export type VertexId = Id<'vertex'>;
export type EdgeId = Id<'edge'>;
export type CoedgeId = Id<'coedge'>;
export type LoopId = Id<'loop'>;
export type FaceId = Id<'face'>;
export type ShellId = Id<'shell'>;
export type BodyId = Id<'body'>;

export const vertexId = (n: number): VertexId => n as VertexId;
export const edgeId = (n: number): EdgeId => n as EdgeId;
export const coedgeId = (n: number): CoedgeId => n as CoedgeId;
export const loopId = (n: number): LoopId => n as LoopId;
export const faceId = (n: number): FaceId => n as FaceId;
export const shellId = (n: number): ShellId => n as ShellId;
export const bodyId = (n: number): BodyId => n as BodyId;

export interface Vertex { readonly point: Point3 }

/**
 * An edge runs from `start` to `end` along `curve`, over the parameter interval `[t0, t1]` (`t0 < t1`,
 * inside `curveRange(curve)`): `curve(t0)` is the start vertex and `curve(t1)` the end vertex (within
 * `zoneTol3d`, checked by `validateBrepGeometry`). A closed edge (a full circle) has `start === end`; a line
 * edge never does. A coedge may use the edge in either direction.
 */
export interface Edge {
  readonly start: VertexId;
  readonly end: VertexId;
  readonly curve: Curve3;
  readonly t0: number;
  readonly t1: number;
}

/**
 * One side of an edge in a loop. `reversed` is true when the loop traverses the edge from `end` to `start`.
 * `next`/`prev` link the coedges of the loop into a cycle; `partner` is the other coedge on the same edge
 * (`null` when the edge does not have exactly two coedges, which validation rejects). The optional `pcurve`
 * is the coedge in its face's surface parameters: a 2D NURBS curve (`dimension === 2`) whose points are
 * `(u, v)`, running in the coedge's direction (from the coedge's start vertex at the start of its domain to its
 * end vertex at the end). A seam edge (both coedges on one face) has two pcurves, e.g. on `u = 0` and `u = 2π`.
 */
export interface Coedge {
  readonly edge: EdgeId;
  readonly reversed: boolean;
  readonly loop: LoopId;
  readonly next: CoedgeId;
  readonly prev: CoedgeId;
  readonly partner: CoedgeId | null;
  readonly pcurve?: NurbsCurve;
}

export interface Loop { readonly face: FaceId; readonly first: CoedgeId }

/**
 * A face of `surface` bounded by `loops` (outer loop first). The outward normal is the surface's natural normal
 * `S_u x S_v`, negated when `reversed`. Viewed from outside (against the outward normal) the outer loop runs
 * counter-clockwise and inner loops (holes) clockwise, so the material is always on the left of each coedge.
 */
export interface Face {
  readonly shell: ShellId;
  readonly loops: readonly LoopId[];
  readonly surface: Surface3;
  readonly reversed: boolean;
}

export interface Shell { readonly body: BodyId; readonly faces: readonly FaceId[] }
export interface Body { readonly shells: readonly ShellId[] }

/** A frozen B-rep. Structural validity is checked by `validateBrep`, not assumed. */
export interface Brep {
  readonly vertices: readonly Vertex[];
  readonly edges: readonly Edge[];
  readonly coedges: readonly Coedge[];
  readonly loops: readonly Loop[];
  readonly faces: readonly Face[];
  readonly shells: readonly Shell[];
  readonly bodies: readonly Body[];
}

/**
 * A coedge as given to `BrepBuilder.addLoop`: which edge, in which direction the loop runs it, and optionally
 * its pcurve (see `Coedge.pcurve`).
 */
export interface CoedgeUse { readonly edge: EdgeId; readonly reversed: boolean; readonly pcurve?: NurbsCurve }

/** Frozen deep copy of plain data (objects and arrays of numbers, strings, booleans). */
function frozenCopy<T>(x: T): T {
  if (Array.isArray(x)) return Object.freeze(x.map((y: unknown) => frozenCopy(y))) as T;
  if (typeof x === 'object' && x !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) out[k] = frozenCopy(v);
    return Object.freeze(out) as T;
  }
  return x;
}

/** Deep-freezes (copies of) the arrays, records and geometry of a B-rep. */
export function freezeBrep(parts: Brep): Brep {
  return frozenCopy({
    vertices: parts.vertices,
    edges: parts.edges,
    coedges: parts.coedges,
    loops: parts.loops,
    faces: parts.faces,
    shells: parts.shells,
    bodies: parts.bodies,
  });
}

interface MutableFace { shell: ShellId; loops: LoopId[]; surface: Surface3; reversed: boolean }
type PendingCoedge = { edge: EdgeId; reversed: boolean; loop: LoopId; next: CoedgeId; prev: CoedgeId; pcurve?: NurbsCurve };

/**
 * Builds the arenas of a B-rep. Ids handed out by the builder are the only valid arguments; passing an id
 * the builder did not return is a programming error and throws `RangeError`. Geometry is stored as given:
 * `validateBrepGeometry` checks it. `build()` links each edge's two coedges as partners and returns a frozen
 * `Brep` (call `validateBrep` / `validateBrepGeometry` to check it).
 */
export class BrepBuilder {
  #vertices: Vertex[] = [];
  #edges: Edge[] = [];
  #coedges: PendingCoedge[] = [];
  #loops: Loop[] = [];
  #faces: MutableFace[] = [];
  #shells: { body: BodyId; faces: FaceId[] }[] = [];
  #bodies: { shells: ShellId[] }[] = [];

  addVertex(point: Point3): VertexId {
    this.#vertices.push({ point });
    return vertexId(this.#vertices.length - 1);
  }

  /**
   * An edge from `start` to `end` along `curve` over `[t0, t1]` (default: the whole `curveRange(curve)`).
   * For a closed edge (a full circle) pass the same vertex twice.
   */
  addEdge(start: VertexId, end: VertexId, curve: Curve3, t0?: number, t1?: number): EdgeId {
    this.#check(start, this.#vertices.length, 'vertex');
    this.#check(end, this.#vertices.length, 'vertex');
    const [r0, r1] = curveRange(curve);
    this.#edges.push({ start, end, curve, t0: t0 ?? r0, t1: t1 ?? r1 });
    return edgeId(this.#edges.length - 1);
  }

  /**
   * A straight edge between two distinct vertices: the segment curve `start + t (end - start)`, `t in [0, 1]`.
   * Fails (`invalid-input`, from `createSegmentCurve`) when the points coincide or are not finite.
   */
  addLineEdge(start: VertexId, end: VertexId): Result<EdgeId> {
    const a = this.#vertices[this.#check(start, this.#vertices.length, 'vertex')]!.point;
    const b = this.#vertices[this.#check(end, this.#vertices.length, 'vertex')]!.point;
    const line = createSegmentCurve(a, b);
    if (!line.ok) return line;
    return ok(this.addEdge(start, end, line.value, 0, 1));
  }

  addBody(): BodyId {
    this.#bodies.push({ shells: [] });
    return bodyId(this.#bodies.length - 1);
  }

  addShell(body: BodyId): ShellId {
    const b = this.#bodies[this.#check(body, this.#bodies.length, 'body')]!;
    const id = shellId(this.#shells.length);
    this.#shells.push({ body, faces: [] });
    b.shells.push(id);
    return id;
  }

  addFace(shell: ShellId, surface: Surface3, reversed = false): FaceId {
    const s = this.#shells[this.#check(shell, this.#shells.length, 'shell')]!;
    const id = faceId(this.#faces.length);
    this.#faces.push({ shell, loops: [], surface, reversed });
    s.faces.push(id);
    return id;
  }

  /** Appends a loop to `face` (the first loop added is the outer one), linking `uses` into a cycle in order. */
  addLoop(face: FaceId, uses: readonly CoedgeUse[]): LoopId {
    const f = this.#faces[this.#check(face, this.#faces.length, 'face')]!;
    if (uses.length === 0) throw new RangeError('BrepBuilder.addLoop: a loop needs at least one coedge');
    const id = loopId(this.#loops.length);
    const base = this.#coedges.length;
    const n = uses.length;
    uses.forEach((u, i) => {
      this.#check(u.edge, this.#edges.length, 'edge');
      const c: PendingCoedge = {
        edge: u.edge,
        reversed: u.reversed,
        loop: id,
        next: coedgeId(base + ((i + 1) % n)),
        prev: coedgeId(base + ((i + n - 1) % n)),
      };
      if (u.pcurve !== undefined) c.pcurve = u.pcurve;
      this.#coedges.push(c);
    });
    this.#loops.push({ face, first: coedgeId(base) });
    f.loops.push(id);
    return id;
  }

  build(): Brep {
    const byEdge: CoedgeId[][] = this.#edges.map(() => []);
    this.#coedges.forEach((c, i) => byEdge[c.edge]!.push(coedgeId(i)));
    const coedges: Coedge[] = this.#coedges.map((c, i) => {
      const uses = byEdge[c.edge]!;
      const partner = uses.length === 2 ? uses.find((u) => u !== i) ?? null : null;
      return { ...c, partner };
    });
    return freezeBrep({
      vertices: this.#vertices,
      edges: this.#edges,
      coedges,
      loops: this.#loops,
      faces: this.#faces,
      shells: this.#shells,
      bodies: this.#bodies,
    });
  }

  #check(id: number, length: number, kind: string): number {
    if (!Number.isInteger(id) || id < 0 || id >= length) throw new RangeError(`BrepBuilder: unknown ${kind} id ${id}`);
    return id;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Accessors. They are total on any `Brep`: dangling ids give `undefined` or an `invalid-topology` result.

/** All face ids, in arena order. */
export function faces(brep: Brep): readonly FaceId[] {
  return Object.freeze(brep.faces.map((_, i) => faceId(i)));
}

/** The vertex a coedge starts at (in loop direction), or `undefined` when its ids dangle. */
export function coedgeStart(brep: Brep, c: CoedgeId): VertexId | undefined {
  const co = brep.coedges[c];
  const e = co === undefined ? undefined : brep.edges[co.edge];
  if (co === undefined || e === undefined) return undefined;
  return co.reversed ? e.end : e.start;
}

/** The vertex a coedge ends at (in loop direction), or `undefined` when its ids dangle. */
export function coedgeEnd(brep: Brep, c: CoedgeId): VertexId | undefined {
  const co = brep.coedges[c];
  const e = co === undefined ? undefined : brep.edges[co.edge];
  if (co === undefined || e === undefined) return undefined;
  return co.reversed ? e.start : e.end;
}

const OP_WALK = 'topology.loopCoedges';

/**
 * The coedges of `loop` from its first coedge along `next`. Fails with `invalid-topology` when an id dangles
 * or the walk does not return to the first coedge within `brep.coedges.length` steps.
 */
export function loopCoedges(brep: Brep, loop: LoopId): Result<readonly CoedgeId[]> {
  const l = brep.loops[loop];
  if (l === undefined) return err({ kind: 'invalid-topology', operation: OP_WALK, reason: 'unknown loop', entity: { kind: 'loop', id: loop } });
  const out: CoedgeId[] = [];
  let c = l.first;
  for (let step = 0; step <= brep.coedges.length; step++) {
    const co = brep.coedges[c];
    if (co === undefined) {
      return err({ kind: 'invalid-topology', operation: OP_WALK, reason: `dangling coedge ${c}`, entity: { kind: 'loop', id: loop } });
    }
    out.push(c);
    c = co.next;
    if (c === l.first) return ok(Object.freeze(out));
  }
  return err({ kind: 'invalid-topology', operation: OP_WALK, reason: 'loop does not close', entity: { kind: 'loop', id: loop } });
}

/** The start vertices of the coedges of `loop`, in loop order. */
export function loopVertices(brep: Brep, loop: LoopId): Result<readonly VertexId[]> {
  const cs = loopCoedges(brep, loop);
  if (!cs.ok) return cs;
  const out: VertexId[] = [];
  for (const c of cs.value) {
    const v = coedgeStart(brep, c);
    if (v === undefined) {
      return err({ kind: 'invalid-topology', operation: OP_WALK, reason: `coedge ${c} names a missing edge`, entity: { kind: 'coedge', id: c } });
    }
    out.push(v);
  }
  return ok(Object.freeze(out));
}

/** The vertices of the outer loop of `face`, in loop order. */
export function faceVertices(brep: Brep, face: FaceId): Result<readonly VertexId[]> {
  const outer = brep.faces[face]?.loops[0];
  if (outer === undefined) {
    return err({ kind: 'invalid-topology', operation: 'topology.faceVertices', reason: 'face has no loop', entity: { kind: 'face', id: face } });
  }
  return loopVertices(brep, outer);
}

/**
 * The constant outward normal of a planar face: its plane normal, negated when the face is reversed.
 * `undefined` for a face on any other surface (use `faceNormalAt` from `geometry.ts` there).
 */
export function faceNormal(face: Face): Vec3 | undefined {
  if (face.surface.kind !== 'plane') return undefined;
  const n = face.surface.frame.normal;
  return face.reversed ? scale3(n, -1) : n;
}
