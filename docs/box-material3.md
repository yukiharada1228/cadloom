# Exact box material bridge

`boundaryBoxMaterial3(origin,width,depth,height)` expresses a positive-size axis-aligned box in the bounded cylinder/plane material backend. Its six outward planes preserve the exact rational box boundary. This is a kernel representation bridge, without tessellation or tolerance snapping.

The bounded-expression constructor requires material to be contained in finite cylinder supports. An auxiliary vertical cylinder uses origin `(ox,oy,0)`, radius squared `width² + depth² + 1`, and axial interval `(oz − 1, oz + height + 1)`. For every point of the closed box, `dx² + dy² ≤ width² + depth²` and both axial inequalities are strict. Consequently this guard is strictly inactive throughout the box, including its boundary. Conjoining it with the six halfspaces gives exactly the closed box; it contributes no selected face. Positivity is checked before construction. No square root is approximated.

The owned result composes with `booleanCylinderMaterials3` and can use existing manifold Body adoption, complete domain persistence and replay. Construction documents store the full material program, including the auxiliary support; they do not pretend this is the native box construction tag. Public `booleanCylinderBodies3` still rejects native box inputs; automatic family dispatch is a subsequent integration step. General polyhedra, transformed boxes and NURBS are not supplied by this helper.

Validation includes six-plane-only boundary checks, manifold incidence, 125 independent rational classification points on a translated fractional box after full Body replay, invalid dimensions, and a box/cylinder intersection retaining both planar and cylindrical faces through replay.

The four operations are also checked against 80 independent strict rational points per operation, with signed edge balance retained even for nonmanifold XOR. A closed-manifold assertion is intentionally limited to manifold results; balanced contact material is not promoted implicitly.

All three new cases passed (the first two together, the four-operation case in a separate invocation), alongside all six existing material-expression regressions. TypeScript compilation and the existing scoped 133-declaration Lean audit passed. The prior 812-test full non-hard run belongs to the parent milestone and was not rerun here; no whole-program formal verification is claimed.
