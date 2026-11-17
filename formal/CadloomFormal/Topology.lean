/-!
# Topology: combinatorial closed cell structures and the box

Models (exactly, over `Nat`/`Int`) the combinatorics that the TypeScript topology code computes:

* `cycleUses f` is the list of directed edge uses `(f[k], f[(k+1) % n])` of a face given as a vertex-index
  cycle. This is the pairing `buildPolyhedron` (`src/topology/polyhedron.ts`) makes for each face (`a`, `c`).
* `key` is the undirected edge key (`min`, `max`) that `buildPolyhedron` uses to share one edge between the
  two faces that use it; `nub` is first-occurrence de-duplication, i.e. the order in which
  `buildPolyhedron` creates edges.
* `boxFaces` is `BOX_FACES` of `src/primitive/box.ts`, in the same order with the same vertex order.
* `genus` is the per-shell genus formula of `eulerPoincare` (`src/topology/validate.ts`),
  `G = S - (V - E + F - (L - F)) / 2`.

Theorems:
* `uses_length` — the number of directed edge uses is the sum of the face cycle lengths.
* `length_eq_sum_count` — a list whose entries all lie in a duplicate-free list `E` has length
  `sum_{e in E} count e`.
* `two_mul_edges_eq_sum_face_lengths` — if every undirected edge of `E` is used exactly twice (and every
  use is of an edge of `E`), then `2 |E| = sum of face lengths`.
* `box_counts`, `box_euler` — the box has `V = 8`, `E = 12`, `F = 6`, `V - E + F = 2`.
* `box_edge_uses_opposite` — every directed use in the box occurs once and its reverse occurs once (each
  edge is used by exactly two faces, with opposite orientations: a closed oriented 2-manifold).
* `box_each_edge_twice`, `box_two_mul_edges` — the general lemma instantiated on the box.
* `genus_of_euler_poincare`, `box_genus` — the genus formula inverts `V - E + F - (L - F) = 2 (S - G)`, and
  gives genus 0 for the box (`L = F = 6`, `S = 1`).

Not covered: the arena representation itself (ids, `next`/`prev` arrays, partner links), the run-time
checks of `validateBrep`, geometry (coordinates, planarity), and floating point.
-/
namespace CadloomFormal
namespace Topology

/-- A face as a closed cycle of vertex indices. -/
abbrev Cycle := List Nat

/-- Directed edge uses of a face cycle: `(f[k], f[(k+1) % n])` for `k < n`. -/
def cycleUses (f : Cycle) : List (Nat × Nat) := f.zip (f.drop 1 ++ f.take 1)

/-- All directed edge uses of a list of faces, face by face. -/
def uses (faces : List Cycle) : List (Nat × Nat) := faces.flatMap cycleUses

/-- Undirected edge key: the pair ordered as (min, max). -/
def key (p : Nat × Nat) : Nat × Nat := if p.1 ≤ p.2 then p else (p.2, p.1)

/-- First-occurrence de-duplication. -/
def nub {α : Type} [DecidableEq α] : List α → List α
  | [] => []
  | x :: xs => x :: (nub xs).filter (fun y => y ≠ x)

theorem cycleUses_length (f : Cycle) : (cycleUses f).length = f.length := by
  simp only [cycleUses, List.length_zip, List.length_append, List.length_drop, List.length_take]
  omega

theorem uses_length (faces : List Cycle) : (uses faces).length = (faces.map List.length).sum := by
  induction faces with
  | nil => simp [uses]
  | cons f fs ih =>
    simp only [uses, List.flatMap_cons, List.length_append, List.map_cons, List.sum_cons] at ih ⊢
    rw [cycleUses_length, ih]

private theorem sum_indicator {α : Type} [BEq α] [LawfulBEq α] (x : α) (E : List α) :
    (E.map (fun e => if (x == e) = true then 1 else 0)).sum = E.count x := by
  induction E with
  | nil => simp
  | cons e es ih =>
    simp only [List.map_cons, List.sum_cons, List.count_cons, ih]
    by_cases h : x = e
    · subst h; simp; omega
    · have h1 : (x == e) = false := by simp [h]
      have h2 : (e == x) = false := by simp; exact fun h' => h h'.symm
      simp [h1, h2]

private theorem sum_map_add {α : Type} (E : List α) (f g : α → Nat) :
    (E.map (fun e => f e + g e)).sum = (E.map f).sum + (E.map g).sum := by
  induction E with
  | nil => simp
  | cons e es ih => simp only [List.map_cons, List.sum_cons, ih]; omega

theorem length_eq_sum_count {α : Type} [BEq α] [LawfulBEq α] (L E : List α) (hE : E.Nodup)
    (hL : ∀ x ∈ L, x ∈ E) : L.length = (E.map (fun e => L.count e)).sum := by
  induction L with
  | nil =>
    simp only [List.length_nil, List.count_nil]
    clear hE hL
    induction E with
    | nil => rfl
    | cons e es ih => simp only [List.map_cons, List.sum_cons, ← ih]
  | cons x xs ih =>
    have ih' := ih (fun y hy => hL y (List.mem_cons_of_mem x hy))
    have hx : x ∈ E := hL x List.mem_cons_self
    have h1 : E.count x = 1 := by rw [List.Nodup.count hE, if_pos hx]
    have hsplit : (E.map (fun e => (x :: xs).count e)).sum
        = (E.map (fun e => xs.count e)).sum + (E.map (fun e => if (x == e) = true then 1 else 0)).sum := by
      rw [← sum_map_add]
      congr 1
      apply List.map_congr_left
      intro e _
      simp only [List.count_cons]
    rw [hsplit, sum_indicator, h1, List.length_cons, ih']

private theorem sum_const_two {α : Type} (E : List α) (f : α → Nat) (h : ∀ e ∈ E, f e = 2) :
    (E.map f).sum = 2 * E.length := by
  induction E with
  | nil => simp
  | cons e es ih =>
    simp only [List.map_cons, List.sum_cons, List.length_cons]
    rw [h e List.mem_cons_self, ih (fun e' he' => h e' (List.mem_cons_of_mem e he'))]
    omega

/-- If every undirected edge of `E` (duplicate-free) is used exactly twice and every use is of an edge of
`E`, then `2 E = sum of face lengths`. -/
theorem two_mul_edges_eq_sum_face_lengths (faces : List Cycle) (E : List (Nat × Nat)) (hE : E.Nodup)
    (hcover : ∀ u ∈ uses faces, key u ∈ E)
    (htwice : ∀ e ∈ E, ((uses faces).map key).count e = 2) :
    2 * E.length = (faces.map List.length).sum := by
  have hL : ∀ x ∈ (uses faces).map key, x ∈ E := by
    intro x hx
    obtain ⟨u, hu, rfl⟩ := List.mem_map.mp hx
    exact hcover u hu
  have h := length_eq_sum_count ((uses faces).map key) E hE hL
  rw [List.length_map, uses_length] at h
  exact (h.trans (sum_const_two E _ htwice)).symm

/-! ## The box (same table as `BOX_FACES` in `src/primitive/box.ts`) -/

def boxFaces : List Cycle :=
  [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]

/-- Vertices in first-use order. -/
def boxVertices : List Nat := nub boxFaces.flatten

/-- Edges in the order `buildPolyhedron` creates them (first use of each undirected key). -/
def boxEdges : List (Nat × Nat) := nub ((uses boxFaces).map key)

theorem box_counts : boxVertices.length = 8 ∧ boxEdges.length = 12 ∧ boxFaces.length = 6 := by
  decide

theorem box_euler :
    (boxVertices.length : Int) - boxEdges.length + boxFaces.length = 2 := by
  rw [box_counts.1, box_counts.2.1, box_counts.2.2]; decide

theorem box_edge_uses_opposite :
    ∀ u ∈ uses boxFaces, (uses boxFaces).count u = 1 ∧ (uses boxFaces).count (u.2, u.1) = 1 := by
  decide

theorem box_each_edge_twice : ∀ e ∈ boxEdges, ((uses boxFaces).map key).count e = 2 := by
  decide

theorem box_two_mul_edges : 2 * boxEdges.length = (boxFaces.map List.length).sum :=
  two_mul_edges_eq_sum_face_lengths boxFaces boxEdges (by decide) (by decide) box_each_edge_twice

/-! ## Euler–Poincaré -/

/-- Genus from the counts, as `eulerPoincare` computes it (`G = S - (V - E + F - (L - F)) / 2`). -/
def genus (v e f l s : Int) : Int := s - (v - e + f - (l - f)) / 2

theorem genus_of_euler_poincare (v e f l s g : Int) (h : v - e + f - (l - f) = 2 * (s - g)) :
    genus v e f l s = g := by
  unfold genus; rw [h]; omega

theorem box_genus :
    genus boxVertices.length boxEdges.length boxFaces.length boxFaces.length 1 = 0 := by
  rw [box_counts.1, box_counts.2.1, box_counts.2.2]; decide

end Topology
end CadloomFormal
