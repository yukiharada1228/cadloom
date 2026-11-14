# Constructive convex cylinder/halfspace BReps

`clipCylinderBRep3(cylinder, lower, upper, halfspaces)` constructs the closed
regularized 3D intersection of a filled finite circular cylinder and finitely
many rational plane halfspaces. The cylinder axis, radius squared, bounds and
planes are exact rational data. Bounds are axis parameters, not unit-axis
distances. Curved walls, planar caps, intersection edges, an exact material
locator and a rational strict interior witness are constructed together.
The API does not infer a solid merely from a closed incidence table.

## Geometric set and canonical inequalities

Let the axis be o+t*d, D=d·d>0, radius squared R>0 and lower<upper. The filled
finite cylinder is

`|d×(p-o)|² ≤ R*D`,

`D*lower ≤ d·(p-o) ≤ D*upper`.

Orient every selected halfspace as n·p+k≤0, add both axial cap inequalities,
normalize by a positive rational coefficient and deduplicate. Opposite copies
of one plane leave no strict 3D material. A plane disjoint from the infinite
cylinder, or tangent along a generator, has one material side determined by
its value at the axis origin: keeping that side is redundant, while keeping
the other side has no 3D interior. Such planes create no positive-area facet.
The public plane list retains all canonical input/cap inequalities, including
redundant or rejecting constraints.

The result is convex, closed and bounded. Lower-dimensional-only material is
regularized to empty. Radius squared must be positive and bounds strictly
increasing; invalid base cylinders are rejected rather than treated as solids.

## Complete face domains

On the circular wall use four nonperiodic angular quadrant charts with the
existing exact cylinder-trim constructor and all active planes. A connected
chart component has one angular interval and a nonempty height fiber at every
interior angle. The two continuous height envelopes bound a disk-like patch;
an endpoint fiber may collapse to a cusp. Nonperiodicity prevents a full-circle
pinch from identifying the two ends of one boundary. Thus positive-area wall
components have one unambiguous disk boundary, even when whole-cylinder wall
loops would touch. The constructor checks this boundary condition.

For every active cutting/cap plane, construct its entire filled cylinder
section before applying the other halfspaces:

- If n·d≠0, the section is the exact ellipse disk supplied by the complete
  plane/cylinder reduction. Its chart normal agrees with the outward plane
  normal, so sense +1 is physical outward.
- If n·d=0 and Δ=R*N-h²>0, with N=n·n and h=n·o+k, put
  q=o-n*h/N and w=n×d. Every section point is q+w*s+d*t with
  `|s|≤sqrt(Δ/(N²*D))` and lower≤t≤upper. This is an exact algebraically
  bounded planar rectangle. Its frame normal w×d points opposite n, so its
  physical face sense is -1.

Trim these bases by every other active plane. The sections and all remaining
halfspaces are convex, so each nonempty planar cap has one connected interior
and one disk boundary. These are checked before sewing. Empty/area-zero cap
sections contribute no face. All constructed component samples are relative
interior points, and physical face normals point away from the material.

Every boundary point of the full-dimensional inequality intersection is on
the cylinder or at least one plane. These wall and cap constructions therefore
cover its boundary, including lower-dimensional intersections by closure.
Conversely every retained face point satisfies all solid inequalities. Redundant
tangent constraints only touch existing boundaries and need no extra face.

## Exact planar-polyhedron certificate

For a section, take a rational rectangle containing its complete analytic base
and clip that rectangle by the other halfplanes using rational polygon
clipping. Call the resulting convex polygon P and the analytic base S. If P
is empty or has zero exact signed area, S∩H has no 2D material either. If all
vertices of P satisfy the exact convex-section predicate, convexity gives
P⊆S. Since S⊆box, both inclusions yield P=S∩H. The polygon is then an exact
facet, with no approximation of the analytic section. Otherwise retain the
curved section path.

Ellipse membership uses its rational weighted quadratic. Parallel-plane strip
membership uses the rational squared bound on s. The initial boxes strictly
exceed the ellipse radii or strip width, so an artificial loose-box edge
cannot survive a successful containment certificate. Actual axial bounds of
strip sections remain geometric constraints. This makes plane-only solids
inside the cylinder efficient, including cases with no surviving wall patch.

## Strict 3D witness and regularized emptiness

A positive-area wall component sample is on the cylinder and strictly inside
all proper active plane inequalities. Contract it toward the rational axis
origin by p'=(1-epsilon)*p+epsilon*o. For 0<epsilon<1 the radial cylinder value
is strictly negative. Lean checks `cylinder_radial_contraction`, the identity

`F(s*q)=s²*F(q)+(s²-1)*R*D`.

All plane inequalities remain strict for sufficiently small epsilon by
continuity, even when the axis origin lies outside the finite axial slab.
Dyadic reduction finds such an epsilon with exact sign predicates.

If only planar faces remain, their relative interior samples are strictly
inside the cylinder and every other noncoincident halfspace. A small translation
opposite their outward rational normal makes their own plane inequality
strict as well. Coincident equal planes were deduplicated and opposite planes
already imply empty regularized material. The same exact dyadic search finds
a strict 3D point.

Refine the three algebraic coordinate certificates of that strict point and
try their rational interval midpoints. The midpoints converge to the point;
strict membership is open, so eventually a rational candidate satisfies all
inequalities strictly. The returned `interiorSample` is verified using rational
cylinder/plane evaluations. No approximate point is accepted without that
exact check.

Thus a positive-area constructed face gives a 3D interior witness. Conversely,
a nonempty bounded full-dimensional convex intersection has a regular boundary
patch on at least one of its finitely many plane/cylinder supports, which is
included by the face enumeration. No faces therefore means no 3D material;
return an empty complex and an outside-only locator. Point/line/disk-only
nonregularized contacts do not become false solid boundaries.

## Sewing and closed-shell audit

Every physical face/face intersection is a boundary from the common plane
constraint set. Plane/plane/cylinder intersections were noded by those domain
constructors. Artificial angular seams introduce endpoint T-junctions on caps;
exact endpoint sewing inserts those points into every incident boundary and
merges coincident pieces. Facet crossings absent from all endpoint data cannot
occur here: retained faces are boundaries of the same convex inequality set.
The generic sewing API itself does not provide this geometric guarantee.

Require exactly two opposite coedges per edge, manifold vertex links, no
incidence issues, one shell, and V-E+F=2 for the disk-face decomposition.
These checks audit the construction. The geometric embedding justification is
the known convex intersection and its complete outward face domains. A compact
convex set with a strict interior point has a spherical boundary by radial
projection from that point. The incidence checks alone would not establish
this for arbitrary input BRep data.

The face array uses the same indexing as the sewn topology; each entry retains
its owned surface domain, component index and planar support when applicable.
Sewing provenance records how each source curve maps to shared edges.

## Exact queries and validation scope

For a nonempty result, evaluate the cylinder and all active plane inequalities.
A positive value gives outside, any equality gives boundary, and otherwise the
point is inside. All feasible closed points belong to the regularized solid:
a convex combination with the certified strict interior point approaches each
one through strict interior material. Empty results always locate outside.
No ray casting or tessellated surrogate determines material.

Tests compare rational grids against independent disk/height/plane inequalities,
including intersecting oblique caps, algebraic-width parallel cuts, tangent
cap pinches, a box and an octahedron strictly inside the cylinder, arbitrary
rational axes and signed reparameterization, redundant/tangent/contradictory
constraints, lower-dimensional-only sets, irrational radii and width 1e-30.
They also audit closed incidence, physical normals, Euler characteristic,
relative face samples and strict rational interior witnesses.

The new scoped Lean identity supports radial contraction; the construction,
convex-topological arguments, root refinement and complete TypeScript execution
are not machine-verified. This family contains one filled circular cylinder
and finitely many rational planes. General cylinder/cylinder Boolean operations,
nonconvex unions, holes, arbitrary supplied BRep solid certification and curved
volume integration remain future work. Existing skew algebraic cases can still
be expensive; no uniform runtime/memory bound is promised.
