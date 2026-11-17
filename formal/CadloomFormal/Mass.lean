import CadloomFormal.Foundation

/-!
# Mass: the divergence-theorem volume of fan-triangulated polygons

Exact rational model of `src/mass/polyhedron.ts`:

* `det a b c = a · (b × c)` is `det3`.
* `tetDet r a b c = det (a - r) (b - r) (c - r)` is one term of `signedVolume` / `polyhedronMass` with
  reference point `r` (the TypeScript code uses the bounding-box centre; every theorem here holds for an
  arbitrary `r`). `polyhedronMass` additionally divides the differences by a power of two `s` and multiplies
  the sum back by `s^3`; `det_smul` shows this is the identity in exact arithmetic.
* `fanDet r p0 [p1, …, pn] = Σ_{i=1}^{n-1} tetDet r p0 p_i p_{i+1}` and `loopDet r (p0 :: ps) = fanDet r p0 ps`
  are the fan triangulation of one loop, `fanTriangles` (triangles `(q0, q_i, q_{i+1})`, `i = 1 .. n-2`),
  summed in the same order.
* `boxPt` is `boxCorner` and `boxFaces` is `BOX_FACES` of `src/primitive/box.ts` (same corner numbering, same
  faces, same vertex order, hence the same loops the B-rep built by `makeBox` walks: `buildPolyhedron` makes
  each loop start at the face's first index). `boxDetSum` sums `loopDet` over the faces in order, so
  `boxDetSum / 6` is the volume `polyhedronMass` computes for `makeBox` in exact arithmetic.

Theorems:
* `det_cyclic`, `det_swap` — `det` is invariant under cyclic rotation and changes sign under a swap.
* `det_smul` — `det (s a) (s b) (s c) = s^3 det a b c` (the local-frame scaling of `polyhedronMass`).
* `tetDet_swap` — swapping two triangle vertices negates the tetrahedron term (orientation).
* `fanDet_split`, `loopDet_split` — splitting a polygon along a diagonal from its first vertex splits the fan
  sum additively.
* `fanDet_reverse`, `loopDet_reverse` — reversing a loop (`[p0, pn, …, p1]`) negates its fan sum.
* `boxVolume_eq` — for every origin, size `dx, dy, dz` and reference point `r`, `boxDetSum / 6 = dx·dy·dz`.

Not covered: IEEE rounding, the run-time validity/planarity/orientation checks, surface area (it uses a
square root to normalise the face normal), the centroid, and the general statement that the divergence sum
of an arbitrary closed oriented polyhedron is independent of `r`.
-/
namespace CadloomFormal
namespace Mass

open V3

/-- `a · (b × c)`. -/
def det (a b c : V3) : Rat := dot a (cross b c)

theorem det_cyclic (a b c : V3) : det a b c = det b c a := by
  simp only [det, dot, cross]; grind

theorem det_swap (a b c : V3) : det a c b = -det a b c := by
  simp only [det, dot, cross]; grind

theorem det_smul (s : Rat) (a b c : V3) : det (smul s a) (smul s b) (smul s c) = s ^ 3 * det a b c := by
  simp only [det, dot, cross, smul]; grind

/-- Six times the signed volume of the tetrahedron `(r, a, b, c)`. -/
def tetDet (r a b c : V3) : Rat := det (sub a r) (sub b r) (sub c r)

theorem tetDet_swap (r a b c : V3) : tetDet r a c b = -tetDet r a b c := by
  simp only [tetDet]; exact det_swap _ _ _

/-- Fan from `p0` over consecutive pairs of the remaining vertices. -/
def fanDet (r p0 : V3) : List V3 → Rat
  | a :: b :: rest => tetDet r p0 a b + fanDet r p0 (b :: rest)
  | _ => 0

/-- Fan sum of one loop, triangulated from its first vertex. -/
def loopDet (r : V3) : List V3 → Rat
  | [] => 0
  | p0 :: ps => fanDet r p0 ps

theorem fanDet_split (r p0 pk : V3) (l1 l2 : List V3) :
    fanDet r p0 (l1 ++ pk :: l2) = fanDet r p0 (l1 ++ [pk]) + fanDet r p0 (pk :: l2) := by
  induction l1 with
  | nil => simp [fanDet]; grind
  | cons a t ih =>
    cases t with
    | nil => simp [fanDet]; grind
    | cons b t' =>
      simp only [List.cons_append] at ih ⊢
      simp only [fanDet, ih]
      grind

/-- Splitting the polygon `p0 … pk … pn` along the diagonal `p0 pk`. -/
theorem loopDet_split (r p0 pk : V3) (l1 l2 : List V3) :
    loopDet r (p0 :: (l1 ++ pk :: l2)) = loopDet r (p0 :: (l1 ++ [pk])) + loopDet r (p0 :: pk :: l2) := by
  simp only [loopDet]; exact fanDet_split r p0 pk l1 l2

theorem fanDet_append_pair (r p0 y x : V3) (l : List V3) :
    fanDet r p0 (l ++ [y, x]) = fanDet r p0 (l ++ [y]) + tetDet r p0 y x := by
  rw [fanDet_split r p0 y l [x]]; simp [fanDet]; grind

theorem fanDet_reverse (r p0 : V3) (l : List V3) : fanDet r p0 l.reverse = -fanDet r p0 l := by
  induction l with
  | nil => simp [fanDet]; grind
  | cons a t ih =>
    cases t with
    | nil => simp [fanDet]; grind
    | cons b t' =>
      have hrev : (a :: b :: t').reverse = t'.reverse ++ [b, a] := by simp
      have hrev' : (b :: t').reverse = t'.reverse ++ [b] := by simp
      rw [hrev, fanDet_append_pair, ← hrev', ih, tetDet_swap]
      simp only [fanDet]
      grind

/-- Reversing the loop `p0 p1 … pn` to `p0 pn … p1` negates its contribution. -/
theorem loopDet_reverse (r p0 : V3) (ps : List V3) :
    loopDet r (p0 :: ps.reverse) = -loopDet r (p0 :: ps) := by
  simp only [loopDet]; exact fanDet_reverse r p0 ps

/-! ## The box (same tables as `boxCorner` and `BOX_FACES` in `src/primitive/box.ts`) -/

/-- Corner `i`: `o + (dx * bit0 i, dy * bit1 i, dz * bit2 i)`. -/
def boxPt (o : V3) (dx dy dz : Rat) (i : Nat) : V3 :=
  ⟨o.x + (if i % 2 = 1 then dx else 0),
   o.y + (if i / 2 % 2 = 1 then dy else 0),
   o.z + (if i / 4 % 2 = 1 then dz else 0)⟩

def boxFaces : List (List Nat) :=
  [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]

/-- Six times the divergence-theorem volume of the box's fan-triangulated faces. -/
def boxDetSum (r o : V3) (dx dy dz : Rat) : Rat :=
  (boxFaces.map (fun f => loopDet r (f.map (boxPt o dx dy dz)))).sum

theorem boxVolume_eq (r o : V3) (dx dy dz : Rat) : boxDetSum r o dx dy dz / 6 = dx * dy * dz := by
  simp only [boxDetSum, boxFaces, List.map_cons, List.map_nil, List.sum_cons, List.sum_nil, loopDet, fanDet,
    tetDet, det, boxPt, dot, cross, sub, Nat.reduceMod, Nat.reduceDiv, ite_true]
  grind

end Mass
end CadloomFormal
