/**
 * A B-rep plan: the data of a B-rep before it is built (vertex points, edge geometry, faces with loops of
 * `(edge index, reversed, pcurve)` and the grouping into shells and bodies). Sewing and face merging both end in
 * a plan and build it here through the one `BrepBuilder` (src/topology), in builder order (bodies, then their
 * shells, then faces shell by shell), so the result round-trips through record/convert. Unused vertices and
 * edges are dropped.
 *
 * Upstream consulted (for the shape, not translated): `solidcore/crates/solidcore/src/topology/brep_constructor.rs`
 * (a body assembled from index-linked records), `heal/heal_data.rs` (the healer's working data) — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { ok, type Result } from '../core/error.ts';
import type { Point3 } from '../math/vec.ts';
import type { Curve3 } from '../curve/types.ts';
import { reverseNurbsCurve, type NurbsCurve } from '../nurbs/curve.ts';
import type { Surface3 } from '../surface/types.ts';
import { BrepBuilder, loopCoedges, type Brep, type CoedgeUse, type EdgeId, type VertexId } from '../topology/brep.ts';

export interface PlanEdge {
  readonly start: number;
  readonly end: number;
  readonly curve: Curve3;
  readonly t0: number;
  readonly t1: number;
}

export interface PlanCoedge {
  readonly edge: number;
  readonly reversed: boolean;
  readonly pcurve?: NurbsCurve;
}

export interface PlanFace {
  readonly surface: Surface3;
  readonly reversed: boolean;
  /** Outer loop first. */
  readonly loops: readonly (readonly PlanCoedge[])[];
}

export interface Plan {
  readonly vertices: readonly Point3[];
  readonly edges: readonly PlanEdge[];
  readonly faces: readonly PlanFace[];
  /** Bodies, each a list of shells (outer shell first), each a list of face indices. */
  readonly bodies: readonly (readonly (readonly number[])[])[];
}

/** The face with the opposite orientation: `reversed` toggled, every loop run backwards (pcurves reversed). */
export function flipPlanFace(face: PlanFace): Result<PlanFace> {
  const loops: PlanCoedge[][] = [];
  for (const loop of face.loops) {
    const out: PlanCoedge[] = [];
    for (let i = loop.length - 1; i >= 0; i--) {
      const c = loop[i]!;
      if (c.pcurve === undefined) {
        out.push({ edge: c.edge, reversed: !c.reversed });
        continue;
      }
      const pc = reverseNurbsCurve(c.pcurve);
      if (!pc.ok) return pc;
      out.push({ edge: c.edge, reversed: !c.reversed, pcurve: pc.value });
    }
    loops.push(out);
  }
  return ok({ surface: face.surface, reversed: !face.reversed, loops });
}

/** Builds `plan` (see the module comment). Ids in the plan are trusted (they come from this module's callers). */
export function buildPlan(plan: Plan): Brep {
  const usedEdge = new Array<boolean>(plan.edges.length).fill(false);
  for (const body of plan.bodies) {
    for (const shell of body) for (const f of shell) for (const loop of plan.faces[f]!.loops) for (const c of loop) usedEdge[c.edge] = true;
  }
  const usedVertex = new Array<boolean>(plan.vertices.length).fill(false);
  plan.edges.forEach((e, i) => {
    if (usedEdge[i]) usedVertex[e.start] = usedVertex[e.end] = true;
  });
  const b = new BrepBuilder();
  const vid: VertexId[] = [];
  plan.vertices.forEach((p, i) => {
    if (usedVertex[i]) vid[i] = b.addVertex(p);
  });
  const eid: EdgeId[] = [];
  plan.edges.forEach((e, i) => {
    if (usedEdge[i]) eid[i] = b.addEdge(vid[e.start]!, vid[e.end]!, e.curve, e.t0, e.t1);
  });
  const shells = plan.bodies.map((body) => {
    const bid = b.addBody();
    return body.map((faces) => ({ id: b.addShell(bid), faces }));
  });
  for (const body of shells) {
    for (const shell of body) {
      for (const f of shell.faces) {
        const face = plan.faces[f]!;
        const fid = b.addFace(shell.id, face.surface, face.reversed);
        for (const loop of face.loops) {
          b.addLoop(
            fid,
            loop.map((c): CoedgeUse => (c.pcurve === undefined ? { edge: eid[c.edge]!, reversed: c.reversed } : { edge: eid[c.edge]!, reversed: c.reversed, pcurve: c.pcurve })),
          );
        }
      }
    }
  }
  return b.build();
}

/** The plan of a structurally valid B-rep (same vertex, edge and face indices). */
export function planOfBrep(brep: Brep): Result<Plan> {
  const faces: PlanFace[] = [];
  for (const f of brep.faces) {
    const loops: PlanCoedge[][] = [];
    for (const l of f.loops) {
      const cs = loopCoedges(brep, l);
      if (!cs.ok) return cs;
      loops.push(
        cs.value.map((c) => {
          const co = brep.coedges[c]!;
          return co.pcurve === undefined ? { edge: co.edge, reversed: co.reversed } : { edge: co.edge, reversed: co.reversed, pcurve: co.pcurve };
        }),
      );
    }
    faces.push({ surface: f.surface, reversed: f.reversed, loops });
  }
  return ok({
    vertices: brep.vertices.map((v) => v.point),
    edges: brep.edges.map((e) => ({ start: e.start, end: e.end, curve: e.curve, t0: e.t0, t1: e.t1 })),
    faces,
    bodies: brep.bodies.map((body) => body.shells.map((s) => [...brep.shells[s]!.faces])),
  });
}
