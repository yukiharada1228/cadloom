import CollinearOverlap

namespace Cadloom

structure InputSegment where
  start : Point
  finish : Point
  deriving DecidableEq, Repr

def resultVertices : IntersectionResult → Finset Point
  | .none => ∅
  | .point p => {p}
  | .overlap a b => {a, b}

theorem resultVertices_sound (r : IntersectionResult) (a b c d p : Point)
    (hr : IntersectionCorrect r a b c d) (hp : p ∈ resultVertices r) :
    onSegment p a b ∧ onSegment p c d := by
  apply (hr p).mp
  cases r with
  | none => simp [resultVertices] at hp
  | point q => simpa [resultVertices, resultContains] using hp
  | overlap x y =>
    simp only [resultVertices, Finset.mem_insert, Finset.mem_singleton] at hp
    rcases hp with rfl | rfl
    · exact ⟨0, ⟨le_rfl, by norm_num⟩, (lerp_zero _ _).symm⟩
    · exact ⟨1, ⟨by norm_num, le_rfl⟩, (lerp_one _ _).symm⟩

-- Exactly the ordered index pairs visited by i=0..n-1, j=i+1..n-1.
def indexPairs (n : Nat) : List (Fin n × Fin n) :=
  (List.finRange n).flatMap (fun i =>
    ((List.finRange n).filter (fun j => i < j)).map (fun j => (i, j)))

theorem indexPairs_membership (n : Nat) (i j : Fin n) :
    (i, j) ∈ indexPairs n ↔ i < j := by
  simp [indexPairs]

def pairVertices {n : Nat} (segments : Fin n → InputSegment) (ij : Fin n × Fin n) : Finset Point :=
  resultVertices (intersectModel (segments ij.1).start (segments ij.1).finish
    (segments ij.2).start (segments ij.2).finish)

abbrev CutState (n : Nat) := Fin n → Finset Point

def cutStep {n : Nat} (segments : Fin n → InputSegment) (cuts : CutState n)
    (ij : Fin n × Fin n) : CutState n := fun k =>
  if k = ij.1 ∨ k = ij.2 then cuts k ∪ pairVertices segments ij else cuts k

def initialCuts {n : Nat} (segments : Fin n → InputSegment) : CutState n :=
  fun k => {(segments k).start, (segments k).finish}

def pairLoop {n : Nat} (segments : Fin n → InputSegment)
    (events : List (Fin n × Fin n)) (cuts : CutState n) : CutState n :=
  events.foldl (cutStep segments) cuts

theorem cutStep_membership {n : Nat} (segments : Fin n → InputSegment)
    (cuts : CutState n) (ij : Fin n × Fin n) (k : Fin n) (p : Point) :
    p ∈ cutStep segments cuts ij k ↔
      p ∈ cuts k ∨ ((k = ij.1 ∨ k = ij.2) ∧ p ∈ pairVertices segments ij) := by
  unfold cutStep
  split_ifs <;> simp_all

theorem pairLoop_membership {n : Nat} (segments : Fin n → InputSegment)
    (events : List (Fin n × Fin n)) (cuts : CutState n) (k : Fin n) (p : Point) :
    p ∈ pairLoop segments events cuts k ↔ p ∈ cuts k ∨
      ∃ ij ∈ events, (k = ij.1 ∨ k = ij.2) ∧ p ∈ pairVertices segments ij := by
  induction events generalizing cuts with
  | nil => simp [pairLoop]
  | cons ij rest ih =>
    change p ∈ pairLoop segments rest (cutStep segments cuts ij) k ↔ _
    rw [ih, cutStep_membership]
    simp only [List.mem_cons]
    constructor
    · rintro ((hp | hp) | hp)
      · exact Or.inl hp
      · exact Or.inr ⟨ij, Or.inl rfl, hp⟩
      · obtain ⟨event, he, hp⟩ := hp
        exact Or.inr ⟨event, Or.inr he, hp⟩
    · rintro (hp | ⟨event, he, hp⟩)
      · exact Or.inl (Or.inl hp)
      · rcases he with rfl | he
        · exact Or.inl (Or.inr hp)
        · exact Or.inr ⟨event, he, hp⟩

def computedCuts {n : Nat} (segments : Fin n → InputSegment) : CutState n :=
  pairLoop segments (indexPairs n) (initialCuts segments)

theorem computedCuts_membership {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (p : Point) :
    p ∈ computedCuts segments k ↔
      p = (segments k).start ∨ p = (segments k).finish ∨
      ∃ i j : Fin n, i < j ∧ (k = i ∨ k = j) ∧ p ∈ pairVertices segments (i, j) := by
  unfold computedCuts
  rw [pairLoop_membership]
  simp only [initialCuts, Finset.mem_insert, Finset.mem_singleton]
  constructor
  · rintro ((hp | hp) | ⟨⟨i, j⟩, hij, hk, hp⟩)
    · exact Or.inl hp
    · exact Or.inr (Or.inl hp)
    · exact Or.inr (Or.inr ⟨i, j, (indexPairs_membership n i j).mp hij, hk, hp⟩)
  · rintro (hp | hp | ⟨i, j, hij, hk, hp⟩)
    · exact Or.inl (Or.inl hp)
    · exact Or.inl (Or.inr hp)
    · exact Or.inr ⟨(i, j), (indexPairs_membership n i j).mpr hij, hk, hp⟩

theorem computedCuts_sound {n : Nat} (segments : Fin n → InputSegment)
    (k : Fin n) (p : Point) (hp : p ∈ computedCuts segments k) :
    onSegment p (segments k).start (segments k).finish := by
  rcases (computedCuts_membership segments k p).mp hp with hp | hp | ⟨i, j, _, hk, hp⟩
  · rw [hp]
    exact ⟨0, ⟨le_rfl, by norm_num⟩, (lerp_zero _ _).symm⟩
  · rw [hp]
    exact ⟨1, ⟨by norm_num, le_rfl⟩, (lerp_one _ _).symm⟩
  · have h := resultVertices_sound _ _ _ _ _ p (intersectModel_correct _ _ _ _) hp
    rcases hk with rfl | rfl
    · exact h.1
    · exact h.2

-- Overlap boundaries introduce no new coordinates on a shared line.
theorem overlap_boundaries_endpoints (a b c d : Point) :
    let endpoint := fun p => p = a ∨ p = b ∨ p = c ∨ p = d
    endpoint (overlapLow a b c d) ∧ endpoint (overlapHigh a b c d) := by
  let endpoint := fun p => p = a ∨ p = b ∨ p = c ∨ p = d
  have ha : endpoint a := Or.inl rfl
  have hb : endpoint b := Or.inr (Or.inl rfl)
  have hc : endpoint c := Or.inr (Or.inr (Or.inl rfl))
  have hd : endpoint d := Or.inr (Or.inr (Or.inr rfl))
  exact ⟨orderedEnd_property endpoint _ _
      (orderedStart_property endpoint a b ha hb) (orderedStart_property endpoint c d hc hd),
    orderedStart_property endpoint _ _
      (orderedEnd_property endpoint a b ha hb) (orderedEnd_property endpoint c d hc hd)⟩

theorem collinear_vertices_endpoints (a b c d p : Point)
    (hp : p ∈ resultVertices (collinearBranch a b c d)) :
    p = a ∨ p = b ∨ p = c ∨ p = d := by
  have hlo := (overlap_boundaries_endpoints a b c d).1
  have hhi := (overlap_boundaries_endpoints a b c d).2
  unfold collinearBranch at hp
  by_cases horder : lexLE (overlapLow a b c d) (overlapHigh a b c d)
  · rw [if_neg (not_not.mpr horder)] at hp
    by_cases heq : overlapLow a b c d = overlapHigh a b c d
    · rw [if_pos heq] at hp
      simp only [resultVertices, Finset.mem_singleton] at hp
      subst p
      exact hlo
    · rw [if_neg heq] at hp
      simp only [resultVertices, Finset.mem_insert, Finset.mem_singleton] at hp
      rcases hp with hp | hp
      · subst p; exact hlo
      · subst p; exact hhi
  · rw [if_pos horder] at hp
    simp [resultVertices] at hp

end Cadloom
