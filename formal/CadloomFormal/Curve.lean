import CadloomFormal.Foundation
/-
Curve: the exact rational model of the analytic curves of `src/curve/` and of their exact
NURBS forms (The NURBS Book A7.1 MakeNurbsCircle).

Core Lean has no reals, so `cos`/`sin` are modelled as rational variables `(c, s)` with the
hypothesis `c * c + s * s = 1` (every theorem below holds for every such pair, in particular for
the true values), and the circle also through its rational parametrisation
`((1 - T²), 2T, (1 + T²))`.

What each theorem models (TypeScript → Lean):

* `unitArcNet` / `rationalQuadraticArc` in `src/curve/conic.ts`. One A7.1 segment of half-angle
  `φ` about the mid direction `m` has homogeneous control points
  `(cos(m-φ), sin(m-φ), 1)`, `(cos m, sin m, cos φ)` (the TS stores `P1 = (cos m, sin m) / cos φ`
  with weight `w1 = cos φ`, so `w1 P1 = (cos m, sin m)`), `(cos(m+φ), sin(m+φ), 1)`.
  With `(cm, sm) = (cos m, sin m)` and `(c, s) = (cos φ, sin φ)`, the end points are the rotations
  `(cm c + sm s, sm c - cm s)` and `(cm c - sm s, sm c + cm s)`. The rational Bezier point at
  local parameter `t` is `(Nx / D, Ny / D)` with Bernstein weights `(1-t)², 2t(1-t), t²`:
  - `arcNx`, `arcNy`, `arcD` are those numerators and the denominator;
  - `arc_on_unit_circle`: `Nx² + Ny² = D²` (every point of the segment is on the unit circle);
  - `arc_denominator_pos`: `D > 0` for `t ∈ [0, 1]` and `c > 0` (the segment has no pole; A7.1
    segments have `φ ≤ 45°`, so `c ≥ √2/2 > 0`);
  - `arc_reparam_x` / `arc_reparam_y`: with `τ = 2t - 1` and `T = τ s / (1 + c)`
    (`= τ tan(φ/2)`), the point equals the rational-parametrisation point of the half-angle
    tangent `T` rotated by `m`: this is the exact reparametrisation
    `θ = m + 2 atan(τ tan(φ/2))` used by `unitArcAngleOfParam` / `unitArcParamOfAngle`;
  - `quarter_on_unit_circle`: the textbook quarter `(1,0), (1,1), (0,1)` with weights `1, w, 1`
    and `w² = 1/2`.
  - `ellipse_arc_on_ellipse`: the affine image `(a Nx, b Ny) / D` used by `ellipseArcToNurbs`
    lies on `x²/a² + y²/b² = 1` (multiplied out: `b² X² + a² Y² = a² b² D²`).
* `rational_unit_circle`: `(1 - T²)² + (2T)² = (1 + T²)²` (the rational parametrisation).
* `ellipse_point_on_ellipse`: `evaluateCurve3` on an ellipse, in-plane coordinates `(a c, b s)`.
* `circle_frame_radius`, `circle_deriv_orthogonal`, `circle_speed_sq`, `circle_second_deriv`:
  `evaluateCurve3` on a circle `C = o + r c u + r s v`, `C' = -r s u + r c v`,
  `C'' = -r c u - r s v`, with an orthonormal frame `(u, v)` given as dot-product hypotheses.
  They give `|C - o| = r`, `C' ⊥ (C - o)`, `|C'|² = r²` and `C'' = -(C - o)`, hence the
  curvature `|C' × C''| / |C'|³ = r · r² / r³ = 1/r` checked by the TS test of that name.
* `line_closest_orthogonal`, `line_dist_decomp`, `line_closest_min`: `closestPointOnCurve` on a
  line `o + t d`: the parameter `t* = (p - o)·d / (d·d)` makes the residual orthogonal to `d`,
  `dist²(t) = dist²(t*) + (t - t*)² (d·d)`, hence `dist²(t*) ≤ dist²(t)` for every `t`.
* `principal_axes_reparam`, `principal_axes_dot`: `transformCurve3` turns the image
  `o + cos t U + sin t V` of a circle/ellipse (`U, V` not orthogonal in general) into principal
  axes `U' = c0 U + s0 V`, `V' = -s0 U + c0 V` with the shifted parameter `t = σ + t0`
  (`cos t = cσ c0 - sσ s0`, `sin t = sσ c0 + cσ s0`): the curve is unchanged
  (`principal_axes_reparam`), and `U'·V' = (c0² - s0²) U·V - c0 s0 (U·U - V·V)`
  (`principal_axes_dot`), which vanishes for the `t0` the TS picks
  (`tan 2t0 = 2 U·V / (U·U - V·V)`); `principal_axes_major`: for that `t0` (as the polar
  direction of `(U·U - V·V, 2 U·V)`) the axes are orthogonal and `|U'| ≥ |V'|` (so `U'` is the
  major axis, as `conicFromConjugateAxes` assumes).
* `arc_mid_from_ends`: `unitArcNet` computes the middle point as `(P0 + P2) / (2 w²)` from the
  segment's end points; its weighted point is the model's `(cm, sm)`.

NOT covered: IEEE-754 rounding and the libm `cos`/`sin`/`atan2` (the hypotheses `c² + s² = 1`
hold only approximately in doubles), the choice of the number of segments in A7.1, the knot
vector bookkeeping, the ellipse closest-point root finder (Newton with bracketing), adaptive
Gauss-Legendre arc length, the frame construction (Gram-Schmidt) and every `Result` error path.
These are checked by tests in `tests/curve.test.ts`.
-/
namespace CadloomFormal
namespace Curve

/-! ## (a) One rational quadratic arc segment (A7.1) -/

/-- Squares are non-negative (helper). -/
theorem sq_nonneg (x : Rat) : 0 ≤ x * x := by
  rcases Rat.le_total (a := 0) (b := x) with h | h
  · exact Rat.mul_nonneg h h
  · have h' : 0 ≤ -x := by grind
    have := Rat.mul_nonneg h' h'
    grind

/-- `x` numerator of the rational Bezier arc: `(1-t)² x0 + 2t(1-t) cm + t² x2`, where
`x0 = cm c + sm s`, `x2 = cm c - sm s` and the middle homogeneous point is `(cm, sm, c)`. -/
def arcNx (cm sm c s t : Rat) : Rat :=
  (1 - t) * (1 - t) * (cm * c + sm * s) + 2 * t * (1 - t) * cm + t * t * (cm * c - sm * s)

/-- `y` numerator: `(1-t)² y0 + 2t(1-t) sm + t² y2`, `y0 = sm c - cm s`, `y2 = sm c + cm s`. -/
def arcNy (cm sm c s t : Rat) : Rat :=
  (1 - t) * (1 - t) * (sm * c - cm * s) + 2 * t * (1 - t) * sm + t * t * (sm * c + cm * s)

/-- Denominator: `(1-t)² · 1 + 2t(1-t) · c + t² · 1` (weights `1, cos φ, 1`). -/
def arcD (c t : Rat) : Rat :=
  (1 - t) * (1 - t) + 2 * t * (1 - t) * c + t * t

/-- Every point of an A7.1 segment lies on the unit circle: `Nx² + Ny² = D²`. -/
theorem arc_on_unit_circle (cm sm c s t : Rat)
    (hm : cm * cm + sm * sm = 1) (hφ : c * c + s * s = 1) :
    arcNx cm sm c s t * arcNx cm sm c s t + arcNy cm sm c s t * arcNy cm sm c s t
      = arcD c t * arcD c t := by
  unfold arcNx arcNy arcD
  grind

/-- The denominator has no zero on the segment when the middle weight is positive. -/
theorem arc_denominator_pos (c t : Rat) (hc : 0 < c) (h0 : 0 ≤ t) (h1 : t ≤ 1) :
    0 < arcD c t := by
  unfold arcD
  have a : 0 ≤ t * (1 - t) := Rat.mul_nonneg h0 (by grind)
  have b : 0 ≤ t * (1 - t) * c := Rat.mul_nonneg a (Rat.le_of_lt hc)
  have q1 : 0 ≤ (1 - t) * (1 - t) := Rat.mul_nonneg (by grind) (by grind)
  have q2 : 0 ≤ t * t := Rat.mul_nonneg h0 h0
  -- (1-t)² + t² ≥ 1/2 > 0: (2t - 1)² ≥ 0.
  have sq : 0 ≤ (2 * t - 1) * (2 * t - 1) := sq_nonneg _
  grind

/-- The exact reparametrisation, `x` part: with `τ = 2t - 1` and half-angle tangent
`T = τ s / (1 + c)`, `Nx / D` is the `x` of the rational-parametrisation point
`((1 - T²), 2T) / (1 + T²)` rotated by `(cm, sm)`. Stated multiplied out by `(1 + c)²` and the
denominators: `Nx · ((1+c)² + τ² s²) = D · (cm ((1+c)² - τ² s²) - sm · 2 τ s (1+c))`. -/
theorem arc_reparam_x (cm sm c s t : Rat) (hφ : c * c + s * s = 1) :
    arcNx cm sm c s t * ((1 + c) * (1 + c) + (2 * t - 1) * (2 * t - 1) * s * s)
      = arcD c t * (cm * ((1 + c) * (1 + c) - (2 * t - 1) * (2 * t - 1) * s * s)
          - sm * (2 * (2 * t - 1) * s * (1 + c))) := by
  unfold arcNx arcD
  grind

/-- The exact reparametrisation, `y` part (see `arc_reparam_x`). -/
theorem arc_reparam_y (cm sm c s t : Rat) (hφ : c * c + s * s = 1) :
    arcNy cm sm c s t * ((1 + c) * (1 + c) + (2 * t - 1) * (2 * t - 1) * s * s)
      = arcD c t * (sm * ((1 + c) * (1 + c) - (2 * t - 1) * (2 * t - 1) * s * s)
          + cm * (2 * (2 * t - 1) * s * (1 + c))) := by
  unfold arcNy arcD
  grind

/-- The middle control point as `unitArcNet` computes it: from the end points,
`P1 = (P0 + P2) · k` with `k · 2 c² = 1` (TS `k = 1 / (2 w²)`). Its weighted point `w P1` is
the homogeneous middle point `(cm, sm)` of the model above (so the TS net is this segment). -/
theorem arc_mid_from_ends (cm sm c s k : Rat) (hk : k * (2 * (c * c)) = 1) :
    c * (((cm * c + sm * s) + (cm * c - sm * s)) * k) = cm
      ∧ c * (((sm * c - cm * s) + (sm * c + cm * s)) * k) = sm := by
  constructor
  · have : c * (((cm * c + sm * s) + (cm * c - sm * s)) * k) = cm * (k * (2 * (c * c))) := by grind
    rw [this, hk]; grind
  · have : c * (((sm * c - cm * s) + (sm * c + cm * s)) * k) = sm * (k * (2 * (c * c))) := by grind
    rw [this, hk]; grind

/-- The textbook quarter circle `(1,0), (1,1), (0,1)` with weights `1, w, 1`, `w² = 1/2`. -/
theorem quarter_on_unit_circle (w t : Rat) (hw : w * w = 1 / 2) :
    let nx := (1 - t) * (1 - t) * 1 + 2 * t * (1 - t) * w * 1 + t * t * 0
    let ny := (1 - t) * (1 - t) * 0 + 2 * t * (1 - t) * w * 1 + t * t * 1
    let d := (1 - t) * (1 - t) + 2 * t * (1 - t) * w + t * t
    nx * nx + ny * ny = d * d := by
  intro nx ny d
  simp only [nx, ny, d]
  grind

/-- The affine image `(a Nx, b Ny)` of an A7.1 segment (an elliptical arc in the frame of its
axes) lies on the ellipse `x²/a² + y²/b² = 1`, multiplied out. -/
theorem ellipse_arc_on_ellipse (a b cm sm c s t : Rat)
    (hm : cm * cm + sm * sm = 1) (hφ : c * c + s * s = 1) :
    b * b * ((a * arcNx cm sm c s t) * (a * arcNx cm sm c s t))
      + a * a * ((b * arcNy cm sm c s t) * (b * arcNy cm sm c s t))
      = a * a * (b * b) * (arcD c t * arcD c t) := by
  have h := arc_on_unit_circle cm sm c s t hm hφ
  grind

/-! ## (b) The rational parametrisation of the circle -/

theorem rational_unit_circle (T : Rat) :
    (1 - T * T) * (1 - T * T) + (2 * T) * (2 * T) = (1 + T * T) * (1 + T * T) := by
  grind

/-! ## (c) The ellipse -/

/-- `(a c, b s)` satisfies `x²/a² + y²/b² = 1`, multiplied out by `a² b²`. -/
theorem ellipse_point_on_ellipse (a b c s : Rat) (h : c * c + s * s = 1) :
    b * b * ((a * c) * (a * c)) + a * a * ((b * s) * (b * s)) = a * a * (b * b) := by
  grind

/-! ## (d) Circle evaluation in an orthonormal frame -/

open V3 in
/-- `C(c, s) = o + r c u + r s v`. -/
def circlePt (o u v : V3) (r c s : Rat) : V3 := add o (add (smul (r * c) u) (smul (r * s) v))

open V3 in
/-- `C' = -r s u + r c v`. -/
def circleD1 (u v : V3) (r c s : Rat) : V3 := add (smul (-(r * s)) u) (smul (r * c) v)

open V3 in
/-- `C'' = -r c u - r s v`. -/
def circleD2 (u v : V3) (r c s : Rat) : V3 := add (smul (-(r * c)) u) (smul (-(r * s)) v)

open V3 in
theorem circle_frame_radius (o u v : V3) (r c s : Rat)
    (huu : dot u u = 1) (hvv : dot v v = 1) (huv : dot u v = 0) (h : c * c + s * s = 1) :
    dot (sub (circlePt o u v r c s) o) (sub (circlePt o u v r c s) o) = r * r := by
  simp only [circlePt, add, sub, smul, dot] at *
  grind

open V3 in
theorem circle_deriv_orthogonal (o u v : V3) (r c s : Rat)
    (huu : dot u u = 1) (hvv : dot v v = 1) (huv : dot u v = 0) :
    dot (circleD1 u v r c s) (sub (circlePt o u v r c s) o) = 0 := by
  simp only [circlePt, circleD1, add, sub, smul, dot] at *
  grind

open V3 in
theorem circle_speed_sq (u v : V3) (r c s : Rat)
    (huu : dot u u = 1) (hvv : dot v v = 1) (huv : dot u v = 0) (h : c * c + s * s = 1) :
    dot (circleD1 u v r c s) (circleD1 u v r c s) = r * r := by
  simp only [circleD1, add, smul, dot] at *
  grind

open V3 in
theorem circle_second_deriv (o u v : V3) (r c s : Rat) :
    circleD2 u v r c s = smul (-1) (sub (circlePt o u v r c s) o) := by
  simp only [circlePt, circleD2, add, sub, smul, mk.injEq]
  grind

/-! ## (e) Closest point on a line -/

open V3 in
/-- `o + t d`. -/
def linePt (o d : V3) (t : Rat) : V3 := add o (smul t d)

open V3 in
/-- Squared distance from `p` to the line point at `t`. -/
def lineDist2 (o d p : V3) (t : Rat) : Rat := dot (sub p (linePt o d t)) (sub p (linePt o d t))

open V3 in
/-- The projection parameter `t* = (p - o)·d / (d·d)`. -/
def lineParam (o d p : V3) : Rat := dot (sub p o) d / dot d d

open V3 in
theorem line_closest_orthogonal (o d p : V3) (hd : dot d d ≠ 0) :
    dot (sub p (linePt o d (lineParam o d p))) d = 0 := by
  have key : lineParam o d p * dot d d = dot (sub p o) d := by
    unfold lineParam; exact Rat.div_mul_cancel hd
  simp only [linePt, lineParam, add, sub, smul, dot] at *
  grind

open V3 in
/-- `dist²(t) = dist²(t*) + (t - t*)² (d·d)`. -/
theorem line_dist_decomp (o d p : V3) (hd : dot d d ≠ 0) (t : Rat) :
    lineDist2 o d p t
      = lineDist2 o d p (lineParam o d p)
        + (t - lineParam o d p) * (t - lineParam o d p) * dot d d := by
  have orth := line_closest_orthogonal o d p hd
  generalize hk : lineParam o d p = k at *
  simp only [lineDist2, linePt, add, sub, smul, dot] at *
  grind

open V3 in
theorem line_closest_min (o d p : V3) (hd : dot d d ≠ 0) (t : Rat) :
    lineDist2 o d p (lineParam o d p) ≤ lineDist2 o d p t := by
  rw [line_dist_decomp o d p hd t]
  have hdd : 0 ≤ dot d d := by
    simp only [dot]
    have h1 := sq_nonneg d.x
    have h2 := sq_nonneg d.y
    have h3 := sq_nonneg d.z
    grind
  have hsq : 0 ≤ (t - lineParam o d p) * (t - lineParam o d p) := sq_nonneg _
  have := Rat.mul_nonneg hsq hdd
  grind

/-! ## Principal axes of an affine image (transformCurve3) -/

open V3 in
/-- Shifting the parameter by `t0` re-expresses `cos t U + sin t V` in the rotated axes. -/
theorem principal_axes_reparam (U V : V3) (cσ sσ c0 s0 : Rat) :
    add (smul (cσ * c0 - sσ * s0) U) (smul (sσ * c0 + cσ * s0) V)
      = add (smul cσ (add (smul c0 U) (smul s0 V))) (smul sσ (add (smul (-s0) U) (smul c0 V))) := by
  simp only [add, smul, mk.injEq]
  grind

open V3 in
theorem principal_axes_dot (U V : V3) (c0 s0 : Rat) :
    dot (add (smul c0 U) (smul s0 V)) (add (smul (-s0) U) (smul c0 V))
      = (c0 * c0 - s0 * s0) * dot U V - c0 * s0 * (dot U U - dot V V) := by
  simp only [add, smul, dot]
  grind

open V3 in
/-- The `t0` of `conicFromConjugateAxes`: `2 t0 = atan2(2 U·V, U·U - V·V)` means
`(cos 2t0, sin 2t0) = (c0² - s0², 2 c0 s0)` is the unit direction of `(U·U - V·V, 2 U·V)`,
i.e. `U·U - V·V = ρ (c0² - s0²)` and `2 U·V = ρ (2 c0 s0)` with `ρ ≥ 0`. Then the new axes are
orthogonal and `U'` is the major one: `|U'|² - |V'|² = ρ ≥ 0`. -/
theorem principal_axes_major (U V : V3) (c0 s0 ρ : Rat) (h : c0 * c0 + s0 * s0 = 1)
    (hρ : 0 ≤ ρ) (hd : dot U U - dot V V = ρ * (c0 * c0 - s0 * s0))
    (ho : 2 * dot U V = ρ * (2 * c0 * s0)) :
    dot (add (smul c0 U) (smul s0 V)) (add (smul (-s0) U) (smul c0 V)) = 0
      ∧ 0 ≤ dot (add (smul c0 U) (smul s0 V)) (add (smul c0 U) (smul s0 V))
          - dot (add (smul (-s0) U) (smul c0 V)) (add (smul (-s0) U) (smul c0 V)) := by
  have hdot := principal_axes_dot U V c0 s0
  have hdiff : dot (add (smul c0 U) (smul s0 V)) (add (smul c0 U) (smul s0 V))
      - dot (add (smul (-s0) U) (smul c0 V)) (add (smul (-s0) U) (smul c0 V))
      = (c0 * c0 - s0 * s0) * (dot U U - dot V V) + (2 * c0 * s0) * (2 * dot U V) := by
    simp only [add, smul, dot]; grind
  constructor
  · rw [hdot]
    have e1 : (c0 * c0 - s0 * s0) * dot U V = (c0 * c0 - s0 * s0) * (ρ * (c0 * s0)) := by grind
    have e2 : c0 * s0 * (dot U U - dot V V) = c0 * s0 * (ρ * (c0 * c0 - s0 * s0)) := by rw [hd]
    grind
  · rw [hdiff, hd, ho]
    have e : (c0 * c0 - s0 * s0) * (ρ * (c0 * c0 - s0 * s0)) + 2 * c0 * s0 * (ρ * (2 * c0 * s0))
        = ρ * ((c0 * c0 + s0 * s0) * (c0 * c0 + s0 * s0)) := by grind
    rw [e, h]; grind

end Curve
end CadloomFormal
