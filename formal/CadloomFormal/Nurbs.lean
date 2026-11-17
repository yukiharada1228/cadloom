/-
Nurbs: the exact rational model of the B-spline evaluation and knot-insertion schemes in
`src/nurbs/`.

What each part models (TypeScript → Lean):

* `deBoorPoint` and its private `deBoorTriangle` in `src/nurbs/curve.ts` (the de Boor triangle, NURBS Book A3.1-style,
  used by `evaluateCurve`, `deBoor`, the derivative evaluation and the homogeneous evaluation of
  rational curves) → `deBoor`. The TS code starts from `d[j] = P[s + j]` (`j = 0..p`, `s = span - p`)
  and for `r = 1..p`, `j = p` down to `r` overwrites
  `d[j] = (1 - a) d[j-1] + a d[j]` with `a = (u - U[s+j]) / (U[s+j+p+1-r] - U[s+j])`.
  Because `j` runs downward, `d[j-1]` still holds level `r-1`, so after the loops `d[p]` is exactly
  `deBoor P U p s u p p` below (same base index `s`, same `j`, same knot indices). For a span from
  `findSpan` the denominator is at least `U[span+1] - U[span] > 0`, so the TS guard
  `den === 0 ? 0 : …` never fires there; on other inputs it returns `0`, matching Lean's `x / 0 = 0`.
* `deCasteljau` / `subdivideBezier` in `src/nurbs/bezier.ts` → `casteljau`. TS overwrites
  `b[i] = (1 - t) b[i] + t b[i+1]` for `k = 1..p`, `i = 0..p-k` (ascending, so `b[i+1]` is still
  level `k-1`); after level `k`, `b[0]` is the k-th left subdivision point and `b[p-k]` the
  `(p-k)`-th right one. That is `casteljau P t k 0` and `casteljau P t k (p-k)`.
* `insertKnot` in `src/nurbs/insert.ts` (Boehm insertion, NURBS Book A5.1) for a single
  insertion (`r = 1`) at `ū` in span `k` → `insAlpha`, `insertedPts`, `insertedKnots`.
  A5.1 with `r = 1` computes `Q[i] = a_i P[i] + (1 - a_i) P[i-1]` for `i = k-p+1 .. k-s`
  (`s` = multiplicity of `ū`), `Q[i] = P[i]` for `i ≤ k-p`, `Q[i] = P[i-1]` for `i ≥ k-s+1`.
  The model uses the `s = 0` formula on the whole range `k-p+1 .. k`; for `i` in `k-s+1 .. k` the
  knot `U[i]` equals `ū`, so `a_i = 0` and the formula gives `P[i-1]`, the same value A5.1 copies
  (`insertedPts_eq_prev_of_knot_eq`; that `U[i] = ū` on those indices follows from the knots being
  sorted and is not itself formalized).

Coordinates are independent in every one of these schemes (each step is the same affine
combination applied to every coordinate, and to the homogeneous weight of a rational curve), so
one `Rat` coordinate suffices. Control points and knots are functions `Nat → Rat`.

NOT covered: IEEE-754 rounding (the TS computes in doubles), array bounds and `Result` errors,
`findSpan` itself (the theorems take the span `k = s + p` as a hypothesis), the basis-function
evaluation (A2.2/A2.3) and its agreement with de Boor (checked by tests only), derivatives,
the rational quotient, multiple insertion (`r > 1`) and — importantly — the full statement that
insertion leaves the curve unchanged at every parameter. What is proved about insertion is:
its coefficients are convex weights (`insAlpha_mem_unit`, `insertedPts_between`), and the new
curve has the same de Boor point as the old one at the inserted parameter itself, for every
degree (`insert_preserves_point_at_inserted_param`).
-/
namespace CadloomFormal
namespace Nurbs

/-! ## de Boor -/

/-- The de Boor weight at level `r`, column `j`, base `s = span - p`
(`a = (u - U[s+j]) / (U[s+j+p+1-r] - U[s+j])`). -/
def alpha (U : Nat → Rat) (p s : Nat) (u : Rat) (r j : Nat) : Rat :=
  (u - U (s + j)) / (U (s + j + (p + 1 - r)) - U (s + j))

/-- The de Boor triangle: `deBoor P U p s u r j` is `d_j` after level `r`.
The point of the curve is `deBoor P U p s u p p`. -/
def deBoor (P U : Nat → Rat) (p s : Nat) (u : Rat) : Nat → Nat → Rat
  | 0, j => P (s + j)
  | r + 1, j =>
      (1 - alpha U p s u (r + 1) j) * deBoor P U p s u r (j - 1)
        + alpha U p s u (r + 1) j * deBoor P U p s u r j

theorem deBoor_succ (P U : Nat → Rat) (p s : Nat) (u : Rat) (r j : Nat) :
    deBoor P U p s u (r + 1) j =
      (1 - alpha U p s u (r + 1) j) * deBoor P U p s u r (j - 1)
        + alpha U p s u (r + 1) j * deBoor P U p s u r j := rfl

/-- (a) Constant reproduction (partition of unity): if every control point is `c`, every entry of
the triangle is `c`, for every degree and any knots. -/
theorem deBoor_const (P U : Nat → Rat) (c : Rat) (hP : ∀ i, P i = c) (p s : Nat) (u : Rat) :
    ∀ r j, deBoor P U p s u r j = c := by
  intro r
  induction r with
  | zero => intro j; simp [deBoor, hP]
  | succ r ih => intro j; simp only [deBoor, ih]; grind

/-- (b) Affine invariance: de Boor of `α P_i + β` is `α (de Boor of P) + β`. -/
theorem deBoor_affine (P U : Nat → Rat) (a b : Rat) (p s : Nat) (u : Rat) :
    ∀ r j, deBoor (fun i => a * P i + b) U p s u r j = a * deBoor P U p s u r j + b := by
  intro r
  induction r with
  | zero => intro j; simp [deBoor]
  | succ r ih => intro j; simp only [deBoor, ih]; grind

/-- Linearity in the control points (used for coordinates of sums of curves). -/
theorem deBoor_add (P Q U : Nat → Rat) (p s : Nat) (u : Rat) :
    ∀ r j, deBoor (fun i => P i + Q i) U p s u r j = deBoor P U p s u r j + deBoor Q U p s u r j := by
  intro r
  induction r with
  | zero => intro j; simp [deBoor]
  | succ r ih => intro j; simp only [deBoor, ih]; grind

/-! ### Convexity -/

theorem ratio_mem_unit (a b : Rat) (h0 : 0 ≤ a) (h1 : a ≤ b) : 0 ≤ a / b ∧ a / b ≤ 1 := by
  rw [Rat.div_def]
  by_cases hb : b = 0
  · subst hb
    rw [Rat.inv_zero, Rat.mul_zero]
    exact ⟨by decide, by decide⟩
  · have hbpos : 0 < b := by
      have : (0 : Rat) ≤ b := Rat.le_trans h0 h1
      exact Rat.lt_of_le_of_ne this (fun h => hb h.symm)
    have hinv : 0 < b⁻¹ := Rat.inv_pos.mpr hbpos
    refine ⟨Rat.mul_nonneg h0 (Rat.le_of_lt hinv), ?_⟩
    have h2 : b⁻¹ * a ≤ b⁻¹ * b := Rat.mul_le_mul_of_nonneg_left h1 (Rat.le_of_lt hinv)
    have h3 : b * b⁻¹ = 1 := Rat.mul_inv_cancel b hb
    grind

theorem lerp_between (lo hi a x y : Rat) (ha0 : 0 ≤ a) (ha1 : a ≤ 1)
    (hx : lo ≤ x ∧ x ≤ hi) (hy : lo ≤ y ∧ y ≤ hi) :
    lo ≤ (1 - a) * x + a * y ∧ (1 - a) * x + a * y ≤ hi := by
  have e1 : (0 : Rat) ≤ 1 - a := by grind
  have k1 := Rat.mul_nonneg e1 (show (0 : Rat) ≤ x - lo by grind)
  have k2 := Rat.mul_nonneg ha0 (show (0 : Rat) ≤ y - lo by grind)
  have k3 := Rat.mul_nonneg e1 (show (0 : Rat) ≤ hi - x by grind)
  have k4 := Rat.mul_nonneg ha0 (show (0 : Rat) ≤ hi - y by grind)
  constructor <;> grind

/-- Non-decreasing knots. -/
def Monotone (U : Nat → Rat) : Prop := ∀ i j, i ≤ j → U i ≤ U j

/-- Every de Boor weight used by the triangle lies in `[0, 1]` when the knots do not decrease and
`U[k] ≤ u ≤ U[k+1]` with `k = s + p` (the span found by `findSpan`). -/
theorem alpha_mem_unit (U : Nat → Rat) (hU : Monotone U) (p s : Nat) (u : Rat)
    (hlo : U (s + p) ≤ u) (hhi : u ≤ U (s + p + 1)) (r j : Nat)
    (hr : 1 ≤ r) (hrj : r ≤ j) (hj : j ≤ p) :
    0 ≤ alpha U p s u r j ∧ alpha U p s u r j ≤ 1 := by
  unfold alpha
  apply ratio_mem_unit
  · have := hU (s + j) (s + p) (by omega); grind
  · have := hU (s + p + 1) (s + j + (p + 1 - r)) (by omega); grind

/-- Convex hull property: when the knots do not decrease and `u` lies in span `k = s + p`,
every entry `d_j` of level `r` (`r ≤ j ≤ p`) lies between the bounds of the control points
`P[s+j-r] .. P[s+j]`; in particular the curve point `deBoor … p p` lies in `[lo, hi]` whenever
`P[s] .. P[s+p]` do. -/
theorem deBoor_between (P U : Nat → Rat) (hU : Monotone U) (p s : Nat) (u : Rat)
    (hlo : U (s + p) ≤ u) (hhi : u ≤ U (s + p + 1)) (lo hi : Rat)
    (hP : ∀ i, s ≤ i → i ≤ s + p → lo ≤ P i ∧ P i ≤ hi) :
    ∀ r j, r ≤ j → j ≤ p → lo ≤ deBoor P U p s u r j ∧ deBoor P U p s u r j ≤ hi := by
  intro r
  induction r with
  | zero => intro j _ hj; simp only [deBoor]; exact hP (s + j) (by omega) (by omega)
  | succ r ih =>
    intro j hrj hj
    have ha := alpha_mem_unit U hU p s u hlo hhi (r + 1) j (by omega) hrj hj
    simp only [deBoor]
    exact lerp_between lo hi _ _ _ ha.1 ha.2 (ih (j - 1) (by omega) (by omega)) (ih j (by omega) hj)

/-! ## de Casteljau -/

/-- The de Casteljau triangle: `casteljau P t r i` is `b_i` after level `r`. -/
def casteljau (P : Nat → Rat) (t : Rat) : Nat → Nat → Rat
  | 0, i => P i
  | r + 1, i => (1 - t) * casteljau P t r i + t * casteljau P t r (i + 1)

/-- (c) At `t = 0` every level reproduces the first point of its window. -/
theorem casteljau_zero (P : Nat → Rat) : ∀ r i, casteljau P 0 r i = P i := by
  intro r; induction r with
  | zero => intro i; rfl
  | succ r ih => intro i; simp only [casteljau, ih]; grind

/-- (c) At `t = 1` every level reproduces the last point of its window. -/
theorem casteljau_one (P : Nat → Rat) : ∀ r i, casteljau P 1 r i = P (i + r) := by
  intro r; induction r with
  | zero => intro i; rfl
  | succ r ih =>
    intro i
    simp only [casteljau, ih]
    have e : i + 1 + r = i + (r + 1) := by omega
    rw [e]; grind

/-- (c) End-point interpolation of a degree-`p` Bezier segment. -/
theorem bezier_endpoints (P : Nat → Rat) (p : Nat) :
    casteljau P 0 p 0 = P 0 ∧ casteljau P 1 p 0 = P p := by
  refine ⟨casteljau_zero P p 0, ?_⟩
  rw [casteljau_one]; simp

/-- (c) Constant reproduction for de Casteljau. -/
theorem casteljau_const (P : Nat → Rat) (c t : Rat) (hP : ∀ i, P i = c) :
    ∀ r i, casteljau P t r i = c := by
  intro r; induction r with
  | zero => intro i; simp [casteljau, hP]
  | succ r ih => intro i; simp only [casteljau, ih]; grind

/-- Subdivision indexing sanity check (definitional, proved by `simp`): `subdivideBezier` takes
`left[k] = casteljau P t k 0` and `right[p-k] = casteljau P t k (p-k)`, so `left[0] = P 0`,
`right[p] = P p` and `left[p] = right[0]`. This does NOT prove that the halves reproduce the
segment (only the TS tests check that). -/
theorem subdivide_endpoints (P : Nat → Rat) (t : Rat) (p : Nat) :
    casteljau P t 0 0 = P 0 ∧ casteljau P t 0 p = P p ∧
      casteljau P t p (p - p) = casteljau P t p 0 := by
  simp [casteljau]

/-- On the Bezier knot vector `0^{p+1} 1^{p+1}` the de Boor triangle is the de Casteljau
triangle: `d_j` at level `r` is `b_{j-r}`. So `evaluateCurve` of a single-segment clamped curve
on `[0,1]` and `deCasteljau` compute the same affine combinations. -/
theorem deBoor_eq_casteljau (P : Nat → Rat) (p : Nat) (t : Rat) :
    ∀ r j, r ≤ j → j ≤ p →
      deBoor P (fun i => if i ≤ p then 0 else 1) p 0 t r j = casteljau P t r (j - r) := by
  intro r
  induction r with
  | zero => intro j _ _; simp [deBoor, casteljau]
  | succ r ih =>
    intro j hrj hj
    have ha : alpha (fun i => if i ≤ p then 0 else 1) p 0 t (r + 1) j = t := by
      unfold alpha
      have h1 : 0 + j ≤ p := by omega
      have h2 : ¬ (0 + j + (p + 1 - (r + 1)) ≤ p) := by omega
      simp only [h1, h2, if_true, if_false]
      grind
    simp only [deBoor, ha]
    rw [ih (j - 1) (by omega) (by omega), ih j (by omega) hj]
    simp only [casteljau]
    have e1 : j - 1 - r = j - (r + 1) := by omega
    have e2 : j - r = j - (r + 1) + 1 := by omega
    rw [e1, e2]

/-! ## Single knot insertion (Boehm, A5.1 with r = 1) -/

/-- `a_i = (ū - U[i]) / (U[i+p] - U[i])`. -/
def insAlpha (U : Nat → Rat) (p : Nat) (ub : Rat) (i : Nat) : Rat :=
  (ub - U i) / (U (i + p) - U i)

/-- New control points after inserting `ū` once into span `k`. -/
def insertedPts (P U : Nat → Rat) (p k : Nat) (ub : Rat) (i : Nat) : Rat :=
  if i + p ≤ k then P i
  else if i ≤ k then insAlpha U p ub i * P i + (1 - insAlpha U p ub i) * P (i - 1)
  else P (i - 1)

/-- New knot vector: `ū` placed at index `k + 1`. -/
def insertedKnots (U : Nat → Rat) (k : Nat) (ub : Rat) (i : Nat) : Rat :=
  if i ≤ k then U i else if i = k + 1 then ub else U (i - 1)

/-- (d) The insertion coefficients used (`k-p+1 ≤ i ≤ k`) are in `[0, 1]` for non-decreasing knots
and `U[k] ≤ ū ≤ U[k+1]`. -/
theorem insAlpha_mem_unit (U : Nat → Rat) (hU : Monotone U) (p k : Nat) (ub : Rat)
    (hlo : U k ≤ ub) (hhi : ub ≤ U (k + 1)) (i : Nat) (hi1 : k + 1 ≤ i + p) (hi2 : i ≤ k) :
    0 ≤ insAlpha U p ub i ∧ insAlpha U p ub i ≤ 1 := by
  unfold insAlpha
  apply ratio_mem_unit
  · have := hU i k hi2; grind
  · have := hU (k + 1) (i + p) hi1; grind

/-- The copy case of A5.1 with multiplicity `s > 0`: where `U[i] = ū` (A5.1's indices
`k-s+1 .. k`), the model's formula yields `P[i-1]`, exactly the point A5.1 copies. -/
theorem insertedPts_eq_prev_of_knot_eq (P U : Nat → Rat) (p k : Nat) (ub : Rat) (i : Nat)
    (hi1 : k + 1 ≤ i + p) (hi2 : i ≤ k) (hk : U i = ub) :
    insertedPts P U p k ub i = P (i - 1) := by
  have c1 : ¬ (i + p ≤ k) := by omega
  have ha : insAlpha U p ub i = 0 := by
    unfold insAlpha
    rw [hk, show ub - ub = 0 by grind, Rat.div_def, Rat.zero_mul]
  unfold insertedPts
  simp only [c1, hi2, if_false, if_true, ha]
  grind

/-- (d) Each new control point is a convex combination of its two old neighbours: it lies between
any bounds of `P[i-1]` and `P[i]` (for the copied points it is one of them). -/
theorem insertedPts_between (P U : Nat → Rat) (hU : Monotone U) (p k : Nat) (ub : Rat)
    (hlo : U k ≤ ub) (hhi : ub ≤ U (k + 1)) (i : Nat) (lo hi : Rat)
    (h1 : lo ≤ P (i - 1) ∧ P (i - 1) ≤ hi) (h2 : lo ≤ P i ∧ P i ≤ hi) :
    lo ≤ insertedPts P U p k ub i ∧ insertedPts P U p k ub i ≤ hi := by
  unfold insertedPts
  split
  · exact h2
  · split
    · have ha := insAlpha_mem_unit U hU p k ub hlo hhi i (by omega) (by omega)
      have := lerp_between lo hi (1 - insAlpha U p ub i) (P i) (P (i - 1))
        (by grind) (by grind) h2 h1
      constructor <;> grind
    · exact h1

/-- Key index identity for the insertion proof: the triangle of the new curve at `ū`
(span `k + 1`, base `s + 1`) is the old triangle shifted by one level and one column, except in
the last column where its weight is `0`. -/
theorem inserted_triangle (P U : Nat → Rat) (p s : Nat) (ub : Rat) :
    ∀ r, r ≤ p →
      (∀ j, r ≤ j → j < p →
        deBoor (insertedPts P U p (s + p) ub) (insertedKnots U (s + p) ub) p (s + 1) ub r j
          = deBoor P U p s ub (r + 1) (j + 1)) ∧
      (1 ≤ r →
        deBoor (insertedPts P U p (s + p) ub) (insertedKnots U (s + p) ub) p (s + 1) ub r p
          = deBoor P U p s ub r p) := by
  intro r
  induction r with
  | zero =>
    intro _
    refine ⟨?_, by omega⟩
    intro j _ hj
    -- level 0 of the new triangle is Q[s+1+j]; level 1 of the old one is the A5.1 combination
    simp only [deBoor, insertedPts]
    have c1 : ¬ (s + 1 + j + p ≤ s + p) := by omega
    have c2 : s + 1 + j ≤ s + p := by omega
    simp only [c1, c2, if_false, if_true]
    have e0 : s + 1 + j - 1 = s + (j + 1 - 1) := by omega
    have e1 : s + 1 + j = s + (j + 1) := by omega
    have ea : insAlpha U p ub (s + 1 + j) = alpha U p s ub (0 + 1) (j + 1) := by
      unfold insAlpha alpha
      have : s + (j + 1) + (p + 1 - (0 + 1)) = s + 1 + j + p := by omega
      rw [this, e1]
    rw [ea, e0, e1]
    grind
  | succ r ih =>
    intro hr
    have ih' := ih (by omega)
    constructor
    · intro j hrj hj
      -- the new weight equals the old weight one level and one column further
      have ea : alpha (insertedKnots U (s + p) ub) p (s + 1) ub (r + 1) j
          = alpha U p s ub (r + 1 + 1) (j + 1) := by
        unfold alpha insertedKnots
        have c1 : s + 1 + j ≤ s + p := by omega
        have c2 : ¬ (s + 1 + j + (p + 1 - (r + 1)) ≤ s + p) := by omega
        have c3 : ¬ (s + 1 + j + (p + 1 - (r + 1)) = s + p + 1) := by omega
        simp only [c1, c2, c3, if_true, if_false]
        have e1 : s + 1 + j + (p + 1 - (r + 1)) - 1 = s + (j + 1) + (p + 1 - (r + 1 + 1)) := by omega
        have e2 : s + 1 + j = s + (j + 1) := by omega
        rw [e1, e2]
      rw [deBoor_succ (insertedPts P U p (s + p) ub), ea, ih'.1 (j - 1) (by omega) (by omega),
        ih'.1 j (by omega) hj, deBoor_succ P U p s ub (r + 1) (j + 1)]
      have e3 : j - 1 + 1 = j + 1 - 1 := by omega
      rw [e3]
    · intro _
      -- last column: U'[s+1+p] = ū, so the new weight is 0
      have ea : alpha (insertedKnots U (s + p) ub) p (s + 1) ub (r + 1) p = 0 := by
        unfold alpha insertedKnots
        have c2 : s + 1 + p = s + p + 1 := by omega
        have c1 : ¬ (s + p + 1 ≤ s + p) := by omega
        rw [c2]
        simp only [c1, if_false, if_true]
        rw [show ub - ub = 0 by grind, Rat.div_def, Rat.zero_mul]
      rw [deBoor_succ (insertedPts P U p (s + p) ub), ea]
      have hprev := ih'.1 (p - 1) (by omega) (by omega)
      have e : p - 1 + 1 = p := by omega
      rw [e] at hprev
      rw [hprev]
      grind

/-- (d) Inserting `ū` once into span `k = s + p` (with `p ≥ 1`) does not move the curve point at
`ū`: the de Boor point of the new curve in its span `k + 1` equals the de Boor point of the old
curve in span `k`. This is an algebraic identity of the two triangles (no ordering hypothesis is
needed); it covers every degree `p ≥ 1`, but only the parameter `ū` itself. -/
theorem insert_preserves_point_at_inserted_param (P U : Nat → Rat) (p s : Nat) (ub : Rat)
    (hp : 1 ≤ p) :
    deBoor (insertedPts P U p (s + p) ub) (insertedKnots U (s + p) ub) p (s + 1) ub p p
      = deBoor P U p s ub p p :=
  (inserted_triangle P U p s ub p (Nat.le_refl p)).2 hp

/-- The degree-1 and degree-2 instances spelled out. -/
theorem insert_preserves_point_deg1 (P U : Nat → Rat) (s : Nat) (ub : Rat) :
    deBoor (insertedPts P U 1 (s + 1) ub) (insertedKnots U (s + 1) ub) 1 (s + 1) ub 1 1
      = deBoor P U 1 s ub 1 1 :=
  insert_preserves_point_at_inserted_param P U 1 s ub (by omega)

theorem insert_preserves_point_deg2 (P U : Nat → Rat) (s : Nat) (ub : Rat) :
    deBoor (insertedPts P U 2 (s + 2) ub) (insertedKnots U (s + 2) ub) 2 (s + 1) ub 2 2
      = deBoor P U 2 s ub 2 2 :=
  insert_preserves_point_at_inserted_param P U 2 s ub (by omega)

end Nurbs
end CadloomFormal
