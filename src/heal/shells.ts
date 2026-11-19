/**
 * Outward orientation of sewn shells, lumps and voids.
 *
 * Decision (side of a closed shell): the **signed volume of its display mesh**. Each consistently oriented
 * shell is built alone (`buildPlan`), meshed by the one mesher (`tessellate` of src/tess, which meshes every
 * face from shared edge samples, so a closed shell gives a closed mesh) and measured by `meshSignedVolume`. A
 * negative volume means the faces point inwards: the whole shell is flipped. Only the *sign* is used, and a
 * volume within `zoneTol3d · diag²` of zero (or a face the mesher could not mesh) is refused (`zero-volume`):
 * the side of such a shell is not decided from a display mesh. A ray test (`classifyPoint`) would need a point
 * known to be inside, which a thin or curved shell does not give cheaply; the mesh sign needs none.
 *
 * Disjointness: two shells whose certified boxes (`bodyBounds`, grown by `zoneTol3d`) overlap must have disjoint
 * boundaries, else `shells-intersect`. This is decided by the M4 intersections and `pointInFace`, in two parts:
 * 1. every edge of one shell (over its interval) against every face of the other whose box meets the edge's box
 *    (`intersectCurveSurface`): a point hit, or a sample of an overlap stretch, classified `inside` or `on` the
 *    face is a contact;
 * 2. every pair of faces of the two shells whose boxes meet (`intersectSurfaces` over the faces' `(u, v)` boxes):
 *    an intersection point, or a sample of an intersection curve, `inside` or `on` both faces is a contact.
 * If the boundaries meet, either some part of the meeting set reaches a face boundary — an edge of one shell
 * meeting a face of the other, found by part 1 — or a whole component (a closed curve or a touch point) lies in
 * the interiors of two faces, where every one of its points (so the samples of part 2) is in both faces. A
 * refusal of either intersection (an unresolved tangency, an exhausted budget) is refused as `shells-intersect`
 * too: contact that cannot be excluded is not accepted. Limitation: a gap below `zoneTol3d` that the
 * intersections do not report (two spheres `0.5 · zoneTol3d` apart: the closed form finds no common point) is
 * not a contact here, and the two lumps are returned.
 *
 * Nesting: once the boundaries are disjoint, a shell lies wholly inside or wholly outside another, and every
 * vertex of `A` is classified against `B` built alone (`classifyPoint` of src/query); `A` lies inside `B` when all
 * are `inside`. A vertex `on` `B`, or vertices on both sides, is still refused (`shells-intersect`). The depth
 * of a shell is the number of shells containing it; an even depth makes it the outer shell of a lump (a body), an odd depth a void
 * of the containing shell of depth one less, flipped to point into the void (negative volume). Bodies are ordered
 * by their outer shell's smallest face index, voids after the outer shell in the same order.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/heal/face_props.rs`
 * (face orientation fixes), `heal/stitch.rs` (shells after stitching), `topology/shell.rs` (shells of a body),
 * `docs/booleans.md` (lumps and voids of a result) — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result, type SolidError } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import { box3Diagonal, boxesOverlap3, expandBox3 } from '../interval/box.ts';
import { curvePoint3 } from '../curve/evaluate.ts';
import { intersectCurveSurface } from '../intersect/curve-surface.ts';
import { intersectSurfaces } from '../intersect/surface-surface.ts';
import { surfacePatch } from '../intersect/ssi-types.ts';
import { refusalReason } from '../intersect/types.ts';
import { curveRange } from '../curve/types.ts';
import type { Point3 } from '../math/vec.ts';
import { faceId } from '../topology/brep.ts';
import { bodyBounds, prepareBody, type PreparedBody } from '../query/domain.ts';
import { classifyPoint } from '../query/classify.ts';
import { pointInFace } from '../query/face.ts';
import { meshSignedVolume } from '../tess/check.ts';
import { tessellate } from '../tess/mesh.ts';
import type { Brep } from '../topology/brep.ts';
import { healError } from './error.ts';
import { buildPlan, flipPlanFace, type Plan, type PlanFace } from './plan.ts';

export interface ShellLayout {
  /** The faces after outward / void orientation. */
  readonly faces: readonly PlanFace[];
  /** Bodies (lumps): outer shell first, then its voids; each shell a list of face indices. */
  readonly bodies: readonly (readonly (readonly number[])[])[];
  /** Faces whose orientation this step changed (whole shells), ascending. */
  readonly flipped: readonly number[];
  /** Signed mesh volume of each component before flipping (input order of `components`). */
  readonly volumes: readonly number[];
}

/** Fractions of an overlap stretch or an intersection curve that are classified (ends and interior). */
const CONTACT_SAMPLES: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

/** A contact found between two shells (a description), `undefined` for none. */
type Contact = Result<string | undefined>;

/** An intersection error: a refusal is a contact that cannot be excluded; other errors are returned. */
function contactOfError(error: SolidError, what: string): Contact {
  const reason = refusalReason(error);
  return reason === undefined ? { ok: false, error } : ok(`${what}: contact not resolved (${reason})`);
}

/** Whether `p` lies `inside` or `on` face `f` of `body`. */
function inFace(kernel: Kernel, body: PreparedBody, f: number, p: Point3): Result<boolean> {
  const c = pointInFace(kernel, body, faceId(f), { point: p });
  return c.ok ? ok(c.value.class !== 'outside') : c;
}

/** Part 1 of the disjointness test (module comment): edges of `a` against faces of `b`. */
function edgesMeetFaces(kernel: Kernel, a: PreparedBody, b: PreparedBody): Contact {
  const tol = kernel.tolerances.zoneTol3d;
  for (const [e, edge] of a.brep.edges.entries()) {
    const eb = expandBox3(a.edgeBoxes[e]!, tol);
    if (!eb.ok) return eb;
    const slack = 1e-9 * Math.max(1, Math.abs(edge.t0), Math.abs(edge.t1));
    for (const dom of b.faces) {
      if (!boxesOverlap3(eb.value, dom.box)) continue;
      const x = intersectCurveSurface(kernel, edge.curve, dom.surface);
      if (!x.ok) return contactOfError(x.error, `edge ${e} and face ${dom.face}`);
      for (const h of x.value.hits) {
        const ts: number[] = [];
        if (h.kind === 'point') {
          if (h.t >= edge.t0 - slack && h.t <= edge.t1 + slack) ts.push(h.t);
        } else {
          const lo = Math.max(h.range[0], edge.t0), hi = Math.min(h.range[1], edge.t1);
          if (lo <= hi) for (const s of CONTACT_SAMPLES) ts.push(s === 1 ? hi : lo + s * (hi - lo));
        }
        for (const t of ts) {
          const p = h.kind === 'point' ? ok(h.point) : curvePoint3(edge.curve, Math.min(edge.t1, Math.max(edge.t0, t)));
          if (!p.ok) return p;
          const inside = inFace(kernel, b, dom.face, p.value);
          if (!inside.ok) return inside;
          if (inside.value) return ok(`edge ${e} meets face ${dom.face}`);
        }
      }
    }
  }
  return ok(undefined);
}

/** Part 2 of the disjointness test (module comment): faces of `a` against faces of `b`. */
function facesMeet(kernel: Kernel, a: PreparedBody, b: PreparedBody): Contact {
  for (const fa of a.faces) {
    for (const fb of b.faces) {
      if (!boxesOverlap3(fa.box, fb.box)) continue;
      const pa = surfacePatch(fa.surface, { u: [fa.uvBox.min.x, fa.uvBox.max.x], v: [fa.uvBox.min.y, fa.uvBox.max.y] });
      if (!pa.ok) return contactOfError(pa.error, `face ${fa.face}`);
      const pb = surfacePatch(fb.surface, { u: [fb.uvBox.min.x, fb.uvBox.max.x], v: [fb.uvBox.min.y, fb.uvBox.max.y] });
      if (!pb.ok) return contactOfError(pb.error, `face ${fb.face}`);
      const x = intersectSurfaces(kernel, pa.value, pb.value);
      if (!x.ok) return contactOfError(x.error, `faces ${fa.face} and ${fb.face}`);
      // Coincident surfaces: their overlap is bounded by edges of one shell lying on the other's face (part 1).
      for (const h of x.value.hits) {
        const points: Point3[] = [];
        if (h.kind === 'point') points.push(h.point);
        else {
          const [t0, t1] = curveRange(h.curve);
          for (const s of CONTACT_SAMPLES) {
            const p = curvePoint3(h.curve, s === 1 ? t1 : t0 + s * (t1 - t0));
            if (!p.ok) return p;
            points.push(p.value);
          }
        }
        for (const p of points) {
          const ia = inFace(kernel, a, fa.face, p);
          if (!ia.ok) return ia;
          if (!ia.value) continue;
          const ib = inFace(kernel, b, fb.face, p);
          if (!ib.ok) return ib;
          if (ib.value) return ok(`faces ${fa.face} and ${fb.face} meet`);
        }
      }
    }
  }
  return ok(undefined);
}

/** The boundaries of two shells meet (or their contact cannot be excluded): a description, else `undefined`. */
function shellsMeet(kernel: Kernel, a: PreparedBody, b: PreparedBody): Contact {
  const ab = edgesMeetFaces(kernel, a, b);
  if (!ab.ok || ab.value !== undefined) return ab;
  const ba = edgesMeetFaces(kernel, b, a);
  if (!ba.ok || ba.value !== undefined) return ba;
  return facesMeet(kernel, a, b);
}

const single = (plan: Plan, faces: readonly PlanFace[], shell: readonly number[]): Brep =>
  buildPlan({ vertices: plan.vertices, edges: plan.edges, faces, bodies: [[shell]] });

/**
 * Orients each consistently oriented closed component outward, finds lumps and voids (see the module comment).
 * `components` partition the plan's faces; `op` names the calling operation in errors.
 */
export function layoutShells(kernel: Kernel, op: string, plan: Plan, components: readonly (readonly number[])[]): Result<ShellLayout> {
  const faces = [...plan.faces];
  const toggled = new Array<boolean>(faces.length).fill(false);
  const volumes: number[] = [];
  const flipShell = (shell: readonly number[]): Result<void> => {
    for (const f of shell) {
      const g = flipPlanFace(faces[f]!);
      if (!g.ok) return g;
      faces[f] = g.value;
      toggled[f] = !toggled[f];
    }
    return ok(undefined);
  };
  const boxes = [];
  for (const [k, shell] of components.entries()) {
    const brep = single(plan, faces, shell);
    const mesh = tessellate(kernel, brep);
    if (!mesh.ok) return mesh;
    const failed = mesh.value.stats.failedFaces[0] ?? mesh.value.stats.failedEdges[0];
    if (failed !== undefined) {
      return healError(op, 'zero-volume', `shell ${k} could not be meshed to decide its side (${failed.error.operation})`, { kind: 'face', id: shell[0]! });
    }
    const vol = meshSignedVolume(mesh.value);
    const bounds = bodyBounds(kernel, brep);
    if (!bounds.ok) return bounds;
    const diag = box3Diagonal(bounds.value.box);
    if (!(Math.abs(vol) > kernel.tolerances.zoneTol3d * diag * diag)) {
      return healError(op, 'zero-volume', `shell ${k} encloses no volume (${vol})`, { kind: 'face', id: shell[0]! });
    }
    volumes.push(vol);
    boxes.push(bounds.value.box);
    if (vol < 0) {
      const r = flipShell(shell);
      if (!r.ok) return r;
    }
  }

  // Nesting: inside[a][b] = shell a lies inside shell b.
  const n = components.length;
  const inside: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const breps: PreparedBody[] = [];
  for (const shell of components) {
    const p = prepareBody(kernel, single(plan, faces, shell));
    if (!p.ok) return p;
    breps.push(p.value);
  }
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const grown = expandBox3(boxes[b]!, kernel.tolerances.zoneTol3d);
      if (!grown.ok) return grown;
      if (!boxesOverlap3(grown.value, boxes[a]!)) continue;
      if (a < b) {
        const meet = shellsMeet(kernel, breps[a]!, breps[b]!);
        if (!meet.ok) return meet;
        if (meet.value !== undefined) return healError(op, 'shells-intersect', `shells ${a} and ${b}: ${meet.value}`, { kind: 'face', id: components[b]![0]! });
      }
      let ins = 0, outs = 0;
      for (const v of breps[a]!.brep.vertices) {
        const c = classifyPoint(kernel, breps[b]!, v.point);
        if (!c.ok) return c;
        if (c.value.class === 'on') return healError(op, 'shells-intersect', `a vertex of shell ${a} lies on shell ${b}`, { kind: 'face', id: components[b]![0]! });
        if (c.value.class === 'inside') ins++;
        else outs++;
      }
      if (ins > 0 && outs > 0) return healError(op, 'shells-intersect', `shell ${a} crosses shell ${b}`, { kind: 'face', id: components[b]![0]! });
      inside[a]![b] = ins > 0;
    }
  }
  const depth = inside.map((row) => row.filter((x) => x).length);
  const parent = new Array<number>(n).fill(-1);
  for (let a = 0; a < n; a++) {
    if (depth[a]! % 2 === 0) continue;
    parent[a] = inside[a]!.findIndex((x, b) => x && depth[b] === depth[a]! - 1);
    if (parent[a]! < 0) return healError(op, 'shells-intersect', `shell ${a} has no enclosing shell one level up`, { kind: 'face', id: components[a]![0]! });
    const r = flipShell(components[a]!);
    if (!r.ok) return r;
  }
  const bodies: (readonly number[])[][] = [];
  for (let a = 0; a < n; a++) {
    if (parent[a]! >= 0) continue;
    const body: (readonly number[])[] = [components[a]!];
    for (let v = 0; v < n; v++) if (parent[v] === a) body.push(components[v]!);
    bodies.push(body);
  }
  // `components` are ordered by their smallest face, so `bodies` and voids already are.
  const flipped = toggled.flatMap((t, f) => (t ? [f] : []));
  return ok({ faces, bodies, flipped, volumes });
}
