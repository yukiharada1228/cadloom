import Cadloom

namespace Cadloom

structure AffineMap2 where
  a : ℚ
  b : ℚ
  c : ℚ
  d : ℚ
  tx : ℚ
  ty : ℚ

def affineApply (m : AffineMap2) (p : Point) : Point :=
  ⟨m.a*p.x + m.b*p.y + m.tx, m.c*p.x + m.d*p.y + m.ty⟩
def affineDet (m : AffineMap2) : ℚ := m.a*m.d - m.b*m.c

def affineInverse (m : AffineMap2) : AffineMap2 :=
  ⟨m.d/affineDet m, -m.b/affineDet m, -m.c/affineDet m, m.a/affineDet m,
   (m.b*m.ty-m.d*m.tx)/affineDet m, (m.c*m.tx-m.a*m.ty)/affineDet m⟩

theorem affine_cross_scaled (m : AffineMap2) (a b c : Point) :
    cross (delta (affineApply m a) (affineApply m b))
      (delta (affineApply m a) (affineApply m c)) =
    affineDet m * cross (delta a b) (delta a c) := by
  dsimp [affineApply, affineDet, cross, delta]
  ring

theorem affine_lerp (m : AffineMap2) (a b : Point) (t : ℚ) :
    affineApply m (lerp a b t) = lerp (affineApply m a) (affineApply m b) t := by
  ext <;> dsimp [affineApply, lerp] <;> ring

theorem affine_inverse_left (m : AffineMap2) (p : Point) (h : affineDet m ≠ 0) :
    affineApply (affineInverse m) (affineApply m p) = p := by
  ext <;> dsimp [affineApply, affineInverse] <;> field_simp <;>
    dsimp [affineDet] at * <;> nlinarith

theorem affine_segment_iff (m : AffineMap2) (p a b : Point) (h : affineDet m ≠ 0) :
    onSegment (affineApply m p) (affineApply m a) (affineApply m b) ↔ onSegment p a b := by
  constructor
  · rintro ⟨t, ht, hp⟩
    refine ⟨t, ht, ?_⟩
    have hh := congrArg (affineApply (affineInverse m)) hp
    rw [← affine_lerp, affine_inverse_left m p h, affine_inverse_left m (lerp a b t) h] at hh
    exact hh
  · rintro ⟨t, ht, rfl⟩
    exact ⟨t, ht, affine_lerp m a b t⟩

end Cadloom
