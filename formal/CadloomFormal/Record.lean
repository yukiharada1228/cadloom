/-!
# Record: the index structure of a B-rep record, its range check and its word serialisation

Models (exactly, over `Nat`/`Bool`/`List`/`Option`) the index structure of a B-rep record
(`src/record/topology.ts`):

* `Rec` is `RecordTopology`: the geometry arena counts (`counts.vertices`, `curves`, `surfaces`,
  `pcurves`) and the index tuples of edges `(curve, start, end)` (`stop` here, `end` being a Lean keyword),
  coedges `(edge, reversed, loop, next, prev, pcurve?)`, loops `(face, first)`, faces
  `(shell, surface, reversed, loops)`, shells `(body, faces)` and bodies `(shells)`.
  A coedge's optional pcurve is `Option Nat` (`number | null` in TS).
* `validate` is `topologyRangeIssue(t) === undefined` (the range check that `parseRecord` runs): the same
  checks in the same order: edges (`curve < nCurves`, `start < nVertices`, `stop < nVertices`), coedges
  (`edge < |edges|`, `loop < |loops|`, `next < |coedges|`, `prev < |coedges|`, `pcurve < nPcurves` when
  present), loops (`face < |faces|`, `first < |coedges|`), faces (`shell < |shells|`, `surface < nSurfaces`,
  each loop `< |loops|`), shells (`body < |bodies|`, each face `< |faces|`), bodies (each shell
  `< |shells|`). TS returns the first failing field; the Bool conjunction here fails exactly when TS
  reports some field.
* `encode` / `decode` are `encodeRecordTopology` / `decodeRecordTopology`: the counts, then each arena as
  its length followed by its items, flags as `0`/`1`, an optional pcurve as `0` (none) or `k + 1`, index
  lists length-prefixed.

Theorems:
* `validate_iff` — `validate r = true` iff every index field is below the size of the arena it names.
* `validate_complete` — if every index is in range, `validate r = true` (completeness of the range check).
* `validate_sound_edges`, `validate_sound_coedges`, `validate_sound_loops`, `validate_sound_faces`,
  `validate_sound_shells`, `validate_sound_bodies` — soundness: when `validate r = true`, every lookup by
  an index of an item at position `i` succeeds (`xs[j]? = some _`), both into the topology arenas of `r`
  and into any geometry arrays (`vertices`, `curves`, `surfaces`, `pcurves`) of the declared counts.
* `decList_encList` — length-prefixed lists decode back, whatever follows them (the general lemma).
* `decode_encode` — `decode (encode r) = some r` for every record topology `r`.
* `decode_encode_validate` — decoding preserves the range check (a corollary).

Not covered: the shape checks of `parseRecord` (JSON types, finite numbers, unknown fields, item budget,
NURBS count consistency), the geometry payloads, canonical JSON text (`stringifyRecord`), the TS early
length guard of `decodeRecordTopology` (it only refuses inputs that would run out of words anyway), the
builder-order check and the conversion to the kernel (`src/convert`), and run-time exceptions.
-/
namespace CadloomFormal
namespace Record

structure EdgeR where
  curve : Nat
  start : Nat
  stop : Nat
deriving DecidableEq, Repr

structure CoedgeR where
  edge : Nat
  reversed : Bool
  loop : Nat
  next : Nat
  prev : Nat
  pcurve : Option Nat
deriving DecidableEq, Repr

structure LoopR where
  face : Nat
  first : Nat
deriving DecidableEq, Repr

structure FaceR where
  shell : Nat
  surface : Nat
  reversed : Bool
  loops : List Nat
deriving DecidableEq, Repr

structure ShellR where
  body : Nat
  faces : List Nat
deriving DecidableEq, Repr

structure BodyR where
  shells : List Nat
deriving DecidableEq, Repr

/-- `RecordTopology`: geometry arena counts and topology arenas. -/
structure Rec where
  nVertices : Nat
  nCurves : Nat
  nSurfaces : Nat
  nPcurves : Nat
  edges : List EdgeR
  coedges : List CoedgeR
  loops : List LoopR
  faces : List FaceR
  shells : List ShellR
  bodies : List BodyR
deriving DecidableEq, Repr

/-! ## The range check (`topologyRangeIssue`) -/

def edgeOk (r : Rec) (e : EdgeR) : Bool :=
  decide (e.curve < r.nCurves) && decide (e.start < r.nVertices) && decide (e.stop < r.nVertices)

def pcurveOk (r : Rec) : Option Nat → Bool
  | none => true
  | some p => decide (p < r.nPcurves)

def coedgeOk (r : Rec) (c : CoedgeR) : Bool :=
  decide (c.edge < r.edges.length) && decide (c.loop < r.loops.length) &&
    decide (c.next < r.coedges.length) && decide (c.prev < r.coedges.length) && pcurveOk r c.pcurve

def loopOk (r : Rec) (l : LoopR) : Bool :=
  decide (l.face < r.faces.length) && decide (l.first < r.coedges.length)

def faceOk (r : Rec) (f : FaceR) : Bool :=
  decide (f.shell < r.shells.length) && decide (f.surface < r.nSurfaces) &&
    f.loops.all (fun l => decide (l < r.loops.length))

def shellOk (r : Rec) (s : ShellR) : Bool :=
  decide (s.body < r.bodies.length) && s.faces.all (fun f => decide (f < r.faces.length))

def bodyOk (r : Rec) (b : BodyR) : Bool :=
  b.shells.all (fun s => decide (s < r.shells.length))

/-- The range check, arenas in the TS order. -/
def validate (r : Rec) : Bool :=
  r.edges.all (edgeOk r) && r.coedges.all (coedgeOk r) && r.loops.all (loopOk r) &&
    r.faces.all (faceOk r) && r.shells.all (shellOk r) && r.bodies.all (bodyOk r)

/-- Every index field is in range (the specification of `validate`). -/
def InRange (r : Rec) : Prop :=
  (∀ e ∈ r.edges, e.curve < r.nCurves ∧ e.start < r.nVertices ∧ e.stop < r.nVertices) ∧
  (∀ c ∈ r.coedges, c.edge < r.edges.length ∧ c.loop < r.loops.length ∧ c.next < r.coedges.length ∧
      c.prev < r.coedges.length ∧ ∀ p, c.pcurve = some p → p < r.nPcurves) ∧
  (∀ l ∈ r.loops, l.face < r.faces.length ∧ l.first < r.coedges.length) ∧
  (∀ f ∈ r.faces, f.shell < r.shells.length ∧ f.surface < r.nSurfaces ∧ ∀ l ∈ f.loops, l < r.loops.length) ∧
  (∀ s ∈ r.shells, s.body < r.bodies.length ∧ ∀ f ∈ s.faces, f < r.faces.length) ∧
  (∀ b ∈ r.bodies, ∀ s ∈ b.shells, s < r.shells.length)

theorem pcurveOk_iff (r : Rec) (o : Option Nat) : pcurveOk r o = true ↔ ∀ p, o = some p → p < r.nPcurves := by
  cases o <;> simp [pcurveOk]

theorem validate_iff (r : Rec) : validate r = true ↔ InRange r := by
  simp only [validate, InRange, Bool.and_eq_true, List.all_eq_true, edgeOk, coedgeOk, loopOk, faceOk,
    shellOk, bodyOk, decide_eq_true_eq, pcurveOk_iff, and_assoc]

theorem validate_complete (r : Rec) (h : InRange r) : validate r = true := (validate_iff r).2 h

/-- An index below a list's length looks up an item. -/
theorem getElem?_some_of_lt {α : Type} (xs : List α) (j : Nat) (h : j < xs.length) : ∃ x, xs[j]? = some x :=
  ⟨xs[j], List.getElem?_eq_getElem h⟩

theorem mem_of_getElem? {α : Type} {xs : List α} {i : Nat} {x : α} (h : xs[i]? = some x) : x ∈ xs :=
  List.mem_of_getElem? h

theorem validate_sound_edges (r : Rec) (hv : validate r = true) (i : Nat) (e : EdgeR)
    (he : r.edges[i]? = some e) {G : Type} (vertices curves : List G)
    (hV : vertices.length = r.nVertices) (hC : curves.length = r.nCurves) :
    (∃ c, curves[e.curve]? = some c) ∧ (∃ v, vertices[e.start]? = some v) ∧ (∃ v, vertices[e.stop]? = some v) := by
  have h := ((validate_iff r).1 hv).1 e (mem_of_getElem? he)
  exact ⟨getElem?_some_of_lt _ _ (by omega), getElem?_some_of_lt _ _ (by omega),
    getElem?_some_of_lt _ _ (by omega)⟩

theorem validate_sound_coedges (r : Rec) (hv : validate r = true) (i : Nat) (c : CoedgeR)
    (hc : r.coedges[i]? = some c) {G : Type} (pcurves : List G) (hP : pcurves.length = r.nPcurves) :
    (∃ e, r.edges[c.edge]? = some e) ∧ (∃ l, r.loops[c.loop]? = some l) ∧
      (∃ n, r.coedges[c.next]? = some n) ∧ (∃ p, r.coedges[c.prev]? = some p) ∧
      (∀ k, c.pcurve = some k → ∃ g, pcurves[k]? = some g) := by
  have h := ((validate_iff r).1 hv).2.1 c (mem_of_getElem? hc)
  refine ⟨getElem?_some_of_lt _ _ h.1, getElem?_some_of_lt _ _ h.2.1, getElem?_some_of_lt _ _ h.2.2.1,
    getElem?_some_of_lt _ _ h.2.2.2.1, fun k hk => getElem?_some_of_lt _ _ ?_⟩
  have := h.2.2.2.2 k hk
  omega

theorem validate_sound_loops (r : Rec) (hv : validate r = true) (i : Nat) (l : LoopR)
    (hl : r.loops[i]? = some l) :
    (∃ f, r.faces[l.face]? = some f) ∧ (∃ c, r.coedges[l.first]? = some c) := by
  have h := ((validate_iff r).1 hv).2.2.1 l (mem_of_getElem? hl)
  exact ⟨getElem?_some_of_lt _ _ h.1, getElem?_some_of_lt _ _ h.2⟩

theorem validate_sound_faces (r : Rec) (hv : validate r = true) (i : Nat) (f : FaceR)
    (hf : r.faces[i]? = some f) {G : Type} (surfaces : List G) (hS : surfaces.length = r.nSurfaces) :
    (∃ s, r.shells[f.shell]? = some s) ∧ (∃ g, surfaces[f.surface]? = some g) ∧
      (∀ k l : Nat, f.loops[k]? = some l → ∃ lr, r.loops[l]? = some lr) := by
  have h := ((validate_iff r).1 hv).2.2.2.1 f (mem_of_getElem? hf)
  refine ⟨getElem?_some_of_lt _ _ h.1, getElem?_some_of_lt _ _ (by omega), fun k l hk => ?_⟩
  exact getElem?_some_of_lt _ _ (h.2.2 l (mem_of_getElem? hk))

theorem validate_sound_shells (r : Rec) (hv : validate r = true) (i : Nat) (s : ShellR)
    (hs : r.shells[i]? = some s) :
    (∃ b, r.bodies[s.body]? = some b) ∧ (∀ k f : Nat, s.faces[k]? = some f → ∃ fr, r.faces[f]? = some fr) := by
  have h := ((validate_iff r).1 hv).2.2.2.2.1 s (mem_of_getElem? hs)
  exact ⟨getElem?_some_of_lt _ _ h.1, fun k f hk => getElem?_some_of_lt _ _ (h.2 f (mem_of_getElem? hk))⟩

theorem validate_sound_bodies (r : Rec) (hv : validate r = true) (i : Nat) (b : BodyR)
    (hb : r.bodies[i]? = some b) :
    ∀ k s : Nat, b.shells[k]? = some s → ∃ sr, r.shells[s]? = some sr := by
  have h := ((validate_iff r).1 hv).2.2.2.2.2 b (mem_of_getElem? hb)
  exact fun k s hk => getElem?_some_of_lt _ _ (h s (mem_of_getElem? hk))

/-! ## Word serialisation (`encodeRecordTopology` / `decodeRecordTopology`) -/

/-- A decoder reads an item off the front of the words and returns the rest. -/
abbrev Dec (α : Type) := List Nat → Option (α × List Nat)

def encList {α : Type} (f : α → List Nat) (xs : List α) : List Nat := xs.length :: xs.flatMap f

def decN {α : Type} (d : Dec α) : Nat → Dec (List α)
  | 0, ws => some ([], ws)
  | n + 1, ws =>
    match d ws with
    | none => none
    | some (x, ws') =>
      match decN d n ws' with
      | none => none
      | some (xs, ws'') => some (x :: xs, ws'')

def decList {α : Type} (d : Dec α) : Dec (List α)
  | [] => none
  | n :: ws => decN d n ws

theorem decN_flatMap {α : Type} (f : α → List Nat) (d : Dec α)
    (hd : ∀ x rest, d (f x ++ rest) = some (x, rest)) (xs : List α) (rest : List Nat) :
    decN d xs.length (xs.flatMap f ++ rest) = some (xs, rest) := by
  induction xs with
  | nil => simp [decN]
  | cons x xs ih => simp [decN, List.flatMap_cons, List.append_assoc, hd, ih]

theorem decList_encList {α : Type} (f : α → List Nat) (d : Dec α)
    (hd : ∀ x rest, d (f x ++ rest) = some (x, rest)) (xs : List α) (rest : List Nat) :
    decList d (encList f xs ++ rest) = some (xs, rest) := by
  simp [encList, decList, decN_flatMap f d hd]

def encBool (b : Bool) : Nat := if b then 1 else 0

def decBool : Nat → Option Bool
  | 0 => some false
  | 1 => some true
  | _ => none

theorem decBool_encBool (b : Bool) : decBool (encBool b) = some b := by cases b <;> rfl

def encOpt : Option Nat → Nat
  | none => 0
  | some k => k + 1

def decOpt : Nat → Option Nat
  | 0 => none
  | k + 1 => some k

theorem decOpt_encOpt (o : Option Nat) : decOpt (encOpt o) = o := by cases o <;> rfl

def encNat (n : Nat) : List Nat := [n]

def decNat : Dec Nat
  | n :: ws => some (n, ws)
  | [] => none

theorem decNat_encNat (n : Nat) (rest : List Nat) : decNat (encNat n ++ rest) = some (n, rest) := rfl

def encEdge (e : EdgeR) : List Nat := [e.curve, e.start, e.stop]

def decEdge : Dec EdgeR
  | c :: s :: t :: ws => some (⟨c, s, t⟩, ws)
  | _ => none

def encCoedge (c : CoedgeR) : List Nat := [c.edge, encBool c.reversed, c.loop, c.next, c.prev, encOpt c.pcurve]

def decCoedge : Dec CoedgeR
  | e :: b :: l :: n :: p :: o :: ws =>
    match decBool b with
    | none => none
    | some rev => some (⟨e, rev, l, n, p, decOpt o⟩, ws)
  | _ => none

def encLoop (l : LoopR) : List Nat := [l.face, l.first]

def decLoop : Dec LoopR
  | f :: c :: ws => some (⟨f, c⟩, ws)
  | _ => none

def encFace (f : FaceR) : List Nat := [f.shell, f.surface, encBool f.reversed] ++ encList encNat f.loops

def decFace : Dec FaceR
  | s :: g :: b :: ws =>
    match decBool b with
    | none => none
    | some rev =>
      match decList decNat ws with
      | none => none
      | some (ls, ws') => some (⟨s, g, rev, ls⟩, ws')
  | _ => none

def encShell (s : ShellR) : List Nat := s.body :: encList encNat s.faces

def decShell : Dec ShellR
  | b :: ws =>
    match decList decNat ws with
    | none => none
    | some (fs, ws') => some (⟨b, fs⟩, ws')
  | [] => none

def encBody (b : BodyR) : List Nat := encList encNat b.shells

def decBody : Dec BodyR := fun ws =>
  match decList decNat ws with
  | none => none
  | some (ss, ws') => some (⟨ss⟩, ws')

theorem decEdge_encEdge (e : EdgeR) (rest : List Nat) : decEdge (encEdge e ++ rest) = some (e, rest) := rfl

theorem decCoedge_encCoedge (c : CoedgeR) (rest : List Nat) : decCoedge (encCoedge c ++ rest) = some (c, rest) := by
  cases c with
  | mk e b l n p o => cases b <;> cases o <;> rfl

theorem decLoop_encLoop (l : LoopR) (rest : List Nat) : decLoop (encLoop l ++ rest) = some (l, rest) := rfl

theorem decFace_encFace (f : FaceR) (rest : List Nat) : decFace (encFace f ++ rest) = some (f, rest) := by
  cases f with
  | mk s g b ls =>
    have h := decList_encList encNat decNat decNat_encNat ls rest
    cases b <;> simp [encFace, decFace, encBool, decBool, h]

theorem decShell_encShell (s : ShellR) (rest : List Nat) : decShell (encShell s ++ rest) = some (s, rest) := by
  cases s with
  | mk b fs =>
    have h := decList_encList encNat decNat decNat_encNat fs rest
    simp [encShell, decShell, h]

theorem decBody_encBody (b : BodyR) (rest : List Nat) : decBody (encBody b ++ rest) = some (b, rest) := by
  cases b with
  | mk ss =>
    have h := decList_encList encNat decNat decNat_encNat ss rest
    simp [encBody, decBody, h]

/-- `encodeRecordTopology`. -/
def encode (r : Rec) : List Nat :=
  [r.nVertices, r.nCurves, r.nSurfaces, r.nPcurves] ++ encList encEdge r.edges ++ encList encCoedge r.coedges ++
    encList encLoop r.loops ++ encList encFace r.faces ++ encList encShell r.shells ++ encList encBody r.bodies

/-- The words of a record topology, and the rest (the body of `decodeRecordTopology`). -/
def decRec : Dec Rec
  | nV :: nC :: nS :: nP :: ws =>
    match decList decEdge ws with
    | none => none
    | some (es, ws) =>
      match decList decCoedge ws with
      | none => none
      | some (cs, ws) =>
        match decList decLoop ws with
        | none => none
        | some (ls, ws) =>
          match decList decFace ws with
          | none => none
          | some (fs, ws) =>
            match decList decShell ws with
            | none => none
            | some (ss, ws) =>
              match decList decBody ws with
              | none => none
              | some (bs, ws) => some (⟨nV, nC, nS, nP, es, cs, ls, fs, ss, bs⟩, ws)
  | _ => none

/-- `decodeRecordTopology`: the whole input must be one record topology (no trailing words). -/
def decode (ws : List Nat) : Option Rec :=
  match decRec ws with
  | some (r, []) => some r
  | _ => none

theorem decRec_encode (r : Rec) (rest : List Nat) : decRec (encode r ++ rest) = some (r, rest) := by
  cases r with
  | mk nV nC nS nP es cs ls fs ss bs =>
    simp only [encode, List.append_assoc, List.cons_append, List.nil_append, decRec,
      decList_encList encEdge decEdge decEdge_encEdge,
      decList_encList encCoedge decCoedge decCoedge_encCoedge,
      decList_encList encLoop decLoop decLoop_encLoop,
      decList_encList encFace decFace decFace_encFace,
      decList_encList encShell decShell decShell_encShell,
      decList_encList encBody decBody decBody_encBody]

theorem decode_encode (r : Rec) : decode (encode r) = some r := by
  have h := decRec_encode r []
  rw [List.append_nil] at h
  simp [decode, h]

theorem decode_encode_validate (r : Rec) (r' : Rec) (h : decode (encode r) = some r') :
    validate r' = validate r := by
  rw [decode_encode] at h
  cases h
  rfl

/-! ## Non-vacuity: a one-face record (a disc bounded by one closed edge) passes the check. -/

def disc : Rec :=
  { nVertices := 1, nCurves := 1, nSurfaces := 1, nPcurves := 1,
    edges := [⟨0, 0, 0⟩], coedges := [⟨0, false, 0, 0, 0, some 0⟩], loops := [⟨0, 0⟩],
    faces := [⟨0, 0, false, [0]⟩], shells := [⟨0, [0]⟩], bodies := [⟨[0]⟩] }

theorem disc_valid : validate disc = true := by decide

theorem disc_bad_loop : validate { disc with faces := [⟨0, 0, false, [1]⟩] } = false := by decide

theorem disc_roundtrip : decode (encode disc) = some disc := decode_encode disc

end Record
end CadloomFormal
