import Cadloom

namespace Cadloom

/-- Recover the omitted coordinate from two retained coordinates of a plane. -/
def liftPlaneCoordinate (u v a b c d : ℚ) : ℚ := -(a*u+b*v+d)/c

theorem plane_lift_satisfies (u v a b c d : ℚ) (hc : c ≠ 0) :
    a*u+b*v+c*liftPlaneCoordinate u v a b c d+d=0 := by
  unfold liftPlaneCoordinate
  field_simp
  ring

theorem plane_lift_unique (u v w a b c d : ℚ) (hc : c ≠ 0)
    (hplane : a*u+b*v+c*w+d=0) : w=liftPlaneCoordinate u v a b c d := by
  unfold liftPlaneCoordinate
  apply (eq_div_iff hc).mpr
  linear_combination hplane

end Cadloom
