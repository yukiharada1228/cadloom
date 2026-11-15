# Planar face partition by a cylinder and rational planes

`partitionPlanarFaceByCylinder3` partitions an owned native planar domain by an infinite circular cylinder and optional rational planes. `partitionPlanarFaceByFiniteCylinder3` supplies the two axial cap planes and labels the resulting open planar cells against the filled finite cylinder. These include circular caps, elliptic domains, chart rectangles, and supported planar curve domains with holes. Source domains are cloned through the owned planar-face API; structural copies and substituted callbacks do not confer ownership.

## Complete conic arrangement

The plane/cylinder supporting section is either an ellipse, one tangent generator, two parallel generators, or empty. Ellipses remain exact native ellipses. Generator lines and rational plane/plane intersection lines are clipped to a chart box strictly containing the source face. No finite part of the source domain is lost by this auxiliary clipping.

Canonical source segments/elliptic arcs and cutter curves are intersected pairwise. Ellipse/ellipse quartics retain all real recovery branches; coincident supports contribute their bounded endpoints. Segment/ellipse and segment/segment intersections include their closed endpoints and overlaps. All curve endpoints, x-extrema and intersection x-coordinates partition the chart's x-axis. Auxiliary full-ellipse charts supply root evaluation without extending the actual source boundary sets used by the arrangement.

Inside an open x-slab, no graph branch starts, stops, becomes vertical, crosses or changes order. Sort all boundary/cutter y-events at a strict rational x witness, merge equal events and examine adjacent intervals. Keep an interval exactly when its strict rational interior witness is inside the owned source face. This handles source holes and concavity without assuming the source is a disk or convex. Every retained interval defines an embedded monotone strip domain. Their interiors are disjoint and their closed union is the original source face. Artificial vertical cuts remain; cells are not maximal connected faces.

Lower and upper graph boundaries are either nonvertical segments or selected lower/upper roots of positive ellipse quadratics. Endpoint values remain ordered by the complete event partition. The lower graph runs in increasing x, the right side upward, the upper graph in decreasing x and the left side downward; reverse the whole loop when the chart normal disagrees with the physical source normal. Omit collapsed vertical sides. Sewing nodes all supplied endpoints and preserves source curve-use paths and opposite shared coedge orientations. The whole result is an open surface partition, not a solid shell.

## Exact location and event-coordinate preservation

A cell query first checks the supporting plane and closed x-interval. Segment bounds use exact affine interpolation. For an ellipse equation `K*y²+L(x)*y+C(x)=0`, K is positive. The ellipse sign and the derivative sign `2*K*y+L(x)` distinguish below/between/above the roots and select the requested zero branch; no root reconstruction is needed for membership queries.

At an event x-coordinate, reuse a known endpoint when it belongs to the selected bound branch. If the known point belongs to the other branch of the same ellipse, reflect it by `y_other=-L(x)/K-y`. This is a rational affine map in the plane, so common-root rational-function and affine coordinate registries remain valid. An event on one branch therefore supplies the opposite branch without taking another nested radical. Other bound endpoints use exact closed-slice evaluation.

Ellipse/ellipse recovery now records its common root, coordinate numerator polynomials and denominator in the existing private rational-point registry. Exceptional zero recovery coefficients retain affine/biparametric representations. Plane-frame linear maps use the same source-aware linear evaluation. Ellipse membership for a registered rational point evaluates `rv²*Nx²+ru²*Ny²-ru²*rv²*W²` at its source root after checking the supporting plane; W² is strictly positive. Negative denominators do not reverse this quadratic sign. Rational-point elliptic-arc phase predicates also evaluate one linear numerator in the common source field. These preserve exact values and do not assume unrecorded relations between independent algebraic parameters.

Algebraic segment membership first checks every fixed coordinate and closed coordinate interval. A segment varying on one coordinate needs only that interval test; all other segments still require exact cross-product collinearity. These are necessary geometric exclusions, not floating-point shortcuts. They avoid unrelated field products during endpoint noding.

## Finite cylinder classification

For the optional cap planes `d·(p-o)-|d|²*lower` and `d·(p-o)-|d|²*upper`, an open planar cell is outside if the radial cylinder sign is positive or either axial inequality fails. It is inside when all three inequalities are strict. A cap-coincident planar patch satisfying the other inequalities is boundary. Such patches are retained explicitly, including reversed/nonunit cutter-axis parameterizations. Locations and plane signs classify open cells; their closed boundaries may carry several adjacent labels.

## Validation and limits

Fixtures check exact coverage and unique interior ownership on independent chart grids, loop continuity, endpoint/domain agreement, source-use paths, opposite shared directions and source-boundary ownership of open edges. They include intersecting circles, tilted ellipse sections, four genuine quartic intersections with the independent identity `4*x*y=1`, tangent/secant generators, enclosing/disjoint cylinders, holes, algebraic rectangle limits, inward tilted ellipse domains, finite rectangular cap material and coplanar cap boundary patches. Direct predicate tests cover negative rational-function denominators, off-plane points, each segment axis and non-axis collinearity.

These are documented constructions and executable tests, not new Lean proofs or whole-program TypeScript verification. Native planar boundaries are supported; arbitrary NURBS trims and additional curved cutter families are not. Maximal face consolidation, material face selection across both operands, global shell/material certification and persistent common mixed Body adoption remain required work. No mesh approximation or external CAD kernel is used.

## Multiple cylinder cutters

`partitionPlanarFaceByCylinders3` inserts every plane/cylinder section into the same arrangement before computing all pairwise events. The preceding vertical decomposition argument therefore applies to the union of these finite conic families: an open strip cannot cross any cutter zero. Each cell retains an immutable `cylinderSides` vector in input order; `side` and `cutter` preserve the first-cutter API. Duplicate and tangent supports remain valid, and a nonempty cutter list is required. Ownership is established by the same private factory registry.

`planar-multi-partition-cell` records the full cutter list and plane cuts. Replay recomputes the arrangement and requires the stored point to select exactly one strict interior cell; orientation reverses both loop uses and sense. Batch caches contain definitions only. The legacy single-cutter encoder rejects multi-cutter partitions instead of silently discarding cuts. Tests cover holes, crossing circles, generator lines, tangent and duplicate sections, intersecting oblique ellipses, sign vectors, closed coverage, sewing, and reversed domain replay. This remains a face partition, not material selection or a closed solid Boolean.
