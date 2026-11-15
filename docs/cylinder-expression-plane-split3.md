# Closed plane-cut boundaries of cylinder expressions

`splitFiniteCylinderExpressionByPlane3` consumes an actual owned finite-cylinder expression and returns negative/positive closed mixed-boundary children, their material queries, common section data and immediate face provenance. It does not yet return common `Body3` objects or persistent/reusable clipped construction recipes.

## Refining the existing material boundary

Each existing primitive-wall arrangement is refined by the cut plane. Its immediate source-cell IDs map each new cell to the original selected expression face. Original Boolean orientation and support are retained; the new final plane-side column chooses the child.

Primitive cap arrangements are rebuilt with the same walls/cap planes plus the cut plane. The unchanged chart and retained original events make this a refinement of the existing planar arrangement. Each new selected cell must have a unique strict parent-face match; ambiguous matches reject. New cell samples and parent-face IDs are available for downstream checks. Original unselected cells never become exterior faces merely because a cut was added.

An open wall cell cannot lie in a plane, so a zero wall-side value rejects. A zero planar-side value must have a checked coincident cut support. The dot product of the parent's physical outward normal with the cut normal selects the one child whose material lies behind that existing cap. This prevents copying an outer/cavity cap into an empty regularized child.

## Paired cut caps and closure

Only section patches with material on both normal sides add a new interface. They use the same exact planar cell domain for both children, with opposite face senses and complete reversed curve traversal. One-sided coincident boundary patches are already supplied by the original exterior face and are not duplicated.

Each child is independently sewn by the existing mixed BRep algorithm, including endpoint noding and whole-support/witness checks. Every edge must have at least two uses and zero signed coedge sum; unbalanced results reject. Balanced nonmanifold results retain their incidence and `manifold: false`, rather than being promoted to a common solid. Empty children explicitly contain no faces.

Interface metadata gives the section-patch index and the negative/positive child face indices. It is a face-pair correspondence, not a claim that child coedge subdivision tables have identical edge IDs. The retained common section and per-child sewing tables support future common interface atom mapping.

## Queries and result classification

Child queries first test the selected face-domain closures. Other points must be strictly on the child's kept plane side and strictly inside the original regularized expression to be interior. This excludes isolated tangent remnants from an empty halfspace child without numerical offsets. Queries inherit the constructive source; arbitrary imported incidence is never used as a material oracle.

`kind: 'split'` means both children have volume. It also covers separated components on opposite sides with no cut interface. `one-sided` intentionally does not distinguish touching from disjoint: complete point/line contact classification remains future work. `empty` has two empty children.

## Validation and remaining work

The initial four-test group passed cavity cuts by orthogonal/oblique planes, independent rational material inequalities, coincident/tangent/disjoint cuts, opposed-cap cancellation, disconnected components, empty expressions, SSI-bounded perpendicular cylinders with a nonunit axis, strict parent-face samples and opposite interface face pairs. Copied split/source ownership is rejected. The balanced nonmanifold XOR test and broader final checks are recorded below.

Common Body region adoption, persistent clipped recipes, repeated cuts/Boolean reuse, common interface atom tables, rejoining and full contact relations remain incomplete. Existing scoped Lean declarations do not prove this new runtime path. This is a constructive split boundary, not general curved/NURBS Boolean or SolidCraft parity.

The full source-38 broad suite completed with 778 tests passing in one invocation (77180 ms), before adding the fifth XOR-contact case. The final five-test split file subsequently passed separately, including retained balanced nonmanifold incidence and contact-point boundary queries. Thus 779 distinct non-hard tests have passing evidence across those runs; this is not one 779-test invocation. The existing 133-declaration scoped audit passed. The old hard no-cut fixture was not rerun for this new entry point, and no source-38 hard-fixture result is claimed.
