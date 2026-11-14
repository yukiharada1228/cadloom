-- Generated from the TypeScript AST. Do not edit by hand.
-- The extractor is a trusted translation tool, NOT a verified JS compiler.
-- Rational methods are interpreted as mathematical rational operations here.
import Cadloom
namespace Cadloom
def sourceDeterminant (a b c d : Point) : ℚ := (((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x)))
def sourceT (a b c d : Point) : ℚ := ((((c.x - a.x) * (d.y - c.y)) - ((c.y - a.y) * (d.x - c.x))) / (((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x))))
def sourceU (a b c d : Point) : ℚ := ((((c.x - a.x) * (b.y - a.y)) - ((c.y - a.y) * (b.x - a.x))) / (((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x))))
def sourcePoint (a b c d : Point) : Point :=
  ⟨(a.x + ((b.x - a.x) * ((((c.x - a.x) * (d.y - c.y)) - ((c.y - a.y) * (d.x - c.x))) / (((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x)))))), (a.y + ((b.y - a.y) * ((((c.x - a.x) * (d.y - c.y)) - ((c.y - a.y) * (d.x - c.x))) / (((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x))))))⟩

theorem sourceDeterminant_eq (a b c d : Point) :
    sourceDeterminant a b c d = determinant a b c d := by rfl
theorem sourceT_eq (a b c d : Point) : sourceT a b c d = parameterT a b c d := by rfl
theorem sourceU_eq (a b c d : Point) : sourceU a b c d = parameterU a b c d := by rfl
theorem sourcePoint_eq (a b c d : Point) :
    sourcePoint a b c d = lerp a b (parameterT a b c d) := by
  ext <;> dsimp [sourcePoint, lerp, parameterT, determinant, cross, delta] <;> ring

theorem sourcePoint_sound (a b c d : Point)
    (h : sourceDeterminant a b c d ≠ 0)
    (ht : inUnit (sourceT a b c d)) (hu : inUnit (sourceU a b c d)) :
    onSegment (sourcePoint a b c d) a b ∧ onSegment (sourcePoint a b c d) c d := by
  apply (nonparallel_intersection_iff a b c d _ h).mpr
  exact ⟨ht, hu, sourcePoint_eq a b c d⟩
end Cadloom
