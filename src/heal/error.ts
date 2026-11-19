/**
 * Named refusals of the healing layer. Every one is an `invalid-topology` error whose `reason` starts with a
 * stable `HealIssue` code, then `': '` and a detail (the convention of `TopologyIssue` in src/topology).
 *
 * Upstream consulted (for the failure cases, not translated): `solidcore/crates/solidcore/src/heal/stitch.rs`
 * (open and non-manifold stitch results), `docs/booleans.md` (a result is a valid solid or a named refusal) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
import { err, type EntityRef, type Result, type SolidError } from '../core/error.ts';

export type HealIssue =
  | 'empty-soup' // no faces
  | 'invalid-piece' // an edge piece's interval or pcurve is unusable
  | 'degenerate-piece' // an edge piece collapses onto one vertex
  | 'loop-gap' // consecutive pieces of a loop do not meet within the vertex tolerance
  | 'not-closed' // an edge is used by one face only: the soup does not close a solid
  | 'non-manifold' // an edge is used by more than two faces
  | 'non-orientable' // no flipping of faces makes every shared edge used in opposite directions
  | 'zero-volume' // a closed shell encloses no volume (or could not be meshed to decide its side)
  | 'shells-intersect'; // two shells cross or touch (a vertex of one is on, or partly inside, another)

/** An `invalid-topology` error of `operation` whose reason starts with `issue`. */
export function healError(operation: string, issue: HealIssue, detail: string, entity?: EntityRef): Result<never> {
  return err(
    entity === undefined
      ? { kind: 'invalid-topology', operation, reason: `${issue}: ${detail}` }
      : { kind: 'invalid-topology', operation, reason: `${issue}: ${detail}`, entity },
  );
}

const ISSUES: ReadonlySet<string> = new Set<HealIssue>([
  'empty-soup', 'invalid-piece', 'degenerate-piece', 'loop-gap', 'not-closed', 'non-manifold', 'non-orientable',
  'zero-volume', 'shells-intersect',
]);

/** The `HealIssue` of an error made by this module, if it is one. */
export function healIssue(error: SolidError): HealIssue | undefined {
  if (error.kind !== 'invalid-topology') return undefined;
  const code = error.reason.split(':', 1)[0]!;
  return ISSUES.has(code) ? (code as HealIssue) : undefined;
}
