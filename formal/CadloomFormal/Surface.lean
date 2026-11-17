import CadloomFormal.Foundation
import CadloomFormal.Curve
/-
Surface: the exact rational model of the analytic surfaces of `src/surface/`, their implicit
equations, their differential geometry and their exact NURBS forms (The NURBS Book A8.1
MakeRevolvedSurf).

Core Lean has no reals: `cos u, sin u` are rational variables `(cu, su)` with the hypothesis
`cu * cu + su * su = 1`, and `(cv, sv)` likewise for the second angle; orthonormal frames
`(X, Y, Z)` are given by dot-product hypotheses. The formulas are those of the TS code:
`e = cu X + su Y`, and in `src/surface/evaluate.ts`
plane `O + u X + v Y`, cylinder `O + r e + h Z`, cone `O + (b + t h) e + h Z`,
sphere `O + r (cv e + sv Z)`, torus `O + (R + r cv) e + r sv Z`.

What each theorem models (TypeScript → Lean):

* `implicitValue` / the constructors (`src/surface/implicit.ts`, `types.ts`): the points of
  each surface satisfy its implicit equation, in an arbitrary orthonormal frame:
  - `cylinder_on_implicit`: `|p - O|² - ((p - O)·Z)² = r²` (squared distance to the axis), and
    `(p - O)·Z = h` — so the TS value `ρ - r` vanishes;
  - `sphere_on_implicit`: `|p - O|² = r²`;
  - `torus_local_implicit`: in local coordinates `(x, y, z)`,
    `(x² + y² + z² + R² - r²)² = 4 R² (x² + y²)`; `torus_meridian`: `(ρ - R)² + z² = r²` with
    `ρ = R + r cv` (the TS value `sqrt((ρ - R)² + z²) - r` vanishes when `ρ ≥ 0`, i.e. `R > r`);
  - `cone_on_implicit`: `|p - O|² - ((p - O)·Z)² = (b + t (p - O)·Z)²`;
  - `cone_meridian_zero`, `cone_foot_decomp`, `cone_foot_radius`: the TS cone distance. In the
    meridian half-plane `(ρ, z)`, with `t ca = sa` (`t = tan α`) and `ca² + sa² = 1`, the line
    value `g = (ρ - b) ca - z sa` vanishes on the generator, the point decomposes orthogonally as
    `(ρ, z) = (b, 0) + σ (sa, ca) + g (ca, -sa)` with `σ = (ρ - b) sa + z ca` (so `|g|` is the
    distance to the line and the foot is at height `v_f = σ ca`), and `R(v_f) = b + σ sa` is the
    foot's radius (the apex test `R(v_f) >= 0` of `coneFoot`).
  - `plane_signed_distance`: `(O + a X + b Y + h Z - O)·Z = h` (the TS `implicitValue` of a plane);
  - `plane_normal_eq_cross`: with `Y = Z × X` (the frame of `createCurveFrame`), `X × Y = Z`: the
    plane's unit normal `S_u × S_v = X × Y` is the frame normal.
* `evaluateSurface3` / `surfaceCurvature` (`src/surface/evaluate.ts`): in local coordinates
  (the forms are invariant under rigid motions), with the TS derivative formulas,
  `E = S_u·S_u, F = S_u·S_v, G = S_v·S_v`, `L = S_uu·n, M = S_uv·n, N = S_vv·n`:
  - `sphere_cross_eq`: `S_u × S_v = r² cv · n`, `n = cv e + sv Z` (outward when `cv > 0`);
  - `sphere_gauss`: `r² (LN - M²) = EG - F²` (`K = 1/r²`);
    `sphere_mean`: `r (EN - 2FM + GL) = -2 (EG - F²)` (`H = -1/r`, normal outward);
  - `cylinder_cross_eq`, `cylinder_gauss` (`LN - M² = 0`), `cylinder_mean`
    (`r (EN - 2FM + GL) = -(EG - F²)`, `H = -1/(2r)`);
  - `torus_cross_eq` (`S_u × S_v = r (R + r cv) n`), `torus_gauss`:
    `r (R + r cv) (LN - M²) = cv (EG - F²)`, i.e. `K = cv / (r (R + r cv))`: positive on the outer
    equator (`cv = 1`), negative on the inner one (`cv = -1`);
  - `cone_cross_eq` (`S_u × S_v = R(v) (e - t Z)`), `cone_gauss` (`LN - M² = 0`).
* `revolveCurveToNurbs` (`src/surface/nurbs-form.ts`, A8.1):
  - `rotate_axis_distance`: rotating a profile point `O + x X + z Z` by `(c, s)` about `Z` keeps
    its distance to the axis (`x²`) and its height (`z`);
  - `revolve_tensor_x/_y/_z/_w`: the homogeneous tensor-product sums of the revolved net
    (`P_ij = r_j (x_i X + y_i Y) + z_j Z` relative to the axis point, weight `α_i β_j` where
    `α_i = B_i(a) w_i` and `β_j = B_j(b) w_j` are the arc's and the profile's basis functions
    times weights) factor into arc sums × profile sums, for nets of **any** size (lists);
  - `revolve_sphere`, `revolve_torus`, `revolve_cone`: hence if the profile's homogeneous point
    lies on a meridian circle / tube circle / generator line and the arc's on the unit circle,
    the surface's homogeneous point `(N, D)` satisfies `|N|² = ρ² D²`, the homogeneous torus
    equation, or the cone equation — at every parameter, not just at control points;
  - `sphere_segment_patch`: the concrete symbolic patch: one A7.1 segment in each direction with
    the middle control point exactly as `unitArcNet` computes it (`(P0 + P2) k`, `k · 2c² = 1`)
    gives a homogeneous point on the sphere of radius `ρ`.

Lemmas (no TS counterpart of their own): `sub_add_cancel_left`, `dot_comb`, `dot_comb_Z`,
`dot_comb_orth`, `dot_comb_Z_orth` (bilinearity of `dot` on frame combinations), `psum_mul_left`,
`psum_congr`, `psum_mul_right`, `tensor_factor` (double sums of products factor),
`segment_sums` (the sums of a TS A7.1 segment are `Curve.arcNx/arcNy/arcD`), `scaleSeg_sums`.

NOT covered: IEEE-754 rounding and libm `cos`/`sin`/`tan`/`atan2`/`hypot` (the hypotheses
`c² + s² = 1` and orthonormality hold only approximately in doubles), the knot vectors and the
segment count of A7.1, a profile that is not coplanar with the axis (the revolve theorems
use one common radial direction `X` with signed `r_j`, which covers the analytic patches; the TS
uses a per-row `X_j`, correct by linearity of the rotation, checked only by tests), the
B-spline evaluation of the profile (a general profile enters only
through its homogeneous point), the angle maps `unitArcAngleOfParam`, the sign/nappe case
analysis and `Result` error paths of `projectPoint` / `implicitValue`, the Newton projection on
NURBS, the principal curvatures' square root, the similarity test of `transformSurface3`, and
the degeneracy thresholds. These are checked by tests in `tests/surface.test.ts` (one test per
theorem, named after it).
-/
namespace CadloomFormal
namespace Surface

open V3

/-! ## Frame helpers -/

/-- `a X + b Y + c Z`. -/
def comb (X Y Z : V3) (a b c : Rat) : V3 := add (smul a X) (add (smul b Y) (smul c Z))

theorem sub_add_cancel_left (O w : V3) : sub (add O w) O = w := by
  cases O; cases w; simp only [sub, add, mk.injEq]; grind

/-- Bilinearity of `dot` on frame combinations (no hypotheses). -/
theorem dot_comb (X Y Z : V3) (a b c a' b' c' : Rat) :
    dot (comb X Y Z a b c) (comb X Y Z a' b' c')
      = a * a' * dot X X + b * b' * dot Y Y + c * c' * dot Z Z + (a * b' + b * a') * dot X Y
        + (a * c' + c * a') * dot X Z + (b * c' + c * b') * dot Y Z := by
  simp only [comb, add, smul, dot]; grind

theorem dot_comb_Z (X Y Z : V3) (a b c : Rat) :
    dot (comb X Y Z a b c) Z = a * dot X Z + b * dot Y Z + c * dot Z Z := by
  simp only [comb, add, smul, dot]; grind

/-- In an orthonormal frame, `dot` of combinations is the dot of the coefficients. -/
theorem dot_comb_orth (X Y Z : V3) (a b c a' b' c' : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0) :
    dot (comb X Y Z a b c) (comb X Y Z a' b' c') = a * a' + b * b' + c * c' := by
  rw [dot_comb, hxx, hyy, hzz, hxy, hxz, hyz]; grind

theorem dot_comb_Z_orth (X Y Z : V3) (a b c : Rat)
    (hzz : dot Z Z = 1) (hxz : dot X Z = 0) (hyz : dot Y Z = 0) :
    dot (comb X Y Z a b c) Z = c := by
  rw [dot_comb_Z, hzz, hxz, hyz]; grind

/-! ## (a) Cylinder -/

theorem cylinder_on_implicit (O X Y Z : V3) (r cu su h : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0)
    (hu : cu * cu + su * su = 1) :
    let d := sub (add O (comb X Y Z (r * cu) (r * su) h)) O
    dot d d - dot d Z * dot d Z = r * r ∧ dot d Z = h := by
  intro d
  simp only [d, sub_add_cancel_left]
  rw [dot_comb_orth X Y Z _ _ _ _ _ _ hxx hyy hzz hxy hxz hyz, dot_comb_Z_orth X Y Z _ _ _ hzz hxz hyz]
  constructor
  · have : r * cu * (r * cu) + r * su * (r * su) = r * r * (cu * cu + su * su) := by grind
    grind
  · rfl

/-! ## (b) Sphere -/

theorem sphere_on_implicit (O X Y Z : V3) (r cu su cv sv : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0)
    (hu : cu * cu + su * su = 1) (hv : cv * cv + sv * sv = 1) :
    let d := sub (add O (comb X Y Z (r * cv * cu) (r * cv * su) (r * sv))) O
    dot d d = r * r := by
  intro d
  simp only [d, sub_add_cancel_left]
  rw [dot_comb_orth X Y Z _ _ _ _ _ _ hxx hyy hzz hxy hxz hyz]
  have e : r * cv * cu * (r * cv * cu) + r * cv * su * (r * cv * su) + r * sv * (r * sv)
      = r * r * (cv * cv * (cu * cu + su * su) + sv * sv) := by grind
  rw [e, hu]; grind

/-! ## (c) Torus -/

/-- The quartic of the torus in local coordinates. -/
theorem torus_local_implicit (R r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) (hv : cv * cv + sv * sv = 1) :
    let x := (R + r * cv) * cu
    let y := (R + r * cv) * su
    let z := r * sv
    (x * x + y * y + z * z + R * R - r * r) * (x * x + y * y + z * z + R * R - r * r)
      = 4 * (R * R) * (x * x + y * y) := by
  intro x y z
  simp only [x, y, z]
  have hxy : (R + r * cv) * cu * ((R + r * cv) * cu) + (R + r * cv) * su * ((R + r * cv) * su)
      = (R + r * cv) * (R + r * cv) := by grind
  rw [hxy]
  have hs : (R + r * cv) * (R + r * cv) + r * sv * (r * sv) + R * R - r * r = 2 * R * (R + r * cv) := by
    grind
  rw [hs]
  grind

/-- In the meridian half-plane the point is on the tube circle: `(ρ - R)² + z² = r²`. -/
theorem torus_meridian (R r cv sv : Rat) (hv : cv * cv + sv * sv = 1) :
    ((R + r * cv) - R) * ((R + r * cv) - R) + (r * sv) * (r * sv) = r * r := by
  grind

/-! ## (d) Cone -/

theorem cone_on_implicit (O X Y Z : V3) (b t cu su h : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0)
    (hu : cu * cu + su * su = 1) :
    let d := sub (add O (comb X Y Z ((b + t * h) * cu) ((b + t * h) * su) h)) O
    dot d d - dot d Z * dot d Z = (b + t * dot d Z) * (b + t * dot d Z) := by
  intro d
  simp only [d, sub_add_cancel_left]
  rw [dot_comb_orth X Y Z _ _ _ _ _ _ hxx hyy hzz hxy hxz hyz, dot_comb_Z_orth X Y Z _ _ _ hzz hxz hyz]
  have e : (b + t * h) * cu * ((b + t * h) * cu) + (b + t * h) * su * ((b + t * h) * su)
      = (b + t * h) * (b + t * h) * (cu * cu + su * su) := by grind
  grind

/-- The line value `g = (ρ - b) ca - z sa` vanishes on the generator `ρ = b + t z`. -/
theorem cone_meridian_zero (b z ca sa t : Rat) (ht : t * ca = sa) :
    ((b + t * z) - b) * ca - z * sa = 0 := by
  have : ((b + t * z) - b) * ca - z * sa = z * (t * ca - sa) := by grind
  rw [this, ht]; grind

/-- Orthogonal decomposition in the meridian plane: `(ρ, z) = (b, 0) + σ (sa, ca) + g (ca, -sa)`. -/
theorem cone_foot_decomp (b ρ z ca sa : Rat) (h : ca * ca + sa * sa = 1) :
    let σ := (ρ - b) * sa + z * ca
    let g := (ρ - b) * ca - z * sa
    ρ = b + σ * sa + g * ca ∧ z = σ * ca - g * sa := by
  intro σ g
  simp only [σ, g]
  constructor <;> grind

/-- The foot at height `v_f = σ ca` has radius `R(v_f) = b + t v_f = b + σ sa`. -/
theorem cone_foot_radius (b σ ca sa t : Rat) (ht : t * ca = sa) :
    b + t * (σ * ca) = b + σ * sa := by
  have : t * (σ * ca) = σ * (t * ca) := by grind
  rw [this, ht]

/-! ## (f) Plane -/

theorem plane_normal_eq_cross (X Z : V3) (hxx : dot X X = 1) (hxz : dot X Z = 0) :
    cross X (cross Z X) = Z := by
  cases X; cases Z
  simp only [cross, dot, mk.injEq] at *
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem plane_signed_distance (O X Y Z : V3) (a b h : Rat)
    (hzz : dot Z Z = 1) (hxz : dot X Z = 0) (hyz : dot Y Z = 0) :
    dot (sub (add O (comb X Y Z a b h)) O) Z = h := by
  simp only [comb, add, sub, smul, dot] at *
  grind

/-! ## Differential geometry (local coordinates) -/

/-- `E, F, G, L, M, N` of the partials `Su, Sv, Suu, Suv, Svv` and the unit normal `n`. -/
structure Forms where
  E : Rat
  F : Rat
  G : Rat
  L : Rat
  M : Rat
  N : Rat

def forms (Su Sv Suu Suv Svv n : V3) : Forms :=
  ⟨dot Su Su, dot Su Sv, dot Sv Sv, dot Suu n, dot Suv n, dot Svv n⟩

/-- Sphere partials (TS `analyticLocal`, sphere case, `R = 0`). -/
def sphSu (r cu su cv : Rat) : V3 := ⟨-(r * cv) * su, r * cv * cu, 0⟩
def sphSv (r cu su cv sv : Rat) : V3 := ⟨-(r * sv) * cu, -(r * sv) * su, r * cv⟩
def sphSuu (r cu su cv : Rat) : V3 := ⟨-(r * cv) * cu, -(r * cv) * su, 0⟩
def sphSuv (r cu su sv : Rat) : V3 := ⟨r * sv * su, -(r * sv) * cu, 0⟩
def sphSvv (r cu su cv sv : Rat) : V3 := ⟨-(r * cv) * cu, -(r * cv) * su, -(r * sv)⟩
/-- The outward unit normal `cv e + sv Z`. -/
def sphN (cu su cv sv : Rat) : V3 := ⟨cv * cu, cv * su, sv⟩

theorem sphere_cross_eq (r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) :
    cross (sphSu r cu su cv) (sphSv r cu su cv sv) = smul (r * r * cv) (sphN cu su cv sv) := by
  simp only [sphSu, sphSv, sphN, cross, smul, mk.injEq]
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem sphere_gauss (r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) :
    let f := forms (sphSu r cu su cv) (sphSv r cu su cv sv) (sphSuu r cu su cv)
      (sphSuv r cu su sv) (sphSvv r cu su cv sv) (sphN cu su cv sv)
    r * r * (f.L * f.N - f.M * f.M) = f.E * f.G - f.F * f.F := by
  intro f
  simp only [f, forms, sphSu, sphSv, sphSuu, sphSuv, sphSvv, sphN, dot]
  grind

theorem sphere_mean (r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) :
    let f := forms (sphSu r cu su cv) (sphSv r cu su cv sv) (sphSuu r cu su cv)
      (sphSuv r cu su sv) (sphSvv r cu su cv sv) (sphN cu su cv sv)
    r * (f.E * f.N - 2 * f.F * f.M + f.G * f.L) = -2 * (f.E * f.G - f.F * f.F) := by
  intro f
  simp only [f, forms, sphSu, sphSv, sphSuu, sphSuv, sphSvv, sphN, dot]
  grind

/-- Cylinder partials. -/
def cylSu (r cu su : Rat) : V3 := ⟨-(r * su), r * cu, 0⟩
def cylSv : V3 := ⟨0, 0, 1⟩
def cylSuu (r cu su : Rat) : V3 := ⟨-(r * cu), -(r * su), 0⟩
def zero3 : V3 := ⟨0, 0, 0⟩
def cylN (cu su : Rat) : V3 := ⟨cu, su, 0⟩

theorem cylinder_cross_eq (r cu su : Rat) :
    cross (cylSu r cu su) cylSv = smul r (cylN cu su) := by
  simp only [cylSu, cylSv, cylN, cross, smul, mk.injEq]
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem cylinder_gauss (r cu su : Rat) :
    let f := forms (cylSu r cu su) cylSv (cylSuu r cu su) zero3 zero3 (cylN cu su)
    f.L * f.N - f.M * f.M = 0 := by
  intro f
  simp only [f, forms, cylSu, cylSv, cylSuu, zero3, cylN, dot]
  grind

theorem cylinder_mean (r cu su : Rat) :
    let f := forms (cylSu r cu su) cylSv (cylSuu r cu su) zero3 zero3 (cylN cu su)
    r * (f.E * f.N - 2 * f.F * f.M + f.G * f.L) = -(f.E * f.G - f.F * f.F) := by
  intro f
  simp only [f, forms, cylSu, cylSv, cylSuu, zero3, cylN, dot]
  grind

/-- Torus partials, `ρ = R + r cv`. -/
def torSu (R r cu su cv : Rat) : V3 := ⟨-((R + r * cv) * su), (R + r * cv) * cu, 0⟩
def torSuu (R r cu su cv : Rat) : V3 := ⟨-((R + r * cv) * cu), -((R + r * cv) * su), 0⟩

theorem torus_cross_eq (R r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) :
    cross (torSu R r cu su cv) (sphSv r cu su cv sv) = smul (r * (R + r * cv)) (sphN cu su cv sv) := by
  simp only [torSu, sphSv, sphN, cross, smul, mk.injEq]
  refine ⟨?_, ?_, ?_⟩ <;> grind

theorem torus_gauss (R r cu su cv sv : Rat)
    (hu : cu * cu + su * su = 1) :
    let f := forms (torSu R r cu su cv) (sphSv r cu su cv sv) (torSuu R r cu su cv)
      (sphSuv r cu su sv) (sphSvv r cu su cv sv) (sphN cu su cv sv)
    r * (R + r * cv) * (f.L * f.N - f.M * f.M) = cv * (f.E * f.G - f.F * f.F) := by
  intro f
  simp only [f, forms, torSu, sphSv, torSuu, sphSuv, sphSvv, sphN, dot]
  grind

/-- Cone partials with `ρ = b + t h`: `Su = ρ f`, `Sv = t e + Z`, `Suu = -ρ e`, `Suv = t f`. -/
def coneSu (ρ cu su : Rat) : V3 := ⟨-(ρ * su), ρ * cu, 0⟩
def coneSv (t cu su : Rat) : V3 := ⟨t * cu, t * su, 1⟩
def coneSuu (ρ cu su : Rat) : V3 := ⟨-(ρ * cu), -(ρ * su), 0⟩
def coneSuv (t cu su : Rat) : V3 := ⟨-(t * su), t * cu, 0⟩
/-- `e - t Z` (not normalised). -/
def coneW (t cu su : Rat) : V3 := ⟨cu, su, -t⟩

theorem cone_cross_eq (ρ t cu su : Rat) (hu : cu * cu + su * su = 1) :
    cross (coneSu ρ cu su) (coneSv t cu su) = smul ρ (coneW t cu su) := by
  simp only [coneSu, coneSv, coneW, cross, smul, mk.injEq]
  refine ⟨?_, ?_, ?_⟩ <;> grind

/-- `LN - M² = 0` for any normal multiple `k (e - t Z)` (so for the unit normal): `K = 0`. -/
theorem cone_gauss (ρ t cu su k : Rat) :
    let f := forms (coneSu ρ cu su) (coneSv t cu su) (coneSuu ρ cu su) (coneSuv t cu su) zero3
      (smul k (coneW t cu su))
    f.L * f.N - f.M * f.M = 0 := by
  intro f
  simp only [f, forms, coneSu, coneSv, coneSuu, coneSuv, zero3, coneW, smul, dot]
  grind

/-! ## (e) Surfaces of revolution (A8.1) -/

/-- Rotating `O + x X + z Z` about the axis `(O, Z)` by `(c, s)` gives `O + x c X + x s Y + z Z`:
the distance to the axis and the height are unchanged. -/
theorem rotate_axis_distance (O X Y Z : V3) (x z c s : Rat)
    (hxx : dot X X = 1) (hyy : dot Y Y = 1) (hzz : dot Z Z = 1)
    (hxy : dot X Y = 0) (hxz : dot X Z = 0) (hyz : dot Y Z = 0)
    (h : c * c + s * s = 1) :
    let d := sub (add O (comb X Y Z (x * c) (x * s) z)) O
    dot d d - dot d Z * dot d Z = x * x ∧ dot d Z = z := by
  intro d
  simp only [d, sub_add_cancel_left]
  rw [dot_comb_orth X Y Z _ _ _ _ _ _ hxx hyy hzz hxy hxz hyz, dot_comb_Z_orth X Y Z _ _ _ hzz hxz hyz]
  constructor
  · have : x * c * (x * c) + x * s * (x * s) = x * x * (c * c + s * s) := by grind
    grind
  · rfl

/-- Sum over a list of triples. -/
def psum : List (Rat × Rat × Rat) → (Rat → Rat → Rat → Rat) → Rat
  | [], _ => 0
  | (a, b, c) :: t, f => f a b c + psum t f

theorem psum_mul_left (l : List (Rat × Rat × Rat)) (k : Rat) (g : Rat → Rat → Rat → Rat) :
    psum l (fun a b c => k * g a b c) = k * psum l g := by
  induction l with
  | nil => simp [psum]
  | cons hd t ih =>
    obtain ⟨a, b, c⟩ := hd
    simp only [psum, ih]; grind

theorem psum_congr (l : List (Rat × Rat × Rat)) (f g : Rat → Rat → Rat → Rat)
    (h : ∀ a b c, f a b c = g a b c) : psum l f = psum l g := by
  have : f = g := by funext a b c; exact h a b c
  rw [this]

theorem psum_mul_right (l : List (Rat × Rat × Rat)) (k : Rat) (g : Rat → Rat → Rat → Rat) :
    psum l (fun a b c => g a b c * k) = psum l g * k := by
  rw [psum_congr l (fun a b c => g a b c * k) (fun a b c => k * g a b c) (fun _ _ _ => by grind),
    psum_mul_left]; grind

/-- Arc sums: `Σ α_i`, `Σ α_i x_i`, `Σ α_i y_i` (entries `(α_i, x_i, y_i)`). -/
def aW (arc : List (Rat × Rat × Rat)) : Rat := psum arc (fun a _ _ => a)
def aX (arc : List (Rat × Rat × Rat)) : Rat := psum arc (fun a x _ => a * x)
def aY (arc : List (Rat × Rat × Rat)) : Rat := psum arc (fun a _ y => a * y)
/-- Profile sums: `Σ β_j`, `Σ β_j r_j`, `Σ β_j z_j` (entries `(β_j, r_j, z_j)`, meridian coordinates). -/
def pW (pr : List (Rat × Rat × Rat)) : Rat := psum pr (fun b _ _ => b)
def pR (pr : List (Rat × Rat × Rat)) : Rat := psum pr (fun b r _ => b * r)
def pZ (pr : List (Rat × Rat × Rat)) : Rat := psum pr (fun b _ z => b * z)

/-- Homogeneous tensor sums of the revolved net `P_ij = r_j (x_i X + y_i Y) + z_j Z`, weight
`α_i β_j` (the frame components of `Σ_i Σ_j α_i β_j P_ij` and the denominator `Σ_i Σ_j α_i β_j`). -/
def tX (arc pr : List (Rat × Rat × Rat)) : Rat := psum arc (fun a x _ => psum pr (fun b r _ => a * b * (r * x)))
def tY (arc pr : List (Rat × Rat × Rat)) : Rat := psum arc (fun a _ y => psum pr (fun b r _ => a * b * (r * y)))
def tZ (arc pr : List (Rat × Rat × Rat)) : Rat := psum arc (fun a _ _ => psum pr (fun b _ z => a * b * z))
def tW (arc pr : List (Rat × Rat × Rat)) : Rat := psum arc (fun a _ _ => psum pr (fun b _ _ => a * b))

/-- A double sum of products factors: `Σ_i Σ_j f_i g_j = (Σ_i f_i)(Σ_j g_j)`. -/
theorem tensor_factor (arc pr : List (Rat × Rat × Rat)) (f g : Rat → Rat → Rat → Rat) :
    psum arc (fun a x y => psum pr (fun b r z => f a x y * g b r z)) = psum arc f * psum pr g := by
  rw [psum_congr arc _ (fun a x y => f a x y * psum pr g) (fun a x y => psum_mul_left pr (f a x y) g)]
  exact psum_mul_right arc _ f

theorem revolve_tensor_x (arc pr : List (Rat × Rat × Rat)) : tX arc pr = aX arc * pR pr := by
  unfold tX aX pR
  rw [← tensor_factor]
  apply psum_congr; intro a x y
  apply psum_congr; intro b r z
  grind

theorem revolve_tensor_y (arc pr : List (Rat × Rat × Rat)) : tY arc pr = aY arc * pR pr := by
  unfold tY aY pR
  rw [← tensor_factor]
  apply psum_congr; intro a x y
  apply psum_congr; intro b r z
  grind

theorem revolve_tensor_z (arc pr : List (Rat × Rat × Rat)) : tZ arc pr = aW arc * pZ pr := by
  unfold tZ aW pZ
  rw [← tensor_factor]
  apply psum_congr; intro a x y
  apply psum_congr; intro b r z
  grind

theorem revolve_tensor_w (arc pr : List (Rat × Rat × Rat)) : tW arc pr = aW arc * pW pr := by
  unfold tW aW pW
  exact (tensor_factor arc pr (fun a _ _ => a) (fun b _ _ => b)).symm ▸ rfl

/-- Sphere: arc on the unit circle and profile on the meridian circle of radius `ρ` about the
axis point ⇒ `|N|² = ρ² D²` for the revolved surface's homogeneous point. -/
theorem revolve_sphere (arc pr : List (Rat × Rat × Rat)) (ρ : Rat)
    (ha : aX arc * aX arc + aY arc * aY arc = aW arc * aW arc)
    (hp : pR pr * pR pr + pZ pr * pZ pr = ρ * ρ * (pW pr * pW pr)) :
    tX arc pr * tX arc pr + tY arc pr * tY arc pr + tZ arc pr * tZ arc pr
      = ρ * ρ * (tW arc pr * tW arc pr) := by
  rw [revolve_tensor_x, revolve_tensor_y, revolve_tensor_z, revolve_tensor_w]
  have e : aX arc * pR pr * (aX arc * pR pr) + aY arc * pR pr * (aY arc * pR pr)
      + aW arc * pZ pr * (aW arc * pZ pr)
      = (aX arc * aX arc + aY arc * aY arc) * (pR pr * pR pr) + aW arc * aW arc * (pZ pr * pZ pr) := by
    grind
  rw [e, ha]
  have e2 : aW arc * aW arc * (pR pr * pR pr) + aW arc * aW arc * (pZ pr * pZ pr)
      = aW arc * aW arc * (pR pr * pR pr + pZ pr * pZ pr) := by grind
  rw [e2, hp]; grind

/-- Torus: profile on the tube circle `(ρ - R)² + z² = r²` (homogeneous) ⇒ the homogeneous
torus quartic `(|N|² + (R² - r²) D²)² = 4 R² D² (N_x² + N_y²)`. -/
theorem revolve_torus (arc pr : List (Rat × Rat × Rat)) (R r : Rat)
    (ha : aX arc * aX arc + aY arc * aY arc = aW arc * aW arc)
    (hp : (pR pr - R * pW pr) * (pR pr - R * pW pr) + pZ pr * pZ pr = r * r * (pW pr * pW pr)) :
    let n2 := tX arc pr * tX arc pr + tY arc pr * tY arc pr + tZ arc pr * tZ arc pr
    let d := tW arc pr
    (n2 + (R * R - r * r) * (d * d)) * (n2 + (R * R - r * r) * (d * d))
      = 4 * (R * R) * (d * d) * (tX arc pr * tX arc pr + tY arc pr * tY arc pr) := by
  intro n2 d
  simp only [n2, d]
  rw [revolve_tensor_x, revolve_tensor_y, revolve_tensor_z, revolve_tensor_w]
  generalize aX arc = ax at *
  generalize aY arc = ay at *
  generalize aW arc = aw at *
  generalize pR pr = pr' at *
  generalize pZ pr = pz at *
  generalize pW pr = pw at *
  have hxy : ax * pr' * (ax * pr') + ay * pr' * (ay * pr') = aw * aw * (pr' * pr') := by
    have : ax * pr' * (ax * pr') + ay * pr' * (ay * pr') = (ax * ax + ay * ay) * (pr' * pr') := by grind
    rw [this, ha]
  have hin : ax * pr' * (ax * pr') + ay * pr' * (ay * pr') + aw * pz * (aw * pz)
      + (R * R - r * r) * (aw * pw * (aw * pw)) = aw * aw * (2 * R * pr' * pw) := by
    rw [hxy]
    have : pr' * pr' + pz * pz + (R * R - r * r) * (pw * pw) = 2 * R * pr' * pw := by grind
    grind
  rw [hin, hxy]
  grind

/-- Cone: profile on the generator line `ρ = b + t z` (homogeneous `pR = b pW + t pZ`) ⇒
`N_x² + N_y² = (b D + t N_z)²`. -/
theorem revolve_cone (arc pr : List (Rat × Rat × Rat)) (b t : Rat)
    (ha : aX arc * aX arc + aY arc * aY arc = aW arc * aW arc)
    (hp : pR pr = b * pW pr + t * pZ pr) :
    tX arc pr * tX arc pr + tY arc pr * tY arc pr
      = (b * tW arc pr + t * tZ arc pr) * (b * tW arc pr + t * tZ arc pr) := by
  rw [revolve_tensor_x, revolve_tensor_y, revolve_tensor_z, revolve_tensor_w]
  have e : aX arc * pR pr * (aX arc * pR pr) + aY arc * pR pr * (aY arc * pR pr)
      = (aX arc * aX arc + aY arc * aY arc) * (pR pr * pR pr) := by grind
  rw [e, ha, hp]; grind

/-- One A7.1 segment as the TS stores it: Bernstein weight times weight `α_i`, Euclidean point
`(x_i, y_i)`; end points at angles `m ∓ φ`, middle point `(P0 + P2) k` with weight `c`. -/
def segment (cm sm c s k t : Rat) : List (Rat × Rat × Rat) :=
  [((1 - t) * (1 - t), cm * c + sm * s, sm * c - cm * s),
   (2 * t * (1 - t) * c, ((cm * c + sm * s) + (cm * c - sm * s)) * k, ((sm * c - cm * s) + (sm * c + cm * s)) * k),
   (t * t, cm * c - sm * s, sm * c + cm * s)]

theorem segment_sums (cm sm c s k t : Rat) (hk : k * (2 * (c * c)) = 1) :
    aX (segment cm sm c s k t) = Curve.arcNx cm sm c s t
      ∧ aY (segment cm sm c s k t) = Curve.arcNy cm sm c s t
      ∧ aW (segment cm sm c s k t) = Curve.arcD c t := by
  obtain ⟨hx, hy⟩ := Curve.arc_mid_from_ends cm sm c s k hk
  simp only [aX, aY, aW, segment, psum, Curve.arcNx, Curve.arcNy, Curve.arcD]
  refine ⟨?_, ?_, ?_⟩
  · have : 2 * t * (1 - t) * c * (((cm * c + sm * s) + (cm * c - sm * s)) * k)
        = 2 * t * (1 - t) * (c * (((cm * c + sm * s) + (cm * c - sm * s)) * k)) := by grind
    rw [this, hx]; grind
  · have : 2 * t * (1 - t) * c * (((sm * c - cm * s) + (sm * c + cm * s)) * k)
        = 2 * t * (1 - t) * (c * (((sm * c - cm * s) + (sm * c + cm * s)) * k)) := by grind
    rw [this, hy]; grind
  · grind

/-- Scales a segment's points by `ρ` (the meridian arc of radius `ρ`: `(r, z) = ρ (x, y)`). -/
def scaleSeg (ρ : Rat) (l : List (Rat × Rat × Rat)) : List (Rat × Rat × Rat) :=
  l.map (fun e => (e.1, ρ * e.2.1, ρ * e.2.2))

theorem scaleSeg_sums (ρ : Rat) (l : List (Rat × Rat × Rat)) :
    pR (scaleSeg ρ l) = ρ * aX l ∧ pZ (scaleSeg ρ l) = ρ * aY l ∧ pW (scaleSeg ρ l) = aW l := by
  induction l with
  | nil => simp [scaleSeg, pR, pZ, pW, aX, aY, aW, psum]
  | cons hd tl ih =>
    obtain ⟨a, b, c⟩ := hd
    simp only [scaleSeg, List.map, pR, pZ, pW, aX, aY, aW, psum] at *
    obtain ⟨h1, h2, h3⟩ := ih
    refine ⟨?_, ?_, ?_⟩ <;> grind

/-- The symbolic sphere patch of `sphereToNurbs`: one A7.1 segment in the rotation direction
`(cm, sm, c, s, k)` at local parameter `t1` times one A7.1 segment of the meridian of radius
`ρ`, `(cm', sm', c', s', k')` at `t2`, as `unitArcNet` builds them. Its homogeneous point lies
on the sphere: `|N|² = ρ² D²`. -/
theorem sphere_segment_patch (ρ cm sm c s k t1 cm' sm' c' s' k' t2 : Rat)
    (hm : cm * cm + sm * sm = 1) (hφ : c * c + s * s = 1) (hk : k * (2 * (c * c)) = 1)
    (hm' : cm' * cm' + sm' * sm' = 1) (hφ' : c' * c' + s' * s' = 1) (hk' : k' * (2 * (c' * c')) = 1) :
    let arc := segment cm sm c s k t1
    let pr := scaleSeg ρ (segment cm' sm' c' s' k' t2)
    tX arc pr * tX arc pr + tY arc pr * tY arc pr + tZ arc pr * tZ arc pr
      = ρ * ρ * (tW arc pr * tW arc pr) := by
  intro arc pr
  apply revolve_sphere
  · obtain ⟨hx, hy, hw⟩ := segment_sums cm sm c s k t1 hk
    simp only [arc]
    rw [hx, hy, hw]
    exact Curve.arc_on_unit_circle cm sm c s t1 hm hφ
  · obtain ⟨hr, hz, hw⟩ := scaleSeg_sums ρ (segment cm' sm' c' s' k' t2)
    obtain ⟨hx, hy, hw'⟩ := segment_sums cm' sm' c' s' k' t2 hk'
    simp only [pr]
    rw [hr, hz, hw, hx, hy, hw']
    have := Curve.arc_on_unit_circle cm' sm' c' s' t2 hm' hφ'
    grind

end Surface
end CadloomFormal
