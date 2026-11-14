# Regularized cylinder-domain split by a rational plane

`splitCylinderFaceByPlane3(face, plane)` splits the finite band/angular-patch
domain from `prepareCylinderFace3` into the closures of its strict negative
and positive parts, relative to the cylinder surface. It returns exact
membership predicates, a common curve-edge table, signed region boundary uses,
and boundary loops where endpoint incidence determines a unique continuation.
The input domain is reconstructed from geometric data, ignoring supplied
callbacks and cached boundary/topology data.

A side can be disconnected or have a boundary contact singularity. It is a
surface region, not automatically one certified connected face. This API does
not silently discard such input or invent a pairing at a branching vertex.

## Noding and side classification

First classify the infinite supporting plane/cylinder intersection. A disjoint
plane has the whole cylinder on the sign of its value at the axis origin.
The same holds for a tangent-generator plane except on the generator itself.
Tangency does not split a 2D cylinder surface: the nonempty regularized side
keeps the entire original domain, including interior points of the tangent
generator. The other side is empty and there is no shared cut edge.

For a transverse ellipse or two simple generators, split every original
boundary curve at its plane intersections. Circle arcs also receive chart
quadrant cuts, avoiding a full-circle seam or tangent endpoint as a purported
open-cell witness. Generator segments use exact segment/plane intersection.
Each resulting open boundary cell has a constant nonzero plane sign, unless
its whole support lies in the plane. A point strictly inside the curve
classifies the cell's side.

For a boundary cell contained in the cutting plane, let N be the physical
oriented surface normal and T the physically oriented boundary tangent. The
original material is on the side N×T of this boundary. Its plane sign is
`sign(n·(N×T)) = -sign(T·(N×n))`. This assigns a coincident cap or angular
boundary to only the side containing its adjacent material. A tangent
cylinder generator was handled separately, so the inward derivative is
nonzero for a contained boundary cell here.

## Separating curves and physical orientation

Obtain the complete finite plane/cylinder-domain section. Its isolated contacts
are not separating edges. Likewise exclude positive-length section pieces
on the original domain boundary. Split elliptic sections at chart-axis
extrema; thus witnesses lie strictly inside their open cells even if a full
ellipse's seam coincides with an isolated boundary tangency.

Every remaining piece lies inside the original face and transversely separates
the two sides. Insert it exactly once in the common edge table. The negative
side traverses it along N×n, because N×(N×n) points toward decreasing plane
value after projection into the surface tangent plane. The positive side uses
the same edge ID with the opposite direction.

For a closed ellipse section the direction can be determined without large
products of algebraic coordinates. Its CCW tangent is aligned with the plane
normal crossed with the cylinder's outward normal: the ellipse bounds the
convex cylinder section disk. Hence the sign of T·(N×n) is the negative of
`face.sense * arc.direction * sign((U×V)·n)`.
A cap circle contained in the plane uses the same normal-orientation rule.
For a generator, T is a nonzero signed multiple of the rational cylinder axis
direction d. With D=d·d and q=p-o, the outward normal is
`D*q-d*(d·q)`. The relevant sign reduces to
`face.sense * sign(T relative to d) * sign((n×d)·q)`.
All positive scale factors are irrelevant. This is a rational linear predicate
on the algebraic origin, rather than independent conjugate products.

Lean checks the scalar triple-product identity `cut_boundary_orientation`.
The convex-section orientation argument, enumeration and full runtime are
not machine-verified.

## Loop incidence and regularized membership

Weld endpoint vertices by semantic exact algebraic equality. A region has
unambiguous boundary loops only if each used vertex has one incoming and one
outgoing use. Otherwise `loops` is null, preserving the complete oriented
edge-use graph without choosing a successor arbitrarily. For example, an
oblique section tangent to an original cap can make boundary loops touch at
one vertex. The exact region remains available even when its manifold loop
decomposition is unavailable.

When both sides have loops, `topology` builds explicit BRep incidence from the
common edges. Shared edges acquire opposite coedges and twins. The optional
`topologyFaces` maps the two region records into that incidence table; one
record can still contain multiple connected components. Neither the topology
builder nor this mapping certifies one connected face, a closed shell or a
solid. If loop continuation is ambiguous, topology and both face IDs are null.

On a strict plane side the corresponding region inherits the original domain's
membership and the other region is outside. On the cutting plane, a region's
regularized closure contains a point only when one of its retained boundary
edges contains it. This excludes isolated contacts with no adjacent 2D
material on that side. The disjoint/tangent supporting-plane case instead
inherits the complete original membership on its one material side, so an
internal tangent generator is not incorrectly made a new boundary.

The union of the two closed output regions is the original domain. Their
relative interiors are disjoint; separating edges belong to both boundaries.
Emptiness follows from absence of retained boundary edges: every nonempty
strict-side part of this compact finite cylinder product domain has a nonempty
boundary on the cylinder surface.

## Algebraic segment/plane intersection

`intersectAlgebraicSegmentPlane3` distinguishes a finite point, a coplanar
positive-length interval and the empty set, including collapsed segments.
Plane evaluation is affine along a segment; opposite endpoint signs give the
unique closed-segment root. Endpoint zeros are returned unchanged.

When the displacement is represented as rational, compute the slope as the
rational plane normal dotted with that displacement. The parameter is the
negative starting plane value divided by that rational slope, avoiding a
subtraction of dependent algebraic endpoint values. If the starting point
also has a trusted affine source parameter, substitute the new parameter into
that same source representation. The intersection point remains affine in the
original root. Other cases fall back to exact algebraic field operations;
a null rational getter never proves irrationality or causes input rejection.
The finite cylinder-section API reuses this construction.

## Tests and remaining work

Independent rational circle/product-domain samples check strict side membership,
union coverage and boundary location. Tests cover arbitrary rational axes,
plane rescaling, reversed face sense, physical generator traversal directions,
cap coincidence, tangent and disjoint planes, major angular patches,
irrational angular generators, shared-edge twins, closed loops, and explicit
ambiguity at touching boundaries. Independent rational segment intersection
fixtures and separate algebraic-coordinate cases check the segment helper.

Reusable rational-halfspace trimming and connected-component extraction are now
available via [trimmed cylinder domains](trimmed-cylinder3.md). The side records
of this older single-plane API are not themselves owned trimmed inputs; construct
a trimmed domain from its base and selected halfspace. Geometric germ pairing
at singular contacts within one component, arbitrary planar-face splitting, shell
sewing and curved solid Boolean operations remain future work. Source hashes and these tests do
not establish full TypeScript verification.
