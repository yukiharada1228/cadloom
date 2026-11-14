import CutCompleteness

namespace Cadloom

section OrderedList
variable {α : Type*} [LinearOrder α]

def consecutiveEdges : List α → List (α × α)
  | [] => []
  | [_] => []
  | x :: y :: rest => (x, y) :: consecutiveEdges (y :: rest)

def ListAdjacent (xs : List α) (a b : α) : Prop :=
  a ∈ xs ∧ b ∈ xs ∧ a < b ∧ ∀ p ∈ xs, ¬ (a < p ∧ p < b)

theorem consecutiveEdges_sound (xs : List α) (hs : xs.Pairwise (· < ·)) (a b : α)
    (he : (a, b) ∈ consecutiveEdges xs) : ListAdjacent xs a b := by
  induction xs with
  | nil => simp [consecutiveEdges] at he
  | cons x tail ih =>
    cases tail with
    | nil => simp [consecutiveEdges] at he
    | cons y rest =>
      have hhead := (List.pairwise_cons.mp hs).1
      have htail := (List.pairwise_cons.mp hs).2
      simp only [consecutiveEdges, List.mem_cons, Prod.mk.injEq] at he
      rcases he with ⟨rfl, rfl⟩ | he
      · refine ⟨by simp, by simp, hhead _ (by simp), ?_⟩
        intro p hp hint
        rcases List.mem_cons.mp hp with rfl | hp
        · exact (lt_irrefl _ hint.1)
        · rcases List.mem_cons.mp hp with rfl | hp
          · exact (lt_irrefl _ hint.2)
          · have hyp := (List.pairwise_cons.mp htail).1 p hp
            exact (not_lt_of_ge (le_of_lt hyp)) hint.2
      · have h := ih htail he
        refine ⟨by simp [h.1], by simp [h.2.1], h.2.2.1, ?_⟩
        intro p hp hint
        rcases List.mem_cons.mp hp with rfl | hp
        · have hxa := hhead a h.1
          exact (not_lt_of_ge (le_of_lt hxa)) hint.1
        · exact h.2.2.2 p hp hint

theorem consecutiveEdges_complete (xs : List α) (hs : xs.Pairwise (· < ·))
    (a b : α) (h : ListAdjacent xs a b) : (a, b) ∈ consecutiveEdges xs := by
  induction xs with
  | nil => simp [ListAdjacent] at h
  | cons x tail ih =>
    cases tail with
    | nil =>
      obtain ⟨ha, hb, hab, _⟩ := h
      simp only [List.mem_singleton] at ha hb
      subst a
      subst b
      exact False.elim (lt_irrefl _ hab)
    | cons y rest =>
      have hhead := (List.pairwise_cons.mp hs).1
      have htail := (List.pairwise_cons.mp hs).2
      obtain ⟨ha, hb, hab, hgap⟩ := h
      rcases List.mem_cons.mp ha with rfl | hat
      · rcases List.mem_cons.mp hb with rfl | hb
        · exact False.elim (lt_irrefl _ hab)
        · rcases List.mem_cons.mp hb with rfl | hb
          · simp [consecutiveEdges]
          · have hxy := hhead y (by simp)
            have hyb := (List.pairwise_cons.mp htail).1 b hb
            exact False.elim (hgap y (by simp) ⟨hxy, hyb⟩)
      · rcases List.mem_cons.mp hb with rfl | hb
        · have hxa := hhead a hat
          exact False.elim ((not_lt_of_ge (le_of_lt hxa)) hab)
        · have ht : ListAdjacent (y :: rest) a b :=
            ⟨hat, hb, hab, fun p hp => hgap p (List.mem_cons_of_mem x hp)⟩
          have he := ih htail ht
          exact List.mem_cons_of_mem _ he

theorem consecutiveEdges_iff (xs : List α) (hs : xs.Pairwise (· < ·)) (a b : α) :
    (a, b) ∈ consecutiveEdges xs ↔ ListAdjacent xs a b :=
  ⟨consecutiveEdges_sound xs hs a b, consecutiveEdges_complete xs hs a b⟩

theorem consecutiveEdges_cover (xs : List α) (hs : xs.Pairwise (· < ·)) (p : α)
    (hl : ∃ l ∈ xs, l ≤ p) (hu : ∃ u ∈ xs, p ≤ u) :
    p ∈ xs ∨ ∃ a b, (a, b) ∈ consecutiveEdges xs ∧ a ≤ p ∧ p ≤ b := by
  by_cases hp : p ∈ xs
  · exact Or.inl hp
  · right
    induction xs with
    | nil => simp at hl
    | cons x tail ih =>
      have hhead := (List.pairwise_cons.mp hs).1
      have htail := (List.pairwise_cons.mp hs).2
      have hxp : x ≤ p := by
        obtain ⟨l, hmem, hlp⟩ := hl
        rcases List.mem_cons.mp hmem with rfl | hmem
        · exact hlp
        · exact le_trans (le_of_lt (hhead l hmem)) hlp
      have huTail : ∃ u ∈ tail, p ≤ u := by
        obtain ⟨u, hmem, hpu⟩ := hu
        rcases List.mem_cons.mp hmem with rfl | hmem
        · have heq := le_antisymm hpu hxp
          exact False.elim (hp (heq ▸ List.mem_cons_self))
        · exact ⟨u, hmem, hpu⟩
      cases tail with
      | nil => simp at huTail
      | cons y rest =>
        by_cases hpy : p ≤ y
        · exact ⟨x, y, by simp [consecutiveEdges], hxp, hpy⟩
        · have hyp : y ≤ p := le_of_lt (lt_of_not_ge hpy)
          have hpt : p ∉ y :: rest := fun h => hp (List.mem_cons_of_mem x h)
          exact (ih htail ⟨y, by simp, hyp⟩ huTail hpt).imp
            (fun a ⟨b, he, hap, hpb⟩ => ⟨b, List.mem_cons_of_mem _ he, hap, hpb⟩)

end OrderedList
-- The order is exactly the coordinate comparison used by comparePoints.
instance pointLinearOrder : LinearOrder Point where
  le := lexLE
  le_refl := lexLE_refl
  le_trans := fun _ _ _ => lexLE_trans
  le_antisymm := lexLE_antisymm
  le_total := lexLE_total
  toDecidableLE := fun a b => inferInstanceAs (Decidable (lexLE a b))

def sortedCuts {n : Nat} (segments : Fin n → InputSegment) (k : Fin n) : List Point :=
  (computedCuts segments k).sort (· ≤ ·)

def sourceEdges {n : Nat} (segments : Fin n → InputSegment) (k : Fin n) : List (Point × Point) :=
  consecutiveEdges (sortedCuts segments k)

theorem sourceEdges_iff_adjacent {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (a b : Point) :
    (a, b) ∈ sourceEdges segments k ↔ adjacent (computedCuts segments k) a b := by
  unfold sourceEdges sortedCuts
  rw [consecutiveEdges_iff _ (Finset.sort_sorted_lt _)]
  simp only [ListAdjacent, Finset.mem_sort, adjacent, interior]

theorem onSegment_subsegment (s e a b p : Point)
    (ha : onSegment a s e) (hb : onSegment b s e) (hp : onSegment p a b) :
    onSegment p s e := by
  obtain ⟨t, ht, rfl⟩ := ha
  obtain ⟨u, hu, rfl⟩ := hb
  obtain ⟨v, hv, rfl⟩ := hp
  have hbetween := scalar_lerp_between t u v hv
  have h0 : 0 ≤ min t u := le_min ht.1 hu.1
  have h1 : max t u ≤ 1 := max_le ht.2 hu.2
  refine ⟨t + v * (u - t), ⟨le_trans h0 hbetween.1, le_trans hbetween.2 h1⟩, ?_⟩
  ext <;> dsimp [lerp] <;> ring

theorem sourceEdge_sound {n : Nat} (segments : Fin n → InputSegment) (k : Fin n)
    (a b p : Point) (he : (a, b) ∈ sourceEdges segments k) (hp : onSegment p a b) :
    onSegment p (segments k).start (segments k).finish := by
  have h := (sourceEdges_iff_adjacent segments k a b).mp he
  exact onSegment_subsegment _ _ a b p
    (computedCuts_sound segments k a h.1) (computedCuts_sound segments k b h.2.1) hp

theorem sourceEdge_no_interior_global_vertex {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (a b p : Point) (he : (a, b) ∈ sourceEdges segments k)
    (hv : GlobalVertex segments p) (hp : onSegment p a b) : p = a ∨ p = b := by
  have h := (sourceEdges_iff_adjacent segments k a b).mp he
  have hps := sourceEdge_sound segments k a b p he hp
  have hcut := global_vertex_recorded_on_segment segments k p hv hps
  have hbounds := (ordered_point_membership p a b).mpr hp
  have hab : lexLE a b := le_of_lt h.2.2.1
  have hbounds' : a ≤ p ∧ p ≤ b := by
    simpa only [orderedStart, orderedEnd, if_pos hab] using hbounds.2
  by_cases hpa : p = a
  · exact Or.inl hpa
  · by_cases hpb : p = b
    · exact Or.inr hpb
    · have hap : a < p := lt_of_le_of_ne hbounds'.1 (Ne.symm hpa)
      have hpb' : p < b := lt_of_le_of_ne hbounds'.2 hpb
      exact False.elim (h.2.2.2 p hcut ⟨hap, hpb'⟩)

theorem sourceEdges_cover_segment {n : Nat} (segments : Fin n → InputSegment) (k : Fin n)
    (p : Point) (hp : onSegment p (segments k).start (segments k).finish) :
    p ∈ computedCuts segments k ∨
      ∃ a b, (a, b) ∈ sourceEdges segments k ∧ onSegment p a b := by
  have hstart : (segments k).start ∈ computedCuts segments k :=
    (computedCuts_membership segments k _).mpr (Or.inl rfl)
  have hend : (segments k).finish ∈ computedCuts segments k :=
    (computedCuts_membership segments k _).mpr (Or.inr (Or.inl rfl))
  by_cases hse : (segments k).start = (segments k).finish
  · left
    have hpp := hp
    rw [hse] at hpp
    have heq := (degenerate_iff p (segments k).finish).mp hpp
    rw [heq]
    exact hend
  · have hlo := orderedStart_property (fun q => q ∈ computedCuts segments k) _ _ hstart hend
    have hhi := orderedEnd_property (fun q => q ∈ computedCuts segments k) _ _ hstart hend
    have hbounds := ((ordered_point_membership p _ _).mpr hp).2
    have hlow : ∃ l ∈ sortedCuts segments k, l ≤ p := by
      refine ⟨orderedStart (segments k).start (segments k).finish, ?_, hbounds.1⟩
      simpa only [sortedCuts, Finset.mem_sort] using hlo
    have hhigh : ∃ u ∈ sortedCuts segments k, p ≤ u := by
      refine ⟨orderedEnd (segments k).start (segments k).finish, ?_, hbounds.2⟩
      simpa only [sortedCuts, Finset.mem_sort] using hhi
    have hcover := consecutiveEdges_cover (sortedCuts segments k)
      (Finset.sort_sorted_lt _) p hlow hhigh
    rcases hcover with hp' | ⟨a, b, he, hap, hpb⟩
    · left
      simpa only [sortedCuts, Finset.mem_sort] using hp'
    · right
      refine ⟨a, b, he, ?_⟩
      have hadj := (sourceEdges_iff_adjacent segments k a b).mp he
      have ha := (containsPoint_iff_onSegment a _ _).mpr (computedCuts_sound segments k a hadj.1)
      have hb := (containsPoint_iff_onSegment b _ _).mpr (computedCuts_sound segments k b hadj.2.1)
      have hpc := ((containsPoint_iff_onSegment p _ _).mpr hp).1
      apply collinear_lex_bounds_onSegment p a b _ hap hpb
      exact collinear_triple _ _ a b p hse ha.1 hb.1 hpc

-- An emitted geometric edge is emitted by exactly every input that covers it.
theorem sourceEdge_provenance_complete {n : Nat} (segments : Fin n → InputSegment)
    (k l : Fin n) (a b : Point) (he : (a, b) ∈ sourceEdges segments k) :
    (a, b) ∈ sourceEdges segments l ↔
      onSegment a (segments l).start (segments l).finish ∧
      onSegment b (segments l).start (segments l).finish := by
  have hk := (sourceEdges_iff_adjacent segments k a b).mp he
  constructor
  · intro hl
    have h := (sourceEdges_iff_adjacent segments l a b).mp hl
    exact ⟨computedCuts_sound segments l a h.1, computedCuts_sound segments l b h.2.1⟩
  · rintro ⟨ha, hb⟩
    apply (sourceEdges_iff_adjacent segments l a b).mpr
    have hacut := global_vertex_recorded_on_segment segments l a ⟨k, hk.1⟩ ha
    have hbcut := global_vertex_recorded_on_segment segments l b ⟨k, hk.2.1⟩ hb
    refine ⟨hacut, hbcut, hk.2.2.1, ?_⟩
    intro p hpcut hint
    have hse : (segments l).start ≠ (segments l).finish := by
      intro h
      rw [h] at ha hb
      have hab : a = b := ((degenerate_iff a _).mp ha).trans ((degenerate_iff b _).mp hb).symm
      exact (ne_of_lt hk.2.2.1) hab
    have hap := ((containsPoint_iff_onSegment a _ _).mpr ha).1
    have hbp := ((containsPoint_iff_onSegment b _ _).mpr hb).1
    have hpp := ((containsPoint_iff_onSegment p _ _).mpr (computedCuts_sound segments l p hpcut)).1
    have hp : onSegment p a b := collinear_lex_bounds_onSegment p a b
      (collinear_triple _ _ a b p hse hap hbp hpp) (le_of_lt hint.1) (le_of_lt hint.2)
    rcases sourceEdge_no_interior_global_vertex segments k a b p he ⟨l, hpcut⟩ hp with hpa | hpb
    · rw [hpa] at hint
      exact lt_irrefl _ hint.1
    · rw [hpb] at hint
      exact lt_irrefl _ hint.2

end Cadloom
