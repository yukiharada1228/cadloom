import CadloomFormal.Nurbs

/-!
NurbsSurface: the exact rational model of tensor-product surface evaluation, isoparametric curve
extraction and Bezier degree elevation in `src/nurbs/surface.ts` and `src/nurbs/elevate.ts`.

What each part models (TypeScript → Lean):

* `evaluateSurface` (`src/nurbs/surface.ts`) → `tensor`. The TS code finds the spans
  `spanU`, `spanV`, runs the M0 `deBoorPoint` over u on each column `j = sv..sv+q` of the net
  (`columnPointsAt`, base `su = spanU - p`), then the M0 `deBoorPoint` over v on those points (base
  `sv = spanV - q`). `deBoorPoint` is `Nurbs.deBoor … p p` (see `Nurbs.lean`), so the TS value is
  `deBoor (fun j => deBoor (fun i => P i j) U p su u p p) V q sv v q q` = `tensor`.
  Rational surfaces run the same scheme on homogeneous coordinates (one more coordinate).
* `isoparametricCurve(s, 'u', u)` → `isoU`: control point `j` is the column de Boor value at `u`
  for every `j` (same `su`); the curve, evaluated by the M0 `evaluateCurve` at `v` with the span
  `sv` from `findSpan` on the same knots `V`, is `deBoor (isoU …) V q sv v q q`.
* `isoparametricCurve(s, 'v', v)` → `isoV`: control point `i` is the row de Boor value at `v`.
* `elevateBezier` (one step, `src/nurbs/elevate.ts`, private `elevateOnce`) → `elev`:
  `Q[i] = (i/(p+1)) P[i-1] + (1 - i/(p+1)) P[i]` for `i = 1..p`; the TS sets `Q[0] = P[0]` and
  `Q[p+1] = P[p]` directly, which is what `elev` gives at `i = 0` and `i = p + 1`
  (`elev_first`, `elev_last`).

Theorems (TS tests with the same names check the property on the implementation):

* `deBoor_lin` — de Boor is linear in the control points (`deBoor (a F + b G) = a deBoor F + b deBoor G`).
* `deBoor_smul` — `deBoor (c F) = c deBoor F`.
* `tensor_comm` — the two orders (columns-then-row, rows-then-column) give the same triangle
  entries at every level; in particular the surface value does not depend on the order.
* `tensor_const` — partition of unity: a constant net gives that constant.
* `tensor_affine` — `tensor (a P + b) = a tensor P + b`.
* `tensor_row_only` — if `P i j` depends only on `i`, the surface is the u-curve of that column.
* `tensor_col_only` — if `P i j` depends only on `j`, the surface is the v-curve of that row.
* `tensor_product` — `P i j = A i * B j` gives `(de Boor of A at u) * (de Boor of B at v)`.
* `isoU_consistent` — evaluating the u = const iso curve at `v` equals the surface at `(u, v)`.
* `isoV_consistent` — evaluating the v = const iso curve at `u` equals the surface at `(u, v)`.
* `tensor_between` — convex hull: with sorted knots and `u`, `v` in their spans, bounds on the
  `(p+1) x (q+1)` window of the net bound the surface value.
* `elev_first`, `elev_last` — `Q[0] = P[0]`, `Q[p+1] = P[p]` for every `p`.
* `elev_const` — the elevated polygon of a constant polygon is constant (every `p`, every `i`).
* `elev_between` — every `Q[i]`, `1 ≤ i ≤ p`, lies between bounds of `P[i-1]` and `P[i]`.
* `elev_deg1_casteljau`, `elev_deg2_casteljau` — elevation 1 → 2 and 2 → 3 leaves the de Casteljau
  value unchanged for every `t` (symbolic over `Rat`).

NOT covered: IEEE-754 rounding, `Result` errors, array bounds, `findSpan` (spans are hypotheses
or parameters), the basis-function evaluation (A3.5/A4.3) and its agreement with the tensor
de Boor, partial derivatives (A3.6/A4.4), the normal, the rational quotient, knot insertion on
surfaces (it is the M0 curve insertion per row, see `Nurbs.lean`), the elevation matrix with
`t > 1`, Bezier elevation preserving the curve for degree `p ≥ 3`, and the B-spline curve degree
elevation A5.9 (checked only by sampling tests).
-/
namespace CadloomFormal
namespace NurbsSurface

open Nurbs

/-! ## Linearity of de Boor -/

/-- de Boor is linear in the control points. -/
theorem deBoor_lin (F G U : Nat → Rat) (a b : Rat) (p s : Nat) (u : Rat) :
    ∀ r j, deBoor (fun i => a * F i + b * G i) U p s u r j
      = a * deBoor F U p s u r j + b * deBoor G U p s u r j := by
  intro r
  induction r with
  | zero => intro j; simp [deBoor]
  | succ r ih => intro j; simp only [deBoor, ih]; grind

/-- de Boor commutes with scaling. -/
theorem deBoor_smul (F U : Nat → Rat) (c : Rat) (p s : Nat) (u : Rat) :
    ∀ r j, deBoor (fun i => c * F i) U p s u r j = c * deBoor F U p s u r j := by
  intro r
  induction r with
  | zero => intro j; simp [deBoor]
  | succ r ih => intro j; simp only [deBoor, ih]; grind

/-! ## Tensor-product de Boor -/

/-- The surface point: de Boor over u of every column `j`, then de Boor over v
(`evaluateSurface`). `su = spanU - p`, `sv = spanV - q`. -/
def tensor (P : Nat → Nat → Rat) (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) : Rat :=
  deBoor (fun j => deBoor (fun i => P i j) U p su u p p) V q sv v q q

/-- Control points of the iso curve `u = const` (a curve in v): column de Boor values. -/
def isoU (P : Nat → Nat → Rat) (U : Nat → Rat) (p su : Nat) (u : Rat) (j : Nat) : Rat :=
  deBoor (fun i => P i j) U p su u p p

/-- Control points of the iso curve `v = const` (a curve in u): row de Boor values. -/
def isoV (P : Nat → Nat → Rat) (V : Nat → Rat) (q sv : Nat) (v : Rat) (i : Nat) : Rat :=
  deBoor (fun j => P i j) V q sv v q q

/-- The two evaluation orders agree entry by entry, at every pair of levels. -/
theorem tensor_comm (P : Nat → Nat → Rat) (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    ∀ r1 j1 r2 j2,
      deBoor (fun j => deBoor (fun i => P i j) U p su u r1 j1) V q sv v r2 j2
        = deBoor (fun i => deBoor (fun j => P i j) V q sv v r2 j2) U p su u r1 j1 := by
  intro r1
  induction r1 with
  | zero => intro j1 r2 j2; rfl
  | succ r1 ih =>
    intro j1 r2 j2
    have hl := deBoor_lin (fun j => deBoor (fun i => P i j) U p su u r1 (j1 - 1))
      (fun j => deBoor (fun i => P i j) U p su u r1 j1) V
      (1 - alpha U p su u (r1 + 1) j1) (alpha U p su u (r1 + 1) j1) q sv v r2 j2
    simp only [deBoor_succ (fun i => P i _) U p su u r1 j1]
    rw [hl, ih (j1 - 1) r2 j2, ih j1 r2 j2]
    rfl

/-- Partition of unity: a constant net gives the constant. -/
theorem tensor_const (P : Nat → Nat → Rat) (c : Rat) (hP : ∀ i j, P i j = c)
    (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    tensor P U V p q su sv u v = c := by
  unfold tensor
  apply deBoor_const _ V c _ q sv v q q
  intro j
  exact deBoor_const _ U c (fun i => hP i j) p su u p p

/-- Affine invariance. -/
theorem tensor_affine (P : Nat → Nat → Rat) (a b : Rat)
    (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    tensor (fun i j => a * P i j + b) U V p q su sv u v = a * tensor P U V p q su sv u v + b := by
  unfold tensor
  have inner : (fun j => deBoor (fun i => a * P i j + b) U p su u p p)
      = (fun j => a * deBoor (fun i => P i j) U p su u p p + b) := by
    funext j
    exact deBoor_affine (fun i => P i j) U a b p su u p p
  rw [inner]
  exact deBoor_affine _ V a b q sv v q q

/-- Separability (u only): `P i j = f i` gives the u-curve of `f`. -/
theorem tensor_row_only (P : Nat → Nat → Rat) (f : Nat → Rat) (hP : ∀ i j, P i j = f i)
    (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    tensor P U V p q su sv u v = deBoor f U p su u p p := by
  unfold tensor
  apply deBoor_const _ V _ _ q sv v q q
  intro j
  have : (fun i => P i j) = f := by funext i; exact hP i j
  rw [this]

/-- Separability (v only): `P i j = g j` gives the v-curve of `g`. -/
theorem tensor_col_only (P : Nat → Nat → Rat) (g : Nat → Rat) (hP : ∀ i j, P i j = g j)
    (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    tensor P U V p q su sv u v = deBoor g V q sv v q q := by
  unfold tensor
  have : (fun j => deBoor (fun i => P i j) U p su u p p) = g := by
    funext j
    exact deBoor_const _ U (g j) (fun i => hP i j) p su u p p
  rw [this]

/-- Separability (product): `P i j = A i * B j` gives the product of the two curves. -/
theorem tensor_product (A B : Nat → Rat) (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    tensor (fun i j => A i * B j) U V p q su sv u v
      = deBoor A U p su u p p * deBoor B V q sv v q q := by
  unfold tensor
  have inner : (fun j => deBoor (fun i => A i * B j) U p su u p p)
      = (fun j => deBoor A U p su u p p * B j) := by
    funext j
    have h := deBoor_smul A U (B j) p su u p p
    have e : (fun i => A i * B j) = (fun i => B j * A i) := by funext i; grind
    rw [e, h]; grind
  rw [inner]
  exact deBoor_smul B V _ q sv v q q

/-- Iso curve `u = const`: evaluating it at `v` (same knots `V`, same span) is the surface. -/
theorem isoU_consistent (P : Nat → Nat → Rat) (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    deBoor (isoU P U p su u) V q sv v q q = tensor P U V p q su sv u v := rfl

/-- Iso curve `v = const`: evaluating it at `u` (same knots `U`, same span) is the surface. -/
theorem isoV_consistent (P : Nat → Nat → Rat) (U V : Nat → Rat) (p q su sv : Nat) (u v : Rat) :
    deBoor (isoV P V q sv v) U p su u p p = tensor P U V p q su sv u v := by
  unfold isoV tensor
  exact (tensor_comm P U V p q su sv u v p p q q).symm

/-- Convex hull: with sorted knots and `u`, `v` in spans `su + p`, `sv + q`, bounds on the window
`P[su..su+p][sv..sv+q]` bound the surface point. -/
theorem tensor_between (P : Nat → Nat → Rat) (U V : Nat → Rat) (hU : Monotone U) (hV : Monotone V)
    (p q su sv : Nat) (u v : Rat)
    (hul : U (su + p) ≤ u) (huh : u ≤ U (su + p + 1))
    (hvl : V (sv + q) ≤ v) (hvh : v ≤ V (sv + q + 1)) (lo hi : Rat)
    (hP : ∀ i j, su ≤ i → i ≤ su + p → sv ≤ j → j ≤ sv + q → lo ≤ P i j ∧ P i j ≤ hi) :
    lo ≤ tensor P U V p q su sv u v ∧ tensor P U V p q su sv u v ≤ hi := by
  unfold tensor
  apply deBoor_between _ V hV q sv v hvl hvh lo hi _ q q (Nat.le_refl q) (Nat.le_refl q)
  intro j hj1 hj2
  exact deBoor_between (fun i => P i j) U hU p su u hul huh lo hi
    (fun i hi1 hi2 => hP i j hi1 hi2 hj1 hj2) p p (Nat.le_refl p) (Nat.le_refl p)

/-! ## Bezier degree elevation (one step) -/

/-- `Q[i] = (i/(p+1)) P[i-1] + (1 - i/(p+1)) P[i]` (natural subtraction: at `i = 0` the first
coefficient is `0`). -/
def elev (P : Nat → Rat) (p i : Nat) : Rat :=
  ((i : Rat) / ((p : Rat) + 1)) * P (i - 1) + (1 - (i : Rat) / ((p : Rat) + 1)) * P i

theorem elev_first (P : Nat → Rat) (p : Nat) : elev P p 0 = P 0 := by
  simp [elev]
  rw [Rat.div_def, Rat.zero_mul]
  grind

theorem elev_last (P : Nat → Rat) (p : Nat) : elev P p (p + 1) = P p := by
  unfold elev
  have hne : ((p : Rat) + 1) ≠ 0 := by
    have : (0 : Rat) ≤ (p : Rat) := by exact_mod_cast Nat.zero_le p
    grind
  have hc : (((p + 1 : Nat) : Rat)) = (p : Rat) + 1 := by simp
  have h1 : (((p + 1 : Nat) : Rat)) / ((p : Rat) + 1) = 1 := by
    rw [hc, Rat.div_def]
    exact Rat.mul_inv_cancel _ hne
  rw [h1]
  simp only [Nat.add_sub_cancel]
  grind

theorem elev_const (P : Nat → Rat) (c : Rat) (hP : ∀ i, P i = c) (p i : Nat) : elev P p i = c := by
  simp only [elev, hP]; grind

/-- For `1 ≤ i ≤ p` the coefficient `i/(p+1)` lies in `[0, 1]`, so `Q[i]` lies between bounds of
its two neighbours `P[i-1]`, `P[i]`. -/
theorem elev_between (P : Nat → Rat) (p i : Nat) (hip : i ≤ p) (lo hi : Rat)
    (h1 : lo ≤ P (i - 1) ∧ P (i - 1) ≤ hi) (h2 : lo ≤ P i ∧ P i ≤ hi) :
    lo ≤ elev P p i ∧ elev P p i ≤ hi := by
  have hu := ratio_mem_unit (i : Rat) ((p : Rat) + 1)
    (by exact_mod_cast Nat.zero_le i)
    (by have : (i : Rat) ≤ (p : Rat) := by exact_mod_cast hip
        grind)
  have := lerp_between lo hi (1 - (i : Rat) / ((p : Rat) + 1)) (P (i - 1)) (P i)
    (by grind) (by grind) h1 h2
  unfold elev
  constructor <;> grind

/-- Degree 1 → 2 preserves the Bezier curve (de Casteljau value) at every `t`. -/
theorem elev_deg1_casteljau (P : Nat → Rat) (t : Rat) :
    casteljau (elev P 1) t 2 0 = casteljau P t 1 0 := by
  simp [casteljau, elev]
  grind

/-- Degree 2 → 3 preserves the Bezier curve (de Casteljau value) at every `t`. -/
theorem elev_deg2_casteljau (P : Nat → Rat) (t : Rat) :
    casteljau (elev P 2) t 3 0 = casteljau P t 2 0 := by
  simp [casteljau, elev]
  grind

end NurbsSurface
end CadloomFormal
