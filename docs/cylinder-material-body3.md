# Reusable clipped cylinder-family Body Booleans

`booleanCylinderBodies3` now retains operand-local halfspaces when either owned operand is a native clipped cylinder, a single/multi-cut expression or a prior mixed-predicate material Body. Uncut inputs keep their existing construction path. `clipCylinderExpressionBody3` also accepts the new Boolean results without flattening their local predicates into global conditions.

An actual owned backend supplies each operand's finite-cylinder expression and all local constraints. The material constructor composes these formulas, validates boundedness, constructs the complete boundary and independently checks signed edge balance. Native clipped-cylinder constraints, old single-cut conditions and restored multi-cut programs are retained rather than recasting any operand as a bare cylinder. Unrelated Body families and copied ownership reject.

## Complete persistence and derived material

`bodyRecordFromCylinderMaterial3` exports every selected cylindrical wall, primitive cap and plane carrier with its complete domain and chosen orientation. In particular, subtracting a clipped operand can reverse a halfspace face; the domain codec preserves that reversal. The existing mixed decoder still checks actual geometry, support, shell connectivity, domain orientation and entire boundary-set correspondence.

`cylinderMaterialRegions3` only accepts an actual manifold constructive material boundary. It restores/binds the boundary, derives nesting/coorientation and strict rational witnesses using the existing complete-line algorithm, and retains an identity-bound checked result. Witnesses on any primitive/plane boundary retry. Body adoption reuses that geometry and checks manifold incidence, issue absence, sample count and membership before registering ownership. Balanced nonmanifold results remain lower-level objects and cannot acquire Body3 ownership.

The `cylinder-material-expression` construction recipe stores finite cylinders, oriented negative-side planes and the complete cylinder/halfspace Boolean tree. The strict reader snapshots/budgets fields and detects cycles. Restoration regenerates bounded material, derives its regions and compares the entire ordered BodyRecord. Unbounded formulas, invalid indices, mismatched material/void records or altered formula claims do not bypass geometric validation. Earlier tags remain accepted; older readers do not understand this new tag.

## Reuse and limits

Restored material Bodies retain actual factory state and can participate in subsequent Booleans or cuts. Composition preserves each input's predicates and registers a new immutable result; it does not change prior Bodies. Empty/disconnected material and nested cavities/islands persist.

Common Body adoption remains restricted to manifold material. For example, overlapping XOR operands may produce balanced nonmanifold contacts and are rejected by Body3, while `booleanCylinderMaterials3` retains those boundaries. General planar/box-versus-cylinder dispatch, other analytic/NURBS material, maximal face consolidation, complete contact/rejoin metadata and interactive performance remain incomplete.

## Validation

The connected 17-test group passed, including six new end-to-end cases: all four operations on disjoint independently clipped operands; nontrivial overlapping union/intersection/difference and nonmanifold XOR rejection; restore → difference → later-cut reuse; nested cavity/island region roles and checked-geometry identity; tampered/unbounded/cyclic/index/ownership data; and SSI-bearing clipped difference with reversed plane faces and complete replay. Original strict face samples remain inside restored domains and every returned material sample is inside the adopted Body.

Two previous unsupported-clipping expectations were replaced with positive cut-preservation checks. Existing native-only and copied-ownership guards remain checked. Broader final results are recorded separately. No new Lean theorem or full execution-refinement proof is claimed.

The full non-hard regression invocation passed all 812 tests (about 190 seconds). The unchanged slow two-test oblique integration file was excluded and was not rerun for this milestone. The source inventory/arithmetic correspondence checks and existing 133-declaration Lean axiom audit passed; this remains scoped geometry/arithmetic verification, not verification of full TypeScript execution.
