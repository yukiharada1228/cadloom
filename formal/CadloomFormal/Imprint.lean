import CadloomFormal.Profile
import CadloomFormal.Topology

/-!
# Imprint: counting, areas and parameter partitions of face and edge splitting (M5)

Exact model of the bookkeeping of `src/boolean/imprint-count.ts`, `src/boolean/imprint-arrangement.ts` and
`src/boolean/split.ts` (the imprint stage of the boolean: edges are cut, faces are split along intersection
curves). Counts are `Int`, parameters and `(u, v)` points `Rat` (`Tess.P = Rat × Rat`).

## (a), (c) The counting model — `imprint-count.ts`, used by `imprint.ts`

`Op` is the TS `ImprintOp`, `delta` the TS table `IMPRINT_DELTA` (same rows, same numbers), `apply` / `run` the TS
`applyImprintOp` / `applyImprintOps` (a left fold), `chi c = V - E + 2F - L` the TS `imprintChi`.

* `chi_apply`, `chi_run` — every step, hence every logged sequence, keeps `χ`.
* `chi_eq_euler`, `genus_run` — `χ` is the Euler–Poincaré left side `V - E + F - (L - F)` of M0 `eulerPoincare`,
  so the genus `Topology.genus` of an imprinted body equals the original's.
* `chord_counts` — a chord between two vertices of one boundary: `E + 1, F + 1, L + 1` (`V + 0`).
* `chord_new_vertices` — a chord between two points inside edges (`split-edge, split-edge, chord`, the TS log of
  a face cut by a line): `V + 2, E + 3, F + 1, L + 1`.
* `ring_counts` — a closed curve inside a face (`ring`): `V + 1, E + 1, F + 1, L + 2` — one new face (the disc,
  one loop) and one hole in the old face.
* `run_f`, `run_l` — the faces and loops a face's logged steps predict: `F = F₀ + #chord + #ring`,
  `L = L₀ + #chord + #free-edge + 2 #ring - #bridge`. `imprint.ts` refuses an arrangement whose walked
  sub-faces and loops differ from `run ⟨0, 0, 1, L₀⟩ ops` (the guard of step 5).
* `box_box_log`, `slab_log`, `sphere_equator_log` — the logs the TS produces for three test bodies (box/box,
  a box cut through by a slab, a sphere cut at its equator) give exactly the counts of the TS result bodies
  (tested by the same names in `tests/boolean-imprint.test.ts`).

## (b) Shoelace additivity — `imprint-arrangement.ts`

`Profile.shoelace2` is the TS `ringArea2` (`Σ cr(pᵢ, p₍ᵢ₊₁₎ mod n)`, `Profile.shoelace2_eq_area2`).

* `cr_insert`, `chain_insert`, `insert_on_segment` — cutting a boundary segment `a b` at a point of its line
  (`onSeg a b s`, an edge cut in a planar face) keeps the polygon's area.
* `chord_split_area` — a polygon `p0 … pk …` split by a chord **polyline** `c` from `pk` to `p0` (an imprinted
  curve sampled in `(u, v)`) has twice-area equal to the sum of the two parts' twice-areas (the chord's terms
  cancel: `Profile.chain_reverse`); `chord_split_diagonal` is the straight case (`c = []`, Profile's
  `shoelace2_split`).
* `ring_split_area` — a closed imprint ring: the face's area with the ring as a hole plus the disc's area is the
  face's area (`area(outer) + area(reversed ring) + area(ring) = area(outer)`).

## (d) Edge parameter partition — `split.ts`

`splitIntervals t0 t1 cs = (t0 :: cs).zip (cs ++ [t1])` is the TS `splitIntervals` (starts `[t0, ...cuts]`,
ends `[...cuts, t1]`, zipped). `Increasing t0 cs t1` is the TS precondition (cuts increase strictly inside).

* `splitIntervals_length` — `cuts + 1` pieces; `split_one` — one cut `s`: `[(t0, s), (s, t1)]`.
* `splitIntervals_head`, `splitIntervals_last` — the first piece starts at `t0`, the last ends at `t1`.
* `splitIntervals_linked` — consecutive pieces share their end points (the sub-edges share the cut vertex).
* `splitIntervals_increasing` — every piece is increasing (`a < b`: each sub-edge interval is valid).
* `splitIntervals_sum` — the piece lengths add up to `t1 - t0`; `splitIntervals_cover` — every parameter of
  `[t0, t1]` lies in a piece (with `splitIntervals_increasing`: a partition of the interval).

Not covered: floating point; the geometry of the arrangement (angles at nodes, the successor walk, hole
assignment by a probe point), the curve intersections that produce the pieces, pcurve location and fitting,
tolerances (one vertex per `zoneTol3d`), and the claim that the TS walk finds exactly the sub-faces of a planar
graph (it is checked at run time against `run_f` / `run_l`, and the result body by `validateBrepGeometry`).
-/
namespace CadloomFormal
namespace Imprint

open Tess (P cr chain area2)

/-! ## (a), (c) Counting model -/

/-- The TS `ImprintOp`. -/
inductive Op
  | splitEdge
  | spur
  | freeEdge
  | chord
  | bridge
  | ring
  deriving DecidableEq, Repr

/-- Counts `(V, E, F, L)`. -/
structure Counts where
  v : Int
  e : Int
  f : Int
  l : Int
  deriving DecidableEq, Repr

/-- The TS table `IMPRINT_DELTA`. -/
def delta : Op → Counts
  | .splitEdge => ⟨1, 1, 0, 0⟩
  | .spur => ⟨1, 1, 0, 0⟩
  | .freeEdge => ⟨2, 1, 0, 1⟩
  | .chord => ⟨0, 1, 1, 1⟩
  | .bridge => ⟨0, 1, 0, -1⟩
  | .ring => ⟨1, 1, 1, 2⟩

/-- The TS `applyImprintOp`. -/
def apply (c : Counts) (o : Op) : Counts :=
  ⟨c.v + (delta o).v, c.e + (delta o).e, c.f + (delta o).f, c.l + (delta o).l⟩

/-- The TS `applyImprintOps` (a left fold). -/
def run (c : Counts) (ops : List Op) : Counts := ops.foldl apply c

/-- The TS `imprintChi`: `V - E + 2F - L`. -/
def chi (c : Counts) : Int := c.v - c.e + 2 * c.f - c.l

theorem chi_apply (c : Counts) (o : Op) : chi (apply c o) = chi c := by
  cases o <;> simp [chi, apply, delta] <;> omega

theorem chi_run (ops : List Op) : ∀ c : Counts, chi (run c ops) = chi c := by
  induction ops with
  | nil => intro c; rfl
  | cons o os ih => intro c; simp only [run, List.foldl_cons] at ih ⊢; rw [ih, chi_apply]

theorem chi_eq_euler (c : Counts) : chi c = c.v - c.e + c.f - (c.l - c.f) := by
  simp [chi]; omega

/-- Imprinting never changes the genus (`Topology.genus`, the M0 `eulerPoincare` formula). -/
theorem genus_run (c : Counts) (ops : List Op) (s : Int) :
    Topology.genus (run c ops).v (run c ops).e (run c ops).f (run c ops).l s = Topology.genus c.v c.e c.f c.l s := by
  have h := chi_run ops c
  simp only [chi] at h
  simp only [Topology.genus]
  have : (run c ops).v - (run c ops).e + (run c ops).f - ((run c ops).l - (run c ops).f) =
      c.v - c.e + c.f - (c.l - c.f) := by omega
  rw [this]

theorem chord_counts (c : Counts) : apply c .chord = ⟨c.v, c.e + 1, c.f + 1, c.l + 1⟩ := by
  simp [apply, delta]

theorem chord_new_vertices (c : Counts) :
    run c [.splitEdge, .splitEdge, .chord] = ⟨c.v + 2, c.e + 3, c.f + 1, c.l + 1⟩ := by
  simp [run, apply, delta]; omega

theorem ring_counts (c : Counts) :
    run c [.ring] = ⟨c.v + 1, c.e + 1, c.f + 1, c.l + 2⟩ ∧ chi (run c [.ring]) = chi c := by
  refine ⟨by simp [run, apply, delta], chi_run _ _⟩

theorem run_f (ops : List Op) : ∀ c : Counts,
    (run c ops).f = c.f + (ops.count .chord : Int) + (ops.count .ring : Int) := by
  induction ops with
  | nil => intro c; simp [run]
  | cons o os ih =>
    intro c
    simp only [run, List.foldl_cons] at ih ⊢
    rw [ih]
    cases o <;> simp [apply, delta] <;> omega

theorem run_l (ops : List Op) : ∀ c : Counts,
    (run c ops).l = c.l + (ops.count .chord : Int) + (ops.count .freeEdge : Int) + 2 * (ops.count .ring : Int)
      - (ops.count .bridge : Int) := by
  induction ops with
  | nil => intro c; simp [run]
  | cons o os ih =>
    intro c
    simp only [run, List.foldl_cons] at ih ⊢
    rw [ih]
    cases o <;> simp [apply, delta] <;> omega

/-- Box `[0,2]³` imprinted by box `[1,3]³`: the TS log on the box `(8, 12, 6, 6)`. -/
theorem box_box_log :
    run ⟨8, 12, 6, 6⟩ [.splitEdge, .splitEdge, .splitEdge, .spur, .chord, .spur, .chord, .spur, .chord] =
      ⟨14, 21, 9, 9⟩ := by decide

/-- Box `[0,2]³` cut through by a slab face: four edge cuts and four chords. -/
theorem slab_log :
    run ⟨8, 12, 6, 6⟩ [.splitEdge, .splitEdge, .splitEdge, .splitEdge, .chord, .chord, .chord, .chord] =
      ⟨12, 20, 10, 10⟩ := by decide

/-- A sphere `(V, E, F, L) = (2, 1, 1, 1)` cut at its equator: the seam is cut, the equator is a chord. -/
theorem sphere_equator_log : run ⟨2, 1, 1, 1⟩ [.splitEdge, .chord] = ⟨3, 3, 2, 2⟩ := by decide

/-! ## (b) Shoelace additivity -/

/-- The point at fraction `s` of the segment `a b`. -/
def onSeg (a b : P) (s : Rat) : P := (a.1 + s * (b.1 - a.1), a.2 + s * (b.2 - a.2))

theorem cr_insert (a b : P) (s : Rat) : cr a (onSeg a b s) + cr (onSeg a b s) b = cr a b := by
  simp only [cr, onSeg]; grind

theorem chain_insert (l1 l2 : List P) (a b : P) (s : Rat) :
    chain (l1 ++ a :: onSeg a b s :: b :: l2) = chain (l1 ++ a :: b :: l2) := by
  have h1 := Tess.chain_split l1 a (onSeg a b s :: b :: l2)
  have h2 := Tess.chain_split l1 a (b :: l2)
  rw [h1, h2]
  simp only [chain]
  have := cr_insert a b s
  grind

/-- Cutting the side `a b` of a polygon at a point of its line keeps the area (an edge cut). -/
theorem insert_on_segment (x a b : P) (l1 l2 : List P) (s : Rat) :
    Profile.shoelace2 (x :: (l1 ++ a :: onSeg a b s :: b :: l2)) = Profile.shoelace2 (x :: (l1 ++ a :: b :: l2)) := by
  rw [Profile.shoelace2_eq_area2, Profile.shoelace2_eq_area2]
  simp only [area2]
  have e1 : x :: (l1 ++ a :: onSeg a b s :: b :: l2) ++ [x] = (x :: l1) ++ a :: onSeg a b s :: b :: (l2 ++ [x]) := by simp
  have e2 : x :: (l1 ++ a :: b :: l2) ++ [x] = (x :: l1) ++ a :: b :: (l2 ++ [x]) := by simp
  rw [e1, e2, chain_insert]

/--
A polygon `p0 :: l1 ++ pk :: l2` split by the chord polyline `pk → c → p0`: twice its area is the sum of the
two parts' (`p0 … pk` then back along the chord, and `pk … p0` then forward along the reversed chord).
-/
theorem chord_split_area (p0 pk : P) (l1 l2 c : List P) :
    Profile.shoelace2 (p0 :: (l1 ++ pk :: l2)) =
      Profile.shoelace2 (p0 :: (l1 ++ pk :: c)) + Profile.shoelace2 (pk :: (l2 ++ p0 :: c.reverse)) := by
  rw [Profile.shoelace2_eq_area2, Profile.shoelace2_eq_area2, Profile.shoelace2_eq_area2]
  simp only [area2]
  have h1 := Tess.chain_split (p0 :: l1) pk (l2 ++ [p0])
  have h2 := Tess.chain_split (p0 :: l1) pk (c ++ [p0])
  have h3 := Tess.chain_split (pk :: l2) p0 (c.reverse ++ [pk])
  have hr : chain (p0 :: (c.reverse ++ [pk])) = -chain (pk :: (c ++ [p0])) := by
    have e : p0 :: (c.reverse ++ [pk]) = (pk :: (c ++ [p0])).reverse := by simp
    rw [e, Profile.chain_reverse]
  simp only [List.cons_append, List.append_assoc] at h1 h2 h3 ⊢
  rw [h1, h2, h3, hr]; grind

/-- The straight chord (a diagonal `p0 pk`): Profile's `shoelace2_split` as the `c = []` case. -/
theorem chord_split_diagonal (p0 pk : P) (l1 l2 : List P) :
    Profile.shoelace2 (p0 :: (l1 ++ pk :: l2)) =
      Profile.shoelace2 (p0 :: (l1 ++ [pk])) + Profile.shoelace2 (pk :: (l2 ++ [p0])) := by
  have h := chord_split_area p0 pk l1 l2 []
  simpa using h

/--
A closed imprint ring `r :: rs` inside a face: the fragment with the ring as a hole (traversed backwards) and the
disc (traversed forwards) have areas adding up to the face's area.
-/
theorem ring_split_area (o : List P) (r : P) (rs : List P) :
    (Profile.shoelace2 o + Profile.shoelace2 (r :: rs.reverse)) + Profile.shoelace2 (r :: rs) = Profile.shoelace2 o := by
  rw [Profile.shoelace2_reverse]; grind

/-! ## (d) Edge parameter partition -/

/-- The TS `splitIntervals`. -/
def splitIntervals (t0 t1 : Rat) (cs : List Rat) : List (Rat × Rat) := (t0 :: cs).zip (cs ++ [t1])

/-- The TS precondition: `t0 < c1 < … < ck < t1`. -/
def Increasing : Rat → List Rat → Rat → Prop
  | a, [], b => a < b
  | a, c :: cs, b => a < c ∧ Increasing c cs b

/-- Consecutive pieces share their end points. -/
def Linked : List (Rat × Rat) → Prop
  | x :: y :: r => x.2 = y.1 ∧ Linked (y :: r)
  | _ => True

theorem splitIntervals_nil (t0 t1 : Rat) : splitIntervals t0 t1 [] = [(t0, t1)] := rfl

theorem splitIntervals_cons (t0 t1 c : Rat) (cs : List Rat) :
    splitIntervals t0 t1 (c :: cs) = (t0, c) :: splitIntervals c t1 cs := rfl

theorem split_one (t0 s t1 : Rat) (h0 : t0 < s) (h1 : s < t1) :
    splitIntervals t0 t1 [s] = [(t0, s), (s, t1)] ∧ t0 < s ∧ s < t1 := ⟨rfl, h0, h1⟩

theorem splitIntervals_length (cs : List Rat) : ∀ t0 t1 : Rat, (splitIntervals t0 t1 cs).length = cs.length + 1 := by
  induction cs with
  | nil => intro t0 t1; rfl
  | cons c cs ih => intro t0 t1; rw [splitIntervals_cons, List.length_cons, ih]; simp

theorem splitIntervals_head (cs : List Rat) (t0 t1 : Rat) :
    ∃ b rest, splitIntervals t0 t1 cs = (t0, b) :: rest := by
  cases cs with
  | nil => exact ⟨t1, [], rfl⟩
  | cons c cs => exact ⟨c, _, splitIntervals_cons t0 t1 c cs⟩

theorem splitIntervals_last (cs : List Rat) : ∀ t0 t1 : Rat, ∃ a, (splitIntervals t0 t1 cs).getLast? = some (a, t1) := by
  induction cs with
  | nil => intro t0 t1; exact ⟨t0, rfl⟩
  | cons c cs ih =>
    intro t0 t1
    obtain ⟨a, ha⟩ := ih c t1
    refine ⟨a, ?_⟩
    rw [splitIntervals_cons]
    obtain ⟨b, rest, hr⟩ := splitIntervals_head cs c t1
    rw [hr] at ha ⊢
    rw [List.getLast?_cons_cons]; exact ha

theorem splitIntervals_linked (cs : List Rat) : ∀ t0 t1 : Rat, Linked (splitIntervals t0 t1 cs) := by
  induction cs with
  | nil => intro t0 t1; simp [splitIntervals_nil, Linked]
  | cons c cs ih =>
    intro t0 t1
    rw [splitIntervals_cons]
    obtain ⟨b, rest, hr⟩ := splitIntervals_head cs c t1
    have hl := ih c t1
    rw [hr] at hl ⊢
    exact ⟨rfl, hl⟩

theorem splitIntervals_increasing (cs : List Rat) :
    ∀ t0 t1 : Rat, Increasing t0 cs t1 → ∀ iv ∈ splitIntervals t0 t1 cs, iv.1 < iv.2 := by
  induction cs with
  | nil => intro t0 t1 h iv hm; simp [splitIntervals_nil] at hm; subst hm; exact h
  | cons c cs ih =>
    intro t0 t1 h iv hm
    rw [splitIntervals_cons, List.mem_cons] at hm
    rcases hm with hm | hm
    · subst hm; exact h.1
    · exact ih c t1 h.2 iv hm

theorem splitIntervals_sum (cs : List Rat) :
    ∀ t0 t1 : Rat, ((splitIntervals t0 t1 cs).map (fun iv => iv.2 - iv.1)).sum = t1 - t0 := by
  induction cs with
  | nil => intro t0 t1; simp [splitIntervals_nil]; grind
  | cons c cs ih =>
    intro t0 t1
    rw [splitIntervals_cons, List.map_cons, List.sum_cons, ih c t1]; grind

theorem increasing_lt (cs : List Rat) : ∀ t0 t1 : Rat, Increasing t0 cs t1 → t0 < t1 := by
  induction cs with
  | nil => intro t0 t1 h; exact h
  | cons c cs ih => intro t0 t1 h; have := ih c t1 h.2; have := h.1; grind

theorem splitIntervals_cover (cs : List Rat) :
    ∀ t0 t1 x : Rat, t0 ≤ x → x ≤ t1 → ∃ iv ∈ splitIntervals t0 t1 cs, iv.1 ≤ x ∧ x ≤ iv.2 := by
  induction cs with
  | nil => intro t0 t1 x h0 h1; exact ⟨(t0, t1), by simp [splitIntervals_nil], h0, h1⟩
  | cons c cs ih =>
    intro t0 t1 x h0 h1
    by_cases hx : x ≤ c
    · exact ⟨(t0, c), by simp [splitIntervals_cons], h0, hx⟩
    · obtain ⟨iv, hm, hiv⟩ := ih c t1 x (by grind) h1
      exact ⟨iv, by rw [splitIntervals_cons]; exact List.mem_cons_of_mem _ hm, hiv⟩

end Imprint
end CadloomFormal
