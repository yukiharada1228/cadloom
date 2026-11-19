/-!
# Query: crossing parity, ray transitions and box pruning

Exact rational models of the decisions of `src/query` (M4 body queries).

**(a) The half-open crossing rule** (`src/query/crossing.ts`, `edgeCrossing` / `crossingCount`, used by
`pointInFace` on a face's `(u, v)` rings). Points are `P2 = Rat × Rat`; `orient a b c` is the M0 `orient2d`
determinant `(b - a) × (c - a)` (positive counter-clockwise). `crosses q a b` is the TS rule for an edge `(a, b)`
and the `+x` ray from `q`, for `q` not on the edge (the TS returns `on` there): the edge straddles the ray's line
iff `(a.y > q.y) ≠ (b.y > q.y)`, and crosses right of `q` iff `orient a b q > 0` for an upward edge
(`b.y > a.y`), `orient a b q < 0` otherwise. `cnt` is its 0/1 count.
* `orient_at_line_in`, `orient_at_line_out` — with the vertex `v` on the ray's line, `orient a v q` and
  `orient v b q` factor as `(q.y - a.y)(v.x - q.x)` and `(b.y - q.y)(v.x - q.x)`.
* `pass_through_count` — consecutive edges `(a, v)`, `(v, b)` with `v` on the ray right of `q` and `a`, `b`
  strictly on opposite sides count exactly **one** crossing (either direction); `pass_through_left` — `v` left of
  `q`: zero.
* `touch_count_above` / `touch_count_below` / `touch_count_even` — `a`, `b` strictly on the same side: 2 (above, `v`
  right of `q`) or 0 — an even count, so parity is unaffected.
* `horizontal_zero` — an edge on the ray's line never counts; `horizontal_run_pass` — a pass through the line along
  a horizontal run `v → w` (both right of `q`) counts exactly once.
* **(b)** `crosses_symm` — the rule is symmetric in the edge's ends; `crossCount_reverse` — the crossing count of a
  polygon's edge list read backwards (`reverseEdges`: reversed order, each edge swapped, as `[...ring].reverse()`)
  equals the forward count; `inside_reverse` — so the even–odd answer does not depend on loop orientation.
* `ringEdges`, `ringEdges_reverse`, `ringInside_reverse` — the edges `crossingCount` reads from a ring are
  `(ring[i], ring[(i + 1) % n])` (`ringEdges`: the chain of the ring closed back to its first vertex); the ring
  read backwards (`[...ring].reverse()`, so a rotated edge list as well as swapped edges — `chain_reverse`,
  `chain_rotate`) has the same crossing count, so `pointInFace` does not depend on loop orientation.
* `crossCount_append` — counts add over rings (outer loop and holes are counted together).
* `cnt_left_zero` — an edge with both ends strictly left of `q` never counts: the `crossingCount` pre-filter
  (`a.x < q.x && b.x < q.x`, and the non-straddling `a.y, b.y` both above / both below) skips no crossing.

**(c) Ray transitions** (`src/query/classify.ts`, `rayBody`: `transition = n·d < 0 ? entering : leaving` with
the outward normal `n`). `V3` is a rational 3-vector, `g t = n·(o + t d - p0)` the signed distance (times `|n|`) of
the ray point to the face's tangent plane at the hit `p0` (positive on the outward side).
* `g_linear` — `g t = g 0 + t (n·d)`.
* `entering_side` — at a hit `g th = 0` with `n·d < 0`: before the hit (`s < th`) the ray is on the outward side
  (`g s > 0`), after it (`s > th`) on the inner side (`g s < 0`); `leaving_side` — the mirror for `n·d > 0`;
  `transition_entering_iff` — the TS `transition` is `entering` iff `n·d < 0`.

**(d) Box pruning** (`src/query/box.ts`, `axisGap`, `boxDistanceSq`, `canPrune`; used by `closestPointOnBody`).
`gap lo hi x` is the TS `max(lo - x, 0, x - hi)` (`gap_ge_left`, `gap_ge_zero`, `gap_ge_right`, `gap_cases`: it is
the largest of the three), `boxDistSq` the sum of the squared gaps.
* `gap_sq_le` — for `lo ≤ y ≤ hi`, `gap² ≤ (y - x)²`;
* `boxDistSq_le` — every point of the box is at squared distance at least `boxDistSq` from `p`;
* `prune_sound` — if `boxDistSq > best²`, no point of the box is within `best` of `p` (the box cannot improve the
  current best).

Not covered: floating point (the TS decides `orient` exactly with the M0 predicate — the model's `orient` — but
the comparisons on coordinates are on doubles, which are exact rationals, so (a) and (b) apply verbatim; (c) and
(d) are floating in TS, with an `8 ε` allowance in `canPrune`); the `on` detection of the crossing rule; the
geometry of the `(u, v)` rings (sampling, seams, poles), the intersection code supplying ray hits, the 3D
tolerance bands, the retry policy of `classifyPoint` and the face-area quadrature — tested in
`tests/query.test.ts`. The Jordan curve theorem itself (odd parity ⇔ inside) is assumed, not proved.
-/
namespace CadloomFormal
namespace Query

/-- A point of a face's `(u, v)` plane. -/
abbrev P2 := Rat × Rat

/-- The `orient2d` determinant `(b - a) × (c - a)`. -/
def orient (a b c : P2) : Rat := (b.1 - a.1) * (c.2 - a.2) - (b.2 - a.2) * (c.1 - a.1)

/-- The TS half-open crossing rule of edge `(a, b)` against the `+x` ray from `q` (`edgeCrossing(...) === 'cross'`). -/
def crosses (q a b : P2) : Bool :=
  if decide (a.2 > q.2) != decide (b.2 > q.2) then
    (if b.2 > a.2 then decide (orient a b q > 0) else decide (orient a b q < 0))
  else false

/-- The 0/1 count of one edge. -/
def cnt (q a b : P2) : Nat := if crosses q a b then 1 else 0

theorem orient_swap (a b c : P2) : orient b a c = -orient a b c := by
  simp only [orient]; grind

theorem orient_at_line_in (q a v : P2) (hv : v.2 = q.2) : orient a v q = (q.2 - a.2) * (v.1 - q.1) := by
  simp only [orient]; rw [hv]; grind

theorem orient_at_line_out (q v b : P2) (hv : v.2 = q.2) : orient v b q = (b.2 - q.2) * (v.1 - q.1) := by
  simp only [orient]; rw [hv]; grind

private theorem pos_mul {x y : Rat} (hx : 0 < x) (hy : 0 < y) : 0 < x * y := Rat.mul_pos hx hy

private theorem neg_mul_pos {x y : Rat} (hx : x < 0) (hy : 0 < y) : x * y < 0 := by
  have h := Rat.mul_pos (show 0 < -x by grind) hy
  have e : -x * y = -(x * y) := by grind
  grind

/-- An edge ending (or starting) on the ray's line, its other end below: it does not straddle. -/
theorem cnt_below_to_line (q a v : P2) (ha : a.2 < q.2) (hv : v.2 = q.2) : cnt q a v = 0 := by
  have h1 : decide (a.2 > q.2) = false := by simp; grind
  have h2 : decide (v.2 > q.2) = false := by simp; grind
  simp [cnt, crosses, h1, h2]

theorem cnt_line_to_below (q v b : P2) (hb : b.2 < q.2) (hv : v.2 = q.2) : cnt q v b = 0 := by
  have h1 : decide (v.2 > q.2) = false := by simp; grind
  have h2 : decide (b.2 > q.2) = false := by simp; grind
  simp [cnt, crosses, h1, h2]

/-- An edge from the line up to `b`: counts iff the vertex on the line is right of `q`. -/
theorem cnt_line_to_above (q v b : P2) (hb : b.2 > q.2) (hv : v.2 = q.2) (hx : v.1 ≠ q.1) :
    cnt q v b = if v.1 > q.1 then 1 else 0 := by
  have h1 : decide (v.2 > q.2) = false := by simp; grind
  have h2 : decide (b.2 > q.2) = true := by simp; grind
  have hup : b.2 > v.2 := by grind
  have ho := orient_at_line_out q v b hv
  by_cases hr : v.1 > q.1
  · have : orient v b q > 0 := by rw [ho]; exact pos_mul (by grind) (by grind)
    simp [cnt, crosses, h1, h2, hup, this, hr]
  · have : ¬ orient v b q > 0 := by
      rw [ho]
      have := neg_mul_pos (show v.1 - q.1 < 0 by grind) (show 0 < b.2 - q.2 by grind)
      grind
    simp [cnt, crosses, h1, h2, hup, this, hr]

/-- An edge from `a` above down to the line: counts iff the vertex on the line is right of `q`. -/
theorem cnt_above_to_line (q a v : P2) (ha : a.2 > q.2) (hv : v.2 = q.2) (hx : v.1 ≠ q.1) :
    cnt q a v = if v.1 > q.1 then 1 else 0 := by
  have h1 : decide (a.2 > q.2) = true := by simp; grind
  have h2 : decide (v.2 > q.2) = false := by simp; grind
  have hdown : ¬ v.2 > a.2 := by grind
  have ho := orient_at_line_in q a v hv
  by_cases hr : v.1 > q.1
  · have : orient a v q < 0 := by
      rw [ho]
      have := neg_mul_pos (show q.2 - a.2 < 0 by grind) (show 0 < v.1 - q.1 by grind)
      grind
    simp [cnt, crosses, h1, h2, hdown, this, hr]
  · have : ¬ orient a v q < 0 := by
      rw [ho]
      have := Rat.mul_pos (show 0 < -(q.2 - a.2) by grind) (show 0 < -(v.1 - q.1) by grind)
      have e : -(q.2 - a.2) * -(v.1 - q.1) = (q.2 - a.2) * (v.1 - q.1) := by grind
      grind
    simp [cnt, crosses, h1, h2, hdown, this, hr]

/-- **Pass-through**: `a` and `b` strictly on opposite sides of the ray's line at `v` (right of `q`): one crossing. -/
theorem pass_through_count (q a v b : P2) (hv : v.2 = q.2) (hx : v.1 > q.1)
    (hab : (a.2 < q.2 ∧ b.2 > q.2) ∨ (a.2 > q.2 ∧ b.2 < q.2)) : cnt q a v + cnt q v b = 1 := by
  rcases hab with ⟨ha, hb⟩ | ⟨ha, hb⟩
  · rw [cnt_below_to_line q a v ha hv, cnt_line_to_above q v b hb hv (by grind)]; simp [hx]
  · rw [cnt_above_to_line q a v ha hv (by grind), cnt_line_to_below q v b hb hv]; simp [hx]

/-- The vertex on the line but left of `q`: the ray misses it, no crossing. -/
theorem pass_through_left (q a v b : P2) (hv : v.2 = q.2) (hx : v.1 < q.1)
    (hab : (a.2 < q.2 ∧ b.2 > q.2) ∨ (a.2 > q.2 ∧ b.2 < q.2)) : cnt q a v + cnt q v b = 0 := by
  have hn : ¬ v.1 > q.1 := by grind
  rcases hab with ⟨ha, hb⟩ | ⟨ha, hb⟩
  · rw [cnt_below_to_line q a v ha hv, cnt_line_to_above q v b hb hv (by grind)]; simp [hn]
  · rw [cnt_above_to_line q a v ha hv (by grind), cnt_line_to_below q v b hb hv]; simp [hn]

/-- **Touch from above**: 2 crossings when `v` is right of `q`, else 0. -/
theorem touch_count_above (q a v b : P2) (hv : v.2 = q.2) (hx : v.1 ≠ q.1) (ha : a.2 > q.2) (hb : b.2 > q.2) :
    cnt q a v + cnt q v b = if v.1 > q.1 then 2 else 0 := by
  rw [cnt_above_to_line q a v ha hv hx, cnt_line_to_above q v b hb hv hx]
  by_cases h : v.1 > q.1 <;> simp [h]

/-- **Touch from below**: no crossing. -/
theorem touch_count_below (q a v b : P2) (hv : v.2 = q.2) (ha : a.2 < q.2) (hb : b.2 < q.2) :
    cnt q a v + cnt q v b = 0 := by
  rw [cnt_below_to_line q a v ha hv, cnt_line_to_below q v b hb hv]

/-- A touch never changes the parity. -/
theorem touch_count_even (q a v b : P2) (hv : v.2 = q.2) (hx : v.1 ≠ q.1)
    (hab : (a.2 > q.2 ∧ b.2 > q.2) ∨ (a.2 < q.2 ∧ b.2 < q.2)) : (cnt q a v + cnt q v b) % 2 = 0 := by
  rcases hab with ⟨ha, hb⟩ | ⟨ha, hb⟩
  · rw [touch_count_above q a v b hv hx ha hb]; by_cases h : v.1 > q.1 <;> simp [h]
  · rw [touch_count_below q a v b hv ha hb]

/-- An edge lying on the ray's line never counts. -/
theorem horizontal_zero (q a b : P2) (ha : a.2 = q.2) (hb : b.2 = q.2) : crosses q a b = false := by
  have h1 : decide (a.2 > q.2) = false := by simp; grind
  have h2 : decide (b.2 > q.2) = false := by simp; grind
  simp [crosses, h1, h2]

/-- A pass through the line along a horizontal run `v → w` right of `q` counts once. -/
theorem horizontal_run_pass (q a v w b : P2) (hv : v.2 = q.2) (hw : w.2 = q.2) (hwx : w.1 > q.1)
    (ha : a.2 < q.2) (hb : b.2 > q.2) : cnt q a v + cnt q v w + cnt q w b = 1 := by
  have h0 : cnt q v w = 0 := by simp [cnt, horizontal_zero q v w hv hw]
  rw [cnt_below_to_line q a v ha hv, h0, cnt_line_to_above q w b hb hw (by grind)]; simp [hwx]

/-- **(b)** The rule does not depend on the edge's direction. -/
theorem crosses_symm (q a b : P2) : crosses q a b = crosses q b a := by
  have hs := orient_swap a b q
  by_cases ha : a.2 > q.2 <;> by_cases hb : b.2 > q.2
  · simp [crosses, ha, hb]
  · have hba : ¬ b.2 > a.2 := by grind
    have hab : a.2 > b.2 := by grind
    simp only [crosses, ha, hb, hba, hab, decide_true, decide_false, bne_iff_ne, ne_eq, if_true, if_false]
    simp only [Bool.true_eq_false, not_false_eq_true, Bool.false_eq_true, if_true]
    rw [hs]; simp only [decide_eq_decide]; grind
  · have hab : b.2 > a.2 := by grind
    have hba : ¬ a.2 > b.2 := by grind
    simp only [crosses, ha, hb, hba, hab, decide_true, decide_false, bne_iff_ne, ne_eq, if_true, if_false]
    simp only [Bool.true_eq_false, not_false_eq_true, Bool.false_eq_true, if_true]
    rw [hs]; simp only [decide_eq_decide]; grind
  · simp [crosses, ha, hb]

theorem cnt_symm (q a b : P2) : cnt q a b = cnt q b a := by simp [cnt, crosses_symm q a b]

/-- An upward straddling edge with both ends left of `q` never counts (helper of `cnt_left_zero`). -/
private theorem cnt_left_up (q a b : P2) (ha : a.1 < q.1) (hb : b.1 < q.1) (hya : ¬ a.2 > q.2) (hyb : b.2 > q.2) :
    cnt q a b = 0 := by
  have hup : b.2 > a.2 := by grind
  -- -orient a b q = (H - s)(q.x - a.x) + s (q.x - b.x) with H = b.y - a.y, s = q.y - a.y, 0 ≤ s < H.
  have e : -orient a b q = ((b.2 - a.2) - (q.2 - a.2)) * (q.1 - a.1) + (q.2 - a.2) * (q.1 - b.1) := by
    simp only [orient]; grind
  have h1 := Rat.mul_pos (show 0 < (b.2 - a.2) - (q.2 - a.2) by grind) (show 0 < q.1 - a.1 by grind)
  have h2 := Rat.mul_nonneg (show 0 ≤ q.2 - a.2 by grind) (show 0 ≤ q.1 - b.1 by grind)
  have hneg : ¬ orient a b q > 0 := by grind
  have d1 : decide (a.2 > q.2) = false := by simp; grind
  have d2 : decide (b.2 > q.2) = true := by simp; grind
  simp [cnt, crosses, d1, d2, hup, hneg]

/-- **The `crossingCount` pre-filter**: an edge with both ends strictly left of `q` never counts, so the TS may
skip it (`a.x < q.x && b.x < q.x`) without changing the count. -/
theorem cnt_left_zero (q a b : P2) (ha : a.1 < q.1) (hb : b.1 < q.1) : cnt q a b = 0 := by
  by_cases hya : a.2 > q.2 <;> by_cases hyb : b.2 > q.2
  · have d1 : decide (a.2 > q.2) = true := by simp; grind
    have d2 : decide (b.2 > q.2) = true := by simp; grind
    simp [cnt, crosses, d1, d2]
  · rw [cnt_symm]; exact cnt_left_up q b a hb ha hyb hya
  · exact cnt_left_up q a b ha hb hya hyb
  · have d1 : decide (a.2 > q.2) = false := by simp; grind
    have d2 : decide (b.2 > q.2) = false := by simp; grind
    simp [cnt, crosses, d1, d2]

/-- The crossing count of an edge list (all rings' edges together). -/
def crossCount (q : P2) (es : List (P2 × P2)) : Nat := (es.map fun e => cnt q e.1 e.2).sum

/-- The edges of the polygon read backwards: reversed order, each edge swapped. -/
def reverseEdges (es : List (P2 × P2)) : List (P2 × P2) := (es.map Prod.swap).reverse

theorem crossCount_append (q : P2) (xs ys : List (P2 × P2)) :
    crossCount q (xs ++ ys) = crossCount q xs + crossCount q ys := by
  induction xs with
  | nil => simp [crossCount]
  | cons x xs ih => simp only [crossCount, List.cons_append, List.map_cons, List.sum_cons] at ih ⊢; omega

theorem crossCount_reverse (q : P2) (es : List (P2 × P2)) : crossCount q (reverseEdges es) = crossCount q es := by
  induction es with
  | nil => simp [reverseEdges, crossCount]
  | cons e es ih =>
    have h : reverseEdges (e :: es) = reverseEdges es ++ [(e.2, e.1)] := by
      obtain ⟨a, b⟩ := e
      simp [reverseEdges, Prod.swap]
    rw [h, crossCount_append, ih]
    simp [crossCount, cnt_symm q e.2 e.1]
    omega

/-- The even–odd answer. -/
def inside (q : P2) (es : List (P2 × P2)) : Bool := crossCount q es % 2 == 1

theorem inside_reverse (q : P2) (es : List (P2 × P2)) : inside q (reverseEdges es) = inside q es := by
  simp [inside, crossCount_reverse]

/-! ### The TS ring indexing -/

/-- The open chain of consecutive edges `(p₀,p₁), (p₁,p₂), …` of a vertex list. -/
def chain : List P2 → List (P2 × P2)
  | a :: b :: rest => (a, b) :: chain (b :: rest)
  | _ => []

/-- The TS edges of a closed ring `[p₀, …, pₙ₋₁]`: `(ring[i], ring[(i + 1) % n])` for `i < n`, i.e. the chain of
the ring closed back to its first vertex. -/
def ringEdges : List P2 → List (P2 × P2)
  | [] => []
  | a :: rest => chain (a :: rest ++ [a])

theorem chain_snoc (l : List P2) (x y : P2) : chain (l ++ [x, y]) = chain (l ++ [x]) ++ [(x, y)] := by
  induction l with
  | nil => simp [chain]
  | cons a l ih =>
    cases l with
    | nil => simp [chain]
    | cons b l' =>
      simp only [List.cons_append] at ih ⊢
      simp only [chain, ih, List.cons_append]

theorem chain_reverse (l : List P2) : chain l.reverse = reverseEdges (chain l) := by
  induction l with
  | nil => simp [chain, reverseEdges]
  | cons a l ih =>
    cases l with
    | nil => simp [chain, reverseEdges]
    | cons b l' =>
      rw [List.reverse_cons, List.reverse_cons]
      have e : l'.reverse ++ [b] ++ [a] = l'.reverse ++ [b, a] := by simp
      rw [e, chain_snoc]
      have e2 : l'.reverse ++ [b] = (b :: l').reverse := by simp
      rw [e2, ih]
      simp [chain, reverseEdges]

/-- Starting a closed walk one vertex later does not change its crossing count. -/
theorem chain_rotate (q a b : P2) (m : List P2) :
    crossCount q (chain (b :: m ++ [a, b])) = crossCount q (chain (a :: b :: m ++ [a])) := by
  have h1 : b :: m ++ [a, b] = (b :: m) ++ [a, b] := rfl
  rw [h1, chain_snoc, crossCount_append]
  have h2 : chain (a :: b :: m ++ [a]) = (a, b) :: chain (b :: m ++ [a]) := by simp [chain]
  rw [h2]
  simp [crossCount]
  omega

/-- **The TS ring read backwards** (`[...ring].reverse()`, edges `(ring[i], ring[(i + 1) % n])`) has the same
crossing count. -/
theorem ringEdges_reverse (q : P2) (l : List P2) : crossCount q (ringEdges l.reverse) = crossCount q (ringEdges l) := by
  cases l with
  | nil => simp [ringEdges]
  | cons a rest =>
    rcases List.eq_nil_or_concat rest with h | ⟨L, b, h⟩
    · subst h; simp [ringEdges]
    · subst h
      rw [List.concat_eq_append]
      have e1 : (a :: (L ++ [b])).reverse = b :: (L.reverse ++ [a]) := by simp
      rw [e1]
      simp only [ringEdges]
      have e2 : b :: (L.reverse ++ [a]) ++ [b] = b :: L.reverse ++ [a, b] := by simp
      rw [e2, chain_rotate]
      have e3 : a :: b :: L.reverse ++ [a] = (a :: (L ++ [b]) ++ [a]).reverse := by simp
      rw [e3, chain_reverse, crossCount_reverse]

theorem ringInside_reverse (q : P2) (l : List P2) :
    crossCount q (ringEdges l.reverse) % 2 = crossCount q (ringEdges l) % 2 := by
  rw [ringEdges_reverse]

example : ringEdges [(0,0), (1,0), (0,1)] = [((0,0),(1,0)), ((1,0),(0,1)), ((0,1),(0,0))] := by decide

/-! ## (c) Ray transitions -/

/-- A rational 3-vector. -/
structure V3 where
  x : Rat
  y : Rat
  z : Rat

def dot (a b : V3) : Rat := a.x * b.x + a.y * b.y + a.z * b.z

/-- The ray point `o + t d`. -/
def at_ (o d : V3) (t : Rat) : V3 := ⟨o.x + t * d.x, o.y + t * d.y, o.z + t * d.z⟩

/-- The signed distance (times `|n|`) of the ray point at `t` to the plane through `p0` with outward normal `n`. -/
def g (n p0 o d : V3) (t : Rat) : Rat := dot n ⟨(at_ o d t).x - p0.x, (at_ o d t).y - p0.y, (at_ o d t).z - p0.z⟩

theorem g_linear (n p0 o d : V3) (t : Rat) : g n p0 o d t = g n p0 o d 0 + t * dot n d := by
  simp only [g, dot, at_]; grind

theorem g_sub (n p0 o d : V3) (s th : Rat) (h0 : g n p0 o d th = 0) : g n p0 o d s = (s - th) * dot n d := by
  have a := g_linear n p0 o d s
  have b := g_linear n p0 o d th
  grind

/-- Entering: with `n·d < 0`, the ray is on the outward side before the hit and on the inner side after it. -/
theorem entering_side (n p0 o d : V3) (th : Rat) (h0 : g n p0 o d th = 0) (hnd : dot n d < 0) :
    (∀ s, s < th → g n p0 o d s > 0) ∧ (∀ s, s > th → g n p0 o d s < 0) := by
  constructor
  · intro s hs
    rw [g_sub n p0 o d s th h0]
    have := Rat.mul_pos (show 0 < -(s - th) by grind) (show 0 < -dot n d by grind)
    have e : -(s - th) * -dot n d = (s - th) * dot n d := by grind
    grind
  · intro s hs
    rw [g_sub n p0 o d s th h0]
    have := Rat.mul_pos (show 0 < s - th by grind) (show 0 < -dot n d by grind)
    have e : (s - th) * -dot n d = -((s - th) * dot n d) := by grind
    grind

/-- Leaving: with `n·d > 0`, inner side before the hit, outward side after it. -/
theorem leaving_side (n p0 o d : V3) (th : Rat) (h0 : g n p0 o d th = 0) (hnd : dot n d > 0) :
    (∀ s, s < th → g n p0 o d s < 0) ∧ (∀ s, s > th → g n p0 o d s > 0) := by
  constructor
  · intro s hs
    rw [g_sub n p0 o d s th h0]
    have := Rat.mul_pos (show 0 < -(s - th) by grind) hnd
    have e : -(s - th) * dot n d = -((s - th) * dot n d) := by grind
    grind
  · intro s hs
    rw [g_sub n p0 o d s th h0]
    exact Rat.mul_pos (show 0 < s - th by grind) hnd

/-- The TS transition of a transversal, non-grazing hit from the cosine `n·d`. -/
inductive Transition where
  | entering
  | leaving
  deriving DecidableEq

def transition (c : Rat) : Transition := if c < 0 then .entering else .leaving

theorem transition_entering_iff (c : Rat) : transition c = .entering ↔ c < 0 := by
  unfold transition; by_cases h : c < 0 <;> simp [h]

/-! ## (d) Box pruning -/

/-- The TS `axisGap(lo, hi, x) = max(lo - x, 0, x - hi)`. -/
def gap (lo hi x : Rat) : Rat := if x < lo then lo - x else if x > hi then x - hi else 0

theorem gap_ge_zero (lo hi x : Rat) : 0 ≤ gap lo hi x := by unfold gap; split <;> (try split) <;> grind

theorem gap_ge_left (lo hi x : Rat) (h : lo ≤ hi) : lo - x ≤ gap lo hi x := by
  unfold gap; split <;> (try split) <;> grind

theorem gap_ge_right (lo hi x : Rat) (h : lo ≤ hi) : x - hi ≤ gap lo hi x := by
  unfold gap; split <;> (try split) <;> grind

/-- The gap is one of the three: so it is their maximum. -/
theorem gap_cases (lo hi x : Rat) : gap lo hi x = lo - x ∨ gap lo hi x = 0 ∨ gap lo hi x = x - hi := by
  unfold gap; split <;> (try split) <;> simp

theorem gap_sq_le (lo hi x y : Rat) (hy0 : lo ≤ y) (hy1 : y ≤ hi) : gap lo hi x * gap lo hi x ≤ (y - x) * (y - x) := by
  unfold gap
  split
  · -- (y - x)² - (lo - x)² = (y - lo)(y + lo - 2x)
    have := Rat.mul_nonneg (show 0 ≤ y - lo by grind) (show 0 ≤ y + lo - 2 * x by grind)
    have e : (y - x) * (y - x) - (lo - x) * (lo - x) = (y - lo) * (y + lo - 2 * x) := by grind
    grind
  · split
    · have := Rat.mul_nonneg (show 0 ≤ hi - y by grind) (show 0 ≤ 2 * x - y - hi by grind)
      have e : (y - x) * (y - x) - (x - hi) * (x - hi) = (hi - y) * (2 * x - y - hi) := by grind
      grind
    · have := Rat.mul_nonneg (show 0 ≤ (y - x) * (y - x) by
          by_cases h : 0 ≤ y - x
          · exact Rat.mul_nonneg h h
          · have := Rat.mul_nonneg (show 0 ≤ -(y - x) by grind) (show 0 ≤ -(y - x) by grind)
            grind) (show (0 : Rat) ≤ 1 by grind)
      grind

/-- The TS `boxDistanceSq`: the sum of the squared gaps. -/
def boxDistSq (lo hi p : V3) : Rat :=
  gap lo.x hi.x p.x * gap lo.x hi.x p.x + gap lo.y hi.y p.y * gap lo.y hi.y p.y + gap lo.z hi.z p.z * gap lo.z hi.z p.z

def dist2 (a b : V3) : Rat := (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z)

def inBox (lo hi y : V3) : Prop := lo.x ≤ y.x ∧ y.x ≤ hi.x ∧ lo.y ≤ y.y ∧ y.y ≤ hi.y ∧ lo.z ≤ y.z ∧ y.z ≤ hi.z

/-- Every point of the box is at squared distance at least `boxDistSq` from `p`. -/
theorem boxDistSq_le (lo hi p y : V3) (h : inBox lo hi y) : boxDistSq lo hi p ≤ dist2 y p := by
  obtain ⟨h1, h2, h3, h4, h5, h6⟩ := h
  have a := gap_sq_le lo.x hi.x p.x y.x h1 h2
  have b := gap_sq_le lo.y hi.y p.y y.y h3 h4
  have c := gap_sq_le lo.z hi.z p.z y.z h5 h6
  simp only [boxDistSq, dist2]
  grind

/-- **Pruning**: a box whose bound exceeds `best²` holds no point within `best` of `p`. -/
theorem prune_sound (lo hi p : V3) (best : Rat) (h : boxDistSq lo hi p > best * best) :
    ∀ y, inBox lo hi y → dist2 y p > best * best := by
  intro y hy
  have := boxDistSq_le lo hi p y hy
  grind

end Query
end CadloomFormal
