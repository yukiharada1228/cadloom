import CadloomFormal.Tess

/-!
# Profile: Green areas of planar profile wires

Exact rational model of the area terms of `src/profile/area.ts` and the polygon wires of `src/profile/build.ts`.
Points are `Tess.P = Rat × Rat` (the profile plane's 2D coordinates); `Tess.cr p q = p.x q.y - q.x p.y` is one
shoelace term, `Tess.chain` the shoelace sum along an open polyline and `Tess.area2` twice the signed area of a
closed ring (the formulas the M2 mesher uses, reused here: one job, one place).

* `Seg` is a line segment `(start, end)` and `lineTerm2 s = cr s.1 s.2` is twice its Green term, the TS
  `lineTerm2(p, q)` (`segmentGreen` returns half of it as `area`).
* `greenSum` sums `lineTerm2` over a segment list in order: `2 · wireArea` of a wire of lines.
* `polySegs ps = ps.zip (rot1 ps)` are the segments of `polygonWire(ps)`: segment `i` runs from `ps[i]` to
  `ps[(i + 1) mod n]` (`polySegs_getElem`), the TS indexing; `shoelace2 ps = greenSum (polySegs ps)`.
* `revSegs` is `reverseWire` on lines: segments in reverse order, each with its ends swapped.
* `arcTerm2 cx cy r θ c0 s0 c1 s1` is the TS `arcTerm2(cx, cy, r, t0, t1)` with the trigonometric values as
  variables: `θ` stands for `t1 - t0`, `(c_k, s_k)` for `(cos t_k, sin t_k)`, so the end points are
  `arcEnd = (cx + r c_k, cy + r s_k)` and the term is `r² θ + cx (y1 - y0) - cy (x1 - x0)`. No real numbers, `π` or
  trigonometry are used: the theorems below are polynomial identities in these variables, valid for every value
  (in particular for points on the circle, `c² + s² = 1`), with `θ` a symbolic placeholder.

Theorems:
* `zip_telescope` — general lemma on cyclic lists: if `g a b = k · cr a b + f b - f a`, summing `g` over the
  consecutive pairs of `x :: xs ++ [y]` gives `k · chain (x :: xs ++ [y]) + f y - f x` (so `f` cancels on a
  closed ring).
* `greenSum_zip`, `shoelace2_eq_area2` — the TS segment sum equals the ring shoelace `Tess.area2`.
* `polySegs_length`, `polySegs_getElem` — `n` segments, segment `i` is `(ps[i], ps[(i+1) % n])`.
* `shoelace2_translate` — translation invariance of the polygon area.
* `greenSum_revSegs`, `shoelace2_reverse` — reversing a wire (as `reverseWire` does, or reading the ring
  backwards from its first vertex) negates the area.
* `shoelace2_split` — splitting a polygon along the diagonal `p0 pk` adds the two areas.
* `shoelace2_rotN` — the area does not depend on which vertex the wire starts at.
* `arcTerm2_chord_segment` — the arc term is the chord's shoelace term plus twice the circular segment
  `r² (θ - sin θ)` written with `sin θ = c0 s1 - s0 c1`; `arc_triangle` — that `r² (c0 s1 - s0 c1)` is twice the
  signed area of the triangle (center, start, end); `sin_cos_diff` — on the unit circle
  `(c0 s1 - s0 c1)² + (c0 c1 + s0 s1)² = 1` (the placeholders are the sine and cosine of the sweep).
* `arcTerm2_sector` — about the origin the arc term is the sector `r² θ`; `arcTerm2_full` — a full circle
  (`(c1, s1) = (c0, s0)`) gives `r² θ` whatever the center.
* `arcTerm2_add` — consecutive arcs (sweeps `θa`, `θb`) add to the arc of sweep `θa + θb`.
* `arcTerm2_reverse` — the reversed arc (`reverseSegment`) has the negated term.
* `arcTerm2_translate` — moving the arc by `d` changes its term exactly like a line's,
  `+ cr p0 d - cr p1 d`, so wires mixing lines and arcs are translation invariant too (by `zip_telescope`).

Not covered: floating point, the trigonometric evaluation itself (`cos`, `sin` and the angle difference `θ`), the
moments (centroid) and the Gauss–Legendre quadrature of NURBS segments, and the validation of `createProfile`
(closure, contacts, nesting, orientation) — those are tested in `tests/profile.test.ts`.
-/
namespace CadloomFormal
namespace Profile

open Tess (P cr chain area2 rot1 rotN triArea2)

/-- A line segment `(start, end)`. -/
abbrev Seg := P × P

/-- Twice the Green term of a line segment: `lineTerm2(p, q) = p × q`. -/
def lineTerm2 (s : Seg) : Rat := cr s.1 s.2

/-- Twice the area of a wire of lines: the sum of its segments' terms, in order. -/
def greenSum (ss : List Seg) : Rat := (ss.map lineTerm2).sum

/-- The segments of `polygonWire(ps)`: `ps[i] → ps[(i + 1) mod n]`. -/
def polySegs (ps : List P) : List Seg := ps.zip (rot1 ps)

/-- Twice the signed area of the polygon wire through `ps`. -/
def shoelace2 (ps : List P) : Rat := greenSum (polySegs ps)

theorem greenSum_cons (s : Seg) (ss : List Seg) : greenSum (s :: ss) = lineTerm2 s + greenSum ss := by
  simp [greenSum]

/-- `(a ++ b).sum = a.sum + b.sum` over `Rat` (core has only the `Nat` version). -/
theorem rsum_append (a b : List Rat) : (a ++ b).sum = a.sum + b.sum := by
  induction a with
  | nil => simp only [List.nil_append, List.sum_nil]; grind
  | cons x t ih => simp only [List.cons_append, List.sum_cons, ih]; grind

theorem cr_anti (a b : P) : cr b a = -cr a b := by simp only [cr]; grind

/-- Telescoping over the consecutive pairs of `x :: xs ++ [y]`. -/
theorem zip_telescope (g : P → P → Rat) (f : P → Rat) (k : Rat)
    (hg : ∀ a b, g a b = k * cr a b + f b - f a) :
    ∀ (xs : List P) (x y : P),
      (((x :: xs).zip (xs ++ [y])).map (fun s => g s.1 s.2)).sum = k * chain (x :: (xs ++ [y])) + f y - f x := by
  intro xs
  induction xs with
  | nil => intro x y; simp [chain, hg]; grind
  | cons a t ih =>
    intro x y
    have hz : (x :: a :: t).zip (a :: t ++ [y]) = (x, a) :: (a :: t).zip (t ++ [y]) := by simp
    rw [hz, List.map_cons, List.sum_cons, ih a y, hg]
    simp only [List.cons_append, chain]
    grind

theorem greenSum_zip (xs : List P) (x y : P) :
    greenSum ((x :: xs).zip (xs ++ [y])) = chain (x :: (xs ++ [y])) := by
  have h := zip_telescope (fun a b => cr a b) (fun _ => 0) 1 (by intro a b; grind) xs x y
  have e : lineTerm2 = fun s : Seg => cr s.1 s.2 := by funext s; rfl
  unfold greenSum
  rw [e, h]; grind

theorem shoelace2_eq_area2 (ps : List P) : shoelace2 ps = area2 ps := by
  cases ps with
  | nil => simp [shoelace2, polySegs, greenSum, rot1, area2]
  | cons x xs =>
    simp only [shoelace2, polySegs, rot1, area2]
    exact greenSum_zip xs x x

theorem polySegs_length (ps : List P) : (polySegs ps).length = ps.length := by
  cases ps <;> simp [polySegs, rot1]

/-- Segment `i` of `polygonWire(ps)` runs from `ps[i]` to `ps[(i + 1) % n]` (the TS indexing). -/
theorem polySegs_getElem (ps : List P) (i : Nat) (hi : i < ps.length) :
    (polySegs ps)[i]'(by rw [polySegs_length]; exact hi) =
      (ps[i], ps[(i + 1) % ps.length]'(Nat.mod_lt _ (by omega))) := by
  cases ps with
  | nil => simp at hi
  | cons x xs =>
    simp only [polySegs, rot1, List.getElem_zip, Prod.mk.injEq, true_and]
    simp only [List.length_cons] at hi ⊢
    by_cases h : i + 1 < xs.length + 1
    · have hm : (i + 1) % (xs.length + 1) = i + 1 := Nat.mod_eq_of_lt h
      simp [hm, List.getElem_append_left (show i < xs.length by omega)]
    · have hi' : i = xs.length := by omega
      subst hi'
      simp

/-! ## Translation -/

/-- `p + d`. -/
def tr (d : P) (p : P) : P := (p.1 + d.1, p.2 + d.2)

theorem shoelace2_translate (d : P) (ps : List P) : shoelace2 (ps.map (tr d)) = shoelace2 ps := by
  cases ps with
  | nil => rfl
  | cons x xs =>
    simp only [shoelace2, polySegs, rot1, List.map_cons]
    have hz : (tr d x :: xs.map (tr d)).zip (xs.map (tr d) ++ [tr d x]) =
        ((x :: xs).zip (xs ++ [x])).map (fun s => (tr d s.1, tr d s.2)) := by
      rw [show xs.map (tr d) ++ [tr d x] = (xs ++ [x]).map (tr d) by simp,
        show tr d x :: xs.map (tr d) = (x :: xs).map (tr d) by simp, List.zip_map]
      rfl
    rw [hz]
    have h1 := zip_telescope (fun a b => cr (tr d a) (tr d b)) (fun p => -cr p d) 1
      (by intro a b; simp only [cr, tr]; grind) xs x x
    have h2 := greenSum_zip xs x x
    simp only [greenSum, List.map_map] at h1 h2 ⊢
    simp only [Function.comp_def, lineTerm2] at h1 h2 ⊢
    rw [h1, h2]; grind

/-! ## Reversal -/

/-- `reverseWire` on lines: reverse the order and swap each segment's ends. -/
def revSegs (ss : List Seg) : List Seg := (ss.map Prod.swap).reverse

theorem greenSum_revSegs (ss : List Seg) : greenSum (revSegs ss) = -greenSum ss := by
  induction ss with
  | nil => (simp [revSegs, greenSum]) <;> grind
  | cons s t ih =>
    simp only [revSegs, List.map_cons, List.reverse_cons] at ih ⊢
    simp only [greenSum, List.map_append, rsum_append, List.map_cons, List.map_nil, List.sum_cons,
      List.sum_nil] at ih ⊢
    rw [ih]
    simp only [lineTerm2, Prod.fst_swap, Prod.snd_swap, cr]
    grind

theorem chain_reverse (l : List P) : chain l.reverse = -chain l := by
  induction l with
  | nil => (simp [chain]) <;> grind
  | cons a t ih =>
    cases t with
    | nil => (simp [chain]) <;> grind
    | cons b t' =>
      have e : (a :: b :: t').reverse = t'.reverse ++ [b, a] := by simp
      have e' : (b :: t').reverse = t'.reverse ++ [b] := by simp
      rw [e, Tess.chain_snoc2, ← e', ih]
      simp only [chain]
      rw [cr_anti]; grind

/-- Reading the polygon backwards from its first vertex negates its area. -/
theorem shoelace2_reverse (x : P) (xs : List P) : shoelace2 (x :: xs.reverse) = -shoelace2 (x :: xs) := by
  rw [shoelace2_eq_area2, shoelace2_eq_area2]
  simp only [area2, List.cons_append]
  have e : x :: (xs.reverse ++ [x]) = (x :: (xs ++ [x])).reverse := by simp
  rw [e, chain_reverse]

/-! ## Diagonal split and rotation -/

/-- Splitting the polygon `p0 … pk …` along the diagonal `p0 pk` adds the areas of the two parts. -/
theorem shoelace2_split (p0 pk : P) (l1 l2 : List P) :
    shoelace2 (p0 :: (l1 ++ pk :: l2)) = shoelace2 (p0 :: (l1 ++ [pk])) + shoelace2 (pk :: (l2 ++ [p0])) := by
  rw [shoelace2_eq_area2, shoelace2_eq_area2, shoelace2_eq_area2]
  simp only [area2, List.cons_append, List.append_assoc, List.nil_append]
  have h1 := Tess.chain_split (p0 :: l1) pk (l2 ++ [p0])
  have h2 := Tess.chain_split (p0 :: l1) pk [p0]
  have h3 := Tess.chain_split (pk :: l2) p0 [pk]
  simp only [List.cons_append] at h1 h2 h3
  rw [h1, h2, h3]
  simp only [chain]
  rw [cr_anti pk p0]; grind

theorem shoelace2_rotN (k : Nat) (ps : List P) : shoelace2 (rotN k ps) = shoelace2 ps := by
  rw [shoelace2_eq_area2, shoelace2_eq_area2, Tess.area2_rotN]

/-! ## Arc terms -/

/-- The point at `(c, s)` of the circle of radius `r` about `(cx, cy)`. -/
def arcEnd (cx cy r c s : Rat) : P := (cx + r * c, cy + r * s)

/-- Twice the Green term of an arc, `arcTerm2` of `area.ts`, with `θ = t1 - t0` and `(c_k, s_k) = (cos t_k, sin t_k)`. -/
def arcTerm2 (cx cy r θ c0 s0 c1 s1 : Rat) : Rat :=
  r * r * θ + cx * ((arcEnd cx cy r c1 s1).2 - (arcEnd cx cy r c0 s0).2)
    - cy * ((arcEnd cx cy r c1 s1).1 - (arcEnd cx cy r c0 s0).1)

/-- Chord plus circular segment: `arcTerm2 = cr p0 p1 + r² (θ - (c0 s1 - s0 c1))`. -/
theorem arcTerm2_chord_segment (cx cy r θ c0 s0 c1 s1 : Rat) :
    arcTerm2 cx cy r θ c0 s0 c1 s1 =
      lineTerm2 (arcEnd cx cy r c0 s0, arcEnd cx cy r c1 s1) + r * r * (θ - (c0 * s1 - s0 * c1)) := by
  simp only [arcTerm2, lineTerm2, arcEnd, cr]; grind

/-- `r² (c0 s1 - s0 c1)` is twice the signed area of the triangle (center, start, end). -/
theorem arc_triangle (cx cy r c0 s0 c1 s1 : Rat) :
    r * r * (c0 * s1 - s0 * c1) = triArea2 ((cx, cy), arcEnd cx cy r c0 s0, arcEnd cx cy r c1 s1) := by
  simp only [triArea2, arcEnd, cr]; grind

/-- On the unit circle the placeholders `c0 s1 - s0 c1` and `c0 c1 + s0 s1` are a sine and cosine pair. -/
theorem sin_cos_diff (c0 s0 c1 s1 : Rat) (h0 : c0 * c0 + s0 * s0 = 1) (h1 : c1 * c1 + s1 * s1 = 1) :
    (c0 * s1 - s0 * c1) * (c0 * s1 - s0 * c1) + (c0 * c1 + s0 * s1) * (c0 * c1 + s0 * s1) = 1 := by
  have : (c0 * s1 - s0 * c1) * (c0 * s1 - s0 * c1) + (c0 * c1 + s0 * s1) * (c0 * c1 + s0 * s1) =
      (c0 * c0 + s0 * s0) * (c1 * c1 + s1 * s1) := by grind
  rw [this, h0, h1]; grind

/-- About the origin the arc term is the sector `r² θ`. -/
theorem arcTerm2_sector (r θ c0 s0 c1 s1 : Rat) : arcTerm2 0 0 r θ c0 s0 c1 s1 = r * r * θ := by
  simp only [arcTerm2, arcEnd]; grind

/-- A full circle (end = start) contributes `r² θ` whatever its center. -/
theorem arcTerm2_full (cx cy r θ c s : Rat) : arcTerm2 cx cy r θ c s c s = r * r * θ := by
  simp only [arcTerm2, arcEnd]; grind

/-- Consecutive arcs of one circle add. -/
theorem arcTerm2_add (cx cy r θa θb c0 s0 c1 s1 c2 s2 : Rat) :
    arcTerm2 cx cy r θa c0 s0 c1 s1 + arcTerm2 cx cy r θb c1 s1 c2 s2 = arcTerm2 cx cy r (θa + θb) c0 s0 c2 s2 := by
  simp only [arcTerm2, arcEnd]; grind

/-- The reversed arc has the negated term. -/
theorem arcTerm2_reverse (cx cy r θ c0 s0 c1 s1 : Rat) :
    arcTerm2 cx cy r (-θ) c1 s1 c0 s0 = -arcTerm2 cx cy r θ c0 s0 c1 s1 := by
  simp only [arcTerm2, arcEnd]; grind

/-- Translating an arc by `d` changes its term by `cr p0 d - cr p1 d`, exactly as for its chord. -/
theorem arcTerm2_translate (d : P) (cx cy r θ c0 s0 c1 s1 : Rat) :
    arcTerm2 (cx + d.1) (cy + d.2) r θ c0 s0 c1 s1 =
      arcTerm2 cx cy r θ c0 s0 c1 s1 + cr (arcEnd cx cy r c0 s0) d - cr (arcEnd cx cy r c1 s1) d := by
  simp only [arcTerm2, arcEnd, cr]; grind

theorem lineTerm2_translate (d a b : P) : lineTerm2 (tr d a, tr d b) = lineTerm2 (a, b) + cr a d - cr b d := by
  simp only [lineTerm2, tr, cr]; grind

end Profile
end CadloomFormal
