# Plane refinement of owned cylinder/SSI face cells

`partitionCylinderFaceCellsByPlane3` refines the complete owned face partition from `partitionCylinderFaceByCylinder3` or a previous plane refinement. Both strict sides remain in the output as closed embedded cells. Each cell retains the original cylinder-side classification, its immediate input-cell index, and an ordered sign vector for every applied plane. Source links preserve provenance through repeated operations. Structural copies and external location callbacks cannot supply ownership.

## Complete boundary events and ordered heights

Intersect the new plane with every non-generator boundary curve of an input cell. Native segment sides in these owned strip domains are axial generators: their projection is already an angular endpoint, so their plane intersections add no interior angular event. New height bounds reconstruct the cut vertices on those sides directly. Native circles, ellipses and algebraic segments use their complete native plane-section algorithms; owned SSI curves use complete quartic point recovery or whole-curve overlap. Project all finite events and native-piece endpoints onto the reference circle, then subdivide the input angular interval.

If `a = plane.normal · source.axis.direction` is nonzero, the plane is a height graph `h_plane(q) = -plane(q)/a`. Its relative order against either old height bound cannot change inside a refined angular cell: a change or isolated equality would be a boundary/plane event already used to cut the interval. Whole-bound overlap needs no zero-width cell. A strict interior height comparison decides whether to insert the plane between the old bounds. Construct one or two cells from consecutive bounds, using the same embedded strip construction as the original cylinder partition.

If a=0, plane membership is independent of height. Every interior generator intersected by the plane meets the strip's lower/upper boundary, so boundary intersections provide the complete angular events. Refine angular intervals only; no invalid vertical-plane height bound is constructed. Tangencies, disjoint planes and planes coinciding with a boundary leave strict open-cell signs and no zero-area faces.

Because the refinement subdivides each old angular interval and each height interval without gaps or overlapping interiors, its closed union equals the input partition. Previous sign labels remain valid on every new open cell. A strict interior witness determines the new plane sign. Closed boundaries may belong to cells with different labels: sign vectors classify open two-dimensional cells, not every point in their closures.

## Exact native ellipse boundaries and queries

`CylinderHeightBound3` now also represents a validated plane snapshot. Plane-bound endpoints project the base-circle point along the source axis onto that plane. Rational affine, biparametric and rational-function point registries preserve coordinate correlations during projection; public extra fields are not trusted.

The plane cuts an ellipse whenever a is nonzero. The CCW base-circle traversal maps to ellipse traversal with sign `source.axis.direction · (ellipse.frame.u × ellipse.frame.v)`. This gives the lower forward / upper reverse boundary orientation before the source face sense is applied. Closed endpoints coincide exactly with the domain bounds. Point queries compare the signed plane value times sign(a), with zero returned canonically, instead of rebuilding a root or evaluating trigonometry.

Sewing reconstructs shared native/SSI edges and ordered original-curve uses. Artificial generator cuts remain. The resulting surface partition has open edges only along its source domain boundary in the tested fixtures; it is not a closed solid shell.

## Finite cylinder material classification

`partitionCylinderFaceByFiniteCylinder3` first partitions by the cutter cylinder support, then refines by its lower and upper axial cap planes. The open-cell material location is inside exactly when the cylinder sign is negative and the two oriented cap signs are respectively positive and negative. A coincident cutter-wall cell within the axial window is boundary; it is not silently selected as material. All other cells are outside. Reversed/nonunit cutter axes use their own parameter bounds consistently.

The cutter's `PreparedCylinderFace3` records the complete circular wall band; the material interpretation also includes the filled disks at its two axial limits. The returned cells belong to the source wall only. The function does not construct the cutter's planar cap partitions or assemble a Boolean shell.

## Validation and limits

Tests cover strict sign vectors, exact location and complete source-domain coverage, unique interior ownership, source-cell and ordered edge-use provenance, opposite shared coedge directions, inward source sense, oblique quartic cuts, shared elliptic SSI components, repeated/reversed planes, plane-order changes, axis-parallel/tangent/disjoint/cap-coincident planes and copy rejection. Independent rational circle/height samples compare finite-cylinder labels with radial quadratic and axial inequalities, including coincident walls and shifted/reversed cutter axes.

These are documented constructive arguments and executable tests, not new Lean theorems or machine-verified TypeScript execution. Refinement currently accepts rational planes after one cylinder-support partition; arbitrary additional cylinder/NURBS cutters, maximal face consolidation, common mixed Body persistence, cutter cap construction, global shell embedding and material Boolean assembly remain incomplete. Generic algebraic cases can still be expensive.
