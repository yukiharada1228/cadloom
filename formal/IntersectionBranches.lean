import SegmentMembership
import SourceArithmetic

namespace Cadloom

instance (a b : Point) : Decidable (lexLE a b) := by unfold lexLE; infer_instance
instance (t : Rat) : Decidable (inUnit t) := by unfold inUnit; infer_instance

def orderedStart (a b : Point) : Point := if lexLE a b then a else b
def orderedEnd (a b : Point) : Point := if lexLE a b then b else a

def pointOnSegmentModel (p a b : Point) : Prop :=
  cross (delta a b) (delta a p) = 0 ∧
    lexLE (orderedStart a b) p ∧ lexLE p (orderedEnd a b)

instance (p a b : Point) : Decidable (pointOnSegmentModel p a b) := by
  unfold pointOnSegmentModel
  infer_instance

theorem ordered_point_membership (p a b : Point) :
    pointOnSegmentModel p a b ↔ onSegment p a b := by
  rw [← lexContains_iff_onSegment]
  unfold pointOnSegmentModel orderedStart orderedEnd lexContains
  by_cases hab : lexLE a b
  · simp only [if_pos hab]
    constructor
    · rintro ⟨hc, hp⟩; exact ⟨hc, Or.inl hp⟩
    · rintro ⟨hc, hp | hp⟩
      · exact ⟨hc, hp⟩
      · have hpa := lexLE_antisymm a b hab (by
          rcases hp with ⟨hbp, hpa⟩
          rcases hbp with hx | ⟨hx, hy⟩ <;> rcases hpa with hx' | ⟨hx', hy'⟩
          · left; linarith
          · left; linarith
          · left; linarith
          · right; exact ⟨hx.trans hx', le_trans hy hy'⟩)
        subst b
        exact ⟨hc, hp⟩
  · simp only [if_neg hab]
    constructor
    · rintro ⟨hc, hp⟩; exact ⟨hc, Or.inr hp⟩
    · rintro ⟨hc, hp | hp⟩
      · exfalso
        apply hab
        rcases hp with ⟨hap, hpb⟩
        rcases hap with hx | ⟨hx, hy⟩ <;> rcases hpb with hx' | ⟨hx', hy'⟩
        · left; linarith
        · left; linarith
        · left; linarith
        · right; exact ⟨hx.trans hx', le_trans hy hy'⟩
      · exact ⟨hc, hp⟩

inductive IntersectionResult where
  | none
  | point : Point → IntersectionResult
  | overlap : Point → Point → IntersectionResult
  deriving DecidableEq, Repr

def resultContains (result : IntersectionResult) (p : Point) : Prop :=
  match result with
  | .none => False
  | .point q => p = q
  | .overlap a b => onSegment p a b

def IntersectionCorrect (result : IntersectionResult) (a b c d : Point) : Prop :=
  ∀ p, resultContains result p ↔ onSegment p a b ∧ onSegment p c d

-- The first two source branches, before determinant calculation.
def degenerateFirst (a c d : Point) : IntersectionResult :=
  if pointOnSegmentModel a c d then .point a else .none

def degenerateSecond (a b c : Point) : IntersectionResult :=
  if pointOnSegmentModel c a b then .point c else .none

theorem degenerateFirst_correct (a c d : Point) :
    IntersectionCorrect (degenerateFirst a c d) a a c d := by
  intro p
  unfold degenerateFirst
  split_ifs with h
  · simp only [resultContains, degenerate_iff]
    constructor
    · intro hp; subst p; exact ⟨rfl, (ordered_point_membership a c d).mp h⟩
    · exact fun hp => hp.1
  · simp only [resultContains, false_iff, degenerate_iff]
    rintro ⟨rfl, hp⟩
    exact h ((ordered_point_membership _ _ _).mpr hp)

theorem degenerateSecond_correct (a b c : Point) :
    IntersectionCorrect (degenerateSecond a b c) a b c c := by
  intro p
  unfold degenerateSecond
  split_ifs with h
  · simp only [resultContains, degenerate_iff]
    constructor
    · intro hp; subst p; exact ⟨(ordered_point_membership c a b).mp h, rfl⟩
    · exact fun hp => hp.2
  · simp only [resultContains, false_iff, degenerate_iff]
    rintro ⟨hp, rfl⟩
    exact h ((ordered_point_membership _ _ _).mpr hp)

-- Source-extracted arithmetic expressions are used, with the rational unit test.
def nonparallelBranch (a b c d : Point) : IntersectionResult :=
  if inUnit (sourceT a b c d) ∧ inUnit (sourceU a b c d)
  then .point (sourcePoint a b c d) else .none

theorem nonparallelBranch_correct (a b c d : Point)
    (hdet : determinant a b c d ≠ 0) :
    IntersectionCorrect (nonparallelBranch a b c d) a b c d := by
  intro p
  rw [nonparallel_intersection_iff a b c d p hdet]
  unfold nonparallelBranch
  simp only [sourceT_eq, sourceU_eq, sourcePoint_eq]
  split_ifs with h
  · simp only [resultContains]
    exact ⟨fun hp => ⟨h.1, h.2, hp⟩, fun hp => hp.2.2⟩
  · simp only [resultContains, false_iff]
    rintro ⟨ht, hu, _⟩
    exact h ⟨ht, hu⟩

theorem cross_lerp_identity (a b c d : Point) (u : Rat) :
    cross (delta a b) (delta a (lerp c d u)) =
      cross (delta a b) (delta a c) + u * determinant a b c d := by
  dsimp [cross, delta, lerp, determinant]
  ring

theorem parallel_common_implies_collinear (a b c d p : Point)
    (hdet : determinant a b c d = 0)
    (hp : onSegment p a b ∧ onSegment p c d) :
    cross (delta a b) (delta a c) = 0 := by
  have hc := ((containsPoint_iff_onSegment p a b).mpr hp.1).1
  obtain ⟨u, _, hpu⟩ := hp.2
  rw [hpu, cross_lerp_identity, hdet, mul_zero, add_zero] at hc
  exact hc

theorem parallel_noncollinear_correct (a b c d : Point)
    (hdet : determinant a b c d = 0)
    (hcol : cross (delta a b) (delta a c) ≠ 0) :
    IntersectionCorrect .none a b c d := by
  intro p
  simp only [resultContains, false_iff]
  intro hp
  exact hcol (parallel_common_implies_collinear a b c d p hdet hp)

end Cadloom
