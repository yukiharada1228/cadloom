# Bounded cylinder material with operand-local halfspaces

`boundaryCylinderMaterialExpression3(cylinders, planes, expression)` constructs the regularized boundary of a bounded Boolean program. Leaves are filled finite cylinders or the negative side of rational planes. Binary union/intersection/difference/xor nodes retain each operand's predicates inside the expression: `(A ∩ H) ∪ B` does not apply `H` to `B`.

`booleanCylinderMaterials3` composes actual owned clipped-expression or material-boundary results, and its output is another reusable material boundary. `clipCylinderMaterial3` adds more halfspace predicates to an existing material program. These are lower-level kernel results; common Body adoption/persistent recipes for the new mixed-predicate family are not connected yet.

## Boundedness and ownership

A finite rational plane working rectangle is only valid for bounded material. The factory therefore computes a conservative Boolean interval with all cylinder leaves false and every plane leaf unknown. A false upper bound certifies the result is contained in the union of its finite cylinders. Every Boolean composition of bounded operands preserves this certificate. Bare/unbounded halfspace programs reject rather than being silently truncated by a working rectangle. The guard is a sufficient structural certificate, not a complete logical boundedness solver for arbitrary rewritten plane formulas.

Cylinders must be actual factory-owned primitives; planes and expression nodes are validated immutable snapshots. Cycles, invalid indices and unknown operations reject. Composition remaps cylinder/plane IDs and deduplicates only actual immutable object identities; it never trusts serialized provenance or textual root IDs. Clipped operands contribute their complete original finite-cylinder expression conjoined with every normalized local halfspace.

## Exact two-sided boundary selection

Every cylinder wall and cap is arranged against all finite-cylinder supports and all planes. Every plane has a rational working rectangle strictly enclosing all possible material sections and is arranged against the same complete definitions. The existing section rectangle construction is shared through `finiteCylinderPlaneDomain3`; its rational bound and coordinate chart are unchanged.

Strict primitive locations remain unchanged on both sides of an open candidate face. A boundary cylinder location must come from a coincident wall or axial cap; a zero plane sign must have a coincident plane support. Exact physical-normal signs determine each predicate's two values. The complete material expression is evaluated on both truth vectors. Equal results discard an internal face; differing results select its physical orientation. A deterministic support-carrier priority emits each coincident patch once, including plane/cap or reversed-plane coincidence.

All selected mixed faces are independently sewn with whole-curve support and endpoint noding checks. Unbalanced edges reject; balanced nonmanifold results remain explicit. Plane faces created by subtraction can carry the reverse orientation, not just the original clipping orientation.

## Regularized queries

Strict cylinder/plane locations determine material directly. Otherwise selected face-domain closures identify actual output boundaries. Discarded primitive boundaries use exact symbolic infinitesimal directions `(1,k,k²)`: linear derivatives determine plane/cap signs and cylinder radial derivatives use the quadratic term when necessary. Degenerate directions retry. Finite nonzero support normals exclude only finitely many such directions, with no floating epsilon. Once no output boundary is incident, generic-direction truth gives the common local interior/exterior value.

## Validation and limits

Six new tests passed in a connected ten-test group: all four operations with separate operand cuts against independent rational grids; reversed-plane internal-cap cancellation and regularized seam queries; coincident cap carriers and tangent-only emptiness; clipped SSI subtraction with reversed plane faces and independent inequalities; unsafe/cyclic/index/ownership rejection and immutable snapshots; and clipped-result union → difference → further-cut reuse. The prior section tests also pass after the rectangle-helper extraction.

This backend enables constructive clipped-operand Booleans at the kernel level. New-family domain persistence, derived regions/common Body adoption and public Body dispatch remain required. General analytic/NURBS material, maximal consolidation, full lower-dimensional contact classification and SolidCraft parity remain incomplete. No new Lean theorem or full execution-refinement proof is claimed.

The complete source-43 isolated suite passed all 806 non-hard tests in one invocation (153185 ms), including existing section/Body replay cases after sharing the rectangle helper. The existing scoped audit passed 133 declarations after reviewing the added/changed source inventory. The old no-cut hard two-test file was not rerun for this new backend; no source-43 hard result, whole-program proof or controlled speed claim is made.
