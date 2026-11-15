# Two-sided plane sections of finite-cylinder expressions

`sectionFiniteCylinderExpression3` constructs positive-area cap candidates on a rational plane for an actual owned finite-cylinder expression. It returns a complete planar arrangement and selected cell patches with exact material flags in the negative and positive normal directions. It does not yet assemble child Bodies, merge cell boundaries, or report isolated point/line contacts.

A patch with both flags true is an interior cut: it can supply opposite caps to the two children. Exactly one true flag identifies an existing material boundary coincident with the cut plane. Both false flags discard the cell. This distinction handles external caps, cavity caps and opposed caps cancelled by union/xor without assigning arbitrary truth to a primitive boundary.

## A finite rational working domain

For a cylinder point `p = o + t*d + r`, the axial parameter lies between the declared finite endpoints and the perpendicular displacement satisfies `|r_k| <= radius < radiusSquared + 1`. Hence the maximum absolute coordinate of the two rational axis endpoints, plus `radiusSquared + 2`, strictly bounds every material coordinate. The maximum over all operands bounds every finite Boolean expression built from them.

The plane chart selects a nonzero normal component as pivot, sets the other origin coordinates to zero and uses those two actual world coordinates as free chart coordinates. Solving the plane equation gives rational chart vectors. A rectangle bounded by the world-coordinate bound therefore strictly contains every possible material section. Its artificial outer edges cannot become selected material boundaries. The chart sense is chosen by the exact sign of the chart-normal/cut-normal dot product, so cap cell orientation agrees with the requested plane normal.

All cylinder walls, finite axial caps and optional extra planes are then noded by the existing complete planar finite-cylinder arrangement. Existing radial/cap sign columns determine each primitive's location on an open cell.

## Exact material on both sides

A strict primitive location stays unchanged under sufficiently small displacements along the cut normal. Boundary membership on a positive-area planar cell must come from a coincident axial cap: a regular circular cylinder wall cannot contain an open planar patch. The implementation checks that coincident cap rather than assuming one exists.

If `m` is that cap's outward normal and `n` is the cut normal, `m·n` is nonzero. The negative normal side is inside exactly when this dot product is positive; the positive side is inside exactly when it is negative. Applying the original Boolean expression separately to these two exact primitive truth vectors gives the patch's two material flags. No floating offset, tolerance or sampled epsilon is used.

Only owned constructive expressions are accepted. Planes and chart data are validated snapshots; section results have private factory ownership and frozen patch arrays. No arbitrary imported face or serialized ownership claim gains solid validity.

## Scope and next integration

These patches are bounded planar cell domains compatible with the existing domain codecs. Their boundaries can be paired with the wall/cap arrangements refined by the same cut plane. Selecting exterior pieces, sewing negative/positive children, retaining contact relations, deriving regions and persisting reusable clipped construction recipes remain required. The current function is a section/cap primitive, not a complete clipped-expression Boolean implementation.

Four new tests cover annular cavity sections against an independent rational grid, one-sided outer/cavity caps and reversed normals, tangent/disjoint planes, disconnected oblique sections against independent inequalities, opposed cap cancellation for all four operations, empty expressions, and rejected copied ownership/invalid planes. The connected nine-test group passed. Broader validation is recorded separately; no new Lean theorem or whole-program verification is claimed.

The full isolated source-37 regression suite passed all 774 tests outside the unchanged two-test hard oblique fixture in one invocation (116983 ms). The existing scoped audit passed 133 declarations after adding the new source to the reviewed inventory. The old hard fixture was not rerun: this change adds an independent section entry point and does not modify the existing expression/Body path, but no source-37 hard result is claimed.
