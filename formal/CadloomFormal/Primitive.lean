import CadloomFormal.TopologyGeometry

/-!
# Primitive: the combinatorics of the curved primitives, pole contraction, and the frustum volume

Models (exactly, over `Nat`/`Bool`/`Int`/`Rat`) the B-reps that the M3 primitives (`src/primitive/`) build and
how `eulerPoincare` / `validateBrep` (`src/topology/validate.ts`) count and pair them.

* A `Model` is an arena: `nv` vertex ids, the edge end pairs `edges` (`Edge.start`, `Edge.end`, by edge id), `nf`
  face ids, and the loops in arena order, each the `TopologyGeometry.Use` list of its coedges in `next` order
  (`Use` = face, edge, `Coedge.reversed`). `V`, `E`, `F` count the ids that occur (distinct coedge start vertices,
  distinct edges, distinct faces, as `eulerPoincare` collects them per shell; `countUsed` counts ids `< n`, which
  for these models is the `Topology.nub` count of `TopologyGeometry`: `cylinder_counts_agree`). `L` is the
  number of loops and `chi = V - E + F - (L - F)`. All models are one shell (`S = 1`).
* `cylinderModel` is `makeCylinder` (and `makeCone` with `r1 = r2` or two non-zero radii, `buildRuledSolid` in
  `src/primitive/ruled.ts`): the M2 fixture `TopologyGeometry.cylinderLoops` (`cylinder_model_eq`).
  `coneApexTopModel` is `makeCone(r1 > 0, r2 = 0)`, `coneApexBottomModel` is `makeCone(r1 = 0, r2 > 0)`,
  `sphereModel` is `makeSphere`, `torusModel` is `makeTorus` — same ids, same coedge order as the TS builders.
  The pole / apex is a vertex where the seam ends; it has no edge (the TS decision, `uvGapCollapses`).

Theorems (each mapped to the TS test whose name contains it in `tests/primitive.test.ts`; the counting and
list lemmas `countUsed_*`, `mem_contract_uses`, `contract_V/E/F/L`, `contract_filter`, `edgeEnds_append`,
`useStart_append`, `genus_of_chi`, `cylinder_top_cap` serve the proofs and have no test of their own):
* `cylinder_model_eq`, `cylinder_counts_agree` — the cylinder model is the M2 fixture, and `countUsed` agrees with
  the `nub` counts of `TopologyGeometry`.
* `cylinder_prim_counts` / `coneApexTop_counts` / `coneApexBottom_counts` / `sphere_counts` / `torus_counts` —
  `(V, E, F, L)` = `(2, 3, 3, 3)`, `(2, 2, 2, 2)`, `(2, 2, 2, 2)`, `(2, 1, 1, 1)`, `(1, 2, 1, 1)`.
* `*_euler_poincare` — `V - E + F - (L - F) = 2 (S - G)` with `G = 0` (cylinder, cones, sphere) and `G = 1`
  (torus: `chi = 0`); `*_genus` — the genus formula `Topology.genus` of `eulerPoincare` returns that `G`.
* `*_loops_close` — in every loop each coedge ends where the next starts (`validateBrep`, `vertex-mismatch`).
* `*_paired` — every edge has exactly two uses in opposite directions (`edge-use-count`, `edge-orientation`);
  `sphere_seam_one_face` / `torus_seams_one_face` — every edge of the sphere and torus is a seam of face 0 (the
  sphere's poles are upstream's `inside_face` vertices).
* `countUsed_congr`, `countUsed_drop`, `countUsed_succ` — counting lemmas.
* `mem_contract_uses`, `contract_V`, `contract_E`, `contract_F`, `contract_L` and **`pole_contraction_euler`**:
  contracting a cap to a pole — removing the cap loop (all of whose coedges use the closed edge `e` at vertex `w`)
  and the other uses of `e` — keeps `V`, lowers `E`, `F`, `L` by one each, so it keeps `chi` and hence the
  Euler–Poincaré balance, under `PoleCap` (the cap is the only all-`e` loop, its face has no other edge, every
  other face keeps an edge, and `w` stays the start of a kept coedge). `contract_revsOf` /
  **`pole_contraction_paired`**: every remaining edge stays paired. `cylinder_contract_top` /
  `cylinder_contract_both`: contracting the cylinder's top cap gives the counts of the apex cone; contracting both
  gives the sphere's counts.
* **`degenerate_pole_edge_shift`**: adding instead a *degenerate pole edge* — a fresh closed edge `(w, w)` at a
  used vertex `w`, used `k ≥ 1` times inside an existing loop of an existing face — lowers `chi` by exactly 1. So
  a body with `D` such edges satisfies `V - (E - D) + F - (L - F) = 2 (S - G)`, not the relation `eulerPoincare`
  checks. `degenerate_pole_edge_unpaired`: with one coedge (the upstream / SMLib pole edge use) the edge is not
  paired (`edge-use-count`); with two coedges (`degenerate_pole_edge_two_uses`) it is paired but `chi` still drops
  (and `validateBrep` rejects it as `non-manifold-vertex`, a check not modelled here). This is why cadloom's pole
  is vertex-only.
* `frustum_volume_difference` — over `Rat`: if `h1 r2 = h2 r1` (similar cones of heights `h1`, `h2` over radii `r1`,
  `r2`), `h1 r1² - h2 r2² = (h1 - h2)(r1² + r1 r2 + r2²)`: the frustum volume `π/3 h (r1² + r1 r2 + r2²)` is the
  difference of the two cone volumes (π a common factor). `frustum_volume_apex` (`r2 = 0`: then `h2 = 0`) and
  `frustum_volume_cylinder` (`r1 = r2`, `h (3 r²) / 3 = h r²`) are the limits the tests use.

Not covered: geometry (circles, surfaces, pcurves, `uvGapCollapses`, tolerances), the `next`/`prev`/partner
arrays, the manifold-vertex and connectivity checks, the display mesh (pole fans are tested only), floating
point, and π (the volume tests compare floating-point meshes with `πr²h`, `π/3 h(r1² + r1r2 + r2²)`, `4/3 πr³`,
`2π²Rr²`).
-/
namespace CadloomFormal
namespace Primitive

open TopologyGeometry

/-- An arena B-rep reduced to what counting and pairing see. -/
structure Model where
  nv : Nat
  edges : List (Nat × Nat)
  nf : Nat
  loops : List (List Use)

/-- All coedges in arena order. -/
def Model.uses (m : Model) : List Use := m.loops.flatten

/-- The number of ids `i < n` with `p i`. -/
def countUsed (n : Nat) (p : Nat → Bool) : Nat := ((List.range n).filter p).length

def Model.V (m : Model) : Nat := countUsed m.nv (fun v => m.uses.any (fun c => useStart m.edges c == v))
def Model.E (m : Model) : Nat := countUsed m.edges.length (fun e => m.uses.any (fun c => c.edge == e))
def Model.F (m : Model) : Nat := countUsed m.nf (fun f => m.uses.any (fun c => c.face == f))
def Model.L (m : Model) : Nat := m.loops.length

/-- `V - E + F - (L - F)`. -/
def Model.chi (m : Model) : Int := (m.V : Int) - m.E + m.F - ((m.L : Int) - m.F)

/-- Every loop closes (`validateBrep` step 4). -/
def Model.closes (m : Model) : Bool := m.loops.all (loopCloses m.edges)

/-! ## The primitives -/

/-- `makeCylinder` (and a frustum): `v0` bottom, `v1` top; `e0` bottom circle, `e1` top circle, `e2` seam;
faces bottom disc, top disc, side. -/
def cylinderModel : Model :=
  { nv := 2, edges := [(0, 0), (1, 1), (0, 1)], nf := 3,
    loops := [[⟨0, 0, true⟩], [⟨1, 1, false⟩], [⟨2, 0, false⟩, ⟨2, 2, false⟩, ⟨2, 1, true⟩, ⟨2, 2, true⟩]] }

/-- `makeCone(r1 > 0, r2 = 0)`: `v1` the apex; `e0` bottom circle, `e1` seam; faces bottom disc, side. -/
def coneApexTopModel : Model :=
  { nv := 2, edges := [(0, 0), (0, 1)], nf := 2,
    loops := [[⟨0, 0, true⟩], [⟨1, 0, false⟩, ⟨1, 1, false⟩, ⟨1, 1, true⟩]] }

/-- `makeCone(r1 = 0, r2 > 0)`: `v0` the apex; `e0` top circle, `e1` seam; faces top disc, side. -/
def coneApexBottomModel : Model :=
  { nv := 2, edges := [(1, 1), (0, 1)], nf := 2,
    loops := [[⟨0, 0, false⟩], [⟨1, 1, false⟩, ⟨1, 0, true⟩, ⟨1, 1, true⟩]] }

/-- `makeSphere`: `v0` south pole, `v1` north pole; `e0` the seam meridian; one face. -/
def sphereModel : Model :=
  { nv := 2, edges := [(0, 1)], nf := 1, loops := [[⟨0, 0, false⟩, ⟨0, 0, true⟩]] }

/-- `makeTorus`: one vertex; `e0` the outer equator, `e1` the tube circle; one face. -/
def torusModel : Model :=
  { nv := 1, edges := [(0, 0), (0, 0)], nf := 1,
    loops := [[⟨0, 0, false⟩, ⟨0, 1, false⟩, ⟨0, 0, true⟩, ⟨0, 1, true⟩]] }

theorem cylinder_model_eq : cylinderModel.edges = cylinderEdges ∧ cylinderModel.loops = cylinderLoops :=
  ⟨rfl, rfl⟩

theorem cylinder_counts_agree :
    cylinderModel.V = numVertices ∧ cylinderModel.E = numEdges ∧ cylinderModel.F = numFaces ∧
      cylinderModel.L = numLoops := by decide

theorem cylinder_prim_counts :
    cylinderModel.V = 2 ∧ cylinderModel.E = 3 ∧ cylinderModel.F = 3 ∧ cylinderModel.L = 3 := by decide
theorem coneApexTop_counts :
    coneApexTopModel.V = 2 ∧ coneApexTopModel.E = 2 ∧ coneApexTopModel.F = 2 ∧ coneApexTopModel.L = 2 := by decide
theorem coneApexBottom_counts :
    coneApexBottomModel.V = 2 ∧ coneApexBottomModel.E = 2 ∧ coneApexBottomModel.F = 2 ∧
      coneApexBottomModel.L = 2 := by decide
theorem sphere_counts :
    sphereModel.V = 2 ∧ sphereModel.E = 1 ∧ sphereModel.F = 1 ∧ sphereModel.L = 1 := by decide
theorem torus_counts :
    torusModel.V = 1 ∧ torusModel.E = 2 ∧ torusModel.F = 1 ∧ torusModel.L = 1 := by decide

theorem cylinder_prim_euler_poincare : cylinderModel.chi = 2 * (1 - 0) := by decide
theorem coneApexTop_euler_poincare : coneApexTopModel.chi = 2 * (1 - 0) := by decide
theorem coneApexBottom_euler_poincare : coneApexBottomModel.chi = 2 * (1 - 0) := by decide
theorem sphere_euler_poincare : sphereModel.chi = 2 * (1 - 0) := by decide
theorem torus_euler_poincare : torusModel.chi = 2 * (1 - 1) := by decide

/-- The genus `eulerPoincare` reports for a one-shell model. -/
def Model.genus (m : Model) : Int := Topology.genus m.V m.E m.F m.L 1

theorem genus_of_chi (m : Model) (g : Int) (h : m.chi = 2 * (1 - g)) : m.genus = g :=
  Topology.genus_of_euler_poincare _ _ _ _ _ _ h

theorem cylinder_prim_genus : cylinderModel.genus = 0 := genus_of_chi _ _ cylinder_prim_euler_poincare
theorem coneApexTop_genus : coneApexTopModel.genus = 0 := genus_of_chi _ _ coneApexTop_euler_poincare
theorem coneApexBottom_genus : coneApexBottomModel.genus = 0 := genus_of_chi _ _ coneApexBottom_euler_poincare
theorem sphere_genus : sphereModel.genus = 0 := genus_of_chi _ _ sphere_euler_poincare
theorem torus_genus : torusModel.genus = 1 := genus_of_chi _ _ torus_euler_poincare

theorem cylinder_prim_loops_close : cylinderModel.closes = true := by decide
theorem coneApexTop_loops_close : coneApexTopModel.closes = true := by decide
theorem coneApexBottom_loops_close : coneApexBottomModel.closes = true := by decide
theorem sphere_loops_close : sphereModel.closes = true := by decide
theorem torus_loops_close : torusModel.closes = true := by decide

theorem cylinder_prim_paired : Paired cylinderModel.uses := by decide
theorem coneApexTop_paired : Paired coneApexTopModel.uses := by decide
theorem coneApexBottom_paired : Paired coneApexBottomModel.uses := by decide
theorem sphere_paired : Paired sphereModel.uses := by decide
theorem torus_paired : Paired torusModel.uses := by decide

theorem sphere_seam_one_face : ∀ c ∈ sphereModel.uses, c.face = 0 := by decide
theorem torus_seams_one_face : ∀ c ∈ torusModel.uses, c.face = 0 := by decide

/-! ## Counting lemmas -/

theorem countUsed_congr (n : Nat) (p q : Nat → Bool) (h : ∀ i, i < n → p i = q i) :
    countUsed n p = countUsed n q := by
  unfold countUsed
  rw [List.filter_congr (fun i hi => h i (List.mem_range.mp hi))]

/-- Turning one id `e < n` from used to unused lowers the count by one. -/
theorem countUsed_drop (n e : Nat) (p q : Nat → Bool) (he : e < n) (hp : p e = true) (hq : q e = false)
    (h : ∀ i, i < n → i ≠ e → p i = q i) : countUsed n q + 1 = countUsed n p := by
  induction n with
  | zero => omega
  | succ n ih =>
    unfold countUsed at *
    rw [List.range_succ, List.filter_append, List.filter_append, List.length_append, List.length_append]
    by_cases hn : n = e
    · subst hn
      have hc : countUsed n q = countUsed n p :=
        countUsed_congr n q p (fun i hi => (h i (by omega) (by omega)).symm)
      unfold countUsed at hc
      simp [hp, hq, hc]
    · have := ih (by omega) (fun i hi hie => h i (by omega) hie)
      have hpq := h n (by omega) hn
      cases hpn : p n <;> simp [hpn, ← hpq] <;> omega

/-- Adding a new id `n` that is used raises the count by one. -/
theorem countUsed_succ (n : Nat) (p q : Nat → Bool) (h : ∀ i, i < n → p i = q i) (hq : q n = true) :
    countUsed (n + 1) q = countUsed n p + 1 := by
  unfold countUsed
  rw [List.range_succ, List.filter_append, List.length_append]
  have := countUsed_congr n p q h
  unfold countUsed at this
  simp [hq, this]

/-! ## Contracting a cap to a pole -/

/-- Remove the loops all of whose coedges use `e` (the cap) and every other use of `e`. -/
def contract (m : Model) (e : Nat) : Model :=
  { nv := m.nv, edges := m.edges, nf := m.nf,
    loops := List.map (fun l => l.filter (fun c => c.edge != e))
      (m.loops.filter (fun l => !(l.all (fun c => c.edge == e)))) }

theorem mem_contract_uses (m : Model) (e : Nat) (c : Use) :
    c ∈ (contract m e).uses ↔ c ∈ m.uses ∧ c.edge ≠ e := by
  simp only [Model.uses, contract, List.mem_flatten, List.mem_map, List.mem_filter]
  constructor
  · rintro ⟨_, ⟨l, ⟨hl, _⟩, rfl⟩, hc⟩
    rw [List.mem_filter] at hc
    exact ⟨⟨l, hl, hc.1⟩, by simpa using hc.2⟩
  · rintro ⟨⟨l, hl, hc⟩, hce⟩
    refine ⟨_, ⟨l, ⟨hl, ?_⟩, rfl⟩, List.mem_filter.mpr ⟨hc, by simpa using hce⟩⟩
    simp only [Bool.not_eq_true', List.all_eq_false]
    exact ⟨c, hc, by simpa using hce⟩

/-- The hypotheses under which contracting edge `e` (a closed edge at vertex `w`, the boundary of the cap face
`fc`) turns the cap into a pole. -/
structure PoleCap (m : Model) (e fc w : Nat) : Prop where
  edge_lt : e < m.edges.length
  closed : edgeEnds m.edges e = (w, w)
  face_lt : fc < m.nf
  one_cap : m.loops.countP (fun l => l.all (fun c => c.edge == e)) = 1
  cap_used : ∃ c ∈ m.uses, c.face = fc
  cap_only_e : ∀ c ∈ m.uses, c.face = fc → c.edge = e
  others_keep : ∀ c ∈ m.uses, c.edge = e → c.face ≠ fc → ∃ d ∈ m.uses, d.face = c.face ∧ d.edge ≠ e
  pole_kept : ∃ c ∈ m.uses, c.edge ≠ e ∧ useStart m.edges c = w

theorem contract_V (m : Model) (e fc w : Nat) (h : PoleCap m e fc w) : (contract m e).V = m.V := by
  unfold Model.V
  apply countUsed_congr
  intro v _
  have hedges : (contract m e).edges = m.edges := rfl
  rw [hedges, Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
  constructor
  · rintro ⟨c, hc, hv⟩
    exact ⟨c, ((mem_contract_uses m e c).mp hc).1, hv⟩
  · rintro ⟨c, hc, hv⟩
    by_cases hce : c.edge = e
    · obtain ⟨d, hd, hde, hdw⟩ := h.pole_kept
      have hcw : useStart m.edges c = w := by
        unfold useStart; rw [hce, h.closed]; split <;> rfl
      refine ⟨d, (mem_contract_uses m e d).mpr ⟨hd, hde⟩, ?_⟩
      simp only [beq_iff_eq] at hv ⊢
      rw [hdw, ← hcw, hv]
    · exact ⟨c, (mem_contract_uses m e c).mpr ⟨hc, hce⟩, hv⟩

theorem contract_E (m : Model) (e fc w : Nat) (h : PoleCap m e fc w) : (contract m e).E + 1 = m.E := by
  unfold Model.E
  have hedges : (contract m e).edges = m.edges := rfl
  rw [hedges]
  apply countUsed_drop _ e _ _ h.edge_lt
  · obtain ⟨c, hc, hf⟩ := h.cap_used
    exact List.any_eq_true.mpr ⟨c, hc, by simp [h.cap_only_e c hc hf]⟩
  · rw [Bool.eq_false_iff]
    intro ha
    obtain ⟨c, hc, hce⟩ := List.any_eq_true.mp ha
    exact ((mem_contract_uses m e c).mp hc).2 (by simpa using hce)
  · intro i _ hie
    rw [Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
    constructor
    · rintro ⟨c, hc, hci⟩
      exact ⟨c, (mem_contract_uses m e c).mpr ⟨hc, by simp at hci; omega⟩, hci⟩
    · rintro ⟨c, hc, hci⟩
      exact ⟨c, ((mem_contract_uses m e c).mp hc).1, hci⟩

theorem contract_F (m : Model) (e fc w : Nat) (h : PoleCap m e fc w) : (contract m e).F + 1 = m.F := by
  unfold Model.F
  have hnf : (contract m e).nf = m.nf := rfl
  rw [hnf]
  apply countUsed_drop _ fc _ _ h.face_lt
  · obtain ⟨c, hc, hf⟩ := h.cap_used
    exact List.any_eq_true.mpr ⟨c, hc, by simp [hf]⟩
  · rw [Bool.eq_false_iff]
    intro ha
    obtain ⟨c, hc, hcf⟩ := List.any_eq_true.mp ha
    have ⟨hm, hne⟩ := (mem_contract_uses m e c).mp hc
    exact hne (h.cap_only_e c hm (by simpa using hcf))
  · intro g _ hg
    rw [Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
    constructor
    · rintro ⟨c, hc, hcg⟩
      have hcg' : c.face = g := by simpa using hcg
      by_cases hce : c.edge = e
      · obtain ⟨d, hd, hdf, hde⟩ := h.others_keep c hc hce (by omega)
        exact ⟨d, (mem_contract_uses m e d).mpr ⟨hd, hde⟩, by simp [hdf, hcg']⟩
      · exact ⟨c, (mem_contract_uses m e c).mpr ⟨hc, hce⟩, hcg⟩
    · rintro ⟨c, hc, hcg⟩
      exact ⟨c, ((mem_contract_uses m e c).mp hc).1, hcg⟩

theorem contract_L (m : Model) (e fc w : Nat) (h : PoleCap m e fc w) : (contract m e).L + 1 = m.L := by
  unfold Model.L contract
  simp only [List.length_map]
  have hsplit := List.length_eq_countP_add_countP (fun l => l.all (fun c => c.edge == e)) (l := m.loops)
  rw [h.one_cap, ← List.countP_eq_length_filter] at *
  have : (List.countP (fun l => !l.all fun c => c.edge == e) m.loops) =
      List.countP (fun a => decide ¬(a.all fun c => c.edge == e) = true) m.loops := by
    apply List.countP_congr; intro l _; simp
  omega

/-- Contracting a cap to a pole keeps `V - E + F - (L - F)`, hence the Euler–Poincaré balance. -/
theorem pole_contraction_euler (m : Model) (e fc w : Nat) (h : PoleCap m e fc w) :
    (contract m e).chi = m.chi := by
  have hV := contract_V m e fc w h
  have hE := contract_E m e fc w h
  have hF := contract_F m e fc w h
  have hL := contract_L m e fc w h
  unfold Model.chi
  omega

theorem contract_filter (ls : List (List Use)) (e e' : Nat) (hne : e' ≠ e) :
    (((ls.filter (fun l => !(l.all (fun c => c.edge == e)))).map
      (fun l => l.filter (fun c => c.edge != e))).flatten).filter (fun c => c.edge == e') =
      ls.flatten.filter (fun c => c.edge == e') := by
  induction ls with
  | nil => rfl
  | cons l ls ih =>
    by_cases hl : l.all (fun c => c.edge == e) = true
    · have hz : l.filter (fun c => c.edge == e') = [] := by
        rw [List.filter_eq_nil_iff]
        intro c hc
        have := List.all_eq_true.mp hl c hc
        simp at this ⊢; omega
      simp [hl, List.filter_append, hz, ih]
    · have hff : (l.filter (fun c => c.edge != e)).filter (fun c => c.edge == e') =
          l.filter (fun c => c.edge == e') := by
        rw [List.filter_filter]
        apply List.filter_congr
        intro c _
        by_cases h1 : c.edge = e' <;> simp [h1, hne]
      simp only [Bool.not_eq_true] at hl
      simp [hl, List.filter_append, ih, hff]

/-- Every edge other than `e` keeps its uses (with their directions) under contraction. -/
theorem contract_revsOf (m : Model) (e e' : Nat) (hne : e' ≠ e) :
    revsOf (contract m e).uses e' = revsOf m.uses e' := by
  unfold revsOf Model.uses contract
  simp only
  rw [contract_filter m.loops e e' hne]

/-- Contraction keeps every remaining edge paired. -/
theorem pole_contraction_paired (m : Model) (e : Nat) (hp : Paired m.uses) : Paired (contract m e).uses := by
  intro c hc
  have ⟨hm, hne⟩ := (mem_contract_uses m e c).mp hc
  unfold PairedAt
  rw [contract_revsOf m e c.edge hne]
  exact hp c hm

theorem cylinder_top_cap : PoleCap cylinderModel 1 1 1 :=
  { edge_lt := by decide, closed := rfl, face_lt := by decide, one_cap := by decide,
    cap_used := ⟨⟨1, 1, false⟩, by decide, rfl⟩, cap_only_e := by decide, others_keep := by decide,
    pole_kept := ⟨⟨2, 2, true⟩, by decide, by decide, rfl⟩ }

/-- Contracting the cylinder's top circle gives the counts of the apex cone. -/
theorem cylinder_contract_top :
    (contract cylinderModel 1).V = coneApexTopModel.V ∧ (contract cylinderModel 1).E = coneApexTopModel.E ∧
      (contract cylinderModel 1).F = coneApexTopModel.F ∧ (contract cylinderModel 1).L = coneApexTopModel.L ∧
      (contract cylinderModel 1).chi = cylinderModel.chi :=
  ⟨by decide, by decide, by decide, by decide, pole_contraction_euler _ _ _ _ cylinder_top_cap⟩

/-- Contracting both circles gives the sphere's counts (and keeps `chi = 2`). -/
theorem cylinder_contract_both :
    (contract (contract cylinderModel 1) 0).V = sphereModel.V ∧
      (contract (contract cylinderModel 1) 0).E = sphereModel.E ∧
      (contract (contract cylinderModel 1) 0).F = sphereModel.F ∧
      (contract (contract cylinderModel 1) 0).L = sphereModel.L ∧
      (contract (contract cylinderModel 1) 0).chi = 2 := by decide

/-! ## A degenerate pole edge instead -/

/-- Add a fresh closed edge `(w, w)` (id `m.edges.length`) and the uses `ds` of it at the end of loop `l`, where the
loops are `pre ++ l :: post`. -/
def addDegenerate (m : Model) (w : Nat) (pre : List (List Use)) (l : List Use) (post : List (List Use))
    (ds : List Use) : Model :=
  { m with edges := m.edges ++ [(w, w)], loops := pre ++ (l ++ ds) :: post }

theorem edgeEnds_append (E : List (Nat × Nat)) (x : Nat × Nat) (i : Nat) (hi : i < E.length) :
    edgeEnds (E ++ [x]) i = edgeEnds E i := by
  unfold edgeEnds
  simp [List.getD_eq_getElem?_getD, List.getElem?_append_left hi]

theorem useStart_append (E : List (Nat × Nat)) (x : Nat × Nat) (c : Use) (hi : c.edge < E.length) :
    useStart (E ++ [x]) c = useStart E c := by
  unfold useStart; rw [edgeEnds_append E x c.edge hi]

/-- Adding a degenerate pole edge with `k ≥ 1` uses lowers `V - E + F - (L - F)` by exactly one. -/
theorem degenerate_pole_edge_shift (m : Model) (w f : Nat) (pre : List (List Use)) (l : List Use)
    (post : List (List Use)) (ds : List Use) (hloops : m.loops = pre ++ l :: post)
    (hwf : ∀ c ∈ m.uses, c.edge < m.edges.length)
    (hds : ds ≠ []) (hdse : ∀ d ∈ ds, d.edge = m.edges.length ∧ d.face = f)
    (hf : ∃ c ∈ l, c.face = f) (hw : ∃ c ∈ m.uses, useStart m.edges c = w) :
    (addDegenerate m w pre l post ds).chi = m.chi - 1 := by
  let m' := addDegenerate m w pre l post ds
  have hmem : ∀ c, c ∈ m'.uses ↔ c ∈ m.uses ∨ c ∈ ds := by
    intro c
    simp only [m', addDegenerate, Model.uses, hloops, List.flatten_append, List.flatten_cons, List.mem_append]
    grind
  have hdstart : ∀ d ∈ ds, useStart m'.edges d = w := by
    intro d hd
    simp only [m', addDegenerate, useStart, edgeEnds, (hdse d hd).1]
    simp [List.getD_eq_getElem?_getD]
  have hold : ∀ c ∈ m.uses, useStart m'.edges c = useStart m.edges c :=
    fun c hc => useStart_append m.edges (w, w) c (hwf c hc)
  obtain ⟨d0, hd0⟩ := List.exists_mem_of_ne_nil ds hds
  have hV : m'.V = m.V := by
    unfold Model.V
    apply countUsed_congr
    intro v _
    rw [Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
    constructor
    · rintro ⟨c, hc, hv⟩
      rcases (hmem c).mp hc with hc | hc
      · exact ⟨c, hc, by rw [← hold c hc]; exact hv⟩
      · obtain ⟨c', hc', hc'w⟩ := hw
        refine ⟨c', hc', ?_⟩
        simp only [beq_iff_eq] at hv ⊢
        rw [hc'w, ← hv, hdstart c hc]
    · rintro ⟨c, hc, hv⟩
      exact ⟨c, (hmem c).mpr (Or.inl hc), by rw [hold c hc]; exact hv⟩
  have hE : m'.E = m.E + 1 := by
    unfold Model.E
    have hlen : m'.edges.length = m.edges.length + 1 := by simp [m', addDegenerate]
    rw [hlen]
    apply countUsed_succ
    · intro i hi
      rw [Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
      constructor
      · rintro ⟨c, hc, hci⟩; exact ⟨c, (hmem c).mpr (Or.inl hc), hci⟩
      · rintro ⟨c, hc, hci⟩
        rcases (hmem c).mp hc with hc | hc
        · exact ⟨c, hc, hci⟩
        · simp [(hdse c hc).1] at hci; omega
    · exact List.any_eq_true.mpr ⟨d0, (hmem d0).mpr (Or.inr hd0), by simp [(hdse d0 hd0).1]⟩
  have hF : m'.F = m.F := by
    unfold Model.F
    apply countUsed_congr
    intro g _
    rw [Bool.eq_iff_iff, List.any_eq_true, List.any_eq_true]
    constructor
    · rintro ⟨c, hc, hcg⟩
      rcases (hmem c).mp hc with hc | hc
      · exact ⟨c, hc, hcg⟩
      · obtain ⟨c', hc'l, hc'f⟩ := hf
        refine ⟨c', ?_, by simp only [beq_iff_eq] at hcg ⊢; rw [hc'f, ← (hdse c hc).2, hcg]⟩
        simp only [Model.uses, hloops, List.flatten_append, List.flatten_cons, List.mem_append]
        exact Or.inr (Or.inl hc'l)
    · rintro ⟨c, hc, hcg⟩; exact ⟨c, (hmem c).mpr (Or.inl hc), hcg⟩
  have hL : m'.L = m.L := by simp [m', addDegenerate, Model.L, hloops]
  show m'.chi = m.chi - 1
  unfold Model.chi
  omega

/-- With one coedge (upstream's single use of a pole edge) the degenerate edge is not paired. -/
theorem degenerate_pole_edge_unpaired (m : Model) (w f : Nat) (pre : List (List Use)) (l : List Use)
    (post : List (List Use)) (hloops : m.loops = pre ++ l :: post)
    (hwf : ∀ c ∈ m.uses, c.edge < m.edges.length) :
    ¬ PairedAt (addDegenerate m w pre l post [⟨f, m.edges.length, false⟩]).uses m.edges.length := by
  have hz : m.uses.filter (fun c => c.edge == m.edges.length) = [] := by
    rw [List.filter_eq_nil_iff]
    intro c hc
    have := hwf c hc
    simp; omega
  have hparts : pre.flatten.filter (fun c => c.edge == m.edges.length) = [] ∧
      l.filter (fun c => c.edge == m.edges.length) = [] ∧
      post.flatten.filter (fun c => c.edge == m.edges.length) = [] := by
    simp only [Model.uses, hloops, List.flatten_append, List.flatten_cons, List.filter_append,
      List.append_eq_nil_iff] at hz
    exact ⟨hz.1, hz.2.1, hz.2.2⟩
  have hr : revsOf (addDegenerate m w pre l post [⟨f, m.edges.length, false⟩]).uses m.edges.length = [false] := by
    unfold revsOf
    simp only [addDegenerate, Model.uses, List.flatten_append, List.flatten_cons, List.filter_append, hparts.1,
      hparts.2.1, hparts.2.2]
    simp
  unfold PairedAt
  rw [hr]
  decide

/-- The sphere with two-coedge degenerate pole edges at both poles: paired, but `chi = 0`, not 2. -/
def sphereWithPoleEdges : Model :=
  { nv := 2, edges := [(0, 1), (0, 0), (1, 1)], nf := 1,
    loops := [[⟨0, 1, false⟩, ⟨0, 1, true⟩, ⟨0, 0, false⟩, ⟨0, 2, false⟩, ⟨0, 2, true⟩, ⟨0, 0, true⟩]] }

theorem degenerate_pole_edge_two_uses :
    Paired sphereWithPoleEdges.uses ∧ sphereWithPoleEdges.closes = true ∧ sphereWithPoleEdges.chi = 0 := by
  decide

/-! ## The frustum volume as a difference of similar cones (π a common factor) -/

theorem frustum_volume_difference (h1 h2 r1 r2 : Rat) (hs : h1 * r2 = h2 * r1) :
    h1 * r1 ^ 2 - h2 * r2 ^ 2 = (h1 - h2) * (r1 ^ 2 + r1 * r2 + r2 ^ 2) := by
  grind

/-- A cone (`r2 = 0`): similarity forces the cut-off cone's height `h2 = 0`, and the frustum formula is the cone's
`h1 r1²` (times `π/3`). -/
theorem frustum_volume_apex (h1 h2 r1 : Rat) (hr : r1 ≠ 0) (hs : h1 * 0 = h2 * r1) :
    h2 = 0 ∧ (h1 - h2) * (r1 ^ 2 + r1 * 0 + 0 ^ 2) = h1 * r1 ^ 2 := by
  have h0 : h2 * r1 = 0 := by grind
  have hz : h2 = 0 := by
    rcases Rat.mul_eq_zero.mp h0 with h | h
    · exact h
    · exact absurd h hr
  exact ⟨hz, by rw [← frustum_volume_difference h1 h2 r1 0 hs, hz]; grind⟩

/-- A cylinder (`r1 = r2 = r`): `h (3 r²) / 3 = h r²` (times `π`). -/
theorem frustum_volume_cylinder (h r : Rat) : h * (r ^ 2 + r * r + r ^ 2) / 3 = h * r ^ 2 := by grind

end Primitive
end CadloomFormal
