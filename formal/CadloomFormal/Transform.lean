/-
Transform: the rational model of `src/math/transform.ts`.

An affine map of 3-space is a 3x4 matrix `[L | t]` stored row-major, acting on column vectors:
`applyPoint f p = L p + t`, `applyVector f v = L v`. `Aff` holds the twelve entries `mij` with the
same indices as the TS tuple `m[4 * i + j]`.

Modelled (same formulas as the TS):
* `compose f g` is `compose(f, g)`, "first `g`, then `f`": linear part `Lf Lg`, translation
  `Lf tg + tf`. Theorems: `apply_compose`, `applyVector_compose`, `compose_assoc`, identity laws.
* `det` is `determinant`, the cofactor expansion of `L` along its first row (translation
  ignored). Theorem `det_compose`: `det (compose f g) = det f * det g`.
* `inverse f` is `inverse(t)`: linear part `adj(L) / det` (columns the cross products
  `r1 × r2`, `r2 × r0`, `r0 × r1` of the rows `ri`), translation `-(L⁻¹ t)`. Theorems
  `apply_inverse_left` / `apply_inverse_right` (for `det ≠ 0`) and `det_inverse`.
  The TS first scales the rows by powers of two `d_i` (`S = diag d0 d1 d2`) and returns
  `compose (inverse (compose S f)) S`; `compose_diag_left` / `compose_diag_right` show these are
  the TS's row and column scalings, and `apply_inverse_scaled_left` / `_right` prove the result is
  still the two-sided inverse of `f`.
* `translation`, `scaling` (about a centre) and `rodrigues` (the rotation matrix
  `c I + s [k]× + (1 - c) k kᵀ` from `c = cos θ`, `s = sin θ` and the unit axis `k`, about a
  point). Theorems: `det_translation`, `det_scaling`, `scaling_fixes_center`, and, under the
  hypotheses `c² + s² = 1` and `|k|² = 1` that the TS gets from `Math.cos`/`Math.sin` and the
  normalised axis (only approximately in floating point), `rodrigues_det` (= 1),
  `rodrigues_fixes_axis` and `rodrigues_preserves_dot` (the map is an isometry).

NOT covered: floating-point rounding (the TS computes in doubles, so e.g. `compose` is only
approximately associative there), the trigonometric functions themselves, normalisation by a
square root, the TS singularity test (an exact dyadic determinant sign), the choice of the
power-of-two scale factors, and `Result` errors (overflow / ill-conditioning checks).
-/
namespace CadloomFormal
namespace Transform

structure P3 where
  x : Rat
  y : Rat
  z : Rat

def P3.dot (a b : P3) : Rat := a.x * b.x + a.y * b.y + a.z * b.z

/-- Row-major 3x4 affine matrix: `m[4 * i + j]` is `mij`. -/
structure Aff where
  m00 : Rat
  m01 : Rat
  m02 : Rat
  m03 : Rat
  m10 : Rat
  m11 : Rat
  m12 : Rat
  m13 : Rat
  m20 : Rat
  m21 : Rat
  m22 : Rat
  m23 : Rat

namespace Aff

def identity : Aff := ⟨1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0⟩

def applyPoint (f : Aff) (p : P3) : P3 :=
  ⟨f.m00 * p.x + f.m01 * p.y + f.m02 * p.z + f.m03,
   f.m10 * p.x + f.m11 * p.y + f.m12 * p.z + f.m13,
   f.m20 * p.x + f.m21 * p.y + f.m22 * p.z + f.m23⟩

def applyVector (f : Aff) (v : P3) : P3 :=
  ⟨f.m00 * v.x + f.m01 * v.y + f.m02 * v.z,
   f.m10 * v.x + f.m11 * v.y + f.m12 * v.z,
   f.m20 * v.x + f.m21 * v.y + f.m22 * v.z⟩

/-- First `g`, then `f`. -/
def compose (f g : Aff) : Aff :=
  ⟨f.m00 * g.m00 + f.m01 * g.m10 + f.m02 * g.m20,
   f.m00 * g.m01 + f.m01 * g.m11 + f.m02 * g.m21,
   f.m00 * g.m02 + f.m01 * g.m12 + f.m02 * g.m22,
   f.m00 * g.m03 + f.m01 * g.m13 + f.m02 * g.m23 + f.m03,
   f.m10 * g.m00 + f.m11 * g.m10 + f.m12 * g.m20,
   f.m10 * g.m01 + f.m11 * g.m11 + f.m12 * g.m21,
   f.m10 * g.m02 + f.m11 * g.m12 + f.m12 * g.m22,
   f.m10 * g.m03 + f.m11 * g.m13 + f.m12 * g.m23 + f.m13,
   f.m20 * g.m00 + f.m21 * g.m10 + f.m22 * g.m20,
   f.m20 * g.m01 + f.m21 * g.m11 + f.m22 * g.m21,
   f.m20 * g.m02 + f.m21 * g.m12 + f.m22 * g.m22,
   f.m20 * g.m03 + f.m21 * g.m13 + f.m22 * g.m23 + f.m23⟩

/-- Determinant of the linear part, cofactor expansion along the first row. -/
def det (f : Aff) : Rat :=
  f.m00 * (f.m11 * f.m22 - f.m12 * f.m21)
  - f.m01 * (f.m10 * f.m22 - f.m12 * f.m20)
  + f.m02 * (f.m10 * f.m21 - f.m11 * f.m20)

/-- `inverse`: `L⁻¹ = adj(L) / det`, translation `-(L⁻¹ t)`. -/
def inverse (f : Aff) : Aff :=
  let d := det f
  -- adjugate entries: column j of adj(L) is the cross product of the other two rows
  let a00 := (f.m11 * f.m22 - f.m12 * f.m21) / d
  let a01 := (f.m02 * f.m21 - f.m01 * f.m22) / d
  let a02 := (f.m01 * f.m12 - f.m02 * f.m11) / d
  let a10 := (f.m12 * f.m20 - f.m10 * f.m22) / d
  let a11 := (f.m00 * f.m22 - f.m02 * f.m20) / d
  let a12 := (f.m02 * f.m10 - f.m00 * f.m12) / d
  let a20 := (f.m10 * f.m21 - f.m11 * f.m20) / d
  let a21 := (f.m01 * f.m20 - f.m00 * f.m21) / d
  let a22 := (f.m00 * f.m11 - f.m01 * f.m10) / d;
  ⟨a00, a01, a02, -(a00 * f.m03 + a01 * f.m13 + a02 * f.m23),
   a10, a11, a12, -(a10 * f.m03 + a11 * f.m13 + a12 * f.m23),
   a20, a21, a22, -(a20 * f.m03 + a21 * f.m13 + a22 * f.m23)⟩

def translation (v : P3) : Aff := ⟨1, 0, 0, v.x, 0, 1, 0, v.y, 0, 0, 1, v.z⟩

/-- Scaling by `(sx, sy, sz)` about `c`: `p ↦ c + S (p - c)`, translation `c - S c`. -/
def scaling (sx sy sz : Rat) (c : P3) : Aff :=
  ⟨sx, 0, 0, c.x - sx * c.x, 0, sy, 0, c.y - sy * c.y, 0, 0, sz, c.z - sz * c.z⟩

/-- Rodrigues: `R = c I + s [k]× + (1 - c) k kᵀ` about the point `o` (translation `o - R o`). -/
def rodrigues (k : P3) (c s : Rat) (o : P3) : Aff :=
  let v := 1 - c
  let r00 := c + k.x * k.x * v
  let r01 := k.x * k.y * v - k.z * s
  let r02 := k.x * k.z * v + k.y * s
  let r10 := k.y * k.x * v + k.z * s
  let r11 := c + k.y * k.y * v
  let r12 := k.y * k.z * v - k.x * s
  let r20 := k.z * k.x * v - k.y * s
  let r21 := k.z * k.y * v + k.x * s
  let r22 := c + k.z * k.z * v;
  ⟨r00, r01, r02, o.x - (r00 * o.x + r01 * o.y + r02 * o.z),
   r10, r11, r12, o.y - (r10 * o.x + r11 * o.y + r12 * o.z),
   r20, r21, r22, o.z - (r20 * o.x + r21 * o.y + r22 * o.z)⟩

/-! ## Composition -/

theorem apply_compose (f g : Aff) (p : P3) :
    applyPoint (compose f g) p = applyPoint f (applyPoint g p) := by
  simp only [applyPoint, compose, P3.mk.injEq]; grind

theorem applyVector_compose (f g : Aff) (v : P3) :
    applyVector (compose f g) v = applyVector f (applyVector g v) := by
  simp only [applyVector, compose, P3.mk.injEq]; grind

theorem compose_assoc (f g h : Aff) : compose (compose f g) h = compose f (compose g h) := by
  simp only [compose, Aff.mk.injEq]; and_intros <;> grind

theorem compose_id_left (f : Aff) : compose identity f = f := by
  cases f; simp only [compose, identity, Aff.mk.injEq]; and_intros <;> grind

theorem compose_id_right (f : Aff) : compose f identity = f := by
  cases f; simp only [compose, identity, Aff.mk.injEq]; and_intros <;> grind

theorem apply_identity (p : P3) : applyPoint identity p = p := by
  cases p; simp only [applyPoint, identity, P3.mk.injEq]; grind

/-- The vector map ignores translation: it is the difference of two point images. -/
theorem applyVector_eq_sub (f : Aff) (p q : P3) :
    applyVector f ⟨p.x - q.x, p.y - q.y, p.z - q.z⟩ =
      ⟨(applyPoint f p).x - (applyPoint f q).x, (applyPoint f p).y - (applyPoint f q).y,
       (applyPoint f p).z - (applyPoint f q).z⟩ := by
  simp only [applyVector, applyPoint, P3.mk.injEq]; grind

/-! ## Determinant -/

theorem det_compose (f g : Aff) : det (compose f g) = det f * det g := by
  simp only [det, compose]; grind

theorem det_identity : det identity = 1 := by simp only [det, identity]; grind

theorem det_translation (v : P3) : det (translation v) = 1 := by
  simp only [det, translation]; grind

theorem det_scaling (sx sy sz : Rat) (c : P3) : det (scaling sx sy sz c) = sx * sy * sz := by
  simp only [det, scaling]; grind

theorem scaling_fixes_center (sx sy sz : Rat) (c : P3) : applyPoint (scaling sx sy sz c) c = c := by
  cases c; simp only [applyPoint, scaling, P3.mk.injEq]; grind

theorem translation_apply (v p : P3) :
    applyPoint (translation v) p = ⟨p.x + v.x, p.y + v.y, p.z + v.z⟩ := by
  simp only [applyPoint, translation, P3.mk.injEq]; grind

/-! ## Inverse -/

theorem apply_inverse_left (f : Aff) (h : det f ≠ 0) (p : P3) :
    applyPoint (inverse f) (applyPoint f p) = p := by
  have hd : det f * (det f)⁻¹ = 1 := Rat.mul_inv_cancel _ h
  cases p
  simp only [applyPoint, inverse, P3.mk.injEq, Rat.div_def]
  generalize (det f)⁻¹ = e at hd ⊢
  simp only [det] at hd
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem apply_inverse_right (f : Aff) (h : det f ≠ 0) (p : P3) :
    applyPoint f (applyPoint (inverse f) p) = p := by
  have hd : det f * (det f)⁻¹ = 1 := Rat.mul_inv_cancel _ h
  cases p
  simp only [applyPoint, inverse, P3.mk.injEq, Rat.div_def]
  generalize (det f)⁻¹ = e at hd ⊢
  simp only [det] at hd
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem det_inverse (f : Aff) (h : det f ≠ 0) : det (inverse f) * det f = 1 := by
  simp only [det, inverse]
  simp only [det] at h
  grind

/-! ## The scaled inverse that the TS computes

`inverse(f)` in TS first scales row `i` of `[L | t]` by `d_i = 2^-k_i` (that is `compose S f` with
`S = scaling d0 d1 d2 0`), inverts that with the adjugate formula, then multiplies column `j` of the
linear part by `d_j` and keeps the translation (that is `compose (inverse (compose S f)) S`). -/

/-- The row scaling `S` of the TS `inverse` (no translation). -/
def diag (d0 d1 d2 : Rat) : Aff := scaling d0 d1 d2 ⟨0, 0, 0⟩

/-- `compose S f` scales whole rows of `[L | t]`, as the TS `row(i, j)` does. -/
theorem compose_diag_left (d0 d1 d2 : Rat) (f : Aff) :
    compose (diag d0 d1 d2) f =
      ⟨d0 * f.m00, d0 * f.m01, d0 * f.m02, d0 * f.m03,
       d1 * f.m10, d1 * f.m11, d1 * f.m12, d1 * f.m13,
       d2 * f.m20, d2 * f.m21, d2 * f.m22, d2 * f.m23⟩ := by
  simp only [compose, diag, scaling, Aff.mk.injEq]; and_intros <;> grind

/-- `compose g S` multiplies column `j` of the linear part by `d_j` and keeps the translation, as
the final step of the TS `inverse` does. -/
theorem compose_diag_right (g : Aff) (d0 d1 d2 : Rat) :
    compose g (diag d0 d1 d2) =
      ⟨g.m00 * d0, g.m01 * d1, g.m02 * d2, g.m03,
       g.m10 * d0, g.m11 * d1, g.m12 * d2, g.m13,
       g.m20 * d0, g.m21 * d1, g.m22 * d2, g.m23⟩ := by
  simp only [compose, diag, scaling, Aff.mk.injEq]; and_intros <;> grind

theorem diag_injective (d0 d1 d2 : Rat) (h0 : d0 ≠ 0) (h1 : d1 ≠ 0) (h2 : d2 ≠ 0) (p q : P3)
    (h : applyPoint (diag d0 d1 d2) p = applyPoint (diag d0 d1 d2) q) : p = q := by
  cases p; cases q
  simp only [applyPoint, diag, scaling, P3.mk.injEq] at h ⊢
  obtain ⟨hx, hy, hz⟩ := h
  refine ⟨?_, ?_, ?_⟩
  · have := Rat.mul_inv_cancel _ h0; grind
  · have := Rat.mul_inv_cancel _ h1; grind
  · have := Rat.mul_inv_cancel _ h2; grind

/-- The row-scaled inverse the TS computes is a left inverse of `f`. -/
theorem apply_inverse_scaled_left (f : Aff) (d0 d1 d2 : Rat) (h : det f ≠ 0)
    (h0 : d0 ≠ 0) (h1 : d1 ≠ 0) (h2 : d2 ≠ 0) (p : P3) :
    applyPoint (compose (inverse (compose (diag d0 d1 d2) f)) (diag d0 d1 d2)) (applyPoint f p) = p := by
  have hS : det (diag d0 d1 d2) ≠ 0 := by
    rw [diag, det_scaling]; intro e
    rcases Rat.mul_eq_zero.mp e with e | e
    · rcases Rat.mul_eq_zero.mp e with e | e <;> contradiction
    · contradiction
  have hd : det (compose (diag d0 d1 d2) f) ≠ 0 := by
    rw [det_compose]; intro e; rcases Rat.mul_eq_zero.mp e with e | e <;> contradiction
  rw [apply_compose, ← apply_compose (diag d0 d1 d2) f]
  exact apply_inverse_left _ hd p

/-- ... and a right inverse. -/
theorem apply_inverse_scaled_right (f : Aff) (d0 d1 d2 : Rat) (h : det f ≠ 0)
    (h0 : d0 ≠ 0) (h1 : d1 ≠ 0) (h2 : d2 ≠ 0) (p : P3) :
    applyPoint f (applyPoint (compose (inverse (compose (diag d0 d1 d2) f)) (diag d0 d1 d2)) p) = p := by
  have hS : det (diag d0 d1 d2) ≠ 0 := by
    rw [diag, det_scaling]; intro e
    rcases Rat.mul_eq_zero.mp e with e | e
    · rcases Rat.mul_eq_zero.mp e with e | e <;> contradiction
    · contradiction
  have hd : det (compose (diag d0 d1 d2) f) ≠ 0 := by
    rw [det_compose]; intro e; rcases Rat.mul_eq_zero.mp e with e | e <;> contradiction
  apply diag_injective d0 d1 d2 h0 h1 h2
  rw [apply_compose, ← apply_compose (diag d0 d1 d2) f]
  exact apply_inverse_right _ hd _

/-! ## Rotation -/

theorem rodrigues_det (k : P3) (c s : Rat) (o : P3)
    (hk : k.x * k.x + k.y * k.y + k.z * k.z = 1) (hcs : c * c + s * s = 1) :
    det (rodrigues k c s o) = 1 := by
  simp only [det, rodrigues]; grind

theorem rodrigues_fixes_axis (k : P3) (c s : Rat) (o : P3)
    (hk : k.x * k.x + k.y * k.y + k.z * k.z = 1) :
    applyVector (rodrigues k c s o) k = k := by
  cases k; simp only [applyVector, rodrigues, P3.mk.injEq] at *; refine ⟨?_, ?_, ?_⟩ <;> grind

theorem rodrigues_fixes_origin (k : P3) (c s : Rat) (o : P3) :
    applyPoint (rodrigues k c s o) o = o := by
  cases o; simp only [applyPoint, rodrigues, P3.mk.injEq]; grind

theorem rodrigues_preserves_dot (k : P3) (c s : Rat) (o u v : P3)
    (hk : k.x * k.x + k.y * k.y + k.z * k.z = 1) (hcs : c * c + s * s = 1) :
    P3.dot (applyVector (rodrigues k c s o) u) (applyVector (rodrigues k c s o) v) = P3.dot u v := by
  simp only [P3.dot, applyVector, rodrigues]; grind

end Aff
end Transform
end CadloomFormal
