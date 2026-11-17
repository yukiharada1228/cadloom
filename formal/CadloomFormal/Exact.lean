/-
Exact: the rational model of `src/exact/dyadic.ts` and `src/exact/predicates.ts`.

What is modelled (same structure, same indices as the TypeScript):

* `Dy` is `Dyadic` (`{ num: bigint, exp: number }`, value `num * 2^exp`); `Dy.val` is its value,
  with `pow2 : Int → Rat` for `2^exp` (exponents of either sign).
  - `Dy.add` is `addDyadic` before normalisation: both numerators are shifted left onto the smaller
    exponent `min a.exp b.exp` and added (`num << BigInt(exp - m)` is `num * 2^(exp - m)`).
    `Dy.neg` is `negDyadic`, `Dy.sub a b = Dy.add a (Dy.neg b)` is `subDyadic`, `Dy.mul` is
    `mulDyadic` (numerators multiplied, exponents added).
  - `normalize` in TS strips the trailing zero bits: `num = q * 2^k` becomes `(q, exp + k)`, and a
    zero numerator becomes `(0, 0)`. `val_shift` and `val_zero` prove these steps keep the value.
  - `signDyadic` / `compareDyadic` read the sign of `num` (of `sub a b`); `val_pos_iff`,
    `val_neg_iff`, `val_eq_zero_iff` prove that is the sign of the value.
  - `decode E F` is the value `fromNumber` assigns to a non-negative finite double with biased
    exponent field `E` and fraction field `F` (subnormal: `F * 2^-1074`; normal:
    `(2^52 + F) * 2^(E - 1075)`); the sign bit negates `num`. `decode_frac_lt`, `decode_carry_lt`
    and `decode_subnormal_boundary` prove the decoding is strictly monotone in the bit pattern
    (the IEEE ordering property) and continuous across the subnormal/normal boundary.
* `orient2d` / `orient3d` are the determinants that `orient2dExact` / `orient3dExact` evaluate,
  with exactly the same expansion (Shewchuk's: differences against the last point; `orient3d` is
  the negated Shewchuk determinant so that it is positive when `d` is on the side of the plane
  `abc` that `(b - a) × (c - a)` points to). `orient2dDy` / `orient3dDy` are the same expression
  trees evaluated with `Dy` operations, and `orient2dDy_val` / `orient3dDy_val` prove they equal
  the rational determinants of the decoded inputs: the TS exact path computes the true sign.

NOT covered: the floating-point filter (its error bound is Shewchuk's published bound, argued in
the TS comment, not proved here), the bit-level decoding with `DataView` and the trailing-zero
count, bigint/number conversions, the representation of `exp` as a JS number, and `Result` errors.
-/
namespace CadloomFormal
namespace Exact

/-! ## Powers of two with integer exponents -/

/-- `2^e` for `e : Int`. -/
def pow2 : Int → Rat
  | .ofNat n => 2 ^ n
  | .negSucc n => 1 / 2 ^ (n + 1)

theorem two_pow_pos (n : Nat) : (0 : Rat) < 2 ^ n := Rat.pow_pos rfl

theorem pow2_pos (e : Int) : 0 < pow2 e := by
  cases e with
  | ofNat n => exact two_pow_pos n
  | negSucc n =>
    have h := Rat.inv_pos.mpr (two_pow_pos (n + 1))
    simp only [pow2]; grind

theorem pow2_succ (e : Int) : pow2 (e + 1) = 2 * pow2 e := by
  cases e with
  | ofNat n =>
    show pow2 (Int.ofNat (n + 1)) = _
    simp only [pow2, Rat.pow_succ]; grind
  | negSucc n =>
    have h := two_pow_pos n
    cases n with
    | zero => simp [pow2]; grind
    | succ m =>
      have : Int.negSucc (m + 1) + 1 = Int.negSucc m := by omega
      rw [this]; simp only [pow2, Rat.pow_succ] at *; grind

theorem pow2_sub_one (e : Int) : pow2 (e - 1) = pow2 e / 2 := by
  have := pow2_succ (e - 1); simp at this; grind

theorem pow2_add_nat (a : Int) (n : Nat) : pow2 (a + n) = pow2 a * 2 ^ n := by
  induction n with
  | zero => simp
  | succ n ih =>
    have : a + ((n + 1 : Nat) : Int) = (a + n) + 1 := by omega
    rw [this, pow2_succ, ih, Rat.pow_succ]; grind

theorem pow2_sub_nat (a : Int) (n : Nat) : pow2 (a - n) = pow2 a / 2 ^ n := by
  induction n with
  | zero => simp; grind
  | succ n ih =>
    have h := two_pow_pos n
    have : a - ((n + 1 : Nat) : Int) = (a - n) - 1 := by omega
    rw [this, pow2_sub_one, ih, Rat.pow_succ]; grind

/-- `2^(a + b) = 2^a * 2^b`: the law behind `mulDyadic`'s exponent sum. -/
theorem pow2_add (a b : Int) : pow2 (a + b) = pow2 a * pow2 b := by
  cases b with
  | ofNat n => exact pow2_add_nat a n
  | negSucc n =>
    have : a + Int.negSucc n = a - ((n + 1 : Nat) : Int) := by omega
    rw [this, pow2_sub_nat]; simp only [pow2]; grind

/-! ## Dyadic rationals -/

/-- `Dyadic`: the value `num * 2^exp`. -/
structure Dy where
  num : Int
  exp : Int

namespace Dy

def val (d : Dy) : Rat := (d.num : Rat) * pow2 d.exp

/-- `addDyadic` (before normalisation): align both numerators on the smaller exponent. -/
def add (a b : Dy) : Dy :=
  let m := min a.exp b.exp
  ⟨a.num * 2 ^ (a.exp - m).toNat + b.num * 2 ^ (b.exp - m).toNat, m⟩

def neg (a : Dy) : Dy := ⟨-a.num, a.exp⟩

/-- `subDyadic`. -/
def sub (a b : Dy) : Dy := add a (neg b)

/-- `mulDyadic`. -/
def mul (a b : Dy) : Dy := ⟨a.num * b.num, a.exp + b.exp⟩

/-- Shifting a numerator left by `k` is the same as an exponent `k` larger. -/
theorem val_shift (q : Int) (k : Nat) (e : Int) : val ⟨q * 2 ^ k, e⟩ = val ⟨q, e + k⟩ := by
  simp only [val, pow2_add_nat]; push_cast; grind

/-- `normalize` maps every zero to `(0, 0)`: the value is unchanged. -/
theorem val_zero (e : Int) : val ⟨0, e⟩ = val ⟨0, 0⟩ := by simp [val]

theorem add_correct (a b : Dy) : (add a b).val = a.val + b.val := by
  have ha : a.exp = min a.exp b.exp + ((a.exp - min a.exp b.exp).toNat : Int) := by omega
  have hb : b.exp = min a.exp b.exp + ((b.exp - min a.exp b.exp).toNat : Int) := by omega
  simp only [add, val]
  conv => rhs; rw [ha, hb, pow2_add_nat, pow2_add_nat]
  push_cast; grind

theorem neg_correct (a : Dy) : (neg a).val = -a.val := by
  simp only [neg, val]; push_cast; grind

theorem sub_correct (a b : Dy) : (sub a b).val = a.val - b.val := by
  simp only [sub, add_correct, neg_correct]; grind

theorem mul_correct (a b : Dy) : (mul a b).val = a.val * b.val := by
  simp only [mul, val, pow2_add]; push_cast; grind

theorem val_pos_of {d : Dy} (h : 0 < d.num) : 0 < d.val :=
  Rat.mul_pos (Rat.intCast_pos.mpr h) (pow2_pos _)

theorem val_neg_of {d : Dy} (h : d.num < 0) : d.val < 0 := by
  have := val_pos_of (d := neg d) (by simp only [neg]; omega)
  rw [neg_correct] at this; grind

theorem val_zero_of {d : Dy} (h : d.num = 0) : d.val = 0 := by simp [val, h]

/-- `signDyadic`: the sign of the value is the sign of the numerator. -/
theorem val_pos_iff (d : Dy) : 0 < d.val ↔ 0 < d.num := by
  rcases Int.lt_trichotomy d.num 0 with h | h | h
  · have := val_neg_of h; constructor <;> intro <;> grind
  · have := val_zero_of h; constructor <;> intro <;> grind
  · have := val_pos_of h; constructor <;> intro <;> grind

theorem val_eq_zero_iff (d : Dy) : d.val = 0 ↔ d.num = 0 := by
  rcases Int.lt_trichotomy d.num 0 with h | h | h
  · have := val_neg_of h; constructor <;> intro <;> grind
  · have := val_zero_of h; constructor <;> intro <;> grind
  · have := val_pos_of h; constructor <;> intro <;> grind

theorem val_neg_iff (d : Dy) : d.val < 0 ↔ d.num < 0 := by
  rcases Int.lt_trichotomy d.num 0 with h | h | h
  · have := val_neg_of h; constructor <;> intro <;> grind
  · have := val_zero_of h; constructor <;> intro <;> grind
  · have := val_pos_of h; constructor <;> intro <;> grind

/-- `compareDyadic a b` reads the sign of `(sub a b).num`. -/
theorem compare_lt_iff (a b : Dy) : a.val < b.val ↔ (sub a b).num < 0 := by
  rw [← val_neg_iff, sub_correct]; grind

end Dy

/-! ## Decoding IEEE doubles -/

/-- The implicit leading bit of a normal double, `2^52`. -/
def hiddenBit : Nat := 2 ^ 52

/-- The value `fromNumber` gives a non-negative finite double with exponent field `E` and fraction
field `F` (`F < 2^52`, `E < 2047`): subnormal `F * 2^-1074`, normal `(2^52 + F) * 2^(E - 1075)`. -/
def decode (E F : Nat) : Dy :=
  if E = 0 then ⟨F, -1074⟩ else ⟨(hiddenBit : Int) + F, (E : Int) - 1075⟩

/-- The subnormal formula continued to `F = 2^52` is the least normal number: the two branches of
`decode` agree at the boundary (no gap and no overlap between subnormals and normals). -/
theorem decode_subnormal_boundary : (decode 0 hiddenBit).val = (decode 1 0).val := by
  simp only [decode, Dy.val, if_pos, Nat.one_ne_zero, if_false]
  have e : ((1 : Nat) : Int) - 1075 = -1074 := by omega
  rw [e]; push_cast; grind

/-- Within one binade, a larger fraction field is a larger value. -/
theorem decode_frac_lt (E F : Nat) : (decode E F).val < (decode E (F + 1)).val := by
  have h := pow2_pos ((E : Int) - 1075)
  have h' := pow2_pos (-1074)
  simp only [decode, Dy.val]
  split <;> push_cast <;> grind

/-- The largest fraction of a binade (`F + 1 = 2^52`) is below the start of the next binade. -/
theorem decode_carry_lt (E F : Nat) (hF : F + 1 = hiddenBit) :
    (decode E F).val < (decode (E + 1) 0).val := by
  cases E with
  | zero =>
    have h := pow2_pos (-1074)
    simp only [decode, Dy.val, if_pos, Nat.add_one_ne_zero, if_false]
    have e : (((0 + 1 : Nat)) : Int) - 1075 = -1074 := by omega
    rw [e]
    have : (F : Rat) + 1 = (hiddenBit : Rat) := by
      have := congrArg (fun n : Nat => (n : Rat)) hF; simpa using this
    push_cast; rw [← this]; grind
  | succ n =>
    have h := pow2_pos ((n + 1 : Nat) - 1075 : Int)
    have e : (((n + 1 + 1 : Nat) : Int) - 1075) = (((n + 1 : Nat) : Int) - 1075) + 1 := by omega
    have : (F : Rat) + 1 = (hiddenBit : Rat) := by
      have := congrArg (fun n : Nat => (n : Rat)) hF; simpa using this
    simp only [decode, Dy.val, Nat.add_one_ne_zero, if_false, e, pow2_succ]
    push_cast; rw [← this]; grind

/-! ## Orientation determinants -/

structure P2 where
  x : Rat
  y : Rat

structure P3 where
  x : Rat
  y : Rat
  z : Rat

/-- `orient2d`, Shewchuk's expansion `(ax - cx)(by - cy) - (ay - cy)(bx - cx)`: positive when
`a, b, c` turn counterclockwise. -/
def orient2d (a b c : P2) : Rat :=
  (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x)

/-- `orient3d`: minus Shewchuk's determinant of `a - d, b - d, c - d`, expanded along the `z`
column exactly as Shewchuk's (and the TS) code groups it.
Positive when `d` is on the side of plane `abc` that `(b - a) × (c - a)` points to. -/
def orient3d (a b c d : P3) : Rat :=
  let adx := a.x - d.x; let ady := a.y - d.y; let adz := a.z - d.z
  let bdx := b.x - d.x; let bdy := b.y - d.y; let bdz := b.z - d.z
  let cdx := c.x - d.x; let cdy := c.y - d.y; let cdz := c.z - d.z;
  -(adz * (bdx * cdy - cdx * bdy) + bdz * (cdx * ady - adx * cdy) + cdz * (adx * bdy - bdx * ady))

theorem orient2d_swap_ab (a b c : P2) : orient2d b a c = -orient2d a b c := by
  simp only [orient2d]; grind

theorem orient2d_swap_bc (a b c : P2) : orient2d a c b = -orient2d a b c := by
  simp only [orient2d]; grind

theorem orient2d_swap_ac (a b c : P2) : orient2d c b a = -orient2d a b c := by
  simp only [orient2d]; grind

theorem orient2d_cyclic (a b c : P2) : orient2d b c a = orient2d a b c := by
  simp only [orient2d]; grind

def P2.shift (p : P2) (v : P2) : P2 := ⟨p.x + v.x, p.y + v.y⟩

theorem orient2d_translate (a b c v : P2) :
    orient2d (a.shift v) (b.shift v) (c.shift v) = orient2d a b c := by
  simp only [orient2d, P2.shift]; grind

/-- A point `c = (1 - t) a + t b` on the line `ab` has orientation zero. -/
theorem orient2d_collinear (a b : P2) (t : Rat) :
    orient2d a b ⟨(1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y⟩ = 0 := by
  simp only [orient2d]; grind

/-- The determinant is `(b - a) × (c - a)`: the counterclockwise convention. -/
theorem orient2d_eq_cross (a b c : P2) :
    orient2d a b c = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) := by
  simp only [orient2d]; grind

theorem orient3d_swap_ab (a b c d : P3) : orient3d b a c d = -orient3d a b c d := by
  simp only [orient3d]; grind

theorem orient3d_swap_bc (a b c d : P3) : orient3d a c b d = -orient3d a b c d := by
  simp only [orient3d]; grind

theorem orient3d_swap_cd (a b c d : P3) : orient3d a b d c = -orient3d a b c d := by
  simp only [orient3d]; grind

theorem orient3d_swap_ad (a b c d : P3) : orient3d d b c a = -orient3d a b c d := by
  simp only [orient3d]; grind

def P3.shift (p : P3) (v : P3) : P3 := ⟨p.x + v.x, p.y + v.y, p.z + v.z⟩

theorem orient3d_translate (a b c d v : P3) :
    orient3d (a.shift v) (b.shift v) (c.shift v) (d.shift v) = orient3d a b c d := by
  simp only [orient3d, P3.shift]; grind

/-- A point `d = (1 - s - t) a + s b + t c` on the plane `abc` has orientation zero. -/
theorem orient3d_coplanar (a b c : P3) (s t : Rat) :
    orient3d a b c ⟨(1 - s - t) * a.x + s * b.x + t * c.x,
                    (1 - s - t) * a.y + s * b.y + t * c.y,
                    (1 - s - t) * a.z + s * b.z + t * c.z⟩ = 0 := by
  simp only [orient3d]; grind

/-- The determinant is the triple product `((b - a) × (c - a)) · (d - a)`. -/
theorem orient3d_eq_triple (a b c d : P3) :
    orient3d a b c d =
      ((b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)) * (d.x - a.x) +
      ((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)) * (d.y - a.y) +
      ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * (d.z - a.z) := by
  simp only [orient3d]; grind

/-! ## The exact path: the same expressions over dyadics -/

structure D2 where
  x : Dy
  y : Dy

structure D3 where
  x : Dy
  y : Dy
  z : Dy

def D2.val (p : D2) : P2 := ⟨p.x.val, p.y.val⟩
def D3.val (p : D3) : P3 := ⟨p.x.val, p.y.val, p.z.val⟩

/-- `orient2dExact`'s dyadic expression tree. -/
def orient2dDy (a b c : D2) : Dy :=
  Dy.sub (Dy.mul (Dy.sub a.x c.x) (Dy.sub b.y c.y)) (Dy.mul (Dy.sub a.y c.y) (Dy.sub b.x c.x))

/-- `orient3dExact`'s dyadic expression tree (the final negation is applied to the sign). -/
def orient3dDy (a b c d : D3) : Dy :=
  let adx := Dy.sub a.x d.x; let ady := Dy.sub a.y d.y; let adz := Dy.sub a.z d.z
  let bdx := Dy.sub b.x d.x; let bdy := Dy.sub b.y d.y; let bdz := Dy.sub b.z d.z
  let cdx := Dy.sub c.x d.x; let cdy := Dy.sub c.y d.y; let cdz := Dy.sub c.z d.z;
  Dy.neg (Dy.add (Dy.add
    (Dy.mul adz (Dy.sub (Dy.mul bdx cdy) (Dy.mul cdx bdy)))
    (Dy.mul bdz (Dy.sub (Dy.mul cdx ady) (Dy.mul adx cdy))))
    (Dy.mul cdz (Dy.sub (Dy.mul adx bdy) (Dy.mul bdx ady))))

theorem orient2dDy_val (a b c : D2) : (orient2dDy a b c).val = orient2d a.val b.val c.val := by
  simp only [orient2dDy, orient2d, D2.val, Dy.sub_correct, Dy.mul_correct]

theorem orient3dDy_val (a b c d : D3) :
    (orient3dDy a b c d).val = orient3d a.val b.val c.val d.val := by
  simp only [orient3dDy, orient3d, D3.val, Dy.neg_correct, Dy.add_correct, Dy.sub_correct,
    Dy.mul_correct]

/-- The exact path's sign: the numerator of the dyadic result has the determinant's sign. -/
theorem orient2dDy_sign (a b c : D2) :
    (0 < orient2d a.val b.val c.val ↔ 0 < (orient2dDy a b c).num) ∧
    (orient2d a.val b.val c.val = 0 ↔ (orient2dDy a b c).num = 0) := by
  rw [← orient2dDy_val]; exact ⟨Dy.val_pos_iff _, Dy.val_eq_zero_iff _⟩

theorem orient3dDy_sign (a b c d : D3) :
    (0 < orient3d a.val b.val c.val d.val ↔ 0 < (orient3dDy a b c d).num) ∧
    (orient3d a.val b.val c.val d.val = 0 ↔ (orient3dDy a b c d).num = 0) := by
  rw [← orient3dDy_val]; exact ⟨Dy.val_pos_iff _, Dy.val_eq_zero_iff _⟩

end Exact
end CadloomFormal
