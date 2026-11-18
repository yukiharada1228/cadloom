/-!
# Tess: ear clipping, shoelace areas, watertight unions and circle sampling

Exact model of the display mesher `src/tess/` (M2). Points are `Rat × Rat` (the TypeScript works on doubles
in its scaled `(u, v)` work plane); vertices of the combinatorial statements are arbitrary types or `Nat`
(the welded vertex ids of `src/tess/check.ts`).

## Ear clipping (`src/tess/triangulate.ts`, `earClip`)

The TypeScript polygon is a ring (a doubly linked cycle of vertex ids without a distinguished start). The
model represents the ring by a list read from any start; `rotN k` re-reads it from the `k`-th vertex, which is
the same ring. One clipping step at the ring node `b` with neighbours `a`, `c` is: rotate so that the ring reads
`a :: b :: c :: rest`, emit the triangle `(a, b, c)` — exactly the `[prev, cur, next]` triple the TypeScript
emits — and continue with the ring `a :: c :: rest` (the node unlinked). `pick` stands for the TypeScript ear
search, whatever node it chooses: every theorem holds for every choice function. The TypeScript emits the last
triangle by the same step when three nodes remain.

* `earClip_length` — a ring of `n + 3` vertices clips into exactly `n + 1` triangles (`n - 2` for `n ≥ 3`).
* `rotN_length` — re-reading a ring from another vertex keeps its length (lemma).
* `area2_rot1`, `area2_rotN` — the shoelace sum `area2` does not depend on where the ring is read from.
* `area2_clip` — removing the ear `(a, b, c)` changes twice the polygon area by exactly twice the ear's
  signed area: `area2 (a :: b :: c :: rest) = triArea2 (a, b, c) + area2 (a :: c :: rest)`.
* `earClip_area` — for every choice of ears, the triangles' signed areas sum to the shoelace area of the
  polygon (`sumArea (earClip pick fuel l) = area2 l`).
* `fan_eq_earClip`, `fan_area` — the fan `(p0, p_i, p_{i+1})` (M0 `fanTriangles`) is the ear clipping that
  always clips the second vertex, so it preserves the shoelace area too.
* `bridge_length`, `bridge_area` — hole bridging (`bridgeHole`): splicing the hole ring `m :: hs` into the
  outer ring `p :: os` by the doubled bridge `p → m … m → p` adds `|hole| + 2` vertices, and its shoelace
  area is the outer area plus the (clockwise, negative) hole area: the two bridge edges cancel.
  With `earClip_length`, a face of `n` boundary vertices and `h` holes gives `n + 2h - 2` triangles.

## Watertightness (`src/tess/check.ts`, `meshEdgeUseCounts`, `isWatertight`)

Triangles are triples of welded vertex ids; `dcount T e` counts the directed edges of the triangle list `T`
equal to `e` — the directed half of `meshEdgeUseCounts` (which reports, per undirected edge, its uses in each
direction). A patch `T` with boundary `B` (a list of directed edges, the face's loop sample edges in loop
order) is balanced: `dcount T e + count B (swap e) = dcount T (swap e) + count B e` for every `e`: inside
the patch each edge is used once each way, on the boundary once along it.

* `triangle_patch` — a single triangle is a patch with its three sides as boundary (the base case).
* `patch_append` — two patches whose boundaries are given side by side form a patch with the concatenated
  boundary (gluing along shared edges is done by the cancellation below).
* `union_balanced` — two patches with boundaries `B` and the reversed sequence `revEdges B` (the shared
  boundary edge samples of two faces, run in opposite directions) have a union in which every edge is used
  as often in each direction.
* `patches_balanced` — the same for any list of faces whose boundaries cancel in total (each edge's samples
  used by its two coedges in opposite directions), which is the B-rep case.
* `watertight_of_balanced` — if moreover no directed edge is used twice, every used undirected edge is used
  exactly twice, once in each direction: the `isWatertight` condition.

## Circle sampling (`src/tess/sample.ts`, `circleStepCount`)

* `chord_ends_on_circle`, `chord_midpoint`, `sagitta_eq_gap` — for a chord spanning the angle `θ` about the
  direction of its middle, with `(c, s) = (cos θ/2, sin θ/2)`, `c² + s² = 1`: its ends `(r c, ± r s)` lie on the
  circle, its midpoint is `(r c, 0)`, and the distance from the midpoint to the circle along the middle
  direction, `r - r c`, is the TypeScript sagitta `r (1 - c)`.
* `sagitta_le_iff` — `sagitta r c ≤ chord ↔ 1 - chord / r ≤ c`: the TypeScript chooses the largest
  `θ/2 = acos(1 - chord / r)`, and any smaller step has a larger cosine, so its sagitta is within `chord`.
* `step_le` — the TypeScript step count `n = ceil(sweep / θ)` satisfies `sweep / θ ≤ n`, hence (for `θ > 0`,
  `n > 0`) the actual step `sweep / n ≤ θ`.
* `steps_reach_end` — `n` steps of `sweep / n` from `t0` end exactly at `t0 + sweep`.

Lemmas (no TypeScript counterpart of their own): `rot1_length`, `earClip_short`, `chain_split`,
`chain_snoc2`, `area2_short`, `dcount_append`, `ecount_append`, `ecount_rev`, `swap_swap`, `allPatch`.

Not covered: IEEE rounding (the TypeScript decides orientation with the exact M0 `orient2d` and the exact
`incircle`, but computes `(u, v)` and the work-plane scaling in floating point); that the TypeScript ear search
finds an ear (it may report a face failure instead), the geometric validity of the triangles (non-overlap), the
Lawson flips (they preserve the count and the boundary edges, tested only), the grid points of curved faces,
`acos`/`cos` themselves, ellipse and NURBS sampling, and the weld by exact position equality.
-/
namespace CadloomFormal
namespace Tess

/-! ## Rings and ear clipping -/

/-- Re-read a ring from its second vertex. -/
def rot1 {α : Type} : List α → List α
  | [] => []
  | x :: xs => xs ++ [x]

/-- Re-read a ring from its `k`-th vertex. -/
def rotN {α : Type} : Nat → List α → List α
  | 0, l => l
  | k + 1, l => rotN k (rot1 l)

theorem rot1_length {α : Type} (l : List α) : (rot1 l).length = l.length := by
  cases l <;> simp [rot1]

theorem rotN_length {α : Type} (k : Nat) (l : List α) : (rotN k l).length = l.length := by
  induction k generalizing l with
  | zero => rfl
  | succ k ih => simp [rotN, ih, rot1_length]

/--
Ear clipping of a ring: the TypeScript loop. Each step re-reads the ring at the chosen node's predecessor
(`pick`), emits `(prev, cur, next)` and unlinks `cur`. `fuel` bounds the steps (the ring length suffices).
-/
def earClip {α : Type} (pick : List α → Nat) : Nat → List α → List (α × α × α)
  | 0, _ => []
  | fuel + 1, l =>
    match rotN (pick l) l with
    | a :: b :: c :: rest => (a, b, c) :: earClip pick fuel (a :: c :: rest)
    | _ => []

theorem earClip_short {α : Type} (pick : List α → Nat) (f : Nat) (l : List α) (h : l.length ≤ 2) :
    earClip pick f l = [] := by
  cases f with
  | zero => rfl
  | succ f =>
    simp only [earClip]
    split
    · rename_i a b c rest heq
      have hr := rotN_length (pick l) l
      rw [heq] at hr; simp at hr; omega
    · rfl

theorem earClip_length {α : Type} (pick : List α → Nat) :
    ∀ (n fuel : Nat) (l : List α), l.length = n + 3 → n + 1 ≤ fuel →
      (earClip pick fuel l).length = n + 1 := by
  intro n
  induction n with
  | zero =>
    intro fuel l hl hf
    obtain ⟨f, rfl⟩ : ∃ f, fuel = f + 1 := ⟨fuel - 1, by omega⟩
    have hr := rotN_length (pick l) l
    simp only [earClip]
    split
    · rename_i a b c rest heq
      rw [heq] at hr
      simp at hr
      have : rest = [] := by
        cases rest with
        | nil => rfl
        | cons _ _ => simp at hr; omega
      subst this
      simp [earClip_short pick f [a, c] (by simp)]
    · rename_i hne
      exfalso
      match h : rotN (pick l) l with
      | a :: b :: c :: rest => exact hne a b c rest h
      | [] => rw [h] at hr; simp at hr; omega
      | [_] => rw [h] at hr; simp at hr; omega
      | [_, _] => rw [h] at hr; simp at hr; omega
  | succ n ih =>
    intro fuel l hl hf
    obtain ⟨f, rfl⟩ : ∃ f, fuel = f + 1 := ⟨fuel - 1, by omega⟩
    have hr := rotN_length (pick l) l
    simp only [earClip]
    split
    · rename_i a b c rest heq
      rw [heq] at hr
      simp at hr
      have := ih f (a :: c :: rest) (by simp; omega) (by omega)
      simp [this]
    · rename_i hne
      exfalso
      match h : rotN (pick l) l with
      | a :: b :: c :: rest => exact hne a b c rest h
      | [] => rw [h] at hr; simp at hr; omega
      | [_] => rw [h] at hr; simp at hr; omega
      | [_, _] => rw [h] at hr; simp at hr; omega

/-! ## Shoelace areas -/

abbrev P := Rat × Rat

/-- `p × q = p.x q.y - q.x p.y`, one shoelace term. -/
def cr (p q : P) : Rat := p.1 * q.2 - q.1 * p.2

/-- Twice the signed area of the triangle `(a, b, c)` (counter-clockwise positive). -/
def triArea2 (t : P × P × P) : Rat := cr t.1 t.2.1 + cr t.2.1 t.2.2 + cr t.2.2 t.1

/-- Shoelace sum along an open polyline. -/
def chain : List P → Rat
  | p :: q :: rest => cr p q + chain (q :: rest)
  | _ => 0

/-- Twice the signed area of the polygon (closed ring): the shoelace sum with the closing side. -/
def area2 : List P → Rat
  | [] => 0
  | p :: rest => chain (p :: rest ++ [p])

/-- Sum of twice the signed areas of a triangle list. -/
def sumArea : List (P × P × P) → Rat
  | [] => 0
  | t :: ts => triArea2 t + sumArea ts

theorem chain_split (l1 : List P) (x : P) (l2 : List P) :
    chain (l1 ++ x :: l2) = chain (l1 ++ [x]) + chain (x :: l2) := by
  induction l1 with
  | nil => simp [chain]; grind
  | cons a t ih =>
    cases t with
    | nil => simp [chain]; grind
    | cons b t' =>
      simp only [List.cons_append] at ih ⊢
      simp only [chain, ih]
      grind

theorem chain_snoc2 (l : List P) (x y : P) : chain (l ++ [x, y]) = chain (l ++ [x]) + cr x y := by
  have := chain_split l x [y]
  simp only [chain] at this
  grind

theorem area2_rot1 (l : List P) : area2 (rot1 l) = area2 l := by
  cases l with
  | nil => rfl
  | cons x xs =>
    cases xs with
    | nil => rfl
    | cons y ys =>
      have h := chain_snoc2 (y :: ys) x y
      have e1 : area2 (rot1 (x :: y :: ys)) = chain ((y :: ys) ++ [x, y]) := by simp [rot1, area2]
      have e2 : area2 (x :: y :: ys) = cr x y + chain ((y :: ys) ++ [x]) := by simp [area2, chain]
      rw [e1, e2, h]; grind

theorem area2_rotN (k : Nat) (l : List P) : area2 (rotN k l) = area2 l := by
  induction k generalizing l with
  | zero => rfl
  | succ k ih => simp only [rotN, ih, area2_rot1]

/-- Removing the ear `(a, b, c)` removes exactly its area. -/
theorem area2_clip (a b c : P) (rest : List P) :
    area2 (a :: b :: c :: rest) = triArea2 (a, b, c) + area2 (a :: c :: rest) := by
  simp only [area2, List.cons_append, chain, triArea2]
  simp only [cr]
  grind

theorem area2_short (l : List P) (h : l.length ≤ 2) : area2 l = 0 := by
  match l, h with
  | [], _ => rfl
  | [a], _ => simp [area2, chain, cr]; grind
  | [a, b], _ => simp [area2, chain, cr]; grind

theorem earClip_area (pick : List P → Nat) :
    ∀ (fuel : Nat) (l : List P), l.length ≤ fuel + 2 → sumArea (earClip pick fuel l) = area2 l := by
  intro fuel
  induction fuel with
  | zero =>
    intro l hl
    simp [earClip, sumArea, area2_short l hl]
  | succ f ih =>
    intro l hl
    have hr := rotN_length (pick l) l
    have harea := area2_rotN (pick l) l
    simp only [earClip]
    split
    · rename_i a b c rest heq
      rw [heq] at hr harea
      simp at hr
      simp only [sumArea, ih (a :: c :: rest) (by simp; omega)]
      rw [← harea, area2_clip]
    · rename_i hne
      simp only [sumArea]
      match h : rotN (pick l) l with
      | a :: b :: c :: rest => exact absurd h (hne a b c rest)
      | [] => rw [h] at hr; exact (area2_short l (by simp at hr; omega)).symm
      | [_] => rw [h] at hr; exact (area2_short l (by simp at hr; omega)).symm
      | [_, _] => rw [h] at hr; exact (area2_short l (by simp at hr; omega)).symm

/-- The fan `(p0, p_i, p_{i+1})` of M0 `fanTriangles`. -/
def fanTris (p0 : P) : List P → List (P × P × P)
  | a :: b :: rest => (p0, a, b) :: fanTris p0 (b :: rest)
  | _ => []

theorem fan_eq_earClip (p0 : P) (l : List P) :
    earClip (fun _ => 0) (l.length) (p0 :: l) = fanTris p0 l := by
  induction l with
  | nil => simp [earClip, fanTris]
  | cons a t ih =>
    cases t with
    | nil => simp [earClip, rotN, fanTris]
    | cons b t' =>
      simp only [List.length_cons] at ih ⊢
      have step : earClip (fun _ => 0) (t'.length + 1 + 1) (p0 :: a :: b :: t') =
          (p0, a, b) :: earClip (fun _ => 0) (t'.length + 1) (p0 :: b :: t') := rfl
      rw [step, ih, fanTris]

theorem fan_area (p0 : P) (l : List P) : sumArea (fanTris p0 l) = area2 (p0 :: l) := by
  rw [← fan_eq_earClip]
  exact earClip_area _ _ _ (by simp)

/-! ## Hole bridging -/

/--
Splice the hole ring `m :: hs` into the outer ring `p :: os` through the bridge `p → m`: read from `p`, the
merged ring is `p, m, hs…, m, p, os…` (both bridge vertices appear twice, as in the TypeScript).
-/
def bridgeHole (p : P) (os : List P) (m : P) (hs : List P) : List P :=
  p :: m :: (hs ++ [m, p] ++ os)

theorem bridge_length (p : P) (os : List P) (m : P) (hs : List P) :
    (bridgeHole p os m hs).length = (p :: os).length + (m :: hs).length + 2 := by
  simp [bridgeHole]; omega

theorem bridge_area (p : P) (os : List P) (m : P) (hs : List P) :
    area2 (bridgeHole p os m hs) = area2 (p :: os) + area2 (m :: hs) := by
  simp only [bridgeHole, area2]
  have h1 : (p :: m :: (hs ++ [m, p] ++ os) ++ [p]) = [p] ++ m :: (hs ++ [m] ++ p :: (os ++ [p])) := by simp
  rw [h1, chain_split [p] m]
  have h2 : m :: (hs ++ [m] ++ p :: (os ++ [p])) = (m :: hs ++ [m]) ++ p :: (os ++ [p]) := by simp
  rw [h2, chain_split (m :: hs ++ [m]) p (os ++ [p])]
  have h3 : (m :: hs ++ [m]) ++ [p] = (m :: hs) ++ [m, p] := by simp
  rw [h3, chain_snoc2]
  simp only [chain, List.cons_append, List.nil_append]
  simp only [cr]
  grind

/-! ## Watertightness -/

abbrev Edge := Nat × Nat
abbrev Tri := Nat × Nat × Nat

def swap (e : Edge) : Edge := (e.2, e.1)

/-- The directed sides of a triangle, in its order. -/
def triEdges (t : Tri) : List Edge := [(t.1, t.2.1), (t.2.1, t.2.2), (t.2.2, t.1)]

/-- Uses of the directed edge `e` by the triangles `T` (the directed half of `meshEdgeUseCounts`). -/
def dcount (T : List Tri) (e : Edge) : Nat := ((T.flatMap triEdges).filter (· == e)).length

/-- Occurrences of `e` in a list of directed edges. -/
def ecount (B : List Edge) (e : Edge) : Nat := (B.filter (· == e)).length

def revEdges (B : List Edge) : List Edge := B.map swap

/-- `T` is a patch with boundary `B`: every edge is used as often each way, up to the boundary. -/
def Patch (T : List Tri) (B : List Edge) : Prop :=
  ∀ e, dcount T e + ecount B (swap e) = dcount T (swap e) + ecount B e

theorem dcount_append (T1 T2 : List Tri) (e : Edge) : dcount (T1 ++ T2) e = dcount T1 e + dcount T2 e := by
  simp [dcount, List.flatMap_append, List.filter_append]

theorem ecount_append (B1 B2 : List Edge) (e : Edge) : ecount (B1 ++ B2) e = ecount B1 e + ecount B2 e := by
  simp [ecount, List.filter_append]

theorem swap_swap (e : Edge) : swap (swap e) = e := by simp [swap]

theorem ecount_rev (B : List Edge) (e : Edge) : ecount (revEdges B) e = ecount B (swap e) := by
  induction B with
  | nil => rfl
  | cons x xs ih =>
    simp only [revEdges, List.map_cons, ecount, List.filter_cons] at ih ⊢
    have : (swap x == e) = (x == swap e) := by
      cases x; cases e; simp only [swap]; rw [Bool.eq_iff_iff]; simp; grind
    rw [this]
    split <;> simp [ih]

theorem triangle_patch (t : Tri) : Patch [t] (triEdges t) := by
  intro e
  simp only [dcount, ecount, List.flatMap_cons, List.flatMap_nil, List.append_nil]
  omega

theorem patch_append (T1 T2 : List Tri) (B1 B2 : List Edge) (h1 : Patch T1 B1) (h2 : Patch T2 B2) :
    Patch (T1 ++ T2) (B1 ++ B2) := by
  intro e
  have a := h1 e
  have b := h2 e
  simp only [dcount_append, ecount_append]
  omega

/-- Two patches glued along the same boundary samples run in opposite directions are balanced. -/
theorem union_balanced (T1 T2 : List Tri) (B : List Edge) (h1 : Patch T1 B) (h2 : Patch T2 (revEdges B)) :
    ∀ e, dcount (T1 ++ T2) e = dcount (T1 ++ T2) (swap e) := by
  intro e
  have a := h1 e
  have b := h2 e
  rw [ecount_rev, ecount_rev, swap_swap] at b
  simp only [dcount_append]
  omega

/-- Faces as (triangles, boundary) pairs. -/
def allTris : List (List Tri × List Edge) → List Tri
  | [] => []
  | f :: fs => f.1 ++ allTris fs

def allBoundary : List (List Tri × List Edge) → List Edge
  | [] => []
  | f :: fs => f.2 ++ allBoundary fs

theorem allPatch (F : List (List Tri × List Edge)) (h : ∀ f ∈ F, Patch f.1 f.2) :
    Patch (allTris F) (allBoundary F) := by
  induction F with
  | nil => intro e; simp [allTris, allBoundary, dcount, ecount]
  | cons f fs ih =>
    exact patch_append _ _ _ _ (h f (by simp)) (ih (fun g hg => h g (by simp [hg])))

/-- Faces whose boundaries cancel in total (each boundary sample edge run once each way) are balanced. -/
theorem patches_balanced (F : List (List Tri × List Edge)) (h : ∀ f ∈ F, Patch f.1 f.2)
    (hb : ∀ e, ecount (allBoundary F) e = ecount (allBoundary F) (swap e)) :
    ∀ e, dcount (allTris F) e = dcount (allTris F) (swap e) := by
  intro e
  have a := allPatch F h e
  have b := hb e
  omega

/-- Balanced and no directed edge used twice: each used edge is used exactly once in each direction. -/
theorem watertight_of_balanced (T : List Tri) (hbal : ∀ e, dcount T e = dcount T (swap e))
    (hle : ∀ e, dcount T e ≤ 1) (e : Edge) (hused : 0 < dcount T e + dcount T (swap e)) :
    dcount T e = 1 ∧ dcount T (swap e) = 1 ∧ dcount T e + dcount T (swap e) = 2 := by
  have a := hbal e
  have b := hle e
  omega

/-! ## Circle sampling -/

/-- The sagitta used by the TypeScript: `r (1 - cos(θ/2))`, with `c` standing for `cos(θ/2)`. -/
def sagitta (r c : Rat) : Rat := r * (1 - c)

theorem chord_ends_on_circle (r c s : Rat) (h : c * c + s * s = 1) :
    (r * c) * (r * c) + (r * s) * (r * s) = r * r ∧ (r * c) * (r * c) + (-(r * s)) * (-(r * s)) = r * r := by
  constructor
  · have : (r * c) * (r * c) + (r * s) * (r * s) = r * r * (c * c + s * s) := by grind
    rw [this, h]; grind
  · have : (r * c) * (r * c) + (-(r * s)) * (-(r * s)) = r * r * (c * c + s * s) := by grind
    rw [this, h]; grind

theorem chord_midpoint (r c s : Rat) : ((r * c + r * c) / 2, (r * s + -(r * s)) / 2) = (r * c, (0 : Rat)) := by
  simp only [Prod.mk.injEq]
  constructor <;> grind

/-- The midpoint `(r c, 0)` lies `r - r c` inside the circle point `(r, 0)` of the middle direction. -/
theorem sagitta_eq_gap (r c : Rat) : r - r * c = sagitta r c := by
  simp only [sagitta]; grind

theorem sagitta_le_iff (r c chord : Rat) (hr : 0 < r) : sagitta r c ≤ chord ↔ 1 - chord / r ≤ c := by
  simp only [sagitta]
  have hinv : 0 < r⁻¹ := Rat.inv_pos.mpr hr
  have hrr : r * r⁻¹ = 1 := Rat.mul_inv_cancel r (by grind)
  rw [Rat.div_def]
  constructor
  · intro h
    have := Rat.mul_le_mul_of_nonneg_left h (Rat.le_of_lt hinv)
    have e : r⁻¹ * (r * (1 - c)) = 1 - c := by
      have : r⁻¹ * (r * (1 - c)) = (r * r⁻¹) * (1 - c) := by grind
      rw [this, hrr]; grind
    rw [e] at this
    grind
  · intro h
    have h' : 1 - c ≤ chord * r⁻¹ := by grind
    have := Rat.mul_le_mul_of_nonneg_left h' (Rat.le_of_lt hr)
    have e : r * (chord * r⁻¹) = chord := by
      have : r * (chord * r⁻¹) = chord * (r * r⁻¹) := by grind
      rw [this, hrr]; grind
    rw [e] at this
    exact this

/-- The step count `n = ceil(sweep / θ)` (any `n ≥ sweep / θ`, `n > 0`) gives steps of at most `θ`. -/
theorem step_le (sweep θ : Rat) (n : Nat) (hθ : 0 < θ) (hn : 0 < n) (hceil : sweep / θ ≤ n) :
    sweep / n ≤ θ := by
  have hn' : (0 : Rat) < n := by exact_mod_cast hn
  have hθθ : θ⁻¹ * θ = 1 := by have := Rat.mul_inv_cancel θ (by grind); grind
  have hnn : (n : Rat) * (n : Rat)⁻¹ = 1 := Rat.mul_inv_cancel _ (by grind)
  rw [Rat.div_def] at hceil ⊢
  -- sweep ≤ n θ
  have h1 : sweep ≤ n * θ := by
    have := Rat.mul_le_mul_of_nonneg_left hceil (Rat.le_of_lt hθ)
    have e : θ * (sweep * θ⁻¹) = sweep := by
      have : θ * (sweep * θ⁻¹) = sweep * (θ⁻¹ * θ) := by grind
      rw [this, hθθ]; grind
    rw [e] at this
    grind
  have hinv : 0 ≤ (n : Rat)⁻¹ := Rat.le_of_lt (Rat.inv_pos.mpr hn')
  have := Rat.mul_le_mul_of_nonneg_left h1 hinv
  have e : (n : Rat)⁻¹ * (n * θ) = θ := by
    have : (n : Rat)⁻¹ * (n * θ) = θ * ((n : Rat) * (n : Rat)⁻¹) := by grind
    rw [this, hnn]; grind
  rw [e] at this
  grind

/-- `n` steps of `sweep / n` from `t0` end at `t0 + sweep`. -/
theorem steps_reach_end (t0 sweep : Rat) (n : Nat) (hn : 0 < n) : t0 + n * (sweep / n) = t0 + sweep := by
  have hn' : (n : Rat) ≠ 0 := by
    have : (0 : Rat) < n := by exact_mod_cast hn
    grind
  have hnn : (n : Rat) * (n : Rat)⁻¹ = 1 := Rat.mul_inv_cancel _ hn'
  rw [Rat.div_def]
  have : (n : Rat) * (sweep * (n : Rat)⁻¹) = sweep * ((n : Rat) * (n : Rat)⁻¹) := by grind
  rw [this, hnn]; grind

end Tess
end CadloomFormal
