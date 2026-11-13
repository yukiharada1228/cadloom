import Cadloom

namespace Cadloom

def scalarBetween (a b p : ℚ) : Prop := min a b ≤ p ∧ p ≤ max a b

theorem scalar_lerp_between (a b t : ℚ) (ht : inUnit t) :
    scalarBetween a b (a + t * (b - a)) := by
  obtain ⟨h0, h1⟩ := ht
  by_cases hab : a ≤ b
  · simp only [scalarBetween, min_eq_left hab, max_eq_right hab]
    constructor <;> nlinarith
  · have hba := le_of_not_ge hab
    simp only [scalarBetween, min_eq_right hba, max_eq_left hba]
    constructor <;> nlinarith

theorem scalar_parameter_in_unit (a b p : ℚ) (hne : b - a ≠ 0)
    (hp : scalarBetween a b p) : inUnit ((p - a) / (b - a)) := by
  have he : (p - a) / (b - a) * (b - a) = p - a := div_mul_cancel₀ _ hne
  unfold inUnit
  by_cases hab : a ≤ b
  · simp only [scalarBetween, min_eq_left hab, max_eq_right hab] at hp
    obtain ⟨h0, h1⟩ := hp
    have hdiff : 0 < b - a := lt_of_le_of_ne (sub_nonneg.mpr hab) (Ne.symm hne)
    constructor <;> nlinarith
  · have hba := le_of_not_ge hab
    simp only [scalarBetween, min_eq_right hba, max_eq_left hba] at hp
    obtain ⟨h0, h1⟩ := hp
    constructor <;> nlinarith

def containsPoint (p a b : Point) : Prop :=
  cross (delta a b) (delta a p) = 0 ∧
    scalarBetween a.x b.x p.x ∧ scalarBetween a.y b.y p.y

theorem containsPoint_iff_onSegment (p a b : Point) :
    containsPoint p a b ↔ onSegment p a b := by
  constructor
  · rintro ⟨hcross, hx, hy⟩
    by_cases hdx : b.x - a.x = 0
    · have hax : b.x = a.x := sub_eq_zero.mp hdx
      have hpx : p.x = a.x := by
        simp only [scalarBetween, hax, min_self, max_self] at hx
        exact le_antisymm hx.2 hx.1
      by_cases hdy : b.y - a.y = 0
      · have hay : b.y = a.y := sub_eq_zero.mp hdy
        have hpy : p.y = a.y := by
          simp only [scalarBetween, hay, min_self, max_self] at hy
          exact le_antisymm hy.2 hy.1
        refine ⟨0, ⟨le_rfl, by norm_num⟩, ?_⟩
        ext <;> simp [lerp, hpx, hpy]
      · refine ⟨(p.y - a.y) / (b.y - a.y), scalar_parameter_in_unit _ _ _ hdy hy, ?_⟩
        apply Point.ext
        · simp [lerp, hdx, hpx]
        · dsimp [lerp]
          rw [div_mul_cancel₀ _ hdy]
          ring
    · refine ⟨(p.x - a.x) / (b.x - a.x), scalar_parameter_in_unit _ _ _ hdx hx, ?_⟩
      apply Point.ext
      · dsimp [lerp]
        rw [div_mul_cancel₀ _ hdx]
        ring
      · dsimp [lerp]
        field_simp
        dsimp [cross, delta] at hcross
        nlinarith
  · rintro ⟨t, ht, rfl⟩
    refine ⟨?_, scalar_lerp_between _ _ _ ht, scalar_lerp_between _ _ _ ht⟩
    dsimp [cross, delta, lerp]
    ring

def lexLE (a b : Point) : Prop := a.x < b.x ∨ a.x = b.x ∧ a.y ≤ b.y

theorem lexLE_total (a b : Point) : lexLE a b ∨ lexLE b a := by
  rcases lt_trichotomy a.x b.x with h | h | h
  · exact Or.inl (Or.inl h)
  · rcases le_total a.y b.y with hy | hy
    · exact Or.inl (Or.inr ⟨h, hy⟩)
    · exact Or.inr (Or.inr ⟨h.symm, hy⟩)
  · exact Or.inr (Or.inl h)

theorem lexLE_antisymm (a b : Point) (hab : lexLE a b) (hba : lexLE b a) : a = b := by
  rcases hab with hx | ⟨hx, hy⟩ <;> rcases hba with hx' | ⟨hx', hy'⟩
  · linarith
  · linarith
  · linarith
  · exact Point.ext hx (le_antisymm hy hy')

theorem lerp_reverse (a b : Point) (t : ℚ) : lerp b a (1 - t) = lerp a b t := by
  ext <;> dsimp [lerp] <;> ring

theorem onSegment_reverse (p a b : Point) : onSegment p a b ↔ onSegment p b a := by
  constructor
  · rintro ⟨t, ⟨ht0, ht1⟩, hp⟩
    exact ⟨1 - t, ⟨by linarith, by linarith⟩, hp.trans (lerp_reverse a b t).symm⟩
  · rintro ⟨t, ⟨ht0, ht1⟩, hp⟩
    exact ⟨1 - t, ⟨by linarith, by linarith⟩, hp.trans (lerp_reverse b a t).symm⟩

theorem lerp_lex_bounds (a b : Point) (hab : lexLE a b) (t : ℚ) (ht : inUnit t) :
    lexLE a (lerp a b t) ∧ lexLE (lerp a b t) b := by
  obtain ⟨ht0, ht1⟩ := ht
  rcases hab with hx | ⟨hx, hy⟩
  · constructor
    · by_cases hzero : t = 0
      · simp [hzero, lerp_zero, lexLE]
      · have hpos : 0 < t := lt_of_le_of_ne ht0 (Ne.symm hzero)
        left
        dsimp [lerp]
        nlinarith
    · by_cases hone : t = 1
      · simp [hone, lerp_one, lexLE]
      · have hlt : t < 1 := lt_of_le_of_ne ht1 hone
        left
        dsimp [lerp]
        nlinarith
  · constructor
    · right
      dsimp [lerp]
      constructor <;> nlinarith
    · right
      dsimp [lerp]
      constructor <;> nlinarith

theorem collinear_lex_bounds_onSegment (p a b : Point)
    (hcross : cross (delta a b) (delta a p) = 0)
    (hap : lexLE a p) (hpb : lexLE p b) : onSegment p a b := by
  have haxp : a.x ≤ p.x := hap.elim le_of_lt (fun h => le_of_eq h.1)
  have hpxb : p.x ≤ b.x := hpb.elim le_of_lt (fun h => le_of_eq h.1)
  have haxb : a.x ≤ b.x := le_trans haxp hpxb
  by_cases hdx : b.x - a.x = 0
  · have hba : b.x = a.x := sub_eq_zero.mp hdx
    have hpa : p.x = a.x := by linarith
    have hayp : a.y ≤ p.y := hap.elim (fun h => by linarith) (fun h => h.2)
    have hpyb : p.y ≤ b.y := hpb.elim (fun h => by linarith) (fun h => h.2)
    apply (containsPoint_iff_onSegment p a b).mp
    refine ⟨hcross, ?_, ?_⟩
    · simp [scalarBetween, hba, hpa]
    · have haby : a.y ≤ b.y := le_trans hayp hpyb
      simpa only [scalarBetween, min_eq_left haby, max_eq_right haby] using And.intro hayp hpyb
  · have hbetween : scalarBetween a.x b.x p.x := by
      simpa only [scalarBetween, min_eq_left haxb, max_eq_right haxb] using And.intro haxp hpxb
    refine ⟨(p.x - a.x) / (b.x - a.x), scalar_parameter_in_unit _ _ _ hdx hbetween, ?_⟩
    apply Point.ext
    · dsimp [lerp]
      rw [div_mul_cancel₀ _ hdx]
      ring
    · dsimp [lerp]
      field_simp
      dsimp [cross, delta] at hcross
      nlinarith

def lexContains (p a b : Point) : Prop :=
  cross (delta a b) (delta a p) = 0 ∧
    ((lexLE a p ∧ lexLE p b) ∨ (lexLE b p ∧ lexLE p a))

theorem lexContains_iff_onSegment (p a b : Point) : lexContains p a b ↔ onSegment p a b := by
  constructor
  · rintro ⟨hc, ⟨ha, hb⟩ | ⟨hb, ha⟩⟩
    · exact collinear_lex_bounds_onSegment p a b hc ha hb
    · apply (onSegment_reverse p a b).mpr
      apply collinear_lex_bounds_onSegment p b a _ hb ha
      dsimp [cross, delta] at hc ⊢
      nlinarith
  · intro hp
    have hc := ((containsPoint_iff_onSegment p a b).mpr hp).1
    refine ⟨hc, ?_⟩
    rcases lexLE_total a b with hab | hba
    · obtain ⟨t, ht, rfl⟩ := hp
      exact Or.inl (lerp_lex_bounds a b hab t ht)
    · obtain ⟨t, ht, rfl⟩ := (onSegment_reverse p a b).mp hp
      exact Or.inr (lerp_lex_bounds b a hba t ht)

end Cadloom
