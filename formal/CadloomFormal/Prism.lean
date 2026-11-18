import CadloomFormal.Profile
import CadloomFormal.Mass
import CadloomFormal.TopologyGeometry

/-!
# Prism: the topology and the volume of an extruded profile

Exact model of `extrude` (`src/prism/extrude.ts`) for one region whose wires (outer first, then the holes) have
`ns = [n_0, …, n_H]` segments, `N = ns.sum`, and of the divergence-theorem volume `polyhedronMass`
(`src/mass/polyhedron.ts`, Lean `Mass.loopDet`) of the faces it builds.

Topology (ids exactly as `buildPrismRegion` of `src/prism/layout.ts` assigns them):
* `allSegs 0 ns` lists `(g, next g)` for every global segment index `g`, wire by wire: segment `j` of a wire with
  offset `o` and `n` segments is `(o + j, o + (j + 1) % n)` (`nextOf` in the TS).
* `edges ns` are the edge end vertices in arena order: bottom `B_g = (g, next g)`, top `T_g = (N + g, N + next g)`,
  vertical `S_g = (g, N + g)`; vertices `b_g = g`, `t_g = N + g`.
* `loops ns` are the loops in arena order, each in `next` order, as `TopologyGeometry.Use` (face, edge, reversed):
  face 0 (bottom) one loop per wire `[B_{o+n-1} rev, …, B_o rev]`, face 1 (top) one per wire `[T_o, …, T_{o+n-1}]`,
  then face `2 + g` the side loop `[B_g fwd, S_next fwd, T_g rev, S_g rev]`.

Geometry (volume): the profile plane is the `z = 0` plane of the standard frame (the TS works in the plane's
own frame; a rigid change of frame does not change volumes), a wire is the list of its segment start points
`p0 :: ps`, `lift0 p = (p.x, p.y, 0)` and `liftV v p = (p.x + v.x, p.y + v.y, v.z)` (the extrusion vector `v`,
oblique or not). The loops `polyhedronMass` fans, with their vertices in loop order (`loopVertices`: the start of
each coedge, from the loop's first coedge), are `bottomLoop` (`b_0, b_{n-1}, …, b_1`), `topLoop` and `sideLoop a b`
(`b_g, b_next, t_next, t_g`).

Theorems:
* `allSegs_length`, `prism_counts` — `V = 2N`, `E = 3N`, `F = N + 2`, `L = N + 2 (H + 1)` for every `ns`.
* `prism_euler_poincare` — `V - E + F - (L - F) = 2 (S - G)` with `S = 1` and `G = H` (the number of holes);
  `prism_genus` — `Topology.genus` gives `H`: every hole is a through hole. `prism_genus_simple` — no hole, genus 0.
* `examples_close`, `examples_paired`, `examples_counts` — for `ns = [1]` (a cylinder), `[2]`, `[4]` (a box),
  `[4, 1]` (a plate with a round hole), `[3, 1, 2]`: every loop closes (`loopCloses`), every edge has exactly
  two coedges in opposite directions (`Paired`), and the counts `eulerPoincare` takes (distinct start vertices,
  distinct edges) are `2N` and `3N` (decided).
* `cap_tri` — per fan triangle, the top cap minus the bottom cap contributes `v.z` times the triangle's
  `triArea2`; `caps_det` — the two caps of a wire contribute `v.z · area2`.
* `side_det` — a side quad contributes `2 v.z (a × b) + 2 (ψ b - ψ a)`; `sides_det` — summed over the wire's
  segments `polySegs` the `ψ` terms telescope (`Profile.zip_telescope`) to `2 v.z · area2`.
* `wire_det`, `prism_det`, `prism_volume` — for every reference point `r`, every extrusion vector `v` and any
  list of wires, the divergence sum of all the faces (bottom loops, top loops, side quads) is `3 v.z Σ area2 w`,
  so the volume `prismDet / 6` is `v.z` times the shoelace area `Σ area2 w / 2` (holes, listed clockwise, have
  negative `area2` and are subtracted).

Not covered: the arcs and NURBS segments of curved profiles (their side faces are not planar; the TS reference
volume `prismVolume` is `area × h` and the tests compare meshes against it), floating point, the run-time
checks, the arena arrays (`next`/`prev`, partner links) and the general `Paired` property for every `ns`
(decided on the examples only).
-/
namespace CadloomFormal
namespace Prism

open V3
open Tess (P cr chain area2 triArea2 sumArea fanTris)
open TopologyGeometry (Use loopCloses Paired)

/-! ## Topology -/

/-- `(o + j, o + (j + 1) % n)` for `j < n`: one wire's segments with their successors. -/
def wireSegs (o n : Nat) : List (Nat × Nat) := (List.range n).map (fun j => (o + j, o + (j + 1) % n))

/-- All segments of the region, wire by wire, from offset `o`. -/
def allSegs : Nat → List Nat → List (Nat × Nat)
  | _, [] => []
  | o, n :: ns => wireSegs o n ++ allSegs (o + n) ns

/-- Edge end vertices, in arena order: bottom, top, vertical. -/
def edges (ns : List Nat) : List (Nat × Nat) :=
  let N := ns.sum
  let S := allSegs 0 ns
  S.map (fun s => (s.1, s.2)) ++ S.map (fun s => (N + s.1, N + s.2)) ++ (List.range N).map (fun g => (g, N + g))

def numVertices (ns : List Nat) : Nat := 2 * ns.sum
def numFaces (ns : List Nat) : Nat := ns.sum + 2

/-- The bottom loops (face 0), one per wire, each running its wire backwards. -/
def bottomLoops : Nat → List Nat → List (List Use)
  | _, [] => []
  | o, n :: ns => ((wireSegs o n).reverse.map (fun s => (⟨0, s.1, true⟩ : Use))) :: bottomLoops (o + n) ns

/-- The top loops (face 1), one per wire, forwards. -/
def topLoops (N : Nat) : Nat → List Nat → List (List Use)
  | _, [] => []
  | o, n :: ns => ((wireSegs o n).map (fun s => (⟨1, N + s.1, false⟩ : Use))) :: topLoops N (o + n) ns

/-- The side loop of segment `(g, next g)`: `[B_g fwd, S_next fwd, T_g rev, S_g rev]` on face `2 + g`. -/
def sideLoop (N : Nat) (s : Nat × Nat) : List Use :=
  [⟨2 + s.1, s.1, false⟩, ⟨2 + s.1, 2 * N + s.2, false⟩, ⟨2 + s.1, N + s.1, true⟩, ⟨2 + s.1, 2 * N + s.1, true⟩]

/-- All loops, in arena order. -/
def loops (ns : List Nat) : List (List Use) :=
  bottomLoops 0 ns ++ topLoops ns.sum 0 ns ++ (allSegs 0 ns).map (sideLoop ns.sum)

theorem wireSegs_length (o n : Nat) : (wireSegs o n).length = n := by simp [wireSegs]

theorem allSegs_length (ns : List Nat) : ∀ o, (allSegs o ns).length = ns.sum := by
  induction ns with
  | nil => intro o; simp [allSegs]
  | cons n ns ih => intro o; simp [allSegs, wireSegs_length, ih]

theorem bottomLoops_length (ns : List Nat) : ∀ o, (bottomLoops o ns).length = ns.length := by
  induction ns with
  | nil => intro o; simp [bottomLoops]
  | cons n ns ih => intro o; simp [bottomLoops, ih]

theorem topLoops_length (N : Nat) (ns : List Nat) : ∀ o, (topLoops N o ns).length = ns.length := by
  induction ns with
  | nil => intro o; simp [topLoops]
  | cons n ns ih => intro o; simp [topLoops, ih]

theorem prism_counts (ns : List Nat) :
    numVertices ns = 2 * ns.sum ∧ (edges ns).length = 3 * ns.sum ∧ numFaces ns = ns.sum + 2 ∧
      (loops ns).length = ns.sum + 2 * ns.length := by
  refine ⟨rfl, ?_, rfl, ?_⟩
  · simp only [edges, List.length_append, List.length_map, List.length_range, allSegs_length]; omega
  · simp only [loops, List.length_append, List.length_map, bottomLoops_length, topLoops_length, allSegs_length]
    omega

/-- Euler–Poincaré with `S = 1` shell and genus `G = H = ns.length - 1` (one per hole). -/
theorem prism_euler_poincare (ns : List Nat) (h : ns ≠ []) :
    (numVertices ns : Int) - (edges ns).length + numFaces ns - ((loops ns).length - numFaces ns) =
      2 * (1 - ((ns.length : Int) - 1)) := by
  obtain ⟨hv, he, hf, hl⟩ := prism_counts ns
  rw [hv, he, hf, hl]
  have : ns.length ≥ 1 := by cases ns with | nil => exact absurd rfl h | cons _ _ => simp
  push_cast; omega

theorem prism_genus (ns : List Nat) (h : ns ≠ []) :
    Topology.genus (numVertices ns) (edges ns).length (numFaces ns) (loops ns).length 1 = (ns.length : Int) - 1 :=
  Topology.genus_of_euler_poincare _ _ _ _ _ _ (prism_euler_poincare ns h)

theorem prism_genus_simple (n : Nat) :
    Topology.genus (numVertices [n]) (edges [n]).length (numFaces [n]) (loops [n]).length 1 = 0 := by
  have := prism_genus [n] (by simp); simpa using this

/-! ### Decided examples -/

/-- The counts `eulerPoincare` takes: distinct coedge start vertices and distinct edges. -/
def epVertices (ns : List Nat) : Nat :=
  (Topology.nub ((loops ns).flatten.map (TopologyGeometry.useStart (edges ns)))).length
def epEdges (ns : List Nat) : Nat := (Topology.nub ((loops ns).flatten.map Use.edge)).length

def examples : List (List Nat) := [[1], [2], [4], [4, 1], [3, 1, 2]]

theorem examples_close : ∀ ns ∈ examples, ∀ l ∈ loops ns, loopCloses (edges ns) l = true := by decide

theorem examples_paired : ∀ ns ∈ examples, Paired (loops ns).flatten := by decide

theorem examples_counts : ∀ ns ∈ examples, epVertices ns = 2 * ns.sum ∧ epEdges ns = 3 * ns.sum := by decide

/-! ## Volume -/

def lift0 (p : P) : V3 := ⟨p.1, p.2, 0⟩
def liftV (v : V3) (p : P) : V3 := ⟨p.1 + v.x, p.2 + v.y, v.z⟩

/-- The bottom loop of a wire `p0 :: ps`: `b_0, b_{n-1}, …, b_1`. -/
def bottomLoop : List P → List V3
  | [] => []
  | p0 :: ps => lift0 p0 :: (ps.map lift0).reverse

def topLoop (v : V3) (w : List P) : List V3 := w.map (liftV v)

/-- The side quad of the segment `a → b`: `b_g, b_next, t_next, t_g`. -/
def sideLoopPts (v : V3) (a b : P) : List V3 := [lift0 a, lift0 b, liftV v b, liftV v a]

/-- Divergence sum of the faces of one wire: its bottom and top loops and its side quads. -/
def wireDet (r v : V3) (w : List P) : Rat :=
  Mass.loopDet r (bottomLoop w) + Mass.loopDet r (topLoop v w) +
    ((Profile.polySegs w).map (fun s => Mass.loopDet r (sideLoopPts v s.1 s.2))).sum

/-- The divergence sum of all faces of the prism in the TS order: bottom face (every wire's loop), top face
(every wire's loop), side faces (every segment of every wire). -/
def prismDet (r v : V3) (ws : List (List P)) : Rat :=
  (ws.map (fun w => Mass.loopDet r (bottomLoop w))).sum + (ws.map (fun w => Mass.loopDet r (topLoop v w))).sum +
    (ws.map (fun w => ((Profile.polySegs w).map (fun s => Mass.loopDet r (sideLoopPts v s.1 s.2))).sum)).sum

theorem cap_tri (r v : V3) (a b c : P) :
    Mass.tetDet r (liftV v a) (liftV v b) (liftV v c) - Mass.tetDet r (lift0 a) (lift0 b) (lift0 c) =
      v.z * triArea2 (a, b, c) := by
  simp only [Mass.tetDet, Mass.det, dot, cross, sub, liftV, lift0, triArea2, cr]; grind

theorem fan_caps (r v : V3) (p0 : P) :
    ∀ ps : List P, Mass.fanDet r (liftV v p0) (ps.map (liftV v)) - Mass.fanDet r (lift0 p0) (ps.map lift0) =
      v.z * sumArea (fanTris p0 ps) := by
  intro ps
  induction ps with
  | nil => simp [Mass.fanDet, fanTris, sumArea]; grind
  | cons a t ih =>
    cases t with
    | nil => simp [Mass.fanDet, fanTris, sumArea]; grind
    | cons b t' =>
      simp only [List.map_cons, Mass.fanDet, fanTris, sumArea] at ih ⊢
      have := cap_tri r v p0 a b
      grind

theorem caps_det (r v : V3) (w : List P) :
    Mass.loopDet r (bottomLoop w) + Mass.loopDet r (topLoop v w) = v.z * area2 w := by
  cases w with
  | nil => (simp [bottomLoop, topLoop, Mass.loopDet, area2]) <;> grind
  | cons p0 ps =>
    simp only [bottomLoop, topLoop, List.map_cons]
    rw [Mass.loopDet_reverse]
    simp only [Mass.loopDet]
    have h := fan_caps r v p0 ps
    rw [Tess.fan_area] at h
    grind

/-- The potential whose differences the side quads leave besides `2 v.z (a × b)`. -/
def psi (r v : V3) (p : P) : Rat := v.z * (p.1 * r.y - p.2 * r.x) + v.x * r.z * p.2 - v.y * r.z * p.1

theorem side_det (r v : V3) (a b : P) :
    Mass.loopDet r (sideLoopPts v a b) = 2 * v.z * cr a b + 2 * psi r v b - 2 * psi r v a := by
  simp only [sideLoopPts, Mass.loopDet, Mass.fanDet, Mass.tetDet, Mass.det, dot, cross, sub, liftV, lift0, psi, cr]
  grind

theorem sides_det (r v : V3) (w : List P) :
    ((Profile.polySegs w).map (fun s => Mass.loopDet r (sideLoopPts v s.1 s.2))).sum = 2 * v.z * area2 w := by
  cases w with
  | nil => simp [Profile.polySegs, Tess.rot1, area2]
  | cons x xs =>
    have h := Profile.zip_telescope (fun a b => Mass.loopDet r (sideLoopPts v a b)) (fun p => 2 * psi r v p)
      (2 * v.z) (by intro a b; simp only [side_det]) xs x x
    simp only [Profile.polySegs, Tess.rot1, area2]
    rw [h]
    simp only [List.cons_append]
    grind

theorem wire_det (r v : V3) (w : List P) : wireDet r v w = 3 * v.z * area2 w := by
  unfold wireDet
  rw [sides_det]
  have := caps_det r v w
  grind

theorem prism_det (r v : V3) (ws : List (List P)) : prismDet r v ws = 3 * v.z * (ws.map area2).sum := by
  induction ws with
  | nil => (simp [prismDet]) <;> grind
  | cons w ws ih =>
    simp only [prismDet, List.map_cons, List.sum_cons] at ih ⊢
    have h1 := caps_det r v w
    have h2 := sides_det r v w
    grind

/-- The divergence volume `prismDet / 6` is the height `v.z` times the shoelace area `Σ area2 / 2`. -/
theorem prism_volume (r v : V3) (ws : List (List P)) :
    prismDet r v ws / 6 = v.z * ((ws.map area2).sum / 2) := by
  rw [prism_det]; grind

/-- With the TS segment terms: `Σ shoelace2 = Σ area2` (`Profile.shoelace2_eq_area2`). -/
theorem prism_volume_shoelace (r v : V3) (ws : List (List P)) :
    prismDet r v ws / 6 = v.z * ((ws.map Profile.shoelace2).sum / 2) := by
  rw [prism_volume]
  have : ws.map Profile.shoelace2 = ws.map area2 := by
    apply List.map_congr_left; intro w _; exact Profile.shoelace2_eq_area2 w
  rw [this]

end Prism
end CadloomFormal
