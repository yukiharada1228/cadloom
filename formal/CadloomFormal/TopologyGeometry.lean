import CadloomFormal.Topology

/-!
# TopologyGeometry: seam edges, coedge pairing under face reversal, and the edge parameter map

Models (exactly, over `Nat`/`Bool`/`Int`/`Rat`) what the M2 B-rep code (`src/topology/brep.ts`,
`src/topology/validate.ts`, `src/topology/geometry.ts`) computes:

* `Use` is a coedge reduced to what pairing and Euler–Poincaré see: its face, its edge and whether it runs the
  edge backwards (`Coedge.reversed`). A loop is the list of its uses in `next` order.
* `cylinderEdges` / `cylinderLoops` are the closed cylinder fixture `cylinder()` of
  `tests/topology-geometry.test.ts`, same ids in the same order: edges `e0` bottom circle `(v0, v0)`, `e1` top
  circle `(v1, v1)`, `e2` seam `(v0, v1)`; loops `F0: [e0 rev]`, `F1: [e1 fwd]`,
  `F2: [e0 fwd, e2 fwd, e1 rev, e2 rev]` (the seam used twice by face 2).
* `revsOf cs e` is the list of directions of the uses of edge `e` in arena order; `PairedAt cs e` is step 5 of
  `validateBrep` for that edge (exactly two coedges, opposite directions: `edge-use-count`, `edge-orientation`).
* `flip S cs` reverses the direction of every coedge of the faces in `S` (what reversing those faces does to
  `Coedge.reversed`; the test helper `reverseFaces` also swaps `next`/`prev`).
* `edgeParam t0 t1 s = t0 + s (t1 - t0)` is `edgeParam` of `geometry.ts`, and `coedgeParam` composes it with
  `coedgeFraction` (`1 - s` for a reversed coedge), as `coedgePoint` / `edgeCurvePoint` / `pcurveUv` do.

Theorems:
* `cylinder_counts` — the fixture has `V = 2`, `E = 3`, `F = 3`, `L = 3` (vertices and edges counted as
  `eulerPoincare` does: distinct coedge start vertices and distinct edges of the shell's loops).
* `cylinder_euler_poincare` — `V - E + F - (L - F) = 2 (S - G)` with `S = 1`, `G = 0`; `cylinder_genus` — the
  genus formula `Topology.genus` gives 0.
* `cylinder_loops_close` — in every loop each coedge ends where the next starts (`vertex-mismatch` passes).
* `cylinder_paired` — every edge of the fixture, the seam included, is `PairedAt`; `cylinder_seam_one_face` —
  both uses of the seam lie on face 2.
* `revsOf_flip` — flipping maps the direction list of each edge use-wise (lemma).
* `flip_preserves_pairedAt` — if both uses of `e` lie in faces that `S` treats alike, flipping `S` keeps `e`
  paired; `flip_preserves_paired` — flipping a face set closed under edge sharing keeps every edge paired;
  `seam_flip_preserves_pairedAt` — a seam (both uses on face `f`) stays paired when face `f` alone is flipped.
* `cylinder_flip_side_breaks_circle` — flipping only face 2 breaks the circle `e0` (the hypothesis of
  `flip_preserves_paired` is needed) while `cylinder_flip_side_keeps_seam` the seam stays paired.
* `edgeParam_zero`, `edgeParam_one`, `edgeParam_strictMono`, `edgeParam_mem` — `s ↦ t0 + s (t1 - t0)` hits `t0`
  at 0 and `t1` at 1, is strictly increasing when `t0 < t1`, and maps `[0, 1]` into `[t0, t1]`.
* `coedgeParam_start`, `coedgeParam_end`, `coedgeParam_reverse` — a coedge starts at the edge parameter of
  its start vertex (`t1` when reversed) and ends at that of its end vertex; the partner coedge traverses the
  same parameters backwards.

Not covered: the geometry checks (curve and surface evaluation, pcurve lifting, tolerances), the arena
representation (`next`/`prev` arrays, partner links), the manifold-vertex and connectivity checks, floating
point (the TS `edgeParam` returns `t1` exactly at `s = 1`; its strict monotonicity in doubles is tested only).
-/
namespace CadloomFormal
namespace TopologyGeometry

/-- A coedge: its face, its edge, and whether it runs the edge from `end` to `start`. -/
structure Use where
  face : Nat
  edge : Nat
  rev : Bool
deriving DecidableEq, Repr

/-! ## The closed cylinder fixture -/

/-- Edge end vertices `(start, end)`: bottom circle, top circle, seam. -/
def cylinderEdges : List (Nat × Nat) := [(0, 0), (1, 1), (0, 1)]

/-- Loops in arena order, each in `next` order (the TS fixture `cylinder()`). -/
def cylinderLoops : List (List Use) :=
  [ [⟨0, 0, true⟩],
    [⟨1, 1, false⟩],
    [⟨2, 0, false⟩, ⟨2, 2, false⟩, ⟨2, 1, true⟩, ⟨2, 2, true⟩] ]

/-- All coedges in arena order. -/
def cylinderUses : List Use := cylinderLoops.flatten

def edgeEnds (E : List (Nat × Nat)) (e : Nat) : Nat × Nat := E.getD e (0, 0)

/-- `coedgeStart`: the edge's end vertex when reversed, else its start vertex. -/
def useStart (E : List (Nat × Nat)) (c : Use) : Nat := if c.rev then (edgeEnds E c.edge).2 else (edgeEnds E c.edge).1

/-- `coedgeEnd`. -/
def useEnd (E : List (Nat × Nat)) (c : Use) : Nat := if c.rev then (edgeEnds E c.edge).1 else (edgeEnds E c.edge).2

/-- Each coedge ends where the next one (cyclically) starts. -/
def loopCloses (E : List (Nat × Nat)) (l : List Use) : Bool :=
  (l.zip (l.drop 1 ++ l.take 1)).all (fun p => useEnd E p.1 == useStart E p.2)

/-- Counts as `eulerPoincare` takes them for one shell. -/
def numVertices : Nat := (Topology.nub (cylinderUses.map (useStart cylinderEdges))).length
def numEdges : Nat := (Topology.nub (cylinderUses.map Use.edge)).length
def numFaces : Nat := (Topology.nub (cylinderUses.map Use.face)).length
def numLoops : Nat := cylinderLoops.length

theorem cylinder_counts : numVertices = 2 ∧ numEdges = 3 ∧ numFaces = 3 ∧ numLoops = 3 := by decide

theorem cylinder_euler_poincare :
    (numVertices : Int) - numEdges + numFaces - (numLoops - numFaces) = 2 * (1 - 0) := by
  rw [cylinder_counts.1, cylinder_counts.2.1, cylinder_counts.2.2.1, cylinder_counts.2.2.2]; decide

theorem cylinder_genus : Topology.genus numVertices numEdges numFaces numLoops 1 = 0 :=
  Topology.genus_of_euler_poincare _ _ _ _ _ _ cylinder_euler_poincare

theorem cylinder_loops_close : ∀ l ∈ cylinderLoops, loopCloses cylinderEdges l = true := by decide

/-! ## Pairing of coedges -/

/-- Directions of the uses of edge `e`, in arena order. -/
def revsOf (cs : List Use) (e : Nat) : List Bool := (cs.filter (fun c => c.edge == e)).map Use.rev

/-- Exactly two uses, in opposite directions. -/
def PairedAt (cs : List Use) (e : Nat) : Prop := revsOf cs e = [false, true] ∨ revsOf cs e = [true, false]

instance (cs : List Use) (e : Nat) : Decidable (PairedAt cs e) := by unfold PairedAt; infer_instance

/-- Every edge that is used is paired. -/
def Paired (cs : List Use) : Prop := ∀ c ∈ cs, PairedAt cs c.edge

instance (cs : List Use) : Decidable (Paired cs) := by unfold Paired; infer_instance

theorem cylinder_paired : Paired cylinderUses := by decide

theorem cylinder_seam_one_face : ∀ c ∈ cylinderUses, c.edge = 2 → c.face = 2 := by decide

/-- Reverse the coedges of the faces selected by `S`. -/
def flipOne (S : Nat → Bool) (c : Use) : Use := if S c.face then { c with rev := !c.rev } else c

def flip (S : Nat → Bool) (cs : List Use) : List Use := cs.map (flipOne S)

theorem flipOne_edge (S : Nat → Bool) (c : Use) : (flipOne S c).edge = c.edge := by
  unfold flipOne; split <;> rfl

theorem revsOf_flip (S : Nat → Bool) (cs : List Use) (e : Nat) :
    revsOf (flip S cs) e = (cs.filter (fun c => c.edge == e)).map (fun c => (flipOne S c).rev) := by
  unfold revsOf flip
  rw [List.filter_map, List.map_map]
  congr 2
  funext c
  simp only [Function.comp, flipOne_edge]

/-- The faces of the uses of `e` are all inside or all outside `S`. -/
def EdgeClosedAt (S : Nat → Bool) (cs : List Use) (e : Nat) : Prop :=
  ∀ c ∈ cs, ∀ d ∈ cs, c.edge = e → d.edge = e → S c.face = S d.face

theorem flip_preserves_pairedAt (S : Nat → Bool) (cs : List Use) (e : Nat)
    (hc : EdgeClosedAt S cs e) (hp : PairedAt cs e) : PairedAt (flip S cs) e := by
  unfold PairedAt at hp ⊢
  rw [revsOf_flip]
  unfold revsOf at hp
  match hL : cs.filter (fun c => c.edge == e) with
  | [c1, c2] =>
    rw [hL] at hp
    rw [hL]
    have m1 : c1 ∈ cs.filter (fun c => c.edge == e) := by rw [hL]; simp
    have m2 : c2 ∈ cs.filter (fun c => c.edge == e) := by rw [hL]; simp
    simp only [List.mem_filter, beq_iff_eq] at m1 m2
    have hs := hc c1 m1.1 c2 m2.1 m1.2 m2.2
    simp only [List.map_cons, List.map_nil, List.cons.injEq, and_true] at hp ⊢
    unfold flipOne
    rw [hs]
    cases h : S c2.face <;> rcases hp with ⟨ha, hb⟩ | ⟨ha, hb⟩ <;> simp [ha, hb]
  | [] => rw [hL] at hp; simp at hp
  | [_] => rw [hL] at hp; simp at hp
  | _ :: _ :: _ :: _ => rw [hL] at hp; simp at hp

/-- Flipping a face set closed under edge sharing keeps every edge paired. -/
theorem flip_preserves_paired (S : Nat → Bool) (cs : List Use)
    (hc : ∀ c ∈ cs, ∀ d ∈ cs, c.edge = d.edge → S c.face = S d.face) (hp : Paired cs) :
    Paired (flip S cs) := by
  intro c hcm
  obtain ⟨c0, h0, rfl⟩ := List.mem_map.mp hcm
  rw [flipOne_edge]
  exact flip_preserves_pairedAt S cs c0.edge
    (fun a ha b hb hae hbe => hc a ha b hb (hae.trans hbe.symm)) (hp c0 h0)

/-- A seam: both uses of `e` on face `f`. Flipping face `f` alone keeps it paired. -/
theorem seam_flip_preserves_pairedAt (cs : List Use) (e f : Nat)
    (hseam : ∀ c ∈ cs, c.edge = e → c.face = f) (hp : PairedAt cs e) :
    PairedAt (flip (fun g => g == f) cs) e :=
  flip_preserves_pairedAt _ cs e
    (fun c hc d hd hce hde => by rw [hseam c hc hce, hseam d hd hde]) hp

theorem cylinder_flip_side_breaks_circle : ¬ PairedAt (flip (fun g => g == 2) cylinderUses) 0 := by decide

theorem cylinder_flip_side_keeps_seam : PairedAt (flip (fun g => g == 2) cylinderUses) 2 :=
  seam_flip_preserves_pairedAt cylinderUses 2 2 (by decide) (by decide)

/-! ## The edge parameter map `s ↦ t0 + s (t1 - t0)` -/

def edgeParam (t0 t1 s : Rat) : Rat := t0 + s * (t1 - t0)

theorem edgeParam_zero (t0 t1 : Rat) : edgeParam t0 t1 0 = t0 := by simp [edgeParam]; grind

theorem edgeParam_one (t0 t1 : Rat) : edgeParam t0 t1 1 = t1 := by simp [edgeParam]; grind

theorem edgeParam_strictMono (t0 t1 s s' : Rat) (ht : t0 < t1) (hs : s < s') :
    edgeParam t0 t1 s < edgeParam t0 t1 s' := by
  have h : 0 < (s' - s) * (t1 - t0) := Rat.mul_pos (by grind) (by grind)
  unfold edgeParam
  grind

theorem edgeParam_mem (t0 t1 s : Rat) (ht : t0 ≤ t1) (h0 : 0 ≤ s) (h1 : s ≤ 1) :
    t0 ≤ edgeParam t0 t1 s ∧ edgeParam t0 t1 s ≤ t1 := by
  have a : 0 ≤ s * (t1 - t0) := Rat.mul_nonneg h0 (by grind)
  have b : 0 ≤ (1 - s) * (t1 - t0) := Rat.mul_nonneg (by grind) (by grind)
  unfold edgeParam
  constructor <;> grind

/-- `coedgeFraction` then `edgeParam`: the edge parameter at fraction `s` along a coedge. -/
def coedgeParam (t0 t1 : Rat) (rev : Bool) (s : Rat) : Rat := edgeParam t0 t1 (if rev then 1 - s else s)

theorem coedgeParam_start (t0 t1 : Rat) (rev : Bool) :
    coedgeParam t0 t1 rev 0 = if rev then t1 else t0 := by
  cases rev <;> simp [coedgeParam, edgeParam] <;> grind

theorem coedgeParam_end (t0 t1 : Rat) (rev : Bool) :
    coedgeParam t0 t1 rev 1 = if rev then t0 else t1 := by
  cases rev <;> simp [coedgeParam, edgeParam] <;> grind

theorem coedgeParam_reverse (t0 t1 : Rat) (rev : Bool) (s : Rat) :
    coedgeParam t0 t1 (!rev) s = coedgeParam t0 t1 rev (1 - s) := by
  have h : 1 - (1 - s) = s := by grind
  cases rev <;> simp [coedgeParam, h]

end TopologyGeometry
end CadloomFormal
