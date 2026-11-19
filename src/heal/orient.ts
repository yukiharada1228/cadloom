/**
 * Consistent orientation of a sewn face set: which faces to flip so that every shared edge is used in opposite
 * directions by its two coedges (the condition `validateBrep` checks as `edge-orientation`).
 *
 * Model (`formal/CadloomFormal/Heal.lean`, `Use`, `opposite`, `propagate`): an edge shared by two coedges is a
 * `Use { f1, d1, f2, d2 }` — the coedge in face `f1` runs the edge backwards iff `d1`, the one in `f2` iff `d2`
 * (`f1 = f2` for a seam). Flipping face `f` (`flip[f] = true`) reverses all its coedges, so after flipping the
 * use is consistent iff `(d1 xor flip[f1]) != (d2 xor flip[f2])` (`opposite`).
 *
 * `propagateOrientation` runs a BFS over the faces (roots: the smallest face index not yet reached, flipped
 * `false`; the queue is FIFO; each face's uses are scanned in ascending use order). Discovering face `g` from
 * the reached face `f` through a use sets `flip[g] = !(d_f xor flip[f]) xor d_g`, the only value making that use
 * consistent; the discovery is recorded as a tree step `(f, d_f, g, d_g)` (Lean `propagate` over the steps).
 * Then **every** use is checked. Lean `propagate_complete`: if some assignment makes every use consistent (the
 * shell is orientable) then the propagated one does too; so a failed check (`propagate_refusal_sound`) proves
 * the face set non-orientable (a Möbius band, a seam used twice the same way), never a wrong BFS choice. Over
 * several components the steps of the whole run form one tree order from all the roots (a root is never
 * discovered later), and Lean `propagate_complete_forest` with `consistent_xorOn_closed` covers the whole run.
 *
 * Upstream consulted (for the method, not translated): `solidcore/crates/solidcore/src/heal/stitch.rs` (fix
 * face orientation after stitching), `topology/shell.rs` (a shell's faces connected through edge uses) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */

/** One shared edge: its coedge in face `f1` runs it backwards iff `d1`, its coedge in `f2` iff `d2`. */
export interface EdgeUsePair {
  readonly f1: number;
  readonly d1: boolean;
  readonly f2: number;
  readonly d2: boolean;
}

/** Whether `u` is used in opposite directions once the faces in `flip` are flipped (Lean `opposite`). */
export function usesOpposite(flip: readonly boolean[], u: EdgeUsePair): boolean {
  return (u.d1 !== (flip[u.f1] ?? false)) !== (u.d2 !== (flip[u.f2] ?? false));
}

export type Orientation =
  | {
      readonly ok: true;
      /** Faces to flip. */
      readonly flip: readonly boolean[];
      /** The BFS tree steps, oriented from the reached face to the discovered one (Lean `propagate`). */
      readonly steps: readonly EdgeUsePair[];
      /** Connected components (by shared edges), each ascending, ordered by their smallest face. */
      readonly components: readonly (readonly number[])[];
    }
  | { readonly ok: false; readonly use: number };

/**
 * Propagates an orientation over `faceCount` faces linked by `uses` (see the module comment). Fails with the
 * index of the first use that the propagated assignment leaves inconsistent: the faces are then not orientable.
 */
export function propagateOrientation(faceCount: number, uses: readonly EdgeUsePair[]): Orientation {
  const adjacent: number[][] = Array.from({ length: faceCount }, () => []);
  uses.forEach((u, i) => {
    adjacent[u.f1]!.push(i);
    if (u.f2 !== u.f1) adjacent[u.f2]!.push(i);
  });
  const flip = new Array<boolean>(faceCount).fill(false);
  const reached = new Array<boolean>(faceCount).fill(false);
  const steps: EdgeUsePair[] = [];
  const components: number[][] = [];
  for (let root = 0; root < faceCount; root++) {
    if (reached[root]) continue;
    reached[root] = true;
    const component = [root];
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const f = queue[head]!;
      for (const i of adjacent[f]!) {
        const u = uses[i]!;
        // Orient the use from f to the other face.
        const step: EdgeUsePair = u.f1 === f ? u : { f1: u.f2, d1: u.d2, f2: u.f1, d2: u.d1 };
        if (reached[step.f2]) continue;
        reached[step.f2] = true;
        flip[step.f2] = !(step.d1 !== flip[f]) !== step.d2;
        steps.push(Object.freeze(step));
        component.push(step.f2);
        queue.push(step.f2);
      }
    }
    components.push(component.sort((a, b) => a - b));
  }
  const bad = uses.findIndex((u) => !usesOpposite(flip, u));
  if (bad >= 0) return { ok: false, use: bad };
  return Object.freeze({
    ok: true,
    flip: Object.freeze(flip),
    steps: Object.freeze(steps),
    components: Object.freeze(components.map((c) => Object.freeze(c))),
  });
}
