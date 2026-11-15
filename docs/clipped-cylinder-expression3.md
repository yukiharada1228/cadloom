# Repeated halfspace cuts of cylinder-expression material

`clipFiniteCylinderExpression3(source, halfspaces)` intersects an actual owned finite-cylinder expression with a finite list of rational halfspaces. `refineClippedCylinderExpression3(result, additional)` appends constraints to the same original expression and regenerates its complete clipped boundary. It preserves earlier conditions rather than treating a previous cut child as an unclipped primitive.

Every input side is validated and snapshotted into an outward-oriented plane that keeps the negative side. All constraints, including duplicates and infeasibility-producing cuts, remain in original order. Refinement results and their condition arrays are frozen and have private factory ownership. Structural copies cannot be refined.

## Original exterior faces

Cylinder wall arrangements refine successively by every cut. Immediate source-cell maps compose back to the original expression's wall-cell indices. Only cells belonging to an originally selected material face survive, and every new plane side must be strictly negative. Original outward/cavity orientation remains unchanged.

Primitive caps are arranged with every original cylinder wall/cap and every new cut plane. Each new selected cell must have a unique strict original parent-face match. All positive plane-side cells are discarded. A zero side must be a coincident supporting plane, and its physical outward normal must agree with the normalized kept-negative inequality; opposite material sides are not copied into zero-volume remnants.

Provenance refers to the original expression face and the final wall/cap cell. It is not claimed as an immediate face mapping to a preceding clipped result.

## New cut faces and coincidence

For each cut, the existing exact two-sided section algorithm is run with all cut planes. Only source-interior patches (material on both original normal sides) supply new caps. Other constraints select their negative side on the planar cell. A zero side must be a coincident plane: opposed outward normals reject the patch because the common feasible set has no volume; equal outward directions emit only the earliest cut's representative. Original cap coincidence is already handled by exterior-face selection, so it is not duplicated.

This nodes cap/cap lines together with cylinder/SSI events before assembly. Each result is independently sewn with full mixed-curve support and endpoint checks. Every edge must have at least two uses and zero signed incidence; unbalanced boundaries reject. Balanced nonmanifold material remains explicit with `manifold: false`. Material queries check selected boundary closures, all strict normalized halfspaces and the original regularized expression without tolerances.

Contradictory or opposed coincident cuts yield empty regularized volume, while their conditions remain available in the result. Full lower-dimensional touching/contact relations are not reported by this API.

## Validation and remaining integration

Five new tests passed: successive and reordered cuts against independent rational material inequalities; coincident/reversed duplicate caps and incompatible constraints; a `10^-40` retained-volume strip; multiple planes actively clipping SSI material with independent grid truth; and no-cut/nonmanifold semantics. They also check composed original-face provenance, boundary closure, all retained inequalities, immutable input snapshots and copied/invalid-side rejection.

This is a constructive kernel boundary/material result, not yet common Body adoption or a reusable operand in unrelated Booleans. A multi-cut domain exporter, region adoption, persistent construction recipes, common Body dispatch and general clipped-leaf Booleans remain integration work. No new Lean theorem or full execution proof is claimed.

The full source-41 isolated suite subsequently passed all 795 non-hard tests in one invocation (93878 ms), including the committed active-oblique-SSI Body case from source 40. The existing scoped audit passed 133 declarations after adding the new source to its reviewed inventory. The old no-cut hard two-test fixture was not rerun for this new independent API; no source-41 hard result or whole-program proof is claimed.
