import Cadloom

namespace Cadloom

/-- Midpoint plus a positive multiple of the left normal. -/
def leftSamplePoint (a b : Point) (t : ℚ) : Point :=
  ⟨(a.x + b.x) / 2 - t * (b.y - a.y),
   (a.y + b.y) / 2 + t * (b.x - a.x)⟩

theorem leftSample_cross (a b : Point) (t : ℚ) :
    cross (delta a b) (delta a (leftSamplePoint a b t)) =
      t * ((b.x - a.x)^2 + (b.y - a.y)^2) := by
  dsimp [cross, delta, leftSamplePoint]
  ring

theorem leftSample_strictly_left (a b : Point) (t : ℚ)
    (hne : a ≠ b) (ht : 0 < t) :
    0 < cross (delta a b) (delta a (leftSamplePoint a b t)) := by
  rw [leftSample_cross]
  apply mul_pos ht
  have hx := sq_nonneg (b.x - a.x)
  have hy := sq_nonneg (b.y - a.y)
  by_contra h
  have hsum : (b.x - a.x)^2 + (b.y - a.y)^2 = 0 := by linarith
  have hxx : b.x - a.x = 0 := by nlinarith
  have hyy : b.y - a.y = 0 := by nlinarith
  apply hne
  ext <;> linarith

/-- A positive hit at t shortens the step to min(step, t/2). -/
def shortenStep (step t : ℚ) : ℚ := min step (t / 2)

theorem shortenStep_positive (step t : ℚ) (hs : 0 < step) (ht : 0 < t) :
    0 < shortenStep step t := by
  exact lt_min hs (by linarith)

theorem shortenStep_before_hit (step t : ℚ) (ht : 0 < t) :
    shortenStep step t < t := by
  have h : shortenStep step t ≤ t / 2 := min_le_right _ _
  linarith

theorem shortenStep_preserves_bound (step t bound : ℚ) (hs : step < bound) :
    shortenStep step t < bound := by
  exact lt_of_le_of_lt (min_le_left _ _) hs

end Cadloom
