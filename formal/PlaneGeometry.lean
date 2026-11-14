import PrismVolume

namespace Cadloom

def spaceDelta (a b : SpacePoint) : SpacePoint := ⟨b.x-a.x,b.y-a.y,b.z-a.z⟩
def spaceCross (a b : SpacePoint) : SpacePoint :=
  ⟨a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x⟩
def spaceDot (a b : SpacePoint) : ℚ := a.x*b.x+a.y*b.y+a.z*b.z
def spaceLerp (a b : SpacePoint) (t : ℚ) : SpacePoint :=
  ⟨a.x+t*(b.x-a.x),a.y+t*(b.y-a.y),a.z+t*(b.z-a.z)⟩

structure PlaneEquation3 where
  normal : SpacePoint
  offset : ℚ

def planeValue (plane : PlaneEquation3) (p : SpacePoint) : ℚ :=
  spaceDot plane.normal p + plane.offset

def throughPlane (a b c : SpacePoint) : PlaneEquation3 :=
  let normal := spaceCross (spaceDelta a b) (spaceDelta a c)
  ⟨normal,-spaceDot normal a⟩

def orientationValue3 (a b c d : SpacePoint) : ℚ :=
  spaceDot (spaceCross (spaceDelta a b) (spaceDelta a c)) (spaceDelta a d)

theorem plane_lerp_value (plane : PlaneEquation3) (a b : SpacePoint) (t : ℚ) :
    planeValue plane (spaceLerp a b t) =
      (1-t)*planeValue plane a+t*planeValue plane b := by
  dsimp [planeValue, spaceLerp, spaceDot]
  ring

theorem plane_through_orientation (a b c d : SpacePoint) :
    planeValue (throughPlane a b c) d = orientationValue3 a b c d := by
  dsimp [planeValue, throughPlane, orientationValue3, spaceDot, spaceCross, spaceDelta]
  ring

theorem plane_through_endpoints (a b c : SpacePoint) :
    planeValue (throughPlane a b c) a = 0 ∧
    planeValue (throughPlane a b c) b = 0 ∧
    planeValue (throughPlane a b c) c = 0 := by
  dsimp [planeValue, throughPlane, spaceDot, spaceCross, spaceDelta]
  constructor
  · ring
  constructor <;> ring

theorem plane_zero_parameter_iff (plane : PlaneEquation3) (a b : SpacePoint) (t : ℚ)
    (h : planeValue plane a-planeValue plane b ≠ 0) :
    planeValue plane (spaceLerp a b t) = 0 ↔
      t = planeValue plane a/(planeValue plane a-planeValue plane b) := by
  rw [plane_lerp_value]
  constructor
  · intro hz
    apply (eq_div_iff h).mpr
    nlinarith
  · intro ht
    rw [ht]
    field_simp
    ring

private theorem positive_denominator_parameter_bounds (u v : ℚ) (h : 0 < u-v) :
    (0 ≤ u/(u-v) ∧ u/(u-v) ≤ 1) ↔ u*v ≤ 0 := by
  rw [le_div_iff₀ h, div_le_iff₀ h]
  simp only [zero_mul, one_mul]
  constructor
  · rintro ⟨hu,hv⟩
    exact mul_nonpos_of_nonneg_of_nonpos hu (by linarith)
  · intro hprod
    by_cases hu : 0 ≤ u
    · refine ⟨hu, ?_⟩
      by_contra hh
      have hv : 0 < v := by linarith
      have hupos : 0 < u := by linarith
      have hp := mul_pos hupos hv
      linarith
    · have huneg : u < 0 := lt_of_not_ge hu
      have hvneg : v < 0 := by linarith
      have hp := mul_pos_of_neg_of_neg huneg hvneg
      linarith

theorem plane_parameter_unit_iff (u v : ℚ) (h : u-v ≠ 0) :
    (0 ≤ u/(u-v) ∧ u/(u-v) ≤ 1) ↔ u*v ≤ 0 := by
  by_cases hpos : 0 < u-v
  · exact positive_denominator_parameter_bounds u v hpos
  · have hreverse : 0 < v-u := by
      have hh : u-v < 0 := lt_of_le_of_ne (le_of_not_gt hpos) h
      linarith
    have heq : u/(u-v) = 1-v/(v-u) := by
      have hv : v-u ≠ 0 := ne_of_gt hreverse
      field_simp
      ring
    have hb := positive_denominator_parameter_bounds v u hreverse
    constructor
    · rintro ⟨h0,h1⟩
      have ht : 0 ≤ v/(v-u) ∧ v/(v-u) ≤ 1 := by
        constructor <;> linarith [heq]
      simpa [mul_comm] using hb.mp ht
    · intro hp
      have ht := hb.mpr (by simpa [mul_comm] using hp)
      constructor <;> linarith [heq]

theorem plane_constant_on_parallel (plane : PlaneEquation3) (a b : SpacePoint) (t : ℚ)
    (h : planeValue plane a = planeValue plane b) :
    planeValue plane (spaceLerp a b t) = planeValue plane a := by
  rw [plane_lerp_value, ← h]
  ring

theorem plane_segment_meets_iff (plane : PlaneEquation3) (a b : SpacePoint) :
    (∃ t : ℚ, inUnit t ∧ planeValue plane (spaceLerp a b t) = 0) ↔
      planeValue plane a * planeValue plane b ≤ 0 := by
  by_cases h : planeValue plane a-planeValue plane b = 0
  · have heq : planeValue plane a = planeValue plane b := sub_eq_zero.mp h
    constructor
    · rintro ⟨t,_,ht⟩
      rw [plane_constant_on_parallel plane a b t heq] at ht
      simp [ht]
    · intro hp
      have hz : planeValue plane a = 0 := by
        rw [← heq] at hp
        nlinarith [sq_nonneg (planeValue plane a)]
      refine ⟨0, ⟨le_rfl, by norm_num⟩, ?_⟩
      rw [plane_constant_on_parallel plane a b 0 heq, hz]
  · constructor
    · rintro ⟨t,ht,hz⟩
      have heq := (plane_zero_parameter_iff plane a b t h).mp hz
      subst t
      exact (plane_parameter_unit_iff _ _ h).mp ht
    · intro hp
      refine ⟨_, (plane_parameter_unit_iff _ _ h).mpr hp, ?_⟩
      exact (plane_zero_parameter_iff plane a b _ h).mpr rfl

/-- Precomputed edge halfplanes equal the original oriented triangle edge test. -/
theorem cached_edge_halfplane (a b p normal : SpacePoint) :
    spaceDot (spaceCross (spaceDelta a b) (spaceDelta a p)) normal =
      spaceDot (spaceCross normal (spaceDelta a b)) p -
      spaceDot (spaceCross normal (spaceDelta a b)) a := by
  dsimp [spaceDot, spaceCross, spaceDelta]
  ring

/-- Canonical plane rescaling preserves every nonparallel ray intersection parameter. -/
theorem ray_parameter_rescale (value slope scale : ℚ) (hs : slope ≠ 0) (hc : scale ≠ 0) :
    -(value / scale) / (slope / scale) = -value / slope := by
  field_simp

end Cadloom
