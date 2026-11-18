import CadloomFormal.Prism
import CadloomFormal.Primitive

/-!
# Sweep: reflections and the double reflection frame step, revolve topology, Pappus

Exact rational models of `src/sweep/` (`frames.ts`, `revolve.ts`). Vectors are `V3` (`Foundation`), 2D meridian
points `Tess.P = Rat × Rat` with `.1 = ρ` (distance from the axis) and `.2 = h` (height along it), coedges
`TopologyGeometry.Use` (face, edge, reversed), arenas `Primitive.Model`.

## (a) Reflections — `reflect3` in `frames.ts` (Lean `reflect`)
`reflect v n = v - (2 (v·n) / (n·n)) n`, and `v` itself when `n·n = 0` (the TS skips a zero reflection the same way).
* `reflect_dot` — a reflection keeps dot products: `R a · R b = a · b` (hence lengths and orthogonality).
* `reflect_involutive` — `R (R v) = v`.
* `reflect_swap` — if `|a| = |b|`, reflecting by `n = b - a` maps `a` to `b` (also when `a = b`, `n = 0`, via
  `sq3_zero`).

## (b) The double reflection step — `doubleReflectionStep` in `frames.ts` (Wang et al. 2008)
`drStep x0 x1 t0 t1 r0` is the TS formula: `v1 = x1 - x0`, `rL = R_{v1} r0`, `tL = R_{v1} t0`, `v2 = t1 - tL`,
`r1 = R_{v2} rL`.
* `dr_tangent` — the same two reflections take `t0` to `t1` whenever `|t1| = |t0|`: the transported frame's tangent is
  the path's tangent at the next station.
* `dr_orthonormal` — if `(r0, t0)` is orthonormal and `|t1| = 1`, then `(r1, t1)` is orthonormal.
* `dr_frame_orthonormal` — with `s1 = t1 × r1` (the TS `binormal`), `(r1, s1, t1)` is orthonormal.
The station points `x0`, `x1` are arbitrary (the first reflection only needs to be a reflection).

## (c) Revolve topology — `revolve.ts`, ids exactly as the TS builders assign them
*Full turn* (`buildFullRun`, a cyclic run: a wire not touching the axis): segment kinds `ks` (`curved` for a
cylinder / cone / sphere / torus / NURBS face, `planarUp` / `planarDown` for a plane whose radius grows / shrinks along
the segment), `N = ks.length`, `M` curved. Vertices `g`; edges the circles `(g, g)` then a meridian `(g, g+1 mod N)` per
curved segment (id `N + #curved before g`); face `g` has the loop `[c_g fwd, m_g fwd, c_{g+1} rev, m_g rev]` (curved)
or the two loops `[c_g fwd]`, `[c_{g+1} rev]`, larger radius first (planar).
* `fullLoopsFrom_length`, `meridiansFrom_length`, `full_counts` — `E = N + M`, `L = 2N - M` for every `ks`.
* `full_euler_poincare` — `V - E + F - (L - F) = 2 (S - G)` with `S = 1`, `G = 1`; `full_genus` — genus 1.
* `full_examples_close`, `full_examples_paired`, `full_examples_counts` — decided on models: the loops close, every
  edge has two opposite coedges, and the counts `eulerPoincare` takes (distinct start vertices, distinct edges, used
  faces) are `N`, `N + M`, `N` — for a rectangle tube `[up, curved, down, curved]`, a quadrilateral of cones, a
  triangle `[curved, curved, curved]` and a lone circle `[curved]`; `full_circle_is_torus` — the latter is exactly
  `makeTorus`'s arena `Primitive.torusModel` (same ids, same coedge order).
*Partial turn* (`buildPartialRegion`, no axis contact): wires of `ns` segments (outer first), `N = ns.sum`, the
segments `(g, next g)` of `Prism.allSegs`. Vertices `v_g = g`, `w_g = N + g`; edges arcs `(g, N + g)`, profile
`(g, next g)` at `N + g`, turned `(N + g, N + next g)` at `2N + g`; faces start cap 0 (wires forwards), end cap 1
(wires backwards), sides `2 + g` with `[a_g fwd, q_g fwd, a_next rev, p_g rev]`.
* `partial_counts` — `V = 2N`, `E = 3N`, `F = N + 2`, `L = N + 2 (H + 1)`.
* `partial_euler_poincare` — `V - E + F - (L - F) = 2 (1 - H)`, `H = ns.length - 1`; `partial_genus_simple` — a
  profile without holes revolves by a partial turn to genus 0; `partial_genus` — each hole is a tunnel.
* `partial_examples_close`, `partial_examples_paired`, `partial_examples_counts` — decided on `[1]`, `[4]`,
  `[3]`, `[4, 1]`, `[3, 1, 2]`.

## (d) Pappus — `revolveVolume` in `revolve.ts` (with `wireGreen` of `src/profile/area.ts`)
The TS volume is `Θ · Σ mx` over the meridian wires, `mx` the Green moment `½ ∮ ρ² dh = ∫∫ ρ dA`; for a line
`p → q` it is `momentX p q = (q.h - p.h)(p.ρ² + p.ρ q.ρ + q.ρ²) / 6` — exactly the signed frustum volume swept by the
segment divided by `2π`. `Θ` (`2π` for a full turn) is a symbolic rational: no real numbers are used.
* `momentX_fan` — per segment, `momentX = fanMoment + ψ q - ψ p` with `fanMoment` the area of the triangle
  (axis origin, `p`, `q`) times its centroid's `ρ`, `ψ p = p.h p.ρ² / 6`.
* `pappus_polygon` — over any closed polygon the `ψ` terms cancel: the frustum sum equals the sum over the fan
  triangles of area × centroid distance, i.e. `revolveVolume = Θ · A · ρ̄` (Pappus–Guldin).
* `pappus_triangle` — for a triangle, `Σ momentX = area · (ρa + ρb + ρc)/3`.
* `pappus_volume` — `revolveVolumeModel Θ ps = Θ · Σ fan areas × centroids`.
* `revolve_frustum` — the trapezoid `(0, h0), (r0, h0), (r1, h1), (0, h1)` gives `(h1 - h0)(r0² + r0 r1 + r1²)/6`, so
  a full turn is the frustum volume `π/3 (h1 - h0)(r0² + r0 r1 + r1²)` of `makeCone` (`Primitive.frustum_volume_*`).

Not covered: floating point; the stations, the path evaluation and the convergence of the double reflection method to
the exact rotation-minimizing frame (tested); the analytic recognition and all geometry of `revolve` (surfaces,
pcurves, `validateBrepGeometry`); revolve layouts with poles (profiles touching the axis: their counts are checked
by `eulerPoincare` in the tests); the Green moments of arcs and NURBS segments; the skinned sweep's interpolation and
its measured deviation. The skinned and translational sweeps use the ids of `extrude`, whose counts are
`Prism.prism_counts` / `Prism.prism_euler_poincare`.
-/
namespace CadloomFormal
namespace Sweep

open V3
open TopologyGeometry (Use loopCloses Paired)

/-! ## (a) Reflections -/

/-- TS `reflect(v, n)`. -/
def reflect (v n : V3) : V3 := if dot n n = 0 then v else sub v (smul (2 * dot v n / dot n n) n)

theorem v3_eq {a b : V3} (hx : a.x = b.x) (hy : a.y = b.y) (hz : a.z = b.z) : a = b := by
  cases a; cases b; simp_all

theorem reflect_dot (a b n : V3) : dot (reflect a n) (reflect b n) = dot a b := by
  unfold reflect
  split
  · rfl
  · simp only [dot, sub, smul] at *
    grind

theorem reflect_involutive (v n : V3) : reflect (reflect v n) n = v := by
  by_cases h : dot n n = 0
  · simp [reflect, h]
  · simp only [reflect, h, if_false]
    simp only [dot, sub, smul] at *
    apply v3_eq <;> simp only <;> grind

theorem sq_nonneg' (x : Rat) : 0 ≤ x * x := by
  rcases (Rat.le_total : (0 : Rat) ≤ x ∨ x ≤ 0) with h | h
  · exact Rat.mul_nonneg h h
  · exact Lean.Grind.OrderedRing.mul_nonneg_of_nonpos_of_nonpos h h

/-- A sum of three rational squares vanishes only at zero. -/
theorem sq3_zero (x y z : Rat) (h : x * x + y * y + z * z = 0) : x = 0 ∧ y = 0 ∧ z = 0 := by
  have hx := sq_nonneg' x
  have hy := sq_nonneg' y
  have hz := sq_nonneg' z
  have ex : x * x = 0 := by grind
  have ey : y * y = 0 := by grind
  have ez : z * z = 0 := by grind
  refine ⟨?_, ?_, ?_⟩
  · rcases Rat.mul_eq_zero.mp ex with h | h <;> exact h
  · rcases Rat.mul_eq_zero.mp ey with h | h <;> exact h
  · rcases Rat.mul_eq_zero.mp ez with h | h <;> exact h

theorem reflect_swap (a b : V3) (h : dot a a = dot b b) : reflect a (sub b a) = b := by
  unfold reflect
  split
  · rename_i h0
    simp only [dot, sub] at h0
    have := sq3_zero _ _ _ h0
    apply v3_eq <;> grind
  · simp only [dot, sub, smul] at *
    apply v3_eq <;> simp only <;> grind

/-! ## (b) The double reflection step -/

/-- TS `doubleReflectionStep(x0, x1, t0, t1, r0)`. -/
def drStep (x0 x1 t0 t1 r0 : V3) : V3 :=
  reflect (reflect r0 (sub x1 x0)) (sub t1 (reflect t0 (sub x1 x0)))

/-- The tangent under the same two reflections reaches `t1` when `|t1| = |t0|`. -/
theorem dr_tangent (x0 x1 t0 t1 : V3) (h : dot t1 t1 = dot t0 t0) :
    reflect (reflect t0 (sub x1 x0)) (sub t1 (reflect t0 (sub x1 x0))) = t1 := by
  apply reflect_swap
  rw [reflect_dot]; exact h.symm

theorem dr_orthonormal (x0 x1 t0 t1 r0 : V3) (hr : dot r0 r0 = 1) (hrt : dot r0 t0 = 0)
    (ht : dot t0 t0 = 1) (ht1 : dot t1 t1 = 1) :
    dot (drStep x0 x1 t0 t1 r0) (drStep x0 x1 t0 t1 r0) = 1 ∧ dot (drStep x0 x1 t0 t1 r0) t1 = 0 := by
  have htan := dr_tangent x0 x1 t0 t1 (by rw [ht1, ht])
  constructor
  · unfold drStep; rw [reflect_dot, reflect_dot]; exact hr
  · unfold drStep
    conv => lhs; arg 2; rw [← htan]
    rw [reflect_dot, reflect_dot]; exact hrt

/-- Lagrange: `|t × r|² = |t|²|r|² - (t·r)²`. -/
theorem cross_dot_self (t r : V3) : dot (cross t r) (cross t r) = dot t t * dot r r - dot t r * dot t r := by
  simp only [dot, cross]; grind

theorem dr_frame_orthonormal (x0 x1 t0 t1 r0 : V3) (hr : dot r0 r0 = 1) (hrt : dot r0 t0 = 0)
    (ht : dot t0 t0 = 1) (ht1 : dot t1 t1 = 1) :
    let r1 := drStep x0 x1 t0 t1 r0
    let s1 := cross t1 r1
    dot r1 r1 = 1 ∧ dot r1 t1 = 0 ∧ dot s1 s1 = 1 ∧ dot s1 t1 = 0 ∧ dot s1 r1 = 0 := by
  intro r1 s1
  obtain ⟨h1, h2⟩ := dr_orthonormal x0 x1 t0 t1 r0 hr hrt ht ht1
  have hs : dot s1 s1 = 1 := by
    simp only [s1]; rw [cross_dot_self, ht1, h1]
    have : dot t1 r1 = 0 := by simp only [dot] at h2 ⊢; grind
    rw [this]; grind
  refine ⟨h1, h2, hs, ?_, ?_⟩
  · simp only [s1, dot, cross]; grind
  · simp only [s1, dot, cross]; grind

/-! ## (c) Revolve topology -/

open Primitive (Model)

/-- The kind of a side face, as far as the topology sees it. -/
inductive Kind where
  | curved
  | planarUp
  | planarDown
deriving DecidableEq, Repr

def Kind.curvedNat : Kind → Nat
  | .curved => 1
  | _ => 0

def numCurved (ks : List Kind) : Nat := (ks.map Kind.curvedNat).sum

/-- Loops of face `g` of a cyclic run of `N` segments; `me` the id of its meridian edge. -/
def faceLoops (N g me : Nat) : Kind → List (List Use)
  | .curved => [[⟨g, g, false⟩, ⟨g, me, false⟩, ⟨g, (g + 1) % N, true⟩, ⟨g, me, true⟩]]
  | .planarUp => [[⟨g, (g + 1) % N, true⟩], [⟨g, g, false⟩]]
  | .planarDown => [[⟨g, g, false⟩], [⟨g, (g + 1) % N, true⟩]]

def fullLoopsFrom (N : Nat) : Nat → Nat → List Kind → List (List Use)
  | _, _, [] => []
  | g, me, k :: ks => faceLoops N g me k ++ fullLoopsFrom N (g + 1) (me + k.curvedNat) ks

def meridiansFrom (N : Nat) : Nat → List Kind → List (Nat × Nat)
  | _, [] => []
  | g, k :: ks => (if k = .curved then [(g, (g + 1) % N)] else []) ++ meridiansFrom N (g + 1) ks

/-- Edges in arena order: circles, then meridians. -/
def fullEdges (ks : List Kind) : List (Nat × Nat) :=
  (List.range ks.length).map (fun g => (g, g)) ++ meridiansFrom ks.length 0 ks

def fullLoops (ks : List Kind) : List (List Use) := fullLoopsFrom ks.length 0 ks.length ks

def fullModel (ks : List Kind) : Model := { nv := ks.length, edges := fullEdges ks, nf := ks.length, loops := fullLoops ks }

theorem faceLoops_length (N g me : Nat) (k : Kind) : (faceLoops N g me k).length + k.curvedNat = 2 := by
  cases k <;> rfl

theorem fullLoopsFrom_length (N : Nat) (ks : List Kind) :
    ∀ g me, (fullLoopsFrom N g me ks).length + numCurved ks = 2 * ks.length := by
  induction ks with
  | nil => intro g me; rfl
  | cons k ks ih =>
    intro g me
    have h1 := faceLoops_length N g me k
    have h2 := ih (g + 1) (me + k.curvedNat)
    simp only [fullLoopsFrom, numCurved, List.length_append, List.map_cons, List.sum_cons, List.length_cons] at *
    omega

theorem meridiansFrom_length (N : Nat) (ks : List Kind) : ∀ g, (meridiansFrom N g ks).length = numCurved ks := by
  induction ks with
  | nil => intro g; rfl
  | cons k ks ih =>
    intro g
    have h2 := ih (g + 1)
    cases k <;> simp_all [meridiansFrom, numCurved, Kind.curvedNat] <;> omega

theorem full_counts (ks : List Kind) :
    (fullEdges ks).length = ks.length + numCurved ks ∧ (fullLoops ks).length + numCurved ks = 2 * ks.length := by
  refine ⟨?_, fullLoopsFrom_length _ _ _ _⟩
  simp [fullEdges, meridiansFrom_length]

/-- A full turn of a run not touching the axis: one shell (`S = 1`) of genus `G = 1`. -/
theorem full_euler_poincare (ks : List Kind) :
    (ks.length : Int) - (fullEdges ks).length + ks.length - ((fullLoops ks).length - ks.length) = 2 * (1 - 1) := by
  obtain ⟨he, hl⟩ := full_counts ks
  omega

theorem full_genus (ks : List Kind) :
    Topology.genus ks.length (fullEdges ks).length ks.length (fullLoops ks).length 1 = 1 :=
  Topology.genus_of_euler_poincare _ _ _ _ _ _ (full_euler_poincare ks)

/-- Runs decided below: a rectangle tube, cones, a triangle, a circle (the torus). -/
def fullExamples : List (List Kind) :=
  [[.planarUp, .curved, .planarDown, .curved], [.curved, .curved, .curved, .curved], [.curved, .curved, .curved],
   [.curved], [.planarDown, .curved, .planarUp, .curved]]

theorem full_examples_close : ∀ ks ∈ fullExamples, (fullModel ks).closes = true := by decide

theorem full_examples_paired : ∀ ks ∈ fullExamples, Paired (fullModel ks).uses := by decide

theorem full_examples_counts : ∀ ks ∈ fullExamples,
    (fullModel ks).V = ks.length ∧ (fullModel ks).E = ks.length + numCurved ks ∧ (fullModel ks).F = ks.length ∧
      (fullModel ks).chi = 0 := by decide

/-- The torus `revolve` makes from one circle is exactly `makeTorus`'s arena (`Primitive.torusModel`). -/
theorem full_circle_is_torus : fullModel [.curved] = Primitive.torusModel := rfl

/-! ### Partial turn -/

open Prism (allSegs wireSegs allSegs_length wireSegs_length)

def partialEdges (ns : List Nat) : List (Nat × Nat) :=
  let N := ns.sum
  let S := allSegs 0 ns
  (List.range N).map (fun g => (g, N + g)) ++ S.map (fun s => (s.1, s.2)) ++ S.map (fun s => (N + s.1, N + s.2))

/-- The start cap (face 0): one loop per wire, its profile edges `p_g = N + g` forwards. -/
def startLoops (N : Nat) : Nat → List Nat → List (List Use)
  | _, [] => []
  | o, n :: ns => ((wireSegs o n).map (fun s => (⟨0, N + s.1, false⟩ : Use))) :: startLoops N (o + n) ns

/-- The end cap (face 1): one loop per wire, its turned edges `q_g = 2N + g` backwards. -/
def endLoops (N : Nat) : Nat → List Nat → List (List Use)
  | _, [] => []
  | o, n :: ns => ((wireSegs o n).reverse.map (fun s => (⟨1, 2 * N + s.1, true⟩ : Use))) :: endLoops N (o + n) ns

/-- Side face `2 + g`: `[a_g fwd, q_g fwd, a_next rev, p_g rev]`. -/
def partialSide (N : Nat) (s : Nat × Nat) : List Use :=
  [⟨2 + s.1, s.1, false⟩, ⟨2 + s.1, 2 * N + s.1, false⟩, ⟨2 + s.1, s.2, true⟩, ⟨2 + s.1, N + s.1, true⟩]

def partialLoops (ns : List Nat) : List (List Use) :=
  startLoops ns.sum 0 ns ++ endLoops ns.sum 0 ns ++ (allSegs 0 ns).map (partialSide ns.sum)

def partialModel (ns : List Nat) : Model :=
  { nv := 2 * ns.sum, edges := partialEdges ns, nf := ns.sum + 2, loops := partialLoops ns }

theorem startLoops_length (N : Nat) (ns : List Nat) : ∀ o, (startLoops N o ns).length = ns.length := by
  induction ns with
  | nil => intro o; rfl
  | cons n ns ih => intro o; simp [startLoops, ih]

theorem endLoops_length (N : Nat) (ns : List Nat) : ∀ o, (endLoops N o ns).length = ns.length := by
  induction ns with
  | nil => intro o; rfl
  | cons n ns ih => intro o; simp [endLoops, ih]

theorem partial_counts (ns : List Nat) :
    (partialModel ns).nv = 2 * ns.sum ∧ (partialEdges ns).length = 3 * ns.sum ∧ (partialModel ns).nf = ns.sum + 2 ∧
      (partialLoops ns).length = ns.sum + 2 * ns.length := by
  refine ⟨rfl, ?_, rfl, ?_⟩
  · simp only [partialEdges, List.length_append, List.length_map, List.length_range, allSegs_length]; omega
  · simp only [partialLoops, List.length_append, List.length_map, startLoops_length, endLoops_length, allSegs_length]
    omega

/-- A partial turn: one shell of genus `H = ns.length - 1` (each hole a tunnel through the caps). -/
theorem partial_euler_poincare (ns : List Nat) (h : ns ≠ []) :
    ((2 * ns.sum : Nat) : Int) - (partialEdges ns).length + (ns.sum + 2 : Nat) - ((partialLoops ns).length - (ns.sum + 2 : Nat)) =
      2 * (1 - ((ns.length : Int) - 1)) := by
  obtain ⟨_, he, _, hl⟩ := partial_counts ns
  rw [he, hl]
  have : ns.length ≥ 1 := by cases ns with | nil => exact absurd rfl h | cons _ _ => simp
  push_cast; omega

theorem partial_genus (ns : List Nat) (h : ns ≠ []) :
    Topology.genus (2 * ns.sum : Nat) (partialEdges ns).length (ns.sum + 2 : Nat) (partialLoops ns).length 1 = (ns.length : Int) - 1 :=
  Topology.genus_of_euler_poincare _ _ _ _ _ _ (partial_euler_poincare ns h)

/-- A profile without holes revolved by a partial turn has genus 0 (the end caps close the solid). -/
theorem partial_genus_simple (n : Nat) :
    Topology.genus (2 * [n].sum : Nat) (partialEdges [n]).length ([n].sum + 2 : Nat) (partialLoops [n]).length 1 = 0 := by
  have := partial_genus [n] (by simp); simpa using this

def partialExamples : List (List Nat) := [[1], [3], [4], [4, 1], [3, 1, 2]]

theorem partial_examples_close : ∀ ns ∈ partialExamples, (partialModel ns).closes = true := by decide

theorem partial_examples_paired : ∀ ns ∈ partialExamples, Paired (partialModel ns).uses := by decide

theorem partial_examples_counts : ∀ ns ∈ partialExamples,
    (partialModel ns).V = 2 * ns.sum ∧ (partialModel ns).E = 3 * ns.sum ∧ (partialModel ns).F = ns.sum + 2 := by
  decide

/-! ## (d) Pappus -/

open Tess (P cr triArea2)
open Profile (polySegs)

/-- TS `lineGreen(p, q).mx` in meridian coordinates: `(q.h - p.h)(p.ρ² + p.ρ q.ρ + q.ρ²) / 6`. -/
def momentX (p q : P) : Rat := (q.2 - p.2) * (p.1 * p.1 + p.1 * q.1 + q.1 * q.1) / 6

/-- The triangle (axis origin, `p`, `q`): its signed area `cr p q / 2` times its centroid's `ρ`, `(0 + p.ρ + q.ρ) / 3`. -/
def fanMoment (p q : P) : Rat := cr p q / 2 * ((0 + p.1 + q.1) / 3)

def psi (p : P) : Rat := p.2 * p.1 * p.1 / 6

theorem momentX_fan (p q : P) : momentX p q = fanMoment p q + psi q - psi p := by
  simp only [momentX, fanMoment, psi, cr]; grind

/-- Summing `f = g + φ b - φ a` over the consecutive pairs of `x :: xs ++ [y]`. -/
theorem zip_shift (f g : P → P → Rat) (φ : P → Rat) (hf : ∀ a b, f a b = g a b + φ b - φ a) :
    ∀ (xs : List P) (x y : P),
      (((x :: xs).zip (xs ++ [y])).map (fun s => f s.1 s.2)).sum =
        (((x :: xs).zip (xs ++ [y])).map (fun s => g s.1 s.2)).sum + φ y - φ x := by
  intro xs
  induction xs with
  | nil => intro x y; simp [hf]; grind
  | cons a t ih =>
    intro x y
    have hz : (x :: a :: t).zip (a :: t ++ [y]) = (x, a) :: (a :: t).zip (t ++ [y]) := by simp
    rw [hz, List.map_cons, List.map_cons, List.sum_cons, List.sum_cons, ih a y, hf]
    grind

/-- Pappus for a polygon: the frustum (Green) moment sum equals the fan triangles' area × centroid sum. -/
theorem pappus_polygon (ps : List P) :
    ((polySegs ps).map (fun s => momentX s.1 s.2)).sum = ((polySegs ps).map (fun s => fanMoment s.1 s.2)).sum := by
  cases ps with
  | nil => rfl
  | cons x xs =>
    simp only [polySegs, Tess.rot1]
    rw [zip_shift momentX fanMoment psi momentX_fan xs x x]
    grind

/-- Pappus for a triangle: `Σ momentX = area · (ρa + ρb + ρc) / 3`. -/
theorem pappus_triangle (a b c : P) :
    momentX a b + momentX b c + momentX c a = triArea2 (a, b, c) / 2 * ((a.1 + b.1 + c.1) / 3) := by
  simp only [momentX, triArea2, cr]; grind

/-- The TS reference volume of a polygonal meridian wire, `Θ · Σ mx` (`Θ` symbolic: `2π` for a full turn). -/
def revolveVolumeModel (θ : Rat) (ps : List P) : Rat := θ * ((polySegs ps).map (fun s => momentX s.1 s.2)).sum

theorem pappus_volume (θ : Rat) (ps : List P) :
    revolveVolumeModel θ ps = θ * ((polySegs ps).map (fun s => fanMoment s.1 s.2)).sum := by
  unfold revolveVolumeModel; rw [pappus_polygon]

/-- The trapezoid on the axis revolves to the frustum: `Σ momentX = (h1 - h0)(r0² + r0 r1 + r1²)/6`. -/
theorem revolve_frustum (r0 r1 h0 h1 : Rat) :
    ((polySegs [((0 : Rat), h0), (r0, h0), (r1, h1), (0, h1)]).map (fun s => momentX s.1 s.2)).sum =
      (h1 - h0) * (r0 * r0 + r0 * r1 + r1 * r1) / 6 := by
  simp [polySegs, Tess.rot1, momentX]; grind

end Sweep
end CadloomFormal
