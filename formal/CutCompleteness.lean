import PairLoop

namespace Cadloom

theorem segment_start_extreme (a b x y : Point)
    (hx : onSegment x a b) (hy : onSegment y a b) (ha : onSegment a x y) :
    a = x ∨ a = y := by
  have hbounds := ((lexContains_iff_onSegment a x y).mpr ha).2
  rcases lexLE_total a b with hab | hba
  · have hax : lexLE a x := by
      have h := (ordered_point_membership x a b).mpr hx
      simpa [pointOnSegmentModel, orderedStart, orderedEnd, hab] using h.2.1
    have hay : lexLE a y := by
      have h := (ordered_point_membership y a b).mpr hy
      simpa [pointOnSegmentModel, orderedStart, orderedEnd, hab] using h.2.1
    rcases hbounds with ⟨hxa, _⟩ | ⟨hya, _⟩
    · exact Or.inl (lexLE_antisymm a x hax hxa)
    · exact Or.inr (lexLE_antisymm a y hay hya)
  · have hxa : lexLE x a := by
      obtain ⟨t, ht, rfl⟩ := (onSegment_reverse x a b).mp hx
      exact (lerp_lex_bounds b a hba t ht).2
    have hya : lexLE y a := by
      obtain ⟨t, ht, rfl⟩ := (onSegment_reverse y a b).mp hy
      exact (lerp_lex_bounds b a hba t ht).2
    rcases hbounds with ⟨_, hay⟩ | ⟨_, hax⟩
    · exact Or.inr (lexLE_antisymm a y hay hya)
    · exact Or.inl (lexLE_antisymm a x hax hxa)

theorem resultVertices_endpoint (r : IntersectionResult) (a b c d p : Point)
    (hr : IntersectionCorrect r a b c d)
    (hep : p = a ∨ p = b ∨ p = c ∨ p = d)
    (hp : onSegment p a b ∧ onSegment p c d) : p ∈ resultVertices r := by
  have hpr := (hr p).mpr hp
  cases r with
  | none => exact False.elim hpr
  | point q => simpa only [resultVertices, Finset.mem_singleton] using hpr
  | overlap x y =>
    have hxr := (hr x).mp (by
      exact ⟨0, ⟨le_rfl, by norm_num⟩, (lerp_zero x y).symm⟩)
    have hyr := (hr y).mp (by
      exact ⟨1, ⟨by norm_num, le_rfl⟩, (lerp_one x y).symm⟩)
    simp only [resultVertices, Finset.mem_insert, Finset.mem_singleton]
    rcases hep with rfl | rfl | rfl | rfl
    · exact segment_start_extreme _ _ x y hxr.1 hyr.1 hpr
    · exact segment_start_extreme _ _ x y
        ((onSegment_reverse _ _ _).mp hxr.1) ((onSegment_reverse _ _ _).mp hyr.1) hpr
    · exact segment_start_extreme _ _ x y hxr.2 hyr.2 hpr
    · exact segment_start_extreme _ _ x y
        ((onSegment_reverse _ _ _).mp hxr.2) ((onSegment_reverse _ _ _).mp hyr.2) hpr

theorem resultVertices_nonparallel (r : IntersectionResult) (a b c d p : Point)
    (hr : IntersectionCorrect r a b c d) (hdet : determinant a b c d ≠ 0)
    (hp : onSegment p a b ∧ onSegment p c d) : p ∈ resultVertices r := by
  have hpr := (hr p).mpr hp
  cases r with
  | none => exact False.elim hpr
  | point q => simpa only [resultVertices, Finset.mem_singleton] using hpr
  | overlap x y =>
    have hxr := (hr x).mp (by
      exact ⟨0, ⟨le_rfl, by norm_num⟩, (lerp_zero x y).symm⟩)
    have hpx := ((nonparallel_intersection_iff a b c d p hdet).mp hp).2.2
    have hxx := ((nonparallel_intersection_iff a b c d x hdet).mp hxr).2.2
    simp only [resultVertices, Finset.mem_insert, Finset.mem_singleton]
    exact Or.inl (hpx.trans hxx.symm)

theorem determinant_swap (a b c d : Point) :
    determinant c d a b = -determinant a b c d := by
  dsimp [determinant, cross]
  ring

-- A nonzero direction cannot be parallel to two nonparallel directions.
theorem third_direction_nonparallel (a b c d e f : Point)
    (habcd : determinant a b c d ≠ 0) (hef : e ≠ f) :
    determinant a b e f ≠ 0 ∨ determinant c d e f ≠ 0 := by
  by_contra hn
  push_neg at hn
  obtain ⟨h1, h2⟩ := hn
  have hx : (f.x - e.x) * determinant a b c d = 0 := by
    dsimp [determinant, cross, delta] at *
    linear_combination (d.x - c.x) * h1 - (b.x - a.x) * h2
  have hy : (f.y - e.y) * determinant a b c d = 0 := by
    dsimp [determinant, cross, delta] at *
    linear_combination (d.y - c.y) * h1 - (b.y - a.y) * h2
  have hxx := (mul_eq_zero.mp hx).resolve_right habcd
  have hyy := (mul_eq_zero.mp hy).resolve_right habcd
  exact hef (Point.ext (by linarith) (by linarith))

theorem intersection_vertex_classification (a b c d p : Point)
    (hp : p ∈ resultVertices (intersectModel a b c d)) :
    (p = a ∨ p = b ∨ p = c ∨ p = d) ∨ determinant a b c d ≠ 0 := by
  by_cases hdet : determinant a b c d = 0
  · left
    unfold intersectModel at hp
    by_cases hab : a = b
    · rw [if_pos hab] at hp
      unfold degenerateFirst at hp
      split_ifs at hp with h
      · simp only [resultVertices, Finset.mem_singleton] at hp
        exact Or.inl hp
      · simp [resultVertices] at hp
    · rw [if_neg hab] at hp
      by_cases hcd : c = d
      · rw [if_pos hcd] at hp
        unfold degenerateSecond at hp
        split_ifs at hp with h
        · simp only [resultVertices, Finset.mem_singleton] at hp
          exact Or.inr (Or.inr (Or.inl hp))
        · simp [resultVertices] at hp
      · rw [if_neg hcd, if_pos hdet] at hp
        by_cases hcol : cross (delta a b) (delta a c) ≠ 0
        · rw [if_pos hcol] at hp
          simp [resultVertices] at hp
        · rw [if_neg hcol] at hp
          exact collinear_vertices_endpoints a b c d p hp
  · exact Or.inr hdet

theorem computedCuts_pair_recorded {n : Nat} (segments : Fin n → InputSegment)
    (k i : Fin n) (p : Point) (hki : k ≠ i)
    (hkiVertex : p ∈ pairVertices segments (k, i))
    (hikVertex : p ∈ pairVertices segments (i, k)) : p ∈ computedCuts segments k := by
  apply (computedCuts_membership segments k p).mpr
  right; right
  rcases lt_or_gt_of_ne hki with h | h
  · exact ⟨k, i, h, Or.inl rfl, hkiVertex⟩
  · exact ⟨i, k, h, Or.inr rfl, hikVertex⟩

theorem endpoint_recorded {n : Nat} (segments : Fin n → InputSegment)
    (k i : Fin n) (p : Point)
    (hep : p = (segments i).start ∨ p = (segments i).finish)
    (hpk : onSegment p (segments k).start (segments k).finish) :
    p ∈ computedCuts segments k := by
  by_cases hki : k = i
  · subst i
    apply (computedCuts_membership segments k p).mpr
    rcases hep with hp | hp
    · exact Or.inl hp
    · exact Or.inr (Or.inl hp)
  · have hpi : onSegment p (segments i).start (segments i).finish := by
      rcases hep with hp | hp
      · rw [hp]; exact ⟨0, ⟨le_rfl, by norm_num⟩, (lerp_zero _ _).symm⟩
      · rw [hp]; exact ⟨1, ⟨by norm_num, le_rfl⟩, (lerp_one _ _).symm⟩
    apply computedCuts_pair_recorded segments k i p hki
    · exact resultVertices_endpoint _ _ _ _ _ p (intersectModel_correct _ _ _ _)
        (Or.inr (Or.inr hep)) ⟨hpk, hpi⟩
    · exact resultVertices_endpoint _ _ _ _ _ p (intersectModel_correct _ _ _ _)
        (hep.elim Or.inl (fun h => Or.inr (Or.inl h))) ⟨hpi, hpk⟩

theorem nonparallel_recorded {n : Nat} (segments : Fin n → InputSegment)
    (i k : Fin n) (p : Point)
    (hdet : determinant (segments i).start (segments i).finish
      (segments k).start (segments k).finish ≠ 0)
    (hpi : onSegment p (segments i).start (segments i).finish)
    (hpk : onSegment p (segments k).start (segments k).finish) :
    p ∈ computedCuts segments k := by
  have hki : k ≠ i := by
    intro h
    subst k
    apply hdet
    dsimp [determinant, cross]
    ring
  apply computedCuts_pair_recorded segments k i p hki
  · apply resultVertices_nonparallel _ _ _ _ _ p (intersectModel_correct _ _ _ _) _ ⟨hpk, hpi⟩
    rw [determinant_swap]
    exact neg_ne_zero.mpr hdet
  · exact resultVertices_nonparallel _ _ _ _ _ p (intersectModel_correct _ _ _ _) hdet ⟨hpi, hpk⟩

-- A global vertex is any point accumulated by at least one source segment.
def GlobalVertex {n : Nat} (segments : Fin n → InputSegment) (p : Point) : Prop :=
  ∃ i, p ∈ computedCuts segments i

theorem global_vertex_recorded_on_segment {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (p : Point) (hv : GlobalVertex segments p)
    (hpk : onSegment p (segments k).start (segments k).finish) :
    p ∈ computedCuts segments k := by
  obtain ⟨source, hs⟩ := hv
  rcases (computedCuts_membership segments source p).mp hs with hp | hp | ⟨i, j, _, _, hp⟩
  · exact endpoint_recorded segments k source p (Or.inl hp) hpk
  · exact endpoint_recorded segments k source p (Or.inr hp) hpk
  · have hcommon := resultVertices_sound _ _ _ _ _ p (intersectModel_correct _ _ _ _) hp
    rcases intersection_vertex_classification _ _ _ _ p hp with hep | hdet
    · rcases hep with hi | hi | hj | hj
      · exact endpoint_recorded segments k i p (Or.inl hi) hpk
      · exact endpoint_recorded segments k i p (Or.inr hi) hpk
      · exact endpoint_recorded segments k j p (Or.inl hj) hpk
      · exact endpoint_recorded segments k j p (Or.inr hj) hpk
    · by_cases hk : (segments k).start = (segments k).finish
      · have hpstart : p = (segments k).start := by
          rw [hk] at hpk
          have h := (degenerate_iff p (segments k).finish).mp hpk
          exact h.trans hk.symm
        exact endpoint_recorded segments k k p (Or.inl hpstart) hpk
      · rcases third_direction_nonparallel _ _ _ _ _ _ hdet hk with hik | hjk
        · exact nonparallel_recorded segments i k p hik hcommon.1 hpk
        · exact nonparallel_recorded segments j k p hjk hcommon.2 hpk

theorem computedCuts_complete {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (p : Point) : p ∈ computedCuts segments k ↔
      GlobalVertex segments p ∧ onSegment p (segments k).start (segments k).finish := by
  constructor
  · intro hp
    exact ⟨⟨k, hp⟩, computedCuts_sound segments k p hp⟩
  · rintro ⟨hv, hp⟩
    exact global_vertex_recorded_on_segment segments k p hv hp

end Cadloom
