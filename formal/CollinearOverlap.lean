import IntersectionBranches

namespace Cadloom

theorem lexLE_refl (a : Point) : lexLE a a := Or.inr ⟨rfl, le_rfl⟩

theorem lexLE_trans {a b c : Point} (hab : lexLE a b) (hbc : lexLE b c) : lexLE a c := by
  rcases hab with hx | ⟨hx, hy⟩ <;> rcases hbc with hx' | ⟨hx', hy'⟩
  · left; linarith
  · left; linarith
  · left; linarith
  · right; exact ⟨hx.trans hx', le_trans hy hy'⟩

theorem collinear_triple (a b c d p : Point) (hab : a ≠ b)
    (hc : cross (delta a b) (delta a c) = 0)
    (hd : cross (delta a b) (delta a d) = 0)
    (hp : cross (delta a b) (delta a p) = 0) :
    cross (delta c d) (delta c p) = 0 := by
  have hx : (b.x - a.x) * cross (delta c d) (delta c p) = 0 := by
    dsimp [cross, delta] at *
    linear_combination (d.x - c.x) * hp - (p.x - c.x) * hd + (p.x - d.x) * hc
  have hy : (b.y - a.y) * cross (delta c d) (delta c p) = 0 := by
    dsimp [cross, delta] at *
    linear_combination (d.y - c.y) * hp - (p.y - c.y) * hd + (p.y - d.y) * hc
  by_contra hn
  have hxx := (mul_eq_zero.mp hx).resolve_right hn
  have hyy := (mul_eq_zero.mp hy).resolve_right hn
  exact hab (Point.ext (by linarith) (by linarith))

theorem shared_line_iff (a b c d p : Point) (hab : a ≠ b) (hcd : c ≠ d)
    (hc : cross (delta a b) (delta a c) = 0)
    (hd : cross (delta a b) (delta a d) = 0) :
    cross (delta a b) (delta a p) = 0 ↔ cross (delta c d) (delta c p) = 0 := by
  constructor
  · exact collinear_triple a b c d p hab hc hd
  · intro hp
    have haa : cross (delta a b) (delta a a) = 0 := by simp [delta, cross]
    have hbb : cross (delta a b) (delta a b) = 0  := by dsimp [cross]; ring
    exact collinear_triple c d a b p hcd
      (collinear_triple a b c d a hab hc hd haa)
      (collinear_triple a b c d b hab hc hd hbb) hp

theorem ordered_members (a b : Point) :
    (orderedStart a b = a ∨ orderedStart a b = b) ∧
    (orderedEnd a b = a ∨ orderedEnd a b = b) := by
  unfold orderedStart orderedEnd
  split_ifs <;> simp

theorem lexLE_ordered (a b : Point) : lexLE (orderedStart a b) (orderedEnd a b) := by
  unfold orderedStart orderedEnd
  split_ifs with h
  · exact h
  · exact (lexLE_total a b).resolve_left h

-- Lower bound = maximum of the two lower endpoints; upper bound = minimum.
def overlapLow (a b c d : Point) : Point := orderedEnd (orderedStart a b) (orderedStart c d)
def overlapHigh (a b c d : Point) : Point := orderedStart (orderedEnd a b) (orderedEnd c d)

theorem lexLE_max_iff (a b p : Point) :
    lexLE (orderedEnd a b) p ↔ lexLE a p ∧ lexLE b p := by
  unfold orderedEnd
  split_ifs with hab
  · exact ⟨fun h => ⟨lexLE_trans hab h, h⟩, fun h => h.2⟩
  · have hba := (lexLE_total a b).resolve_left hab
    exact ⟨fun h => ⟨h, lexLE_trans hba h⟩, fun h => h.1⟩

theorem lexLE_min_iff (a b p : Point) :
    lexLE p (orderedStart a b) ↔ lexLE p a ∧ lexLE p b := by
  unfold orderedStart
  split_ifs with hab
  · exact ⟨fun h => ⟨h, lexLE_trans h hab⟩, fun h => h.1⟩
  · have hba := (lexLE_total a b).resolve_left hab
    exact ⟨fun h => ⟨lexLE_trans h hba, h⟩, fun h => h.2⟩

theorem overlap_bounds_iff (a b c d p : Point) :
    (lexLE (overlapLow a b c d) p ∧ lexLE p (overlapHigh a b c d)) ↔
    ((lexLE (orderedStart a b) p ∧ lexLE p (orderedEnd a b)) ∧
     (lexLE (orderedStart c d) p ∧ lexLE p (orderedEnd c d))) := by
  unfold overlapLow overlapHigh
  rw [lexLE_max_iff, lexLE_min_iff]
  tauto

def collinearBranch (a b c d : Point) : IntersectionResult :=
  let lo := overlapLow a b c d
  let hi := overlapHigh a b c d
  if ¬ lexLE lo hi then .none else
  if lo = hi then .point lo else .overlap lo hi

theorem orderedStart_property (P : Point → Prop) (a b : Point) (ha : P a) (hb : P b) :
    P (orderedStart a b) := by
  rcases (ordered_members a b).1 with h | h
  · rw [h]; exact ha
  · rw [h]; exact hb

theorem orderedEnd_property (P : Point → Prop) (a b : Point) (ha : P a) (hb : P b) :
    P (orderedEnd a b) := by
  rcases (ordered_members a b).2 with h | h
  · rw [h]; exact ha
  · rw [h]; exact hb

theorem collinearBranch_correct (a b c d : Point) (hab : a ≠ b) (hcd : c ≠ d)
    (hdet : determinant a b c d = 0)
    (hc : cross (delta a b) (delta a c) = 0) :
    IntersectionCorrect (collinearBranch a b c d) a b c d := by
  have hd : cross (delta a b) (delta a d) = 0 := by
    dsimp [cross, delta, determinant] at *
    linear_combination hc + hdet
  let line := fun p => cross (delta a b) (delta a p) = 0
  have ha : line a := by simp [line, cross, delta]
  have hb : line b := by dsimp [line, cross]; ring
  have hlo : line (overlapLow a b c d) :=
    orderedEnd_property line _ _
      (orderedStart_property line a b ha hb) (orderedStart_property line c d hc hd)
  have hhi : line (overlapHigh a b c d) :=
    orderedStart_property line _ _
      (orderedEnd_property line a b ha hb) (orderedEnd_property line c d hc hd)
  have hcommon (p : Point) :
      (onSegment p a b ∧ onSegment p c d) ↔
      (line p ∧ lexLE (overlapLow a b c d) p ∧ lexLE p (overlapHigh a b c d)) := by
    rw [← ordered_point_membership p a b, ← ordered_point_membership p c d]
    unfold pointOnSegmentModel
    rw [← shared_line_iff a b c d p hab hcd hc hd]
    rw [← and_assoc, overlap_bounds_iff]
    dsimp [line]
    tauto
  intro p
  rw [hcommon]
  unfold collinearBranch
  by_cases horder : lexLE (overlapLow a b c d) (overlapHigh a b c d)
  · rw [if_neg (not_not.mpr horder)]
    by_cases heq : overlapLow a b c d = overlapHigh a b c d
    · rw [if_pos heq]
      change p = overlapLow a b c d ↔ _
      constructor
      · intro hp; subst p
        exact ⟨hlo, lexLE_refl _, heq ▸ lexLE_refl _⟩
      · rintro ⟨_, hlow, hhigh⟩
        rw [← heq] at hhigh
        exact lexLE_antisymm _ _ hhigh hlow
    · rw [if_neg heq]
      change onSegment p (overlapLow a b c d) (overlapHigh a b c d) ↔ _
      rw [← ordered_point_membership]
      unfold pointOnSegmentModel orderedStart orderedEnd
      rw [if_pos horder, if_pos horder]
      exact and_congr_left (fun _ => (shared_line_iff a b _ _ p hab heq hlo hhi).symm)
  · rw [if_pos horder]
    change False ↔ _
    constructor
    · exact False.elim
    · rintro ⟨_, hlow, hhigh⟩
      exact horder (lexLE_trans hlow hhigh)

-- Same branch order as intersectSegments in the TypeScript source.
def intersectModel (a b c d : Point) : IntersectionResult :=
  if a = b then degenerateFirst a c d else
  if c = d then degenerateSecond a b c else
  if determinant a b c d = 0 then
    if cross (delta a b) (delta a c) ≠ 0 then .none else collinearBranch a b c d
  else nonparallelBranch a b c d

theorem intersectModel_correct (a b c d : Point) :
    IntersectionCorrect (intersectModel a b c d) a b c d := by
  unfold intersectModel
  by_cases hab : a = b
  · rw [if_pos hab]
    subst b
    exact degenerateFirst_correct a c d
  · rw [if_neg hab]
    by_cases hcd : c = d
    · rw [if_pos hcd]
      subst d
      exact degenerateSecond_correct a b c
    · rw [if_neg hcd]
      by_cases hdet : determinant a b c d = 0
      · rw [if_pos hdet]
        by_cases hcol : cross (delta a b) (delta a c) = 0
        · rw [if_neg (not_not.mpr hcol)]
          exact collinearBranch_correct a b c d hab hcd hdet hcol
        · rw [if_pos hcol]
          exact parallel_noncollinear_correct a b c d hdet hcol
      · rw [if_neg hdet]
        exact nonparallelBranch_correct a b c d hdet

end Cadloom
