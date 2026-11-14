import Cadloom

namespace Cadloom

/-- Substituting a rational parametric line into a squared-radius circle. -/
theorem line_circle_polynomial {K : Type*} [CommRing K] (ox oy dx dy cx cy radiusSquared t : K) :
    (ox+t*dx-cx)^2+(oy+t*dy-cy)^2-radiusSquared =
      (dx^2+dy^2)*t^2 +
      2*((ox-cx)*dx+(oy-cy)*dy)*t +
      ((ox-cx)^2+(oy-cy)^2-radiusSquared) := by
  ring

/-- Subtracting circle equations gives their rational radical axis. -/
theorem circle_equation_difference {K : Type*} [CommRing K] (x y ax ay bx byc ra rb : K) :
    ((x-ax)^2+(y-ay)^2-ra)-((x-bx)^2+(y-byc)^2-rb) =
      2*((bx-ax)*x+(byc-ay)*y)-(bx^2+byc^2-ax^2-ay^2+ra-rb) := by
  ring

/-- On the radical axis, the two circle equations have identical zero sets. -/
theorem radical_axis_circle_iff {K : Type*} [CommRing K] (x y ax ay bx byc ra rb : K)
    (h : 2*((bx-ax)*x+(byc-ay)*y)=bx^2+byc^2-ax^2-ay^2+ra-rb) :
    (x-ax)^2+(y-ay)^2-ra=0 ↔ (x-bx)^2+(y-byc)^2-rb=0 := by
  have hd := circle_equation_difference x y ax ay bx byc ra rb
  have he : (x-ax)^2+(y-ay)^2-ra = (x-bx)^2+(y-byc)^2-rb := by
    linear_combination hd + h
  rw [he]

/-- Rational circumcenter offsets solve both squared-distance linear equations. -/
theorem circumcenter_linear_equations (ux uy vx vy : ℚ) (h : ux*vy-uy*vx ≠ 0) :
    let hx := ((ux^2+uy^2)*vy-uy*(vx^2+vy^2))/(2*(ux*vy-uy*vx))
    let hy := (ux*(vx^2+vy^2)-(ux^2+uy^2)*vx)/(2*(ux*vy-uy*vx))
    2*(ux*hx+uy*hy)=ux^2+uy^2 ∧ 2*(vx*hx+vy*hy)=vx^2+vy^2 := by
  dsimp
  generalize hd : ux*vy-uy*vx = determinant at *
  constructor <;> field_simp [h] <;> rw [← hd] <;> ring

/-- On a fixed circle, x and a common closed vertical half determine a unique y. -/
theorem circle_same_x_half_unique {K : Type*} [Field K] [LinearOrder K] [IsStrictOrderedRing K]
    (x y1 y2 cx cy radiusSquared : K)
    (h1 : (x-cx)^2+(y1-cy)^2=radiusSquared)
    (h2 : (x-cx)^2+(y2-cy)^2=radiusSquared)
    (hh : (0 ≤ y1-cy ∧ 0 ≤ y2-cy) ∨ (y1-cy ≤ 0 ∧ y2-cy ≤ 0)) :
    y1=y2 := by
  have hs : (y1-cy)^2=(y2-cy)^2 := by linarith
  rcases (sq_eq_sq_iff_eq_or_eq_neg).mp hs with he | he
  · linarith
  · rcases hh with ⟨ha,hb⟩ | ⟨ha,hb⟩ <;> linarith

/-- A nonvertical rational line can use its x coordinate as an exact parameter. -/
theorem canonical_line_frame {K : Type*} [Field K] (ox oy dx dy t : K) (h : dx ≠ 0) :
    oy-dy*ox/dx+(ox+t*dx)*(dy/dx)=oy+t*dy := by
  field_simp
  ring

/-- Quadratic terms cancel when comparing circle tangents at a shared point. -/
theorem circle_tangent_cross_linear {K : Type*} [CommRing K] (x y ax ay bx bcy : K) :
    (-(y-ay))*(x-bx)-(x-ax)*(-(y-bcy)) =
      (ay-bcy)*x+(bx-ax)*y+ax*bcy-ay*bx := by
  ring

/-- A small circle about the contact fixes the signed normal displacement exactly. -/
theorem circle_germ_normal_offset {K : Type*} [Field K] [CharZero K]
    (s z r rho : K) (hr : r ≠ 0)
    (hc : s^2+(z-r)^2=r^2) (hs : s^2+z^2=rho^2) :
    z=rho^2/(2*r) := by
  apply (eq_div_iff (mul_ne_zero (by norm_num) hr)).mpr
  linear_combination hs-hc

end Cadloom
