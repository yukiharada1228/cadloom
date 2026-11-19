/**
 * Selection — stage 4 of the boolean pipeline (upstream `docs/booleans.md` §3 "select"): which classified
 * fragments make the boundary of the regularized result, and which of them are turned over.
 *
 * Every fragment of operand `A` is labelled relative to `B` (and every fragment of `B` relative to `A`):
 * - `in` / `out`: the fragment lies inside / outside the other solid;
 * - `on-same`: it lies on a face of the other solid whose outward normal agrees with its own;
 * - `on-opposite`: it lies on a face of the other solid whose outward normal is opposite.
 *
 * `SELECTION[op][side][label]` is `'keep'` (as it is), `'reverse'` (turned over: `subtract` keeps the part of
 * `B` inside `A` as the walls of the cavity, pointing out of `A - B`, i.e. into `B`) or `'drop'`:
 *
 * | op        | A: in | A: out | A: on-same | A: on-opposite | B: in    | B: out | B: on-* |
 * |-----------|-------|--------|------------|----------------|----------|--------|---------|
 * | union     | drop  | keep   | keep       | drop           | drop     | keep   | drop    |
 * | intersect | keep  | drop   | keep       | drop           | keep     | drop   | drop    |
 * | subtract  | drop  | keep   | drop       | keep           | reverse  | drop   | drop    |
 *
 * A coincident region carries one fragment of each operand; it is kept (at most) **once**, from `A`. The table
 * is derived from the local side model (`sideModelAction`): at a fragment, the space near it has a *front*
 * (where its outward normal points) and a *back*; each operand is in or out on each side (`LABEL_SIDES`); the
 * fragment bounds `op(A, B)` iff `op` differs between the sides, and it keeps its orientation iff the result is
 * on the back. Lean `Boolean.lean` proves that the table equals that model (`table_eq_model`), that each
 * boundary site of the result is produced exactly once with the outward orientation (`emit_eq_expected`), and the
 * algebraic laws of the regularized operations; the TS tests check the same table against `sideModelAction`.
 *
 * Upstream consulted (for the rules, not translated): `solidcore/docs/booleans.md` §3 (select: union keeps the
 * outside parts, intersection the inside parts, difference the outside of A with the inside of B reversed;
 * coincident faces kept once by orientation), `solidcore/crates/solidcore/src/boolean/api_brep.rs`,
 * `boolean/merge.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */

/** The three regularized boolean operations. */
export type BooleanOp = 'union' | 'intersect' | 'subtract';

/** Where a fragment of one operand lies relative to the other operand. */
export type FragmentLabel = 'in' | 'out' | 'on-same' | 'on-opposite';

/** Which operand a fragment comes from. */
export type OperandSide = 'A' | 'B';

/** What the selection does with a fragment. */
export type SelectAction = 'keep' | 'reverse' | 'drop';

export const BOOLEAN_OPS: readonly BooleanOp[] = Object.freeze(['union', 'intersect', 'subtract']);
export const FRAGMENT_LABELS: readonly FragmentLabel[] = Object.freeze(['in', 'out', 'on-same', 'on-opposite']);
export const OPERAND_SIDES: readonly OperandSide[] = Object.freeze(['A', 'B']);

type Row = Readonly<Record<FragmentLabel, SelectAction>>;
const row = (r: Record<FragmentLabel, SelectAction>): Row => Object.freeze(r);

/** The selection table (see the module comment; Lean `Boolean.table`). The one table code and tests use. */
export const SELECTION: Readonly<Record<BooleanOp, Readonly<Record<OperandSide, Row>>>> = Object.freeze({
  union: Object.freeze({
    A: row({ in: 'drop', out: 'keep', 'on-same': 'keep', 'on-opposite': 'drop' }),
    B: row({ in: 'drop', out: 'keep', 'on-same': 'drop', 'on-opposite': 'drop' }),
  }),
  intersect: Object.freeze({
    A: row({ in: 'keep', out: 'drop', 'on-same': 'keep', 'on-opposite': 'drop' }),
    B: row({ in: 'keep', out: 'drop', 'on-same': 'drop', 'on-opposite': 'drop' }),
  }),
  subtract: Object.freeze({
    A: row({ in: 'drop', out: 'keep', 'on-same': 'drop', 'on-opposite': 'keep' }),
    B: row({ in: 'reverse', out: 'drop', 'on-same': 'drop', 'on-opposite': 'drop' }),
  }),
});

/** The table's action for a fragment of `side` labelled `label` (Lean `Boolean.table`). */
export function selectAction(op: BooleanOp, side: OperandSide, label: FragmentLabel): SelectAction {
  return SELECTION[op][side][label];
}

/** The point-set operation on memberships (Lean `Boolean.opEval`): is a point of the result? */
export function opEval(op: BooleanOp, inA: boolean, inB: boolean): boolean {
  switch (op) {
    case 'union':
      return inA || inB;
    case 'intersect':
      return inA && inB;
    case 'subtract':
      return inA && !inB;
  }
}

/**
 * The other operand's membership on the front and back of a fragment with label `label` (Lean
 * `Boolean.labelSides`): `in` both, `out` neither, `on-same` the back only (its outward side is the fragment's
 * front), `on-opposite` the front only.
 */
export const LABEL_SIDES: Readonly<Record<FragmentLabel, readonly [front: boolean, back: boolean]>> = Object.freeze({
  in: Object.freeze([true, true] as const),
  out: Object.freeze([false, false] as const),
  'on-same': Object.freeze([false, true] as const),
  'on-opposite': Object.freeze([true, false] as const),
});

/**
 * The action the local side model gives (Lean `Boolean.model`): the fragment's own operand is out in front, in
 * behind; the result is evaluated on both sides. Different sides: on the result's boundary, kept when the result
 * is behind (`keep`) and turned over when it is in front (`reverse`). Coincident labels give their region once,
 * from `A`: a `B` fragment with an `on-*` label is dropped.
 */
export function sideModelAction(op: BooleanOp, side: OperandSide, label: FragmentLabel): SelectAction {
  if (side === 'B' && (label === 'on-same' || label === 'on-opposite')) return 'drop';
  const [otherFront, otherBack] = LABEL_SIDES[label];
  const at = (own: boolean, other: boolean): boolean => (side === 'A' ? opEval(op, own, other) : opEval(op, other, own));
  const front = at(false, otherFront), back = at(true, otherBack);
  if (front === back) return 'drop';
  return back ? 'keep' : 'reverse';
}
