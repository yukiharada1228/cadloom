# Common Bodies with repeated cylinder-expression halfspaces

`clipCylinderExpressionBody3(body, halfspaces)` appends halfspace conditions to an owned cylinder-family Body. It accepts finite/clipped cylinder primitives, binary cylinder results, uncut expressions, old single-cut expression Bodies and existing multi-cut expression Bodies. Restored results retain their constructive backend and can be cut again. Unrelated Body families and copied ownership claims reject.

The internal Body state retains actual owned source/condition objects. Existing multi-cut results append to their complete condition list; old single-cut results retain their original expression and original kept halfspace. Binary results are reconstructed as the equivalent finite-cylinder expression, while native clipped cylinders retain all their outward inequalities, including axial/inactive/infeasibility-producing conditions. A cut child is never silently converted to an unclipped finite cylinder.

## Complete boundary persistence and material adoption

`bodyRecordFromClippedCylinderExpression3` records every selected wall cell, original cap cell and cut-section cell, with correct original cavity orientation. All plane definitions remain in the existing bounded-domain schemas. Caller region declarations at this low level do not certify material.

`clippedCylinderExpressionRegions3` requires actual factory ownership and manifold status, independently restores/binds the whole mixed boundary and runs the existing exact nesting/coorientation analysis. Strict rational witnesses retry on primitive or cut-plane ambiguity. It derives void/material roles, handles cavities/islands and empty results, and retains a private identity-bound validation result. Body adoption reuses that already checked geometry and verifies incidence, issue absence, sample count and sample membership. Nonmanifold results remain available below Body3 and cannot claim solid ownership.

## Persistent recipe and replay

The new `clipped-cylinder-expression` construction tag stores original finite-cylinder operands, their Boolean expression and every ordered normalized halfspace. Regions, closed-incidence flags and saved geometric data are not trusted as proof: restoration regenerates the original material, reapplies all constraints, rederives regions and compares every ordered BodyRecord field. Removing conditions, flipping kept sides or changing material claims rejects if the material record no longer agrees.

Old construction tags remain accepted, including the single-cut tag; readers predating the new tag do not understand new recipes. New metadata is kept in immutable actual factory state, not serialized ownership flags. Empty/infeasible results preserve their conditions, so later cuts cannot accidentally restore removed volume.

## Validation and limits

Five connected tests passed: cut/restore/append with retained old constraints; dispatch from native clipped cylinders, binary results and old single-cut Bodies; nested cavity/island regions and checked-geometry reuse; empty contradictions, tampered recipes, schemas/budgets and nonmanifold/unrelated-family rejection; and repeated oblique/axial cuts through SSI material with whole Body replay and face-sample checks.

This connects repeated halfspace cuts and persistence. Clipped results are still not operands for unrelated cylinder unions/differences, which require halfspace predicates inside the material expression rather than a global condition list. Shared split atom mapping/rejoining, full contact classification, general curved/NURBS Booleans and full SolidCraft parity remain incomplete. The existing scoped Lean declarations do not prove this runtime refinement.

The complete source-42 isolated suite passed all 800 non-hard tests in one invocation (150225 ms), including old construction/archive compatibility and the active-oblique-SSI cases. The existing scoped audit passed 133 declared theorems after reviewing the added exporter and changed source hashes; this is not a new execution proof. The old no-cut hard two-test file was not rerun for this new repeated-clipping path, so no source-42 hard result or controlled speed claim is made.
