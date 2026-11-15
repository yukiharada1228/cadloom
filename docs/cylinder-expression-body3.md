# Reusable finite-cylinder expression Bodies

`bodyFromFiniteCylinderExpression3` adopts an owned manifold expression boundary through its derived shell/material regions and common mixed face binding. All material samples must lie strictly inside the resulting material. Native-only operations retain backend checks; arbitrary imported topology and nonmanifold expression contacts are not promoted to owned Bodies.

`booleanCylinderBodies3` retains the original two-primitive path and accepts earlier two-cylinder Boolean Bodies and expression Bodies as operands. It combines their construction trees, remaps leaf indices and deduplicates identical owned primitive instances. It then recomputes all primitive-face arrangements for the combined expression. This is constructive CSG replay, not generic arbitrary BRep Boolean editing. Plane-clipped cylinders and other surface families still require additional leaf backends.

## Regularized point membership without a numeric epsilon

`locateFiniteCylinderExpression3` first checks all selected closed face domains. A retained face hit is boundary, including its artificial seams. An empty expression is outside. At any remaining point, the constructed boundary has no material transition in a neighborhood, even if a discarded primitive wall or cap passes through the point.

Choose the symbolic positive infinitesimal direction `v=(1,k,k²)` for successive nonnegative integers k. A nonzero radial or cap constant keeps its sign. At a zero radial constant, the sign of `[(|d|² v-(d·v)d)·(p-o)]` gives the linear coefficient. If it vanishes and `|d×v|²>0`, the positive quadratic term gives outside; a contained generator retries. At a zero cap constant, use the sign of `d·v`; a contained cap direction retries. The resulting strict leaf inequalities determine Boolean truth for all sufficiently small positive parameters. No finite epsilon is chosen.

Every active cap normal and nonzero radial gradient produces a nonzero degree-at-most-two polynomial in k. A finite union of their roots cannot exclude all nonnegative integers, so a usable direction exists. The radial gradient cannot vanish on a positive-radius cylinder support. Away from the selected regularized boundary, local material truth is constant, so a usable infinitesimal direction gives the point's material location. The argument relies on the complete constructive boundary selection; this does not validate arbitrary imported faces.

## Construction documents and replay

The `finite-cylinder-expression` recipe stores normalized finite-cylinder definitions and the snapshotted operation tree. The strict structural reader checks fields, operation kinds, safe indices, cycles and item/numeric budgets. Replay rebuilds primitive geometry, complete expression boundary and material regions, then compares every ordered common record field semantically through the existing exact construction equivalence check. A stored recipe label, material role or ownership-like flag is not a certificate.

Tests cover removed shared caps, canceled radial supports with a contained first candidate direction, algebraic point queries, three-level material/cavity/island roles, face queries, save/restore, restored self-difference, successive binary-result union, altered recipes, invalid indices, cyclic/extra-field/budget rejection and existing curved Body regressions. General oblique multi-operand/contact coverage, maximal face consolidation, arbitrary curved BRep import and other analytic/NURBS Boolean families remain incomplete. These are documented algorithms and executable checks, not a whole-program formal proof.
