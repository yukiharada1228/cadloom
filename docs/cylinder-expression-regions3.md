# Constructive cylinder expression material regions

`finiteCylinderExpressionRegions3` accepts only an owned manifold expression boundary. It restores every bounded face from the expression boundary record and uses the same private shell-nesting core as owned two-cylinder Boolean regions. Generic imported closed incidence is not accepted as a constructive material source.

For each shell, exact complete rational-line scans find a simple crossing of a strict face interior, rejecting contained supports and edge/vertex degeneracies. Parity of crossings gives all containing shells. Strict rational parameters between adjacent selected boundary events supply witnesses on both sides. For expression sources, a candidate pair touching any primitive boundary is retried; primitive leaf membership is never guessed at a discarded/internal boundary. Away from all primitive boundaries, the snapshotted Boolean expression supplies independent material truth.

A strict containment forest yields parent and depth. Even-depth bounded regions are material and odd-depth regions are void. The physical shell normal and the expression's truth on both side witnesses must agree with that assignment. Return the complete region table, immutable shell roles and one strict rational sample for each bounded material region. Cache entries are keyed by the actual privately owned expression boundary.

Termination relies on complete constructive finite-cylinder face selection and embedded manifold shells: generic lines through neighborhoods of open face interiors avoid the finite algebraic degeneracy sets. This is a documented construction with executable validation, not a new Lean theorem or arbitrary imported-shell embedding proof.

Regression coverage includes a three-level outer material/cavity/material island forest, empty expressions, exact independent primitive truth, cache identity and rejected structural copies. Existing two-cylinder region regressions cover oblique nonunit axes, disjoint roots, cavity coorientation, empty results and nonmanifold rejection after the shared-core refactor. Common Body adoption and editable expression recipes remain separate work.
