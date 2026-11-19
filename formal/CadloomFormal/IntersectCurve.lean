import CadloomFormal.Interval

/-!
IntersectCurve: the exact rational model of the closed forms, the exclusion search and the
root-isolation tests of the curve/curve and curve/surface intersectors
(`src/intersect/curve-curve.ts`, `src/intersect/curve-surface.ts`, M4).

Core Lean has no reals: a square root is a rational variable `s` with `s * s = disc`, and the
cosine / sine pairs of the torus are variables with `c² + s² = 1`. The formulas are those of the
TypeScript code, in the same order.

What each theorem models (TypeScript → Lean):

* line/line (`cramer2`, `lineLineExact` in `curve-curve.ts`, exact dyadic / rational arithmetic):
  - `cramer_on_both`: `det = dA.x dB.y - dA.y dB.x ≠ 0`, `w = oB - oA`,
    `s = (w.x dB.y - w.y dB.x) / det`, `t = (w.x dA.y - w.y dA.x) / det` (the TS formulas) satisfy
    both line equations `oA + s dA = oB + t dB` — the 2D (pcurve) case and each coordinate plane
    of the 3D case;
  - `parallel_no_solution`: `det = 0` with `w × dA ≠ 0` (parallel, not collinear) has no `(s, t)`;
  - `coplanar_third_coord`: in 3D, with `n = dA × dB`, `w · n = 0` (the TS coplanarity test) and the
    Cramer plane chosen where `n_z ≠ 0`, the two plane equations imply the third — so the exact
    3D answer is the 2D Cramer answer;
  - `collinear_param`: the TS collinear map `s(t) = (w·dA + t dB·dA) / dA·dA` returns the `σ` with
    `oB + t dB = oA + σ dA` (the overlap's parameter map, also `t(s)` with the roles swapped).
* line/plane (`linePlaneParam` in `curve-surface.ts`): `line_plane_on`
  (`t = n·(p0 - o) / n·d`, `n·d ≠ 0` → `n·(o + t d) = n·p0`), `line_plane_parallel`
  (`n·d = 0`, `n·(p0 - o) ≠ 0` → no `t`).
* line/quadric (`quadraticRoots`, `quadricCoefficients`, the tangent test of `lineQuadric`):
  - `quadratic_roots`: with `s * s = B² - 4AC`, `A ≠ 0`, both `(-B ± s) / 2A` are roots;
    `linear_root` the TS `A = 0` branch `-C / B`;
  - `disc_eq_sq_of_root`: a root `t` gives `B² - 4AC = (2At + B)²`, so `disc_neg_no_root`: a
    negative discriminant has no real root (the TS returns `[]`);
  - `vertex_value`: at the TS vertex `t_m = -B / 2A` the quadratic is `-(B² - 4AC) / 4A`
    (a double root, the tangent case, iff the discriminant vanishes);
  - `sphere_coeffs`, `cylinder_coeffs`, `cone_coeffs`: the TS coefficients `[A, B, C]` are the
    implicit equation along `o + t d` in the surface frame (sphere `|x|² - r²`, cylinder
    `x² + y² - r²`, cone `x² + y² - (b + τ z)²` with the TS `R0 = b + τ o_z`).
* line/torus (`implicitAt`, `implicitEnclosure` in `curve-surface.ts`, the quartic
  `G = (|x|² + R² - r²)² - 4R²(x² + y²)`): `torus_implicit_zero` (every torus point is a root of
  `G`), `torus_factor` (`G = ((ρ - R)² + z² - r²)((ρ + R)² + z² - r²)` with `ρ² = x² + y²`), and
  `torus_root_on_tube` (for `R > r ≥ 0`, `ρ ≥ 0`, `G = 0` → `(ρ - R)² + z² = r²`: every root of the
  quartic is a point of the torus, none is spurious).
* exclusion (`boxesDisjoint3` on `boundCurve` / `boundSurface` boxes in `solveGeneral`,
  `solveNurbsSurface`), on `Interval.Box3`:
  - `axis_close_of_euclid`: Euclidean distance `≤ g` (the TS contact) bounds every axis by `g`;
  - `prune_sound`: if the boxes of two pieces are separated by more than `g` (the TS pruning
    predicate) no point of one piece is within `g` (per axis, hence Euclidean) of the other;
  - the subdivision loop as a worklist (`stepRect`, `run`): pop a parameter rectangle, drop it when
    its boxes are separated, otherwise emit it (isolated root / leaf / covered piece) or split it
    at any `m` in `s` or in `t` (the TS splits at a knot or the midpoint, whichever curve's box is
    larger — modelled as an arbitrary policy `act`). `survivor_complete`: a rectangle holding a
    contact is never dropped and the contact lands in a pushed or emitted rectangle;
    `search_keeps_contacts`: after any number of steps every contact of the root rectangle is in
    the worklist or the output; `exhausted_complete`: when the worklist is empty, every contact is
    in an emitted rectangle — a dropped pair provably holds no intersection.
* root isolation (`krawczyk1`, the monotonicity test, `krawczykContracts`):
  - `krawczyk_root_mem`: the TS operator
    `K(T) = add(sub(m, scale(Gm, y)), mul(sub(1, scale(D, y)), sub(T, m)))` contains every root `x ∈ T`
    of `G`, given the mean-value form `G(x) = g_m + d (x - m)` with `g_m ∈ Gm`, `d ∈ D` (a hypothesis:
    no mean value theorem in core Lean), built from the same `Interval` operations as the TS;
  - `krawczyk_excludes`: `K(T) ∩ T = ∅` (TS `intersect` returns `undefined`) → no root in `T`;
  - `monotone_unique_root`: `0 ∉ D` (TS `dG.lo > 0 || dG.hi < 0`) with the mean-value form between
    any two points → at most one root on the piece;
  - `prod_bound`, `contraction_injective2`: the 2×2 case of `krawczykContracts` — if every row of
    `|I - Y J̃|` sums below 1 (`‖·‖∞ < 1`, entry bounds `aᵢⱼ` as hypotheses) then `v = M v` forces
    `v = 0`, i.e. the projected curve/curve system is injective on the box (one root at most).
* mean-value exclusion (`separatedAlong`, `pairSeparated` in `curve-curve.ts`,
  `pairPatchSeparated`, the centered `Gc` / `gBand` test of `solveAnalytic` and
  `krawczykExcludes3` in `curve-surface.ts`):
  - `dot_sq_le` (Cauchy–Schwarz) and `axis_separation`: with `|u|² ≤ 1` and `u · (X - Y)` enclosed
    above `g` or below `-g`, `|X - Y|² > g²` — the pair holds no contact;
  - `centered_mem` / `centered_excludes`: the TS centered form `add(Gm, mul(D, sub(T, [m, m])))`
    contains `G(x) = g_m + d (x - m)`, so a lower bound above the band excludes the piece;
  - `sphere_band`: within `tol` of a sphere / cylinder, `|n² - r²| ≤ tol (2r + tol)` (the TS
    `gBand`; cone and torus bands are `prod_bound` instances);
  - `krawczyk3_row_mem`: every zero of the mean-value form `F(m) + J̃ (x - m)` lies in each row of
    the TS 3×3 Krawczyk operator (`kRow`, `kEntry`, `kStep`: the same interval operations in the
    same order), so an empty intersection with the box (`inter_none`) excludes it.

NOT covered: IEEE-754 rounding (the TS forms the closed forms in exact dyadic / rational arithmetic
and rounds once, `qToNumber`, tested against exact rationals; the quadric / torus / circle formulas
run in doubles and are tested), the square root and trigonometry (variables with hypotheses), the
interval chain rule `G'(T) ⊆ ∇G(box) · C'(T)` and the mean value theorem (hypotheses), the
3×3 Krawczyk contraction (uniqueness) test of the curve/NURBS-surface system (its exclusion is
`krawczyk3_row_mem`), the choice of separation directions (any direction is sound), the
normal-cone separation test, the Gauss–Newton / regula falsi convergence (roots are accepted by
measured residual), the contact-stretch classification (overlap / tangent / refusal by sampling,
`crossesOver`, the seam split of `overlapPieces`, the sampled overlap-end extension
`extendContactEnd` and the merge of overlaps that continue each other), the closed-form precision
guard (`precisionLimited`), the routing of near-tangent circle/plane pairs to the general solver
(`circleTouchesOtherPlane`), deduplication (`samePlaceOnCurve`), and
array / `Result` paths.
-/
namespace CadloomFormal
namespace IntersectCurve

open Interval

theorem sq_nonneg (x : Rat) : 0 ≤ x * x := by
  by_cases h : 0 ≤ x
  · exact Rat.mul_nonneg h h
  · have h' : (0 : Rat) ≤ -x := by grind
    have := Rat.mul_nonneg h' h'
    grind

/-- `num = σ · den`, `den ≠ 0` → `num / den = σ` (the TS exact rational quotient). -/
theorem div_of_mul_eq (num den σ : Rat) (hd : den ≠ 0) (h : num = σ * den) : num / den = σ := by
  rw [h]; exact Rat.mul_div_cancel hd

/-! ## line / line -/

/-- TS `cramer2`: `det = dA.x dB.y - dA.y dB.x`. -/
def det2 (ax ay bx by_ : Rat) : Rat := ax * by_ - ay * bx

theorem cramer_on_both (oAx oAy oBx oBy ax ay bx by_ : Rat) (h : det2 ax ay bx by_ ≠ 0) :
    let wx := oBx - oAx
    let wy := oBy - oAy
    let s := (wx * by_ - wy * bx) / det2 ax ay bx by_
    let t := (wx * ay - wy * ax) / det2 ax ay bx by_
    oAx + s * ax = oBx + t * bx ∧ oAy + s * ay = oBy + t * by_ := by
  intro wx wy s t
  have hs : s * det2 ax ay bx by_ = wx * by_ - wy * bx := Rat.div_mul_cancel h
  have ht : t * det2 ax ay bx by_ = wx * ay - wy * ax := Rat.div_mul_cancel h
  have k1 : (s * ax - t * bx - wx) * det2 ax ay bx by_ = 0 := by unfold det2 at *; grind
  have k2 : (s * ay - t * by_ - wy) * det2 ax ay bx by_ = 0 := by unfold det2 at *; grind
  have z1 := (Rat.mul_eq_zero.mp k1).resolve_right h
  have z2 := (Rat.mul_eq_zero.mp k2).resolve_right h
  constructor <;> grind

/-- `det = 0` and `w × dA ≠ 0`: parallel distinct lines have no common point. -/
theorem parallel_no_solution (oAx oAy oBx oBy ax ay bx by_ : Rat) (h : det2 ax ay bx by_ = 0)
    (hw : (oBx - oAx) * ay - (oBy - oAy) * ax ≠ 0) :
    ¬ ∃ s t : Rat, oAx + s * ax = oBx + t * bx ∧ oAy + s * ay = oBy + t * by_ := by
  intro ⟨s, t, h1, h2⟩
  apply hw
  have hx : oBx - oAx = s * ax - t * bx := by grind
  have hy : oBy - oAy = s * ay - t * by_ := by grind
  rw [hx, hy]
  have : t * det2 ax ay bx by_ = 0 := by rw [h]; grind
  unfold det2 at this
  grind

/--
3D: with `n = dA × dB`, the TS coplanarity test `w · n = 0` and `n_z ≠ 0` (the Cramer plane xy),
the x and y equations imply the z equation.
-/
theorem coplanar_third_coord (wx wy wz ax ay az bx by_ bz s t : Rat)
    (hcop : wx * (ay * bz - az * by_) + wy * (az * bx - ax * bz) + wz * (ax * by_ - ay * bx) = 0)
    (hn : ax * by_ - ay * bx ≠ 0)
    (h1 : s * ax - t * bx = wx) (h2 : s * ay - t * by_ = wy) :
    s * az - t * bz = wz := by
  have key : (s * az - t * bz - wz) * (ax * by_ - ay * bx) = 0 := by
    have e : (s * az - t * bz - wz) * (ax * by_ - ay * bx) =
        (s * ax - t * bx - wx) * (ay * bz - az * by_) + (s * ay - t * by_ - wy) * (az * bx - ax * bz) -
          (wx * (ay * bz - az * by_) + wy * (az * bx - ax * bz) + wz * (ax * by_ - ay * bx)) := by grind
    rw [e, hcop]
    have a1 : s * ax - t * bx - wx = 0 := by grind
    have a2 : s * ay - t * by_ - wy = 0 := by grind
    rw [a1, a2]; grind
  have := (Rat.mul_eq_zero.mp key).resolve_right hn
  grind

/-- TS collinear map `s(t) = (w·dA + t (dB·dA)) / (dA·dA)`: on collinear lines it gives `A(s) = B(t)`. -/
theorem collinear_param (wx wy wz ax ay az bx by_ bz t σ : Rat)
    (hA : ax * ax + ay * ay + az * az ≠ 0)
    (hx : wx + t * bx = σ * ax) (hy : wy + t * by_ = σ * ay) (hz : wz + t * bz = σ * az) :
    (wx * ax + wy * ay + wz * az + t * (bx * ax + by_ * ay + bz * az)) / (ax * ax + ay * ay + az * az) = σ := by
  apply div_of_mul_eq _ _ _ hA
  have e : wx * ax + wy * ay + wz * az + t * (bx * ax + by_ * ay + bz * az) =
      (wx + t * bx) * ax + (wy + t * by_) * ay + (wz + t * bz) * az := by grind
  rw [e, hx, hy, hz]; grind

/-! ## line / plane -/

/-- TS `linePlaneParam`: `t = n·(p0 - o) / n·d` lies on the plane `n·x = n·p0`. -/
theorem line_plane_on (ox oy oz dx dy dz px py pz nx ny nz : Rat) (h : nx * dx + ny * dy + nz * dz ≠ 0) :
    let t := (nx * (px - ox) + ny * (py - oy) + nz * (pz - oz)) / (nx * dx + ny * dy + nz * dz)
    nx * (ox + t * dx) + ny * (oy + t * dy) + nz * (oz + t * dz) = nx * px + ny * py + nz * pz := by
  intro t
  have ht : t * (nx * dx + ny * dy + nz * dz) = nx * (px - ox) + ny * (py - oy) + nz * (pz - oz) :=
    Rat.div_mul_cancel h
  grind

/-- `n·d = 0` and `n·(p0 - o) ≠ 0`: the line is parallel to the plane and off it. -/
theorem line_plane_parallel (ox oy oz dx dy dz px py pz nx ny nz : Rat) (h : nx * dx + ny * dy + nz * dz = 0)
    (hoff : nx * (px - ox) + ny * (py - oy) + nz * (pz - oz) ≠ 0) (t : Rat) :
    nx * (ox + t * dx) + ny * (oy + t * dy) + nz * (oz + t * dz) ≠ nx * px + ny * py + nz * pz := by
  intro he
  apply hoff
  have : t * (nx * dx + ny * dy + nz * dz) = 0 := by rw [h]; grind
  grind

/-! ## line / quadric: the quadratic `A t² + B t + C` -/

def quad (A B C t : Rat) : Rat := A * t * t + B * t + C
/-- TS `disc = B * B - 4 * A * C`. -/
def disc (A B C : Rat) : Rat := B * B - 4 * A * C

/-- TS `quadraticRoots`: with `s * s = disc`, both `(-B ± s) / 2A` are roots. -/
theorem quadratic_roots (A B C s : Rat) (hA : A ≠ 0) (hs : s * s = disc A B C) :
    quad A B C ((-B - s) / (2 * A)) = 0 ∧ quad A B C ((-B + s) / (2 * A)) = 0 := by
  have h2A : 2 * A ≠ 0 := by grind
  have h4A : 4 * A ≠ 0 := by grind
  unfold disc at hs
  constructor
  · have hr : (-B - s) / (2 * A) * (2 * A) = -B - s := Rat.div_mul_cancel h2A
    have k : quad A B C ((-B - s) / (2 * A)) * (4 * A) = 0 := by unfold quad; grind
    exact (Rat.mul_eq_zero.mp k).resolve_right h4A
  · have hr : (-B + s) / (2 * A) * (2 * A) = -B + s := Rat.div_mul_cancel h2A
    have k : quad A B C ((-B + s) / (2 * A)) * (4 * A) = 0 := by unfold quad; grind
    exact (Rat.mul_eq_zero.mp k).resolve_right h4A

/-- TS `A = 0` branch: `-C / B` is the root of `B t + C`. -/
theorem linear_root (B C : Rat) (hB : B ≠ 0) : quad 0 B C (-C / B) = 0 := by
  have : -C / B * B = -C := Rat.div_mul_cancel hB
  unfold quad; grind

/-- A root `t` gives `disc = (2At + B)²`. -/
theorem disc_eq_sq_of_root (A B C t : Rat) (h : quad A B C t = 0) : disc A B C = (2 * A * t + B) * (2 * A * t + B) := by
  unfold quad disc at *; grind

/-- A negative discriminant has no real root (the TS returns no root). -/
theorem disc_neg_no_root (A B C : Rat) (h : disc A B C < 0) (t : Rat) : quad A B C t ≠ 0 := by
  intro hr
  have := disc_eq_sq_of_root A B C t hr
  have := sq_nonneg (2 * A * t + B)
  grind

/-- TS tangent test at the vertex `t_m = -B / 2A`: the value there is `-disc / 4A`. -/
theorem vertex_value (A B C : Rat) (hA : A ≠ 0) :
    quad A B C (-B / (2 * A)) * (4 * A) = -disc A B C := by
  have h2A : 2 * A ≠ 0 := by grind
  have hr : -B / (2 * A) * (2 * A) = -B := Rat.div_mul_cancel h2A
  unfold quad disc; grind

/-- TS `quadricCoefficients`, sphere: `|o + t d|² - r²`. -/
theorem sphere_coeffs (ox oy oz dx dy dz r t : Rat) :
    (ox + t * dx) * (ox + t * dx) + (oy + t * dy) * (oy + t * dy) + (oz + t * dz) * (oz + t * dz) - r * r =
      quad (dx * dx + dy * dy + dz * dz) (2 * (ox * dx + oy * dy + oz * dz)) (ox * ox + oy * oy + oz * oz - r * r) t := by
  unfold quad; grind

/-- TS `quadricCoefficients`, cylinder: `x² + y² - r²`. -/
theorem cylinder_coeffs (ox oy dx dy r t : Rat) :
    (ox + t * dx) * (ox + t * dx) + (oy + t * dy) * (oy + t * dy) - r * r =
      quad (dx * dx + dy * dy) (2 * (ox * dx + oy * dy)) (ox * ox + oy * oy - r * r) t := by
  unfold quad; grind

/-- TS `quadricCoefficients`, cone: `x² + y² - (b + τ z)²` with `R0 = b + τ o_z`. -/
theorem cone_coeffs (ox oy oz dx dy dz b τ t : Rat) :
    let R0 := b + τ * oz
    (ox + t * dx) * (ox + t * dx) + (oy + t * dy) * (oy + t * dy) - (b + τ * (oz + t * dz)) * (b + τ * (oz + t * dz)) =
      quad (dx * dx + dy * dy - τ * τ * dz * dz) (2 * (ox * dx + oy * dy - τ * R0 * dz)) (ox * ox + oy * oy - R0 * R0) t := by
  intro R0
  unfold quad; grind

/-! ## line / torus: the quartic implicit -/

/-- TS `implicitAt`, torus: `(|x|² + R² - r²)² - 4R²(x² + y²)`. -/
def torusG (R r x y z : Rat) : Rat :=
  (x * x + y * y + z * z + (R * R - r * r)) * (x * x + y * y + z * z + (R * R - r * r)) - 4 * R * R * (x * x + y * y)

/-- Every torus point `((R + r cv) cu, (R + r cv) su, r sv)` is a root of the quartic. -/
theorem torus_implicit_zero (R r cu su cv sv : Rat) (hu : cu * cu + su * su = 1) (hv : cv * cv + sv * sv = 1) :
    torusG R r ((R + r * cv) * cu) ((R + r * cv) * su) (r * sv) = 0 := by
  unfold torusG
  have e1 : (R + r * cv) * cu * ((R + r * cv) * cu) + (R + r * cv) * su * ((R + r * cv) * su) =
      (R + r * cv) * (R + r * cv) * (cu * cu + su * su) := by grind
  rw [e1, hu]
  have e2 : r * sv * (r * sv) = r * r * (sv * sv) := by grind
  rw [e2]
  have e3 : sv * sv = 1 - cv * cv := by grind
  rw [e3]
  grind

/-- With `ρ² = x² + y²`, the quartic factors as `((ρ - R)² + z² - r²)((ρ + R)² + z² - r²)`. -/
theorem torus_factor (R r x y z ρ : Rat) (hρ : ρ * ρ = x * x + y * y) :
    torusG R r x y z = ((ρ - R) * (ρ - R) + z * z - r * r) * ((ρ + R) * (ρ + R) + z * z - r * r) := by
  unfold torusG
  rw [← hρ]
  grind

/-- For `R > r ≥ 0`, every root of the quartic is a point of the tube: no spurious root. -/
theorem torus_root_on_tube (R r x y z ρ : Rat) (hρ : ρ * ρ = x * x + y * y) (h0 : 0 ≤ ρ) (hr : 0 ≤ r) (hR : r < R)
    (hG : torusG R r x y z = 0) : (ρ - R) * (ρ - R) + z * z = r * r := by
  rw [torus_factor R r x y z ρ hρ] at hG
  rcases Rat.mul_eq_zero.mp hG with h | h
  · grind
  · exfalso
    -- (ρ + R)² ≥ R² > r² and z² ≥ 0.
    have hz := sq_nonneg z
    have hRpos : 0 < R := by grind
    have k1 : r * r < R * R := by
      have a := Rat.mul_nonneg hr (show (0 : Rat) ≤ R - r by grind)
      have b := Rat.mul_pos hRpos (show (0 : Rat) < R - r by grind)
      grind
    have k2 : R * R ≤ (ρ + R) * (ρ + R) := by
      have a := Rat.mul_nonneg h0 (show (0 : Rat) ≤ ρ + 2 * R by grind)
      grind
    grind

/-! ## Exclusion by separated boxes, and the subdivision loop -/

/-- Points within `g` of each other along every axis (implied by Euclidean distance `≤ g`). -/
def close3 (p q : Rat × Rat × Rat) (g : Rat) : Prop :=
  (-g ≤ q.1 - p.1 ∧ q.1 - p.1 ≤ g) ∧ (-g ≤ q.2.1 - p.2.1 ∧ q.2.1 - p.2.1 ≤ g) ∧
    (-g ≤ q.2.2 - p.2.2 ∧ q.2.2 - p.2.2 ≤ g)

/-- One axis of a Euclidean contact: `dx² + dy² + dz² ≤ g²`, `g ≥ 0` → `|dx| ≤ g`. -/
theorem axis_close_of_euclid (dx dy dz g : Rat) (hg : 0 ≤ g) (h : dx * dx + dy * dy + dz * dz ≤ g * g) :
    -g ≤ dx ∧ dx ≤ g := by
  have hy := sq_nonneg dy
  have hz := sq_nonneg dz
  have hx : dx * dx ≤ g * g := by grind
  constructor
  · apply Classical.byContradiction
    intro hn
    have a : 0 < -dx - g := by grind
    have b : 0 < -dx + g := by grind
    have := Rat.mul_pos a b
    grind
  · apply Classical.byContradiction
    intro hn
    have a : 0 < dx - g := by grind
    have b : 0 < dx + g := by grind
    have := Rat.mul_pos a b
    grind

/-- The TS pruning predicate (`boxesDisjoint3(boxA, boxB, tol)`) is sound: no contact across separated boxes. -/
theorem prune_sound (A B : Box3) (g : Rat) (p q : Rat × Rat × Rat) (h : separated A B g)
    (hp : mem3 p A) (hq : mem3 q B) : ¬ close3 p q g := by
  intro hc
  have := separated_sound A B g p q h hp hq
  unfold close3 at hc
  grind

instance (A B : Box3) (g : Rat) : Decidable (separated A B g) := by
  unfold separated sepAxis; infer_instance

/-- A parameter rectangle `[s0, s1] × [t0, t1]` (a TS pair of pieces). -/
structure Rect where
  s0 : Rat
  s1 : Rat
  t0 : Rat
  t1 : Rat

def inRect (s t : Rat) (R : Rect) : Prop := R.s0 ≤ s ∧ s ≤ R.s1 ∧ R.t0 ≤ t ∧ t ≤ R.t1

/-- What the TS does with a pair that is not pruned: emit it (isolated root, leaf, covered piece) or split one side at `m`. -/
inductive Action where
  | emit
  | splitS (m : Rat)
  | splitT (m : Rat)

/--
One pair of the TS loop: `(pushed, emitted)`. `bA lo hi` / `bB lo hi` are the certified boxes of the
pieces (TS `boundCurve`), `g` the tolerance, `act` the TS policy for unpruned pairs.
-/
def stepRect (bA bB : Rat → Rat → Box3) (g : Rat) (act : Rect → Action) (R : Rect) : List Rect × List Rect :=
  if separated (bA R.s0 R.s1) (bB R.t0 R.t1) g then ([], [])
  else
    match act R with
    | .emit => ([], [R])
    | .splitS m => ([⟨R.s0, m, R.t0, R.t1⟩, ⟨m, R.s1, R.t0, R.t1⟩], [])
    | .splitT m => ([⟨R.s0, R.s1, R.t0, m⟩, ⟨R.s0, R.s1, m, R.t1⟩], [])

/-- `bA` encloses the curve over every parameter interval (TS `boundCurve`, `Interval.deBoor_in_hull`). -/
def Encloses (C : Rat → Rat × Rat × Rat) (b : Rat → Rat → Box3) : Prop :=
  ∀ lo hi s, lo ≤ s → s ≤ hi → mem3 (C s) (b lo hi)

/-- A pair holding a contact is never dropped: the contact lands in a pushed or an emitted rectangle. -/
theorem survivor_complete (A B : Rat → Rat × Rat × Rat) (bA bB : Rat → Rat → Box3) (g : Rat)
    (act : Rect → Action) (hA : Encloses A bA) (hB : Encloses B bB) (R : Rect) (s t : Rat)
    (hin : inRect s t R) (hc : close3 (A s) (B t) g) :
    ∃ R' ∈ (stepRect bA bB g act R).1 ++ (stepRect bA bB g act R).2, inRect s t R' := by
  unfold inRect at hin
  have hsep : ¬ separated (bA R.s0 R.s1) (bB R.t0 R.t1) g := fun h =>
    prune_sound _ _ g _ _ h (hA _ _ _ hin.1 hin.2.1) (hB _ _ _ hin.2.2.1 hin.2.2.2) hc
  unfold stepRect
  rw [if_neg hsep]
  cases hact : act R with
  | emit => exact ⟨R, by simp, by unfold inRect; exact hin⟩
  | splitS m =>
    by_cases hm : s ≤ m
    · exact ⟨⟨R.s0, m, R.t0, R.t1⟩, by simp, by unfold inRect; simp only; grind⟩
    · exact ⟨⟨m, R.s1, R.t0, R.t1⟩, by simp, by unfold inRect; simp only; grind⟩
  | splitT m =>
    by_cases hm : t ≤ m
    · exact ⟨⟨R.s0, R.s1, R.t0, m⟩, by simp, by unfold inRect; simp only; grind⟩
    · exact ⟨⟨R.s0, R.s1, m, R.t1⟩, by simp, by unfold inRect; simp only; grind⟩

/-- `n` iterations of the TS loop on the worklist `stack` (popped at the head) with output `out`. -/
def run (bA bB : Rat → Rat → Box3) (g : Rat) (act : Rect → Action) :
    Nat → List Rect → List Rect → List Rect × List Rect
  | 0, stack, out => (stack, out)
  | _ + 1, [], out => ([], out)
  | n + 1, R :: rest, out =>
    let r := stepRect bA bB g act R
    run bA bB g act n (r.1 ++ rest) (r.2 ++ out)

/-- Every contact of the worklist ∪ output stays in the worklist ∪ output after any number of steps. -/
theorem search_keeps_contacts (A B : Rat → Rat × Rat × Rat) (bA bB : Rat → Rat → Box3) (g : Rat)
    (act : Rect → Action) (hA : Encloses A bA) (hB : Encloses B bB) (s t : Rat) (hc : close3 (A s) (B t) g) :
    ∀ n stack out, (∃ R ∈ stack ++ out, inRect s t R) →
      ∃ R ∈ (run bA bB g act n stack out).1 ++ (run bA bB g act n stack out).2, inRect s t R := by
  intro n
  induction n with
  | zero => intro stack out h; simpa [run] using h
  | succ n ih =>
    intro stack out h
    cases stack with
    | nil => simpa [run] using h
    | cons R rest =>
      simp only [run]
      apply ih
      obtain ⟨R', hR', hin⟩ := h
      simp only [List.cons_append, List.mem_cons, List.mem_append] at hR'
      rcases hR' with rfl | hrest | hout
      · obtain ⟨R'', hR'', hin''⟩ := survivor_complete A B bA bB g act hA hB R' s t hin hc
        refine ⟨R'', ?_, hin''⟩
        simp only [List.mem_append] at hR'' ⊢
        grind
      · exact ⟨R', by simp [hrest], hin⟩
      · exact ⟨R', by simp [hout], hin⟩

/-- When the worklist is exhausted, every contact in the root pair lies in an emitted pair: pruning lost nothing. -/
theorem exhausted_complete (A B : Rat → Rat × Rat × Rat) (bA bB : Rat → Rat → Box3) (g : Rat)
    (act : Rect → Action) (hA : Encloses A bA) (hB : Encloses B bB) (root : Rect) (n : Nat) (out : List Rect)
    (hrun : run bA bB g act n [root] [] = ([], out)) (s t : Rat) (hin : inRect s t root)
    (hc : close3 (A s) (B t) g) : ∃ R ∈ out, inRect s t R := by
  have := search_keeps_contacts A B bA bB g act hA hB s t hc n [root] [] ⟨root, by simp, hin⟩
  rw [hrun] at this
  simpa using this

/-! ## Root isolation: Krawczyk (1D), monotonicity, contraction (2D) -/

/-- The point interval `[m, m]` (TS `ivPt`). -/
def pt (m : Rat) : Iv := ⟨m, m⟩

theorem pt_mem (m : Rat) : mem m (pt m) := by unfold mem pt; grind

/-- TS `krawczyk1(T, m, Gm, D, y)`, with the same interval operations in the same order. -/
def krawczyk1 (T : Iv) (m : Rat) (Gm D : Iv) (y : Rat) : Iv :=
  add (sub (pt m) (scale Gm y)) (mul (sub (pt 1) (scale D y)) (sub T (pt m)))

/-- Every root `x ∈ T` lies in `K(T)`, given the mean-value form `G(x) = g_m + d (x - m)`. -/
theorem krawczyk_root_mem (T Gm D : Iv) (m y x gm d Gx : Rat) (hx : mem x T) (hgm : mem gm Gm) (hd : mem d D)
    (hmv : Gx = gm + d * (x - m)) (hroot : Gx = 0) : mem x (krawczyk1 T m Gm D y) := by
  have e : x = (m - gm * y) + (1 - d * y) * (x - m) := by
    have : gm + d * (x - m) = 0 := by rw [← hmv, hroot]
    have k : y * (gm + d * (x - m)) = 0 := by rw [this]; grind
    grind
  rw [e]
  unfold krawczyk1
  apply add_sound
  · exact sub_sound _ _ _ _ (pt_mem m) (scale_sound _ _ _ hgm)
  · apply mul_sound
    · exact sub_sound _ _ _ _ (pt_mem 1) (scale_sound _ _ _ hd)
    · exact sub_sound _ _ _ _ hx (pt_mem m)

/-- `K(T) ∩ T = ∅` (TS `intersect` is `undefined`) proves that `G` has no root in `T`. -/
theorem krawczyk_excludes (T Gm D : Iv) (m y : Rat) (G : Rat → Rat)
    (hmv : ∀ x, mem x T → ∃ gm d, mem gm Gm ∧ mem d D ∧ G x = gm + d * (x - m))
    (hK : inter (krawczyk1 T m Gm D y) T = none) : ∀ x, mem x T → G x ≠ 0 := by
  intro x hx hG
  obtain ⟨gm, d, hgm, hd, he⟩ := hmv x hx
  exact inter_none x _ _ hK ⟨krawczyk_root_mem T Gm D m y x gm d (G x) hx hgm hd he hG, hx⟩

/-- TS monotonicity test: `0 ∉ D` (`D.lo > 0 ∨ D.hi < 0`) → at most one root on the piece. -/
theorem monotone_unique_root (D : Iv) (G : Rat → Rat) (x x' d : Rat) (hD : D.lo > 0 ∨ D.hi < 0) (hd : mem d D)
    (hmv : G x - G x' = d * (x - x')) (hx : G x = 0) (hx' : G x' = 0) : x = x' := by
  unfold mem at hd
  have hd0 : d ≠ 0 := by grind
  have : d * (x - x') = 0 := by grind
  have := (Rat.mul_eq_zero.mp this).resolve_left hd0
  grind

/-- `|m| ≤ a`, `|v| ≤ V` → `|m v| ≤ a V`. -/
theorem prod_bound (m a v V : Rat) (hm : -a ≤ m ∧ m ≤ a) (hv : -V ≤ v ∧ v ≤ V) : -(a * V) ≤ m * v ∧ m * v ≤ a * V := by
  have p1 := Rat.mul_nonneg (show (0 : Rat) ≤ a - m by grind) (show (0 : Rat) ≤ V + v by grind)
  have p2 := Rat.mul_nonneg (show (0 : Rat) ≤ a + m by grind) (show (0 : Rat) ≤ V - v by grind)
  have p3 := Rat.mul_nonneg (show (0 : Rat) ≤ a + m by grind) (show (0 : Rat) ≤ V + v by grind)
  have p4 := Rat.mul_nonneg (show (0 : Rat) ≤ a - m by grind) (show (0 : Rat) ≤ V - v by grind)
  constructor <;> grind

def rabs (x : Rat) : Rat := if 0 ≤ x then x else -x

theorem rabs_bounds (x : Rat) : -rabs x ≤ x ∧ x ≤ rabs x := by unfold rabs; split <;> grind
theorem rabs_cases (x : Rat) : rabs x = x ∨ rabs x = -x := by unfold rabs; split <;> simp

/--
The 2×2 contraction of TS `krawczykContracts`: with `M = I - Y J̃` bounded entrywise by `aᵢⱼ` and
both row sums `< 1` (`‖M‖∞ < 1`), the fixed-point equation `v = M v` (from `G(p) = G(q)`,
`v = p - q`, by the mean value form) forces `v = 0`: the system is injective on the box.
-/
theorem contraction_injective2 (m11 m12 m21 m22 a11 a12 a21 a22 v1 v2 : Rat)
    (h11 : -a11 ≤ m11 ∧ m11 ≤ a11) (h12 : -a12 ≤ m12 ∧ m12 ≤ a12)
    (h21 : -a21 ≤ m21 ∧ m21 ≤ a21) (h22 : -a22 ≤ m22 ∧ m22 ≤ a22)
    (r1 : a11 + a12 < 1) (r2 : a21 + a22 < 1)
    (e1 : v1 = m11 * v1 + m12 * v2) (e2 : v2 = m21 * v1 + m22 * v2) : v1 = 0 ∧ v2 = 0 := by
  obtain ⟨V, hVdef⟩ : ∃ V, V = rmax (rabs v1) (rabs v2) := ⟨_, rfl⟩
  have c1 := rabs_bounds v1
  have c2 := rabs_bounds v2
  have m1 := le_rmax_left (rabs v1) (rabs v2)
  have m2 := le_rmax_right (rabs v1) (rabs v2)
  rw [← hVdef] at m1 m2
  have b1 : -V ≤ v1 ∧ v1 ≤ V := by constructor <;> grind
  have b2 : -V ≤ v2 ∧ v2 ≤ V := by constructor <;> grind
  have q11 := prod_bound m11 a11 v1 V h11 b1
  have q12 := prod_bound m12 a12 v2 V h12 b2
  have q21 := prod_bound m21 a21 v1 V h21 b1
  have q22 := prod_bound m22 a22 v2 V h22 b2
  have hV0 : 0 ≤ V := by grind
  -- |v1| ≤ (a11 + a12) V and |v2| ≤ (a21 + a22) V.
  have s1 : -((a11 + a12) * V) ≤ v1 ∧ v1 ≤ (a11 + a12) * V := by constructor <;> grind
  have s2 : -((a21 + a22) * V) ≤ v2 ∧ v2 ≤ (a21 + a22) * V := by constructor <;> grind
  have hV : V = 0 := by
    apply Classical.byContradiction
    intro hne
    have hpos : 0 < V := by grind
    have l1 : (a11 + a12) * V < V := by
      have := Rat.mul_pos (show (0 : Rat) < 1 - (a11 + a12) by grind) hpos; grind
    have l2 : (a21 + a22) * V < V := by
      have := Rat.mul_pos (show (0 : Rat) < 1 - (a21 + a22) by grind) hpos; grind
    -- V is |v1| or |v2|, both strictly below V.
    rcases rmax_cases (rabs v1) (rabs v2) with h | h <;> rw [← hVdef] at h
    · rcases rabs_cases v1 with k | k <;> grind
    · rcases rabs_cases v2 with k | k <;> grind
  constructor <;> grind

/-! ## Mean-value (centered-form) exclusion, the band of the algebraic implicit, 3×3 Krawczyk -/

/-- Cauchy–Schwarz in 3D (Lagrange's identity). -/
theorem dot_sq_le (ex ey ez vx vy vz : Rat) :
    (ex * vx + ey * vy + ez * vz) * (ex * vx + ey * vy + ez * vz) ≤
      (ex * ex + ey * ey + ez * ez) * (vx * vx + vy * vy + vz * vz) := by
  have h1 := sq_nonneg (ex * vy - ey * vx)
  have h2 := sq_nonneg (ex * vz - ez * vx)
  have h3 := sq_nonneg (ey * vz - ez * vy)
  have e : (ex * ex + ey * ey + ez * ez) * (vx * vx + vy * vy + vz * vz) -
      (ex * vx + ey * vy + ez * vz) * (ex * vx + ey * vy + ez * vz) =
      (ex * vy - ey * vx) * (ex * vy - ey * vx) + (ex * vz - ez * vx) * (ex * vz - ez * vx) +
        (ey * vz - ez * vy) * (ey * vz - ez * vy) := by grind
  grind

/--
TS `separatedAlong`: with `|u|² ≤ 1` (the shrunk unit direction) and the enclosure of `u · v`
(`v = X - Y`) above `g ≥ 0` or below `-g`, `|v|² > g²`: no contact within `g` on the pair.
-/
theorem axis_separation (ux uy uz vx vy vz g : Rat) (hg : 0 ≤ g) (hu : ux * ux + uy * uy + uz * uz ≤ 1)
    (h : g < ux * vx + uy * vy + uz * vz ∨ ux * vx + uy * vy + uz * vz < -g) :
    g * g < vx * vx + vy * vy + vz * vz := by
  have cs := dot_sq_le ux uy uz vx vy vz
  have hv : 0 ≤ vx * vx + vy * vy + vz * vz := by
    have := sq_nonneg vx; have := sq_nonneg vy; have := sq_nonneg vz; grind
  have k := Rat.mul_nonneg (show (0 : Rat) ≤ 1 - (ux * ux + uy * uy + uz * uz) by grind) hv
  obtain ⟨d, hd⟩ : ∃ d, d = ux * vx + uy * vy + uz * vz := ⟨_, rfl⟩
  rw [← hd] at h cs
  have hdd : g * g < d * d := by
    rcases h with h | h
    · have := Rat.mul_pos (show (0 : Rat) < d - g by grind) (show (0 : Rat) < d + g by grind); grind
    · have := Rat.mul_pos (show (0 : Rat) < -d - g by grind) (show (0 : Rat) < -d + g by grind); grind
  grind

/--
TS centered form (`separatedAlong`'s terms, `solveAnalytic`'s `Gc`):
`G(x) = g_m + d (x - m)` with `g_m ∈ Gm`, `d ∈ D`, `x ∈ T` lies in `add Gm (mul D (sub T [m, m]))`.
-/
theorem centered_mem (T Gm D : Iv) (m x gm d : Rat) (hx : mem x T) (hgm : mem gm Gm) (hd : mem d D) :
    mem (gm + d * (x - m)) (add Gm (mul D (sub T (pt m)))) :=
  add_sound _ _ _ _ hgm (mul_sound _ _ _ _ hd (sub_sound _ _ _ _ hx (pt_mem m)))

/-- The TS exclusion `Gc.lo > band`: every value of `G` on the piece exceeds the band. -/
theorem centered_excludes (T Gm D : Iv) (m band : Rat) (G : Rat → Rat)
    (hmv : ∀ x, mem x T → ∃ gm d, mem gm Gm ∧ mem d D ∧ G x = gm + d * (x - m))
    (hb : band < (add Gm (mul D (sub T (pt m)))).lo) : ∀ x, mem x T → band < G x := by
  intro x hx
  obtain ⟨gm, d, hgm, hd, he⟩ := hmv x hx
  have := centered_mem T Gm D m x gm d hx hgm hd
  unfold mem at this
  grind

/--
TS `gBand`, sphere / cylinder: a point within `tol` of the surface (`|n - r| ≤ tol`, `n = |x|` or
`ρ`) has `|G| = |n² - r²| ≤ tol (2r + tol)`. (Cone and torus: `G = d' q` with `|d'|`, `|q|` bounded,
`prod_bound`.)
-/
theorem sphere_band (n r tol : Rat) (hn : 0 ≤ n) (hr : 0 ≤ r) (h1 : n - r ≤ tol) (h2 : r - n ≤ tol) :
    -(tol * (2 * r + tol)) ≤ n * n - r * r ∧ n * n - r * r ≤ tol * (2 * r + tol) := by
  have := prod_bound (n - r) tol (n + r) (2 * r + tol) ⟨by grind, h1⟩ ⟨by grind, by grind⟩
  have e : n * n - r * r = (n - r) * (n + r) := by grind
  rw [e]; exact this

/-- One `e` entry of TS `krawczykExcludes3`: `((δ - J₀ y₀) - J₁ y₁) - J₂ y₂` (`J_l = J[l][j]`, `y_l = Y[i][l]`). -/
def kEntry (δ : Rat) (J0 J1 J2 : Iv) (y0 y1 y2 : Rat) : Iv :=
  sub (sub (sub (pt δ) (scale J0 y0)) (scale J1 y1)) (scale J2 y2)

/-- One `j` step of TS `krawczykExcludes3`: `k ← add(sub(k, scale(F_j, Y_ij)), mul(e_j, X_j - m_j))`. -/
def kStep (k Fj : Iv) (yj : Rat) (ej dXj : Iv) : Iv := add (sub k (scale Fj yj)) (mul ej dXj)

/-- Row `i` of the TS 3×3 Krawczyk operator, in the TS order. -/
def kRow (mi : Rat) (F0 F1 F2 : Iv) (y0 y1 y2 : Rat) (e0 e1 e2 dX0 dX1 dX2 : Iv) : Iv :=
  kStep (kStep (kStep (pt mi) F0 y0 e0 dX0) F1 y1 e1 dX1) F2 y2 e2 dX2

/--
Every zero `x ∈ X` of `F(x) = F(m) + J̃ (x - m)` (`F(m) ∈ F`, `J̃ ∈ J` entrywise: the mean-value
form per equation) lies in row `i` of the TS Krawczyk operator (`δ` the `i`-th row of `I`, so
`Σ δ_j (x_j - m_j) = x_i - m_i`).
-/
theorem krawczyk3_row_mem (mi xi y0 y1 y2 δ0 δ1 δ2 : Rat) (m0 m1 m2 x0 x1 x2 f0 f1 f2 : Rat)
    (j00 j01 j02 j10 j11 j12 j20 j21 j22 : Rat)
    (F0 F1 F2 J00 J01 J02 J10 J11 J12 J20 J21 J22 X0 X1 X2 : Iv)
    (hf0 : mem f0 F0) (hf1 : mem f1 F1) (hf2 : mem f2 F2)
    (h00 : mem j00 J00) (h01 : mem j01 J01) (h02 : mem j02 J02)
    (h10 : mem j10 J10) (h11 : mem j11 J11) (h12 : mem j12 J12)
    (h20 : mem j20 J20) (h21 : mem j21 J21) (h22 : mem j22 J22)
    (hx0 : mem x0 X0) (hx1 : mem x1 X1) (hx2 : mem x2 X2)
    (z0 : f0 + j00 * (x0 - m0) + j01 * (x1 - m1) + j02 * (x2 - m2) = 0)
    (z1 : f1 + j10 * (x0 - m0) + j11 * (x1 - m1) + j12 * (x2 - m2) = 0)
    (z2 : f2 + j20 * (x0 - m0) + j21 * (x1 - m1) + j22 * (x2 - m2) = 0)
    (hδ : δ0 * (x0 - m0) + δ1 * (x1 - m1) + δ2 * (x2 - m2) = xi - mi) :
    mem xi (kRow mi F0 F1 F2 y0 y1 y2
      (kEntry δ0 J00 J10 J20 y0 y1 y2) (kEntry δ1 J01 J11 J21 y0 y1 y2) (kEntry δ2 J02 J12 J22 y0 y1 y2)
      (sub X0 (pt m0)) (sub X1 (pt m1)) (sub X2 (pt m2))) := by
  have k0 : y0 * (f0 + j00 * (x0 - m0) + j01 * (x1 - m1) + j02 * (x2 - m2)) = 0 := by rw [z0]; grind
  have k1 : y1 * (f1 + j10 * (x0 - m0) + j11 * (x1 - m1) + j12 * (x2 - m2)) = 0 := by rw [z1]; grind
  have k2 : y2 * (f2 + j20 * (x0 - m0) + j21 * (x1 - m1) + j22 * (x2 - m2)) = 0 := by rw [z2]; grind
  have e : xi = ((((((mi - f0 * y0) + (((δ0 - j00 * y0) - j10 * y1) - j20 * y2) * (x0 - m0)) - f1 * y1) +
      (((δ1 - j01 * y0) - j11 * y1) - j21 * y2) * (x1 - m1)) - f2 * y2) +
      (((δ2 - j02 * y0) - j12 * y1) - j22 * y2) * (x2 - m2)) := by grind
  have ent : ∀ (δ a b c : Rat) (A B C : Iv), mem a A → mem b B → mem c C →
      mem (((δ - a * y0) - b * y1) - c * y2) (kEntry δ A B C y0 y1 y2) := by
    intro δ a b c A B C ha hb hc
    unfold kEntry
    exact sub_sound _ _ _ _ (sub_sound _ _ _ _ (sub_sound _ _ _ _ (pt_mem δ) (scale_sound _ _ _ ha))
      (scale_sound _ _ _ hb)) (scale_sound _ _ _ hc)
  have step : ∀ (kv fv yv ev dv : Rat) (K Fv Ev Dv : Iv), mem kv K → mem fv Fv → mem ev Ev → mem dv Dv →
      mem ((kv - fv * yv) + ev * dv) (kStep K Fv yv Ev Dv) := by
    intro kv fv yv ev dv K Fv Ev Dv hk hfv hev hdv
    unfold kStep
    exact add_sound _ _ _ _ (sub_sound _ _ _ _ hk (scale_sound _ _ _ hfv)) (mul_sound _ _ _ _ hev hdv)
  rw [e]
  unfold kRow
  apply step _ _ _ _ _ _ _ _ _ _ hf2 (ent _ _ _ _ _ _ _ h02 h12 h22) (sub_sound _ _ _ _ hx2 (pt_mem m2))
  apply step _ _ _ _ _ _ _ _ _ _ hf1 (ent _ _ _ _ _ _ _ h01 h11 h21) (sub_sound _ _ _ _ hx1 (pt_mem m1))
  exact step _ _ _ _ _ _ _ _ _ (pt_mem mi) hf0 (ent _ _ _ _ _ _ _ h00 h10 h20) (sub_sound _ _ _ _ hx0 (pt_mem m0))

end IntersectCurve
end CadloomFormal
