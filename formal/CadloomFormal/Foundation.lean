/-
Foundation: 3D vectors over `Rat`, the exact model of `src/math/vec.ts`.
The TypeScript code computes in IEEE doubles; these theorems are about the exact algebra
that the floating-point code approximates (see docs/POLICY.md §4).
-/
namespace CadloomFormal

structure V3 where
  x : Rat
  y : Rat
  z : Rat
deriving Repr

namespace V3
def add (a b : V3) : V3 := ⟨a.x + b.x, a.y + b.y, a.z + b.z⟩
def sub (a b : V3) : V3 := ⟨a.x - b.x, a.y - b.y, a.z - b.z⟩
def smul (s : Rat) (a : V3) : V3 := ⟨s * a.x, s * a.y, s * a.z⟩
def dot (a b : V3) : Rat := a.x * b.x + a.y * b.y + a.z * b.z
def cross (a b : V3) : V3 := ⟨a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x⟩
/-- `(1 - t) a + t b`, as `lerp3`. -/
def lerp (a b : V3) (t : Rat) : V3 := ⟨(1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y, (1 - t) * a.z + t * b.z⟩

theorem cross_dot_left (a b : V3) : dot (cross a b) a = 0 := by
  simp only [cross, dot]; grind

theorem cross_dot_right (a b : V3) : dot (cross a b) b = 0 := by
  simp only [cross, dot]; grind

theorem cross_anticomm (a b : V3) : cross a b = smul (-1) (cross b a) := by
  simp only [cross, smul, mk.injEq]; grind

theorem lerp_zero (a b : V3) : lerp a b 0 = a := by
  cases a; simp only [lerp, mk.injEq]; grind

theorem lerp_one (a b : V3) : lerp a b 1 = b := by
  cases b; simp only [lerp, mk.injEq]; grind

/-- An affine combination of a point with itself is that point. -/
theorem lerp_self (a : V3) (t : Rat) : lerp a a t = a := by
  cases a; simp only [lerp, mk.injEq]; grind
end V3

end CadloomFormal
