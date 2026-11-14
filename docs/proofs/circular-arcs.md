# Exact closed circular arcs

This layer trims rational supporting circles using rational or real-algebraic
endpoints. It adds curve membership, traversal order, subdivision and curve/curve
intersection, not filled-region Booleans or curved 3D BRep.

## Representation and closed-set conventions

`circularArc2(circle,start,end,{direction,fullCircle})` snapshots its inputs and
requires both endpoints to lie exactly on the circle. Direction is `ccw` by default
or `cw`. Equal endpoints represent a **point arc** by default. Setting `fullCircle`
requires equal endpoints and represents one entire positive-radius circle, with
that point as a traversal seam. A zero-radius supporting circle always normalizes
to its single point, even if the full-circle option was requested.

`fullCircleArc2(circle,direction)` chooses the rightmost point as the seam. Its x
coordinate can be irrational: isolate the positive root of X²-radiusSquared and
map it from the center. `reverseCircularArc2` swaps endpoints and orientation while
preserving the closed point set. There are no multiple-turn arcs.

`locatePointOnArc2` returns outside, endpoint or interior. A positive-radius full
circle has no boundary endpoint: the seam returns interior. A point arc returns
endpoint at its point and outside elsewhere. Curve intersections preserve isolated
contacts; these are not regularized area/volume operations.

## Membership of general algebraic coordinates

`classifyAlgebraicPointToCircle2` now accepts general `AlgebraicCoordinates2`.
For a point created by `algebraicPoint2`, an internal WeakMap records its immutable
shared parameterization and the existing polynomial sign predicate is used. Extra
fields on a general coordinate object never establish this correlation. Otherwise
the squared-distance expression is evaluated using exact algebraic field arithmetic
on the authoritative x/y values. Snapshots retain trusted correlation when present;
plain structural copies remain valid but may use the slower general path.

The registry is a runtime construction invariant, not a machine-verified provenance
mechanism. General field degree/coefficient growth remains as documented in
[algebraic-field.md](algebraic-field.md).

## Ordering a circle without numerical angles

For a positive-radius circle with center (cx,cy), partition valid circle points:

- Half 0: y>cy, or y=cy and x>=cx. It starts at the positive x ray and excludes the
  negative x ray.
- Half 1: all remaining points. It starts at the negative x ray and excludes the
  positive x ray.

Half 0 comes first in CCW order from the positive x ray. Within half 0, x decreases
strictly along the circle; within half 1, x increases strictly. Thus comparing the
half and then x (reversed in half 0) gives the exact cyclic order without atan2,
trigonometric approximation, coordinate cross products or algebraic multiplication.
The circle is the upper/lower graph of its circle equation over x, with opposite
traversal directions on those graphs.

The Lean theorem `circle_same_x_half_unique` proves over ordered fields that two
points on the same circle with equal x and ordinates on the same closed vertical
side of the center must have equal y. It follows from equality of the squared
ordinates and their common sign. This supports comparator equality: equal order
keys cannot identify distinct valid circle points. The theorem does not formalize
the whole cyclic-order/topological traversal algorithm.

Public `comparePointsAroundCircle2` rejects off-circle inputs. `comparePointsOnArc2`
requires both points on the arc, rotates the cyclic order to its start seam, and
reverses it for clockwise traversal. This also defines traversal order on a full
circle, where the seam is distinguished for ordering but not a boundary endpoint.

For a proper CCW arc with ordered start<end, circle membership is the closed linear
interval start<=point<=end. If start>end it is the union point>=start or point<=end
across the seam. CW membership swaps start/end. Equal endpoints are handled by the
explicit point/full distinction, not by an ambiguous zero-angle comparison.

## Subdivision

`splitCircularArc2` checks every cut, includes original endpoints, removes value-equal
duplicates and sorts by traversal order. Consecutive points delimit proper oriented
pieces. Full circles additionally connect the final point back to the first seam.
A full circle with no distinct cut stays full; a point arc stays one point arc.
No repeated cut or endpoint creates a new zero-length piece. The ordered chain
covers the input exactly, with disjoint relative interiors and shared endpoints.

## Intersection

Line/segment intersection first computes all supporting-circle hits and filters
by arc membership. Circle/line quadratic multiplicities are retained; arc trimming
does not assert a separate algebraic multiplicity at arc endpoints.

For distinct supporting circles, their finite exact intersection set is filtered
against both arcs. Point-circle degeneracies are already included in that circle
intersection routine. Finite results are sorted along the first arc.

For coincident positive-radius circles, collect the at most four distinct endpoints
and sort them cyclically. Between adjacent endpoints, membership of either closed
arc is constant. Direction-normalized endpoint indices determine each open cell's
membership, and Boolean AND selects the intersection cells. The all-selected case
is a full circle. Otherwise each selected cell with an unselected predecessor begins
one maximal component; follow selected cells to its end to construct an overlap
arc. Overlap orientation follows the first operand. A vertex belonging to both
closed arcs with neither neighboring cell selected is an isolated contact point.
Vertices incident to selected cells are already contained in the overlap arcs and
are not duplicated as isolated points.

Every circle point is either in an open cell or is one of these vertices, proving
completeness and absence of extraneous components. Intersections may have two
positive-length components, two isolated endpoints, or a positive-length component
plus a separate isolated point. `ArcIntersection2` distinguishes none, points, and
overlap (arcs plus isolated points). Component starts/isolated points are ordered
along the first operand; a full circle's seam can lie inside a component and does
not force that geometric component to split.

## Independent checks and verification limits

- All 128 oriented arcs between eight rational unit-circle marks compared with
  independent integer cyclic-index membership and traversal order at 16 known
  ordered samples; all 256 sample pairs check the circle comparator.
- All 20,736 pairs of those arcs and full circles compared with independent closed
  cyclic-set intersection. Samples lie at every endpoint and strictly between all
  neighboring marks. These fixtures cover cyclic endpoint ranks, directions,
  point/full arcs, maximal overlaps and isolated contacts.
- 1,024 arc pairs on two distinct unit circles select the independently known
  upper/lower intersection branches by their cardinal-interval ranks.
- Split chains, coverage, nonoverlapping interiors, repeated cuts, algebraic seam
  equality, endpoint/tangent/point-circle contacts, irrational endpoints, independent
  quadratic coordinates, input snapshots and invalid input.
- A unit-circle rational point with stereographic parameter 10^-40 is distinguished
  from the seam without an angular or coordinate tolerance. Extra unrelated metadata
  cannot forge the correlated point fast path.

The new uniqueness lemma and previous circle/field mathematics support the
construction. Arc factories, circle ordering, cell selection/merging, WeakMap and
TypeScript runtime behavior are **not fully machine-verified**. Numerical tests are
independent comparisons, not a claim of complete formal program verification.

Supporting circle centers/squared radii remain rational. Algebraic endpoints are
supported. [Mixed curve noding](curved-arrangements.md) now connects these primitives
into a vertex/edge graph. Tangent rotation systems/faces, filled curved Booleans,
NURBS and curved 3D solids remain future kernel work. General algebraic
coordinate predicates can be expensive; the same-circle order intentionally avoids
unnecessary field multiplication.
