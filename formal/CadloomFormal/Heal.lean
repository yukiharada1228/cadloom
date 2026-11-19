/-!
# Heal: sewing equivalences, orientation propagation, Euler counts of face merging

Models (exactly, over `Nat`/`Int`/`Bool`) the combinatorial decisions of `src/heal`:

**(a) Union-find (`mergeLabels`, `src/heal/union-find.ts`; used by `clusterPoints` for vertices and by
`mergeCosurfaceFaces` for face classes).** `mergeStep label (a, b)` relabels every `x` with
`label x = max (label a) (label b)` to `min (label a) (label b)`; `runMerges` processes a list of pairs in
order. The TS keeps class member lists only to touch the relabelled class; the function computed is this one.
* `runMerges_good` / `runMerges_idem` — `rep (rep x) = rep x`; `runMerges_le` — `rep x ≤ x`.
* `runMerges_sound` — equal labels imply connection by the pairs (`Conn`: the equivalence closure).
* `runMerges_complete` — connection implies equal labels.
* `runMerges_rep_min` — the label of a class is its minimum member.

**(b) Orientation propagation (`propagateOrientation`, `src/heal/orient.ts`).** A shared edge is a `Use`
`(f1, d1, f2, d2)`: the coedge in face `f1` runs it backwards iff `d1`. With flips `τ`, the edge is used in
opposite directions iff `(d1 xor τ f1) != (d2 xor τ f2)` (`opposite`, TS `usesOpposite`). The BFS discovers
face `f2` from the reached face `f1` and sets `τ f2 := !(d1 xor τ f1) xor d2` (`stepVal`); `propagate` applies the
tree steps in BFS order (`TreeOrder`: each step starts in a reached face and discovers a new one).
* `propagate_keeps` — a reached face's flip is never changed by later steps.
* `propagate_steps_opposite` — every tree edge ends up used in opposite directions.
* `propagate_eq_sigma` — if some `σ` makes every step consistent, the propagated flips are `σ` xor `σ root`.
* `propagate_complete` — if some `σ` makes every use consistent (the shell is orientable) and every face of a use
  is reached, the propagated flips make every use (tree and non-tree) opposite: the TS check then passes.
* `propagate_refusal_sound` — so when the TS check of all uses fails, no assignment exists: `non-orientable`
  is a true statement about the face set, not an artefact of the BFS order.
* `consistent_xorOn_closed` — flipping a consistent assignment on a union of components keeps it consistent;
  `propagate_complete_forest` — the whole TS run over several components (steps in a `TreeOrder` from all roots):
  with a consistent `σ` that is `false` at every root, every use ends up opposite; `forest_example` — a concrete
  two-component run.
* `check_sound` — the TS check (`uses.all opposite`) passing means every use is opposite.

**(c) Euler–Poincaré counts (`mergeCosurfaceFaces`, `removeRedundantVertices`, `src/heal/merge.ts`).** With
`chi = V - E + F - (L - F)`:
* `mergeAcrossEdge_euler` — two faces merged across one edge: `E - 1`, `F - 1`, `L - 1` keep `chi`.
* `splitLoop_euler` — removing an edge whose two sides lie on one loop: `E - 1`, `L + 1` keep `chi`.
* `removeVertex_euler` — removing a vertex between two edges: `V - 1`, `E - 1` keep `chi`;
  `removeVertex_coedges` — the coedge count drops by 2 (one per loop through the vertex), keeping `C = 2E`.
* `mergeGroup_euler_iff` — merging `k` faces, removing `r` edges and `w` vertices, with `Lg` loops before and
  `Lg'` after, keeps `chi` iff `Lg' = mergedLoopCount Lg r w k = Lg + r - w + 2 - 2k` (the TS guard
  `mergedLoopCount`); `mergeAcrossEdge_is_group` — the one-edge merge is the case `k = 2, r = 1, w = 0`.

Not covered: geometry (vertex clustering distances, edge coincidence sampling, surface coincidence, the mesh
volume sign and the nesting of shells by `classifyPoint`), the arena building (`buildPlan`), the loop
re-tracing of merged faces, and floating point. The BFS queue discipline itself is not modelled: any order of
tree steps satisfying `TreeOrder` is covered, which includes the TS FIFO order.
-/
namespace CadloomFormal
namespace Heal

/-! ## (a) Union-find with the minimum representative -/

/-- One merge: relabel the larger of the two labels to the smaller (TS `mergeLabels` loop body). -/
def mergeStep (label : Nat → Nat) (p : Nat × Nat) : Nat → Nat :=
  fun x => if label x = max (label p.1) (label p.2) then min (label p.1) (label p.2) else label x

/-- Merging pairs in order (TS `mergeLabels`, started from `id`). -/
def runMerges (label : Nat → Nat) : List (Nat × Nat) → Nat → Nat
  | [] => label
  | p :: ps => runMerges (mergeStep label p) ps

/-- Labels are fixed points and never exceed the index. -/
def Good (label : Nat → Nat) : Prop := ∀ x, label (label x) = label x ∧ label x ≤ x

theorem good_id : Good id := fun _ => ⟨rfl, Nat.le_refl _⟩

theorem mergeStep_good (label : Nat → Nat) (p : Nat × Nat) (h : Good label) : Good (mergeStep label p) := by
  intro x
  have ha := h p.1
  have hb := h p.2
  have hx := h x
  have hlx := h (label x)
  constructor
  · simp only [mergeStep]
    by_cases hM : label x = max (label p.1) (label p.2)
    · simp only [hM, if_true]
      by_cases hab : label p.1 ≤ label p.2
      · have e1 : min (label p.1) (label p.2) = label p.1 := Nat.min_eq_left hab
        rw [e1, ha.1]
        split <;> omega
      · have e1 : min (label p.1) (label p.2) = label p.2 := by omega
        rw [e1, hb.1]
        split <;> omega
    · simp only [hM, if_false, hx.1]
  · simp only [mergeStep]
    split <;> omega

theorem runMerges_good (label : Nat → Nat) (ps : List (Nat × Nat)) (h : Good label) : Good (runMerges label ps) := by
  induction ps generalizing label with
  | nil => exact h
  | cons p ps ih => exact ih _ (mergeStep_good label p h)

theorem runMerges_idem (ps : List (Nat × Nat)) (x : Nat) : runMerges id ps (runMerges id ps x) = runMerges id ps x :=
  (runMerges_good id ps good_id x).1

theorem runMerges_le (ps : List (Nat × Nat)) (x : Nat) : runMerges id ps x ≤ x :=
  (runMerges_good id ps good_id x).2

/-- Connection by the pairs: the equivalence closure. -/
inductive Conn (ps : List (Nat × Nat)) : Nat → Nat → Prop
  | refl (x : Nat) : Conn ps x x
  | symm {x y : Nat} : Conn ps x y → Conn ps y x
  | trans {x y z : Nat} : Conn ps x y → Conn ps y z → Conn ps x z
  | edge {a b : Nat} : (a, b) ∈ ps → Conn ps a b

theorem runMerges_conn (qs : List (Nat × Nat)) (label : Nat → Nat) (ps : List (Nat × Nat))
    (hsub : ∀ p ∈ ps, p ∈ qs) (h : ∀ x, Conn qs x (label x)) : ∀ x, Conn qs x (runMerges label ps x) := by
  induction ps generalizing label with
  | nil => exact h
  | cons p ps ih =>
    apply ih
    · intro q hq; exact hsub q (List.mem_cons_of_mem _ hq)
    · intro x
      have hp : p ∈ qs := hsub p (List.mem_cons_self ..)
      -- the two labels of the pair are connected
      have hab : Conn qs (label p.1) (label p.2) :=
        Conn.trans (Conn.symm (h p.1)) (Conn.trans (Conn.edge hp) (h p.2))
      simp only [mergeStep]
      split
      · rename_i hM
        have hx := h x
        rw [hM] at hx
        by_cases hle : label p.1 ≤ label p.2
        · rw [Nat.max_eq_right hle] at hx
          rw [Nat.min_eq_left hle]
          exact Conn.trans hx (Conn.symm hab)
        · have e1 : max (label p.1) (label p.2) = label p.1 := by omega
          have e2 : min (label p.1) (label p.2) = label p.2 := by omega
          rw [e1] at hx
          rw [e2]
          exact Conn.trans hx hab
      · exact h x

theorem runMerges_sound (ps : List (Nat × Nat)) (x y : Nat) (h : runMerges id ps x = runMerges id ps y) : Conn ps x y := by
  have c := runMerges_conn ps id ps (fun _ hp => hp) (fun x => Conn.refl x)
  exact Conn.trans (c x) (h ▸ Conn.symm (c y))

theorem runMerges_congr (label : Nat → Nat) (ps : List (Nat × Nat)) (x y : Nat) (h : label x = label y) :
    runMerges label ps x = runMerges label ps y := by
  induction ps generalizing label with
  | nil => exact h
  | cons p ps ih =>
    apply ih
    unfold mergeStep
    rw [h]

theorem runMerges_pair (label : Nat → Nat) (ps : List (Nat × Nat)) (a b : Nat) (h : (a, b) ∈ ps) :
    runMerges label ps a = runMerges label ps b := by
  induction ps generalizing label with
  | nil => cases h
  | cons p ps ih =>
    cases h with
    | head =>
      show runMerges (mergeStep label (a, b)) ps a = runMerges (mergeStep label (a, b)) ps b
      apply runMerges_congr
      unfold mergeStep
      dsimp only
      split <;> split <;> omega
    | tail _ h => exact ih _ h

theorem runMerges_complete (ps : List (Nat × Nat)) (x y : Nat) (h : Conn ps x y) : runMerges id ps x = runMerges id ps y := by
  induction h with
  | refl => rfl
  | symm _ ih => exact ih.symm
  | trans _ _ ih1 ih2 => exact ih1.trans ih2
  | edge hm => exact runMerges_pair id ps _ _ hm

theorem runMerges_rep_min (ps : List (Nat × Nat)) (x y : Nat) (h : Conn ps x y) : runMerges id ps x ≤ y := by
  rw [runMerges_complete ps x y h]; exact runMerges_le ps y

/-- A concrete run: pairs (3,1), (4,3), (0,2) give classes {1,3,4} (rep 1) and {0,2} (rep 0). -/
theorem runMerges_example :
    (List.range 5).map (runMerges id [(3, 1), (4, 3), (0, 2)]) = [0, 1, 0, 1, 1] := by decide

/-! ## (b) Orientation propagation -/

/-- A shared edge: the coedge in face `f1` runs it backwards iff `d1`, the one in `f2` iff `d2`. -/
structure Use where
  f1 : Nat
  d1 : Bool
  f2 : Nat
  d2 : Bool

/-- Used in opposite directions once faces are flipped by `τ` (TS `usesOpposite`). -/
def opposite (τ : Nat → Bool) (u : Use) : Bool := (u.d1 ^^ τ u.f1) != (u.d2 ^^ τ u.f2)

def setAt (τ : Nat → Bool) (k : Nat) (b : Bool) : Nat → Bool := fun x => if x = k then b else τ x

/-- The flip the BFS gives the discovered face (TS `flip[g] = !(d_f xor flip[f]) xor d_g`). -/
def stepVal (τ : Nat → Bool) (u : Use) : Bool := (!(u.d1 ^^ τ u.f1)) ^^ u.d2

def propagate (τ : Nat → Bool) : List Use → Nat → Bool
  | [] => τ
  | u :: us => propagate (setAt τ u.f2 (stepVal τ u)) us

/-- Tree steps in discovery order from the reached list `R`. -/
def TreeOrder : List Nat → List Use → Prop
  | _, [] => True
  | R, u :: us => u.f1 ∈ R ∧ u.f2 ∉ R ∧ TreeOrder (u.f2 :: R) us

def Reached (R : List Nat) (us : List Use) (x : Nat) : Prop := x ∈ R ∨ x ∈ us.map Use.f2

theorem propagate_keeps (τ : Nat → Bool) (R : List Nat) (us : List Use) (hT : TreeOrder R us) (x : Nat) (hx : x ∈ R) :
    propagate τ us x = τ x := by
  induction us generalizing τ R with
  | nil => rfl
  | cons u us ih =>
    obtain ⟨_, hnot, hrest⟩ := hT
    simp only [propagate]
    rw [ih _ _ hrest (List.mem_cons_of_mem _ hx)]
    have : x ≠ u.f2 := fun e => hnot (e ▸ hx)
    simp [setAt, this]

theorem stepVal_opposite (τ : Nat → Bool) (u : Use) (hne : u.f1 ≠ u.f2) :
    opposite (setAt τ u.f2 (stepVal τ u)) u = true := by
  simp only [opposite, setAt, stepVal, if_neg hne]
  cases u.d1 <;> cases u.d2 <;> cases τ u.f1 <;> simp

theorem propagate_steps_opposite (τ : Nat → Bool) (R : List Nat) (us : List Use) (hT : TreeOrder R us) :
    ∀ u ∈ us, opposite (propagate τ us) u = true := by
  induction us generalizing τ R with
  | nil => intro u hu; cases hu
  | cons v vs ih =>
    obtain ⟨h1, hnot, hrest⟩ := hT
    intro u hu
    cases hu with
    | head =>
      simp only [propagate]
      have hne : v.f1 ≠ v.f2 := fun e => hnot (e ▸ h1)
      have k1 := propagate_keeps (setAt τ v.f2 (stepVal τ v)) _ vs hrest v.f1 (List.mem_cons_of_mem _ h1)
      have k2 := propagate_keeps (setAt τ v.f2 (stepVal τ v)) _ vs hrest v.f2 (List.mem_cons_self ..)
      have := stepVal_opposite τ v hne
      simp only [opposite] at this ⊢
      rw [k1, k2]; exact this
    | tail _ h => exact ih _ _ hrest u h

/-- Every step consistent with `σ`. -/
def ConsistentOn (σ : Nat → Bool) (us : List Use) : Prop := ∀ u ∈ us, opposite σ u = true

theorem propagate_eq_sigma (σ : Nat → Bool) (c : Bool) (τ : Nat → Bool) (R : List Nat) (us : List Use)
    (hT : TreeOrder R us) (hσ : ConsistentOn σ us) (hR : ∀ x ∈ R, τ x = (σ x ^^ c)) :
    ∀ x, Reached R us x → propagate τ us x = (σ x ^^ c) := by
  induction us generalizing τ R with
  | nil =>
    intro x hx
    rcases hx with hx | hx
    · exact hR x hx
    · cases hx
  | cons u us ih =>
    obtain ⟨h1, hnot, hrest⟩ := hT
    have hu := hσ u (List.mem_cons_self ..)
    have hσ' : ConsistentOn σ us := fun v hv => hσ v (List.mem_cons_of_mem _ hv)
    have hR' : ∀ x ∈ u.f2 :: R, setAt τ u.f2 (stepVal τ u) x = (σ x ^^ c) := by
      intro x hx
      cases hx with
      | head =>
        simp only [setAt, stepVal, ite_true]
        rw [hR u.f1 h1]
        simp only [opposite] at hu
        revert hu
        cases u.d1 <;> cases u.d2 <;> cases σ u.f1 <;> cases σ u.f2 <;> cases c <;> simp
      | tail _ hx =>
        have : x ≠ u.f2 := fun e => hnot (e ▸ hx)
        simp only [setAt, if_neg this]
        exact hR x hx
    intro x hx
    simp only [propagate]
    apply ih _ _ hrest hσ' hR'
    rcases hx with hx | hx
    · exact Or.inl (List.mem_cons_of_mem _ hx)
    · simp only [List.map_cons, List.mem_cons] at hx
      rcases hx with hx | hx
      · exact Or.inl (hx ▸ List.mem_cons_self ..)
      · exact Or.inr hx

theorem opposite_xor (σ : Nat → Bool) (c : Bool) (τ : Nat → Bool) (u : Use)
    (h1 : τ u.f1 = (σ u.f1 ^^ c)) (h2 : τ u.f2 = (σ u.f2 ^^ c)) : opposite τ u = opposite σ u := by
  simp only [opposite, h1, h2]
  cases u.d1 <;> cases u.d2 <;> cases σ u.f1 <;> cases σ u.f2 <;> cases c <;> simp

/--
Completeness of propagation: tree steps `steps` (a subset of the uses, in a tree order from `root`) reaching every
face of every use, started from flips `τ0` with `τ0 root = false`; if some `σ` makes every use consistent, the
propagated flips make every use opposite.
-/
theorem propagate_complete (σ τ0 : Nat → Bool) (root : Nat) (uses steps : List Use)
    (hT : TreeOrder [root] steps) (hsub : ∀ u ∈ steps, u ∈ uses) (hroot : τ0 root = false)
    (hreach : ∀ u ∈ uses, Reached [root] steps u.f1 ∧ Reached [root] steps u.f2)
    (hσ : ConsistentOn σ uses) : ∀ u ∈ uses, opposite (propagate τ0 steps) u = true := by
  have hR : ∀ x ∈ [root], τ0 x = (σ x ^^ σ root) := by
    intro x hx
    simp only [List.mem_singleton] at hx
    subst hx
    rw [hroot]; cases σ x <;> rfl
  have heq := propagate_eq_sigma σ (σ root) τ0 [root] steps hT (fun u hu => hσ u (hsub u hu)) hR
  intro u hu
  rw [opposite_xor σ (σ root) _ u (heq _ (hreach u hu).1) (heq _ (hreach u hu).2)]
  exact hσ u hu

/-- A failed check of the propagated flips proves that the uses are not orientable. -/
theorem propagate_refusal_sound (τ0 : Nat → Bool) (root : Nat) (uses steps : List Use)
    (hT : TreeOrder [root] steps) (hsub : ∀ u ∈ steps, u ∈ uses) (hroot : τ0 root = false)
    (hreach : ∀ u ∈ uses, Reached [root] steps u.f1 ∧ Reached [root] steps u.f2)
    (hfail : ∃ u ∈ uses, opposite (propagate τ0 steps) u = false) : ¬ ∃ σ, ConsistentOn σ uses := by
  rintro ⟨σ, hσ⟩
  obtain ⟨u, hu, hf⟩ := hfail
  have := propagate_complete σ τ0 root uses steps hT hsub hroot hreach hσ u hu
  rw [hf] at this
  cases this

/-- Flipping `σ` on a set `S` of faces (`S x = true`). -/
def xorOn (σ S : Nat → Bool) : Nat → Bool := fun x => σ x ^^ S x

/--
Flipping a consistent assignment on a set of faces closed under the uses (a union of connected components)
keeps it consistent: so an orientable face set has a consistent assignment that is `false` at the root of every
component (flip each component whose root has `σ root = true`).
-/
theorem consistent_xorOn_closed (σ S : Nat → Bool) (uses : List Use) (hσ : ConsistentOn σ uses)
    (hS : ∀ u ∈ uses, S u.f1 = S u.f2) : ConsistentOn (xorOn σ S) uses := by
  intro u hu
  have h := hσ u hu
  have e := hS u hu
  simp only [opposite, xorOn] at h ⊢
  rw [e]
  revert h
  cases u.d1 <;> cases u.d2 <;> cases σ u.f1 <;> cases σ u.f2 <;> cases S u.f2 <;> simp

/--
Completeness over a forest (the TS run over all components): the TS steps form a `TreeOrder` from the list of
**all** BFS roots (a root is chosen among unreached faces only, so it is never discovered by a step), the roots
keep flip `false`, and some consistent `σ` is `false` at every root (`consistent_xorOn_closed`). Then the
propagated flips make every use opposite.
-/
theorem propagate_complete_forest (σ τ0 : Nat → Bool) (roots : List Nat) (uses steps : List Use)
    (hT : TreeOrder roots steps) (hsub : ∀ u ∈ steps, u ∈ uses) (hroot : ∀ r ∈ roots, τ0 r = false)
    (hσroot : ∀ r ∈ roots, σ r = false)
    (hreach : ∀ u ∈ uses, Reached roots steps u.f1 ∧ Reached roots steps u.f2)
    (hσ : ConsistentOn σ uses) : ∀ u ∈ uses, opposite (propagate τ0 steps) u = true := by
  have hR : ∀ x ∈ roots, τ0 x = (σ x ^^ false) := by
    intro x hx
    rw [hroot x hx, hσroot x hx]; rfl
  have heq := propagate_eq_sigma σ false τ0 roots steps hT (fun u hu => hσ u (hsub u hu)) hR
  intro u hu
  rw [opposite_xor σ false _ u (heq _ (hreach u hu).1) (heq _ (hreach u hu).2)]
  exact hσ u hu

/-- Two components (faces 0-1 and 2-3, roots 0 and 2): the forest steps are a `TreeOrder` from both roots. -/
theorem forest_example :
    TreeOrder [0, 2] [⟨0, false, 1, false⟩, ⟨2, true, 3, false⟩] ∧
    ([⟨0, false, 1, false⟩, ⟨2, true, 3, false⟩] : List Use).all
      (opposite (propagate (fun _ => false) [⟨0, false, 1, false⟩, ⟨2, true, 3, false⟩])) = true := by
  refine ⟨?_, ?_⟩
  · simp [TreeOrder]
  · decide

/-- The TS check of all uses. -/
theorem check_sound (τ : Nat → Bool) (uses : List Use) (h : uses.all (opposite τ) = true) :
    ∀ u ∈ uses, opposite τ u = true := by
  simpa [List.all_eq_true] using h

/-- The three-face Möbius strip of the TS test has no consistent assignment (checked over all 8 flips). -/
def moebius : List Use := [⟨0, false, 1, true⟩, ⟨1, false, 2, true⟩, ⟨2, false, 0, false⟩]

theorem moebius_not_orientable :
    ∀ a b c : Bool, moebius.all (opposite (fun x => if x = 0 then a else if x = 1 then b else c)) = false := by
  decide

/-! ## (c) Euler–Poincaré counts of merging -/

structure Counts where
  V : Int
  E : Int
  F : Int
  L : Int

/-- `V - E + F - (L - F)`, the left side of Euler–Poincaré (`validateBrep`'s `eulerPoincare`). -/
def chi (c : Counts) : Int := c.V - c.E + c.F - (c.L - c.F)

def mergeAcrossEdge (c : Counts) : Counts := { c with E := c.E - 1, F := c.F - 1, L := c.L - 1 }
def splitLoop (c : Counts) : Counts := { c with E := c.E - 1, L := c.L + 1 }
def removeVertex (c : Counts) : Counts := { c with V := c.V - 1, E := c.E - 1 }

theorem mergeAcrossEdge_euler (c : Counts) : chi (mergeAcrossEdge c) = chi c := by
  simp only [chi, mergeAcrossEdge]; omega

theorem splitLoop_euler (c : Counts) : chi (splitLoop c) = chi c := by
  simp only [chi, splitLoop]; omega

theorem removeVertex_euler (c : Counts) : chi (removeVertex c) = chi c := by
  simp only [chi, removeVertex]; omega

/-- Every edge has two coedges; removing a vertex of degree two drops one coedge from each of its two loops. -/
theorem removeVertex_coedges (c : Counts) (C : Int) (h : C = 2 * c.E) : C - 2 = 2 * (removeVertex c).E := by
  simp only [removeVertex]; omega

/-- TS `mergedLoopCount`. -/
def mergedLoopCount (Lg r w k : Int) : Int := Lg + r - w + 2 - 2 * k

/-- Merging `k` faces of a group, removing `r` edges and `w` vertices; the group had `Lg` loops and has `Lg'`. -/
def mergeGroup (c : Counts) (k r w Lg Lg' : Int) : Counts :=
  { V := c.V - w, E := c.E - r, F := c.F - (k - 1), L := c.L - Lg + Lg' }

theorem mergeGroup_euler_iff (c : Counts) (k r w Lg Lg' : Int) :
    chi (mergeGroup c k r w Lg Lg') = chi c ↔ Lg' = mergedLoopCount Lg r w k := by
  simp only [chi, mergeGroup, mergedLoopCount]; omega

theorem mergeAcrossEdge_is_group (c : Counts) : mergeGroup c 2 1 0 2 1 = mergeAcrossEdge c := by
  simp only [mergeGroup, mergeAcrossEdge]
  congr 1 <;> omega

theorem mergedLoopCount_examples :
    mergedLoopCount 2 1 0 2 = 1 ∧ mergedLoopCount 2 2 0 2 = 2 ∧ mergedLoopCount 4 4 1 4 = 1 := by decide

end Heal
end CadloomFormal
