# Reusable plane-trimmed cylinder regions and connected interiors

`prepareTrimmedCylinder3(base, halfspaces)` constructs the regularized closure
of a finite cylinder product domain intersected with finitely many strict
rational halfspaces. The base is the existing band/angular-patch domain.
`splitTrimmedCylinderByPlane3` returns two reusable domains and shared boundary
incidence; `extractTrimmedCylinderComponent3` extracts a single connected
interior as a reusable domain. Component closures may touch at boundary points.
These are constructive cylinder surface domains, not closed solids.

## Canonical constraints and regularization

Each chosen halfspace is oriented as h(p)<0. Divide its coefficients by the
absolute value of the first nonzero normal coefficient; this preserves its
sign and permits exact duplicate detection. Opposite copies of one plane
have no strict 2D material in common and yield an empty regularized domain.
All normalized constraints remain in public metadata and factory ownership,
including constraints that already make the domain empty.

A plane disjoint from the supporting cylinder, or tangent along a generator,
has one constant strict sign on the remaining cylinder. Its value at the axis
origin determines that sign. A kept-side constraint is redundant; a rejected
side yields no 2D material. Thus a tangent generator is not made a false
boundary of the nonempty side. Other redundant constraints can remain active;
their geometry is handled by the same exact cell decomposition.

The regularized result discards isolated points and lines with no adjacent
2D material. In particular, a box whose intersection with a circle consists
only of its corners is empty as a cylinder surface region, even if its closed
nonregularized inequalities have a few feasible generators.

## Exact angular fibers

Write cylinder points as `p=r+t*d`, where r is on the reference circle through
the axis origin o, d is the rational axis direction, and t is its axis parameter.
For each plane, `h(p)=a*t+b(r)` with rational a=n·d.

- a>0 gives the strict upper bound t<-b/a;
- a<0 gives the strict lower bound t>-b/a;
- a=0 gives a strict angular condition b(r)<0.

Combine the base's rational height bounds with the maximum of lower bounds
and minimum of upper bounds. At a feasible angle, the strict fiber is a
nonempty open interval precisely when lower<upper and every angular-only
condition is strict. A fiber is convex, so it cannot have two separate
material pieces at one angle. Lean checks `positive_height_bound`, the scalar
inequality reduction for positive a. The negative case follows by negating
its coefficients; the finite envelope construction is not machine-verified.

## Critical angles and connected-component completeness

An angular-only condition can change sign only where its plane meets the
cylinder. Two finite height bounds can exchange order or close a feasible
fiber only where their boundary planes intersect on the cylinder. Include the
two base cap planes among the constraint planes. Enumerate all plane pairs:
intersect the rational planes to a line, then intersect that line with the
cylinder. A contained generator contributes one projected reference-circle
point; finite line hits contribute their axial projections. Coincident or
parallel distinct planes introduce no isolated critical angles.

Plane/cap pairs also supply the angular roots of every axis-parallel
constraint. Include base angular endpoints and rational-ray chart quadrant
points. Semantic coordinate equality removes duplicate cuts. Between adjacent
cuts, no bound ordering or angular inequality changes, so an exact open-arc
sample determines whether the complete angular cell has positive-height
material. Dyadic angular witnesses use one factory-owned algebraic parameter;
all height bounds at that sample are affine in the same parameter. Selecting
the lower/upper envelope and substituting their midpoint preserves that
correlation in the 3D interior sample.

Join adjacent feasible angular cells only when their common critical angle
also has a nonempty strict fiber. Join the circular seam only for a full base
circle. This is a finite graph with interval or circular connected components.
Within an angular cell, the lower and upper envelopes are continuous finite
maxima/minima of affine circle-coordinate functions. Their midpoint gives a
continuous interior section, and each open fiber contracts to that section.
Thus one feasible angular cell has connected interior. A nonempty strict fiber
at a common angle connects its two neighboring cells. An empty fiber prevents
an interior connection across that angle; no alternate path can jump over it,
since projecting an interior path to the circle is continuous. The resulting
graph components are exactly the connected relative interiors.

A zero-width fiber may still be a common point of two component closures.
It does not join those interiors. For a full circle with only one pinched
angle, the remaining angular interval can still be one connected interior;
its closure may have a singular boundary. This is why counting boundary loops
or boundary-graph components alone is insufficient.

## Complete oriented boundary construction

Node every original boundary curve by all active constraint planes. For each
constraint, obtain its complete finite base-domain section, retain its
positive-length transverse curves inside the base, orient them with material
on the physical left, and node them by all remaining planes. Elliptic curves
also receive chart extrema to ensure strict open-cell witnesses. Algebraic
segments retain their exact source correlation where available.

For each candidate cell and each constraint:

- h>0 rejects the cell;
- h<0 imposes no further boundary condition;
- if h=0, its whole curve must lie in that plane. Retain it only when the
  physical inward surface direction decreases h.

The last condition excludes coincident generators with incompatible material
sides and assigns boundary-coincident cuts to their adjacent 2D material.
Supporting tangent planes were handled already, so an active constraint cannot
have a vanishing inward derivative along a positive-length contained cell.
Original base boundary cells and internal cut cells cover all possible
regularized boundary arcs. Different planes can share the same cylinder
generator; exact coincident segment pieces are merged after noding.

Each surviving positive-length boundary cell belongs to exactly one angular
component. A boundary cell of positive angular extent cannot cross a component
bottleneck without a constraint intersection, which was noded. A generator at
a critical angle with positive height belongs to its one adjacent material
component; if both neighbors are connected through strict material they are
already one component. Generator lines at zero-width fibers have no positive
length and are not edges. This assigns each edge to a connected interior.

`locate` first checks the original base and all active plane signs. A point
with a zero active plane value belongs to the regularized closure only if a
retained boundary curve contains it; strict feasible points inherit the base
location. Component queries additionally restrict to their closed angular
cells. This includes common contact points in both component closures without
adding material to their interiors.

## Extraction, repeated splitting and incidence

Factory ownership records the base and all normalized constraints. Repeated
splitting recomputes the complete finite arrangement with one added halfspace,
so it does not depend on a previous boundary-loop decomposition being manifold.
The opposite child uses the opposite plane orientation. Merge coincident child
boundary cells into one common edge table; true shared edges have opposite
uses. If all component loops have unique incoming/outgoing continuation,
construct BRep incidence with one face record per connected component.

For component extraction, a proper angular component has a unique initial and
final cell in circular order, even across the representation seam. Restrict
the base angular patch to the closure of that interval and reconstruct the
same constraints. The result has exactly that component's material and one
connected interior. If there is only one component, the original owned domain
is already the desired result. Extracted domains can themselves be split.

A connected component whose boundary touches itself can still have `loops:
null`. Incidence construction remains unavailable in that case, while exact
geometry and further splitting remain available. Distinct component closures
can touch at a vertex even when each has valid loops; the assembled BRep's
vertex-link diagnostics report this global nonmanifold contact. Connected
interior certification does not certify a globally manifold shell or solid.

## Evidence and limits

Independent rational circle/height samples test explicit halfspace inequalities,
component coverage, interior samples and disjoint interior ownership. Fixtures
cover two and four disconnected angular intervals, lower-dimensional-only
intersections, a pinched fiber separating component closures, a connected
pinched domain with ambiguous loops, re-splitting that domain, redundant
coincident generators, arbitrary rational axes, constraint order, normal
rescaling, reversed face sense and component extraction across the seam.
Shared-edge direction/twin and per-component incidence checks supplement the
point-set oracles.

This constructor supports finite rational-plane halfspace trimming of the
existing cylinder product domains. It does not accept arbitrary manually
specified trim curves, curved halfspaces, cylinder/cylinder intersections or
arbitrary BRep tables. Singular boundary germ pairing within one component,
planar-domain splitting, general shell sewing and curved solid Booleans remain
future work. The scalar Lean lemma and source hashes do not prove the entire
TypeScript implementation.
