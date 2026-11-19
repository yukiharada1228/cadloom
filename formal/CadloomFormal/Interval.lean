import CadloomFormal.NurbsSurface

/-!
Interval: the exact rational model of the interval arithmetic and certified bounds in
`src/interval/` (M4), the basis on which every intersection exclusion rests.

What each part models (TypeScript → Lean):

* `Interval` `{lo, hi}` (`src/interval/interval.ts`) → `Iv`, membership `mem x I` (`lo ≤ x ≤ hi`,
  TS `contains`).
* `add`, `sub`, `neg`, `mul`, `scale`, `sqr`, `hull`, `intersect`, `expand` → `add`, `sub`, `neg`,
  `mul`, `scale`, `sqr`, `hull`, `inter`, `widenBy`, with the SAME endpoint formulas: `mul` is
  `rmin (rmin (lo·lo) (lo·hi)) (rmin (hi·lo) (hi·hi))` and the `rmax` of the same products in the
  same order (TS `Math.min(Math.min(..), Math.min(..))`), `sqr` has the TS's three sign cases,
  `scale` the TS's two sign cases, `inter` returns `none` exactly when TS returns `undefined`.
  `rmin` / `rmax` are `Math.min` / `Math.max` on non-NaN values.
* Outward rounding (`float.ts` `addDown`/`addUp`, `mulDown`/`mulUp`, …): the TS computes each
  endpoint with a rounding that only moves it outward (`xDown ≤ exact ≤ xUp`). The abstract
  property used is `widen_mem` (a wider interval keeps every member), instantiated for the
  rounded sum (`add_rounded_sound`) and the rounded product (`mul_rounded_sound`: each corner
  product `p_k` with `d_k ≤ p_k ≤ u_k`, the result `[min d, max u]` — exactly TS `mul`).
* `Box3` and `boxesDisjoint3(a, b, gap)` (`src/interval/box.ts`) → `Box3`, `mem3`, `separated`
  (some axis with `b.lo - a.hi > gap` or `a.lo - b.hi > gap`, the TS's exact dyadic test);
  `separated_sound` (separated boxes: every pair of members differs by more than `gap` along that
  axis), `disjoint_iff` (for non-empty boxes, gap 0: separated ↔ no common point — the test is
  exact, not just sound), `union3_mem` (TS `unionBox3`).
* `hullOf` / the per-coordinate control-point hull in `nurbs-hull.ts` (`hullCoords`) →
  `hullList` (a fold of `rmin` / `rmax`), `hullList_mem` (every listed value is inside).
* The convex-hull bound of `boundNurbsCurve` / `boundNurbsSurface`:
  `combo_mem` (a convex combination of values in an interval stays inside), `ratio_combo_mem`
  (the rational case: `Σ wᵢxᵢ / Σ wᵢ` with positive weights, i.e. the projected NURBS point, stays
  inside), `deBoor_in_hull` / `tensor_in_hull` (the M0 / M1 de Boor and tensor de Boor point lies
  in any interval containing its window — `Nurbs.deBoor_between`, `NurbsSurface.tensor_between`
  restated for `Iv`), and `perturbed_deBoor_mem` / `perturbed_tensor_mem`: if computed control
  points lie in `I` and the exact ones are within `e` of them, the exact curve / surface point lies
  in `widenBy I e` — the step that turns the TS "hull of the inserted control points widened by
  the insertion error" into a certified bound.

Coordinates are independent (each coordinate of a box is its own interval), so one `Rat`
coordinate suffices except for the box theorems.

NOT covered: IEEE-754 rounding itself (that `addDown` etc. really round outward — TwoSum /
TwoProduct exactness and `nextUp` are tested in `tests/interval.test.ts` against exact dyadic
arithmetic, not proved), `div` and `sqrt` (no division / square root lemmas in core `Rat` used
here; tested exactly), the interval `sin` / `cos` (extrema location and libm error budget,
documented in `trig.ts` and tested against 256-bit Taylor series), the numerical size of the
knot-insertion error `err = γ_{16(L+2c+1)} M` (a documented derivation; Lean takes `e` as a
hypothesis), the rational quotient's error, the hodograph / normal cone (`normal-cone.ts`),
`spanWindow` / `findSpan` (spans are hypotheses as in `Nurbs.lean`), and array / `Result` paths.
-/
namespace CadloomFormal
namespace Interval

/-- `Math.min` on non-NaN values. -/
def rmin (a b : Rat) : Rat := if a ≤ b then a else b
/-- `Math.max` on non-NaN values. -/
def rmax (a b : Rat) : Rat := if a ≤ b then b else a

theorem rmin_le_left (a b : Rat) : rmin a b ≤ a := by unfold rmin; split <;> grind
theorem rmin_le_right (a b : Rat) : rmin a b ≤ b := by unfold rmin; split <;> grind
theorem le_rmax_left (a b : Rat) : a ≤ rmax a b := by unfold rmax; split <;> grind
theorem le_rmax_right (a b : Rat) : b ≤ rmax a b := by unfold rmax; split <;> grind
theorem rmin_cases (a b : Rat) : rmin a b = a ∨ rmin a b = b := by unfold rmin; split <;> simp
theorem rmax_cases (a b : Rat) : rmax a b = a ∨ rmax a b = b := by unfold rmax; split <;> simp

/-- A closed interval (TS `Interval`). -/
structure Iv where
  lo : Rat
  hi : Rat

/-- `x ∈ I` (TS `contains`). -/
def mem (x : Rat) (I : Iv) : Prop := I.lo ≤ x ∧ x ≤ I.hi

def add (a b : Iv) : Iv := ⟨a.lo + b.lo, a.hi + b.hi⟩
def sub (a b : Iv) : Iv := ⟨a.lo - b.hi, a.hi - b.lo⟩
def neg (a : Iv) : Iv := ⟨-a.hi, -a.lo⟩

/-- TS `mul`: min / max of the four corner products in the TS order. -/
def mul (a b : Iv) : Iv :=
  ⟨rmin (rmin (a.lo * b.lo) (a.lo * b.hi)) (rmin (a.hi * b.lo) (a.hi * b.hi)),
   rmax (rmax (a.lo * b.lo) (a.lo * b.hi)) (rmax (a.hi * b.lo) (a.hi * b.hi))⟩

/-- TS `scale(a, s)`: `s ≥ 0` keeps the order, `s < 0` swaps the ends. -/
def scale (a : Iv) (s : Rat) : Iv := if 0 ≤ s then ⟨a.lo * s, a.hi * s⟩ else ⟨a.hi * s, a.lo * s⟩

/-- TS `sqr`: the three sign cases. -/
def sqr (a : Iv) : Iv :=
  if 0 ≤ a.lo then ⟨a.lo * a.lo, a.hi * a.hi⟩
  else if a.hi ≤ 0 then ⟨a.hi * a.hi, a.lo * a.lo⟩
  else ⟨0, rmax (a.lo * a.lo) (a.hi * a.hi)⟩

/-- TS `hull`. -/
def hull (a b : Iv) : Iv := ⟨rmin a.lo b.lo, rmax a.hi b.hi⟩

/-- TS `intersect`: `none` (TS `undefined`) when the common part is empty. -/
def inter (a b : Iv) : Option Iv :=
  if rmax a.lo b.lo ≤ rmin a.hi b.hi then some ⟨rmax a.lo b.lo, rmin a.hi b.hi⟩ else none

/-- TS `expand(a, e)`: `[lo - e, hi + e]`. -/
def widenBy (a : Iv) (e : Rat) : Iv := ⟨a.lo - e, a.hi + e⟩

/-! ## Inclusion soundness of the exact formulas -/

theorem add_sound (x y : Rat) (A B : Iv) (hx : mem x A) (hy : mem y B) : mem (x + y) (add A B) := by
  unfold mem add at *; constructor <;> grind

theorem sub_sound (x y : Rat) (A B : Iv) (hx : mem x A) (hy : mem y B) : mem (x - y) (sub A B) := by
  unfold mem sub at *; constructor <;> grind

theorem neg_sound (x : Rat) (A : Iv) (hx : mem x A) : mem (-x) (neg A) := by
  unfold mem neg at *; constructor <;> grind

/-- For `a ≤ x ≤ b`, `x y` lies between `a y` and `b y` (in some order). -/
theorem seg (a b x y : Rat) (h1 : a ≤ x) (h2 : x ≤ b) :
    rmin (a * y) (b * y) ≤ x * y ∧ x * y ≤ rmax (a * y) (b * y) := by
  by_cases hy : 0 ≤ y
  · have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ x - a by grind) hy
    have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ b - x by grind) hy
    have e1 : (x - a) * y = x * y - a * y := by grind
    have e2 : (b - x) * y = b * y - x * y := by grind
    have := rmin_le_left (a * y) (b * y)
    have := le_rmax_right (a * y) (b * y)
    constructor <;> grind
  · have hy' : (0 : Rat) ≤ -y := by grind
    have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ x - a by grind) hy'
    have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ b - x by grind) hy'
    have e1 : (x - a) * -y = a * y - x * y := by grind
    have e2 : (b - x) * -y = x * y - b * y := by grind
    have := rmin_le_right (a * y) (b * y)
    have := le_rmax_left (a * y) (b * y)
    constructor <;> grind

theorem mul_sound (x y : Rat) (A B : Iv) (hx : mem x A) (hy : mem y B) : mem (x * y) (mul A B) := by
  unfold mem at hx hy
  -- x y lies between A.lo y and A.hi y; each of those between the corner products.
  have hxy := seg A.lo A.hi x y hx.1 hx.2
  have hl := seg B.lo B.hi y A.lo hy.1 hy.2
  have hh := seg B.lo B.hi y A.hi hy.1 hy.2
  have c1 : A.lo * y = y * A.lo := Rat.mul_comm _ _
  have c2 : A.hi * y = y * A.hi := Rat.mul_comm _ _
  have c3 : B.lo * A.lo = A.lo * B.lo := Rat.mul_comm _ _
  have c4 : B.hi * A.lo = A.lo * B.hi := Rat.mul_comm _ _
  have c5 : B.lo * A.hi = A.hi * B.lo := Rat.mul_comm _ _
  have c6 : B.hi * A.hi = A.hi * B.hi := Rat.mul_comm _ _
  rw [c3, c4] at hl
  rw [c5, c6] at hh
  rw [← c1] at hl
  rw [← c2] at hh
  unfold mem mul
  simp only
  have m1 := rmin_le_left (rmin (A.lo * B.lo) (A.lo * B.hi)) (rmin (A.hi * B.lo) (A.hi * B.hi))
  have m2 := rmin_le_right (rmin (A.lo * B.lo) (A.lo * B.hi)) (rmin (A.hi * B.lo) (A.hi * B.hi))
  have m3 := rmin_le_left (A.lo * B.lo) (A.lo * B.hi)
  have m4 := rmin_le_right (A.lo * B.lo) (A.lo * B.hi)
  have m5 := rmin_le_left (A.hi * B.lo) (A.hi * B.hi)
  have m6 := rmin_le_right (A.hi * B.lo) (A.hi * B.hi)
  have M1 := le_rmax_left (rmax (A.lo * B.lo) (A.lo * B.hi)) (rmax (A.hi * B.lo) (A.hi * B.hi))
  have M2 := le_rmax_right (rmax (A.lo * B.lo) (A.lo * B.hi)) (rmax (A.hi * B.lo) (A.hi * B.hi))
  have M3 := le_rmax_left (A.lo * B.lo) (A.lo * B.hi)
  have M4 := le_rmax_right (A.lo * B.lo) (A.lo * B.hi)
  have M5 := le_rmax_left (A.hi * B.lo) (A.hi * B.hi)
  have M6 := le_rmax_right (A.hi * B.lo) (A.hi * B.hi)
  have r1 := rmin_cases (A.lo * B.lo) (A.lo * B.hi)
  have r2 := rmin_cases (A.hi * B.lo) (A.hi * B.hi)
  have r3 := rmax_cases (A.lo * B.lo) (A.lo * B.hi)
  have r4 := rmax_cases (A.hi * B.lo) (A.hi * B.hi)
  have r5 := rmin_cases (A.lo * y) (A.hi * y)
  have r6 := rmax_cases (A.lo * y) (A.hi * y)
  constructor
  · rcases r5 with h5 | h5 <;> rw [h5] at hxy
    · rcases r1 with h1 | h1 <;> rw [h1] at hl <;> grind
    · rcases r2 with h2 | h2 <;> rw [h2] at hh <;> grind
  · rcases r6 with h6 | h6 <;> rw [h6] at hxy
    · rcases r3 with h3 | h3 <;> rw [h3] at hl <;> grind
    · rcases r4 with h4 | h4 <;> rw [h4] at hh <;> grind

theorem scale_sound (x s : Rat) (A : Iv) (hx : mem x A) : mem (x * s) (scale A s) := by
  unfold mem scale at *
  have := seg A.lo A.hi x s hx.1 hx.2
  by_cases hs : 0 ≤ s
  · simp only [hs, if_true]
    have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ x - A.lo by grind) hs
    have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ A.hi - x by grind) hs
    have e1 : (x - A.lo) * s = x * s - A.lo * s := by grind
    have e2 : (A.hi - x) * s = A.hi * s - x * s := by grind
    constructor <;> grind
  · simp only [hs, if_false]
    have hs' : (0 : Rat) ≤ -s := by grind
    have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ x - A.lo by grind) hs'
    have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ A.hi - x by grind) hs'
    have e1 : (x - A.lo) * -s = A.lo * s - x * s := by grind
    have e2 : (A.hi - x) * -s = x * s - A.hi * s := by grind
    constructor <;> grind

theorem sqr_sound (x : Rat) (A : Iv) (hx : mem x A) : mem (x * x) (sqr A) := by
  unfold mem at hx
  unfold mem sqr
  by_cases h0 : 0 ≤ A.lo
  · simp only [h0, if_true]
    have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ x - A.lo by grind) (show (0 : Rat) ≤ x + A.lo by grind)
    have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ A.hi - x by grind) (show (0 : Rat) ≤ A.hi + x by grind)
    have e1 : (x - A.lo) * (x + A.lo) = x * x - A.lo * A.lo := by grind
    have e2 : (A.hi - x) * (A.hi + x) = A.hi * A.hi - x * x := by grind
    constructor <;> grind
  · simp only [h0, if_false]
    by_cases h1 : A.hi ≤ 0
    · simp only [h1, if_true]
      have k1 := Rat.mul_nonneg (show (0 : Rat) ≤ A.hi - x by grind) (show (0 : Rat) ≤ -(A.hi + x) by grind)
      have k2 := Rat.mul_nonneg (show (0 : Rat) ≤ x - A.lo by grind) (show (0 : Rat) ≤ -(x + A.lo) by grind)
      have e1 : (A.hi - x) * -(A.hi + x) = x * x - A.hi * A.hi := by grind
      have e2 : (x - A.lo) * -(x + A.lo) = A.lo * A.lo - x * x := by grind
      constructor <;> grind
    · simp only [h1, if_false]
      have ml := le_rmax_left (A.lo * A.lo) (A.hi * A.hi)
      have mr := le_rmax_right (A.lo * A.lo) (A.hi * A.hi)
      constructor
      · by_cases hx0 : 0 ≤ x
        · exact Rat.mul_nonneg hx0 hx0
        · have := Rat.mul_nonneg (show (0 : Rat) ≤ -x by grind) (show (0 : Rat) ≤ -x by grind)
          have e : -x * -x = x * x := by grind
          grind
      · by_cases hx0 : 0 ≤ x
        · have k := Rat.mul_nonneg (show (0 : Rat) ≤ A.hi - x by grind) (show (0 : Rat) ≤ A.hi + x by grind)
          have e : (A.hi - x) * (A.hi + x) = A.hi * A.hi - x * x := by grind
          grind
        · have k := Rat.mul_nonneg (show (0 : Rat) ≤ x - A.lo by grind) (show (0 : Rat) ≤ -(x + A.lo) by grind)
          have e : (x - A.lo) * -(x + A.lo) = A.lo * A.lo - x * x := by grind
          grind

/-! ## Hull and intersection -/

theorem hull_sound (x : Rat) (A B : Iv) (h : mem x A ∨ mem x B) : mem x (hull A B) := by
  unfold mem hull at *
  have := rmin_le_left A.lo B.lo; have := rmin_le_right A.lo B.lo
  have := le_rmax_left A.hi B.hi; have := le_rmax_right A.hi B.hi
  rcases h with h | h <;> constructor <;> grind

/-- `hull` is the least interval containing both. -/
theorem hull_least (A B C : Iv) (hA : C.lo ≤ A.lo ∧ A.hi ≤ C.hi) (hB : C.lo ≤ B.lo ∧ B.hi ≤ C.hi) :
    C.lo ≤ (hull A B).lo ∧ (hull A B).hi ≤ C.hi := by
  unfold hull; simp only
  have := rmin_cases A.lo B.lo; have := rmax_cases A.hi B.hi
  constructor <;> grind

theorem inter_sound (x : Rat) (A B I : Iv) (h : inter A B = some I) : mem x I ↔ mem x A ∧ mem x B := by
  unfold inter at h
  split at h
  · cases h
    unfold mem; simp only
    have := rmax_cases A.lo B.lo; have := rmin_cases A.hi B.hi
    have := le_rmax_left A.lo B.lo; have := le_rmax_right A.lo B.lo
    have := rmin_le_left A.hi B.hi; have := rmin_le_right A.hi B.hi
    constructor
    · intro hx; constructor <;> constructor <;> grind
    · intro hx; constructor <;> grind
  · cases h

theorem inter_none (x : Rat) (A B : Iv) (h : inter A B = none) : ¬ (mem x A ∧ mem x B) := by
  unfold inter at h
  split at h
  · cases h
  · intro hx
    unfold mem at hx
    have := rmax_cases A.lo B.lo; have := rmin_cases A.hi B.hi
    grind

/-! ## Outward rounding -/

/-- Widening keeps members: the property outward rounding provides (`lo' ≤ lo`, `hi ≤ hi'`). -/
theorem widen_mem (x lo hi lo' hi' : Rat) (hl : lo' ≤ lo) (hh : hi ≤ hi') (hx : mem x ⟨lo, hi⟩) :
    mem x ⟨lo', hi'⟩ := by
  unfold mem at *; simp only at *; constructor <;> grind

/-- TS `add` with `addDown` / `addUp` endpoints `dl ≤ a.lo + b.lo`, `a.hi + b.hi ≤ uh`. -/
theorem add_rounded_sound (x y dl uh : Rat) (A B : Iv) (hx : mem x A) (hy : mem y B)
    (hd : dl ≤ A.lo + B.lo) (hu : A.hi + B.hi ≤ uh) : mem (x + y) ⟨dl, uh⟩ :=
  widen_mem _ _ _ _ _ hd hu (add_sound x y A B hx hy)

/-- TS `mul`: each corner product rounded down (`dᵢ`) and up (`uᵢ`), then the min / max. -/
theorem mul_rounded_sound (x y d1 d2 d3 d4 u1 u2 u3 u4 : Rat) (A B : Iv) (hx : mem x A) (hy : mem y B)
    (h1 : d1 ≤ A.lo * B.lo ∧ A.lo * B.lo ≤ u1) (h2 : d2 ≤ A.lo * B.hi ∧ A.lo * B.hi ≤ u2)
    (h3 : d3 ≤ A.hi * B.lo ∧ A.hi * B.lo ≤ u3) (h4 : d4 ≤ A.hi * B.hi ∧ A.hi * B.hi ≤ u4) :
    mem (x * y) ⟨rmin (rmin d1 d2) (rmin d3 d4), rmax (rmax u1 u2) (rmax u3 u4)⟩ := by
  have hm := mul_sound x y A B hx hy
  apply widen_mem _ _ _ _ _ _ _ hm
  · have := rmin_cases (rmin (A.lo * B.lo) (A.lo * B.hi)) (rmin (A.hi * B.lo) (A.hi * B.hi))
    have := rmin_cases (A.lo * B.lo) (A.lo * B.hi); have := rmin_cases (A.hi * B.lo) (A.hi * B.hi)
    have := rmin_le_left (rmin d1 d2) (rmin d3 d4); have := rmin_le_right (rmin d1 d2) (rmin d3 d4)
    have := rmin_le_left d1 d2; have := rmin_le_right d1 d2
    have := rmin_le_left d3 d4; have := rmin_le_right d3 d4
    grind
  · have := rmax_cases (rmax (A.lo * B.lo) (A.lo * B.hi)) (rmax (A.hi * B.lo) (A.hi * B.hi))
    have := rmax_cases (A.lo * B.lo) (A.lo * B.hi); have := rmax_cases (A.hi * B.lo) (A.hi * B.hi)
    have := le_rmax_left (rmax u1 u2) (rmax u3 u4); have := le_rmax_right (rmax u1 u2) (rmax u3 u4)
    have := le_rmax_left u1 u2; have := le_rmax_right u1 u2
    have := le_rmax_left u3 u4; have := le_rmax_right u3 u4
    grind

/-- TS `expand`: a member stays a member. -/
theorem expand_mem (x e : Rat) (A : Iv) (he : 0 ≤ e) (hx : mem x A) : mem x (widenBy A e) := by
  unfold mem widenBy at *; constructor <;> grind

/-- A value within `e` of a member lies in the interval widened by `e`. -/
theorem perturbed_mem (x x' e : Rat) (A : Iv) (hx' : mem x' A) (hl : x' - e ≤ x) (hh : x ≤ x' + e) :
    mem x (widenBy A e) := by
  unfold mem widenBy at *; constructor <;> grind

/-! ## Boxes -/

/-- A 3D box: one interval per axis (TS `Box3`). -/
structure Box3 where
  x : Iv
  y : Iv
  z : Iv

def mem3 (p : Rat × Rat × Rat) (B : Box3) : Prop := mem p.1 B.x ∧ mem p.2.1 B.y ∧ mem p.2.2 B.z

/-- One axis of TS `boxesDisjoint3`: `b.lo - a.hi > g` or `a.lo - b.hi > g`. -/
def sepAxis (a b : Iv) (g : Rat) : Prop := b.lo - a.hi > g ∨ a.lo - b.hi > g

/-- TS `boxesDisjoint3(a, b, g)`. -/
def separated (A B : Box3) (g : Rat) : Prop := sepAxis A.x B.x g ∨ sepAxis A.y B.y g ∨ sepAxis A.z B.z g

theorem sepAxis_sound (a b : Iv) (g s t : Rat) (h : sepAxis a b g) (hs : mem s a) (ht : mem t b) :
    t - s > g ∨ s - t > g := by
  unfold sepAxis mem at *; grind

/-- Separated boxes: every member of `A` and every member of `B` differ by more than `g` along some axis. -/
theorem separated_sound (A B : Box3) (g : Rat) (p q : Rat × Rat × Rat) (h : separated A B g)
    (hp : mem3 p A) (hq : mem3 q B) :
    (q.1 - p.1 > g ∨ p.1 - q.1 > g) ∨ (q.2.1 - p.2.1 > g ∨ p.2.1 - q.2.1 > g) ∨
      (q.2.2 - p.2.2 > g ∨ p.2.2 - q.2.2 > g) := by
  unfold separated mem3 at *
  rcases h with h | h | h
  · exact Or.inl (sepAxis_sound _ _ _ _ _ h hp.1 hq.1)
  · exact Or.inr (Or.inl (sepAxis_sound _ _ _ _ _ h hp.2.1 hq.2.1))
  · exact Or.inr (Or.inr (sepAxis_sound _ _ _ _ _ h hp.2.2 hq.2.2))

/-- Gap 0: separated boxes share no point. -/
theorem disjoint_sound (A B : Box3) (p : Rat × Rat × Rat) (h : separated A B 0) :
    ¬ (mem3 p A ∧ mem3 p B) := by
  intro ⟨hA, hB⟩
  have := separated_sound A B 0 p p h hA hB
  grind

def nonempty (B : Box3) : Prop := B.x.lo ≤ B.x.hi ∧ B.y.lo ≤ B.y.hi ∧ B.z.lo ≤ B.z.hi

/-- The test is exact: for non-empty boxes, separated at gap 0 iff no common point. -/
theorem disjoint_iff (A B : Box3) (hA : nonempty A) (hB : nonempty B) :
    separated A B 0 ↔ ¬ ∃ p, mem3 p A ∧ mem3 p B := by
  constructor
  · intro h ⟨p, hp⟩; exact disjoint_sound A B p h hp
  · intro h
    apply Classical.byContradiction
    intro hs
    apply h
    unfold separated sepAxis at hs
    unfold nonempty at hA hB
    refine ⟨(rmax A.x.lo B.x.lo, rmax A.y.lo B.y.lo, rmax A.z.lo B.z.lo), ?_, ?_⟩ <;>
    · unfold mem3 mem; simp only
      have := rmax_cases A.x.lo B.x.lo; have := rmax_cases A.y.lo B.y.lo; have := rmax_cases A.z.lo B.z.lo
      have := le_rmax_left A.x.lo B.x.lo; have := le_rmax_right A.x.lo B.x.lo
      have := le_rmax_left A.y.lo B.y.lo; have := le_rmax_right A.y.lo B.y.lo
      have := le_rmax_left A.z.lo B.z.lo; have := le_rmax_right A.z.lo B.z.lo
      grind

/-- TS `unionBox3` (the per-axis `hull`) contains both boxes. -/
theorem union3_mem (A B : Box3) (p : Rat × Rat × Rat) (h : mem3 p A ∨ mem3 p B) :
    mem3 p ⟨hull A.x B.x, hull A.y B.y, hull A.z B.z⟩ := by
  unfold mem3 at *
  rcases h with h | h
  · exact ⟨hull_sound _ _ _ (Or.inl h.1), hull_sound _ _ _ (Or.inl h.2.1), hull_sound _ _ _ (Or.inl h.2.2)⟩
  · exact ⟨hull_sound _ _ _ (Or.inr h.1), hull_sound _ _ _ (Or.inr h.2.1), hull_sound _ _ _ (Or.inr h.2.2)⟩

/-! ## Hull of a list of values (TS `hullOf`, `hullCoords`) -/

/-- The fold `lo = min(lo, v)`, `hi = max(hi, v)` started at the first value. -/
def hullList (x0 : Rat) (xs : List Rat) : Iv :=
  xs.foldl (fun I v => ⟨rmin I.lo v, rmax I.hi v⟩) ⟨x0, x0⟩

theorem hullList_fold_mono (xs : List Rat) :
    ∀ (I : Iv) (y : Rat), mem y I → mem y (xs.foldl (fun I v => ⟨rmin I.lo v, rmax I.hi v⟩) I) := by
  induction xs with
  | nil => intro I y h; exact h
  | cons v vs ih =>
    intro I y h
    apply ih
    unfold mem at *; simp only
    have := rmin_le_left I.lo v; have := le_rmax_left I.hi v
    constructor <;> grind

theorem hullList_fold_mem (xs : List Rat) :
    ∀ (I : Iv) (y : Rat), y ∈ xs → mem y (xs.foldl (fun I v => ⟨rmin I.lo v, rmax I.hi v⟩) I) := by
  induction xs with
  | nil => intro I y h; cases h
  | cons v vs ih =>
    intro I y h
    simp only [List.foldl]
    rcases List.mem_cons.mp h with h | h
    · subst h
      apply hullList_fold_mono
      unfold mem; simp only
      exact ⟨rmin_le_right _ _, le_rmax_right _ _⟩
    · exact ih _ _ h

/-- Every listed value lies in the hull. -/
theorem hullList_mem (x0 : Rat) (xs : List Rat) (y : Rat) (h : y = x0 ∨ y ∈ xs) : mem y (hullList x0 xs) := by
  unfold hullList
  rcases h with h | h
  · apply hullList_fold_mono; subst h; unfold mem; constructor <;> grind
  · exact hullList_fold_mem xs _ y h

/-! ## Convex combinations (the convex-hull bound) -/

def wsum : List (Rat × Rat) → Rat
  | [] => 0
  | (w, _) :: l => w + wsum l

/-- `Σ wᵢ xᵢ`. -/
def combo : List (Rat × Rat) → Rat
  | [] => 0
  | (w, x) :: l => w * x + combo l

/-- With non-negative weights and members of `I`: `lo Σw ≤ Σ w x ≤ hi Σw`. -/
theorem combo_bounds (I : Iv) :
    ∀ l : List (Rat × Rat), (∀ wx ∈ l, 0 ≤ wx.1 ∧ mem wx.2 I) →
      I.lo * wsum l ≤ combo l ∧ combo l ≤ I.hi * wsum l := by
  intro l
  induction l with
  | nil => intro _; simp only [wsum, combo, Rat.mul_zero]; exact ⟨Rat.le_refl, Rat.le_refl⟩
  | cons wx l ih =>
    intro h
    obtain ⟨w, x⟩ := wx
    have hw := h (w, x) (List.mem_cons_self ..)
    have ihl := ih (fun y hy => h y (List.mem_cons_of_mem _ hy))
    simp only [wsum, combo]
    unfold mem at hw
    have k1 := Rat.mul_nonneg hw.1 (show (0 : Rat) ≤ x - I.lo by grind)
    have k2 := Rat.mul_nonneg hw.1 (show (0 : Rat) ≤ I.hi - x by grind)
    have e1 : w * (x - I.lo) = w * x - I.lo * w := by grind
    have e2 : w * (I.hi - x) = I.hi * w - w * x := by grind
    have e3 : I.lo * (w + wsum l) = I.lo * w + I.lo * wsum l := by grind
    have e4 : I.hi * (w + wsum l) = I.hi * w + I.hi * wsum l := by grind
    constructor <;> grind

/-- A convex combination of members of `I` is a member. -/
theorem combo_mem (I : Iv) (l : List (Rat × Rat)) (h : ∀ wx ∈ l, 0 ≤ wx.1 ∧ mem wx.2 I)
    (hs : wsum l = 1) : mem (combo l) I := by
  have := combo_bounds I l h
  rw [hs] at this
  unfold mem; constructor <;> grind

/-- The rational case: `Σ wᵢ xᵢ / Σ wᵢ` with non-negative weights of positive sum stays in `I`
(the projected point of a NURBS with positive weights `wᵢ Nᵢ`). -/
theorem ratio_combo_mem (I : Iv) (l : List (Rat × Rat)) (h : ∀ wx ∈ l, 0 ≤ wx.1 ∧ mem wx.2 I)
    (hs : 0 < wsum l) : mem (combo l / wsum l) I := by
  have hb := combo_bounds I l h
  have hinv : 0 < (wsum l)⁻¹ := Rat.inv_pos.mpr hs
  have hne : wsum l ≠ 0 := fun h0 => by rw [h0] at hs; exact Rat.lt_irrefl hs
  have hc : wsum l * (wsum l)⁻¹ = 1 := Rat.mul_inv_cancel _ hne
  have m1 := Rat.mul_le_mul_of_nonneg_right hb.1 (Rat.le_of_lt hinv)
  have m2 := Rat.mul_le_mul_of_nonneg_right hb.2 (Rat.le_of_lt hinv)
  have a1 : I.lo * wsum l * (wsum l)⁻¹ = I.lo * (wsum l * (wsum l)⁻¹) := Rat.mul_assoc _ _ _
  have a2 : I.hi * wsum l * (wsum l)⁻¹ = I.hi * (wsum l * (wsum l)⁻¹) := Rat.mul_assoc _ _ _
  rw [Rat.div_def]
  unfold mem
  rw [hc, Rat.mul_one] at a1 a2
  constructor <;> grind

/-! ## The NURBS hull bound (connection to `Nurbs.deBoor` / `NurbsSurface.tensor`) -/

open Nurbs NurbsSurface

/-- The de Boor point (TS `deBoorPoint`, the curve point) lies in any interval containing the
window `P[s] .. P[s+p]` (sorted knots, `u` in span `s + p`). -/
theorem deBoor_in_hull (P U : Nat → Rat) (hU : Monotone U) (p s : Nat) (u : Rat)
    (hlo : U (s + p) ≤ u) (hhi : u ≤ U (s + p + 1)) (I : Iv)
    (hP : ∀ i, s ≤ i → i ≤ s + p → mem (P i) I) : mem (deBoor P U p s u p p) I :=
  deBoor_between P U hU p s u hlo hhi I.lo I.hi hP p p (Nat.le_refl p) (Nat.le_refl p)

/-- The tensor de Boor point (TS `evaluateSurface`) lies in any interval containing its window. -/
theorem tensor_in_hull (P : Nat → Nat → Rat) (U V : Nat → Rat) (hU : Monotone U) (hV : Monotone V)
    (p q su sv : Nat) (u v : Rat)
    (hul : U (su + p) ≤ u) (huh : u ≤ U (su + p + 1)) (hvl : V (sv + q) ≤ v) (hvh : v ≤ V (sv + q + 1)) (I : Iv)
    (hP : ∀ i j, su ≤ i → i ≤ su + p → sv ≤ j → j ≤ sv + q → mem (P i j) I) :
    mem (tensor P U V p q su sv u v) I :=
  tensor_between P U V hU hV p q su sv u v hul huh hvl hvh I.lo I.hi hP

/-- The certified "fine" bound: the computed control points `C` lie in `I` and the exact ones
`P` are within `e` of them; then the exact curve point lies in `widenBy I e`. -/
theorem perturbed_deBoor_mem (P C U : Nat → Rat) (hU : Monotone U) (p s : Nat) (u e : Rat)
    (hlo : U (s + p) ≤ u) (hhi : u ≤ U (s + p + 1)) (I : Iv)
    (hC : ∀ i, s ≤ i → i ≤ s + p → mem (C i) I)
    (hPC : ∀ i, s ≤ i → i ≤ s + p → C i - e ≤ P i ∧ P i ≤ C i + e) :
    mem (deBoor P U p s u p p) (widenBy I e) :=
  deBoor_in_hull P U hU p s u hlo hhi (widenBy I e)
    (fun i h1 h2 => perturbed_mem (P i) (C i) e I (hC i h1 h2) (hPC i h1 h2).1 (hPC i h1 h2).2)

/-- The surface analogue of `perturbed_deBoor_mem`. -/
theorem perturbed_tensor_mem (P C : Nat → Nat → Rat) (U V : Nat → Rat) (hU : Monotone U) (hV : Monotone V)
    (p q su sv : Nat) (u v e : Rat)
    (hul : U (su + p) ≤ u) (huh : u ≤ U (su + p + 1)) (hvl : V (sv + q) ≤ v) (hvh : v ≤ V (sv + q + 1)) (I : Iv)
    (hC : ∀ i j, su ≤ i → i ≤ su + p → sv ≤ j → j ≤ sv + q → mem (C i j) I)
    (hPC : ∀ i j, su ≤ i → i ≤ su + p → sv ≤ j → j ≤ sv + q → C i j - e ≤ P i j ∧ P i j ≤ C i j + e) :
    mem (tensor P U V p q su sv u v) (widenBy I e) :=
  tensor_in_hull P U V hU hV p q su sv u v hul huh hvl hvh (widenBy I e)
    (fun i j h1 h2 h3 h4 =>
      perturbed_mem (P i j) (C i j) e I (hC i j h1 h2 h3 h4) (hPC i j h1 h2 h3 h4).1 (hPC i j h1 h2 h3 h4).2)

/-! ## Satisfiability examples (the hypotheses are not vacuous) -/

example : mem (3 * (-2)) (mul ⟨1, 4⟩ ⟨-3, 2⟩) :=
  mul_sound _ _ _ _ (by unfold mem; constructor <;> grind) (by unfold mem; constructor <;> grind)
example : separated ⟨⟨0, 1⟩, ⟨0, 1⟩, ⟨0, 1⟩⟩ ⟨⟨2, 3⟩, ⟨0, 1⟩, ⟨0, 1⟩⟩ (1 / 2) := by
  unfold separated sepAxis; simp only; exact Or.inl (Or.inl (by grind))

end Interval
end CadloomFormal
