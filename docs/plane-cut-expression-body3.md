# Common Bodies for one-plane cylinder-expression cuts

`bodyFromCylinderExpressionSplit3(split, side)` adopts a constructive manifold cut child into common `Body3`. Its material regions and strict samples are derived, not supplied by the caller. Empty children are supported. Balanced nonmanifold children remain available through the lower-level split API and cannot acquire common Body ownership.

## Derived regions and validated geometry

`finiteCylinderExpressionSplitRegions3` first checks actual split ownership, a valid side and the child's manifold status. It exports complete face domains, independently restores/binds the mixed boundary and reuses the existing exact complete-line shell probing algorithm. That algorithm checks even crossing counts, strict nesting forests, shell orientation and material on both adjacent sides. Primitive-boundary and cut-plane-ambiguous rational witnesses retry instead of assigning arbitrary leaf truth.

The child material oracle is the original finite-cylinder expression restricted to the chosen strict plane side. A cut that leaves a cavity closed retains a void region and any nested material island. A cut opening that cavity to the exterior recomputes the forest; the opened cavity is not incorrectly retained as a bounded void. One strict rational material witness is retained per nonvoid bounded region.

The private region-result identity map retains the fully bound geometry with the checked final region table. Body adoption reuses that validated object, preserving the earlier no-duplicate-restoration invariant. It still checks closed manifold incidence, issue absence, sample count and actual sample membership before registering Body ownership. Copied source/region claims and arbitrary imported closed incidence cannot enter this route.

## Persistent single-cut construction

The `plane-cut-cylinder-expression` construction variant stores finite-cylinder operands, the complete Boolean expression and a `cut` halfspace with rational normal, offset and kept side. The existing strict reader freezes and budgets these fields. Old construction tags/version-1 records remain accepted; readers predating this new construction tag do not understand it.

Restoration regenerates the original expression, performs the plane split, derives the child's regions, adopts its common Body and compares every ordered BodyRecord field with the saved record. A construction label, region void flag or closed-incidence claim is not trusted as a material proof. Wrong side/tree/region declarations reject when they disagree with the reconstructed material.

## Scope and validation

The connected 14-test group passed. Three new region tests cover closed nested cavity/island forests, cavities opened by a cut, independent strict material witnesses, actual cached certificate identity, empty regions and nonmanifold/copied/invalid-side rejection. Five new Body tests cover both children, common queries, JSON construction replay, original strict face samples, SSI-bearing geometry, tampered side/tree/region data, strict schema budgets, empty Bodies and nonmanifold rejection.

This is one-plane adoption and replay of existing finite-cylinder expressions. Repeated cuts, plane-clipped leaves in later cylinder Booleans, common Body split dispatch and full contact classification are still required. Those unsupported operations are rejected rather than treating a cut child as an unclipped finite cylinder. General NURBS/analytic import and full SolidCraft parity remain incomplete. The existing scoped Lean declarations do not prove this new runtime construction/refinement.

The broad source-40 suite passed all 789 then-current non-hard tests in one invocation (84363 ms), and the existing 133-declaration scoped audit passed. A fifth Body test was then added and passed separately on the same runtime snapshot: the plane `2x+z=0` actively intersects unequal perpendicular-cylinder SSI in four shared vertices, all verified on both cylinders and the cut plane after Body replay. Both kept sides retain closed incidence, exact material samples and correct inside/outside/boundary queries. Thus all 790 distinct final non-hard tests have passing evidence across the broad run and added test, not one 790-test invocation. The earlier exploratory `x+z=0` case passed but did not actively cross SSI and is not used as evidence for that requirement.

The old two-test hard no-cut fixture was not rerun for this new path; its source-35 completion remains separate evidence. No source-40 hard-fixture result or controlled performance claim is made.
