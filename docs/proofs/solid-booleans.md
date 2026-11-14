# Exact regularized polyhedral Booleans

`booleanSolids3(a,b,operation)` computes union, intersection, difference or symmetric
difference of finite polyhedral material sets. Array operands must pass
`prepareSolid3`: embedded closed consistently oriented manifold shells, with nested
cavity orientations. A previous Boolean result from this kernel instance is also
accepted, including nonmanifold edge/vertex contacts. A private WeakSet recognizes
these immutable results; arbitrary objects with caller-provided classifiers are
rejected. This registry is a runtime provenance guard, not a formal proof.

The operation is regularized: take the closure of the interior of the selected
material. A point- or edge-only intersection is empty. Touching material components
can produce a nonmanifold boundary on union or xor; such contacts are retained,
with `topology.closedManifold === false`, rather than silently separating points.

## 1. Supporting planes and candidate coverage

Divide each plane equation by its first nonzero normal component. This canonical
rational representation identifies coincident planes independently of triangle
winding or scale. Drop that coordinate, keeping the remaining axes in cyclic order.
The omitted coordinate is restored by the plane equation. The dropped normal
component is one, so counterclockwise projected winding corresponds to the canonical
positive normal. The existing Lean plane-lifting lemmas establish the scalar lifting
identity; the complete grouping/projection implementation is tested, not extracted
into Lean.

Within each operand, faces on a plane have disjoint relative interiors: proper
embedding forbids overlap. Even-odd planar filling therefore gives exactly their
coverage regardless of their orientations. Union of the two planar coverages
includes every possible result face, without duplicating coplanar overlap. Boolean
boundaries cannot appear away from the input boundaries, since both material
indicators are locally constant elsewhere.

## 2. Cell subdivision and two-sided classification

Triangulate the candidate coverage, then partition each triangle by every other
supporting plane. A positive-area cell witness is not on any distinct supporting
plane: the partition's strict-interior witness property rules this out. If an input
boundary changes along a candidate plane, the change occurs on an edge incident to
a noncoplanar face, hence on one of these cutting planes. Interior triangulation
edges between coplanar faces do not change material. Consequently the material
state on either side of a cell is constant over its relative interior.

For witness w and canonical normal n, write each other plane's value along the
normal as v+t*s, with v != 0 and s=normal_other·n. Choose

    h = min(1, min_{s != 0} |v/s| / 2).

Then h>0, and the open normal segments from w to w±h*n meet no other supporting
plane. The own-plane functional at these two endpoints has opposite nonzero signs,
because n·n>0. Thus both samples avoid every input face, and their exact membership
states give the two adjacent material states. Evaluate the requested Boolean truth
function at each sample. Retain a face if and only if the states differ. Orient it
from material toward exterior, reversing the canonical winding when necessary.

This handles coincident equal/opposite-facing patches without a special tolerance
or an arbitrary choice of which input owns the result face. Shared interfaces of
face-touching unions disappear; lower-dimensional intersections contribute no face.

## 3. Planar consolidation and conforming sewing

On each plane, consolidate retained polygons separately for each orientation using
nonzero planar union. The two orientations cannot overlap in positive area, since
the material states determine at most one orientation there. Triangulate each
consolidated region, and partition those triangles by the other supporting planes
once more. This preserves contact points/lines even where material orientation is
constant, such as a tetrahedron tip touching another face interior. Without this
second partition, planar consolidation could hide a required contact vertex in a
triangle interior. These projected partitions may subdivide the same spatial edge
differently on different supporting planes.

Gather every resulting vertex. On every convex polygon edge insert every gathered vertex
that lies on its closed segment, excluding its final endpoint, and sort by exact
dot product along the edge. Collinearity uses a zero cross product; the endpoint
bound is `(p-a)·(p-b) <= 0`. Consecutive edges therefore share endpoints once, and
incident faces use identical ordered subdivisions of a geometric shared edge.

If no extra boundary vertex was inserted, retain the triangle. Otherwise its
boundary is a convex polygon with collinear vertices. Its vertex average is strictly
inside, so a center fan produces only positive-area triangles, preserving every
boundary subdivision. New fan centers cannot lie on other patches' boundaries,
because they are in the relative interior of disjoint planar patches. Exact vertex
welding yields conforming topology without snapping.

Each oriented edge must have balanced forward/backward uses. Two uses are usual;
four or more are allowed at nonmanifold contacts. Runtime checks reject unbalanced
edges and any improper triangle-pair intersection. Exact axis-aligned bounding boxes skip a face pair only when at least one axis
is strictly separated; equality is retained, so no possible contact is skipped.
These checks support diagnosis;
the mathematical construction, not edge balance alone, establishes Boolean semantics.

## 4. Volume and point location

Selected faces form the oriented boundary of the regularized material. Summing
`a·(b×c)/6` gives its signed divergence-theorem volume, including cavity subtraction.
The implementation rejects a negative total. Reusing the exact generic-ray locator
on this boundary gives membership: a generic crossing in a face interior changes
material state, including when the boundary has edge/vertex contacts. Such contacts
are avoided by the ray family; a query on any output triangle is boundary. Far
from the finite boundary is exterior. Odd crossing parity is therefore inside.

## Evidence and limits

Independent interval arithmetic and a local-octant oracle check seven pairs of
axis-aligned boxes for all four operations: transverse overlap, equality, partial
coplanar containment, separation, face contact, edge contact and vertex contact.
Tests also cover cavities, nested islands, empty sets, chained contact results,
forged classifiers, vertex/edge contacts in a face interior, different triangulation diagonals, huge/tiny oblique rational
maps, and four operations on translated tetrahedra with simplex-volume and grid
membership oracles. Cube/octahedron results match independent corner-tetrahedron
volumes (intersection 20/3, union 12, cube difference 4/3, xor 16/3).

The arrangement, side classification, sewing, registry and reconstruction are
**not machine-verified TypeScript execution**. This document gives the construction
argument; tests provide independent comparisons. Existing scoped Lean arithmetic
and plane proofs remain applicable, without proving the complete Boolean algorithm.
There is no claim of industrial validation or optimized complexity. The algorithm
uses all supporting planes, exact planar arrangements, global vertex/edge tests and
quadratic final embedding checks; large models can be expensive and rational
numerators/denominators can grow. Curved faces, tolerance-based imports, feature
history and CAD file compatibility remain outside this polyhedral API.
