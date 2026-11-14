# Mixed line/circular-arc noding with shared algebraic vertices

`splitCurves2` builds an immutable embedded curve graph from rational segments,
rational supporting lines with algebraic parameter trims, circular arcs with
algebraic endpoints, and isolated rational/algebraic points. It computes shared
vertices and geometric edges, not a half-edge rotation system or faces.

## Line intervals and canonical frames

`lineInterval2(line,startParameter,endParameter)` represents the closed image of the
parameter interval on a nonzero rational line. Bounds may be reversed or equal;
traversal follows startParameter to endParameter. Equal bounds give a point.
`pointOnLineInterval2`, `intersectLineIntervals2` and `intersectLineIntervalArc2`
include both endpoints exactly. Nonparallel rational supporting lines intersect at
a rational point, filtered by algebraic parameter comparisons. Parallel collinear
intervals intersect by exact max/min bounds; distinct parallel supports are disjoint.

For nonvertical o+t*d, the canonical line has

    origin = (0, oy-dy*ox/dx), direction = (1,dy/dx).

Its parameter is the x coordinate of the represented point. The Lean theorem
`canonical_line_frame` proves over fields that

    oy-dy*ox/dx+(ox+t*dx)*(dy/dx) = oy+t*dy,  dx != 0.

Vertical lines instead use origin=(ox,0), direction=(0,1), with y as parameter.
Thus canonical parameters increase in exact lexicographic point order, regardless
of the input frame's scale/direction. General point membership uses an exact linear
cross-product expression and closed parameter bounds. Factory-recorded shared
parameterizations retain the polynomial-sign fast path; unrelated extra fields
are not trusted.

## Input normalization and finite cuts

Each caller-owned input is snapshotted. Reversed line frames/trims are normalized
to increasing canonical parameters, retaining the source traversal sign. Zero-length
segments/line intervals and point arcs become isolated point inputs. A full circle's
arbitrary seam is replaced by its canonical rightmost seam: a seam is not a
geometric endpoint and must not make the graph depend on input parameter phase.
Arc direction is retained.

Initial cuts include every proper endpoint/point and both horizontal-axis extrema
of each supporting circle when they belong to that arc. The extrema are computed
by exact line/circle intersection and shared by all arcs on the same rational
circle. They split every full circle into at least two proper x-monotone arcs, and
prevent an unsplit loop from having only one vertex. A point arc contributes only
its point, not the other extrema of its supporting circle.

For every input pair, add all finite contacts and overlap boundaries to both cut
sets. Arc overlaps retain isolated contacts as well as positive-length components.
Endpoints of either coincident-support arc that belong to both are also included,
so trimming information cannot disappear inside a consolidated overlap. Line/arc
hits are filtered against the algebraic line trim. Point inputs split every curve
that contains them.

## Completeness of shared incidence

All primitive pair intersections are exact and complete by their prior constructions.
A graph vertex arises from an endpoint/point, a finite pair contact/overlap boundary,
or an added circle extremum. Every input containing that vertex acquires a cut:

- An endpoint belonging to another input is a pair contact/overlap endpoint. Full
  circle seams are handled as canonical extrema instead of arbitrary endpoints.
- If a finite contact lies in another coincident input, its intersection with the
  other support produces the same contact. If all supports coincide locally, a new
  overlap boundary must be an endpoint, already covered above.
- Coincident circle inputs add the same extrema independently. Any different
  support containing an extremum meets the first circle there and receives it from
  pair intersection. Point inputs are handled directly.

Consequently source incidence is complete, including coincident regions, triple
contacts and Steiner extrema. Sort all cut records lexicographically by exact
algebraic value and merge equal adjacent coordinates. Defining-polynomial text is
**not** a valid point key: distinct polynomials can represent the same coordinate.
Vertex IDs use semantic order; each vertex's sorted sources contain every input
that contains it. All stored coordinates and metadata are immutable snapshots.

## Atomic edges, merging and source orientation

For a normalized line, consecutive distinct cut IDs give consecutive parameters.
For an arc, exact traversal subdivision gives the analogous pieces. Completeness
means no global graph vertex lies in a piece's relative interior. Any two
noncoincident pieces can meet only at shared endpoints. In a coincident interval,
both inputs have every shared cut, so their atomic pieces coincide exactly.

All output edges have startID<endID. Line geometry uses the canonical increasing
line frame. Arc geometry is reversed when necessary to start at startID. A line
edge is uniquely determined by its two distinct vertices; an arc additionally needs
its exact supporting circle and canonical CW/CCW direction. The direction matters:
complementary semicircles share both vertices but must remain distinct edges.
These geometric keys merge overlaps without collapsing chords, lens boundaries or
complementary arcs.

Each edge retains sorted `sources` and `uses`, where a use's direction is +1/-1
relative to canonical start->end geometry. Line uses include the original trim/frame
orientation; arc uses include any canonical endpoint reversal. Opposite traversals
therefore share one geometric edge with opposite uses, rather than canceling the
geometry at the noding stage. These labels can support later winding propagation.
An input primitive has at most one turn, so it cannot use an atomic edge in both
directions; a contradictory duplicate is rejected as an invariant error.

Output line/arc edges themselves satisfy the `PlanarCurve2` input structure and can
be re-noded with algebraic endpoints. Isolated vertices must be reintroduced as
point inputs if they should survive an edge-only round trip. Geometry is stable
under input permutation, traversal reversal and re-input; source numbering/uses
naturally follow the new input list.

## Evidence and scope

- All 6,561 3x3-grid rational segment pairs differentially checked for both line
  interval intersection and full graph geometry/provenance against the existing
  segment implementation (itself previously checked against an integer oracle).
  Source use signs are checked against the original rational endpoint order.
- Mixed circle/chord graphs with irrational intersections and reversed overlapping
  arcs; duplicate full circles with different seams; crossing, tangent and nested
  circles; isolated algebraic points, point arcs and zero-length segments.
- Circle/line secant/tangent ranks with independently known vertex/edge counts,
  including nonhorizontal rational tangency. Near-tangent circle overlap versus a
  genuine gap at rational offset 10^-30 remains distinct.
- Every tested vertex's source list equals actual closed-curve membership. Every
  edge's endpoints match its shared vertex IDs, source arc coverage is checked by
  exact overlap, no vertex lies in an edge interior, and all edge-pair contacts are
  restricted to shared endpoints with no residual positive-length overlap.
- For every source, open primitives have E=V-1 atomic pieces, full circles E=V,
  point sources V=1,E=0. Permutation/reversal and re-input preserve geometry, reversed
  traversals negate uses, and nonminimal/equivalent root descriptions weld by value.

The new line-frame identity is Lean-checked. Pair loops, cut propagation, algebraic
value welding, geometric keys, source labels and graph reconstruction are
**not whole-program machine verification**; their construction arguments and
independent comparisons are stated above. The scoped Lean audit does not prove
complete TypeScript execution or the algebraic field implementation.

This implementation uses all input pairs and exact algebraic comparisons; bit sizes,
root separation and general coordinate predicates can make large models expensive.
It supports rational line/circle data with algebraic trims, without arbitrary
algebraic supporting coefficients or general splines. Tangent-germ ordering,
half-edges/faces, curved-region Booleans, curved BRep and CAD import remain future
kernel stages.
