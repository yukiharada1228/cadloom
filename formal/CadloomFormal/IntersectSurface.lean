import CadloomFormal.Foundation
import CadloomFormal.Surface
/-
IntersectSurface: the exact rational model of the closed forms and the linear algebra of the
surface/surface intersector (`src/intersect/ssi-*.ts`, `surface-surface.ts`).

Core Lean has no reals: square roots and the cosine/sine pair are rational variables with their
defining hypotheses (`h * h = (r1 - x) * (r1 + x)`, `D * D = dx² + dz²`, `cu² + su² = 1`). The
formulas are those of the TypeScript code, in the same order.

What each theorem models (TypeScript → Lean):

* `planePlanePoint` (`ssi-exact.ts`), plane/plane: with `w = n1 × n2`, the TS point
  `P = (d1 (n2 × w) + d2 (w × n1)) / (w·w)`:
  - `plane_plane_num_first` / `plane_plane_num_second`: `n_i · (d1 (n2 × w) + d2 (w × n1)) = d_i (w·w)`
    (no hypothesis);
  - `plane_plane_point_on_first` / `plane_plane_point_on_second`: `w·w ≠ 0 → n_i · P = d_i`
    (the point lies on both planes);
  - `plane_plane_dir_orth`: the direction `w` is orthogonal to both normals (it lies in both planes).
* plane/sphere (`ssi-revolution.ts`, the plane ray against the sphere's meridian circle about the
  axis through the center along the plane normal):
  - `plane_sphere_center_eq_ts`: for a unit normal, `c - ((n·c - d)/(n·n)) n = c + ((O - c)·n) n`,
    the TS center `A + h Z` with `A = c`, `Z = n`, `h = (O - c)·n`, `d = n·O`;
  - `plane_sphere_center_on_plane`: `n·n ≠ 0 → n · c' = d`;
  - `plane_sphere_circle_on_sphere`: every `p` of the plane with `|p - c'|² = ρ²`, where
    `ρ² = r² - s² (n·n)` and `s = (n·c - d)/(n·n)` (the TS distance `dist = s` for a unit normal),
    satisfies `|p - c|² = r²`;
  - `plane_sphere_rho_ts`: the TS compensated form `(r - a)(r + a) = r² - s²` when `a² = s²`
    (`a = |dist|`).
* the marching tangent (`ssi-march.ts`, `marchTangent`, `SINGULAR_SIN`):
  - `march_tangent_orth`: `t = n1 × n2` has `t·n1 = 0` and `t·n2 = 0`;
  - `cross_parallel_zero`: `n2 = k n1 → n1 × n2 = 0` (parallel normals give no direction);
  - `lagrange_identity`: `|a × b|² = |a|²|b|² - (a·b)²`;
  - `unit_cross_sq`: for unit normals `|n1 × n2|² = 1 - (n1·n2)²` (the TS `sin`);
  - `cross_zero_cauchy`: `a × b = 0 → (a·b)² = |a|²|b|²` (equality in Cauchy–Schwarz: parallel).
* plane/cylinder square to the axis (`ssi-revolution.ts`: the plane ray `z = h`,
  `h = (O - A)·Z`, meets the cylinder's meridian line `ρ = r`; the circle `A + h Z + r (cu X + su Y)`):
  - `plane_cylinder_perp_on_both`: its points satisfy the plane equation `n·p = n·O` for `n = σ Z`
    (any `σ`, in the TS `±1`), and the M1 cylinder implicit form `|p - A|² - ((p - A)·Z)² = r²` (Surface
    `cylinder_on_implicit`).
* the meridian intersections (`ssi-revolution.ts`):
  - `meridian_line_line`: `lineLine`'s `λ = (w × d2)/(d1 × d2)`, `μ = (w × d1)/(d1 × d2)`
    (`w = p2 - p1`, 2D cross) give `p1 + λ d1 = p2 + μ d2` when `d1 × d2 ≠ 0`;
  - `sphere_sphere_on_both`: `circleCircle`'s radical point `f ± h u⊥`, `f = c1 + x u`,
    `u = (c2 - c1)/D`, `x = (D² + r1² - r2²)/(2D)`, `h² = (r1 - x)(r1 + x)`, lies on both circles
    (`|q - c1|² = r1²`, `|q - c2|² = r2²`); the meridians of two spheres (and of a sphere and a
    torus) about a common axis.
* the linear solves (`linalg.ts`):
  - `solveSym2_spec`: `solveSym2`'s `x = (c f - b g)/D`, `y = (a g - b f)/D`, `D = ac - b² ≠ 0`
    solve `[[a, b], [b, c]] (x, y) = (f, g)` (the predictor's and `footOn`'s normal equations, the
    contact Newton step);
  - `solve3_spec`: `solve3`'s cofactor formulas solve `M y = r` when `det3 M ≠ 0` (the fixed-
    parameter corrector);
  - `minNormStep_spec`: if `y` solves the TS Gram system (`gram` of `linalg.ts`: entries
    `xx = Σ_k c_k.x c_k.x`, ..., as `solve3` returns it), the step `Δ_k = c_k · y` satisfies
    `Σ_k Δ_k c_k = b`, i.e. `J Δ = b` (the minimum-norm Gauss–Newton corrector, four columns).

* the boundary iso-curves (`ssi-boundary.ts`, `boundaryIsoCurve`): a sphere meridian `u = u0` and
  a torus tube circle are made as circles with x reference `e = e(u0)` and normal `N = e × Z`; the
  curve frame's y axis is `N × e` (src/curve/types.ts, `yAxis = normal × xAxis`):
  - `boundary_meridian_frame`: `|e| = 1`, `e·Z = 0 → (e × Z) × e = Z`, so the circle
    `c + ρ (cos t e + sin t (N × e))` is `c + ρ (cos t e + sin t Z)`, the surface's iso-curve at `v = t`;
  - `boundary_meridian_normal_unit`: for unit orthogonal `e`, `Z`, the normal `e × Z` is a unit vector.

Lemmas (no TS counterpart of their own): `gram` (the TS Gram matrix applied to a vector is
`Σ_k (c_k · y) c_k`), `mul_div_self'`, `dot_smul_right`; definitions `planePlaneNum`,
`planePlanePoint`, `planeSphereCenter`, `cross2`, `det3`, `gramApply` mirror the TS formulas.

NOT covered: IEEE-754 rounding, the square roots, `atan2` / trig of the parameters, the tolerance
decisions (parallel / coaxial / tangent thresholds, `2h <= zone` merging), the plane/cylinder line and
ellipse, the plane/cone sections, parallel cylinders, the pcurves, Newton's convergence, the
subdivision's completeness (its exclusions rest on the M4 interval module, formal/CadloomFormal/
Interval.lean), the marcher's step control and loop closure, the contact classification by the gap
Hessian, and the fitting. These are checked by tests in `tests/intersect-surface.test.ts` (one test
per theorem, named after it, plus the behavioural tests).
-/
namespace CadloomFormal
namespace IntersectSurface

open V3

/-! ## (a) plane/plane -/

theorem mul_div_self' (a b : Rat) (hb : b ≠ 0) : b * (a / b) = a := by
  rw [Rat.div_def, Rat.mul_comm, Rat.mul_assoc, Rat.inv_mul_cancel b hb, Rat.mul_one]

/-- The numerator of the TS point: `d1 (n2 × w) + d2 (w × n1)`, `w = n1 × n2`. -/
def planePlaneNum (n1 : V3) (d1 : Rat) (n2 : V3) (d2 : Rat) : V3 :=
  add (smul d1 (cross n2 (cross n1 n2))) (smul d2 (cross (cross n1 n2) n1))

/-- `planePlanePoint` of `ssi-exact.ts`. -/
def planePlanePoint (n1 : V3) (d1 : Rat) (n2 : V3) (d2 : Rat) : V3 :=
  smul (1 / dot (cross n1 n2) (cross n1 n2)) (planePlaneNum n1 d1 n2 d2)

theorem plane_plane_num_first (n1 n2 : V3) (d1 d2 : Rat) :
    dot n1 (planePlaneNum n1 d1 n2 d2) = d1 * dot (cross n1 n2) (cross n1 n2) := by
  simp only [planePlaneNum, add, smul, cross, dot]; grind

theorem plane_plane_num_second (n1 n2 : V3) (d1 d2 : Rat) :
    dot n2 (planePlaneNum n1 d1 n2 d2) = d2 * dot (cross n1 n2) (cross n1 n2) := by
  simp only [planePlaneNum, add, smul, cross, dot]; grind

theorem dot_smul_right (a b : V3) (s : Rat) : dot a (smul s b) = s * dot a b := by
  simp only [dot, smul]; grind

theorem plane_plane_point_on_first (n1 n2 : V3) (d1 d2 : Rat)
    (hw : dot (cross n1 n2) (cross n1 n2) ≠ 0) :
    dot n1 (planePlanePoint n1 d1 n2 d2) = d1 := by
  simp only [planePlanePoint]
  rw [dot_smul_right, plane_plane_num_first]
  generalize dot (cross n1 n2) (cross n1 n2) = w at hw ⊢
  rw [Rat.div_def, Rat.one_mul, ← Rat.mul_assoc, Rat.mul_comm (w⁻¹), Rat.mul_assoc, Rat.inv_mul_cancel w hw, Rat.mul_one]

theorem plane_plane_point_on_second (n1 n2 : V3) (d1 d2 : Rat)
    (hw : dot (cross n1 n2) (cross n1 n2) ≠ 0) :
    dot n2 (planePlanePoint n1 d1 n2 d2) = d2 := by
  simp only [planePlanePoint]
  rw [dot_smul_right, plane_plane_num_second]
  generalize dot (cross n1 n2) (cross n1 n2) = w at hw ⊢
  rw [Rat.div_def, Rat.one_mul, ← Rat.mul_assoc, Rat.mul_comm (w⁻¹), Rat.mul_assoc, Rat.inv_mul_cancel w hw, Rat.mul_one]

theorem plane_plane_dir_orth (n1 n2 : V3) :
    dot (cross n1 n2) n1 = 0 ∧ dot (cross n1 n2) n2 = 0 :=
  ⟨cross_dot_left n1 n2, cross_dot_right n1 n2⟩

/-! ## (b) plane/sphere -/

/-- `c' = c - ((n·c - d)/(n·n)) n`. -/
def planeSphereCenter (c n : V3) (d : Rat) : V3 := sub c (smul ((dot n c - d) / dot n n) n)

theorem plane_sphere_center_eq_ts (c n O : V3) (hn : dot n n = 1) :
    planeSphereCenter c n (dot n O) = add c (smul (dot (sub O c) n) n) := by
  have h1 : (dot n c - dot n O) / dot n n = dot n c - dot n O := by rw [hn]; grind
  simp only [planeSphereCenter, h1]
  simp only [sub, add, smul, dot, mk.injEq]; grind

theorem plane_sphere_center_on_plane (c n : V3) (d : Rat) (hn : dot n n ≠ 0) :
    dot n (planeSphereCenter c n d) = d := by
  have key : dot n (planeSphereCenter c n d) = dot n c - ((dot n c - d) / dot n n) * dot n n := by
    simp only [planeSphereCenter, sub, smul, dot]; grind
  rw [key, Rat.div_mul_cancel hn]; grind

theorem plane_sphere_circle_on_sphere (c n p : V3) (d r rho2 : Rat) (hn : dot n n ≠ 0)
    (hp : dot n p = d)
    (hrho : dot (sub p (planeSphereCenter c n d)) (sub p (planeSphereCenter c n d)) = rho2)
    (hr : rho2 = r * r - ((dot n c - d) / dot n n) * ((dot n c - d) / dot n n) * dot n n) :
    dot (sub p c) (sub p c) = r * r := by
  generalize hs : (dot n c - d) / dot n n = s at hr hrho
  have hs' : s * dot n n = dot n c - d := by rw [← hs, Rat.div_mul_cancel hn]
  have hc : planeSphereCenter c n d = sub c (smul s n) := by simp only [planeSphereCenter, hs]
  rw [hc] at hrho
  have expand : dot (sub p c) (sub p c)
      = dot (sub p (sub c (smul s n))) (sub p (sub c (smul s n)))
        - 2 * s * (dot n p - dot n c) - s * s * dot n n := by
    simp only [sub, smul, dot]; grind
  rw [expand, hrho, hr, hp]
  grind

theorem plane_sphere_rho_ts (r s a : Rat) (ha : a * a = s * s) :
    (r - a) * (r + a) = r * r - s * s := by
  grind

/-! ## (c) the marching tangent -/

theorem march_tangent_orth (n1 n2 : V3) :
    dot (cross n1 n2) n1 = 0 ∧ dot (cross n1 n2) n2 = 0 :=
  ⟨cross_dot_left n1 n2, cross_dot_right n1 n2⟩

theorem cross_parallel_zero (n : V3) (k : Rat) : cross n (smul k n) = ⟨0, 0, 0⟩ := by
  simp only [cross, smul, mk.injEq]; grind

theorem lagrange_identity (a b : V3) :
    dot (cross a b) (cross a b) = dot a a * dot b b - dot a b * dot a b := by
  simp only [cross, dot]; grind

theorem unit_cross_sq (n1 n2 : V3) (h1 : dot n1 n1 = 1) (h2 : dot n2 n2 = 1) :
    dot (cross n1 n2) (cross n1 n2) = 1 - dot n1 n2 * dot n1 n2 := by
  rw [lagrange_identity, h1, h2]; grind

theorem cross_zero_cauchy (a b : V3) (h : cross a b = ⟨0, 0, 0⟩) :
    dot a b * dot a b = dot a a * dot b b := by
  have l := lagrange_identity a b
  rw [h] at l
  simp only [dot] at l ⊢
  grind

/-! ## (d) plane/cylinder square to the axis -/

open Surface in
theorem plane_cylinder_perp_on_both (A O X Y Z : V3) (r cu su sigma : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0)
    (hu : cu * cu + su * su = 1) :
    let h := dot (sub O A) Z
    let p := add A (comb X Y Z (r * cu) (r * su) h)
    let n := smul sigma Z
    dot n p = dot n O ∧
      dot (sub p A) (sub p A) - dot (sub p A) Z * dot (sub p A) Z = r * r := by
  intro h p n
  have hcyl := cylinder_on_implicit A X Y Z r cu su h hxx hyy hzz hxy hxz hyz hu
  refine ⟨?_, hcyl.1⟩
  have hz : dot (comb X Y Z (r * cu) (r * su) h) Z = h := dot_comb_Z_orth X Y Z _ _ _ hzz hxz hyz
  have e1 : dot n p = sigma * (dot A Z + dot (comb X Y Z (r * cu) (r * su) h) Z) := by
    simp only [n, p, add, smul, dot]; grind
  have e2 : dot n O = sigma * dot O Z := by simp only [n, smul, dot]; grind
  have e3 : h = dot O Z - dot A Z := by simp only [h, sub, dot]; grind
  rw [e1, e2, hz, e3]; grind

/-! ## Meridian intersections (`ssi-revolution.ts`) -/

/-- The 2D cross product `a × b = a0 b1 - a1 b0`. -/
def cross2 (a0 a1 b0 b1 : Rat) : Rat := a0 * b1 - a1 * b0

theorem meridian_line_line (p0 p1 q0 q1 d0 d1 e0 e1 : Rat)
    (hc : cross2 d0 d1 e0 e1 ≠ 0) :
    let w0 := q0 - p0
    let w1 := q1 - p1
    let lam := cross2 w0 w1 e0 e1 / cross2 d0 d1 e0 e1
    let mu := cross2 w0 w1 d0 d1 / cross2 d0 d1 e0 e1
    p0 + lam * d0 = q0 + mu * e0 ∧ p1 + lam * d1 = q1 + mu * e1 := by
  intro w0 w1 lam mu
  generalize hC : cross2 d0 d1 e0 e1 = C at hc
  have hlam : lam * C = cross2 w0 w1 e0 e1 := by
    simp only [lam, hC]; rw [Rat.div_mul_cancel hc]
  have hmu : mu * C = cross2 w0 w1 d0 d1 := by
    simp only [mu, hC]; rw [Rat.div_mul_cancel hc]
  have hCdef : C = d0 * e1 - d1 * e0 := by rw [← hC]; rfl
  simp only [cross2] at hlam hmu
  simp only [w0, w1] at hlam hmu
  constructor
  · have : (p0 + lam * d0 - (q0 + mu * e0)) * C = 0 := by rw [hCdef] at hlam hmu ⊢; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hc
  · have : (p1 + lam * d1 - (q1 + mu * e1)) * C = 0 := by rw [hCdef] at hlam hmu ⊢; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hc

theorem sphere_sphere_on_both (a0 a1 b0 b1 r1 r2 D h sgn : Rat)
    (hD : D * D = (b0 - a0) * (b0 - a0) + (b1 - a1) * (b1 - a1)) (hD0 : D ≠ 0)
    (hs : sgn * sgn = 1) :
    let x := (D * D + r1 * r1 - r2 * r2) / (2 * D)
    let ux := (b0 - a0) / D
    let uz := (b1 - a1) / D
    let q0 := a0 + x * ux - sgn * h * uz
    let q1 := a1 + x * uz + sgn * h * ux
    h * h = (r1 - x) * (r1 + x) →
    (q0 - a0) * (q0 - a0) + (q1 - a1) * (q1 - a1) = r1 * r1 ∧
      (q0 - b0) * (q0 - b0) + (q1 - b1) * (q1 - b1) = r2 * r2 := by
  intro x ux uz q0 q1 hh
  have hu : ux * ux + uz * uz = 1 := by
    simp only [ux, uz]
    rw [Rat.div_def, Rat.div_def]
    have hi : D⁻¹ * D = 1 := Rat.inv_mul_cancel D hD0
    have : (b0 - a0) * D⁻¹ * ((b0 - a0) * D⁻¹) + (b1 - a1) * D⁻¹ * ((b1 - a1) * D⁻¹)
        = ((b0 - a0) * (b0 - a0) + (b1 - a1) * (b1 - a1)) * (D⁻¹ * D⁻¹) := by grind
    rw [this, ← hD]
    have : D * D * (D⁻¹ * D⁻¹) = (D⁻¹ * D) * (D⁻¹ * D) := by grind
    rw [this, hi]; grind
  have hb0 : b0 - a0 = D * ux := by simp only [ux]; rw [mul_div_self' _ _ hD0]
  have hb1 : b1 - a1 = D * uz := by simp only [uz]; rw [mul_div_self' _ _ hD0]
  have hx : 2 * D * x = D * D + r1 * r1 - r2 * r2 := by
    have h2 : 2 * D ≠ 0 := by grind
    simp only [x]; rw [mul_div_self' _ _ h2]
  have e1 : (q0 - a0) * (q0 - a0) + (q1 - a1) * (q1 - a1) = (x * x + sgn * sgn * h * h) * (ux * ux + uz * uz) := by
    simp only [q0, q1]; grind
  have e2 : (q0 - b0) * (q0 - b0) + (q1 - b1) * (q1 - b1)
      = ((x - D) * (x - D) + sgn * sgn * h * h) * (ux * ux + uz * uz) := by
    have : q0 - b0 = (x - D) * ux - sgn * h * uz := by simp only [q0]; grind
    have h' : q1 - b1 = (x - D) * uz + sgn * h * ux := by simp only [q1]; grind
    rw [this, h']; grind
  rw [e1, e2, hu, hs]
  constructor
  · grind
  · grind

/-! ## Boundary iso-curves (`ssi-boundary.ts`) -/

theorem boundary_meridian_frame (e Z : V3) (he : dot e e = 1) (hez : dot e Z = 0) :
    cross (cross e Z) e = Z := by
  obtain ⟨ex, ey, ez⟩ := e
  obtain ⟨zx, zy, zz⟩ := Z
  simp only [dot] at he hez
  simp only [cross, mk.injEq]
  refine ⟨?_, ?_, ?_⟩
  · have : zx = zx * (ex * ex + ey * ey + ez * ez) - ex * (ex * zx + ey * zy + ez * zz) := by rw [he, hez]; grind
    rw [this]; grind
  · have : zy = zy * (ex * ex + ey * ey + ez * ez) - ey * (ex * zx + ey * zy + ez * zz) := by rw [he, hez]; grind
    rw [this]; grind
  · have : zz = zz * (ex * ex + ey * ey + ez * ez) - ez * (ex * zx + ey * zy + ez * zz) := by rw [he, hez]; grind
    rw [this]; grind

theorem boundary_meridian_normal_unit (e Z : V3) (he : dot e e = 1) (hz : dot Z Z = 1) (hez : dot e Z = 0) :
    dot (cross e Z) (cross e Z) = 1 := by
  rw [lagrange_identity, he, hz, hez]; grind

/-! ## (e) the linear solves -/

theorem solveSym2_spec (a b c f g : Rat) (hd : a * c - b * b ≠ 0) :
    let x := (c * f - b * g) / (a * c - b * b)
    let y := (a * g - b * f) / (a * c - b * b)
    a * x + b * y = f ∧ b * x + c * y = g := by
  intro x y
  generalize hD : a * c - b * b = D at hd
  have hx : x * D = c * f - b * g := by simp only [x, hD]; rw [Rat.div_mul_cancel hd]
  have hy : y * D = a * g - b * f := by simp only [y, hD]; rw [Rat.div_mul_cancel hd]
  constructor
  · have : (a * x + b * y - f) * D = 0 := by rw [← hD] at hx hy ⊢; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hd
  · have : (b * x + c * y - g) * D = 0 := by rw [← hD] at hx hy ⊢; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hd

/-- `det3` of `linalg.ts` (cofactor expansion along the first row). -/
def det3 (a b c d e f g h i : Rat) : Rat := a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)

theorem solve3_spec (a b c d e f g h i p q s : Rat) (hd : det3 a b c d e f g h i ≠ 0) :
    let y0 := (p * (e * i - f * h) - b * (q * i - f * s) + c * (q * h - e * s)) / det3 a b c d e f g h i
    let y1 := (a * (q * i - f * s) - p * (d * i - f * g) + c * (d * s - q * g)) / det3 a b c d e f g h i
    let y2 := (a * (e * s - q * h) - b * (d * s - q * g) + p * (d * h - e * g)) / det3 a b c d e f g h i
    a * y0 + b * y1 + c * y2 = p ∧ d * y0 + e * y1 + f * y2 = q ∧ g * y0 + h * y1 + i * y2 = s := by
  intro y0 y1 y2
  generalize hD : det3 a b c d e f g h i = D at hd
  have h0 : y0 * D = p * (e * i - f * h) - b * (q * i - f * s) + c * (q * h - e * s) := by
    simp only [y0, hD]; rw [Rat.div_mul_cancel hd]
  have h1 : y1 * D = a * (q * i - f * s) - p * (d * i - f * g) + c * (d * s - q * g) := by
    simp only [y1, hD]; rw [Rat.div_mul_cancel hd]
  have h2 : y2 * D = a * (e * s - q * h) - b * (d * s - q * g) + p * (d * h - e * g) := by
    simp only [y2, hD]; rw [Rat.div_mul_cancel hd]
  have hDdef : D = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) := by rw [← hD]; rfl
  refine ⟨?_, ?_, ?_⟩
  · have : (a * y0 + b * y1 + c * y2 - p) * D = 0 := by
      have : (a * y0 + b * y1 + c * y2 - p) * D = a * (y0 * D) + b * (y1 * D) + c * (y2 * D) - p * D := by grind
      rw [this, h0, h1, h2, hDdef]; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hd
  · have : (d * y0 + e * y1 + f * y2 - q) * D = 0 := by
      have : (d * y0 + e * y1 + f * y2 - q) * D = d * (y0 * D) + e * (y1 * D) + f * (y2 * D) - q * D := by grind
      rw [this, h0, h1, h2, hDdef]; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hd
  · have : (g * y0 + h * y1 + i * y2 - s) * D = 0 := by
      have : (g * y0 + h * y1 + i * y2 - s) * D = g * (y0 * D) + h * (y1 * D) + i * (y2 * D) - s * D := by grind
      rw [this, h0, h1, h2, hDdef]; grind
    rcases Rat.mul_eq_zero.mp this with h | h
    · grind
    · exact absurd h hd

/-- `(Σ_k c_k c_kᵀ) y` for four columns, as the vector `Σ_k (c_k · y) c_k`. -/
def gramApply (c0 c1 c2 c3 y : V3) : V3 :=
  add (add (smul (dot c0 y) c0) (smul (dot c1 y) c1)) (add (smul (dot c2 y) c2) (smul (dot c3 y) c3))

/-- The Gram matrix of `linalg.ts` (`xx = Σ c.x c.x`, ...) applied to `y` is `gramApply`. -/
theorem gram (c0 c1 c2 c3 y : V3) :
    let xx := c0.x * c0.x + c1.x * c1.x + c2.x * c2.x + c3.x * c3.x
    let xy := c0.x * c0.y + c1.x * c1.y + c2.x * c2.y + c3.x * c3.y
    let xz := c0.x * c0.z + c1.x * c1.z + c2.x * c2.z + c3.x * c3.z
    let yy := c0.y * c0.y + c1.y * c1.y + c2.y * c2.y + c3.y * c3.y
    let yz := c0.y * c0.z + c1.y * c1.z + c2.y * c2.z + c3.y * c3.z
    let zz := c0.z * c0.z + c1.z * c1.z + c2.z * c2.z + c3.z * c3.z
    gramApply c0 c1 c2 c3 y = ⟨xx * y.x + xy * y.y + xz * y.z, xy * y.x + yy * y.y + yz * y.z, xz * y.x + yz * y.y + zz * y.z⟩ := by
  intro xx xy xz yy yz zz
  simp only [gramApply, add, smul, dot, mk.injEq, xx, xy, xz, yy, yz, zz]
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem minNormStep_spec (c0 c1 c2 c3 y b : V3)
    (h0 : (c0.x * c0.x + c1.x * c1.x + c2.x * c2.x + c3.x * c3.x) * y.x
        + (c0.x * c0.y + c1.x * c1.y + c2.x * c2.y + c3.x * c3.y) * y.y
        + (c0.x * c0.z + c1.x * c1.z + c2.x * c2.z + c3.x * c3.z) * y.z = b.x)
    (h1 : (c0.x * c0.y + c1.x * c1.y + c2.x * c2.y + c3.x * c3.y) * y.x
        + (c0.y * c0.y + c1.y * c1.y + c2.y * c2.y + c3.y * c3.y) * y.y
        + (c0.y * c0.z + c1.y * c1.z + c2.y * c2.z + c3.y * c3.z) * y.z = b.y)
    (h2 : (c0.x * c0.z + c1.x * c1.z + c2.x * c2.z + c3.x * c3.z) * y.x
        + (c0.y * c0.z + c1.y * c1.z + c2.y * c2.z + c3.y * c3.z) * y.y
        + (c0.z * c0.z + c1.z * c1.z + c2.z * c2.z + c3.z * c3.z) * y.z = b.z) :
    let d0 := dot c0 y
    let d1 := dot c1 y
    let d2 := dot c2 y
    let d3 := dot c3 y
    add (add (smul d0 c0) (smul d1 c1)) (add (smul d2 c2) (smul d3 c3)) = b := by
  intro d0 d1 d2 d3
  have g := gram c0 c1 c2 c3 y
  simp only at g
  show gramApply c0 c1 c2 c3 y = b
  rw [g, h0, h1, h2]

end IntersectSurface
end CadloomFormal
