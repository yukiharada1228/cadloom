import Mathlib.Data.Rat.Lemmas
import Mathlib.Data.Finset.Sort
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Ring
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.LinearCombination

/-!
Machine-checked mathematical lemmas. No theorem here asserts a verified
ECMAScript interpreter or equivalence to the handwritten TypeScript program.
-/
namespace Cadloom

def gcdLoop (a b : ℕ) : ℕ :=
  if b = 0 then a else gcdLoop b (a % b)
termination_by b
decreasing_by
  apply Nat.mod_lt
  omega

theorem gcdLoop_correct (a b : ℕ) : gcdLoop a b = Nat.gcd a b := by
  rw [gcdLoop]
  split
  · rename_i h
    subst b
    simp
  · rename_i h
    rw [gcdLoop_correct b (a % b)]
    rw [Nat.gcd_comm b (a % b), ← Nat.gcd_rec b a, Nat.gcd_comm b a]
termination_by b
decreasing_by
  apply Nat.mod_lt
  omega

theorem fraction_add (a b c d : ℚ) (hb : b ≠ 0) (hd : d ≠ 0) :
    (a * d + c * b) / (b * d) = a / b + c / d := by
  field_simp

theorem fraction_sub (a b c d : ℚ) (hb : b ≠ 0) (hd : d ≠ 0) :
    (a * d - c * b) / (b * d) = a / b - c / d := by
  field_simp

theorem fraction_mul (a b c d : ℚ) :
    (a * c) / (b * d) = (a / b) * (c / d) := by
  exact mul_div_mul_comm a c b d

theorem fraction_div (a b c d : ℚ) :
    (a * d) / (b * c) = (a / b) / (c / d) := by
  simp only [div_eq_mul_inv, mul_inv_rev, inv_inv]
  ring

theorem normalize_preserves_value (n d g sign : ℚ) (hg : g ≠ 0) (hs : sign ≠ 0) :
    ((n / g) * sign) / ((d / g) * sign) = n / d := by
  field_simp

@[ext] structure Point where
  x : ℚ
  y : ℚ
  deriving DecidableEq, Repr

def delta (a b : Point) : Point := ⟨b.x - a.x, b.y - a.y⟩
def cross (a b : Point) : ℚ := a.x * b.y - a.y * b.x
def lerp (a b : Point) (t : ℚ) : Point :=
  ⟨a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)⟩
def inUnit (t : ℚ) : Prop := 0 ≤ t ∧ t ≤ 1
def onSegment (p a b : Point) : Prop := ∃ t, inUnit t ∧ p = lerp a b t
def determinant (a b c d : Point) : ℚ := cross (delta a b) (delta c d)
def parameterT (a b c d : Point) : ℚ :=
  cross (delta a c) (delta c d) / determinant a b c d
def parameterU (a b c d : Point) : ℚ :=
  cross (delta a c) (delta a b) / determinant a b c d

theorem lerp_zero (a b : Point) : lerp a b 0 = a := by
  ext <;> simp [lerp]

theorem lerp_one (a b : Point) : lerp a b 1 = b := by
  ext <;> simp [lerp]

theorem lerp_degenerate (a : Point) (t : ℚ) : lerp a a t = a := by
  ext <;> simp [lerp]

theorem degenerate_iff (p a : Point) : onSegment p a a ↔ p = a := by
  constructor
  · rintro ⟨t, _, hp⟩
    simpa [lerp_degenerate] using hp
  · intro hp
    exact ⟨0, ⟨le_rfl, by norm_num⟩, by simpa [hp] using (lerp_zero a a).symm⟩

theorem intersection_parameters_meet (a b c d : Point)
    (h : determinant a b c d ≠ 0) :
    lerp a b (parameterT a b c d) = lerp c d (parameterU a b c d) := by
  apply Point.ext
  · dsimp [lerp, parameterT, parameterU]
    field_simp
    dsimp [determinant, cross, delta] at *
    ring
  · dsimp [lerp, parameterT, parameterU]
    field_simp
    dsimp [determinant, cross, delta] at *
    ring

theorem meeting_parameters_unique (a b c d : Point) (t u : ℚ)
    (h : determinant a b c d ≠ 0) (heq : lerp a b t = lerp c d u) :
    t = parameterT a b c d ∧ u = parameterU a b c d := by
  have hx := congrArg Point.x heq
  have hy := congrArg Point.y heq
  dsimp [lerp] at hx hy
  constructor
  · unfold parameterT
    apply (eq_div_iff h).2
    dsimp [determinant, cross, delta]
    linear_combination (d.y - c.y) * hx - (d.x - c.x) * hy
  · unfold parameterU
    apply (eq_div_iff h).2
    dsimp [determinant, cross, delta]
    linear_combination (b.y - a.y) * hx - (b.x - a.x) * hy

theorem nonparallel_intersection_iff (a b c d p : Point)
    (h : determinant a b c d ≠ 0) :
    (onSegment p a b ∧ onSegment p c d) ↔
      (inUnit (parameterT a b c d) ∧ inUnit (parameterU a b c d) ∧
        p = lerp a b (parameterT a b c d)) := by
  constructor
  · rintro ⟨⟨t, ht, hp⟩, ⟨u, hu, hq⟩⟩
    have heq : lerp a b t = lerp c d u := hp.symm.trans hq
    obtain ⟨rfl, rfl⟩ := meeting_parameters_unique a b c d t u h heq
    exact ⟨ht, hu, hp⟩
  · rintro ⟨ht, hu, hp⟩
    exact ⟨⟨_, ht, hp⟩, ⟨_, hu, hp.trans (intersection_parameters_meet a b c d h)⟩⟩

theorem parameter_bound_iff (n d : ℚ) (hd : 0 < d) :
    inUnit (n / d) ↔ 0 ≤ n ∧ n ≤ d := by
  have he : n / d * d = n := div_mul_cancel₀ n (ne_of_gt hd)
  unfold inUnit
  constructor <;> rintro ⟨h0, h1⟩ <;> constructor <;> nlinarith

/- Interval noding abstraction. Geometry-to-order correspondence is a separate
   obligation; these theorems do not assume their own conclusion. -/
section Ordered
variable {α : Type*} [LinearOrder α]

def inside (l h p : α) : Prop := l ≤ p ∧ p ≤ h
def interior (l h p : α) : Prop := l < p ∧ p < h
def adjacent (v : Finset α) (a b : α) : Prop :=
  a ∈ v ∧ b ∈ v ∧ a < b ∧ ∀ p ∈ v, ¬ interior a b p

theorem interval_intersection (a b c d p : α) :
    (inside a b p ∧ inside c d p) ↔ inside (max a c) (min b d) p := by
  simp only [inside, max_le_iff, le_min_iff]
  tauto

theorem adjacent_no_interior_vertex (v : Finset α) (a b : α)
    (h : adjacent v a b) (p : α) (hp : p ∈ v) : ¬ interior a b p :=
  h.2.2.2 p hp

theorem adjacent_intersection_endpoints (v : Finset α) (a b c d p : α)
    (hab : adjacent v a b) (hcd : adjacent v c d)
    (hne : a ≠ c ∨ b ≠ d) (hp : inside a b p ∧ inside c d p) :
    (p = a ∨ p = b) ∧ (p = c ∨ p = d) := by
  have ha := hab.1
  have hb := hab.2.1
  have hc := hcd.1
  have hd := hcd.2.1
  have nab := hab.2.2.2
  have ncd := hcd.2.2.2
  obtain ⟨⟨hap, hpb⟩, ⟨hcp, hpd⟩⟩ := hp
  have ac : a ≤ c ∨ c ≤ a := le_total a c
  have bd : b ≤ d ∨ d ≤ b := le_total b d
  unfold interior at nab ncd
  constructor <;> by_contra hn
  · push_neg at hn
    have hap' : a < p := lt_of_le_of_ne hap (Ne.symm hn.1)
    have hpb' : p < b := lt_of_le_of_ne hpb hn.2
    have ca : c ≤ a := by
      by_contra hca
      exact nab c hc ⟨lt_of_not_ge hca, lt_of_le_of_lt hcp hpb'⟩
    have bd' : b ≤ d := by
      by_contra hbd
      exact nab d hd ⟨lt_of_lt_of_le hap' hpd, lt_of_not_ge hbd⟩
    have ca' : c = a := by
      by_contra hca
      exact ncd a ha ⟨lt_of_le_of_ne ca hca, lt_of_lt_of_le hap' hpd⟩
    have bd'' : b = d := by
      by_contra hbd
      exact ncd b hb ⟨lt_of_le_of_lt ca hab.2.2.1, lt_of_le_of_ne bd' hbd⟩
    exact hne.elim (fun h => h ca'.symm) (fun h => h bd'')
  · push_neg at hn
    have hcp' : c < p := lt_of_le_of_ne hcp (Ne.symm hn.1)
    have hpd' : p < d := lt_of_le_of_ne hpd hn.2
    have ac' : a ≤ c := by
      by_contra hac
      exact ncd a ha ⟨lt_of_not_ge hac, lt_of_le_of_lt hap hpd'⟩
    have db : d ≤ b := by
      by_contra hdb
      exact ncd b hb ⟨lt_of_lt_of_le hcp' hpb, lt_of_not_ge hdb⟩
    have ac'' : a = c := by
      by_contra hac
      exact nab c hc ⟨lt_of_le_of_ne ac' hac, lt_of_lt_of_le hcp' hpb⟩
    have db' : d = b := by
      by_contra hdb
      exact nab d hd ⟨lt_of_le_of_lt ac' hcd.2.2.1, lt_of_le_of_ne db hdb⟩
    exact hne.elim (fun h => h ac'') (fun h => h db'.symm)

end Ordered
end Cadloom
