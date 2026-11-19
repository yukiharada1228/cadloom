import CadloomFormal.Topology

/-!
# Boolean: the selection table of the regularized operations, its laws and orientation (M5)

Exact model of `src/boolean/select.ts` (the table used by `src/boolean/boolean.ts`) and of the counts of
concrete results of `union` / `subtract` / `intersect`.

## The model

`Op`, `Side`, `Label`, `Action` are the TS `BooleanOp`, `OperandSide`, `FragmentLabel` (`in`, `out`, `on-same`,
`on-opposite`) and `SelectAction`. `table` is the TS constant `SELECTION` (same rows, same entries). `opEval` is
the TS `opEval` (membership in `op(A, B)`), `labelSides` the TS `LABEL_SIDES`, `model` the TS `sideModelAction`.

A **site** is a point of space near the boundaries, seen along a reference normal `n`: `aF`, `aB` say whether
the points just in front (`+n`) and just behind (`-n`) are in `A`, `bF`, `bB` the same for `B`. Where
`aF ≠ aB` the point is on `∂A`, and the imprinted `A` has a fragment there whose outward normal is `+n` iff the
back is inside (`aB`); its label relative to `B` is `labelAt` (the other operand's membership read in the
fragment's own front / back). Same for `B`. The **regularized** result `op(A, B)` is in front iff
`opEval op aF bF` and behind iff `opEval op aB bB`; it has a boundary at the site iff these differ, with outward
normal `+n` iff it is behind (`expected`). `emit op s` is what the TS pipeline produces at the site: each
operand's fragment run through `table` — dropped, kept with its orientation, or reversed.

## (a) Selection is exactly the regularized boundary

* `table_eq_model` — the TS table equals the side model `model` (TS `sideModelAction`) for every operation,
  side and label (TS test of the same name compares `SELECTION` with `sideModelAction`).
* `emit_eq_expected` — at every site (16 membership patterns) and for every operation, the fragments the table
  keeps are exactly the boundary of the regularized result, **once**, with its outward orientation; in
  particular coincident faces (`on-same`, `on-opposite`) give one face or none, never two.
* `kept_iff_boundary_A`, `kept_iff_boundary_B` — for a fragment with a non-coincident label (`in` / `out`), the
  table keeps it iff it lies on `∂ op(A, B)`; `emit_length_le_one` — never two faces at one place.

## (b) Algebraic laws of the regularized operations (on the pipeline's output)

* `union_comm`, `intersect_comm` — swapping the operands gives the same faces at every site (although the table
  takes coincident faces from `A` only, the face kept is the same place and orientation).
* `union_assoc`, `intersect_assoc` — `(A ∪ B) ∪ C` and `A ∪ (B ∪ C)` emit the same faces (the inner result's
  sides are `opEval` of the operands' sides).
* `de_morgan_union`, `de_morgan_intersect` — with the complement (both sides flipped, faces turned over):
  `∁A ∪ ∁B` emits the faces of `A ∩ B` turned over, `∁A ∩ ∁B` those of `A ∪ B`.
* `subtract_eq_intersect_compl` — `A - B` emits exactly the faces of `A ∩ ∁B`.
* `union_idem`, `intersect_idem` — `A ∪ A` and `A ∩ A` emit exactly `A`'s own face (`on-same` kept once);
  `subtract_self` — `A - A` emits nothing (the TS `empty` result).
* `opEval_*` — the point-set laws behind them (commutativity, associativity, De Morgan, `A - B = A ∩ ∁B`).

## (c) Orientation of subtract

* `subtract_B_in_reversed` — a fragment of `B` inside `A` (`aF = aB = true`) with outward normal `o` is emitted
  turned over (`!o`), and `!o` is the outward normal of `A - B` there: the cavity walls point out of the result
  (into `B`). `sign_flip` is the same with normals as signs `±1` (`sgn`): the emitted normal is `-sgn o`.
* `subtract_A_out_kept` — a fragment of `A` outside `B` keeps its orientation, the outward normal of `A - B`.

## (d) Euler–Poincaré of concrete TS results

`corner_union_counts` — box `[0,2]³ ∪ [1,3]³` (TS test `box ∪ box corner overlap`): `V = 7 + 7 + 6 = 20` (the
corners outside the other box plus the six intersection vertices), `E = 12 + 12 + 6 = 30`, `F = 6 + 6 = 12`,
`L = 12`, and `V - E + F - (L - F) = 2`, genus 0. Also `corner_intersect_counts` (8, 12, 6, 6),
`corner_subtract_counts` (14, 21, 9, 9), `through_hole_genus` (16, 24, 10, 12: genus 1),
`drilled_hole_genus` (box − cylinder: 10, 15, 7, 9: genus 1), `disjoint_union_counts` (two lumps, 16, 24, 12,
12, two shells). The TS tests of the same names assert these counts of the TS result bodies.

Not covered: geometry. The model assumes that classification gave each fragment the label of its site
(`labelAt`), that every fragment lies in one site pattern (no fragment straddles an intersection curve: the
imprint stage's job) and that assembly by sewing joins the kept faces as they are; floating point, tolerances,
sampling, ray classification and the sewing / merging of faces are not modelled (they are checked at run time by
`validateBrep`, `validateBrepGeometry` and the tests).
-/
namespace CadloomFormal
namespace Boolean

/-- The TS `BooleanOp`. -/
inductive Op
  | union
  | intersect
  | subtract
  deriving DecidableEq, Repr

/-- The TS `OperandSide`. -/
inductive Side
  | A
  | B
  deriving DecidableEq, Repr

/-- The TS `FragmentLabel`: `in`, `out`, `on-same`, `on-opposite`. -/
inductive Label
  | inside
  | outside
  | onSame
  | onOpposite
  deriving DecidableEq, Repr

/-- The TS `SelectAction`. -/
inductive Action
  | keep
  | reverse
  | drop
  deriving DecidableEq, Repr

/-- The TS `SELECTION` table (same rows: union, intersect, subtract; A then B; in, out, on-same, on-opposite). -/
def table : Op → Side → Label → Action
  | .union, .A, .inside => .drop
  | .union, .A, .outside => .keep
  | .union, .A, .onSame => .keep
  | .union, .A, .onOpposite => .drop
  | .union, .B, .inside => .drop
  | .union, .B, .outside => .keep
  | .union, .B, .onSame => .drop
  | .union, .B, .onOpposite => .drop
  | .intersect, .A, .inside => .keep
  | .intersect, .A, .outside => .drop
  | .intersect, .A, .onSame => .keep
  | .intersect, .A, .onOpposite => .drop
  | .intersect, .B, .inside => .keep
  | .intersect, .B, .outside => .drop
  | .intersect, .B, .onSame => .drop
  | .intersect, .B, .onOpposite => .drop
  | .subtract, .A, .inside => .drop
  | .subtract, .A, .outside => .keep
  | .subtract, .A, .onSame => .drop
  | .subtract, .A, .onOpposite => .keep
  | .subtract, .B, .inside => .reverse
  | .subtract, .B, .outside => .drop
  | .subtract, .B, .onSame => .drop
  | .subtract, .B, .onOpposite => .drop

/-- The TS `opEval`: membership in `op(A, B)`. -/
def opEval : Op → Bool → Bool → Bool
  | .union, a, b => a || b
  | .intersect, a, b => a && b
  | .subtract, a, b => a && !b

/-- The TS `LABEL_SIDES`: the other operand's membership (front, back) of a fragment with this label. -/
def labelSides : Label → Bool × Bool
  | .inside => (true, true)
  | .outside => (false, false)
  | .onSame => (false, true)
  | .onOpposite => (true, false)

/-- The result evaluated on a side: own membership `own`, the other's `other`, in operand order. -/
def evalAt (op : Op) (side : Side) (own other : Bool) : Bool :=
  match side with
  | .A => opEval op own other
  | .B => opEval op other own

/-- The TS `sideModelAction`. -/
def model (op : Op) (side : Side) (l : Label) : Action :=
  if side = .B ∧ (l = .onSame ∨ l = .onOpposite) then .drop
  else
    let front := evalAt op side false (labelSides l).1
    let back := evalAt op side true (labelSides l).2
    if front = back then .drop else if back then .keep else .reverse

theorem table_eq_model (op : Op) (side : Side) (l : Label) : table op side l = model op side l := by
  cases op <;> cases side <;> cases l <;> decide

/-! ## Sites -/

/-- Memberships of `A` and `B` in front of (`+n`) and behind a point. -/
structure Site where
  aF : Bool
  aB : Bool
  bF : Bool
  bB : Bool
  deriving DecidableEq, Repr

/-- The label of a fragment whose outward normal is `+n` iff `o`, from the other operand's sides `oF`, `oB`. -/
def labelAt (o oF oB : Bool) : Label :=
  match (if o then oF else oB), (if o then oB else oF) with
  | true, true => .inside
  | false, false => .outside
  | false, true => .onSame
  | true, false => .onOpposite

/-- The orientations (`true`: `+n`) a fragment of `side` gives under `table`, if that operand bounds the site. -/
def fromSide (op : Op) (side : Side) (ownF ownB otherF otherB : Bool) : List Bool :=
  if ownF = ownB then []
  else
    let o := ownB
    match table op side (labelAt o otherF otherB) with
    | .keep => [o]
    | .reverse => [!o]
    | .drop => []

/-- What the TS pipeline emits at a site: A's fragment then B's, each through the table. -/
def emit (op : Op) (s : Site) : List Bool :=
  fromSide op .A s.aF s.aB s.bF s.bB ++ fromSide op .B s.bF s.bB s.aF s.aB

/-- The boundary of the regularized `op(A, B)` at a site: one face, outward `+n` iff the result is behind. -/
def expected (op : Op) (s : Site) : List Bool :=
  let f := opEval op s.aF s.bF
  let b := opEval op s.aB s.bB
  if f = b then [] else [b]

theorem emit_eq_expected (op : Op) : ∀ aF aB bF bB : Bool, emit op ⟨aF, aB, bF, bB⟩ = expected op ⟨aF, aB, bF, bB⟩ := by
  cases op <;> decide

theorem emit_length_le_one (op : Op) (s : Site) : (emit op s).length ≤ 1 := by
  cases s with
  | mk aF aB bF bB =>
    rw [emit_eq_expected]
    simp only [expected]
    split <;> simp

/-- A fragment of `A` with a non-coincident label is kept (or reversed) iff the site is on `∂ op(A, B)`. -/
theorem kept_iff_boundary_A (op : Op) : ∀ aB bF : Bool,
    (fromSide op .A (!aB) aB bF bF ≠ []) ↔ (opEval op (!aB) bF ≠ opEval op aB bF) := by
  cases op <;> decide

/-- The same for a fragment of `B`. -/
theorem kept_iff_boundary_B (op : Op) : ∀ bB aF : Bool,
    (fromSide op .B (!bB) bB aF aF ≠ []) ↔ (opEval op aF (!bB) ≠ opEval op aF bB) := by
  cases op <;> decide

/-! ## (b) Algebraic laws -/

theorem opEval_union_comm (a b : Bool) : opEval .union a b = opEval .union b a := by cases a <;> cases b <;> rfl
theorem opEval_intersect_comm (a b : Bool) : opEval .intersect a b = opEval .intersect b a := by cases a <;> cases b <;> rfl
theorem opEval_union_assoc (a b c : Bool) :
    opEval .union (opEval .union a b) c = opEval .union a (opEval .union b c) := by cases a <;> cases b <;> cases c <;> rfl
theorem opEval_intersect_assoc (a b c : Bool) :
    opEval .intersect (opEval .intersect a b) c = opEval .intersect a (opEval .intersect b c) := by
  cases a <;> cases b <;> cases c <;> rfl
theorem opEval_de_morgan (a b : Bool) : opEval .union (!a) (!b) = !(opEval .intersect a b) := by cases a <;> cases b <;> rfl
theorem opEval_subtract (a b : Bool) : opEval .subtract a b = opEval .intersect a (!b) := by cases a <;> cases b <;> rfl

theorem union_comm : ∀ aF aB bF bB : Bool, emit .union ⟨aF, aB, bF, bB⟩ = emit .union ⟨bF, bB, aF, aB⟩ := by decide
theorem intersect_comm : ∀ aF aB bF bB : Bool, emit .intersect ⟨aF, aB, bF, bB⟩ = emit .intersect ⟨bF, bB, aF, aB⟩ := by
  decide

theorem union_assoc : ∀ aF aB bF bB cF cB : Bool,
    emit .union ⟨opEval .union aF bF, opEval .union aB bB, cF, cB⟩ =
      emit .union ⟨aF, aB, opEval .union bF cF, opEval .union bB cB⟩ := by decide

theorem intersect_assoc : ∀ aF aB bF bB cF cB : Bool,
    emit .intersect ⟨opEval .intersect aF bF, opEval .intersect aB bB, cF, cB⟩ =
      emit .intersect ⟨aF, aB, opEval .intersect bF cF, opEval .intersect bB cB⟩ := by decide

/-- The complement turns every face over: `∁A ∪ ∁B` emits the faces of `A ∩ B`, reversed. -/
theorem de_morgan_union : ∀ aF aB bF bB : Bool,
    emit .union ⟨!aF, !aB, !bF, !bB⟩ = (emit .intersect ⟨aF, aB, bF, bB⟩).map (fun o => !o) := by decide

theorem de_morgan_intersect : ∀ aF aB bF bB : Bool,
    emit .intersect ⟨!aF, !aB, !bF, !bB⟩ = (emit .union ⟨aF, aB, bF, bB⟩).map (fun o => !o) := by decide

theorem subtract_eq_intersect_compl : ∀ aF aB bF bB : Bool,
    emit .subtract ⟨aF, aB, bF, bB⟩ = emit .intersect ⟨aF, aB, !bF, !bB⟩ := by decide

/-- `A ∪ A = A`: the coincident copy is kept once, from `A`, with `A`'s orientation. -/
theorem union_idem : ∀ aF aB : Bool, emit .union ⟨aF, aB, aF, aB⟩ = (if aF = aB then [] else [aB]) := by decide

theorem intersect_idem : ∀ aF aB : Bool, emit .intersect ⟨aF, aB, aF, aB⟩ = (if aF = aB then [] else [aB]) := by decide

/-- `A - A = ∅`: nothing is emitted (the TS `empty` result). -/
theorem subtract_self : ∀ aF aB : Bool, emit .subtract ⟨aF, aB, aF, aB⟩ = [] := by decide

/-! ## (c) Orientation of subtract -/

/-- A fragment of `B` inside `A`, outward `+n` iff `o`, is emitted turned over, which is the outward side of
`A - B` (the result is behind iff `!o`). -/
theorem subtract_B_in_reversed (o : Bool) :
    emit .subtract ⟨true, true, !o, o⟩ = [!o] ∧ expected .subtract ⟨true, true, !o, o⟩ = [!o] := by
  cases o <;> decide

/-- A fragment of `A` outside `B` keeps its orientation in `A - B`. -/
theorem subtract_A_out_kept (o : Bool) : emit .subtract ⟨!o, o, false, false⟩ = [o] := by cases o <;> decide

/-- Normals as signs. -/
def sgn (o : Bool) : Int := if o then 1 else -1

/-- In sign form: B's inside fragment with normal `sgn o · n` is emitted with normal `-(sgn o) · n`, which is
`sgn` of "the result `A - B` is behind" (behind: `aB = true`, `bB = o`): the normal points out of `A - B`. -/
theorem sign_flip (o : Bool) :
    (emit .subtract ⟨true, true, !o, o⟩).map sgn = [-sgn o] ∧ sgn (opEval .subtract true o) = -sgn o := by
  cases o <;> decide

/-! ## (d) Euler–Poincaré of concrete TS results -/

/-- `V - E + F - (L - F)`. -/
def chi (v e f l : Int) : Int := v - e + f - (l - f)

/-- Box `[0,2]³ ∪ [1,3]³`: corners outside the other box (`7 + 7`) and six intersection vertices; each box keeps
its twelve (three shortened) edges plus six intersection edges; six faces of each (three L-shaped); no holes. -/
def cornerUnion : Int × Int × Int × Int := (7 + 7 + 6, 12 + 12 + 6, 6 + 6, 6 + 6)

theorem corner_union_counts :
    cornerUnion = (20, 30, 12, 12) ∧ chi 20 30 12 12 = 2 ∧ Topology.genus 20 30 12 12 1 = 0 := by decide

/-- `[0,2]³ ∩ [1,3]³` is the unit box `[1,2]³`. -/
theorem corner_intersect_counts : chi 8 12 6 6 = 2 ∧ Topology.genus 8 12 6 6 1 = 0 := by decide

/-- `[0,2]³ - [1,3]³`: 7 corners of A and 7 intersection-side vertices; 21 edges; 9 faces. -/
theorem corner_subtract_counts : chi 14 21 9 9 = 2 ∧ Topology.genus 14 21 9 9 1 = 0 := by decide

/-- A box minus a box through it: 16 vertices, 24 edges, 10 faces, 12 loops (two holes): genus 1. -/
theorem through_hole_genus : chi 16 24 10 12 = 0 ∧ Topology.genus 16 24 10 12 1 = 1 := by decide

/-- A box minus a cylinder through it: 10 vertices, 15 edges, 7 faces, 9 loops: genus 1. -/
theorem drilled_hole_genus : chi 10 15 7 9 = 0 ∧ Topology.genus 10 15 7 9 1 = 1 := by decide

/-- Two disjoint unit boxes: two shells of `(8, 12, 6, 6)`. -/
theorem disjoint_union_counts : chi (8 + 8) (12 + 12) (6 + 6) (6 + 6) = 2 * 2 ∧ Topology.genus 16 24 12 12 2 = 0 := by
  decide

end Boolean
end CadloomFormal
