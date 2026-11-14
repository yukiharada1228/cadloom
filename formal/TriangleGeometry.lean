import PlaneGeometry

namespace Cadloom

def spaceBarycentric (a b c : SpacePoint) (α β γ : ℚ) : SpacePoint :=
  ⟨α*a.x+β*b.x+γ*c.x,α*a.y+β*b.y+γ*c.y,α*a.z+β*b.z+γ*c.z⟩

theorem triangle_plane_value (plane : PlaneEquation3) (a b c : SpacePoint) (α β γ : ℚ)
    (hs : α+β+γ=1) :
    planeValue plane (spaceBarycentric a b c α β γ) =
      α*planeValue plane a+β*planeValue plane b+γ*planeValue plane c := by
  dsimp [planeValue, spaceDot, spaceBarycentric]
  linear_combination (-plane.offset) * hs

theorem triangle_plane_bounds (plane : PlaneEquation3) (a b c : SpacePoint)
    (α β γ lower upper : ℚ) (hα : 0≤α) (hβ : 0≤β) (hγ : 0≤γ) (hs : α+β+γ=1)
    (ha : lower≤planeValue plane a ∧ planeValue plane a≤upper)
    (hb : lower≤planeValue plane b ∧ planeValue plane b≤upper)
    (hc : lower≤planeValue plane c ∧ planeValue plane c≤upper) :
    lower≤planeValue plane (spaceBarycentric a b c α β γ) ∧
      planeValue plane (spaceBarycentric a b c α β γ)≤upper := by
  rw [triangle_plane_value plane a b c α β γ hs]
  have hla := mul_nonneg hα (sub_nonneg.mpr ha.1)
  have hlb := mul_nonneg hβ (sub_nonneg.mpr hb.1)
  have hlc := mul_nonneg hγ (sub_nonneg.mpr hc.1)
  have hua := mul_nonneg hα (sub_nonneg.mpr ha.2)
  have hub := mul_nonneg hβ (sub_nonneg.mpr hb.2)
  have huc := mul_nonneg hγ (sub_nonneg.mpr hc.2)
  have hl : (α+β+γ)*lower=lower := by rw [hs]; ring
  have hu : (α+β+γ)*upper=upper := by rw [hs]; ring
  constructor <;> nlinarith

def spaceAdd (a b : SpacePoint) : SpacePoint := ⟨a.x+b.x,a.y+b.y,a.z+b.z⟩

private theorem space_ext (a b : SpacePoint) (hx : a.x=b.x) (hy : a.y=b.y) (hz : a.z=b.z) : a=b := by
  cases a; cases b; simp_all

/-- The diagonal fan preserves the oriented area vector of a quadrilateral. -/
theorem triangle_fan_area_vector (a b c d : SpacePoint) :
    spaceAdd (spaceCross (spaceDelta a b) (spaceDelta a c))
      (spaceCross (spaceDelta a c) (spaceDelta a d)) =
    spaceAdd (spaceAdd (spaceCross a b) (spaceCross b c))
      (spaceAdd (spaceCross c d) (spaceCross d a)) := by
  apply space_ext <;> dsimp [spaceAdd, spaceCross, spaceDelta] <;> ring

end Cadloom
